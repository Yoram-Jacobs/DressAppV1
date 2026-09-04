# DressApp Vollständiges technisches Benutzerhandbuch

Umfassendes Benutzerhandbuch und technische Referenz für das DressApp-Kleiderschrank-Ökosystem, die Styling-Engine, den Circular Marketplace und die Admin-Panels.

---

## 1. Übersicht & Technologie-Stack

DressApp ist ein KI-gestützter persönlicher Kleiderschrank-Manager, Styling-Berater und zirkulärer Marktplatz. Es hilft Benutzern, Kleidungsstücke digital zu verwalten, sie automatisch freizustellen und zu taggen, wetter- und kalenderbezogene Outfit-Empfehlungen zu erhalten, digitale EU-Produktpässe (DPP) zu scannen und Kleidungsstücke zu handeln.

### Kernwertversprechen
- **Erfassung des digitalen Kleiderschranks**: Schnappschuss- oder Foto-Upload-Verarbeitung mit automatischer Hintergrundentfernung, Kleiderkategorisierung und Generierung von Attribut-Tags.
- **Virtueller KI-Stylist**: Ein Conversational Agent, der Ihren Kleiderschrank, Ihre Google Calendar-Ereignisse und lokale Wettervorhersagen kontextbezogen analysiert, um tägliche Outfits vorzuschlagen.
- **Circular Marketplace**: Sicheres Kaufen, Verkaufen, Tauschen und Mieten von Kleidung zwischen Benutzern, um Fast-Fashion-Abfälle zu reduzieren.
- **Cost-Per-Wear-Analysen (CPW)**: Einblicke in den Wert Ihres Kleiderschranks, Nutzungsraten und Nutzungsoptimierung.

### Technologie-Architektur
- **Backend Edge**: Python 3.11 mit FastAPI unter Verwendung asynchroner Motor-Treiber, die mit einem MongoDB Atlas-Cluster verbunden sind.
- **Frontend SPA**: React 19 Single-Page-Application, die benutzerdefinierte `useSyncExternalStore`-Stores verwendet (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, Shadcn/UI-Komponenten und `react-i18next` mit Unterstützung für 12 Sprachen.
- **Zustands- & Netzwerkoptimierung**: Deduplizierung aktiver Anfragen, 15-minütiges Caching und `visibilitychange`-Tab-Revalidierung, die bei Inaktivität zu null GET-Anfragen im Hintergrund führt.
- **Lokales maschinelles Lernen & Größenberechnung**: CPU-lokales U2-Net (`rembg`) Hintergrund-Matting, SegFormer-b2 Kleidungsanalyse, Fashion-CLIP Embeddings und das ANSUR II Körpermaß-Regressionsmodell (`body_predictor.py`). Optional Weiterleitung an selbst gehostete GPU-Container (SegFormer-b3 + BiRefNet) für schnelle Operationen.
- **Konversations-STT/TTS**: Live-Client-seitige Web Speech-Erkennung als Fallback, multimodale serverseitige Gemini 2.5 Flash-Modulationen und Piper/Sherpa-ONNX-Engines auf dem Gerät für die Offline-Nutzung.
- **Externe Integrationsdienste**: OpenWeatherMap API für Wetterdaten, Google Calendar OAuth für den täglichen Zeitplanexport, OpenStreetMap (Nominatim) für Adressvervollständigung und PayPal Subscriptions/Checkout REST-APIs.

---

## 2. Voraussetzungen

### Anforderungen an die Host-Umgebung
- **Hardware**: VPS mit mindestens 4 GB RAM (z. B. Hetzner VPS für das Hosting von `dressapp.co`).
- **Abhängigkeiten**: Docker & Docker Compose (einschließlich Backend, Frontend und Caddy-TLS-Terminierung).
- **Umgebungsvariablen**: API-Schlüssel-Konfiguration (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` und Google Calendar OAuth-Token).

### Anforderungen an die Benutzer-App
- **Webbrowser**: Google Chrome oder Apple Safari (erforderlich für die volle Kompatibilität der Sprachfunktionen).
- **Berechtigungen**: Gewähren Sie Kameraberechtigungen (für Schnappschüsse und QR-Scans) und Mikrofonberechtigungen (für Sprach-Chats).
- **Netzwerk**: Aktive Verbindung für LLM-Verarbeitung, wobei IndexedDB-Caching ein Offline-Durchsuchen des Katalogs ermöglicht.

---

## 3. Schritt-für-Schritt-Anleitung

### 3.1 Erfassen von Kleidungsstücken (Artikel hinzufügen)
ERFASSUNGSMETHODEN: Fotografie, digitale EU-Produktpässe (DPP) und digitale Kaufbelege.

#### A. Interaktive Kamera und Datei-Upload
1. Navigieren Sie zum Bildschirm **Artikel hinzufügen**.
2. Wählen Sie **Foto aufnehmen** (startet die Kamera des Geräts) oder klicken Sie auf **Fotos hochladen** (öffnet den Dateiauswahldialog).
3. Der Client berechnet den SHA-256-Wert und den dHash des Bildes im Browser (~100-180 ms), um zu prüfen, ob der Artikel bereits im Kleiderschrank vorhanden ist.
4. Wenn eine Übereinstimmung gefunden wird, öffnet sich der **Doppelgänger-Vorschau-Dialog**. Wählen Sie **Überspringen** oder **Trotzdem hinzufügen**.
5. Nach der Annahme startet der Server einen NDJSON-Stream. Ein Platzhalter-Vorschaurahmen wird innerhalb von 5-7 Sekunden angezeigt, sodass Sie die Artikeldetails sofort bearbeiten können, während das Backend das Tagging abschließt.
6. Überprüfen Sie die automatisch erkannten Tags (Farbe, Material, Passform, Muster, Anlass). Wenn der Ausschnitt nicht korrekt ist, ändern Sie das Dropdown-Menü **Kategorie**; dies veranlasst SegFormer, das Kleidungsstück automatisch neu freizustellen.
7. Klicken Sie auf **Speichern**, um den Artikel sofort im Schrank-Grid anzuzeigen (~16 ms), während die WebP-Vorschaubildgenerierung im Hintergrund abgeschlossen wird.

#### B. Scannen von EU Digital Product Passports (DPP)
1. Tippen Sie auf der Seite "Artikel hinzufügen" auf die Schaltfläche **QR scannen (DPP)**.
2. Gewähren Sie Kameraberechtigungen und richten Sie den QR-Code auf dem Etikett des Kleidungsstücks aus, oder laden Sie einen gespeicherten QR-Screenshot hoch.
3. Das Backend löst die URL auf und führt SSRF-Sicherheitsprüfungen durch (Blockierung privater IP-Bereiche).
4. Das System analysiert die JSON-LD-Schemas, um Marke, Materialzusammensetzung, Lieferketten-Trace, CO2-Fußabdruck und Pflegehinweise zu extrahieren.
5. Überprüfen Sie die extrahierten Daten im grünen Akkordeon-Panel **Verifizierte DPP-Daten** und klicken Sie auf **Speichern**.

#### C. Importieren digitaler Kaufbelege
1. Öffnen Sie die Registerkarte **Digitaler Import**.
2. Wählen Sie einen Untermodus: **Text einfügen**, **Bild hochladen**, **PDF hochladen** oder geben Sie einen **Web-Link** ein.
3. Das Backend verwendet multimodale Vision-Modelle, um Transaktionsdaten (Marke, Preis, Größe, Kategorie) zu extrahieren.
4. Die analysierten Felder werden gesperrt, um sie vor zukünftigen visuellen Re-Analysen zu schützen. Klicken Sie zur Bestätigung auf **Speichern**.

---

## 3.2 Interaktiver virtueller KI-Stylist
Beschreiben Sie Ihre Styling-Dilemmas und erhalten Sie sprachgesteuerte Outfit-Empfehlungen.

1. Navigieren Sie zum Bildschirm **AI Stylist**.
2. Klicken Sie auf das Mikrofonsymbol `[Microphone]` in der Chat-Eingabeleiste.
3. Sprechen Sie Ihre Anfrage (z. B. "Welches Oberteil passt zu meiner beigen Hose für ein verregnetes Mittagessen im Freien?").
4. Wenn Web Speech unterstützt wird, wird Ihre Sprache live im Eingabefeld transkribiert. Wenn nicht, nimmt die App eine WebM-Datei auf und lädt sie hoch.
5. Das Backend leitet die Sprachanfrage an den lokalen Gemma4-Container weiter (mit Fallback auf Gemini 2.5 Flash, wenn der Server offline ist).
6. Der Stylist verarbeitet Ihren Kleiderschrankverlauf, lokale Wettervorhersagen und Kalenderereignisse, um einen Styling-Vorschlag zu formulieren.
7. Der Stylist gibt die Antwort über die vordefinierten Sprachprofile (`puck`, `aoede` oder `charon`) aus.
8. Tippen Sie auf der Karte auf **Antwort abspielen** (oder **Wiederholen** im Hebräisch-Modus), um das Audio erneut abzuspielen.

---

## 3.3 Profil, Einstellungen und Systemabhängigkeiten
Die Profilseite dient als zentrale Steuerzentrale für DressApp. Konfigurationsfelder haben direkten Einfluss auf die Leistung, das Routing und das Verhalten nachgelagerter Module.

##### Abhängigkeiten und Gründe für Akkordeon-Abschnitte

1. **Fotos & digitale Avatarbühne (`AvatarViewer2D` & `DynamicAvatar`)**
   - **Bedeutung**: Rendert Ihre visuelle Identität auf allen Try-on-Flächen mithilfe einer dualen Bühne (segmentierter Echtkörper-Fotoausschnitt vs. dynamische Schaufensterpuppe auf 2D-Bezier-Vektor-Basis SVG).
   - **Abhängigkeiten**: Fotoausschnitte werden über lokales U2-Net (`rembg`) freigestellt und im Browser auf maximal 1280 Pixel bei 82 % Qualität komprimiert, um in die 16-MB-Grenze von MongoDB-Dokumenten zu passen. Die Bühne wendet kalibrierte Landmarken-Offsets an (`top-[14.5%]` Kragen-zu-Ausschnitt, `top-[36.5%]` Hosenbund-zu-Taille, `bottom-[2%]` Schuhebene) sowie eine proportionale Brust-/Hüftskalierung ($scaleX$). Klicken Sie auf *Foto entfernen*, um sofort zur 2D-SVG-Schaufensterpuppe zurückzukehren.

2. **Stilprofil (Bescheidenheitsregeln, Dresscode)**
   - **Bedeutung**: Legt persönliche Grenzen für Outfit-Empfehlungen fest und verhindert, dass die KI unpassende Stilvorschläge generiert.
   - **Abhängigkeiten**: Die ausgewählten Parameter (z. B. Regeln für bescheidene Kleidung) werden direkt in die Prompts für Gemini 2.5 Flash eingespeist, um passende Kleiderschrankartikel vor der Anzeige zu filtern.

3. **Details (Name, Telefon, Beruf)**
   - **Bedeutung**: Personalisiert den Ton der Kommunikation und steuert Benachrichtigungen.
   - **Abhängigkeiten**: Der Name des Benutzers wird dynamisch in E-Mails und System-Pushes integriert. Die Telefonnummer dient als Fallback für geplante Warnungen. Der Berufsparameter wird an das Stylist-LLM und den Trend Scout-Personalisierungs-Ranker übermittelt, um Vorschläge anzupassen.

4. **Körpermaße & Größen (ANSUR II-Regressionsmodell & Sizing Predictor)**
   - **Bedeutung**: Erspart das Rätselraten bei Größen, ermöglicht die automatische Berechnung von Einzelhandelsgrößen, den externen Größenvergleich und das genaue virtuelle Layering.
   - **Abhängigkeiten**: Die Eingabe von 4 Basisparametern (**Height**, **Weight**, **Waist**, **Foot Length**) veranlasst das Regressionsmodell scikit-learn ANSUR II (`body_predictor.py`), automatisch 6 strukturelle Dimensionen vorherzusagen (*Schultern*, *Brust*, *Hüfte*, *Ärmel*, *Schrittlänge*, *Außennaht*).
     - **Größenübersetzung**: Sobald strukturelle Maße vorhergesagt wurden, konvertiert die Engine diese in Einzelhandelsgrößen: **Hemdgröße** (XS-XXL basierend auf Brustumfang), **Hosengröße** (Taille in Zoll), **Schuhgröße** (US-Männer/Frauen und EU-Standards basierend auf Fußlänge und Geschlecht), **Kleidergröße** (US 0-14+ basierend auf Brust, Taille, Hüfte) und **BH-Größe** (Unterbrust- und Brustumfang).
     - **Automatisches Ausfüllen**: Diese empfohlenen Größen werden automatisch in die Felder des *Detaillierten Bearbeitungsmodus* im Profil eingetragen.
     - **Integrationen**: Die Maße werden direkt vom Einkaufsassistenten (Chrome-Erweiterung) abgefragt, um Größentabellen auf Partner-Websites (Zara, Asos) zu lesen und die beste Passform zu empfehlen.

5. **Lifestyle (Status, Geschlecht)**
   - **Bedeutung**: Passt Standardempfehlungen an und bewertet Content-Algorithmen.
   - **Abhängigkeiten**: Die Auswahl des Geschlechts beeinflusst direkt den Ranking-Algorithmus der täglichen Trend Scout-Karten. Wenn die Kategorie einer Nachrichtenkarte nicht mit dem Geschlecht des Benutzers übereinstimmt, wendet der Algorithmus einen Abzug von -2,0 Punkten an, wodurch sie im Feed nach hinten verschoben wird.

6. **KI-Konfiguration (SaaS-Schlüssel, Edge-Modus, Credits)**
   - **Bedeutung**: Bestimmt Abrechnung, Betriebsleistung und Netzwerkstatus.
   - **Abhängigkeiten**: Routet Text- und Audiogenerierungsanfragen. Standardeinstellungen verbrauchen System-Credits von DressApp. Durch die Eingabe persönlicher API-Schlüssel (Google AI Studio, Anthropic, OpenAI) werden Kosten direkt auf die Entwicklerkonten des Benutzers umgelegt. Die Auswahl des lokalen Edge-Modus leitet Anfragen an den Offline-Gemma-Container weiter.

7. **Planer & Push-Erinnerungen (Häufigkeit, täglicher Alarm, Stilfokus)**
   - **Bedeutung**: Verwaltet das automatische tägliche Senden von Stil-Empfehlungen.
   - **Abhängigkeiten**: Aktiviert `APScheduler`-Cron-Jobs auf dem FastAPI-Backend. Jeden Morgen werden Push-Benachrichtigungen via `pywebpush` unter Verwendung der VAPID-Schlüssel des Clients gesendet, angepasst an die ausgewählten Stilparameter.

8. **Google Calendar (OAuth-Synchronisierung, Exportregeln)**
   - **Bedeutung**: Verbindet Ihren Kleiderschrank direkt mit realen Ereignissen.
   - **Abhängigkeiten**: Erfordert die Authentifizierung über Google OAuth. Der Planer fragt Ihren Kalender ab, um Ereignisse zu identifizieren, Outfits zu generieren und diese direkt in Ihren Google Calendar zu exportieren.

9. **Standortdienste (GPS-Tracking, Wettergenauigkeit)**
   - **Bedeutung**: Koordiniert wetterangepasste Vorschläge und geografische Filter für lokale Transaktionen.
   - **Abhängigkeiten**: Aktiviert `navigator.geolocation` Reverse-Geokodierung. Die Koordinaten werden an die OpenWeatherMap API gesendet, um Stylisten-Empfehlungen anzupassen (z. B. Regenbekleidung bei Starkregen). Berechnet auch Entfernungen für Marketplace-Artikel und Experten in Ihrer Nähe.

10. **Stimme & Sprache (Auswahl der Stimme des virtuellen Stylisten)**
    - **Bedeutung**: Bestimmt die Übersetzung von Texten und das Sprachprofil.
    - **Abhängigkeiten**: Steuert die aktive Sprache für Übersetzungen über `react-i18next`. Die Sprachauswahl verknüpft BCP-47-Sprachcodes (z. B. `he-IL` oder `ar-JO`) mit Sprachausgaben im Browser oder Offline-Piper-Modellen.

11. **Freunde einladen (Teilen-API)**
    - **Bedeutung**: Bietet eine virale Wachstumsschleife für kostenlose Schrankerweiterungen.
    - **Abhängigkeiten**: Hängt die MongoDB-ID des Werbenden an die URL an. Neuanmeldungen fragen diese ID ab und erhöhen das `closet_capacity_bonus` des Werbenden automatisch um +10 Plätze, wodurch die Kapazitätsgrenzen in `closet.py` aktualisiert werden.

---

## 3.4 Dashboard für Kleiderschrank-Statistiken
Analysieren Sie den Gesamtwert des Kleiderschranks, verfolgen Sie die Kleidungsnutzung und CPW-Parameter.

1. Navigieren Sie zu **Wardrobe Insights**.
2. **Überprüfen Sie die Kennzahlen**:
   - *Wert des Kleiderschranks (Closet Worth)*: Dynamische Summe der Kaufpreise.
   - *Schranknutzung (Closet Utilization)*: Prozentsatz der Kleidungsstücke, die mindestens einmal getragen wurden.
   - *Durchschnittliche Kosten pro Tragen (CPW)*: Berechnet als `Preis / Anzahl Tragevorgänge`.
3. **Verteilungsgrafiken**: Wechseln Sie die Registerkarten, um Recharts-Visualisierungen anzuzeigen:
   - *Farbpalette*: Verteilung der Hex-Farbwerte im Kleiderschrank.
   - *Materialien*: Prozentuale Materialverteilung.
   - *Unterkategorien*: Verteilung der Unterkategorien.
4. **Effizienz-Rangliste**: Zeigen Sie die 5 Kleidungsstücke mit den niedrigsten CPW-Werten an.

---

## 3.5 Outfit-Canvas & Planer
Erstellen, schichten und überprüfen Sie Outfits auf einem interaktiven 2D-Avatar-Canvas.

1. Öffnen Sie den **Outfit Canvas** Planer.
2. **Schichten von Außenbekleidung (Doppelter Canvas)**: Wenn Ihr Outfit Außenbekleidung (z. B. eine Jacke) über einem Oberteil enthält, zeigt die Seite zwei vertikale Avatare an: "With Outerwear" (zeigt die Jacke in der äußeren Schicht) und "Without Outerwear" (zeigt das darunter liegende Oberteil).
3. **Interaktive 2D-Elemente**: Klicken Sie direkt auf ein Kleidungsstück auf dem Körper des Avatars, um direkt zum Detailbildschirm dieses Artikels zu gelangen.
4. **Registerkarte „Metriken“**: Klicken Sie auf die Details-Schaltfläche und wählen Sie die Registerkarte **Metrics** aus, um Kompatibilitätskriterien anzuzeigen:
   - *Farbharmonie* (neutrale Harmonie).
   - *Musterkompatibilität* (Vermeidung von Musterkonflikten).
   - *Passform* (Größenübereinstimmung).
   - *Wettertauglichkeit* (Saisoneignung).
   - *Eventtauglichkeit* (Anlassentsprechung).
   - *Standortkompatibilität* (Prüfung der Einhaltung von Bescheidenheitsregeln).
5. **Umbenennen/Beschreiben**: Klicken Sie auf das Stiftsymbol, um Outfitnamen und -beschreibungen zu bearbeiten.

---

## 3.6 Urlaubsplaner (Urlaubs-Assistent)
Organisieren Sie Ihre Packliste für Reisen, um Übergepäck zu vermeiden.

1. Gehen Sie zur Seite **Suitcase** und füllen Sie das Reisekontext-Formular aus (Zielort, Reisedaten, Reisekategorie, Kalenderereignisse).
2. Die KI generiert eine personalisierte Packliste und tägliche Outfits basierend auf Reisedauer und Wettervorhersagen.
3. Überprüfen Sie den Packfortschritt. Wenn ein wichtiger Artikel fehlt (z. B. Regenschirm bei Regen, Badebekleidung für den Strand), warnt Sie das System und schlägt passende Artikel aus dem Marketplace oder von lokalen Geschäften vor.
4. Verwenden Sie das integrierte Chat-Feld, um Vorschläge anzupassen (z. B. "Ändere Tag 2 in legere Abendkleidung"). Der Assistent aktualisiert die Liste und behält den Rest bei.
5. Tippen Sie auf **Approve Suitcase**, um Ihren Packplan final freizugeben.

---

## 3.7 Planer & tägliche Erinnerungen
Richten Sie tägliche Styling-Erinnerungen ein, um automatisch Outfit-Empfehlungen auf Ihr Telefon zu erhalten.

1. Öffnen Sie **Profile** und gehen Sie zu **Scheduler & Push**.
2. Aktivieren Sie Benachrichtigungen, legen Sie die tägliche Benachrichtigungszeit, die Wochentagshäufigkeit und das Styling-Thema fest.
3. Jeden Morgen prüft die Hintergrundaufgabe (`APScheduler`) die Wettervorhersage und sendet eine Push-Benachrichtigung.
4. Tippen Sie auf die Benachrichtigung auf Ihrem Gerät (oder rufen Sie das Benachrichtigungscenter in der Web-App auf), um einen Dialog mit 3 Outfitvorschlägen zu öffnen.
5. Speichern Sie eine Empfehlung direkt in Ihrem **Wardrobe Diary**.

---

## 3.8 Zirkulärer Marktplatz (Wiederverkauf, Vermietung, Tausch, Geschenke)
Nehmen Sie am Peer-to-Peer-Circular-Fashion-Marktplatz teil.

- **Inserat erstellen**: Öffnen Sie die Detailseite eines Artikels, wählen Sie **Edit Intent** und wählen Sie eine öffentliche Absicht:
  - *For Sale*: Geben Sie Verkaufspreis and Währung ein (erkennt automatisch die lokale Währung über Ihre Regionaleinstellungen).
  - *Rent*: Legen Sie den täglichen Mietpreis und die Leihbedingungen fest.
  - *Swap*: Markieren Sie den Artikel als tauschbar.
  - *Donate*: Verschenken Sie den Artikel kostenlos.
- **Statussynchronisierung**: Inserate werden automatisch im Marketplace-Feed veröffentlicht. Das Frontend verwendet `useSyncExternalStore` und lokalen IndexedDB-Cache, um Suchergebnisse ohne Verzögerung zu laden.
- **Anprobe-Sandbox**: Käufer/Mieter können vor dem Abschluss der Transaktion eine virtuelle Anprobe des Artikels im Vergleich zu Kleidungsstücken in ihrem eigenen Schrank durchführen.
- **Transaktionsabwicklung**:
  - *Kauf/Miete*: Schließen Sie die Transaktion über die integrierten PayPal-Schaltflächen ab. Webhooks informieren den Verkäufer, ändern den Artikelstatus auf verkauft/vermietet und verbuchen die Transaktion abzüglich der 7%igen Plattformgebühr im Buchungsjournal.
  - *Tausch*: Interessierte bieten Tauschgeschäfte an. Der Besitzer erhält Bestätigungs-E-Mails zur Annahme oder Ablehnung.

---

## 3.9 Admin-Dashboard
Überprüfung der Systemfunktion, Finanzbuchhaltung und Verwaltung von Benutzerkonten.

1. Navigieren Sie zu `/admin` (verfügbar für Benutzer mit Administratorrechten).
2. **Übersicht**: Überprüfen Sie das Transaktionsvolumen und die Einnahmen aus Plattformgebühren. Analysieren Sie die Tabelle **Provider Activity Table**, um Antwortzeiten und Fehlerraten externer Dienste (Gemini API, Wetter-API) zu überwachen.
3. **Anbieter (Providers)**: Klicken Sie auf **Verify Key**, um einen Test-Ping an die Gemini API zu senden. Schalten Sie den Schalter **Eyes Vision Override** um, um die Bildanalyse zwischen dem standardmäßigen Gemini-Endpunkt und einem lokalen Gemma-Container umzuleiten.
4. **Benutzer**: Zeigen Sie Guthaben, Rollen und Gesamtzahlungen an. Nutzen Sie Direktaktionen zur Beförderung oder Herabstufung von Benutzern.
5. **Inserate (Listings)**: Zeigen Sie den Status von Inseraten an und deaktivieren Sie Artikel im Falle von Betrugsverdacht.

---

## 4. Erwartete Ergebnisse

- **Erfassung**: Artikel werden sofort im Schrank-Grid angezeigt (~16 ms). Die Hintergrundentfernung erfolgt sauber und liefert transparente PNG-Dateien.
- **DPP-Verifizierung**: Das Scannen gültiger Produktpässe zeigt eine grüne Infokarte mit Nachhaltigkeitsdetails.
- **Avatar-Schichten**: Außenbekleidung wird korrekt über Hemden auf dem 2D-Avatar-Canvas dargestellt, ohne Clipping-Fehler bei Kopfbedeckungen/Schuhen.
- **Sprachausgabe**: Textausgaben des KI-Stylisten werden automatisch vorgelesen und von einer visuellen Wellenformanzeige begleitet.
- **Abonnements**: Nach dem Upgrade auf den Manager- oder Professional-Plan verschwindet die Kapazitätswarnung des Kleiderschranks sofort.

---

## 5. Fehlerbehebung

### HTTP 402 Payment Required
- **Problem**: Ingestion blockiert. Sie haben das Basislimit von 50 Artikeln erreicht (oder bis zu 200 Artikel durch Empfehlungsboni).
- **Lösung**: Gehen Sie zur **Preisseite** (`/pricing`) und abonnieren Sie den Manager- oder Professional-Plan, oder teilen Sie Ihren Empfehlungslink, um +10 Plätze pro Registrierung zu erhalten (bis zu maximal 200 Artikel).

### SSRF-Blockierung / DNS-Fehler bei DPP
- **Problem**: URL des gescannten QR-Produktpasses kann nicht analysiert werden.
- **Lösung**: Der Parser blockiert private IP-Adressen (z. B. `127.0.0.1` und `192.168.x.x`), um interne Server zu schützen. Stellen Sie sicher, dass QR-Codes auf öffentliche Domains verweisen.

### Kameraberechtigung / Mikrofonberechtigung verweigert
- **Problem**: Das Aufnahme-/Scanfenster zeigt eine Fehlermeldung mit einem 'X' oder die Spracheingabe schlägt fehl.
- **Lösung**: Öffnen Sie die Berechtigungen im Browser, erlauben Sie den Zugriff auf Kamera und Mikrofon für die Domain und laden Sie die Seite neu.

### Stylist-Chat fehlgeschlagen / API-Grenzwerte erreicht
- **Problem**: Der Chat friert ein oder zeigt Fehler.
- **Lösung**: Der Server fängt Gemini `429` Überlastungsfehler ab und weicht auf einen regelbasierten Artikelauswahl-Algorithmus aus. Überprüfen Sie Ihre Internetverbindung.

### Arbeitsspeicher-Engpass (OOM) bei VPS-Servern
- **Problem**: Hohe CPU-/RAM-Last bei Upload-Prozessen.
- **Lösung**: Die Erfassung verwendet sequenzielle Sperren für Stapel-Uploads von mehr als 5 Artikeln. Stellen Sie sicher, dass der Server über mindestens 4 GB RAM verfügt.

---

## 6. Einschränkungen

- **Sprach-APIs im Browser**: Die integrierte Sprache-zu-Text-Transkription ist auf Chrome und Safari beschränkt; andere Browser fallen auf Standard-Texteingabe zurück.
- **Offline-Sprachausgabe**: Die mobile Offline-Sprachsynthese über Piper ONNX verwendet weniger Sprachprofile als das serverseitige Gemini-Audiomodell.
- **Bildgrößenbeschränkungen**: Bild-Uploads für Profil und Avatar werden im Browser auf 82 % Qualität komprimiert, um in die 16-MB-Grenze von MongoDB-Dokumenten zu passen.
- **Beleganalyse**: Bei sehr verschwommenen, verzerrten oder handschriftlichen Belegen kann die Datenextraktion fehlschlagen.
