# Ingesting & Adding Clothes

Digitize your physical wardrobe in seconds with multi-modal AI scanning, smart background removal, and automatic image completion.

## Overview
Ingest clothes using live camera snaps, multi-image gallery uploads, Digital Product Passports (DPP) QR tags, or digital receipts (invoice OCR). Built-in AI automatically cuts out backgrounds, tags fashion attributes, assesses crop completeness, and reconstructs occluded or cut-off garments.

## Prerequisites
- Clear, well-lit photos of garments (mirror selfies, full-body outfit photos, or flat lays).
- Camera access for scanning physical items and QR codes.
- Digital receipts or invoice screenshots (PDF / PNG / JPEG) for e-commerce purchases.

## Step-by-Step

1. **Interactive Upload & Capture**:
   - Tap **Add Item** &rarr; select **Take Photo** or upload one or more outfit photos from your device.
   - Built-in duplicate detection instantly checks if you previously uploaded the same garment.
2. **AI Segmentation & Multi-Item Detection**:
   - The vision model isolates distinct garments (jackets, tops, skirts, pants, footwear, accessories) in a single pass.
3. **AI Quality Checker & Automatic Image Repair**:
   - Gemini's visual Quality Checker inspects each cropped item:
     - **Complete**: Intact, unoccluded garments are matted directly.
     - **Image Completion**: If an item has missing side contours, occlusions (from bags/arms), or cropped hems/collars, the AI automatically outpaints and completes the missing fabric.
     - **Full Studio Reconstruction**: Severely cut-off items (such as shoes showing only toe caps) are fully reconstructed into pristine studio catalog photographs.
4. **Automatic Metadata Tagging**:
   - The AI extracts 20+ fashion attributes (colors, fabric composition, sub-category, dress code, brand, and condition).
5. **Digital Receipts & DPP Tags**:
   - Switch to **Digital Import** to parse order confirmation emails or invoices, locking purchase price and verified sizes.
   - Tap **Scan QR (DPP)** on the label to import EU Digital Product Passport supply chain facts and care guidelines.
6. **Save to Closet**:
   - Tap **Save**. Items appear immediately in your Closet grid, while generative completions finalize seamlessly in the background.

## Expected Results
Every garment appears in your digital wardrobe as a centered, clean studio-quality photograph with fully indexed search attributes and rich taxonomy tags.

## Troubleshooting
- **Cut-Off / Partial Garments in Photos**: The AI automatically detects cut-off borders and reconstructs them; you can also tap **Repair Photo** on any item detail card to trigger manual studio regeneration.
- **Lighting & Contrast**: For best results on dark garments, photograph against contrasting backgrounds.
- **Receipt OCR Mismatches**: Use the interactive box selector on receipt images to manually designate individual product lines.

## Limitations
- High-resolution batch uploads (>5 items) process via asynchronous background queues to guarantee responsive performance without browser timeout.
