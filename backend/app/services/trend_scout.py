"""Trend-Scout / Fashion-Scout agent.

Runs on a schedule (daily at 07:00 UTC) and generates short editorial cards
for the home feed and the Stylist side panel.

Phase R extends the schema so the stylist page can render a richer
"news-flash" feed with optional media:

    {
      "bucket": "runway" | "street" | "sustainability" | "influencers"
                 | "second_hand" | "recycling" | "news_flash",
      "headline": str,
      "body": str,
      "tag": str,
      "source_name": str | None,
      "source_url": str | None,
      "image_url": str | None,
      "video_url": str | None,
    }

The agent does not yet call out to the live web (keeps things self-contained
and deterministic). It asks Gemini for a plausible, editorial-voice
observation *and* a suggestive source/media citation. When the generator
returns a URL we keep it; otherwise the fields stay null and the UI
gracefully falls back to a gradient tile.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
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
# Buckets — prompts read like mini editorial briefs.
# ---------------------------------------------------------------------------
BUCKETS: list[dict[str, Any]] = [
    {
        "slug": "ss26-runway",
        "label": "Runway",
        "prompt": (
            "Summarise ONE concrete SS26 runway trend worth a closet update."
            " Focus on silhouette, fabric, or signature colour."
        ),
        "starter_urls": [
            "https://www.vogue.com/runway",
            "https://www.elle.com/runway/",
            "https://www.harpersbazaar.com/fashion/"
        ],
    },
    {
        "slug": "street",
        "label": "Street",
        "prompt": (
            "Name ONE street-style shift that's actually being worn (not"
            " editorial fantasy). Call out the key item and the styling move."
        ),
        "starter_urls": [
            "https://hypebeast.com/fashion",
            "https://www.highsnobiety.com/",
            "https://www.whowhatwear.com/"
        ],
    },
    {
        "slug": "sustainability",
        "label": "Sustainability",
        "prompt": (
            "Pick ONE emerging sustainability story (resale, swap, materials,"
            " repair, rental) and state the user-facing implication."
        ),
        "starter_urls": [
            "https://www.vogue.com/fashion",
            "https://www.whowhatwear.com/"
        ],
    },
    {
        "slug": "influencers",
        "label": "Influencers",
        "prompt": (
            "Highlight ONE global fashion influencer whose feed is shaping"
            " how people are dressing right now. Name the person, their"
            " signature move, and why it matters."
        ),
        "starter_urls": [
            "https://www.elle.com/culture/celebrities/",
            "https://www.vogue.com/fashion",
            "https://www.harpersbazaar.com/fashion/"
        ],
    },
    {
        "slug": "second_hand",
        "label": "Second-hand",
        "prompt": (
            "Spotlight ONE concrete second-hand / vintage marketplace trend"
            " (platform, category, buyer behaviour). Make it actionable."
        ),
        "starter_urls": [
            "https://hypebeast.com/tags/vintage",
            "https://www.highsnobiety.com/tag/vintage/"
        ],
    },
    {
        "slug": "recycling",
        "label": "Recycling",
        "prompt": (
            "Call out ONE innovative clothing-recycling or repair idea that"
            " a home wardrobe could realistically adopt this month."
        ),
        "starter_urls": [
            "https://www.vogue.com/fashion"
        ],
    },
    {
        "slug": "news_flash",
        "label": "News Flash",
        "prompt": (
            "Deliver ONE breaking fashion-industry headline worth sharing in"
            " a news-flash ticker (brand move, collaboration, regulation,"
            " launch). Be factual-sounding and editorial."
        ),
        "starter_urls": [
            "https://hypebeast.com/fashion",
            "https://www.highsnobiety.com/",
            "https://www.harpersbazaar.com/fashion/",
            "https://www.elle.com/fashion/"
        ],
    },
]


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
}

SEARCH_TEMPLATES: dict[str, list[str]] = {
    "ss26-runway": [
        "site:vogue.com/runway OR site:elle.com/runway runway fashion trends 2026",
        "{country} runway fashion designer collection trends 2026",
        "spring summer 2026 runway fashion show highlights {country} wmagazine thecut"
    ],
    "street": [
        "instagram tiktok street style fashion trends 2026 whowhatwear refinery29",
        "instagram tiktok facebook street style fashion {country} dazed i-d",
        "streetwear trends 2026 {country} instagram tiktok highsnobiety hypebeast"
    ],
    "sustainability": [
        "sustainable fashion resale upcycling vogue whowhatwear refinery29 fashionista",
        "sustainable fashion {country} eco friendly clothing brand upcycling",
        "instagram facebook sustainable fashion resale {country} thecut"
    ],
    "influencers": [
        "instagram tiktok fashion influencer outfit trends 2026 whowhatwear refinery29",
        "instagram tiktok twitter {country} fashion influencer hype dazed",
        "top fashion creators instagram tiktok {country} dressing style fashionista"
    ],
    "second_hand": [
        "vintage second hand clothing marketplace trends highsnobiety hypebeast grailed",
        "best online vintage clothing shops resale platforms 2026 {country} fashionista",
        "facebook vintage second hand clothing group marketplace {country} refinery29"
    ],
    "recycling": [
        "clothing recycling repair upcycling diy wardrobe ideas 2026 whowhatwear",
        "clothing recycling upcycling repair {country} fashionista",
        "instagram clothing repair upcycling wardrobe {country} refinery29"
    ],
    "news_flash": [
        "breaking fashion industry news collaboration launch 2026 hypebeast harpersbazaar gq wmagazine",
        "breaking fashion news brand collaboration {country} thecut",
        "twitter facebook breaking fashion brand news {country} dazed i-d"
    ]
}

def get_search_queries(bucket_slug: str, country_code: str | None, city: str | None = None) -> list[str]:
    country = COUNTRY_NAME_MAP.get((country_code or "").upper(), "") if country_code else ""
    templates = SEARCH_TEMPLATES.get(bucket_slug, ["fashion trends 2026"])
    
    queries = []
    for t in templates:
        if "{country}" in t:
            place = f"{city} {country}" if (city and country) else (country or city or "")
            if place:
                queries.append(t.format(country=place).strip())
        else:
            queries.append(t)
            
    if not queries:
        queries = [t.replace("{country}", "").strip() for t in templates]
        
    import urllib.parse
    urls = []
    for q in queries:
        encoded = urllib.parse.quote_plus(q)
        urls.append(f"https://search.yahoo.com/search?q={encoded}")
    return urls


SYSTEM_PROMPT = (
    "You are DressApp's Fashion-Scout — an independent agent searching for fashion trends.\n"
    "You can browse the web to find real-time insights.\n"
    "Write for a reader who already dresses well and wants ONE actionable insight per card.\n\n"
    "Rules for sources:\n"
    "- NEVER use 'Vogue Business' (which is subscription-walled). Instead, use 'Vogue Runway' for Vogue runway/fashion articles.\n"
    "- NEVER use search engine domains (e.g. yahoo.com, google.com) or social media homepages (e.g. instagram.com, tiktok.com, facebook.com, twitter.com) as the final source_url. All final cards must link to actual content articles or specific posts.\n"
    "- You MUST browse at least one actual deep fashion article/post link from the search results to get real content before calling 'finish'. Do not finish with only Yahoo Search results in history.\n"
    "- The source_url in your final card MUST be the exact deep article/post URL found within the browsed page content (in markdown format, e.g. [title](url)).\n\n"
    "Output contract: return ONLY a JSON object.\n"
    'If you need to search a website, return: {"action": "browse_web", "url": "<https URL>"}.\n'
    'Once you have enough context, return: {"action": "finish", "card": {\n'
    ' "headline": string (<= 8 words),\n'
    ' "body": string (1-2 sentences, <= 220 chars),\n'
    ' "tag": string (short all-caps category tag),\n'
    ' "source_name": string (e.g., "Vogue Runway", "Hypebeast"),\n'
    ' "source_url": string (must be a specific deep link found in the browsed text),\n'
    ' "image_url": string (or null),\n'
    ' "video_url": string (or null)\n'
    "}}. No markdown, no prose outside JSON."
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def browse_web(url: str) -> str:
    """Agent tool to fetch and extract text and inline links from a webpage."""
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
                return "Failed to fetch Yahoo search page: Anti-bot challenge or empty results."
                
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
    """Keep only https URLs and strip obvious fabrications."""
    if not value or not isinstance(value, str):
        return None
    v = value.strip()
    if not v.lower().startswith(("http://", "https://")):
        return None
    # Normalize to https to avoid mixed-content warnings in the browser.
    if v.lower().startswith("http://"):
        v = "https://" + v[len("http://") :]
    # Reject obviously-fake hosts (private or example.com) to keep the UI honest.
    lowered = v.lower()
    if "example.com" in lowered or "localhost" in lowered:
        return None
    return v[:300]


# ---------------------------------------------------------------------------
# Personalization (Phase TS-2)
#
# Until the real web-scouring integration lands (Tavily / Perplexity / etc,
# tracked as a future tier-pricing milestone), the trend pool is
# generated by an LLM and stored in ``trend_reports``. We can still
# give the user a meaningfully better feed by **ranking the same pool
# against their demographics** at read time — gender, occupation,
# professional profile, and country.
#
# The ranker is intentionally simple: a deterministic keyword-overlap
# score with a few content-aware boosts. This avoids another LLM call
# on every read (cost + latency) and keeps the behaviour debuggable.
# When the live web search ships, the same ranker will simply operate
# on a richer, real-content pool.
# ---------------------------------------------------------------------------
_BUCKET_AFFINITY: dict[str, dict[str, float]] = {
    # Bucket → keyword → weight. Boosts the bucket when the user's
    # keyword set hints at an interest in that subject. Weights kept
    # small (≤ 2.0) so they nudge ranking rather than dominate it.
    "ss26-runway": {
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
    "second_hand": {
        "thrift": 2.0, "vintage": 2.0, "student": 1.5, "budget": 1.0,
    },
    "recycling": {
        "designer": 1.0, "engineer": 1.0, "tailor": 1.5, "diy": 1.5,
    },
    "news_flash": {},  # neutral
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
    sex = user.get("sex")
    if isinstance(sex, str):
        # Map sex → likely fashion-feed keywords. Cards rarely tag
        # gender explicitly so we look for the english noun forms.
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


def _country_codes(user: dict[str, Any]) -> set[str]:
    """Best-effort country code set for the viewer (upper-case, 2-letter)."""
    out: set[str] = set()
    name_to_code = {
        "AFGHANISTAN": "AF", "ALAND ISLANDS": "AX", "ALBANIA": "AL", "ALGERIA": "DZ", "AMERICAN SAMOA": "AS",
        "ANDORRA": "AD", "ANGOLA": "AO", "ANGUILLA": "AI", "ANTARCTICA": "AQ", "ANTIGUA AND BARBUDA": "AG",
        "ARGENTINA": "AR", "ARMENIA": "AM", "ARUBA": "AW", "AUSTRALIA": "AU", "AUSTRIA": "AT", "AZERBAIJAN": "AZ",
        "BAHAMAS": "BS", "BAHRAIN": "BH", "BANGLADESH": "BD", "BARBADOS": "BB", "BELARUS": "BY", "BELGIUM": "BE",
        "BELIZE": "BZ", "BENIN": "BJ", "BERMUDA": "BM", "BHUTAN": "BT", "BOLIVIA": "BO", "BONAIRE, SINT EUSTATIUS AND SABA": "BQ",
        "BOSNIA AND HERZEGOVINA": "BA", "BOTSWANA": "BW", "BOUVET ISLAND": "BV", "BRAZIL": "BR", "BRITISH INDIAN OCEAN TERRITORY": "IO",
        "BRUNEI DARUSSALAM": "BN", "BULGARIA": "BG", "BURKINA FASO": "BF", "BURUNDI": "BI", "CABO VERDE": "CV",
        "CAMBODIA": "KH", "CAMEROON": "CM", "CANADA": "CA", "CAYMAN ISLANDS": "KY", "CENTRAL AFRICAN REPUBLIC": "CF",
        "CHAD": "TD", "CHILE": "CL", "CHINA": "CN", "CHRISTMAS ISLAND": "CX", "COCOS (KEELING) ISLANDS": "CC",
        "COLOMBIA": "CO", "COMOROS": "KM", "CONGO": "CG", "CONGO, DEMOCRATIC REPUBLIC OF THE": "CD", "COOK ISLANDS": "CK",
        "COSTA RICA": "CR", "COTE D'IVOIRE": "CI", "CROATIA": "HR", "CUBA": "CU", "CURACAO": "CW", "CYPRUS": "CY",
        "CZECHIA": "CZ", "DENMARK": "DK", "DJIBOUTI": "DJ", "DOMINICA": "DM", "DOMINICAN REPUBLIC": "DO",
        "ECUADOR": "EC", "EGYPT": "EG", "EL SALVADOR": "SV", "EQUATORIAL GUINEA": "GQ", "ERITREA": "ER", "ESTONIA": "EE",
        "ESWATINI": "SZ", "ETHIOPIA": "ET", "FALKLAND ISLANDS (MALVINAS)": "FK", "FAROE ISLANDS": "FO", "FIJI": "FJ",
        "FINLAND": "FI", "FRANCE": "FR", "FRENCH GUIANA": "GF", "FRENCH POLYNESIA": "PF", "FRENCH SOUTHERN TERRITORIES": "TF",
        "GABON": "GA", "GAMBIA": "GM", "GEORGIA": "GE", "GERMANY": "DE", "GHANA": "GH", "GIBRALTAR": "GI", "GREECE": "GR",
        "GREENLAND": "GL", "GRENADA": "GD", "GUADELOUPE": "GP", "GUAM": "GU", "GUATEMALA": "GT", "GUERNSEY": "GG",
        "GUINEA": "GN", "GUINEA-BISSAU": "GW", "GUYANA": "GY", "HAITI": "HT", "HEARD ISLAND AND MCDONALD ISLANDS": "HM",
        "HOLY SEE": "VA", "HONDURAS": "HN", "HONG KONG": "HK", "HUNGARY": "HU", "ICELAND": "IS", "INDIA": "IN",
        "INDONESIA": "ID", "IRAN": "IR", "IRAQ": "IQ", "IRELAND": "IE", "ISLE OF MAN": "IM", "ISRAEL": "IL",
        "ITALY": "IT", "JAMAICA": "JM", "JAPAN": "JP", "JERSEY": "JE", "JORDAN": "JO", "KAZAKHSTAN": "KZ",
        "KENYA": "KE", "KIRIBATI": "KI", "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF": "KP", "KOREA, REPUBLIC OF": "KR",
        "SOUTH KOREA": "KR", "NORTH KOREA": "KP", "KUWAIT": "KW", "KYRGYZSTAN": "KG", "LAO PEOPLE'S DEMOCRATIC REPUBLIC": "LA",
        "LATVIA": "LV", "LEBANON": "LB", "LESOTHO": "LS", "LIBERIA": "LR", "LIBYA": "LY", "LIECHTENSTEIN": "LI",
        "LITHUANIA": "LT", "LUXEMBOURG": "LU", "MACAO": "MO", "MADAGASCAR": "MG", "MALAWI": "MW", "MALAYSIA": "MY",
        "MALDIVES": "MV", "MALI": "ML", "MALTA": "MT", "MARSHALL ISLANDS": "MH", "MARTINIQUE": "MQ", "MAURITANIA": "MR",
        "MAURITIUS": "MU", "MAYOTTE": "YT", "MEXICO": "MX", "MICRONESIA": "FM", "MOLDOVA": "MD", "MONACO": "MC",
        "MONGOLIA": "MN", "MONTENEGRO": "ME", "MONTSERRAT": "MS", "MOROCCO": "MA", "MOZAMBIQUE": "MZ", "MYANMAR": "MM",
        "NAMIBIA": "NA", "NAURU": "NR", "NEPAL": "NP", "NETHERLANDS": "NL", "NEW CALEDONIA": "NC", "NEW ZEALAND": "NZ",
        "NICARAGUA": "NI", "NIGER": "NE", "NIGERIA": "NG", "NIUE": "NU", "NORFOLK ISLAND": "NF", "NORTHERN MARIANA ISLANDS": "MP",
        "NORWAY": "NO", "OMAN": "OM", "PAKISTAN": "PK", "PALAU": "PW", "PALESTINE, STATE OF": "PS", "PALESTINE": "PS",
        "PANAMA": "PA", "PAPUA NEW GUINEA": "PG", "PARAGUAY": "PY", "PERU": "PE", "PHILIPPINES": "PH", "PITCAIRN": "PN",
        "POLAND": "PL", "PORTUGAL": "PT", "PUERTO RICO": "PR", "QATAR": "QA", "REUNION": "RE", "ROMANIA": "RO",
        "RUSSIAN FEDERATION": "RU", "RUSSIA": "RU", "RWANDA": "RW", "SAINT BARTHELEMY": "BL", "SAINT HELENA, ASCENSION AND TRISTAN DA CUNHA": "SH",
        "SAINT KITTS AND NEVIS": "KN", "SAINT LUCIA": "LC", "SAINT MARTIN (FRENCH PART)": "MF", "SAINT PIERRE AND MIQUELON": "PM",
        "SAINT VINCENT AND THE GRENADINES": "VC", "SAMOA": "WS", "SAN MARINO": "SM", "SAO TOME AND PRINCIPE": "ST",
        "SAUDI ARABIA": "SA", "SENEGAL": "SN", "SERBIA": "RS", "SEYCHELLES": "SC", "SIERRA LEONE": "SL", "SINGAPORE": "SG",
        "SINT MAARTEN (DUTCH PART)": "SX", "SLOVAKIA": "SK", "SLOVENIA": "SI", "SOLOMON ISLANDS": "SB", "SOMALIA": "SO",
        "SOUTH AFRICA": "ZA", "SOUTH GEORGIA AND THE SOUTH SANDWICH ISLANDS": "GS", "SOUTH SUDAN": "SS", "SPAIN": "ES",
        "SRI LANKA": "LK", "SUDAN": "SD", "SURINAME": "SR", "SVALBARD AND JAN MAYEN": "SJ", "SWEDEN": "SE", "SWITZERLAND": "CH",
        "SYRIAN ARAB REPUBLIC": "SY", "TAIWAN": "TW", "TAJIKISTAN": "TJ", "TANZANIA, UNITED REPUBLIC OF": "TZ",
        "THAILAND": "TH", "TIMOR-LESTE": "TL", "TOGO": "TG", "TOKELAU": "TK", "TONGA": "TO", "TRINIDAD AND TOBAGO": "TT",
        "TUNISIA": "TN", "TURKEY": "TR", "TURKMENISTAN": "TM", "TURKS AND CAICOS ISLANDS": "TC", "TUVALU": "TV",
        "UGANDA": "UG", "UKRAINE": "UA", "UNITED ARAB EMIRATES": "AE", "UAE": "AE", "UNITED KINGDOM": "GB", "UK": "GB",
        "GREAT BRITAIN": "GB", "UNITED STATES": "US", "USA": "US", "UNITED STATES MINOR OUTLYING ISLANDS": "UM",
        "URUGUAY": "UY", "UZBEKISTAN": "UZ", "VANUATU": "VU", "VENEZUELA": "VE", "VIET NAM": "VN", "VIETNAM": "VN",
        "VIRGIN ISLANDS, BRITISH": "VG", "VIRGIN ISLANDS, U.S.": "VI", "WALLIS AND FUTUNA": "WF", "WESTERN SAHARA": "EH",
        "YEMEN": "YE", "ZAMBIA": "ZM", "ZIMBABWE": "ZW"
    }
    for source_key in ("home_location", "address"):
        source = user.get(source_key) or {}
        if isinstance(source, dict):
            for k in ("country_code", "country"):
                v = source.get(k)
                if isinstance(v, str) and v.strip():
                    val = v.strip().upper()
                    if len(val) == 2:
                        out.add(val)
                    elif val in name_to_code:
                        out.add(name_to_code[val])
    return out


def _opposite_gender_penalty(card: dict[str, Any], sex: str | None) -> float:
    """Soft-penalise cards that explicitly target the opposite gender.

    Hard filtering is deliberately avoided — fashion stories often
    apply across genders even when the headline mentions one — so we
    just tilt the ranking down (-2) rather than dropping the card.
    """
    if not sex:
        return 0.0
    text = f"{card.get('headline', '')} {card.get('body', '')}".lower()
    if sex == "female" and (" men's " in f" {text} " or "menswear" in text):
        return -2.0
    if sex == "male" and (" women's " in f" {text} " or "womenswear" in text):
        return -2.0
    return 0.0


def rank_cards_for_user(
    cards: list[dict[str, Any]],
    user: dict[str, Any],
) -> list[dict[str, Any]]:
    """Sort ``cards`` (highest relevance first) for the supplied user.

    Scoring:
      * +10 recency boost for cards matching the newest date in the candidate pool.
      * +2 for each user-keyword token that appears in the card text.
      * +0..2 bucket-affinity boost based on user keywords.
      * +3 if the card text mentions a country we associate with the user.
      * -2 soft penalty for cards that explicitly target the opposite gender.
      * Ties broken by recency (``date`` desc, then ``created_at`` desc).
    """
    if not cards:
        return cards
    user_keywords = _user_keyword_set(user)
    user_countries = _country_codes(user)
    sex = user.get("sex") if isinstance(user.get("sex"), str) else None
    
    latest_date = max(((c.get("date") or "") for c in cards), default="")

    def _score(card: dict[str, Any]) -> float:
        text_tokens = _tokens(
            " ".join(
                str(card.get(k, "") or "")
                for k in ("headline", "body", "tag", "source_name")
            )
        )
        score = 0.0
        # 1) Recency boost.
        if latest_date and card.get("date") == latest_date:
            score += 10.0
        # 2) Keyword overlap.
        overlap = user_keywords & text_tokens
        score += 2.0 * len(overlap)
        # 2) Bucket affinity from the user's vocabulary.
        affinity = _BUCKET_AFFINITY.get(card.get("bucket") or "", {})
        for kw, weight in affinity.items():
            if kw in user_keywords:
                score += weight
        # 3) Country mention boost.
        if user_countries:
            blob = f"{card.get('body', '')} {card.get('headline', '')}".upper()
            if any(cc and cc in blob for cc in user_countries):
                score += 3.0
            # Country code match boost (massive boost if card generated for user's country)
            card_country = card.get("country_code")
            if card_country and card_country.upper() in user_countries:
                score += 8.0
        # 4) Opposite-gender soft penalty.
        score += _opposite_gender_penalty(card, sex)
        return score

    def _sort_key(card: dict[str, Any]) -> tuple:
        # Primary: ISO date desc (newest first). Secondary: descending score.
        d_str = card.get("date") or "0000-00-00"
        d_val = 0
        try:
            d_val = int(d_str.replace("-", ""))
        except ValueError:
            pass
        return (-d_val, -_score(card))

    # Two-pass sort to keep recency stable as the secondary key.
    by_recency = sorted(
        cards,
        key=lambda c: (c.get("date") or "", c.get("created_at") or ""),
        reverse=True,
    )
    return sorted(by_recency, key=_sort_key)


async def _generate_one(bucket: dict[str, Any], client_type: str = "desktop", country_code: str | None = None, city: str | None = None) -> dict[str, Any] | None:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("No GEMINI_API_KEY set — cannot run Trend-Scout")
    
    starter_urls = get_search_queries(bucket["slug"], country_code, city)
        
    urls_list_str = ", ".join(starter_urls)
    history = [
        f"Task: {bucket['prompt']}",
        f"You MUST start by calling action 'browse_web' on one of the following dynamic Yahoo Search URLs to discover recent articles or social media updates: {urls_list_str}",
        "Important: Do not finish without first browsing. The source_url in your final card must be a specific article deep link or social media post (e.g. https://www.instagram.com/p/something) rather than a general homepage. The source_url MUST be one of the exact URLs found within the browsed search result page content or deep page content."
    ]
    if country_code:
        history.append(
            f"Note: You are scraping localized Yahoo Search results for country '{country_code.upper()}'. Read the local content, but your final card output MUST be in English. Focus on trends, styles, designers, or stores relevant to '{country_code.upper()}'."
        )
    
    browsed_urls = []
    discovered_urls = set()
    
    def normalize_url(u: str) -> str:
        if not u:
            return ""
        u = u.lower().strip()
        for prefix in ("http://", "https://"):
            if u.startswith(prefix):
                u = u[len(prefix):]
        if u.startswith("www."):
            u = u[4:]
        return u.rstrip("/")

    for attempt in range(4):
        user_text = "\n".join(history)
        if client_type == "mobile":
            # Mobile package uses local Gemma4-E2B (running in dressapp-eyes)
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "http://eyes:7860/v1/chat/completions",
                        json={
                            "messages": [
                                {"role": "system", "content": SYSTEM_PROMPT},
                                {"role": "user", "content": user_text}
                            ],
                            "temperature": 0.3,
                        },
                        timeout=30.0
                    )
                    resp.raise_for_status()
                    raw = resp.json()["choices"][0]["message"]["content"]
            except Exception as exc:
                logger.warning("Gemma mobile call failed for %s: %s", bucket["slug"], exc)
                return None
        else:
            # Desktop uses Gemini 2.5 Flash
            gemini_client = GeminiClient(api_key=settings.GEMINI_API_KEY)
            try:
                raw = await gemini_client.text(
                    system=SYSTEM_PROMPT,
                    user_text=user_text,
                    model="gemini-3.5-flash-lite",
                    response_mime_type="application/json",
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Fashion-Scout LLM call failed for %s: %s", bucket["slug"], exc)
                return None
                
        parsed = _extract_json(raw or "")
        
        # Enforce browsing requirement
        if not browsed_urls and (parsed.get("action") == "finish" or (parsed.get("headline") and parsed.get("body"))):
            history.append(f"Error: You have not browsed any websites yet. You MUST call action 'browse_web' on one of the starter URLs first: {urls_list_str}")
            continue
        
        if parsed.get("action") == "browse_web" and parsed.get("url"):
            url = parsed["url"]
            content = await browse_web(url)
            browsed_urls.append(url)
            discovered_urls.add(url)
            # Extract links from markdown content
            found_links = re.findall(r'\[.*?\]\((https?://[^\s)\]]+)\)', content)
            discovered_urls.update(found_links)
            
            # Check if content is empty or blocked (anti-scrape challenge page)
            if len(content.strip()) < 150:
                history.append(
                    f"Warning: The page at '{url}' returned empty or blocked content (status 202/challenge). "
                    f"You MUST call action 'browse_web' on a DIFFERENT starter URL from the list to find active articles: {urls_list_str}"
                )
            else:
                history.append(f"Result from {url}: {content[:3000]}")
            continue
        elif parsed.get("action") == "finish" and parsed.get("card"):
            card_data = parsed["card"]
            if not card_data.get("headline") or not card_data.get("body"):
                return None
            
            source_url = _clean_url(card_data.get("source_url"))
            
            # Normalize and check source_url against discovered URLs
            normalized_source = normalize_url(source_url)
            normalized_discovered = {normalize_url(u) for u in discovered_urls}
            
            if source_url and normalized_source not in normalized_discovered:
                available = [u for u in discovered_urls if len(u.split("/")) > 3][:10]
                history.append(
                    f"Error: The source_url '{source_url}' was not found in the browsed pages. "
                    f"You MUST use one of the exact article URLs found on the pages you browsed. "
                    f"Available URLs: {available}"
                )
                continue
            
            # If model returned a generic homepage URL, try to resolve to a deep link browsed
            if source_url and source_url.rstrip("/") in ["https://www.vogue.com", "https://hypebeast.com", "https://www.businessoffashion.com", "https://www.vogue.com/fashion"]:
                deep_links = [u for u in browsed_urls if len(u.split("/")) > 3]
                if deep_links:
                    source_url = deep_links[0]
            
            return {
                "headline": str(card_data["headline"])[:140],
                "body": str(card_data["body"])[:400],
                "tag": (card_data.get("tag") or bucket["label"]).upper()[:40],
                "source_name": (card_data.get("source_name") or "")[:80] or None,
                "source_url": source_url,
                "image_url": _clean_url(card_data.get("image_url")),
                "video_url": _clean_url(card_data.get("video_url")),
            }
        else:
            # Attempt to fall back gracefully if the LLM skips the action envelope
            if parsed.get("headline") and parsed.get("body") and browsed_urls:
                source_url = _clean_url(parsed.get("source_url"))
                
                normalized_source = normalize_url(source_url)
                normalized_discovered = {normalize_url(u) for u in discovered_urls}
                
                if source_url and normalized_source not in normalized_discovered:
                    # Try to fall back to first deep link browsed
                    deep_links = [u for u in discovered_urls if len(u.split("/")) > 3]
                    if deep_links:
                        source_url = deep_links[0]
                    else:
                        source_url = browsed_urls[0]
                        
                return {
                    "headline": str(parsed["headline"])[:140],
                    "body": str(parsed["body"])[:400],
                    "tag": (parsed.get("tag") or bucket["label"]).upper()[:40],
                    "source_name": (parsed.get("source_name") or "")[:80] or None,
                    "source_url": source_url,
                    "image_url": _clean_url(parsed.get("image_url")),
                    "video_url": _clean_url(parsed.get("video_url")),
                }
            logger.warning("Invalid agent action for %s: %s", bucket["slug"], parsed)
            history.append("Error: Invalid response format. You must return either browse_web or finish.")
    return None


async def _already_today(bucket_slug: str, country_code: str | None = None) -> bool:
    db = get_db()
    today = date.today().isoformat()
    existing = await db.trend_reports.find_one(
        {"bucket": bucket_slug, "date": today, "language": {"$in": [None, "en"]}, "country_code": country_code}
    )
    return bool(existing)


async def run_trend_scout(*, force: bool = False, client_type: str = "desktop", user: dict | None = None, country_code: str | None = None) -> dict[str, Any]:
    """Generate and persist today's fashion-scout cards. Safe to call on demand."""
    db = get_db()
    today = date.today().isoformat()
    
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
            
    country_code = country_code.upper() if country_code else None
    
    results: list[dict[str, Any]] = []
    skipped: list[str] = []
    for bucket in BUCKETS:
        if not force and await _already_today(bucket["slug"], country_code):
            skipped.append(bucket["slug"])
            continue
        card = await _generate_one(bucket, client_type=client_type, country_code=country_code, city=city)
        if not card:
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "bucket": bucket["slug"],
            "bucket_label": bucket["label"],
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
            "model": settings.DEFAULT_STYLIST_MODEL,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.trend_reports.replace_one(
            {"bucket": bucket["slug"], "date": today, "language": "en", "country_code": country_code}, doc, upsert=True
        )
        results.append(doc)
        
    if user and results:
        from fastapi import HTTPException
        from app.services.billing_service import deduct_user_credits
        if not await deduct_user_credits(db, user, cost=1):
            raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")
        
    logger.info(
        "Fashion-Scout run complete: generated=%d, skipped=%d, client_type=%s, country_code=%s",
        len(results),
        len(skipped),
        client_type,
        country_code
    )
    return {
        "generated": [{k: v for k, v in r.items() if k != "_id"} for r in results],
        "skipped": skipped,
        "date": today,
    }


_REFRESH_LOCKS: dict[str | None, asyncio.Lock] = {}
_LAST_AUTO_REFRESH: dict[str | None, datetime] = {}


def _stale_threshold() -> int:
    """Hours after which `/trends/latest` reads opportunistically
    schedule a background refresh. Never fewer than 1 hour to keep the
    refresh fire-rate sane even if mis-configured.
    """
    try:
        return max(1, int(getattr(settings, "TREND_SCOUT_STALE_AFTER_HOURS", 24) or 24))
    except (TypeError, ValueError):
        return 24


async def _maybe_background_refresh(cards: list[dict[str, Any]], country_code: str | None = None) -> None:
    """If the newest card is older than the configured stale window,
    fire a background `run_trend_scout` so the next visit gets fresh
    data. Throttled to at most one auto-refresh per stale window to
    avoid hammering the LLM on a busy home page.
    """
    global _LAST_AUTO_REFRESH, _REFRESH_LOCKS
    if not getattr(settings, "TREND_SCOUT_ENABLED", True):
        return
    threshold = timedelta(hours=_stale_threshold())
    now = datetime.now(timezone.utc)
    
    last_refresh = _LAST_AUTO_REFRESH.get(country_code)
    if last_refresh and (now - last_refresh) < threshold:
        return  # already auto-refreshed within this stale window
    if not cards:
        return
    newest_iso = max(
        (c.get("created_at") or c.get("updated_at") or "") for c in cards
    )
    try:
        newest = datetime.fromisoformat(newest_iso.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return
    if newest.tzinfo is None:
        newest = newest.replace(tzinfo=timezone.utc)
    if (now - newest) < threshold:
        return  # still fresh
        
    if country_code not in _REFRESH_LOCKS:
        _REFRESH_LOCKS[country_code] = asyncio.Lock()
    lock = _REFRESH_LOCKS[country_code]
    if lock.locked():
        return  # someone already kicked off a refresh

    async def _go() -> None:
        global _LAST_AUTO_REFRESH
        async with lock:
            try:
                _LAST_AUTO_REFRESH[country_code] = datetime.now(timezone.utc)
                logger.info(
                    "Trend-Scout auto-refresh kicked off for country %s (newest card was %s)",
                    country_code,
                    newest.isoformat(),
                )
                await run_trend_scout(country_code=country_code)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Trend-Scout auto-refresh failed for country %s: %s", country_code, exc)

    asyncio.create_task(_go())


async def latest_trend_cards(limit_per_bucket: int = 1, country: str | None = None) -> list[dict[str, Any]]:
    """Return the most recent English card for each bucket, newest first
    (legacy feed). Opportunistically schedules a background refresh
    when the newest card is older than ``TREND_SCOUT_STALE_AFTER_HOURS``.
    """
    db = get_db()
    out: list[dict[str, Any]] = []
    country = country.upper() if country else None
    
    for bucket in BUCKETS:
        cursor = (
            db.trend_reports.find(
                {"bucket": bucket["slug"], "language": {"$in": [None, "en"]}, "country_code": country},
                {"_id": 0},
            )
            .sort("date", -1)
            .limit(limit_per_bucket)
        )
        async for doc in cursor:
            out.append(doc)
            
    # Fallback to global cards for missing buckets
    if country and len(out) < len(BUCKETS):
        existing_slugs = {c["bucket"] for c in out}
        for bucket in BUCKETS:
            if bucket["slug"] not in existing_slugs:
                cursor = (
                    db.trend_reports.find(
                        {"bucket": bucket["slug"], "language": {"$in": [None, "en"]}, "country_code": None},
                        {"_id": 0},
                    )
                    .sort("date", -1)
                    .limit(limit_per_bucket)
                )
                async for doc in cursor:
                    out.append(doc)
                    
    # Best-effort auto-refresh — never blocks the response.
    try:
        await _maybe_background_refresh(out, country_code=country)
    except Exception:  # noqa: BLE001
        pass
    return out


async def fashion_scout_feed(
    limit: int = 10,
    *,
    language: str | None = None,
    country: str | None = None,
    user: dict[str, Any] | None = None,
    pool_size: int | None = None,
) -> list[dict[str, Any]]:
    """Newest-first flat feed for the Stylist side panel.

    When `language` is supplied and differs from ``en`` we look up cached
    translated cards for that (bucket, date, language) triplet, and when
    none are present we translate the English canon on demand (storing the
    result so the next reader is instant). `country` tailors source picks
    and tone when translating.

    When `user` is supplied we rank the candidate pool by relevance to
    the viewer's demographics (gender / profession / occupation /
    country) before slicing to ``limit``. ``pool_size`` controls how
    many candidate cards we consider before ranking — defaults to
    ``max(limit, 30)`` so even a Home request for 4 cards picks the 4
    *most relevant* ones from a wide pool, not just the 4 newest.
    """
    db = get_db()
    language = (language or "en").lower()
    limit = max(1, min(limit, 50))
    # Pull a wider pool when we're going to re-rank. With no user
    # context we still respect the historical newest-first contract.
    fetch_limit = max(limit, pool_size or (30 if user else limit))
    fetch_limit = min(fetch_limit, 60)

    country = country.upper() if country else None
    # Pull newest-first English canon for the requested limit.
    cursor = (
        db.trend_reports.find(
            {"language": {"$in": [None, "en"]}, "country_code": {"$in": [None, country]}},
            {"_id": 0},
        )
        .sort([("date", -1), ("created_at", -1)])
        .limit(fetch_limit)
    )
    canon = [doc async for doc in cursor]
    if not canon:
        return []
    # Re-rank the pool against the viewer before any translation work
    # happens — translating is the expensive bit, so we want to spend
    # those tokens only on the cards we'll actually return.
    if user is not None:
        canon = rank_cards_for_user(canon, user)
    canon = canon[:limit]
    if language == "en":
        return canon

    out: list[dict[str, Any]] = []
    for card in canon:
        # Defensive: if the canon doc is missing an ``id`` (e.g. a
        # legacy/partial document slipped into trend_reports) we
        # cannot key the translation cache by ``origin_id`` — skip
        # the translation step and surface the raw English card so
        # the feed never 500s on a single bad row.
        canon_id = card.get("id")
        if not canon_id:
            logger.warning(
                "fashion_scout_feed: canon card missing 'id' (bucket=%s date=%s)",
                card.get("bucket"),
                card.get("date"),
            )
            out.append(card)
            continue
        try:
            cached = await db.trend_reports.find_one(
                {
                    "origin_id": canon_id,
                    "language": language,
                    **({"country_code": country.upper()} if country else {}),
                },
                {"_id": 0},
            )
            if cached:
                out.append(cached)
                continue
            translated = await _translate_card(
                card, language=language, country=country
            )
            if translated:
                # Persist for the next reader. ``insert_one`` failures
                # here (duplicate key from a concurrent writer, write
                # quorum hiccup, etc.) must NOT take down the whole
                # request — we still have a perfectly good translated
                # card to show; we just won't cache it this time.
                try:
                    await db.trend_reports.insert_one(
                        {**translated, "_origin": canon_id}
                    )
                except Exception as cache_exc:  # noqa: BLE001
                    logger.info(
                        "fashion_scout_feed: cache insert skipped (%s -> %s): %s",
                        canon_id,
                        language,
                        cache_exc,
                    )
                out.append({k: v for k, v in translated.items() if k != "_id"})
            else:
                out.append(card)
        except Exception as exc:  # noqa: BLE001
            # Last-resort: log and fall back to the English canon
            # card so a single broken translation never 500s the
            # whole feed for the user.
            logger.warning(
                "fashion_scout_feed: per-card failure (%s -> %s): %s",
                canon_id,
                language,
                exc,
            )
            out.append(card)
    return out


async def _translate_card(
    card: dict[str, Any],
    *,
    language: str,
    country: str | None,
) -> dict[str, Any] | None:
    """Translate a canonical English card into the target language.

    We ask Gemini Flash for a structured translation plus *regionalization*
    — so an Israeli reader sees culturally-relevant source picks and idiom.
    Returns a fresh document with a new id so the cached list operates on
    stable primary keys.
    """
    if not settings.GEMINI_API_KEY:
        return None
    lang_name = {
        "en": "English",
        "he": "Hebrew",
        "ar": "Arabic",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
        "ru": "Russian",
        "zh": "Chinese",
        "ja": "Japanese",
        "hi": "Hindi",
    }.get(language, "English")
    country_clause = (
        f" The reader is in country code {country.upper()}. Tune the tone,"
        f" examples and — where the original was generic — the source_name"
        f" / source_url to an outlet a {country.upper()} reader would"
        f" actually recognise."
        if country
        else ""
    )
    system_prompt = (
        f"You localise DressApp fashion-scout cards into {lang_name}. Keep"
        " the editorial voice crisp and factual. Preserve factual claims;"
        " only adapt idioms and examples."
        f"{country_clause}"
        " Return ONLY a JSON object with the keys: headline, body, tag,"
        " source_name, source_url, image_url, video_url."
        " Preserve URLs verbatim (do not translate them). Tag remains"
        " short, uppercase, in the target language."
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
            model="gemini-3.5-flash-lite",
            response_mime_type="application/json",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Translate scout card failed (%s -> %s): %s",
            card.get("id"),
            language,
            exc,
        )
        return None
    parsed = _extract_json(raw or "")
    if not parsed.get("headline") or not parsed.get("body"):
        return None
    return {
        "id": str(uuid.uuid4()),
        "origin_id": card["id"],
        "bucket": card["bucket"],
        "bucket_label": card.get("bucket_label"),
        "date": card.get("date"),
        "headline": str(parsed["headline"])[:140],
        "body": str(parsed["body"])[:400],
        "tag": (parsed.get("tag") or card.get("tag") or "").upper()[:40],
        "source_name": (parsed.get("source_name") or card.get("source_name"))[:80]
        if parsed.get("source_name") or card.get("source_name")
        else None,
        "source_url": _clean_url(parsed.get("source_url"))
        or card.get("source_url"),
        "image_url": _clean_url(parsed.get("image_url")) or card.get("image_url"),
        "video_url": _clean_url(parsed.get("video_url")) or card.get("video_url"),
        "language": language,
        "country_code": (country or "").upper() or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
