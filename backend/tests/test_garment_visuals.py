"""Unit tests for GarmentVisuals deep module (backend/app/services/garment_visuals.py)."""
import base64
import io
import pytest
from PIL import Image
from app.services.garment_visuals import GarmentVisuals, ProcessedVisuals


def _create_test_image_bytes(color=(255, 0, 0), size=(100, 100), mode="RGB") -> bytes:
    img = Image.new(mode, size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG" if mode == "RGBA" else "JPEG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_extract_bytes_formats():
    raw = _create_test_image_bytes()
    b64_str = base64.b64encode(raw).decode("ascii")
    data_url = f"data:image/jpeg;base64,{b64_str}"

    # 1. Raw bytes
    b1, _ = GarmentVisuals._extract_bytes(raw)
    assert b1 == raw

    # 2. Base64 string
    b2, _ = GarmentVisuals._extract_bytes(b64_str)
    assert b2 == raw

    # 3. Data URL
    b3, _ = GarmentVisuals._extract_bytes(data_url)
    assert b3 == raw


@pytest.mark.asyncio
async def test_process_raw_upload_structure():
    raw = _create_test_image_bytes(size=(200, 200))
    res = await GarmentVisuals.process_raw_upload(raw, generate_cutout=False)

    assert isinstance(res, ProcessedVisuals)
    assert res.original_image_url.startswith("data:image/")
    assert res.clean_image_url is None
    assert res.thumbnail_data_url is not None
    assert res.thumbnail_data_url.startswith("data:image/webp;base64,")
    assert res.placeholder_data_url is not None
    assert res.clean_image_status == "skipped"


@pytest.mark.asyncio
async def test_ensure_transparent_cutout_fallback(monkeypatch):
    raw = _create_test_image_bytes(mode="RGBA", color=(0, 255, 0, 255))

    # Mock background matting to simulate cutout
    async def mock_remove_background(b):
        return {"image_png": raw, "faithful": True, "provider": "mock"}

    monkeypatch.setattr("app.services.garment_visuals.remove_background", mock_remove_background)

    cutout = await GarmentVisuals.ensure_transparent_cutout(raw)
    assert cutout is not None
    assert cutout.startswith("data:image/png;base64,")


@pytest.mark.asyncio
async def test_invalid_bytes_handling():
    res = await GarmentVisuals.ensure_transparent_cutout("invalid-non-base64")
    assert res is None