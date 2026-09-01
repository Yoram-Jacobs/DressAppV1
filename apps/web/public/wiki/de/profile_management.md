# Profil, Größen & Konfiguration (`/me`)

Verwalten Sie Körpermaße, Hautton, Körperfoto-Ausschnitte, Styling-Präferenzen, KI-Modell-Anmeldedaten und Systemintegrationen in Ihrem persönlichen Profil-Dashboard.

## Übersicht
Die Seite **Profil & Einstellungen** (`https://dressapp.co/me`) dient als zentrale Steuerzentrale für Ihr DressApp-Ökosystem. Sie beherbergt Ihre physischen anthropometrischen Parameter, die digitale Anprobe-Avatar-Bühne, Stil-Einschränkungen, lokalisierte Präferenzen, KI-Modell-Schlüssel und Push-Benachrichtigungszeitpläne.
Verwalten Sie physische Maße, Hautton, Körperfoto-Ausschnitte, Styling-Präferenzen, KI-Modell-Anmeldedaten und Systemintegrationen auf Ihrem persönlichen Profil-Dashboard.

## Übersicht
Die Seite **Profil & Einstellungen** (`https://dressapp.co/me`) dient als zentrale Steuerzentrale für Ihr DressApp-Ökosystem. Sie enthält Ihre physischen anthropometrischen Parameter, Ihre digitale Try-on-Avatarbühne, Stilbeschränkungen, lokalisierte Präferenzen, KI-Modellschlüssel und Push-Benachrichtigungszeitpläne.

---

## Voraussetzungen
- Ein aktives DressApp-Konto.
- (Optional) Gerätekamera-Berechtigungen für Ganzkörper-Foto-Upload.
- (Optional) Standortberechtigungen für lokales Stylisten-Kampagnen-Targeting und Wettervorhersage.
- (Optional) Kameraberechtigungen des Geräts für den Upload von Ganzkörperfotos.
- (Optional) Standortberechtigungen für die Ausrichtung lokaler Stylisten-Kampagnen, kulturelle Einschränkungen und Wettervorhersagen.

---

## Schritt-für-Schritt-Anleitung: Seitenübersicht von oben nach unten

### 1. Seitenkopf & Entdecken-Navigationsleiste
Am oberen Rand des `/me`-Dashboards:
- **Kopfzeile**: Zeigt Ihren Kontostatus und Titel an.
- **Entdecken-Karten**: Schnellzugriff auf Haupt-App-Bereiche:
  - **Trend Scout** (`/trends`): Täglich KI-kuratierte Mode-News-Feeds anzeigen.
  - **Outfits** (`/outfits`): Auf Ihren gespeicherten Outfit-Kalender zugreifen.
  - **Experten** (`/experts`): Lokale Modestylisten und Schneider durchsuchen.
  - **Unpacked / Statistiken** (`/me/stats`): Kleiderschrankbewertung, Cost-per-Wear-Metriken und Farbaufschlüsselungen anzeigen.

### 2. Sprach- & Sprachauswahl-Karte
Prominent platziert für sofortige Barrierefreiheit:
- **Sprachauswahl**: Wählen Sie aus 12 unterstützten Sprachen (*Englisch, Spanisch, Französisch, Deutsch, Italienisch, Portugiesisch, Russisch, Chinesisch, Japanisch, Arabisch, Hindi, Hebräisch*). Die Auswahl einer Sprache aktualisiert die UI-Locale automatisch und bindet das Standard-Regional-Text-to-Speech (TTS)-Stimmenmodell.

---

### 3. Identitäts- & Persönliche-Details-Karte (`ProfileDetailsCard`)

Enthält 9 erweiterbare Akkordeon-Panels zur Verwaltung Ihrer persönlichen Identität, Größen und Avatar-Darstellung:

#### Panel A: Identität
- **Vor- & Nachname**: Persönliche Identifikationsfelder.
- **E-Mail-Adresse**: Read-only-Anzeige Ihrer registrierten E-Mail.
- **Geburtsdatum**: Wird zur Personalisierung demografischer Trend-Bewertung verwendet.
- *Google Autofill Badge*: Wird automatisch angezeigt, wenn Ihr Profil über Google OAuth erstellt wurde.

#### Panel B: Kontakt & Lieferadresse
- **Telefonnummer**: Erforderlich für SMS/Push-Benachrichtigungen für tägliche Scheduler-Vorschläge und lokale Expertenkampagnen.
- **Adresszeile 1**: OpenStreetMap (Nominatim) Straßenebene-Autovervollständigung. Auswahl eines Vorschlags füllt Zeile 1, Stadt, Region, PLZ und Land automatisch aus.
- **Adresszeile 2, Stadt, Region, Postleitzahl**: Manuelle Adressfelder für Marketplace-Versand.
- **Land**: Offline-Kombinationsfeld, durchsuchbar nach Ländernamen oder ISO-2-Code.

#### Panel C: Demografie
- **Geschlecht**: *Weiblich* oder *Männlich* wählen, um Basiskörpermaße und Bekleidungstaxonomie zu konfigurieren.
- **Persönlicher Status**: *Single*, *Verheiratet*, *Geschieden* oder *Verwitwet* wählen.
- **Beruf**: Freitexteingabe (z. B. *Student*, *Marketing Manager*, *Barista*). Speist den Trend-Scout-Personalisierungs-Ranker für relevante Stil-Nachrichten.

#### Panel D: Präferenzen & Maßeinheiten
- **Gewichtseinheit**: Zwischen Kilogramm (`kg`) und Pfund (`lb`) umschalten.
- **Längeneinheit**: Zwischen Zentimeter (`cm`) und Zoll (`in`) umschalten.

#### Panel E: Fotos & Digitale Avatar-Bühne
- **Linke Spalte — Foto-Auswahl**:
  - *Gesichtsbild*: Avatar-Thumbnail hochladen.
  - *Ganzkörperfoto*: Ganzkörperfoto hochladen. Das System führt automatisch lokales U2-Net (`rembg`) Matting zur Hintergrundentfernung durch.
  - *Foto entfernen Button*: Ein-Klick-Entfernung Ihres Foto-Ausschnitts, sofortiger Wechsel zurück zur 2D-SVG-Vektorpuppe ohne UI-Lag.
- **Rechte Spalte — Digitaler Avatar & Anprobe-Bühne**:
  - **Hautton-Wähler**: Interaktive Farbpalette zur Auswahl Ihres Mannequin-Hauttons.
  - **Avatar-Anprobe-Canvas**: Rendert Kleidungsstücke auf Ihrem Foto-Ausschnitt oder der dynamischen Bézier-Vektorpuppe (`DynamicAvatar.jsx`) mit kalibrierten Landmarken-Offsets (`top-[14.5%]` Kragen-zu-Halslinie und `top-[36.5%]` Bund-zu-Taillinie).

#### Panel F: Stilprofil
- **Ästhetik**: Kommagetrennte Stil-Keywords (z. B. *Minimalistisch, Streetwear, Vintage*).
- **Farbpalette**: Bevorzugte Farbtöne (z. B. *Pastell, Erdtöne, Monochrom*).
- **Vermeiden**: Farben oder Kleidungsstücke, die strikt von KI-Empfehlungen ausgeschlossen werden (z. B. *Gelb, Crop Tops*).
- **Kulturelle Kleidungskonservativität**: Bescheidenheitsgrad wählen (*Locker/Entspannt*, *Mäßig*, *Konservativ*) zur Steuerung der KI-Stylisten-Outfit-Bedeckung.

#### Panel G: Körpermaße & Größen (ANSUR II Größen-Prädiktor)
- **Onboarding / Neuanfang-Modus**: 4 Basiseingaben eingeben: **Größe**, **Gewicht**, **Taillenumfang** und **Fußlänge**. Das integrierte scikit-learn ANSUR II Multi-Output-Regressionsmodell sagt automatisch 6 strukturelle Maße voraus:
  - *Schultern*, *Brust/Busen*, *Hüfte*, *Ärmellänge*, *Innenbeinlänge* und *Außenbeinlänge*.
- **Automatische Größenübersetzung**: Sobald strukturelle Maße vorhergesagt sind, füllen deterministische Größenalgorithmen **alle Standard-Einzelhandelsgrößen** bis hin zur Schuhgröße sofort aus:
  - *Casual-Shirt-Größe* (XS–XXL basierend auf Brustumfang)
  - *Hosen-Taillengröße* (Zoll, umgerechnet von Taillen-cm)
  - *US-Schuhgröße* (Herren/Damen-Formeln aus Fußlänge)
  - *Damen-Kleidergröße* (US 0–14+ basierend auf Taille)
  - *Damen-BH-Größe* (Band + Cup berechnet aus Brust/Unterbrust)
- **Detaillierter Bearbeitungsmodus**: Nach Auto-Ausfüllung alle 15 Größenparameter feinjustieren (inkl. Shirt-Größe, Hosen-Größe, Schuhgröße, BH-Größe, Kleidergröße) und Haareigenschaften (*Länge, Art, Farbe, Stil*).
- **Live-Einheiten-Umschaltung**: Zwischen *kg/cm* und *lb/in* wechseln — alle Werte konvertieren sofort ohne Neuvorhersage.

#### Panel H: Profi- & Expertenverzeichnis-Registrierung
- **Profi-Stylist-Umschalter**: Als verifizierter Modeprofi registrieren (Stylist, Schneider, Designer).
- **Geschäftsdetails**: Firmenname, Adresse, Telefon, E-Mail, Website und Beschreibung eingeben, um im `/experts`-Verzeichnis und regionalem Kampagnen-Ticker aufzutauchen.

#### Panel I: PayPal-Auszahlungseinstellungen
- **PayPal-Empfänger-E-Mail**: Ihre PayPal-E-Mail eingeben, um Auszahlungen für Marketplace-Verkäufe und aktive Expertenkampagnen zu erhalten.

---

### 4. Systemeinstellungen-Akkordeon-Karte

Verwaltet Systemeinstellungen, Abonnements und KI-Integrationen:

- **KI-Konfiguration**:
  - *Standardmodus*: Verwendet systemverwaltete Gemini Flash 2.x-Endpunkte.
  - *Benutzerdefinierter API-Schlüssel-Modus*: Eigene Google Gemini, Anthropic, OpenAI oder DeepSeek API-Schlüssel über geführtes Setup-Modal verbinden.
- **Abonnement & Kleiderschranklimits**:
  - Aktuelle Kontostufe anzeigen (**Kostenlos**: 150-Artikel-Limit vs **Pro**: Unbegrenzt).
  - Upgrade über PayPal Subscriptions REST API ($4.99/Monat oder $29.99/Jahr).
  - **Empfehlungslink kopieren**: Gewährt +10 Kleiderschrank-Kapazitätsslots für jeden Freund, der sich registriert.
- **Scheduler & Push-Erinnerungen**:
  - Morgendliche Outfit-Vorschlag-Benachrichtigungen umschalten.
  - Häufigkeit festlegen (*Täglich*, *Jeden zweiten Tag*, *Zweimal wöchentlich*, *An Wochentagen*), Uhrzeit (z. B. *07:00*) und Dresscode-Stil (*Casual*, *Formal*, *Athletisch*, *Benutzerdefiniert*).
  - Browser-VAPID-Push-Benachrichtigungen aktivieren.
- **Kampagnen-Benachrichtigungspräferenzen**:
  - Granulare Umschalter für *Lokale Mode Push/E-Mail*, *Verkaufsalarme*, *Nachhaltige Mode*, *Luxus-Promos* und *Persönlicher Stylist*.
  - **Max. Kampagnen-Distanz** Schieberegler einstellen (5 km bis 50 km).
- **Google Kalender Verbinden**: OAuth-Button zur Synchronisation persönlicher Kalenderereignisse mit dem KI-Stylisten.
- **Standortdienste-Karte**: GPS-Standortberechtigungen für entfernungsbasierte Experten-Feeds und hyperlokales Wetter umschalten.
- **Freunde Einladen Button**: Teilbaren Empfehlungslink kopieren.
- **Shopping Assistant**: Chrome Web Store Erweiterungsdetails aufrufen oder **Universal Bookmarklet** (`javascript:...`) für sofortige E-Commerce-Größenvergleiche generieren.
### 1. Seitenkopf & Erkundungs-Navigationsleiste
Befindet sich oben auf dem `/me`-Dashboard:
- **Seitenkopf**: Zeigt Ihren Kontostatus und Titel an.
- **Erkundungskarten**: Schnelle Verknüpfungen zu den Hauptbereichen der App:
  - **Trend Scout** (`/trends`): Zeigen Sie täglich von einer KI kuratierte Modenachrichten an.
  - **Outfits** (`/outfits`): Greifen Sie auf Ihren gespeicherten Outfit-Kalender zu.
  - **Experts** (`/experts`): Durchsuchen Sie lokale Modestylisten und Schneider.
  - **Unpacked / Stats** (`/me/stats`): Zeigen Sie die Bewertung Ihres Kleiderschranks, Cost-per-Wear-Metriken und Farbanalysen an.

### 2. Sprach- & Sprachauswahlkarte
Gut sichtbar platziert für sofortige Barrierefreiheit:
- **Sprachauswahl**: Wählen Sie aus 12 unterstützten Sprachen (*Deutsch, Englisch, Spanisch, Französisch, Italienisch, Portugiesisch, Russisch, Chinesisch, Japanisch, Arabisch, Hindi, Hebräisch*). Die Auswahl einer Sprache aktualisiert automatisch das UI-Gebietsschema und bindet das standardmäßige regionale Text-to-Speech (TTS)-Sprachmodell.

---

### 3. Identitäts- & persönliche Detailkarte (`ProfileDetailsCard`)

Enthält 9 erweiterbare Akkordeon-Panels zur Verwaltung Ihrer persönlichen Identität, Größe und Avatar-Darstellung:

#### Panel A: Identität
- **Vorname & Nachname**: Felder zur persönlichen Identifikation.
- **E-Mail-Adresse**: Schreibgeschützte Anzeige Ihrer registrierten E-Mail-Adresse.
- **Geburtsdatum**: Wird verwendet, um die demografische Trendbewertung zu personalisieren.
- *Google-Autofill-Badge*: Wird automatisch angezeigt, wenn Ihr Profil über Google OAuth erstellt wurde.

#### Panel B: Kontakt- & Lieferadresse
- **Telefonnummer**: Erforderlich, um SMS-/Push-Benachrichtigungen für tägliche Planervorschläge und lokale Expertenkampagnen zu erhalten.
- **Adresszeile 1**: Bietet eine automatische Vervollständigung auf Straßenebene über OpenStreetMap (Nominatim). Durch Auswahl eines Vorschlags werden Zeile 1, Stadt, Region, Postleitzahl und Land automatisch ausgefüllt.
- **Adresszeile 2, Stadt, Region, Postleitzahl**: Manuelle Adressfelder für den Marketplace-Versand.
- **Land**: Offline-Kombinationsfeld, durchsuchbar nach Ländernamen oder ISO-2-Code.

#### Panel C: Demografie
- **Geschlecht**: Wählen Sie *Female* oder *Male*, um die Körpergrundmaße und die Kleidungstaxonomie zu konfigurieren.
- **Familienstand**: Wählen Sie *Single*, *Married*, *Divorced* oder *Widowed*.
- **Beruf**: Freitexteingabe (z. B. *Student*, *Marketing Manager*, *Barista*). Speist den Trend Scout-Personalisierungs-Ranker, um relevante Stilnachrichten zu priorisieren.

#### Zusammenfassung: Synchronisieren fehlender Google-Profildaten (People API-Zustimmung)
Wenn Sie sich mit Google angemeldet haben, bevor DressApp Zugriff auf Ihre Profildetails der **Google People API** (Telefon, Adresse, Geschlecht, Geburtsdatum) angefordert hat, bleiben diese Felder möglicherweise leer. Sie können sie mit einem Klick synchronisieren:

1. **Öffnen Sie das Akkordeon „Kontakt“ oder „Demografie“** — Sie sehen eine Schaltfläche **"Sync from Google"** (Aktualisierungssymbol) neben dem Titel des Abschnitts.
2. **Klicken Sie auf „Sync from Google“** — Wenn die erforderlichen People API-Berechtigungen bei Ihrer ursprünglichen Anmeldung nicht erteilt wurden, erkennt DressApp dies und zeigt einen Info-Toast an: *"Google benötigt Ihre Erlaubnis, um auf Profildetails zuzugreifen. Sie werden zu Google weitergeleitet, um den Zugriff zu gewähren."*
3. **Erteilen Sie die Zustimmung auf dem Google-Bildschirm** — Sie werden zum OAuth-Zustimmungsbildschirm von Google weitergeleitet. Aktivieren Sie die Kontrollkästchen für **Profile info** (Name, E-Mail, Foto) und **Contact info** (Telefon, Adresse, Geschlecht, Geburtstag).
4. **Automatische Rückkehr & automatisches Ausfüllen** — Nach der Zustimmung leitet Google Sie zurück zu DressApp. Die Funktion `syncGoogleProfile()` wird automatisch ausgeführt und ruft den Backend-Endpunkt `/auth/google/sync-profile` auf, der:
   - Ihre Telefonnummer, Adresse, Ihr Geschlecht und Ihr Geburtsdatum von der Google People API abruft.
   - Die leeren Felder in den Panels **Kontakt** (Telefon, Adresse) und **Demografie** (Geschlecht, Geburtsdatum) ausfüllt.
   - Die Aktualisierungen sofort in Ihrem Profil speichert.
5. **Fertig** — Ihr Profil ist nun ohne manuelles Tippen vollständig.

> **Hinweis**: Die Schaltfläche „Sync from Google“ wird auch im Seitenkopf (neben der Hauptschaltfläche „Google-Profil synchronisieren“) angezeigt und funktioniert auf dieselbe Weise — sie synchronisiert alle verfügbaren Google-Profildaten auf einmal.

#### Panel D: Präferenzen & Maßeinheiten
- **Gewichtseinheit**: Wechseln Sie zwischen Kilogramm (`kg`) und Pfund (`lb`).
- **Längeneinheit**: Wechseln Sie zwischen Zentimetern (`cm`) und Zoll (`in`).

#### Panel E: Fotos & digitale Avatarbühne
- **Linke Spalte — Foto-Auswahl**:
  - *Gesichtsfoto*: Laden Sie ein Avatar-Vorschaubild hoch.
  - *Ganzkörperfoto*: Laden Sie ein Ganzkörperfoto hoch. Das System führt automatisch eine lokale U2-Net-Matting (`rembg`) durch, um den Hintergrund zu entfernen.
  - *Foto entfernen*: Entfernen Sie Ihren Foto-Ausschnitt mit einem Klick, um die Try-on-Bühne ohne UI-Verzögerung sofort wieder auf die 2D-SVG-Vektorschaufensterpuppe umzustellen.
- **Rechte Spalte — Digitaler Avatar & Try-On-Bühne**:
  - **Hautton-Auswahl**: Interaktive Farbpalette zur Auswahl des Hauttons Ihrer Schaufensterpuppe.
  - **Avatar Try-On-Canvas**: Rendert Kleidungsstücke auf Ihrem Foto-Ausschnitt oder Ihrer dynamischen Bezier-Vektorschaufensterpuppe (`DynamicAvatar.jsx`) unter Verwendung kalibrierter Landmarken-Offsets (`top-[14.5%]` Kragen-zu-Ausschnitt und `top-[36.5%]` Hosenbund-zu-Taille).

#### Panel F: Stilprofil
- **Ästhetik**: Kommagetrennte Stil-Schlüsselwörter (z. B. *Minimalist, Streetwear, Vintage*).
- **Farbpalette**: Bevorzugte Farbtöne (z. B. *Pastels, Earth Tones, Monochrome*).
- **Vermeiden**: Farben oder Kleidungsstücktypen, die strikt von KI-Empfehlungen ausgeschlossen werden sollen (z. B. *Yellow, Crop Tops*).
- **Kulturelle Kleidungs-Konservativität**: Wählen Sie das Bescheidenheitsniveau (*Casual/Relaxed*, *Moderate*, *Conservative*), um die Abdeckung durch den AI Stylist zu steuern.

#### Panel G: Körpermaße & Größen (ANSUR II Sizing Predictor)
- **Onboarding / Neuanfang-Modus**: Geben Sie 4 Basiseingaben ein: **Height** (Größe), **Weight** (Gewicht), **Waist** (Taille) und **Foot Length** (Fußlänge). Das integrierte scikit-learn ANSUR II Multi-Output-Regressionsmodell prognostiziert automatisch 6 strukturelle Maße:
  - *Schultern*, *Brustumfang*, *Hüfte*, *Ärmellänge*, *Schrittlänge (Inseam)* und *Außennaht (Outseam)*.
- **Automatische Größenübersetzung**: Sobald die strukturellen Maße vorhergesagt wurden, füllen deterministische Größenalgorithmen sofort **alle Standard-Einzelhandelsgrößen** bis hin zur Schuhgröße aus:
  - *Freizeithemd-Größe* (XS–XXL basierend auf dem Brustumfang)
  - *Hosen-Taille* (in Zoll, umgerechnet aus Taille in cm)
  - *US-Schuhgröße* (Formeln für Männer/Frauen basierend auf Fußlänge)
  - *Damenkleidergröße* (US 0–14+ basierend auf der Taille)
  - *Damen-BH-Größe* (Unterbrust- und Brustumfang)
- **Detaillierter Bearbeitungsmodus**: Optimieren Sie nach dem automatischen Ausfüllen alle 15 Größenparameter (einschließlich Hemdgröße, Hosengröße, Schuhgröße, BH-Größe, Kleidungsgröße) und Haar-Attribute (*Länge, Typ, Farbe, Stil*).
- **Einheiten-Wechsel**: Wechseln Sie zwischen *kg/cm* und *lb/in* — alle Werte werden sofort ohne erneute Vorhersage umgerechnet.

#### Panel H: Registrierung im Expertenverzeichnis
- **Registrierung als professioneller Stylist**: Registrieren Sie sich als verifizierter Modeprofi (Stylist, Schneider, Designer).
- **Geschäftsdetails**: Geben Sie Firmenname, Adresse, Telefonnummer, E-Mail-Adresse, Website und Beschreibung ein, um im `/experts`-Verzeichnis und im regionalen Kampagnen-Ticker zu erscheinen.

#### Panel I: PayPal-Auszahlungseinstellungen
- **PayPal-Empfänger-E-Mail**: Geben Sie Ihre PayPal-E-Mail-Adresse ein, um Auszahlungen für Marketplace-Verkäufe und aktive Expertenkampagnen zu erhalten.

---

### 4. Akkordeonkarte für Systempräferenzen

Verwaltet Einstellungen auf Systemebene, Abonnements und KI-Integrationen:

- **KI-Konfiguration**:
  - *Standardmodus*: Verwendet vom System verwaltete Gemini Flash 2.x-Endpunkte.
  - *Modus für benutzerdefinierte API-Schlüssel*: Verbinden Sie benutzerdefinierte Google Gemini-, Anthropic-, OpenAI- oder DeepSeek-API-Schlüssel über ein geführtes Einrichtungsmodal.
- **Abonnement & Kleiderschrank-Limits**:
  - Zeigen Sie die aktuelle Kontostufe an (**Free**: Limit von 50 Artikeln vs. **Manager** oder **Professional**: Unbegrenzte Artikel).
  - Rufen Sie die **Preisseite** auf (`/pricing` oder klicken Sie auf Ihre Plankarte), um die Stufenvergleichstabelle anzuzeigen, einen Plan auszuwählen und ihn zu abonnieren.
  - Upgrade über die PayPal Subscriptions REST API (Manager: 4,99 $/Monat; Professional: 9,99 $/Monat) oder das Atzmai-Gateway für lokale ILS-Transaktionen.
  - Kopieren Sie den **Empfehlungslink**: Gewährt +10 zusätzliche Kapazitätsplätze im Kleiderschrank für jeden registrierten Freund (bis zu maximal 200 Artikel).
- **Planer & Push-Erinnerungen**:
  - Schalten Sie morgendliche Outfit-Vorschlagsbenachrichtigungen ein/aus.
  - Stellen Sie Häufigkeit (*Täglich*, *Alle zwei Tage*, *Zweimal pro Woche*, *An Wochentagen*), Uhrzeit (z. B. *07:00*) und Anforderungen an den Dresscode (*Casual*, *Formal*, *Athletic*, *Custom*) ein.
  - Aktivieren Sie Browser-VAPID-Push-Benachrichtigungen.
- **Kampagnen-Benachrichtigungseinstellungen**:
  - Detaillierte Schalter für *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos* und *Personal Stylist*.
  - Passen Sie den Schieberegler für die **maximale Kampagnenentfernung** an (5 km bis 50 km).
- **Google Calendar verbinden**: OAuth-Schaltfläche zur Synchronisierung persönlicher Kalenderereignisse mit dem AI Stylist.
- **Standortdienste**: Aktivieren Sie GPS-Standortberechtigungen für entfernungsabgestimmte Experten-Feeds und hyperlokales Wetter.
- **Freunde einladen**: Kopieren Sie den teilbaren Empfehlungslink.
- **Einkaufsassistent**: Rufen Sie Details zur Erweiterung des Chrome Web Store ab oder generieren Sie ein **Universal Bookmarklet** (`javascript:...`) für sofortige Größenvergleiche im E-Commerce.

---

### 5. Kontoaktionen & Diagnose
- **Abmelden**: Aus der aktuellen Sitzung abmelden.
- **Mein Konto löschen**: Link zum dauerhaften Löschen von Kontodaten.
- **Entwickler-Panel**: Diagnose-Akkordeon für Umgebungs-Tests.
- **Abmelden**: Melden Sie sich von Ihrer aktuellen Sitzung ab.
- **Mein Konto löschen**: Link zum dauerhaften Löschen von Kontodaten.
- **Entwickler-Panel**: Diagnose-Akkordeon für Umgebungstests.

---

## Erwartete Ergebnisse
- Sofortige Synchronisation physischer Metriken, Hauttons und Fotoausschnitte über die 2D-Avatar-Anprobe-Leinwand.
- Null Leerlauf-Netzwerkanfragen beim Navigieren zwischen Einstellungs-Panels.
- Angepasste KI-Stylisten-Outfit-Vorschläge, abgestimmt auf Ihre Bescheidenheitsregeln und Ihren Zeitplan.
- Sofortige Synchronisierung physischer Maße, des Hauttons und der Foto-Ausschnitte auf dem 2D-Avatar Try-On-Canvas.
- Keine inaktiven Netzwerkanfragen beim Navigieren zwischen den Einstellungsbereichen.
- Maßgeschneiderte AI Stylist-Outfit-Vorschläge, die auf Ihre Bescheidenheitsregeln und Ihren Zeitplan abgestimmt sind.

---

## Fehlerbehebung
- **Foto-Hintergrund nicht entfernt**: Stellen Sie sicher, dass Ihr hochgeladenes Foto ganzkörperig mit kontrastierender Hintergrundbeleuchtung ist.
- **Push-Benachrichtigungen kommen nicht an**: Bestätigen Sie, dass Browser-Benachrichtigungsberechtigungen aktiviert sind und eine Telefonnummer unter *Kontakt* gespeichert ist.
- **Adress-Autovervollständigung reagiert nicht**: Prüfen Sie, ob die Internetverbindung für OpenStreetMap Nominatim-Abfragen aktiv ist.
- **Hintergrund des Fotos nicht entfernt**: Stellen Sie sicher, dass das hochgeladene Foto ein Ganzkörperfoto mit kontrastierender Hintergrundbeleuchtung ist.
- **Push-Benachrichtigungen kommen nicht an**: Bestätigen Sie, dass die Benachrichtigungsberechtigungen des Browsers aktiviert sind und eine Telefonnummer unter *Kontakt* gespeichert ist.
- **Automatische Vervollständigung der Adresse reagiert nicht**: Überprüfen Sie, ob eine aktive Internetverbindung für OpenStreetMap Nominatim-Abfragen vorhanden ist.

---

## Einschränkungen
- Kostenloses Kontingent ist auf 150 Artikel begrenzt, es sei denn, es wird durch Empfehlungsbonus (+10 Slots pro Einladung) oder Pro-Abonnement erweitert.
- Benutzerdefinierter API-Schlüssel-Modus erfordert gültige Schlüssel mit verbleibendem Kontingent vom jeweiligen Anbieter.

(Ende der Datei)
- Der Speicherplatz für Free-Konten ist auf 50 Artikel begrenzt, es sei denn, er wird durch Empfehlungsboni erweitert (+10 Plätze pro Einladung, bis zu maximal 200 Artikel) oder durch ein Upgrade auf die Manager- oder Professional-Stufe.
- Der Modus für benutzerdefinierte API-Schlüssel erfordert gültige Schlüssel mit verbleibendem Kontingent des jeweiligen Anbieters.
