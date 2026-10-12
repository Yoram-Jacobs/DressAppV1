"""Unit and integration tests for Google Translate in the DressApp Eyes pipeline."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.translation_service import (
    normalize_lang,
    translate_text,
    translate_batch,
    translate_stylist_payload,
    translate_garment_attributes,
    _apply_fashion_glossary,
)


def test_normalize_lang():
    assert normalize_lang("he") == "he"
    assert normalize_lang("iw") == "he"
    assert normalize_lang("HE") == "he"
    assert normalize_lang("ar") == "ar"
    assert normalize_lang("es") == "es"
    assert normalize_lang("zh-cn") == "zh"
    assert normalize_lang(None) == "en"
    assert normalize_lang("") == "en"


def test_apply_fashion_glossary():
    # Salwar variations replaced with canonical Hebrew שרוואל
    assert "שרוואל" in _apply_fashion_glossary("חליפת סלוואר קמיז", "he")
    assert "שרוואל" in _apply_fashion_glossary("מכנסי סלבר ירוקים", "he")
    assert "שרוואל" in _apply_fashion_glossary("שלוואר משי", "he")


@pytest.mark.asyncio
async def test_translate_text_same_lang_fast_return():
    res = await translate_text("Hello world", target_lang="en", source_lang="en")
    assert res == "Hello world"


@pytest.mark.asyncio
async def test_translate_text_with_mocked_gemini():
    with patch("app.services.translation_service._translate_via_google_gemini", new_callable=AsyncMock) as mock_gemini:
        mock_gemini.return_value = ["קורטה משי שחור וזהב עם צ'ורידר ירוק"]

        res = await translate_text(
            "Black & Gold Silk Kurta with Green Churidar",
            target_lang="he",
            source_lang="en",
        )
        assert res == "קורטה משי שחור וזהב עם צ'ורידר ירוק"
        mock_gemini.assert_called_once()


@pytest.mark.asyncio
async def test_translate_stylist_payload():
    sample_payload = {
        "spoken_reply": "Here is an outfit for the event.",
        "reasoning_summary": "Classic formal attire.",
        "outfit_recommendations": [
            {
                "name": "Navy Blazer and Grey Trousers",
                "why": "Appropriate for city hall business meetings.",
                "designer_notes": "Tailored fit.",
                "items": [
                    {"id": "item1", "category": "Outerwear", "description": "Tailored navy wool blazer"},
                    {"id": "item2", "category": "Bottom", "description": "Charcoal wool trousers"}
                ],
            }
        ],
        "shopping_suggestions": [
            {"name": "Silk Pocket Square", "why": "Adds a refined touch", "notes": "White or pale blue"}
        ],
        "do_dont": ["Do wear polished shoes", "Don't wear sneakers"]
    }

    mock_translations = [
        "הנה תלבושת לאירוע.",
        "לבוש רשמי קלאסי.",
        "בלייזר כחול נייבי ומכנסיים אפורים",
        "מתאים לפגישות עסקיות בעירייה.",
        "גזרה מחויטת.",
        "בלייזר צמר כחול נייבי מחויט",
        "מכנסי צמר בצבע פחם",
        "מטפחת כיס ממשי",
        "מוסיפה מגע מעודן",
        "לבן או תכלת",
        "כן לנעול נעליים מצוחצחות",
        "לא לנעול נעלי ספורט",
    ]

    with patch("app.services.translation_service._translate_via_google_gemini", new_callable=AsyncMock) as mock_gemini:
        mock_gemini.return_value = mock_translations

        translated = await translate_stylist_payload(sample_payload, target_lang="he")

        assert translated["spoken_reply"] == "הנה תלבושת לאירוע."
        assert translated["reasoning_summary"] == "לבוש רשמי קלאסי."
        rec = translated["outfit_recommendations"][0]
        assert rec["name"] == "בלייזר כחול נייבי ומכנסיים אפורים"
        assert rec["why"] == "מתאים לפגישות עסקיות בעירייה."
        assert rec["items"][0]["id"] == "item1"
        assert rec["items"][0]["category"] == "Outerwear"
        assert rec["items"][0]["description"] == "בלייזר צמר כחול נייבי מחויט"
        assert translated["shopping_suggestions"][0]["name"] == "מטפחת כיס ממשי"
        assert translated["do_dont"][0] == "כן לנעול נעליים מצוחצחות"


@pytest.mark.asyncio
async def test_translate_garment_attributes():
    sample_garment = {
        "title": "Black Silk Kurta",
        "name": "Black Silk Kurta",
        "caption": "An elegant embroidered black silk kurta.",
        "category": "Top",
        "sub_category": "Kurta",
        "tags": ["traditional", "embroidery", "silk"],
        "repair_advice": "Dry clean only."
    }

    mock_trans = [
        "קורטה משי שחורה",
        "קורטה משי שחורה",
        "קורטה משי שחורה ורקומה אלגנטית.",
        "ניקוי יבש בלבד.",
        "מסורתי",
        "רקמה",
        "משי",
    ]

    with patch("app.services.translation_service._translate_via_google_gemini", new_callable=AsyncMock) as mock_gemini:
        mock_gemini.return_value = mock_trans

        translated = await translate_garment_attributes(sample_garment, target_lang="he")
        assert translated["title"] == "קורטה משי שחורה"
        assert translated["caption"] == "קורטה משי שחורה ורקומה אלגנטית."
        assert translated["repair_advice"] == "ניקוי יבש בלבד."
        assert translated["category"] == "Top"  # Enum stays English
        assert translated["sub_category"] == "Kurta"
        assert "רקמה" in translated["tags"]
