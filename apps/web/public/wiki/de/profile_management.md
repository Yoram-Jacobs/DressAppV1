# Profil, Größen & Konfiguration (`/me`)

Verwalten Sie Körpermaße, Hautton, Ganzkörper-Fotoausschnitte, Styling-Präferenzen, KI-Modell-Einstellungen und Systemintegrationen auf Ihrem persönlichen Profil-Dashboard.

## Übersicht
Die Seite **Profil & Einstellungen** (`https://dressapp.co/me`) dient als zentrale Steuerzentrale für Ihr DressApp-Ökosystem. Sie umfasst Ihre anthropometrischen Körperparameter, die digitale Anprobebühne für den Avatar, Stilvorgaben, lokalisierte Einstellungen, KI-Modell-Konfigurationen und Push-Benachrichtigungszeitpläne.

---

## Voraussetzungen
- Ein aktives DressApp-Konto.
- (Optional) Kameraberechtigung des Geräts für den Upload von Ganzkörperfotos.
- (Optional) Standortberechtigung für regionales Stylisten-Kampagnen-Targeting, kulturelle Bekleidungsvorgaben und Wettervorhersagen.

---

## Schritt-für-Schritt-Anleitung: Seitenübersicht von oben nach unten

### 1. Seitenkopf & Explore-Navigationsleiste
Befindet sich ganz oben auf dem `/me`-Dashboard:
- **Kopfbereich (Header)**: Zeigt Ihren Kontostatus und Titel an.
- **Explore-Karten**: Schnelle Verknüpfungen zu den Hauptbereichen der App:
  - **Trend Scout** (`/trends`): Tägliche KI-kuratierte Modenachrichten-Feeds anzeigen.
  - **Outfits** (`/outfits`): Zugriff auf Ihren gespeicherten Outfit-Kalender.
  - **Experts** (`/experts`): Lokale Mode-Stylisten und Schneider durchsuchen.
  - **Unpacked / Stats** (`/me/stats`): Garderobenbewertung, Cost-per-Wear-Metriken und Farbaufschlüsselungen einsehen.

### 2. Sprach- & Stimmauswahl-Karte
Prominent platziert für sofortigen Zugriff:
- **Sprachauswahl**: Wählen Sie aus 12 unterstützten Sprachen (*Englisch, Spanisch, Französisch, Deutsch, Italienisch, Portugiesisch, Russisch, Chinesisch, Japanisch, Arabisch, Hindi, Hebräisch*). Die Auswahl einer Sprache aktualisiert automatisch das Gebietsschema der Benutzeroberfläche und bindet das standardmäßige regionale Text-to-Speech (TTS)-Sprachmodell ein.

---

### 3. Karte für Identität & persönliche Angaben (`ProfileDetailsCard`)

Enthält 9 aufklappbare Akkordeon-Panels zur Verwaltung Ihrer persönlichen Identität, Größen und Avatar-Darstellung:

#### Panel A: Identität
- **Vorname & Nachname**: Felder zur persönlichen Identifikation.
- **E-Mail-Adresse**: Schreibgeschützte Anzeige Ihrer registrierten E-Mail-Adresse.
- **Geburtsdatum**: Wird zur Personalisierung des demografischen Trend-Scorings verwendet.
- *Google-Autofill-Badge*: Wird automatisch angezeigt, wenn Ihr Profil über Google OAuth initialisiert wurde.

#### Panel B: Kontakt & Lieferadresse
- **Telefonnummer**: Erforderlich für den Empfang von SMS-/Push-Benachrichtigungen für tägliche Planer-Vorschläge und lokale Expertenkampagnen.
- **Adresszeile 1**: Bietet Autovervollständigung auf Straßenebene über OpenStreetMap (Nominatim). Die Auswahl eines Vorschlags füllt Zeile 1, Stadt, Region, Postleitzahl und Land automatisch aus.
- **Adresszeile 2, Stadt, Region, Postleitzahl**: Manuelle Adressfelder für den Marktplatzversand.
- **Land**: Offline-Combobox, durchsuchbar nach Ländernamen oder ISO-2-Code.

#### Panel C: Demografie
- **Geschlecht (Sex)**: Wählen Sie *Weiblich* oder *Männlich*, um grundlegende Körpermaße und Kleidungstaxonomien zu konfigurieren.
- **Familienstand**: Wählen Sie *Ledig*, *Verheiratet*, *Geschieden* oder *Verwitwet*.
- **Beruf**: Freitexteingabe (z. B. *Student*, *Marketing-Manager*, *Barista*). Fließt in das Personalisierungs-Ranking von Trend Scout ein, um relevante Modenachrichten zu priorisieren.

#### Zusammenfassende Anleitung: Synchronisierung fehlender Google-Profildaten (Erneute People API-Zustimmung)
Falls Sie sich mit Google angemeldet haben, bevor DressApp Zugriff auf Ihre Profildaten der **People API** (Telefon, Adresse, Geschlecht, Geburtsdatum) angefordert hat, sind diese Felder möglicherweise noch leer. Sie können sie mit einem Klick synchronisieren:

1. **Öffnen Sie das Akkordeon „Kontakt" oder „Demografie"** — neben dem Abschnittstitel finden Sie die Schaltfläche **„Sync from Google"** (Aktualisierungssymbol).
2. **Klicken Sie auf „Sync from Google"** — falls die erforderlichen People API-Berechtigungen bei Ihrer ursprünglichen Anmeldung nicht erteilt wurden, erkennt DressApp dies und zeigt einen Hinweis-Toast an: *„Google benötigt Ihre Erlaubnis für den Zugriff auf Profildetails. Sie werden zu Google weitergeleitet, um den Zugriff zu gewähren."*
3. **Zustimmung auf dem Google-Bildschirm erteilen** — Sie werden zum OAuth-Zustimmungsbildschirm von Google weitergeleitet. Aktivieren Sie die Kontrollkästchen für **Profilinformationen** (Name, E-Mail, Foto) und **Kontaktinformationen** (Telefon, Adresse, Geschlecht, Geburtstag).
4. **Automatische Rückkehr & automatisches Ausfüllen** — nach der Zustimmung leitet Google Sie zurück zu DressApp. Die Funktion `syncGoogleProfile()` wird automatisch ausgeführt und ruft den Backend-Endpunkt `/auth/google/sync-profile` auf, welcher:
   - Ihre Telefonnummer, Adresse, Ihr Geschlecht und Ihr Geburtsdatum über die Google People API abruft
   - Die leeren Felder in den Panels **Kontakt** (Telefon, Adresse) und **Demografie** (Geschlecht, Geburtsdatum) ausfüllt
   - Die Aktualisierungen sofort in Ihrem Profil speichert
5. **Fertig** — Ihr Profil ist nun ohne manuelles Tippen vollständig.

> **Hinweis**: Die Schaltfläche „Sync from Google" erscheint auch im Seitenkopf (neben der Hauptschaltfläche „Sync Google Profile") und funktioniert auf dieselbe Weise — sie synchronisiert alle verfügbaren Google-Profildaten auf einmal.

#### Panel D: Einstellungen & Maßeinheiten
- **Gewichtseinheit**: Umschalten zwischen Kilogramm (`kg`) und Pfund (`lb`).
- **Längeneinheit**: Umschalten zwischen Zentimetern (`cm`) und Zoll (`in`).

#### Panel E: Fotos & digitale Avatar-Bühne
- **Linke Spalte — Foto-Auswahl**:
  - *Gesichtsfoto*: Avatar-Vorschaubild hochladen.
  - *Ganzkörperfoto*: Ein Ganzkörperfoto hochladen. Das System führt automatisch ein lokales U2-Net (`rembg`)-Matting aus, um den Hintergrund zu entfernen.
  - *Foto-Entfernen-Schaltfläche*: Entfernt Ihren Fotoausschnitt mit einem Klick und schaltet die Anprobebühne ohne Verzögerung sofort wieder auf die 2D-SVG-Vektormanikin um.
- **Rechte Spalte — Digitaler Avatar & Anprobebühne**:
  - **Hautton-Auswahl**: Interaktive Farbpalette zur Auswahl des Hauttons Ihrer Manikin.
  - **Avatar-Anprobefläche (Avatar Try-On Canvas)**: Rendert Kleidungsstücke auf Ihrem Fotoausschnitt oder der dynamischen Bézier-Vektormanikin (`DynamicAvatar.jsx`) unter Verwendung kalibrierter Landmark-Offsets (`top-[14.5%]` Kragen-zu-Halsausschnitt und `top-[36.5%]` Hosenbund-zu-Taille).

#### Panel F: Stil-Profil
- **Ästhetik**: Kommagetrennte Stil-Schlagwörter (z. B. *Minimalistisch, Streetwear, Vintage*).
- **Farbpalette**: Bevorzugte Farbtöne (z. B. *Pastelltöne, Erdtöne, Monochrom*).
- **Vermeiden**: Farben oder Kleidungsarten, die strikt von KI-Empfehlungen ausgeschlossen werden sollen (z. B. *Gelb, Crop Tops*).
- **Kulturelle Konservativität der Kleidung**: Wählen Sie das gewünschte Maß an modischer Zurückhaltung (*Locker/Entspannt*, *Moderat*, *Konservativ*), um den Bedeckungsgrad bei Empfehlungen des KI-Stylisten zu steuern.

#### Panel G: Körpermaße & Konfektionsgrößen (ANSUR II Sizing Predictor)
- **Onboarding / Neustart-Modus**: Geben Sie 4 grundlegende Werte ein: **Körpergröße**, **Gewicht**, **Taillenumfang** und **Fußlänge**. Das integrierte scikit-learn ANSUR II Multi-Output-Regressionsmodell prognostiziert automatisch 6 strukturelle Maße:
  - *Schultern*, *Brust / Oberweite*, *Hüfte*, *Ärmellänge*, *Innenbeinlänge* und *Außenbeinlänge*.
- **Automatische Größenübersetzung**: Sobald die strukturellen Maße prognostiziert sind, ermitteln deterministische Größenalgorithmen sofort **alle gängigen Standardgrößen des Einzelhandels** bis hin zur Schuhgröße:
  - *Freizeithemd-Größe* (XS–XXL basierend auf dem Brustumfang)
  - *Hosengröße / Bundweite* (Zoll/Inches, umgerechnet aus Taillenumfang in cm)
  - *US-Schuhgröße* (Formeln für Herren/Damen basierend auf der Fußlänge)
  - *Damenkleid-Größe* (US 0–14+ basierend auf der Taille)
  - *BH-Größe* (Unterbrustband + Körbchengröße, berechnet aus Brust- und Unterbrustumfang)
- **Detaillierter Bearbeitungsmodus**: Nach dem automatischen Ausfüllen können Sie alle 15 Größenparameter (einschließlich Hemdgröße, Hosengröße, Schuhgröße, BH-Größe, Kleidergröße) sowie Haarattribute (*Länge, Typ, Farbe, Stil*) präzise anpassen.
- **Live-Einheitenumschaltung**: Wechseln Sie zwischen *kg/cm* und *lb/in* — alle Werte werden sofort umgerechnet, ohne dass eine erneute Vorhersage erforderlich ist.

#### Panel H: Registrierung im Experten- & Dienstleisterverzeichnis
- **Umschalter für professionelle Stylisten**: Registrieren Sie sich als verifizierter Modeprofi (Stylist, Schneider, Designer).
- **Unternehmensdaten**: Geben Sie Firmenname, Adresse, Telefonnummer, E-Mail-Adresse, Website und Beschreibung ein, um im `/experts`-Verzeichnis und im regionalen Kampagnen-Ticker zu erscheinen.

#### Panel I: PayPal-Auszahlungseinstellungen
- **PayPal-Empfänger-E-Mail**: Tragen Sie Ihre PayPal-E-Mail-Adresse ein, um Auszahlungen für Marktplatzverkäufe und aktive Expertenkampagnen zu erhalten.

---

### 4. Akkordeon-Karte für Systemeinstellungen

Verwaltung von Systemeinstellungen, Abonnements und KI-Integrationen:

- **KI-Modell-Routing (Gestufte Architektur — Zero BYOK)**:
  - *Kostenloser Tarif / Free Tier (Lokale On-Premises-Eyes)*: Nutzer des kostenlosen Tarifs werden von der selbst gehosteten lokalen **Eyes**-Engine von DressApp (derzeit ein feinabgestimmtes **Qwen 2.5 VL 3B**-Modell) auf Port 7860 bedient – ganz ohne eigene API-Schlüssel.
  - *Manager- & Professional-Tarife (Schnelles Cloud-Modell)*: Abonnenten der Tarife **Manager** und **Professional** genießen vorrangiges Routing zum schnellen Cloud-KI-Modell (derzeit **Google Gemini 3.5 Flash** über `llm_gateway.py`).
  - *Lokales On-Premises-Quoten-Sicherheitsnetz*: Sollten externe Cloud-Ratenbegrenzungen (`429` / `RESOURCE_EXHAUSTED`) erreicht werden, weichen Anfragen automatisch auf den selbst gehosteten **Eyes**-Container (`Qwen 2.5 VL 3B`) auf Port 7860 aus, sodass Ihre Styling-Unterhaltung niemals unterbrochen wird.
- **Abonnement & Kleiderschranklimits**:
  - Zeigt die aktuelle Kontostufe an (**Free**: 150 Artikel Basislimit vs. **Manager** (10 $/Monat) oder **Professional** (15 $/Monat): Unbegrenzte Artikel + schnelles Cloud-KI-Modell).
  - Rufen Sie die **Preisseite** (`/pricing` oder Klick auf Ihre Tarifkarte) auf, um die Tarifvergleichstabelle einzusehen, einen Tarif auszuwählen oder nicht verfallende Prepaid-Guthabenpakete zu erwerben.
  - Upgrade über PayPal-Abonnements oder das Atzmai-Gateway für lokale israelische ILS-Zahlungen (Bit / Kreditkarte).
  - **Empfehlungslink kopieren**: Gewährt +10 Kleiderschrankplätze für jeden Freund, der sich registriert (bis maximal 150 Artikel).
- **Planer & Push-Erinnerungen**:
  - Aktivieren oder deaktivieren Sie morgendliche Outfit-Vorschlagsbenachrichtigungen.
  - Legen Sie die Häufigkeit (*Täglich*, *Jeden zweiten Tag*, *Zweimal pro Woche*, *An Wochentagen*), Uhrzeit (z. B. *07:00*) und Dresscode-Stilanforderungen fest (*Freizeit*, *Formell*, *Sportlich*, *Benutzerdefiniert*).
  - Aktivieren Sie VAPID-Push-Benachrichtigungen im Browser.
- **Kampagnen-Benachrichtigungseinstellungen**:
  - Detaillierte Schalter für *Lokale Mode-Push/E-Mail*, *Sale-Benachrichtigungen*, *Nachhaltige Mode*, *Luxus-Aktionen* und *Persönlicher Stylist*.
  - Schieberegler für **Maximale Kampagnendistanz** einstellen (5 km bis 50 km).
- **Google Kalender verknüpfen**: OAuth-Schaltfläche zur Synchronisierung persönlicher Kalendertermine mit dem KI-Stylisten.
- **Standortdienste-Karte**: GPS-Standortberechtigungen aktivieren für entfernungsbasierte Experten-Feeds und hyperlokales Wetter.
- **Freunde einladen-Schaltfläche**: Teilbaren Empfehlungslink kopieren.
- **Shopping Assistant**: Details zur Chrome Web Store-Erweiterung aufrufen oder ein **Universal Bookmarklet** (`javascript:...`) für sofortige Größenvergleiche beim Online-Shopping generieren.

---

### 5. Kontoaktionen & Diagnose
- **Abmelden (Sign Out)**: Aus der aktuellen Sitzung ausloggen.
- **Mein Konto löschen (Delete my Account)**: Link zum dauerhaften Löschen aller Kontodaten.
- **Entwickler-Panel**: Diagnoseansicht für Umgebungstests. Authentifiziert über Google OAuth (`dressappdeveloper@gmail.com`).

---

## Erwartete Ergebnisse
- Sofortige Synchronisierung von Körpermaßen, Hautton und Fotoausschnitten auf der 2D-Avatar-Anprobefläche.
- Keine überflüssigen Netzwerkanfragen im Leerlauf beim Wechseln zwischen Einstellungs-Panels.
- Maßgeschneiderte Outfit-Vorschläge des KI-Stylisten, abgestimmt auf Ihre Bekleidungsregeln und Ihren Terminkalender.

---

## Fehlerbehebung
- **Fotohintergrund wird nicht entfernt**: Stellen Sie sicher, dass es sich um ein Ganzkörperfoto mit kontrastreicher Hintergrundbeleuchtung handelt.
- **Push-Benachrichtigungen kommen nicht an**: Überprüfen Sie, ob Browser-Benachrichtigungen erlaubt sind und unter *Kontakt* eine Telefonnummer hinterlegt ist.
- **Adress-Autovervollständigung reagiert nicht**: Prüfen Sie, ob eine aktive Internetverbindung für OpenStreetMap-Nominatim-Abfragen besteht.

---

## Einschränkungen
- Der Speicherplatz im kostenlosen Tarif (Free Tier) ist auf 150 Artikel begrenzt und verwendet das lokale Eyes-Modell (`Qwen 2.5 VL 3B`), sofern kein Upgrade auf den **Manager**- oder **Professional**-Tarif für unbegrenzten Speicherplatz und das schnelle Cloud-Modell (`Gemini 3.5 Flash`) erfolgt.
- Sollten Cloud-Kontingente vorübergehend erreicht werden, weichen Anfragen nahtlos auf die integrierte lokale Eyes-Engine (`Qwen 2.5 VL 3B`) aus, ohne die Sitzung zu unterbrechen.
