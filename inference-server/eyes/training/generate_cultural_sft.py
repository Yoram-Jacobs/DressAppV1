"""Generate distilled cultural garment dataset for Eyes LoRA fine-tuning."""
import json
from pathlib import Path

DATASET_PATH = Path("c:/DressApp_AG/inference-server/eyes/training/curated_cultural_sft_dataset.jsonl")

RECORDS = [
    {
        "type": "attribute_parsing",
        "expected_category": "outerwear",
        "image_path": "assets/cultural/blue_silk_achkan.jpg",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. "
                    "Analyze the garment crop with technical precision, adhering to canonical cultural taxonomy axioms. "
                    "Output raw JSON only matching the schema."
                ),
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Outerwear",
                    "sub_category": "Achkan",
                    "item_type": "Achkan",
                    "name": "Blue Silk Achkan",
                    "title": "Blue Silk Achkan",
                    "caption": "Royal blue raw silk achkan with standing mandarin collar and button placket.",
                    "colors": [{"name": "Blue", "pct": 95}, {"name": "Gold", "pct": 5}],
                    "fabric_materials": [{"name": "Raw Silk", "pct": 90}, {"name": "Cotton Lining", "pct": 10}],
                    "pattern": "solid",
                    "dress_code": "formal",
                    "gender": "men",
                    "model_gender": "men",
                    "season": ["fall", "winter", "spring"],
                    "tags": ["achkan", "sherwani", "bandhgala", "royal blue", "mandarin collar", "formal", "south asian"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "attribute_parsing",
        "expected_category": "outerwear",
        "image_path": "assets/cultural/ivory_embroidered_sherwani.jpg",
        "messages": [
            {
                "role": "system",
                "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema.",
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Outerwear",
                    "sub_category": "Sherwani",
                    "item_type": "Sherwani",
                    "name": "Ivory Embroidered Sherwani",
                    "title": "Ivory Embroidered Sherwani",
                    "caption": "Ivory silk sherwani featuring intricate gold thread embroidery and high mandarin collar.",
                    "colors": [{"name": "Ivory", "pct": 80}, {"name": "Gold", "pct": 20}],
                    "fabric_materials": [{"name": "Silk Brocade", "pct": 85}, {"name": "Silk Lining", "pct": 15}],
                    "pattern": "embroidered",
                    "dress_code": "formal",
                    "gender": "men",
                    "model_gender": "men",
                    "season": ["spring", "fall", "winter"],
                    "tags": ["sherwani", "wedding", "groom", "ivory", "gold embroidery", "mandarin collar"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "attribute_parsing",
        "expected_category": "outerwear",
        "image_path": "assets/cultural/black_bandhgala_suit.jpg",
        "messages": [
            {
                "role": "system",
                "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema.",
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Outerwear",
                    "sub_category": "Bandhgala",
                    "item_type": "Bandhgala",
                    "name": "Black Wool Bandhgala",
                    "title": "Black Wool Bandhgala",
                    "caption": "Black tailored wool bandhgala jacket with structured closed Nehru band collar.",
                    "colors": [{"name": "Black", "pct": 100}],
                    "fabric_materials": [{"name": "Wool", "pct": 95}, {"name": "Silk Satin", "pct": 5}],
                    "pattern": "solid",
                    "dress_code": "formal",
                    "gender": "men",
                    "model_gender": "men",
                    "season": ["fall", "winter"],
                    "tags": ["bandhgala", "jodhpuri suit", "mandarin collar", "formal", "tailored", "black"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "attribute_parsing",
        "expected_category": "outerwear",
        "image_path": "assets/cultural/raw_silk_nehru_jacket.jpg",
        "messages": [
            {
                "role": "system",
                "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema.",
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Outerwear",
                    "sub_category": "Nehru Jacket",
                    "item_type": "Nehru Jacket",
                    "name": "Maroon Silk Nehru Jacket",
                    "title": "Maroon Silk Nehru Jacket",
                    "caption": "Sleeveless maroon raw silk nehru jacket with standing collar and front buttons.",
                    "colors": [{"name": "Maroon", "pct": 90}, {"name": "Brass", "pct": 10}],
                    "fabric_materials": [{"name": "Raw Silk", "pct": 100}],
                    "pattern": "solid",
                    "dress_code": "smart-casual",
                    "gender": "men",
                    "model_gender": "men",
                    "season": ["spring", "summer", "fall", "winter"],
                    "tags": ["nehru jacket", "modi jacket", "waistcoat", "sleeveless", "maroon", "silk"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "attribute_parsing",
        "expected_category": "top",
        "image_path": "assets/cultural/white_cotton_kurta.jpg",
        "messages": [
            {
                "role": "system",
                "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema.",
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Top",
                    "sub_category": "Kurta",
                    "item_type": "Kurta",
                    "name": "White Cotton Kurta",
                    "title": "White Cotton Kurta",
                    "caption": "Pristine white pure cotton kurta with delicate hand-embroidered neckline.",
                    "colors": [{"name": "White", "pct": 100}],
                    "fabric_materials": [{"name": "Cotton", "pct": 100}],
                    "pattern": "embroidered",
                    "dress_code": "casual",
                    "gender": "men",
                    "model_gender": "men",
                    "season": ["spring", "summer"],
                    "tags": ["kurta", "chikankari", "cotton", "white", "traditional", "breathable"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "attribute_parsing",
        "expected_category": "top",
        "image_path": "assets/cultural/linen_guayabera_shirt.jpg",
        "messages": [
            {
                "role": "system",
                "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema.",
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Top",
                    "sub_category": "Guayabera",
                    "item_type": "Guayabera",
                    "name": "White Linen Guayabera",
                    "title": "White Linen Guayabera",
                    "caption": "Formal white 100% linen guayabera featuring four pockets and dual vertical alforza pleats.",
                    "colors": [{"name": "White", "pct": 100}],
                    "fabric_materials": [{"name": "Linen", "pct": 100}],
                    "pattern": "pleated",
                    "dress_code": "smart-casual",
                    "gender": "men",
                    "model_gender": "men",
                    "season": ["spring", "summer"],
                    "tags": ["guayabera", "cuban wedding", "linen", "pleated", "alforzas", "caribbean"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "attribute_parsing",
        "expected_category": "dress",
        "image_path": "assets/cultural/black_dubai_abaya.jpg",
        "messages": [
            {
                "role": "system",
                "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema.",
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Full Body",
                    "sub_category": "Abaya",
                    "item_type": "Abaya",
                    "name": "Black Nida Abaya",
                    "title": "Black Nida Abaya",
                    "caption": "Elegant black flowing nida fabric abaya with modest loose drape and wide sleeves.",
                    "colors": [{"name": "Black", "pct": 100}],
                    "fabric_materials": [{"name": "Nida", "pct": 100}],
                    "pattern": "solid",
                    "dress_code": "formal",
                    "gender": "women",
                    "model_gender": "women",
                    "season": ["all"],
                    "tags": ["abaya", "modest", "black", "nida", "gulf", "islamic attire"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "attribute_parsing",
        "expected_category": "top",
        "image_path": "assets/cultural/saudi_white_thobe.jpg",
        "messages": [
            {
                "role": "system",
                "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema.",
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Full Body",
                    "sub_category": "Thobe",
                    "item_type": "Thobe",
                    "name": "White Formal Thobe",
                    "title": "White Formal Thobe",
                    "caption": "Crisp white ankle-length thobe with structured stiff standing collar and buttoned placket.",
                    "colors": [{"name": "White", "pct": 100}],
                    "fabric_materials": [{"name": "Cotton Polyester", "pct": 100}],
                    "pattern": "solid",
                    "dress_code": "formal",
                    "gender": "men",
                    "model_gender": "men",
                    "season": ["all"],
                    "tags": ["thobe", "kandura", "dishdasha", "white", "traditional", "gulf"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "attribute_parsing",
        "expected_category": "dress",
        "image_path": "assets/cultural/emerald_moroccan_kaftan.jpg",
        "messages": [
            {
                "role": "system",
                "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema.",
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Full Body",
                    "sub_category": "Kaftan",
                    "item_type": "Kaftan",
                    "name": "Emerald Moroccan Kaftan",
                    "title": "Emerald Moroccan Kaftan",
                    "caption": "Emerald green silk velvet kaftan embroidered with handmade gold sfifa and mdamma belt.",
                    "colors": [{"name": "Emerald Green", "pct": 80}, {"name": "Gold", "pct": 20}],
                    "fabric_materials": [{"name": "Silk Velvet", "pct": 85}, {"name": "Gold Zari Thread", "pct": 15}],
                    "pattern": "embroidered",
                    "dress_code": "formal",
                    "gender": "women",
                    "model_gender": "women",
                    "season": ["fall", "winter"],
                    "tags": ["kaftan", "moroccan", "takchita", "emerald", "gold embroidery", "ceremonial"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "attribute_parsing",
        "expected_category": "dress",
        "image_path": "assets/cultural/banarasi_silk_saree.jpg",
        "messages": [
            {
                "role": "system",
                "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema.",
            },
            {
                "role": "user",
                "content": "<image>\nAnalyze this garment crop and output technical fashion attributes as raw JSON.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "is_clothing": True,
                    "category": "Full Body",
                    "sub_category": "Saree",
                    "item_type": "Saree",
                    "name": "Crimson Banarasi Saree",
                    "title": "Crimson Banarasi Saree",
                    "caption": "Crimson red handwoven Banarasi pure silk saree with heavy gold brocade pallu.",
                    "colors": [{"name": "Crimson Red", "pct": 75}, {"name": "Gold", "pct": 25}],
                    "fabric_materials": [{"name": "Banarasi Silk", "pct": 80}, {"name": "Metallic Zari", "pct": 20}],
                    "pattern": "zari",
                    "dress_code": "formal",
                    "gender": "women",
                    "model_gender": "women",
                    "season": ["all"],
                    "tags": ["saree", "sari", "banarasi", "wedding", "gold brocade", "crimson"]
                }, ensure_ascii=False),
            }
        ]
    },
    {
        "type": "outfit_completion",
        "anchor_category": "outerwear",
        "image_path": "assets/cultural/blue_silk_achkan.jpg",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are DressApp Eyes, an expert fashion stylist. Given an anchor garment, create a complete, "
                    "harmonious head-to-toe outfit adhering to cultural dress codes and mandatory footwear/accessories. "
                    "Output ONLY valid JSON."
                ),
            },
            {
                "role": "user",
                "content": "<image>\nComplete a formal South Asian wedding guest look starting from this Blue Silk Achkan anchor piece.",
            },
            {
                "role": "model",
                "content": json.dumps({
                    "reasoning_summary": "Regal ceremonial ensemble pairing the royal blue silk achkan with tapered ivory churidar pants, hand-embroidered leather mojari footwear, and a gold silk pocket square.",
                    "outfit_recommendations": [
                        {
                            "name": "Royal Celebratory Achkan Look",
                            "items": [
                                {"role": "bottom", "description": "Ivory cotton-silk churidar trousers with gathered ankle folds"},
                                {"role": "shoes", "description": "Gold and blue hand-embroidered leather mojari juttis with curved toe"},
                                {"role": "accessory", "description": "Tussar silk gold zari pocket square"}
                            ],
                            "why": "The tapered ivory churidar balances the knee-length structured achkan coat, while traditional mojaris provide authentic formal elegance without Western suit clashing.",
                            "confidence": 0.98
                        }
                    ],
                    "do_dont": [
                        "Do pair with tapered churidar or straight salwar pants and traditional mojaris",
                        "Don't pair with western denim jeans, sneakers, neckties, or lapel pins"
                    ],
                    "spoken_reply": "Here is an authentic, regal ceremonial look pairing your blue silk achkan with ivory churidars and gold mojaris."
                }, ensure_ascii=False),
            }
        ]
    }
]

with open(DATASET_PATH, "w", encoding="utf-8") as f:
    for rec in RECORDS:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

print(f"Successfully generated {len(RECORDS)} distilled cultural records at {DATASET_PATH}")
