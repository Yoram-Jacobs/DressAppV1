# GarmentVision — De DressApp Eyes-pijplijn

> **Module:** `backend/app/services/vision/`  
> **Status:** Productie (live bij preview + `dressapp-eyes` self-host).  
> **Rol van de eigenaar:** Verandert een enkele foto van een persoon (of een flat-lay) in N schone, individueel getagde kastitems. Alles stroomafwaarts – het kastenrooster, de stylist, de vermeldingen op de markt – gaat ervan uit dat GarmentVision zijn werk heeft gedaan.

---

## 1. Samenvatting en waardevoorstel

### Overzicht op hoog niveau
GarmentVision is het optische zenuwstelsel van DressApp. Het is een sterk geoptimaliseerde, uit meerdere fasen bestaande pijplijn die is ontworpen om elke door een gebruiker geüploade afbeelding (van een spiegelselfie tot een professionele catalogus platgelegd) te nemen en perfect gesegmenteerde, intelligent getagde kledingitems te extraheren. Onlangs opnieuw vormgegeven in de robuuste 'vision'-microarchitectuur, verankert het zijn intelligentie in een hybride aanpak: snelle, deterministische objectdetectie via SegFormer gecombineerd met de diepgaande, multimodale redenering van Gemini 2.5 Flash.

### Architecturale stroom

```Zeemeermin
grafiek TD
    A[Gebruiker uploadt foto] --> B[Detectie: kleding_parser.py]
    B -->|Maskers en BBoxen| C[Filter voor nuttige detectie]
    C -->|BBox JPEG's| D[Matting: u2netp Rembg]
    D -->|Alfa-uitsparingen| E[LLM-analyse: Gemini 2.5 Flash]
    E -->|JSON-metagegevens| F[Canvasnormalisatie: fit_crop_to_card]
    F --> G[Frontend-client: NDJSON-stream]
```

### Waardepropositie voor gebruikers
- **Frictionless Onboarding:** Een gebruiker kan één volledige outfitfoto uploaden en zijn digitale kast onmiddellijk vullen met meerdere afzonderlijke items.
- **Vlekkeloze visuele presentatie:** Elk uitgenomen kledingstuk wordt zorgvuldig gecentreerd en geschaald op een transparant 3:4 portretcanvas, waardoor de visuele voorkeuren behouden blijven zonder agressief bijsnijden of zoomen. 
- **Intelligente taxonomie:** Items worden zorgvuldig gecategoriseerd. Recente updates geven voorrang aan de van de LLM afgeleide ‘sub_category’ boven generieke labels, waardoor wordt gegarandeerd dat een sneaker precies als sneaker wordt gelabeld en niet verkeerd wordt geïnterpreteerd als een generiek accessoire of tas.
- **Naadloze frontend-ervaring:** Geëxtraheerde items vullen onmiddellijk het kastraster van de gebruiker via luie databasesynchronisatie, waardoor laadspinners worden geëlimineerd en de vloeibaarheid van de UX behouden blijft.

---

## 2. Uitgebreide gebruikershandleiding

### Visuele interfacetopologie
```tekst
[GarmentVision UI-stroom]
┌──────────────────────────── ────────────────────────────┐
│ [Camera / Galerij uploaden] │
│ │ │
│ ▼ │
│ [ Artikelverwerking Skeletladers ] │
│ (Toont directe tijdelijke aanduidingen tijdens het streamen) │
│ │ │
│ ▼ │
│ [ Kastraster gevuld met nieuwe kledingkaarten ] │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ [PNG bijsnijden] │ │ [PNG bijsnijden] │ │ [PNG bijsnijden] │ │
│ │ Sneakers │ │ T-shirt │ │ Spijkerjeans │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
└──────────────────────────── ────────────────────────────┘
```

### Workflow-overzichten
- **Eén foto uploaden:** De gebruiker selecteert een foto. De afbeelding wordt doorgegeven aan de backend, waarbij onmiddellijke blokkering van databaseschrijfbewerkingen wordt omzeild. De frontend slaat de geretourneerde uitgesneden afbeelding lokaal op via `closetStore`, waardoor onmiddellijke visuele feedback wordt gegeven, terwijl de achtergrond de rijke metadata en AWS S3-blobs synchroniseert.
- **Taxonomievalidatie:** Als de gebruiker een item beoordeelt en probeert dit te groeperen met items uit conflicterende categorieën (bijvoorbeeld door een 'Top' samen te voegen met een 'Schoeisel'), onderschept het Gatekeeper-dialoogvenster de actie, waardoor een sierlijke waarschuwing wordt gegeven en taxonomiecorruptie wordt voorkomen.

### Foutafhandeling en feedback
- **Phantom Guards:** Als een geëxtraheerd masker minder dan 5% effen alfapixels bevat, laat GarmentVision stilletjes de spookdetectie vallen om te voorkomen dat lege witte kaarten in de kast terechtkomen.
- **LLM-taxonomiehandhaving:** Als het visietaalmodel een onmogelijke categorie hallucineert (bijvoorbeeld door de staart van een jas te bestempelen als een 'Onderkant'), heft het systeem de hallucinatie krachtig op met behulp van het deterministische SegFormer-anker, waardoor de integriteit van de taxonomie wordt gegarandeerd.

---

## 3. Technologiestapel en mogelijkheden Deep-Dive

### Kernorkestratie en AI/logica
De pijplijn omvat meerdere nauwkeurig ontworpen lagen binnen `backend/app/services/vision/`:
- **Deterministische detectie (`clothing_parser.py` & `geometry.py`):** Gebruikt SegFormer (`b3_clothes`) om maximaal 18 verschillende modeklassen te identificeren. Het past complexe heuristieken toe, zoals het aftrekken van de menselijke huid (het maskeren van gezichten en ledematen) en morfologische overbrugging (het opnieuw verbinden van losgemaakte tasriemen).
- **Intelligente normalisatie (`image.py`):** De functie `_fit_crop_to_card` is de bewaker van de visuele esthetiek. Het schaalt de geëxtraheerde uitsnede dynamisch zodat deze binnen een canvas van 900 x 1200 past. Recente updates introduceerden een veiligheidsmarge van 0,90, waardoor het item ademruimte heeft en **nooit** wordt geknipt of uitgerekt, waardoor de exacte visuele integriteit van het kledingstuk van de gebruiker behouden blijft.
- **Multimodaal redeneren (`llm.py` & `validation.py`):** Voegt de resulterende gewassen samen en voert ze in Gemini 2.5 Flash in. De prompt-engineering geeft grote prioriteit aan de extractie van 'sub_categorie', waardoor nauwkeurige, gedetailleerde tagging wordt gegarandeerd (bijvoorbeeld 'T-shirt met ronde hals' in plaats van alleen 'Top').

### Gegevens- en contextpijplijnen
- **Streaming NDJSON:** Om Kubernetes-time-outs voor ingress te omzeilen en een ultra-responsieve gebruikersinterface te bieden, maakt de pijplijn gebruik van asynchrone generatoren, die geanalyseerde chunks naar de frontend streamen zodra de LLM deze uitzendt.
- **Lazy Database Sync:** Door extreme frontend-snappiness te benadrukken, onderschept de client de verwerkte itemafbeeldingen en schrijft ze onmiddellijk naar lokale opslag (`closetStore.js`). De zware S3-uploads en MongoDB-inserts gebeuren achter de schermen, waardoor de waargenomen latentie effectief tot nul wordt teruggebracht.

### Frontend- en clientarchitectuur
- **State Optimisme:** De frontend behoudt actief de originele, prachtig uitgesneden afbeeldingen die zijn geretourneerd door het `/analyze` eindpunt, waarbij eventuele verouderde cachereacties worden genegeerd die de kaart tijdelijk kunnen terugzetten naar de niet-bijgesneden originele foto tijdens de luie synchronisatiefase.
- **Dynamische labeling:** Productkaarten koppelen hun visuele titels strikt aan de LLM-afgeleide `sub_category`, waardoor eerdere randgevallen waarbij de brede omsluitende vakken van SegFormer verkeerd labelden (bijvoorbeeld het labelen van gelaagde outfits als tassen) direct werden opgelost.