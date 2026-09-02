import io
import base64
import pytest
from PIL import Image
from app.services.vision.image import _fit_crop_to_card, fit_image_data_url_to_card, _CARD_CANVAS_W, _CARD_CANVAS_H

def create_sample_garment_png(w: int, h: int, color=(255, 0, 0, 255)) -> bytes:
    """Create a sample RGBA PNG bytes of specified dimensions with non-transparent pixels."""
    img = Image.new("RGBA", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def test_fit_crop_to_card_dimensions_and_margin():
    """Verify _fit_crop_to_card creates a 900x1200 canvas and fits item within 0.90 safety margin."""
    raw_png = create_sample_garment_png(500, 500)
    fitted_bytes, mime = _fit_crop_to_card(raw_png, crop_mime="image/png")
    
    assert mime == "image/png"
    img = Image.open(io.BytesIO(fitted_bytes))
    assert img.size == (_CARD_CANVAS_W, _CARD_CANVAS_H)
    assert img.size == (900, 1200)

    # Get non-transparent bounding box on the 900x1200 canvas
    bbox = img.getbbox()
    assert bbox is not None
    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]

    # The garment should occupy max 90% of the canvas (max 810px width or 1080px height)
    assert bw <= int(900 * 0.90) + 2
    assert bh <= int(1200 * 0.90) + 2

def test_fit_image_data_url_to_card():
    """Verify fit_image_data_url_to_card formats base64 data URLs correctly with 0.90 margin."""
    raw_png = create_sample_garment_png(400, 800)
    b64_str = base64.b64encode(raw_png).decode("ascii")
    data_url = f"data:image/png;base64,{b64_str}"

    fitted_url = fit_image_data_url_to_card(data_url)
    assert fitted_url is not None
    assert fitted_url.startswith("data:image/png;base64,")

    header, encoded = fitted_url.split(",", 1)
    fitted_bytes = base64.b64decode(encoded)
    img = Image.open(io.BytesIO(fitted_bytes))
    assert img.size == (900, 1200)

    bbox = img.getbbox()
    assert bbox is not None
    bh = bbox[3] - bbox[1]
    assert bh <= int(1200 * 0.90) + 2

def test_tilted_garment_deskew_and_extended_fit():
    """Verify that a tilted rectangular garment PNG is deskewed upright and scaled to 0.90 margin."""
    garment = Image.new("RGBA", (100, 400), (0, 0, 255, 255))
    canvas = Image.new("RGBA", (600, 600), (0, 0, 0, 0))
    canvas.paste(garment, (250, 100))
    tilted_img = canvas.rotate(35, expand=True)

    buf = io.BytesIO()
    tilted_img.save(buf, format="PNG")
    tilted_bytes = buf.getvalue()

    fitted_bytes, mime = _fit_crop_to_card(tilted_bytes, crop_mime="image/png")
    out_img = Image.open(io.BytesIO(fitted_bytes))
    assert out_img.size == (900, 1200)

    bbox = out_img.getbbox()
    assert bbox is not None
    bh = bbox[3] - bbox[1]
    assert bh >= 900
    assert bh <= int(1200 * 0.90) + 10
