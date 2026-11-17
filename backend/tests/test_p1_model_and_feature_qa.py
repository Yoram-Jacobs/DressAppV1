"""Regression tests for P1 Model QA, Sizing, Token Observability, Duplicate Color Gate, and Stylist Fixes."""

from __future__ import annotations

import base64
import io
import os
import sys
import warnings
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "pytest-p1-secret-value-0123456789abcdef")

from tests.test_p0_remediations import _FakeCollection, _FakeDB  # noqa: E402


def _make_tee_rgba_bytes(rgb: tuple[int, int, int]) -> bytes:
    """Create a synthetic studio t-shirt RGBA PNG on transparent backdrop (same silhouette)."""
    im = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    # Torso + sleeves silhouette
    draw.rectangle([36, 24, 92, 112], fill=(*rgb, 255))
    draw.rectangle([16, 24, 36, 62], fill=(*rgb, 255))
    draw.rectangle([92, 24, 112, 62], fill=(*rgb, 255))
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# 1. BUG-ML-01 & BUG-ML-02: BodyPredictor sklearn alignment & invariants
# ---------------------------------------------------------------------------
def test_p1_body_predictor_loads_cleanly_monotonic_and_ood_invariants() -> None:
    from app.services.body_predictor import BodyPredictor

    predictor = BodyPredictor()
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        res = predictor.predict(
            height_cm=170.0,
            weight_kg=64.0,
            waist_cm=84.0,
            foot_length_cm=23.5,
            gender="female",
        )
    version_warnings = [w for w in caught if "InconsistentVersionWarning" in type(w.message).__name__]
    assert version_warnings == [], f"Unexpected sklearn version mismatch warnings: {version_warnings}"
    assert predictor.model_version == "ansur2-gender-ridge-v2"
    assert set(res.keys()) == {"shoulders", "chest", "hip", "sleeve", "inseam", "outseam"}

    # Weight sweep monotonicity on chest circumference (no zigzag inversions)
    prev_chest = 0.0
    for wt in range(50, 131, 10):
        step_pred = predictor.predict(175.0, float(wt), 88.0, 26.5, "male")
        assert step_pred["chest"] >= prev_chest
        prev_chest = step_pred["chest"]

    # OOD extreme bounds preserve chest >= waist - 5 and outseam >= inseam + 18
    ood = predictor.predict(230.0, 250.0, 180.0, 40.0, "male")
    assert ood["chest"] >= 180.0 - 5.0
    assert ood["outseam"] >= ood["inseam"] + 18.0


# ---------------------------------------------------------------------------
# 2. BUG-ML-03: Foreground-masked color signature blocks Black vs Navy tee collision
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_p1_color_signature_blocks_black_vs_navy_tee_false_duplicate() -> None:
    from app.services.duplicate_detection import find_potential_duplicate
    from app.services.image_hash import (
        DEFAULT_COLOR_THRESHOLD,
        color_distance,
        color_signature,
        compute_sha256,
        compute_signatures,
        is_duplicate_match,
    )

    black_tee = _make_tee_rgba_bytes((20, 22, 26))
    navy_tee = _make_tee_rgba_bytes((25, 40, 95))

    ph_blk, cs_blk = compute_signatures(black_tee)
    ph_nav, cs_nav = compute_signatures(navy_tee)

    assert cs_blk is not None and len(cs_blk) == 24
    assert cs_nav is not None and len(cs_nav) == 24
    assert color_signature(black_tee) == cs_blk
    assert color_distance(cs_blk, cs_nav) > DEFAULT_COLOR_THRESHOLD

    # Same silhouette, different color must NOT match as duplicate
    assert (
        is_duplicate_match(
            compute_sha256(black_tee),
            compute_sha256(navy_tee),
            ph_blk,
            ph_nav,
            cs_blk,
            cs_nav,
        )
        is False
    )

    # Same color with minor lighting shift MUST still match
    black_lit = _make_tee_rgba_bytes((28, 30, 34))
    ph_blk2, cs_blk2 = compute_signatures(black_lit)
    assert is_duplicate_match(None, None, ph_blk, ph_blk2, cs_blk, cs_blk2) is True

    # End-to-end duplicate_detection gate must reject Black vs Navy match
    fake_db = _FakeDB()
    fake_db.closet_items = _FakeCollection(
        [
            {
                "id": "tee-black-1",
                "user_id": "u-dup",
                "title": "Crew Neck Tee",
                "category": "top",
                "sub_category": "t-shirt",
                "color": "black",
                "source_phash": ph_blk,
                "source_color_sig": cs_blk,
                "source_sha256": compute_sha256(black_tee),
            }
        ]
    )
    fake_cursor = MagicMock()
    fake_cursor.limit.return_value = fake_cursor
    fake_cursor.to_list = AsyncMock(return_value=list(fake_db.closet_items.docs))
    fake_db.closet_items.find = MagicMock(return_value=fake_cursor)

    with patch("app.services.duplicate_detection.get_db", return_value=fake_db):
        dup = await find_potential_duplicate(
            "u-dup",
            {
                "title": "Navy T-Shirt",
                "category": "top",
                "sub_category": "t-shirt",
                "color": "navy",
                "crop_base64": base64.b64encode(navy_tee).decode("ascii"),
            },
        )
        assert dup is None


# ---------------------------------------------------------------------------
# 3. BUG-ML-04: complete-outfit awaits embed_text (no encode_text AttributeError)
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_p1_complete_outfit_uses_async_embed_text_and_listing_embedding() -> None:
    from app.api.v1.closet.search_stats import CompleteOutfitIn, complete_outfit
    from app.services.fashion_clip import attach_listing_clip_embedding

    fake_db = _FakeDB()
    fake_db.listings = _FakeCollection(
        [
            {
                "id": "lst-1",
                "title": "Cream Linen Blazer",
                "category": "Outerwear",
                "color": "cream",
                "status": "active",
            },
            {
                "id": "lst-2",
                "title": "Stone Chino Trousers",
                "category": "Bottom",
                "color": "stone",
                "status": "active",
                "clip_embedding": [0.95, 0.05, 0.0, 0.0],
            },
        ]
    )
    fake_db.closet_items = _FakeCollection(
        [
            {
                "id": "c-bot-1",
                "user_id": "u-clip",
                "category": "Bottom",
                "title": "Navy Chinos",
                "clip_embedding": [1.0, 0.0, 0.0, 0.0],
            },
            {
                "id": "c-sho-1",
                "user_id": "u-clip",
                "category": "Shoes",
                "title": "Brown Loafers",
                "clip_embedding": [0.9, 0.1, 0.0, 0.0],
            },
        ]
    )

    mock_clip = SimpleNamespace(
        embed_text=AsyncMock(return_value=[1.0, 0.0, 0.0, 0.0]),
        cosine=lambda a, b: float(sum(x * y for x, y in zip(a, b))),
    )

    async def _fake_find_many(col, query, **_kwargs):
        if col is fake_db.closet_items:
            return list(fake_db.closet_items.docs)
        return [fake_db.listings.docs[1]]

    fake_repos = SimpleNamespace(
        find_one=AsyncMock(return_value=fake_db.listings.docs[0]),
        find_many=AsyncMock(side_effect=_fake_find_many),
    )

    with (
        patch("app.api.v1.closet.search_stats.get_db", return_value=fake_db),
        patch("app.api.v1.closet.search_stats.repos", fake_repos),
        patch("app.api.v1.closet.search_stats.fashion_clip_service", mock_clip),
        patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock, return_value=True),
        patch("app.services.gemini_stylist.get_gemini_stylist_service", MagicMock(return_value=None)),
    ):
        res = await complete_outfit(
            CompleteOutfitIn(item_ids=[], listing_id="lst-1", include_marketplace=True),
            user={"id": "u-clip"},
        )
        assert mock_clip.embed_text.await_count == 1
        assert res["has_embeddings"] is True
        assert any(it["id"] == "c-bot-1" for it in res["closet_suggestions"])
        assert any(m["id"] == "lst-2" for m in res["market_suggestions"])

    # Copying clip_embedding from linked closet_item into new listing
    listing_doc = {"id": "lst-new", "title": "Jacket", "category": "Outerwear"}
    await attach_listing_clip_embedding(listing_doc, source_item={"clip_embedding": [0.5, 0.5]})
    assert listing_doc["clip_embedding"] == [0.5, 0.5]


# ---------------------------------------------------------------------------
# 4. BUG-ML-05: Deterministic women's shirts, bust/hip dress, and clamped bra size
# ---------------------------------------------------------------------------
def test_p1_deterministic_womens_shirt_dress_and_bra_sizes() -> None:
    from app.api.v1.sizes import (
        compute_recommended_sizes,
        get_bra_size,
        get_womens_dress_size_us,
        get_womens_shirt_size,
    )

    # Gender-aware shirt mapping
    assert get_womens_shirt_size(86.0) == "S"
    assert get_womens_shirt_size(92.0) == "M"
    f_sizes = compute_recommended_sizes("female", 86.0, 68.0, 92.0, 24.0)
    m_sizes = compute_recommended_sizes("male", 86.0, 78.0, 92.0, 27.0)
    assert f_sizes["shirt_size"] == "S"
    assert m_sizes["shirt_size"] == "XS"

    # Dress mapping respects bust & hip dimensions
    assert get_womens_dress_size_us(84.0, 66.0, 91.0) == "2 / S"
    assert get_womens_dress_size_us(86.0, 66.0, 106.0) == "10 / L"
    assert get_womens_dress_size_us(110.0, 66.0, 120.0) == "14+ / XL"

    # Bra negative-diff bug fixed (never returns '30G+') and spans multiple cup letters
    assert get_bra_size(70.0, 75.0) == "30AA"
    cups_seen = {
        compute_recommended_sizes("female", chest, waist, 95.0, 24.0)["bra_size"][2:]
        for chest, waist in ((76.0, 74.0), (84.0, 70.0), (92.0, 68.0), (102.0, 68.0))
    }
    assert len(cups_seen) >= 3


# ---------------------------------------------------------------------------
# 5. BUG-STY-01: Live weather + deterministic harmony score on daily proposals
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_p1_daily_proposal_uses_live_weather_and_deterministic_harmony() -> None:
    from app.api.v1.daily_proposals import _generate_and_save_daily_proposal
    from app.services.stylist_scheduler_brain import compute_outfit_harmony_score

    h1 = compute_outfit_harmony_score(
        [
            {"role": "top", "color": "white", "pattern": "solid"},
            {"role": "bottom", "color": "navy", "pattern": "solid"},
            {"role": "shoes", "color": "brown"},
        ],
        weather={"temp_c": 21},
        occasion="daily",
    )
    h2 = compute_outfit_harmony_score(
        [
            {"role": "top", "color": "white", "pattern": "solid"},
            {"role": "bottom", "color": "navy", "pattern": "solid"},
            {"role": "shoes", "color": "brown"},
        ],
        weather={"temp_c": 21},
        occasion="daily",
    )
    assert h1 == h2 and 55 <= h1 <= 98

    fake_db = _FakeDB()
    fake_db.daily_proposals = _FakeCollection()
    fake_db.daily_proposals.update_many = AsyncMock()
    fake_db.closet_items = _FakeCollection(
        [
            {"id": "it-1", "user_id": "u-dp", "category": "top", "title": "White Tee", "color": "white"},
            {"id": "it-2", "user_id": "u-dp", "category": "bottom", "title": "Dark Jeans", "color": "navy"},
            {"id": "it-3", "user_id": "u-dp", "category": "shoes", "title": "White Sneakers", "color": "white"},
        ]
    )
    fake_db.closet_items.update_many = AsyncMock()
    user = {
        "id": "u-dp",
        "home_location": {"lat": 32.0853, "lng": 34.7818},
        "preferred_language": "en",
        "subscription": {"is_active": True, "tier": "professional", "plan_type": "professional"},
    }
    mock_weather = {"temp_c": 16.4, "description": "Partly Cloudy", "condition": "Clouds"}

    with (
        patch("app.api.v1.daily_proposals.get_db", return_value=fake_db),
        patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock, return_value=True),
        patch("app.api.v1.daily_proposals.resolve_user_target_weather", new_callable=AsyncMock, return_value=mock_weather),
        patch("app.services.stylist_scheduler_brain.get_recent_wardrobe_history", new_callable=AsyncMock, return_value=({}, [])),
        patch("app.api.v1.daily_proposals.generate_scheduled_proposals", new_callable=AsyncMock, return_value={"outfit_recommendations": []}),
    ):
        prop = await _generate_and_save_daily_proposal(user, "2026-11-18", force=True)
        assert prop["temperature"] == 16
        assert prop["weather_summary"] == "Partly Cloudy"
        assert len(prop["items"]) >= 2
        assert prop["harmony_score"] == compute_outfit_harmony_score(
            fake_db.closet_items.docs, weather=mock_weather
        )

    with (
        patch("app.api.v1.daily_proposals.get_db", return_value=fake_db),
        patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock, return_value=True),
        patch("app.api.v1.daily_proposals.resolve_user_target_weather", new_callable=AsyncMock, return_value=None),
        patch("app.services.stylist_scheduler_brain.get_recent_wardrobe_history", new_callable=AsyncMock, return_value=({}, [])),
        patch("app.api.v1.daily_proposals.generate_scheduled_proposals", new_callable=AsyncMock, return_value={"outfit_recommendations": []}),
    ):
        prop_no_weather = await _generate_and_save_daily_proposal(user, "2026-11-19", force=True)
        assert prop_no_weather["temperature"] is None
        assert prop_no_weather["weather_summary"] is None


# ---------------------------------------------------------------------------
# 6. BUG-FIN-03: TokenMeter & GeminiClient populate real tokens, model, and cost_usd
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_p1_token_usage_records_real_gemini_tokens_and_cost() -> None:
    from app.services import credit_manager as cm
    from app.services.gemini_client import _emit_gemini_usage

    fake_db = _FakeDB()
    fake_db.token_usage = _FakeCollection()
    fake_db.users.docs.append(
        {
            "id": "u-meter",
            "subscription": {"is_active": True, "tier": "manager", "plan_type": "manager"},
        }
    )

    assert cm.TokenMeter.compute_usd_cost("gemini", "gemini-3.5-flash-lite", 1000, 1000) == pytest.approx(0.000375)
    assert cm.TokenMeter.compute_usd_cost("runpod", "flux.2-klein-4b", 0, 0) == pytest.approx(0.004)

    with patch.object(cm, "get_db", return_value=fake_db):
        ok = await cm.deduct_user_credits(fake_db, fake_db.users.docs[0], cost=1, operation="stylist_chat")
        assert ok is True
        assert len(fake_db.token_usage.docs) == 1

        fake_resp = SimpleNamespace(
            usage_metadata=SimpleNamespace(prompt_token_count=320, candidates_token_count=90, thoughts_token_count=10)
        )
        await _emit_gemini_usage("gemini-3.5-flash-lite", fake_resp)

        row = fake_db.token_usage.docs[0]
        assert row["provider"] == "gemini"
        assert row["model"] == "gemini-3.5-flash-lite"
        assert row["input_tokens"] == 320
        assert row["output_tokens"] == 100
        assert row["cost_usd"] > 0.0
