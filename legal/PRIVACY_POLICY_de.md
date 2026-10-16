# DressApp Datenschutzerklärung

**Datum des Inkrafttretens:** 23. September 2026  
**Zuletzt aktualisiert:** 16. Oktober 2026  
**App-Version:** 1.0.5  
**Offizielle Website:** [https://dressapp.co](https://dressapp.co)  
**Spezielle Datenschutz-URL:** [https://dressapp.co/privacy](https://dressapp.co/privacy)  

Willkommen bei **DressApp** („wir", „unser", „uns" oder „die Anwendung"). DressApp ist eine intelligente Plattform für digitale Garderobenverwaltung, Stilplanung und einen persönlichen KI-Stylisten, die von der **DressApp Ltd.** entwickelt und betrieben wird.

Diese Datenschutzerklärung erläutert im Detail, wie wir personenbezogene Daten abrufen, erheben, verwenden, verarbeiten, speichern, offenlegen, aufbewahren und schützen, wenn Sie unsere Webplattform, unsere mobilen Anwendungen und verbundene Dienste nutzen. Bitte lesen Sie dieses Dokument sorgfältig durch. Indem Sie ein Konto erstellen oder DressApp nutzen, bestätigen Sie die in dieser Richtlinie dargelegten Praktiken und erklären sich damit einverstanden.

---

## 1. Daten, die wir erheben und auf die wir zugreifen

Wir erheben Daten, die Sie uns direkt zur Verfügung stellen, Daten, die automatisch durch die Interaktion mit Ihrem Gerät erfasst werden, sowie Daten, die über autorisierte Drittanbieter-Integrationen bezogen werden.

### 1.1 Konto- & Identitätsdaten
- **Authentifizierungsdaten:** E-Mail-Adresse und kryptografisch gehashte Passwörter (mit Salt mittels bcrypt). Wir speichern niemals Passwörter im Klartext.
- **Profildetails:** Anzeigename, Vorname, Nachname, Telefonnummer (optional), Geburtsdatum (optional) und Geschlecht (optional, verwendet für maßgeschneidertes Styling und Avatar-Geometrie).
- **Demografische Daten & Größendaten:** Körpermaße (Körpergröße, Gewicht, Brustumfang, Taillenumfang, Hüftumfang, Schrittlänge, Armlänge), Hautton-Präferenz und Haarprofil (optional) zur Erstellung virtueller Anprobe-Avatare und präziser Passformempfehlungen.
- **Standortinformationen:** Stadt, Land und ungefähre geografische Koordinaten (Breiten-/Längengrad), die mit Ihrer Einwilligung bereitgestellt werden, um lokale Wetterbedingungen für wettergerechte tägliche Outfit-Empfehlungen abzurufen.

### 1.2 Digitale Garderobe, Medien und Outfits
- **Kleidungsfotos:** Bilder von Kleidungsstücken, die Sie fotografieren oder in Ihren digitalen Kleiderschrank hochladen.
- **Kleidungs-Metadaten:** Artikelkategorie (Oberteil, Unterteil, Schuhe, Oberbekleidung, Kleid, Accessoire), Marke, Farbpalette, Stoffzusammensetzung, Formalität/Dresscode, Saison und Zustands-Tags.
- **Outfits & Looks:** Vom Nutzer erstellte Outfit-Kombinationen, geplante Kalender-Looks und Koffer-Packlisten.
- **Marktplatz-Inhalte:** Für den Verkauf, den Tausch oder die Spende erstellte Artikel-Inserate, einschließlich Beschreibungen, Preisvorstellungen und Lieferpräferenzen.

### 1.3 Geräteberechtigungen
- **Kamera:** Wird ausschließlich verwendet, wenn Sie Fotos von Kleidungsstücken direkt in der App aufnehmen.
- **Fotomediathek:** Wird ausschließlich verwendet, wenn Sie vorhandene Fotos von Kleidungsstücken oder Profil-Avataren zum Hochladen auswählen.
- **Push-Benachrichtigungen:** Werden nur mit Ihrer Erlaubnis verwendet, um tägliche Outfit-Erinnerungen, Updates des Packassistenten und wichtige Sicherheitswarnungen zu senden.

---

## 2. Google-Nutzerdaten & Offenlegung zur eingeschränkten Nutzung (Limited Use)

DressApp bietet optionale Integrationen mit Google, um die Nutzeranmeldung und eine personalisierte Zeitplanung zu erleichtern. In diesem Abschnitt wird ausdrücklich erläutert, auf welche Google-Nutzerdaten zugegriffen wird, wie diese verwendet und gespeichert werden und wie wir die strengen Datenschutzstandards von Google einhalten.

> ### Richtlinie für Nutzerdaten der Google API-Dienste — Erklärung zur eingeschränkten Nutzung (Limited Use)
> **Die Nutzung und Weitergabe von Informationen, die DressApp von Google APIs erhält, an andere Apps erfolgt unter Einhaltung der [Richtlinie für Nutzerdaten der Google API-Dienste (Google API Services User Data Policy)](https://developers.google.com/terms/api-services-user-data-policy), einschließlich der Anforderungen zur eingeschränkten Nutzung (Limited Use).**

### 2.1 Auf welche Google-Nutzerdaten wir zugreifen

| Google API-Bereich (Scope) | Abgerufene Daten | Spezifischer Zweck in DressApp |
|---|---|---|
| `openid`<br>`userinfo.email`<br>`userinfo.profile` | Google-Nutzer-ID, primäre E-Mail-Adresse, vollständiger Name und URL des Profilbild-Avatars. | Zur Authentifizierung Ihrer Identität, zur Erstellung und Sicherung Ihres DressApp-Nutzerkontos sowie zur Anzeige Ihres Namens und Profil-Avatars in Ihrem persönlichen Kleiderschrank-Dashboard. |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Zusammenfassungen von Google Kalender-Terminen, Start-/Endzeitstempel, Orte und Terminbeschreibungen. | Schreibgeschützter Zugriff, der ausschließlich von der KI-Stylist-Funktion genutzt wird, um Outfit-Vorschläge auf Ihren realen Terminkalender abzustimmen (z. B. Vorschlag professioneller Geschäftskleidung für geplante Meetings, Sportbekleidung für Workouts oder formeller Kleidung für Abendveranstaltungen). |
| `https://www.googleapis.com/auth/user.birthday.read`<br>`https://www.googleapis.com/auth/user.gender.read` | Geburtsdatum und Geschlecht (sofern in Ihrem Google-Profil hinterlegt und ausdrücklich freigegeben). | Wird verwendet, um Algorithmen für die Größenberechnung des Körper-Avatars, altersgerechte Stilberatung und Passformempfehlungen zu kalibrieren. |
| `https://www.googleapis.com/auth/user.phonenumbers.read`<br>`https://www.googleapis.com/auth/user.addresses.read` | Telefonnummer und Adresse (sofern in Ihrem Google-Profil hinterlegt und ausdrücklich freigegeben). | Wird nach ausdrücklicher Bestätigung durch den Nutzer ausschließlich zum Vorausfüllen von Lieferadressen für Marktplatz-Transaktionen und zur Kontowiederherstellung verwendet. |

### 2.2 Wie wir Google-Nutzerdaten verwenden
- Google-Nutzerdaten werden **ausschließlich zur Bereitstellung und Verbesserung nutzerorientierter Funktionen** der DressApp-Anwendung verwendet (Authentifizierung, Einrichtung des Nutzerprofils und kalenderbasierte Outfit-Empfehlungen).
- Wir verarbeiten Titel und Zeitstempel von Google Kalender-Terminen im flüchtigen Arbeitsspeicher, um tägliche Garderobenempfehlungen und Packlisten zu generieren.

### 2.3 Strikte Verbote und Schutzmaßnahmen für Google-Nutzerdaten
- **Kein Modelltraining:** Google-Nutzerdaten und Daten der Google Workspace APIs werden **NICHT** verwendet, um allgemeine oder nicht-personalisierte Modelle für künstliche Intelligenz (KI) oder maschinelles Lernen (ML) zu entwickeln, zu verbessern oder zu trainieren.
- **Keine Werbung:** Wir verwenden, übertragen oder legen Google-Nutzerdaten **NICHT** zur Ausspielung von Werbung offen, einschließlich zielgerichteter, personalisierter, Retargeting- oder interessenbasierter Werbung.
- **Keine Datenhändler / Kein Weiterverkauf:** Wir verkaufen, vermieten, lizenzieren oder handeln Google-Nutzerdaten unter keinen Umständen an Dritte, Datenhändler oder Informationswiederverkäufer.
- **Keine Kredit- oder Bonitätsprüfung:** Google-Nutzerdaten werden niemals zur Feststellung der Kreditwürdigkeit oder für Kreditvergabezwecke verwendet.
- **Beschränkungen des menschlichen Zugriffs:** Mitarbeiter, Auftragnehmer und Entwickler lesen Ihre Google-Nutzerdaten **NICHT**, es sei denn:
  1. Sie haben Ihre ausdrückliche aktive Einwilligung für eine bestimmte Sitzung zur Fehlerbehebung erteilt;
  2. Dies ist für Sicherheitsuntersuchungen zwingend erforderlich (z. B. zur Untersuchung von Missbrauch, Betrug oder Malware);
  3. Dies ist gesetzlich vorgeschrieben, um geltendem Recht oder rechtskräftigen behördlichen Anordnungen nachzukommen; oder
  4. Die Daten sind für den internen technischen Betrieb aggregiert und anonymisiert.

---

## 3. Wie wir allgemeine Daten verarbeiten und verwenden

Wir verarbeiten nicht von Google stammende personenbezogene Daten auf den folgenden Rechtsgrundlagen:

| Verarbeitungstätigkeit | Rechtsgrundlage (DSGVO / Globale Standards) | Verwendete Datenkategorien |
|---|---|---|
| Indexierung und Katalogisierung der digitalen Garderobe sowie Outfit-Erstellung | Vertragserfüllung | Kleidungsfotos, Kategorien, Farben, Metadaten |
| KI-Hintergrundentfernung und Extraktion transparenter Kleidungsausschnitte | Vertragserfüllung | Hochgeladene Kleidungsfotografien |
| KI-Stylist-Look-Empfehlungen & Stilberatung | Berechtigtes Interesse / Einwilligung | Garderoben-Metadaten, Stilpräferenzen |
| Wetterangepasste Outfit-Planung | Einwilligung (Standortberechtigung) | Ungefährer Standort (Stadt/Koordinaten) |
| Transaktionsbezogene Kommunikation (Sicherheitswarnungen, Passwort-Zurücksetzungen) | Vertragserfüllung | E-Mail-Adresse des Kontos |
| Marktplatz-Transaktionen und Zahlungsabwicklung | Vertragserfüllung | Token des Zahlungsdienstleisters (Stripe/PayPal), Transaktionsverlauf |

---

## 4. Datenspeicherung, Sicherheit und Schutzmechanismen

Wir setzen robuste administrative, technische und physische Sicherheitsmaßnahmen ein, um Ihre sensiblen Daten vor unbefugtem Zugriff, Veränderung, Offenlegung oder Zerstörung zu schützen:

- **Verschlüsselung bei der Übertragung (Encryption in Transit):** 100 % der zwischen Ihrem Browser/Ihrer App und unseren Servern übertragenen Daten werden mit modernem **HTTPS und Transport Layer Security (TLS 1.3 / TLS 1.2)** verschlüsselt.
- **Isolierte selbst gehostete Datenbank & Speicherschutz:** Alle Datenbankeinträge, Garderoben-Metadaten, Profileinträge und verschlüsselten OAuth-Zugangsdaten werden in der isolierten, selbstverwalteten **lokalen (On-Premises) MongoDB 7.0-Datenbank** von DressApp auf dediziertem **Hetzner Cloud (EU)** NVMe-Speicher gespeichert; diese ist innerhalb eines internen privaten Container-Netzwerks ohne öffentlich zugänglichen Datenbank-Port isoliert und durch AES-256-Verschlüsselung für sensible Token sowie automatisierte lokale Backups geschützt.
- **Kryptografischer Passwortschutz:** Nutzerpasswörter werden mittels bcrypt-Hashing inklusive nutzerspezifischer Salts verschlüsselt.
- **Zugriffskontrolle:** Der Zugriff auf die Produktionsinfrastruktur ist durch SSH-Schlüsselauthentifizierung, Multi-Faktor-Authentifizierung (MFA), rollenbasierte Zugriffskontrollen nach dem Prinzip der geringsten Rechte (Least-Privilege RBAC) und fortlaufende Audit-Protokollierung streng beschränkt.

---

## 5. Datenaufbewahrung und Löschung

### 5.1 Aufbewahrungsdauer
- Wir bewahren Ihre personenbezogenen Daten und Garderobendatensätze so lange auf, wie Ihr DressApp-Nutzerkonto aktiv bleibt.
- Google OAuth-Zugriffstoken und der Kalender-Cache werden nur so lange aufbewahrt, wie die Google-Integration aktiv und von Ihnen autorisiert ist.

### 5.2 Trennen von Google-Integrationen
- Sie können Ihr Google-Konto oder Ihre Google Kalender-Integration jederzeit direkt in der App über **Einstellungen → Integrationen → Google trennen** (Settings → Integrations → Disconnect Google) trennen.
- Sie können die Berechtigungen für DressApp auch direkt über Ihre [Sicherheitseinstellungen des Google-Kontos](https://myaccount.google.com/permissions) widerrufen.
- Nach dem Trennen werden gespeicherte Google OAuth-Token und zwischengespeicherte Kalendertermine sofort aus unseren aktiven Systemen gelöscht.

### 5.3 Kontolöschung & Recht auf Löschung
Sie haben das uneingeschränkte Recht, Ihr Konto und alle zugehörigen Daten jederzeit zu löschen:
- **Ein-Klick-Löschung in der App:** Navigieren Sie zu **Einstellungen → Konto → Konto löschen** (Settings → Account → Delete Account).
- **Per E-Mail-Anfrage:** Senden Sie eine E-Mail von Ihrer registrierten E-Mail-Adresse an [dev@dressapp.co](mailto:dev@dressapp.co) mit dem Betreff „Delete My Account" (Mein Konto löschen).

Die Kontolöschung führt eine sofortige, unwiderrufliche Kaskadenlöschung über alle Datenbanken hinweg aus, wodurch Folgendes dauerhaft gelöscht wird:
- Ihr Nutzerprofil, Ihre Identitätsdatensätze und Authentifizierungsdaten;
- Alle Garderobenartikel, hochgeladenen Fotografien und vom Hintergrund freigestellten Bilder;
- Alle gespeicherten Outfits, Lookbook-Einträge und Packlisten;
- Alle Marktplatz-Inserate und Transaktionsreferenzen;
- Alle Gesprächsverläufe mit dem KI-Stylisten, Vektor-Embeddings und Google-Token.

Alle Daten werden innerhalb von 30 Tagen nach der Löschanfrage vollständig vernichtet.

---

## 6. Datenweitergabe, Offenlegung und Drittanbieter

Wir verkaufen, vermieten oder handeln Ihre personenbezogenen Daten nicht. Die Kerndatenbankspeicherung und die Basis-Computer-Vision („The Eyes") werden direkt von DressApp auf unserer isolierten, selbstverwalteten On-Premises-Serverinfrastruktur ohne zwischengeschaltete Drittanbieter-Datenbank-SaaS-Dienste betrieben. Wir geben Daten nur an geprüfte Infrastruktur- und Dienstleister weiter, die uns beim Betrieb unserer Plattform unterstützen und streng an Auftragsverarbeitungsverträge gebunden sind:

| Dienstleister | Offengelegte Daten | Zweck |
|---|---|---|
| **Hetzner Online GmbH (EU-Infrastruktur)** | Verschlüsselte Server-Volumes, auf denen die selbstverwaltete On-Premises-MongoDB-Datenbank von DressApp, Garderobenmedien und die lokale KI-Inferenz gehostet werden | Dedizierter europäischer Virtual Private Server (VPS) und NVMe-Speicherinfrastruktur (DSGVO-konformes EU-Rechenzentrum) |
| **Google Cloud Platform / Google APIs** | OAuth-Authentifizierungstoken, Styling-Anfrage-Prompts | Nutzerauthentifizierung und Gemini-KI-Styling-Analyse |
| **Stripe / PayPal** | Zahlungstransaktions-Token, Abrechnungs-Metadaten | PCI-konforme Zahlungsabwicklung (Kartennummern berühren niemals unsere Server) |
| **Resend / Transaktions-E-Mail-Dienst** | E-Mail-Adresse, Anzeigename des Nutzers | Zustellung wichtiger Systemmitteilungen und Passwort-Zurücksetzungen |

---

## 7. Internationale Datenschutzrechte (DSGVO, CCPA/CPRA, LGPD, PIPEDA)

Abhängig von Ihrem geografischen Standort stehen Ihnen bestimmte gesetzliche Datenschutzrechte zu:
- **Recht auf Auskunft / Datenübertragbarkeit:** Sie können eine vollständige, maschinenlesbare JSON-Kopie aller personenbezogenen Daten anfordern, die wir über Sie gespeichert haben.
- **Recht auf Berichtigung:** Sie können unrichtige personenbezogene Daten jederzeit in den App-Einstellungen aktualisieren oder korrigieren.
- **Recht auf Löschung:** Sie können die dauerhafte Löschung Ihrer personenbezogenen Daten wie in Abschnitt 5 beschrieben verlangen.
- **Recht auf Einschränkung der Verarbeitung oder Widerspruch:** Sie können jederzeit gegen automatisiertes Profiling Widerspruch einlegen oder Ihre Einwilligung zur Standort-/Kameraverarbeitung widerrufen.
- **Nichtdiskriminierung:** Wir werden Sie niemals benachteiligen, Ihnen Dienste verweigern oder Preise ändern, weil Sie Ihre Datenschutzrechte ausgeübt haben.

---

## 8. Datenschutz von Kindern

DressApp ist ausschließlich für Personen bestimmt, die mindestens 16 Jahre alt sind (oder das gesetzliche Mindestalter für die digitale Einwilligung in Ihrer Rechtsordnung erreicht haben). Wir fordern wissentlich keine personenbezogenen Daten von Kindern unter 16 Jahren an und erheben diese auch nicht. Wenn wir feststellen, dass uns ein Minderjähriger unter 16 Jahren personenbezogene Daten übermittelt hat, werden wir diese Daten umgehend von unseren Servern löschen.

---

## 9. Änderungen dieser Datenschutzerklärung

Wir können diese Datenschutzerklärung regelmäßig aktualisieren, um Änderungen unserer Dienste, technologische Fortschritte oder gesetzliche Anforderungen abzubilden. Bei Aktualisierungen passen wir das Datum „Zuletzt aktualisiert" oben in dieser Richtlinie an und informieren die Nutzer bei wesentlichen Änderungen über eine In-App-Ankündigung oder per E-Mail-Benachrichtigung. Wir empfehlen Ihnen, diese Seite regelmäßig zu überprüfen.

---

## 10. Kontaktinformationen & Datenschutzanfragen

Wenn Sie Fragen, Bedenken, Feedback oder Anfragen zu dieser Datenschutzerklärung oder Ihren personenbezogenen Daten haben, wenden Sie sich bitte an unser Datenschutzteam:

- **Organisation:** DressApp Ltd.
- **Primärer Datenschutzkontakt:** [dev@dressapp.co](mailto:dev@dressapp.co)
- **Nutzersupport-Kontakt:** [lokoprod@gmail.com](mailto:lokoprod@gmail.com)
- **Postanschrift:** DressApp Ltd., 11 Hanoter St, 8442711 Be'er-Sheva, Israel
- **Offizielle Website:** [https://dressapp.co](https://dressapp.co)
- **Spezielle Datenschutz-URL:** [https://dressapp.co/privacy](https://dressapp.co/privacy)

Wir verpflichten uns, alle Datenschutzanfragen umgehend und innerhalb von dreißig (30) Tagen nach Eingang zu bearbeiten und zu klären.
