# DressApp Audio- en spraakarchitectuur: STT & TTS Deep-Dive

Dit document biedt een uitgebreide technische analyse, architectuuranalyse en gebruikershandleiding voor de subsystemen Speech-to-Text (STT) en Text-to-Speech (TTS) binnen het DressApp-ecosysteem. Het beschrijft zowel de multimodale AI-pijplijnen aan de serverzijde als de terugval in spraak van lokale web-/mobiele clients.

---

## 1. Samenvatting en waardevoorstel

### Overzicht op hoog niveau
DressApp integreert een dual-tier, zeer veerkrachtig audiosysteem dat is ontworpen om een meeslepende, handsfree gesprekslus te bieden met de AI Virtual Stylist. Het systeem ondersteunt volledige bidirectionele spraak:
* **Speech-to-Text (STT)**: Transcribeert spraakopdrachten van gebruikers om vragen over kleding, het maken van outfits en stijladvies te begeleiden. Het routeert automatisch tussen een lokale Gemma4 zijspancontainer en het eigen Gemini 2.5 Flash multimodale eindpunt van Google.
* **Tekst-naar-spraak (TTS)**: zet het outfitadvies van de virtuele stylist samen in gesproken audio van hoge kwaliteit. Het maakt gebruik van de mogelijkheden van Gemini voor het genereren van audio op serverniveau, met automatische Web Speech-synthese aan de clientzijde en offline Piper TTS-engines op het apparaat voor mobiele pods.

### Architecturale stroom

```Zeemeermin
grafiek TD
    Gebruiker([Gebruiker]) -->|Spraakinvoer| FE[Reageer frontend]
    
    subgraph Client-kant (browser / mobiel)
        FE -->|1. Webspraak-API STT| LocalSTT[Lokale spraakherkenning]
        FE -->|2. Microfoonopname| WebM[Audioblob: audio/webm]
        LocalSTT -->|Teksttranscript| TextQuery[Tekstinvoerveld]
    einde

WebM -->|POST /api/v1/stylist| API[FastAPI-gateway]
    TextQuery -->|POST /api/v1/stylist| API

subgrafie Backend-services
        API --> STT[STT-service: EyesSTTService]
        STT -->|Controleer opheffing| Aanbieder{Aanbieder?}
        Aanbieder -->|Gemma| Gemma[Gemma4 zijspancontainer]
        Aanbieder -->|Gemini| GeminiSTT[Gemini 2.5 Flash multimodaal]
        Gemma -->|Fallback| TweelingSTT
        
        API --> Hersenen[Stylist Hersenservice]
        Hersenen -->|Tekstreactie| TTS[TTS-service: GeminiTTSService]
        TTS -->|gemini-2.5-flash respons_modaliteiten: AUDIO| GeminiTTS[Gemini 2.5 Flash multimodaal]
    einde

GeminiTTS -->|Ruwe audiobytes| TTS
    TTS -->|Base64 gecodeerd| API
    API -->|JSON-antwoord: tts_audio_base64| FE
    
    FE -->|Decoderen en afspelen| Afspelen [HTML-audio / golfvormspeler]
    FE -->|Fallback als er geen serveraudio is| LocalTTS[Web Speech API: spraakSynthese]
```

### Waardepropositie voor gebruikers
* **Frictieloze interactie**: gebruikers kunnen stylingdilemma's beschrijven, kledingstukken opvragen en outfitmatches geheel handsfree aanvragen.
* **Lage latentie en hoge snappiness**: Realtime spraakherkenning aan de clientzijde biedt directe visuele transcriptiefeedback terwijl de gebruiker spreekt.
* **Fail-Safe Robuustheid**: Als het speciale Gemma4-model uitvalt, valt het systeem automatisch terug naar Gemini 2.5 Flash. Als het genereren van spraak op de server mislukt, synthetiseert de browser tekst onmiddellijk lokaal met behulp van de Web Speech API.
* **Privacy- en offlinemogelijkheden**: het Piper/Sherpa-ONNX-integratiepatroon zorgt ervoor dat mobiele clienttoepassingen de spraakgeneratie volledig op het apparaat kunnen uitvoeren, waardoor serverbandbreedte wordt bespaard en de privacy van gebruikers wordt gewaarborgd.

---

## 2. Uitgebreide gebruikershandleiding

### Visuele interfacetopologie (chatpaneel voor stylist)

```tekst
+---------------------------------------------------+
| [<-] AI-stylist [Sessielijst] [ ] |
+---------------------------------------------------+
|                                                         |
|  (AI) Hier is een elegante outfitaanbeveling... |
|      [================== Waveform-speler ============] |
|                                                         |
|  (Gebruiker) "Welke schoenen passen goed bij deze groene sneakers?" |
|                                                         |
|  (AI) Ik stel voor om ze te stylen met een beige chino.         |
|      +---------------------------------------+ |
|      | [Volumepictogram] Antwoord afspelen (השמע תשובה) |      |
|      +---------------------------------------+ |
|                                                         |
+---------------------------------------------------+
| [📷] [🎤 Vasthouden/tik om te spreken] [ Typ uw bericht... ] [>]|
+---------------------------------------------------+
```

### Modus- en workflow-walkthroughs

#### 1. Voice Query-modus (spraak-naar-tekstinvoer)
* **Start opname**: de gebruiker tikt op de microfoonknop (`[🎤]`) in de invoerbalk van de stylist.
* **Browser STT (primair)**: in ondersteunde browsers (bijv. Chrome, Safari) vraagt ​​het systeem om microfoonrechten en roept het `window.SpeechRecognition` aan. Tussentijdse transcripties verschijnen in realtime in de invoerbalk.
* **Opnemen/Fallback (alternatief)**: in browsers zonder API's voor spraakherkenning (bijvoorbeeld Firefox Desktop), neemt de interface standaard onbewerkte WebM-audiofragmenten op via `MediaRecorder`.
* **Verzenden**: zodra de spraak stopt, wordt de tekstquery automatisch ingevuld en verzonden. Als de fallback-opname is gebruikt, wordt het binaire audiobestand verpakt in een `MultipartForm` onder `voice_audio` en geanalyseerd op de backend.

#### 2. Gesproken responsmodus (tekst-naar-spraakuitvoer)
* **Automatisch afspelen**: nadat de AI-stylist een verzoek heeft verwerkt, wordt het antwoord automatisch afgespeeld als er serveraudio wordt gegenereerd.
* **Handmatig opnieuw afspelen**: elke AI-berichtkaart bevat een dynamische knop met het label **Speel antwoord af** (of gelokaliseerde varianten zoals **השמע תשובה**). Als u erop klikt, wordt de gesynthetiseerde audio opnieuw gestreamd.
* **Toggle Stop**: Als u op de knop klikt terwijl audio wordt afgespeeld, wordt de audiostream onmiddellijk geannuleerd.

### Foutafhandeling en gebruikersfeedback
* **Microfoonrechten geweigerd**: de frontend vangt toestemmingsfouten op en genereert een toastmelding waarin de gebruiker wordt geïnstrueerd om microfoontoegang in de browserinstellingen in te schakelen.
* **Niet-ondersteunde browserfallbacks**: als de browser geen native herkenning heeft, valt de gebruikersinterface veilig terug naar standaardtekstinvoer.
* **Tekst-naar-spraak-stilte**: als spraaksynthese mislukt, registreert een consoletracering de fout en zet de interface de spraakknop terug naar de inactieve status om te voorkomen dat knoppen vastlopen.

---

## 3. Technologiestapel en mogelijkheden Deep-Dive

### Kernorkestratie en AI/logica

#### Dual-tier spraak-naar-tekst (`stt_service.py`)
De backend-orkestrator gebruikt `EyesSTTService` om een robuust, faalveilig dual-path transcriptiesysteem te implementeren:
1. **Specifiek containerpad (Gemma4)**: wanneer `EYES_PROVIDER=gemma` actief is, verzendt de service een `POST`-verzoek met het audiobestand naar de Gemma4-containerruimte (`EYES_GEMMA_SPACE_URL`).
2. **Native Multimodal Path (Gemini 2.5 Flash)**: Als de Gemma-container uitvalt of wordt omzeild, neemt `GeminiSTTService` het over. De audiobytes worden omgezet in een inline multimodaal object en rechtstreeks door Gemini verwerkt:
   ```python
   # Gemini STT-transcriptieverzoekconfiguratie
   text = wacht op client.vision(
       user_parts=[
           "Transcribeer deze audio nauwkeurig. Voer ALLEEN de ruwe transcriptietekst uit in de taal waarin deze werd gesproken. Voeg geen inleidende of afsluitende tekst, opmaak of commentaar toe.",
           (audio_bytes, inhoudstype)
       ],
       temperatuur=0,0,
   )
   ```

#### Multimodale server-side TTS (`tts_service.py`)
In plaats van te vertrouwen op cloudaudio-API's van derden, maakt DressApp gebruik van **Gemini 2.5 Flash** native spraaksynthese:
* **Audio Model Config**: Het verzoek vraagt Gemini om expliciet te reageren in audioformaat:
  ```python
  configuratie = {
      "response_modalities": ["AUDIO"],
      "speech_config": {
          "voice_config": {
              "prebuilt_voice_config": {
                  "voice_name": voice_name # puck, aoede (vrouwelijk), charon (mannelijk)
              }
          }
      }
  }
  ```
* **Payload-extractie**: de backend extraheert de geretourneerde audiobytes uit de `inline_data.data`-onderdelen van de kandidaat, codeert ze naar base64 en stuurt ze terug naar de frontend.

---

### Gegevens- en contextpijplijnen

#### Backend-API-pijplijn (`logic.py`)
Wanneer een vraag van een stylist de backend bereikt:
1. `logic.py` controleert of `voice_audio` wordt aangeboden. Als dat zo is, roept het `stt_service.transcribe` aan om de audio om te zetten in een tekstueel transcript.
2. Het transcript wordt verwerkt door het Stylist Brain om een ​​contextuele aanbeveling te genereren.
3. De gegenereerde tekst wordt ingevoerd in `tts_service.speak_to_bytes` met behulp van de voorkeursstem van de gebruiker.
4. De uitvoerbytes worden geconverteerd naar base64 en geretourneerd in `tts_audio_base64`.
5. Elke fase registreert zijn latentie (`whisper_ms`, `stylist_brain_ms`, `tts_ms`) om de prestaties te controleren.

---

### Frontend- en clientarchitectuur

#### Web Speech API-wrapper (`speech.js`)
* **BCP-47 Mapping**: De frontend wijst lokale taalcodes van twee letters toe aan hun volledige BCP-47-tegenhangers (bijvoorbeeld `he` -> `he-IL`, `ar` -> `ar-SA`) om correcte regionale spraaksynthesestemmen op te halen.
* **Zorg ervoor dat stemmen worden geladen**: Chrome en Safari laden systeemeigen stemmen asynchroon. De frontend primet stemmen met behulp van een luisteraar met beloftes op de `voiceschanged`-gebeurtenis:
  ```javascript
  const synth = venster.speechSynthesis;
  synth.addEventListener('voiceschanged', () => oplossing(synth.getVoices()));
  ```
* **Voice Matching-hiërarchie**: als de exacte regionale stem ontbreekt, valt deze terug op het voorvoegsel van de moedertaal of de kale taalcode voordat deze standaard wordt ingesteld op standaard Engels.

#### Lokale TTS-terugval
Als de backend `tts_audio_base64` niet retourneert (of als deze null is), maakt de frontend gebruik van de eigen tekst-naar-spraak-engine van de clientbrowser:
```javascript
// Native browserspraak-fallback-oproep
if (ttsSupportedRef.current && !audioUrl) {
  wacht op speak(spokenText, userLang);
}
```

#### Piper offline TTS-blauwdruk op het apparaat (mobiele clientpods)
Voor mobiele platforms (React Native, Android en iOS) waar servers moeten worden omzeild voor offline bewerkingen:
* **Sherpa-ONNX-integratie**: gebruikt de ONNX-runtime om VITS-modellen lokaal uit te voeren.
* **Componentarchitectuur**:
  1. **Model & Config (`*.onnx`, `*.onnx.json`)**: vooraf getrainde stemgewichten opgeslagen in het applicatiepakket.
  2. **Lexicon (`lexicon.txt`)**: Wijst woorden rechtstreeks toe aan fonetische klanken.
  3. **Tokens (`tokens.txt`)**: wijst fonemen toe aan specifieke modeluitvoerlagen.
  4. **Phonemizer (`espeak-ng-data`)**: gecompileerde assets die taalspecifieke foneemvertaling op het apparaat uitvoeren.
* **Taal-Voice Mapping**: De app stelt automatisch de standaard stem-ID-toewijzing in tijdens registratie of taalwisselingen, waardoor handmatige vervolgkeuzemenu's worden geëlimineerd:
  * **Engels**: `en_US-ryan-medium`
  * **Hebreeuws**: `he_IL-hebreeuws-medium` (gemeenschapsmodel)
  * **Arabisch**: `ar_JO-kareem-low`
  * **Hindi**: `hi_IN-rohan-medium`
  * **Spaans**: `es_ES-carl-medium`