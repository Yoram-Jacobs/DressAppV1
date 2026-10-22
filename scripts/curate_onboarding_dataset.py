#!/usr/bin/env python3
"""
scripts/curate_onboarding_dataset.py

Curates the 48-item Men's & Women's Static Onboarding Dataset (24 Women's + 24 Men's)
directly from DressApp's 5,000-item Gemini 2.5 Flash Ground-Truth Distilled Dataset
(`dataset_distilled/curated_distilled_5k.jsonl` + `dataset_distilled/images/`) and
the Curated Cultural SFT Dataset (`inference-server/eyes/training/curated_cultural_sft_dataset.jsonl`).

Outputs:
  1. Static studio-cutout garment images in `apps/web/public/assets/onboarding/{item_id}.jpg`
  2. Pre-cataloged dataset module in `apps/web/src/lib/onboardingDataset.js`

Usage:
  python scripts/curate_onboarding_dataset.py
  python scripts/curate_onboarding_dataset.py --verify
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tarfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parent.parent
DISTILLED_TAR = REPO_ROOT / "dataset_distilled.tar.gz"
DISTILLED_DIR = REPO_ROOT / "dataset_distilled"
DISTILLED_JSONL = DISTILLED_DIR / "curated_distilled_5k.jsonl"
CULTURAL_JSONL = REPO_ROOT / "inference-server" / "eyes" / "training" / "curated_cultural_sft_dataset.jsonl"

PUBLIC_ASSETS_DIR = REPO_ROOT / "apps" / "web" / "public" / "assets" / "onboarding"
OUTPUT_JS_PATH = REPO_ROOT / "apps" / "web" / "src" / "lib" / "onboardingDataset.js"


# ─────────────────────────────────────────────────────────────────────────────
# 48 Curated Target Archetypes (24 Women's + 24 Men's)
# Sourced from `dataset_distilled/curated_distilled_5k.jsonl` and `curated_cultural_sft_dataset.jsonl`
# ─────────────────────────────────────────────────────────────────────────────

CURATED_SPECS: list[dict[str, Any]] = [
    # =========================================================================
    # WOMEN'S COLLECTION (24 Items across 6 Silhouette Families)
    # =========================================================================
    # 1. Full-Body Cultural, Modest & One-Piece (6 items)
    {
        "onboarding_id": "w_abaya_black",
        "source_id": "ashraq_55789",
        "sex": "female",
        "silhouette_group": "full_body",
        "title_en": "Black Embroidered Modest Abaya",
        "caption_en": "Flowing black modest abaya with delicate floral embroidery along the sleeves.",
        "category": "Full Body",
        "sub_category": "Abaya",
        "item_type": "Embroidered Abaya",
        "dress_code": "formal",
        "conservativeness": "high",
        "aesthetics": ["modest", "traditional", "classic", "minimalist"],
        "hex_color": "#1C1C22",
        "english_colors": [{"name": "Black", "pct": 90}, {"name": "Silver", "pct": 10}],
        "english_materials": [{"name": "Nida Polyester", "pct": 100}],
    },
    {
        "onboarding_id": "w_kaftan_emerald",
        "source_id": "cultural:emerald_moroccan_kaftan",
        "sex": "female",
        "silhouette_group": "full_body",
        "title_en": "Emerald Moroccan Kaftan",
        "caption_en": "Emerald green silk velvet kaftan embroidered with handmade gold sfifa.",
        "category": "Full Body",
        "sub_category": "Kaftan",
        "item_type": "Moroccan Kaftan",
        "dress_code": "formal",
        "conservativeness": "high",
        "aesthetics": ["modest", "traditional", "classic", "boho"],
        "hex_color": "#145F37",
        "english_colors": [{"name": "Emerald Green", "pct": 80}, {"name": "Gold", "pct": 20}],
        "english_materials": [{"name": "Silk Velvet", "pct": 85}, {"name": "Gold Zari", "pct": 15}],
    },
    {
        "onboarding_id": "w_jalabiya_kurta_set",
        "source_id": "ashraq_50386",
        "sex": "female",
        "silhouette_group": "full_body",
        "title_en": "White Embroidered Jalabiya & Kurta Set",
        "caption_en": "Breathable white cotton-silk longline kurta and printed loose trousers set.",
        "category": "Full Body",
        "sub_category": "Kurta Set",
        "item_type": "Jalabiya / Kurta Set",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["modest", "traditional", "relaxed"],
        "hex_color": "#F5F3EE",
        "english_colors": [{"name": "White", "pct": 70}, {"name": "Coral", "pct": 30}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "w_saree_maroon",
        "source_id": "ashraq_49926",
        "sex": "female",
        "silhouette_group": "full_body",
        "title_en": "Maroon Banarasi Silk Saree",
        "caption_en": "Traditional maroon woven silk saree with ornate gold border.",
        "category": "Full Body",
        "sub_category": "Saree",
        "item_type": "Traditional Silk Saree",
        "dress_code": "formal",
        "conservativeness": "high",
        "aesthetics": ["traditional", "classic", "modest"],
        "hex_color": "#6E1926",
        "english_colors": [{"name": "Maroon", "pct": 80}, {"name": "Gold", "pct": 20}],
        "english_materials": [{"name": "Silk", "pct": 100}],
    },
    {
        "onboarding_id": "w_dress_sheath_black",
        "source_id": "ashraq_59982",
        "sex": "female",
        "silhouette_group": "full_body",
        "title_en": "Tailored Black & White Sheath Dress",
        "caption_en": "Structured knee-length sheath dress with contrast white neckline trim.",
        "category": "Full Body",
        "sub_category": "Dress",
        "item_type": "Sheath Dress",
        "dress_code": "business",
        "conservativeness": "moderate",
        "aesthetics": ["business", "classic", "minimalist", "smart_casual"],
        "hex_color": "#23252A",
        "english_colors": [{"name": "Black", "pct": 85}, {"name": "White", "pct": 15}],
        "english_materials": [{"name": "Polyester Blend", "pct": 100}],
    },
    {
        "onboarding_id": "w_jumpsuit_black",
        "source_id": "ashraq_57078",
        "sex": "female",
        "silhouette_group": "full_body",
        "title_en": "Tailored Black Wide-Leg Jumpsuit",
        "caption_en": "Sleek full-length black tailored jumpsuit for effortless evening or smart-casual wear.",
        "category": "Full Body",
        "sub_category": "Jumpsuit",
        "item_type": "Wide-Leg Jumpsuit",
        "dress_code": "smart-casual",
        "conservativeness": "moderate",
        "aesthetics": ["minimalist", "smart_casual", "classic"],
        "hex_color": "#1E2024",
        "english_colors": [{"name": "Black", "pct": 100}],
        "english_materials": [{"name": "Crepe Polyester", "pct": 100}],
    },

    # 2. Skirts (3 items)
    {
        "onboarding_id": "w_skirt_pleated_midi",
        "source_id": "ashraq_10366",
        "sex": "female",
        "silhouette_group": "skirts",
        "title_en": "Black Pleated Modest Midi Skirt",
        "caption_en": "Flowing black pleated midi skirt with modest below-the-knee drape.",
        "category": "Bottom",
        "sub_category": "Skirt",
        "item_type": "Pleated Midi Skirt",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["modest", "classic", "minimalist", "dresses_skirts"],
        "hex_color": "#202226",
        "english_colors": [{"name": "Black", "pct": 100}],
        "english_materials": [{"name": "Polyester Crepe", "pct": 100}],
    },
    {
        "onboarding_id": "w_skirt_aline_grey",
        "source_id": "ashraq_10351",
        "sex": "female",
        "silhouette_group": "skirts",
        "title_en": "Charcoal A-Line Business Midi Skirt",
        "caption_en": "Tailored charcoal grey A-line midi skirt ideal for office and smart-casual styling.",
        "category": "Bottom",
        "sub_category": "Skirt",
        "item_type": "A-Line Midi Skirt",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "classic", "modest", "dresses_skirts"],
        "hex_color": "#5E6268",
        "english_colors": [{"name": "Charcoal Grey", "pct": 100}],
        "english_materials": [{"name": "Cotton Blend", "pct": 100}],
    },
    {
        "onboarding_id": "w_skirt_denim_pleated",
        "source_id": "ashraq_29171",
        "sex": "female",
        "silhouette_group": "skirts",
        "title_en": "Dark Indigo Pleated Denim Skirt",
        "caption_en": "Classic dark indigo pleated denim skirt with versatile casual structure.",
        "category": "Bottom",
        "sub_category": "Skirt",
        "item_type": "Pleated Denim Skirt",
        "dress_code": "casual",
        "conservativeness": "moderate",
        "aesthetics": ["dresses_skirts", "smart_casual", "streetwear"],
        "hex_color": "#273A5A",
        "english_colors": [{"name": "Dark Blue", "pct": 100}],
        "english_materials": [{"name": "Denim Cotton", "pct": 100}],
    },

    # 3. Trousers & Loose Pants (4 items)
    {
        "onboarding_id": "w_trousers_tailored_grey",
        "source_id": "ashraq_26372",
        "sex": "female",
        "silhouette_group": "trousers",
        "title_en": "Tailored Slate Business Trousers",
        "caption_en": "High-waisted tailored slate grey trousers with clean straight leg.",
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Tailored Trousers",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "minimalist", "classic"],
        "hex_color": "#64686E",
        "english_colors": [{"name": "Grey", "pct": 100}],
        "english_materials": [{"name": "Cotton Blend", "pct": 100}],
    },
    {
        "onboarding_id": "w_pants_loose_olive",
        "source_id": "ashraq_35941",
        "sex": "female",
        "silhouette_group": "trousers",
        "title_en": "Loose Wide-Leg Forest Linen Pants",
        "caption_en": "Relaxed wide-leg forest green draped trousers for breathable modest comfort.",
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Wide-Leg Loose Pants",
        "dress_code": "casual",
        "conservativeness": "high",
        "aesthetics": ["relaxed", "modest", "boho", "minimalist"],
        "hex_color": "#294636",
        "english_colors": [{"name": "Dark Green", "pct": 100}],
        "english_materials": [{"name": "Viscose Linen", "pct": 100}],
    },
    {
        "onboarding_id": "w_chinos_beige",
        "source_id": "ashraq_27906",
        "sex": "female",
        "silhouette_group": "trousers",
        "title_en": "Warm Sand Smart-Casual Chinos",
        "caption_en": "Versatile beige cotton chinos with clean tailored ankle silhouette.",
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Chinos",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["smart_casual", "minimalist", "classic"],
        "hex_color": "#C8B69E",
        "english_colors": [{"name": "Beige", "pct": 100}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "w_jeans_blue",
        "source_id": "ashraq_51366",
        "sex": "female",
        "silhouette_group": "trousers",
        "title_en": "Classic Indigo Straight Denim Jeans",
        "caption_en": "Everyday mid-wash blue straight denim jeans with classic five-pocket styling.",
        "category": "Bottom",
        "sub_category": "Jeans",
        "item_type": "Straight Jeans",
        "dress_code": "casual",
        "conservativeness": "moderate",
        "aesthetics": ["smart_casual", "streetwear", "minimalist"],
        "hex_color": "#3B597A",
        "english_colors": [{"name": "Blue", "pct": 100}],
        "english_materials": [{"name": "Denim", "pct": 100}],
    },

    # 4. Tops, Blouses & Loose Tunics (4 items)
    {
        "onboarding_id": "w_tunic_mandarin_green",
        "source_id": "ashraq_31890",
        "sex": "female",
        "silhouette_group": "tops",
        "title_en": "Loose Mandarin-Collar Longline Tunic",
        "caption_en": "Breathable emerald-green longline cotton tunic with standing mandarin collar.",
        "category": "Top",
        "sub_category": "Tunic",
        "item_type": "Mandarin Collar Tunic",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["modest", "relaxed", "traditional", "smart_casual"],
        "hex_color": "#2E6F56",
        "english_colors": [{"name": "Green", "pct": 90}, {"name": "Blue", "pct": 10}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "w_shirt_buttondown_striped",
        "source_id": "ashraq_32395",
        "sex": "female",
        "silhouette_group": "tops",
        "title_en": "Crisp Tailored Button-Down Shirt",
        "caption_en": "Classic tailored button-down poplin shirt for business and smart-casual layering.",
        "category": "Top",
        "sub_category": "Shirt",
        "item_type": "Button-Down Shirt",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "classic", "minimalist", "smart_casual"],
        "hex_color": "#D8DCE2",
        "english_colors": [{"name": "Light Grey", "pct": 85}, {"name": "White", "pct": 15}],
        "english_materials": [{"name": "Cotton Poplin", "pct": 100}],
    },
    {
        "onboarding_id": "w_blouse_stand_collar",
        "source_id": "ashraq_23150",
        "sex": "female",
        "silhouette_group": "tops",
        "title_en": "High-Neck Modest Crepe Blouse",
        "caption_en": "Elegant stand-collar modest blouse with gathered neckline and soft drape.",
        "category": "Top",
        "sub_category": "Blouse",
        "item_type": "Stand Collar Blouse",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["modest", "business", "classic", "dresses_skirts"],
        "hex_color": "#5C3A6B",
        "english_colors": [{"name": "Plum Purple", "pct": 100}],
        "english_materials": [{"name": "Polyester Crepe", "pct": 100}],
    },
    {
        "onboarding_id": "w_top_white_longsleeve",
        "source_id": "ashraq_10003",
        "sex": "female",
        "silhouette_group": "tops",
        "title_en": "Essential Crisp White Long-Sleeve Top",
        "caption_en": "Clean white long-sleeve essential top that pairs effortlessly under blazers or solo.",
        "category": "Top",
        "sub_category": "T-Shirt",
        "item_type": "Long-Sleeve Top",
        "dress_code": "casual",
        "conservativeness": "high",
        "aesthetics": ["minimalist", "relaxed", "smart_casual", "streetwear"],
        "hex_color": "#F4F5F7",
        "english_colors": [{"name": "White", "pct": 100}],
        "english_materials": [{"name": "Cotton Jersey", "pct": 100}],
    },
    {
        "onboarding_id": "w_tshirt_white_crew",
        "source_id": "hf_fashion_900x1200:59403",
        "sex": "female",
        "silhouette_group": "tops",
        "title_en": "Classic White Cotton Crew-Neck T-Shirt",
        "caption_en": "Breathable pure cotton white crew-neck t-shirt for effortless everyday layering.",
        "category": "Top",
        "sub_category": "T-Shirt",
        "item_type": "Crew-Neck T-Shirt",
        "dress_code": "casual",
        "conservativeness": "moderate",
        "aesthetics": ["minimalist", "relaxed", "smart_casual", "streetwear"],
        "hex_color": "#F6F7F9",
        "english_colors": [{"name": "White", "pct": 100}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "w_tshirt_black_fitted",
        "source_id": "hf_fashion_900x1200:2078",
        "sex": "female",
        "silhouette_group": "tops",
        "title_en": "Essential Black Fitted Cotton T-Shirt",
        "caption_en": "Sleek black fitted short-sleeve cotton t-shirt that pairs cleanly with jeans, skirts, or blazers.",
        "category": "Top",
        "sub_category": "T-Shirt",
        "item_type": "Fitted Crew-Neck T-Shirt",
        "dress_code": "casual",
        "conservativeness": "moderate",
        "aesthetics": ["minimalist", "smart_casual", "streetwear", "classic"],
        "hex_color": "#1E2024",
        "english_colors": [{"name": "Black", "pct": 100}],
        "english_materials": [{"name": "Cotton Jersey", "pct": 100}],
    },

    # 5. Business Suits & Outerwear (3 items)
    {
        "onboarding_id": "w_blazer_suit_black",
        "source_id": "ashraq_6886",
        "sex": "female",
        "silhouette_group": "outerwear",
        "title_en": "Tailored Single-Breasted Business Suit Blazer",
        "caption_en": "Sharp black single-breasted suit blazer with structured lapels.",
        "category": "Outerwear",
        "sub_category": "Blazer",
        "item_type": "Single-Breasted Suit Blazer",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "classic", "minimalist"],
        "hex_color": "#1E2025",
        "english_colors": [{"name": "Black", "pct": 100}],
        "english_materials": [{"name": "Wool Blend", "pct": 100}],
    },
    {
        "onboarding_id": "w_trench_coat_cream",
        "source_id": "ashraq_6889",
        "sex": "female",
        "silhouette_group": "outerwear",
        "title_en": "Classic Belted Cream Trench Coat",
        "caption_en": "Timeless double-breasted cream trench coat for polished all-weather layering.",
        "category": "Outerwear",
        "sub_category": "Trench Coat",
        "item_type": "Belted Trench Coat",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["classic", "business", "modest", "minimalist"],
        "hex_color": "#EAE2D3",
        "english_colors": [{"name": "Cream", "pct": 100}],
        "english_materials": [{"name": "Cotton Gabardine", "pct": 100}],
    },
    {
        "onboarding_id": "w_cardigan_long_black",
        "source_id": "ashraq_11368",
        "sex": "female",
        "silhouette_group": "outerwear",
        "title_en": "Longline Open-Front Modest Cardigan",
        "caption_en": "Soft black longline open-front knit cardigan for relaxed modest layering.",
        "category": "Outerwear",
        "sub_category": "Cardigan",
        "item_type": "Longline Open Cardigan",
        "dress_code": "casual",
        "conservativeness": "high",
        "aesthetics": ["modest", "relaxed", "minimalist"],
        "hex_color": "#24262B",
        "english_colors": [{"name": "Black", "pct": 100}],
        "english_materials": [{"name": "Cotton Knit", "pct": 100}],
    },

    # 6. Footwear (4 items)
    {
        "onboarding_id": "w_sneakers_white_navy",
        "source_id": "ashraq_1786",
        "sex": "female",
        "silhouette_group": "footwear",
        "title_en": "Clean White & Navy Low-Top Sneakers",
        "caption_en": "Crisp white leather sneakers with subtle navy trim for everyday versatility.",
        "category": "Footwear",
        "sub_category": "Sneakers",
        "item_type": "Low-Top Sneakers",
        "dress_code": "casual",
        "conservativeness": "high",
        "aesthetics": ["minimalist", "smart_casual", "relaxed", "streetwear"],
        "hex_color": "#F2F4F8",
        "english_colors": [{"name": "White", "pct": 85}, {"name": "Navy", "pct": 15}],
        "english_materials": [{"name": "Leather", "pct": 100}],
    },
    {
        "onboarding_id": "w_heels_pumps_black",
        "source_id": "ashraq_15490",
        "sex": "female",
        "silhouette_group": "footwear",
        "title_en": "Classic Black Closed-Toe Court Heels",
        "caption_en": "Timeless black closed-toe pumps suited for business suits, dresses, and formal wear.",
        "category": "Footwear",
        "sub_category": "Heels",
        "item_type": "Closed-Toe Court Pumps",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "classic", "dresses_skirts", "modest"],
        "hex_color": "#1C1D21",
        "english_colors": [{"name": "Black", "pct": 100}],
        "english_materials": [{"name": "Leather", "pct": 100}],
    },
    {
        "onboarding_id": "w_loafers_black",
        "source_id": "ashraq_17963",
        "sex": "female",
        "silhouette_group": "footwear",
        "title_en": "Polished Black Pointed-Toe Loafers",
        "caption_en": "Sleek black slip-on loafers combining tailored polish with all-day comfort.",
        "category": "Footwear",
        "sub_category": "Loafers",
        "item_type": "Pointed-Toe Loafers",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["business", "minimalist", "smart_casual", "classic"],
        "hex_color": "#222428",
        "english_colors": [{"name": "Black", "pct": 95}, {"name": "Pink", "pct": 5}],
        "english_materials": [{"name": "Synthetic Leather", "pct": 100}],
    },
    {
        "onboarding_id": "w_sandals_wedge_black",
        "source_id": "ashraq_47591",
        "sex": "female",
        "silhouette_group": "footwear",
        "title_en": "Minimalist Black Wedge Sandals",
        "caption_en": "Comfortable black wedge sandals ideal for warm weather, kaftans, and maxi skirts.",
        "category": "Footwear",
        "sub_category": "Sandals",
        "item_type": "Wedge Sandals",
        "dress_code": "casual",
        "conservativeness": "moderate",
        "aesthetics": ["traditional", "modest", "relaxed", "boho"],
        "hex_color": "#26282C",
        "english_colors": [{"name": "Black", "pct": 100}],
        "english_materials": [{"name": "Synthetic", "pct": 100}],
    },

    # =========================================================================
    # MEN'S COLLECTION (24 Items across 5 Silhouette Families)
    # =========================================================================
    # 1. Full-Body Traditional, Cultural Tunics & Complete Suits (5 items)
    {
        "onboarding_id": "m_thobe_white",
        "source_id": "cultural:saudi_white_thobe",
        "sex": "male",
        "silhouette_group": "full_body",
        "title_en": "Crisp White Formal Thobe (Dishdasha)",
        "caption_en": "Ankle-length crisp white formal thobe with structured standing collar and placket.",
        "category": "Full Body",
        "sub_category": "Thobe",
        "item_type": "Formal Thobe / Kandura",
        "dress_code": "formal",
        "conservativeness": "high",
        "aesthetics": ["traditional", "modest", "classic"],
        "hex_color": "#FAFAFC",
        "english_colors": [{"name": "White", "pct": 100}],
        "english_materials": [{"name": "Cotton Blend", "pct": 100}],
    },
    {
        "onboarding_id": "m_kurta_set_festive",
        "source_id": "ashraq_30733",
        "sex": "male",
        "silhouette_group": "full_body",
        "title_en": "Traditional Embroidered Kurta & Pyjama Set",
        "caption_en": "Complete traditional longline kurta and matching tapered pyjama trousers ensemble.",
        "category": "Full Body",
        "sub_category": "Kurta Set",
        "item_type": "Kurta Pyjama Set",
        "dress_code": "formal",
        "conservativeness": "high",
        "aesthetics": ["traditional", "modest", "classic"],
        "hex_color": "#8C242B",
        "english_colors": [{"name": "Crimson Red", "pct": 85}, {"name": "Gold", "pct": 15}],
        "english_materials": [{"name": "Dupioni Silk", "pct": 100}],
    },
    {
        "onboarding_id": "m_suit_navy_three_piece",
        "source_id": "df_MEN_Jackets_Vests_id_00001875_03_1_front",
        "sex": "male",
        "silhouette_group": "full_body",
        "title_en": "Tailored Navy Business Suit Ensemble",
        "caption_en": "Complete tailored navy wool business suit with structured lapels and dress trousers.",
        "category": "Full Body",
        "sub_category": "Suit",
        "item_type": "Tailored Business Suit",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "classic", "minimalist"],
        "hex_color": "#1E2B44",
        "english_colors": [{"name": "Navy Blue", "pct": 90}, {"name": "White", "pct": 10}],
        "english_materials": [{"name": "Wool", "pct": 100}],
    },
    {
        "onboarding_id": "m_kurta_lightblue",
        "source_id": "ashraq_56689",
        "sex": "male",
        "silhouette_group": "tops",
        "title_en": "Relaxed Sky-Blue Cotton Kurta Tunic",
        "caption_en": "Breathable sky-blue straight-cut cotton kurta tunic with mandarin collar.",
        "category": "Top",
        "sub_category": "Kurta",
        "item_type": "Longline Kurta Tunic",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["traditional", "relaxed", "modest"],
        "hex_color": "#8BB8D6",
        "english_colors": [{"name": "Light Blue", "pct": 100}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "m_guayabera_linen",
        "source_id": "cultural:linen_guayabera_shirt",
        "sex": "male",
        "silhouette_group": "tops",
        "title_en": "White 4-Pocket Pleated Linen Guayabera",
        "caption_en": "Formal white 100% linen guayabera featuring four pockets and vertical alforza pleats.",
        "category": "Top",
        "sub_category": "Guayabera",
        "item_type": "Pleated Linen Guayabera",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["traditional", "relaxed", "classic", "smart_casual"],
        "hex_color": "#F3F3EE",
        "english_colors": [{"name": "White", "pct": 100}],
        "english_materials": [{"name": "Linen", "pct": 100}],
    },

    # 2. Business Suit Jackets, Cultural Coats & Outerwear (5 items)
    {
        "onboarding_id": "m_blazer_suit_charcoal",
        "source_id": "df_MEN_Jackets_Vests_id_00001875_01_2_side",
        "sex": "male",
        "silhouette_group": "outerwear",
        "title_en": "Dark Charcoal Single-Breasted Suit Jacket",
        "caption_en": "Sharp dark charcoal single-breasted suit blazer for executive and formal styling.",
        "category": "Outerwear",
        "sub_category": "Blazer",
        "item_type": "Single-Breasted Suit Jacket",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "classic", "minimalist"],
        "hex_color": "#36393F",
        "english_colors": [{"name": "Dark Grey", "pct": 100}],
        "english_materials": [{"name": "Wool Blend", "pct": 100}],
    },
    {
        "onboarding_id": "m_blazer_smart_lightblue",
        "source_id": "ashraq_31729",
        "sex": "male",
        "silhouette_group": "outerwear",
        "title_en": "Unstructured Slate-Blue Smart Blazer",
        "caption_en": "Lightweight tailored slate-blue blazer that pairs effortlessly with chinos or jeans.",
        "category": "Outerwear",
        "sub_category": "Blazer",
        "item_type": "Unstructured Smart Blazer",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["smart_casual", "business", "classic"],
        "hex_color": "#6F8FAF",
        "english_colors": [{"name": "Light Blue", "pct": 100}],
        "english_materials": [{"name": "Cotton Linen", "pct": 100}],
    },
    {
        "onboarding_id": "m_nehru_waistcoat_black",
        "source_id": "ashraq_30739",
        "sex": "male",
        "silhouette_group": "outerwear",
        "title_en": "Black Mandarin-Collar Bandhgala Waistcoat",
        "caption_en": "Structured black standing-collar Nehru waistcoat for layering over kurtas or dress shirts.",
        "category": "Outerwear",
        "sub_category": "Waistcoat",
        "item_type": "Nehru Collar Waistcoat",
        "dress_code": "formal",
        "conservativeness": "high",
        "aesthetics": ["traditional", "business", "classic", "modest"],
        "hex_color": "#1E2024",
        "english_colors": [{"name": "Black", "pct": 100}],
        "english_materials": [{"name": "Silk Wool Blend", "pct": 100}],
    },
    {
        "onboarding_id": "m_achkan_royal_blue",
        "source_id": "cultural:blue_silk_achkan",
        "sex": "male",
        "silhouette_group": "outerwear",
        "title_en": "Royal Blue Silk Achkan / Sherwani Coat",
        "caption_en": "Knee-length royal blue raw silk achkan with standing mandarin collar and button placket.",
        "category": "Outerwear",
        "sub_category": "Achkan",
        "item_type": "Ceremonial Achkan Coat",
        "dress_code": "formal",
        "conservativeness": "high",
        "aesthetics": ["traditional", "modest", "classic"],
        "hex_color": "#192D73",
        "english_colors": [{"name": "Royal Blue", "pct": 95}, {"name": "Gold", "pct": 5}],
        "english_materials": [{"name": "Raw Silk", "pct": 100}],
    },
    {
        "onboarding_id": "m_trench_coat_khaki",
        "source_id": "df_MEN_Jackets_Vests_id_00005943_08_1_front",
        "sex": "male",
        "silhouette_group": "outerwear",
        "title_en": "Classic Khaki Double-Breasted Trench Coat",
        "caption_en": "Structured khaki double-breasted overcoat for timeless cold-weather layering.",
        "category": "Outerwear",
        "sub_category": "Trench Coat",
        "item_type": "Double-Breasted Overcoat",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["classic", "business", "minimalist"],
        "hex_color": "#C2B092",
        "english_colors": [{"name": "Khaki", "pct": 100}],
        "english_materials": [{"name": "Cotton Gabardine", "pct": 100}],
    },

    # 3. Shirts, Tops & Loose Layers (5 items)
    {
        "onboarding_id": "m_shirt_dress_grey",
        "source_id": "ashraq_9427",
        "sex": "male",
        "silhouette_group": "tops",
        "title_en": "Crisp Tailored Long-Sleeve Dress Shirt",
        "caption_en": "Refined long-sleeve button-down dress shirt ideal for suits and office wear.",
        "category": "Top",
        "sub_category": "Shirt",
        "item_type": "Long-Sleeve Dress Shirt",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "classic", "smart_casual", "minimalist"],
        "hex_color": "#CFD4DC",
        "english_colors": [{"name": "Light Grey", "pct": 100}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "m_shirt_relaxed_white",
        "source_id": "ashraq_10788",
        "sex": "male",
        "silhouette_group": "tops",
        "title_en": "Relaxed White Linen-Cotton Camp Shirt",
        "caption_en": "Breathable loose-fit white woven button-down shirt for warm weather and casual layering.",
        "category": "Top",
        "sub_category": "Shirt",
        "item_type": "Relaxed Short-Sleeve Shirt",
        "dress_code": "smart-casual",
        "conservativeness": "moderate",
        "aesthetics": ["relaxed", "smart_casual", "minimalist"],
        "hex_color": "#F1F2F4",
        "english_colors": [{"name": "White", "pct": 85}, {"name": "Grey", "pct": 15}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "m_sweater_shawl_knit",
        "source_id": "ashraq_18312",
        "sex": "male",
        "silhouette_group": "tops",
        "title_en": "Fine-Knit Shawl-Collar Pullover Sweater",
        "caption_en": "Warm structured shawl-collar knit sweater for smart-casual autumn and winter days.",
        "category": "Top",
        "sub_category": "Sweater",
        "item_type": "Shawl Collar Sweater",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["classic", "smart_casual", "minimalist"],
        "hex_color": "#4A4E58",
        "english_colors": [{"name": "Charcoal", "pct": 70}, {"name": "Light Grey", "pct": 30}],
        "english_materials": [{"name": "Cotton Wool Knit", "pct": 100}],
    },
    {
        "onboarding_id": "m_polo_white",
        "source_id": "ashraq_2493",
        "sex": "male",
        "silhouette_group": "tops",
        "title_en": "Classic Crisp White Piqué Polo Shirt",
        "caption_en": "Timeless white piqué cotton polo shirt bridging casual comfort and tailored polish.",
        "category": "Top",
        "sub_category": "Polo Shirt",
        "item_type": "Short-Sleeve Polo Shirt",
        "dress_code": "smart-casual",
        "conservativeness": "moderate",
        "aesthetics": ["smart_casual", "classic", "minimalist"],
        "hex_color": "#F5F6F8",
        "english_colors": [{"name": "White", "pct": 100}],
        "english_materials": [{"name": "Piqué Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "m_tshirt_navy",
        "source_id": "hf_fashion_900x1200:7990",
        "sex": "male",
        "silhouette_group": "tops",
        "title_en": "Essential Navy Crew-Neck Cotton Tee",
        "caption_en": "Everyday navy 100% cotton crew-neck t-shirt with clean relaxed fit.",
        "category": "Top",
        "sub_category": "T-Shirt",
        "item_type": "Crew-Neck T-Shirt",
        "dress_code": "casual",
        "conservativeness": "moderate",
        "aesthetics": ["minimalist", "relaxed", "streetwear", "smart_casual"],
        "hex_color": "#23304A",
        "english_colors": [{"name": "Navy", "pct": 90}, {"name": "White", "pct": 10}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "m_tshirt_white_crew",
        "source_id": "hf_fashion_900x1200:20000",
        "sex": "male",
        "silhouette_group": "tops",
        "title_en": "Essential White Crew-Neck Cotton T-Shirt",
        "caption_en": "Crisp white 100% cotton crew-neck t-shirt for clean solo wear or layering under jackets.",
        "category": "Top",
        "sub_category": "T-Shirt",
        "item_type": "Crew-Neck T-Shirt",
        "dress_code": "casual",
        "conservativeness": "moderate",
        "aesthetics": ["minimalist", "relaxed", "streetwear", "smart_casual"],
        "hex_color": "#F5F6F8",
        "english_colors": [{"name": "White", "pct": 100}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "m_tshirt_black_crew",
        "source_id": "hf_fashion_900x1200:2048",
        "sex": "male",
        "silhouette_group": "tops",
        "title_en": "Classic Black Crew-Neck Cotton T-Shirt",
        "caption_en": "Timeless black pure cotton crew-neck t-shirt suited for everyday casual and streetwear looks.",
        "category": "Top",
        "sub_category": "T-Shirt",
        "item_type": "Crew-Neck T-Shirt",
        "dress_code": "casual",
        "conservativeness": "moderate",
        "aesthetics": ["minimalist", "streetwear", "relaxed", "smart_casual"],
        "hex_color": "#1D1F23",
        "english_colors": [{"name": "Black", "pct": 100}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },

    # 4. Trousers, Chinos & Loose Pants (5 items)
    {
        "onboarding_id": "m_trousers_dress_charcoal",
        "source_id": "ashraq_38983",
        "sex": "male",
        "silhouette_group": "trousers",
        "title_en": "Tailored Charcoal Straight-Leg Dress Trousers",
        "caption_en": "Sharp dark grey tailored dress trousers with crisp front crease for business and formal wear.",
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Straight-Leg Dress Pants",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "classic", "minimalist"],
        "hex_color": "#383B42",
        "english_colors": [{"name": "Dark Grey", "pct": 100}],
        "english_materials": [{"name": "Wool Blend", "pct": 100}],
    },
    {
        "onboarding_id": "m_pants_relaxed_olive",
        "source_id": "ashraq_16330",
        "sex": "male",
        "silhouette_group": "trousers",
        "title_en": "Relaxed Olive Straight-Leg Cotton Trousers",
        "caption_en": "Comfortable loose straight-leg olive trousers ideal for relaxed and modest daily wear.",
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Relaxed Straight-Leg Pants",
        "dress_code": "casual",
        "conservativeness": "high",
        "aesthetics": ["relaxed", "modest", "minimalist", "traditional"],
        "hex_color": "#555B46",
        "english_colors": [{"name": "Olive", "pct": 100}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "m_chinos_beige",
        "source_id": "ashraq_14688",
        "sex": "male",
        "silhouette_group": "trousers",
        "title_en": "Sand Beige Tailored Straight Chinos",
        "caption_en": "Classic beige cotton twill chinos that pair effortlessly with blazers, shirts, or polos.",
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Straight Chinos",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["smart_casual", "classic", "business", "minimalist"],
        "hex_color": "#D2C2A8",
        "english_colors": [{"name": "Beige", "pct": 100}],
        "english_materials": [{"name": "Cotton Twill", "pct": 100}],
    },
    {
        "onboarding_id": "m_pants_white_linen",
        "source_id": "ashraq_15084",
        "sex": "male",
        "silhouette_group": "trousers",
        "title_en": "Crisp Ivory Cotton-Linen Trousers",
        "caption_en": "Clean white/ivory tailored cotton trousers suitable for kurtas, achkans, or summer blazers.",
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Tailored Cotton Trousers",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["traditional", "classic", "smart_casual", "modest"],
        "hex_color": "#F3F2EE",
        "english_colors": [{"name": "White", "pct": 100}],
        "english_materials": [{"name": "Cotton", "pct": 100}],
    },
    {
        "onboarding_id": "m_jeans_dark_indigo",
        "source_id": "ashraq_11351",
        "sex": "male",
        "silhouette_group": "trousers",
        "title_en": "Dark Indigo Straight-Fit Denim Jeans",
        "caption_en": "Clean dark indigo straight-leg denim jeans with timeless five-pocket construction.",
        "category": "Bottom",
        "sub_category": "Jeans",
        "item_type": "Straight Jeans",
        "dress_code": "casual",
        "conservativeness": "high",
        "aesthetics": ["smart_casual", "minimalist", "streetwear", "relaxed"],
        "hex_color": "#26364F",
        "english_colors": [{"name": "Dark Blue", "pct": 100}],
        "english_materials": [{"name": "Denim", "pct": 100}],
    },

    # 5. Footwear (4 items)
    {
        "onboarding_id": "m_shoes_derby_brown",
        "source_id": "ashraq_7216",
        "sex": "male",
        "silhouette_group": "footwear",
        "title_en": "Polished Brown Leather Derby Dress Shoes",
        "caption_en": "Hand-burnished brown leather lace-up derby shoes for suits, chinos, and formal attire.",
        "category": "Footwear",
        "sub_category": "Shoes",
        "item_type": "Leather Derby Dress Shoes",
        "dress_code": "business",
        "conservativeness": "high",
        "aesthetics": ["business", "classic", "smart_casual"],
        "hex_color": "#5C3A24",
        "english_colors": [{"name": "Brown", "pct": 100}],
        "english_materials": [{"name": "Leather", "pct": 100}],
    },
    {
        "onboarding_id": "m_loafers_leather_brown",
        "source_id": "ashraq_21079",
        "sex": "male",
        "silhouette_group": "footwear",
        "title_en": "Classic Brown Leather Slip-On Loafers",
        "caption_en": "Versatile slip-on leather loafers suited for smart-casual trousers, kurtas, and thobes.",
        "category": "Footwear",
        "sub_category": "Loafers",
        "item_type": "Slip-On Leather Loafers",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["smart_casual", "traditional", "classic", "modest"],
        "hex_color": "#4E3426",
        "english_colors": [{"name": "Brown", "pct": 100}],
        "english_materials": [{"name": "Leather", "pct": 100}],
    },
    {
        "onboarding_id": "m_boots_chelsea_brown",
        "source_id": "ashraq_7384",
        "sex": "male",
        "silhouette_group": "footwear",
        "title_en": "Rich Brown Leather Chelsea Boots",
        "caption_en": "Sleek ankle-high brown leather Chelsea boots with elastic side gussets.",
        "category": "Footwear",
        "sub_category": "Boots",
        "item_type": "Chelsea Boots",
        "dress_code": "smart-casual",
        "conservativeness": "high",
        "aesthetics": ["classic", "smart_casual", "minimalist"],
        "hex_color": "#523322",
        "english_colors": [{"name": "Brown", "pct": 100}],
        "english_materials": [{"name": "Leather", "pct": 100}],
    },
    {
        "onboarding_id": "m_sneakers_navy_white",
        "source_id": "ashraq_4560",
        "sex": "male",
        "silhouette_group": "footwear",
        "title_en": "Clean Navy & White Low-Top Sneakers",
        "caption_en": "Crisp low-top leather sneakers in navy and white for everyday casual and streetwear looks.",
        "category": "Footwear",
        "sub_category": "Sneakers",
        "item_type": "Low-Top Sneakers",
        "dress_code": "casual",
        "conservativeness": "high",
        "aesthetics": ["minimalist", "streetwear", "relaxed", "smart_casual"],
        "hex_color": "#263859",
        "english_colors": [{"name": "Navy", "pct": 60}, {"name": "White", "pct": 40}],
        "english_materials": [{"name": "Leather", "pct": 100}],
    },
]


def render_cultural_studio_image(dest_path: Path, key: str) -> None:
    """Renders high-clarity 600x600 studio garment cutouts for the 4 cultural SFT items
    whose source records live in `curated_cultural_sft_dataset.jsonl`."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (600, 600), color=(248, 247, 244))
    draw = ImageDraw.Draw(img)

    if key == "emerald_moroccan_kaftan":
        rgb = (20, 95, 55)
        gold = (218, 178, 58)
        # Flowing floor-length Moroccan Kaftan with wide sleeves and gold sfifa + mdamma belt
        draw.polygon([(195, 75), (405, 75), (475, 545), (125, 545)], fill=rgb, outline=(15, 65, 38), width=3)
        draw.polygon([(195, 75), (75, 265), (130, 295), (215, 165)], fill=rgb, outline=(15, 65, 38), width=3)
        draw.polygon([(405, 75), (525, 265), (470, 295), (385, 165)], fill=rgb, outline=(15, 65, 38), width=3)
        # V-neck gold collar & vertical sfifa embroidery down to hem
        draw.polygon([(255, 75), (300, 145), (345, 75)], fill=(238, 232, 220), outline=gold, width=4)
        draw.line([(300, 145), (300, 542)], fill=gold, width=8)
        # Gold embroidered sleeve cuffs
        draw.line([(78, 263), (128, 292)], fill=gold, width=7)
        draw.line([(522, 263), (472, 292)], fill=gold, width=7)
        # Ornate gold Mdamma belt
        draw.rectangle([(212, 265), (388, 298)], fill=gold, outline=(140, 105, 20), width=3)
        draw.ellipse([(282, 262), (318, 301)], fill=(240, 205, 80), outline=(120, 85, 15), width=3)
    elif key == "saudi_white_thobe":
        rgb = (252, 252, 253)
        outline = (205, 208, 215)
        # Crisp white ankle-length Gulf Thobe / Kandura with stiff mandarin collar & placket
        draw.polygon([(195, 80), (405, 80), (445, 545), (155, 545)], fill=rgb, outline=outline, width=3)
        draw.polygon([(195, 80), (95, 295), (145, 315), (215, 165)], fill=rgb, outline=outline, width=3)
        draw.polygon([(405, 80), (505, 295), (455, 315), (385, 165)], fill=rgb, outline=outline, width=3)
        # Standing collar
        draw.rectangle([(252, 56), (348, 84)], fill=rgb, outline=(180, 184, 192), width=3)
        # Concealed chest placket
        draw.rectangle([(288, 84), (312, 225)], fill=(247, 248, 250), outline=(190, 194, 202), width=2)
        for y in (110, 145, 180, 210):
            draw.ellipse([(296, y), (304, y + 8)], fill=(220, 224, 230), outline=(170, 175, 182))
        # Breast pocket
        draw.rectangle([(215, 155), (262, 205)], outline=(195, 198, 206), width=2)
    elif key == "blue_silk_achkan":
        rgb = (25, 45, 115)
        gold = (218, 180, 55)
        # Royal blue raw silk knee-length Achkan coat with standing Nehru collar & gold buttons
        draw.polygon([(190, 80), (410, 80), (440, 510), (160, 510)], fill=rgb, outline=(15, 28, 75), width=3)
        draw.polygon([(190, 80), (90, 285), (140, 305), (215, 165)], fill=rgb, outline=(15, 28, 75), width=3)
        draw.polygon([(410, 80), (510, 285), (460, 305), (385, 165)], fill=rgb, outline=(15, 28, 75), width=3)
        draw.rectangle([(250, 54), (350, 82)], fill=rgb, outline=gold, width=3)
        draw.line([(300, 82), (300, 508)], fill=(15, 25, 68), width=4)
        for y in range(102, 480, 38):
            draw.ellipse([(293, y), (307, y + 14)], fill=gold, outline=(120, 95, 20), width=2)
        # Pocket square
        draw.line([(212, 165), (260, 165)], fill=gold, width=3)
        draw.polygon([(222, 165), (236, 144), (250, 165)], fill=gold)
    elif key == "linen_guayabera_shirt":
        rgb = (244, 242, 236)
        outline = (195, 190, 180)
        # White 4-pocket pleated linen Guayabera shirt
        draw.polygon([(185, 85), (415, 85), (425, 470), (175, 470)], fill=rgb, outline=outline, width=3)
        draw.polygon([(185, 85), (90, 230), (145, 255), (205, 160)], fill=rgb, outline=outline, width=3)
        draw.polygon([(415, 85), (510, 230), (455, 255), (395, 160)], fill=rgb, outline=outline, width=3)
        # Camp collar
        draw.polygon([(245, 62), (355, 62), (335, 110), (265, 110)], fill=rgb, outline=outline, width=3)
        # Vertical alforza pleats
        for x in (232, 240, 248, 352, 360, 368):
            draw.line([(x, 90), (x, 465)], fill=(210, 206, 198), width=2)
        # 4 buttoned pockets
        for px, py in ((205, 165), (335, 165), (205, 345), (335, 345)):
            draw.rectangle([(px, py), (px + 60, py + 68)], fill=rgb, outline=outline, width=2)
            draw.ellipse([(px + 27, py + 8), (px + 33, py + 14)], fill=(180, 175, 165))
        # Center placket
        draw.line([(300, 110), (300, 468)], fill=outline, width=3)

    img.save(dest_path, "JPEG", quality=90, optimize=True)


def ensure_distilled_dataset_unpacked() -> None:
    if not DISTILLED_JSONL.exists():
        if not DISTILLED_TAR.exists():
            raise FileNotFoundError(f"Missing {DISTILLED_TAR} and {DISTILLED_JSONL}")
        with tarfile.open(DISTILLED_TAR, "r:gz") as tar:
            tar.extractall(REPO_ROOT)


def load_source_indexes() -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    ensure_distilled_dataset_unpacked()
    distilled_by_id: dict[str, dict[str, Any]] = {}
    with open(DISTILLED_JSONL, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            distilled_by_id[rec["id"]] = rec

    cultural_by_key: dict[str, dict[str, Any]] = {}
    if CULTURAL_JSONL.exists():
        with open(CULTURAL_JSONL, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                if rec.get("type") == "attribute_parsing":
                    stem = Path(rec.get("image_path", "")).stem
                    model_msg = next(
                        (m["content"] for m in rec.get("messages", []) if m.get("role") == "model"),
                        "{}",
                    )
                    cultural_by_key[stem] = {
                        "image_path": rec.get("image_path"),
                        "ground_truth": json.loads(model_msg) if isinstance(model_msg, str) else model_msg,
                    }
    return distilled_by_id, cultural_by_key


def build_onboarding_dataset() -> list[dict[str, Any]]:
    distilled_by_id, cultural_by_key = load_source_indexes()
    PUBLIC_ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    curated_items: list[dict[str, Any]] = []

    for spec in CURATED_SPECS:
        oid = spec["onboarding_id"]
        src_id = spec["source_id"]
        dest_img_name = f"{oid}.jpg"
        dest_img_path = PUBLIC_ASSETS_DIR / dest_img_name
        public_url = f"/assets/onboarding/{dest_img_name}"

        if src_id.startswith("cultural:"):
            c_key = src_id.split(":", 1)[1]
            c_rec = cultural_by_key.get(c_key, {})
            gt = dict(c_rec.get("ground_truth") or {})
            render_cultural_studio_image(dest_img_path, c_key)
            dataset_provenance = f"curated_cultural_sft:{c_key}"
        else:
            if src_id not in distilled_by_id:
                raise KeyError(f"Source ID '{src_id}' not found in {DISTILLED_JSONL}")
            d_rec = distilled_by_id[src_id]
            gt = dict(d_rec.get("ground_truth") or {})
            src_img_path = DISTILLED_DIR / d_rec["image_path"]
            if not src_img_path.exists():
                raise FileNotFoundError(f"Source image '{src_img_path}' missing on disk")
            shutil.copy2(src_img_path, dest_img_path)
            dataset_provenance = f"curated_distilled_5k:{src_id}"

        colors = spec.get("english_colors") or gt.get("colors") or [{"name": "Neutral", "pct": 100}]
        materials = spec.get("english_materials") or gt.get("fabric_materials") or [{"name": "Cotton", "pct": 100}]
        primary_color = colors[0]["name"] if colors else "Neutral"
        primary_material = materials[0]["name"] if materials else "Cotton"
        season = gt.get("season") or ["spring", "summer", "fall", "winter"]
        if season == ["all"]:
            season = ["spring", "summer", "fall", "winter"]

        raw_tags = list(gt.get("tags") or [])
        merged_tags = ["starter_capsule"]
        for t in [*spec.get("aesthetics", []), spec["sub_category"].lower(), *raw_tags]:
            t_clean = str(t).strip().lower()
            if t_clean and t_clean not in merged_tags and t_clean.isascii():
                merged_tags.append(t_clean)

        item_record = {
            "id": oid,
            "source_dataset_id": dataset_provenance,
            "sex": spec["sex"],
            "gender": "women" if spec["sex"] == "female" else "men",
            "silhouette_group": spec["silhouette_group"],
            "name": spec["title_en"],
            "title": spec["title_en"],
            "caption": spec["caption_en"],
            "category": spec["category"],
            "sub_category": spec["sub_category"],
            "item_type": spec["item_type"],
            "dress_code": spec["dress_code"],
            "conservativeness": spec["conservativeness"],
            "aesthetics": spec["aesthetics"],
            "color": primary_color,
            "hex_color": spec["hex_color"],
            "colors": colors,
            "material": primary_material,
            "fabric_materials": materials,
            "pattern": gt.get("pattern") or "solid",
            "season": season,
            "tags": merged_tags[:8],
            "image_url": public_url,
            "is_starter_capsule": True,
        }
        curated_items.append(item_record)

    js_header = """/**
 * AUTO-GENERATED BY `scripts/curate_onboarding_dataset.py`
 * Sourced from DressApp's 5,000+ Cataloged Training Dataset:
 *   - `dataset_distilled/curated_distilled_5k.jsonl` (Gemini 2.5 Flash Ground-Truth Distilled Dataset)
 *   - `inference-server/eyes/training/curated_cultural_sft_dataset.jsonl` (Curated Cultural SFT Dataset)
 *
 * Contains 48 real cataloged wardrobe staples (24 Women's + 24 Men's) across:
 *   - Full-Body Cultural, Modest & One-Piece (Abaya, Kaftan, Jalabiya/Kurta Set, Saree, Dress, Jumpsuit, Thobe, Business Suit)
 *   - Skirts (Pleated Midi, A-Line Business Midi, Pleated Denim)
 *   - Trousers, Chinos & Loose Pants (Tailored Dress Trousers, Wide-Leg/Loose Pants, Chinos, Straight Jeans)
 *   - Tops, Blouses, Shirts & Loose Tunics (Mandarin Tunic, Kurta, Guayabera, Button-Down Shirt, Modest Blouse, Sweater, Polo, Tee)
 *   - Business Suits, Cultural Coats & Outerwear (Suit Blazer, Bandhgala Waistcoat, Achkan, Trench Coat, Long Cardigan)
 *   - Footwear (Derby Dress Shoes, Court Heels, Loafers, Chelsea Boots, Sneakers, Wedge Sandals)
 */

export const ONBOARDING_STATIC_DATASET = """
    js_body = json.dumps(curated_items, indent=2, ensure_ascii=False)
    js_footer = """;

export const WOMEN_ONBOARDING_DATASET = ONBOARDING_STATIC_DATASET.filter((item) => item.sex === 'female');
export const MEN_ONBOARDING_DATASET = ONBOARDING_STATIC_DATASET.filter((item) => item.sex === 'male');

export const ONBOARDING_DATASET_BY_ID = Object.fromEntries(
  ONBOARDING_STATIC_DATASET.map((item) => [item.id, item])
);
"""
    OUTPUT_JS_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JS_PATH.write_text(js_header + js_body + js_footer, encoding="utf-8")
    return curated_items


def verify_dataset(items: list[dict[str, Any]]) -> None:
    assert len(items) == 48, f"Expected 48 items, got {len(items)}"
    women = [i for i in items if i["sex"] == "female"]
    men = [i for i in items if i["sex"] == "male"]
    assert len(women) == 24, f"Expected 24 women items, got {len(women)}"
    assert len(men) == 24, f"Expected 24 men items, got {len(men)}"

    for item in items:
        img_file = REPO_ROOT / "apps" / "web" / "public" / item["image_url"].lstrip("/")
        assert img_file.exists() and img_file.stat().st_size > 1000, f"Missing or empty image: {img_file}"
        color_sum = sum(int(c["pct"]) for c in item["colors"])
        mat_sum = sum(int(m["pct"]) for m in item["fabric_materials"])
        assert color_sum == 100, f"Color pct sum != 100 for {item['id']}: {color_sum}"
        assert mat_sum == 100, f"Material pct sum != 100 for {item['id']}: {mat_sum}"
        assert "starter_capsule" in item["tags"], f"Missing starter_capsule tag in {item['id']}"

    print(f"Verified {len(items)} curated onboarding items (24 Women's + 24 Men's) and all 48 image assets.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Curate DressApp static onboarding dataset from 5k training catalog.")
    parser.add_argument("--verify", action="store_true", help="Run integrity assertions after building.")
    args = parser.parse_args()

    items = build_onboarding_dataset()
    try:
        import fit_onboarding_garments_to_avatar
        fit_onboarding_garments_to_avatar.main()
        raw_js = OUTPUT_JS_PATH.read_text(encoding="utf-8")
        start_idx = raw_js.index("export const ONBOARDING_STATIC_DATASET = ") + len("export const ONBOARDING_STATIC_DATASET = ")
        end_idx = raw_js.index(";\n\nexport const WOMEN_ONBOARDING_DATASET")
        items = json.loads(raw_js[start_idx:end_idx])
    except Exception as exc:
        print(f"Note: fit_onboarding_garments_to_avatar skipped: {exc}")
    verify_dataset(items)
    if args.verify:
        print("All dataset verification checks passed!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
