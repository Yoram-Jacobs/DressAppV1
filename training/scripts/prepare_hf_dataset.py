#!/usr/bin/env python3
"""ETL Script: Convert Hugging Face 'ashraq/fashion-product-images-small' to DressApp QLoRA format.

Extracts a curated, category-balanced dataset mapping directly to DressApp's canonical
JSON schema:
  - Apparel: Tops, Bottoms, Outerwear, Dresses
  - Footwear: Shoes, Boots, Sneakers, Sandals, Heels
  - Accessories: Sunglasses, Bags, Belts, Headwear

Usage:
  python training/scripts/prepare_hf_dataset.py --output training/datasets/garment_vision_curated.jsonl --samples_per_bucket 300
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("prepare_hf_dataset")

# Mapping rules from ashraq/fashion-product-images-small to DressApp taxonomy
CATEGORY_BUCKETS = {
    "tops": {
        "master": ["Apparel"],
        "sub": ["Topwear"],
        "articles": ["Tshirts", "Shirts", "Tops", "Sweaters", "Sweatshirts", "Tunics", "Kurtas"],
        "dressapp_cat": "Top",
    },
    "bottoms": {
        "master": ["Apparel"],
        "sub": ["Bottomwear"],
        "articles": ["Jeans", "Trousers", "Shorts", "Skirts", "Leggings", "Capris", "Track Pants"],
        "dressapp_cat": "Bottom",
    },
    "outerwear": {
        "master": ["Apparel"],
        "sub": ["Topwear"],
        "articles": ["Jackets", "Blazers", "Coats", "Waistcoat"],
        "dressapp_cat": "Outerwear",
    },
    "dresses": {
        "master": ["Apparel"],
        "sub": ["Dress"],
        "articles": ["Dresses", "Jumpsuit"],
        "dressapp_cat": "Full Body",
    },
    "footwear": {
        "master": ["Footwear"],
        "sub": ["Shoes", "Flip Flops", "Sandal"],
        "articles": ["Casual Shoes", "Sports Shoes", "Heels", "Flats", "Sandals", "Boots", "Flip Flops"],
        "dressapp_cat": "Footwear",
    },
    "accessories_sunglasses": {
        "master": ["Accessories"],
        "sub": ["Eyewear"],
        "articles": ["Sunglasses"],
        "dressapp_cat": "Accessories",
    },
    "accessories_bags": {
        "master": ["Accessories"],
        "sub": ["Bags"],
        "articles": ["Handbags", "Backpacks", "Clutches", "Trolley Bag", "Duffel Bag", "Messenger Bag"],
        "dressapp_cat": "Accessories",
    },
    "accessories_belts": {
        "master": ["Accessories"],
        "sub": ["Belts"],
        "articles": ["Belts"],
        "dressapp_cat": "Accessories",
    },
    "accessories_headwear": {
        "master": ["Accessories"],
        "sub": ["Headwear"],
        "articles": ["Caps", "Hats"],
        "dressapp_cat": "Accessories",
    },
}

GENDER_MAP = {
    "Men": "men",
    "Women": "women",
    "Boys": "kids",
    "Girls": "kids",
    "Unisex": "unisex",
}

USAGE_TO_DRESS_CODE = {
    "Casual": "casual",
    "Ethnic": "smart-casual",
    "Formal": "formal",
    "Sports": "athletic",
    "Smart Casual": "smart-casual",
    "Party": "formal",
    "Travel": "casual",
}

SEASON_MAP = {
    "Summer": ["summer", "spring"],
    "Fall": ["fall"],
    "Winter": ["winter"],
    "Spring": ["spring"],
}


def build_dressapp_target(row: Dict[str, Any]) -> Dict[str, Any]:
    master = row.get("masterCategory", "")
    sub = row.get("subCategory", "")
    article = row.get("articleType", "")
    color = row.get("baseColour") or "Black"
    name = row.get("productDisplayName") or f"{color} {article}"
    gender_raw = row.get("gender") or "Unisex"
    gender = GENDER_MAP.get(gender_raw, "unisex")
    usage = row.get("usage") or "Casual"
    dress_code = USAGE_TO_DRESS_CODE.get(usage, "casual")
    season_raw = row.get("season") or "Summer"
    seasons = SEASON_MAP.get(season_raw, ["spring", "summer"])

    # Determine DressApp category
    category = "Top"
    sub_category = article
    item_type = article

    if master == "Accessories":
        category = "Accessories"
        if sub == "Eyewear" or "Sunglasses" in article:
            sub_category = "Sunglasses"
            item_type = "Classic Sunglasses"
        elif sub == "Bags" or "Bag" in article or "Handbag" in article:
            sub_category = "Bags"
            item_type = article if article != "Bags" else "Handbag"
        elif "Belt" in article:
            sub_category = "Belts"
            item_type = "Belt"
        elif "Hat" in article or "Cap" in article:
            sub_category = "Headwear"
            item_type = article
    elif master == "Footwear":
        category = "Footwear"
        if "Boot" in article:
            sub_category = "Boots"
            item_type = "Ankle Boots"
        elif "Sandal" in article:
            sub_category = "Sandals"
            item_type = "Sandals"
        elif "Heel" in article:
            sub_category = "Heels"
            item_type = "Classic Heels"
        elif "Shoe" in article:
            sub_category = "Sneakers" if "Sport" in article else "Shoes"
            item_type = article
        else:
            sub_category = "Shoes"
            item_type = article
    elif master == "Apparel":
        if sub == "Bottomwear":
            category = "Bottom"
            sub_category = "Jeans" if "Jean" in article else ("Shorts" if "Short" in article else "Pants")
            item_type = article
        elif sub == "Dress":
            category = "Full Body"
            sub_category = "Dresses"
            item_type = article
        elif article in ("Jackets", "Blazers", "Coats"):
            category = "Outerwear"
            sub_category = "Jackets" if article != "Coats" else "Coats"
            item_type = article
        else:
            category = "Top"
            sub_category = "T-Shirt" if "Tshirt" in article else "Shirt"
            item_type = article

    caption = f"A {color.lower()} {item_type.lower()} with clean styling, suitable for {dress_code} wear."

    return {
        "is_clothing": True,
        "name": name,
        "title": name,
        "category": category,
        "sub_category": sub_category,
        "item_type": item_type,
        "gender": gender,
        "dress_code": dress_code,
        "season": seasons,
        "colors": [{"name": color, "pct": 100}],
        "pattern": "solid",
        "caption": caption,
        "tags": [category.lower(), sub_category.lower(), color.lower()],
    }


def main():
    parser = argparse.ArgumentParser(description="Extract curated DressApp training dataset from Hugging Face")
    parser.add_argument("--output", type=str, default="training/datasets/garment_vision_curated.jsonl")
    parser.add_argument("--samples_per_bucket", type=int, default=250)
    args = parser.parse_args()

    try:
        from datasets import load_dataset
    except ImportError:
        logger.error("Please install datasets library: pip install datasets")
        sys.exit(1)

    logger.info("Loading 'ashraq/fashion-product-images-small' from Hugging Face...")
    ds = load_dataset("ashraq/fashion-product-images-small", split="train")
    logger.info(f"Loaded total {len(ds)} raw rows from Hugging Face.")

    bucket_counts = {k: 0 for k in CATEGORY_BUCKETS}
    selected_samples = []

    for row in ds:
        master = row.get("masterCategory", "")
        sub = row.get("subCategory", "")
        article = row.get("articleType", "")

        matched_bucket = None
        for b_name, b_spec in CATEGORY_BUCKETS.items():
            if master in b_spec["master"]:
                if (sub in b_spec["sub"]) or (article in b_spec["articles"]):
                    if bucket_counts[b_name] < args.samples_per_bucket:
                        matched_bucket = b_name
                        break

        if matched_bucket:
            bucket_counts[matched_bucket] += 1
            target_json = build_dressapp_target(row)
            
            # Format message for QLoRA training
            user_msg = (
                "Analyze the garment or accessory in the image and extract all attributes into strict JSON: "
                "is_clothing, name, title, category, sub_category, item_type, gender, dress_code, season, colors, pattern, caption, tags."
            )
            sample = {
                "messages": [
                    {"role": "user", "content": user_msg},
                    {"role": "assistant", "content": json.dumps(target_json, ensure_ascii=False)},
                ],
                "meta": {
                    "bucket": matched_bucket,
                    "hf_id": row.get("id"),
                    "displayName": row.get("productDisplayName"),
                }
            }
            selected_samples.append(sample)

            if all(c >= args.samples_per_bucket for c in bucket_counts.values()):
                logger.info("All category buckets successfully filled!")
                break

    logger.info(f"Selected {len(selected_samples)} balanced samples across buckets:")
    for b_name, c in bucket_counts.items():
        logger.info(f"  - {b_name}: {c} items")

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for item in selected_samples:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    logger.info(f"Successfully exported curated training dataset to: {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
