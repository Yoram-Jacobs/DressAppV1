#!/usr/bin/env python3
"""DressApp Eyes Dataset Distillation Pipeline.

Distills ground-truth fashion visual intelligence from Gemini 2.5 Flash
into a high-quality, stratified multilingual dataset for fine-tuning
DressApp Eyes (google/gemma-4-e4b-it).

Stratification Matrix (5,000 items):
- Top: 800 (Ashraq 500 + DeepFashion 300)
- Bottom: 800 (Ashraq 400 + DeepFashion 400)
- Outerwear: 600 (Ashraq 300 + DeepFashion 300)
- Full Body / Dresses: 500 (Ashraq 250 + DeepFashion 250)
- Footwear: 800 (Ashraq 700 + DeepFashion 100)
- Bags & Luggage: 500 (Ashraq 500)
- Accessories: 500 (Ashraq 500)
- Jewelry: 500 (Ashraq 500)

Languages (13 UI languages distributed round-robin):
en, he, ar, es, fr, de, it, pt, ru, zh, ja, hi, nl (~384 items / lang)
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import logging
import os
import random
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from PIL import Image
from pydantic import BaseModel, Field

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("distill_pipeline")

# Disable torch check inside datasets library to prevent Windows C-extension error
import datasets.config
datasets.config.TORCH_AVAILABLE = False
from datasets import load_dataset

# Add backend to path to import canonical prompts
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.keyed_prompts import PROMPT_GARMENT_VISION
from app.services.vision.llm import _user_prompt

# Supported DressApp Languages
LANGUAGES = [
    "en", "he", "ar", "es", "fr", "de",
    "it", "pt", "ru", "zh", "ja", "hi", "nl",
]

# Output Pydantic Schema for Gemini Structured Outputs
class ColorItem(BaseModel):
    name: str = Field(description="Color name (localized if Hebrew/Arabic etc., or standard)")
    pct: int = Field(description="Percentage between 0 and 100")

class FabricItem(BaseModel):
    name: str = Field(description="Fabric/material name")
    pct: int = Field(description="Percentage between 0 and 100")

class DistilledGarment(BaseModel):
    is_clothing: bool = Field(True, description="True for wearable clothing, footwear, bags, accessories, jewelry")
    name: str = Field(description="Concise, unique, descriptive item name (2-5 words) in target language extracting cut/attributes. Never generic like 'Garment' or 'Clothing'.")
    title: str = Field(description="Identical or close to name in target language")
    caption: str = Field(description="Fluent single sentence <= 12 words in target language ending with period.")
    category: str = Field(description="Top, Bottom, Outerwear, Full Body, Footwear, Accessories, Underwear")
    sub_category: str = Field(description="Specific garment cut in English, e.g. T-Shirt, Jeans, Skirt, Loafers, Handbag, Sunglasses, Earrings")
    item_type: str = Field(description="Specific silhouette or cut in target language")
    dress_code: str = Field(description="One of: casual, smart-casual, business, formal, athletic, loungewear")
    model_gender: Optional[str] = Field(None, description="'men', 'women', or null if flat lay/mannequin")
    gender: str = Field(description="'men', 'women', or 'unisex'")
    colors: List[ColorItem] = Field(description="Array of colors summing to 100")
    fabric_materials: List[FabricItem] = Field(description="Array of materials summing to 100")
    pattern: str = Field(description="One of: solid, printed, geometric, striped, plaid, floral, camouflage")
    season: List[str] = Field(description="List of applicable seasons: spring, summer, fall, winter")
    tags: List[str] = Field(description="3-5 descriptive localized tags (never duplicating sub_category)")


def load_gemini_client():
    """Load google-genai client with API key from backend/.env or environment."""
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        env_file = BACKEND_DIR / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("GEMINI_API_KEY="):
                    api_key = line.split("=", 1)[1].strip()
                    break
                elif line.startswith("GOOGLE_API_KEY=") and not api_key:
                    api_key = line.split("=", 1)[1].strip()

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not found in environment or backend/.env")

    os.environ["GEMINI_API_KEY"] = api_key
    os.environ["GOOGLE_API_KEY"] = api_key
    return genai.Client(api_key=api_key)


def build_sampling_plan() -> List[Dict[str, Any]]:
    """Build the exact stratified sampling plan of 5,000 items from Ashraq and DeepFashion."""
    logger.info("Loading Ashraq dataset for stratified selection...")
    ashraq_ds = load_dataset("ashraq/fashion-product-images-small", split="train")

    logger.info("Categorizing Ashraq catalog (%d items)...", len(ashraq_ds))
    ashraq_buckets: Dict[str, List[int]] = {
        "Top": [],
        "Bottom": [],
        "Outerwear": [],
        "Full Body": [],
        "Footwear": [],
        "Bags": [],
        "Accessories": [],
        "Jewelry": [],
    }

    outerwear_types = {"jackets", "blazers", "coats", "shrug", "waistcoat"}
    dress_types = {"dresses", "jumpsuit", "rompers"}

    for idx, row in enumerate(ashraq_ds):
        master = (row.get("masterCategory") or "").lower()
        sub = (row.get("subCategory") or "").lower()
        art = (row.get("articleType") or "").lower()

        # Skip personal care, free items, cosmetics
        if master in ("personal care", "free items", "sporting goods"):
            continue

    for idx, row in enumerate(ashraq_ds):
        master = (row.get("masterCategory") or "").lower()
        sub = (row.get("subCategory") or "").lower()
        art = (row.get("articleType") or "").lower()

        # Skip personal care, free items, cosmetics
        if master in ("personal care", "free items", "sporting goods"):
            continue

        if art in outerwear_types or "jacket" in art or "coat" in art or "blazer" in art or "shrug" in art or "waistcoat" in art:
            ashraq_buckets["Outerwear"].append(idx)
        elif sub == "dress" or art in dress_types or "dress" in art or "sarees" in art or "salwar" in art:
            ashraq_buckets["Full Body"].append(idx)
        elif sub == "topwear":
            ashraq_buckets["Top"].append(idx)
        elif sub == "bottomwear":
            ashraq_buckets["Bottom"].append(idx)
        elif sub in ("shoes", "sandal", "flip flops") or master == "footwear":
            ashraq_buckets["Footwear"].append(idx)
        elif sub in ("bags", "wallets"):
            ashraq_buckets["Bags"].append(idx)
        elif sub == "jewellery":
            ashraq_buckets["Jewelry"].append(idx)
        elif sub in ("watches", "eyewear", "belts", "headwear", "ties", "scarves", "mufflers", "cufflinks", "socks") or master == "accessories":
            ashraq_buckets["Accessories"].append(idx)

    for k, v in ashraq_buckets.items():
        logger.info("Ashraq Bucket [%s]: %d available items", k, len(v))

    # Stratified target counts for Ashraq (Total 4,700 items)
    ashraq_targets = {
        "Top": 800,
        "Bottom": 800,
        "Footwear": 800,
        "Full Body": 500,
        "Bags": 500,
        "Accessories": 500,
        "Jewelry": 500,
        "Outerwear": 300,
    }

    random.seed(42)
    selected_items: List[Dict[str, Any]] = []

    for cat, count in ashraq_targets.items():
        indices = ashraq_buckets[cat]
        if len(indices) < count:
            sample_idx = indices
        else:
            sample_idx = random.sample(indices, count)

        for i in sample_idx:
            row = ashraq_ds[i]
            selected_items.append({
                "source": "ashraq",
                "id": f"ashraq_{row['id']}",
                "category_target": cat,
                "article_type": row.get("articleType"),
                "product_name": row.get("productDisplayName"),
                "gender_hint": row.get("gender"),
                "image": row["image"],
            })

    logger.info("Selected %d items from Ashraq.", len(selected_items))

    # DeepFashion targets: 300 real-world worn Outerwear (jackets, coats, blazers) with human models
    df_outerwear_target = 300
    df_count = 0
    logger.info("Streaming DeepFashion for %d Outerwear items...", df_outerwear_target)
    try:
        df_ds = load_dataset("Marqo/deepfashion-multimodal", split="data", streaming=True)
        for item in df_ds:
            if df_count >= df_outerwear_target:
                break

            cat2 = str(item.get("category2", "")).lower()
            iid = str(item.get("item_ID", ""))
            if "jacket" in cat2 or "coat" in cat2 or "Jackets_Vests" in iid or "Outerwear" in iid:
                df_count += 1
                clean_id = iid.replace("-", "_").replace(" ", "_")
                selected_items.append({
                    "source": "deepfashion",
                    "id": f"df_{clean_id}",
                    "category_target": "Outerwear",
                    "article_type": cat2,
                    "product_name": item.get("text", "")[:60],
                    "gender_hint": item.get("category1"),
                    "image": item["image"],
                })

        logger.info("DeepFashion Outerwear streamed: %d items", df_count)
    except Exception as exc:
        logger.warning("DeepFashion streaming encountered issue (%s). Using Ashraq supplement...", exc)
        needed = df_outerwear_target - df_count
        if needed > 0:
            remaining = [i for i in ashraq_buckets["Outerwear"] if ashraq_ds[i]["id"] not in [x["id"] for x in selected_items]]
            sample_extra = random.sample(remaining, min(needed, len(remaining)))
            for i in sample_extra:
                row = ashraq_ds[i]
                selected_items.append({
                    "source": "ashraq_outerwear",
                    "id": f"ashraq_{row['id']}",
                    "category_target": "Outerwear",
                    "article_type": row.get("articleType"),
                    "product_name": row.get("productDisplayName"),
                    "gender_hint": row.get("gender"),
                    "image": row["image"],
                })

    # Shuffle plan deterministically
    random.seed(1337)
    random.shuffle(selected_items)

    # Assign languages in round-robin fashion
    for i, item in enumerate(selected_items):
        item["target_lang"] = LANGUAGES[i % len(LANGUAGES)]

    logger.info("Total Stratified Items Planned: %d", len(selected_items))
    return selected_items


def resize_image_for_model(img: Image.Image, max_dim: int = 768) -> Image.Image:
    """Ensure image is RGB and fits within max_dim preserving aspect ratio."""
    if img.mode != "RGB":
        img = img.convert("RGB")
    w, h = img.size
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        new_w, new_h = int(w * scale), int(h * scale)
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    return img


def annotate_item(
    client,
    item: Dict[str, Any],
    images_dir: Path,
    max_retries: int = 4,
) -> Optional[Dict[str, Any]]:
    """Process a single item through Gemini 2.5 Flash with backoff and validation."""
    from google.genai import types

    item_id = item["id"]
    target_lang = item["target_lang"]
    image: Image.Image = item["image"]

    # Save image locally
    img_rgb = resize_image_for_model(image)
    img_filename = f"{item_id}.jpg"
    img_path = images_dir / img_filename
    img_rgb.save(img_path, format="JPEG", quality=88)

    user_msg = _user_prompt(target_lang, user_gender=item.get("gender_hint"))

    for attempt in range(max_retries):
        try:
            res = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[img_rgb, user_msg],
                config=types.GenerateContentConfig(
                    system_instruction=PROMPT_GARMENT_VISION,
                    response_mime_type="application/json",
                    response_schema=DistilledGarment,
                    temperature=0.1,
                ),
            )

            raw_text = res.text.strip()
            parsed = json.loads(raw_text)

            # Validate basic schema compliance
            if not parsed.get("name") or not parsed.get("colors"):
                raise ValueError("Incomplete parsed JSON from Gemini")

            # Validate colors sum to 100
            colors = parsed.get("colors", [])
            tot_col = sum(c.get("pct", 0) for c in colors)
            if colors and tot_col != 100:
                # Normalize percentages
                for c in colors:
                    c["pct"] = int(round(c.get("pct", 0) * 100 / max(tot_col, 1)))
                diff = 100 - sum(c["pct"] for c in colors)
                colors[0]["pct"] += diff

            # Validate fabrics sum to 100
            fabrics = parsed.get("fabric_materials", [])
            tot_fab = sum(f.get("pct", 0) for f in fabrics)
            if fabrics and tot_fab != 100:
                for f in fabrics:
                    f["pct"] = int(round(f.get("pct", 0) * 100 / max(tot_fab, 1)))
                diff = 100 - sum(f["pct"] for f in fabrics)
                fabrics[0]["pct"] += diff

            return {
                "id": item_id,
                "image_path": f"images/{img_filename}",
                "source_dataset": item["source"],
                "target_language": target_lang,
                "category_target": item["category_target"],
                "system_prompt": PROMPT_GARMENT_VISION,
                "user_prompt": user_msg,
                "teacher_model": "gemini-2.5-flash",
                "ground_truth": parsed,
            }

        except Exception as exc:
            wait_time = (2 ** attempt) + random.uniform(0.5, 1.5)
            logger.warning(
                "[%s] Attempt %d/%d failed (%s). Retrying in %.1fs...",
                item_id, attempt + 1, max_retries, exc, wait_time,
            )
            time.sleep(wait_time)

    logger.error("[%s] Failed after %d attempts. Skipping.", item_id, max_retries)
    return None


def main():
    parser = argparse.ArgumentParser(description="Distill DressApp Eyes Dataset using Gemini Flash")
    parser.add_argument("--output-dir", type=str, default="dataset_distilled", help="Output directory")
    parser.add_argument("--limit", type=int, default=5000, help="Total number of items to distill (default: 5000)")
    parser.add_argument("--workers", type=int, default=8, help="Number of concurrent workers (default: 8)")
    parser.add_argument("--dry-run", action="store_true", help="Plan and display sampling matrix without calling API")
    args = parser.parse_args()

    out_dir = Path(args.output_dir)
    images_dir = out_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    jsonl_path = out_dir / "curated_distilled_5k.jsonl"
    manifest_path = out_dir / "manifest.json"

    # Identify already completed IDs for checkpoint / resume
    completed_ids = set()
    if jsonl_path.exists():
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        record = json.loads(line)
                        completed_ids.add(record["id"])
                    except Exception:
                        pass
        logger.info("Found %d already annotated items in %s (will skip).", len(completed_ids), jsonl_path)

    # 1. Build Stratified Plan
    plan = build_sampling_plan()
    if args.limit and args.limit < len(plan):
        plan = plan[:args.limit]

    # Filter out already completed items
    pending_items = [item for item in plan if item["id"] not in completed_ids]
    logger.info("Total items in plan: %d | Pending to process: %d", len(plan), len(pending_items))

    # Print distribution breakdown
    cat_counts = {}
    lang_counts = {}
    for item in plan:
        c = item["category_target"]
        l = item["target_lang"]
        cat_counts[c] = cat_counts.get(c, 0) + 1
        lang_counts[l] = lang_counts.get(l, 0) + 1

    logger.info("Category Distribution: %s", cat_counts)
    logger.info("Language Distribution: %s", lang_counts)

    if args.dry_run:
        logger.info("Dry-run requested. Exiting without Gemini API calls.")
        return

    # 2. Initialize Gemini Client
    client = load_gemini_client()

    # 3. Execute Concurrently with Progress Saving
    success_count = len(completed_ids)
    fail_count = 0
    start_time = time.time()

    with open(jsonl_path, "a", encoding="utf-8") as jsonl_file:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
            future_to_item = {
                executor.submit(annotate_item, client, item, images_dir): item
                for item in pending_items
            }

            for idx, future in enumerate(concurrent.futures.as_completed(future_to_item)):
                item = future_to_item[future]
                try:
                    result = future.result()
                    if result:
                        jsonl_file.write(json.dumps(result, ensure_ascii=False) + "\n")
                        jsonl_file.flush()
                        success_count += 1
                        elapsed = time.time() - start_time
                        rate = success_count / max(elapsed, 1)
                        if success_count % 10 == 0 or success_count <= 20:
                            logger.info(
                                "Progress: [%d/%d] (%.1f%%) | Success: %d | Fail: %d | Speed: %.2f items/s | Latest: [%s] -> %s",
                                success_count, len(plan), (success_count / len(plan)) * 100,
                                success_count, fail_count, rate, result["target_language"],
                                result["ground_truth"]["name"][:35],
                            )
                    else:
                        fail_count += 1
                except Exception as exc:
                    logger.error("Worker error on %s: %s", item["id"], exc)
                    fail_count += 1

    # Write final manifest
    manifest = {
        "version": "1.0.0",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_items": success_count,
        "failed_items": fail_count,
        "categories": cat_counts,
        "languages": lang_counts,
        "teacher_model": "gemini-2.5-flash",
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    logger.info("Distillation pipeline completed! Saved %d items to %s", success_count, jsonl_path)


if __name__ == "__main__":
    main()
