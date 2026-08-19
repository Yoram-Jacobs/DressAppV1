# Kleidung aufnehmen und hinzufügen

Digitalisieren Sie Ihre physische Garderobe in Sekundenschnelle mit multimodaler KI-Erkennung, intelligenter Hintergrundentfernung und automatischer Bildrekonstruktion.

## Übersicht
Erfassen Sie Kleidung über Live-Kameraaufnahmen, Galerie-Uploads mehrerer Bilder, QR-Codes digitaler Produktpässe (DPP) oder digitale Belege (Rechnungs-OCR). Die integrierte KI schneidet Hintergründe automatisch frei, versieht Kleidungsstücke mit Modeattributen, bewertet die Vollständigkeit des Zuschnitts und rekonstruiert verdeckte oder abgeschnittene Artikel.

## Voraussetzungen
- Klare, gut beleuchtete Fotos von Kleidungsstücken (Spiegelselfies, Ganzkörper-Outfitfotos oder Flat-Lays).
- Kamerazugriff zum Scannen physischer Artikel und QR-Codes.
- Digitale Quittungen oder Rechnungs-Screenshots (PDF / PNG / JPEG) für Online-Käufe.

## Schritt für Schritt

1. **Interaktiver Upload & Aufnahme**:
   - Tippen Sie auf **Artikel hinzufügen** &rarr; wählen Sie **Foto aufnehmen** oder laden Sie ein oder mehrere Outfit-Fotos von Ihrem Gerät hoch.
   - Die integrierte Duplikaterkennung prüft sofort, ob Sie dasselbe Kleidungsstück bereits hochgeladen haben.
2. **KI-Segmentierung & Multi-Item-Erkennung**:
   - Das Vision-Modell isoliert verschiedene Kleidungsstücke (Jacken, Oberteile, Röcke, Hosen, Schuhe, Accessoires) in einem einzigen Durchlauf.
3. **KI-Qualitätsprüfung & Automatische Bildreparatur**:
   - Der visuelle Qualitätsprüfer von Gemini inspiziert jeden zugeschnittenen Artikel:
     - **Vollständig**: Intakte, unverdeckte Kleidungsstücke werden direkt freigestellt.
     - **Bildvervollständigung**: Weist ein Artikel fehlende Seitenkonturen, Verdeckungen (durch Taschen/Arme) oder abgeschnittene Säume/Kragen auf, führt die KI automatisch ein Outpainting durch und ergänzt den fehlenden Stoff.
     - **Vollständige Studio-Rekonstruktion**: Stark abgeschnittene Artikel (wie Schuhe, bei denen nur die Kappe sichtbar ist) werden vollständig in makellose Studio-Katalogfotos umgewandelt.
4. **Automatisches Metadaten-Tagging**:
   - Die KI extrahiert über 20 Modeattribute (Farben, Stoffzusammensetzung, Unterkategorie, Dresscode, Marke und Zustand).
5. **Digitale Belege & DPP-Tags**:
   - Wechseln Sie zu **Digitaler Import**, um Bestellbestätigungs-E-Mails oder Rechnungen zu analysieren und Kaufpreise sowie verifizierte Größen zu hinterlegen.
   - Tippen Sie auf **QR scannen (DPP)** auf dem Etikett, um Lieferketteninformationen und Pflegehinweise des EU-Produktpasses zu importieren.
6. **Im Kleiderschrank speichern**:
   - Tippen Sie auf **Speichern**. Artikel erscheinen sofort im Kleiderschrank-Grid, während generative Vervollständigungen nahtlos im Hintergrund finalisiert werden.

## Erwartete Ergebnisse
Jedes Kleidungsstück erscheint in Ihrer digitalen Garderobe als zentriertes, sauberes Foto in Studioqualität mit vollständig indizierten Suchattributen und umfassenden Taxonomie-Tags.

## Fehlerbehebung
- **Abgeschnittene / Unvollständige Kleidungsstücke**: Die KI erkennt Bildkantenabschnitte automatisch und rekonstruiert sie; Sie können auch auf jeder Artikeldetailkarte auf **Foto reparieren** tippen, um eine manuelle Studio-Neugenerierung auszulösen.
- **Beleuchtung & Kontrast**: Für beste Ergebnisse bei dunklen Kleidungsstücken fotografieren Sie diese vor kontrastierenden Hintergründen.
- **Fehlerhafte Quittungs-OCR**: Verwenden Sie die interaktive Box-Auswahl auf Quittungsbildern, um einzelne Produktzeilen manuell festzulegen.

## Einschränkungen
- Hochauflösende Stapel-Uploads (>5 Artikel) werden über asynchrone Hintergrundwarteschlangen verarbeitet, um eine reaktionsschnelle Leistung ohne Browser-Timeouts zu gewährleisten.