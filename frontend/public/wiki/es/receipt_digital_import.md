# Digital Receipt & Email Import — Architecture & User Manual

> **Module:** `frontend/src/pages/AddItem.jsx` (import tab) · `backend/app/api/v1/closet.py`
> **Phase:** R (July 2026)
> **Surface:** Add Item → Digital Import tab
> **API Routes:** `POST /closet/parse-receipt` · `POST /closet/extract-pdf-text` · `POST /closet/items`

---

## 1. Executive Summary & Value Proposition

### Overview

The **Digital Import** feature is DressApp's zero-friction bridge between the digital commerce world and the personal wardrobe. Instead of photographing each garment and waiting for GarmentVision to scan it, a user can paste a receipt email, upload a store invoice PDF/image, or paste a link to an order confirmation page — and DressApp extracts brand, price, size, category, and title automatically using Gemini's multimodal vision.

Unlike a naive OCR-to-text scraper, Digital Import runs a **dual-path concurrent analysis** for image receipts: Gemini reads the image as a wardrobe cataloguing agent while GarmentVision's SegFormer detects and crops the garment region simultaneously via `asyncio.gather`. The two outputs are merged by a strict field-priority rule — OCR wins on transactional facts (`price_cents`, `size`, `brand`), GarmentVision wins on aesthetic attributes (`colors`, `pattern`, `dress_code`, `season`).

Once items are confirmed and saved, they inherit **receipt-locked field** protection: any future re-analysis (triggered when the user later attaches a photo) can only *fill empty fields*, never overwrite the purchase facts the user already reviewed and accepted.

### User Value Proposition

- **Zero-photo required** — garments from online orders are catalogued when the order email arrives, before the item ships.
- **Transactional accuracy guaranteed** — price, brand, and size come from the receipt text, not from a model inference. These fields are permanently protected after save via `receipt_locked_fields`.
- **Per-item region selection** — draggable selector boxes isolate individual items on multi-item receipt images. OCR fires only on the selected sub-regions, not the full page.
- **Image receipts get full visual analysis** — GarmentVision's SegFormer runs concurrently with OCR for image inputs, producing rich aesthetic metadata at no extra latency cost.
- **Closet linking** — a receipt item can be matched to an *existing* closet entry: only empty commercial fields (price, brand, size) are patched; the user's edited title and thumbnail are untouched.
- **Optimistic UI** — items appear in the Closet grid immediately via `closetStore.upsert`; GarmentVision enrichment continues in the background asynchronously.
- **12-language localisation** — full RTL support for Arabic and Hebrew; every string uses the `{ defaultValue }` audit rule.

---

## 2. Comprehensive User Manual

### 2.1 Mode A — Paste Text

1. The **Paste Text** sub-tab is selected by default (`importMode = 'text'`).
2. A `<textarea>` renders with a multilingual placeholder example.
3. The user pastes raw email body, receipt text, or invoice content. **No network call fires at this stage**.
4. The selector overlay renders over the text preview region. Each selector's `{y, h}` percentages map to character-line offsets via `cropText()`.
5. Clicking **Extract Selected Items** iterates each selector, calls `cropText(receiptText, sel)`, and POSTs the sub-string to `/closet/parse-receipt` with `text=<fragment>`.
6. The backend sends the text directly to Gemini; `run_visual()` returns `None` (no image bytes).

---

### 2.2 Mode B — Upload File (Image)

1. The user selects **Upload File** and picks a JPEG, PNG, WEBP, or HEIC file.
2. `handleImportFileChange` detects `file.type.startsWith('image/')` and **returns immediately** after `setImportFile(file)`. A `useEffect` watching `importFile` calls `URL.createObjectURL(importFile)` → `setImagePreviewUrl(url)`. **Zero network calls on upload**.
3. The image renders inside the preview container with the draggable selector overlay on top.
4. On **Extract Selected Items**, for each selector:
   - `cropImageFile(importFile, sel)` draws the region onto an off-screen `<canvas>` and exports a JPEG `Blob` at 90% quality.
   - The cropped `File` is appended to `FormData` as `file=crop-N.jpeg`.
   - The backend detects `"image" in mime_type` → sets `is_image = True` → runs `asyncio.gather(run_ocr(), run_visual())`.
5. If the backend returns `image_base64`, the card shows a GarmentVision-cropped thumbnail; otherwise the browser-cropped JPEG is used directly.

> **Credit efficiency:** The previous architecture OCR'd the entire image the moment the user selected it. The current architecture defers OCR to extract-time, running only on the user-selected sub-regions. A 4-item receipt goes from 1 full-page OCR call to 4 small-region calls at a fraction of the token cost.

---

### 2.3 Mode C — Upload File (PDF)

1. The user picks a `.pdf` file.
2. `handleImportFileChange` detects `isPdf === true` and **immediately** triggers `api.extractPdfText(formData)`.
3. Loading toast: *"Extracting text using Gemini OCR…"*
4. The backend's `/closet/extract-pdf-text` endpoint:
   - **Primary path:** Gemini Multimodal OCR with a column-merge prompt.
   - **Fallback:** `pypdf.PdfReader` local text extraction (PDF only, no Gemini credits consumed).
5. On success, `receiptText` is populated; a success toast confirms.
6. The selector overlay renders over the text preview. **Extract Selected Items** then uses `cropText()` to isolate line ranges per-selector.

> **Why OCR on upload for PDFs?** `canvas.drawImage()` cannot render PDF content. Text must be extracted before selectors can meaningfully crop a line range.

---

### 2.4 Mode D — Web Link

1. The user pastes any URL (order confirmation page, or direct link to a JPEG/PDF invoice).
2. No network call fires on typing.
3. On **Extract Selected Items**, each selector POSTs `url=<value>` to `/closet/parse-receipt`.
4. The backend fetches the URL via `httpx` with a browser-like User-Agent, follows redirects, and routes by content type:
   - `image/*` → multimodal binary part + `is_image = True` (full dual-path).
   - `text/html` → `resp.text` string part.
5. A 15-second fetch timeout guards against slow merchant servers.

---

### 2.5 The Selector System

| Property | Details |
|---|---|
| **State shape** | `selectors: [{id, x, y, w, h}]` — all values as % of the container |
| **Initial state** | `[{id:1, x:0, y:10, w:100, h:2}]` — one full-width selector at 10% from top |
| **Add** | `handleAddSelector()` stacks below the last box, inheriting its width |
| **Move** | onMouseDown/onTouchStart records delta; onMouseMove updates (x,y) in state |
| **Resize** | 8-direction edge/corner hit zones update (w,h) clamped to container bounds |
| **Remove** | `handleRemoveSelector(id)` filters the entry from state |
| **Label** | `t('addItem.selectorItemLabel', {n: idx+1})` — fully localised in 12 locales |
| **Drag session** | `dragState: {id, type, startX, startY, origX, origY, origW, origH}` — null on mouseUp |

---

### 2.6 Extracted Item Cards

| Field | Derivation |
|---|---|
| Thumbnail | Browser-cropped JPEG → `res.image_base64` from GarmentVision → generated SVG placeholder |
| Name | `res.name` or `"{brand} {item_type}"` |
| Brand | `res.brand` or `"Generic"` |
| Category | One of: Top, Bottom, Outerwear, Full Body, Footwear, Underwear, Accessories |
| Size | `res.size` or `"M"` |
| Price | `res.price_cents / 100` formatted with locale currency |
| Colors | `res.colors[]` normalised to `{name, pct:null}` objects |
| Selected | Checkbox toggle via `handleToggleItemSelect(id)` |

**Card actions:**

- **Attach Photo** — opens hidden `<input type="file" ref={itemImageInputRef}>` bound to `activeItemForImage` ID. FileReader stores the image as `base64Image` on the card.
- **Link to Closet Item** — opens closet picker (`closetModalOpen = true`). Selecting a match calls `handleLinkItem(closetItem)`, sets `item.closetItem`, and copies its image URL if the card has none.
- **Linked chip** — tapping opens `closetItemDetailPane` showing full detail of the linked closet entry (image, title, brand/category/size, price).

---

### 2.7 Save & Ingest Flow

```
1. Filter extractedItems where selected === true → itemsToSave
2. setIngestPhase('saving') → setIngestProgress({done:0, total:N})
3. For each item:
   ├─ if item.closetItem → api.updateItem(patch: brand/size/price only, title untouched)
   └─ else → api.createItem({ from_receipt:true, receipt_locked_fields, image_base64? })
   closetStore.upsert(result)   ← optimistic: grid updates immediately
   ingestProgress.done++        ← progress ring advances
4. setIngestPhase('syncing')
5. await closetStore.prewarm({ force: true })   ← full server re-fetch
6. Clear state → nav('/closet')
```

---

### 2.8 Ingest Overlay Animation

A `<AnimatePresence>` block positioned `absolute inset-0 z-50` renders during the save phase:

- **SVG progress ring:** `<motion.circle>` with `strokeDasharray = 2π×34` and `strokeDashoffset = (2π×34)×(1 − done/total)` during saving; `0` (complete) during syncing.
- **Phase icon:** ✦ Sparkles (saving) → spinning ↺ RefreshCw (syncing).
- **Phase label:** `AnimatePresence mode="wait"` keyed on `ingestPhase`, fades `{y:6}→{y:0}` on enter, `{y:-6}` on exit.
- **Counter pill:** monospace `done / total` badge (saving phase only).
- **Backdrop:** `hsl(var(--background)/0.92)` with `backdrop-filter: blur(12px)`.

---

### 2.9 Error Handling Reference

| Scenario | Feedback |
|---|---|
| PDF OCR fails (Gemini + pypdf) | `toast.error(detail or t('addItem.import.textError'))` |
| No text found in PDF/image | `toast.error(t('addItem.import.textEmpty'))` |
| `/closet/parse-receipt` fails for a selector | `toast.error(detail or t('addItem.import.error'))` |
| Save with nothing selected | `toast.error(t('addItem.import.noSelectedItems'))` |
| `createItem` or `updateItem` fails | `toast.error(detail or t('addItem.import.saveFailed'))` |
| Web URL fetch fails (4xx/5xx/timeout) | `HTTPException(400, "Failed to fetch receipt from URL…")` |

---

## 3. Technology Stack & Capability Deep-Dive

### 3.1 Frontend State Variables (AddItem.jsx lines 271–305)

| Variable | Type | Role |
|---|---|---|
| `importMode` | `'text' | 'file' | 'url'` | Active sub-mode |
| `importFile` | `File | null` | Selected file object |
| `importUrl` | `string` | Web link URL |
| `receiptText` | `string` | OCR-extracted or pasted text |
| `imagePreviewUrl` | `string | null` | `URL.createObjectURL(importFile)` |
| `isExtracting` | `boolean` | Disables Extract button; shows spinner |
| `selectors` | `{id,x,y,w,h}[]` | Selector regions in % |
| `dragState` | `object | null` | Active drag/resize session |
| `extractedItems` | `ExtractedItem[]` | Parsed item cards |
| `linkingItemId` | `string | null` | Card whose closet-link dialog is open |
| `closetModalOpen` | `boolean` | Closet picker visibility |
| `closetSearch` | `string` | Search query inside closet picker |
| `activeItemForImage` | `string | null` | Card whose photo-attach input is active |
| `closetItemDetailPane` | `object | null` | Detail dialog for linked closet item |
| `ingestPhase` | `null | 'saving' | 'syncing'` | Overlay phase |
| `ingestProgress` | `{done, total}` | Ring progress |
| `saving` | `boolean` | Top-level save spinner |

---

### 3.2 `cropImageFile` — Browser-Side Canvas Crop (lines 504–538)

```javascript
const x = (selector.x / 100) * img.width;
const y = (selector.y / 100) * img.height;
const w = (selector.w / 100) * img.width;
const h = (selector.h / 100) * img.height;
canvas.width = w; canvas.height = h;
ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
canvas.toBlob(resolve, 'image/jpeg', 0.9);   // 90% JPEG quality
```

The result is a `File` named `crop-{selectorId}-{originalFilename}` submitted as `file` in the multipart request.

---

### 3.3 `cropText` — Text-Layer Selector Crop (lines 540–545)

```javascript
const lines = text.split('\n');
const startLine = Math.floor((selector.y / 100) * lines.length);
const endLine   = Math.ceil(((selector.y + selector.h) / 100) * lines.length);
return lines.slice(startLine, endLine).join('\n');
```

`selector.y / 100` is the fraction-from-top of the text block, converted to a line index.

---

### 3.4 Backend — `POST /closet/parse-receipt`

**Input routing:**

| Input | Condition | `parts` content | `is_image` |
|---|---|---|---|
| `text` param | non-blank string | `[text_string]` | False |
| file — text type | MIME starts with `text/` or known ext | `[decoded_utf8]` | False |
| file — binary | PDF or image | `[(bytes, mime)]` | True if image |
| url — HTML | `text/html` response | `[resp.text]` | False |
| url — image/PDF | Binary content-type | `[(content, ct)]` | True if image |

**Dual-path concurrent analysis (lines 6038–6039):**

```python
ocr_result, visual_result = await asyncio.gather(run_ocr(), run_visual())
```

- **`run_ocr()`** — Gemini Vision with wardrobe-cataloguing system prompt; `response_mime_type="application/json"`; code-fence stripping before `json.loads`.
- **`run_visual()`** — `detect_items(image_bytes)` → largest bbox → `_bbox_crop_useful` → `analyze(crop_bytes, language=user_lang)`. Returns `{visual_analysis, image_base64, image_mime}`.

**Gemini system prompt extracts seven fields:**
`brand` · `item_type` (singular lowercase noun) · `size` · `price_cents` (integer cents after discount) · `colors` (lowercase list) · `category` (constrained to 7 canonical values) · `name` (friendly descriptive label)

**Field merge priority (lines 6041–6086):**

| Priority | Fields | Source |
|---|---|---|
| OCR wins | `brand`, `size`, `price_cents`, `category`, `item_type`, `name/title` | Receipt/invoice text |
| Vision wins | `colors`, `fabric_materials`, `pattern`, `dress_code`, `season` | GarmentVision SegFormer |
| Defaults | `brand→Generic`, `size→M`, `category→Top` | Applied when both are empty |

---

### 3.5 Backend — `POST /closet/extract-pdf-text`

```python
# Primary: Gemini Multimodal OCR (temperature=0.0)
# Prompt: horizontal column-merge extraction, row-by-row
ocr_text = await gemini.vision(user_parts=[prompt, (file_bytes, mime_type)], temperature=0.0)

# Fallback (PDF only, no Gemini credits):
reader = pypdf.PdfReader(io.BytesIO(file_bytes))
text = "".join(page.extract_text() or "" for page in reader.pages)
```

The column-merge prompt is critical for multi-column store invoices where item name, SKU, and price appear in adjacent columns that naive extractors produce as separate vertical text blocks.

---

### 3.6 Receipt-Locked Field System

**Frontend lock computation (lines 963–972):**

```javascript
const receiptLockedFields = [
  item.name         ? 'title'                : null,
  item.brand        ? 'brand'                : null,
  item.size         ? 'size'                 : null,
  item.price_cents  ? 'price_cents'          : null,
  item.price_cents  ? 'purchase_price_cents' : null,
  item.category     ? 'category'             : null,
  item.colors?.length ? 'colors'             : null,
  item.colors?.length ? 'color'              : null,
].filter(Boolean);
```

Only fields that *actually have receipt data* are locked — a missing field remains freely fillable by later GarmentVision analysis.

**Backend persistence (lines 998–1000):**

```python
doc["from_receipt"] = True
doc["receipt_locked_fields"] = list(payload.receipt_locked_fields or [])
```

**Merge enforcement in `_run_background_matte_and_analyze` (lines 726–741):**

```python
locked = set(receipt_locked_fields or [])
for key in ANALYSIS_KEYS:          # 19 keys: title, brand, dress_code, season, …
    if key in locked:
        continue                   # Never overwrite receipt data
    current = item_doc.get(key)
    if current or current == 0:
        continue                   # Fill-empty-only for non-locked fields
    update_doc[key] = analysis[key]  # Safe to apply
```

The lock also applies in `PATCH /closet/{id}` (lines 4360–4369), so editing a receipt item through the closet detail view also respects the permanent protection.

**All 11 `receipt_locked_fields` references in closet.py:**

| Line | Context |
|---|---|
| L189 | Inline comment in `CreateItemPayload` |
| L196 | Pydantic field definition |
| L643 | `_run_background_matte_and_analyze` parameter |
| L654 | Docstring merge-rule section |
| L726 | Runtime `locked = set(receipt_locked_fields or [])` |
| L1000 | `create_item` persistence |
| L1040 | `create_item` background task comment |
| L1047 | `create_item` task dispatch argument |
| L4273 | `update_item` docstring |
| L4360 | `update_item` protected-set comment |
| L4363 | `update_item` runtime enforcement |

---

### 3.7 Background GarmentVision Pipeline

When `from_receipt=True` and an image is present, `create_item` queues:

```python
background_tasks.add_task(
    _run_background_matte_and_analyze,
    item_id, raw_for_bg, payload.category,
    list(payload.receipt_locked_fields or []),
)
```

**Task chain:**

```
Step 1: _run_background_matte(item_id, raw_bytes, category)
    └─ rembg (u2netp) background removal
    └─ Writes clean_image_url + clean_image_status to MongoDB

Step 2: garment_vision_service.analyze(raw_bytes, language=user_lang)
    └─ Full 18-field Gemini VLM taxonomy pass
    └─ _safe_analysis() sanitisation
    └─ _is_unidentifiable() guard — aborts if Gemini returns noise
    └─ Field merge: fill-empty + locked-field enforcement
    └─ MongoDB update_one
```

**All failure modes are soft** — rembg failure, GarmentVision unavailable, unidentifiable result, and any unhandled exception all log and exit cleanly, leaving the item's receipt data intact.

For receipt items created **without a photo**, no pipeline runs at all — the receipt data is the complete dataset.

---

### 3.8 Closet Store Synchronisation

```javascript
// Per-item: optimistic (instant)
closetStore.upsert(created.item);

// After all items saved: authoritative
setIngestPhase('syncing');
await closetStore.prewarm({ force: true });
```

`closetStore` is built on React 19's `useSyncExternalStore`. The forced `prewarm` ensures:
- All open browser tabs see new items immediately via the `storage` event.
- `clean_image_url`, `clean_image_status`, and background-pipeline results are visible the moment the user arrives on `/closet`.
- The Closet grid does not serve stale cache entries until TTL expiry.

---

### 3.9 API Client Methods (`frontend/src/lib/api.js`)

```javascript
parseReceipt: (formData) =>
  client.post('/closet/parse-receipt', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,    // 60 s — GarmentVision + Gemini
  }).then(r => r.data),

extractPdfText: (formData) =>
  client.post('/closet/extract-pdf-text', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,    // 30 s — OCR only
  }).then(r => r.data),
```

---

### 3.10 Localisation (12 Locales)

| Key | Default (en) |
|---|---|
| `addItem.tabs.import` | Digital Import |
| `addItem.tabs.upload` | Camera & Upload |
| `addItem.import.extractButton` | Extract Selected Items |
| `addItem.import.extracting` | Extracting items… |
| `addItem.import.extractingText` | Extracting text using Gemini OCR… |
| `addItem.import.textExtracted` | Text extracted successfully via Gemini OCR! |
| `addItem.import.textEmpty` | No readable text found. |
| `addItem.import.textError` | Failed to extract text. |
| `addItem.import.success` | Successfully extracted items! |
| `addItem.import.error` | Could not parse receipt. Please verify formatting and try again. |
| `addItem.import.noSelectedItems` | Please select at least one item to save. |
| `addItem.import.saveFailed` | Ingestion failed |
| `addItem.import.ingestCataloguing` | Cataloguing item {{done}} of {{total}}… |
| `addItem.import.ingestSyncing` | Syncing to your Closet… |
| `addItem.import.ingestAnalysisHint` | Running rembg & Gemini Vision in the background. |
| `addItem.import.ingestSyncingHint` | Refreshing your wardrobe — almost there. |
| `addItem.selectorItemLabel` | Item {{n}} |

---

## 4. API Contract Reference

### `POST /closet/parse-receipt`

**Auth:** Bearer JWT · **Content-Type:** `multipart/form-data` · **Timeout:** 60 s

**Request** — exactly one of:

| Field | Type | Description |
|---|---|---|
| `text` | `string` | Pasted receipt or email body |
| `file` | `UploadFile` | Image (JPEG/PNG/WEBP/HEIC) or PDF |
| `url` | `string` | URL to a receipt page or image/PDF |

**Response:**

```json
{
  "name": "Wosawe Wind Jacket Lightweight",
  "title": "Wosawe Wind Jacket Lightweight",
  "brand": "Wosawe",
  "item_type": "jacket",
  "size": "M",
  "price_cents": 7966,
  "category": "Outerwear",
  "colors": [{"name": "blue", "pct": null}],
  "image_base64": "<base64-jpeg-of-garment-crop>",
  "image_mime": "image/jpeg"
}
```

`image_base64` / `image_mime` are only present when GarmentVision produced a garment crop.

---

### `POST /closet/extract-pdf-text`

**Auth:** Bearer JWT · **Content-Type:** `multipart/form-data` · **Timeout:** 30 s

**Request:** `file: UploadFile` (PDF or image)

**Response:** `{ "text": "<extracted string>" }`

---

## 5. Design Decisions & Edge Cases

| Decision | Rationale |
|---|---|
| **Images skip upfront OCR** | Deferring to extract-time reduces credits per session; N-item receipts go from 1 full-page OCR to N small-region calls at a fraction of the token cost |
| **PDFs OCR on upload** | `canvas.drawImage()` cannot render PDF content; text must be extracted before selectors can meaningfully crop a line range |
| **`asyncio.gather` for OCR + Vision** | Both calls are I/O-bound and independent; concurrent execution cuts per-item latency from ~4 s sequential to ~2.5 s |
| **`receipt_locked_fields` is granular** | Only fields that *actually have receipt data* are locked; missing fields remain freely fillable by later GarmentVision analysis |
| **Title excluded from closet-link patch** | `handleSaveExtractedItems` link path patches only `brand`, `size`, `price_cents`, `purchase_price_cents` — user's edited title is never overwritten |
| **SVG placeholder fallback** | When no image is available, a branded SVG is generated client-side using `btoa(unescape(encodeURIComponent(svg)))` with brand/type text in SVG `<text>` nodes |
| **`cropImageFile` JPEG at 0.9 quality** | 90% quality preserves enough detail for Gemini's OCR without inflating the FormData payload size |
| **`_is_unidentifiable` guard in background task** | Prevents GarmentVision garbage output from polluting a receipt item that already has clean, authoritative receipt metadata |
| **`prewarm({ force: true })` after save** | Without forced re-fetch, the closet cache would serve stale entries until TTL expiry; force ensures real thumbnails and pipeline status are visible immediately |
| **SVG detection by data URI prefix** | `item.base64Image.startsWith('data:image/svg+xml')` marks the item as "no photo" so `from_receipt` items with placeholder SVGs do not trigger the GarmentVision pipeline |
