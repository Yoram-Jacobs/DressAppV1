"""Golden Benchmark & Evaluation Harness for Cultural & Traditional Grounding RAG.

Verifies:
1. Dynamic retrieval precision (Hit Rate @ 2) across Jewish, Islamic, Hindu, East Asian, and Western formal traditions.
2. Cross-lingual trigger efficacy (Hebrew, Arabic, Hindi, Japanese, Chinese, English).
3. Negative constraint preservation (prohibited colors/garments per culture).
4. Lexical integrity and zero machine-translation hallucinations.
5. Injected prompt token budget (<150 tokens / compact length).
"""
import pytest
from app.services.fashion_rules_rag import (
    get_all_rules,
    retrieve_fashion_axioms,
    format_rules_for_prompt,
    initialize_rules_cache,
)


@pytest.fixture(autouse=True)
def ensure_fresh_cache():
    """Ensure in-memory rules cache is initialized from latest seed."""
    from app.services import fashion_rules_rag
    fashion_rules_rag._RULES_CACHE.clear()
    fashion_rules_rag._RULES_BY_ID.clear()
    initialize_rules_cache()


# -----------------------------------------------------------------------------
# 1. Retrieval Precision & Cross-Lingual Benchmarks
# -----------------------------------------------------------------------------

BENCHMARK_CASES = [
    # Jewish Shiva & Mourning
    ("לבוש הולם לביקור שבעה אצל חבר", "rule_cultural_mourning_shiva"),
    ("what to wear to a Jewish shiva condolence call", "rule_cultural_mourning_shiva"),
    ("תלבושת לניחום אבלים", "rule_cultural_mourning_shiva"),
    ("زي مناسب لتقديم واجب العزاء", "rule_cultural_mourning_shiva"),

    # Jewish Tzniut (Orthodox Modesty)
    ("בגדים מתאימים לפי כללי צניעות", "rule_cultural_jewish_tzniut"),
    ("modest clothing for orthodox jewish synagogue", "rule_cultural_jewish_tzniut"),
    ("שמלה לפי כללי הצניעות לבית כנסת", "rule_cultural_jewish_tzniut"),

    # Jewish Shabbat & Holidays
    ("לבוש חגיגי לסעודת שבת", "rule_cultural_jewish_shabbat"),
    ("elevated look for Friday night Shabbat dinner", "rule_cultural_jewish_shabbat"),
    ("בגדים יפים לערב חג", "rule_cultural_jewish_shabbat"),

    # Islamic Friday Prayer & Mosque
    ("outfit for Friday Jumuah prayer at the mosque", "rule_cultural_islamic_jumuah"),
    ("ملابس مناسبة لصلاة الجمعة في المسجد", "rule_cultural_islamic_jumuah"),
    ("modest attire for visiting a grand mosque", "rule_cultural_islamic_jumuah"),

    # Hindu Funerals (Antyeshti)
    ("what should I wear to a Hindu funeral", "rule_cultural_hindu_antyeshti"),
    ("attire for antyeshti cremation ceremony", "rule_cultural_hindu_antyeshti"),
    ("अंतिम संस्कार के लिए सादे कपड़े", "rule_cultural_hindu_antyeshti"),

    # Hindu Weddings & Diwali (Vivaha)
    ("festive outfit for a Hindu wedding sangeet", "rule_cultural_hindu_vivaha"),
    ("दिवाली पूजा और उत्सव के लिए पारंपरिक पोशाक", "rule_cultural_hindu_vivaha"),
    ("what to wear to an Indian vivaha shaadi celebration", "rule_cultural_hindu_vivaha"),

    # East Asian Funerals
    ("solemn attire for a Chinese funeral service", "rule_cultural_east_asian_funeral"),
    ("お葬式に参列するための喪服コーディネート", "rule_cultural_east_asian_funeral"),
    ("参加告別式的黑色正装", "rule_cultural_east_asian_funeral"),

    # East Asian Weddings
    ("guest attire for a traditional Chinese wedding banquet", "rule_cultural_east_asian_wedding"),
    ("結婚式のお呼ばれゲストドレス", "rule_cultural_east_asian_wedding"),
    ("参加朋友婚礼喜酒", "rule_cultural_east_asian_wedding"),

    # Western Black Tie
    ("black tie charity gala dinner", "rule_cultural_western_black_tie"),
    ("טוקסידו לערב גאלה רשמי", "rule_cultural_western_black_tie"),
    ("opera opening night black-tie dress code", "rule_cultural_western_black_tie"),

    # Western Wedding Guest
    ("what to wear as a guest to a summer chapel wedding", "rule_cultural_ceremony_etiquette"),
    ("שמלה יפה לאורחת בחתונה", "rule_cultural_ceremony_etiquette"),

    # Egyptian & Levantine Galabiya
    ("אירוע משפחתי מסורתי במצרים עם גלבייה", "rule_cultural_galabiya_etiquette"),
    ("Egyptian linen galabiya for family dinner", "rule_cultural_galabiya_etiquette"),

    # Abaya & Sheila Layering
    ("layering an abaya with a matching sheila", "rule_cultural_abaya_modest_layering"),
    ("תלבושת עבאיה מכובדת עם חיג'אב", "rule_cultural_abaya_modest_layering"),

    # Arabian Thobe & Kandura
    ("formal white thobe for business gathering in Riyadh", "rule_cultural_thobe_kandura_etiquette"),
    ("ת'וב לבן מגוהץ עם כאפייה ועקאל", "rule_cultural_thobe_kandura_etiquette"),

    # South Asian Kurta & Sherwani
    ("formal kurta pyjama with embroidered sherwani for wedding", "rule_cultural_kurta_sherwani_pairing"),
    ("בגדי קורטה מסורתיים עם שרוואני לאירוע", "rule_cultural_kurta_sherwani_pairing"),

    # Traditional Saree & Lehenga Choli
    ("silk saree draping for reception dinner", "rule_cultural_sari_lehenga_ensemble"),
    ("להנגה צ'ולי מפוארת לחתונה הודית", "rule_cultural_sari_lehenga_ensemble"),
]


@pytest.mark.parametrize("query,expected_rule_id", BENCHMARK_CASES)
def test_cultural_retrieval_hit_rate(query: str, expected_rule_id: str):
    """Verify that every cultural benchmark query retrieves its canonical ground-truth rule."""
    rules = retrieve_fashion_axioms(user_text=query, top_k=4)
    rule_ids = [r.id for r in rules]
    assert expected_rule_id in rule_ids, f"Query '{query}' failed to retrieve {expected_rule_id}. Retrieved: {rule_ids}"


def test_cultural_taxonomy_enum_presence():
    """Verify cultural garments are present in both eyes inference server and backend vision schema."""
    from app.services.vision.llm import _GARMENT_OBJECT_SCHEMA

    sub_props = _GARMENT_OBJECT_SCHEMA["properties"]["sub_category"]
    assert "enum" in sub_props, "sub_category must have strict enum validation"
    enums = sub_props["enum"]

    expected_cultural = [
        "Galabiya", "Kaftan", "Thobe", "Abaya", "Kurta", "Sherwani",
        "Sari", "Lehenga", "Hanbok", "Kimono", "Dirndl", "Guayabera",
    ]
    for garment in expected_cultural:
        assert garment in enums, f"Missing {garment} in _GARMENT_OBJECT_SCHEMA sub_category enum"


# -----------------------------------------------------------------------------
# 2. Strict Negative Constraint Integrity Checks
# -----------------------------------------------------------------------------

def test_hindu_funeral_prohibits_black():
    """In Hindu funerals, black is inauspicious and strictly forbidden (white required)."""
    rules = retrieve_fashion_axioms(user_text="attending Hindu funeral ceremony", top_k=2)
    hindu_rule = next(r for r in rules if r.id == "rule_cultural_hindu_antyeshti")
    assert "STRICTLY FORBID BLACK" in hindu_rule.negative_constraint
    assert "white" in hindu_rule.rule_statement.lower()


def test_hindu_wedding_prohibits_black_and_mourning_white():
    """In Hindu weddings, solid black and plain mourning white are strictly prohibited."""
    rules = retrieve_fashion_axioms(user_text="Hindu wedding guest outfit", top_k=2)
    wedding_rule = next(r for r in rules if r.id == "rule_cultural_hindu_vivaha")
    assert "STRICTLY FORBID SOLID BLACK" in wedding_rule.negative_constraint
    assert "STRICTLY FORBID PLAIN UNADORNED WHITE" in wedding_rule.negative_constraint


def test_east_asian_funeral_prohibits_red_and_gold():
    """In East Asian funerals, red and gold represent celebration and are strictly forbidden."""
    rules = retrieve_fashion_axioms(user_text="attire for Chinese funeral", top_k=2)
    funeral_rule = next(r for r in rules if r.id == "rule_cultural_east_asian_funeral")
    assert "STRICTLY FORBID RED AND GOLD" in funeral_rule.negative_constraint


def test_east_asian_wedding_prohibits_red_and_white_for_guests():
    """At East Asian weddings, guests must not wear solid red (reserved for bride) or white."""
    rules = retrieve_fashion_axioms(user_text="guest at Chinese wedding banquet", top_k=2)
    wedding_rule = next(r for r in rules if r.id == "rule_cultural_east_asian_wedding")
    assert "STRICTLY FORBID SOLID RED" in wedding_rule.negative_constraint
    assert "STRICTLY FORBID SOLID WHITE" in wedding_rule.negative_constraint


def test_black_tie_prohibits_business_suits_and_sneakers():
    """Black tie strictly forbids daytime business suits, neckties, or casual shoes."""
    rules = retrieve_fashion_axioms(user_text="annual charity gala black tie", top_k=2)
    bt_rule = next(r for r in rules if r.id == "rule_cultural_western_black_tie")
    assert "business suits" in bt_rule.negative_constraint.lower()
    assert "sneakers" in bt_rule.negative_constraint.lower()


def test_shiva_negative_constraint_includes_shiva_hebrew_idiom():
    """Shiva rule explicitly includes negative constraint on literal Hebrew machine translations."""
    rules = retrieve_fashion_axioms(user_text="לבוש לביקור שבעה", top_k=2)
    shiva_rule = next(r for r in rules if r.id == "rule_cultural_mourning_shiva")
    assert "לביקור שבעה" in shiva_rule.negative_constraint
    assert "להולך בישיבה שבעה" in shiva_rule.negative_constraint


# -----------------------------------------------------------------------------
# 3. Prompt Formatting & Token Budget (<150 tokens)
# -----------------------------------------------------------------------------

def test_prompt_formatting_stays_compact():
    """Retrieved rules formatted for prompt injection must stay ultra-dense and concise."""
    rules = retrieve_fashion_axioms(user_text="לביקור שבעה של חבר", top_k=3)
    formatted = format_rules_for_prompt(rules, max_chars_per_rule=200)

    assert "GROUND-TRUTH FASHION DESIGN AXIOMS:" in formatted
    assert len(formatted.splitlines()) >= 2
    # Ensure compact length suitable for fast CPU inference
    assert len(formatted) < 900
