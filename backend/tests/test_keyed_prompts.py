"""Unit tests for Keyed Prompt Injection Architecture (Phase 2)."""
import pytest
from app.services.keyed_prompts import (
    KEY_GARMENT_VISION,
    KEY_SCHEDULED_OUTFIT,
    KEY_STYLIST_CHAT,
    KEY_SUITCASE,
    KEY_TREND_SCOUT,
    PROMPT_GARMENT_VISION,
    PROMPT_SCHEDULED_OUTFIT,
    PROMPT_STYLIST_CHAT,
    PROMPT_SUITCASE,
    PROMPT_TREND_SCOUT,
    KEYED_PROMPTS,
    get_keyed_prompt,
)


def test_keyed_prompts_registry_contains_all_five_workflows():
    """Verify all 5 core workflows are registered with non-empty prompts."""
    expected_keys = {
        KEY_GARMENT_VISION,
        KEY_SCHEDULED_OUTFIT,
        KEY_STYLIST_CHAT,
        KEY_SUITCASE,
        KEY_TREND_SCOUT,
    }
    assert set(KEYED_PROMPTS.keys()) == expected_keys
    for k in expected_keys:
        prompt = KEYED_PROMPTS[k]
        assert isinstance(prompt, str)
        assert len(prompt) > 50, f"Prompt for {k} is too short"


def test_garment_vision_prompt_contract():
    """Verify garment vision keyed prompt contains critical rules."""
    p = get_keyed_prompt(KEY_GARMENT_VISION)
    assert p == PROMPT_GARMENT_VISION
    # Enforces JSON only
    assert "JSON" in p
    # Enforces unique 2-4 word titles
    assert "unique" in p.lower()
    # Enforces 3-tier gender hierarchy
    assert "3-tier hierarchy" in p.lower() or "gender" in p.lower()
    # Includes camouflage pattern
    assert "camouflage" in p.lower()
    # Enforces strict background surface rejection
    assert "background rejection" in p.lower()
    assert "background surfaces" in p.lower()


def test_scheduled_outfit_prompt_contract():
    """Verify scheduled outfit prompt includes full outfit requirement."""
    p = get_keyed_prompt(KEY_SCHEDULED_OUTFIT)
    assert p == PROMPT_SCHEDULED_OUTFIT
    assert "Complete Outfits" in p or "top+bottom" in p
    assert "footwear" in p.lower() or "shoes" in p.lower()
    assert "proposals" in p


def test_stylist_chat_prompt_contract():
    """Verify stylist chat prompt includes anatomical order and multi-turn."""
    p = get_keyed_prompt(KEY_STYLIST_CHAT)
    assert p == PROMPT_STYLIST_CHAT
    assert "Anatomical Order" in p
    assert "Multi-turn" in p or "conversation history" in p
    assert "outfit_recommendations" in p


def test_suitcase_prompt_contract():
    """Verify suitcase packing prompt includes capsule efficiency and stores."""
    p = get_keyed_prompt(KEY_SUITCASE)
    assert p == PROMPT_SUITCASE
    assert "Capsule Efficiency" in p or "capsule" in p.lower()
    assert "missing_items" in p
    assert "local_fashion_stores" in p


def test_trend_scout_prompt_contract():
    """Verify trend scout prompt includes anti-marketplace and anti-paywall rules."""
    p = get_keyed_prompt(KEY_TREND_SCOUT)
    assert p == PROMPT_TREND_SCOUT
    assert "No marketplaces" in p or "Amazon" in p
    assert "No paywalls" in p
    assert "browse_web" in p
    assert "finish" in p


def test_alias_resolution():
    """Verify common workflow key aliases resolve to canonical prompts."""
    # Garment vision aliases
    assert get_keyed_prompt("vision") == PROMPT_GARMENT_VISION
    assert get_keyed_prompt("garmentvision") == PROMPT_GARMENT_VISION
    assert get_keyed_prompt("<garmentVision>") == PROMPT_GARMENT_VISION
    assert get_keyed_prompt("gemma") == PROMPT_GARMENT_VISION

    # Scheduled outfit aliases
    assert get_keyed_prompt("scheduler") == PROMPT_SCHEDULED_OUTFIT
    assert get_keyed_prompt("scheduled_outfit") == PROMPT_SCHEDULED_OUTFIT
    assert get_keyed_prompt("<Scheduled Outfit>") == PROMPT_SCHEDULED_OUTFIT

    # Stylist chat aliases
    assert get_keyed_prompt("stylist") == PROMPT_STYLIST_CHAT
    assert get_keyed_prompt("chat") == PROMPT_STYLIST_CHAT
    assert get_keyed_prompt("<Stylist Chat>") == PROMPT_STYLIST_CHAT

    # Suitcase aliases
    assert get_keyed_prompt("travel") == PROMPT_SUITCASE
    assert get_keyed_prompt("packing") == PROMPT_SUITCASE
    assert get_keyed_prompt("<Suitcase>") == PROMPT_SUITCASE

    # Trend scout aliases
    assert get_keyed_prompt("trend") == PROMPT_TREND_SCOUT
    assert get_keyed_prompt("fashion_scout") == PROMPT_TREND_SCOUT
    assert get_keyed_prompt("<Trend Scout>") == PROMPT_TREND_SCOUT


def test_fallback_behavior():
    """Verify unknown keys fall back to specified fallback or garment_vision."""
    custom_fallback = "CUSTOM_FALLBACK_PROMPT"
    assert get_keyed_prompt("unknown_workflow", fallback=custom_fallback) == custom_fallback
    assert get_keyed_prompt("completely_random_key") == PROMPT_GARMENT_VISION
