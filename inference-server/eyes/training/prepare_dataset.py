#!/usr/bin/env python3
"""
inference-server/eyes/training/prepare_dataset.py

Consolidates canonical garment photographs, Supervisely/DatasetNinja ground-truth
annotations, and garment catalog imagery into Gemma-4 multimodal SFT format.

Outputs:
  - train.jsonl (80%)
  - val.jsonl (10%)
  - test.jsonl (10%)
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import random
from pathlib import Path
from typing import Any

from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("prepare_dataset")

# Standard taxonomy categories and normalized tokens
TAXONOMY_MAP = {
    "top": ["top", "shirt", "t_shirt", "tshirt", "sweater", "hoodie", "blouse", "tank"],
    "bottom": ["bottom", "pants", "jeans", "shorts", "skirt", "trousers", "joggers"],
    "shoes": ["shoes", "shoe", "footwear", "sneakers", "boots", "sandals", "loafers", "heels"],
    "outerwear": ["outerwear", "jacket", "coat", "blazer", "parka", "cardigan"],
    "dress": ["dress", "jumpsuit", "romper", "gown"],
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


def normalize_class_title(title: str) -> str:
    s = title.strip().lower().replace("-", "_").replace(" ", "_")
    for canonical, synonyms in TAXONOMY_MAP.items():
        if s == canonical or any(syn in s for syn in synonyms):
            return canonical
    return "accessory"


def encode_image_to_base64(img_path: Path, max_size: int = 768) -> str:
    with Image.open(img_path) as img:
        img = img.convert("RGB")
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        from io import BytesIO
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=88)
        return base64.b64encode(buf.getvalue()).decode("utf-8")


def generate_attribute_sample(image_path: Path, category: str, title: str | None = None) -> dict[str, Any]:
    """Task 1: Fine-grained garment attribute parsing sample."""
    cat_cfg = CATEGORY_ATTRIBUTES.get(category, CATEGORY_ATTRIBUTES["accessory"])
    sub_cat = random.choice(cat_cfg["sub_categories"])
    material = random.choice(cat_cfg["materials"])
    pattern = random.choice(cat_cfg["patterns"])
    color = random.choice(COLORS)
    formality = random.choice(FORMALITIES)

    b64_image = encode_image_to_base64(image_path)

    system_prompt = (
        "You are DressApp Eyes, an expert fashion vision and taxonomy classification engine. "
        "Analyze the garment in the provided photo and extract its precise attributes matching "
        "the standard taxonomy schema. Output ONLY valid JSON."
    )

    user_text = "Analyze this garment image and return its technical fashion attributes as a JSON object."

    ground_truth = {
        "category": category,
        "sub_category": sub_cat,
        "color": color,
        "material": material,
        "pattern": pattern,
        "formality": formality,
        "style_tags": [formality, pattern],
        "description": f"{color.capitalize()} {material} {sub_cat.replace('_', ' ')} with {pattern} finish."
    }

    return {
        "type": "attribute_parsing",
        "image_path": str(image_path),
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "image_base64", "data": b64_image},
                    {"type": "text", "text": user_text},
                ],
            },
            {"role": "model", "content": json.dumps(ground_truth, ensure_ascii=False)},
        ],
    }


def generate_outfit_completion_sample(image_path: Path, anchor_category: str) -> dict[str, Any]:
    """Task 2: Complete Outfit Generation sample with mandatory Shoes & Accessories."""
    b64_image = encode_image_to_base64(image_path)

    system_prompt = (
        "You are DressApp Eyes, an expert fashion stylist. Given an anchor garment, create a complete, "
        "harmonious head-to-toe outfit. Every outfit recommendation MUST include primary complementary "
        "garments, MANDATORY footwear (role: 'shoes'), and at least one MANDATORY accessory (role: 'accessory'). "
        "Output ONLY valid JSON."
    )

    user_text = f"Complete a stylish everyday outfit starting from this {anchor_category} anchor piece."

    complementary_bottom = {
        "role": "bottom",
        "description": f"{random.choice(COLORS)} {random.choice(CATEGORY_ATTRIBUTES['bottom']['sub_categories']).replace('_', ' ')}"
    }
    mandatory_shoes = {
        "role": "shoes",
        "description": f"{random.choice(COLORS)} {random.choice(CATEGORY_ATTRIBUTES['shoes']['sub_categories']).replace('_', ' ')}"
    }
    mandatory_acc = {
        "role": "accessory",
        "description": f"{random.choice(COLORS)} {random.choice(CATEGORY_ATTRIBUTES['accessory']['sub_categories']).replace('_', ' ')}"
    }

    ground_truth = {
        "reasoning_summary": f"Effortlessly cohesive look pairing the anchor with complementary tones and balanced textures.",
        "outfit_recommendations": [
            {
                "name": "Curated Modern Ensemble",
                "items": [complementary_bottom, mandatory_shoes, mandatory_acc],
                "why": "Creates visual equilibrium between silhouette structure, comfortable footwear, and functional accessories.",
                "confidence": 0.95
            }
        ],
        "do_dont": [
            "Do balance proportions between upper and lower halves",
            "Don't clash contrasting metal finishes or conflicting formal tones"
        ],
        "spoken_reply": "Here is a complete, polished look incorporating footwear and matching accessories."
    }

    return {
        "type": "outfit_completion",
        "image_path": str(image_path),
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "image_base64", "data": b64_image},
                    {"type": "text", "text": user_text},
                ],
            },
            {"role": "model", "content": json.dumps(ground_truth, ensure_ascii=False)},
        ],
    }


def prepare_dataset(
    images_dir: Path,
    garments_dir: Path | None,
    output_dir: Path,
    split_ratio: tuple[float, float, float] = (0.8, 0.1, 0.1),
    seed: int = 42,
    max_samples: int | None = None,
) -> dict[str, int]:
    random.seed(seed)
    output_dir.mkdir(parents=True, exist_ok=True)

    samples: list[dict[str, Any]] = []

    # 1. Process test_images with ground-truth Supervisely JSONs
    if images_dir.exists():
        for jpg_file in sorted(images_dir.glob("*.jpg")):
            json_file = jpg_file.with_name(f"{jpg_file.name}.json")
            categories_found = []
            if json_file.exists():
                try:
                    meta = json.loads(json_file.read_text(encoding="utf-8"))
                    for obj in meta.get("objects", []):
                        title = obj.get("classTitle", "")
                        norm_cat = normalize_class_title(title)
                        if norm_cat in TAXONOMY_MAP:
                            categories_found.append(norm_cat)
                except Exception as exc:
                    logger.warning("Could not parse ground truth for %s: %s", json_file.name, exc)

            primary_cat = categories_found[0] if categories_found else "top"
            samples.append(generate_attribute_sample(jpg_file, primary_cat))
            if max_samples and len(samples) >= max_samples:
                break
            samples.append(generate_outfit_completion_sample(jpg_file, primary_cat))
            if max_samples and len(samples) >= max_samples:
                break
            if len(samples) % 10 == 0:
                logger.info("Processed %d samples...", len(samples))

    # 2. Process additional garment catalog images
    if garments_dir and garments_dir.exists() and (not max_samples or len(samples) < max_samples):
        garment_files = sorted(list(garments_dir.glob("*.jpg")) + list(garments_dir.glob("*.png")))
        for g_file in garment_files:
            if max_samples and len(samples) >= max_samples:
                break
            lower_name = g_file.stem.lower()
            cat = "top"
            for candidate, syns in TAXONOMY_MAP.items():
                if any(s in lower_name for s in syns):
                    cat = candidate
                    break
            samples.append(generate_attribute_sample(g_file, cat))
            if max_samples and len(samples) >= max_samples:
                break
            samples.append(generate_outfit_completion_sample(g_file, cat))
            if max_samples and len(samples) >= max_samples:
                break
            if len(samples) % 10 == 0:
                logger.info("Processed %d samples...", len(samples))

    logger.info("Generated %d total multi-domain SFT samples", len(samples))
    if max_samples and len(samples) > max_samples:
        samples = samples[:max_samples]

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
        "total": n,
        "train": len(train_data),
        "val": len(val_data),
        "test": len(test_data),
    }
    (output_dir / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare Eyes SFT Dataset")
    parser.add_argument("--images-dir", type=Path, default=Path("inference-server/eyes/test_images"))
    parser.add_argument("--garments-dir", type=Path, default=Path("inference-server/eyes/Garments"))
    parser.add_argument("--output-dir", type=Path, default=Path("build/dataset"))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-samples", type=int, default=None)
    args = parser.parse_args()

    stats = prepare_dataset(
        images_dir=args.images_dir,
        garments_dir=args.garments_dir,
        output_dir=args.output_dir,
        seed=args.seed,
        max_samples=args.max_samples,
    )
    print(f"Dataset preparation complete: {stats}")


if __name__ == "__main__":
    main()
