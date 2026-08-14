# Kleding Digitaliseren en Toevoegen

Digitaliseer uw fysieke garderobe in enkele seconden met behulp van multimodale AI-scanning, slimme achtergrondverwijdering en automatische beeldreconstructie.

## Overzicht
Voeg kleding toe via live camera-opnames, meervoudige galerij-uploads, Digital Product Passport (DPP) QR-tags of digitale bonnen (factuur-OCR). De ingebouwde AI verwijdert automatisch achtergronden, tagt modekenmerken, beoordeelt de volledigheid van de uitsnede en reconstrueert bedekte of afgesneden kledingstukken.

## Vereisten
- Duidelijke, goed verlichte foto's van kledingstukken (spiegelselfies, foto's ten voeten uit of flat-lays).
- Cameratoegang voor het scannen van fysieke items en QR-codes.
- Digitale bonnen of factuurscreenshots (PDF / PNG / JPEG) voor online aankopen.

## Stap voor Stap

1. **Interactieve Upload & Opname**:
   - Tik op **Item Toevoegen** &rarr; kies **Foto Maken** of upload een of meerdere outfitfoto's vanaf uw apparaat.
   - De ingebouwde duplicaatdetectie controleert direct of u hetzelfde kledingstuk al eerder hebt geüpload.
2. **AI-segmentatie & Detectie van Meerdere Items**:
   - Het beeldmodel isoleert afzonderlijke kledingstukken (jassen, tops, rokken, broeken, schoenen, accessoires) in één enkele scan.
3. **AI-kwaliteitscontroleur & Automatisch Beeldherstel**:
   - Gemini's visuele kwaliteitscontroleur inspecteert elk uitgesneden item:
     - **Compleet**: Intacte, onbelemmerde kledingstukken worden direct vrijgemaakt.
     - **Beeldaanvulling**: Als een item ontbrekende zijcontouren, bedekkingen (door tassen/armen) of afgesneden zomen/kragen heeft, voert de AI automatisch outpainting uit en vult de ontbrekende stof aan.
     - **Volledige Studio-reconstructie**: Zwaar afgesneden items (zoals schoenen waarvan alleen de neus zichtbaar is) worden volledig opnieuw gegenereerd tot studiowaardige catalogusfoto's.
4. **Automatische Metadata-tagging**:
   - De AI extraheert meer dan 20 modekenmerken (kleuren, stofsamenstelling, subcategorie, dresscode, merk en staat).
5. **Digitale Bonnen & DPP-tags**:
   - Schakel over naar het tabblad **Digitale Import** om orderbevestigingsmails of facturen te analyseren en aankoopprijzen en geverifieerde maten vast te leggen.
   - Tik op **Scan QR (DPP)** op het label om toeleveringsketengegevens en onderhoudsinstructies van het Europees Digitaal Productpaspoort te importeren.
6. **Opslaan in Kledingkast**:
   - Tik op **Opslaan**. Kledingstukken verschijnen direct in uw kledingkast-grid, terwijl generatieve beeldaanvullingen naadloos op de achtergrond worden afgerond.

## Verwachte Resultaten
Elk kledingstuk verschijnt in uw digitale garderobe als een gecentreerde, schone foto van studiokwaliteit met volledig geïndexeerde zoekkenmerken en uitgebreide taxonomietags.

## Probleemoplossing
- **Afgesneden / Onvolledige Kledingstukken**: De AI detecteert afgesneden randen automatisch en reconstrueert ze; u kunt ook op **Foto Repareren** tikken op de detailkaart van een item om handmatig een studio-hergeneratie te starten.
- **Verlichting & Contrast**: Fotografeer donkere kledingstukken tegen een contrasterende lichte achtergrond voor het beste resultaat.
- **Fouten in Bon-OCR**: Gebruik het interactieve selectiekader op de factuurafbeelding om handmatig individuele productregels aan te wijzen.

## Beperkingen
- Batch-uploads in hoge resolutie (>5 items) worden verwerkt via asynchrone achtergrondwachtrijen om responsieve prestaties zonder browser-time-outs te garanderen.