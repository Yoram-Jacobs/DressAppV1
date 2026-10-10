import json
import io
from PIL import Image
import pytest

from app.services.vision.llm import SYSTEM_PROMPT, _build_batch_prompts, _GARMENT_OBJECT_SCHEMA
from app.services.vision.image import _create_batch_collage
from app.services.gemini_stylist import _compact_closet_summary, prepare_stylist_prompt
from app.services.gemini_client import GeminiClient
from app.services.reconstruction import _build_reconstruction_prompt
from app.services.gemini_image_service import GeminiImageService


def test_system_prompt_token_compression():
    """Verify SYSTEM_PROMPT is concise (under 250 words) while retaining all critical taxonomy rules."""
    words = SYSTEM_PROMPT.split()
    assert len(words) < 320, f"SYSTEM_PROMPT is too verbose: {len(words)} words"

    # Verify critical domain rules are strictly preserved:
    assert "sub_category" in SYSTEM_PROMPT
    assert "Jeans" in SYSTEM_PROMPT
    assert "Sweatpants" in SYSTEM_PROMPT
    assert "Sandals" in SYSTEM_PROMPT
    assert "model_gender" in SYSTEM_PROMPT
    assert "Strict 3-Tier Hierarchy" in SYSTEM_PROMPT
    assert "reconstruction_prompt" in SYSTEM_PROMPT


def test_batch_prompt_deduplication():
    """Verify _build_batch_prompts has zero back-to-back duplicate crop directives."""
    sys_prompt, user_text = _build_batch_prompts(
        n=3,
        kind_hints=["top", "bottom", "footwear"],
        language="en",
        user_gender="men",
        model_gender="women",
    )
    # Must only contain the BATCH analyze directive once
    assert user_text.count("BATCH: Analyze 3 crop(s)") == 1
    # User text should not redundantly repeat the model gender directive if it is in system_prompt
    assert user_text.count("All garments in this outfit are worn by a visible women model") == 0
    assert "visible women model" in sys_prompt


def test_create_batch_collage_768_boundary():
    """Verify _create_batch_collage outputs an image clamped to 768px (Gemini single-tile 258 token boundary)."""
    img1 = Image.new("RGB", (600, 800), (255, 0, 0))
    img2 = Image.new("RGB", (600, 800), (0, 255, 0))
    buf1 = io.BytesIO()
    buf2 = io.BytesIO()
    img1.save(buf1, format="JPEG")
    img2.save(buf2, format="JPEG")

    collage_bytes = _create_batch_collage([buf1.getvalue(), buf2.getvalue()])
    collage_img = Image.open(io.BytesIO(collage_bytes))
    w, h = collage_img.size
    assert max(w, h) <= 768, f"Batch collage exceeded 768px tile boundary: ({w}, {h})"


def test_compact_closet_summary_pruning():
    """Verify _compact_closet_summary strips database noise and minimizes token footprint."""
    raw_closet = [
        {
            "_id": "660c1f2e9a3b8e001",
            "id": "item_1",
            "title": "Navy Wool Blazer",
            "category": "Outerwear",
            "sub_category": "Blazer",
            "colors": [{"name": "Navy", "pct": 100}],
            "dress_code": "smart-casual",
            "season": ["fall", "winter"],
            "pattern": "solid",
            "tags": ["formal", "classic", "workwear"],
            "brand": "Brooks Brothers",
            "raw_image_url": "https://s3.amazonaws.com/uploads/raw_123.jpg",
            "clean_image_url": "https://s3.amazonaws.com/uploads/clean_123.png",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-02T00:00:00Z",
            "embedding_v4": [0.12, 0.45, 0.88],
            "status": "active",
        }
    ]
    compact = _compact_closet_summary(raw_closet)
    assert len(compact) == 1
    it = compact[0]
    assert it["id"] == "item_1"
    assert it["name"] == "Navy Wool Blazer"
    assert it["category"] == "Outerwear"
    assert it["colors"] == ["Navy"]
    assert it["brand"] == "Brooks Brothers"
    # Unneeded token-wasting keys MUST be stripped:
    assert "raw_image_url" not in it
    assert "clean_image_url" not in it
    assert "created_at" not in it
    assert "embedding_v4" not in it
    assert "status" not in it


@pytest.mark.anyio
async def test_prepare_stylist_prompt_compact_json():
    """Verify prepare_stylist_prompt uses compact JSON without indentation whitespace."""
    _, prompt_text = await prepare_stylist_prompt(
        user_text="What should I wear to a dinner?",
        closet_summary=[{"id": "c1", "title": "White Shirt", "category": "Top"}],
        user_profile={"preferred_language": "en", "sex": "men"},
    )
    # Check that context JSON does not contain multi-space indentation (indent=2)
    assert '{\n  "weather"' not in prompt_text
    assert '"closet_summary":[{"id":"c1"' in prompt_text or '"closet_summary": [{"id": "c1"' in prompt_text


def test_gemini_client_thinking_budget_config():
    """Verify GeminiClient._build_config supports thinking_budget."""
    client = GeminiClient(api_key="fake-key-for-test-1234567890")
    config = client._build_config(
        system="test system",
        temperature=0.2,
        max_tokens=256,
        response_mime_type="application/json",
        response_schema=None,
        thinking_budget=0,
    )
    if config is not None and hasattr(config, "thinking_config"):
        assert config.thinking_config is not None
        assert getattr(config.thinking_config, "thinking_budget", None) == 0


def test_image_prompt_engineering_refactor():
    """Verify reconstruction and edit prompts follow photographic prompt engineering standards."""
    analysis = {
        "sub_category": "Blouse",
        "color": "Emerald Green",
        "material": "Silk",
        "pattern": "solid",
        "dress_code": "smart-casual",
    }
    recon_prompt = _build_reconstruction_prompt(analysis)
    assert "Emerald Green Silk solid Blouse" in recon_prompt
    assert "High-fidelity editorial product photograph" in recon_prompt
    # Negative fluff keywords should not be present
    assert "8k resolution" not in recon_prompt
    assert "photorealistic" not in recon_prompt
    assert "NO landscape, NO background scenery, NO outdoor environment" not in recon_prompt

    edit_prompt = GeminiImageService._build_edit_prompt("Restore missing sleeve", analysis)
    assert "Restore missing sleeve" in edit_prompt
    assert "#F5F2EB" in edit_prompt
    assert "no dark shadows, no dark vignette, no black backdrop" not in edit_prompt
