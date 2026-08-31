# DressApp Audio & Speech Architecture: STT & TTS Deep-Dive

This document provides a comprehensive technical breakdown, architectural analysis, and user guide for the Speech-to-Text (STT) and Text-to-Speech (TTS) subsystems within the DressApp ecosystem. It details both the server-side multimodal AI pipelines and the local web/mobile client speech fallbacks.

---

## 1. Executive Summary & Value Proposition

### High-Level Overview
DressApp integrates a dual-tier, highly resilient audio system designed to offer an immersive, hands-free conversation loop with the AI Virtual Stylist. The system supports full bidirectional speech:
* **Speech-to-Text (STT)**: Transcribes user voice commands to guide closet queries, outfit creation, and style advice. It automatically routes between an on-premises Gemma4 sidecar container and Google's native Gemini 2.5 Flash multimodal endpoint.
* **Text-to-Speech (TTS)**: Synthesizes the Virtual Stylist's outfit advice into high-quality spoken audio. It leverages Gemini's native audio generation capabilities at the server level, with automatic client-side Web Speech synthesis and on-device offline Piper TTS engines for mobile pods.

### Architectural Flow

```mermaid
graph TD
    User([User]) -->|Voice Input| FE[React Frontend]
    
    subgraph Client-Side (Browser / Mobile)
        FE -->|1. Web Speech API STT| LocalSTT[Local Speech Recognition]
        FE -->|2. Mic Recording| WebM[Audio Blob: audio/webm]
        LocalSTT -->|Text Transcript| TextQuery[Text Input Field]
    end

    WebM -->|POST /api/v1/stylist| API[FastAPI Gateway]
    TextQuery -->|POST /api/v1/stylist| API

    subgraph Backend Services
        API --> STT[STT Service: EyesSTTService]
        STT -->|Check Override| Provider{Provider?}
        Provider -->|Gemma| Gemma[Gemma4 Sidecar Container]
        Provider -->|Gemini| GeminiSTT[Gemini 2.5 Flash Multimodal]
        Gemma -->|Fallback| GeminiSTT
        
        API --> Brain[Stylist Brain Service]
        Brain -->|Text Response| TTS[TTS Service: GeminiTTSService]
        TTS -->|gemini-2.5-flash response_modalities: AUDIO| GeminiTTS[Gemini 2.5 Flash Multimodal]
    end

    GeminiTTS -->|Raw Audio Bytes| TTS
    TTS -->|Base64 Encoded| API
    API -->|JSON Response: tts_audio_base64| FE
    
    FE -->|Decode & Play| Playback[HTML Audio / Waveform Player]
    FE -->|Fallback if No Server Audio| LocalTTS[Web Speech API: speechSynthesis]
```

### User Value Proposition
* **Frictionless Interaction**: Users can describe styling dilemmas, query closet items, and request outfit matches entirely hands-free.
* **Low Latency & High Snappiness**: Real-time client-side speech recognition provides instant visual transcription feedback as the user speaks.
* **Fail-Safe Robustness**: If the dedicated Gemma4 model fails, the system automatically falls back to Gemini 2.5 Flash. If server-side speech generation fails, the browser immediately synthesizes text locally using the Web Speech API.
* **Privacy & Offline Capabilities**: The Piper/Sherpa-ONNX integration pattern ensures that mobile client applications can run speech generation entirely on-device, saving server bandwidth and securing user privacy.

---

## 2. Comprehensive User Manual

### Visual Interface Topology (Stylist Chat Panel)

```text
+---------------------------------------------------------+
| [<-] AI Stylist                      [Session List] [ ] |
+---------------------------------------------------------+
|                                                         |
|  (AI) Here is an elegant outfit recommendation...       |
|      [================== Waveform Player ============]  |
|                                                         |
|  (User) "What shoes go well with these green sneakers?" |
|                                                         |
|  (AI) I suggest styling them with beige chinos.         |
|      +-------------------------------------------+      |
|      | [Volume Icon] Play reply (השמע תשובה)     |      |
|      +-------------------------------------------+      |
|                                                         |
+---------------------------------------------------------+
| [📷] [🎤 Hold/Tap to Speak] [ Type your message...  ] [>]|
+---------------------------------------------------------+
```

### Mode & Workflow Walkthroughs

#### 1. Voice Query Mode (Speech-to-Text Input)
* **Start Recording**: The user taps the microphone (`[🎤]`) button in the stylist input bar.
* **Browser STT (Primary)**: In supported browsers (e.g., Chrome, Safari), the system requests mic permissions and invokes `window.SpeechRecognition`. Interim transcripts appear in the input bar in real time.
* **Recording/Fallback (Alternative)**: On browsers lacking speech recognition APIs (e.g., Firefox Desktop), the interface defaults to recording raw WebM audio chunks via `MediaRecorder`.
* **Submitting**: Once speech stops, the text query is automatically populated and sent. If the fallback recording was used, the audio binary is packaged in a `MultipartForm` under `voice_audio` and analyzed on the backend.

#### 2. Spoken Response Mode (Text-to-Speech Output)
* **Auto-Play**: After the AI Stylist processes a request, the response is played automatically if server audio is generated.
* **Manual Replay**: Each AI message card contains a dynamic button labeled **Play reply** (or localized variants like **השמע תשובה**). Clicking it streams the synthesized audio again.
* **Toggle Stop**: Clicking the button while audio is playing immediately cancels the audio stream.

### Error Handling & User Feedback
* **Microphone Permissions Denied**: The frontend catches permission errors and raises a toast notification instructing the user to enable microphone access in browser settings.
* **Unsupported Browser Fallbacks**: If the browser lacks native recognition, the UI safely falls back to standard text inputs.
* **Text-to-Speech Silence**: If speech synthesis fails, a console trace logs the failure, and the interface resets the speech button back to the idle state to prevent button lock-ups.

---

## 3. Technology Stack & Capability Deep-Dive

### Core Orchestration & AI/Logic

#### Dual-Tier Speech-to-Text (`stt_service.py`)
The backend orchestrator uses `EyesSTTService` to implement a robust, fail-safe dual-path transcription system:
1. **Dedicated Container Path (Gemma4)**: When `EYES_PROVIDER=gemma` is active, the service submits a `POST` request with the audio file to the Gemma4 container space (`EYES_GEMMA_SPACE_URL`).
2. **Native Multimodal Path (Gemini 2.5 Flash)**: If the Gemma container fails or is bypassed, `GeminiSTTService` takes over. The audio bytes are converted into an inline multimodal object and processed directly by Gemini:
   ```python
   # Gemini STT transcription request configuration
   text = await client.vision(
       user_parts=[
           "Transcribe this audio precisely. Output ONLY the raw transcription text in the language it was spoken. Do not add any introductory or concluding text, formatting, or commentary.",
           (audio_bytes, content_type)
       ],
       temperature=0.0,
   )
   ```

#### Multimodal Server-Side TTS (`tts_service.py`)
Instead of relying on third-party cloud audio APIs, DressApp leverages **Gemini 2.5 Flash** native speech synthesis:
* **Audio Model Config**: The request requests Gemini to respond explicitly in audio format:
  ```python
  config = {
      "response_modalities": ["AUDIO"],
      "speech_config": {
          "voice_config": {
              "prebuilt_voice_config": {
                  "voice_name": voice_name  # puck, aoede (female), charon (male)
              }
          }
      }
  }
  ```
* **Payload extraction**: The backend extracts the returned audio bytes from the candidate's `inline_data.data` parts, encodes them to base64, and returns them to the frontend.

---

### Data & Context Pipelines

#### Backend API Pipeline (`logic.py`)
When a stylist query hits the backend:
1. `logic.py` checks if `voice_audio` is provided. If so, it invokes `stt_service.transcribe` to resolve the audio into a textual transcript.
2. The transcript is processed by the Stylist Brain to generate a contextual recommendation.
3. The generated text is fed to `tts_service.speak_to_bytes` using the user's preferred voice.
4. The output bytes are converted to base64 and returned in `tts_audio_base64`.
5. Each stage logs its latency (`whisper_ms`, `stylist_brain_ms`, `tts_ms`) to monitor performance.

---

### Frontend & Client Architecture

#### Web Speech API Wrapper (`speech.js`)
* **BCP-47 Mapping**: The frontend maps local 2-letter language codes to their full BCP-47 counterparts (e.g., `he` -> `he-IL`, `ar` -> `ar-SA`) to fetch correct regional speech synthesis voices.
* **Ensure Voices Loaded**: Chrome and Safari load system-native voices asynchronously. The frontend primes voices using a promise-wrapped listener on the `voiceschanged` event:
  ```javascript
  const synth = window.speechSynthesis;
  synth.addEventListener('voiceschanged', () => resolve(synth.getVoices()));
  ```
* **Voice Matching Hierarchy**: If the exact regional voice is missing, it falls back to the parent language prefix or bare language code before defaulting to standard English.

#### Local TTS Fallback
If the backend does not return `tts_audio_base64` (or if it is null), the frontend leverages the client browser's native text-to-speech engine:
```javascript
// Native browser speech fallback call
if (ttsSupportedRef.current && !audioUrl) {
  await speak(spokenText, userLang);
}
```

#### On-Device Piper Offline TTS Blueprint (Mobile Client Pods)
For mobile platforms (React Native, Android, and iOS) where servers should be bypassed for offline operations:
* **Sherpa-ONNX Integration**: Uses the ONNX runtime to execute VITS models locally.
* **Component Architecture**:
  1. **Model & Config (`*.onnx`, `*.onnx.json`)**: Pre-trained voice weights stored inside the application package.
  2. **Lexicon (`lexicon.txt`)**: Maps words directly to phonetic sounds.
  3. **Tokens (`tokens.txt`)**: Maps phonemes to specific model output layers.
  4. **Phonemizer (`espeak-ng-data`)**: Compiled assets executing language-specific phoneme translation on-device.
* **Language-Voice Mapping**: The app automatically sets the default voice ID mapping during registration or language switches, eliminating manual dropdown configurations:
  * **English**: `en_US-ryan-medium`
  * **Hebrew**: `he_IL-hebrew-medium` (community model)
  * **Arabic**: `ar_JO-kareem-low`
  * **Hindi**: `hi_IN-rohan-medium`
  * **Spanish**: `es_ES-carl-medium`
