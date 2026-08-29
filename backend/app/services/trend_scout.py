"""Trend-Scout / Fashion-Scout agent.

Runs on a monthly schedule (midnight UTC on the 1st of every month) as well as
daily/on-demand refreshes. Curates gender-sensitive fashion intelligence:
- Men's Fashion Ecosystem (7 buckets) for male users.
- Women's Fashion Ecosystem (7 buckets) for female users.

Buckets:
  1. local: Local News (anchored to device country e.g. Israel / IL)
  2. runway: Runway (Worldwide Fashion News)
  3. street: Street Style
  4. sustainability: Sustainability
  5. influencers: Mainstream Influencers & Tastemakers
  6. vintage: Vintage & Archival Fashion (No shopping)
  7. maintenance_repairs: Maintenance & Repairs (Garment care, mending, cobbling)

Enforces strict source rules:
- Restricts shopping/e-commerce checkout platforms (Amazon, ASOS, Shein, cart/checkout links).
- Restricts registration-walled / paywalled sites (no sign-up needed).
- Exposes true authentic deep links, never search redirect wrappers.
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
# Canonical Initial Seed Data (Instant Zero-Latency Fallback)
# ---------------------------------------------------------------------------
CANONICAL_SEED_CARDS: list[dict[str, Any]] = [
    # --- MEN'S ECOSYSTEM ---
    {
        "id": "seed-men-local-il",
        "bucket": "local",
        "gender": "male",
        "country_code": "IL",
        "headline": "חדשות אופנה וסטייל בתל אביב: מעצבים מקומיים",
        "body": "עדכוני אופנה, מעצבים מקומיים וקולקציות חדשות בסצנת הסטייל של תל אביב עם התאמה לאקלים הים-תיכוני.",
        "tag": "LOCAL NEWS",
        "source_name": "Time Out Tel Aviv",
        "source_url": "https://timeout.co.il/topic/%D7%90%D7%95%D7%A4%D7%A0%D7%94/",
        "image_url": "https://static.timeout.co.il/www/images/share_image.png",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-men-runway",
        "bucket": "runway",
        "gender": "male",
        "country_code": None,
        "headline": "Men’s Fashion Through the Decades: Tailoring & Silhouette Shifts",
        "body": "Analysis of evolving silhouettes, architectural shoulders, and relaxed fluid drapes across runway lookbooks.",
        "tag": "RUNWAY",
        "source_name": "The Fashionisto",
        "source_url": "https://www.thefashionisto.com/articles/fashion-through-the-decades-men/",
        "image_url": "https://www.thefashionisto.com/wp-content/uploads/2024/10/Fashion-Through-the-Decades-Men-Featured.jpg",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-men-street",
        "bucket": "street",
        "gender": "male",
        "country_code": None,
        "headline": "Streetwear Movements: Functional Utility & Retro Runners",
        "body": "Urban street style fuses archival trail silhouettes with loose-fit carpenter trousers and tonal modular layering.",
        "tag": "STREET STYLE",
        "source_name": "Ape to Gentleman",
        "source_url": "https://www.apetogentleman.com/mens-fashion-trends/",
        "image_url": "https://www.apetogentleman.com/wp-content/uploads/2022/05/FALL-WINTER-TRENDS.jpg",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-men-sustainability",
        "bucket": "sustainability",
        "gender": "male",
        "country_code": None,
        "headline": "Sustainable Menswear Brands: Ethical Sourcing & Traceability",
        "body": "Investigating closed-loop organic cotton, regenerative hemp, and transparent ethical auditing in modern menswear.",
        "tag": "SUSTAINABILITY",
        "source_name": "Good On You",
        "source_url": "https://goodonyou.eco/sustainable-menswear-brands/",
        "image_url": "https://goodonyou.eco/wp-content/uploads/2021/12/MaggieZhou-Menswear-1200x630.jpg",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-men-influencers",
        "bucket": "influencers",
        "gender": "male",
        "country_code": None,
        "headline": "Smart-Casual Tastemakers: Modern Luxury & Minimalist Tailoring",
        "body": "Tastemakers demonstrate how relaxed blazers, structured neutral knits, and tailored trousers build cohesive capsule wardrobes.",
        "tag": "TASTEMAKERS",
        "source_name": "The Fashionisto",
        "source_url": "https://www.thefashionisto.com/story/amiri-fall-2026-campaign/",
        "image_url": "https://www.thefashionisto.com/wp-content/uploads/2026/08/amiri-fall-winter-2026-campaign.jpg",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-men-vintage",
        "bucket": "vintage",
        "gender": "male",
        "country_code": None,
        "headline": "Archival Workwear & Heritage Denim Buying Guides",
        "body": "Deep dives into shuttle-loom selvedge denim history, military surplus construction, and vintage garment tags.",
        "tag": "VINTAGE & ARCHIVAL",
        "source_name": "Heddels",
        "source_url": "https://www.heddels.com/buying-guides/",
        "image_url": "https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=800&q=80",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-men-repairs",
        "bucket": "maintenance_repairs",
        "gender": "male",
        "country_code": None,
        "headline": "Garment Care & Cobbling Maintenance Guides",
        "body": "Mastering denim chainstitch mending, leather conditioning, and shoe care to extend wardrobe investments by decades.",
        "tag": "MAINTENANCE & REPAIRS",
        "source_name": "Put This On",
        "source_url": "https://putthison.com/all-articles/",
        "image_url": "https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=800&q=80",
        "date": "2026-08-01",
        "language": "en",
    },

    # --- WOMEN'S ECOSYSTEM ---
    {
        "id": "seed-women-local-il",
        "bucket": "local",
        "gender": "female",
        "country_code": "IL",
        "headline": "הפקות אופנה ומעצבות ישראליות: גוונים ארציים ופיסוליות",
        "body": "מעצבות ישראליות מובילות קו טבעי ונושם של משי אורגני, גווני טרקוטה ארציים ותכשיטי בוטיק ייחודיים.",
        "tag": "LOCAL NEWS",
        "source_name": "Walla! Fashion",
        "source_url": "https://fashion.walla.co.il/category/2131",
        "image_url": "https://images.wcdn.co.il/f_auto,q_auto,w_1200,t_54/3/6/9/0/3690025-46.jpg",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-women-runway",
        "bucket": "runway",
        "gender": "female",
        "country_code": None,
        "headline": "Runway Lookbooks: Sculptural Volume & Silhouette Play",
        "body": "International runway showcases blend sheer layering, sculptural corsetry, and kinetic fringe for confident eveningwear.",
        "tag": "RUNWAY",
        "source_name": "The Fashionisto",
        "source_url": "https://www.thefashionisto.com/story/amiri-fall-2026-campaign/",
        "image_url": "https://www.thefashionisto.com/wp-content/uploads/2026/08/amiri-fall-winter-2026-campaign.jpg",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-women-street",
        "bucket": "street",
        "gender": "female",
        "country_code": None,
        "headline": "Oversized Tailoring & Conscious Street Style Standards",
        "body": "Fashion week attendees elevate voluminous blazers with delicate ballet flats, wide-leg poplin trousers, and verified ethical staples.",
        "tag": "STREET STYLE",
        "source_name": "Good On You",
        "source_url": "https://goodonyou.eco/how-we-rate/",
        "image_url": "https://goodonyou.eco/wp-content/uploads/2018/12/opengraph-1200x630.jpg",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-women-sustainability",
        "bucket": "sustainability",
        "gender": "female",
        "country_code": None,
        "headline": "Circular Fashion Advocacy & The #NoNewClothes Challenge",
        "body": "Global slow-fashion leaders spotlight transparent garment worker standards and lab-grown mycelium leather alternatives in everyday staples.",
        "tag": "SUSTAINABILITY",
        "source_name": "Remake",
        "source_url": "https://remake.world/no-new-clothes-2024/",
        "image_url": "https://images.unsplash.com/photo-1532453286298-9836439e1607?auto=format&fit=crop&w=800&q=80",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-women-influencers",
        "bucket": "influencers",
        "gender": "female",
        "country_code": None,
        "headline": "Quiet Luxury & Minimalist Tastemaker Staples",
        "body": "Tastemakers showcase effortless Parisian-Scandi blends, combining crisp poplin shirts with vintage knitwear staples.",
        "tag": "TASTEMAKERS",
        "source_name": "Ape to Gentleman",
        "source_url": "https://www.apetogentleman.com/mens-fashion-trends/",
        "image_url": "https://www.apetogentleman.com/wp-content/uploads/2022/05/FALL-WINTER-TRENDS.jpg",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-women-vintage",
        "bucket": "vintage",
        "gender": "female",
        "country_code": None,
        "headline": "Archival Heritage & Enduring Craftsmanship Retrospectives",
        "body": "Curated retrospectives examine historic fashion silhouettes, archive collector panels, and museum-grade textile preservation methodologies.",
        "tag": "VINTAGE & ARCHIVAL",
        "source_name": "Heddels",
        "source_url": "https://www.heddels.com/buying-guides/five-plus-one/",
        "image_url": "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80",
        "date": "2026-08-01",
        "language": "en",
    },
    {
        "id": "seed-women-repairs",
        "bucket": "maintenance_repairs",
        "gender": "female",
        "country_code": None,
        "headline": "Visible Mending & Survival Sewing Skills Tutorials",
        "body": "Creative Japanese boro embroidery, sweater defuzzing, and invisible zipper repairs empower sustainable closet longevity directly at home.",
        "tag": "MAINTENANCE & REPAIRS",
        "source_name": "Repair What You Wear",
        "source_url": "https://repairwhatyouwear.com/core-mending-skills/",
        "image_url": "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?auto=format&fit=crop&w=800&q=80",
        "date": "2026-08-01",
        "language": "en",
    },
]


# ---------------------------------------------------------------------------
# Search Queries & Filtering
# ---------------------------------------------------------------------------
DISALLOWED_SHOPPING_DOMAINS = (
    "amazon.", "ebay.", "shein.", "aliexpress.", "asos.com/shop", "temu.com",
    "zara.com/shop", "hm.com/shop", "etsy.com", "target.com", "walmart.com",
    "shop.", "store.", "cart", "checkout", "buy-now"
)

DISALLOWED_PAYWALL_DOMAINS = (
    "voguebusiness.com", "wsj.com", "ft.com", "bloomberg.com"
)

DEFAULT_BUCKET_IMAGES: dict[tuple[str, str], str] = {
    # Men's Buckets
    ("local", "male"): "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
    ("runway", "male"): "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=800&q=80",
    ("street", "male"): "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=80",
    ("sustainability", "male"): "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
    ("influencers", "male"): "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?auto=format&fit=crop&w=800&q=80",
    ("vintage", "male"): "https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=800&q=80",
    ("maintenance_repairs", "male"): "https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=800&q=80",

    # Women's Buckets
    ("local", "female"): "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80",
    ("runway", "female"): "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80",
    ("street", "female"): "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80",
    ("sustainability", "female"): "https://images.unsplash.com/photo-1532453286298-9836439e1607?auto=format&fit=crop&w=800&q=80",
    ("influencers", "female"): "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    ("vintage", "female"): "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80",
    ("maintenance_repairs", "female"): "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?auto=format&fit=crop&w=800&q=80",
}


def _get_fallback_image(bucket_slug: str | None, gender: str | None) -> str:
    canonical = BUCKET_SLUG_ALIASES.get(bucket_slug or "", bucket_slug or "local")
    g = "male" if (gender or "").lower() == "male" else "female"
    return (
        DEFAULT_BUCKET_IMAGES.get((canonical, g))
        or DEFAULT_BUCKET_IMAGES.get(("local", g))
        or "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80"
    )


def _ensure_card_image(card: dict[str, Any]) -> dict[str, Any]:
    """Ensure card always has a valid non-empty representative image_url."""
    if not card:
        return card
    if not card.get("image_url") or not str(card.get("image_url")).startswith("http"):
        card["image_url"] = _get_fallback_image(card.get("bucket"), card.get("gender"))
    return card


def get_search_queries(
    bucket_slug: str,
    country_code: str | None,
    city: str | None = None,
    gender: str = "female"
) -> list[str]:
    """Build high-relevance search queries targeting open-access editorial fashion outlets."""
    canonical_slug = BUCKET_SLUG_ALIASES.get(bucket_slug, bucket_slug)
    country_name = COUNTRY_NAME_MAP.get((country_code or "").upper(), country_code or "Israel")
    place = f"{city} {country_name}" if (city and country_name) else country_name
    gender_word = "menswear men" if gender == "male" else "womenswear women"

    if canonical_slug == "local":
        if (country_code or "").upper() == "IL":
            if gender == "male":
                return [
                    "site:fashion.walla.co.il OR site:timeout.co.il אופנת גברים תל אביב",
                    "site:prtfl.co.il אופנה מעצבים ישראלים גברים",
                    "Israeli menswear fashion designers Tel Aviv style",
                ]
            return [
                "site:fashionforward.mako.co.il OR site:atmag.co.il אופנה מעצבים ישראלים",
                "site:fashion-israel.co.il מגזין אופנה ישראלי",
                "Israeli fashion designers boutique Tel Aviv style trends",
            ]
        return [
            f"{place} {gender_word} fashion news local designers trends 2026",
            f"top {gender_word} fashion magazines boutique style {place}",
        ]

    elif canonical_slug == "runway":
        if gender == "male":
            return [
                "site:thefashionisto.com OR site:fuckingyoung.es runway menswear trends 2026",
                "site:malemodelscene.net menswear runway fashion week lookbook 2026",
            ]
        return [
            "site:lofficielusa.com OR site:fashionista.com runway fashion trends 2026",
            "site:crash.fr fashion week couture runway highlights",
        ]

    elif canonical_slug == "street":
        if gender == "male":
            return [
                "site:hypebeast.com OR site:highsnobiety.com street style menswear sneakers 2026",
                "site:pausemag.co.uk street style urban fashion men",
            ]
        return [
            "site:styledumonde.com OR site:whowhatwear.com street style fashion week women",
            "site:refinery29.com/en-us/fashion street style outfits trends",
        ]

    elif canonical_slug == "sustainability":
        if gender == "male":
            return [
                "site:goodonyou.eco OR site:eco-stylist.com mens sustainable ethical fashion",
                "site:fashionrevolution.org ethical sustainable clothing guides",
            ]
        return [
            "site:remake.world OR site:ecocult.com sustainable slow fashion women",
            "site:thegoodtrade.com/category/style ethical conscious style",
        ]

    elif canonical_slug == "influencers":
        if gender == "male":
            return [
                "site:fashionbeans.com OR site:apetogentleman.com mens style tastemaker outfits",
                "site:valetmag.com everyday smart casual menswear capsule",
            ]
        return [
            "site:elle.com/fashion OR site:cosmopolitan.com/style-beauty/fashion viral aesthetic trends",
            "site:glamour.com/fashion fashion creators styling tips women",
        ]

    elif canonical_slug == "vintage":
        if gender == "male":
            return [
                "site:sabukaru.online OR site:heddels.com vintage menswear archival workwear",
                "site:vintagefashionguild.org vintage fashion history identification",
            ]
        return [
            "site:showstudio.com OR site:thevintagewomanmagazine.com archival fashion history women",
            "site:documentjournal.com fashion archive history retrospective",
        ]

    elif canonical_slug == "maintenance_repairs":
        if gender == "male":
            return [
                "site:putthison.com OR site:denimhunters.com raw denim repair darning garment care",
                "site:heddels.com/category/education/maintenance-and-repair cobbling denim mending",
            ]
        return [
            "site:repairwhatyouwear.com OR site:fixing.fashion visible mending garment repair",
            "site:gathered.how/sewing-and-quilting/sewing clothes mending upcycling guide",
        ]

    queries = [f"{gender_word} fashion trends 2026 {place}"]
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
    "- NEVER use shopping platforms, e-commerce checkout stores, or commercial cart pages (e.g. Amazon, ASOS, Shein, Temu, Zara/HM store carts).\n"
    "- NEVER use subscription-walled / registration-walled websites (e.g. Vogue Business, WSJ, FT). Must be free and open-access with no sign-up needed.\n"
    "- NEVER use search engine redirect domains (e.g. google.com/url, search.yahoo.com) or root social homepages.\n"
    "- CRITICAL FOR SOURCE_URL: source_url MUST navigate directly to the specific article, editorial piece, or guide itself (e.g. https://domain.com/category/article-slug). NEVER provide a root domain or homepage (e.g. NEVER https://domain.com or https://domain.com/). Always extract the direct article link from the markdown links inside the browsed page.\n\n"
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
    """Keep only https URLs, unwrap search redirects, and strip shopping or paywalled domains."""
    if not value or not isinstance(value, str):
        return None
    v = value.strip()
    if not v.lower().startswith(("http://", "https://")):
        return None

    # Normalize to https
    if v.lower().startswith("http://"):
        v = "https://" + v[len("http://") :]

    lowered = v.lower()
    if "example.com" in lowered or "localhost" in lowered:
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

    # Strip e-commerce shopping / cart platforms
    if any(shop in lowered for shop in DISALLOWED_SHOPPING_DOMAINS):
        return None

    # Strip paywalled domains
    if any(pw in lowered for pw in DISALLOWED_PAYWALL_DOMAINS):
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


def _country_codes(user: dict[str, Any]) -> set[str]:
    """Best-effort country code set for the viewer (upper-case, 2-letter)."""
    out: set[str] = set()
    for source_key in ("home_location", "address"):
        source = user.get(source_key) or {}
        if isinstance(source, dict):
            for k in ("country_code", "country"):
                v = source.get(k)
                if isinstance(v, str) and v.strip():
                    val = v.strip().upper()
                    if len(val) == 2:
                        out.add(val)
                    elif val in {"ISRAEL"}:
                        out.add("IL")
                    elif val in {"UNITED STATES", "USA", "US"}:
                        out.add("US")
                    elif val in {"UNITED KINGDOM", "UK", "GB"}:
                        out.add("GB")
                    elif val in {"FRANCE"}:
                        out.add("FR")
                    elif val in {"GERMANY"}:
                        out.add("DE")
                    elif val in {"ITALY"}:
                        out.add("IT")
    return out


def rank_cards_for_user(
    cards: list[dict[str, Any]],
    user: dict[str, Any],
) -> list[dict[str, Any]]:
    """Sort cards for the user based on gender match, locality, keywords, and recency."""
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
    gender: str = "female"
) -> dict[str, Any] | None:
    if not settings.GEMINI_API_KEY:
        return None

    country_name = COUNTRY_NAME_MAP.get((country_code or "").upper(), country_code or "Israel")
    starter_urls = get_search_queries(bucket["slug"], country_code, city, gender=gender)
    urls_list_str = ", ".join(starter_urls)

    prompt_formatted = bucket["prompt"].format(country=country_name)
    history = [
        f"Task for {gender.upper()} fashion ({bucket['label']}): {prompt_formatted}",
        f"You MUST start by calling action 'browse_web' on one of the search URLs to discover recent active articles or official tastemaker links: {urls_list_str}",
        "Important: Do not finish without first browsing. The source_url in your final card must be a specific article deep link or social post. No shopping carts or paywalls."
    ]

    browsed_urls = []
    discovered_urls = set()

    for _attempt in range(4):
        user_text = "\n".join(history)
        if client_type == "mobile":
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
                logger.warning("Mobile eyes call failed for %s: %s", bucket["slug"], exc)
                return None
        else:
            gemini_client = GeminiClient(api_key=settings.GEMINI_API_KEY)
            try:
                raw = await gemini_client.text(
                    system=SYSTEM_PROMPT,
                    user_text=user_text,
                    model="gemini-3.5-flash-lite",
                    response_mime_type="application/json",
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Gemini Fashion-Scout call failed for %s: %s", bucket["slug"], exc)
                return None

        parsed = _extract_json(raw or "")

        if not browsed_urls and (parsed.get("action") == "finish" or (parsed.get("headline") and parsed.get("body"))):
            history.append(f"Error: You must call action 'browse_web' on one of the starter URLs first: {urls_list_str}")
            continue

        if parsed.get("action") == "browse_web" and parsed.get("url"):
            url = parsed["url"]
            content = await browse_web(url)
            browsed_urls.append(url)
            discovered_urls.add(url)
            found_links = re.findall(r'\[.*?\]\((https?://[^\s)\]]+)\)', content)
            discovered_urls.update(found_links)

            if len(content.strip()) < 150:
                history.append(
                    f"Warning: Page '{url}' returned empty or blocked content. Browse a different starter URL: {urls_list_str}"
                )
            else:
                history.append(f"Result from {url}: {content[:3000]}")
            continue

        elif parsed.get("action") == "finish" and parsed.get("card"):
            card_data = parsed["card"]
            if not card_data.get("headline") or not card_data.get("body"):
                return None

            source_url = _clean_url(card_data.get("source_url"))
            image_url = _clean_url(card_data.get("image_url")) or _get_fallback_image(bucket["slug"], gender)
            raw_card = {
                "headline": str(card_data["headline"])[:140],
                "body": str(card_data["body"])[:400],
                "tag": (card_data.get("tag") or bucket["label"]).upper()[:40],
                "source_name": (card_data.get("source_name") or "")[:80] or None,
                "source_url": source_url or (bucket.get("starter_websites") or [{}])[0].get("url"),
                "image_url": image_url,
                "video_url": _clean_url(card_data.get("video_url")),
            }
            verified = await verify_and_enrich_card(raw_card, bucket["slug"], gender)
            return verified or raw_card
        else:
            if parsed.get("headline") and parsed.get("body") and browsed_urls:
                source_url = _clean_url(parsed.get("source_url"))
                image_url = _clean_url(parsed.get("image_url")) or _get_fallback_image(bucket["slug"], gender)
                raw_card = {
                    "headline": str(parsed["headline"])[:140],
                    "body": str(parsed["body"])[:400],
                    "tag": (parsed.get("tag") or bucket["label"]).upper()[:40],
                    "source_name": (parsed.get("source_name") or "")[:80] or None,
                    "source_url": source_url or (bucket.get("starter_websites") or [{}])[0].get("url"),
                    "image_url": image_url,
                    "video_url": _clean_url(parsed.get("video_url")),
                }
                verified = await verify_and_enrich_card(raw_card, bucket["slug"], gender)
                return verified or raw_card
            history.append("Error: Invalid response format. Return either browse_web or finish with card.")
    return None


async def verify_and_enrich_card(card: dict[str, Any] | None, bucket_slug: str, gender: str) -> dict[str, Any] | None:
    """Validate that source_url is reachable (HTTP 200) and extract authentic article og:image."""
    if not card or not card.get("source_url"):
        return None
    url = card["source_url"]
    if not url.startswith("http"):
        return None
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning("Rejecting unreachable trend card URL: %s (status %d)", url, resp.status_code)
                return None
            final_url = str(resp.url)
            resp_text = resp.text
            # Check for 404 error indicators or anti-bot block pages
            if "404" in resp_text and ("Not Found" in resp_text or "הלינקים הכי שבורים" in resp_text or "עמוד לא נמצא" in resp_text or "Page not found" in resp_text):
                logger.warning("Rejecting soft-404 trend card URL: %s", url)
                return None
            if "Radware Block Page" in resp_text or ("Cloudflare" in resp_text and "Access denied" in resp_text):
                logger.warning("Rejecting bot-blocked trend card URL: %s", url)
                return None

            soup = BeautifulSoup(resp_text, "html.parser")
            og_img = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
            tw_img = soup.find("meta", property="twitter:image") or soup.find("meta", attrs={"name": "twitter:image"})
            extracted_img = None
            if og_img and og_img.get("content"):
                extracted_img = urllib.parse.urljoin(final_url, og_img["content"].strip())
            elif tw_img and tw_img.get("content"):
                extracted_img = urllib.parse.urljoin(final_url, tw_img["content"].strip())

            card["source_url"] = final_url
            if extracted_img and extracted_img.startswith("http"):
                card["image_url"] = extracted_img
            elif not card.get("image_url") or not str(card.get("image_url")).startswith("http"):
                card["image_url"] = _get_fallback_image(bucket_slug, gender)

            return card
    except Exception as exc:
        logger.warning("Verification failed for trend card URL %s: %s", url, exc)
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


async def ensure_seed_data() -> None:
    """Ensure database has canonical initial starting trend cards and heal missing images & article deep links."""
    db = get_db()
    # Heal existing seed/canonical documents with direct article deep links and images
    for seed in CANONICAL_SEED_CARDS:
        await db.trend_reports.update_many(
            {"bucket": seed["bucket"], "gender": seed["gender"]},
            {"$set": {
                "source_url": seed["source_url"],
                "source_name": seed["source_name"],
                "image_url": seed["image_url"],
            }},
        )
    count = await db.trend_reports.count_documents({})
    if count == 0:
        logger.info("Seeding initial canonical Trend Scout cards for Men and Women...")
        for seed in CANONICAL_SEED_CARDS:
            doc = {
                **seed,
                "model": "seed-canonical-v1",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.trend_reports.replace_one(
                {"bucket": seed["bucket"], "gender": seed["gender"], "country_code": seed.get("country_code")},
                doc,
                upsert=True
            )


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
    """Generate and persist today's fashion-scout cards for the requested gender & country."""
    db = get_db()
    await ensure_seed_data()
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

    country_code = country_code.upper() if country_code else "IL"

    # Resolve target gender: if None, process both genders
    if gender:
        target_genders = [gender.lower()]
    elif user:
        user_sex = (user.get("sex") or user.get("gender") or "female").lower()
        target_genders = ["male" if user_sex == "male" else "female"]
    else:
        target_genders = ["female", "male"]

    results: list[dict[str, Any]] = []
    skipped: list[str] = []

    for g in target_genders:
        buckets_to_run = MENS_BUCKETS if g == "male" else WOMENS_BUCKETS
        for bucket in buckets_to_run:
            if not force and await _already_today(bucket["slug"], country_code, gender=g):
                skipped.append(f"{g}:{bucket['slug']}")
                continue

            card = await _generate_one(
                bucket,
                client_type=client_type,
                country_code=country_code,
                city=city,
                gender=g
            )
            if not card:
                continue

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
                "model": settings.DEFAULT_STYLIST_MODEL,
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
            results.append(doc)

    logger.info(
        "Trend-Scout run complete: generated=%d, skipped=%d, country_code=%s, genders=%s",
        len(results),
        len(skipped),
        country_code,
        target_genders
    )
    return {
        "generated": [{k: v for k, v in r.items() if k != "_id"} for r in results],
        "skipped": skipped,
        "date": today,
    }


async def monthly_trend_scout_refresh() -> dict[str, Any]:
    """Monthly scheduled refresh executed at midnight UTC on the 1st of every month.

    Refreshes both Men's and Women's Fashion Ecosystems with authentic real-time data
    for primary target locations.
    """
    logger.info("Starting monthly Trend Scout refresh on the 1st of the month at 00:00 UTC...")
    results = {}
    for country in ["IL", "US", "GB", "FR"]:
        for g in ["female", "male"]:
            try:
                res = await run_trend_scout(force=True, country_code=country, gender=g)
                results[f"{country}_{g}"] = len(res.get("generated") or [])
            except Exception as exc:  # noqa: BLE001
                logger.warning("Monthly Trend Scout refresh failed for %s (%s): %s", country, g, exc)
    return results


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

    # Fallback to seed cards if database is still missing some buckets
    if len(out) < len(active_buckets):
        existing_slugs = {c["bucket"] for c in out}
        for seed in CANONICAL_SEED_CARDS:
            if seed["gender"] == gender and seed["bucket"] not in existing_slugs:
                out.append(seed)
                existing_slugs.add(seed["bucket"])

    return [_ensure_card_image(dict(c)) for c in out]


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

    country = country.upper() if country else None

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

    # If canon is empty, fill with canonical seeds
    if not canon:
        canon = [s for s in CANONICAL_SEED_CARDS if s.get("gender") == target_gender]

    if user is not None:
        canon = rank_cards_for_user(canon, user)
    canon = canon[:limit]

    if language == "en":
        return [_ensure_card_image(dict(c)) for c in canon]

    # On-demand translation with regionalization
    out: list[dict[str, Any]] = []
    for card in canon:
        canon_id = card.get("id")
        if not canon_id:
            out.append(_ensure_card_image(dict(card)))
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
                out.append(_ensure_card_image(dict(cached)))
                continue
            translated = await _translate_card(
                card, language=language, country=country
            )
            if translated:
                try:
                    await db.trend_reports.insert_one(
                        {**translated, "_origin": canon_id}
                    )
                except Exception:
                    pass
                out.append(_ensure_card_image({k: v for k, v in translated.items() if k != "_id"}))
            else:
                out.append(_ensure_card_image(dict(card)))
        except Exception as exc:
            logger.warning("fashion_scout_feed translation failure: %s", exc)
            out.append(_ensure_card_image(dict(card)))
    return out


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
        f"You localise DressApp fashion-scout cards into {lang_name}. Keep"
        " the editorial voice crisp and factual. Preserve factual claims; only adapt idioms and examples."
        f"{country_clause}"
        " Return ONLY a JSON object with keys: headline, body, tag, source_name, source_url, image_url, video_url."
        " Preserve URLs verbatim. Tag remains short, uppercase in target language."
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
    except Exception as exc:
        logger.warning("Translate scout card failed (%s -> %s): %s", card.get("id"), language, exc)
        return None

    parsed = _extract_json(raw or "")
    if not parsed.get("headline") or not parsed.get("body"):
        return None

    return {
        "id": str(uuid.uuid4()),
        "origin_id": card["id"],
        "bucket": card["bucket"],
        "bucket_label": card.get("bucket_label"),
        "gender": card.get("gender"),
        "date": card.get("date"),
        "headline": str(parsed["headline"])[:140],
        "body": str(parsed["body"])[:400],
        "tag": (parsed.get("tag") or card.get("tag") or "").upper()[:40],
        "source_name": (parsed.get("source_name") or card.get("source_name"))[:80] if (parsed.get("source_name") or card.get("source_name")) else None,
        "source_url": _clean_url(parsed.get("source_url")) or card.get("source_url"),
        "image_url": _clean_url(parsed.get("image_url")) or card.get("image_url") or _get_fallback_image(card.get("bucket"), card.get("gender")),
        "video_url": _clean_url(parsed.get("video_url")) or card.get("video_url"),
        "language": language,
        "country_code": (country or "").upper() or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

