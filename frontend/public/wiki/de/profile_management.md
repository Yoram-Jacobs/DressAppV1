# Profil, Größen & Konfiguration (`/me`)

Verwalten Sie Körpermaße, Hautton, Körperfoto-Ausschnitte, Styling-Präferenzen, KI-Modell-Anmeldedaten und Systemintegrationen in Ihrem persönlichen Profil-Dashboard.

## Übersicht
Die Seite **Profil & Einstellungen** (`https://dressapp.co/me`) dient als zentrale Steuerzentrale für Ihr DressApp-Ökosystem. Sie beherbergt Ihre physischen anthropometrischen Parameter, die digitale Anprobe-Avatar-Bühne, Stil-Einschränkungen, lokalisierte Präferenzen, KI-Modell-Schlüssel und Push-Benachrichtigungszeitpläne.

---

## Voraussetzungen
- Ein aktives DressApp-Konto.
- (Optional) Gerätekamera-Berechtigungen für Ganzkörper-Foto-Upload.
- (Optional) Standortberechtigungen für lokales Stylisten-Kampagnen-Targeting und Wettervorhersage.

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

---

### 5. Kontoaktionen & Diagnose
- **Abmelden**: Aus der aktuellen Sitzung abmelden.
- **Mein Konto löschen**: Link zum dauerhaften Löschen von Kontodaten.
- **Entwickler-Panel**: Diagnose-Akkordeon für Umgebungs-Tests.

---

## Erwartete Ergebnisse
- Sofortige Synchronisation physischer Metriken, Hauttons und Fotoausschnitte über die 2D-Avatar-Anprobe-Leinwand.
- Null Leerlauf-Netzwerkanfragen beim Navigieren zwischen Einstellungs-Panels.
- Angepasste KI-Stylisten-Outfit-Vorschläge, abgestimmt auf Ihre Bescheidenheitsregeln und Ihren Zeitplan.

---

## Fehlerbehebung
- **Foto-Hintergrund nicht entfernt**: Stellen Sie sicher, dass Ihr hochgeladenes Foto ganzkörperig mit kontrastierender Hintergrundbeleuchtung ist.
- **Push-Benachrichtigungen kommen nicht an**: Bestätigen Sie, dass Browser-Benachrichtigungsberechtigungen aktiviert sind und eine Telefonnummer unter *Kontakt* gespeichert ist.
- **Adress-Autovervollständigung reagiert nicht**: Prüfen Sie, ob die Internetverbindung für OpenStreetMap Nominatim-Abfragen aktiv ist.

---

## Einschränkungen
- Kostenloses Kontingent ist auf 150 Artikel begrenzt, es sei denn, es wird durch Empfehlungsbonus (+10 Slots pro Einladung) oder Pro-Abonnement erweitert.
- Benutzerdefinierter API-Schlüssel-Modus erfordert gültige Schlüssel mit verbleibendem Kontingent vom jeweiligen Anbieter.

(Ende der Datei)