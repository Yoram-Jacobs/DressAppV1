# Ingesting & Adding Clothes

Digitize your physical wardrobe in seconds with automatic 3-pipeline photo routing, smart background removal, and generative image completion.

## Overview
Ingest clothes using live camera snaps, multi-image gallery uploads (including mixed batches of single items, worn outfits, and garment clusters), Digital Product Passports (DPP) QR tags, or digital receipts (invoice OCR). Built-in on-premises AI automatically detects each photo's characteristics, cuts out backgrounds, tags 20+ fashion attributes (including sweatshirts/hoodies and 60+ traditional & cultural garments), and prepares clean studio cutouts with zero required API keys.

## Prerequisites
- Clear, well-lit photos of garments (single items, full-body mirror selfies, mannequins, or flat-lay clusters of multiple garments).
- Camera access for scanning physical items and QR codes.
- Digital receipts or invoice screenshots (PDF / PNG / JPEG) for e-commerce purchases.

## Step-by-Step Instructions

1. **Interactive Upload & Mixed-Batch Capture**:
   - Tap **Add Item** → select **Take Photo** or **Upload Photos** to select one or more photos from your device. You can freely mix single-item photos, full outfits on a person, and piles/clusters of clothes in the same batch without selecting any mode tabs!
   - Built-in duplicate detection instantly checks if you previously uploaded the same garment.
2. **Automatic 3-Pipeline Photo Routing**:
   - **GarmentVision** automatically inspects every photo and routes it to the right pipeline:
     - **Single Garment**: Isolates one garment with studio alpha matting.
     - **Multi-Garment (Worn Outfit)**: Splits head-to-toe outfits on a model or mannequin into separate top, bottom, outerwear, footwear, and accessory cards.
     - **Mass Cluster (Unworn Pile / Flat-Lay / Wall Hooks)**: Separates groups of unworn clothes arranged side-by-side or hanging on hooks into individual items.
3. **AI Matting & Clean Studio Photos**:
   - The built-in vision pipeline automatically keys out backgrounds into crisp, transparent PNG images for all accounts.
4. **Automatic Metadata, Hoodie & Cultural Attire Tagging**:
   - Free Tier accounts use DressApp's on-premises **Eyes** engine (fine-tuned `Qwen 2.5 VL 3B`), while **Manager** ($10/mo) and **Professional** ($15/mo) plan users enjoy the fast Cloud model (`Google Gemini 3.5 Flash`) to extract 20+ fashion attributes—accurately distinguishing **Sweatshirts & Hoodies** from T-shirts and recognizing 60+ **Traditional & Cultural** garments (Sari, Kimono, Thobe, Kaftan, Hanbok, Cheongsam, Ao Dai, Dirndl, Kilt, and more) in all 13 languages.
5. **Advanced Generative Photo Repair (Nano Banana)**:
   - Nano Banana inspects cropped items for occlusions (bags, hands) and frame boundaries, automatically outpainting and reconstructing missing fabric into complete studio photographs with zero external API keys required.
6. **Digital Receipts & DPP Tags**:
   - Switch to **Digital Import** to parse order confirmation emails or invoices, locking purchase price and verified sizes.
   - Tap **Scan QR (DPP)** on the label to import EU Digital Product Passport supply chain facts and care guidelines.
7. **Save to Closet**:
   - Tap **Save**. Items appear immediately in your Closet grid.

## Expected Results
Every garment appears in your digital wardrobe as a centered, clean studio-quality photograph with accurate category/subcategory labels, cultural heritage tags, and fully indexed search attributes.

## Troubleshooting
- **Cut-Off / Partial Garments in Photos**: Cleanly center the garment against a contrasting background. Nano Banana can reconstruct clipped collars or hems automatically.
- **Lighting & Contrast**: For best results on dark garments, photograph against contrasting light backgrounds.
- **Receipt OCR Mismatches**: Use the interactive box selector on receipt images to manually designate individual product lines.

## Limitations
- High-resolution batch uploads (>5 items) process via asynchronous background queues to guarantee responsive performance without browser timeout.
