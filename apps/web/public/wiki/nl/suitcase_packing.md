# Koffer-inpakassistent

Pak efficiënt en zorgeloos in voor elke bestemming met AI-gestuurde weersvoorspellingen en interactieve verfijning van uw checklist.

## Overzicht
De Koffer-inpakassistent neemt alle reisstress weg door uw reisschema, de weersverwachting op uw bestemming en uw persoonlijke kledingcatalogus te analyseren om een op maat gemaakte, dag-tot-dag paklijst samen te stellen. Aangedreven door **Google Gemini 3.5 Flash-Lite** via `llm_gateway.py` genereert de assistent binnen enkele seconden complete inpakplannen en stelt u in staat items interactief via een chatgesprek te verfijnen.

## Vereisten
- Naam van de bestemmingsstad en vertrek- en terugkeerdata.
- Een actieve kledingkastinventaris met minimaal een aantal basiskledingstukken.
- Een actieve internetverbinding om weersvoorspellingen voor de bestemming op te halen.

## Stapsgewijze instructies
1. **Reis aanmaken**: Open het tabblad Suitcase, tik op **New Trip** en voer uw bestemmingsstad, begin- en einddatum en het reisdoel in (bijv. *Zakelijk*, *Strandvakantie*, *Stedentrip*).
2. **Inpakplan genereren**: Tik op **Generate Checklist**. De AI haalt de voorspelde temperaturen en weersomstandigheden op voor uw bestemming, vergelijkt deze met uw kledingkast en stelt een gebalanceerde paklijst op.
3. **Dagelijkse outfits bekijken**: Bekijk de voorgestelde dagelijkse combinaties en zorg voor geschikte laagjes voor frisse ochtenden en warme middagen.
4. **Verfijnen via chat**: Extra opties nodig? Chat rechtstreeks met de inpakassistent (bijv. *„Voeg comfortabele wandelsneakers toe“* of *„Neem een cocktailjurk op voor het diner“*). De checklist wordt direct dynamisch bijgewerkt.
5. **Items als ingepakt markeren**: Gebruik de interactieve selectievakjes terwijl u uw bagage inpakt om bij te houden wat al is ingepakt.
6. **Opslaan voor offlinereizen**: Sla het voltooide reisplan op voor snelle, directe toegang op uw apparaat, zelfs wanneer u onderweg offline bent.

## Verwachte resultaten
Een complete, aan het weer aangepaste inpakchecklist voor uw bagage, geordend per kledingcategorie (bovenkleding, broeken/rokken, jassen, schoenen, essentials) zonder dubbele of onnodige kledingstukken.

## Probleemoplossing
- **Weersvoorspelling niet beschikbaar**: Controleer de spelling van de bestemmingsstad; probeer voor afgelegen locaties de dichtstbijzijnde grote stad op te geven.
- **Checklist toont weinig items**: Zorg ervoor dat u voldoende kledingstukken heeft geüpload die passen bij het seizoen en de verwachte temperaturen op uw bestemming.
- **Aanpassingen worden niet opgeslagen**: Controleer of uw internetverbinding actief is wanneer u aangepaste chatnotities toevoegt.

## Beperkingen
- Geautomatiseerde weersvoorspellingen zijn beschikbaar voor reizen die tot 14 dagen van tevoren zijn gepland; voor reizen verder in de toekomst worden historische seizoensgemiddelden gebruikt.