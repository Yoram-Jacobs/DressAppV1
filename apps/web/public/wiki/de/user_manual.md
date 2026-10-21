# DressApp Vollständiges technisches Benutzerhandbuch

Umfassendes Benutzerhandbuch und technische Referenz für das persönliche Garderoben-Ökosystem von DressApp, die Styling-Engine, den zirkulären Marktplatz und die Administrationsbereiche.

---

## 1. Übersicht & Technologie-Stack

DressApp ist ein KI-gestützter persönlicher Garderoben-Manager, Styling-Berater und zirkulärer Marktplatz. Die Plattform unterstützt Nutzer dabei, Kleidungsstücke digital zu verwalten, automatisch freizustellen und zu verschlagworten, wetter- und kalenderbasierte Outfit-Empfehlungen zu erhalten, digitale EU-Produktpässe (DPP) zu scannen und Kleidungsstücke zu handeln.

### Kernwertversprechen
- **Erfassung der digitalen Garderobe**: Schnappschuss- oder Foto-Upload-Verarbeitung mit automatischer Hintergrundentfernung, Kleidungskategorisierung und Generierung von Attribut-Tags.
- **Virtueller KI-Stylist**: Ein dialogorientierter Agent, der Ihre Garderobe, Ihre Google Kalender-Termine und lokale Wettervorhersagen kontextbezogen auswertet, um tägliche Outfits vorzuschlagen.
- **Zirkulärer Marktplatz**: Sicheres Peer-to-Peer-Kaufen, -Verkaufen, -Tauschen und -Mieten von Kleidung zur Reduzierung von Fast-Fashion-Abfällen.
- **Cost-Per-Wear (CPW)-Analysen**: Einblicke in den Gesamtwert der Garderobe, Nutzungsraten und Nutzungsoptimierung.

### Technologie-Architektur
- **Backend Edge**: Python 3.11 mit FastAPI unter Verwendung asynchroner Motor-Treiber, verbunden mit einer dedizierten lokalen (On-Premises) MongoDB 7.0-Datenbank auf NVMe-Speicher.
- **Frontend SPA**: React 19 Single-Page-Application mit benutzerdefinierten `useSyncExternalStore`-Stores (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, Shadcn/UI-Primitiven und `react-i18next` mit Unterstützung für 13 Sprachen.
- **Zustands- & Netzwerkoptimierung**: Deduplizierung laufender Anfragen, 15-minütiges Store-Caching und `visibilitychange`-Tab-Revalidierung, was im Leerlauf zu null Hintergrund-GET-Anfragen führt.
- **Lokales maschinelles Lernen & Größenberechnung**: CPU-lokales U2-Net (`rembg`) Hintergrund-Matting, SegFormer-b2 Kleidungsanalyse, Fashion-CLIP-Embeddings und das ANSUR II Regressionsmodell für physische Körpermaße (`body_predictor.py`). Umfasst den dedizierten lokalen `dressapp-eyes`-Container mit einem feinabgestimmten `Qwen 2.5 VL 3B`-Modell (`Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj`) auf Port 7860 für Nutzer des kostenlosen Tarifs (Free Tier) und als automatischen Quoten-Fallback.
- **Dialogorientiertes STT/TTS**: Clientseitige Echtzeit-Web-Speech-Erkennung als Fallback, multimodale serverseitige Gemini-Modulationen sowie lokale Offline-Piper/Sherpa-ONNX-Engines auf dem Gerät.
- **Externe Integrationsdienste**: OpenWeatherMap API zum Abrufen von Wetterdaten, Google Calendar OAuth für den Export von Tagesplänen, OpenStreetMap (Nominatim) für die Adress-Autovervollständigung und PayPal Subscriptions/Checkout REST-APIs.

---

## 2. Voraussetzungen

### Anforderungen an die Host-Umgebung
- **Hardware**: VPS mit mindestens 8 GB RAM (z. B. Hetzner CPX32 VPS für das Hosting der Produktionsumgebung `dressapp.co`).
- **Abhängigkeiten**: Docker & Docker Compose Stack (einschließlich lokaler MongoDB 7.0, Backend, Eyes-Inferenzserver, Frontend und Caddy-TLS-Terminierung).
- **Umgebungsvariablen**: Konfiguration der API-Schlüssel (`GEMINI_API_KEY`, `EYES_API_TOKEN`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` sowie Google Calendar OAuth-Token).

### Anforderungen an die Benutzer-App
- **Webbrowser**: Google Chrome oder Apple Safari (erforderlich für die volle Kompatibilität der Sprachfunktionen).
- **Berechtigungen**: Kameraberechtigung (für Kleidungsfotos und QR-Scans) und Mikrofonberechtigung (für Sprachgespräche) erteilen.
- **Gestufte Zero-BYOK-KI**: Kostenlose Nutzer verwenden das lokale Eyes-Modell (`Qwen 2.5 VL 3B`) von DressApp; Abonnenten der Tarife Manager und Professional nutzen das schnelle Cloud-Modell (`Gemini 3.5 Flash`). Es sind keine vom Nutzer bereitgestellten API-Schlüssel erforderlich.
- **Netzwerk**: Aktive Internetverbindung für die LLM-Verarbeitung, wobei IndexedDB-Caching das Offline-Durchsuchen des Katalogs ermöglicht.

---

## 3. Schritt-für-Schritt-Anleitung

### 3.1 Erfassen von Kleidungsstücken (Artikel hinzufügen)
ERFASSUNGSPARADIGMEN: Fotografie, Digitale EU-Produktpässe und digitale Kaufbelege.

#### A. Interaktive Kamera, Gemischter Batch-Upload & Automatisches 3-Pipeline-Routing
1. Navigiere zum Bildschirm **Artikel hinzufügen** (*Add Item*).
2. Wähle **Foto aufnehmen** (startet die native Kamera) oder klicke auf **Fotos hochladen** (öffnet die Dateiauswahl). Du kannst mehrere Fotos mit gemischten Eigenschaften in einem einzigen Durchgang hochladen (einzelne Kleidungsstücke, komplette Outfits an einer Person/Schaufensterpuppe und ungetragene Kleiderstapel/Cluster), ohne manuelle Pipeline-Tabs auswählen zu müssen.
3. Der Client berechnet im Browser den SHA-256-Hash und den horizontalen Differenz-Hash (dHash) jedes Bildes (~100–180 ms), um deinen bestehenden Kleiderschrank auf Duplikate zu prüfen.
4. Wird eine Übereinstimmung gefunden, öffnet sich der **Duplikat-Prüfdialog** mit passenden Vorschauen. Wähle **Überspringen** (*Skip*) oder **Trotzdem hinzufügen** (*Add anyway*).
5. **Automatisches 3-Pipeline-Foto-Routing (`detect_photo_pipeline`)**: Für jedes akzeptierte Foto analysiert `clothing_parser.py` die semantischen SegFormer-Masken (`face_skin_ratio`, `anatomical_stack`, verbundene Komponenten) und leitet das Foto automatisch weiter an:
   - **`single`-Pipeline**: Isoliertes Einzelstück mit Studio-Alpha-Matting (`rembg` + SegFormer-Maskenschnittmenge).
   - **`multi`-Pipeline**: Getragenes Mehrteil-Outfit an einem Model oder einer Puppe; extrahiert separate Zuschnitte für Oberteil, Unterteil, Outerwear, Schuhe und Accessoires.
   - **`mass`-Pipeline**: Ungetragene Kleider-Cluster, Flat-Lay-Arrangements oder mehrere an Haken hängende Kleidungsstücke (`parse_unworn_cluster`); trennt unverbundene Komponenten und führt eine Farb-Watershed-Trennung durch, während Brustdrucke geschützt bleiben.
6. Der Server streamt innerhalb von Sekunden progressive NDJSON-Frames (`detect`, `field`, `item`, `done`), sodass du Artikeldetails sofort bearbeiten kannst, während das Backend das Tagging abschließt – einschließlich präziser Klassifizierung von **Sweatshirts & Hoodies** gegenüber **T-Shirts** sowie über 60 **traditionellen & kulturellen Kleidungsstücken** in allen 13 Sprachen.
7. Überprüfe die automatisch erkannten Tags (Farbe, Stoff, Passform, Muster, Dresscode, Anlass). Falls die Freistellungsform nicht stimmt, ändere das Dropdown **Kategorie**; dadurch schneidet SegFormer das Kleidungsstück automatisch neu zu.
8. Klicke auf **Speichern**, um das Element sofort optimistisch im Kleiderschrank-Raster darzustellen (~16 ms), während im Hintergrund die WebP-Thumbnail-Erstellung und optionale generative Nano-Banana-Ergänzungen abgeschlossen werden.

#### B. Scannen von Digitalen EU-Produktpässen (DPP)
1. Tippen Sie auf der Seite „Artikel hinzufügen" auf die Schaltfläche **QR scannen (DPP)**.
2. Erteilen Sie die Kameraberechtigung und richten Sie die Kamera auf den QR-Code auf dem Pflegeetikett des Kleidungsstücks oder laden Sie einen gespeicherten QR-Screenshot hoch.
3. Das Backend löst die URL auf und führt SSRF-Sicherheitsprüfungen durch (Blockierung privater IP-Bereiche).
4. Das System liest die JSON-LD-Schemata aus, um Marke, Materialzusammensetzung, Lieferketten-Herkunft, CO2-Fußabdruck und Pflegehinweise zu extrahieren.
5. Überprüfen Sie die extrahierten Daten im grünen Akkordeon-Panel **Verifizierte DPP-Daten (Verified DPP Data)** und klicken Sie auf **Speichern**.

#### C. Importieren digitaler Kaufbelege
1. Öffnen Sie den Reiter **Digitaler Import (Digital Import)**.
2. Wählen Sie einen Untermodus: **Text einfügen (Paste Text)**, **Bild hochladen (Upload Image)**, **PDF hochladen (Upload PDF)** oder geben Sie einen **Web-Link** ein.
3. Das Backend nutzt multimodale Vision-Modelle, um Transaktionsfakten (Marke, Preis, Größe, Kategorie) zu extrahieren.
4. Ausgelesene Felder werden durch den Beleg gesperrt, um sie vor künftigen visuellen Neu-Analysen zu schützen. Klicken Sie zur Bestätigung auf **Speichern**.

---

### 3.2 Dialogorientierter virtueller KI-Stylist
Beschreiben Sie Styling-Fragen und erhalten Sie freihändige gesprochene Outfit-Beratung.

1. Navigieren Sie zum Bildschirm **AI Stylist**.
2. Klicken Sie auf das Mikrofonsymbol `[Microphone]` in der Chat-Eingabeleiste.
3. Sprechen Sie Ihre Anfrage ein (z. B. „Welches Oberteil passt zu meiner beigen Hose für ein Mittagessen im Freien bei Regen?").
4. Wenn Web Speech unterstützt wird, wird Ihre Sprache live im Eingabefeld transkribiert. Andernfalls zeichnet die App eine WebM-Datei auf und lädt diese hoch.
5. Das Backend leitet Anfragen von kostenlosen Nutzern an den lokalen Eyes-Container (feinabgestimmtes `Qwen 2.5 VL 3B`) und Anfragen von Abonnenten der Tarife Manager und Professional an das schnelle Cloud-Modell (`Google Gemini 3.5 Flash`) weiter – mit automatischem Fallback auf die lokale Eyes-Engine bei Cloud-Ratenbegrenzungen.
6. Der Stylist verarbeitet Ihre Garderobenhistorie, lokale Wettervorhersagen und Kalendertermine, um einen Styling-Vorschlag zu formulieren.
7. Der Stylist spricht die Antwort mithilfe vorausgewählter Stimmprofile (`puck`, `aoede` oder `charon`).
8. Tippen Sie auf der Karte auf **Play reply** (Antwort abspielen), um die Sprachausgabe erneut anzuhören.

---

### 3.3 Profil, Einstellungen und Subsystem-Abhängigkeiten
Die Profilseite dient als zentrale Steuerkonsole für DressApp. Konfigurationsfelder wirken sich direkt auf die Leistung, das Routing und das Verhalten nachgelagerter Module aus.

##### Abhängigkeiten & Begründung der Akkordeon-Abschnitte

1. **Fotos & dynamische 3D-Avatar-Bühne (`AvatarViewer2D`, `DynamicAvatar` & `closetGarmentFitter`)**
   - **Warum ist das wichtig?**: Rendert Ihre visuelle Identität auf allen Anprobeflächen über eine Dual-Mode-Bühne: ein realistisches menschliches 3D-MB-Lab-WebGL-Mesh (`avatar_male_1.glb` & `avatar_female_1.glb`, mit 2D-Bézier-SVG-Fallback) oder einen segmentierten Echtkörper-Fotoausschnitt.
   - **Subsystem-Abhängigkeiten**: Der 3D-Avatar morpht dynamisch in einem orthografischen `200 x 450`-Canvas entsprechend Ihrer Körpergröße und Ihren Körperumfängen (`scaleY` entkoppelt von `scaleXZ`) und wendet 8 realistische Monk-Hautton-Farbfelder (`SkinTonePicker.jsx`) an. Fotoausschnitte werden über lokales U2-Net (`rembg`) vom Hintergrund freigestellt und im Browser auf maximal 1280 px bei 82 % Qualität herunterskaliert, um innerhalb der 16-MB-Dokumentgrenze von MongoDB zu bleiben. Sowohl die 48 vorangepassten Onboarding-Artikel als auch Kleiderschrank-Ausschnitte der Nutzer werden über `closetGarmentFitter.js` und horizontales Live-Slice-Warping (`FittedGarmentLayer`) exakt auf die Schultern, ausgestreckten Arme, den Oberkörper, die A-Stance-Beine und die leicht gespreizten Füße des 3D-Avatars projiziert. Klicken Sie auf *Foto entfernen*, um sofort wieder zum 3D-Avatar zu wechseln.

2. **Stilprofil (Modesty-Regeln, Dresscode)**
   - **Warum ist das wichtig?**: Es legt persönliche Grenzen für empfohlene Outfits fest und verhindert, dass die KI unpassende Stilvorschläge generiert.
   - **Subsystem-Abhängigkeiten**: Die ausgewählten Parameter (z. B. Vorgaben für bedeckende Kleidung) fließen direkt in die Styling-Prompts ein und filtern passende Garderoben-Ergebnisse vor der Anzeige.

3. **Details (Name, Telefon, Beruf)**
   - **Warum ist das wichtig?**: Passt den Kommunikationston an und steuert Benachrichtigungen.
   - **Subsystem-Abhängigkeiten**: Der Name des Nutzers wird dynamisch in E-Mails und System-Pushes eingefügt. Die Telefonnummer dient als Fallback-Register für geplante Benachrichtigungen. Der Berufsparameter wird an das Stylist-LLM und den Personalisierungs-Ranker von Trend Scout übergeben, um Vorschläge maßzuschneidern.

4. **Körpermaße & Konfektionsgrößen (ANSUR II-Regressionsmodell & Sizing Predictor)**
   - **Warum ist das wichtig?**: Eliminiert das Rätselraten bei Größen und ermöglicht die automatische Berechnung von Einzelhandelsgrößen, den externen Größenvergleich sowie präzises virtuelles Layering.
   - **Subsystem-Abhängigkeiten**: Die Eingabe von 4 Basisparametern (**Körpergröße**, **Gewicht**, **Taille**, **Fußlänge**) löst das scikit-learn ANSUR II-Regressionsmodell (`body_predictor.py`) aus, um automatisch 6 strukturelle Dimensionen vorherzusagen (*Schultern*, *Brust*, *Hüfte*, *Ärmel*, *Innenbeinlänge*, *Außenbeinlänge*).
     - **Deterministische Größenübersetzung**: Sobald kontinuierliche Maße vorhergesagt wurden, wandelt die Größen-Engine des Backends diese dynamisch in Einzelhandels-Kleidergrößen um: **Hemdgröße** (XS–XXL basierend auf Brustumfang), **Hosengröße** (Taille in Zoll), **Schuhgröße** (US-Herren/Damen und EU-Standards basierend auf Fußlänge und Geschlecht), **Kleidergröße** (US 0–14+ basierend auf Brust, Taille und Hüfte) sowie **BH-Größe** (Unterbrustband + Körbchengröße basierend auf Brust und geschätztem Unterbrustumfang).
     - **Automatisches Ausfüllen**: Diese empfohlenen Einzelhandelsgrößen werden automatisch in die Felder des *Detaillierten Bearbeitungsmodus* im Profil-Dashboard eingetragen.
     - **Integrationen**: Die Maße werden direkt von den Content-Skripten der Chrome-Erweiterung **Shopping Assistant** abgefragt, um Größentabellen auf Partner-Websites (Zara, Asos) auszulesen und Größen zu empfehlen.

5. **Lifestyle (Familienstand, Geschlecht)**
   - **Warum ist das wichtig?**: Passt Standardempfehlungen an und bewertet Inhaltsalgorithmen.
   - **Subsystem-Abhängigkeiten**: Die Auswahl des Geschlechts beeinflusst direkt die Ranking-Logik der täglichen Trend-Scout-Karten. Stimmt die Kategorie einer Nachrichtenkarte nicht mit dem Geschlecht des Nutzers überein, wendet der Algorithmus einen Punktabzug von -2,0 an und stuft sie im Feed herab.

6. **KI-Modell-Routing & Abonnementtarife (Gestuftes Zero-BYOK-Routing & Credits)**
   - **Warum ist das wichtig?**: Steuert das gestufte Modell-Routing und den Credit-Verbrauch ganz ohne eigene Nutzer-API-Schlüssel.
   - **Subsystem-Abhängigkeiten**: Nutzer des kostenlosen Tarifs (Free Tier) werden an den lokalen Eyes-Container (feinabgestimmtes `Qwen 2.5 VL 3B`) weitergeleitet. Abonnenten der Tarife Manager und Professional werden an das schnelle Cloud-Modell (`Google Gemini 3.5 Flash`) weitergeleitet, mit automatischem Quoten-Fallback auf die lokale Eyes-Engine.

7. **Planer & Push (Häufigkeit, täglicher Wecker, Stilfokus)**
   - **Warum ist das wichtig?**: Verwaltet automatische tägliche Styling-Push-Benachrichtigungen.
   - **Subsystem-Abhängigkeiten**: Aktiviert `APScheduler`-Cron-Jobs im FastAPI-Backend. Jeden Morgen löst das System Push-Benachrichtigungen über `pywebpush` mithilfe der VAPID-Schlüssel des Clients aus, abgestimmt auf die gewählten Stilfokus-Parameter.

8. **Google Kalender (OAuth-Synchronisierung, Exportregeln)**
   - **Warum ist das wichtig?**: Verbindet Ihre Garderobe direkt mit Ihren realen Kalenderterminen.
   - **Subsystem-Abhängigkeiten**: Authentifiziert über Google OAuth. Der Planer fragt Ihren Kalender ab, um Termine zu erkennen, stellt passende Outfits zusammen und überträgt Outfit-Einträge direkt in Ihre Google Kalender-Agenda.

9. **Standortdienste (GPS-Ortung, Wettergenauigkeit)**
   - **Warum ist das wichtig?**: Koordiniert wettergerechte Vorschläge und Umkreisfilter für lokale Transaktionen.
   - **Subsystem-Abhängigkeiten**: Löst `navigator.geolocation`-Reverse-Geocoding aus. Die Koordinaten werden an die OpenWeatherMap API gesendet, um die Empfehlungen des Stylisten anzupassen (z. B. Regenkleidung bei Starkregen). Zudem berechnet das System Entfernungen für lokale Marktplatz-Inserate und Experten.

10. **Stimme & Sprache (Stimmauswahl des virtuellen Stylisten)**
    - **Warum ist das wichtig?**: Legt die Text-Lokalisierung und Sprachmodulationen fest.
    - **Subsystem-Abhängigkeiten**: Steuert die aktive Übersetzungssprache über `react-i18next`. Die Stimmauswahl ordnet BCP-47-Sprachcodes (z. B. `he-IL` oder `ar-JO`) den Web-Speech-Synthesestimmen des Clients oder lokalen Offline-Piper-TTS-Modellen zu.

11. **Freunde einladen (Share-Payload-API)**
    - **Warum ist das wichtig?**: Bietet eine virale Empfehlungsschleife zur kostenlosen Kleiderschrankerweiterung.
    - **Subsystem-Abhängigkeiten**: Hängt die MongoDB-ID des Werbenden an die URL an. Neuregistrierungen fragen diese ID dynamisch ab und erhöhen den `closet_capacity_bonus` des Werbenden atomar um +10 Plätze, wodurch die Limit-Wächter in `closet.py` angepasst werden.

---

### 3.4 Dashboard für Garderoben-Statistiken (Wardrobe Insights)
Analysieren Sie den Gesamtwert Ihrer Garderobe, verfolgen Sie die Kleidungsnutzung und prüfen Sie Cost-per-Wear-Parameter.

1. Navigieren Sie zu **Wardrobe Insights**.
2. **Kennzahlen prüfen**:
   - *Closet Worth (Kleiderschrankwert)*: Dynamische Summe der Kaufpreise.
   - *Closet Utilization (Schranknutzung)*: Prozentsatz der Kleidungsstücke im Schrank, die mindestens einmal getragen wurden.
   - *Average Cost-per-Wear (CPW)*: Berechnet als `Preis / Trageanzahl`.
3. **Verteilungsdiagramme**: Wechseln Sie die Reiter, um Recharts-Visualisierungen anzuzeigen:
   - *Farbpalette*: Verteilung der zugeordneten Hex-Farbcodes.
   - *Materialien*: Prozentuale Verteilung der Stoffe.
   - *Unterkategorien*: Zugeordnete Unterkategorien.
4. **Effizienz-Rangliste (Efficiency Leaderboard)**: Zeigt die Top 5 Kleidungsstücke mit den niedrigsten Cost-per-Wear-Werten.

---

### 3.5 Outfit-Canvas & Planer
Erstellen, schichten und prüfen Sie Outfit-Vorschläge auf einer interaktiven 2D-Avatar-Fläche.

1. Öffnen Sie den **Outfit Canvas**-Planer.
2. **Schichtung von Oberbekleidung (Doppelter Canvas)**: Wenn Ihr Outfit Oberbekleidung (z. B. eine Jacke) über einem Oberteil umfasst, rendert die Seite zwei vertikale Canvas-Module: „Mit Oberbekleidung" (zeigt die darüber getragene Jacke) und „Ohne Oberbekleidung" (zeigt das darunterliegende Oberteil).
3. **Interaktive 2D-Elemente**: Tippen Sie direkt auf ein beliebiges Kleidungsstück am Körper des Avatars. Die App leitet Sie direkt zur Detailansicht dieses Kleidungsstücks weiter.
4. **Reiter „Metriken" prüfen**: Klicken Sie auf die Details-Schaltfläche und wählen Sie den Reiter **Metrics**, um Fortschrittsbalken für Kompatibilitätskriterien anzuzeigen:
   - *Color Harmony* (Farbharmonie)
   - *Pattern Compatibility* (Vermeidung von Musterkonflikten)
   - *Body Fitting* (Größenübereinstimmung)
   - *Weather Match* (Saisoneignung)
   - *Event Match* (Anlass-Eignung)
   - *Location Match* (Prüfung kultureller Bekleidungsregeln)
5. **Umbenennen/Beschreiben**: Klicken Sie auf das Stiftsymbol, um Outfit-Namen und -Beschreibungen zu bearbeiten.

---

### 3.6 Koffer-Assistent (Suitcase Assistant)
Organisieren Sie Ihren Packbedarf für Reisen ohne Übergepäck.

1. Gehen Sie zur Seite **Suitcase** und füllen Sie das Reisekontext-Formular aus (Reiseziel, Start-/Enddatum, Reisekategorie, Kalendertermine).
2. Die KI generiert anhand der Reisedauer und der Wettervorhersagen eine maßgeschneiderte Packliste sowie tägliche Outfits.
3. Überprüfen Sie den Packfortschritt. Fehlt ein wichtiger Gegenstand (z. B. Regenschirm bei Regen, Badebekleidung für den Strand), weist Sie das System darauf hin und schlägt passende Angebote vom Marktplatz oder aus lokalen Geschäften vor.
4. Nutzen Sie das integrierte Chat-Feld, um Vorschläge zu verfeinern (z. B. „Ändere Tag 2 auf legere Abendgarderobe"). Der Assistent passt den Koffer an und behält den Rest der Liste bei.
5. Tippen Sie auf **Approve Suitcase** (Koffer bestätigen), um Ihren Plan abzuschließen.

---

### 3.7 Planer & Push-Erinnerungen
Richten Sie tägliche Styling-Benachrichtigungen ein, um automatisch Outfit-Empfehlungen zu erhalten.

1. Öffnen Sie **Profil** und gehen Sie zu **Planer & Push (Scheduler & Push)**.
2. Aktivieren Sie Benachrichtigungen, legen Sie eine tägliche Benachrichtigungszeit, die Wochentags-Häufigkeit und das Styling-Fokusthema fest.
3. Jeden Morgen prüft der Hintergrund-Cron-Task (`APScheduler`) die Wettervorhersage und sendet eine Push-Benachrichtigung.
4. Tippen Sie auf die Benachrichtigung auf Ihrem Gerät (oder öffnen Sie das Benachrichtigungscenter der Web-App), um einen Vorschlagsdialog mit 3 gestylten Outfit-Vorschlägen anzuzeigen.
5. Speichern Sie einen Vorschlag direkt in Ihrem **Garderobenkalender (Wardrobe Diary)**.

---

### 3.8 Marktplatz (Wiederverkauf, Vermietung, Tausch, Spende)
Nehmen Sie am zirkulären Peer-to-Peer-Modemarktplatz teil.

- **Inserat erstellen**: Öffnen Sie die Detailseite eines Artikels, wählen Sie **Absicht bearbeiten (Edit Intent)** und wählen Sie eine nicht-private Option:
  - *Verkauf (For Sale)*: Geben Sie Verkaufspreis und Währung ein (erkennt Ihre Standardwährung automatisch anhand der regionalen Spracheinstellungen).
  - *Vermietung (Rent)*: Legen Sie den Tagesmietpreis und die Leihbedingungen fest.
  - *Tausch (Swap)*: Markieren Sie den Artikel als offen für Tauschangebote.
  - *Spende (Donate)*: Bieten Sie den Artikel kostenlos zum Verschenken an.
- **Zustandssynchronisierung**: Inserate werden automatisch im Feed veröffentlicht. Der Client nutzt `useSyncExternalStore` und IndexedDB-Caching, um Suchparameter verzögerungsfrei zu laden.
- **Anprobe-Sandbox (Try-On Sandbox)**: Mieter und Käufer können ein inseriertes Kleidungsstück vor dem Checkout virtuell mit Artikeln aus ihrem eigenen privaten Kleiderschrank kombinieren und anprobieren.
- **Transaktions-Checkout**:
  - *Kaufen/Mieten*: Schließen Sie die Transaktion über die integrierten PayPal-Schaltflächen ab. Erfasste Webhooks benachrichtigen den Verkäufer, setzen den Inseratsstatus auf verkauft/vermietet und verbuchen die Transaktion abzüglich der Plattformgebühr von 7 % im Hauptbuch.
  - *Tauschen (Swapping)*: Interessenten schlagen Tauschgeschäfte vor. Der Inserent erhält Bestätigungs-E-Mails, um das Angebot anzunehmen oder abzulehnen.

---

### 3.9 Admin-Panel-Dashboard
Prüfung der Systemverfügbarkeit, Finanzbuchhaltung und Verwaltung von Nutzerkonten.

1. Navigieren Sie zu `/admin` (verfügbar für Administrator-Rollen).
2. **Übersicht (Overview)**: Prüfen Sie Bruttovolumina und Zusammenfassungen der Plattformgebühren-Einnahmen. Untersuchen Sie die **Provider Activity Table**, um Verfügbarkeitsstatistiken nachgelagerter Dienste (Gemini API, Wetterdienst-Latenz und Fehlerraten) einzusehen.
3. **Anbieter (Providers)**: Klicken Sie auf **Verify Key**, um einen direkten Ping an die Gemini API zu senden. Schalten Sie den Schalter **Eyes Vision Override** um, um die Bildanalyse zwischen dem standardmäßigen Gemini-Endpunkt und dem lokalen Container umzuschalten.
4. **Nutzer (Users)**: Zeigen Sie aktive Credits, Rollen und Gesamtzahlungen an. Nutzen Sie Direktaktionen, um Nutzer hoch- oder herabzustufen.
5. **Inserate (Listings)**: Überprüfen Sie den Status von Inseraten und schalten Sie Aktiv-Flags um, um betrügerische Artikel zu sperren.

---

## 4. Erwartete Ergebnisse

- **Erfassung**: Artikel erscheinen sofort im Kleiderschrank-Raster (~16 ms). Hintergrundfreistellungen liefern saubere, transparente PNG-Ergebnisse.
- **Verifiziertes DPP-Abzeichen**: Das Scannen gültiger Produktpässe zeigt die grüne Informationskarte mit Nachhaltigkeitsdetails an.
- **Avatar-Oberbekleidung**: Oberbekleidung wird auf der 2D-Avatar-Fläche korrekt über Oberteilen geschichtet dargestellt, ohne Kopfbedeckungen oder Schuhe abzuschneiden.
- **Sprachantwort**: Textausgaben des virtuellen Stylisten spielen automatisch gesprochene Audioantworten mit einer sichtbaren Wellenformanzeige ab.
- **Abonnements**: Ein Upgrade auf einen Manager- oder Professional-Tarif entfernt sofort die Warnung zum Kleiderschrank-Kapazitätslimit.

---

## 5. Fehlerbehebung

### HTTP 402 Payment Required
- **Problem**: Erfassung blockiert. Sie haben das Basislimit von 50 Kleiderschrankartikeln erreicht (bzw. bis zu 150 Artikel mit Empfehlungsboni).
- **Lösung**: Öffnen Sie die **Preisseite** (`/pricing`) und abonnieren Sie den Manager- oder Professional-Tarif, oder teilen Sie Ihren Einladungslink, um +10 Plätze pro Registrierung zu erhalten (bis maximal 150 Artikel).

### SSRF blockiert / DNS-Fehler bei DPP
- **Problem**: Die gescannte QR-Produktpass-URL lässt sich nicht auslesen.
- **Lösung**: Der Parser blockiert private IP-Adressen (z. B. `127.0.0.1`, `192.168.x.x`), um interne Server zu schützen. Stellen Sie sicher, dass QR-Codes auf öffentliche Domains verweisen.

### Kamera- / Mikrofonberechtigung verweigert
- **Problem**: Das Aufnahme-/Scanfenster zeigt einen „X"-Fehlerbildschirm an oder die Spracheingabe schlägt fehl.
- **Lösung**: Öffnen Sie die Browserberechtigungen, aktivieren Sie den Kamera- und Mikrofonzugriff für die Domain und laden Sie die Seite neu.

### Stylist-Chat-Fehler / Ratenbegrenzungen
- **Problem**: Der Chat zeigt Fehler an oder friert ein.
- **Lösung**: Der Server fängt Gemini-`429`-Ratenbegrenzungen ab und weicht automatisch auf die lokale On-Premises-Eyes-Engine bzw. den regelbasierten Auswahlalgorithmus aus. Überprüfen Sie Ihre Internetverbindung.

### Arbeitsspeicher-Spitzen (OOM) auf dem VPS
- **Problem**: CPU-/RAM-Spitzen während des Upload-Vorgangs.
- **Lösung**: Die Erfassung nutzt sequenzielle Warteschlangen-Sperren für Stapel-Uploads mit mehr als 5 Artikeln. Stellen Sie sicher, dass der Server über mindestens 4 GB (empfohlen 8 GB) RAM verfügt.

---

## 6. Einschränkungen

- **Web-Speech-APIs im Browser**: Die native Sprache-zu-Text-Transkription ist auf Chrome und Safari beschränkt; andere Browser fallen auf die Standard-Texteingabe zurück.
- **Clientseitige Offline-Modulationen**: Die mobile Offline-Sprachsynthese über Piper ONNX nutzt weniger Stimmprofile als das serverseitige Gemini-Audiomodul.
- **Bildgrößenbeschränkungen**: Avatar- und Profil-Uploads werden lokal im Browser auf 82 % Qualität komprimiert, um die 16-MB-Dokumentgrenze von MongoDB einzuhalten.
- **Umfang der Beleg-Analyse**: Stark verschwommene, verzerrte oder handschriftliche Kaufbelege können bei der Datenextraktion fehlschlagen.
