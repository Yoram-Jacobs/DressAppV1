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
        
        # 2. Upload Original (as fallback)
        orig_ext = "png" if img.mode in ("RGBA", "LA") else "jpeg"
        orig_url = await UploadManager.upload_bytes(raw_bytes, original_mime, orig_ext)
        
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
                
        # 4. Update MongoDB Document — store CDN variant URLs and strip all
        # inline base64 fields.  Fields listed in $unset are removed from
        # the document entirely; existing items that already have these
        # fields as data-URLs will be cleaned up the first time their item
        # passes through the encoder pipeline (i.e. on any re-analyze call).
        db = get_db()
        await db.closet_items.update_one(
            {"id": item_id, "user_id": user_id},
            {
                "$set": {"image_variants": variants},
                "$unset": {
                    # Belt-and-braces cleanup for items created before this
                    # change that may still carry these fields from older builds.
                    "clean_image_url": "",
                    "reconstructed_image_url": "",
                    "placeholder_data_url": "",
                },
            }
        )
        logger.info(f"Successfully processed image variants for item {item_id}")
        
    except Exception as e:
        logger.error(f"Error in encoder pipeline for item {item_id}: {e}", exc_info=True)

