import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from app.services.trend_scout import (
    MENS_BUCKETS,
    WOMENS_BUCKETS,
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


def test_clean_url_enforcement():
    # Valid direct links
    assert _clean_url("https://fashion.walla.co.il/item/123") == "https://fashion.walla.co.il/item/123"
    assert _clean_url("https://www.lofficielusa.com/fashion/article") == "https://www.lofficielusa.com/fashion/article"

    # Disallowed shopping / checkout platforms & online stores
    assert _clean_url("https://www.amazon.com/dp/B08N5WRWNW") is None
    assert _clean_url("https://www.shein.com/goods-p-12345.html") is None
    assert _clean_url("https://www.zara.com/shop/cart") is None
    assert _clean_url("https://shopisrael.com/blogs/style-gifts/fashion-forward-israel-inspired-clothes-for-the-modern-wardrobe") is None
    assert _clean_url("https://brand.myshopify.com/products/jacket") is None
    assert _clean_url("https://store.brand.com/item/123") is None

    # Disallowed paywalls & social logins
    assert _clean_url("https://www.voguebusiness.com/companies/story") is None
    assert _clean_url("https://www.wsj.com/articles/fashion-123") is None
    assert _clean_url("https://www.facebook.com/login/?next=https://example.com") is None
    assert _clean_url("https://www.instagram.com/p/12345") is None

    # Disallowed table of contents / TOC index paths
    assert _clean_url("https://www.fashionbeans.com/table_of_content/20-summer-fashion-staples") is None
    assert _clean_url("https://example-mag.com/toc/summer-guide") is None

    # Search engine redirect unwrapping
    google_redirect = "https://www.google.com/url?q=https%3A%2F%2Ffashionista.com%2F2026%2Ftrend&sa=U"
    assert _clean_url(google_redirect) == "https://fashionista.com/2026/trend"


def test_search_queries_localization_and_gender():
    import urllib.parse

    # Men's local query for Israel
    men_il_raw = get_search_queries("local", country_code="IL", gender="male")
    men_il_queries = [urllib.parse.unquote_plus(q) for q in men_il_raw]
    assert any("אופנת גברים" in q or "Tel Aviv" in q for q in men_il_queries)
    # Ensure NO hardcoded website domains
    assert not any("site:" in q or "fashion.walla.co.il" in q or "timeout.co.il" in q for q in men_il_queries)

    # Women's local query for Israel
    women_il_raw = get_search_queries("local", country_code="IL", gender="female")
    women_il_queries = [urllib.parse.unquote_plus(q) for q in women_il_raw]
    assert any("מעצבים ישראלים" in q or "Tel Aviv" in q for q in women_il_queries)
    assert not any("site:" in q or "fashionforward.mako.co.il" in q or "atmag.co.il" in q for q in women_il_queries)

    # Men's Runway queries
    men_runway_raw = get_search_queries("runway", country_code=None, gender="male")
    men_runway_queries = [urllib.parse.unquote_plus(q) for q in men_runway_raw]
    assert any("menswear" in q or "mens" in q or "runway" in q for q in men_runway_queries)
    assert not any("site:" in q or "thefashionisto.com" in q for q in men_runway_queries)

    # Women's Runway queries
    women_runway_raw = get_search_queries("runway", country_code=None, gender="female")
    women_runway_queries = [urllib.parse.unquote_plus(q) for q in women_runway_raw]
    assert any("womens" in q or "runway" in q or "couture" in q for q in women_runway_queries)
    assert not any("site:" in q or "lofficielusa.com" in q for q in women_runway_queries)

    # Men's Influencer queries with Facebook connected in Israel
    men_inf_raw = get_search_queries("influencers", country_code="IL", gender="male", social_platforms=["facebook"])
    men_inf_queries = [urllib.parse.unquote_plus(q) for q in men_inf_raw]
    assert any("facebook" in q.lower() for q in men_inf_queries)
    assert any("ישראל" in q or "Tel Aviv" in q for q in men_inf_queries)


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

    sample_cards = [
        {"id": "c_male", "headline": "Men Fashion", "gender": "male", "bucket": "runway", "date": "2026-08-01"},
        {"id": "c_female", "headline": "Women Fashion", "gender": "female", "bucket": "runway", "date": "2026-08-01"},
    ]

    # Male ranking should boost male cards
    ranked_for_male = rank_cards_for_user(sample_cards, user_male)
    assert ranked_for_male[0]["gender"] == "male"

    # Female ranking should boost female cards
    ranked_for_female = rank_cards_for_user(sample_cards, user_female)
    assert ranked_for_female[0]["gender"] == "female"


@pytest.mark.anyio
async def test_latest_trend_cards_no_hardcoded_seeds():
    mock_db = MagicMock()
    mock_cursor = MagicMock()

    # When database is empty, return empty list (no hardcoded/pre-coded cards injected)
    async def empty_iter(*args, **kwargs):
        if False:
            yield

    mock_cursor.__aiter__ = empty_iter
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_db.trend_reports.find.return_value = mock_cursor
    mock_db.trend_reports.count_documents = AsyncMock(return_value=0)

    with patch("app.services.trend_scout.get_db", return_value=mock_db):
        cards = await latest_trend_cards(gender="male", country="IL")
        assert cards == []


@pytest.mark.anyio
async def test_cards_deduplication_by_url_and_image():
    mock_db = MagicMock()
    mock_cursor = MagicMock()

    sample_duplicate_cards = [
        {"id": "1", "bucket": "influencers", "gender": "male", "source_url": "https://example.com/same-article", "image_url": "https://images.unsplash.com/photo-1.jpg"},
        {"id": "2", "bucket": "influencers", "gender": "male", "source_url": "https://example.com/same-article", "image_url": "https://images.unsplash.com/photo-1.jpg"},
        {"id": "3", "bucket": "street", "gender": "male", "source_url": "https://example.com/other-article", "image_url": "https://images.unsplash.com/photo-2.jpg"},
    ]

    async def mock_cursor_iter(self):
        for c in sample_duplicate_cards:
            yield c

    mock_cursor.__aiter__ = mock_cursor_iter
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_db.trend_reports.find.return_value = mock_cursor

    from app.services.trend_scout import clear_trend_feed_cache
    clear_trend_feed_cache()

    with patch("app.services.trend_scout.get_db", return_value=mock_db):
        res = await fashion_scout_feed(limit=10, gender="male", country="IL")
        urls = [c["source_url"] for c in res]
        assert len(urls) == len(set(urls))
        assert urls.count("https://example.com/same-article") == 1


def test_card_images_no_hardcoded_or_hallucinated():
    from app.services.trend_scout import _ensure_card_image

    # Card with valid scraped image is preserved
    valid_card = {"bucket": "street", "gender": "male", "image_url": "https://example-article.com/real_photo.jpg"}
    res = _ensure_card_image(valid_card)
    assert res["image_url"] == "https://example-article.com/real_photo.jpg"

    # Card with missing image_url remains None (no hardcoded Unsplash image)
    empty_card = {"bucket": "street", "gender": "male", "headline": "Test Card"}
    filled = _ensure_card_image(empty_card)
    assert filled["image_url"] is None

    # Card with broken domain image is cleared to None (no hallucinated / fallback stock image)
    broken_img_card = {"bucket": "local", "gender": "male", "image_url": "https://ynet-pic1.ynet.co.il/pics/Maskit.jpg"}
    healed = _ensure_card_image(broken_img_card)
    assert healed["image_url"] is None

    # Card with hardcoded stock photo is cleared to None
    stock_img_card = {"bucket": "influencers", "gender": "male", "image_url": "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?auto=format&fit=crop&w=800&q=80"}
    stock_healed = _ensure_card_image(stock_img_card)
    assert stock_healed["image_url"] is None


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


def test_prompt_restrictions_and_must_achieve_rules():
    from app.services.trend_scout import SYSTEM_PROMPT

    # Verify all restrictions are explicitly included
    assert "No marketplaces or online stores" in SYSTEM_PROMPT
    assert "No sign-in walled websites" in SYSTEM_PROMPT
    assert "No hard-coded or hallucinated images" in SYSTEM_PROMPT
    assert "No irrelevant articles" in SYSTEM_PROMPT
    assert "No 404 Not Found - always verify article web links" in SYSTEM_PROMPT

    # Verify all must-achieve goals are explicitly included
    assert "Up-to-date articles with category-filtered, relevant new content" in SYSTEM_PROMPT
    assert "Valid article web link. Must validate the link before publishing" in SYSTEM_PROMPT
    assert "Card image: Original image scraped from the article" in SYSTEM_PROMPT
    assert "A carefully formulated summary of the article. Always localize to the user's language and translate carefully. Verify using the language rules, font, and grammar" in SYSTEM_PROMPT
    assert "Honor i18next localization" in SYSTEM_PROMPT


@pytest.mark.anyio
async def test_verify_and_enrich_card_filters_and_enrichment():
    from app.services.trend_scout import verify_and_enrich_card

    # Rejected URLs (stores, 404 dummy, paywalls, root domain)
    assert await verify_and_enrich_card({"source_url": "https://shopisrael.com/blogs/style-gifts/fashion-forward"}, "local", "female") is None
    assert await verify_and_enrich_card({"source_url": "https://www.ynetnews.com/culture/article/S12345678"}, "local", "female") is None
    assert await verify_and_enrich_card({"source_url": "https://www.facebook.com/login/?next=https://fashion.com"}, "local", "female") is None
    assert await verify_and_enrich_card({"source_url": "https://amazon.com/dp/B012345678"}, "local", "female") is None
    assert await verify_and_enrich_card({"source_url": "https://zara.com/us/en/cart"}, "local", "female") is None
    assert await verify_and_enrich_card({"source_url": "https://fashionista.com"}, "runway", "female") is None


@pytest.mark.anyio
async def test_closet_analysis_and_custom_style_override():
    from app.services.trend_scout import (
        analyze_user_closet_profile,
        save_user_trend_scout_settings,
        get_user_trend_scout_settings,
    )

    mock_db = MagicMock()
    mock_closet_cursor = MagicMock()
    mock_closet_cursor.to_list = AsyncMock(return_value=[
        {"dress_code": "formal", "style": "vintage", "tags": ["retro"]},
        {"dress_code": "formal", "style": "classic"},
        {"dress_code": "casual", "style": "streetwear"},
    ])
    async def mock_aiter(self):
        for item in [
            {"dress_code": "formal", "style": "vintage", "tags": ["retro"]},
            {"dress_code": "formal", "style": "classic"},
            {"dress_code": "casual", "style": "streetwear"},
        ]:
            yield item

    mock_closet_cursor.__aiter__ = mock_aiter
    mock_db.closet_items.find.return_value = mock_closet_cursor
    mock_db.clothes.find.return_value = mock_closet_cursor


    stored_settings = {}
    async def mock_find_one(query, *args, **kwargs):
        return stored_settings.get(query.get("user_id"))

    async def mock_update_one(query, update, *args, **kwargs):
        stored_settings[query["user_id"]] = update["$set"]

    async def mock_replace_one(query, doc, *args, **kwargs):
        stored_settings[query["user_id"]] = doc

    mock_db.trend_scout_settings.find_one = AsyncMock(side_effect=mock_find_one)
    mock_db.trend_scout_settings.update_one = AsyncMock(side_effect=mock_update_one)
    mock_db.trend_scout_settings.replace_one = AsyncMock(side_effect=mock_replace_one)
    mock_db.users.find_one = AsyncMock(return_value={"id": "user_123", "gender": "female"})
    mock_db.users.update_one = AsyncMock()




    with patch("app.services.trend_scout.get_db", return_value=mock_db):

        # 1. Baseline without custom style: Lead dress code is formal, lead style is vintage
        profile = await analyze_user_closet_profile("user_123")
        assert profile["lead_dress_code"].lower() == "formal"
        assert profile["lead_closet_style"].lower() == "vintage"
        assert profile["effective_style"].lower() == "vintage"

        # 2. Set custom style: overrides closet lead style
        await save_user_trend_scout_settings("user_123", {"custom_style": "Quiet Luxury"})
        profile_override = await analyze_user_closet_profile("user_123")
        assert profile_override["lead_dress_code"].lower() == "formal"
        assert profile_override["lead_closet_style"].lower() == "vintage"
        assert profile_override["custom_style"] == "Quiet Luxury"
        assert profile_override["effective_style"] == "Quiet Luxury"

        # 3. Verify settings retrieval
        settings = await get_user_trend_scout_settings("user_123")
        assert settings["custom_style"] == "Quiet Luxury"
        assert len(settings["social_platforms"]) >= 6
        platform_ids = {p["id"] for p in settings["social_platforms"]}
        assert "facebook" in platform_ids


def test_weekly_sunday_schedule():
    from app.services.scheduler import _safe_weekly_run, _safe_monthly_run
    assert callable(_safe_weekly_run)
    assert callable(_safe_monthly_run)




