import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from app.services.trend_scout import (
    MENS_BUCKETS,
    WOMENS_BUCKETS,
    CANONICAL_SEED_CARDS,
    get_search_queries,
    _clean_url,
    latest_trend_cards,
    fashion_scout_feed,
    monthly_trend_scout_refresh,
    rank_cards_for_user,
)

def test_mens_and_womens_ecosystem_structure():
    assert len(MENS_BUCKETS) == 7
    assert len(WOMENS_BUCKETS) == 7

    men_slugs = {b["slug"] for b in MENS_BUCKETS}
    women_slugs = {b["slug"] for b in WOMENS_BUCKETS}
    expected_slugs = {"local", "runway", "street", "sustainability", "influencers", "vintage", "maintenance_repairs"}
    
    assert men_slugs == expected_slugs
    assert women_slugs == expected_slugs

    # Verify seed cards cover all 14 buckets
    men_seeds = [s for s in CANONICAL_SEED_CARDS if s["gender"] == "male"]
    women_seeds = [s for s in CANONICAL_SEED_CARDS if s["gender"] == "female"]
    assert len(men_seeds) == 7
    assert len(women_seeds) == 7


def test_clean_url_enforcement():
    # Valid direct links
    assert _clean_url("https://fashion.walla.co.il/item/123") == "https://fashion.walla.co.il/item/123"
    assert _clean_url("https://www.lofficielusa.com/fashion/article") == "https://www.lofficielusa.com/fashion/article"

    # Disallowed shopping / checkout platforms
    assert _clean_url("https://www.amazon.com/dp/B08N5WRWNW") is None
    assert _clean_url("https://www.shein.com/goods-p-12345.html") is None
    assert _clean_url("https://www.zara.com/shop/cart") is None

    # Disallowed paywalls
    assert _clean_url("https://www.voguebusiness.com/companies/story") is None
    assert _clean_url("https://www.wsj.com/articles/fashion-123") is None

    # Search engine redirect unwrapping
    google_redirect = "https://www.google.com/url?q=https%3A%2F%2Ffashionista.com%2F2026%2Ftrend&sa=U"
    assert _clean_url(google_redirect) == "https://fashionista.com/2026/trend"


def test_search_queries_localization_and_gender():
    # Men's local query for Israel
    men_il_queries = get_search_queries("local", country_code="IL", gender="male")
    assert any("fashion.walla.co.il" in q or "timeout.co.il" in q or "אופנת גברים" in q for q in men_il_queries)

    # Women's local query for Israel
    women_il_queries = get_search_queries("local", country_code="IL", gender="female")
    assert any("fashionforward.mako.co.il" in q or "atmag.co.il" in q or "מעצבים ישראלים" in q for q in women_il_queries)

    # Men's Runway queries
    men_runway_queries = get_search_queries("runway", country_code=None, gender="male")
    assert any("thefashionisto.com" in q or "fuckingyoung.es" in q or "malemodelscene.net" in q for q in men_runway_queries)

    # Women's Runway queries
    women_runway_queries = get_search_queries("runway", country_code=None, gender="female")
    assert any("lofficielusa.com" in q or "fashionista.com" in q for q in women_runway_queries)


def test_gender_ranking():
    user_male = {
        "id": "u_male",
        "sex": "male",
        "home_location": {"country_code": "IL", "city": "Tel Aviv"}
    }
    user_female = {
        "id": "u_female",
        "sex": "female",
        "home_location": {"country_code": "IL", "city": "Tel Aviv"}
    }

    # Male ranking should boost male cards
    ranked_for_male = rank_cards_for_user(CANONICAL_SEED_CARDS, user_male)
    assert ranked_for_male[0]["gender"] == "male"

    # Female ranking should boost female cards
    ranked_for_female = rank_cards_for_user(CANONICAL_SEED_CARDS, user_female)
    assert ranked_for_female[0]["gender"] == "female"


@pytest.mark.anyio
async def test_latest_trend_cards_fallback():
    mock_db = MagicMock()
    mock_cursor = MagicMock()

    async def empty_iter(*args, **kwargs):
        if False:
            yield

    mock_cursor.__aiter__ = empty_iter
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_db.trend_reports.find.return_value = mock_cursor
    mock_db.trend_reports.count_documents = AsyncMock(return_value=1)
    mock_db.trend_reports.update_many = AsyncMock()

    with patch("app.services.trend_scout.get_db", return_value=mock_db):
        cards_male = await latest_trend_cards(gender="male", country="IL")
        assert len(cards_male) == 7
        assert all(c["gender"] == "male" for c in cards_male)
        assert all(bool(c.get("image_url") and c["image_url"].startswith("http")) for c in cards_male)

        cards_female = await latest_trend_cards(gender="female", country="IL")
        assert len(cards_female) == 7
        assert all(c["gender"] == "female" for c in cards_female)
        assert all(bool(c.get("image_url") and c["image_url"].startswith("http")) for c in cards_female)


def test_card_images_and_deep_links_guaranteed():
    from app.services.trend_scout import _ensure_card_image, _get_fallback_image
    import urllib.parse

    # All canonical seed cards must have valid image URLs and deep article source links
    for seed in CANONICAL_SEED_CARDS:
        assert seed.get("image_url") is not None
        assert seed["image_url"].startswith("https://")

        # Must have specific source URL and not just root domain
        source_url = seed.get("source_url")
        assert source_url is not None
        assert source_url.startswith("https://")
        parsed = urllib.parse.urlparse(source_url)
        path = (parsed.path or "").strip("/")
        assert len(path) > 0, f"Seed card {seed['id']} has root domain source_url: {source_url}"

    # Card with missing image_url gets filled by _ensure_card_image
    empty_card = {"bucket": "street", "gender": "male", "headline": "Test Card"}
    filled = _ensure_card_image(empty_card)
    # Card with broken domain image gets replaced with verified fallback
    broken_img_card = {"bucket": "local", "gender": "male", "image_url": "https://ynet-pic1.ynet.co.il/pics/Maskit.jpg"}
    healed = _ensure_card_image(broken_img_card)
    assert "ynet-pic1.ynet.co.il" not in healed["image_url"]
    assert healed["image_url"].startswith("https://images.unsplash.com")


def test_sanitize_localized_text():
    from app.services.trend_scout import _sanitize_localized_text
    
    # Cleans corrupted hybrid mixed-script words
    mangled_headline = "קampaigת מיקונוס של CANDID ממריא"
    cleaned = _sanitize_localized_text(mangled_headline, "he")
    assert "קampaigת" not in cleaned
    assert "קמפיין" in cleaned
    
    # Preserves clean pure text
    clean_headline = "קמפיין מיקונוס של CANDID ממריא"
    assert _sanitize_localized_text(clean_headline, "he") == clean_headline


