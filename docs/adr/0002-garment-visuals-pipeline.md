# ADR-0002: Garment Visuals & Cutout Pipeline Deep Module

## Context

Garment visual assets (photos, bounding box crops, inpainting re-shoots, transparent cutouts, and thumbnails) were previously processed with fragmented, inline logic across 6+ API endpoints in `closet.py`. Each route independently coordinated base64 encoding, rembg background matting, fallback recovery, compression, and thumbnail generation.

This shallowness led to multiple regressions:
1. Key parsing bugs (e.g. checking `.get("success")` on rembg results) caused background cutouts to be dropped, resulting in opaque rectangular boxes covering mannequin avatars and outfit planners.
2. Synchronous multi-roundtrip updates during list queries caused `GET /closet` to block for up to 20 seconds over Atlas WAN.
3. Repetitive image compression and data URL conversions bloated codebase complexity and test surfaces.

## Decision

We establish a deep module at `backend/app/services/garment_visuals.py` (`GarmentVisuals`) that encapsulates all visual processing behind a 2-method interface:

1. `process_raw_upload(image_input, *, generate_cutout=True, max_dim=1024) -> ProcessedVisuals`
2. `ensure_transparent_cutout(image_input) -> str | None`

### Architectural Invariants

1. **Transparency Contract**:
   - `clean_image_url` is always guaranteed to be an isolated transparent PNG cutout with alpha channel (no background).
   - Inpainting/reconstruction workflows (`chat_analyse_item`, `edit_item_image`) must assign the transparent cutout directly to `reconstructed_image_url` and `clean_image_url` so UI cards, avatars, and daily suggestion mannequins render without background boxes.

2. **Automated Fallback**:
   - Primary matting via `remove_background()` automatically falls back to lightweight `matte_crop()` if CLIP faithfulness checks or endpoint calls fail, ensuring graceful degradation.

3. **Sub-100ms List Queries**:
   - `GET /closet` list queries must project out heavy base64 fields at the MongoDB layer and execute thumbnail backfilling asynchronously via background tasks with `bulk_write`, never blocking the client response.

4. **Testing Seam**:
   - Unit tests test the interface through `GarmentVisuals` without requiring live MongoDB instances or HTTP routers.

## Consequences

- **Positive**: Bug locality: all image matting, fallback, and thumbnail behaviors concentrate in one testable module.
- **Positive**: Route handlers in `closet.py` shrink from complex multi-step pipelines to clean one-line invocations.
- **Positive**: 100% transparency guarantee on styling avatars and outfit canvases.