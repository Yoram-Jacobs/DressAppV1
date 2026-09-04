# Digitaal ontvangstbewijs en e-mailimport - Architectuur en gebruikershandleiding

> **Module:** `frontend/src/pages/AddItem.jsx` (tabblad importeren) · `backend/app/api/v1/closet.py`
> **Fase:** R (juli 2026)
> **Oppervlak:** Item toevoegen → tabblad Digitaal importeren
> **API-routes:** `POST /closet/parse-receipt` · `POST /closet/extract-pdf-text` · `POST /closet/items`

---

## 1. Samenvatting en waardevoorstel

### Overzicht

De functie **Digital Import** is de wrijvingsloze brug van DressApp tussen de digitale handelswereld en de persoonlijke garderobe. In plaats van elk kledingstuk te fotograferen en te wachten tot GarmentVision het scant, kan een gebruiker een ontvangst-e-mail plakken, een pdf/afbeelding van een winkelfactuur uploaden of een link naar een orderbevestigingspagina plakken - en DressApp extraheert merk, prijs, maat, categorie en titel automatisch met behulp van de multimodale visie van Gemini.

In tegenstelling tot een naïeve OCR-naar-tekst-scraper, voert Digital Import een **dubbele gelijktijdige analyse** uit voor beeldontvangsten: Gemini leest de afbeelding als een garderobe-catalogusagent, terwijl SegFormer van GarmentVision het kledinggebied tegelijkertijd detecteert en bijsnijdt via `asyncio.gather`. De twee resultaten worden samengevoegd door een strikte veldprioriteitregel: OCR wint op transactionele feiten (`price_cents`, `size`, `brand`), GarmentVision wint op esthetische kenmerken (`colors`, `pattern`, `dress_code`, `season`).

Zodra items zijn bevestigd en opgeslagen, nemen ze de **receipt-locked field**-bescherming over: elke toekomstige heranalyse (geactiveerd wanneer de gebruiker later een foto bijvoegt) kan alleen *lege velden invullen* en nooit de aankoopfeiten overschrijven die de gebruiker al heeft beoordeeld en geaccepteerd.

### Waardepropositie voor gebruikers

- **Zero foto vereist** — kledingstukken van online bestellingen worden gecatalogiseerd wanneer de bestel-e-mail binnenkomt, voordat het artikel wordt verzonden.
- **Transactionele nauwkeurigheid gegarandeerd** — prijs, merk en maat komen uit de tekst van de kassabon, niet uit een modelafleiding. Deze velden zijn na het opslaan permanent beveiligd via `receipt_locked_fields`.
- **Regioselectie per item**: versleepbare selectievakken isoleren individuele items op bonnenafbeeldingen met meerdere items. OCR wordt alleen geactiveerd op de geselecteerde subregio's, niet op de volledige pagina.
- **Afbeeldingsbonnen krijgen een volledige visuele analyse** — GarmentVision's SegFormer werkt gelijktijdig met OCR voor beeldinvoer, waardoor rijke esthetische metadata worden geproduceerd zonder extra latentiekosten.
- **Kastkoppeling** — een kassabonitem kan worden gekoppeld aan een *bestaande* kastinvoer: alleen lege commerciële velden (prijs, merk, maat) worden gepatcht; de bewerkte titel en miniatuur van de gebruiker blijven onaangeroerd.
- **Optimistische gebruikersinterface** — items verschijnen onmiddellijk in het kastraster via `closetStore.upsert`; De GarmentVision-verrijking gaat asynchroon door op de achtergrond.
- **Lokalisatie in 12 talen** — volledige RTL-ondersteuning voor Arabisch en Hebreeuws; elke string gebruikt de auditregel `{ defaultValue }`.

---

## 2. Uitgebreide gebruikershandleiding

### 2.1 Modus A — Tekst plakken

1. Het subtabblad **Tekst plakken** is standaard geselecteerd (`importMode = 'text'`).
2. Een `<textarea>` wordt weergegeven met een meertalig voorbeeld van een tijdelijke aanduiding.
3. De gebruiker plakt de onbewerkte e-mailtekst, ontvangsttekst of factuurinhoud. **Er wordt op dit moment geen netwerkoproep geactiveerd**.
4. De selector-overlay wordt over het tekstvoorbeeldgebied weergegeven. De `{y, h}`-percentages van elke selector worden toegewezen aan tekenlijnverschuivingen via `cropText()`.
5. Als u op **Geselecteerde items extraheren** klikt, wordt elke selector herhaald, wordt `cropText(receiptText, sel)` aangeroepen en wordt de subtekenreeks POST naar `/closet/parse-receipt` met `text=<fragment>`.
6. De backend stuurt de tekst rechtstreeks naar Gemini; `run_visual()` retourneert `None` (geen afbeeldingsbytes).

---

### 2.2 Modus B — Bestand uploaden (afbeelding)

1. De gebruiker selecteert **Bestand uploaden** en kiest een JPEG-, PNG-, WEBP- of HEIC-bestand.
2. `handleImportFileChange` detecteert `file.type.startsWith('image/')` en **retourneert onmiddellijk** na `setImportFile(file)`. Een `useEffect` die `importFile` bekijkt, roept `URL.createObjectURL(importFile)` → `setImagePreviewUrl(url)` aan. **Geen netwerkoproepen bij uploaden**.
3. De afbeelding wordt weergegeven in de voorbeeldcontainer met de versleepbare selector-overlay bovenaan.
4. Bij **Geselecteerde items extraheren**, voor elke selector:
   - `cropImageFile(importFile, sel)` tekent de regio op een off-screen `<canvas>` en exporteert een JPEG `Blob` met een kwaliteit van 90%.
   - Het bijgesneden `Bestand` wordt aan `FormData` toegevoegd als `file=crop-N.jpeg`.
   - De backend detecteert `"image" in mime_type` → stelt `is_image = True` in → voert `asyncio.gather(run_ocr(), run_visual())` uit.
5. Als de backend `image_base64` retourneert, toont de kaart een door GarmentVision bijgesneden miniatuur; anders wordt de door de browser bijgesneden JPEG rechtstreeks gebruikt.

> **Kredietefficiëntie:** De vorige architectuur OCR-de de volledige afbeelding op het moment dat de gebruiker deze selecteerde. De huidige architectuur stelt OCR uit tot extractietijd en draait alleen op de door de gebruiker geselecteerde subregio's. Een ontvangstbewijs met 4 items gaat van 1 OCR-oproep van een volledige pagina tot 4 oproepen in een kleine regio tegen een fractie van de symbolische kosten.

---

### 2.3 Modus C — Bestand uploaden (PDF)

1. De gebruiker kiest een `.pdf`-bestand.
2. `handleImportFileChange` detecteert `isPdf === true` en **onmiddellijk** activeert `api.extractPdfText(formData)`.
3. Toast laden: *"Tekst extraheren met Gemini OCR..."*
4. Het `/closet/extract-pdf-text`-eindpunt van de backend:
   - **Primair pad:** Gemini Multimodale OCR met een prompt voor het samenvoegen van kolommen.
   - **Fallback:** `pypdf.PdfReader` lokale tekstextractie (alleen PDF, geen Gemini-credits verbruikt).
5. Bij succes wordt `receiptText` ingevuld; een succestoost bevestigt.
6. De selector-overlay wordt over het tekstvoorbeeld weergegeven. **Geselecteerde items extraheren** gebruikt vervolgens `cropText()` om lijnbereiken per selector te isoleren.

> **Waarom OCR bij het uploaden van PDF's?** `canvas.drawImage()` kan geen PDF-inhoud weergeven. Tekst moet worden geëxtraheerd voordat selectors op zinvolle wijze een lijnbereik kunnen bijsnijden.

---

### 2.4 Modus D — Weblink

1. De gebruiker plakt een willekeurige URL (bestellingsbevestigingspagina of directe link naar een JPEG/PDF-factuur).
2. Er wordt geen netwerkoproep geactiveerd tijdens het typen.
3. Bij **Geselecteerde items extraheren** plaatst elke selector `url=<waarde>` naar `/closet/parse-receipt`.
4. De backend haalt de URL op via `httpx` met een browserachtige User-Agent, volgt omleidingen en routeert op inhoudstype:
   - `image/*` → multimodaal binair deel + `is_image = True` (volledig dubbelpad).
   - `text/html` → `resp.text` stringgedeelte.
5. Een ophaaltime-out van 15 seconden beschermt tegen trage verkopersservers.

---

### 2.5 Het Selectorsysteem

| Eigendom | Details |
|---|---|
| **Staatsvorm** | `selectors: [{id, x, y, w, h}]` — alle waarden als % van de container |
| **Initiële status** | `[{id:1, x:0, y:10, w:100, h:2}]` — één selector over de volledige breedte op 10% vanaf de bovenkant |
| **Toevoegen** | `handleAddSelector()` wordt onder het laatste vak gestapeld en neemt de breedte ervan over |
| **Verplaatsen** | onMouseDown/onTouchStart registreert delta; onMouseMove-updates (x,y) in staat |
| **Formaat wijzigen** | Update van rand-/hoekhitzones in 8 richtingen (w,h) vastgeklemd aan containergrenzen |
| **Verwijderen** | `handleRemoveSelector(id)` filtert de invoer van status |
| **Etiket** | `t('addItem.selectorItemLabel', {n: idx+1})` — volledig gelokaliseerd in 12 talen |
| **Sleepsessie** | `dragState: {id, type, startX, startY, origX, origY, origW, origH}` — null op mouseUp |

---

### 2.6 Geëxtraheerde artikelkaarten

| Veld | Afleiding |
|---|---|
| Miniatuur | Door de browser bijgesneden JPEG → `res.image_base64` van GarmentVision → gegenereerde SVG-plaatsaanduiding |
| Naam | `res.name` of `"{brand} {item_type}"` |
| Merk | `res.brand` of `"Generiek"` |
| Categorie | Een van: Top, Bottom, Bovenkleding, Full Body, Schoenen, Ondergoed, Accessoires |
| Maat | `res.size` of `"M"` |
| Prijs | `res.price_cents / 100` geformatteerd met lokale valuta |
| Kleuren | `res.colors[]` genormaliseerd naar `{name, pct:null}` objecten |
| Geselecteerd | Schakel het selectievakje in via `handleToggleItemSelect(id)` |

**Kaartacties:**

- **Foto bijvoegen** — opent verborgen `<input type="file" ref={itemImageInputRef}>` gebonden aan `activeItemForImage` ID. FileReader slaat de afbeelding op als `base64Image` op de kaart.
- **Link naar kastitem** — opent kastkiezer (`closetModalOpen = true`). Als u een overeenkomst selecteert, wordt `handleLinkItem(closetItem)` aangeroepen, `item.closetItem` ingesteld en de afbeeldings-URL ervan gekopieerd als de kaart er geen heeft.
- **Gekoppelde chip** — door erop te tikken wordt `closetItemDetailPane` geopend, met volledige details van de gekoppelde kastingang (afbeelding, titel, merk/categorie/grootte, prijs).

---

### 2.7 Opslaan en verwerken van stroom

```
1. Filter geëxtraheerdeItems waarbij geselecteerd === waar → itemsToSave
2. setIngestPhase('opslaan') → setIngestProgress({klaar:0, totaal:N})
3. Voor elk artikel:
   ├─ if item.closetItem → api.updateItem(patch: alleen merk/maat/prijs, titel onaangeroerd)
   └─ anders → api.createItem({ from_receipt:true, ontvangst_vergrendelde_velden, image_base64? })
   closetStore.upsert(resultaat) ← optimistisch: rasterupdates onmiddellijk
   ingestProgress.done++ ← vooruitgang in de voortgangsring
4. setIngestPhase('synchroniseren')
5. wacht op closetStore.prewarm({ force: true }) ← volledige server opnieuw ophalen
6. Status wissen → nav('/kast')
```

---

### 2.8 Overlay-animatie opnemen

Een `<AnimatePresence>`-blok met de positie `absolute inset-0 z-50` wordt weergegeven tijdens de opslagfase:

- **SVG-voortgangsring:** `<motion.circle>` met `strokeDasharray = 2π×34` en `strokeDashoffset = (2π×34)×(1 − done/total)` tijdens het opslaan; `0` (voltooid) tijdens het synchroniseren.
- **Fasepictogram:** ✦ Sparkles (opslaan) → draaien ↺ RefreshCw (synchroniseren).
- **Faselabel:** `AnimatePresence mode="wait"` ingetoetst op `ingestPhase`, vervaagt `{y:6}→{y:0}` bij binnenkomst, `{y:-6}` bij afsluiten.
- **Tegenpil:** monospace `klaar/totaal`-badge (alleen spaarfase).
- **Achtergrond:** `hsl(var(--background)/0.92)` met `achtergrondfilter: vervagen(12px)`.

---

### 2.9 Referentie voor foutafhandeling

| Scenario | Feedback |
|---|---|
| PDF OCR mislukt (Gemini + pypdf) | `toast.error(detail of t('addItem.import.textError'))` |
| Geen tekst gevonden in PDF/afbeelding | `toast.error(t('addItem.import.textEmpty'))` |
| `/closet/parse-receipt` mislukt voor een selector | `toast.error(detail of t('addItem.import.error'))` |
| Opslaan zonder geselecteerd | `toast.error(t('addItem.import.noSelectedItems'))` |
| `createItem` of `updateItem` mislukt | `toast.error(detail of t('addItem.import.saveFailed'))` |
| Ophalen van web-URL mislukt (4xx/5xx/time-out) | `HTTPException(400, "Kon ontvangstbewijs niet ophalen van URL...")` |

---

## 3. Technologiestapel en mogelijkheden Deep-Dive

### 3.1 Frontend-statusvariabelen (AddItem.jsx regels 271-305)

| Variabel | Typ | Rol |
|---|---|---|
| `importmodus` | `'tekst' | 'bestand' | 'url'` | Actieve submodus |
| `importbestand` | `Bestand | nul` | Geselecteerd bestandsobject |
| `importUrl` | `tekenreeks` | Weblink-URL |
| `receiptText` | `tekenreeks` | OCR-geëxtraheerde of geplakte tekst |
| `imagePreviewUrl` | `tekenreeks | nul` | `URL.createObjectURL(importbestand)` |
| `isExtraheren` | `booleaans` | Schakelt de extractieknop uit; toont spinner |
| `kiezers` | `{id,x,y,w,h}[]` | Selectieregio's in % |
| `dragState` | `voorwerp | nul` | Actieve sessie voor slepen/vergroten |
| `geëxtraheerdeItems` | `GeëxtraheerdItem[]` | Geparseerde itemkaarten |
| `linkingItemId` | `tekenreeks | nul` | Kaart waarvan het kastlink-dialoogvenster geopend is |
| `kastModalOpen` | `booleaans` | Zichtbaarheid van kastkiezer |
| `closetSearch` | `tekenreeks` | Zoekopdracht in kastkiezer |
| `activeItemForImage` | `tekenreeks | nul` | Kaart waarvan de foto-attach-invoer actief is |
| `closetItemDetailPane` | `voorwerp | nul` | Detaildialoog voor gekoppeld kastitem |
| `ingestPhase` | `nul | 'besparing' | 'synchroniseren'` | Overlay-fase |
| `ingestProgress` | `{klaar, totaal}` | Voortgang bel |
| `besparing` | `booleaans` | Spaarspinner op het hoogste niveau |

---

### 3.2 `cropImageFile` — Canvas bijsnijden aan de browserzijde (regels 504-538)

```javascript
const x = (selector.x / 100) * img.width;
const y = (selector.y / 100) * img.height;
const w = (selector.w / 100) * img.width;
const h = (selector.h / 100) * img.height;
canvas.breedte = w; doek.hoogte = h;
ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
canvas.toBlob(oplossen, 'afbeelding/jpeg', 0.9);   // 90% JPEG-kwaliteit
```

Het resultaat is een `Bestand` met de naam `crop-{selectorId}-{originalFilename}` ingediend als `bestand` in de meerdelige aanvraag.

---

### 3.3 `cropText` — Bijsnijden tekstlaagselectie (regels 540-545)

```javascript
const regels = tekst.split('\n');
const startLine = Math.floor((selector.y / 100) * lijnen.lengte);
const endLine = Math.ceil(((selector.y + selector.h) / 100) * lijnen.lengte);
retourregels.slice(startregel, eindregel).join('\n');
```

`selector.y / 100` is de breuk vanaf de bovenkant van het tekstblok, omgezet naar een regelindex.

---

### 3.4 Backend — `POST /closet/parse-receipt`

**Invoerroutering:**

| Invoer | Conditie | inhoud `onderdelen` | `is_afbeelding` |
|---|---|---|---|
| `tekst` parameter | niet-lege tekenreeks | `[tekst_string]` | Vals |
| bestand — teksttype | MIME begint met `text/` of bekende ext | `[gedecodeerd_utf8]` | Vals |
| bestand — binair | PDF of afbeelding | `[(bytes, mime)]` | Waar als afbeelding |
| URL-HTML | `text/html` antwoord | `[resp.tekst]` | Vals |
| url — afbeelding/PDF | Binair inhoudstype | `[(inhoud, ct)]` | Waar als afbeelding |

**Dual-path gelijktijdige analyse (regels 6038-6039):**

```python
ocr_result, visual_result = wacht op asyncio.gather(run_ocr(), run_visual())
```

- **`run_ocr()`** — Gemini Vision met systeemprompt voor garderobecatalogus; `response_mime_type="applicatie/json"`; code-fence strippen vóór `json.loads`.
- **`run_visual()`** — `detect_items(image_bytes)` → grootste bbox → `_bbox_crop_useful` → `analyze(crop_bytes, taal=user_lang)`. Retourneert `{visuele_analyse, image_base64, image_mime}`.

**Gemini-systeemprompt extraheert zeven velden:**
`brand` · `item_type` (enkelvoudig zelfstandig naamwoord in kleine letters) · `size` · `price_cents` (gehele centen na korting) · `colors` (lijst met kleine letters) · `category` (beperkt tot 7 canonieke waarden) · `name` (vriendelijk beschrijvend label)

** Prioriteit voor samenvoegen van velden (regels 6041-6086):**

| Prioriteit | Velden | Bron |
|---|---|---|
| OCR wint | `merk`, `maat`, `prijs_cent`, `categorie`, `item_type`, `naam/titel` | Ontvangst/factuurtekst |
| Visie wint | `kleuren`, `stof_materialen`, `patroon`, `dress_code`, `seizoen` | GarmentVision SegVoormalig |
| Standaardwaarden | `merk → Algemeen`, `grootte → M`, `categorie → Top` | Toegepast als beide leeg zijn |

---

### 3.5 Backend — `POST /closet/extract-pdf-text`

```python
# Primair: Gemini Multimodale OCR (temperatuur=0,0)
# Prompt: horizontale extractie van kolommen, rij voor rij
ocr_text = wacht op gemini.vision(user_parts=[prompt, (file_bytes, mime_type)], temperatuur=0,0)

# Terugval (alleen pdf, geen Gemini-credits):
lezer = pypdf.PdfReader(io.BytesIO(file_bytes))
text = "".join(page.extract_text() of "" voor pagina in reader.pages)
```

De prompt voor het samenvoegen van kolommen is van cruciaal belang voor winkelfacturen met meerdere kolommen waarbij de itemnaam, SKU en prijs verschijnen in aangrenzende kolommen die naïeve extractors produceren als afzonderlijke verticale tekstblokken.

---

### 3.6 Bon-vergrendeld veldsysteem

**Frontend lock-berekening (regels 963-972):**

```javascript
const ontvangstLockedFields = [
  item.naam ? 'titel': nul,
  item.merk ? 'merk' : nul,
  item.grootte ? 'grootte': nul,
  item.price_cents ? 'price_cents' : null,
  item.price_cents ? 'purchase_price_cents': null,
  item.categorie ? 'categorie': nul,
  item.kleuren?.lengte ? 'kleuren': nul,
  item.kleuren?.lengte ? 'kleur': nul,
].filter(Booleaans);
```

Alleen velden die *daadwerkelijk ontvangstgegevens* bevatten, zijn vergrendeld; een ontbrekend veld blijft vrij invulbaar door latere GarmentVision-analyse.

**Backend-persistentie (regels 998-1000):**

```python
doc["from_receipt"] = Waar
doc["receipt_locked_fields"] = lijst(payload.receipt_locked_fields of [])
```

**Afdwingen samenvoegen in `_run_background_matte_and_analyze` (regels 726-741):**

```python
vergrendeld = set(receipt_locked_fields of [])
voor sleutel in ANALYSIS_KEYS: # 19 sleutels: titel, merk, dress_code, seizoen, …
    als de sleutel vergrendeld is:
        doorgaan # Overschrijf nooit bongegevens
    huidige = item_doc.get(sleutel)
    als actueel of actueel == 0:
        doorgaan # Alleen invullen voor niet-vergrendelde velden
    update_doc[key] = analyse[key] # Veilig toe te passen
```

De vergrendeling is ook van toepassing in `PATCH /closet/{id}` (regels 4360-4369), dus het bewerken van een ontvangstitem via de detailweergave van de kast respecteert ook de permanente bescherming.

**Alle 11 `receipt_locked_fields` referenties in closet.py:**

| Lijn | Context |
|---|---|
| L189 | Inline commentaar in `CreateItemPayload` |
| L196 | Pydantische velddefinitie |
| L643 | `_run_background_matte_and_analyze`-parameter |
| L654 | Docstring-samenvoegregelsectie |
| L726 | Runtime `locked = set(receipt_locked_fields or [])` |
| L1000 | `create_item` persistentie |
| L1040 | `create_item` achtergrondtaakcommentaar |
| L1047 | `create_item` argument voor taakverzending |
| L4273 | `update_item`docstring |
| L4360 | `update_item` beschermd ingesteld commentaar |
| L4363 | `update_item` runtime-afdwinging |

---

### 3.7 Achtergrond GarmentVision-pijplijn

Wanneer `from_receipt=True` en een afbeelding aanwezig zijn, staat `create_item` in de wachtrij:

```python
achtergrond_taken.add_task(
    _run_background_matte_and_analyze,
    item_id, raw_for_bg, payload.category,
    lijst(payload.receipt_locked_fields of []),
)
```

**Takenketen:**

```
Stap 1: _run_background_matte (item_id, raw_bytes, categorie)
    └─ rembg (u2netp) achtergrondverwijdering
    └─ Schrijft clean_image_url + clean_image_status naar MongoDB

Stap 2: kledingstuk_vision_service.analyze(raw_bytes, taal=user_lang)
    └─ Volledige Gemini VLM-taxonomiepas met 18 velden
    └─ _safe_analysis() sanering
    └─ _is_unidentifiable() bewaker — wordt afgebroken als Gemini geluid retourneert
    └─ Veld samenvoegen: leeg invullen + handhaving van vergrendeld veld
    └─ MongoDB-update_one
```

**Alle foutmodi zijn zacht**: rembg-fout, GarmentVision niet beschikbaar, niet-identificeerbaar resultaat en elke niet-afgehandelde uitzondering wordt allemaal geregistreerd en afgesloten, waarbij de ontvangstgegevens van het item intact blijven.

Voor ontvangstitems die **zonder foto** zijn gemaakt, loopt er helemaal geen pijplijn: de ontvangstgegevens zijn de volledige gegevensset.

---

### 3.8 Synchronisatie van kastwinkels

```javascript
// Per item: optimistisch (direct)
closetStore.upsert(gemaakt.item);

// Nadat alle items zijn opgeslagen: gezaghebbend
setIngestPhase('synchroniseren');
wacht op closetStore.prewarm({ force: true });
```

`closetStore` is gebouwd op `useSyncExternalStore` van React 19. Het geforceerde ‘voorverwarmen’ zorgt voor:
- Alle geopende browsertabbladen zien nieuwe items onmiddellijk via de `storage` gebeurtenis.
- `clean_image_url`, `clean_image_status` en achtergrondpijplijnresultaten zijn zichtbaar op het moment dat de gebruiker op `/closet` arriveert.
- Het Closet-raster biedt geen verouderde cache-items aan totdat de TTL is verlopen.

---

### 3.9 API-clientmethoden (`frontend/src/lib/api.js`)

```javascript
parseReceipt: (formData) =>
  client.post('/closet/parse-receipt', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    time-out: 60000, // 60 s — GarmentVision + Gemini
  }).then(r => r.data),

extractPdfText: (formData) =>
  client.post('/closet/extract-pdf-text', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    time-out: 30000, // 30 s — alleen OCR
  }).then(r => r.data),
```

---

### 3.10 Lokalisatie (12 landinstellingen)

| Sleutel | Standaard (nl) |
|---|---|
| `addItem.tabs.import` | Digitale import |
| `addItem.tabs.upload` | Camera en uploaden |
| `addItem.import.extractButton` | Geselecteerde items extraheren |
| `addItem.import.extracting` | Items extraheren... |
| `addItem.import.extractingText` | Tekst extraheren met Gemini OCR… |
| `addItem.import.textExtracted` | Tekst succesvol geëxtraheerd via Gemini OCR! |
| `addItem.import.textEmpty` | Geen leesbare tekst gevonden. |
| `addItem.import.textError` | Kan tekst niet extraheren. |
| `addItem.import.success` | Items succesvol geëxtraheerd! |
| `addItem.import.error` | Kon ontvangstbewijs niet parseren. Controleer de opmaak en probeer het opnieuw. |
| `addItem.import.noSelectedItems` | Selecteer ten minste één item om op te slaan. |
| `addItem.import.saveFailed` | Opname mislukt |
| `addItem.import.ingestCataloguing` | Catalogusitem {{klaar}} van {{total}}… |
| `addItem.import.ingestSyncing` | Synchroniseren met uw kast… |
| `addItem.import.ingestAnalysisHint` | Rembg & Gemini Vision op de achtergrond uitgevoerd. |
| `addItem.import.ingestSyncingHint` | Je garderobe opfrissen — het is bijna zover. |
| `addItem.selectorItemLabel` | Artikel {{n}} |

---

## 4. API-contractreferentie

### `POST /closet/parse-receipt`

**Auth:** Bearer JWT · **Content-Type:** `multipart/form-data` · **Time-out:** 60 s

**Verzoek** — precies een van:

| Veld | Typ | Beschrijving |
|---|---|---|
| `tekst` | `tekenreeks` | Geplakt ontvangstbewijs of e-mailtekst |
| `bestand` | `Bestand uploaden` | Afbeelding (JPEG/PNG/WEBP/HEIC) of PDF |
| `url` | `tekenreeks` | URL naar een ontvangstpagina of afbeelding/PDF |

**Antwoord:**

```Json
{
  "name": "Wosawe Windjack Lichtgewicht",
  "title": "Wosawe Windjack Lichtgewicht",
  "merk": "Wosawe",
  "item_type": "jas",
  "maat": "M",
  "prijs_cent": 7966,
  "category": "Bovenkleding",
  "kleuren": [{"name": "blauw", "pct": null}],
  "image_base64": "<base64-jpeg-van-kledingstuk-crop>",
  "image_mime": "afbeelding/jpeg"
}
```

`image_base64` / `image_mime` zijn alleen aanwezig als GarmentVision een kledinguitsnede heeft geproduceerd.

---

### `POST /closet/extract-pdf-text`

**Auth:** Bearer JWT · **Content-Type:** `multipart/form-data` · **Time-out:** 30 s

**Verzoek:** `bestand: UploadFile` (PDF of afbeelding)

**Reactie:** `{ "text": "<geëxtraheerde tekenreeks>" }`

---

## 5. Ontwerpbeslissingen en randgevallen

| Besluit | Reden |
|---|---|
| **Afbeeldingen worden vooraf overgeslagen OCR** ​​| Uitstellen tot extractietijd vermindert het aantal credits per sessie; Ontvangsten voor N-items gaan van 1 OCR op een volledige pagina tot N oproepen in kleine regio's tegen een fractie van de symbolische kosten |
| **PDF's OCR bij uploaden** | `canvas.drawImage()` kan geen PDF-inhoud weergeven; tekst moet worden geëxtraheerd voordat selectors op zinvolle wijze een lijnbereik kunnen bijsnijden |
| **`asyncio.gather` voor OCR + Vision** | Beide oproepen zijn I/O-gebonden en onafhankelijk; gelijktijdige uitvoering verlaagt de latentie per item van ~4 s sequentieel naar ~2,5 s |
| **`receipt_locked_fields` is gedetailleerd** | Alleen velden die *daadwerkelijk ontvangstgegevens bevatten* zijn vergrendeld; ontbrekende velden blijven vrij invulbaar door latere GarmentVision-analyse |
| **Titel uitgesloten van patch met kastlink** | `handleSaveExtractedItems` linkpad patcht alleen `brand`, `size`, `price_cents`, `purchase_price_cents` — de bewerkte titel van de gebruiker wordt nooit overschreven |
| ** Tijdelijke aanduiding voor SVG-reserve** | Als er geen afbeelding beschikbaar is, wordt een merk-SVG gegenereerd aan de clientzijde met behulp van `btoa(unescape(encodeURIComponent(svg)))` met merk/type-tekst in SVG `<text>` knooppunten |
| **`cropImageFile` JPEG met kwaliteit 0,9** | 90% kwaliteit behoudt voldoende details voor Gemini's OCR zonder de grootte van de FormData-payload te vergroten |
| **`_is_unidentifiable` bewaker in achtergrondtaak** | Voorkomt dat GarmentVision-afvaluitvoer een ontvangstbewijsitem vervuilt dat al schone, gezaghebbende metagegevens voor ontvangstbewijzen heeft |
| **`voorverwarmen({ force: true })` na opslaan** | Zonder geforceerd opnieuw ophalen zou de kastcache verouderde vermeldingen weergeven tot de TTL-vervaldatum; force zorgt ervoor dat echte thumbnails en pijplijnstatus onmiddellijk zichtbaar zijn |
| **SVG-detectie op basis van gegevens-URI-voorvoegsel** | `item.base64Image.startsWith('data:image/svg+xml')` markeert het item als 'geen foto', zodat `from_receipt` items met tijdelijke SVG's de GarmentVision-pijplijn niet activeren |