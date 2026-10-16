# Kleidung erfassen & hinzufügen

Digitalisieren Sie Ihren physischen Kleiderschrank in Sekundenschnelle mit multimodaler KI-Erkennung, intelligenter Hintergrundentfernung und automatischer Bildvervollständigung.

## Übersicht
Erfassen Sie Kleidungsstücke per Live-Kamerafoto, Galerie-Mehrfachupload, Digital Product Passport (DPP) QR-Codes oder digitalen Kaufbelegen (Rechnungs-OCR). Die integrierte On-Premises-KI entfernt Hintergründe automatisch, extrahiert über 20 Modemerkmale und erstellt saubere Studiofreisteller – ganz ohne erforderliche API-Schlüssel.

## Voraussetzungen
- Klare, gut beleuchtete Fotos der Kleidungsstücke (Spiegelselfies, Ganzkörper-Outfitfotos oder Flat-Lays).
- Kamerazugriff für das Scannen von physischen Kleidungsstücken und QR-Codes.
- Digitale Kaufbelege oder Rechnungs-Screenshots (PDF / PNG / JPEG) für Online-Einkäufe.

## Schritt-für-Schritt-Anleitung

1. **Interaktiver Upload & Aufnahme**:
   - Tippen Sie auf **Artikel hinzufügen** &rarr; wählen Sie **Foto aufnehmen** oder laden Sie ein oder mehrere Outfitfotos von Ihrem Gerät hoch.
   - Die integrierte Duplikaterkennung prüft sofort, ob Sie dasselbe Kleidungsstück bereits zuvor hochgeladen haben.
2. **KI-Segmentierung & Mehrfachartikel-Erkennung**:
   - Das Vision-Modell erkennt und isoliert verschiedene Kleidungsstücke (Jacken, Oberteile, Röcke, Hosen, Schuhe, Accessoires) in einem einzigen Durchgang.
3. **KI-Freistellung & saubere Studiofotos**:
   - Die integrierte Bildverarbeitung entfernt Hintergründe automatisch und erstellt gestochen scharfe, transparente PNG-Bilder für alle Konten.
4. **Automatische Metadaten-Erkennung**:
   - Konten im kostenlosen Tarif (Free Tier) nutzen die lokale On-Premises-**Eyes**-Engine von DressApp (derzeit ein feinabgestimmtes `Qwen 2.5 VL 3B`-Modell), während Abonnenten der Tarife **Manager** und **Professional** vom schnellen Cloud-Modell (`Google Gemini 3.5 Flash`) profitieren, um über 20 Modemerkmale (Farben, Materialzusammensetzung, Unterkategorie, Dresscode, Marke und Zustand) zu extrahieren.
5. **Erweiterte generative Fotoreparatur (Nano Banana)**:
   - Nano Banana untersucht zugeschnittene Artikel auf Verdeckungen (Taschen, Hände) und Bildränder und rekonstruiert fehlende Stoffpartien automatisch per Outpainting zu vollständigen Studioaufnahmen – ganz ohne externe API-Schlüssel.
6. **Digitale Belege & DPP-Tags**:
   - Wechseln Sie zu **Digitaler Import**, um Bestellbestätigungs-E-Mails oder Rechnungen auszulesen und den Kaufpreis sowie verifizierte Größen fest zu speichern.
   - Tippen Sie auf **QR scannen (DPP)** auf dem Pflegeetikett, um Lieferkettendaten des Digitalen EU-Produktpasses und Pflegehinweise zu importieren.
7. **Im Kleiderschrank speichern**:
   - Tippen Sie auf **Speichern**. Die Artikel erscheinen sofort in Ihrer Kleiderschrank-Übersicht.

## Erwartete Ergebnisse
Jedes Kleidungsstück erscheint in Ihrer digitalen Garderobe als zentriertes, sauberes Foto in Studioqualität mit vollständig indexierten Suchattributen und umfangreichen Taxonomie-Tags.

## Fehlerbehebung
- **Abgeschnittene / unvollständige Kleidungsstücke auf Fotos**: Platzieren Sie das Kleidungsstück mittig vor einem kontrastierenden Hintergrund. Nano Banana kann abgeschnittene Kragen oder Säume automatisch rekonstruieren.
- **Beleuchtung & Kontrast**: Fotografieren Sie dunkle Kleidungsstücke für optimale Ergebnisse vor einem hellen, kontrastreichen Hintergrund.
- **Abweichungen bei der Rechnungs-OCR**: Nutzen Sie die interaktive Box-Auswahl auf Rechnungsbildern, um einzelne Produktzeilen manuell zuzuweisen.

## Einschränkungen
- Hochauflösende Stapel-Uploads (>5 Artikel) werden über asynchrone Hintergrund-Warteschlangen verarbeitet, um eine reaktionsschnelle Bedienung ohne Browser-Timeouts zu gewährleisten.
