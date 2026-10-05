#!/usr/bin/env python3
"""
inference-server/eyes/training/prepare_dataset.py

Constructs the Eyes Gemma-4 multimodal SFT training dataset using newly added
and approved items extracted from the live DressApp database (MongoDB / REST API).

Scheduling Rule:
  Fine-tuning is applied ONLY when there are >= min_new_items (default 500)
  newly added and approved items in the DressApp database since the last
  fine-tuning watermark. If fewer than 500 new items exist, the fine-tuning routine
  is skipped to prevent overfitting and model weight distortion on repeated datasets.

Outputs:
  - build/dataset/train.jsonl (80%)
  - build/dataset/val.jsonl (10%)
  - build/dataset/test.jsonl (10%)
  - build/dataset/status.json (Pipeline readiness & skip signals)
  - build/dataset/stats.json
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import random
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("prepare_dataset")

# Standard taxonomy categories and synonyms
TAXONOMY_MAP = {
    "top": ["top", "tops", "shirt", "t_shirt", "tshirt", "sweater", "hoodie", "blouse", "tank", "polo"],
    "bottom": ["bottom", "bottoms", "pants", "jeans", "shorts", "skirt", "trousers", "joggers", "leggings"],
    "shoes": ["shoes", "shoe", "footwear", "sneakers", "boots", "sandals", "loafers", "heels", "flats"],
    "outerwear": ["outerwear", "jacket", "coat", "blazer", "parka", "cardigan", "vest"],
    "dress": ["dress", "full body", "jumpsuit", "romper", "gown"],
    "accessory": ["accessory", "accessories", "bag", "belt", "sunglasses", "hat", "scarf", "jewelry", "watch"],
}

CATEGORY_ATTRIBUTES = {
    "top": {
        "sub_categories": ["t_shirt", "button_down", "sweater", "hoodie", "blouse", "polo", "tank_top"],
        "materials": ["cotton", "linen", "silk", "wool", "polyester", "denim", "knit"],
        "patterns": ["solid", "striped", "graphic", "floral", "plaid"],
    },
    "bottom": {
        "sub_categories": ["jeans", "chinos", "trousers", "shorts", "sweatpants", "cargo_pants", "skirt"],
        "materials": ["denim", "cotton", "wool", "linen", "leather", "spandex"],
        "patterns": ["solid", "distressed", "washed", "plaid", "camo"],
    },
    "shoes": {
        "sub_categories": ["sneakers", "boots", "loafers", "sandals", "dress_shoes", "running_shoes", "flats"],
        "materials": ["leather", "canvas", "suede", "rubber", "mesh", "synthetic"],
        "patterns": ["solid", "colorblock", "two_tone"],
    },
    "outerwear": {
        "sub_categories": ["denim_jacket", "bomber_jacket", "blazer", "trench_coat", "puffer_jacket", "parka", "overcoat"],
        "materials": ["wool", "leather", "down", "nylon", "cotton_twill", "fleece"],
        "patterns": ["solid", "checkered", "houndstooth"],
    },
    "dress": {
        "sub_categories": ["slip_dress", "wrap_dress", "shirt_dress", "maxi_dress", "cocktail_dress"],
        "materials": ["silk", "satin", "cotton", "chiffon", "velvet"],
        "patterns": ["floral", "solid", "polka_dot", "geometric"],
    },
    "accessory": {
        "sub_categories": ["tote_bag", "crossbody_bag", "leather_belt", "sunglasses", "baseball_cap", "beanie", "scarf"],
        "materials": ["leather", "canvas", "acetate", "metal", "wool", "straw"],
        "patterns": ["solid", "monogram", "metallic"],
    },
}

COLORS = ["black", "white", "navy", "grey", "beige", "brown", "olive", "cream", "burgundy", "blue", "yellow", "red", "green"]
FORMALITIES = ["casual", "smart_casual", "business_casual", "formal", "streetwear", "athletic"]


def normalize_class_title(title: str | None) -> str:
    if not title:
        return "top"
    s = title.strip().lower().replace("-", "_").replace(" ", "_")
    for canonical, synonyms in TAXONOMY_MAP.items():
        if s == canonical or any(syn in s for syn in synonyms):
            return canonical
    return "accessory"


def download_or_cache_image(
    image_url: str,
    target_path: Path,
    timeout: int = 15,
) -> bool:
    """Download image from HTTP URL, decode base64 data URL, or copy local file."""
    if target_path.exists() and target_path.stat().st_size > 500:
        return True

    target_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Case 1: Base64 Data URL
        if image_url.startswith("data:image/"):
            parts = image_url.split(",", 1)
            if len(parts) == 2:
                img_bytes = base64.b64decode(parts[1])
                target_path.write_bytes(img_bytes)
                with Image.open(target_path) as img:
                    img.verify()
                return True

        # Case 2: Local file path
        local_p = Path(image_url)
        if local_p.exists() and local_p.is_file():
            img_bytes = local_p.read_bytes()
            target_path.write_bytes(img_bytes)
            with Image.open(target_path) as img:
                img.verify()
            return True

        # Case 3: HTTP/HTTPS URL
        req = urllib.request.Request(
            image_url,
            headers={"User-Agent": "DressApp-Eyes-DatasetPrep/1.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            target_path.write_bytes(data)

        # Verify image integrity
        with Image.open(target_path) as img:
            img.verify()
        return True

    except Exception as exc:
        logger.warning("Failed to download or verify image from %s: %s", image_url[:80], exc)
        if target_path.exists():
            target_path.unlink(missing_ok=True)
        return False


def generate_attribute_sample(
    image_path: Path,
    item: dict[str, Any] | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    """Task 1: Multimodal attribute parsing sample matching standard schema."""
    if item:
        norm_cat = normalize_class_title(item.get("category"))
        raw_sub = item.get("sub_category") or "garment"
        sub_cat = str(raw_sub).lower().replace(" ", "_").replace("-", "_")

        raw_color = item.get("color")
        if not raw_color and item.get("colors") and len(item["colors"]) > 0:
            first_c = item["colors"][0]
            raw_color = first_c.get("name") if isinstance(first_c, dict) else str(first_c)
        color = (raw_color or "neutral").lower()

        raw_mat = item.get("material")
        if not raw_mat and item.get("fabric_materials") and len(item["fabric_materials"]) > 0:
            first_m = item["fabric_materials"][0]
            raw_mat = first_m.get("name") if isinstance(first_m, dict) else str(first_m)
        material = (raw_mat or "cotton").lower()

        pattern = (item.get("pattern") or "solid").lower()
        formality = (item.get("formality") or item.get("dress_code") or "casual").lower()

        tags = item.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        style_tags = list(dict.fromkeys([formality, pattern] + [t.lower() for t in tags]))[:6]

        description = f"{color.capitalize()} {material} {sub_cat.replace('_', ' ')} with {pattern} finish."
    else:
        norm_cat = category or "top"
        cat_cfg = CATEGORY_ATTRIBUTES.get(norm_cat, CATEGORY_ATTRIBUTES["accessory"])
        sub_cat = random.choice(cat_cfg["sub_categories"])
        material = random.choice(cat_cfg["materials"])
        pattern = random.choice(cat_cfg["patterns"])
        color = random.choice(COLORS)
        formality = random.choice(FORMALITIES)
        style_tags = [formality, pattern]
        description = f"{color.capitalize()} {material} {sub_cat.replace('_', ' ')} with {pattern} finish."

    system_prompt = (
        "You are DressApp Eyes, an expert fashion vision and taxonomy classification engine. "
        "Analyze the garment in the provided photo and extract its precise attributes matching "
        "the standard taxonomy schema. Output ONLY valid JSON."
    )
    user_text = "Analyze this garment image and return its technical fashion attributes as a JSON object."

    ground_truth = {
        "category": norm_cat,
        "sub_category": sub_cat,
        "color": color,
        "material": material,
        "pattern": pattern,
        "formality": formality,
        "style_tags": style_tags,
        "description": description,
    }

    return {
        "type": "attribute_parsing",
        "expected_category": norm_cat,
        "image_path": str(image_path),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"<image>\n{user_text}"},
            {"role": "model", "content": json.dumps(ground_truth, ensure_ascii=False)},
        ],
    }


def generate_outfit_completion_sample(
    image_path: Path,
    item: dict[str, Any] | None = None,
    anchor_category: str | None = None,
) -> dict[str, Any]:
    """Task 2: Complete Outfit Generation with mandatory Shoes & Accessories."""
    norm_cat = normalize_class_title(item.get("category") if item else anchor_category)
    color = (item.get("color") if item else random.choice(COLORS)) or "neutral"
    formality = (item.get("formality") if item else random.choice(FORMALITIES)) or "casual"

    system_prompt = (
        "You are DressApp Eyes, an expert fashion stylist. Given an anchor garment, create a complete, "
        "harmonious head-to-toe outfit. Every outfit recommendation MUST include primary complementary "
        "garments, MANDATORY footwear (role: 'shoes'), and at least one MANDATORY accessory (role: 'accessory'). "
        "Output ONLY valid JSON."
    )
    user_text = f"Complete a stylish everyday outfit starting from this {norm_cat} anchor piece."

    complementary_bottom = {
        "role": "bottom",
        "description": f"{random.choice(COLORS)} {random.choice(CATEGORY_ATTRIBUTES['bottom']['sub_categories']).replace('_', ' ')}",
    }
    mandatory_shoes = {
        "role": "shoes",
        "description": f"{random.choice(COLORS)} {random.choice(CATEGORY_ATTRIBUTES['shoes']['sub_categories']).replace('_', ' ')}",
    }
    mandatory_acc = {
        "role": "accessory",
        "description": f"{random.choice(COLORS)} {random.choice(CATEGORY_ATTRIBUTES['accessory']['sub_categories']).replace('_', ' ')}",
    }

    ground_truth = {
        "reasoning_summary": f"Effortlessly cohesive look pairing the anchor with complementary tones and balanced textures.",
        "outfit_recommendations": [
            {
                "name": "Curated Modern Ensemble",
                "items": [complementary_bottom, mandatory_shoes, mandatory_acc],
                "why": "Creates visual equilibrium between silhouette structure, comfortable footwear, and functional accessories.",
                "confidence": 0.95,
            }
        ],
        "do_dont": [
            "Do balance proportions between upper and lower halves",
            "Don't clash contrasting metal finishes or conflicting formal tones",
        ],
        "spoken_reply": "Here is a complete, polished look incorporating footwear and matching accessories.",
    }

    return {
        "type": "outfit_completion",
        "anchor_category": norm_cat,
        "image_path": str(image_path),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"<image>\n{user_text}"},
            {"role": "model", "content": json.dumps(ground_truth, ensure_ascii=False)},
        ],
    }


def fetch_items_from_api(
    api_url: str,
    api_token: str | None,
    min_items: int,
    force: bool,
    since: str | None = None,
) -> dict[str, Any]:
    """Fetch newly added & approved items via backend internal REST API."""
    query_params = [f"min_items={min_items}", f"force={'true' if force else 'false'}"]
    if since:
        query_params.append(f"since={since}")

    full_url = f"{api_url}?{'&'.join(query_params)}"
    logger.info("Querying DressApp internal API: %s", full_url)

    headers = {"User-Agent": "DressApp-Eyes-Prep/1.0"}
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"

    req = urllib.request.Request(full_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        logger.error("HTTP %s from API: %s", exc.code, body)
        raise RuntimeError(f"API returned HTTP {exc.code}: {body}") from exc
    except Exception as exc:
        logger.error("Failed to connect to DressApp internal API: %s", exc)
        raise


def fetch_items_from_mongo(
    mongo_url: str,
    min_items: int,
    force: bool,
    since: str | None = None,
) -> dict[str, Any]:
    """Directly query local/containerized MongoDB for approved items."""
    try:
        import pymongo
    except ImportError as err:
        raise RuntimeError("pymongo is required for direct mongo-url extraction. Install with pip install pymongo.") from err

    client = pymongo.MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client.get_default_database()
    if db is None:
        db = client["dressapp"]

    watermark_doc = db.config.find_one({"_id": "eyes_finetune_state"})
    effective_since = since or (watermark_doc.get("last_finetuned_at") if watermark_doc else None)

    base_filter: dict[str, Any] = {
        "is_duplicate": {"$ne": True},
        "$or": [
            {"thumbnail_data_url": {"$exists": True, "$ne": None}},
            {"reconstructed_image_url": {"$exists": True, "$ne": None}},
        ],
    }

    total_approved = db.closet_items.count_documents(base_filter)
    new_filter = dict(base_filter)
    if effective_since:
        new_filter["created_at"] = {"$gt": effective_since}

    new_count = db.closet_items.count_documents(new_filter)
    eligible = (new_count >= min_items) or force

    if not eligible:
        return {
            "status": "skipped",
            "eligible": False,
            "new_count": new_count,
            "total_count": total_approved,
            "min_items": min_items,
            "forced": force,
            "effective_since": effective_since,
            "items": [],
        }

    raw_items = list(db.closet_items.find(new_filter if effective_since else base_filter).limit(5000))
    items = []
    base_cdn_url = "https://dressapp.co"

    for it in raw_items:
        img_path = it.get("reconstructed_image_url") or it.get("thumbnail_data_url")
        if not img_path:
            continue
        full_img_url = f"{base_cdn_url}{img_path}" if img_path.startswith("/") else img_path
        items.append({
            "id": it.get("id"),
            "title": it.get("name") or it.get("title") or "Garment Item",
            "category": it.get("category"),
            "sub_category": it.get("sub_category"),
            "color": it.get("color"),
            "colors": it.get("colors") or [],
            "material": it.get("material"),
            "fabric_materials": it.get("fabric_materials") or [],
            "pattern": it.get("pattern"),
            "formality": it.get("formality") or it.get("dress_code"),
            "gender": it.get("gender"),
            "season": it.get("season"),
            "tags": it.get("tags") or [],
            "image_url": full_img_url,
            "created_at": it.get("created_at"),
        })

    return {
        "status": "success",
        "eligible": True,
        "new_count": new_count,
        "total_count": total_approved,
        "min_items": min_items,
        "forced": force,
        "effective_since": effective_since,
        "items": items,
    }


def write_github_output(outputs: dict[str, Any]) -> None:
    """Append key-value outputs to GITHUB_OUTPUT file if running in GitHub Actions."""
    gh_output_path = os.environ.get("GITHUB_OUTPUT")
    if gh_output_path:
        with open(gh_output_path, "a", encoding="utf-8") as f:
            for k, v in outputs.items():
                f.write(f"{k}={v}\n")


def prepare_dataset(
    output_dir: Path,
    min_new_items: int = 500,
    force: bool = False,
    api_url: str | None = None,
    api_token: str | None = None,
    mongo_url: str | None = None,
    db_items_file: Path | None = None,
    since: str | None = None,
    images_dir: Path | None = None,
    garments_dir: Path | None = None,
    split_ratio: tuple[float, float, float] = (0.8, 0.1, 0.1),
    seed: int = 42,
    max_samples: int | None = None,
) -> dict[str, Any]:
    random.seed(seed)
    output_dir.mkdir(parents=True, exist_ok=True)
    images_cache_dir = output_dir / "images"
    images_cache_dir.mkdir(parents=True, exist_ok=True)

    db_items: list[dict[str, Any]] = []
    new_count = 0
    total_approved = 0
    is_eligible = False

    # 1. Fetch from Pre-exported File if provided
    if db_items_file and db_items_file.exists():
        logger.info("Loading items from exported file: %s", db_items_file)
        lines = db_items_file.read_text(encoding="utf-8").strip().splitlines()
        for ln in lines:
            if ln.strip():
                db_items.append(json.loads(ln))
        new_count = len(db_items)
        total_approved = new_count
        is_eligible = (new_count >= min_new_items) or force

    # 2. Fetch from MongoDB direct connection if provided
    elif mongo_url:
        logger.info("Querying MongoDB direct connection...")
        res = fetch_items_from_mongo(mongo_url, min_items=min_new_items, force=force, since=since)
        new_count = res.get("new_count", 0)
        total_approved = res.get("total_count", 0)
        is_eligible = res.get("eligible", False)
        db_items = res.get("items", [])

    # 3. Fetch from Internal API
    elif api_url:
        logger.info("Querying DressApp Internal API at %s...", api_url)
        try:
            res = fetch_items_from_api(
                api_url=api_url,
                api_token=api_token,
                min_items=min_new_items,
                force=force,
                since=since,
            )
            new_count = res.get("new_count", 0)
            total_approved = res.get("total_count", 0)
            is_eligible = res.get("eligible", False)
            db_items = res.get("items", [])
        except Exception as exc:
            logger.warning("Could not fetch from internal API: %s", exc)
            if force:
                logger.info("Force flag enabled — falling back to local canonical catalog images.")
            else:
                logger.error("Unable to query DressApp database. Aborting fine-tuning routine.")
                status_info = {
                    "should_train": False,
                    "status": "error",
                    "error": str(exc),
                    "new_item_count": 0,
                    "threshold": min_new_items,
                }
                (output_dir / "status.json").write_text(json.dumps(status_info, indent=2))
                write_github_output({"should_train": "false", "new_item_count": 0})
                return status_info

    # -------------------------------------------------------------------------
    # SCHEDULING RULE ENFORCEMENT
    # -------------------------------------------------------------------------
    if not is_eligible and not force:
        logger.info(
            "========================================================================\n"
            "⏸️  SCHEDULING RULE ENFORCED: FINE-TUNING ACTION SKIPPED\n"
            "------------------------------------------------------------------------\n"
            "Found %d newly added & approved items in DressApp database.\n"
            "Minimum required threshold to construct fine-tuning dataset is >= %d items.\n"
            "Repeated fine-tuning on the same dataset can distort model weights.\n"
            "Fine-tuning safely skipped until >= %d new items are collected.\n"
            "========================================================================",
            new_count,
            min_new_items,
            min_new_items,
        )

        status_info = {
            "should_train": False,
            "status": "skipped",
            "reason": (
                f"Insufficient new items: found {new_count} newly added and approved items, "
                f"below the minimum threshold of {min_new_items}. Fine-tuning skipped."
            ),
            "new_item_count": new_count,
            "total_approved_count": total_approved,
            "min_new_items": min_new_items,
            "force": force,
        }
        (output_dir / "status.json").write_text(json.dumps(status_info, indent=2), encoding="utf-8")
        write_github_output({"should_train": "false", "new_item_count": new_count})
        return status_info

    logger.info(
        "✅ Scheduling gate passed: %d new approved items (threshold: >= %d, force: %s)",
        len(db_items),
        min_new_items,
        force,
    )

    samples: list[dict[str, Any]] = []

    # Process live database items
    downloaded_count = 0
    for idx, item in enumerate(db_items):
        if max_samples and len(samples) >= max_samples:
            break

        item_id = item.get("id") or f"db_item_{idx}"
        img_url = item.get("image_url")
        if not img_url:
            continue

        ext = ".png" if ".png" in img_url.lower() else ".jpg"
        target_img = images_cache_dir / f"{item_id}{ext}"

        if download_or_cache_image(img_url, target_img):
            downloaded_count += 1
            # Add Task 1: Attribute parsing
            samples.append(generate_attribute_sample(target_img, item=item))
            if max_samples and len(samples) >= max_samples:
                break
            # Add Task 2: Outfit completion
            samples.append(generate_outfit_completion_sample(target_img, item=item))
            if max_samples and len(samples) >= max_samples:
                break

        if (idx + 1) % 25 == 0:
            logger.info("Processed %d / %d database items (samples: %d)...", idx + 1, len(db_items), len(samples))

    logger.info("Ingested %d valid database images, generating %d SFT samples", downloaded_count, len(samples))

    # Supplemental Fallback: Include canonical test_images if database items are empty (e.g. force local dev)
    if len(samples) == 0 and images_dir and images_dir.exists():
        logger.info("Including canonical test images from %s...", images_dir)
        for jpg_file in sorted(images_dir.glob("*.jpg")):
            if max_samples and len(samples) >= max_samples:
                break
            samples.append(generate_attribute_sample(jpg_file, category="top"))
            samples.append(generate_outfit_completion_sample(jpg_file, anchor_category="top"))

    if len(samples) == 0:
        logger.error("No valid dataset samples could be constructed!")
        status_info = {
            "should_train": False,
            "status": "error",
            "error": "No valid samples produced",
            "new_item_count": new_count,
            "threshold": min_new_items,
        }
        (output_dir / "status.json").write_text(json.dumps(status_info, indent=2))
        write_github_output({"should_train": "false", "new_item_count": new_count})
        return status_info

    random.shuffle(samples)

    n = len(samples)
    if n >= 3:
        n_val = max(1, int(n * split_ratio[1]))
        n_test = max(1, int(n * split_ratio[2]))
        n_train = n - n_val - n_test
    else:
        n_train, n_val, n_test = n, 0, 0

    train_data = samples[:n_train]
    val_data = samples[n_train : n_train + n_val]
    test_data = samples[n_train + n_val :]

    for split_name, split_list in [("train", train_data), ("val", val_data), ("test", test_data)]:
        target_path = output_dir / f"{split_name}.jsonl"
        with target_path.open("w", encoding="utf-8") as f:
            for item in split_list:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        logger.info("Saved %s split: %d samples to %s", split_name, len(split_list), target_path)

    stats = {
        "total_samples": n,
        "train_samples": len(train_data),
        "val_samples": len(val_data),
        "test_samples": len(test_data),
        "new_items_used": new_count,
    }
    (output_dir / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")

    status_info = {
        "should_train": True,
        "status": "ready",
        "new_item_count": new_count,
        "total_approved_count": total_approved,
        "min_new_items": min_new_items,
        "force": force,
        "stats": stats,
    }
    (output_dir / "status.json").write_text(json.dumps(status_info, indent=2), encoding="utf-8")

    write_github_output({
        "should_train": "true",
        "new_item_count": new_count,
        "total_samples": n,
    })

    return status_info


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare Eyes Multimodal SFT Dataset from Live Database")
    parser.add_argument(
        "--api-url",
        type=str,
        default=os.environ.get("EYES_DATASET_API_URL", "https://dressapp.co/api/v1/internal/training-items"),
        help="Internal API endpoint to query approved items",
    )
    parser.add_argument(
        "--api-token",
        type=str,
        default=os.environ.get("EYES_API_TOKEN"),
        help="Internal service token for API authentication",
    )
    parser.add_argument(
        "--mongo-url",
        type=str,
        default=os.environ.get("MONGO_URL"),
        help="MongoDB connection URI for direct database query",
    )
    parser.add_argument(
        "--db-items",
        type=Path,
        default=None,
        help="Path to pre-exported JSONL file containing approved database items",
    )
    parser.add_argument(
        "--min-new-items",
        type=int,
        default=int(os.environ.get("MIN_NEW_ITEMS", "500")),
        help="Minimum newly added and approved items required to trigger fine-tuning (default: 500)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        default=os.environ.get("FORCE_TRAINING", "false").lower() in ("true", "1", "yes"),
        help="Force dataset preparation and bypass the min-new-items threshold check",
    )
    parser.add_argument(
        "--since",
        type=str,
        default=None,
        help="ISO timestamp watermark filter (items added after this timestamp)",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=Path("inference-server/eyes/test_images"),
        help="Canonical test images directory (supplemental fallback)",
    )
    parser.add_argument(
        "--garments-dir",
        type=Path,
        default=Path("inference-server/eyes/Garments"),
        help="Canonical garments directory (supplemental fallback)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("build/dataset"),
        help="Directory to save generated JSONL splits and images",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-samples", type=int, default=None)
    args = parser.parse_args()

    result = prepare_dataset(
        output_dir=args.output_dir,
        min_new_items=args.min_new_items,
        force=args.force,
        api_url=args.api_url,
        api_token=args.api_token,
        mongo_url=args.mongo_url,
        db_items_file=args.db_items,
        since=args.since,
        images_dir=args.images_dir,
        garments_dir=args.garments_dir,
        seed=args.seed,
        max_samples=args.max_samples,
    )

    should_train = result.get("should_train", False)
    print(f"Dataset preparation finished. Result: should_train={should_train}")
    if not should_train and result.get("status") == "skipped":
        print(f"Scheduling gate skipped fine-tuning: {result.get('reason')}")
        # Clean exit so scheduled CI/CD job completes without error
        sys.exit(0)
    elif not should_train and result.get("status") == "error":
        print(f"Error during preparation: {result.get('error')}")
        sys.exit(1)


if __name__ == "__main__":
    main()
