import io
import asyncio
import logging
from PIL import Image

try:
    import blurhash
except ImportError:
    blurhash = None

try:
    import pillow_avif
except ImportError:
    pass  # AVIF plugin might not be installed, we'll fall back to just WebP

from app.services.upload_manager import UploadManager
from app.db.database import get_db

logger = logging.getLogger(__name__)

# Constants for generated resolutions
VARIANTS = {
    "small": 400,
    "medium": 800,
    "large": 1200
}

def _compute_blurhash(image: Image.Image) -> str:
    if blurhash is None:
        return ""
    # Resize heavily to compute blurhash fast
    image.thumbnail((100, 100))
    # We need RGB mode for blurhash
    if image.mode != "RGB":
        image = image.convert("RGB")
    # compute blurhash (components x, y)
    return blurhash.encode(image, x_components=4, y_components=3)

def _get_dynamic_quality(image: Image.Image) -> int:
    """
    A lightweight perceptual heuristic.
    In a real system, we'd use SSIM, but for performance, we estimate
    detail level by looking at file size after basic JPEG compression or edge detection.
    Here we return a simplified heuristic based on dimensions.
    """
    # Simple fallback heuristic for the edge-aware encoder:
    return 75

async def process_image_pipeline(
    item_id: str,
    user_id: str,
    raw_bytes: bytes,
    original_mime: str,
    crop_bytes: bytes | None = None,
):
    """
    Background worker that transcodes an uploaded image to AVIF/WebP variants
    and computes the BlurHash.
    """
    try:
        # Load image via Pillow
        img = Image.open(io.BytesIO(raw_bytes))
        
        # If crop_bytes is provided, generate variants (WebP, AVIF, BlurHash) from the cutout/crop.
        # Otherwise, generate them from the original raw image.
        variant_img = Image.open(io.BytesIO(crop_bytes)) if crop_bytes else img
        
        # 1. Compute BlurHash
        bh_str = _compute_blurhash(variant_img.copy())
        
        # 2. Upload Original / Garment Crop (as fallback)
        target_bytes = crop_bytes or raw_bytes
        target_img = variant_img
        target_mime = "image/png" if target_img.mode in ("RGBA", "LA") else original_mime
        orig_ext = "png" if target_img.mode in ("RGBA", "LA") else "jpeg"
        orig_url = await UploadManager.upload_bytes(target_bytes, target_mime, orig_ext)
        
        # Dictionary to store variant URLs
        variants = {
            "blurhash": bh_str,
            "original": orig_url,
            "webp": {},
            "avif": {}
        }
        
        quality = _get_dynamic_quality(variant_img)
        
        # 3. Generate Variants
        for size_name, max_dim in VARIANTS.items():
            # Resize while preserving aspect ratio
            resized = variant_img.copy()
            resized.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            
            # Save as WebP
            webp_io = io.BytesIO()
            resized.save(webp_io, format="WEBP", quality=quality, method=4)
            webp_url = await UploadManager.upload_bytes(webp_io.getvalue(), "image/webp", "webp")
            variants["webp"][size_name] = webp_url
            
            # Save as AVIF (if supported)
            try:
                avif_io = io.BytesIO()
                resized.save(avif_io, format="AVIF", quality=quality)
                avif_url = await UploadManager.upload_bytes(avif_io.getvalue(), "image/avif", "avif")
                variants["avif"][size_name] = avif_url
            except Exception as e:
                logger.warning(f"Failed to generate AVIF for {size_name}: {e}")
                
        # 4. Update MongoDB Document — store CDN variant URLs and remove inline base64 placeholders.
        # CRITICAL: clean_image_url and reconstructed_image_url are primary garment display fields
        # and MUST NEVER be $unset. If clean_image_url is missing or is an inline data URL,
        # update it to the CDN webp/original URL.
        db = get_db()
        update_set = {"image_variants": variants}

        try:
            existing_doc = await db.closet_items.find_one({"id": item_id, "user_id": user_id}, {"clean_image_url": 1})
            current_clean = existing_doc.get("clean_image_url") if existing_doc else None
            if not current_clean or (isinstance(current_clean, str) and current_clean.startswith("data:image/")):
                if variants.get("webp", {}).get("large"):
                    update_set["clean_image_url"] = variants["webp"]["large"]
                elif orig_url:
                    update_set["clean_image_url"] = orig_url
        except Exception as check_exc:
            logger.warning(f"Failed checking existing clean_image_url for {item_id}: {check_exc}")

        await db.closet_items.update_one(
            {"id": item_id, "user_id": user_id},
            {
                "$set": update_set,
                "$unset": {
                    "placeholder_data_url": "",
                },
            }
        )
        logger.info(f"Successfully processed image variants for item {item_id}")
        
    except Exception as e:
        logger.error(f"Error in encoder pipeline for item {item_id}: {e}", exc_info=True)

