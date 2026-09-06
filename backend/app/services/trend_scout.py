"""Trend-Scout / Fashion-Scout Agent & Intelligence Engine.

Runs on a monthly schedule (midnight UTC on the 1st of every month) as well as
daily lazy-refresh and on-demand live triggers. Powered by Gemini 3.5 Flash for
editorial web crawling, style synthesis, and multi-language translation.

Demographic Ecosystems:
- Men's Fashion Ecosystem (7 buckets) tailored to male wardrobe aesthetics.
- Women's Fashion Ecosystem (7 buckets) tailored to female wardrobe aesthetics.

Curated Fashion Buckets:
  1. local: Local News & City Radar (anchored to device country e.g. Israel / IL).
  2. runway: Runway & Haute Couture (fashion weeks & international designer debuts).
  3. street: Street Style (global fashion capitals & subcultural street trends).
  4. sustainability: Sustainability (circular economy, textile science & slow fashion).
  5. influencers: Mainstream Influencers & Tastemakers (derives local and global trends,
     incorporating user-authorized social platforms: Instagram, Facebook, TikTok, Pinterest, X, Threads).
  6. vintage: Vintage & Archival Fashion (curatorial retrospectives; strictly editorial, no shopping).
  7. maintenance_repairs: Care & Repairs (garment care, tailoring, mending & footwear upkeep).

Strict Editorial Guardrails & Quality Filters:
- Restricts shopping/e-commerce checkout platforms (Amazon, ASOS, Shein, Temu, cart/checkout links).
- Restricts registration-walled / paywalled sites (no mandatory sign-up needed).
- Authentic deep links only: verified editorial sources, never search redirect wrappers or broken URLs.
- Deduplication: strict uniqueness on source_url and image_url across feed queries.
- Multi-language localization: async translation & caching across all 13 supported languages.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import urllib.parse
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.db.database import get_db
from app.services.gemini_client import GeminiClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Men's and Women's Fashion Ecosystem Buckets Definition
# ---------------------------------------------------------------------------
MENS_BUCKETS: list[dict[str, Any]] = [
    {
        "slug": "local",
        "label": "Local News",
        "gender": "male",
        "focus": "Open-access local fashion editorials, domestic styling news, and local designer coverage.",
        "prompt": (
            "Summarise ONE concrete menswear fashion news story or designer spotlight "
            "deeply anchored to the local cultural identity of {country}. Focus on local fabrics, domestic tailoring, or boutique styling."
        ),
        "starter_websites": [
            {"name": "Walla Fashion", "url": "https://fashion.walla.co.il"},
            {"name": "Time Out Tel Aviv (Style)", "url": "https://timeout.co.il/category/style/fashion"},
            {"name": "Portfolio Magazine (Fashion)", "url": "https://www.prtfl.co.il/category/fashion"},
        ],
        "starter_influencers": [
            {"name": "Asaf Liberfrund", "url": "https://www.instagram.com/thestreetvibe"},
            {"name": "Barak Shamir", "url": "https://www.instagram.com/itsbarakshamir"},
            {"name": "Omer Dror", "url": "https://www.instagram.com/omerdror"},
        ],
    },
    {
        "slug": "runway",
        "label": "Runway",
        "gender": "male",
        "focus": "Free-to-access global menswear collections, lookbooks, and fashion week photography.",
        "prompt": (
            "Summarise ONE concrete global runway menswear trend worth a closet update. "
            "Focus on silhouette, fabric drape, shoulder structure, or signature palette."
        ),
        "starter_websites": [
            {"name": "The Fashionisto", "url": "https://www.thefashionisto.com"},
            {"name": "Fucking Young!", "url": "https://fuckingyoung.es"},
            {"name": "Male Model Scene (DSCENE)", "url": "https://www.malemodelscene.net"},
        ],
        "starter_influencers": [
            {"name": "Alton Mason", "url": "https://www.instagram.com/altonmason"},
            {"name": "Luka Sabbat", "url": "https://www.instagram.com/lukasabbat"},
            {"name": "Jordan Daniels", "url": "https://www.tiktok.com/@jordandaniels_"},
        ],
    },
    {
        "slug": "street",
        "label": "Street Style",
        "gender": "male",
        "focus": "Global urban culture, sneakers, and modern hype fashion.",
        "prompt": (
            "Name ONE street-style menswear shift that is actively being worn. "
            "Call out the key item (sneakers, utility pants, outerwear) and the styling move."
        ),
        "starter_websites": [
            {"name": "Hypebeast", "url": "https://hypebeast.com"},
            {"name": "Highsnobiety", "url": "https://www.highsnobiety.com"},
            {"name": "Pause Magazine", "url": "https://pausemag.co.uk"},
        ],
        "starter_influencers": [
            {"name": "Sangiev", "url": "https://www.youtube.com/c/sangiev"},
            {"name": "Magnus Ronning", "url": "https://www.youtube.com/c/magnusronning"},
            {"name": "Leo Mandella", "url": "https://www.instagram.com/gullyguyleo"},
        ],
    },
    {
        "slug": "sustainability",
        "label": "Sustainability",
        "gender": "male",
        "focus": "Non-profit directories, ethical brand editorials, and eco-fashion guides.",
        "prompt": (
            "Pick ONE emerging sustainable menswear story (closed-loop organic materials, "
            "ethical brand directories, regenerative agriculture) and state the practical wardrobe implication."
        ),
        "starter_websites": [
            {"name": "Good On You (Journal)", "url": "https://goodonyou.eco/category/fashion/"},
            {"name": "Eco-Stylist", "url": "https://www.eco-stylist.com/mens-sustainable-fashion/"},
            {"name": "Fashion Revolution", "url": "https://www.fashionrevolution.org"},
        ],
        "starter_influencers": [
            {"name": "Brett Staniland", "url": "https://www.instagram.com/twinbrett"},
            {"name": "Albert Múzquiz", "url": "https://www.tiktok.com/@albertmuzquiz"},
            {"name": "Sam Manno", "url": "https://www.tiktok.com/@sammanno"},
        ],
    },
    {
        "slug": "influencers",
        "label": "Mainstream Tastemakers",
        "gender": "male",
        "focus": "Everyday styling, smart-casual guides, and accessible menswear advice.",
        "prompt": (
            "Highlight ONE mainstream menswear tastemaker or smart-casual guide shaping accessible daily style. "
            "Name the stylist/creator, the signature rotation move, and how to replicate it."
        ),
        "starter_websites": [
            {"name": "FashionBeans", "url": "https://www.fashionbeans.com"},
            {"name": "Ape to Gentleman", "url": "https://www.apetogentleman.com"},
            {"name": "Valet Magazine", "url": "https://www.valetmag.com"},
        ],
        "starter_influencers": [
            {"name": "Mariano Di Vaio", "url": "https://www.instagram.com/marianodivaio"},
            {"name": "Johannes Huebl", "url": "https://www.instagram.com/johanneshuebl"},
            {"name": "Tim Dessaint", "url": "https://www.youtube.com/c/timdessaint"},
        ],
    },
    {
        "slug": "vintage",
        "label": "Vintage & Archival",
        "gender": "male",
        "focus": "Subcultural deep dives, heritage textiles, and vintage identification resources (No shopping).",
        "prompt": (
            "Spotlight ONE vintage or archival menswear deep dive (heritage selvedge denim, "
            "military workwear history, archival labels, textile identification). Strictly educational, no commerce."
        ),
        "starter_websites": [
            {"name": "Sabukaru Online", "url": "https://sabukaru.online/category/fashion"},
            {"name": "Heddels", "url": "https://www.heddels.com"},
            {"name": "Vintage Fashion Guild", "url": "https://vintagefashionguild.org"},
        ],
        "starter_influencers": [
            {"name": "Christian (Frugal Aesthetic)", "url": "https://www.youtube.com/c/frugalaesthetic"},
            {"name": "Bliss Foster", "url": "https://www.youtube.com/c/blissfoster"},
            {"name": "Drew Joiner", "url": "https://www.youtube.com/c/drewjoiner"},
        ],
    },
    {
        "slug": "maintenance_repairs",
        "label": "Maintenance & Repairs",
        "gender": "male",
        "focus": "Menswear care guides, raw denim repair, darning, and cobbling tutorials.",
        "prompt": (
            "Spotlight ONE practical menswear maintenance or repair technique "
            "(raw denim darning, Goodyear welt shoe cobbling, sweater depilling, leather care) to extend garment lifespan."
        ),
        "starter_websites": [
            {"name": "Put This On (Garment Care)", "url": "https://putthison.com"},
            {"name": "Denimhunters", "url": "https://denimhunters.com"},
            {"name": "Heddels (Repair Section)", "url": "https://www.heddels.com/category/education/maintenance-and-repair/"},
        ],
        "starter_influencers": [
            {"name": "Trenton & Heath", "url": "https://www.youtube.com/c/trentonheath"},
            {"name": "Indigo Proof", "url": "https://www.instagram.com/indigoproof"},
            {"name": "Swiss Jeans Freak", "url": "https://www.instagram.com/swissjeansfreak"},
        ],
    },
]

WOMENS_BUCKETS: list[dict[str, Any]] = [
    {
        "slug": "local",
        "label": "Local News",
        "gender": "female",
        "focus": "Open-access Israeli designer showcases, local trend reporting, and boutique culture.",
        "prompt": (
            "Summarise ONE concrete womenswear fashion news story or designer showcase "
            "deeply anchored to the local cultural identity of {country}. Focus on domestic designers, boutique culture, and regional styling."
        ),
        "starter_websites": [
            {"name": "Fashion Forward (Mako)", "url": "https://fashionforward.mako.co.il"},
            {"name": "AT Magazine", "url": "https://www.atmag.co.il"},
            {"name": "Fashion Israel", "url": "https://www.fashion-israel.co.il"},
        ],
        "starter_influencers": [
            {"name": "Meital Weinberg Adar", "url": "https://www.instagram.com/mmmwa"},
            {"name": "Korin Avraham", "url": "https://www.instagram.com/yasalamfashionblog"},
            {"name": "Dana Zarmon", "url": "https://www.instagram.com/danazarmon"},
        ],
    },
    {
        "slug": "runway",
        "label": "Runway",
        "gender": "female",
        "focus": "Accessible reporting on couture, fashion weeks, and international designer debuts.",
        "prompt": (
            "Summarise ONE concrete international womenswear runway trend worth adopting into a personal closet. "
            "Focus on texture, tailoring, colorway, or dramatic drape."
        ),
        "starter_websites": [
            {"name": "L'Officiel USA", "url": "https://www.lofficielusa.com/fashion"},
            {"name": "Fashionista", "url": "https://fashionista.com"},
            {"name": "Crash Magazine", "url": "https://www.crash.fr/fashion/"},
        ],
        "starter_influencers": [
            {"name": "Chiara Ferragni", "url": "https://www.instagram.com/chiaraferragni"},
            {"name": "Leonie Hanne", "url": "https://www.instagram.com/leoniehanne"},
            {"name": "Bryanboy", "url": "https://www.tiktok.com/@bryanboy"},
        ],
    },
    {
        "slug": "street",
        "label": "Street Style",
        "gender": "female",
        "focus": "High-resolution photography of global fashion week attendees and subcultural trends.",
        "prompt": (
            "Name ONE global street style womenswear trend spotted at recent fashion weeks. "
            "Highlight the signature silhouette, layer combination, and footwear."
        ),
        "starter_websites": [
            {"name": "Style Du Monde", "url": "https://www.styledumonde.com"},
            {"name": "Who What Wear", "url": "https://www.whowhatwear.com"},
            {"name": "Refinery29 Fashion", "url": "https://www.refinery29.com/en-us/fashion"},
        ],
        "starter_influencers": [
            {"name": "Caroline Daur", "url": "https://www.instagram.com/carodaur"},
            {"name": "Aimee Song", "url": "https://www.youtube.com/c/aimeesong"},
            {"name": "Tamara Kalinic", "url": "https://www.youtube.com/c/tamarakalinic"},
        ],
    },
    {
        "slug": "sustainability",
        "label": "Sustainability",
        "gender": "female",
        "focus": "Slow-fashion publications, textile science, and fair-wage advocacy platforms.",
        "prompt": (
            "Spotlight ONE slow-fashion editorial, fair-wage milestone, or innovative circular textile "
            "changing womenswear. State the direct takeaway for conscious shoppers."
        ),
        "starter_websites": [
            {"name": "Remake", "url": "https://remake.world"},
            {"name": "EcoCult", "url": "https://ecocult.com"},
            {"name": "The Good Trade", "url": "https://www.thegoodtrade.com/category/style/"},
        ],
        "starter_influencers": [
            {"name": "Aditi Mayer", "url": "https://www.instagram.com/aditimayer"},
            {"name": "Aja Barber", "url": "https://www.instagram.com/ajabarber"},
            {"name": "Alyssa Beltempo", "url": "https://www.youtube.com/c/alyssabeltempo"},
        ],
    },
    {
        "slug": "influencers",
        "label": "Mainstream Tastemakers",
        "gender": "female",
        "focus": "Pop-culture trends, seasonal viral aesthetics, and everyday celebrity fashion.",
        "prompt": (
            "Highlight ONE viral style movement or aesthetic capsule (e.g. Scandi chic, modern tailoring, quiet luxury). "
            "Name the tastemaker shaping it and how everyday wardrobes can channel the look."
        ),
        "starter_websites": [
            {"name": "Elle Fashion", "url": "https://www.elle.com/fashion/"},
            {"name": "Cosmopolitan Style", "url": "https://www.cosmopolitan.com/style-beauty/fashion/"},
            {"name": "Glamour Fashion", "url": "https://www.glamour.com/fashion"},
        ],
        "starter_influencers": [
            {"name": "Alix Earle", "url": "https://www.tiktok.com/@alixearle"},
            {"name": "Emma Chamberlain", "url": "https://www.youtube.com/c/emmachamberlain"},
            {"name": "Matilda Djerf", "url": "https://www.instagram.com/matildadjerf"},
        ],
    },
    {
        "slug": "vintage",
        "label": "Vintage & Archival",
        "gender": "female",
        "focus": "Historical fashion journals, archival designer panels, and history-of-fashion media (No shopping).",
        "prompt": (
            "Spotlight ONE historical fashion retrospective or archival designer breakdown "
            "(90s runway history, couture construction, vintage textile curation). Strictly educational, no shopping."
        ),
        "starter_websites": [
            {"name": "SHOWstudio", "url": "https://www.showstudio.com"},
            {"name": "The Vintage Woman Magazine", "url": "https://thevintagewomanmagazine.com"},
            {"name": "Document Journal", "url": "https://www.documentjournal.com"},
        ],
        "starter_influencers": [
            {"name": "Mina Le", "url": "https://www.youtube.com/c/minale99"},
            {"name": "Hannah Louise Poston", "url": "https://www.youtube.com/c/hannahlouiseposton"},
            {"name": "Macy Eleni", "url": "https://www.tiktok.com/@macyeleni"},
        ],
    },
    {
        "slug": "maintenance_repairs",
        "label": "Maintenance & Repairs",
        "gender": "female",
        "focus": "Visible mending, upcycling, zero-waste alterations, and creative garment repair tutorials.",
        "prompt": (
            "Share ONE creative garment repair, visible mending (sashiko/boro embroidery), "
            "or zero-waste hemline alteration tutorial that extends wardrobe lifespan at home."
        ),
        "starter_websites": [
            {"name": "Repair What You Wear", "url": "https://repairwhatyouwear.com"},
            {"name": "Fixing Fashion", "url": "https://fixing.fashion"},
            {"name": "Gathered (Sewing Hub)", "url": "https://www.gathered.how/sewing-and-quilting/sewing"},
        ],
        "starter_influencers": [
            {"name": "Lily Fulop", "url": "https://www.instagram.com/mindful_mending"},
            {"name": "Shelby Orme", "url": "https://www.youtube.com/c/shelbizleee"},
            {"name": "Leigh Thayer", "url": "https://www.youtube.com/@leighthayer"},
        ],
    },
]

ALL_BUCKETS: list[dict[str, Any]] = MENS_BUCKETS + WOMENS_BUCKETS

# Backward-compatibility alias
BUCKETS: list[dict[str, Any]] = WOMENS_BUCKETS

BUCKET_SLUG_ALIASES: dict[str, str] = {
    "ss26-runway": "runway",
    "second_hand": "vintage",
    "recycling": "maintenance_repairs",
    "news_flash": "local",
}


COUNTRY_NAME_MAP: dict[str, str] = {
    "IL": "Israel",
    "JP": "Japan",
    "US": "United States",
    "GB": "United Kingdom",
    "FR": "France",
    "DE": "Germany",
    "IT": "Italy",
    "ES": "Spain",
    "CA": "Canada",
    "AU": "Australia",
    "KR": "South Korea",
    "CN": "China",
    "BR": "Brazil",
    "RU": "Russia",
    "IN": "India",
    "MX": "Mexico",
    "ZA": "South Africa",
    "NL": "Netherlands",
    "SE": "Sweden",
    "CH": "Switzerland",
}

# ---------------------------------------------------------------------------
# Supported Social Media Platforms
# ---------------------------------------------------------------------------
DEFAULT_SOCIAL_PLATFORMS: list[dict[str, Any]] = [
    {"id": "instagram", "name": "Instagram", "icon": "Instagram", "connected": False, "username": None, "active": False},
    {"id": "facebook", "name": "Facebook", "icon": "Facebook", "connected": False, "username": None, "active": False},
    {"id": "pinterest", "name": "Pinterest", "icon": "Pin", "connected": False, "username": None, "active": False},
    {"id": "tiktok", "name": "TikTok", "icon": "Video", "connected": False, "username": None, "active": False},
    {"id": "x", "name": "X (Twitter)", "icon": "Twitter", "connected": False, "username": None, "active": False},
    {"id": "threads", "name": "Threads", "icon": "AtSign", "connected": False, "username": None, "active": False},
]


# ---------------------------------------------------------------------------
# Search Queries & Filtering
# ---------------------------------------------------------------------------
DISALLOWED_SHOPPING_DOMAINS = (
    "amazon.", "ebay.", "shein.", "aliexpress.", "asos.com", "temu.com",
    "zara.com", "hm.com", "etsy.com", "target.com", "walmart.com",
    "shopify", "myshopify", "shopisrael.com", "poshmark", "depop", "mercari",
    "farfetch.com", "net-a-porter.com", "ssense.com", "mytheresa.com",
    "nordstrom.com", "macys.com", "bloomingdales.com", "revolve.com",
    "boohoo.com", "prettylittlething.com", "urbanoutfitters.com",
    "mango.com", "pullandbear.com", "bershka.com", "stradivarius.com",
    "massimodutti.com", "cos.com", "gap.com", "shop.", "store.", "cart",
    "checkout", "buy-now",
)

DISALLOWED_PAYWALL_DOMAINS = (
    "voguebusiness.com", "wsj.com", "ft.com", "bloomberg.com",
    "nytimes.com", "businessoffashion.com", "wwd.com",
    "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com",
    "linkedin.com", "pinterest.com",
)

DISALLOWED_URL_PATHS = (
    "/cart", "/checkout", "/collections/", "/products/", "/product/",
    "/buy", "/p/", "/dp/", "/gp/product/", "/shop/", "/store/", "/sale/",
    "/login", "/signin", "/sign-in", "/register", "/auth",
    "/table_of_content", "/table-of-content", "/table_of_contents", "/toc/",
)


def _ensure_card_image(card: dict[str, Any]) -> dict[str, Any]:
    """Ensure card image_url is valid http or None (no hardcoded/hallucinated images)."""
    if not card:
        return card
    img = str(card.get("image_url") or "").strip()
    if (
        not img.startswith("http")
        or any(d in img for d in ("ynet-pic1.ynet.co.il", "example.com", "photo-1617127365659-c47fa864d8bc", "images.unsplash.com", "images.pexels.com"))
    ):
        card["image_url"] = None
    return card


def get_search_queries(
    bucket_slug: str,
    country_code: str | None,
    city: str | None = None,
    gender: str = "female",
    *,
    dress_code: str | None = None,
    style: str | None = None,
    social_platforms: list[str] | None = None,
) -> list[str]:
    """Build high-relevance search queries targeting open-access editorial fashion outlets.

    Incorporates user closet dress code, style preferences, and active social platforms.
    """
    canonical_slug = BUCKET_SLUG_ALIASES.get(bucket_slug, bucket_slug)
    country_name = COUNTRY_NAME_MAP.get((country_code or "").upper(), country_code or "Israel")
    place = f"{city} {country_name}" if (city and country_name) else country_name
    gender_word = "menswear men" if gender == "male" else "womenswear women"
    style_filter = " ".join(filter(None, [dress_code, style])).strip()

    if canonical_slug == "local":
        if (country_code or "").upper() == "IL":
            if gender == "male":
                queries = [
                    f"אופנת גברים {style_filter} מעצבים ישראלים תל אביב חדשות 2026".strip(),
                    f"Israeli menswear {style_filter} fashion designers Tel Aviv editorial 2026".strip(),
                ]
            else:
                queries = [
                    f"אופנה {style_filter} מעצבים ישראלים מגזין כתבות סטייל 2026".strip(),
                    f"Israeli womens {style_filter} fashion designers boutique Tel Aviv trends 2026".strip(),
                ]
        else:
            queries = [
                f"{place} {gender_word} {style_filter} fashion news local designers trends 2026".strip(),
                f"top {gender_word} {style_filter} fashion magazines boutique style {place} 2026".strip(),
            ]

    elif canonical_slug == "runway":
        if gender == "male":
            queries = [
                f"menswear {style_filter} runway trends fashion week collections lookbook 2026".strip(),
                f"mens designer {style_filter} fashion week haute couture reviews 2026".strip(),
            ]
        else:
            queries = [
                f"womens {style_filter} runway fashion trends fashion week collections 2026".strip(),
                f"haute couture {style_filter} runway fashion week reviews highlights 2026".strip(),
            ]

    elif canonical_slug == "street":
        if gender == "male":
            queries = [
                f"street style menswear {style_filter} fashion week urban outfits 2026".strip(),
                f"men street style {style_filter} trends fashion week photography 2026".strip(),
            ]
        else:
            queries = [
                f"women street style {style_filter} fashion week outfits editorial trends 2026".strip(),
                f"street style womenswear {style_filter} trends global fashion week 2026".strip(),
            ]

    elif canonical_slug == "sustainability":
        if gender == "male":
            queries = [
                f"mens sustainable ethical {style_filter} fashion circular textiles 2026".strip(),
                f"menswear eco conscious {style_filter} clothing sustainable design news 2026".strip(),
            ]
        else:
            queries = [
                f"womens sustainable slow {style_filter} fashion circular textiles ethical clothing 2026".strip(),
                f"eco conscious {style_filter} fashion ethical wardrobe styling news 2026".strip(),
            ]

    elif canonical_slug == "influencers":
        social_kws = " ".join(social_platforms) if social_platforms else "social media creators"
        if (country_code or "").upper() == "IL":
            if gender == "male":
                queries = [
                    f"אופנת גברים {style_filter} {social_kws} בלוגרים משפיענים סטייל ישראל 2026".strip(),
                    f"menswear style tastemakers {style_filter} {social_kws} Tel Aviv Israeli creators 2026".strip(),
                ]
            else:
                queries = [
                    f"אופנה {style_filter} {social_kws} מובילות דעה בלוגריות סטייל ישראל 2026".strip(),
                    f"women fashion tastemakers {style_filter} {social_kws} Tel Aviv Israeli style creators 2026".strip(),
                ]
        else:
            if gender == "male":
                queries = [
                    f"mens style tastemakers {style_filter} {social_kws} {place} capsule wardrobe trends 2026".strip(),
                    f"menswear style creators {style_filter} {social_kws} {place} outfit inspiration daily fashion 2026".strip(),
                ]
            else:
                queries = [
                    f"womens fashion tastemakers {style_filter} {social_kws} {place} aesthetic styling tips 2026".strip(),
                    f"women style creators {style_filter} {social_kws} {place} trending outfits fashion inspiration 2026".strip(),
                ]

    elif canonical_slug == "vintage":
        if gender == "male":
            queries = [
                f"vintage menswear {style_filter} archival workwear denim heritage fashion history 2026".strip(),
                f"archival mens fashion {style_filter} vintage garments retrospective history".strip(),
            ]
        else:
            queries = [
                f"vintage womenswear {style_filter} archival fashion history designer garments retrospective".strip(),
                f"vintage fashion history {style_filter} styling iconic archival clothing 2026".strip(),
            ]

    elif canonical_slug == "maintenance_repairs":
        if gender == "male":
            queries = [
                "menswear garment care repair darning cobbling clothing longevity guide",
                "mens clothing care visible mending repair denim maintenance",
            ]
        else:
            queries = [
                "visible mending garment repair clothes upcycling care guide",
                "clothing longevity visible mending textile care guide 2026",
            ]

    else:
        queries = [f"{gender_word} {style_filter} fashion trends 2026 {place}".strip()]

    urls = []
    for q in queries:
        clean_q = re.sub(r"\s+", " ", q).strip()
        encoded = urllib.parse.quote_plus(clean_q)
        urls.append(f"https://search.yahoo.com/search?q={encoded}")
    return urls


SYSTEM_PROMPT = (
    "You are DressApp's Fashion-Scout — an elite, independent fashion intelligence agent searching the live web.\n"
    "You find real-time, actionable insights for stylish readers.\n\n"
    "RESTRICTIONS:\n"
    "* No marketplaces or online stores: Never link to Amazon, eBay, ASOS, Shein, Temu, AliExpress, Etsy, Shopify stores (e.g. shopisrael.com), Zara/H&M store carts, or any commercial checkout or product sales pages.\n"
    "* No sign-in walled websites: Never link to paywalled or login-walled sources (e.g. Vogue Business paywall, WSJ, FT, Bloomberg, or sites requiring mandatory registration or sign-in). Content must be 100% free and open-access to readers.\n"
    "* No hard-coded or hallucinated images: Never invent, guess, or hallucinate an image URL, path, or image domain. Only return authentic original images discovered in the article, or null.\n"
    "* No irrelevant articles: Content must be strictly about fashion trends, designer collections, runway reports, street style, local designers, sustainable textiles, or garment care and repair. Never include politics, general gossip, or unrelated news.\n"
    "* No 404 Not Found - always verify article web links: Source URLs must be active, valid, direct deep links navigating directly to the specific article. Never provide dead links, homepages, search engine redirect wrappers, or root domains.\n\n"
    "MUST ACHIEVE:\n"
    "* Up-to-date articles with category-filtered, relevant new content: Research recent fashion journalism, lookbooks, reviews, or designer announcements from 2026 tailored to the specific category bucket.\n"
    "* Valid article web link. Must validate the link before publishing: source_url must be an authentic, direct deep link to the specific article.\n"
    "* Card image: Original image scraped from the article (og:image, twitter:image, or main featured editorial photo), or null.\n"
    "* A carefully formulated summary of the article. Always localize to the user's language and translate carefully. Verify using the language rules, font, and grammar: A punchy headline (<= 8 words) and an engaging, factual 1-2 sentence body (<= 220 characters) providing one concrete, actionable wardrobe takeaway for stylish readers.\n"
    "* Honor i18next localization: Formulate summaries cleanly in the requested language, respecting grammatical rules, natural flow, typography, and font conventions.\n\n"
    "Output contract: return ONLY a JSON object.\n"
    'If you need to search a website, return: {"action": "browse_web", "url": "<https URL>"}.\n'
    'Once you have enough context, return: {"action": "finish", "card": {\n'
    ' "headline": string (<= 8 words),\n'
    ' "body": string (1-2 sentences, <= 220 chars),\n'
    ' "tag": string (short all-caps category tag),\n'
    ' "source_name": string (e.g., "Time Out Tel Aviv", "Hypebeast", "Fashionista"),\n'
    ' "source_url": string (must be the specific article/report deep link found in browsed page),\n'
    ' "image_url": string (or null),\n'
    ' "video_url": string (or null)\n'
    "}}. No markdown, no prose outside JSON."
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def browse_web(url: str) -> str:
    """Agent tool to fetch and extract text, article featured images, and inline links from a webpage."""
    from urllib.parse import urljoin, urlparse, unquote
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'html.parser')

            # Extract OpenGraph / Twitter / Hero article image
            article_image: str | None = None
            og_img = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
            tw_img = soup.find("meta", property="twitter:image") or soup.find("meta", attrs={"name": "twitter:image"})
            if og_img and og_img.get("content"):
                article_image = urljoin(url, og_img["content"].strip())
            elif tw_img and tw_img.get("content"):
                article_image = urljoin(url, tw_img["content"].strip())
            else:
                first_img = soup.find("img", src=True)
                if first_img and first_img.get("src") and not first_img["src"].startswith("data:"):
                    article_image = urljoin(url, first_img["src"].strip())

            is_yahoo = "search.yahoo.com" in url

            for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
                tag.extract()

            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not href or href.startswith("#") or href.startswith("javascript:"):
                    continue

                if is_yahoo and "r.search.yahoo.com" in href and "/RU=" in href:
                    parsed = urlparse(href)
                    path_parts = parsed.path.split("/")
                    decoded_url = None
                    for part in path_parts:
                        if part.startswith("RU="):
                            decoded_url = unquote(part[3:])
                            break
                    if decoded_url:
                        absolute_url = decoded_url
                    else:
                        absolute_url = urljoin(url, href)
                else:
                    absolute_url = urljoin(url, href)

                link_text = a.get_text(strip=True)
                if link_text:
                    a.replace_with(f" [{link_text}]({absolute_url}) ")

            text = soup.get_text(separator=' ', strip=True)
            text = " ".join(text.split())

            if is_yahoo and len(text) < 500:
                return "Failed to fetch search page: anti-bot challenge or empty results."

            if article_image and not is_yahoo:
                return f"{text[:3500]}\n\n[Article Featured Image]: {article_image}"

            return text[:4000]
    except Exception as exc:
        return f"Failed to fetch {url}: {exc}"


def _extract_json(raw: str) -> dict[str, Any]:
    if not raw:
        return {}
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, flags=re.S)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except Exception:  # noqa: BLE001
            pass
    first = raw.find("{")
    last = raw.rfind("}")
    if first != -1 and last != -1 and last > first:
        try:
            return json.loads(raw[first : last + 1])
        except Exception:  # noqa: BLE001
            pass
    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        return {}


def _clean_url(value: Any) -> str | None:
    """Keep only https URLs, unwrap search redirects, and strictly reject shopping, paywalled, or login domains."""
    if not value or not isinstance(value, str):
        return None
    v = value.strip()
    if not v.lower().startswith(("http://", "https://")):
        return None

    # Normalize to https
    if v.lower().startswith("http://"):
        v = "https://" + v[len("http://") :]

    lowered = v.lower()
    if any(bad in lowered for bad in ("example.com", "localhost", "placeholder", "dummy", "s12345678", "12345678")):
        return None

    # Unwrap search redirects (e.g. google.com/url?q=... or url=...)
    if "google.com/url" in lowered:
        parsed = urllib.parse.urlparse(v)
        qs = urllib.parse.parse_qs(parsed.query)
        target = qs.get("url", qs.get("q", []))
        if target:
            v = target[0]
            lowered = v.lower()

    if "r.search.yahoo.com" in lowered and "/ru=" in lowered:
        parsed = urllib.parse.urlparse(v)
        for part in parsed.path.split("/"):
            if part.lower().startswith("ru="):
                v = urllib.parse.unquote(part[3:])
                lowered = v.lower()
                break

    parsed = urllib.parse.urlparse(v)
    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").lower()

    # Reject if hostname has no dot
    if not host or "." not in host:
        return None

    # Reject disallowed shopping domains
    if any(shop in host for shop in DISALLOWED_SHOPPING_DOMAINS):
        return None

    # Reject shop/store subdomains or store prefixes (e.g. shopisrael.com, store.xyz.com, shoptelaviv.com)
    if host.startswith("shop") or host.startswith("store.") or host.startswith("stores.") or host.startswith("buy.") or host.startswith("market."):
        return None

    # Reject paywall and login/social domains
    if any(pw in host for pw in DISALLOWED_PAYWALL_DOMAINS):
        return None

    # Reject e-commerce cart/checkout/product paths or login/auth paths
    if any(p in path for p in DISALLOWED_URL_PATHS):
        return None

    # Reject root/empty paths — must be deep article link
    clean_path = path.strip("/")
    if not clean_path:
        return None

    return v[:300]


# ---------------------------------------------------------------------------
# Demographic Ranking & Filter Helpers
# ---------------------------------------------------------------------------
_BUCKET_AFFINITY: dict[str, dict[str, float]] = {
    "runway": {
        "designer": 2.0, "stylist": 1.5, "fashion": 1.5, "model": 1.5,
        "editor": 1.0, "creative": 1.0, "luxury": 1.0,
    },
    "street": {
        "student": 1.5, "artist": 1.0, "musician": 1.0, "casual": 1.0,
        "skater": 2.0, "athlete": 1.0,
    },
    "sustainability": {
        "engineer": 1.0, "scientist": 1.5, "teacher": 1.0,
        "sustainability": 2.0, "climate": 2.0, "activist": 2.0,
    },
    "influencers": {
        "marketing": 1.5, "social": 1.5, "content": 1.5, "creator": 2.0,
        "influencer": 2.0, "brand": 1.0,
    },
    "vintage": {
        "thrift": 2.0, "vintage": 2.0, "student": 1.5, "budget": 1.0, "archival": 2.0,
    },
    "maintenance_repairs": {
        "designer": 1.0, "engineer": 1.0, "tailor": 1.5, "diy": 1.5, "repair": 2.0, "mending": 2.0,
    },
    "local": {
        "israel": 2.0, "tel aviv": 2.0, "local": 2.0, "boutique": 1.5,
    },
}

_TOKEN_RE = re.compile(r"[a-z0-9]{3,}")


def _tokens(text: str | None) -> set[str]:
    if not text:
        return set()
    return set(_TOKEN_RE.findall(text.lower()))


def _user_keyword_set(user: dict[str, Any]) -> set[str]:
    """Build the user's relevance keyword set from their profile."""
    parts: list[str] = []
    for key in ("occupation", "first_name", "last_name", "display_name"):
        v = user.get(key)
        if isinstance(v, str):
            parts.append(v)
    sex = user.get("sex") or user.get("gender")
    if isinstance(sex, str):
        if sex == "female":
            parts.append("women womens woman")
        elif sex == "male":
            parts.append("men mens man")
    prof = user.get("professional") or {}
    if isinstance(prof, dict):
        if prof.get("profession"):
            parts.append(str(prof["profession"]))
        biz = prof.get("business") or {}
        if isinstance(biz, dict) and biz.get("description"):
            parts.append(str(biz["description"])[:200])
    home = user.get("home_location") or {}
    addr = user.get("address") or {}
    for source in (home, addr):
        if isinstance(source, dict):
            for k in ("city", "region", "country", "country_code"):
                v = source.get(k)
                if isinstance(v, str):
                    parts.append(v)
    return _tokens(" ".join(parts))


def normalize_country_code(val: str | None) -> str | None:
    """Robustly normalize any country name or code string to a standard 2-letter uppercase ISO code."""
    if not val:
        return None
    cleaned = str(val).strip().upper().rstrip("+")
    if not cleaned:
        return None
    mapping = {
        "ISRAEL": "IL",
        "ישראל": "IL",
        "UNITED STATES": "US",
        "USA": "US",
        "UNITED KINGDOM": "GB",
        "UK": "GB",
        "FRANCE": "FR",
        "GERMANY": "DE",
        "ITALY": "IT",
        "SPAIN": "ES",
        "CANADA": "CA",
        "AUSTRALIA": "AU",
    }
    if cleaned in mapping:
        return mapping[cleaned]
    if len(cleaned) == 2:
        return cleaned
    if "ISRAEL" in cleaned or "ישראל" in cleaned:
        return "IL"
    return cleaned[:2]


def _country_codes(user: dict[str, Any]) -> set[str]:
    """Best-effort country code set for the viewer (upper-case, 2-letter)."""
    out: set[str] = set()
    for source_key in ("home_location", "address"):
        source = user.get(source_key) or {}
        if isinstance(source, dict):
            for k in ("country_code", "country"):
                v = source.get(k)
                if isinstance(v, str) and v.strip():
                    norm = normalize_country_code(v)
                    if norm:
                        out.add(norm)
    return out


def rank_cards_for_user(
    cards: list[dict[str, Any]],
    user: dict[str, Any],
    closet_profile: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Sort cards for the user based on gender match, locality, keywords, closet style, and recency."""
    if not cards:
        return cards
    user_keywords = _user_keyword_set(user)
    user_countries = _country_codes(user)
    raw_sex = user.get("sex") or user.get("gender")
    target_gender = "male" if raw_sex == "male" else "female"

    latest_date = max(((c.get("date") or "") for c in cards), default="")

    def _score(card: dict[str, Any]) -> float:
        score = 0.0

        # Gender ecosystem match (+15 for direct match, -10 for opposite gender)
        card_gender = card.get("gender")
        if card_gender:
            if card_gender == target_gender:
                score += 15.0
            else:
                score -= 10.0

        # Recency boost
        if latest_date and card.get("date") == latest_date:
            score += 10.0

        # Keyword overlap
        text_tokens = _tokens(
            " ".join(
                str(card.get(k, "") or "")
                for k in ("headline", "body", "tag", "source_name")
            )
        )
        overlap = user_keywords & text_tokens
        score += 2.0 * len(overlap)

        # Bucket affinity
        canonical_bucket = BUCKET_SLUG_ALIASES.get(card.get("bucket", ""), card.get("bucket", ""))
        affinity = _BUCKET_AFFINITY.get(canonical_bucket, {})
        for kw, weight in affinity.items():
            if kw in user_keywords:
                score += weight

        # Closet dress code & style matching (+6.0 each)
        if closet_profile:
            dc = (closet_profile.get("lead_dress_code") or "").lower()
            st = (closet_profile.get("effective_style") or "").lower()
            blob_lower = f"{card.get('body', '')} {card.get('headline', '')} {card.get('tag', '')} {card.get('dress_code', '')} {card.get('style', '')}".lower()
            if dc and dc in blob_lower:
                score += 6.0
            if st and st in blob_lower:
                score += 6.0
            for sp in closet_profile.get("social_platforms") or []:
                if str(sp).lower() in blob_lower:
                    score += 3.0

        # Country match
        if user_countries:
            card_country = card.get("country_code")
            if card_country and card_country.upper() in user_countries:
                score += 8.0
            blob = f"{card.get('body', '')} {card.get('headline', '')}".upper()
            if any(cc and cc in blob for cc in user_countries):
                score += 3.0

        return score

    def _sort_key(card: dict[str, Any]) -> tuple:
        d_str = card.get("date") or "0000-00-00"
        d_val = 0
        try:
            d_val = int(d_str.replace("-", ""))
        except ValueError:
            pass
        return (-_score(card), -d_val)

    return sorted(cards, key=_sort_key)


# ---------------------------------------------------------------------------
# LLM Generation
# ---------------------------------------------------------------------------
async def _generate_one(
    bucket: dict[str, Any],
    client_type: str = "desktop",
    country_code: str | None = None,
    city: str | None = None,
    gender: str = "female",
    *,
    dress_code: str | None = None,
    style: str | None = None,
    social_platforms: list[str] | None = None,
) -> dict[str, Any] | None:
    if not settings.GEMINI_API_KEY:
        return None

    country_name = COUNTRY_NAME_MAP.get((country_code or "").upper(), country_code or "Israel")
    place = f"{city}, {country_name}" if city else country_name
    current_date = datetime.now(timezone.utc)
    date_str = current_date.strftime("%B %Y")
    
    gemini_client = GeminiClient(api_key=settings.GEMINI_API_KEY)
    db = get_db()

    # 1. Deduplication: inspect recent stories in this bucket/gender to explore fresh angles
    recent_headlines: list[str] = []
    try:
        cursor = db.trend_reports.find(
            {"bucket": bucket["slug"], "gender": gender},
            {"headline": 1, "_id": 0}
        ).sort("date", -1).limit(4)
        async for doc in cursor:
            if doc.get("headline"):
                recent_headlines.append(doc["headline"])
    except Exception:
        pass

    avoid_topics = ""
    if recent_headlines:
        avoid_topics = f"Do NOT cover or repeat these recently reported topics: {json.dumps(recent_headlines)}."

    personalization_prompt = ""
    if dress_code or style or social_platforms:
        p_lines = ["\nUSER WARDROBE & STYLE PERSONALIZATION FILTER:"]
        if dress_code:
            p_lines.append(f"- Lead Dress Code: {dress_code.title()}")
        if style:
            p_lines.append(f"- Lead Style / Aesthetic: {style.title()}")
        if social_platforms:
            p_lines.append(f"- Influencing Social Platforms: {', '.join(social_platforms)}")
        p_lines.append(f"Ensure the discovered article and practical wardrobe takeaway specifically embody the {dress_code or ''} dress code and {style or ''} aesthetic.")
        if bucket.get("slug") == "influencers" and social_platforms:
            p_lines.append(f"SPECIAL INFLUENCER DIRECTIVE: Prioritize local fashion creators, tastemakers, or editorial features spotlighting viral fashion styling and trends on user's authorized platforms ({', '.join(social_platforms)}).")
        personalization_prompt = "\n".join(p_lines) + "\n\n"

    # 2. DYNAMIC LIVE WEB SEARCH via Google Search Grounding
    grounded_prompt = (
        f"You are DressApp's Fashion-Scout Agent performing live web research in {date_str}.\n"
        f"Actively search the LIVE WEB across fashion publications, designer news, blogs, and style journals for "
        f"the newest, vibrant articles about {gender.upper()} fashion in the '{bucket['label']}' category ({bucket['focus']}).\n"
        f"Geographic focus: {place}.\n"
        f"{personalization_prompt}"
        f"{avoid_topics}\n\n"
        "RESTRICTIONS:\n"
        "* No marketplaces or online stores: Never link to Amazon, eBay, ASOS, Shein, Temu, AliExpress, Etsy, Shopify stores (e.g. shopisrael.com), Zara/H&M store carts, or any commercial checkout or product sales pages.\n"
        "* No sign-in walled websites: Never link to paywalled or login-walled sources (e.g. Vogue Business paywall, WSJ, FT, Bloomberg, or sites requiring mandatory registration or sign-in). Content must be 100% free and open-access to readers.\n"
        "* No hard-coded or hallucinated images: Never invent, guess, or hallucinate an image URL, path, or image domain. Only return authentic original images discovered in the article, or null.\n"
        "* No irrelevant articles: Content must be strictly about fashion trends, designer collections, runway reports, street style, local designers, sustainable textiles, or garment care and repair. Never include politics, general gossip, or unrelated news.\n"
        "* No 404 Not Found - always verify article web links: Source URLs must be active, valid, direct deep links navigating directly to the specific article. Never provide dead links, homepages, search engine redirect wrappers, or root domains.\n\n"
        "MUST ACHIEVE:\n"
        "* Up-to-date articles with category-filtered, relevant new content: Research recent fashion journalism, lookbooks, reviews, or designer announcements from 2026 tailored to the specific category bucket.\n"
        "* Valid article web link. Must validate the link before publishing: source_url MUST be an authentic, direct deep link to the specific article discovered during search.\n"
        "* Card image: Original image scraped from the article itself (from metadata og:image/twitter:image or page body), or null.\n"
        "* A carefully formulated summary of the article. Always localize to the user's language and translate carefully. Verify using the language rules, font, and grammar: A punchy headline (<= 8 words) and an engaging, factual 1-2 sentence body (<= 220 characters) providing one concrete, actionable wardrobe takeaway for stylish readers.\n"
        "* Honor i18next localization: Formulate clearly for seamless downstream localization.\n\n"
        "Return ONLY a valid JSON object matching this structure:\n"
        "{\n"
        '  "headline": "Punchy, exciting headline (<= 8 words)",\n'
        '  "body": "1-2 engaging sentences detailing the trend and practical wardrobe takeaways (<= 220 characters)",\n'
        f'  "tag": "{bucket["label"].upper()}",\n'
        '  "source_name": "Actual publication, magazine, or designer name",\n'
        '  "source_url": "Direct URL of the specific online article or editorial piece discovered",\n'
        '  "image_url": "Direct authentic image URL from the article itself, or null"\n'
        "}\n"
        "Important: Return ONE concrete, actionable trend insight. The source_url in your final card must be a specific article deep link. No shopping carts, online stores, or paywalls."
    )

    card_data = None
    grounded_sources: list[dict[str, str]] = []
    try:
        res = await gemini_client.search_grounded_text(
            prompt=grounded_prompt,
            system=SYSTEM_PROMPT,
            model="gemini-3.5-flash",
            temperature=0.4,
        )
        grounded_sources = res.get("sources", [])
        parsed = _extract_json(res.get("text", ""))
        if parsed and parsed.get("headline") and parsed.get("body"):
            card_data = parsed
    except Exception as exc:
        logger.warning("Google search grounded scout failed for %s (%s): %s", bucket["slug"], gender, exc)

    # Assemble candidate URLs discovered during live web search
    candidate_urls: list[str] = []
    if card_data:
        raw_u = card_data.get("source_url")
        if isinstance(raw_u, list) and raw_u:
            candidate_urls.extend([u for u in raw_u if isinstance(u, str)])
        elif isinstance(raw_u, str):
            candidate_urls.append(raw_u)

    for s in grounded_sources:
        u = s.get("uri")
        if u and u not in candidate_urls:
            candidate_urls.append(u)

    # 3. Autonomous Web Crawling & Enrichment of Discovered Article
    if card_data:
        for u in candidate_urls[:8]:
            source_url = _clean_url(u) or u
            if not source_url.startswith("http"):
                continue
            raw_card = {
                "headline": str(card_data["headline"])[:140],
                "body": str(card_data["body"])[:400],
                "tag": (card_data.get("tag") or bucket["label"]).upper()[:40],
                "source_name": (card_data.get("source_name") or "")[:80] or None,
                "source_url": source_url,
                "image_url": _clean_url(card_data.get("image_url")),
                "video_url": _clean_url(card_data.get("video_url")),
            }
            verified = await verify_and_enrich_card(raw_card, bucket["slug"], gender)
            if verified and verified.get("source_url"):
                return verified

    # 4. Fallback: Multi-turn web search crawler if grounding was offline or empty
    query_strings = get_search_queries(
        bucket["slug"],
        country_code,
        city,
        gender=gender,
        dress_code=dress_code,
        style=style,
        social_platforms=social_platforms,
    )
    starter_urls: list[str] = []
    for q in query_strings:
        if q.startswith("http://") or q.startswith("https://"):
            starter_urls.append(q)
        else:
            encoded = urllib.parse.quote_plus(q)
            starter_urls.append(f"https://search.yahoo.com/search?q={encoded}")

    urls_list_str = ", ".join(starter_urls[:6])
    prompt_formatted = bucket["prompt"].format(country=country_name)
    history = [
        f"Task for {gender.upper()} fashion ({bucket['label']}): {prompt_formatted}",
        f"You can start by calling action 'browse_web' on one of the search URLs to discover recent active articles or official tastemaker links: {urls_list_str}",
        "Important: Return ONE concrete, actionable trend insight. The source_url in your final card must be a specific article deep link, guide, or tastemaker post. No shopping carts or paywalls."
    ]

    browsed_urls = []
    for _attempt in range(3):
        user_text = "\n".join(history)
        try:
            raw = await gemini_client.text(
                system=SYSTEM_PROMPT,
                user_text=user_text,
                model="gemini-3.5-flash",
                response_mime_type="application/json",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemini Fashion-Scout fallback call failed for %s: %s", bucket["slug"], exc)
            return None

        parsed = _extract_json(raw or "")
        if parsed.get("action") == "browse_web" and parsed.get("url"):
            url = parsed["url"]
            if not url.startswith("http"):
                encoded = urllib.parse.quote_plus(url)
                url = f"https://search.yahoo.com/search?q={encoded}"

            content = await browse_web(url)
            browsed_urls.append(url)
            if len(content.strip()) < 150:
                history.append(f"Warning: Page '{url}' returned empty or blocked content. Browse a different URL.")
            else:
                history.append(f"Result from {url}: {content[:3000]}")
            continue

        elif (parsed.get("action") == "finish" and parsed.get("card")) or (parsed.get("headline") and parsed.get("body")):
            card_data = parsed.get("card") if isinstance(parsed.get("card"), dict) else parsed
            if not card_data.get("headline") or not card_data.get("body"):
                return None

            source_url = _clean_url(card_data.get("source_url"))
            image_url = _clean_url(card_data.get("image_url"))
            raw_card = {
                "headline": str(card_data["headline"])[:140],
                "body": str(card_data["body"])[:400],
                "tag": (card_data.get("tag") or bucket["label"]).upper()[:40],
                "source_name": (card_data.get("source_name") or "")[:80] or None,
                "source_url": source_url or starter_urls[0],
                "image_url": image_url,
                "video_url": _clean_url(card_data.get("video_url")),
            }
            verified = await verify_and_enrich_card(raw_card, bucket["slug"], gender)
            if verified and verified.get("source_url"):
                return verified

    return None


async def _is_image_url_valid(url: str | None) -> bool:
    """Actively verify that an image URL resolves, returns HTTP 200, and contains valid non-empty image content."""
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if not u.startswith("http://") and not u.startswith("https://"):
        return False
    # Strictly reject known broken, hallucinated, dummy or placeholder domains
    lowered = u.lower()
    if any(d in lowered for d in ("ynet-pic1.ynet.co.il", "example.com", "localhost", "placeholder", "dummy", "default_avatar", "1x1")):
        return False
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/avif,image/jpeg,image/png,*/*;q=0.8",
    }
    try:
        async with httpx.AsyncClient(timeout=4.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(u)
            if resp.status_code == 200 and len(resp.content) >= 3000:
                ct = resp.headers.get("content-type", "").lower()
                if "image" in ct or "octet-stream" in ct or resp.content[:4] in (b"\xff\xd8\xff", b"\x89PNG", b"RIFF", b"GIF8"):
                    return True
            return False
    except Exception:
        return False


def _sanitize_localized_text(text: str, target_lang: str) -> str:
    """Detect and clean up any accidental mixed-script corruption (e.g. קampaigת -> קמפיין)."""
    if not text:
        return text
    cleaned = text
    if target_lang in ("he", "heb"):
        # Fix corrupt mixed Latin-Hebrew tokens
        cleaned = re.sub(r'קampaig[תn]?', 'קמפיין', cleaned)
        cleaned = re.sub(r'ב?מיקונ[oO][sS]', 'מיקונוס', cleaned)
        cleaned = re.sub(r'\b[קכ]ampaig[a-zA-Z\u0590-\u05FF]*\b', 'קמפיין', cleaned)
    return cleaned


async def verify_and_enrich_card(card: dict[str, Any] | None, bucket_slug: str, gender: str) -> dict[str, Any] | None:
    """Validate that source_url is reachable (HTTP 200), strictly not 404, not an online store or sign-in wall,
    and scrape the authentic original article image.
    """
    if not card or not card.get("source_url"):
        return None
    raw_url = card["source_url"]
    clean_url = _clean_url(raw_url)
    if not clean_url:
        logger.info("Trend link rejected by domain/path filter: %s", raw_url)
        return None

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(clean_url)
            # 1. HARD HTTP ERROR CHECK: Must return 200 OK
            if resp.status_code != 200:
                logger.info("Trend link verification failed: %s returned HTTP %d (REJECTED)", clean_url, resp.status_code)
                return None

            final_url = str(resp.url)
            clean_final = _clean_url(final_url)
            if not clean_final:
                logger.info("Trend final redirected URL %s is disallowed (REJECTED)", final_url)
                return None

            resp_text = resp.text
            if not resp_text or len(resp_text.strip()) < 300:
                logger.info("Trend link %s returned empty or blocked content (REJECTED)", clean_final)
                return None

            soup = BeautifulSoup(resp_text, "html.parser")
            page_title = (soup.title.string or "") if soup.title else ""
            h1_text = " ".join([h.get_text() for h in soup.find_all("h1")])
            check_sample = f"{page_title} {h1_text} {resp_text[:2500]}".lower()

            # 2. SOFT 404 & VIDEO UNAVAILABLE NOT FOUND DETECTION
            soft_404_markers = (
                "404 page not found", "404 not found", "page not found", "page cannot be found",
                "the page you requested does not exist", "this page is unavailable",
                "could not be found", "page doesn't exist", "error 404", "שגיאה 404",
                "עמוד לא נמצא", "הדף לא נמצא", "העמוד המבוקש אינו קיים",
                "seite nicht gefunden", "page introuvable", "sorry page", "ynetglobal - sorry page",
                "this video isn't available anymore", "video unavailable", "this video is unavailable",
            )
            if any(marker in check_sample for marker in soft_404_markers):
                logger.info("Soft 404 or unavailable media detected on %s: REJECTED", clean_final)
                return None

            # Check for YouTube specifically
            if "youtube.com" in clean_final.lower() or "youtu.be" in clean_final.lower():
                if any(yt_err in check_sample for yt_err in ("video unavailable", "this video is unavailable", "this video isn't available", "offlineabilityentity")):
                    logger.info("Unavailable YouTube video rejected on %s", clean_final)
                    return None

            # Substantive article verification: ensure article body is not empty
            paragraphs = soup.find_all("p")
            combined_p_text = " ".join(p.get_text(strip=True) for p in paragraphs)
            if len(combined_p_text) < 200 and not ("youtube.com" in clean_final.lower() or "youtu.be" in clean_final.lower()):
                logger.info("Article on %s has insufficient text content (%d chars): REJECTED", clean_final, len(combined_p_text))
                return None

            # 3. ONLINE STORE / MARKETPLACE DETECTION
            store_markers = (
                'action="/cart', 'action="/checkout', 'action="/buy',
                'window.shopify', 'cdn.shopify.com', 'shopify.theme',
                'add-to-cart', 'add to cart', 'add to bag', 'buy now with 1-click',
                'free shipping on orders', 'items in your cart', 'proceed to checkout',
                'shopping cart', 'view cart', 'in stock', 'out of stock',
            )
            has_cart_form = False
            for form in soup.find_all("form"):
                action = (form.get("action") or "").lower()
                if any(p in action for p in ("/cart", "/checkout", "/buy")):
                    has_cart_form = True
                    break
            if has_cart_form or sum(1 for m in store_markers if m in check_sample) >= 2:
                logger.info("Online store / marketplace detected on %s: REJECTED", clean_final)
                return None

            # 4. SIGN-IN WALLED / PAYWALL DETECTION
            paywall_markers = (
                "sign in to read", "subscribe to continue reading", "subscriber-only",
                "already a subscriber? log in", "create a free account to read",
                "sign in to continue", "members only",
            )
            if any(pm in check_sample for pm in paywall_markers):
                logger.info("Sign-in wall / paywall detected on %s: REJECTED", clean_final)
                return None

            # 5. SCRAPE ORIGINAL ARTICLE IMAGE
            candidate_images: list[str] = []
            og_img = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
            tw_img = soup.find("meta", property="twitter:image") or soup.find("meta", attrs={"name": "twitter:image"})
            if og_img and og_img.get("content"):
                candidate_images.append(urllib.parse.urljoin(final_url, og_img["content"].strip()))
            if tw_img and tw_img.get("content"):
                candidate_images.append(urllib.parse.urljoin(final_url, tw_img["content"].strip()))

            # Look for hero images inside article or main tags
            article_tag = soup.find("article") or soup.find("main") or soup
            for img in article_tag.find_all("img"):
                src = img.get("src") or img.get("data-src") or img.get("data-original")
                if src:
                    full_img = urllib.parse.urljoin(final_url, src.strip())
                    if full_img.startswith("http") and not any(skip in full_img.lower() for skip in ["logo", "icon", "avatar", "pixel", "badge", "tracker"]):
                        candidate_images.append(full_img)

            if card.get("image_url") and str(card["image_url"]).startswith("http"):
                candidate_images.append(str(card["image_url"]))

            verified_img = None
            for c_img in candidate_images[:5]:
                if await _is_image_url_valid(c_img):
                    verified_img = c_img
                    break

            card["image_url"] = verified_img
            card["source_url"] = clean_final

            # Extract source_name from og:site_name if not provided
            if not card.get("source_name"):
                og_site = soup.find("meta", property="og:site_name") or soup.find("meta", attrs={"name": "og:site_name"})
                if og_site and og_site.get("content"):
                    card["source_name"] = og_site["content"].strip()

            return card
    except Exception as exc:
        logger.warning("Verification failed for trend card URL %s: %s", clean_url, exc)
        return None


async def _already_today(bucket_slug: str, country_code: str | None = None, gender: str = "female") -> bool:
    db = get_db()
    today = date.today().isoformat()
    canonical_slug = BUCKET_SLUG_ALIASES.get(bucket_slug, bucket_slug)
    existing = await db.trend_reports.find_one(
        {
            "bucket": {"$in": [bucket_slug, canonical_slug]},
            "gender": gender,
            "date": today,
            "language": {"$in": [None, "en"]},
            "country_code": country_code,
        }
    )
    return bool(existing)


_seed_data_initialized = False
_trend_feed_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 600

def clear_trend_feed_cache() -> None:
    _trend_feed_cache.clear()


async def ensure_seed_data() -> None:
    """Ensure database has canonical initial starting trend cards, prunes broken cards, and heals missing images & article deep links."""
    global _seed_data_initialized
    if _seed_data_initialized:
        return
    db = get_db()
    # Prune existing broken, store, or 404 cards from MongoDB
    disallowed_patterns = [
        {"source_url": {"$regex": r"shopisrael\.com", "$options": "i"}},
        {"source_url": {"$regex": r"facebook\.com/login", "$options": "i"}},
        {"source_url": {"$regex": r"vertexaisearch\.cloud\.google\.com", "$options": "i"}},
        {"source_url": {"$regex": r"S12345678", "$options": "i"}},
        {"source_url": {"$regex": r"timeout\.co\.il/topic/", "$options": "i"}},
        {"source_url": {"$regex": r"ynetnews\.com", "$options": "i"}},
        {"source_url": {"$regex": r"fashionbeans\.com/table_of_content", "$options": "i"}},
        {"source_url": {"$regex": r"youtube\.com/watch\?v=R9_1q_yF0l0", "$options": "i"}},
        {"source_url": {"$regex": r"amiri-fall-2026-campaign", "$options": "i"}},
        {"source_url": {"$regex": r"hed-mayner-fw26.*archetypes", "$options": "i"}},
        {"image_url": {"$regex": r"photo-1617127365659-c47fa864d8bc", "$options": "i"}},
    ]
    for pat in disallowed_patterns:
        try:
            res = await db.trend_reports.delete_many(pat)
            if res.deleted_count > 0:
                logger.info("Pruned %d broken/disallowed trend cards matching %s", res.deleted_count, pat)
        except Exception as exc:
            logger.warning("Failed pruning disallowed trend cards: %s", exc)

    # Nullify hallucinated stock image URLs that return 404
    try:
        updated = await db.trend_reports.update_many(
            {
                "$or": [
                    {"image_url": {"$regex": r"images\.unsplash\.com", "$options": "i"}},
                    {"image_url": {"$regex": r"images\.pexels\.com", "$options": "i"}},
                ]
            },
            {"$set": {"image_url": None}},
        )
        if updated.modified_count > 0:
            logger.info("Nullified %d hallucinated stock photo URLs in trend_reports", updated.modified_count)
    except Exception as exc:
        logger.warning("Failed nullifying dead stock photo URLs: %s", exc)

    _seed_data_initialized = True


# ---------------------------------------------------------------------------
# Trend Scout User Settings & Wardrobe Analysis
# ---------------------------------------------------------------------------
async def get_user_trend_scout_settings(user_id: str, user: dict | None = None) -> dict[str, Any]:
    """Retrieve the Trend Scout settings (custom style & social media accounts) for a user."""
    db = get_db()
    settings_doc = await db.trend_scout_settings.find_one({"user_id": user_id}, {"_id": 0})
    if not settings_doc:
        if not user:
            user = await db.users.find_one({"id": user_id}) or {}
        settings_doc = user.get("trend_scout_settings") or {}

    existing_platforms = {p["id"]: p for p in settings_doc.get("social_platforms") or [] if isinstance(p, dict) and p.get("id")}
    merged_platforms = []
    for default_p in DEFAULT_SOCIAL_PLATFORMS:
        pid = default_p["id"]
        if pid in existing_platforms:
            merged_platforms.append({**default_p, **existing_platforms[pid]})
        else:
            merged_platforms.append(dict(default_p))

    return {
        "user_id": user_id,
        "custom_style": settings_doc.get("custom_style") or "",
        "social_platforms": merged_platforms,
    }


async def save_user_trend_scout_settings(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Save user Trend Scout settings (custom style & social media accounts) and sync to DB."""
    db = get_db()
    current = await get_user_trend_scout_settings(user_id)
    update_data: dict[str, Any] = {
        "user_id": user_id,
        "custom_style": (str(payload.get("custom_style", current.get("custom_style") or ""))).strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if "social_platforms" in payload and isinstance(payload["social_platforms"], list):
        update_data["social_platforms"] = payload["social_platforms"]
    else:
        update_data["social_platforms"] = current.get("social_platforms", [])

    await db.trend_scout_settings.replace_one(
        {"user_id": user_id},
        update_data,
        upsert=True
    )
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"trend_scout_settings": update_data}}
    )
    clear_trend_feed_cache()
    return await get_user_trend_scout_settings(user_id)


async def connect_user_social_platform(user_id: str, platform_id: str, username: str) -> dict[str, Any]:
    """Connect a social media platform account for a user."""
    settings_data = await get_user_trend_scout_settings(user_id)
    platforms = settings_data.get("social_platforms", [])
    clean_username = username.strip()
    if clean_username and not clean_username.startswith("@") and platform_id in ("instagram", "tiktok", "x", "threads"):
        clean_username = f"@{clean_username}"

    found = False
    for p in platforms:
        if p["id"] == platform_id:
            p["connected"] = True
            p["username"] = clean_username or p["name"]
            p["active"] = True
            p["connected_at"] = datetime.now(timezone.utc).isoformat()
            found = True
            break
    if not found:
        platforms.append({
            "id": platform_id,
            "name": platform_id.title(),
            "connected": True,
            "username": clean_username,
            "active": True,
            "connected_at": datetime.now(timezone.utc).isoformat(),
        })

    return await save_user_trend_scout_settings(user_id, {"social_platforms": platforms})


async def disconnect_user_social_platform(user_id: str, platform_id: str) -> dict[str, Any]:
    """Disconnect a social media platform account for a user."""
    settings_data = await get_user_trend_scout_settings(user_id)
    platforms = settings_data.get("social_platforms", [])
    for p in platforms:
        if p["id"] == platform_id:
            p["connected"] = False
            p["username"] = None
            p["active"] = False
            p.pop("connected_at", None)
            break
    return await save_user_trend_scout_settings(user_id, {"social_platforms": platforms})


async def analyze_user_closet_profile(user_id: str, user: dict | None = None) -> dict[str, Any]:
    """Analyze the user's closet for the leading dress code and style.

    By analyzing the user's closet for the leading dress code and style,
    it adds another layer of filtering to the web search results.
    If the user entered a custom style in their Trend Scout settings,
    that custom style overrides or refines the detected style.
    """
    db = get_db()
    if not user:
        user = await db.users.find_one({"id": user_id}) or {}

    items_cursor = db.closet_items.find(
        {"user_id": user_id},
        {"dress_code": 1, "style": 1, "tags": 1, "sub_category": 1, "cultural_tags": 1, "category": 1}
    )
    items = [item async for item in items_cursor]
    if not items and hasattr(db, "clothes"):
        items_cursor = db.clothes.find(
            {"user_id": user_id},
            {"dress_code": 1, "style": 1, "tags": 1, "sub_category": 1, "cultural_tags": 1, "category": 1}
        )
        items = [item async for item in items_cursor]


    # Tally dress codes
    dress_code_counts: dict[str, int] = {}
    for item in items:
        dc = (item.get("dress_code") or "").strip().lower()
        if dc and dc not in ("all", "unknown", "other"):
            dress_code_counts[dc] = dress_code_counts.get(dc, 0) + 1

    lead_dress_code = "casual"
    if dress_code_counts:
        lead_dress_code = max(dress_code_counts, key=dress_code_counts.get)

    # Tally styles
    style_counts: dict[str, int] = {}
    for item in items:
        st = (item.get("style") or "").strip().lower()
        if st and st not in ("all", "unknown", "other"):
            style_counts[st] = style_counts.get(st, 0) + 2

        for t_raw in (item.get("tags") or []):
            t_clean = str(t_raw).strip().lower()
            if t_clean in (
                "vintage", "hip-hop", "hiphop", "streetwear", "minimalist",
                "classic", "boho", "preppy", "grunge", "y2k", "quiet luxury",
                "old money", "formal", "casual", "chic", "punk", "athletic"
            ):
                style_counts[t_clean] = style_counts.get(t_clean, 0) + 1

    # Add user's explicit style profile aesthetics
    user_aesthetics = (user.get("style_profile") or {}).get("aesthetics") or []
    for aes in user_aesthetics:
        aes_clean = str(aes).strip().lower()
        if aes_clean:
            style_counts[aes_clean] = style_counts.get(aes_clean, 0) + 3

    lead_closet_style = "contemporary"
    if style_counts:
        lead_closet_style = max(style_counts, key=style_counts.get)

    # Read user's Trend Scout settings
    scout_settings = await get_user_trend_scout_settings(user_id, user=user)
    custom_style = (scout_settings.get("custom_style") or "").strip()

    effective_style = custom_style if custom_style else lead_closet_style

    active_socials = [
        p["id"] for p in scout_settings.get("social_platforms", [])
        if p.get("active") and p.get("connected")
    ]

    return {
        "lead_dress_code": lead_dress_code,
        "lead_closet_style": lead_closet_style,
        "custom_style": custom_style or None,
        "effective_style": effective_style,
        "social_platforms": active_socials,
        "closet_item_count": len(items),
    }


# ---------------------------------------------------------------------------
# Public Execution & Scheduling Functions
# ---------------------------------------------------------------------------
async def run_trend_scout(
    *,
    force: bool = False,
    client_type: str = "desktop",
    user: dict | None = None,
    country_code: str | None = None,
    gender: str | None = None,
) -> dict[str, Any]:
    """Generate and persist today's fashion-scout cards for the requested gender & country, incorporating closet dress code & style."""
    db = get_db()
    await ensure_seed_data()
    today = date.today().isoformat()
    if force:
        clear_trend_feed_cache()

    city = None
    if user:
        for source_key in ("address", "home_location"):
            source = user.get(source_key) or {}
            if isinstance(source, dict) and source.get("city"):
                city = source["city"]
                break

    if not country_code and user:
        user_countries = _country_codes(user)
        if user_countries:
            country_code = next(iter(user_countries))

    country_code = normalize_country_code(country_code) or "IL"

    # Resolve target gender: if None, process both genders
    if gender:
        target_genders = [gender.lower()]
    elif user:
        user_sex = (user.get("sex") or user.get("gender") or "female").lower()
        target_genders = ["male" if user_sex == "male" else "female"]
    else:
        target_genders = ["female", "male"]

    # Closet & Style Analysis for Personalized Crawling
    closet_profile: dict[str, Any] = {}
    if user and user.get("id"):
        try:
            closet_profile = await analyze_user_closet_profile(user["id"], user=user)
        except Exception as exc:
            logger.warning("Closet profile analysis failed for user %s: %s", user.get("id"), exc)

    lead_dress_code = closet_profile.get("lead_dress_code")
    effective_style = closet_profile.get("effective_style")
    active_socials = closet_profile.get("social_platforms") or []

    results: list[dict[str, Any]] = []
    skipped: list[str] = []
    sem = asyncio.Semaphore(4)

    async def _process_bucket(g: str, bucket: dict[str, Any]) -> dict[str, Any] | None:
        async with sem:
            card = await _generate_one(
                bucket,
                client_type=client_type,
                country_code=country_code,
                city=city,
                gender=g,
                dress_code=lead_dress_code,
                style=effective_style,
                social_platforms=active_socials,
            )
            if not card:
                return None

            doc = {
                "id": str(uuid.uuid4()),
                "bucket": bucket["slug"],
                "bucket_label": bucket["label"],
                "gender": g,
                "date": today,
                "language": "en",
                "country_code": country_code,
                "headline": card["headline"],
                "body": card["body"],
                "tag": card["tag"],
                "source_name": card.get("source_name"),
                "source_url": card.get("source_url"),
                "image_url": card.get("image_url"),
                "video_url": card.get("video_url"),
                "dress_code": lead_dress_code,
                "style": effective_style,
                "model": "gemini-3.5-flash-grounded",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.trend_reports.replace_one(
                {
                    "bucket": bucket["slug"],
                    "gender": g,
                    "date": today,
                    "language": "en",
                    "country_code": country_code,
                },
                doc,
                upsert=True
            )
            return doc

    tasks = []
    for g in target_genders:
        buckets_to_run = MENS_BUCKETS if g == "male" else WOMENS_BUCKETS
        for bucket in buckets_to_run:
            if not force and await _already_today(bucket["slug"], country_code, gender=g):
                skipped.append(f"{g}:{bucket['slug']}")
                continue
            tasks.append(_process_bucket(g, bucket))

    generated_docs = await asyncio.gather(*tasks, return_exceptions=True)
    for res in generated_docs:
        if isinstance(res, dict):
            results.append(res)
        elif isinstance(res, Exception):
            logger.warning("Bucket processing raised exception: %s", res)

    logger.info(
        "Trend-Scout run complete: generated=%d, skipped=%d, country_code=%s, genders=%s, dress_code=%s, style=%s",
        len(results),
        len(skipped),
        country_code,
        target_genders,
        lead_dress_code,
        effective_style,
    )
    clear_trend_feed_cache()
    if user and user.get("id"):
        from app.services.sync_service import broadcast_sync_event
        await broadcast_sync_event(user["id"], "trend_scout_updated", {"date": today})

    return {
        "generated": [{k: v for k, v in r.items() if k != "_id"} for r in results],
        "skipped": skipped,
        "date": today,
    }


async def weekly_trend_scout_refresh() -> dict[str, Any]:
    """Weekly scheduled Trend-Scout refresh executed on Sunday at 10:00 AM local time.

    Refreshes both Men's and Women's Fashion Ecosystems with authentic real-time data
    for primary target locations.
    """
    logger.info("Executing weekly Trend-Scout refresh on Sunday at 10:00 AM local time...")
    results: dict[str, Any] = {}
    for country in ["IL", "US", "GB", "FR", "DE"]:
        for g in ["female", "male"]:
            try:
                res = await run_trend_scout(force=True, country_code=country, gender=g)
                results[f"{country}_{g}"] = len(res.get("generated") or [])
            except Exception as exc:  # noqa: BLE001
                logger.warning("Weekly Trend Scout refresh failed for %s (%s): %s", country, g, exc)
    clear_trend_feed_cache()
    return results


async def monthly_trend_scout_refresh() -> dict[str, Any]:
    """Legacy monthly alias directing to weekly_trend_scout_refresh."""
    return await weekly_trend_scout_refresh()


async def latest_trend_cards(
    limit_per_bucket: int = 1,
    country: str | None = None,
    gender: str = "female"
) -> list[dict[str, Any]]:
    """Return the most recent English cards for each bucket in the user's gender ecosystem."""
    db = get_db()
    await ensure_seed_data()
    out: list[dict[str, Any]] = []
    country = country.upper() if country else None
    gender = "male" if gender == "male" else "female"
    active_buckets = MENS_BUCKETS if gender == "male" else WOMENS_BUCKETS

    for bucket in active_buckets:
        cursor = (
            db.trend_reports.find(
                {
                    "bucket": bucket["slug"],
                    "gender": gender,
                    "language": {"$in": [None, "en"]},
                    "country_code": country,
                },
                {"_id": 0},
            )
            .sort("date", -1)
            .limit(limit_per_bucket)
        )
        async for doc in cursor:
            out.append(doc)

    # Fallback to global/unspecified country cards if country-specific cards missing
    if len(out) < len(active_buckets):
        existing_slugs = {c["bucket"] for c in out}
        for bucket in active_buckets:
            if bucket["slug"] not in existing_slugs:
                cursor = (
                    db.trend_reports.find(
                        {
                            "bucket": bucket["slug"],
                            "gender": gender,
                            "language": {"$in": [None, "en"]},
                            "country_code": None,
                        },
                        {"_id": 0},
                    )
                    .sort("date", -1)
                    .limit(limit_per_bucket)
                )
                async for doc in cursor:
                    out.append(doc)

    deduped_out: list[dict[str, Any]] = []
    seen_srcs: set[str] = set()
    seen_imgs: set[str] = set()
    for c in out:
        s_u = (c.get("source_url") or "").strip().lower()
        i_u = (c.get("image_url") or "").strip().lower()
        if s_u and s_u in seen_srcs:
            continue
        if i_u and i_u in seen_imgs:
            continue
        if s_u:
            seen_srcs.add(s_u)
        if i_u:
            seen_imgs.add(i_u)
        deduped_out.append(c)

    return [_ensure_card_image(dict(c)) for c in deduped_out]


async def fashion_scout_feed(
    limit: int = 10,
    *,
    language: str | None = None,
    country: str | None = None,
    gender: str | None = None,
    user: dict[str, Any] | None = None,
    pool_size: int | None = None,
) -> list[dict[str, Any]]:
    """Newest-first flat feed for the Stylist side panel and Trend Scout radar.

    Filters and ranks by the user's demographic gender and device country location.
    """
    db = get_db()
    await ensure_seed_data()
    language = (language or "en").lower()
    limit = max(1, min(limit, 50))
    fetch_limit = max(limit, pool_size or (30 if user else limit))
    fetch_limit = min(fetch_limit, 60)

    # Resolve target gender
    if gender:
        target_gender = "male" if gender == "male" else "female"
    elif user:
        user_sex = (user.get("sex") or user.get("gender") or "female").lower()
        target_gender = "male" if user_sex == "male" else "female"
    else:
        target_gender = "female"

    country = normalize_country_code(country)

    # Check in-memory feed cache for instant 0ms retrieval
    import time
    today = date.today().isoformat()
    cache_key = f"{target_gender}_{language}_{country}_{today}_{limit}_{bool(user)}"
    now = time.time()
    cached_entry = _trend_feed_cache.get(cache_key)
    if cached_entry and (now - cached_entry[0] < CACHE_TTL_SECONDS):
        return [dict(c) for c in cached_entry[1]]

    # Query matching candidate cards
    cursor = (
        db.trend_reports.find(
            {
                "gender": target_gender,
                "language": {"$in": [None, "en"]},
                "country_code": {"$in": [None, country]},
            },
            {"_id": 0},
        )
        .sort([("date", -1), ("created_at", -1)])
        .limit(fetch_limit)
    )
    canon = [doc async for doc in cursor]

    # Filter out any lingering cards with un-cleaned or broken URLs
    canon = [c for c in canon if _clean_url(c.get("source_url"))]

    # Deduplicate cards so duplicate source_url or identical non-empty image_url cannot repeat
    deduped_canon: list[dict[str, Any]] = []
    seen_sources: set[str] = set()
    seen_images: set[str] = set()
    for c in canon:
        src_u = (c.get("source_url") or "").strip().lower()
        img_u = (c.get("image_url") or "").strip().lower()
        if src_u and src_u in seen_sources:
            continue
        if img_u and img_u in seen_images:
            continue
        if src_u:
            seen_sources.add(src_u)
        if img_u:
            seen_images.add(img_u)
        deduped_canon.append(c)
    canon = deduped_canon

    # If canon is empty, trigger dynamic run_trend_scout in background
    if not canon:
        logger.info(
            "No active trend scout cards found for %s (%s). Triggering run_trend_scout in background...",
            country or "IL", target_gender
        )
        asyncio.create_task(run_trend_scout(country_code=country or "IL", gender=target_gender))

    # Lazy Daily Refresh: if fewer than 4 cards are dated today, trigger background refresh
    today_cards = [c for c in canon if c.get("date") == today]
    if len(today_cards) < 4:
        logger.info(
            "Lazy Daily Refresh: only %d cards for %s (%s) on %s. Triggering run_trend_scout in background...",
            len(today_cards), country or "IL", target_gender, today
        )
        asyncio.create_task(run_trend_scout(country_code=country or "IL", gender=target_gender))

    if user is not None:
        closet_profile = None
        if user.get("id"):
            try:
                closet_profile = await analyze_user_closet_profile(user["id"], user=user)
            except Exception as exc:
                logger.warning("Closet profile analysis failed in feed: %s", exc)
        canon = rank_cards_for_user(canon, user, closet_profile=closet_profile)
    canon = canon[:limit]

    if language == "en":
        final_cards = [_ensure_card_image(dict(c)) for c in canon]
        _trend_feed_cache[cache_key] = (now, [dict(c) for c in final_cards])
        return final_cards

    # Fast batch query: Check MongoDB cache for all canon IDs in one single index lookup
    canon_ids = [c.get("id") for c in canon if c.get("id")]
    cached_docs = await db.trend_reports.find(
        {
            "$or": [
                {"origin_id": {"$in": canon_ids}, "language": language},
                {"_origin": {"$in": canon_ids}, "language": language},
            ]
        },
        {"_id": 0},
    ).to_list(length=100)

    cached_map: dict[str, dict[str, Any]] = {}
    for doc in cached_docs:
        oid = doc.get("origin_id") or doc.get("_origin")
        if oid and oid not in cached_map:
            cached_map[oid] = doc

    # Helper to translate a single card with a strict timeout
    sem = asyncio.Semaphore(4)

    async def _safe_translate(card_to_trans: dict[str, Any]) -> dict[str, Any]:
        cid = card_to_trans.get("id")
        # If card is already in target language or missing id, return directly
        if not cid or card_to_trans.get("language") == language:
            return _ensure_card_image(dict(card_to_trans))
        # If already cached
        if cid in cached_map:
            return _ensure_card_image(dict(cached_map[cid]))

        async with sem:
            try:
                translated = await asyncio.wait_for(
                    _translate_card(card_to_trans, language=language, country=country),
                    timeout=3.5,
                )
                if translated:
                    doc_to_save = {
                        **translated,
                        "origin_id": cid,
                        "_origin": cid,
                        "language": language,
                        "country_code": country.upper() if country else None,
                    }
                    try:
                        await db.trend_reports.update_one(
                            {"origin_id": cid, "language": language},
                            {"$set": doc_to_save},
                            upsert=True,
                        )
                    except Exception:
                        pass
                    return _ensure_card_image({k: v for k, v in doc_to_save.items() if k != "_id"})
            except Exception as exc:
                logger.warning("Translation for card %s timed out or failed: %s", cid, exc)
        return _ensure_card_image(dict(card_to_trans))

    # Priority slice: translate the first 8 cards concurrently
    priority_cards = canon[:8]
    background_cards = canon[8:]

    # Run priority translations concurrently with asyncio.gather
    translated_priority = await asyncio.gather(*[_safe_translate(c) for c in priority_cards])

    # For any remaining cards, return cached version or canonical version immediately
    remaining_out: list[dict[str, Any]] = []
    need_background_trans: list[dict[str, Any]] = []
    for c in background_cards:
        cid = c.get("id")
        if cid and cid in cached_map:
            remaining_out.append(_ensure_card_image(dict(cached_map[cid])))
        else:
            remaining_out.append(_ensure_card_image(dict(c)))
            if cid and c.get("language") != language:
                need_background_trans.append(c)

    # If some background cards need translation, schedule in background without blocking this response
    if need_background_trans:
        async def _trans_remaining(cards_batch: list[dict[str, Any]]):
            for bg_c in cards_batch:
                await _safe_translate(bg_c)
        asyncio.create_task(_trans_remaining(need_background_trans))

    final_cards = list(translated_priority) + remaining_out
    _trend_feed_cache[cache_key] = (now, [dict(c) for c in final_cards])
    return final_cards


async def _translate_card(
    card: dict[str, Any],
    *,
    language: str,
    country: str | None,
) -> dict[str, Any] | None:
    if not settings.GEMINI_API_KEY:
        return None
    lang_name = {
        "en": "English", "he": "Hebrew", "ar": "Arabic", "es": "Spanish",
        "fr": "French", "de": "German", "it": "Italian", "pt": "Portuguese",
        "ru": "Russian", "zh": "Chinese", "ja": "Japanese", "hi": "Hindi", "nl": "Dutch",
    }.get(language, "English")

    country_clause = (
        f" The reader is in country code {country.upper()}. Tune the tone,"
        f" examples and sources to an outlet a {country.upper()} reader would recognise."
        if country else ""
    )
    system_prompt = (
        f"You are DressApp's Expert Fashion Localizer & Translator specializing in {lang_name}.\n"
        f"Your mission is to carefully formulate and localize the fashion trend card into natural, fluent, elegant {lang_name} while strictly honoring i18next localization standards.\n\n"
        "RESTRICTIONS:\n"
        "* No marketplaces or online stores.\n"
        "* No sign-in walled websites.\n"
        "* No hard-coded or hallucinated images.\n"
        "* No irrelevant articles.\n"
        "* No 404 Not Found - always verify and preserve article web links.\n\n"
        "MUST ACHIEVE:\n"
        "* Up-to-date articles with category-filtered, relevant new content.\n"
        "* Valid article web link. Must validate the link before publishing: Keep the exact verified source_url untouched. Never alter, translate, or invent web links.\n"
        "* Card image: Original image scraped from the article: Keep the exact verified image_url untouched.\n"
        "* A carefully formulated summary of the article. Always localize to the user's language and translate carefully. Verify using the language rules, font, and grammar:\n"
        f"  - Complete, natural, idiomatic translation into {lang_name}.\n"
        "  - ABSOLUTELY NO HYBRID OR CORRUPTED WORDS: NEVER mix Latin and Hebrew/Arabic letters inside a single word (e.g., NEVER produce 'קampaigת' or 'במיקונos'). Standard nouns must be translated cleanly (in Hebrew: 'קמפיין', in Arabic: 'حملة'). Proper locations must be transliterated ('מיקונוס' / 'ميكونוס').\n"
        f"  - Ensure correct grammatical gender agreement, subject-verb order, and typography for {lang_name}.\n"
        "  - For RTL languages (Hebrew, Arabic), ensure text flows seamlessly without bidirectional layout artifacts.\n"
        "  - Keep the tone stylish, refined, inspiring, and concise (headline <= 8 words, body 1-2 sentences <= 220 characters).\n"
        f"* Honor i18next localization: Localize all text fields (headline, body, tag) to {lang_name}. Tag should be short, informative, all-caps (e.g. 'חדשות מקומיות' for LOCAL NEWS).\n\n"
        f"{country_clause}\n"
        "Return ONLY a valid JSON object with keys: headline, body, tag, source_name, source_url, image_url, video_url."
    )
    client = GeminiClient(api_key=settings.GEMINI_API_KEY)
    payload_text = json.dumps(
        {
            "headline": card.get("headline"),
            "body": card.get("body"),
            "tag": card.get("tag"),
            "source_name": card.get("source_name"),
            "source_url": card.get("source_url"),
            "image_url": card.get("image_url"),
            "video_url": card.get("video_url"),
        },
        ensure_ascii=False,
    )
    try:
        raw = await client.text(
            system=system_prompt,
            user_text=payload_text,
            model="gemini-3.5-flash",
            response_mime_type="application/json",
        )
    except Exception as exc:
        logger.warning("Translate scout card failed (%s -> %s): %s", card.get("id"), language, exc)
        return None

    parsed = _extract_json(raw or "")
    if not parsed.get("headline") or not parsed.get("body"):
        return None

    headline = _sanitize_localized_text(str(parsed["headline"]).strip(), language)[:140]
    body = _sanitize_localized_text(str(parsed["body"]).strip(), language)[:400]

    # Preserve verified image from canonical card if valid
    verified_img = card.get("image_url")
    if not verified_img or not str(verified_img).startswith("http") or "ynet-pic1.ynet.co.il" in str(verified_img):
        verified_img = None

    return {
        "id": str(uuid.uuid4()),
        "origin_id": card["id"],
        "bucket": card["bucket"],
        "bucket_label": card.get("bucket_label"),
        "gender": card.get("gender"),
        "date": card.get("date"),
        "headline": headline,
        "body": body,
        "tag": (parsed.get("tag") or card.get("tag") or "").upper()[:40],
        "source_name": (parsed.get("source_name") or card.get("source_name"))[:80] if (parsed.get("source_name") or card.get("source_name")) else None,
        "source_url": _clean_url(parsed.get("source_url")) or card.get("source_url"),
        "image_url": verified_img,
        "video_url": _clean_url(parsed.get("video_url")) or card.get("video_url"),
        "language": language,
        "country_code": (country or "").upper() or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

