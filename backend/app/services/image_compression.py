import base64
import io
import logging
from PIL import Image

logger = logging.getLogger(__name__)

def compress_image_bytes(image_bytes: bytes, max_dim: int = 1024, quality: int = 75) -> bytes:
    """Resize image so its maximum dimension is at most max_dim, and compress as JPEG or PNG."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        # Flatten palette images so we can inspect their alpha properly.
        if img.mode == "P":
            img = img.convert("RGBA")
            
        # Determine if we should keep alpha (PNG) or use JPEG
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        
        # Calculate new dimensions keeping aspect ratio
        w, h = img.size
        if w > max_dim or h > max_dim:
            if w > h:
                new_w = max_dim
                new_h = int(h * (max_dim / w))
            else:
                new_h = max_dim
                new_w = int(w * (max_dim / h))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
        out_io = io.BytesIO()
        if has_alpha:
            img.save(out_io, format="PNG", optimize=True)
        else:
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.save(out_io, format="JPEG", quality=quality, optimize=True)
        return out_io.getvalue()
    except Exception as e:
        logger.warning("Failed to compress image bytes: %s", e)
        return image_bytes

def compress_b64_image(b64_str: str | None, max_dim: int = 1024, quality: int = 75) -> str | None:
    """Compress raw base64 image string or data URL."""
    if not b64_str or not isinstance(b64_str, str):
        return b64_str
        
    prefix = ""
    clean_b64 = b64_str
    if b64_str.startswith("data:"):
        try:
            prefix, clean_b64 = b64_str.split(",", 1)
        except ValueError:
            pass
            
    try:
        raw_bytes = base64.b64decode(clean_b64)
        compressed = compress_image_bytes(raw_bytes, max_dim=max_dim, quality=quality)
        
        # Open to check mode for proper prefix
        img = Image.open(io.BytesIO(compressed))
        has_alpha = img.mode in ("RGBA", "LA")
        mime = "image/png" if has_alpha else "image/jpeg"
        
        compressed_b64 = base64.b64encode(compressed).decode("ascii")
        if prefix:
            return f"data:{mime};base64,{compressed_b64}"
        return compressed_b64
    except Exception as e:
        logger.warning("Failed to compress base64 image: %s", e)
        return b64_str

def compress_image_url_or_b64(value: str | None, max_dim: int = 1024, quality: int = 75) -> str | None:
    """Alias for compress_b64_image that ensures output matches correct data URL prefix format."""
    return compress_b64_image(value, max_dim=max_dim, quality=quality)
