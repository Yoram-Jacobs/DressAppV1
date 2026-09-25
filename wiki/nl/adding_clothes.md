# Kleding toevoegen & digitaliseren

Digitaliseer uw fysieke kledingkast in enkele seconden met multimodale AI-scans, slimme achtergrondverwijdering en automatische beeldvoltooiing.

## Overzicht
Voeg kledingstukken toe via live camerafoto's, meervoudige uploads vanuit uw galerij, Digital Product Passport (DPP) QR-tags of digitale aankoopbewijzen (factuur-OCR). De ingebouwde on-premises AI verwijdert achtergronden automatisch, labelt meer dan 20 modekenmerken en bereidt schone studio-uitsneden voor zonder dat u een API-sleutel nodig heeft.

## Vereisten
- Duidelijke, goed belichte foto's van kledingstukken (spiegelselfies, full-body foto's of flat lays).
- Cameratoegang voor het scannen van items en QR-codes.
- Digitale bonnen of factuurscreenshots (PDF / PNG / JPEG) van e-commerce aankopen.
- *(Optioneel)* Een persoonlijke Google Gemini API-sleutel als u gebruik wilt maken van Nano Banana's generatieve fotoreconstructie.

## Stapsgewijze instructies

1. **Interactief uploaden & vastleggen**:
   - Tik op **Item toevoegen** &rarr; kies **Foto maken** of upload één of meerdere foto's vanaf uw apparaat.
   - De ingebouwde duplicaatdetectie controleert direct of u hetzelfde kledingstuk al eerder heeft toegevoegd.
2. **AI-segmentatie & Meervoudige detectie**:
   - Het visuele model isoleert afzonderlijke kledingstukken (jassen, tops, rokken, broeken, schoenen, accessoires) in één enkele scan.
3. **AI-uitsnijding & Schone studiofoto's**:
   - De ingebouwde beeldverwerking wist automatisch achtergronden en levert scherpe, transparante PNG-afbeeldingen voor alle accounts.
4. **Automatische kenmerk-tagging**:
   - De lokale AI herkent meer dan 20 modeparameters (kleuren, stofsamenstelling, subcategorie, dresscode, merk en conditie).
5. **Geavanceerde generatieve fotoreparatie (Nano Banana)**:
   - Voor gebruikers met een eigen Google Gemini API-sleutel analyseert Nano Banana afgesneden of overlappende delen (tassen, handen) en vult ontbrekende kleding automatisch aan tot een complete studiofoto.
6. **Digitale aankoopbewijzen & DPP-tags**:
   - Schakel over naar **Digitale import** om facturen te verwerken en aankoopprijzen en maten vast te leggen.
   - Tik op **Scan QR (DPP)** op het waslabel om gegevens over toeleveringsketens en wasvoorschriften van het Europees Digitaal Productpaspoort in te laden.
7. **Opslaan in uw kledingkast**:
   - Tik op **Opslaan**. Uw kledingstukken verschijnen direct in uw kledingkastoverzicht.

## Verwachte resultaten
Elk kledingstuk wordt opgeslagen als een gecentreerde, professionele studiofoto met volledige zoekkenmerken en rijke categorietags.

## Probleemoplossing
- **Afgesneden kleding op de foto**: Plaats het kledingstuk gecentreerd tegen een contrasterende achtergrond. Met een ingestelde API-sleutel kan Nano Banana ontbrekende kragen of zomen automatisch reconstrueren.
- **Belichting & Contrast**: Zorg bij donkere kledingstukken voor een lichte, contrasterende achtergrond.
- **Onjuiste factuurherkenning**: Gebruik de interactieve kaderselectie op de factuurafbeelding om handmatig de juiste productregels aan te wijzen.

## Beperkingen
- Grote batch-uploads (>5 items) worden verwerkt via een asynchrone achtergrondwachtrij om vertragingen in uw browser te voorkomen.
- Voor de fotorealistische fotoreparatie met Nano Banana is een persoonlijke Google Gemini API-sleutel vereist.
