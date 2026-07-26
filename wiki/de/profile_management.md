# Profil, Größen & Konfiguration (`/me`)

Verwalten Sie Körpermaße, Hautton, Körperfoto-Ausschnitte, Styling-Präferenzen, KI-Modell-Zugangsdaten und Systemintegrationen in Ihrem persönlichen Profil-Dashboard.

## Übersicht
Die **Profil- & Einstellungsseite** (`https://dressapp.co/me`) dient als zentrale Steuerzentrale für Ihr DressApp-Ökosystem. Sie beherbergt Ihre physischen anthropometrischen Parameter, die digitale Anprobe-Avatar-Bühne, Stilbeschränkungen, lokalisierte Präferenzen, KI-Modellschlüssel und Push-Benachrichtigungszeitpläne.

---

## Voraussetzungen
- Ein aktives DressApp-Konto.
- (Optional) Gerätekamera-Berechtigungen für Ganzkörperfoto-Uploads.
- (Optional) Standortberechtigungen für lokale Stylisten-Kampagnen und Wettervorhersagen.

---

## Schritt-für-Schritt-Anleitung: Seitenübersicht von oben nach unten

### 1. Seitenkopf & Entdeckungs-Navigationsleiste
Oben im `/me`-Dashboard:
- **Kopfzeile**: Zeigt Ihren Kontostatus und Titel an.
- **Entdecken-Karten**: Schnellzugriff auf Haupt-App-Bereiche:
  - **Trend Scout** (`/trends`): Täglich KI-kuratierte Mode-Newsfeeds anzeigen.
  - **Outfits** (`/outfits`): Auf Ihren gespeicherten Outfit-Kalender zugreifen.
  - **Experten** (`/experts`): Lokale Modestylisten und Schneider durchsuchen.
  - **Unpacked / Statistiken** (`/me/stats`): Kleiderschrankbewertung, Cost-per-Wear-Metriken und Farbanalysen anzeigen.

### 2. Sprach- & Sprachauswahl-Karte
Prominent platziert für sofortige Barrierefreiheit:
- **Sprachauswahl**: Wählen Sie aus 12 unterstützten Sprachen (*Englisch, Spanisch, Französisch, Deutsch, Italienisch, Portugiesisch, Russisch, Chinesisch, Japanisch, Arabisch, Hindi, Hebräisch*). Die Auswahl einer Sprache aktualisiert die UI-Locale automatisch und bindet das Standard-Regional-Text-to-Speech (TTS)-Stimmmodell.

---

### 3. Identitäts- & Persönliche-Details-Karte (`ProfileDetailsCard`)

Enthält 9 erweiterbare Akkordeon-Panels zur Verwaltung Ihrer Identität, Größen und Avatar-Darstellung:

#### Panel A: Identität
- **Vor- & Nachname**: Persönliche Identifikationsfelder.
- **E-Mail-Adresse**: Read-only-Anzeige Ihrer registrierten E-Mail.
- **Geburtsdatum**: Wird für personalisiertes demografisches Trend-Scoring verwendet.
- *Google Autofill Badge*: Wird automatisch angezeigt, wenn Ihr Profil über Google OAuth erstellt wurde.

#### Panel B: Kontakt & Lieferadresse
- **Telefonnummer**: Erforderlich für SMS/Push-Benachrichtigungen zu täglichen Planer-Vorschlägen und lokalen Experten-Kampagnen.
- **Adresszeile 1**: OpenStreetMap (Nominatim) Straßenebene-Autovervollständigung. Auswahl eines Vorschlags füllt Zeile 1, Stadt, Region, PLZ und Land automatisch aus.
- **Adresszeile 2, Stadt, Region, PLZ**: Manuelle Adressfelder für Marketplace-Versand.
- **Land**: Offline-Kombinationsfeld, durchsuchbar nach Ländernamen oder ISO-2-Code.

#### Panel C: Demografie
- **Geschlecht**: *Weiblich* oder *Männlich* wählen, um Basiskörpermaße und Bekleidungstaxonomie zu konfigurieren.
- **Familienstand**: *Ledig*, *Verheiratet*, *Geschieden* oder *Verwitwet* wählen.
- **Beruf**: Freitexteingabe (z. B. *Student*, *Marketing Manager*, *Barista*). Speist den Trend-Scout-Personalisierungs-Ranker für relevante Style-News.

#### Kurzanleitung: Fehlende Google-Profil-Daten synchronisieren (People API Re-Consent)
Wenn Sie sich vor der Anfrage von DressApp zum Zugriff auf Ihre **People API**-Profildetails (Telefon, Adresse, Geschlecht, Geburtsdatum) mit Google angemeldet haben, bleiben diese Felder möglicherweise leer. Sie können sie mit einem Klick synchronisieren:

1. **Kontakt- oder Demografie-Akkordeon öffnen** — Sie sehen einen **"Von Google synchronisieren"**-Button (Aktualisierungs-Symbol) neben dem Sektions-Titel.
2. **Auf "Von Google synchronisieren" klicken** — Falls die erforderlichen People API-Bereiche beim ursprünglichen Anmelden nicht gewährt wurden, erkennt DressApp dies und zeigt einen Info-Toast: *"Google benötigt Ihre Erlaubnis, um auf Profildetails zuzugreifen. Sie werden zu Google weitergeleitet, um Zugriff zu gewähren."*
3. **Auf Googles Bildschirm zustimmen** — Sie werden zum OAuth-Zustimmungsbildschirm von Google weitergeleitet. Häkchen bei **Profilinformationen** (Name, E-Mail, Foto) und **Kontaktinformationen** (Telefon, Adresse, Geschlecht, Geburtstag) setzen.
4. **Automatische Rückkehr & Auto-Ausfüllen** — Nach der Zustimmung leitet Google Sie zurück zu DressApp. Die `syncGoogleProfile()`-Funktion läuft automatisch, ruft den Backend-Endpunkt `/auth/google/sync-profile` auf, der:
   - Ihre Telefonnummer, Adresse, Geschlecht und Geburtsdatum von der Google People API abruft
   - Die leeren Felder in den Panels **Kontakt** (Telefon, Adresse) und **Demografie** (Geschlecht, Geburtsdatum) ausfüllt
   - Die Aktualisierungen sofort in Ihrem Profil speichert
5. **Fertig** — Ihr Profil ist jetzt ohne manuelle Eingabe vollständig.

> **Hinweis**: Der Button "Von Google synchronisieren" erscheint auch im Seitenkopf (neben dem Hauptbutton "Google-Profil synchronisieren") und funktioniert identisch — er synchronisiert alle verfügbaren Google-Profil-Daten auf einmal.

#### Panel D: Präferenzen & Maßeinheiten
- **Gewichtseinheit**: Zwischen Kilogramm (`kg`) und Pfund (`lb`) umschalten.
- **Längeneinheit**: Zwischen Zentimeter (`cm`) und Zoll (`in`) umschalten.

#### Panel E: Fotos & Digitale Avatar-Bühne
- **Linke Spalte — Foto-Auswahl**:
  - *Gesichtsfoto*: Avatar-Thumbnail hochladen.
  - *Ganzkörperfoto*: Ganzkörperfoto hochladen. Das System führt automatisch lokales U2-Net (`rembg`) Matting zur Hintergrundentfernung durch.
  - *Foto entfernen-Button*: Ein-Klick-Entfernung Ihres Foto-Ausschnitts, sofortiger Wechsel zurück zum 2D-SVG-Vektormanikkin ohne UI-Verzögerung.
- **Rechte Spalte — Digitaler Avatar & Anprobe-Bühne**:
  - **Hautton-Auswahl**: Interaktive Farbpalette zur Auswahl Ihres Mannequin-Hauttons.
  - **Avatar-Anprobe-Canvas**: Rendert Kleidungsstücke auf Ihrem Foto-Ausschnitt oder dem dynamischen Bézier-Vektormanikkin (`DynamicAvatar.jsx`) mit kalibrierten Landmarken-Offsets (`top-[14.5%]` Kragen-zu-Halslinie und `top-[36.5%]` Bund-zu-Taille).

#### Panel F: Stil-Profil
- **Ästhetik**: Kommagetrennte Stil-Schlüsselwörter (z. B. *Minimalistisch, Streetwear, Vintage*).
- **Farbpalette**: Bevorzugte Farbtöne (z. B. *Pastell, Erdtöne, Monochrom*).
- **Vermeiden**: Farben oder Kleidungsstücke, die von KI-Empfehlungen strikt ausgeschlossen werden sollen (z. B. *Gelb, Crop Tops*).
- **Kulturelle Kleidungskonservativität**: Bescheidenheitsgrad wählen (*Locker/Entspannt*, *Mäßig*, *Konservativ*) zur Leitung der Kleidungsabdeckung des KI-Stylisten.

#### Panel G: Körpermessungen & Größen (ANSUR II Größen-Vorhersager)
- **Onboarding / Neuanfang Modus**: 4 Grundeingaben eingeben: **Größe**, **Gewicht**, **Taillenumfang** und **Fußlänge**. Das eingebaute scikit-learn ANSUR II Multi-Output-Regressionsmodell sagt automatisch 6 strukturelle Messungen voraus:
  - *Schultern*, *Brust/Busen*, *Hüfte*, *Ärmellänge*, *Innenbeinlänge* und *Außenseitenlänge*.
- **Automatische Größenübersetzung**: Sobald die strukturellen Messungen vorhergesagt sind, füllen deterministische Größenalgorithmen sofort **alle standardmäßigen Einzelhandelsgrößen** bis hin zur Schuhgröße:
  - *Freizeithemden-Größe* (XS–XXL basierend auf Brustumfang)
  - *Hosenbundgröße* (Zoll, umgerechnet von Taillenumfang cm)
  - *US-Schuhgröße* (Herren/Damen-Formeln aus Fußlänge)
  - *Damen-Kleidergröße* (US 0–14+ basierend auf Taille)
  - *Damen-BH-Größe* (Band + Cup berechnet aus Brust/Unterbrust)
- **Detaillierter Bearbeitungsmodus**: Nach dem Auto-Ausfüllen alle 15 Größenparameter feinjustieren (inkl. Hemdengröße, Hosengröße, Schuhgröße, BH-Größe, Kleidergröße) und Haareigenschaften (*Länge, Typ, Farbe, Stil*).
- **Live-Einheiten-Umschaltung**: Zwischen *kg/cm* und *lb/in* umschalten — alle Werte konvertieren sofort ohne Neu-Vorhersage.

#### Panel H: Registrierung im Profi- & Expertenverzeichnis
- **Professioneller Stylist-Umschalter**: Als verifizierter Modeprofi registrieren (Stylist, Schneider, Designer).
- **Geschäftsdetails**: Firmenname, Adresse, Telefon, E-Mail, Website und Beschreibung eingeben, um im `/experts`-Verzeichnis und regionalen Kampagnen-Ticker aufzutauchen.

#### Panel I: PayPal-Auszahlungseinstellungen
- **PayPal-Empfänger-E-Mail**: Ihre PayPal-E-Mail eingeben, um Auszahlungen für Marketplace-Verkäufe und aktive Expertenkampagnen zu erhalten.

---

### 4. Systemeinstellungen-Akkordeon-Karte

Verwaltet Systemeinstellungen, Abonnements und KI-Integrationen:

- **KI-Konfiguration**:
  - *Standardmodus*: Verwendet systemverwaltete Gemini Flash 2.x-Endpunkte.
  - *Benutzerdefinierter API-Schlüssel-Modus*: Verbinden Sie benutzerdefinierte Google Gemini-, Anthropic-, OpenAI- oder DeepSeek-API-Schlüssel über ein geführtes Setup-Modal.
- **Abonnement & Kleiderschrank-Limits**:
  - Aktuelle Kontostufe anzeigen (**Kostenlos**: 150-Artikel-Limit vs **Pro**: Unbegrenzte Artikel).
  - Upgrade über PayPal Subscriptions REST API (4,99 €/Monat oder 29,99 €/Jahr).
  - **Empfehlungslink kopieren**: Gewährt +10 Kleiderschrank-Kapazitätsslots für jeden Freund, der sich registriert.
- **Scheduler & Push-Erinnerungen**:
  - Morgendliche Outfit-Vorschlag-Benachrichtigungen umschalten.
  - Frequenz festlegen (*Täglich*, *Jeden zweiten Tag*, *Zweimal pro Woche*, *An Wochentagen*), Uhrzeit (z. B. *07:00*) und Dresscode-Anforderungen (*Casual*, *Formal*, *Athletisch*, *Benutzerdefiniert*).
  - Browser-VAPID-Push-Benachrichtigungen aktivieren.
- **Kampagnen-Benachrichtigungspräferenzen**:
  - Granulare Umschalter für *Lokale Mode Push/Email*, *Verkaufsalarme*, *Nachhaltige Mode*, *Luxus-Promos* und *Persönlicher Stylist*.
  - **Maximale Kampagnen-Distanz** Schieberegler anpassen (5 km bis 50 km).
- **Google Kalender Verbinden**: OAuth-Schaltfläche zum Synchronisieren persönlicher Kalenderereignisse mit dem KI-Stylisten.
- **Standortdienste-Karte**: GPS-Standortberechtigungen für entfernungsbasierte Experten-Feeds und hyperlokales Wetter umschalten.
- **Freunde Einladen Button**: Teilbaren Empfehlungslink kopieren.
- **Shopping-Assistent**: Zugriff auf Chrome Web Store-Erweiterungsdetails oder **Universal Bookmarklet** (`javascript:...`) für sofortige E-Commerce-Größenvergleiche generieren.

---

### 5. Kontoaktionen & Diagnose
- **Abmelden**: Aktuelle Sitzung beenden.
- **Mein Konto Löschen**: Link zum dauerhaften Löschen von Kontodaten.
- **Entwickler-Panel**: Diagnostisches Akkordeon für Umgebungs-Tests.

---

## Erwartete Ergebnisse
- Sofortige Synchronisierung physischer Metriken, Hautton und Fotoausschnitte über die 2D-Avatar-Anprobe-Canvas.
- Null Leerlauf-Netzwerkanfragen beim Navigieren zwischen Einstellungs-Panels.
- Angepasste KI-Stylist-Outfit-Vorschläge, abgestimmt auf Ihre Bescheidenheitsregeln und Ihren Zeitplan.

---

## Fehlerbehebung
- **Foto-Hintergrund nicht entfernt**: Stellen Sie sicher, dass Ihr hochgeladenes Foto ganzkörperig mit kontrastierendem Hintergrundlicht ist.
- **Push-Benachrichtigungen kommen nicht an**: Bestätigen Sie, dass Browser-Benachrichtigungsberechtigungen aktiviert sind und eine Telefonnummer unter *Kontakt* gespeichert ist.
- **Adress-Autovervollständigung reagiert nicht**: Prüfen Sie, ob die Internetverbindung für OpenStreetMap Nominatim-Abfragen aktiv ist.

---

## Einschränkungen
- Kostenloses Konto auf 150 Artikel begrenzt, es sei denn, es wird durch Empfehlungsbonus (+10 Slots pro Einladung) oder Pro-Abonnement erweitert.
- Benutzerdefinierter API-Schlüssel-Modus erfordert gültige Schlüssel mit verbleibendem Kontingent vom jeweiligen Anbieter.

(Ende der Datei)