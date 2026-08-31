# DressApp Datenschutzrichtlinie

**Gültig ab:** 27. Juli 2026
**Zuletzt aktualisiert:** 27. Juli 2026

Diese Datenschutzrichtlinie beschreibt, wie DressApp ("wir", "uns") Ihre personenbezogenen Daten erhebt, verwendet, speichert, weitergibt und schützt, wenn Sie unsere digitale Garderobe- und Outfit-Styling-Anwendung nutzen.

Bitte lesen Sie diese Richtlinie sorgfältig. Durch die Nutzung von DressApp stimmen Sie den hier beschriebenen Datenpraktiken zu. Wenn Sie nicht einverstanden sind, dürfen Sie die Anwendung nicht nutzen.

---

## 1. Informationen, die wir erheben

### 1.1 Konto- & Profilinformationen
Wenn Sie ein Konto erstellen oder sich über soziale Anmeldung anmelden, erheben wir:

- **E-Mail-Adresse** — wird用于 Identifikation des Kontos, Authentifizierung und geschäftliche Kommunikation.
- **Passwort** — wird als kryptografischer Hash gespeichert; wir speichern niemals Klartext-Passwörter.
- **Anzeigename** — Ihr gewählter öffentlicher Name innerhalb der App.
- **Vor- und Nachname** — werden aus dem Google OAuth-Profil übernommen oder manuell eingegeben; jederzeit bearbeitbar.
- **Telefonnummer** — optional; wird用于 Kontowiederherstellung und Benachrichtigungen.
- **Geburtsdatum** — optional; wird用于 altersgerechte Inhaltsfilterung.
- **Geschlecht** — optional; wird用于 Körpermaße und Avatar-Empfehlungen.
- **Persönlicher Status** — optional (ledig, verheiratet, geschieden, verwitwet).
- **Adresse** — optional; strukturiert als {line1, line2, city, region, country, postal_code}.
- **Bevorzugte Sprache** — wird用于 Lokalisierung der App-Erfahrung.
- **Bevorzugte Stimme** — wird用于 KI-Stylist-Ausgabe.
- **Avatar- und Profilfotos** — Gesichts- und Körperfotos, gespeichert als base64-data URLs in MongoDB (jeweils clientseitig auf ~500 KB begrenzt).
- **Körpermaße** — Größe, Gewicht, Brust, Taille, Hüfte und andere Maße, die用于 Avatar-Generierung und Kleidungs-Empfehlungen verwendet werden.
- **Haarprofil** — Länge, Typ, Farbe und Stil (optional).
- **Wohnort** — Stadt, Land und Koordinaten (Breite/Länge), verwendet用于 wetterbasierte Outfit-Vorschläge und Kampagnen-Targeting.
- **Stilprofil und kultureller Kontext** — Ihre Stilpräferenzen und kultureller Hintergrund用于 personalisierte Empfehlungen.

### 1.2 Garderobe- & Mediadaten
DressApp ist eine digitale Garderobe-Anwendung. Folgende Daten sind Kern der Funktionalität:

- **Garderobenfotos** — Bilder, die Sie von Ihren Kleidungsstücken hochladen. Diese werden im Browser zur Hintergrundentfernung (Matting) verarbeitet und dann als data URLs in MongoDB gespeichert.
- **Kleidungsmetadaten** — Kategorie (Oberteil, Unterteil, Schuhe, Mantel, Kleid, Accessoire), Marke, Farbe, Größe, Jahreszeit, Tradition, Dresscode, Geschlecht und Unterkategorie-Tags.
- **Outfit-Daten** — gespeicherte Outfit-Kombinationen, die mehrere Garderoben-Elemente verbinden.
- **Marktplatz-Inserate** — wenn Sie Artikel verkaufen oder tauschen, Inserat-Details inklusive Fotos, Preis und Versandinformationen.
- **Koffer-/Packdaten** — Reise-Packlisten mit Artikeln, Mengen und Zweck-Tags (z.B. „Tracking / Outdoor").

### 1.3 Geräteberechtigungen
DressApp erfordert folgende Geräteberechtigungen:

- **Kamera** — zum direkten Fotografieren von Kleidungsstücken innerhalb der App.
- **Fotogalerie / Dateisystemzugriff** — zum Auswählen vorhandener Fotos zum Hochladen.
- **Geolocation** — grober Standortzugriff zum Abruf von Wetterdaten für Outfit-Empfehlungen. Sie können diese Berechtigung jederzeit verweigern oder widerrufen.
- **Benachrichtigungen** — optionale Push-Benachrichtigungen für Kampagnen-Updates und Stylist-Vorschläge.

### 1.4 KI- & maschinelles Lernen
DressApp nutzt geräte- und serverseitige KI für folgende Zwecke:

- **Hintergrundentfernung (Matting)** — Ihre hochgeladenen Kleidungsfotos werden über die rembg-/u2netp-Pipeline zur Extraktion sauberer Schnitte verarbeitet. Diese Verarbeitung erfolgt serverseitig.
- **Körpervorhersage** — Das SegFormer-Modell schätzt Körpermaße aus Ganzkörper-Outfit-Fotos.
- **Kleidungsklassifizierung** — CLIP-basierte Klassifizierung ordnet Artikel Kategorien, Farben und Marken zu.
- **Stylist-Empfehlungen** — Die Google Gemini API verarbeitet Ihre Garderoben-Daten, um Outfit-Vorschläge und Styling-Tipps zu generieren.
- **Avatar-Generierung** — 3D-Avatar-Formparameter werden aus Körpermaßen für virtuelle Anprobe berechnet.

**Wichtig:** Benutzerhochgeladene Fotos werden **nicht** zum Training von maschinellen Lernmodellen verwendet. Sie werden ausschließlich zur Bereitstellung der Kernfunktionen der App verarbeitet und nicht mit Modell-Trainingspipelines geteilt.

### 1.5 Nutzungsdaten & Analysen
Wir erheben aggregierte, anonymisierte Nutzungsdaten zur Verbesserung der App:

- App-Aktivität und Nutzungsmuster der Funktionen.
- Interaktionsdaten mit Artikeln (Ansichten, Bearbeitungen, Löschungen).
- Gerätekennungen (IP-Adresse, Betriebssystem-Version, Browsertyp).
- Kampagnen-Analysen (Werbungseinblendungen, Klicks, Ansichten) — diese sind an Kampagnen-IDs gebunden, nicht an einzelne Benutzeridentitäten.

Wir verwenden **keine** Drittanbieter-Analyse-SDKs (kein Mixpanel, Firebase Analytics, Amplitude, Sentry, LogRocket oder Ähnliches). Alle Analysen werden intern durchgeführt.

### 1.6 Zahlungsdaten
Wenn Sie die Marktplatz- oder Abonnementfunktionen von DressApp nutzen, erheben wir:

- **Stripe** — Stripe-Konto-ID, Abonnements-Zahlungsabsicht-IDs. Tatsächliche Zahlungskartennummern werden niemals auf unseren Servern gespeichert; sie werden direkt von Stripe abgewickelt.
- **PayPal** — PayPal-Empfänger-E-Mail und Bestell-/Erfassungs-IDs.
- **Apple Pay / Google Play** — Zahlungstoken, die von den jeweiligen Plattform-SDKs abgewickelt werden; wir speichern keine Kartendaten.

### 1.7 Authentifizierungsdaten Dritter
- **Google OAuth** — wenn Sie sich mit Google anmelden, erhalten und speichern wir ein verschlüsseltes OAuth-Token (`google_oauth` field), das用于 Zugriff auf Ihr Google-Profil (Name, E-Mail, Avatar) und optional Google Calendar und People API用于 Terminplanung und Kontaktfunktionen verwendet wird.

---

## 2. Wie wir Ihre Daten verwenden

Wir verwenden Ihre Daten für folgende Zwecke:

| Zweck | Rechtsgrundlage (DSGVO) | Datentypen |
|---|---|---|
| Bereitstellung der Kernfunktionen (Garderobe-Organisation, Outfit-Erstellung, Avatar-Generierung) | Vertragliche Notwendigkeit | Garderoben-Fotos, Metadaten, Körpermaße |
| Verarbeitung der Hintergrundentfernung und Kleidungs-Matting | Vertragliche Notwendigkeit | Hochgeladene Kleidungsfotos |
| Generierung von KI-Stylist-Empfehlungen | Berechtigtes Interesse | Garderoben-Metadaten, Stilprofil |
| Abruf von Wetterdaten für Outfit-Vorschläge | Einwilligung (Standortberechtigung) | Wohnort (grob) |
| Authentifizierung und Verwaltung von Benutzerkonten | Vertragliche Notwendigkeit | E-Mail, Passwort-Hash, OAuth-Token |
| Versand geschäftlicher E-Mails (Kontobestätigung, Passwort-Zurücksetzung, Löschbestätigungen) | Vertragliche Notwendigkeit | E-Mail-Adresse |
| Verarbeitung von Marktplatz-Zahlungen | Vertragliche Notwendigkeit | Stripe-/PayPal-Token, Abrechnungsinformationen |
| Erkennung und Prävention von Betrug / Missbrauch | Berechtigtes Interesse | IP-Adresse, Gerätekennungen |
| Verbesserung der App-Funktionalität (aggregierte Analysen) | Berechtigtes Interesse | Anonymisierte Nutzungsdaten |
| Erfüllung gesetzlicher Pflichten | Gesetzliche Verpflichtung | Alle Daten nach gesetzlichen Anforderungen |

---

## 3. Datenspeicherung & Sicherheit

### 3.1 Speicherung
- **Datenbank:** MongoDB Atlas (Cloud-Hosting, M0-Kostenstufe oder kostenpflichtige Stufe je nach Deployment).
- **Bilder:** Garderoben-Fotos werden als base64-verschlüsselte data URLs innerhalb von MongoDB-Dokumenten gespeichert. Jedes Bild wird vor dem Upload clientseitig auf ~500 KB begrenzt.
- **Modell-Cache:** KI-Modellgewichte (SegFormer, u2netp) werden auf persistenten Docker-Volumes auf dem Produktionsserver zwischengespeichert, um bei jeder Anfrage ein erneutes Herunterladen zu vermeiden.
- **Kein externer Blob-Speicher** wird derzeit für Bilder verwendet; alle Bilddaten befinden sich in MongoDB.

### 3.2 Sicherheit
- Alle Daten in Transit werden über **HTTPS/TLS 1.3** verschlüsselt.
- Passwörter werden als **bcrypt-Hashes** gespeichert — niemals im Klartext.
- Google OAuth-Token werden verschlüsselt at rest gespeichert.
- Zahlungsdaten (Stripe-/PayPal-Token) werden niemals im Klartext auf unseren Servern gespeichert; wir speichern nur Referenz-IDs.
- MongoDB Atlas stellt **Verschlüsselung at rest** und **Verschlüsselung in Transit** standardmäßig bereit.
- Der Zugriff auf die Datenbank ist über Connection-String-Anmeldeinformationen auf die Backend-Anwendung beschränkt.

### 3.3 Datenspeicherung
- Ihre Daten werden so lange aufbewahrt, wie Ihr Konto aktiv ist.
- Bei Kontolöschung (siehe Abschnitt 5) werden alle personenbezogenen Daten innerhalb von 30 Tagen unwiderruflich aus MongoDB entfernt.
- Aggregierte, anonymisierte Analysedaten können unbegrenzt aufbewahrt werden und können nicht mit einzelnen Benutzern verknüpft werden.

---

## 4. Datenweitergabe & Dritte

Wir geben Ihre Daten nur wie unten beschrieben an folgende Dritte weiter:

| Dritter | Weitergegebene Daten | Zweck |
|---|---|---|
| **MongoDB Atlas** | Alle Benutzerdaten und Garderoben-Bilder | Cloud-Datenbank-Hosting |
| **Google (OAuth)** | E-Mail, Name, Profilfoto | Authentifizierung und Profilerstellung |
| **Google Calendar API** | Kalender-Ereignisdaten (falls verbunden) | Stylist-Terminplanungsfunktionen |
| **Google People API** | Kontaktdaten (falls verbunden) | Soziale Funktionen |
| **Google Gemini API** | Garderoben-Metadaten und Artikelbeschreibungen | KI-Stylist-Empfehlungen |
| **Stripe** | Zahlungstoken, Abrechnungsinformationen | Zahlungsabwicklung |
| **PayPal** | Zahlungstoken, Abrechnungsinformationen | Zahlungsabwicklung |
| **Resend / SendGrid** | E-Mail-Adresse und Name | Versand geschäftlicher E-Mails |

**Wir verkaufen Ihre personenbezogenen Daten oder Garderoben-Fotos nicht an Drittanbieter-Makler, Werbetreibende oder Datenaggregatoren.**

---

## 5. Ihre Rechte & Kontolöschung

Gemäß DSGVO (EU/EWR), CCPA (Kalifornien) und anderen geltenden Datenschutzgesetzen stehen Ihnen folgende Rechte zu:

### 5.1 Zugang & Export
Sie können eine Kopie aller personenbezogenen Daten, die wir über Sie gespeichert haben, anfordern, indem Sie uns kontaktieren (siehe Abschnitt 6). Wir stellen einen JSON-Export Ihrer Kontodaten bereit, einschließlich Garderobenartikeln, Outfits und Profilinformationen.

### 5.2 Berichtigung
Sie können Ihre Profilinformationen jederzeit über die Einstellungsseite der App aktualisieren oder berichtigen. Felder, die Sie bearbeiten können, umfassen: Anzeigename, Vor-/Nachname, Telefon, Geburtsdatum, Adresse, Körpermaße, Wohnort und Stilpräferenzen.

### 5.3 Löschung (Recht auf Vergessenwerden)
Sie können Ihr Konto und alle zugehörigen Daten jederzeit löschen:

- **In der App:** Navigieren Sie zu Einstellungen → Konto → Konto löschen.
- **API:** Senden Sie eine `POST`-Anfrage an `/api/v1/users/me/delete` (authentifiziert).

Die Kontolöschung löst eine **Kaskadenlöschung** in allen Sammlungen aus:
- Benutzer-Dokument
- Alle Garderobenartikel (Fotos und Metadaten)
- Alle Outfits
- Alle Marktplatz-Inserate
- Alle Koffer und Packlisten
- Alle Stylist-Sitzungen und Nachrichten
- Alle Guthaben-Aufladungen und Transaktionsaufzeichnungen
- Alle Einbettungen (KI-generierte Daten)
- Alle Web-Push-Abonnements

Eine Löschbestätigungs-E-Mail wird an Ihre registrierte E-Mail-Adresse gesendet.

### 5.4 Datenübertragbarkeit
Sie können Ihre Daten jederzeit in einem strukturierten, maschinenlesbaren Format (JSON) anfordern. Kontaktieren Sie uns über die Angaben in Abschnitt 6.

### 5.5 Widerruf der Einwilligung
Sie können die Einwilligung für Standortzugriff, Kamerazugriff und Marketingkommunikation jederzeit über Ihre Geräte-Einstellungen oder die Einstellungsseite der App widerrufen. Der Widerruf der Einwilligung kann bestimmte App-Funktionen einschränken (z.B. wetterbasierte Outfit-Vorschläge).

### 5.6 Widerspruchsrecht (LGPD Art. 18, DSGVO Art. 21)
Gemäß LGPD (Brasilien) und DSGVO (EU/EWR) haben Sie das Recht, der Verarbeitung Ihrer personenbezogenen Daten für bestimmte Zwecke zu widersprechen, einschließlich:
- Verarbeitung aufgrund berechtigten Interesses
- Direktmarketing
- Profiling und automatisierte Entscheidungsfindung (einschließlich KI-basierter Stylist-Empfehlungen)

Um zu widersprechen, kontaktieren Sie uns über die Angaben in Abschnitt 6.

### 5.7 Grenzüberschreitende Datenübermittlungen
DressApp ist eine internationale Anwendung. Ihre Daten können in und außerhalb Ihres Wohnsitzlandes, einschließlich Israel und den Vereinigten Staaten, übermittelt und verarbeitet werden. Wir stellen sicher, dass alle Übermittlungen durch angemessene Schutzmaßnahmen geregelt werden, einschließlich Standardvertragsklauseln (SCCs) soweit dies durch geltendes Recht vorgeschrieben ist.

---

## 6. Kontaktinformationen

Für datenschutzbezogene Anfragen, Anfragen zum Datenzugriff, Löschanfragen oder zur Meldung von Datenschutzbedenken kontaktieren Sie uns bitte:

**E-Mail:** dev@dressapp.co
**Adresse:** DressApp, 11 Hanoter St, 8442711 Be'er-Sheva, Israel

Wir werden alle gültigen Anfragen innerhalb von 30 Tagen beantworten, wie es geltende Datenschutzgesetze einschließlich DSGVO, CCPA, LGPD, PIPEDA und andere internationale Datenschutzbestimmungen vorschreiben.

Für Data Subject Access Requests (DSARs) geben Sie bitte Ihre Kontakten-E-Mail-Adresse und eine Beschreibung der Daten an, auf die Sie zugreifen oder die Sie ändern möchten.

---

## 7. Kinderschutz

DressApp ist nicht für Kinder unter 16 Jahren (oder dem anwendbaren digitalen Einwilligungsalter in Ihrem Zuständigkeitsbereich, je nachdem, welches höher ist) bestimmt. Wir erheben wissentlich keine personenbezogenen Daten von Personen unter diesem Alter. Wenn wir erfahren, dass ein Minderjähriger uns personenbezogene Daten zur Verfügung gestellt hat, werden wir unverzüglich Schritte zu deren Löschung einleiten.

Wenn Sie ein Elternteil oder gesetzlicher Vormund sind und glauben, dass Ihr Kind uns personenbezogene Daten zur Verfügung gestellt hat, kontaktieren Sie uns bitte unter dev@dressapp.co und wir werden umgehend handeln.

---

## 8. Internationale Compliance

DressApp ist für den Einsatz in allen Ländern konzipiert. Diese Datenschutzrichtlinie wurde erstellt, um den folgenden internationalen Datenschutzrahmen zu entsprechen:

| Rahmenwerk | Zuständigkeit | Abgedeckte Kernbestimmungen |
|---|---|---|
| **DSGVO** | EU/EWR | Rechtsgrundlage, Rechte der betroffenen Person, DSO-Kontakt, internationale Übermittlungen, Verletzungsbenachrichtigung |
| **CCPA/CPRA** | Kalifornien, USA | Recht auf Auskunft, Löschung, Widerspruch gegen Verkauf, Nichtdiskriminierung |
| **LGPD** | Brasilien | Rechtsgrundlage, Rechte der betroffenen Person, DSO, internationale Übermittlungen, Einwilligung |
| **PIPEDA** | Kanada | Einwilligung, Zugang, Berichtigung, Rechenschaftspflicht, Verletzungsbenachrichtigung |
| **POPIA** | Südafrika | Rechtmäßige Verarbeitung, Rechte der betroffenen Person, grenzüberschreitende Übermittlung |
| **PDPA** | Thailand | Einwilligung, Rechte der betroffenen Person, internationale Übermittlung |
| **PDPL** | Saudi-Arabien | Rechtsgrundlage, Rechte der betroffenen Person, internationale Übermittlung |

Wo ein bestimmtes Zuständigkeitsrecht zusätzliche Rechte oder Schutzmaßnahmen über das hinaus vorschiebt, was in dieser Richtlinie beschrieben ist, gelten diese zusätzlichen Rechte.

---

## 9. Änderungen an dieser Datenschutzrichtlinie

Wir können diese Datenschutzrichtlinie von Zeit zu Zeit aktualisieren. Über wesentliche Änderungen informieren wir Sie durch:

- Veröffentlichung der aktualisierten Richtlinie auf dieser Seite mit einem geänderten „Gültig ab"-Datum.
- Senden einer E-Mail-Benachrichtigung an Ihre registrierte E-Mail-Adresse bei wesentlichen Änderungen.
- Anzeige eines In-App-Hinweises beim nächsten Öffnen der App.

Wir empfehlen Ihnen, diese Richtlinie regelmäßig zu überprüfen.

---

## 10. Gültig ab & anwendbares Recht

Diese Datenschutzrichtlinie gilt ab dem **27. Juli 2026**.

DressApp ist eine internationale Anwendung, die in allen Ländern eingesetzt wird. Diese Richtlinie unterliegt den Grundsätzen der **Datenschutz-Grundverordnung (DSGVO)** — EU/EWR, des **California Consumer Privacy Act (CCPA)** — Vereinigte Staaten, der **Lei Geral de Proteção de Dados (LGPD)** — Brasilien, des **Personal Information Protection and Electronic Documents Act (PIPEDA)** — Kanada und anderer geltender internationaler Datenschutzgesetze. Im Falle von Widersprüchen zwischen diesen Rahmenwerken gilt der für den Benutzer schützendste Standard.

---

## 10. App-Store-Compliance

Diese Datenschutzrichtlinie ist öffentlich zugänglich unter:

**https://dressapp.co/privacy**

Sie wird referenziert in:
- **Apple App Store Connect** — App-Privacy-Bereich
- **Google Play Console** — Datensicherheitsbereich
- **In-App-Einstellungen** — ein direkter Link ist im Einstellungsmenü verfügbar
- **Onboarding-Fluss** — ein Datenschutzhinweis wird beim erstmaligen Kont-setup angezeigt

---

*DressApp respektiert Ihre Privatsphäre und setzt sich für transparente Datenpraktiken ein. Wenn Sie Fragen zu dieser Richtlinie oder zur Verarbeitung Ihrer Daten haben, kontaktieren Sie uns bitte unter dev@dressapp.co.*
