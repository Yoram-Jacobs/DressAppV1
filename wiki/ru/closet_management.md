# DressApp Closet Workspace: Architecture, User Manual & Technology Guide

This document provides a comprehensive, production-grade architectural analysis, operational user manual, and technology guide for the **DressApp Closet** ecosystem, anchored by `frontend/src/pages/Closet.jsx` and its supporting frontend/backend services.

---

## 1. Executive Summary & Value Proposition

### High-Level Overview

The **Closet** module is the central inventory command center of DressApp. Rather than relying on constant network round-trips, the Closet utilizes a client-side global store (`closetStore.js`) populated during application startup (prewarm). The page operates as an instant-paint, highly interactive catalog supporting:
- Multi-mode searching (Keyword vs. Semantic FashionCLIP search)
- Advanced drag-and-drop garment grouping (Multi-view support)
- NDJSON-streaming metadata repair processes
- Dynamic background matting (rembg) synchronization

### Architectural Flow

```mermaid
graph TD
    User([User]) -->|Filters / Search / Drag-Group| UI[Closet.jsx UI]
    
    subgraph Client_State_And_Store ["Client State & Store"]
        UI -->|useClosetStore Subscription| Snapshot[closetStore Snapshot]
        Snapshot -->|In-Memory Render| Grid[Instantly-Painted Grid]
        UI -->|Scroll to Top| ScrollTop[ScrollToTop Component]
    end

    subgraph User_Action_Flows ["User Action Flows"]
        UI -->|Drag & Drop Grouping| Gatekeeper[getTaxonomyMismatches Guard]
        Gatekeeper -->|No Mismatch / Override| GroupAPI[POST /closet/group]
        
        UI -->|Semantic Search| SemanticAPI[POST /closet/search/semantic]
        UI -->|Bulk Tag| TagAPI[POST /closet/tag-group]
        UI -->|Bulk Delete| DeleteAPI[POST /closet/delete-multiple]
    end

    subgraph Streaming_Repair_Handlers ["Streaming Repair Handlers"]
        UI -->|Repair Fingerprints| HashStream[POST /closet/repair-hashes]
        UI -->|Repair Thumbnails| ThumbStream[POST /closet/repair-thumbnails]
        
        HashStream -->|NDJSON event stream| HashChip[HashRepairChip Overlay]
        ThumbStream -->|NDJSON event stream| ThumbChip[ThumbRepairChip Overlay]
    end

    subgraph Backend_FastAPI_Execution ["Backend FastAPI Execution (/api/v1/closet)"]
        GroupAPI -->|Host / Member update| DB[(MongoDB)]
        GroupAPI -->|Queue Background Task| ReanalyzeTask[reanalyze_group_helper]
        
        SemanticAPI -->|Text Embedding| FashionCLIP[FashionCLIP Embedding Service]
        FashionCLIP -->|Vector Search| DB
        
        HashStream -->|Backfill dHash| DB
        ThumbStream -->|Regen stale thumbnails| DB
        
        UI -->|clean_image_status: pending| PollEndpoint[GET /closet/{id}]
        PollEndpoint -->|rembg completed| DB
    end

    ReanalyzeTask -->|Regenerate combined features| DB
    DB -->|incrementalSync event| Snapshot
```

### User Value Proposition

- **Zero-Latency Grid Painting**: By pulling from the pre-cached `closetStore` snapshot, navigating to `/closet` paints hundreds of items in under 16 ms, bypassing standard REST pagination delays.
- **Natural-Language Semantic Discovery**: Integrated with **FashionCLIP**, users can search using complex concepts (e.g., *"warm clothes for a rainy weekend"* or *"casual office layout"*) rather than just strict tag strings.
- **Multi-View Garment Grouping**: Users can group multiple detail views of the same physical garment under a single "Host" item via simple drag-and-drop. "Member" items are kept out of stylist proposals to prevent redundant layout advice.
- **Streamlined Photo Matting**: Automatically polls for background rembg completions, dynamically swapping in transparent PNG thumbnails the moment the server completes polishing.
- **Wardrobe Utilization Insights**: Integrates a "Times Worn" counter badge on every card and details card to help users easily identify and rotate low-utilization clothes.

---

## 2. Comprehensive User Manual

### 2.1 Visual Interface Topology

The Closet workspace layout structures options, filters, and items into distinct action layers:

```text
+------------------------------------------------------------------------------------+
|  [Select Mode]          [Tuning duplicate detector 12/48...]  [Create New Item]   |
+------------------------------------------------------------------------------------+
|  Search: [ Enter keywords or style concepts... ]  Search Mode: ( Keyword / Meaning )|
+------------------------------------------------------------------------------------+
|  Category: [ All ]  Source/Intent: [ All / Private / For Sale / Swap / Donate ]   |
+------------------------------------------------------------------------------------+
|                                                                                    |
|  Garments Grid:                                                                    |
|  +--------------------+  +--------------------+  +--------------------+            |
|  | [Source: Retail]   |  | [⭐ Host Item]     |  | [Sparkle overlay]  |            |
|  |                    |  |                    |  |                    |            |
|  |                    |  |                    |  |                    |            |
|  |  ( Garment Img )   |  |  ( Garment Img )   |  |  ( Garment Img )   |            |
|  |                    |  |                    |  |                    |            |
|  | Blue Shirt         |  | Black Jacket       |  | Grey Coat          |            |
|  | Top · Blue         |  | Outerwear · Black  |  | Outerwear · Grey   |            |
|  | [12 wears]         |  | [1 wear]           |  | [Syncing...]       |            |
|  +--------------------+  +--------------------+  +--------------------+            |
|                                                                                    |
+------------------------------------------------------------------------------------+
```

---

### 2.2 Operational Workflows

#### Filtering & Synonyms
The Closet sidebar uses filter dropdowns that match the backend's categorization logic:
- **Category Filter**: Filters by Top, Bottom, Outerwear, Shoes, Accessory, or Dress. The client translates plural variants via category synonyms:
  - `shoes` matches `shoes` and `footwear`.
  - `dress` matches `dress`, `dresses`, and `full body`.
- **Source & Intent Filter**: Groups items by source (`Private` / `Retail`) or their active marketplace listing intent (`for_sale`, `swap`, `donate`).

#### Search Modes: Keyword vs. Meaning (Semantic)
- **Keyword Search**: Performs a client-side search across `title`, `name`, `category`, `sub_category`, `color`, `brand`, and `material`.
- **Meaning Search (Semantic)**: Uses FashionCLIP text embeddings. When selected, search queries are sent to `/closet/search/semantic`. The backend vector-matches the query against item image embeddings and returns search matches sorted by similarity score.

#### Drag-and-Drop Grouping & Sets
Users can consolidate duplicate/multi-angle photos of the same item (Single Group) or bundle coordinated outfits (Sets):
- **Desktop**: Click and drag a garment card over another target card.
- **Mobile Touch**: Long-press a card for 350 ms. Upon trigger (accompanied by a 45 ms vibration pulse), drag the card across the screen. Custom event overrides (`touchmove` default cancellation) prevent window scrolling, while touch boundaries trigger page auto-scrolling.
- **Single Item Grouping**: Grouping multiple pictures of the same garment.
  - **The Gatekeeper Guard**: If target fields (e.g., category, brand, dress code) do not match, the `Gatekeeper` modal alerts the user of inconsistencies before confirming the grouping:
    ```jsx
    const mismatches = getTaxonomyMismatches(sourceItem, targetItem);
    ```
- **Coordinated Sets (Item-Group/Set)**: Grouping items of different categories (e.g., a suit of blazer + trousers, or matching top/skirt outfits) into a synchronized Set.
  - **Mismatches Bypass**: If categories differ (`isBulkSet = categories.size > 1`), taxonomy mismatch warnings are bypassed automatically so that different classes of clothes can be combined.
  - Bypassing the LLM re-analysis on the backend allows the Set to persist immediately as a ready item.
- Both groups and sets update the target host item as `group_role: "host"` and member items as `group_role: "member"`. Member items are hidden from stylist proposals to avoid redundant clothing options.

#### Multi-Select & Bulk Operations
Clicking the bulk select button triggers `selectMode = true`, allowing checkmark multi-selection across the grid:
- **Bulk Deletion**: Users select multiple cards and click Delete to execute a unified database removal.
- **Multi-Tagging**: Users select cards and tap Tag to open a prompt dialog. Custom comma-separated tags (e.g. *"Work, GYM, Swimwear"*) are typed and submitted. The client parses and merges them with existing item tags (`Array.from(new Set([...existingTags, ...newTags]))`) for an instant local update via `closetStore.upsert`, before triggering parallel background `api.patchItem` updates.

#### NDJSON Metadata Streaming Repairs
Provides automated metadata alignment tools:
- **Tuning Duplicate Detector (`/repair-hashes`)**: Backfills missing perceptual hashes (dHash) and updates matches across the database.
- **Refreshing Thumbnails (`/repair-thumbnails`)**: Regenerates missing or corrupt item thumbnails from source images.
- Progress updates are streamed via NDJSON and rendered live in the header using `HashRepairChip` and `ThumbRepairChip` overlays.

---

### 2.3 Error Handling & Feedback Mechanisms

- **Ghost Save Failures**: If items fail to save during optimistic background batches, they are removed from the grid. The `SaveAllFailuresDialog` lists failed items so the user can download original photos or retry:
  ```jsx
  closetStore.addSaveFailure(ghostItem);
  ```
- **rembg Polling Backoff**: When uploading items, the client renders placeholder cards while background matting completes. It polls `GET /closet/{id}` using a progressive backoff:
  ```javascript
  const POLL_STEPS_MS = [3000, 4000, 6000, 9000, 12000, 18000];
  ```
  It cancels polling after 30 attempts to prevent API hammering if a background task crashes.

---

## 3. Technology Stack & Capability Deep-Dive

### 3.1 Backend CLI & API Orchestration

#### Concurrency Controls
The `POST /closet/analyze` endpoint uses an asynchronous semaphore to prevent GPU memory depletion on resource-constrained servers:

```python
_ANALYZE_CONCURRENCY = max(1, int(os.environ.get("ANALYZE_CONCURRENCY", "1")))
_ANALYZE_LOCK = asyncio.Semaphore(_ANALYZE_CONCURRENCY)
```

#### Group Re-analysis: `reanalyze_group_helper`
When items are grouped, the backend handler `reanalyze_group_helper` determines the group composition:
- **For Sets (Multiple Categories)**: If `len(categories) > 1`, the backend marks the items as `"ready"` and skips LLM analysis entirely since they represent distinct garments in a set.
- **For Single Groups (Same Category)**: If they share a category, it calculates a consolidated embedding for the host item. It runs FashionCLIP across all member garment images, merging their visual vectors into a single robust search representation:

$$\vec{V}_{\text{host\_final}} = \text{Normalize}\left(\sum_{i \in \text{group}} \vec{V}_i\right)$$

This ensures the host item remains searchable in semantic lookups regardless of the specific photo angle queried.

---

### 3.2 Global Client-Store Synchronisation

#### `closetStore.js` and `useClosetStore`
The client utilizes a centralized store (`closetStore.js`) subscribing via React's `useSyncExternalStore` hook:
- Updates are dispatched via `closetStore.upsert(item)` and `closetStore.remove(id)`.
- Updates are saved to local storage, and tab synchronization is managed via storage listeners:
  ```javascript
  window.addEventListener('storage', (e) => { ... });
  ```
  This ensures changes in one tab instantly mirror across all other open tabs.

---

## 4. Localisation & i18n Reference

Every string in the Closet interface conforms to the options-based syntax with explicit fallback values to guarantee parser stability:

```javascript
t('closet.repair.running', { defaultValue: 'Tuning duplicate detector… {{n}}/{{total}}', n: scanned, total: total })
```

### Critical Keys Map

| Key | Default (en) | Description |
|---|---|---|
| `closet.pendingSync` | Syncing | Sparkle loading overlay for ghost items |
| `item.wearsCount` | `{{count}} wear` / `{{count}} wears` | Item wear count indicator badge |
| `closet.completeListingCta` | Complete listing | Auto-listed item edit CTA |
| `closet.repair.running` | Tuning duplicate detector… | Hash repair status chip |
| `closet.thumbRepair.running` | Refreshing thumbnails… | Thumbnail repair status chip |
| `closet.tagConfirmTitle` | Tag Selected Items | Bulk tag dialog header |
| `closet.tagConfirmBody` | Enter tags separated by commas... | Bulk tag dialog instructions |
| `closet.customTagPlaceholder` | e.g. Work, GYM, Swimwear | Bulk tag text input placeholder |
| `closet.tagsAppliedSuccess` | Tags applied successfully | Bulk tag success toast |
| `closet.confirmGroup` | Group | Group confirm action button |
| `wardrobeStats.tabSustainability` | Sustainability Impact | Statistics category selector |
