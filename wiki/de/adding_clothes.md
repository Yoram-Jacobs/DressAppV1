# Kleidung erfassen & hinzufügen

Digitalisieren Sie Ihren Kleiderschrank in Sekundenschnelle mit multimodaler KI-Erkennung, automatischer Hintergrundentfernung und intelligenter Bildvervollständigung.

## Übersicht
Erfassen Sie Kleidungsstücke per Live-Kamerafoto, Galerie-Mehrfachupload, Digital Product Passport (DPP) QR-Codes oder digitalen Rechnungen (OCR). Die integrierte On-Premises-KI entfernt Hintergründe automatisch, extrahiert über 20 Modemerkmale und erstellt saubere Studiofreisteller – ganz ohne API-Schlüssel.

## Voraussetzungen
- Klare, gut beleuchtete Fotos der Kleidungsstücke (Spiegelselfies, Ganzkörperfotos oder Flat-Lays).
- Kamerazugriff für das Scannen von Gegenständen und QR-Codes.
- Digitale Rechnungen oder Screenshots (PDF / PNG / JPEG) von Online-Käufen.
- *(Optional)* Ein persönlicher Google Gemini API-Schlüssel, wenn Sie die generative Bildrekonstruktion mit Nano Banana nutzen möchten.

## Schritt-für-Schritt-Anleitung

1. **Interaktiver Upload & Aufnahme**:
   - Tippen Sie auf **Artikel hinzufügen** &rarr; wählen Sie **Foto aufnehmen** oder laden Sie Fotos von Ihrem Gerät hoch.
   - Die integrierte Duplikaterkennung prüft sofort, ob der Artikel bereits vorhanden ist.
2. **KI-Segmentierung & Mehrfachartikel-Erkennung**:
   - Das Vision-Modell erkennt und isoliert verschiedene Kleidungsstücke (Jacken, Oberteile, Röcke, Hosen, Schuhe, Accessoires) in einem Durchgang.
3. **KI-Freistellung & Studioqualität**:
   - Die Bildverarbeitung schneidet Hintergründe automatisch aus und generiert gestochen scharfe, transparente PNG-Bilder für alle Konten.
4. **Automatische Attribut-Erkennung**:
   - Die lokale KI extrahiert über 20 Modemerkmale (Farben, Materialzusammensetzung, Unterkategorie, Dresscode, Marke und Zustand).
5. **Erweiterte generative Fotoreparatur (Nano Banana)**:
   - Für Benutzer mit persönlichem Google Gemini API-Schlüssel analysiert Nano Banana verdeckte oder abgeschnittene Bereiche (Taschen, Hände, Bildränder) und rekonstruiert fehlende Stoffpartien zu vollständigen Studioaufnahmen.
6. **Digitale Belege & DPP-Tags**:
   - Wechseln Sie zu **Digitaler Import**, um Bestellbestätigungen oder Rechnungen einzulesen und Kaufpreis sowie Größen zu speichern.
   - Scannen Sie den **QR-Code (DPP)** auf dem Pflegeetikett für EU-Lieferkettendaten und Pflegeanleitungen.
7. **Im Kleiderschrank speichern**:
   - Tippen Sie auf **Speichern**. Die Artikel erscheinen sofort in Ihrer Kleiderschrank-Übersicht.

## Erwartete Ergebnisse
Jedes Kleidungsstück erscheint als zentriertes, professionell freigestelltes Studiofoto mit vollständigen Suchattributen und detaillierten Tags.

## Fehlerbehebung
- **Abgeschnittene Kleidungsstücke**: Platzieren Sie das Kleidungsstück mittig vor einem kontrastierenden Hintergrund. Mit konfiguriertem API-Schlüssel kann Nano Banana abgeschnittene Säume oder Kragen automatisch rekonstruieren.
- **Beleuchtung & Kontrast**: Für dunkle Kleidung empfiehlt sich ein heller, kontrastreicher Hintergrund.
- **Fehlerhafte Rechnungserkennung**: Nutzen Sie die interaktive Box-Auswahl auf dem Rechnungsbild, um Produktzeilen manuell zuzuweisen.

## Einschränkungen
- Größere Stapel-Uploads (>5 Artikel) werden im Hintergrund verarbeitet, um eine flüssige Bedienung ohne Browser-Timeouts zu gewährleisten.
- Die fotorealistische Rekonstruktion mit Nano Banana erfordert einen benutzerdefinierten Google Gemini API-Schlüssel.
