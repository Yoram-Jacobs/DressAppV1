# Piper TTS Mobile Integration Guide (Sherpa-ONNX)

This guide documents how to integrate **Piper TTS** using **Sherpa-ONNX** as a 100% offline, on-device text-to-speech solution across React Native, Native Android, and iOS.

---

## 🏛️ Architecture & Companion Files

On-device speech synthesis via Piper requires four assets for a language model tier:
1. **Model file (`*.onnx`)**: The compiled neural network graph containing model weights.
2. **Configuration file (`*.onnx.json`)**: Contains voice metadata, phoneme settings, and speaker details.
3. **Lexicon file (`lexicon.txt`)**: Maps language words to phonemes.
4. **Tokens file (`tokens.txt`)**: Maps phonemes to ID indices used by the VITS model.
5. **Data directory (`espeak-ng-data`)**: Phoneme and language assets compiled from `espeak-ng`.

### Lexicon and Tokens Format

#### `lexicon.txt`
Maps individual words directly to phonemes (space-separated). E.g.:
```text
a ah
about ah b aw t
dress d r eh s
app ae p
```

#### `tokens.txt`
Maps characters/phonemes to integer IDs matching the model's output dictionary layers. E.g.:
```text
<pad> 0
<bos> 1
<eos> 2
a 3
b 4
ah 5
```

---

## ⚛️ 1. React Native Implementation

Use the library `react-native-sherpa-onnx-offline-tts`.

### Installation
```bash
npm install react-native-sherpa-onnx-offline-tts react-native-fs react-native-zip-archive
cd ios && pod install
```

### Application Code
```typescript
import TTSManager from 'react-native-sherpa-onnx-offline-tts';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';

const VOICE_ZIP_URL = 'https://your-server.com/assets/voice.zip';

async function initializePiper() {
  const targetDir = `${RNFS.DocumentDirectoryPath}/piper_assets`;
  const zipPath = `${targetDir}/voice.zip`;

  // 1. Download & Unzip assets if missing
  if (!(await RNFS.exists(targetDir))) {
    await RNFS.mkdir(targetDir);
    await RNFS.downloadFile({ fromUrl: VOICE_ZIP_URL, toFile: zipPath }).promise;
    await unzip(zipPath, targetDir);
  }

  // 2. Initialize the ONNX Runtime Engine
  await TTSManager.init({
    vits: {
      model: `${targetDir}/en_US-ryan-medium.onnx`,
      lexicon: `${targetDir}/lexicon.txt`,
      tokens: `${targetDir}/tokens.txt`,
      dataDir: `${targetDir}/espeak-ng-data`,
      noiseScale: 0.667,
      noiseScaleW: 0.8,
      lengthScale: 1.0, // Speech rate (higher = slower)
    },
    numThreads: 2, // Keeps CPU cool on mobile cores
  });
}

const handleSpeak = async (text: string) => {
  await TTSManager.speak(text);
};
```

---

## 🤖 2. Native Android (Kotlin) Implementation

Use `com.k2fsa.sherpa.onnx` from MavenCentral.

### Gradle Dependency
```kotlin
dependencies {
    implementation("com.k2fsa.sherpa.onnx:sherpa-onnx:1.10.0")
}
```

### Core Engine Wrapper
```kotlin
import android.content.Context
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class OnDeviceTtsEngine(private val context: Context) {
    private var ttsEngine: OfflineTts? = null

    // Run initialization in a background thread to prevent UI freeze
    suspend fun initializeEngine(
        modelPath: String, 
        lexiconPath: String, 
        tokensPath: String, 
        dataDirPath: String
    ) = withContext(Dispatchers.IO) {
        val vitsConfig = OfflineTtsVitsModelConfig(
            model = modelPath,
            lexicon = lexiconPath,
            tokens = tokensPath,
            dataDir = dataDirPath,
            noiseScale = 0.667f,
            noiseScaleW = 0.8f,
            lengthScale = 1.0f
        )

        val config = OfflineTtsConfig(
            vits = vitsConfig,
            numThreads = 2,
            debug = 0
        )

        ttsEngine = OfflineTts(config)
    }

    fun synthesizeTextToWav(text: String, outputFilename: String) {
        val engine = ttsEngine ?: throw IllegalStateException("TTS Engine not initialized")
        val audioData = engine.generate(text)
        val targetFile = File(context.filesDir, outputFilename)
        audioData.save(targetFile.absolutePath)
    }
}
```

---

## 🍏 3. Native iOS (Swift) Implementation

Link the C++ static core or use the Swift Package Manager wrapper for `sherpa-onnx`.

### Engine Wrapper
```swift
import Foundation
import sherpa_onnx

class PiperTTSWrapper {
    static let shared = PiperTTSWrapper() // Singleton to prevent RAM spikes
    private var tts: OfflineTts?

    private init() {}

    func initializeEngine(completion: @escaping (Bool) -> Void) {
        // Run instantiation on user-initiated background queue
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let bundle = Bundle.main
            
            guard let modelPath = bundle.path(forResource: "en_US-ryan-medium", ofType: "onnx"),
                  let lexiconPath = bundle.path(forResource: "lexicon", ofType: "txt"),
                  let tokensPath = bundle.path(forResource: "tokens", ofType: "txt"),
                  let dataDirPath = bundle.path(forResource: "espeak-ng-data", ofType: "") else {
                print("Missing foundational assets.")
                completion(false)
                return
            }

            var vitsConfig = OfflineTtsVitsModelConfig()
            vitsConfig.model = modelPath
            vitsConfig.lexicon = lexiconPath
            vitsConfig.tokens = tokensPath
            vitsConfig.dataDir = dataDirPath
            vitsConfig.noiseScale = 0.667
            vitsConfig.noiseScaleW = 0.8
            vitsConfig.lengthScale = 1.0

            var config = OfflineTtsConfig()
            config.vits = vitsConfig
            config.numThreads = 2 // Ideal for ARM Apple Silicon efficiency cores

            self?.tts = OfflineTts(config: config)
            completion(true)
        }
    }

    func speakText(text: String) -> [Float]? {
        guard let engine = tts else { return nil }
        let audio = engine.generate(text: text)
        return audio.samples
    }
}
```

---

## ⚠️ Essential Engineering Checklist for Production

* **Memory Management & Singletons**: Under no circumstances should you instantiate the `OfflineTts` model on every voice request. The model loads massive weights and compiles graphs into RAM, which will lead to Jetpack OS OOM termination or iOS Jetsam crashes. Always use a single persistent Instance (Singleton).
* **AV Foundation Binding (iOS)**: The output samples array (`[Float]`) representing raw PCM data must be mapped into `AVAudioPCMBuffer` to be fed into `AVAudioEngine` for output playback.
* **Background Model Loading**: Downloading voice files should be handled on-demand from a remote repo (like Hugging Face `rhasspy/piper-voices` repo) to prevent app binary bloat, and loading the model into memory must always be dispatched onto background worker threads.
