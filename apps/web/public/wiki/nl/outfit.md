# Opgeslagen outfits en visuele componistarchitectuur

Dit document biedt een diepgaande architectonische analyse en gebruikershandleiding voor de opgeslagen outfits, stylistenvoorstellen, avatarcanvasweergave en subsystemen voor het voltooien van outfits binnen DressApp.

---

## 1. Samenvatting en waardevoorstel

### Overzicht op hoog niveau
De DressApp **Outfit Ecosystem** is een high-fidelity stylingframework dat individuele kledingstukken vertaalt in gecoördineerde looks van top tot teen. Door visuele canvasrepresentaties, semantische CLIP-gelijkenismatching, geautomatiseerde AI-voorstellen (planner/gebeurtenisgestuurd) en eindpunten voor sociaal delen te combineren, biedt het subsysteem een ​​wrijvingsloze reis van kledinginname tot outfitcoördinatie.

### Architecturale stroom

```Zeemeermin
grafiek TD
    %% Belangrijkste klantingangspunten
    Gebruiker([Gebruiker]) -->|Tikken op Stylist / Kast| Klant[Reageer klant]
    
    %% Outfits opslaan/bijwerken
    Klant -->|POST /outfits| SaveRoute[outfits.py POST-route]
    Route opslaan -->|1. Kledingstukdetails oplossen| Oplossen [Resolutie kastitemdetail]
    Route opslaan -->|2. Verhoog het aantal slijtage / last_worn_at| StatsDB[(MongoDB: closet_items)]
    Route opslaan -->|3. Details blijven bekijken| OutfitDB[(MongoDB: outfits)]
    
    %% Outfit-voltooiingsblad (FashionCLIP-matching)
    Klant -->|1. Selecteer ankeritem| AnchorSelect[OutfitCompletionSheet]
    AnkerSelecteer -->|2. Herschikking/prioriteit bestellen| Prioriteit [Orderbewuste zwaartepuntweging]
    AnkerSelecteer -->|3. POST /api/v1/stylist/complete-outfit| Volledige API[outfit_composer.py]
    CompleteAPI -->|Kastvectoren ophalen| VectorStore[FashionCLIP-inbedding]
    CompleteAPI -->|Als er gaten blijven bestaan| MarktZoeken[marketplace_search.py]
    CompleteAPI -->|Als pro match past| ProMatch[professional_matcher.py]
    CompleteAPI -->|Weercontrole| Weer[weather_service.py]
    
    %% Outfitcanvasweergave
    Klant -->|Geeft look| Canvas[OutfitCanvas.jsx / OutfitAvatarViewer.jsx]
    Canvas -->|Top-tot-teen positionering| Avatar[AvatarViewer2D.jsx]
    Avatar -->|Bovenkleding + Topcadeau| DualCanvas [Adaptieve dubbele bovenkledingindeling]
    Avatar -->|Geen bovenkleding| SingleCanvas[Adaptieve enkele lay-out]
    
    %% Deel Outfit-workflow
    Klant -->|Genereer Base64 PNG| ShareBtn[ShareOutfitButton.jsx]
    ShareBtn -->|POST /share-card| ShareRoute[outfits.py POST deelkaart]
    ShareRoute -->|Base64 opslaan| ShareDB[(MongoDB: gedeelde_outfits)]
    ShareBtn -->|Native gebruikersinterface activeren| NativeShare[navigator.share / Klembordkopie]
```

### Waardepropositie voor gebruikers
* **Adaptive Visual Modeling**: Wordt automatisch opgesplitst in twee doeken om bovenkleding en onderliggende tops tegelijkertijd te laten zien, waardoor verborgen lagen worden voorkomen.
* **Semantische ankercoördinatie**: Met outfitvoltooiing kunnen gebruikers ankerkledingstukken kiezen en deze een prioriteit geven om de garderobe te doorzoeken op bijpassende, contextbewuste toevoegingen.
* **Wrijvingsloze splitsen van sets**: Breekt gegroepeerde sets (bijvoorbeeld bijpassende pakken of sets uit twee delen) onmiddellijk terug in individuele itemankers voor een aangepaste styling.
* **Wear Tracking & Analytics**: door een outfit op te slaan, wordt automatisch het slijtageaantal van artikelen verhoogd en worden 'last_worn_at'-datums ingesteld voor slimmere garderoberotatiestatistieken.
* **Contextuele compatibiliteitsbeoordelingen**: berekent het weer, de locatie (bescheidenheidsrichtlijnen), patroonharmonie, gebeurtenisstijl, lichaamspasvorm en kleurcompatibiliteit.

---

## 2. Uitgebreide gebruikershandleiding

### Visuele interfacetopologie

#### 1. Het outfitcanvas (compact versus volledige lay-out)
De `OutfitCanvas` beheert zowel inline preview-samenvattingen als uitgebreide detailmodules:

```
COMPACT (in-chatfeedkaart)
+-----------------------------------------------------------+
|  [Top miniatuur] [Onderste miniatuur] [Schoenen] ... [Volledige weergave bekijken] |
+-----------------------------------------------------------+

VOLLEDIG WEERGAVE (gedetailleerde analysemodaal)
+-----------------------------------------------------------+
| [Naam / Dynamische titel] [Titelpictogram bewerken] (Delen) (Sluiten) |
| [Beschrijving / Redenen] |
+------------------+-----------------------------------------+
| ADAPTIEVE AVATAR | METRISCH & KLEDINGPANEEL |
|                    | +--------------------------------------+ |
| +----------------+ | | Tabblad: Stukken | Tabblad: Statistieken | |
| |  Met Bovenkleding| | +--------------------------------------+ |
| |  [Hoofddeksels] | | Algemeen matchingcijfer: [ 89% ] | |
| |  [Jas] | |                                            | |
| |  [Bottoms] | | Compatibiliteitsvoortgangsbalken: | |
| |  [Schoenen] | | - Kleurharmonie [=================] 92% | |
| +----------------+ | | - Bescheidenheid Locatie [=============== ] 80% | |
| | Geen bovenkleding | | - Weerpak [=========== ] 55% | |
| |  [Top/Jurk] | | - Evenement geschikt [=================] 90% | |
| |  [Bottoms] | | - Lichaamsaanpassing [================ ] 85% | |
| +----------------+ | | - Patroonovereenkomst [=================] 95% | |
+------------------+-----------------------------------------+
```

#### 2. Outfit-voltooiingsblad
Het outfit-aanvullingspaneel schuift omhoog vanaf de onderkant/rechts en ligt over het kastscherm:

```
+-----------------------------------------------------------+
|  (Sprankelt) Maak je look compleet (X) |
+-----------------------------------------------------------+
| GESELECTEERDE ANKERS (Sleep de knoppen omhoog/omlaag om de prioriteit te wijzigen) |
| +------------+ +-------------+ +------------+ |
| |  [1] Artikel |   |  [2] Artikel |   |  [3] ItemSet |              |
| | (Omhoog) (Omlaag) |   | (Omhoog) (Omlaag) |   | [Verdeel set]|              |
| |    [X] |   |    [X] |   |    [X] |              |
| +------------+ +-------------+ +------------+ |
|                                                                   |
| [X] Marktplaatsovereenkomsten opnemen |
| [ Gelegenheid/evenementprompt (bijv. bruiloft, zakelijk casual) ] |
| [ AANBEVELINGEN GENEREREN ] |
|                                                                   |
| AANBEVELINGEN RESULTATEN |
| (Weerbewuste badge: bewolkt, 18°C) |
| +-------------------------------------------------------+ |
| | Stylist Rationale: "Een op maat gemaakte look met lichte texturen..." | |
| | (Spreek audioknop) | |
| +-------------------------------------------------------+ |
|                                                                   |
| UIT UW KAST VAN DE MARKT |
| +------------+ +-------------+ +------------+ |
| | Artikel [90%] |  | Artikel [84%] |     | Lijst [88%|              |
| +------------+ +-------------+ +------------+ |
+-----------------------------------------------------------+
```

### Modus- en workflow-walkthroughs

#### 1. Looks bouwen en aanpassen
* **Ankerprioriteit**: sleep of tik op de knoppen **Pijl omhoog** / **Pijl omlaag** op ankers. Tijdens vectormatching krijgt het eerste anker het hoogste gewicht toegewezen.
* **Sets verdelen**: als een gegroepeerde kledingset is geselecteerd, wordt op het blad een knop **Set verdelen** weergegeven. Als u erop tikt, wordt de setkaart vervangen met de samenstellende kledingstukken als individueel bewerkbare ankers.
* **Spraak-naar-tekst en TTS-redenen**:
  * Gebruikers kunnen hun stijlbeperkingen typen of uitspreken in de gelegenheidsinvoer.
  * Als u op het **volumeluidsprekerpictogram** tikt, wordt de gegenereerde redenering van de stylist hardop voorgelezen met behulp van het TTS-systeem van de browser.

#### 2. Compatibiliteitsstatistieken lezen (tabblad Metrieken)
* Het tabblad **Metrische gegevens** vertaalt 6 scores in dynamische, kleurgecodeerde voortgangsbalken:
  * **Groen (>= 80%)**: Uitstekende compatibiliteit.
  * **Amber (50% - 79%)**: acceptabele compatibiliteit.
  * **Roos (< 50%)**: Potentiële mismatch.
* **Overeenkomen met locatie**: Controleert op bescheidenheidsregels of specifieke culturele beperkingen (zoals overheidslocaties, tempels of militaire bases).

---

## 3. Technologiestapel en mogelijkheden Deep-Dive

### Servicelogica (`outfit_composer.py`)
1. **Parallelle Vision-analyse**: uploads worden gelijktijdig uitgevoerd via `garment_vision_service` (begrensd door een semafoor van 3 om RAM-pieken te beperken).
2. **Twin Deduplication**: Voert kenmerkende hashing uit, gevolgd door een perceptuele fallback om te voorkomen dat identieke of bijna identieke kledingstukken de aanbevelingen onoverzichtelijk maken.
3. **LLM-scoretoewijzing**: Prompts evalueren de compatibiliteit van matching (briefing, kleurenpalet, formaliteit, seizoen, locatie en pasvorm).
4. **Opvullen van gaten in de kast en op de markt**: Scant naar vrije plaatsen (bijvoorbeeld ontbrekende schoenen of bovenkleding) en vult automatisch gaten in de kast in of vraagt ​​actieve marktplaatsvermeldingen op.

### API-routerbewerkingen (`outfits.py`)
* **Gebruiksstatistieken Hook**: als je een outfit opslaat, wordt automatisch de 'wear_count' verhoogd en wordt 'last_worn_at' bijgewerkt voor alle gekoppelde item-ID's in de collectie 'closet_items'.
* **Hooks opnieuw plannen**: het opnieuw plannen van een outfit naar een nieuwe datum verhoogt `use_count` op het outfitdocument.
* **Inline bewerkingen**: Ondersteunt PATCH-updates om outfitnamen en beschrijvingsreeksen rechtstreeks te wijzigen.
* **Base64 deelkaarten**: Genereert Base64-gecodeerde snapshot-afbeeldingen die zijn opgeslagen in `shared_outfits` om universeel delen mogelijk te maken via `navigator.share` of klembordkopie-URL's.