# Itemgroepering en outfitsets Functiesamenvatting

Met de functie **Item Grouping** in DressApp kunnen gebruikers meerdere foto's van kledingstukken bundelen in één logische eenheid. Deze functie verwerkt twee verschillende gebruiksscenario's op basis van kledingcategorieën:
1. **Enkele kledingstukweergaven:** Het bundelen van verschillende weergaven van hetzelfde fysieke kledingstuk (bijvoorbeeld vooraanzicht, achteraanzicht, profielweergave en details).
2. **Outfitsets (ensembles):** Het bundelen van verschillende fysieke kledingstukken van verschillende categorieën (bijvoorbeeld een driedelig pak bestaande uit een blazer, broek en vest) om een ​​ensemble voor het hele lichaam te vormen.

---

## 1. Samenvatting en waardevoorstel

### Overzicht op hoog niveau
Item Grouping optimaliseert de digitale garderobe van de gebruiker door de rommel in het kastraster te minimaliseren en tegelijkertijd de details en context te maximaliseren die beschikbaar zijn voor de avatar-rendering-engine en het Stylist Brain. Door onderscheid te maken tussen **Single Garment Views** (homogene categorie) en **Outfitsets** (heterogene categorieën), biedt het systeem naadloze groepering zonder overheadconfiguratie.

### Architecturale stroom

```Zeemeermin
grafiek TD
    Gebruiker[Gebruikersinteractie: slepen en neerzetten / Bulkgroep]
    Raster[Kastraster / Itemdetail bewerken]
    Poortwachter{Dezelfde of verschillende categorieën?}
    Controle[Taxonomie Gatekeeper Check]
    BevestigModal[Poortwachterwaarschuwing Modaal]
    RunGroup[Groepeerpijplijn uitvoeren]
    API[Backend-API: /groep]
    DB[(MongoDB: kast_items)]
    Opwarmen[analyse_groep_helper opnieuw]
    SetCheck{Is het een set?}
    LLM [Gemini 2.5 Flash-groepsanalysator]
    Klaar[Status markeren: gereed]
    Stylist[Stylist Hersenen / Planner]
    Avatar[Avatar-viewer 2D]

Gebruiker --> Raster
    Raster --> Poortwachter
    Poortwachter -- Zelfde Categorie --> Controle
    Poortwachter -- Andere categorie: Outfitset --> RunGroup
    Controleer -- Mismatches gevonden --> BevestigModal
    Vink aan -- komt overeen of goedgekeurd --> RunGroup
    BevestigModal -- Goedgekeurd --> RunGroup
    RunGroup --> API
    API --> DB
    DB --> Opwarming
    Opwarmen --> SetCheck
    SetCheck -- Ja: Instellen --> Klaar
    SetCheck -- Nee: weergaven van één kledingstuk --> LLM
    LLM --> Klaar
    Klaar --> DB
    
    DB --> Stylist
    DB --> Avatar
    Stylist -- Geaarde suggesties --> Gebruiker
    Avatar -- Render gelaagde slots --> Gebruiker
```

### Waardepropositie voor gebruikers
* **Schoon kastraster:** Alleen de primaire/omslagkaart (de gastheer) van een groep of set is zichtbaar in de kast, waardoor het kledingkastraster georganiseerd en gemakkelijk te scannen blijft.
* **Automatische herkenning:** Het samenslepen van items uit verschillende categorieën vormt automatisch een outfitset, waarbij standaard taxonomiewaarschuwingen en poortwachterdialogen worden omzeild.
* **Automatische avatar-aankleding:** Door een outfitset aan de avatar toe te voegen, wordt de mannequin onmiddellijk in alle samenstellende kledingstukken gekleed (bijvoorbeeld blazer in bovenkledingvak, broek in broekvak).
* **Flexibele planning:** Outfitsets kunnen worden onderverdeeld in individuele kledingstukken bij het plannen of samenstellen van outfits, zodat gebruikers hun rotatie kunnen aanpassen.

---

## 2. Uitgebreide gebruikershandleiding

### Visuele interfacetopologie

```
+---------------------------------------------------------+
|                        KASTRASTER |
|                                                                 |
|  +---------------------+ +----------------------+ |
|  | [Afbeelding: Blazerhoes] |     | [Afbeelding: enkel shirt] |        |
|  |                       |     |                       |        |
|  | Titel: Smokingpak |     | Titel: Linnen overhemd |        |
|  | [Outfitset] |     |                       |        |
|  | Bovenkleding·Onderkant·Top |     | Bovenstuk · Wit |        |
|  +---------------------+ +----------------------+ |
|                                                                 |
+---------------------------------------------------------+
|                  OUTFIT VOLTOOIDBLAD |
|                                                                 |
|  Ankers: |
|  +---------------------+ +----------------------+ |
|  | (1) [Blazercover] X |     | (2) [Linnen overhemd] X |        |
|  |                       |     |                       |        |
|  |    [Verdeel set] |     |                       |        |
|  +---------------------+ +----------------------+ |
|                                                                 |
+---------------------------------------------------------+
```

### Modus- en workflow-walkthroughs
1. **Een enkele kledinggroep maken:**
   - Sleep een item naar een ander item uit dezelfde categorie (bijvoorbeeld vooraanzicht van T-shirt naar achteraanzicht van T-shirt).
   - De **Taxonomie Gatekeeper** controleert op metadataconflicten. Als attributen verschillen, wordt een waarschuwing getoond.
   - Na voltooiing stuurt een achtergrondtaak de afbeeldingen naar het visiemodel om tags te consolideren.
2. **Een outfitset maken:**
   - Sleep een item naar een ander item uit een andere categorie (bijvoorbeeld een blazer op een broek).
   - Het systeem herkent de verschillende categorieën, slaat de poortwachter over en groepeert ze onmiddellijk als een **Outfitset**.
   - Op de kaart in de kast staat een 'Outfitset'-badge en worden alle categorieën vermeld (bijvoorbeeld 'Bovenkleding · Onderkant · Bovenkant").
3. **Outfits samenstellen met sets:**
   - Selecteer de outfitset in de kast en klik op 'Outfit compleet'.
   - De outfitset verschijnt als één enkel anker op het voltooiingsblad.
   - Klik op **"Set verdelen"** om de sethoes te vervangen door de afzonderlijke kledingstukken.
   - Gebruik de knop **"X"** op een van de verdeelde kledingstukken om onderdelen uit de planningslijst te verwijderen.

---

## 3. Technologiestapel en mogelijkheden Deep-Dive

### Kernorkestratie en AI/logica
* **Categorienormalisatie:** Het systeem normaliseert categorieën vóór vergelijking om robuuste matching te garanderen:
  ```javascript
  const normCategorie = (cat) => {
    const s = String(cat || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (s === 'top' || s === 'top') retourneert 'top';
    if (s === 'onderkant' || s === 'onderkant') retourneert 'onderkant';
    if (s === 'schoenen' || s === 'schoenen') retourneert 'schoenen';
    if (s === 'accessoire' || s === 'accessoires') retourneert 'accessoires';
    retourneert;
  };
  ```
* **Heranalyse van sets omzeilen:** Voor outfitsets zou het uitvoeren van uniforme groepsanalyse (die metagegevens verenigt alsof het weergaven van een enkel kledingstuk zijn) de taxonomieën van individuele items beschadigen. De backend detecteert dit en voltooit de analyse direct:
  ```python
  categorieën = {norm_category(r.get("category")) voor r in group_items if r.get("category")}
  als len(categorieën) > 1:
      # Het is een set! Stel de status direct in op "klaar" om onafhankelijke tags te behouden
      wacht op db.closet_items.update_many(
          {"id": {"$in": item_ids}},
          {"$set": {"group_analysis_status": "klaar"}}
      )
      terug
  ```

### Gegevens- en contextpijplijnen
* **Achtergrondcontexthydratatie:** Om ervoor te zorgen dat het Stylistbrein setitems samen of afzonderlijk kan voorstellen, hydrateert en sluit `closet_summary_for` in `stylist_memory.py` ledenitems van alle geladen outfitsets in, en versiert ze met de eigenschappen `group_id`, `group_role` en `is_set`.
* **Scheduler-rotatie:** `get_prioritized_closet` in `stylist_scheduler_brain.py` en het complete-outfit-eindpunt in `stylist.py` hydrateren op vergelijkbare wijze de kledingstukken van setleden, waardoor de aanbevelingsengine setstukken kan roteren.

### Frontend- en clientarchitectuur
* **Mannequin Assembly:** `AvatarViewer2D.jsx` lost Outfit Set-leden op uit de momentopname van de winkel en wijst elk item toe aan de overeenkomstige visuele laag (`top`, `bottom`, `bovenkleding`, `schoenen`, `accessoire`, `jurk`, `tas`, `hoofddeksels`).
* **Ankersplitsing:** `OutfitCompletionSheet.jsx` splitst de samenstellende items in de statusarray `orderedAnchors` terwijl duplicaten eruit worden gefilterd.

---

## 4. Belangrijke bugfixes

### 1. Taxonomie-mismatch valse positieven
* **Probleem**: het groeperen van items kan een taxonomiewaarschuwing activeren, zelfs als het om hetzelfde type kledingstuk gaat, vanwege verschillen in categorie/subcategorie (bijvoorbeeld het vergelijken van `'top'` met `'tops'`, of het vergelijken van het Engelse `'shirt'` met het vertaalde Hebreeuwse `'חולצה'`).
* **Opgelost**: de helper voor het vergelijken van taxonomie in `taxonomy.js` is opnieuw ontwikkeld om categorieën te normaliseren en de vertaalindex `canonicalSubCategoryKey` te gebruiken om equivalente termen in verschillende talen op te lossen.

### 2. Seizoensarray-spreidingsbug
* **Probleem**: het seizoensattribuut kan worden opgeslagen als een array (bijvoorbeeld `['all']`) of als een string (bijvoorbeeld `'all'`). De normalisatiehelper `normSeason` had een bug die stringvariabelen verspreidde, waarbij `'all'` werd behandeld als `['a', 'l', 'l']` en onjuiste waarschuwingen voor seizoensmismatches werden veroorzaakt.
* **Opgelost**: `normSeason` in `taxonomy.js` geüpgraded om variabeletypen expliciet te verifiëren, zodat tekenreekswaarden in een array worden verpakt in plaats van verspreid.

### 3. Arabische Unicode-afloop in Hebreeuwse landinstelling
* **Probleem**: het woord "Annuleren" (`ביטול`) en "Profiel" (`פרופיל`) in het Hebreeuwse vertaalbestand `he.json` bevatte Arabische letters (Waw `ו`, Lam `ل`, Yeh `ي`) in plaats van Hebreeuwse equivalenten (Vav `ו`, Lamed `ל`, Yod `י`), wat resulteerde in een vervormde stijl en weergave.
* **Opgelost**: De Hebreeuwse vertaalwaarden zijn recursief opgeschoond om alle exemplaren van Arabische Unicode-tekens te vervangen door hun correcte Hebreeuwse equivalenten.

### 4. Synchronisatie van hoofdlettergevoelige taalvoorkeuren
* **Probleem**: Bij gebruikers met `preferred_lingual = "He"` (met hoofdletters) in de database werd hun taalvoorkeur genegeerd en viel terug op Engels omdat de i18next-synchronisatiecode zocht naar exacte overeenkomsten met ondersteunde codes in kleine letters (zoals `"hij"`).
* **Opgelost**: Genormaliseerde taalcodecontroles naar kleine letters in alle frontendcomponenten (inclusief initialisatie, achtergrondsynchronisatie, profielformulieren, tekst-naar-spraak- en spraak-naar-tekst-configuraties) om hoofdletterongevoeligheid te garanderen.