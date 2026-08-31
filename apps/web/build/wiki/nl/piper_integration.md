# Piper TTS mobiele integratiegids (Sherpa-ONNX)

In deze handleiding wordt beschreven hoe u **Piper TTS** kunt integreren met behulp van **Sherpa-ONNX** als een 100% offline tekst-naar-spraakoplossing op het apparaat in React Native, Native Android en iOS.

---

## 🏛️ Architectuur- en begeleidende bestanden

Voor spraaksynthese op het apparaat via Piper zijn vier middelen vereist voor een taalmodellaag:
1. **Modelbestand (`*.onnx`)**: de gecompileerde neurale netwerkgrafiek met modelgewichten.
2. **Configuratiebestand (`*.onnx.json`)**: Bevat stemmetadata, foneeminstellingen en sprekerdetails.
3. **Lexiconbestand (`lexicon.txt`)**: Wijst taalwoorden toe aan fonemen.
4. **Tokensbestand (`tokens.txt`)**: wijst fonemen toe aan ID-indexen die door het VITS-model worden gebruikt.
5. **Gegevensdirectory (`espeak-ng-data`)**: foneem- en taalelementen samengesteld uit `espeak-ng`.

### Lexicon- en tokensformaat

#### `lexicon.txt`
Wijst individuele woorden rechtstreeks toe aan fonemen (gescheiden door spaties). Bijvoorbeeld:
```tekst
een ah
over ah b aw t
jurk d r eh s
app ae p
```

#### `tokens.txt`
Wijst tekens/fonemen toe aan gehele ID's die overeenkomen met de uitvoerwoordenboeklagen van het model. Bijvoorbeeld:
```tekst
<pad> 0
<bos> 1
<eos> 2
een 3
b4
ah 5
```

---

## ⚛️ 1. Reageer op native implementatie

Gebruik de bibliotheek `react-native-sherpa-onnx-offline-tts`.

### Installatie
``` bash
npm installeer react-native-sherpa-onnx-offline-tts react-native-fs react-native-zip-archief
cd ios && pod installeren
```

### Applicatiecode
```typisch
importeer TTSManager van 'react-native-sherpa-onnx-offline-tts';
importeer RNFS van 'react-native-fs';
import { uitpakken } uit 'react-native-zip-archief';

const VOICE_ZIP_URL = 'https://uw-server.com/assets/voice.zip';

asynchrone functie initializePiper() {
  const targetDir = `${RNFS.DocumentDirectoryPath}/piper_assets`;
  const zipPath = `${targetDir}/voice.zip`;

// 1. Download en pak assets uit als ze ontbreken
  if (!(wacht op RNFS.exists(targetDir))) {
    wacht op RNFS.mkdir (targetDir);
    wacht op RNFS.downloadFile({ fromUrl: VOICE_ZIP_URL, toFile: zipPath }).belofte;
    wacht op unzip(zipPath, targetDir);
  }

// 2. Initialiseer de ONNX Runtime Engine
  wacht op TTSManager.init({
    vits: {
      model: `${targetDir}/en_US-ryan-medium.onnx`,
      lexicon: `${targetDir}/lexicon.txt`,
      tokens: `${targetDir}/tokens.txt`,
      dataDir: `${targetDir}/espeak-ng-data`,
      ruisSchaal: 0,667,
      ruisSchaalW: 0,8,
      lengteSchaal: 1,0, // Spraaksnelheid (hoger = langzamer)
    },
    numThreads: 2, // Houdt de CPU koel op mobiele cores
  });
}

const handleSpeak = async (tekst: string) => {
  wacht op TTSManager.speak(tekst);
};
```

---

## 🤖 2. Native Android-implementatie (Kotlin).

Gebruik `com.k2fsa.sherpa.onnx` van MavenCentral.

### Graduele afhankelijkheid
```Kotlin
afhankelijkheden {
    implementatie("com.k2fsa.sherpa.onnx:sherpa-onnx:1.10.0")
}
```

### Kernmotorwrapper
```Kotlin
importeer android.content.Context
importeer com.k2fsa.sherpa.onnx.OfflineTts
importeer com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
importeer java.io.bestand
importeer kotlinx.coroutines.Dispatchers
importeer kotlinx.coroutines.withContext

class OnDeviceTtsEngine (privéwaardecontext: Context) {
    private var ttsEngine: OfflineTts? = nul

// Voer de initialisatie uit in een achtergrondthread om te voorkomen dat de gebruikersinterface vastloopt
    plezier onderbreken initializeEngine(
        modelPad: String, 
        lexiconPad: String, 
        tokensPad: String, 
        dataDirPath: Tekenreeks
    ) = withContext(Dispatchers.IO) {
        val vitsConfig = OfflineTtsVitsModelConfig(
            model = modelpad,
            lexicon = lexiconPad,
            tokens = tokensPad,
            dataDir = dataDirPath,
            ruisschaal = 0,667f,
            ruisSchaalW = 0,8f,
            lengteSchaal = 1,0f
        )

valconfig = OfflineTtsConfig(
            vits = vitsConfig,
            aantalDraden = 2,
            debuggen = 0
        )

ttsEngine = OfflineTts(config)
    }

fun synthesizeTextToWav(tekst: String, outputBestandsnaam: String) {
        val engine = ttsEngine ?: throw IllegalStateException("TTS Engine niet geïnitialiseerd")
        val audioData = engine.generate(tekst)
        val targetFile = Bestand(context.filesDir, outputFilename)
        audioData.save(doelbestand.absolutePath)
    }
}
```

---

## 🍏 3. Native iOS (Swift)-implementatie

Koppel de statische kern van C++ of gebruik de Swift Package Manager-wrapper voor `sherpa-onnx`.

### Motorwikkelaar
```snel
Stichting importeren
importeer sherpa_onnx

klasse PiperTTSWrapper {
    static let shared = PiperTTSWrapper() // Singleton om RAM-pieken te voorkomen
    privé var tts: OfflineTts?

privé init() {}

func initializeEngine (voltooiing: @escaping (Bool) -> Void) {
        // Voer instantiatie uit op een door de gebruiker geïnitieerde achtergrondwachtrij
        DispatchQueue.global(qos: .userInitiated).async { [zwakke zelf] in
            let bundel = Bundel.main
            
            bewaker laat modelPath = bundel.pad (forResource: "en_US-ryan-medium", ofType: "onnx"),
                  let lexiconPath = bundel.pad(forResource: "lexicon", ofType: "txt"),
                  let tokensPath = bundel.pad(forResource: "tokens", ofType: "txt"),
                  let dataDirPath = bundel.pad (forResource: "espeak-ng-data", ofType: "") else {
                print("Ontbrekende fundamentele elementen.")
                voltooiing (onwaar)
                terug
            }

var vitsConfig = OfflineTtsVitsModelConfig()
            vitsConfig.model = modelPath
            vitsConfig.lexicon = lexiconPath
            vitsConfig.tokens = tokensPath
            vitsConfig.dataDir = dataDirPath
            vitsConfig.noiseScale = 0,667
            vitsConfig.noiseScaleW = 0,8
            vitsConfig.lengthScale = 1,0

var config = OfflineTtsConfig()
            config.vits = vitsConfig
            config.numThreads = 2 // Ideaal voor ARM Apple Silicon-efficiëntiekernen

zelf?.tts = OfflineTts(config: config)
            voltooiing (waar)
        }
    }

func speakText(tekst: String) -> [Zwevend]? {
        bewaker laat motor = tts else { return nul }
        laat audio = engine.generate(tekst: tekst)
        retourneer audio.samples
    }
}
```

---

## ⚠️ Essentiële technische checklist voor productie

* **Geheugenbeheer & Singletons**: Onder geen enkele omstandigheid mag u het `OfflineTts`-model instantiëren bij elk spraakverzoek. Het model laadt enorme gewichten en compileert grafieken in het RAM, wat zal leiden tot het beëindigen van Jetpack OS OOM of het vastlopen van iOS Jetsam. Gebruik altijd één persistent exemplaar (Singleton).
* **AV Foundation Binding (iOS)**: De output samples array (`[Float]`) die ruwe PCM-gegevens vertegenwoordigt, moet worden toegewezen aan `AVAudioPCMBuffer` om te worden ingevoerd in `AVAudioEngine` voor het afspelen van de uitvoer.
* **Achtergrondmodel laden**: het downloaden van spraakbestanden moet op aanvraag worden afgehandeld vanaf een externe opslagplaats (zoals de Hugging Face `rhasspy/piper-voices` opslagplaats) om binaire bloat van de app te voorkomen, en het laden van het model in het geheugen moet altijd worden verzonden naar threads van achtergrondwerkers.