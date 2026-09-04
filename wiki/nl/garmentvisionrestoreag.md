# Samenvatting van herstel en unificatie van kledingvisie

Dit document geeft een samenvatting van de belangrijkste architectonische veranderingen, bugfixes en functie-unificaties die zijn uitgevoerd om de Garment Vision-pijplijn te herstellen en te verbeteren.

## 1. Kerndoelstelling
Het primaire doel was om de oude `analyze_outfit` architectuur te herstellen (die SegFormer correct gebruikte voor context en volledige fotozichtbaarheid) en tegelijkertijd de "Gemini streaming"-ervaring terug te brengen die bestond in `analyze()`. De beperking was om de hele pijplijn te verenigen, zodat **alle** uploadworkflows (één foto, 2-5 batches, 6+ batches) één eindpunt en functie gebruiken.

## 2. Belangrijke architecturale veranderingen

### Unified Backend Streaming-eindpunt (`analyze_outfits_stream`)
- Een nieuwe generator `analyze_outfits_stream` gemaakt in `GarmentVisionService`. 
- In plaats van een enkele afbeelding te accepteren, accepteert het standaard een reeks afbeeldingen (`images_bytes_list: list[bytes]`).
- Voert objectdetectie en bijsnijden uit (`SegFormer`) op alle geüploade afbeeldingen.
- Maakt de geldige uitsneden van alle afbeeldingen plat in een enkele batchgewijze 'Gemini' API-aanroep om de doorvoer te maximaliseren en LLM-belangrijke knelpunten op het gebied van gelijktijdigheid te omzeilen.
- Zendt NDJSON-frames uit (`detect`, `item`, `item_skip`) die nu een `image_index` bevatten, waardoor de frontend de gestreamde analyse terug kan leiden naar de juiste originele foto.

### Frontend API-unificatie (`AddItem.jsx`)
- `AddItem.jsx` opnieuw ontworpen om alle inkomende foto's in een array-payload te verpakken in plaats van het uitvoeren van opeenvolgende API-aanroepen.
- **Batch 1-5:** Verwerkt door een nieuwe functie `analyzeCards(cardsList)`. Alle foto's worden in één verzoek ingediend en de gebruikersinterface wijst binnenkomende gestreamde items dynamisch toe aan hun respectievelijke voorbeeldkaarten.
- **Batches 6+:** De workflow `handleBatchBackground` hersteld om rommelige gebruikersinterface te voorkomen. Het maakt gebruik van een minimalistische voortgangsbalk op de achtergrond (`BgBatchProgress`), maar gebruikt hetzelfde uniforme streaming-eindpunt om items te verwerken en automatisch op te slaan terwijl ze worden teruggestreamd.

## 3. Kritieke bugfixes

### A. Verkeerde classificatie (ontbrekende SegFormer-context)
- **Probleem:** Gemini classificeerde items vaak verkeerd (bijvoorbeeld rokken als spijkerbroeken) omdat het alleen de geïsoleerde uitsnede zag en de context van de originele foto ontbeerde.
- **Opgelost:** We hebben de SegFormer `kind` per gewas in de batchgewijze Gemini-oproep geplaatst als een systeemprompt "GEWASSEN CATEGORIE HINTS". Dit fungeert als een anker (laag 1) om de LLM weg te leiden van misclassificaties veroorzaakt door aangrenzende kledinglekkage, waardoor de oude context effectief wordt hersteld.

### B. "White Canvas" / Streamingstatus desynchronisatie
- **Probleem:** Terugkeren naar de kast zonder op 'Opslaan' te klikken, resulteerde in een wit canvas dat de originele afbeelding verving, en de functionaliteit van de knop 'Terugzetten' verdween.
- **Opgelost:** De introductie van de `image_index` en flat slot-tracking in `analyzeCards` heeft de streamrouting gerepareerd. NDJSON-frames worden strikt toegewezen aan hun bovenliggende kaarten met behulp van robuuste UUID-generatie, waardoor desynchronisatie van de UI-status en beschadigde afbeeldingsblobs worden voorkomen.

### C. Out-of-Memory (OOM) bij meer dan 5 batchuploads
- **Probleem:** De server crashte en retourneerde `ERR_HTTP2_PROTOCOL_ERROR` bij het uploaden van 5 afbeeldingen.
- **Opgelost:** De initiële implementatie gebruikte `asyncio.gather` om SegFormer tegelijkertijd uit te voeren op alle 5 afbeeldingen met volledige resolutie, waardoor OOM de ONNX-runtime beëindigde. De initiële detectiepassage (`_detect_and_crop`) is gewijzigd om opeenvolgend uit te voeren. Hierdoor blijft het geheugen stabiel en worden er slechts ongeveer 1-2 seconden per afbeelding aan de pijplijn toegevoegd.

### D. Ontbrekende `rembg` (achtergrondverwijdering) op foto's van afzonderlijke kledingstukken
- **Probleem:** Bij het uploaden van een reeds bijgesneden foto (bijvoorbeeld een plat T-shirt) werd de achtergrondverwijdering volledig omzeild en werd een JPEG met een achtergrond geretourneerd in plaats van een transparante PNG-uitsnede.
- **Oplossing:** De kortsluitlogica voor reeds bijgesneden foto's opgelost. Wanneer `_looks_already_cropped` `True` retourneert, wijst de pijplijn nu correct de vlag `defer_matte = True` toe (of voert deze inline uit op basis van instellingen), waardoor wordt verzekerd dat de afbeelding op de juiste manier wordt gematteerd in plaats van de stap over te slaan.

## 4. Definitieve pijpleidingstructuur
1. **Frontend:** Gebruiker selecteert `N` foto's. `AddItem.jsx` extraheert `base64` voor alle `N` foto's en roept `api.analyzeItemImage({ images_base64 })` aan.
2. **Backend API:** `/closet/analyze` stuurt de array naar `analyze_outfits_stream`.
3. **Backend-detectie:** Voert SegFormer opeenvolgend uit op elke foto om de totale 'N*M'-uitsneden van het selectiekader te extraheren.
4. **Backend-analyse:** Streamt alle `N*M`-gewassen in één batch multimodaal verzoek naar Gemini. Voor uploads met één uitsnede (bijvoorbeeld één vooraf bijgesneden productfoto) gaat het snel, waarbij gebruik wordt gemaakt van gestructureerde JSON-schemageneratie in plaats van array-streaming, waardoor de latentie met ~15-20s wordt verkort.
5. **Stream Return:** Brengt frames terug naar de frontend met `image_index`, waardoor `AddItem.jsx` voorbeeldkaarten (1-5) of de voortgangsbalk op de achtergrond (6+) naadloos kan bijwerken.

### E. Streaming-unificatie (enkele versus meerdere items)
- **Probleem:** Voorheen omzeilde een snel pad voor uploads van één item (`len(flat_crops) == 1`) de streamingpijplijn ten gunste van een verouderd JSON-schema-eindpunt. Hoewel het bedoeld was om overhead te besparen, werd het streaming-UI-effect voor afzonderlijke items en camera-uploads volledig verbroken.
- **Opgelost:** Het snelle pad voor één item is verwijderd. Alle workflows (enkel item, camera-upload, outfits) lopen nu strikt via `analyze_outfits_stream` en `analyze_batch_stream`. 
- **Streaming-verduidelijking:** Voor een *enkel item* genereert de LLM slechts *één* JSON-blok. Omdat onze frontend-parser een compleet JSON-object nodig heeft om een ​​kaart weer te geven, zal het item niet progressief per veld verschijnen. Het verwachte gedrag is dat de gebruiker gedurende ongeveer 20 seconden "Scannen..." ziet (Gemini's Time-To-First-Token) en vervolgens verschijnt het item onmiddellijk. *Zichtbare progressieve streaming* (gespreid laden) vindt alleen plaats bij opnamen met meerdere items (bijvoorbeeld item 1 op 20s, item 2 op 22s).

### F. Formuliertoegankelijkheid en extensie-eigenaardigheden
- **Probleem:** De Chrome-console gaf toegankelijkheidswaarschuwingen over ontbrekende kenmerken `id` en `name`, en extensies van derden gaven algemene fouten met de melding 'berichtkanaal gesloten'.
- **Opgelost:** De componenten `AddItem.jsx` en `WeightedList.jsx` React zijn opnieuw bewerkt om unieke `idPrefix`-sleutels per kaart te genereren. Toegepaste kenmerken 'id' en 'htmlFor' op alle componenten '<Input>', '<Select>' en '<Label>', waardoor alle waarschuwingen over de toegankelijkheid van de browser werden opgelost en het correcte gedrag van automatisch aanvullen werd gegarandeerd.
- **Verduidelijking:** Bevestigd dat de consolefout 'Een luisteraar heeft een asynchrone reactie aangegeven...' uitsluitend afkomstig is van Chrome-extensies van derden en absoluut geen invloed heeft op de frontend-streamingpijplijn of de backend-latentie.

### G. UI opschonen en scrollen met toast
- **Probleem:** De knop 'Annuleren' en de floater 'Verwijderen-Selecteren' waren niet met elkaar verbonden in de gebruikersinterface. Meldingstoosts bleven bestaan, zelfs als je door grote kasten scrolde.
- **Opgelost:** De floater en de knop 'Annuleren' zijn samengevoegd tot een naadloze overlay met een vaste positie in `Closet.jsx` met behulp van `AnimatePresence`. Er is een globale scroll-listener toegevoegd aan `App.js` die automatisch actieve toastmeldingen negeert zodra de gebruiker door de pagina begint te scrollen.

### H. Backend-gelijktijdigheid bij bulkuploads met hoge resolutie (OOM)
- **Probleem:** het verwerken van een batch van 6 items (bijvoorbeeld 6 spiegelreflexfoto's) zorgde ervoor dat de backend na ~11,7 seconden crashte met een 502-fout, waardoor de containergeheugenlimiet van 6 GB werd uitgeput.
- **Opgelost:** De interne `_ANALYZE_CONCURRENCY` in `closet.py` teruggebracht van 3 naar 1. Dit beperkt het aantal gelijktijdige multimodale verzoeken voor grote items binnen een enkele uploadstream om strikt te voorkomen dat de server onvoldoende geheugen heeft.

### I. EXIF-rotatie en optimalisatie aan de klantzijde (Preflight Pipeline)
- **Probleem:** SLR-foto's met hoge resolutie konden geen dubbele detectie uitvoeren vanwege een onjuiste oriëntatie (EXIF-rotatie werd genegeerd) en werden ongecomprimeerd in canvas geladen, wat het browsergeheugen overbelastte en resulteerde in backend-OOM's.
- **Opgelost:** De frontend preflight-pijplijn in `AddItem.jsx` opnieuw bedraad. De pijplijn wordt nu kleiner en corrigeert de beeldverhouding van de afbeelding EERST door `fileToBase64` (die EXIF ​​respecteert via `createImageBitmap({ imageOrientation: 'from-image' })`) uit te voeren vóór componenten aan de clientzijde. De duplicaatdetectietools (`aHashFile`, `colorSignatureFile`, `sha256File`) draaien nu op de geoptimaliseerde (~150KB) versie, waardoor pieken in het browsergeheugen volledig worden voorkomen, de rotatiebugs worden verholpen en de backend gegarandeerd kleine, perfect bijgesneden afbeeldingen ontvangt, ongeacht het originele cameraformaat.