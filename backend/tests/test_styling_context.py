"""Unit tests for StylingContext deep module (backend/app/services/styling_context.py)."""
import pytest
from app.services.styling_context import StylingContext, CategorizedWardrobe


def test_normalize_category():
    assert StylingContext._normalize_category("t-shirt") == "tops"
    assert StylingContext._normalize_category("hoodie") == "tops"
    assert StylingContext._normalize_category("jeans") == "bottoms"
    assert StylingContext._normalize_category("sneakers") == "shoes"
    assert StylingContext._normalize_category("dress") == "dresses"
    assert StylingContext._normalize_category("jacket") == "outerwear"
    assert StylingContext._normalize_category("watch") == "accessories"


def test_categorize_closet():
    items = [
        {"id": "1", "title": "White Tee", "category": "shirt", "clean_image_url": "data:image/png;base64,AAA"},
        {"id": "2", "title": "Blue Jeans", "category": "pants"},
        {"id": "3", "title": "Running Shoes", "category": "sneaker"},
    ]
    wardrobe = StylingContext._categorize_closet(items)
    assert isinstance(wardrobe, CategorizedWardrobe)
    assert len(wardrobe.tops) == 1
    assert wardrobe.tops[0]["title"] == "White Tee"
    assert len(wardrobe.bottoms) == 1
    assert len(wardrobe.shoes) == 1


def test_build_system_prompt_hebrew_localization():
    wardrobe = CategorizedWardrobe(
        tops=[{"id": "1", "title": "חולצה לבנה"}],
        bottoms=[{"id": "2", "title": "מכנסיים שחורים"}],
        shoes=[{"id": "3", "title": "נעליים אלגנטיות"}],
    )
    prompt = StylingContext._build_system_prompt(
        language="he",
        user_profile={"first_name": "Yoram", "gender": "male"},
        wardrobe=wardrobe,
        weather="24°C, sunny",
        calendar=None,
        occasion="Wedding",
        intent="event",
    )
    assert "Hebrew (עברית)" in prompt
    assert "Language code: he" in prompt
    assert "YOU MUST RESPOND EXCLUSIVELY IN Hebrew (עברית)" in prompt
    assert "Yoram" in prompt