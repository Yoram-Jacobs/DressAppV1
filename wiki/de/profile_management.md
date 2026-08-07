Hier ist die Übersetzung der DressApp Markdown-Dokumentation ins Deutsche:

# Profil, Größen & Konfiguration (`/me`)

Verwalten Sie physische Maße, Hautton, Körperfotofreistellungen, Styling-Präferenzen, KI-Modell-Zugangsdaten und Systemintegrationen auf Ihrem persönlichen Profil-Dashboard.

## Überblick
Die Seite **Profil & Einstellungen** (`https://dressapp.co/me`) dient als zentrales Kontrollzentrum für Ihr DressApp-Ökosystem. Sie enthält Ihre physischen anthropometrischen Parameter, die digitale Anproben-Avatar-Bühne, Stilvorgaben, lokalisierte Präferenzen, KI-Modell-Keys und Zeitpläne für Push-Benachrichtigungen.

---

## Voraussetzungen
- Ein aktives DressApp-Konto.
- (Optional) Gerätekameraberechtigungen für das Hochladen von Ganzkörperfotos.
- (Optional) Standortberechtigungen für die zielgerichtete Kampagnenausrichtung lokaler Stylisten und die Wettervorhersage.

---

## Schritt-für-Schritt-Anleitung: Seitenübersicht von oben nach unten

### 1. Seitenkopfzeile & Explore-Navigationsleiste
Befindet sich am oberen Rand des `/me`-Dashboards:
- **Kopfzeile**: Zeigt Ihren Kontostatus und Titel an.
- **Explore-Karten**: Schnelle Verknüpfungen zu den Hauptbereichen der App:
  - **Trend Scout** (`/trends`): Sehen Sie sich tägliche, von KI kuratierte Modenachrichten-Feeds an.
  - **Outfits** (`/outfits`): Greifen Sie auf Ihren gespeicherten Outfit-Kalender zu.
  - **Experts** (`/experts`): Durchsuchen Sie lokale Modestylisten und Schneider.
  - **Unpacked / Stats** (`/me/stats`): Zeigen Sie die Bewertung Ihres Kleiderschranks, Cost-per-Wear-Metriken und Farbaufschlüsselungen an.

### 2. Sprach- & Stimmauswahlkarte
Prominent platziert für sofortige Zugänglichkeit:
- **Sprachauswahl**: Wählen Sie aus 12 unterstützten Sprachen (*English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi, Hebrew*). Die Auswahl einer Sprache aktualisiert automatisch die UI-Spracheinstellung und bindet das standardmäßige regionale Text-to-Speech (TTS)-Stimmenmodell.

---

### 3. Identitäts- & Persönliche Details-Karte (`ProfileDetailsCard`)

Enthält 9 ausklappbare Akkordeon-Panels, die Ihre persönliche Identität, Größen und Avatar-Darstellung verwalten:

#### Panel A: Identität
- **Vorname & Nachname**: Felder zur persönlichen Identifikation.
- **E-Mail-Adresse**: Nur-Lese-Anzeige Ihrer registrierten E-Mail-Adresse.
- **Geburtsdatum**: Wird zur Personalisierung des demografischen Trend-Scorings verwendet.
- *Google Autofill Badge*: Wird automatisch angezeigt, wenn Ihr Profil über Google OAuth erstellt wurde.

#### Panel B: Kontakt- & Lieferadresse
- **Telefonnummer**: Erforderlich, um SMS/Push-Benachrichtigungen für tägliche Planervorschläge und lokale Expertenkampagnen zu erhalten.
- **Address Line 1**: Bietet OpenStreetMap (Nominatim)-Autovervollständigung auf Straßenebene. Die Auswahl eines Vorschlags füllt automatisch Line 1, City, Region, Zip Code und Country aus.
- **Address Line 2, City, Region, Postal Code**: Manuelle Adressfelder für den Marketplace-Versand.
- **Country**: Offline-Combobox, durchsuchbar nach Landesnamen oder ISO-2-Code.

#### Panel C: Demografie
- **Geschlecht**: Wählen Sie *Weiblich* oder *Männlich*, um die grundlegenden Körpermaße und die Kleidungstaxonomie zu konfigurieren.
- **Familienstand**: Wählen Sie *Ledig*, *Verheiratet*, *Geschieden* oder *Verwitwet*.
- **Beruf**: Freitext-Eingabe (z.B. *Student*, *Marketing Manager*, *Barista*). Fließt in den Personalisierungs-Ranker des Trend Scouts ein, um relevante Stilnachrichten zu priorisieren.

#### Zusammenfassende Anleitung: Fehlende Google-Profildaten synchronisieren (People API Re-Consent)
Wenn Sie sich mit Google angemeldet haben, bevor DressApp Zugriff auf Ihre **People API** Profildetails (Telefon, Adresse, Geschlecht, Geburtsdatum) angefordert hat, können diese Felder leer bleiben. Sie können sie mit einem Klick synchronisieren:

1.  **Öffnen Sie das Kontakt- oder Demografie-Akkordeon** – Sie sehen einen **„Sync from Google“**-Button (Aktualisierungssymbol) neben dem Abschnittstitel.
2.  **Klicken Sie auf „Sync from Google“** – wurden die erforderlichen People API-Scopes während Ihrer ursprünglichen Anmeldung nicht gewährt, erkennt DressApp dies und zeigt einen Info-Toast an: *"Google benötigt Ihre Erlaubnis, um auf Profildetails zuzugreifen. Sie werden zu Google weitergeleitet, um den Zugriff zu gewähren."*
3.  **Erteilen Sie die Zustimmung auf dem Google-Bildschirm** – Sie werden zum Google OAuth-Zustimmungsbildschirm weitergeleitet. Aktivieren Sie die Kontrollkästchen für **Profilinformationen** (Name, E-Mail, Foto) und **Kontaktinformationen** (Telefon, Adresse, Geschlecht, Geburtstag).
4.  **Automatische Rückkehr & automatische Befüllung** – nach der Zustimmung leitet Google Sie zurück zu DressApp. Die `syncGoogleProfile()`-Funktion wird automatisch ausgeführt und ruft den Backend-Endpunkt `/auth/google/sync-profile` auf, der:
    - Ihre Telefonnummer, Adresse, Geschlecht und Ihr Geburtsdatum von der Google People API abruft
    - Die leeren Felder in den Panels **Kontakt** (Telefon, Adresse) und **Demografie** (Geschlecht, Geburtsdatum) ausfüllt
    - Die Aktualisierungen sofort in Ihrem Profil speichert
5.  **Fertig** – Ihr Profil ist nun ohne manuelle Eingabe vollständig.

> **Hinweis**: Der „Sync from Google“-Button erscheint auch in der Seitenkopfzeile (neben dem Haupt-„Sync Google Profile“-Button) und funktioniert auf die gleiche Weise – er synchronisiert alle verfügbaren Google-Profildaten auf einmal.

#### Panel D: Präferenzen & Maßeinheiten
- **Gewichtseinheit**: Umschalten zwischen Kilogramm (`kg`) und Pfund (`lb`).
- **Längeneinheit**: Umschalten zwischen Zentimetern (`cm`) und Zoll (`in`).

#### Panel E: Fotos & Digitale Avatar-Bühne
- **Linke Spalte — Foto-Picker**:
  - *Gesichtsfoto*: Laden Sie ein Avatar-Vorschaubild hoch.
  - *Ganzkörperfoto*: Laden Sie ein Ganzkörperfoto hoch. Das System führt automatisch ein lokales U2-Net (`rembg`)-Matting aus, um den Hintergrund zu entfernen.
  - *Foto entfernen-Button*: Ein-Klick-Entfernung Ihres Fotofreistellers, wobei die Anprobenbühne sofort und ohne UI-Verzögerung wieder auf das 2D-SVG-Vektor-Mannequin umgeschaltet wird.
- **Rechte Spalte — Digitaler Avatar & Anproben-Bühne**:
  - **Hautton-Picker**: Interaktive Farbpalette zur Auswahl Ihres Mannequin-Hauttons.
  - **Avatar-Anproben-Leinwand**: Rendert Kleidungsstücke über Ihrem Fotofreisteller oder dem dynamischen Bezier-Vektor-Mannequin (`DynamicAvatar.jsx`) unter Verwendung kalibrierter Landmarken-Offsets (`top-[14.5%]` Kragen zu Ausschnitt und `top-[36.5%]` Bund zu Taille).

#### Panel F: Stilprofil
- **Ästhetik**: Durch Kommas getrennte Stil-Keywords (z.B. *Minimalistisch, Streetwear, Vintage*).
- **Farbpalette**: Bevorzugte Farbtöne (z.B. *Pastellfarben, Erdtöne, Monochrom*).
- **Vermeiden**: Farben oder Kleidungsstücke, die strikt von KI-Empfehlungen ausgeschlossen werden sollen (z.B. *Gelb, Crop Tops*).
- **Konservativität der kulturellen Kleidung**: Wählen Sie den Bescheidenheitsgrad (*Casual/Relaxed*, *Moderat*, *Konservativ*), um die Outfit-Abdeckung des KI-Stylisten zu steuern.

#### Panel G: Körpermaße & Größen (ANSUR II Sizing Predictor)
- **Onboarding / Fresh Start-Modus**: Geben Sie 4 grundlegende Eingaben ein: **Größe**, **Gewicht**, **Taillenumfang** und **Fußlänge**. Das integrierte scikit-learn ANSUR II Multi-Output-Regressionsmodell prognostiziert automatisch 6 strukturelle Maße:
  - *Schultern*, *Brust / Oberweite*, *Hüfte*, *Ärmellänge*, *Innenbeinlänge* und *Außenbeinlänge*.
- **Automatische Größenübersetzung**: Sobald die strukturellen Maße vorhergesagt sind, füllen deterministische Größenalgorithmen sofort **alle Standard-Einzelhandelsgrößen** bis zur Schuhgröße aus:
  - *Hemdgröße (Casual Shirt Size)* (XS–XXL basierend auf Brustumfang)
  - *Hosengröße (Pants Waist Size)* (Zoll, umgerechnet von Taillenumfang in cm)
  - *US-Schuhgröße (US Shoe Size)* (Herren-/Damenformeln aus Fußlänge)
  - *Damenkleidgröße (Women's Dress Size)* (US 0–14+ basierend auf Taille)
  - *Damen-BH-Größe (Women's Bra Size)* (Unterbrustband + Körbchen, berechnet aus Brust-/Unterbrustumfang)
- **Detaillierter Bearbeitungsmodus**: Nach dem automatischen Ausfüllen können Sie alle 15 Größenparameter (einschließlich Hemdgröße, Hosengröße, Schuhgröße, BH-Größe, Kleidgröße) und Haarattribute (*Länge, Typ, Farbe, Stil*) feinabstimmen.
- **Live-Einheitenumschalter**: Wechseln Sie zwischen *kg/cm* und *lb/in* — alle Werte werden sofort umgerechnet, ohne erneute Vorhersage.

#### Panel H: Registrierung im Verzeichnis für Fachkräfte & Experten
- **Professioneller Stylist-Toggle**: Registrieren Sie sich als verifizierte Modefachkraft (Stylist, Schneider, Designer).
- **Geschäftsdetails**: Geben Sie Firmennamen, Adresse, Telefon, E-Mail, Website und Beschreibung ein, um im `/experts`-Verzeichnis und im regionalen Kampagnen-Ticker aufgeführt zu werden.

#### Panel I: PayPal Auszahlungseinstellungen
- **PayPal Empfänger-E-Mail**: Geben Sie Ihre PayPal-E-Mail-Adresse ein, um Auszahlungen für Marketplace-Verkäufe und aktive Expertenkampagnen zu erhalten.

---

### 4. Systempräferenzen Akkordeon-Karte

Verwaltet systemweite Einstellungen, Abonnements und KI-Integrationen:

- **AI Configuration (KI-Konfiguration)**:
  - *Standard Mode*: Verwendet systemverwaltete Gemini Flash 2.x-Endpunkte.
  - *Custom API Keys Mode*: Verbinden Sie benutzerdefinierte Google Gemini, Anthropic, OpenAI oder DeepSeek API-Keys über ein geführtes Einrichtungsmodal.
- **Subscription & Closet Limits (Abonnement- & Kleiderschrank-Limits)**:
  - Zeigen Sie Ihre aktuelle Kontostufe an (**Kostenlos**: 50-Artikel-Limit vs. **Manager** oder **Professional**: Unbegrenzte Artikel).
  - Upgrade über die PayPal Subscriptions REST API (Manager: 5 $/Monat oder 50 $/Jahr; Professional: 10 $/Monat oder 100 $/Jahr).
- **Scheduler & Push Reminders (Planer & Push-Erinnerungen)**:
  - Schalten Sie Benachrichtigungen für Outfit-Vorschläge am Morgen ein.
  - Legen Sie Häufigkeit (*Täglich*, *Jeden zweiten Tag*, *Zweimal pro Woche*, *Wochentags*), Zeit (z.B. *07:00*) und Anforderungen an den Dresscode-Stil (*Casual*, *Formal*, *Athletic*, *Custom*) fest.
  - Aktivieren Sie Browser-VAPID-Push-Benachrichtigungen.
- **Campaign Notification Preferences (Kampagnenbenachrichtigungspräferenzen)**:
  - Feingranulare Schalter für *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos* und *Personal Stylist*.
  - Passen Sie den Schieberegler für die **Max Campaign Distance** (5 km bis 50 km) an.
- **Google Calendar Connect**: OAuth-Button zur Synchronisierung persönlicher Kalenderereignisse mit dem KI-Stylisten.
- **Location Services Card (Standortdienste-Karte)**: Schalten Sie GPS-Standortberechtigungen für distanzbasierte Experten-Feeds und hyper-lokales Wetter um.
- **Invite Friends Button**: Kopieren Sie einen teilbaren Empfehlungslink.
- **Shopping Assistant**: Greifen Sie auf Details zur Chrome Web Store-Erweiterung zu oder generieren Sie ein **Universal Bookmarklet** (`javascript:...`) für sofortige E-Commerce-Größenvergleiche.

---

### 5. Kontoaktionen & Diagnose
- **Sign Out**: Melden Sie sich von Ihrer aktuellen Sitzung ab.
- **Delete my Account**: Link zum dauerhaften Löschen Ihrer Kontodaten.
- **Developer Panel**: Diagnose-Akkordeon für Umgebungstests.

---

## Erwartete Ergebnisse
- Sofortige Synchronisierung von physischen Metriken, Hautton und Fotofreistellungen über die 2D-Avatar-Anproben-Leinwand hinweg.
- Keine inaktiven Netzwerkanfragen beim Navigieren zwischen den Einstellungs-Panels.
- Maßgeschneiderte Outfit-Vorschläge des KI-Stylisten, die Ihren Diskretionsregeln und Ihrem Zeitplan entsprechen.

---

## Fehlerbehebung
- **Hintergrund des Fotos wird nicht entfernt**: Stellen Sie sicher, dass Ihr hochgeladenes Foto ein Ganzkörperbild mit kontrastierender Hintergrundbeleuchtung ist.
- **Push-Benachrichtigungen kommen nicht an**: Bestätigen Sie, dass die Browser-Benachrichtigungsberechtigungen aktiviert und eine Telefonnummer unter *Kontakt* gespeichert ist.
- **Adress-Autovervollständigung reagiert nicht**: Überprüfen Sie, ob eine aktive Internetverbindung für OpenStreetMap Nominatim-Abfragen besteht.

---

## Einschränkungen
- Der Speicherplatz für kostenlose Konten ist auf 150 Artikel begrenzt, es sei denn, er wird durch einen Empfehlungsbonus (+10 Plätze pro Einladung) oder ein Pro-Abonnement erweitert.
- Der Modus für benutzerdefinierte API-Keys erfordert gültige Keys mit verbleibendem Kontingent vom jeweiligen Anbieter.
