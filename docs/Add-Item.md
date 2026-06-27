# Add Item Workflow & Automated Receipt Parsing Flow

This document summarizes the **Add Item** page (`AddItem.jsx`) workflow and the **Automated Receipt Parsing** service (`parse_receipt`), detailing their capabilities, UX states, and technology stack.

## 1. The "Add Item" Workflow
The **Add Item** page is the entry point for cataloging garments into the user's digital wardrobe. It offers three distinct pathways to register clothing items:
1. **Manual Cataloging**: Users fill out standard taxonomic fields (Title, Category, Subcategory, Brand, Size, Colors, Materials, Price, Condition, Seasonality, Formality, and Tags) and upload a photo.
2. **Digital Product Passport (DPP) Import**: Users scan a QR code or paste a DPP link to import detailed sustainability provenance (materials %, carbon footprint, country of origin, care instructions, certifications) directly into the item metadata.
3. **Automated Receipt Parsing**: Users upload an invoice or receipt to let the AI extract and populate details automatically.

---

## 2. The "Automated Receipt Parsing" Flow
The receipt parsing system (`POST /parse-receipt`) is an intelligent multi-modal workflow that extracts garment details from text, files, or URLs.

### Import Modes (Frontend UX)
- **Pasted Text**: Users paste purchase confirmations or receipt text.
- **Uploaded File**: Users upload receipt PDFs or images.
- **URL**: Users submit an invoice or receipt page link, which the backend fetches securely.

### Processing Pipeline (Backend Services)
When a receipt is submitted, the backend runs two asynchronous extraction steps concurrently (`asyncio.gather`):
1. **Gemini Vision & OCR (`run_ocr()`)**:
   - The document is sent to the Gemini Vision LLM with a specialized wardrobe prompt instructing it to identify the garment and extract structured fields: `brand`, `item_type`, `size`, `price_cents`, `colors`, `category`, and `name`.
2. **Object Bounding Box Detection (`run_visual()`)**:
   - If the receipt is an image containing a photo of the item, the `garment_vision_service` detects garment bounding boxes.
   - It crops the largest bounding box and performs a secondary visual tagging analysis (materials, pattern, cut) in the user's preferred language.
   - Returns the cropped garment photo as a base64-encoded string.

### Data Resolution & UI Hydration
- The backend merges OCR and visual details, applying authoritative text updates from OCR and base64 crops from the visual detector.
- Standard default values are filled in for missing details (e.g., Brand = `Generic`, Size = `M`).
- On return, the frontend **hydrates the cataloging form fields** instantly.
- If no image crop is available, the frontend generates a **premium custom SVG vector placeholder** on the fly (representing the brand name and the dominant color) to present a polished visual asset instead of a generic card blank.
- The user reviews the details, makes adjustments, and saves the item.

---

## 3. Technology Stack

### Frontend Components
- **React Hooks**: Manages upload drag-and-drop, tab states, parsing loader animations, and form field hydration.
- **Form Data API**: Uses the standard browser `FormData` API to stream text, file binaries, and URLs to the backend.
- **Shadcn/UI components**: Uses `Dialog`, `Input`, `Label`, `Select`, `Button`, and custom form cards.
- **Dynamic SVGs**: Employs raw inline SVG templates that dynamically change colors and brand names.
- **Sonner Toast**: Displays detailed loading indicators to update users on OCR and fetching status.

### Backend Services
- **FastAPI**: Declares `/closet/parse-receipt` handling multipart form uploads.
- **Gemini Client**: Integrates the Gemini API (`gemini.vision`) for structured JSON extraction.
- **ML Garment Vision Service**: Built on object detection models to locate and crop garments from receipt image attachments.
- **HTTPX**: A non-blocking asynchronous HTTP client used to fetch merchant invoice pages from remote URLs.
