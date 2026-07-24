# DressApp — Vollständiges technisches Benutzerhandbuch

Umfassendes Benutzerhandbuch und technischer Leitfaden für das persönliche Kleiderschrank-Ökosystem DressApp, die Styling-Engine, den zirkulären Marktplatz und die Administrations-Panels.

---

## 1. Übersicht & Technologie-Stack

DressApp ist ein KI-gestützter persönlicher Kleiderschrank-Manager, Styling-Berater und zirkulärer Marktplatz. Die App hilft Benutzern, Kleidungsstücke digital zu verwalten, sie automatisch freizustellen und zu taggen, wetter- und kalenderbewusste Outfit-Empfehlungen zu erhalten, digitale EU-Produktpässe (DPP) zu scannen und Kleidungsstücke zu handeln.

### Kern-Wertversprechen
- **Digitaler Kleiderschrank-Import**: Verarbeitung von Schnappschüssen oder hochgeladenen Fotos mit automatischer Hintergrundentfernung, Kategorisierung der Kleidung und Erstellung von Eigenschafts-Tags.
- **Virtueller KI-Stylist**: Ein Konversations-Agent, der Ihren Kleiderschrank, Ihre Google Kalender-Ereignisse und die lokale Wettervorhersage kontextbezogen analysiert, um tägliche Outfits vorzuschlagen.
- **Zirkulärer Marktplatz**: Sicherer Peer-to-Peer-Kauf, -Verkauf, -Tausch und -Verleih von Kleidung, um Fast-Fashion-Abfälle zu reduzieren.
- **Cost-per-Wear (CPW) Analysen**: Einblicke in den Wert des Kleiderschranks, die Nutzungsraten und die Optimierung der Nutzung.

### Technologie-Architektur
- **Backend Edge**: Python 3.11 mit FastAPI unter Verwendung asynchroner Motor-Treiber, die mit einem MongoDB Atlas-Cluster verbunden sind.
- **Frontend SPA**: React 19 Single-Page-Application unter Verwendung benutzerdefinierter `useSyncExternalStore`-Stores (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, Shadcn/UI-Komponenten und `react-i18next` mit Unterstützung für 12 Sprachen.
- **Status- und Netzwerkoptimierung**: Deduplizierung von laufenden Anfragen, 15 Minuten Cache-Speicherzeit für die Stores und Revalidierung bei Tab-Wechsel (`visibilitychange`), was im Leerlauf zu null Hintergrund-GET-Anfragen führt.
- **Lokales maschinelles Lernen & Größenberechnung**: CPU-lokales U2-Net (`rembg`) für Hintergrundentfernung, SegFormer-b2 für Kleidungsanalyse, Fashion-CLIP-Embeddings und das ANSUR II-Regressionsmodell für physische Körpermaße (`body_predictor.py`). Optional Weiterleitung an selbst gehostete GPU-Container (SegFormer-b3 + BiRefNet) für schnelle Operationen.
- **Konversations-STT/TTS**: Echtzeit-clientseitige Erkennung über die Web Speech API als Fallback, serverseitige Gemini 2.5 Flash-Verarbeitung für multimodale Audioübertragung und Piper/Sherpa-ONNX-Engines für die Offline-Sprachausgabe auf dem Gerät.
- **Externe Integrationsdienste**: OpenWeatherMap API für Wetterdaten, Google Calendar OAuth für den Export des täglichen Zeitplans, OpenStreetMap (Nominatim) für die automatische Adressvervollständigung und PayPal Subscriptions/Checkout REST APIs.

---

## 2. Voraussetzungen

### Anforderungen an die Host-Umgebung
- **Hardware**: VPS mit mindestens 4 GB RAM (z. B. Hetzner VPS für das Hosting der Produktionsumgebung `dressapp.co`).
- **Abhängigkeiten**: Docker & Docker Compose Stack (einschließlich Backend, Frontend und Caddy TLS-Terminierung).
- **Umgebungsvariablen**: Konfiguration der API-Schlüssel (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` und Google Calendar OAuth-Token).

### Anforderungen an die Benutzer-App
- **Webbrowser**: Google Chrome oder Apple Safari (erforderlich für die vollständige Kompatibilität der Sprachfunktionen).
- **Berechtigungen**: Zugriff auf die Kamera gewähren (für Kleiderschnappschüsse und QR-Scans) sowie auf das Mikrofon (für Sprachgespräche).
- **Netzwerk**: Aktive Verbindung für die LLM-Verarbeitung, wobei IndexedDB-Caching das Offline-Durchsuchen des Katalogs ermöglicht.

---

## 3. Schritt-für-Schritt-Anleitung

### 3.1 Kleidungsstücke importieren (Artikel hinzufügen)
IMPORT-METHODEN: Fotografie, EU-Produktpässe und digitale Kaufbelege.

#### A. Interaktive Kamera und Datei-Upload
1. Navigieren Sie zum Bildschirm **Artikel hinzufügen** (Add Item).
2. Wählen Sie **Foto aufnehmen** (Take Photo) (öffnet die Kamera des Mobilgeräts) oder klicken Sie auf **Fotos hochladen** (Upload Photos) (öffnet die Dateiauswahl des Betriebssystems).
3. Der Client berechnet den SHA-256-Wert und den horizontalen Differenz-Hash (dHash) des Bildes im Browser (~100-180 ms), um es mit dem vorhandenen Kleiderschrank abzugleichen.
4. Wenn eine Übereinstimmung gefunden wird, öffnet sich der **Duplikat-Warnungs-Dialog**, der Vorschauen der übereinstimmenden Artikel zeigt. Wählen Sie **Überspringen** (Skip) oder **Trotzdem hinzufügen** (Add anyway).
5. Nach der Annahme startet der Server einen NDJSON-Stream. Ein Platzhalter-Vorschaurahmen wird innerhalb von 5-7 Sekunden angezeigt, sodass Sie die Details des Artikels sofort bearbeiten können, während das Backend das Tagging abschließt.
6. Überprüfen Sie die automatisch erkannten Tags (Farbe, Stoff, Passform, Muster, Anlass). Wenn der Zuschnitt fehlerhaft ist, ändern Sie die Kategorie im Dropdown-Menü **Kategorie**; dies veranlasst SegFormer, das Kleidungsstück automatisch neu freizustellen.
7. Klicken Sie auf **Speichern** (Save), um den Artikel sofort optimistisch im Kleiderschrank-Raster anzuzeigen (~16 ms), während die Erstellung des WebP-Vorschaubildes im Hintergrund abgeschlossen wird.

#### B. Scannen von EU-Produktpässen (DPP)
1. Tippen Sie auf der Seite "Artikel hinzufügen" auf die Schaltfläche **QR scannen (DPP)**.
2. Gewähren Sie Kameraberechtigungen und richten Sie den QR-Code auf dem Etikett des Kleidungsstücks aus, oder laden Sie einen gespeicherten QR-Screenshot hoch.
3. Das Backend löst die URL auf und führt SSRF-Sicherheitsprüfungen durch (Blockierung privater IP-Bereiche).
4. Das System liest die JSON-LD-Schemata aus, um Marke, Materialzusammensetzung, Lieferketten-Rückverfolgung, CO2-Fußabdruck und Pflegerichtlinien zu extrahieren.
5. Überprüfen Sie die extrahierten Daten, die im grünen Bereich **Verified DPP Data** angezeigt werden, und klicken Sie auf **Speichern**.

#### C. Importieren von digitalen Kaufbelegen
1. Öffnen Sie den Reiter **Digitaler Import** (Digital Import).
2. Wählen Sie einen Untermodus: **Text einfügen**, **Bild hochladen**, **PDF hochladen** oder geben Sie einen **Weblink** ein.
3. Das Backend nutzt multimodale Vision-Modelle, um Transaktionsdaten (Marke, Preis, Größe, Kategorie) zu extrahieren.
4. Analysierte Felder werden gesperrt, um sie vor zukünftigen visuellen Re-Analysen zu schützen. Klicken Sie zur Bestätigung auf **Speichern**.

---

### 3.2 KI-gestützter virtueller Stylist
Beschreiben Sie Ihre Styling-Dilemmas und erhalten Sie freihändige, gesprochene Outfit-Ratschläge.

1. Navigieren Sie zum Bildschirm **AI Stylist**.
2. Klicken Sie auf das Mikrofonsymbol `[Microphone]` in der Chat-Eingabeleiste.
3. Sprechen Sie Ihre Anfrage ein (z. B. *"Welches Oberteil passt zu meiner beigen Hose für ein Mittagessen im Freien bei Regen?"*).
4. Wenn Web Speech unterstützt wird, wird Ihre Stimme live im Eingabefeld transkribiert. Wenn nicht, nimmt die App eine WebM-Datei auf und lädt sie hoch.
5. Das Backend leitet die Sprachanfrage an den lokalen Gemma-Container weiter (fällt offline auf die Gemini 2.5 Flash-Transkription zurück).
6. Der Stylist verarbeitet Ihre Kleiderschrank-Historie, lokale Wettervorhersagen und Kalenderereignisse, um einen Styling-Vorschlag zu formulieren.
7. Der Stylist gibt die Antwort über vorausgewählte Sprachprofile (`puck`, `aoede` oder `charon`) aus.
8. Tippen Sie auf der Karte auf **Antwort abspielen** (oder **Replay** im hebräischen Modus), um das Sprachaudio erneut abzuspielen.

---

### 3.3 Profil, Einstellungen und Subsystem-Abhängigkeiten
Die Profilseite dient als zentrales Kontrollzentrum für DressApp. Konfigurationsfelder haben direkten Einfluss auf die Leistung, das Routing und das Verhalten nachgelagerter Module.

##### Abhängigkeiten und Logik der Akkordeon-Bereiche

1. **Fotos & Digitaler Avatar (`AvatarViewer2D` & `DynamicAvatar`)**
   - **Warum ist es wichtig?**: Zeigt Ihre visuelle Identität auf allen Anprobeflächen in einem Dual-Modus an (segmentierter Foto-Ausschnitt des realen Körpers vs. dynamische 2D-Bezier-Vektorgrafik-Puppe).
   - **Subsystem-Abhängigkeiten**: Foto-Ausschnitte werden über das lokale U2-Net (`rembg`) freigestellt und im Browser auf maximal 1280px bei 82% Qualität herunterskaliert, um innerhalb der MongoDB-Dokumentenobergrenze von 16 MB zu bleiben. Die Bühne wendet kalibrierte Positionsmarken an (`top-[14.5%]` Kragen zu Halsausschnitt, `top-[36.5%]` Hosenbund zu Taille, `bottom-[2%]` Schuhebene) und eine proportionale Brust-/Hüftskalierung ($scaleX$). Klicken Sie auf *Foto entfernen*, um sofort wieder zur 2D-SVG-Vektorpuppe zu wechseln.

2. **Stilprofil (Bescheidenheitsregeln, Dresscode)**
   - **Warum ist es wichtig?**: Legt persönliche Grenzen für empfohlene Outfits fest und verhindert, dass die KI unangemessene Stilvorschläge generiert.
   - **Subsystem-Abhängigkeiten**: Die ausgewählten Parameter (z. B. Richtlinien für bescheidene Kleidung) fließen direkt in die Styling-Prompts für Gemini 2.5 Flash ein und filtern passende Kleiderschrank-Ergebnisse, bevor sie angezeigt werden.

3. **Details (Name, Telefonnummer, Beruf)**
   - **Warum ist es wichtig?**: Personalisiert den Ton der Kommunikation und steuert Benachrichtigungen.
   - **Subsystem-Abhängigkeiten**: Der Name des Benutzers wird dynamisch in E-Mails und Push-Benachrichtigungen des Systems eingefügt. Die Telefonnummer dient als Backup-Register für geplante Alarme. Der Berufsparameter wird an das Stylisten-LLM und den Trend Scout-Personalisierungs-Ranker übergeben, um Vorschläge anzupassen.

4. **Körpermaße & Größenberechnung (ANSUR II Regressionsmodell & Größenrechner)**
   - **Warum ist es wichtig?**: Erspart das Rätselraten bei Konfektionsgrößen und ermöglicht die automatische Größenberechnung sowie die genaue virtuelle Schichtung von Kleidungsstücken.
   - **Subsystem-Abhängigkeiten**: Die Eingabe von 4 Basisparametern (**Größe**, **Gewicht**, **Taille**, **Fußlänge**) veranlasst das scikit-learn ANSUR II Regressionsmodell (`body_predictor.py`), automatisch 6 strukturelle Maße vorherzusagen (*Schultern*, *Brust*, *Hüfte*, *Ärmel*, *Schrittlänge*, *Außennaht*).
     - **Größenübersetzung**: Sobald die Maße berechnet sind, konvertiert die Backend-Größen-Engine diese dynamisch in Konfektionsgrößen: **Hemdgröße** (XS-XXL basierend auf der Brust), **Hosengröße** (Taille in Zoll), **Schuhgröße** (US-Herren/Damen und EU-Standards basierend auf Fußlänge und Geschlecht), **Kleidergröße** (US 0-14+ basierend auf Brust, Taille und Hüfte) und **BH-Größe** (Unterbrustband + Körbchen basierend auf Brust und geschätztem Unterbrustumfang).
     - **Automatische Befüllung**: Diese empfohlenen Größen werden automatisch in die Felder des *Detaillierten Bearbeitungsmodus* im Profil-Dashboard eingetragen.
     - **Integrationen**: Die Maße werden direkt von den Inhaltsskripten der Chrome-Erweiterung **Shopping Assistant** abgefragt, um Größentabellen auf Partner-Websites (Zara, Asos) zu lesen und Größen zu empfehlen.

5. **Lifestyle (Status, Geschlecht)**
   - **Warum ist es wichtig?**: Passt Standardempfehlungen an und gewichtet Content-Algorithmen.
   - **Subsystem-Abhängigkeiten**: Die Geschlechtsauswahl wirkt sich direkt auf die Ranking-Logik der täglichen Trend Scout-Karten aus. Wenn eine Kategorie nicht mit dem Geschlecht des Benutzers übereinstimmt, wendet der Algorithmus einen Abzug von -2.0 Punkten an, wodurch sie im Feed nach unten verschoben wird.

6. **KI-Konfiguration (SaaS-Schlüssel, Edge-Modus, Credits)**
   - **Warum ist es wichtig?**: Bestimmt das Abrechnungs-Routing, die Systemleistung und den Offline-Status des Netzwerks.
   - **Subsystem-Abhängigkeiten**: Leitet Text-/Audio-Generierungsanfragen weiter. Standard-Setups verbrauchen DressApp-System-Credits. Die Eingabe persönlicher API-Schlüssel (Google AI Studio, Anthropic, OpenAI) leitet die Gebühren an das Entwicklerkonto des Benutzers weiter. Die Auswahl des lokalen Edge-Modus leitet Anfragen an den Offline-Gemma-Container weiter.

7. **Planer & Push-Benachrichtigungen (Häufigkeit, täglicher Alarm, Stilschwerpunkt)**
   - **Warum ist es wichtig?**: Verwaltet die automatische tägliche Outfit-Zustellung.
   - **Subsystem-Abhängigkeiten**: Aktiviert `APScheduler`-Cronjobs auf dem FastAPI-Backend. Jeden Morgen werden Push-Benachrichtigungen über `pywebpush` unter Verwendung der VAPID-Schlüssel des Clients gesendet, die dem ausgewählten Stilschwerpunkt entsprechen.

8. **Google Kalender (OAuth-Sync, Exportregeln)**
   - **Warum ist es wichtig?**: Verbindet Ihre Garderobe direkt mit Ihren realen Kalenderereignissen.
   - **Subsystem-Abhängigkeiten**: Authentifizierung über Google OAuth. Der Planer fragt Ihren Kalender ab, um Ereignisse zu identifizieren, stellt Outfits zusammen und trägt die Termine direkt in Ihren Google Kalender ein.

9. **Ortungsdienste (GPS-Tracking, Wettergenauigkeit)**
   - **Warum ist es wichtig?**: Koordiniert wettergerechte Vorschläge und lokale Suchradien.
   - **Subsystem-Abhängigkeiten**: Löst die Rückwärts-Geokodierung via `navigator.geolocation` aus. Die Koordinaten werden an die OpenWeatherMap API gesendet, um die Empfehlungen des Stylisten anzupassen (z. B. Regenbekleidung bei Wolkenbrüchen). Zudem werden Distanzen für Marktplatz-Anzeigen und Experten in der Umgebung berechnet.

10. **Stimme & Sprache (Sprachauswahl des virtuellen Stylisten)**
    - **Warum ist es wichtig?**: Legt die Übersetzungssprache und Sprachmodulationen fest.
    - **Subsystem-Abhängigkeiten**: Steuert die aktive Übersetzungssprache über `react-i18next`. Die Sprachauswahl verknüpft BCP-47-Sprachcodes (z. B. `he-IL` oder `ar-JO`) mit den Sprachsynthese-Stimmen des Browsers oder Offline-Piper-TTS-Modellen.

11. **Freunde einladen (Empfehlungs-API)**
    - **Warum ist es wichtig?**: Bietet eine virale Schleife für die kostenlose Erweiterung des Kleiderschranks.
    - **Subsystem-Abhängigkeiten**: Hängt die MongoDB-ID des Empfehlenden an die URL an. Neue Registrierungen fragen diese ID ab und erhöhen das `closet_capacity_bonus` des Empfehlenden automatisch um +10 Plätze, wodurch die Kapazitätsgrenzen in `closet.py` angepasst werden.

---

## 3.4 Kleiderschrank-Insights-Dashboard
Analysieren Sie den Gesamtwert des Kleiderschranks, verfolgen Sie die Auslastung der Kleidungsstücke und werten Sie die Cost-per-Wear-Parameter aus.

1. Navigieren Sie zu **Wardrobe Insights**.
2. **Kennzahlen überprüfen**:
   - *Wert des Kleiderschranks (Closet Worth)*: Dynamische Summe der Kaufpreise.
   - *Kleiderschrank-Nutzung (Closet Utilization)*: Prozentsatz der Kleidungsstücke, die mindestens einmal getragen wurden.
   - *Durchschnittliche Cost-per-Wear (CPW)*: Berechnet als `Preis / Anzahl der Tragevorgänge`.
3. **Verteilungsgrafiken**: Wechseln Sie die Reiter, um Recharts-Visualisierungen anzuzeigen:
   - *Farbpalette*: Verteilung der erfassten Hex-Codes.
   - *Materialien*: Verteilung der Stoffanteile in Prozent.
   - *Unterkategorien*: Verteilung der erfassten Unterkategorien.
4. **Effizienz-Rangliste**: Zeigen Sie die Top 5 Kleidungsstücke mit den niedrigsten Cost-per-Wear-Werten an.

---

### 3.5 Outfit-Leinwand & Planer
Erstellen, schichten und überprüfen Sie Outfit-Vorschläge auf einer interaktiven 2D-Avatar-Leinwand.

1. Öffnen Sie den Planer **Outfit Canvas**.
2. **Außenbekleidungsschichtung (Duale Leinwand)**: Wenn Ihr Outfit Außenbekleidung (z. B. eine Jacke) über einem Oberteil enthält, rendert die Seite zwei vertikale Leinwand-Module: "Mit Außenbekleidung" (zeigt die Jacke darüber) und "Ohne Außenbekleidung" (zeigt nur das Oberteil darunter).
3. **Interaktive 2D-Elemente**: Tippen Sie direkt auf ein Kleidungsstück auf dem Körper des Avatars. Die App leitet Sie direkt zum Detailbildschirm dieses Kleidungsstücks weiter.
4. **Reiter für Kompatibilitätswerte**: Klicken Sie auf die Schaltfläche "Details" und wählen Sie den Reiter **Metrics**, um Fortschrittsbalken für die Kompatibilitätskriterien anzuzeigen:
   - *Farbharmonie* (neutrale Harmonie)
   - *Musterkompatibilität* (Vermeidung von Musterkonflikten)
   - *Passform* (Größenübereinstimmung)
   - *Wettertauglichkeit* (Saisoneignung)
   - *Anlasskompatibilität* (Aktivitätsangemessenheit)
   - *Ortskompatibilität* (Überprüfung von Bescheidenheitsregeln)
5. **Umbenennen/Beschreiben**: Klicken Sie auf das Bleistiftsymbol, um Outfitnamen und -beschreibungen zu bearbeiten.

---

### 3.6 Koffer-Packassistent
Organisieren Sie Ihr Gepäck für Reisen, ohne zu viel einzupacken.

1. Rufen Sie die Seite **Suitcase** auf und füllen Sie das Formular für den Reisekontext aus (Reiseziel, Start-/Enddatum, Reisekategorie, Kalenderereignisse).
2. Die KI generiert basierend auf Reisedauer und Wettervorhersage eine maßgeschneiderte Packliste und tägliche Outfits.
3. Überprüfen Sie den Packfortschritt. Wenn ein wichtiger Artikel fehlt (z. B. ein Regenschirm für Regentage oder Badebekleidung für den Strand), warnt Sie das System und schlägt passende Artikel aus dem Marktplatz oder von lokalen Geschäften vor.
4. Nutzen Sie den integrierten Chat, um Vorschläge anzupassen (z. B. *"Ändere Tag 2 in lässige Abendkleidung"*). Der Assistent passt den Kofferinhalt an, während der Rest der Liste erhalten bleibt.
5. Tippen Sie auf **Koffer bestätigen** (Approve Suitcase), um Ihren Packplan abzuschließen.

---

### 3.7 Planer & Push-Erinnerungen
Richten Sie tägliche Styling-Erinnerungen ein, um Outfit-Empfehlungen automatisch zu erhalten.

1. Öffnen Sie das **Profile** und gehen Sie zu **Scheduler & Push**.
2. Aktivieren Sie Benachrichtigungen, legen Sie eine tägliche Uhrzeit, die Wochentage und das Styling-Thema fest.
3. Jeden Morgen prüft die Hintergrundaufgabe (`APScheduler`) die Wettervorhersage und sendet eine Push-Benachrichtigung.
4. Tippen Sie auf die Benachrichtigung auf Ihrem Gerät (oder öffnen Sie das Benachrichtigungscenter der App), um einen Vorschlagsdialog mit 3 Outfit-Ideen anzuzeigen.
5. Speichern Sie einen Vorschlag direkt in Ihrem **Garderoben-Tagebuch** (Wardrobe Diary).

---

## 3.8 Marktplatz (Verkauf, Verleih, Tausch, Schenkung)
Nehmen Sie am zirkulären Peer-to-Peer-Modemarktplatz teil.

- **Anzeige erstellen**: Öffnen Sie die Detailseite eines Artikels, wählen Sie **Absicht bearbeiten** (Edit Intent) und entscheiden Sie sich für eine nicht-private Option:
  - *Zu verkaufen (For Sale)*: Geben Sie Preis und Währung an (erkennt Ihre Standardwährung anhand der regionalen Einstellungen).
  - *Mieten (Rent)*: Legen Sie die tägliche Mietgebühr und die Leihbedingungen fest.
  - *Tauschen (Swap)*: Markieren Sie den Artikel als offen für Tauschgeschäfte.
  - *Verschenken (Donate)*: Veröffentlichen Sie den Artikel kostenlos.
- **Statussynchronisierung**: Angebote werden automatisch in den Feed übertragen. Der Client verwendet `useSyncExternalStore` und IndexedDB-Caching, um Suchergebnisse latenzfrei zu laden.
- **Virtuelle Anprobe-Sandbox**: Käufer/Mieter können einen angebotenen Artikel vor dem Kauf virtuell mit Artikeln aus ihrem eigenen Kleiderschrank kombinieren.
- **Kaufabwicklung**:
  - *Kaufen/Mieten*: Schließen Sie Transaktionen über die integrierten PayPal-Schaltflächen ab. Webhooks benachrichtigen den Verkäufer, ändern den Status des Artikels auf verkauft/vermietet und tragen die Transaktion abzüglich der Systemgebühr von 7% in das Kassenbuch ein.
  - *Tauschhandel*: Interessenten schlagen Tauschgeschäfte vor. Der Anbieter erhält Bestätigungs-E-Mails zur Annahme oder Ablehnung des Angebots.

---

### 3.9 Admin-Dashboard
Systemüberwachung, Buchhaltung und Benutzerkontenverwaltung.

1. Navigieren Sie zu `/admin` (nur für Administratoren zugänglich).
2. **Übersicht**: Überprüfen Sie das Bruttovolumen und die Einnahmen aus Systemgebühren. Inspizieren Sie die **Aktivitätstabelle der Anbieter**, um den Status der externen APIs (Gemini, Wetterdienst-Latenz und Fehlerraten) einzusehen.
3. **Anbieter**: Klicken Sie auf **Schlüssel verifizieren** (Verify Key), um einen direkten Ping an die Gemini API zu senden. Aktivieren Sie den Schalter **Eyes Vision Override**, um die Bildanalyse zwischen dem standardmäßigen Gemini-Endpunkt und einem lokalen Gemma-Container umzuschalten.
4. **Benutzer**: Zeigen Sie aktive Credits, Rollen und Gesamtumsätze an. Nutzen Sie Direktaktionen, um Benutzer zu befördern oder zurückzustufen.
5. **Anzeigen**: Sehen Sie den Status von Marktplatz-Inseraten ein und schalten Sie Inserate bei Missbrauch stumm.

---

## 4. Erwartete Ergebnisse

- **Import**: Artikel werden sofort in das Kleiderschrank-Raster geladen (~16 ms). Der Hintergrund wird sauber entfernt und liefert transparente PNGs.
- **DPP-Verifizierung**: Das Scannen gültiger Produktpässe zeigt die grüne Infokarte mit Nachhaltigkeitsdetails.
- **Avatar-Außenbekleidung**: Jacken und Mäntel werden korrekt über Oberteilen auf der 2D-Avatar-Leinwand dargestellt, ohne Kopfbedeckungen oder Schuhe zu überschneiden.
- **Sprachantwort**: Textausgaben des virtuellen Stylisten werden automatisch als Audio ausgegeben, begleitet von einer visuellen Wellenform.
- **Abonnements**: Die Aktivierung von Pro entfernt sofort die Warnung vor dem Limit von 150 Artikeln.

---

## 5. Fehlerbehebung

### HTTP 402 Payment Required
- **Problem**: Import blockiert. Sie haben das maximale Basislimit von 150 Kleiderschrank-Artikeln erreicht.
- **Lösung**: Gehen Sie zu Profile -> Subscription und upgraden Sie auf Pro, oder teilen Sie Ihren Einladungslink, um +10 Plätze pro Registrierung zu erhalten.

### SSRF blockiert / DNS-Fehler bei DPP
- **Problem**: Die URL des gescannten QR-Passports kann nicht aufgelöst werden.
- **Lösung**: Der Parser blockiert private IP-Adressen (z. B. `127.0.0.1`, `192.168.x.x`), um interne Server zu schützen. Stellen Sie sicher, dass QR-Codes auf öffentliche Domains verweisen.

### Kamera- / Mikrofonberechtigung verweigert
- **Problem**: Die Kamera- oder Scan-Ansicht zeigt eine Fehlermeldung mit einem 'X', oder die Spracheingabe schlägt fehl.
- **Lösung**: Öffnen Sie die Browsereinstellungen, erlauben Sie der Domain den Zugriff auf Kamera und Mikrofon und laden Sie die Seite neu.

### Fehler im Stylist-Chat / Ratenbegrenzung (Rate Limits)
- **Problem**: Der Chat zeigt Fehler an oder friert ein.
- **Lösung**: Der Server fängt Gemini `429` Ratenbegrenzungen ab und weicht auf einen regelbasierten Kleiderschrank-Auswahlalgorithmus aus. Überprüfen Sie Ihre Internetverbindung.

### VPS-Speicherüberlastung (Out of Memory - OOM)
- **Problem**: CPU-/RAM-Spitzen während des Bild-Uploads.
- **Lösung**: Der Import verarbeitet Stapel von mehr als 5 Artikeln über sequentielle Warteschlangen-Sperren. Stellen Sie sicher, dass der Server über mindestens 4 GB RAM verfügt.

---

## 6. Einschränkungen

- **Browser-Web-Speech-APIs**: Die native Sprache-zu-Text-Übersetzung ist auf Chrome und Safari beschränkt; andere Browser nutzen die Standard-Texteingabe.
- **Offline-Sprachsynthese**: Die mobile Offline-Synthese via Piper ONNX nutzt weniger Sprachprofile als die serverseitige Gemini-Audioverarbeitung.
- **Einschränkungen der Bildgröße**: Avatare und Profilbilder werden im Browser lokal auf 82% Qualität komprimiert, um in das MongoDB-Limit von 16 MB zu passen.
- **Beleganalyse**: Stark verschwommene, verzerrte oder handschriftliche Belege können beim Datenextraktionsprozess fehlschlagen.
