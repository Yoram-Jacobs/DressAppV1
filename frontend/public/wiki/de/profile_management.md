# Profil, Größen & Konfiguration (`/me`)

Verwalten Sie Ihre körperlichen Messungen, Ihren Hautton, Körperfoto-Ausschnitte, Styling-Präferenzen, KI-Modell-Anmeldedaten und Systemintegrationen auf Ihrem persönlichen Profil-Dashboard.

## Übersicht
Die Seite **Profil & Einstellungen** (`https://dressapp.co/me`) dient als zentraler Steuerungsknotenpunkte für Ihr DressApp-Ökosystem. Sie enthält Ihre physischen anthropometrischen Parameter, die digitale Anprobe-Bühne, Stilbeschränkungen, lokalisierte Einstellungen, KI-Modellschlüssel und Zeitpläne für Push-Benachrichtigungen.

---

## Voraussetzungen
- Ein aktives DressApp-Konto.
- (Optional) Kameraberechtigungen des Geräts für den Upload eines Ganzkörperfotos.
- (Optional) Standortberechtigungen für lokale Stylisten-Kampagnen und Wettervorhersagen.

---

## Schritt-für-Schritt-Anleitung: Seitenübersicht von oben nach unten

### 1. Kopfzeile & Erkundungs-Navigationsleiste
Befindet sich ganz oben im `/me`-Dashboard:
- **Kopfzeile (Header)**: Zeigt Ihren Kontostatus und Titel an.
- **Erkundungs-Karten (Explore Cards)**: Schnelle Verknüpfungen zu den Hauptbereichen der App:
  - **Trend Scout** (`/trends`): Täglich von KI kuratierte Mode-News-Feeds anzeigen.
  - **Outfits** (`/outfits`): Zugriff auf Ihren gespeicherten Outfit-Kalender.
  - **Experten** (`/experts`): Durchsuchen Sie lokale Modestylisten und Schneider.
  - **Ausgepackt / Statistiken** (`/me/stats`): Garderobenbewertung, Cost-per-Wear-Metriken und Farbanalysen anzeigen.

### 2. Sprach- & Sprachauswahl-Karte
Prominent platziert für sofortige Zugänglichkeit:
- **Sprachauswahl**: Wählen Sie aus 12 unterstützten Sprachen (*Englisch, Spanisch, Französisch, Deutsch, Italienisch, Portugiesisch, Russisch, Chinesisch, Japanisch, Arabisch, Hindi, Hebräisch*). Die Auswahl einer Sprache aktualisiert automatisch die UI-Sprache und bindet das Standard-Text-to-Speech (TTS)-Sprachmodell der Region.

---

### 3. Identitäts- & Personendaten-Karte (`ProfileDetailsCard`)

Enthält 9 erweiterbare Akkordeon-Panels zur Verwaltung Ihrer Identität, Größen und Avatar-Darstellung:

#### Panel A: Identität
- **Vorname & Nachname**: Felder zur persönlichen Identifikation.
- **E-Mail-Adresse**: Schreibgeschützte Anzeige Ihrer registrierten E-Mail-Adresse.
- **Geburtsdatum**: Wird zur Personalisierung des demografischen Trend-Scorings verwendet.
- *Google Auto-Ausfüll-Badge*: Wird automatisch angezeigt, wenn Ihr Profil über Google OAuth erstellt wurde.

#### Panel B: Kontakt & Lieferadresse
- **Telefonnummer**: Erforderlich für den Empfang von SMS/Push-Benachrichtigungen für tägliche Vorschläge und lokale Expertenkampagnen.
- **Adresse Zeile 1**: Verfügt über eine automatische Vervollständigung auf Straßenebene via OpenStreetMap (Nominatim).
- **Adresse Zeile 2, Stadt, Region, Postleitzahl**: Manuelle Adressfelder für den Marktplatz-Versand.
- **Land**: Offline-Kombinationsfeld, durchsuchbar nach Landesnamen oder ISO-2-Code.

#### Panel C: Demografie
- **Geschlecht**: Wählen Sie *Weiblich* oder *Männlich*, um grundlegende Körpermaße und Bekleidungstaxonomie zu konfigurieren.
- **Beziehungsstatus**: Wählen Sie *Ledig*, *Verheiratet*, *Geschieden* oder *Verwitwet*.
- **Beruf**: Freitexteingabe (z. B. *Student/in*, *Marketing Manager/in*, *Barista*). Speist den Trend Scout-Personalisierungs-Ranker.

#### Panel D: Einstellungen & Maßeinheiten
- **Gewichtseinheit**: Umschalten zwischen Kilogramm (`kg`) und Pfund (`lb`).
- **Längeneinheit**: Umschalten zwischen Zentimetern (`cm`) und Zoll (`in`).

#### Panel E: Fotos & Digitale Avatar-Bühne
- **Linke Spalte — Foto-Auswahl**:
  - *Gesichtsfoto*: Avatar-Miniaturansicht hochladen.
  - *Ganzkörperfoto*: Ganzkörperfoto hochladen. Das System führt automatisch ein lokales U2-Net (`rembg`)-Matting durch, um den Hintergrund zu entfernen.
  - *Foto entfernen-Button*: Ein-Klick-Entfernung Ihres Foto-Ausschnitts, schaltet die Anprobe-Bühne sofort und ohne Verzögerung auf das 2D-SVG-Vektormannequin zurück.
- **Rechte Spalte — Digitaler Avatar & Anprobe-Bühne**:
  - **Hautton-Auswahl**: Interaktive Farbpalette zur Auswahl des Hauttons Ihres Mannequins.
  - **Avatar-Anprobe-Canvas**: Rendert Kleidungsstücke auf Ihrem Foto-Ausschnitt oder dynamischen Bezier-Vektormannequin (`DynamicAvatar.jsx`) unter Verwendung kalibrierter Offsets (`top-[14.5%]` Kragen zu Ausschnitt und `top-[36.5%]` Bund zu Taille).

#### Panel F: Stil-Profil
- **Ästhetik**: Kommagetrennte Stil-Schlüsselwörter (z. B. *Minimalistisch, Streetwear, Vintage*).
- **Farbpalette**: Bevorzugte Farbtöne (z. B. *Pastell, Erdtöne, Monochrom*).
- **Vermeiden**: Farben oder Kleidungsstücktypen, die strikt von KI-Empfehlungen ausgeschlossen werden sollen (z. B. *Gelb, Crop Tops*).
- **Kulturelle Kleidungskonservativität**: Modestufe wählen (*Lässig/Entspannt*, *Moderat*, *Konservativ*), um die Abdeckung der Outfits des KI-Stylisten zu steuern.

#### Panel G: Körpermaße & Größen (ANSUR II Größenvorhersage)
- **Onboarding / Neuanfang-Modus**: Geben Sie 4 Basiseingaben ein: **Größe**, **Gewicht**, **Taillenumfang** und **Fußlänge**. Das integrierte scikit-learn ANSUR II Multi-Output-Regressionsmodell sagt automatisch 6 strukturelle Maße voraus:
  - *Schultern*, *Brust / Oberweite*, *Hüfte*, *Ärmellänge*, *Innenbeinlänge* und *Außenbeinlänge*.
- **Detaillierter Bearbeitungsmodus**: Feinabstimmung aller 15 Größenparameter (einschließlich Hemdgröße, Hosengröße, Schuhgröße, BH-Größe, Kleidungsgröße) und Haarattribute (*Länge, Typ, Farbe, Stil*).

#### Panel H: Registrierung im Experten-Verzeichnis
- **Profi-Stylist-Schalter**: Registrieren Sie sich als verifizierter Modeprofi (Stylist, Schneider, Designer).
- **Geschäftsdaten**: Eingabe von Firmenname, Adresse, Telefon, E-Mail, Website und Beschreibung zur Anzeige im `/experts`-Verzeichnis.

#### Panel I: PayPal-Auszahlungseinstellungen
- **PayPal-Empfänger-E-Mail**: Geben Sie Ihre PayPal-E-Mail-Adresse ein, um Auszahlungen für Verkäufe auf dem Marktplatz und aktive Expertenkampagnen zu erhalten.

---

## 4. Systemeinstellungen-Akkordeon-Karte

Verwaltet Einstellungen auf Systemebene, Abonnements und KI-Integrationen:

- **KI-Konfiguration (AI Configuration)**:
  - *Standardmodus*: Verwendet vom System verwaltete Gemini Flash 2.x Endpunkte.
  - *Eigener API-Schlüssel-Modus*: Verbinden Sie eigene Google Gemini, Anthropic, OpenAI oder DeepSeek API-Schlüssel.
- **Abonnement & Kleiderschrank-Limits**:
  - Aktuelle Kontostufe anzeigen (**Kostenlos**: 150 Artikel Limit vs **Pro**: Unbegrenzte Artikel).
  - Upgrade über PayPal Subscriptions REST API ($4.99/Monat oder $29.99/Jahr).
  - **Empfehlungslink kopieren**: Gewährt +10 Kleiderschrankplätze für jeden geworbenen Freund.
- **Zeitplan & Push-Erinnerungen**:
  - Aktivieren Sie Benachrichtigungen für morgendliche Outfit-Vorschläge.
  - Häufigkeit einstellen (*Jeden Tag*, *Jeden zweiten Tag*, *Zweimal der Woche*, *An Werktagen*), Uhrzeit (z. B. *07:00*) und Stil-Anforderungen (*Freizeit*, *Formal*, *Sportlich*, *Benutzerdefiniert*).
  - Browser-VAPID-Push-Benachrichtigungen aktivieren.
- **Kampagnen-Benachrichtigungseinstellungen**:
  - Detaillierte Schalter für *Lokale Mode Push/E-Mail*, *Angebots-Benachrichtigungen*, *Nachhaltige Mode*, *Luxus-Aktionen* und *Persönlicher Stylist*.
  - Schieberegler für **Maximale Kampagnen-Entfernung** anpassen (5 km bis 50 km).
- **Google Calendar Connect**: OAuth-Button zur Synchronisierung persönlicher Kalenderereignisse mit dem KI-Stylisten.
- **Standortdienste-Karte**: Aktivieren Sie GPS-Standortberechtigungen für lokale Experten-Feeds und lokales Wetter.
- **Freunde einladen-Button**: Teilt Ihren persönlichen Empfehlungslink.
- **Shopping-Assistent**: Greifen Sie auf Details der Chrome Web Store-Erweiterung zu oder generieren Sie ein **Universelles Lesezeichen** (`javascript:...`) für sofortige Größenvergleiche beim E-Commerce-Shopping.

---

## 5. Konto-Aktionen & Diagnose
- **Abmelden**: Aus der aktuellen Sitzung ausloggen.
- **Konto löschen**: Link zum dauerhaften Löschen der Kontodaten.
- **Entwickler-Panel**: Diagnose-Akkordeon für Umgebungstests.

---

## Erwartete Ergebnisse
- Sofortige Synchronisation physischer Maße, des Hauttons und der Foto-Ausschnitte auf dem 2D-Avatar-Anprobe-Canvas.
- Keine unnötigen Netzwerkanfragen beim Navigieren zwischen Einstellungs-Panels.
- Maßgeschneiderte KI-Stylist-Outfit-Vorschläge, die auf Ihre Wünsche und Ihren Zeitplan abgestimmt sind.

---

## Fehlerbehebung
- **Fotohintergrund nicht entfernt**: Stellen Sie sicher, dass Ihr hochgeladenes Foto ein Ganzkörperfoto mit kontrastreichem Hintergrund ist.
- **Push-Benachrichtigungen kommen nicht an**: Überprüfen Sie, ob die Benachrichtigungsberechtigungen des Browsers aktiviert sind und eine Telefonnummer gespeichert ist.
- **Adresse-Auto-Vervollständigung reagiert nicht**: Überprüfen Sie, ob eine aktive Internetverbindung für OpenStreetMap Nominatim-Abfragen besteht.

---

## Einschränkungen
- Der Speicherplatz für kostenlose Konten ist auf 150 Artikel begrenzt, es sei denn, er wird durch Empfehlungsboni (+10 Plätze pro Einladung) oder ein Pro-Abonnement erweitert.
- Der Modus für eigene API-Schlüssel erfordert gültige Schlüssel mit verbleibendem Kontingent des jeweiligen Anbieters.