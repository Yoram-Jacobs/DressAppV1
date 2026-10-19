# Kleding Scannen & Toevoegen

Digitaliseer je fysieke garderobe in enkele seconden met automatische 3-pijplijn fotoroutering, slimme achtergrondverwijdering en generatieve beeldvervollediging.

## Overzicht
Voeg kleding toe via live camerafoto's, galerij-uploads met meerdere afbeeldingen (inclusief gemengde batches van losse items, gedragen outfits en stapels kleding), QR-codes van Digitale Productpaspoorten (DPP) of digitale kassabonnen (factuur-OCR). De ingebouwde lokale AI herkent automatisch de kenmerken van elke foto, verwijdert achtergronden, voorziet items van meer dan 20 mode-attributen (waaronder sweatshirts/hoodies en 60+ traditionele & culturele kledingstukken) en maakt strakke studio-uitsneden zonder dat er API-sleutels nodig zijn.

## Vereisten
- Duidelijke, goed verlichte foto's van kledingstukken (losse items, full-body spiegelselfies, paspoppen of flat-lays van meerdere kledingstukken).
- Cameratoegang voor het scannen van fysieke items en QR-codes.
- Digitale bonnen of factuur-screenshots (PDF / PNG / JPEG) voor online aankopen.

## Stapsgewijze Instructies

1. **Interactieve Upload & Gemengde Batch-Opname**:
   - Tik op **Item toevoegen** → kies **Foto maken** of **Foto's uploaden** om een of meer foto's van je apparaat te selecteren. Je kunt foto's van losse items, volledige outfits op een persoon en stapels/groepen kleding vrij combineren in dezelfde batch zonder modustabbladen te kiezen!
   - De ingebouwde duplicaatdetectie controleert direct of je hetzelfde kledingstuk al eerder hebt geüpload.
2. **Automatische 3-Pijplijn Fotoroutering (`GarmentVision`)**:
   - **GarmentVision** inspecteert automatisch elke foto en stuurt deze naar de juiste pijplijn:
     - **Enkel Kledingstuk (`Single`)**: Isoleert één kledingstuk met studio-alfa-uitsnijding.
     - **Multi-Item Outfit (`Multi-Garment`)**: Splitst volledige outfits op een model of paspop op in afzonderlijke kaarten voor bovenkleding, onderkleding, jassen, schoenen en accessoires.
     - **Massa-Cluster (`Mass Cluster`)**: Scheidt groepen ongedragen kleding die naast elkaar liggen of aan haken hangen in individuele kledingkast-items.
3. **AI-Uitsnijding & Strakke Studiofoto's**:
   - De ingebouwde visiepijplijn verwijdert automatisch achtergronden en levert scherpe, transparante PNG-afbeeldingen voor alle accounts.
4. **Automatische Metadata-, Hoodie- & Culturele Kleding-Tagging**:
   - Gratis accounts gebruiken de lokale **Eyes**-engine van DressApp (fijn-afgestemde `Qwen 2.5 VL 3B`), terwijl **Manager** ($10/mnd) en **Professional** ($15/mnd) abonnees profiteren van het snelle Cloud-model (`Google Gemini 3.5 Flash`) om 20+ mode-attributen te extraheren — met nauwkeurig onderscheid tussen **Sweatshirts & Hoodies** en **T-shirts** en herkenning van 60+ **traditionele & culturele kledingstukken** (Sari, Kimono, Thobe, Kaftan, Hanbok, Cheongsam, Ao Dai, Dirndl, Kilt en meer) in alle 13 talen.
5. **Geavanceerd Generatief Fotoherstel (Nano Banana)**:
   - Nano Banana controleert uitgesneden items op bedekkingen (tassen, handen) en afgesneden randen, en vult ontbrekende stof automatisch aan tot complete studiofoto's zonder externe API-sleutels.
6. **Digitale Bonnen & DPP-Tags**:
   - Schakel over naar **Digitale import** om orderbevestigingen of facturen uit te lezen, waarbij de aankoopprijs en geverifieerde maten worden vergrendeld.
   - Tik op **Scan QR (DPP)** op het label om gegevens over de toeleveringsketen en wasvoorschriften van het EU Digitaal Productpaspoort te importeren.
7. **Opslaan in Kledingkast**:
   - Tik op **Opslaan**. Items verschijnen direct in je kledingkast-overzicht.

## Verwachte Resultaten
Elk kledingstuk verschijnt in je digitale garderobe als een gecentreerde, strakke studiofoto met nauwkeurige categorie-/subcategorielabels, culturele erfgoed-tags en volledig geïndexeerde zoekattributen.

## Probleemoplossing
- **Afgesneden / Gedeeltelijke Kleding op Foto's**: Centreer het kledingstuk tegen een contrasterende achtergrond. Nano Banana kan afgesneden kragen of zomen automatisch reconstrueren.
- **Belichting & Contrast**: Fotografeer donkere kleding voor het beste resultaat tegen een lichte, contrasterende achtergrond.
- **OCR-Afwijkingen bij Bonnen**: Gebruik de interactieve vakselectie op bonafbeeldingen om individuele productregels handmatig aan te wijzen.

## Beperkingen
- Batch-uploads met hoge resolutie (>5 items) worden verwerkt via asynchrone achtergrondwachtrijen om snelle prestaties zonder browser-time-outs te garanderen.
