# Kleding Invoeren & Toevoegen

Digitaliseer uw fysieke garderobe in enkele seconden met multimodale AI-scanning, slimme achtergrondverwijdering en automatische beeldreconstructie.

## Overzicht
Voeg kleding toe via live camerafoto's, galerij-uploads van meerdere foto's, QR-labels van het Digitaal Productpaspoort (DPP) of digitale aankoopbewijzen (factuur-OCR). De ingebouwde on-premises AI verwijdert automatisch achtergronden, labelt meer dan 20 modekenmerken en maakt strakke studio-uitsneden zonder dat er API-sleutels nodig zijn.

## Vereisten
- Duidelijke, goed verlichte foto's van kledingstukken (spiegelselfies, volledige outfitfoto's of flat-lays).
- Cameratoegang voor het scannen van fysieke kledingstukken en QR-codes.
- Digitale kassabonnen of screenshots van facturen (PDF / PNG / JPEG) voor online aankopen.

## Stapsgewijze Instructies

1. **Interactieve Upload & Opname**:
   - Tik op **Item toevoegen (Add Item)** &rarr; selecteer **Foto maken (Take Photo)** of upload een of meer outfitfoto's vanaf uw apparaat.
   - De ingebouwde duplicaatdetectie controleert direct of u hetzelfde kledingstuk al eerder hebt geüpload.
2. **AI-segmentatie & Detectie van Meerdere Items**:
   - Het vision-model isoleert verschillende kledingstukken (jassen, bovenstukken, rokken, broeken, schoenen, accessoires) in één enkele doorgang.
3. **AI-matting & Strakke Studiofoto's**:
   - De ingebouwde vision-pipeline verwijdert automatisch achtergronden en levert haarscherpe, transparante PNG-afbeeldingen voor alle accounts.
4. **Automatische Metadata-tagging**:
   - Gratis accounts (Free Tier) maken gebruik van de on-premises **Eyes**-engine van DressApp (momenteel een gefinetuned `Qwen 2.5 VL 3B`-model), terwijl abonnees met een **Manager**- of **Professional**-abonnement profiteren van het snelle Cloud-model (`Google Gemini 3.5 Flash`) om meer dan 20 modekenmerken te extraheren (kleuren, stofsamenstelling, subcategorie, kledingvoorschrift, merk en staat).
5. **Geavanceerde Generatieve Fotoreparatie (Nano Banana)**:
   - Nano Banana inspecteert bijgesneden items op bedekkingen (tassen, handen) en kaderranden, en reconstrueert ontbrekende stof automatisch via outpainting tot volledige studiofoto's zonder dat er externe API-sleutels nodig zijn.
6. **Digitale Aankoopbewijzen & DPP-tags**:
   - Schakel over naar **Digitale Import (Digital Import)** om orderbevestigingsmails of facturen te analyseren en de aankoopprijs en geverifieerde maten vast te leggen.
   - Tik op **Scan QR (DPP)** op het kledinglabel om ketengegevens van het EU Digitaal Productpaspoort en onderhoudsinstructies te importeren.
7. **Opslaan in Kledingkast**:
   - Tik op **Opslaan (Save)**. Items verschijnen onmiddellijk in uw Kledingkast-overzicht.

## Verwachte Resultaten
Elk kledingstuk verschijnt in uw digitale garderobe als een gecentreerde, strakke foto van studiokwaliteit met volledig geïndexeerde zoekkenmerken en uitgebreide taxonomietags.

## Probleemoplossing
- **Afgesneden / Gedeeltelijke Kledingstukken op Foto's**: Centreer het kledingstuk netjes tegen een contrasterende achtergrond. Nano Banana kan afgesneden kragen of zomen automatisch reconstrueren.
- **Belichting & Contrast**: Fotografeer donkere kledingstukken voor het beste resultaat tegen een lichte, contrasterende achtergrond.
- **Afwijkingen bij Factuur-OCR**: Gebruik de interactieve vakselectie op factuurafbeeldingen om afzonderlijke productregels handmatig aan te wijzen.

## Beperkingen
- Batch-uploads met hoge resolutie (>5 items) worden verwerkt via asynchrone achtergrondwachtrijen om snelle prestaties zonder browser-time-outs te garanderen.
