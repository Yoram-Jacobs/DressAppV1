# DressApp Vollständiges Technisches Benutzerhandbuch

Umfassendes Benutzerhandbuch und technisches Referenzhandbuch für das DressApp-Ökosystem zur persönlichen Garderobenverwaltung, Styling-Engine, Circular Marketplace und Administrations-Panels.

---

## 1. Übersicht & Technologie-Stack

DressApp ist ein KI-gestützter persönlicher Garderobenmanager, Styling-Berater und zirkulärer Marktplatz. Es hilft Benutzern, Kleidungsstücke digital zu verwalten, sie automatisch freizustellen und zu verschlagworten, wetter- und kalenderbasierte Outfit-Empfehlungen zu erhalten, EU Digital Product Passports (DPP) zu scannen und Kleidung zu handeln.

### Kernwertversprechen
- **Digitale Garderobenerfassung**: Foto-Snapshot oder Upload-Verarbeitung mit automatisierter Hintergrundentfernung, Kleidungskategorisierung und Attribut-Tag-Generierung.
- **Virtueller KI-Stylist**: Ein konversationeller Agent, der Ihre Garderobe, Google Calendar-Ereignisse und lokale Wettervorhersagen kontextbezogen analysiert, um tägliche Outfits vorzuschlagen.
- **Circular Marketplace**: Sicheres Peer-to-Peer-Kaufen, Verkaufen, Tauschen und Mieten von Kleidung zur Reduzierung von Fast-Fashion-Abfall.
- **Cost-Per-Wear (CPW) Analysen**: Einblicke in den Kapitalisierungswert der Garderobe, Nutzungsraten und Nutzungsoptimierung.

### Technologie-Architektur
- **Backend Edge**: Python 3.11 mit FastAPI, unter Verwendung asynchroner Motor-Treiber, die mit einem MongoDB Atlas-Cluster verbunden sind.
- **Frontend SPA**: React 19 Single-Page-Application mit benutzerdefinierten `useSyncExternalStore`-Stores (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, Shadcn/UI-Primitiven und `react-i18next` mit Unterstützung für 12 Sprachen.
- **Zustands- & Netzwerkoptimierung**: In-Flight-Anfrage-Deduplizierung, 15-minütiges Store-Caching und Revalidierung bei `visibilitychange` des Tabs, was zu null Hintergrund-GET-Anfragen im Leerlauf führt.
- **Lokales Machine Learning & Größenberechnung**: CPU-lokales U2-Net (`rembg`) Hintergrund-Matting, SegFormer-b2 Kleidungs-Parsing, Fashion-CLIP-Embeddings und ANSUR II Regressionsmodell für körperliche Messungen (`body_predictor.py`). Optionale Weiterleitung an selbstgehostete GPU-Container (SegFormer-b3 + BiRefNet) für schnelle Operationen.
- **Konversationelles STT/TTS**: Echtzeit-Web-Speech-Erkennungs-Fallback auf Kundenseite, multimodale Gemini 2.5 Flash-Modulationen auf Serverseite und lokale Offline-Piper/Sherpa-ONNX-Engines auf dem Gerät.
- **Externe Integrationsdienste**: OpenWeatherMap-API für Wetterdaten, Google Calendar OAuth für den täglichen Zeitplan-Export, OpenStreetMap (Nominatim) Adress-Vervollständigung und PayPal Subscriptions/Checkout REST-APIs.

---

## 2. Voraussetzungen

### Anforderungen an die Host-Umgebung
- **Hardware**: Mindestens 4 GB RAM VPS (z. B. Hetzner VPS für das produktive `dressapp.co`).
- **Abhängigkeiten**: Docker & Docker Compose Stack (einschließlich Backend, Frontend und Caddy TLS-Terminierung).
- **Umgebungsvariablen**: Konfiguration der API-Schlüssel (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` und Google Calendar OAuth Tokens).

### Anforderungen an die Benutzer-App
- **Webbrowser**: Google Chrome oder Apple Safari (erforderlich für die vollständige Kompatibilität mit Sprachfunktionen).
- **Berechtigungen**: Kamera-Berechtigung (für Kleidungs-Snapshots und QR-Scans) sowie Mikrofon-Berechtigung (für Sprachkonversationen) erteilen.
- **Netzwerk**: Aktive Verbindung für die LLM-Verarbeitung, wobei IndexedDB-Caching das Offline-Durchsuchen des Katalogs ermöglicht.

---

## 3. Schritt-für-Schritt-Anleitung

### 3.1 Kleidung erfassen (Artikel hinzufügen)
ERFASSUNGSPARADIGMEN: Fotografie, EU Product Passports und digitale Kaufbelege.

#### A. Interaktive Kamera und Datei-Upload
1. Navigieren Sie zum Bildschirm **Artikel hinzufügen**.
2. Wählen Sie **Foto aufnehmen** (startet die native Kamera des Mobilgeräts) oder klicken Sie auf **Fotos hochladen** (öffnet den Datei-Auswahldialog des Betriebssystems).
3. Der Client berechnet den SHA-256-Hash des Bildes und den horizontalen Differenz-Hash (dHash) im Browser (~100-180 ms), um ihn mit Ihrem bestehenden Kleiderschrank abzugleichen.
4. Wenn eine Übereinstimmung gefunden wird, öffnet sich der Dialog **Duplikat-Vorprüfungsdialog** mit Vorschauen übereinstimmender Artikel. Wählen Sie **Überspringen** oder **Trotzdem hinzufügen**.
5. Nach der Bestätigung startet der Server einen NDJSON-Stream. Innerhalb von 5-7 Sekunden wird ein Platzhalter-Vorschaurahmen angezeigt, sodass Sie die Artikeldetails sofort bearbeiten können, während das Backend das Tagging abschließt.
6. Überprüfen Sie automatisch erkannte Tags (Farbe, Stoff, Passform, Muster, Anlass). Wenn die Form des Ausschnitts falsch ist, ändern Sie das Dropdown-Menü **Kategorie**; dies veranlasst SegFormer, das Kleidungsstück automatisch neu zuzuschneiden.
7. Klicken Sie auf **Speichern**, um den Artikel sofort im Kleiderschrank-Raster anzuzeigen (~16 ms), während die WebP-Thumbnail-Generierung im Hintergrund abgeschlossen wird.

#### B. Scannen von EU Digital Product Passports (DPP)
1. Tippen Sie auf der Seite "Artikel hinzufügen" auf die Schaltfläche **QR scannen (DPP)**.
2. Gewähren Sie Kamera-Berechtigungen und richten Sie den QR-Code aus, der auf dem Etikett des Kleidungsstücks gedruckt ist, oder laden Sie einen gespeicherten QR-Screenshot hoch.
3. Das Backend löst die URL auf und führt SSRF-Sicherheitsprüfungen durch (Blockierung privater IP-Bereiche).
4. Das System analysiert die JSON-LD-Schemas, um Marke, Materialzusammensetzung, Lieferkettennachweis, CO2-Fußabdruck und Pflegehinweise zu extrahieren.
5. Überprüfen Sie die extrahierten Daten im grünen Akkordeon-Panel **Verifizierte DPP-Daten** und klicken Sie auf **Speichern**.

#### C. Importieren digitaler Kaufbelege
1. Öffnen Sie den Tab **Digitaler Import**.
2. Wählen Sie einen Untermodus: **Text einfügen**, **Bild hochladen**, **PDF hochladen** oder geben Sie einen **Web-Link** ein.
3. Das Backend nutzt multimodale Vision-Modelle, um Transaktionsdaten (Marke, Preis, Größe, Kategorie) zu extrahieren.
4. Analysierte Felder werden auf Basis des Belegs gesperrt, um sie vor zukünftigen visuellen Neuanalysen zu schützen. Klicken Sie zur Bestätigung auf **Speichern**.

---

### 3.2 Konversationeller virtueller KI-Stylist
Beschreiben Sie Styling-Dilemmata und erhalten Sie freihändig gesprochene Outfit-Ratschläge.

1. Navigieren Sie zum Bildschirm **KI-Stylist**.
2. Klicken Sie auf das Mikrofon-Symbol `[Microphone]` in der Chat-Eingabeleiste.
3. Sprechen Sie Ihre Anfrage (z. B. "Welches Oberteil passt zu meiner beigen Hose für ein Mittagessen im Freien bei Regen?").
4. Wenn Web Speech unterstützt wird, wird Ihre Stimme live im Eingabefeld transkribiert. Wenn nicht, nimmt die App eine WebM-Datei auf und lädt sie hoch.
5. Das Backend leitet die Sprachanfrage an den lokalen Gemma4-Container weiter (mit Fallback auf die Gemini 2.5 Flash-Transkription, wenn offline).
6. Der Stylist verarbeitet Ihre Garderobenhistorie, lokale Wettervorhersagen und Kalenderereignisse, um einen Styling-Vorschlag zu formulieren.
7. Der Stylist spricht die Antwort unter Verwendung vorausgewählter Sprachprofile (`puck`, `aoede` oder `charon`).
8. Tippen Sie auf der Karte auf **Antwort abspielen** (oder **Wiederholen** im Hebräisch-Modus), um das Audio erneut abzuspielen.

---

### 3.3 Profil, Einstellungen und Subsystem-Abhängigkeiten
Die Profilseite dient als zentrales Steuerungspanel für DressApp. Konfigurationsfelder wirken sich direkt auf die Leistung, das Routing und das Verhalten nachgelagerter Module aus.

##### Abhängigkeiten und Begründungen der Akkordeon-Abschnitte

1. **Fotos & Digitale Avatar-Bühne (`AvatarViewer2D` & `DynamicAvatar`)**
   - **Warum ist das wichtig?**: Rendert Ihre visuelle Identität über alle Anprobedialoge hinweg mit einer Dual-Mode-Bühne (segmentierter Real-Body-Fotoausschnitt vs. dynamisches 2D-Bezier-Vektormannequin).
   - **Subsystem-Abhängigkeiten**: Fotoausschnitte werden über lokales U2-Net (`rembg`) im Hintergrund freigestellt und im Browser auf maximal 1280px bei 82% Qualität herunterskaliert, um unter der MongoDB-Dokumentenobergrenze von 16 MB zu bleiben. Die Bühne wendet kalibrierte Positionsmarkierungen an (`top-[14.5%]` Kragen bis Ausschnitt, `top-[36.5%]` Bund bis Taillenlinie, `bottom-[2%]` Schuh-Ebene) sowie eine proportionale Brust-/Hüftskalierung ($scaleX$). Klicken Sie auf *Foto entfernen*, um sofort zum 2D-SVG-Vektormannequin zurückzukehren.

2. **Stil-Profil (Bescheidenheitsregeln, Dresscode)**
   - **Warum ist das wichtig?**: Es legt persönliche Grenzen für empfohlene Outfits fest und verhindert, dass die KI unpassende Stilvorschläge generiert.
   - **Subsystem-Abhängigkeiten**: Die ausgewählten Parameter (z. B. Einschränkungen für bescheidene Kleidung) fließen direkt in die Styling-Prompts für Gemini 2.5 Flash ein und filtern passende Garderobenergebnisse vor der Anzeige.

3. **Details (Name, Telefon, Beruf)**
   - **Warum ist das wichtig?**: Es passt den Kommunikationston an und leitet Benachrichtigungsalarme weiter.
   - **Subsystem-Abhängigkeiten**: Der Name des Benutzers wird dynamisch in E-Mails und System-Pushes eingefügt. Die Telefonnummer dient als Fallback-Register für geplante Alarme. Der Berufsparameter wird dem Stylist-LLM und dem Trend Scout-Personalisierungs-Ranker zur Anpassung der Vorschläge übergeben.

4. **Körpermaße & Größenberechnung (ANSUR II Regressionsmodell)**
   - **Warum ist das wichtig?**: Es eliminiert Größeneinschätzungen und ermöglicht den externen Einzelhandels-Größenvergleich sowie genaue virtuelle Schichtungen.
   - **Subsystem-Abhängigkeiten**: Die Eingabe von 4 Grundparametern (**Größe**, **Gewicht**, **Taillenumfang**, **Fußlänge**) löst das scikit-learn ANSUR II Regressionsmodell (`body_predictor.py`) aus, um automatisch 6 Strukturmaße vorherzusagen (*Schultern*, *Brust*, *Hüfte*, *Ärmel*, *Innenbeinlänge*, *Außenbeinlänge*). Maße werden direkt von den Content-Skripten der **Einkaufsassistent**-Chrome-Erweiterung abgefragt, um Größentabellen auf Partner-Websites (Zara, Asos) zu lesen und Größen zu empfehlen.

5. **Lebensstil (Status, Geschlecht)**
   - **Warum ist das wichtig?**: Es passt Standardempfehlungen an und bewertet Inhaltsalgorithmen.
   - **Subsystem-Abhängigkeiten**: Die Geschlechtsauswahl wirkt sich direkt auf die Ranking-Logik der täglichen Trend Scout-Karten aus. Wenn eine News-Kartenkategorie nicht mit dem Geschlecht des Benutzers übereinstimmt, wendet der Algorithmus eine Strafpunkte von -2,0 an und stuft sie im Feed herab.

6. **KI-Konfiguration (SaaS-Schlüssel, Edge-Modus, Credits)**
   - **Warum ist das wichtig?**: Es bestimmt das Abrechnungs-Routing, die betriebliche Leistung und den Offline-Status des Netzwerks.
   - **Subsystem-Abhängigkeiten**: Leitet Text-/Audio-Generierungsanfragen weiter. Standard-Setups verbrauchen DressApp-Systemguthaben. Die Eingabe persönlicher API-Schlüssel (Google AI Studio, Anthropic, OpenAI) leitet die Gebühren an die Entwickler-Abrechnungskonten des Benutzers weiter. Die Auswahl des lokalen Edge-Modus leitet Anfragen an den Offline-Gemma-Container weiter.

7. **Scheduler & Push (Frequenz, täglicher Alarm, Stilfokus)**
   - **Warum ist das wichtig?**: Verwalte automatische tägliche Stil-Pushs.
   - **Subsystem-Abhängigkeiten**: Aktiviert `APScheduler`-Cron-Jobs auf dem FastAPI-Backend. Jeden Morgen werden Push-Benachrichtigungen über `pywebpush` unter Verwendung der VAPID-Schlüssel des Clients ausgelöst, die den ausgewählten Stilfokus-Parametern entsprechen.

8. **Google Calendar (OAuth-Sync, Exportregeln)**
   - **Warum ist das wichtig?**: Verbindet Ihre Garderobe direkt mit Ihren realen Kalenderereignissen.
   - **Subsystem-Abhängigkeiten**: Authentifiziert über Google OAuth. Der Scheduler fragt Ihren Kalender ab, um Ereignisse zu identifizieren, Outfits zu formatieren und Kalenderereignisse direkt in Ihre Google Calendar-Agenda einzutragen.

9. **Standortdienste (GPS-Tracking, Wettergenauigkeit)**
   - **Warum ist das wichtig?**: Koordiniert wettergerechte Vorschläge und lokale Transaktionsradius-Filter.
   - **Subsystem-Abhängigkeiten**: Löst `navigator.geolocation` Reverse-Geocoding aus. Koordinaten werden an die OpenWeatherMap-API gesendet, um die Stylist-Empfehlungen anzupassen (z. B. Regenbekleidung bei Platzregen). Außerdem werden Entfernungen für lokale Marktplatz-Angebote und Experten berechnet (z. B. Umkreisprüfungen für Lissabon).

10. **Sprache & Stimme (Sprachauswahl des virtuellen Stylisten)**
    - **Warum ist das wichtig?**: Es legt die Sprachwörterbücher und Sprachmodulationen fest.
    - **Subsystem-Abhängigkeiten**: Steuert die aktive Sprache für Übersetzungen über `react-i18next`. Die Sprachauswahl ordnet BCP-47-Sprachcodes (z. B. `he-IL` oder `ar-JO`) den Sprachsynthesestimmen von Web Speech auf Kundenseite oder Offline-Piper-TTS-Modellen zu.

11. **Freunde einladen (Share Payload API)**
    - **Warum ist das wichtig?**: Bietet eine virale Schleife für eine kostenlose Kleiderschrankerweiterung.
    - **Subsystem-Abhängigkeiten**: Hängt die MongoDB-ID des Empfehlenden an die URL an. Neue Registrierungen fragen diese ID dynamisch ab und erhöhen das `closet_capacity_bonus` des Empfehlenden atomar um +10 Plätze, was die Limit-Guards in `closet.py` ändert.

---

## 3.4 Garderoben-Insights Dashboard

Analysieren Sie den Kapitalisierungswert der Garderobe, verfolgen Sie die Nutzung der Kleidungsstücke und Parameter der Kosten pro Tragen (Cost-Per-Wear).

1. Navigieren Sie zu **Garderoben-Insights**.
2. **Kennzahlen überprüfen**:
   - *Kleiderschrank-Wert*: Dynamische Summe der Kaufpreise.
   - *Garderoben-Nutzung*: Prozentsatz der Kleidung im Schrank, die mindestens einmal getragen wurde.
   - *Durchschnittliche Kosten pro Tragen (CPW)*: Berechnet als `Price / Wear Count`.
3. **Verteilungsdiagramme**: Umschalten der Tabs zur Anzeige von Recharts-Visualisierungen:
   - *Farbpalette*: Verteilung der zugeordneten Hex-Codes.
   - *Materialien*: Verteilung der Stoffprozentsätze.
   - *Unterkategorien*: Zugeordnete Unterkategorien.
4. **Effizienz-Bestenliste**: Zeigen Sie die 5 besten Kleidungsstücke mit den niedrigsten Cost-Per-Wear-Werten an.

---

## 3.5 Outfit-Canvas & Planer
Erstellen, schichten und überprüfen Sie Outfit-Vorschläge auf einer interaktiven 2D-Avatar-Leinwand.

1. Öffnen Sie den Planer **Outfit-Canvas**.
2. **Oberbekleidungs-Schichtung (Dual Canvas)**: Wenn Ihr Outfit Oberbekleidung (z. B. eine Jacke) über einem Oberteil enthält, rendert die Seite zwei vertikale Canvas-Module: "Mit Oberbekleidung" (zeigt die Jacke geschichtet) und "Ohne Oberbekleidung" (gibt das darunter liegende Oberteil frei).
3. **Interaktive 2D-Elemente**: Tippen Sie direkt auf ein Kleidungsstück am Körper des Avatars. Die App leitet Sie direkt zum Detailbildschirm dieses Kleidungsstücks weiter.
4. **Tab "Kennzahlen überprüfen"**: Klicken Sie auf die Schaltfläche "Details" und wählen Sie den Tab **Kennzahlen**, um Fortschrittsbalken für Kompatibilitätskriterien anzuzeigen:
   - *Farbharmonie* (neutrale Harmonie)
   - *Muster-Kompatibilität* (Vermeidung von Muster-Kollisionen)
   - *Körperpassform* (Größenübereinstimmung)
   - *Wetter-Abgleich* (Saison-Eignung)
   - *Ereignis-Abgleich* (Aktivitäts-Eignung)
   - *Standort-Abgleich* (Prüfung von Bescheidenheitsregeln)
5. **Umbenennen/Beschreiben**: Klicken Sie auf das Bleistift-Symbol, um Outfit-Namen und -Beschreibungen zu bearbeiten.

---

## 3.6 Koffer-Assistent
Organisieren Sie Ihre Packanforderungen für Reisen, ohne zu viel einzupacken.

1. Gehen Sie zur Seite **Koffer** und füllen Sie das Formularkontext-Formular aus (Reiseziel, Start-/Enddatum, Reisekategorie, Kalenderereignisse).
2. Die KI generiert eine maßgeschneiderte Packliste und tägliche Outfits basierend auf Reisedauer und Wettervorhersagen.
3. Überprüfen Sie den Packfortschritt. Wenn ein wichtiger Artikel fehlt (z. B. Regenschirm bei Regen, Badebekleidung für den Strand), macht Sie das System darauf aufmerksam und schlägt passende Artikel vom Marktplatz oder aus lokalen Geschäften vor.
4. Nutzen Sie das integrierte Chat-Feld zur Verfeinerung von Vorschlägen (z. B. "Ändere Tag 2 in zwanglose Abendkleidung"). Der Assistent bearbeitet den Koffer, während der Rest der Liste erhalten bleibt.
5. Tippen Sie auf **Koffer genehmigen**, um Ihren Plan abzuschließen.

---

## 3.7 Scheduler & Push-Erinnerungen
Stellen Sie tägliche Styling-Alarme ein, um automatisch Outfit-Empfehlungen zu erhalten.

1. Öffnen Sie **Profil** und gehen Sie zu **Scheduler & Push**.
2. Schalten Sie Benachrichtigungen ein, legen Sie eine tägliche Benachrichtigungszeit, Wochentag-Frequenz und ein Stilfokus-Thema fest.
3. Jeden Morgen prüft die Hintergrund-Cron-Aufgabe (`APScheduler`) die Wettervorhersagen und sendet eine Push-Benachrichtigung.
4. Tippen Sie auf die Benachrichtigung auf Ihrem Gerät (oder rufen Sie das Benachrichtigungscenter der Web-App auf), um einen Vorschlagsdialog zu öffnen, der 3 gestylte Empfehlungen anzeigt.
5. Speichern Sie einen Vorschlag direkt in Ihrem **Garderoben-Tagebuch**.

---

## 3.8 Marktplatz (Weiterverkauf, Vermietung, Tausch, Schenkung)
Beteiligen Sie sich am zirkulären Peer-to-Peer-Modemarktplatz.

- **Angebot erstellen**: Öffnen Sie die Detailseite eines Artikels, wählen Sie **Absicht bearbeiten** und wählen Sie eine nicht-private Absicht:
  - *Zu verkaufen*: Geben Sie den Verkaufspreis und die Währung ein (erkennt Ihre Standardwährung anhand der regionalen Einstellungen).
  - *Mieten*: Legen Sie den täglichen Miettarif und die Ausleihbedingungen fest.
  - *Tauschen*: Markieren Sie den Artikel als offen für Tauschgeschäfte.
  - *Spenden*: Veröffentlichen Sie den Artikel kostenlos.
- **Zustandssynchronisierung**: Angebote werden automatisch im Feed verbreitet. Der Client nutzt `useSyncExternalStore` und IndexedDB-Caching, um Suchparameter ohne Verzögerung zu laden.
- **Anprobe-Sandbox**: Mieter/Käufer können ein Angebot an Artikeln aus ihrem privaten Kleiderschrank testen, bevor sie zur Kasse gehen.
- **Transaktions-Checkout**:
  - *Kaufen/Mieten*: Schließen Sie die Transaktion über integrierte PayPal-Schaltflächen ab. Erfasste Webhooks benachrichtigen den Verkäufer, stellen den Angebotsstatus auf verkauft/vermietet um und tragen Transaktionen abzüglich der 7%-Plattformgebühr ins Hauptbuch ein.
  - *Tauschen (Bartering)*: Potenzielle Tauscher schlagen Deals vor. Der Anbieter erhält Bestätigungs-E-Mails zum Annehmen oder Ablehnen.

---

## 3.9 Admin-Panel Dashboard
Überprüfung der Systemlebendigkeit, Finanzbuchhaltung und Benutzerkontenverwaltung.

1. Navigieren Sie zu `/admin` (verfügbar für Administrator-Rollen).
2. **Übersicht**: Überprüfen Sie das Bruttovolumen und Zusammenfassungen der Einnahmen aus Plattformgebühren. Überprüfen Sie die **Anbieter-Aktivitätstabelle**, um nachgelagerte Lebendigkeitsstatistiken anzuzeigen (Gemini API, Wetterdienst-Latenz und Fehlerraten).
3. **Anbieter**: Klicken Sie auf **Schlüssel überprüfen**, um einen direkten Ping an die Gemini API zu senden. Schalten Sie den Schalter **Eyes Vision Override** um, um die Bildanalyse zwischen dem Standard-Gemini-Endpunkt und einem lokalen Gemma-Container zu leiten.
4. **Benutzer**: Zeigen Sie aktive Credits, Rollen und lebenslange Zahlungen an. Nutzen Sie direkte Aktionen, um Benutzer zu befördern oder herunterzustufen.
5. **Angebote**: Zeigen Sie Angebotszustände an und schalten Sie aktive Flags um, um betrügerische Artikel zu sperren.

---

## 4. Erwartete Ergebnisse

- **Erfassung**: Artikel füllen sofort das Kleiderschrank-Raster (~16 ms). Hintergrund-Freistellungen liefern saubere, transparente PNG-Ergebnisse.
- **DPP-Verifiziert-Badge**: Das Scannen gültiger Pässe zeigt die grüne Informationskarte mit Nachhaltigkeitsdetails an.
- **Avatar-Oberbekleidung**: Oberbekleidung wird auf der 2D-Avatar-Leinwand korrekt über Oberteilen dargestellt, ohne Kopfbedeckungen oder Schuhe zu überdecken.
- **Sprachantwort**: Textausgaben des virtuellen Stylisten spielen gesprochenes Audio automatisch mit einer sichtbaren Wellenformanzeige ab.
- **Abonnements**: Die Aktivierung von Pro entfernt sofort die Warnung vor dem Limit von 150 Artikeln.

---

## 5. Fehlerbehebung

### HTTP 402 Payment Required
- **Problem**: Erfassung blockiert. Sie haben das maximale Basis-Limit von 150 Kleiderschrank-Artikeln erreicht.
- **Lösung**: Gehen Sie zu Profil -> Abonnement und upgraden Sie auf Pro, oder teilen Sie Ihren Einladungslink, um +10 Plätze pro Registrierung zu erhalten.

### SSRF blockiert / DNS-Fehler bei DPP
- **Problem**: Scannen der QR-Pass-URL schlägt bei der Analyse fehl.
- **Lösung**: Der Parser blockiert private IP-Adressen (z. B. `127.0.0.1`, `192.168.x.x`), um interne Server zu schützen. Stellen Sie sicher, dass QR-Codes auf öffentliche Domänen verweisen.

### Kamera- / Mikrofon-Berechtigung verweigert
- **Problem**: Erfassungs-/Scan-Anzeigebereich zeigt einen 'X'-Fehlerbildschirm an oder Spracheingabe schlägt fehl.
- **Lösung**: Öffnen Sie die Browser-Berechtigungen, aktivieren Sie den Kamera- und Mikrofonzugriff für die Domäne und laden Sie die Seite neu.

### Stylist-Chat-Fehler / Ratenbeschränkungen
- **Problem**: Chat zeigt Fehler an oder friert ein.
- **Lösung**: Der Server fängt Gemini `429` Rate-Limits ab und greift auf einen regelbasierten Garderobenauswahl-Algorithmus zurück. Überprüfen Sie Ihre Internetverbindung.

### Out of Memory (OOM) VPS-Spitzen
- **Problem**: CPU/RAM-Spitzen während des Upload-Vorgangs.
- **Lösung**: Die Erfassung verwendet sequenzielle Warteschlangensperren für Batches von >5 Artikeln. Stellen Sie sicher, dass der Server über mindestens 4 GB RAM verfügt.

---

## 6. Einschränkungen

- **Browser Web Speech APIs**: Native Sprach-zu-Text-Übersetzung ist auf Chrome und Safari beschränkt; andere Browser greifen auf die Standard-Texteingabe zurück.
- **Offline-Client-Modulationen**: Die mobile Offline-Piper-ONNX-Sprachsynthese verwendet weniger Sprachprofile als das serverseitige Gemini-Audiomodell.
- **Beschränkungen der Bildgröße**: Avatar- und Profil-Uploads werden lokal im Browser auf 82% Qualität komprimiert, um in dieMongoDB-Dokumentengrenze von 16 MB zu passen.
- **Umfang der Beleg-Analyse**: Stark verschwommene, verzerrte oder handschriftliche Belege können bei der Datenextraktion fehlschlagen.
