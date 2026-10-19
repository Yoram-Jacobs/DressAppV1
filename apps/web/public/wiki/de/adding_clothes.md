# Kleidung erfassen & hinzufügen

Digitalisiere deinen physischen Kleiderschrank in Sekunden – mit automatischem 3-Pipeline-Foto-Routing, intelligenter Hintergrundentfernung und generativer Bildvervollständigung.

## Übersicht
Erfasse Kleidung per Live-Kameraschnappschuss, Mehrfach-Upload aus der Galerie (einschließlich gemischter Stapel aus Einzelteilen, getragenen Outfits und Kleiderhaufen), QR-Codes des Digitalen Produktpasses (DPP) oder digitalen Kaufbelegen (Rechnungs-OCR). Die integrierte lokale KI erkennt automatisch die Eigenschaften jedes Fotos, entfernt Hintergründe, vergibt über 20 Mode-Attribute (inklusive Sweatshirts/Hoodies sowie über 60 traditioneller & kultureller Kleidungsstücke) und erstellt saubere Studio-Freisteller ganz ohne API-Schlüssel.

## Voraussetzungen
- Klare, gut beleuchtete Fotos von Kleidungsstücken (Einzelteile, Ganzkörper-Spiegelselfies, Schaufensterpuppen oder Flat-Lays mehrerer Kleidungsstücke).
- Kamerazugriff zum Scannen physischer Artikel und QR-Codes.
- Digitale Quittungen oder Rechnungs-Screenshots (PDF / PNG / JPEG) für Online-Einkäufe.

## Schritt-für-Schritt-Anleitung

1. **Interaktiver Upload & Gemischte Stapelverarbeitung**:
   - Tippe auf **Artikel hinzufügen** → wähle **Foto aufnehmen** oder **Fotos hochladen**, um ein oder mehrere Fotos von deinem Gerät auszuwählen. Du kannst Fotos einzelner Kleidungsstücke, komplette Outfits am Körper und Kleiderstapel frei in einem einzigen Upload mischen, ohne Modus-Tabs auswählen zu müssen!
   - Die integrierte Duplikaterkennung prüft sofort, ob du dasselbe Kleidungsstück bereits hochgeladen hast.
2. **Automatisches 3-Pipeline-Routing (`GarmentVision`)**:
   - **GarmentVision** analysiert jedes Foto automatisch und leitet es an die passende Pipeline weiter:
     - **Einzelteil (`Single`)**: Isoliert ein einzelnes Kleidungsstück mit präzisem Studio-Alpha-Matting.
     - **Mehrteiliges Outfit (`Multi-Garment`)**: Teilt Kopf-bis-Fuß-Outfits an einer Person oder Puppe in separate Karten für Oberteil, Unterteil, Jacke/Mantel, Schuhe und Accessoires auf.
     - **Kleider-Cluster (`Mass Cluster`)**: Trennt Gruppen ungetragener Kleidung (nebeneinander ausgelegt oder an Wandhaken hängend) in einzelne Kleiderschrank-Elemente.
3. **KI-Freistellung & Saubere Studiofotos**:
   - Die integrierte Vision-Pipeline entfernt Hintergründe automatisch und erzeugt gestochen scharfe, transparente PNG-Bilder für alle Konten.
4. **Automatisches Tagging für Metadaten, Hoodies & Traditionelle Kleidung**:
   - Kostenlose Konten nutzen die lokale **Eyes**-Engine von DressApp (feinabgestimmtes `Qwen 2.5 VL 3B`), während **Manager**- ($10/Monat) und **Professional**-Nutzer ($15/Monat) vom schnellen Cloud-Modell (`Google Gemini 3.5 Flash`) profitieren, um über 20 Mode-Attribute zu extrahieren – mit präziser Unterscheidung zwischen **Sweatshirts & Hoodies** und **T-Shirts** sowie Erkennung von über 60 **traditionellen & kulturellen Kleidungsstücken** (Sari, Kimono, Thobe, Kaftan, Hanbok, Cheongsam, Ao Dai, Dirndl, Kilt u. v. m.) in allen 13 Sprachen.
5. **Generative Fotoreparatur (Nano Banana)**:
   - Nano Banana prüft freigestellte Artikel auf Verdeckungen (Taschen, Hände) und Bildränder und vervollständigt fehlende Stoffpartien automatisch zu vollständigen Studiofotos – ohne externe API-Schlüssel.
6. **Digitale Belege & DPP-Tags**:
   - Wechsle zu **Digitaler Import**, um Bestellbestätigungen oder Rechnungen auszulesen und Kaufpreis sowie verifizierte Größen zu sperren.
   - Tippe auf **QR scannen (DPP)** am Etikett, um Lieferkettendaten und Pflegehinweise des EU-Digitalen Produktpasses zu importieren.
7. **Im Kleiderschrank speichern**:
   - Tippe auf **Speichern**. Die Artikel erscheinen sofort in deinem Kleiderschrank-Raster.

## Erwartete Ergebnisse
Jedes Kleidungsstück erscheint in deiner digitalen Garderobe als zentriertes, sauberes Studiofoto mit präzisen Kategorie-/Unterkategorie-Labels, kulturellen Heritage-Tags und vollständig indexierten Suchattributen.

## Fehlerbehebung
- **Abgeschnittene / Unvollständige Kleidung auf Fotos**: Zentriere das Kleidungsstück vor einem kontrastreichen Hintergrund. Nano Banana kann abgeschnittene Kragen oder Säume automatisch rekonstruieren.
- **Beleuchtung & Kontrast**: Fotografiere dunkle Kleidung für beste Ergebnisse vor einem hellen, kontrastreichen Hintergrund.
- **Beleg-OCR-Abweichungen**: Nutze die interaktive Rahmenauswahl auf Rechnungsbildern, um einzelne Produktzeilen manuell zu markieren.

## Einschränkungen
- Hochauflösende Stapel-Uploads (>5 Artikel) werden über asynchrone Hintergrund-Warteschlangen verarbeitet, um eine flüssige Bedienung ohne Browser-Timeouts zu gewährleisten.
