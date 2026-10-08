"""Unit tests for Mourning & Shiva Fashion Etiquette and Sanitization Guards."""
import pytest
from app.services.fashion_rules_rag import retrieve_fashion_axioms
from app.services.stylist_scheduler_brain import calculate_garment_style_score
from app.services.gemini_stylist import sanitize_stylist_text, sanitize_stylist_payload


def test_mourning_axioms_retrieval():
    rules = retrieve_fashion_axioms(user_text="לבוש הולם לביקור משפחה של חבר בשבעה", top_k=4)
    rule_ids = [r.id for r in rules]
    assert "rule_cultural_mourning_shiva" in rule_ids
    mourning_rule = next(r for r in rules if r.id == "rule_cultural_mourning_shiva")
    assert "Mourning, Shiva" in mourning_rule.title
    assert "graphic" in mourning_rule.negative_constraint.lower()


def test_calculate_garment_style_score_mourning_penalties():
    prompt = "לבוש הולם לביקור משפחה של חבר בשבעה"

    # 1. Eagle graphic t-shirt (must be disqualified)
    eagle_tee = {
        "title": "חולצה עם הדפס נשר",
        "category": "top",
        "sub_category": "t-shirt",
        "tags": ["graphic", "eagle", "casual"],
    }
    assert calculate_garment_style_score(eagle_tee, prompt) == -100

    # 2. Shorts / Bermuda (must be disqualified)
    shorts = {
        "title": "מכנסיים קצרים אפורים",
        "category": "bottom",
        "sub_category": "shorts",
        "tags": ["summer", "shorts"],
    }
    assert calculate_garment_style_score(shorts, prompt) == -100

    # 3. Bright neon / yellow shirt (must be disqualified)
    neon_shirt = {
        "title": "חולצה צהובה זוהרת",
        "category": "top",
        "sub_category": "t-shirt",
        "tags": ["neon", "yellow", "party"],
    }
    assert calculate_garment_style_score(neon_shirt, prompt) == -100

    # 4. Plain dark trousers (must be strongly boosted)
    dark_pants = {
        "title": "מכנסי צ'ינו שחור כהה",
        "category": "bottom",
        "sub_category": "trousers",
        "tags": ["black", "tailored", "dark"],
    }
    assert calculate_garment_style_score(dark_pants, prompt) >= 40

    # 5. Plain dark collared shirt (must be boosted)
    dark_shirt = {
        "title": "חולצת פולו שחורה חלקה",
        "category": "top",
        "sub_category": "polo",
        "tags": ["black", "collared", "polo"],
    }
    assert calculate_garment_style_score(dark_shirt, prompt) >= 35


def test_sanitize_stylist_text_cjk_and_prefixes():
    # Chinese bleed into Hebrew
    raw_hebrew = "ה组装 הזהב של חליפת בישול משפחתית מושלמת ליום שבעה... ו保守ית, עם נקודות."
    cleaned = sanitize_stylist_text(raw_hebrew, lang="he")
    assert "组装" not in cleaned
    assert "保守" not in cleaned
    assert "שילוב" in cleaned
    assert "שמרני" in cleaned

    # English prefixes in Hebrew Do/Don't
    raw_dont = "Do not wear כיסויים קצרים או חולצות עם הדפסים"
    cleaned_dont = sanitize_stylist_text(raw_dont, lang="he")
    assert cleaned_dont.startswith("אין ללבוש כיסויים קצרים")

    raw_do = "Do wear מכנסיים כהים וחולצה מכופתרת"
    cleaned_do = sanitize_stylist_text(raw_do, lang="he")
    assert cleaned_do.startswith("מומלץ ללבוש מכנסיים כהים")

    raw_avoid = "Avoid wearing חולצות טי עם כיתובים"
    cleaned_avoid = sanitize_stylist_text(raw_avoid, lang="he")
    assert cleaned_avoid.startswith("להימנע מללבוש חולצות טי")


def test_sanitize_stylist_text_prefixes_all_languages():
    languages = ["he", "ar", "es", "fr", "de", "it", "pt", "nl", "ru", "zh", "ja", "hi"]
    for lang in languages:
        # 1. Do not wear
        t_dont = sanitize_stylist_text("Do not wear shorts and sandals", lang=lang)
        assert not t_dont.lower().startswith("do not wear"), f"Failed for lang {lang}: {t_dont}"
        assert not t_dont.lower().startswith("don't wear"), f"Failed for lang {lang}: {t_dont}"

        # 2. Do wear
        t_do = sanitize_stylist_text("Do wear tailored dark trousers", lang=lang)
        assert not t_do.lower().startswith("do wear"), f"Failed for lang {lang}: {t_do}"

        # 3. Avoid wearing
        t_avoid = sanitize_stylist_text("Avoid wearing bright colors", lang=lang)
        assert not t_avoid.lower().startswith("avoid wearing"), f"Failed for lang {lang}: {t_avoid}"


def test_sanitize_stylist_payload_urls_and_cjk():
    payload = {
        "reasoning_summary": "ה组装 המושלם לביקור אבלים.",
        "spoken_reply": "מראה מכובד ו保守.",
        "shopping_suggestions": [
            "https://www.example.com/products/5dc383e1-27f7-44fe-91a5-a5e088e2334e",
            "http://example.com/item/123",
            "חולצת פולו שחורה חלקה",
        ],
        "do_dont": [
            "Do not wear חולצות עם הדפסים",
            "Do wear חולצה כהה וחלקה",
        ],
        "outfit_recommendations": [
            {
                "name": "מראה שמרני ו组装 מכובד",
                "why": "מתאים לביקור אבלים",
                "items": [
                    {
                        "role": "top",
                        "description": "חולצה כהה ו保守ית",
                        "closet_item_id": "abc-123",
                    }
                ],
            }
        ],
    }

    sanitized = sanitize_stylist_payload(payload, lang="he")

    # Reasoning and spoken reply
    assert "组装" not in sanitized["reasoning_summary"]
    assert "שילוב" in sanitized["reasoning_summary"]
    assert "保守" not in sanitized["spoken_reply"]

    # Shopping suggestions: fake URLs eliminated!
    assert len(sanitized["shopping_suggestions"]) == 1
    assert sanitized["shopping_suggestions"][0] == "חולצת פולו שחורה חלקה"

    # Do/Don't localized
    assert sanitized["do_dont"][0].startswith("אין ללבוש")
    assert sanitized["do_dont"][1].startswith("מומלץ ללבוש")

    # Recommendations cleaned
    rec = sanitized["outfit_recommendations"][0]
    assert "组装" not in rec["name"]
    assert "保守" not in rec["items"][0]["description"]


def test_fallback_title_generation():
    from app.services.session_titles import _fallback_title, clean_title
    res = _fallback_title("לבוש הולם לביקור משפחה של חבר בשבעה")
    assert res == "לבוש הולם לביקור משפחה"
    assert clean_title("", fallback_query="לבוש הולם") == "לבוש הולם"


def test_tights_and_floral_disqualification():
    from app.services.fashion_rules_rag import filter_gender_closet_items

    floral_tights = {
        "id": "ccee8af2-135a-4e17-85a2-24fccc004bfd",
        "title": "טייץ פרחוני אפור עם מותן שחור",
        "category": "Bottom",
        "sub_category": "טייץ",
        "tags": ["טייץ", "אקטיבי", "פרחוני", "אפור"],
        "pattern": "floral",
    }

    # 1. Pruned by filter_gender_closet_items for male users
    filtered = filter_gender_closet_items([floral_tights], "male")
    assert len(filtered) == 0

    # 2. Scored -100 for male user in style score
    assert calculate_garment_style_score(floral_tights, "יום יום", user_gender="male") == -100

    # 3. Scored -100 for mourning / Shiva (floral + tights)
    assert calculate_garment_style_score(floral_tights, "לבוש הולם לשבעה") == -100


def test_do_not_prefix_without_space():
    raw1 = "DO NOTהתאמה אביזרי אופנה מודרנית או מפוארת"
    cleaned1 = sanitize_stylist_text(raw1, lang="he")
    assert cleaned1.startswith("אין ללבוש התאמה") or cleaned1.startswith("אין התאמה")

    raw2 = "DO NOT התאמה אביזרי אופנה"
    cleaned2 = sanitize_stylist_text(raw2, lang="he")
    assert cleaned2.startswith("אין ללבוש התאמה") or cleaned2.startswith("אין התאמה")


def test_shopping_suggestions_deduplication():
    payload = {
        "outfit_recommendations": [
            {
                "name": "חולצת כפתורים כחולה עם פסים ושרוול קצר",
                "items": [
                    {
                        "role": "top",
                        "description": "חולצת כפתורים כחולה עם פסים ושרוול קצר",
                        "closet_item_id": "adfa-123",
                    },
                    {
                        "role": "bottom",
                        "description": "מכנסיים מחויטים בצבע כחול כהה",
                        "closet_item_id": "d996-456",
                    },
                ],
            }
        ],
        "shopping_suggestions": [
            "חולצת כפתורים כחולה עם פסים ושרוול קצר",
            "מכנסיים מחויטים בצבע כחול כהה",
            "עניבה כחולה משובחת",
        ],
    }

    sanitized = sanitize_stylist_payload(payload, lang="he")
    # Duplicate shirt and pants must be pruned, leaving only the missing tie
    assert len(sanitized["shopping_suggestions"]) == 1
    assert sanitized["shopping_suggestions"][0] == "עניבה כחולה משובחת"
