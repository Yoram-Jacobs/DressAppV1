# Comprehensive Analysis: Web AddItem & API Client Mapping for ClosetAddScreen (Milestone M3)

## 1. Executive Summary

This report maps out the web implementation of `AddItem` (`apps/web/src/pages/AddItem.jsx`), the `@dressapp/api-client` package, the backend schema and endpoints in `backend/app/api/v1/closet.py`, and the design tokens/conventions in `apps/mobile/` to guide the implementation of `ClosetAddScreen.tsx`.

### Critical Architecture Discovery
- **API Client Module**: The dispatch task references `packages/api-client/src/items.js`. In the codebase, **`packages/api-client/src/items.js` does NOT exist**. Closet and garment item operations are implemented in **`packages/api-client/src/closet.js`** under the `closet` object.
- **Public API Wiring**: `packages/api-client/src/index.js` merges `closet` into the combined `api` object via `buildApi()`. In mobile, `apps/mobile/src/lib/api.ts` exports `api` (where `api.createItem` is exposed) as well as the named export `closet`.
- **Payload Format**: `createItem(body)` sends a standard **JSON** payload (`application/json`) with base64-encoded image data (`image_base64`, `image_mime`), NOT multipart `FormData`.
- **Form Validation & Image Picking**: `apps/mobile/package.json` contains `react-hook-form ^7.56.2`, `zod ^3.24.4`, and `expo-image-picker ~16.1.4`.

---

## 2. Web Implementation Analysis (`apps/web/src/pages/AddItem.jsx`)

### 2.1 Overview and Entry Modes
`AddItem.jsx` (4,499 lines) is the comprehensive garment ingestion hub on web. It supports several ingestion flows:
1. **Photo Upload**: Multi-file and single-file picker using FileReader to base64 (`fileToBase64`).
2. **Camera Capture**: Hidden file input with `capture="environment"`.
3. **URL Import**: Remote image fetching via `api.fetchImageUrl(url)`.
4. **DPP Scanner**: Digital Product Passport QR scanning via `api.importDpp(payload)` and `<DppScanner />`.
5. **Receipt / Document Ingest**: OCR text extraction via `api.extractPdfText(formData)` or `api.parseReceipt(formData)`.

For the native mobile **manual form flow** (Requirement R3):
- DPP and live camera scanning are excluded and replaced with a "Camera scan coming soon" placeholder.
- The core manual form flow captures: **Image Selection**, **Title / Name**, **Category**, **Brand**, **Size**, and **Color**.

### 2.2 Form Fields and Sections Breakdown

In `AddItem.jsx`, field state is managed under a `fields` object initialized with `blankFields()` (lines 171–189):

```js
const blankFields = () => ({
  name: '', title: '', caption: '',
  category: '', sub_category: '', item_type: '', brand: '',
  gender: '', dress_code: '', season: [], tradition: '',
  colors: [], fabric_materials: [], pattern: '',
  state: '', condition: '', quality: '',
  size: '', price_cents: 0, currency: getDefaultCurrency(),
  marketplace_intent: 'own',
  repair_advice: '',
  tags: [],
  image_quality_status: '',
  image_quality_reason: '',
  reconstruction_prompt: '',
});
```

#### A. Basic Info Section (lines 3804–3837, 3960–3991, 4095–4138)
| Field | Type | Control | Web Key / Test ID | Required / Default |
|---|---|---|---|---|
| **Item Name / Title** | `string` | Text input | `name` / `add-item-name` | **Required** (fallback to "Unnamed garment") |
| **Category** | `string` (enum) | Select dropdown | `category` / `add-item-category` | **Required** (default: `'Top'`) |
| **Brand** | `string` | Text input | `brand` / `add-item-brand` | Optional (e.g. "Zara", "Levi's") |
| **Size** | `string` | Text input | `size` / `add-item-size` | Optional (e.g. "M", "32", "US 10") |
| **Sub-category** | `string` | Text input | `sub_category` / `add-item-subcategory` | Optional (e.g. "Shirt", "Sneakers") |
| **Item Type** | `string` | Text input | `item_type` / `add-item-itemtype` | Optional (e.g. "Oxford shirt") |
| **Caption / Notes** | `string` | Textarea | `caption` / `add-item-caption` | Optional |

#### B. Styling Details Section (lines 3839–3893, 4005–4093, 4140–4182, 4214–4252)
| Field | Type | Options / Structure | Web Key |
|---|---|---|---|
| **Gender** | `enum` | `'men'`, `'women'`, `'unisex'`, `'kids'` | `gender` |
| **Dress Code** | `enum` | `'casual'`, `'smart-casual'`, `'business'`, `'formal'`, `'athletic'`, `'loungewear'` | `dress_code` |
| **Pattern** | `enum` | `'solid'`, `'striped'`, `'plaid'`, `'floral'`, `'herringbone'`, `'polka'`, `'paisley'`, `'geometric'`, `'abstract'` | `pattern` |
| **Tradition** | `string` | Free text (e.g. "arabic", "jewish") | `tradition` |
| **Season** | `string[]` | Array of `'spring'`, `'summer'`, `'fall'`, `'winter'`, `'all'` | `season` |
| **Colors** | `WeightedTag[]` | Array of `{ name: string, pct: number }` + primary `color` string | `colors`, `color` |
| **Tags** | `string[]` | Array of strings with tag chips | `tags` |
| **Marketplace Intent** | `enum` | `'own'`, `'for_sale'`, `'donate'`, `'swap'`, `'rent'` | `marketplace_intent` |
| **Price (Cents)** | `number` | Whole units in UI (multiplied by 100 for API) | `price_cents` |
| **Currency** | `string` | e.g. `'USD'`, `'EUR'`, `'ILS'` | `currency` |

#### C. Care & Quality Section (lines 3895–3950, 4184–4212)
| Field | Type | Options | Web Key |
|---|---|---|---|
| **State** | `enum` | `'new'`, `'used'` | `state` |
| **Condition** | `enum` | `'bad'`, `'fair'`, `'good'`, `'excellent'` | `condition` |
| **Quality** | `enum` | `'budget'`, `'mid'`, `'premium'`, `'luxury'` | `quality` |
| **Fabric Materials** | `WeightedTag[]` | Array of `{ name: string, pct: number }` | `fabric_materials` |
| **Repair Advice** | `string` | Free text | `repair_advice` |

### 2.3 Payload Construction (`buildCreatePayload`, lines 4306–4380)

In `AddItem.jsx`, `buildCreatePayload` strips undefined keys and maps fields:
```js
function buildCreatePayload(card, inSuitcase = false) {
  const f = card.fields || {};
  const asBase64 = card.base64;
  const body = {
    source: f.marketplace_intent && f.marketplace_intent !== 'own' ? 'Shared' : 'Private',
    name: f.name || undefined,
    title: f.name || f.title || 'Unnamed garment',
    caption: f.caption || undefined,
    category: f.category || 'Top',
    sub_category: f.sub_category || undefined,
    item_type: f.item_type || undefined,
    brand: f.brand || undefined,
    gender: f.gender || undefined,
    dress_code: f.dress_code || undefined,
    season: f.season || [],
    tradition: f.tradition || undefined,
    size: f.size || undefined,
    color: (f.colors && f.colors[0]?.name) || f.color || undefined,
    colors: (f.colors || []).filter((c) => c.name),
    fabric_materials: (f.fabric_materials || []).filter((c) => c.name),
    pattern: f.pattern || undefined,
    state: f.state || undefined,
    condition: f.condition || undefined,
    quality: f.quality || undefined,
    repair_advice: f.repair_advice || undefined,
    price_cents: f.price_cents === '' || f.price_cents == null ? 0 : Number(f.price_cents),
    currency: f.currency || 'USD',
    marketplace_intent: f.marketplace_intent || 'own',
    tags: f.tags || [],
    image_base64: asBase64 || undefined,
    image_mime: asBase64 ? (card.mime || card.file?.type || 'image/jpeg') : undefined,
    in_suitcase: inSuitcase ? true : undefined,
  };
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}
```

---

## 3. API Client & Endpoint Investigation

### 3.1 API Client Implementation (`packages/api-client/src/closet.js`)
The `closet` object provides the following exact methods:

```js
export const closet = {
  // List user's wardrobe items
  listCloset: (params = {}) => client.get('/closet', { params }).then((r) => r.data),

  // Retrieve single item
  getItem: (id) => client.get(`/closet/${id}`).then((r) => r.data),

  // Create new item (POST /closet) - JSON payload
  createItem: (body) => client.post('/closet', body).then((r) => r.data),

  // Update item (PATCH /closet/:id)
  patchItem: (id, body) => client.patch(`/closet/${id}`, body).then((r) => r.data),
  updateItem: (id, body) => client.patch(`/closet/${id}`, body).then((r) => r.data),

  // Delete item (DELETE /closet/:id)
  deleteItem: (id) => client.delete(`/closet/${id}`).then((r) => r.data),

  // Update item image directly
  setItemPhoto: (itemId, { imageBase64, imageMime = 'image/jpeg', autoSegment = true, language }) =>
    client.post(`/closet/${itemId}/photo`, { image_base64: imageBase64, image_mime: imageMime, auto_segment: autoSegment, ...(language ? { language } : {}) }, { timeout: 120000 }).then((r) => r.data),

  // Analyze image via Gemini / SegFormer
  analyzeItemImage: (body, callbacks) => { ... },
};
```

### 3.2 Backend Endpoint Implementation (`backend/app/api/v1/closet.py`)
- **Route**: `@router.post("", status_code=201)` (Mounts to `/api/v1/closet`)
- **Schema Model**: `CreateItemIn` (`pydantic.BaseModel` with `extra="forbid"`)
- **Processing Steps**:
  1. **Quota Check** (lines 284–304): If user is on `free` tier, verifies count against limit (`50 + bonus`). Returns `402 Payment Required` if limit is exceeded.
  2. **Image Compression & Validation** (lines 305–329): If `image_base64` is provided, decodes and compresses it (max dimension 1024, quality 75) and detects MIME type.
  3. **Document Assembly** (lines 330–383): Instantiates `ClosetItem` model with UUID and ISO-8601 timestamps.
  4. **Image URL Formatting** (lines 389–410): Formats `original_image_url` as `data:{image_mime};base64,{image_base64}`.
  5. **Auto-Listing Integration** (lines 586–631): If `marketplace_intent` is `'for_sale'`, `'donate'`, `'swap'`, or `'rent'`, automatically generates an active listing in `db.listings` and marks the item `source="Shared"`.
  6. **Background Tasks** (lines 523–570): Triggers transcoding pipeline (WebP/AVIF generation) and FashionCLIP similarity embedding asynchronously without blocking the response.
  7. **Database Insertion** (line 643): Inserts item into `db.closet_items`.
  8. **Response** (line 663): Returns `doc` (status 201).

---

## 4. Taxonomy, Enums, and Option Values

### 4.1 Categories
The canonical 7 categories defined across `AddItem.jsx`, `ItemDetail.jsx`, and `taxonomy.js`:
1. `Top` (T-shirts, shirts, blouses, sweaters, hoodies)
2. `Bottom` (Pants, jeans, shorts, skirts, leggings)
3. `Outerwear` (Jackets, coats, blazers, vests)
4. `Full Body` (Dresses, jumpsuits, rompers, suits)
5. `Footwear` (Sneakers, boots, sandals, heels, loafers)
6. `Accessories` (Bags, hats, belts, scarves, jewelry, watches)
7. `Underwear` (Intimates, loungewear, socks)

### 4.2 Standard Colors
From `CANONICAL_COLORS` in `apps/web/src/lib/taxonomy.js`:
- `white`, `black`, `grey`, `light_grey`, `charcoal_grey`
- `burgundy`, `brown`, `terracotta_brown`, `beige`, `cream`, `champagne_gold`
- `blue`, `light_blue`, `navy`
- `green`, `olive`
- `yellow`, `orange`, `pink`, `purple`, `red`

### 4.3 Standard Sizes
Common clothing & footwear sizes:
- General / Tops / Dresses: `XS`, `S`, `M`, `L`, `XL`, `XXL`, `3XL`, `One Size`
- Pants / Waist: `28`, `29`, `30`, `31`, `32`, `33`, `34`, `36`, `38`, `40`
- Shoes (US): `6`, `6.5`, `7`, `7.5`, `8`, `8.5`, `9`, `9.5`, `10`, `10.5`, `11`, `11.5`, `12`
- Shoes (EU): `36`, `37`, `38`, `39`, `40`, `41`, `42`, `43`, `44`, `45`, `46`
- Free-form text input is supported to accommodate international sizing conventions.

### 4.4 Additional Enums
- **Gender**: `men`, `women`, `unisex`, `kids`
- **Dress Code**: `casual`, `smart-casual`, `business`, `formal`, `athletic`, `loungewear`
- **Season**: `spring`, `summer`, `fall`, `winter`, `all`
- **State**: `new`, `used`
- **Condition**: `bad`, `fair`, `good`, `excellent`
- **Quality**: `budget`, `mid`, `premium`, `luxury`
- **Pattern**: `solid`, `striped`, `plaid`, `floral`, `herringbone`, `polka`, `paisley`, `geometric`, `abstract`
- **Marketplace Intent**: `own` (Keep in closet), `for_sale` (Sell), `donate` (Donate), `swap` (Swap), `rent` (Rent)

---

## 5. Error Handling and API Response Data Structures

### 5.1 Success Response (HTTP 201 Created)
Returns the created `ClosetItem` JSON object:
```json
{
  "id": "7b8f9c12-3456-4789-abcd-ef0123456789",
  "user_id": "usr_12345678",
  "schemaVersion": 1,
  "source": "Private",
  "name": "Linen Summer Shirt",
  "title": "Linen Summer Shirt",
  "caption": "Breathable white linen shirt for summer",
  "category": "Top",
  "sub_category": "Shirt",
  "item_type": "Linen shirt",
  "brand": "Uniqlo",
  "gender": "unisex",
  "dress_code": "casual",
  "season": ["summer"],
  "size": "L",
  "color": "white",
  "colors": [{ "name": "white", "pct": 100 }],
  "fabric_materials": [{ "name": "linen", "pct": 100 }],
  "pattern": "solid",
  "state": "used",
  "condition": "excellent",
  "quality": "mid",
  "price_cents": 0,
  "currency": "USD",
  "marketplace_intent": "own",
  "original_image_url": "data:image/jpeg;base64,...",
  "thumbnail_data_url": "data:image/jpeg;base64,...",
  "created_at": "2026-08-17T10:50:00.000Z",
  "updated_at": "2026-08-17T10:50:00.000Z"
}
```

### 5.2 Error Response Codes & Formats
| Status Code | Cause | Backend Response Body | Recommended Mobile UI Handling |
|---|---|---|---|
| **400 Bad Request** | Invalid base64 or corrupt image bytes | `{"detail": "Invalid image_base64: ..."}` | Show `Alert.alert('Error', err.response?.data?.detail)` |
| **401 Unauthorized** | Expired/missing auth token | `{"detail": "Not authenticated"}` | Managed automatically by `api.ts` `onUnauthorized` handler |
| **402 Payment Required** | Free closet capacity reached (50 items) | `{"detail": {"code": "closet_capacity_exceeded", "message": "You have reached your free closet capacity...", "capacity": 50, "current_count": 50}}` | Alert user with option to upgrade subscription |
| **422 Unprocessable Entity** | Missing `title` or `category`, or unknown enum key | `{"detail": [{"loc": ["body", "category"], "msg": "Field required", "type": "missing"}]}` | Inline field error message / Form validation toast |
| **500 / 502 / 503** | Server error or timeout | `{"detail": "Internal server error"}` | Show retry prompt |

---

## 6. Implementation Architecture for `ClosetAddScreen.tsx`

### 6.1 Requirements from `ORIGINAL_REQUEST.md` (R3)
1. **Replace Stub**: Replace `apps/mobile/src/screens/closet/ClosetAddScreen.tsx` (> 3 KB).
2. **Core Interaction Loop**:
   - Image picker via `expo-image-picker` (`launchImageLibraryAsync`).
   - Form fields: Name/Title, Category, Color, Brand, Size.
   - Form validation via `react-hook-form` + `zod`.
   - Submit button that executes `api.createItem(payload)` and navigates back to `ClosetScreen` on success.
3. **Excluded Sub-features**:
   - Camera live capture & DPP scanner are excluded; render a "Camera scan coming soon" placeholder.
4. **Constraints**:
   - TypeScript only (`.tsx`).
   - No web APIs (`window`, `localStorage`, `document`, `navigator`).
   - Styling with `StyleSheet.create()` and design tokens from `@mobile/theme/tokens`.
   - RTL safe layout with `I18nManager.isRTL`.
   - Header / Navigation integration with `ClosetStackParamList`.

### 6.2 Zod Schema & Form Types
```ts
import { z } from 'zod';

export const CATEGORY_OPTIONS = [
  'Top',
  'Bottom',
  'Outerwear',
  'Full Body',
  'Footwear',
  'Accessories',
  'Underwear',
] as const;

export const ClosetAddSchema = z.object({
  title: z.string().trim().min(1, 'Item name is required').max(100),
  category: z.enum(CATEGORY_OPTIONS, {
    errorMap: () => ({ message: 'Please select a category' }),
  }),
  brand: z.string().trim().max(50).optional().or(z.literal('')),
  size: z.string().trim().max(20).optional().or(z.literal('')),
  color: z.string().trim().max(30).optional().or(z.literal('')),
  imageUri: z.string().optional().nullable(),
  imageBase64: z.string().optional().nullable(),
  imageMime: z.string().default('image/jpeg'),
});

export type ClosetAddFormValues = z.infer<typeof ClosetAddSchema>;
```

### 6.3 Image Picker Integration
```ts
import * as ImagePicker from 'expo-image-picker';

const handlePickImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission Denied', 'Photo library access is needed to pick an image.');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.7,
    base64: true,
  });

  if (!result.canceled && result.assets.length > 0) {
    const asset = result.assets[0];
    setValue('imageUri', asset.uri);
    setValue('imageBase64', asset.base64 || null);
    setValue('imageMime', asset.mimeType || 'image/jpeg');
  }
};
```

### 6.4 Submission Payload Mapping
```ts
const onSubmit = async (values: ClosetAddFormValues) => {
  setSubmitting(true);
  try {
    const payload = {
      title: values.title,
      name: values.title,
      category: values.category,
      brand: values.brand || undefined,
      size: values.size || undefined,
      color: values.color || undefined,
      colors: values.color ? [{ name: values.color, pct: 100 }] : [],
      source: 'Private' as const,
      marketplace_intent: 'own' as const,
      image_base64: values.imageBase64 || undefined,
      image_mime: values.imageBase64 ? (values.imageMime || 'image/jpeg') : undefined,
    };

    await api.createItem(payload);
    navigation.goBack();
  } catch (err: any) {
    const errorMsg = err?.response?.data?.detail?.message
      || err?.response?.data?.detail
      || err?.message
      || 'Failed to create item. Please try again.';
    Alert.alert('Error', typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
  } finally {
    setSubmitting(false);
  }
};
```

---

## 7. Verification and Checklist

1. **TypeScript Typecheck**:
   ```bash
   node ../../node_modules/typescript/bin/tsc --noEmit --skipLibCheck
   ```
2. **Web Build Safety Check**:
   ```bash
   yarn build
   ```
3. **No Unintended Edits**: Verify zero edits to `backend/`, `apps/web/`, `apps/mobile/src/navigation/types.ts`, or any `packages/` files.
