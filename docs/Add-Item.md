# Wardrobe Cataloging & Ingestion: Add Item Workflows

This document provides a comprehensive architectural and functional summary of the **Add Item** cataloging module (`AddItem.jsx`), describing every ingestion pathway, verification workflow, background analysis pipeline, and technology stack components.

---

## 1. Wardrobe Ingestion Pathways

The cataloging system supports four primary ingestion methods:
1. **Camera Upload Flow (Mobile & Desktop)**
2. **File Selection & Drag-and-Drop Flow**
3. **Automated Receipt/Invoice Parsing Flow**
4. **Digital Product Passport (DPP) Integration**

---

## 2. Pathway Details & Key Points

### A. Camera Upload Workflow
- **Mechanism**: Utilizes a hidden native HTML5 input tag:
  ```html
  <input type="file" accept="image/*" capture="environment" />
  ```
- **Mobile Devices**: Setting `capture="environment"` instructs iOS and Android webviews to open the native rear camera application immediately. Taking a photo pipes the image bytes directly back into the browser context.
- **Desktop Devices**: Automatically falls back to a standard local file browser, ensuring compatibility.
- **Image Conversion**: Converts captured photo bytes into a base64-encoded string immediately for client-side processing.

---

### B. File Selection & Drag-and-Drop Workflow (Batch & Interactive)
- **Selection**: Supports selecting single or multiple image files via file explorer dialogs or drag-and-drop zones.
- **In-Browser Duplicate Pre-Flight Verification**:
  - To prevent redundant network requests and server-side processing overhead, the client computes three distinct fingerprints for every selected file in parallel (~150-250ms per file):
    1. **SHA-256 Hash**: Identifies identical files byte-for-byte.
    2. **aHash (Average Hash)**: Visual hash indicating color and layout structure.
    3. **Color Signature Vector**: Maps dominant color signatures.
  - Matches the computed fingerprints against the locally-cached wardrobe snapshot (`closetStore.getSnapshot().items`) using the client-side `findDuplicatesInCloset` utility.
- **Collision Resolution Pathways**:
  - **Interactive Path (≤ 5 photos)**: Opens a scrollable `DuplicatePreflightDialog` displaying side-by-side matches. Users can choose to skip or select "Add anyway" for individual items.
  - **Batch Path (> 5 photos)**: Silently drops duplicate files based on pre-defined policies to streamline bulk imports.
- **Sequential Queue Processing**:
  - Staged files are queued and sent sequentially to the backend `/closet/analyze` endpoint. Processing is strictly sequential to prevent high-RAM pipelines (SegFormer segmentation + background removal + Gemini tagging) from causing Out-Of-Memory (OOM) errors on the VPS.
- **Matte & Background Removal**:
  - Runs background matting/masking (`rembg`) to extract clean garment assets. If the server is busy, the matting process is deferred (`deferMatte`), and a background task finishes it.
- **AI Reconstruction (Nano Banana Integration)**:
  - If a garment is partially occluded, the backend attempts to reconstruct the missing boundaries. 
  - The UI displays an interactive toggle enabling the user to switch between the original photo and the reconstructed background-free product image (`useReconstructed`).

---

### C. Automated Receipt / Invoice Parsing Flow
- **Modes**:
  - **Pasted Text**: Users copy-paste text from merchant emails or text-only invoices.
  - **Uploaded File**: Users upload receipt PDFs or receipt photo files.
  - **URL**: Users enter a link to a digital receipt, which the backend fetches securely.
- **Concurrent Extraction Pipeline**:
  - Calls `POST /closet/parse-receipt` which runs two backend processes concurrently:
    1. **OCR LLM Analysis**: Gemini Vision extracts taxonomic data (`brand`, `item_type`, `size`, `price_cents`, `colors`, `category`, `name`).
    2. **Garment Visual Crop**: Runs object detection models to locate the garment on image receipts. It crops the target, analyzes visual tags (neckline, sleeve, pattern), and returns a cropped base64 image.
- **Form Hydration & Fallback Vector Rendering**:
  - Extracted fields instantly populate the form fields.
  - If a cropped photo is returned, it is displayed. If no photo is found, the frontend dynamically generates a **premium custom SVG vector placeholder** on the fly (representing the brand logo and the dominant color) to prevent displaying empty cards.

---

### D. Digital Product Passport (DPP) Integration
- **Mechanism**: Users scan a QR code or enter a DPP URL.
- **Integration**: Fetches official manufacturing provenance data, importing fiber composition (materials %), carbon footprints, care instructions, certifications, and country of origin directly into the item record.

---

## 3. Ingestion Technology Stack

### Frontend Architecture
- **React Hooks & Refs**: Manages state variables (card previews, active tab, import modes), upload triggers, and input references (`fileInputRef`, `cameraInputRef`).
- **In-Browser Fingerprinting**: Computes SHA-256, aHash, and color vectors using client-side hashing scripts.
- **Radix UI & Shadcn**: Provides modal Dialog frames (`DuplicatePreflightDialog`, `DialogContent`, `DialogHeader`) and input components.
- **Inline SVGs**: Dynamic SVG graphics rendered using custom color properties and brand text interpolation.
- **Zustand Store**: Accesses and checks item records locally in the client database cache (`useClosetStore`).

### Backend Architecture
- **FastAPI Routing**: Hosts `/closet/parse-receipt` and `/closet/analyze` endpoints.
- **Gemini Client**: Processes OCR files/text using `gemini.vision` and returns structured JSON outputs.
- **Object Detection & SegFormer Models**: Locates, segments, and crops clothing items from photos.
- **rembg Matting Library**: Handles background subtraction and alpha-channel masks.
- **HTTPX client**: Fetches web invoice URLs securely.
