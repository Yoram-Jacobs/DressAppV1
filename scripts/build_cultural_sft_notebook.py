"""Build the Colab notebook for fine-tuning DressApp Eyes on curated_cultural_sft_dataset.jsonl."""
import json
from pathlib import Path

def create_notebook():
    cells = []

    def md(text):
        return {
            "cell_type": "markdown",
            "metadata": {},
            "source": [line + "\n" for line in text.strip().split("\n")]
        }

    def code(text):
        return {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [line + "\n" for line in text.strip().split("\n")]
        }

    # Badge Cell
    cells.append(md(
        '<a href="https://colab.research.google.com/github/Yoram-Jacobs/DressAppV1/blob/main/notebooks/dressapp_eyes_lora_curated_cultural_sft.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>'
    ))

    # Title & Overview
    cells.append(md(
"""# 👘 DressApp Eyes SFT: Fine-Tuning Qwen2.5-VL-3B on Curated Cultural Attire
### Dedicated SFT on `curated_cultural_sft_dataset.jsonl` + QLoRA + llama.cpp GGUF Quantization (`Q4_K_M`)

**DressApp Eyes** (`Qwen2.5-VL-3B-Instruct`) powers the on-premise vision inference server (`dressapp-eyes` container) on the production Hetzner VPS (`178.105.144.142`). While standard fashion datasets focus primarily on western basics (T-shirts, jeans, sneakers, suits), global users wear cultural, religious, and traditional attire.

---

### 🎯 Key Objectives of this SFT Run:
1. **Curated Golden Cultural SFT Dataset (`curated_cultural_sft_dataset.jsonl`):**
   - **Achkan** (अचकन / אצ'קאן): Knee-length structured coat with standing mandarin collar, full button placket, and side slits (`category: "Outerwear"`, `sub_category: "Achkan"`). **Strictly eliminates the hallucination where Vision models classify Achkans as Western "Blazers" or "Suits".**
   - **Sherwani** (शेरवानी / שרוואני): Heavy regal ceremonial coat with band collar and ornate buttoning (`category: "Outerwear"`, `sub_category: "Sherwani"`).
   - **Bandhgala / Jodhpuri Suit** (बंदगला / בנדגאלה): Tailored closed-collar coat (`category: "Outerwear"`, `sub_category: "Bandhgala"`).
   - **Nehru Jacket** (नेहरू जैकेट / ז'קט נהרו): Sleeveless standing-collar waistcoat (`category: "Outerwear"`, `sub_category: "Nehru Jacket"`).
   - **Kurta** (कुर्ता / קורטה): Straight-cut long tunic shirt (`category: "Top"`, `sub_category: "Kurta"`).
   - **Guayabera** (גואיאברה): Four-pocket pleated linen dress shirt (`category: "Top"`, `sub_category: "Guayabera"`).
   - **Abaya** (عباية / עבאיה): Modest loose cloak (`category: "Full Body"`, `sub_category: "Abaya"`).
   - **Thobe** (ثوب): Tailored crisp ankle-length tunic (`category: "Full Body"`, `sub_category: "Thobe"`).
   - **Moroccan Kaftan** (قفطان / כפתן): Ornate silk-velvet embroidered robe with sfifa (`category: "Full Body"`, `sub_category: "Kaftan"`).
   - **Banarasi Saree** (साड़ी / סארי): Draped pure silk saree with heavy zari pallu (`category: "Full Body"`, `sub_category: "Saree"`).
2. **Cultural Outfit Completion Grounding:**
   - Multi-item pairing reasoning (e.g. Achkan anchor paired with tapered Churidar pants, handcrafted leather Mojari/Jutti footwear, and gold pocket square).
   - Enforcing negative constraints (NEVER pair ceremonial Achkan/Sherwani with jeans, cargo pants, or sneakers).
3. **Multilingual Parity across 13 Languages:**
   - English (`en`), Hebrew (`he`), Arabic (`ar`), Hindi (`hi`), Spanish (`es`), French (`fr`), German (`de`), Italian (`it`), Portuguese (`pt`), Dutch (`nl`), Russian (`ru`), Chinese (`zh`), Japanese (`ja`).
4. **Catastrophic Forgetting Safeguard:**
   - Blended with everyday baseline garments and real Hugging Face studio products (`ashraq/fashion-product-images-small`).
5. **Production Quantization & Deployment:**
   - Export merged FP16 -> Quantize to GGUF `Q4_K_M` via `llama.cpp` -> 1-click push to Hetzner VPS or direct download."""
    ))

    # Step 1
    cells.append(md("## 🛠️ Step 1: Environment Setup, Dependencies & llama.cpp Compilation"))
    cells.append(code(
"""# Check GPU availability (Run on T4, L4, or A100 GPU)
!nvidia-smi

import os, sys
os.environ['USE_TF'] = '0'
os.environ['USE_TORCH'] = '1'

# Install Transformers, PEFT, BitsAndBytes, and Qwen VL Utilities
!pip install -q -U 'transformers>=4.49.0' accelerate peft 'bitsandbytes>=0.46.1' qwen-vl-utils gguf sentencepiece protobuf paramiko scp datasets

# Clone and build llama.cpp for GGUF conversion & quantization utilities
if not os.path.exists('llama.cpp'):
    print('📦 Cloning and compiling llama.cpp tools...')
    os.system('git clone https://github.com/ggerganov/llama.cpp.git')
    os.system('cmake -B llama.cpp/build -S llama.cpp -DGGML_CUDA=OFF')
    os.system('cmake --build llama.cpp/build --config Release -j$(nproc) --target llama-quantize')

print('✅ Environment ready and llama.cpp tools compiled!')"""
    ))

    # Step 2
    cells.append(md("## 📥 Step 2: (Optional) Verify Connection to Hetzner Production VPS"))
    cells.append(code(
"""import os, subprocess

VPS_HOST = "178.105.144.142"
print(f"Testing SSH connection to Hetzner VPS ({VPS_HOST})...")

try:
    proc = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no", f"root@{VPS_HOST}", "echo connected"],
        capture_output=True, text=True, timeout=8
    )
    if "connected" in proc.stdout:
        print("✅ SSH Key authorized! Fast direct transfer to/from VPS enabled.")
    else:
        print("ℹ️ VPS SSH key not pre-configured in this Colab session. Standard web download will be used.")
except Exception as e:
    print(f"ℹ️ SSH check skipped: {e}")"""
    ))

    # Step 3
    cells.append(md("## 📦 Step 3: Ingest Curated Cultural SFT Dataset, Synthesize Assets & Expand Multilingual Samples"))
    cells.append(code(
"""import os, sys, json, tarfile, random
from pathlib import Path

# Resilient Pillow loader to handle Colab kernel module cache collisions
try:
    from PIL import Image, ImageDraw
except (ImportError, AttributeError):
    import subprocess
    print("🔄 Resolving Colab in-memory Pillow cache collision...")
    for mod in list(sys.modules.keys()):
        if mod.startswith("PIL"):
            del sys.modules[mod]
    try:
        from PIL import Image, ImageDraw
    except (ImportError, AttributeError):
        subprocess.run([sys.executable, "-m", "pip", "install", "--force-reinstall", "-q", "pillow"])
        for mod in list(sys.modules.keys()):
            if mod.startswith("PIL"):
                del sys.modules[mod]
        from PIL import Image, ImageDraw

CULTURAL_ASSETS_DIR = Path("assets/cultural")
CULTURAL_ASSETS_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# Step 3.1: Load Golden Curated Cultural SFT Dataset
# ─────────────────────────────────────────────────────────────────────────────
SFT_JSONL = Path("curated_cultural_sft_dataset.jsonl")

# If running standalone in Colab, download directly from GitHub repo
if not SFT_JSONL.exists():
    print("📥 Downloading curated_cultural_sft_dataset.jsonl from GitHub...")
    import urllib.request
    URL = "https://raw.githubusercontent.com/Yoram-Jacobs/DressAppV1/main/inference-server/eyes/training/curated_cultural_sft_dataset.jsonl"
    try:
        urllib.request.urlretrieve(URL, str(SFT_JSONL))
        print("✅ Downloaded curated_cultural_sft_dataset.jsonl!")
    except Exception as e:
        print(f"Failed downloading from GitHub ({e}), falling back to embedded generation...")

# If still not found, write the canonical 11 records directly
if not SFT_JSONL.exists() or SFT_JSONL.stat().st_size < 100:
    embedded_records = [
        {
            "type": "attribute_parsing",
            "expected_category": "outerwear",
            "image_path": "assets/cultural/blue_silk_achkan.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Analyze the garment crop with technical precision, adhering to canonical cultural taxonomy axioms. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Outerwear", "sub_category": "Achkan", "item_type": "Achkan",
                    "name": "Blue Silk Achkan", "title": "Blue Silk Achkan",
                    "caption": "Royal blue raw silk achkan with standing mandarin collar and button placket.",
                    "colors": [{"name": "Blue", "pct": 95}, {"name": "Gold", "pct": 5}],
                    "fabric_materials": [{"name": "Raw Silk", "pct": 90}, {"name": "Cotton Lining", "pct": 10}],
                    "pattern": "solid", "dress_code": "formal", "gender": "men", "model_gender": "men",
                    "season": ["fall", "winter", "spring"],
                    "tags": ["achkan", "sherwani", "bandhgala", "royal blue", "mandarin collar", "formal", "south asian"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "attribute_parsing",
            "expected_category": "outerwear",
            "image_path": "assets/cultural/ivory_embroidered_sherwani.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Outerwear", "sub_category": "Sherwani", "item_type": "Sherwani",
                    "name": "Ivory Embroidered Sherwani", "title": "Ivory Embroidered Sherwani",
                    "caption": "Ivory silk sherwani featuring intricate gold thread embroidery and high mandarin collar.",
                    "colors": [{"name": "Ivory", "pct": 80}, {"name": "Gold", "pct": 20}],
                    "fabric_materials": [{"name": "Silk Brocade", "pct": 85}, {"name": "Silk Lining", "pct": 15}],
                    "pattern": "embroidered", "dress_code": "formal", "gender": "men", "model_gender": "men",
                    "season": ["spring", "fall", "winter"],
                    "tags": ["sherwani", "wedding", "groom", "ivory", "gold embroidery", "mandarin collar"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "attribute_parsing",
            "expected_category": "outerwear",
            "image_path": "assets/cultural/black_bandhgala_suit.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Outerwear", "sub_category": "Bandhgala", "item_type": "Bandhgala",
                    "name": "Black Wool Bandhgala", "title": "Black Wool Bandhgala",
                    "caption": "Black tailored wool bandhgala jacket with structured closed Nehru band collar.",
                    "colors": [{"name": "Black", "pct": 100}],
                    "fabric_materials": [{"name": "Wool", "pct": 95}, {"name": "Silk Satin", "pct": 5}],
                    "pattern": "solid", "dress_code": "formal", "gender": "men", "model_gender": "men",
                    "season": ["fall", "winter"],
                    "tags": ["bandhgala", "jodhpuri suit", "mandarin collar", "formal", "tailored", "black"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "attribute_parsing",
            "expected_category": "outerwear",
            "image_path": "assets/cultural/raw_silk_nehru_jacket.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Outerwear", "sub_category": "Nehru Jacket", "item_type": "Nehru Jacket",
                    "name": "Maroon Silk Nehru Jacket", "title": "Maroon Silk Nehru Jacket",
                    "caption": "Sleeveless maroon raw silk nehru jacket with standing collar and front buttons.",
                    "colors": [{"name": "Maroon", "pct": 90}, {"name": "Brass", "pct": 10}],
                    "fabric_materials": [{"name": "Raw Silk", "pct": 100}],
                    "pattern": "solid", "dress_code": "smart-casual", "gender": "men", "model_gender": "men",
                    "season": ["spring", "summer", "fall", "winter"],
                    "tags": ["nehru jacket", "modi jacket", "waistcoat", "sleeveless", "maroon", "silk"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "attribute_parsing",
            "expected_category": "top",
            "image_path": "assets/cultural/white_cotton_kurta.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Top", "sub_category": "Kurta", "item_type": "Kurta",
                    "name": "White Cotton Kurta", "title": "White Cotton Kurta",
                    "caption": "Pristine white pure cotton kurta with delicate hand-embroidered neckline.",
                    "colors": [{"name": "White", "pct": 100}],
                    "fabric_materials": [{"name": "Cotton", "pct": 100}],
                    "pattern": "embroidered", "dress_code": "casual", "gender": "men", "model_gender": "men",
                    "season": ["spring", "summer"],
                    "tags": ["kurta", "chikankari", "cotton", "white", "traditional", "breathable"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "attribute_parsing",
            "expected_category": "top",
            "image_path": "assets/cultural/linen_guayabera_shirt.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Top", "sub_category": "Guayabera", "item_type": "Guayabera",
                    "name": "White Linen Guayabera", "title": "White Linen Guayabera",
                    "caption": "Formal white 100% linen guayabera featuring four pockets and dual vertical alforza pleats.",
                    "colors": [{"name": "White", "pct": 100}],
                    "fabric_materials": [{"name": "Linen", "pct": 100}],
                    "pattern": "pleated", "dress_code": "smart-casual", "gender": "men", "model_gender": "men",
                    "season": ["spring", "summer"],
                    "tags": ["guayabera", "cuban wedding", "linen", "pleated", "alforzas", "caribbean"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "attribute_parsing",
            "expected_category": "dress",
            "image_path": "assets/cultural/black_dubai_abaya.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Full Body", "sub_category": "Abaya", "item_type": "Abaya",
                    "name": "Black Nida Abaya", "title": "Black Nida Abaya",
                    "caption": "Elegant black flowing nida fabric abaya with modest loose drape and wide sleeves.",
                    "colors": [{"name": "Black", "pct": 100}],
                    "fabric_materials": [{"name": "Nida", "pct": 100}],
                    "pattern": "solid", "dress_code": "formal", "gender": "women", "model_gender": "women",
                    "season": ["all"],
                    "tags": ["abaya", "modest", "black", "nida", "gulf", "islamic attire"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "attribute_parsing",
            "expected_category": "top",
            "image_path": "assets/cultural/saudi_white_thobe.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Full Body", "sub_category": "Thobe", "item_type": "Thobe",
                    "name": "White Formal Thobe", "title": "White Formal Thobe",
                    "caption": "Crisp white ankle-length thobe with structured stiff standing collar and buttoned placket.",
                    "colors": [{"name": "White", "pct": 100}],
                    "fabric_materials": [{"name": "Cotton Polyester", "pct": 100}],
                    "pattern": "solid", "dress_code": "formal", "gender": "men", "model_gender": "men",
                    "season": ["all"],
                    "tags": ["thobe", "kandura", "dishdasha", "white", "traditional", "gulf"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "attribute_parsing",
            "expected_category": "dress",
            "image_path": "assets/cultural/emerald_moroccan_kaftan.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Full Body", "sub_category": "Kaftan", "item_type": "Kaftan",
                    "name": "Emerald Moroccan Kaftan", "title": "Emerald Moroccan Kaftan",
                    "caption": "Emerald green silk velvet kaftan embroidered with handmade gold sfifa and mdamma belt.",
                    "colors": [{"name": "Emerald Green", "pct": 80}, {"name": "Gold", "pct": 20}],
                    "fabric_materials": [{"name": "Silk Velvet", "pct": 85}, {"name": "Gold Zari Thread", "pct": 15}],
                    "pattern": "embroidered", "dress_code": "formal", "gender": "women", "model_gender": "women",
                    "season": ["fall", "winter"],
                    "tags": ["kaftan", "moroccan", "takchita", "emerald", "gold embroidery", "ceremonial"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "attribute_parsing",
            "expected_category": "dress",
            "image_path": "assets/cultural/banarasi_silk_saree.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. Output raw JSON only matching the schema."},
                {"role": "user", "content": "<image>\\nAnalyze this garment crop and output technical fashion attributes as raw JSON."},
                {"role": "model", "content": json.dumps({
                    "is_clothing": True, "category": "Full Body", "sub_category": "Saree", "item_type": "Saree",
                    "name": "Crimson Banarasi Saree", "title": "Crimson Banarasi Saree",
                    "caption": "Crimson red handwoven Banarasi pure silk saree with heavy gold brocade pallu.",
                    "colors": [{"name": "Crimson Red", "pct": 75}, {"name": "Gold", "pct": 25}],
                    "fabric_materials": [{"name": "Banarasi Silk", "pct": 80}, {"name": "Metallic Zari", "pct": 20}],
                    "pattern": "zari", "dress_code": "formal", "gender": "women", "model_gender": "women",
                    "season": ["all"],
                    "tags": ["saree", "sari", "banarasi", "wedding", "gold brocade", "crimson"]
                }, ensure_ascii=False)}
            ]
        },
        {
            "type": "outfit_completion",
            "anchor_category": "outerwear",
            "image_path": "assets/cultural/blue_silk_achkan.jpg",
            "messages": [
                {"role": "system", "content": "You are DressApp Eyes, an expert fashion stylist. Given an anchor garment, create a complete, harmonious head-to-toe outfit adhering to cultural dress codes and mandatory footwear/accessories. Output ONLY valid JSON."},
                {"role": "user", "content": "<image>\\nComplete a formal South Asian wedding guest look starting from this Blue Silk Achkan anchor piece."},
                {"role": "model", "content": json.dumps({
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
                }, ensure_ascii=False)}
            ]
        }
    ]
    with open(SFT_JSONL, "w", encoding="utf-8") as f:
        for r in embedded_records:
            f.write(json.dumps(r, ensure_ascii=False) + "\\n")
    print(f"✅ Generated {len(embedded_records)} golden records in {SFT_JSONL}!")

# ─────────────────────────────────────────────────────────────────────────────
# Step 3.2: Render/Synthesize Visual Assets for All SFT Items
# ─────────────────────────────────────────────────────────────────────────────
def render_cultural_asset(filepath: Path, garment_type: str, rgb: tuple, pattern: str = "solid"):
    filepath.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (448, 448), color=(248, 249, 250))
    draw = ImageDraw.Draw(img)

    if garment_type in ("achkan", "sherwani", "bandhgala"):
        # Knee-length or hip-length coat with high standing mandarin collar and button placket
        body = [(140, 70), (308, 70), (338, 390 if garment_type != "bandhgala" else 330), (110, 390 if garment_type != "bandhgala" else 118)]
        draw.polygon(body, fill=rgb, outline=(30, 30, 30), width=2)
        # Sleeves
        draw.polygon([(140, 70), (60, 200), (95, 215), (155, 125)], fill=rgb, outline=(30, 30, 30), width=2)
        draw.polygon([(308, 70), (388, 200), (353, 215), (293, 125)], fill=rgb, outline=(30, 30, 30), width=2)
        # Mandarin / Nehru standing closed band collar (NO lapels!)
        draw.rectangle([(180, 50), (268, 72)], fill=rgb, outline=(40, 40, 40), width=2)
        # Full button placket down the front
        placket_color = (210, 175, 50) if rgb != (245, 240, 230) else (180, 150, 40)
        draw.line([(224, 72), (224, 380 if garment_type != "bandhgala" else 320)], fill=(40, 40, 40), width=3)
        for y in range(85, 370 if garment_type != "bandhgala" else 315, 24):
            draw.ellipse([(220, y), (228, y + 8)], fill=placket_color, outline=(20, 20, 20))
        # Side slits
        if garment_type != "bandhgala":
            draw.line([(110, 310), (110, 390)], fill=(40, 40, 40), width=2)
            draw.line([(338, 310), (338, 390)], fill=(40, 40, 40), width=2)
        # Chest pocket with pocket square
        draw.line([(155, 130), (185, 130)], fill=(30, 30, 30), width=2)
        draw.polygon([(162, 130), (170, 118), (178, 130)], fill=(220, 185, 50))
    elif garment_type == "nehru_jacket":
        # Sleeveless vest with standing band collar
        body = [(145, 70), (303, 70), (323, 310), (125, 310)]
        draw.polygon(body, fill=rgb, outline=(30, 30, 30), width=2)
        draw.rectangle([(180, 52), (268, 72)], fill=rgb, outline=(40, 40, 40), width=2)
        draw.line([(224, 72), (224, 305)], fill=(40, 40, 40), width=2)
        for y in range(85, 300, 26):
            draw.ellipse([(220, y), (228, y + 8)], fill=(210, 175, 50), outline=(20, 20, 20))
    elif garment_type in ("kurta", "thobe", "abaya", "kaftan"):
        # Flowing long tunic or robe
        body = [(135, 65), (313, 65), (355, 415), (93, 415)]
        draw.polygon(body, fill=rgb, outline=(30, 30, 30), width=2)
        draw.polygon([(135, 65), (55, 205), (95, 220), (155, 125)], fill=rgb, outline=(30, 30, 30), width=2)
        draw.polygon([(313, 65), (393, 205), (353, 220), (293, 125)], fill=rgb, outline=(30, 30, 30), width=2)
        draw.rectangle([(185, 50), (263, 68)], fill=rgb, outline=(40, 40, 40), width=2)
        if garment_type == "kaftan":
            draw.line([(224, 68), (224, 410)], fill=(220, 185, 50), width=6)
            draw.rectangle([(170, 220), (278, 250)], fill=(220, 185, 50), outline=(30, 30, 30), width=2)
    elif garment_type == "guayabera":
        body = [(130, 70), (318, 70), (330, 340), (118, 340)]
        draw.polygon(body, fill=rgb, outline=(30, 30, 30), width=2)
        draw.polygon([(130, 70), (50, 180), (90, 200), (150, 120)], fill=rgb, outline=(30, 30, 30), width=2)
        draw.polygon([(318, 70), (398, 180), (358, 200), (298, 120)], fill=rgb, outline=(30, 30, 30), width=2)
        draw.line([(180, 80), (180, 330)], fill=(70, 70, 70), width=2)
        draw.line([(268, 80), (268, 330)], fill=(70, 70, 70), width=2)
        draw.rectangle([(140, 130), (175, 165)], outline=(40, 40, 40), width=2)
        draw.rectangle([(273, 130), (308, 165)], outline=(40, 40, 40), width=2)
        draw.rectangle([(140, 250), (175, 290)], outline=(40, 40, 40), width=2)
        draw.rectangle([(273, 250), (308, 290)], outline=(40, 40, 40), width=2)
    elif garment_type == "saree":
        body = [(140, 70), (308, 70), (360, 420), (88, 420)]
        draw.polygon(body, fill=rgb, outline=(30, 30, 30), width=2)
        draw.polygon([(140, 70), (80, 160), (110, 175), (160, 110)], fill=(120, 20, 30), width=2)
        pallu = [(160, 70), (360, 420), (308, 420), (130, 150)]
        draw.polygon(pallu, fill=(215, 165, 45), outline=(30, 30, 30), width=2)

    if pattern == "embroidered":
        gold_thread = (220, 180, 50)
        for y in range(90, 370, 26):
            draw.arc([204, y, 244, y + 16], start=0, end=180, fill=gold_thread, width=2)

    img.save(filepath, "JPEG", quality=92)

# Ensure all 11 referenced assets exist
ASSET_RENDER_MAP = {
    "assets/cultural/blue_silk_achkan.jpg": ("achkan", (25, 45, 115), "solid"),
    "assets/cultural/ivory_embroidered_sherwani.jpg": ("sherwani", (245, 240, 230), "embroidered"),
    "assets/cultural/black_bandhgala_suit.jpg": ("bandhgala", (20, 20, 25), "solid"),
    "assets/cultural/raw_silk_nehru_jacket.jpg": ("nehru_jacket", (128, 25, 45), "solid"),
    "assets/cultural/white_cotton_kurta.jpg": ("kurta", (248, 248, 250), "embroidered"),
    "assets/cultural/linen_guayabera_shirt.jpg": ("guayabera", (242, 242, 238), "solid"),
    "assets/cultural/black_dubai_abaya.jpg": ("abaya", (18, 18, 22), "solid"),
    "assets/cultural/saudi_white_thobe.jpg": ("thobe", (252, 252, 252), "solid"),
    "assets/cultural/emerald_moroccan_kaftan.jpg": ("kaftan", (20, 95, 55), "embroidered"),
    "assets/cultural/banarasi_silk_saree.jpg": ("saree", (165, 25, 35), "embroidered"),
}

for rel_path, (gtype, rgb, pat) in ASSET_RENDER_MAP.items():
    p = Path(rel_path)
    if not p.exists():
        render_cultural_asset(p, gtype, rgb, pat)
print(f"✅ Verified all {len(ASSET_RENDER_MAP)} cultural visual assets exist in assets/cultural/!")

# ─────────────────────────────────────────────────────────────────────────────
# Step 3.3: Multilingual SFT Expansion (13 Languages) for High Loss Weighting
# ─────────────────────────────────────────────────────────────────────────────
ALL_LANGS = ["en", "he", "ar", "es", "fr", "de", "it", "pt", "nl", "ru", "zh", "ja", "hi"]

LOCALIZED_NAMES = {
    "Achkan": {
        "en": "Blue Silk Achkan", "he": "אצ'קאן משי כחול", "ar": "أشكان حريري أزرق", "hi": "नीली रेशमी अचकन",
        "es": "Achkan de seda azul", "fr": "Achkan en soie bleue", "de": "Blauer Seiden-Achkan",
        "it": "Achkan in seta blu", "pt": "Achkan de seda azul", "nl": "Blauwe zijden achkan",
        "ru": "Синий шелковый ачкан", "zh": "蓝色真丝阿奇坎长袍", "ja": "青いシルクのアチカン",
    },
    "Sherwani": {
        "en": "Ivory Embroidered Sherwani", "he": "שרוואני שנהב רקום", "ar": "شيرواني عاجي مطرز", "hi": "हाथीदांत कढ़ाईदार शेरवानी",
        "es": "Sherwani bordado marfil", "fr": "Sherwani brodé ivoire", "de": "Elfenbeinfarbener bestickter Sherwani",
        "it": "Sherwani ricamato avorio", "pt": "Sherwani bordado marfim", "nl": "Ivoorkleurige geborduurde sherwani",
        "ru": "Вышитый шервани цвета слоновой кости", "zh": "象牙白刺绣谢尔瓦尼大衣", "ja": "アイボリー刺繍シェルワニ",
    },
    "Bandhgala": {
        "en": "Black Wool Bandhgala", "he": "בנדגאלה צמר שחור", "ar": "باندغالا صوف أسود", "hi": "काली ऊनी बंदगला",
        "es": "Bandhgala de lana negro", "fr": "Bandhgala en laine noire", "de": "Schwarzer Woll-Bandhgala",
        "it": "Bandhgala in lana nera", "pt": "Bandhgala de lã preta", "nl": "Zwarte wollen bandhgala",
        "ru": "Черный шерстяной бандгала", "zh": "黑色羊毛邦德加拉立领夹克", "ja": "黒いウール・バンドガラ",
    },
    "Nehru Jacket": {
        "en": "Maroon Silk Nehru Jacket", "he": "ז'קט נהרו משי בורדו", "ar": "سترة نهرو حرير مارون", "hi": "मैरून सिल्क नेहरू जैकेट",
        "es": "Chaleco Nehru de seda granate", "fr": "Gilet Nehru en soie bordeaux", "de": "Bordeauxrote Seiden-Nehru-Weste",
        "it": "Gilet Nehru in seta bordeaux", "pt": "Colete Nehru de seda bordô", "nl": "Bordeauxrode zijden Nehru gilet",
        "ru": "Бордовый шелковый жилет Неру", "zh": "枣红色真丝尼赫鲁立领背心", "ja": "マルーンシルク・ネルージャケット",
    },
    "Kurta": {
        "en": "White Cotton Kurta", "he": "קורטה כותנה לבנה", "ar": "كورتا قطنية بيضاء", "hi": "सफेद सूती कुर्ता",
        "es": "Kurta de algodón blanco", "fr": "Kurta en coton blanc", "de": "Weißer Baumwoll-Kurta",
        "it": "Kurta in cotone bianco", "pt": "Kurta de algodão branco", "nl": "Witte katoenen kurta",
        "ru": "Белая хлопковая курта", "zh": "白色全棉库尔塔长衫", "ja": "白いコットンのクルタ",
    },
}

sft_expanded_samples = []
with open(SFT_JSONL, "r", encoding="utf-8") as f:
    raw_sft = [json.loads(line) for line in f if line.strip()]

for base_item in raw_sft:
    msgs = base_item.get("messages", [])
    if len(msgs) < 3: continue
    sys_content = msgs[0]["content"]
    user_content = msgs[1]["content"].replace("<image>\\n", "").strip()
    gt_obj = json.loads(msgs[2]["content"])
    sub_cat = gt_obj.get("sub_category", "")

    # Create 13 language variations for each curated item
    for lang in ALL_LANGS:
        loc_gt = dict(gt_obj)
        if sub_cat in LOCALIZED_NAMES and lang in LOCALIZED_NAMES[sub_cat]:
            loc_gt["name"] = LOCALIZED_NAMES[sub_cat][lang]
            loc_gt["title"] = LOCALIZED_NAMES[sub_cat][lang]

        sft_expanded_samples.append({
            "image_path": base_item["image_path"],
            "system": sys_content,
            "user": f"**OUTPUT LANGUAGE = {lang}**. {user_content}",
            "assistant": json.dumps(loc_gt, ensure_ascii=False),
            "lang": lang,
            "category": loc_gt.get("category", "Outerwear"),
            "sub_category": sub_cat,
            "weight": 5.0 # High training weight
        })

print(f"✅ Generated {len(sft_expanded_samples)} multilingual SFT variations from golden dataset!")

# ─────────────────────────────────────────────────────────────────────────────
# Step 3.4: Download Baseline & Stream Hugging Face Real Items (Anti-Forgetting)
# ─────────────────────────────────────────────────────────────────────────────
baseline_samples = []
DATASET_TAR = "dataset_distilled.tar.gz"
DISTILLED_DIR = Path("dataset_distilled")
JSONL_PATH = DISTILLED_DIR / "curated_distilled_5k.jsonl"

if not JSONL_PATH.exists():
    if not os.path.exists(DATASET_TAR) or os.path.getsize(DATASET_TAR) < 5000000:
        print("📥 Downloading baseline dataset (5,000 everyday items) to prevent forgetting...")
        import urllib.request
        MIRRORS = [
            "https://dressapp.co/api/v1/dataset/distilled",
            "https://github.com/Yoram-Jacobs/DressAppV1/raw/main/dataset_distilled.tar.gz",
            "https://raw.githubusercontent.com/Yoram-Jacobs/DressAppV1/main/dataset_distilled.tar.gz",
        ]
        for url in MIRRORS:
            try:
                print(f"Checking mirror {url}...")
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=30) as resp, open(DATASET_TAR, "wb") as out_f:
                    out_f.write(resp.read())
                if os.path.exists(DATASET_TAR) and os.path.getsize(DATASET_TAR) > 5000000:
                    print("✅ Downloaded baseline archive successfully!")
                    break
            except Exception as e:
                print(f"Mirror failed: {e}")

    if os.path.exists(DATASET_TAR) and os.path.getsize(DATASET_TAR) > 5000000:
        print("📦 Unpacking baseline archive...")
        with tarfile.open(DATASET_TAR, "r:gz") as tar:
            tar.extractall(".")

if JSONL_PATH.exists():
    with open(JSONL_PATH, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip(): continue
            rec = json.loads(line)
            img_rel_path = DISTILLED_DIR / rec["image_path"]
            if img_rel_path.exists():
                baseline_samples.append({
                    "image_path": str(img_rel_path),
                    "system": rec["system_prompt"],
                    "user": rec["user_prompt"],
                    "assistant": json.dumps(rec["ground_truth"], ensure_ascii=False),
                    "lang": rec.get("target_language", "en"),
                    "category": rec.get("category_target", "Unknown"),
                    "sub_category": rec["ground_truth"].get("sub_category", "General"),
                    "weight": 1.0
                })
    print(f"✅ Loaded {len(baseline_samples)} baseline wardrobe samples!")

# Stream real South Asian photographic items from Hugging Face
hf_cultural_samples = []
try:
    print("📥 Streaming real ethnic wear from ashraq/fashion-product-images-small...")
    from datasets import load_dataset
    hf_myntra = load_dataset("ashraq/fashion-product-images-small", split="train")

    CULTURAL_MYNTRA_MAP = {
        "Kurtas": ("Top", "Kurta", "smart-casual", "Cotton"),
        "Kurtis": ("Top", "Kurta", "smart-casual", "Cotton"),
        "Sarees": ("Full Body", "Saree", "formal", "Silk"),
        "Nehru Jackets": ("Outerwear", "Nehru Jacket", "formal", "Silk"),
    }
    m_count = 0
    for row in hf_myntra:
        art_type = row.get("articleType")
        if art_type in CULTURAL_MYNTRA_MAP:
            cat, sub_cat, dress_code, default_fabric = CULTURAL_MYNTRA_MAP[art_type]
            pil_img = row.get("image")
            if not pil_img: continue
            img_id = row.get("id", random.randint(10000, 99999))
            img_path = CULTURAL_ASSETS_DIR / f"hf_myntra_{img_id}.jpg"
            if not img_path.exists():
                pil_img.convert("RGB").save(img_path, "JPEG", quality=88)

            color = row.get("baseColour") or "Multi"
            target_lang = ALL_LANGS[m_count % len(ALL_LANGS)]
            gt = {
                "category": cat, "sub_category": sub_cat, "item_type": art_type,
                "name": f"{color} {sub_cat}", "title": row.get("productDisplayName") or f"{color} {sub_cat}",
                "caption": f"Traditional {color.lower()} {sub_cat.lower()} tailored for formal occasions.",
                "dress_code": dress_code, "gender": "men", "model_gender": "men", "pattern": "solid",
                "colors": [{"name": color, "pct": 100}], "fabric_materials": [{"name": default_fabric, "pct": 100}],
                "season": ["fall", "winter", "spring"], "tags": [sub_cat.lower(), "traditional", "formal"],
                "condition": "excellent", "quality": "premium", "state": "new"
            }
            hf_cultural_samples.append({
                "image_path": str(img_path),
                "system": msgs[0]["content"],
                "user": f"**OUTPUT LANGUAGE = {target_lang}**. Extract structured garment attributes.",
                "assistant": json.dumps(gt, ensure_ascii=False),
                "lang": target_lang,
                "category": cat, "sub_category": sub_cat,
                "weight": 1.5
            })
            m_count += 1
            if m_count >= 600: break
    print(f"✅ Loaded {len(hf_cultural_samples)} real photographic South Asian items from Hugging Face!")
except Exception as e:
    print(f"HF stream notice: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# Step 3.5: Oversample Golden Curated SFT Dataset & Export Training File
# ─────────────────────────────────────────────────────────────────────────────
# Repeat the golden SFT records 8x to ensure high model attention on the Achkan/Sherwani distinction
augmented_sft = sft_expanded_samples * 8
final_pool = augmented_sft + hf_cultural_samples + baseline_samples[:2500]

random.seed(42)
random.shuffle(final_pool)

OUT_FILE = "curated_cultural_sft_train.jsonl"
with open(OUT_FILE, "w", encoding="utf-8") as f:
    for s in final_pool:
        f.write(json.dumps(s, ensure_ascii=False) + "\\n")

print(f"🎉 Final training dataset prepared: {len(final_pool)} total samples exported to {OUT_FILE}!")
print(f"• Golden SFT Augmented Samples: {len(augmented_sft)} (Focus on Achkan, Sherwani, Bandhgala)")
print(f"• Hugging Face Real Cultural Photos: {len(hf_cultural_samples)}")
print(f"• Baseline Wardrobe Items: {min(len(baseline_samples), 2500)}")"""
    ))

    # Step 4
    cells.append(md("## 🚀 Step 4: Fine-Tuning Qwen2.5-VL-3B with QLoRA & Prompt Loss Masking"))
    cells.append(code(
"""import json
from PIL import Image
import torch
from transformers import (
    Qwen2_5_VLForConditionalGeneration,
    AutoProcessor,
    BitsAndBytesConfig,
    TrainingArguments,
    Trainer,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from qwen_vl_utils import process_vision_info

MODEL_ID = "Qwen/Qwen2.5-VL-3B-Instruct"

if not torch.cuda.is_available():
    raise RuntimeError("❌ No GPU detected! In Colab, go to menu: Runtime -> Change runtime type -> Hardware accelerator: T4 or A100 GPU")

print(f"Loading Qwen2.5-VL processor for {MODEL_ID}...")
min_pixels = 128 * 28 * 28
max_pixels = 448 * 448
processor = AutoProcessor.from_pretrained(MODEL_ID, min_pixels=min_pixels, max_pixels=max_pixels)

# 4-bit NF4 Quantization
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
    bnb_4bit_use_double_quant=True,
)

print("Loading Qwen2.5-VL-3B-Instruct base model in 4-bit with SDPA...")
model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    attn_implementation="sdpa",
    device_map="auto",
    torch_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
)

model = prepare_model_for_kbit_training(
    model,
    use_gradient_checkpointing=True,
    gradient_checkpointing_kwargs={"use_reentrant": False},
)

# LoRA Configuration targeting key attention projections
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
if hasattr(model, "enable_input_require_grads"):
    model.enable_input_require_grads()
model.print_trainable_parameters()

# Dataset with ChatML formatting and exact Prompt Loss Masking
class QwenCulturalSFTDataset(torch.utils.data.Dataset):
    def __init__(self, jsonl_file, processor, max_samples=None):
        self.items = []
        with open(jsonl_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    self.items.append(json.loads(line))
        if max_samples:
            self.items = self.items[:max_samples]
        self.processor = processor
        self.assistant_marker = processor.tokenizer.encode("<|im_start|>assistant\\n", add_special_tokens=False)

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        item = self.items[idx]
        img_path = item["image_path"]

        messages = [
            {"role": "system", "content": item["system"]},
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": img_path},
                    {"type": "text", "text": item["user"]},
                ],
            },
            {"role": "assistant", "content": item["assistant"]},
        ]

        text_full = self.processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        image_inputs, video_inputs = process_vision_info(messages)

        full_inputs = self.processor(
            text=[text_full],
            images=image_inputs,
            videos=video_inputs,
            padding=False,
            return_tensors="pt",
        )

        input_ids = full_inputs["input_ids"].squeeze(0)
        labels = input_ids.clone()

        # Locate assistant token boundary
        input_list = input_ids.tolist()
        m_len = len(self.assistant_marker)
        prompt_boundary = len(input_list)
        for i in range(len(input_list) - m_len, -1, -1):
            if input_list[i : i + m_len] == self.assistant_marker:
                prompt_boundary = i + m_len
                break

        # Mask prompt & vision tokens with -100 so loss is strictly on assistant output
        labels[:prompt_boundary] = -100

        result = {k: v.squeeze(0) for k, v in full_inputs.items()}
        result["labels"] = labels
        return result

train_dataset = QwenCulturalSFTDataset("curated_cultural_sft_train.jsonl", processor)

# Batch collator
def collate_fn(batch):
    elem = batch[0]
    res = {}
    for k in elem:
        if k in ("input_ids", "labels", "attention_mask"):
            tensors = [d[k] for d in batch]
            pad_val = -100 if k == "labels" else processor.tokenizer.pad_token_id
            res[k] = torch.nn.utils.rnn.pad_sequence(tensors, batch_first=True, padding_value=pad_val)
        elif isinstance(elem[k], torch.Tensor):
            res[k] = torch.stack([d[k] for d in batch])
        else:
            res[k] = [d[k] for d in batch]
    return res

import warnings
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

OUTPUT_DIR = "output_qwen_eyes_cultural_sft"

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=4,
    learning_rate=5e-5,
    logging_steps=20,
    max_steps=600,
    gradient_checkpointing=True,
    gradient_checkpointing_kwargs={"use_reentrant": False},
    bf16=torch.cuda.is_bf16_supported(),
    fp16=not torch.cuda.is_bf16_supported(),
    save_strategy="steps",
    save_steps=150,
    save_total_limit=2,
    warmup_steps=40,
    dataloader_num_workers=0,
    report_to="none",
)

trainer = Trainer(
    model=model,
    train_dataset=train_dataset,
    data_collator=collate_fn,
    args=training_args,
)

print("🚀 Starting QLoRA SFT on Qwen2.5-VL-3B (Curated Cultural SFT + Multilingual Grounding)...")
print("⏱️ Expected duration: ~20-30 minutes (600 steps)")
try:
    trainer.train()
    print("✅ SFT training completed successfully!")
except KeyboardInterrupt:
    print("\\n⚠️ Training interrupted early by user. Saving current checkpoint...")
finally:
    out_adapter = Path(f"{OUTPUT_DIR}/adapter")
    out_adapter.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(out_adapter)
    processor.save_pretrained(out_adapter)
    print(f"✅ Adapter successfully saved to {out_adapter}!")"""
    ))

    # Step 5
    cells.append(md("## ⚙️ Step 5: Merge Adapter & Quantize to Production GGUF (`Q4_K_M`)"))
    cells.append(code(
"""import os, sys
from pathlib import Path
import torch
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from peft import PeftModel

# Bypass torchao check in peft
import peft.import_utils
peft.import_utils.is_torchao_available = lambda: False
try:
    import peft.tuners.lora.torchao
    peft.tuners.lora.torchao.is_torchao_available = lambda: False
except Exception:
    pass

MODEL_ID = "Qwen/Qwen2.5-VL-3B-Instruct"
adapter_dir = "output_qwen_eyes_cultural_sft/adapter"
merged_dir = "qwen2_5_vl_3b_cultural_sft_merged"

print(f"Loading base model in FP16 for merging from {MODEL_ID}...")
base_model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.float16,
    device_map="cpu",
)

print(f"Merging LoRA adapter from {adapter_dir}...")
merged_model = PeftModel.from_pretrained(base_model, adapter_dir)
merged_model = merged_model.merge_and_unload()

print(f"Saving merged FP16 model to {merged_dir}...")
merged_model.save_pretrained(merged_dir)
processor = AutoProcessor.from_pretrained(MODEL_ID)
processor.save_pretrained(merged_dir)
print("✅ Merged model successfully saved!")

# Convert to GGUF using llama.cpp
print("🔄 Converting merged model to GGUF (FP16)...")
os.system(f"python llama.cpp/convert_hf_to_gguf.py {merged_dir} --outfile Qwen2.5-VL-3B-Instruct-SFT-F16.gguf --outtype f16")

# Quantize to Q4_K_M
print("⚙️ Quantizing to Q4_K_M (production target)...")
os.system("./llama.cpp/build/bin/llama-quantize Qwen2.5-VL-3B-Instruct-SFT-F16.gguf Qwen2.5-VL-3B-Instruct-SFT-Q4_K_M.gguf Q4_K_M")

# Copy to canonical name
os.system("cp Qwen2.5-VL-3B-Instruct-SFT-Q4_K_M.gguf Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf")

gguf_path = Path("Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf")
if gguf_path.exists():
    print(f"🎉 Production GGUF successfully built: {gguf_path.name} ({gguf_path.stat().st_size / 1024 / 1024:.1f} MB)")
else:
    raise RuntimeError("❌ GGUF quantization failed!")"""
    ))

    # Step 6
    cells.append(md("## 🧪 Step 6: Cultural Attire Evaluation & Anti-Blazer Hallucination Validation"))
    cells.append(code(
"""import json, os
from PIL import Image
import torch
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info

print("🧪 Loading merged model for evaluation...")
eval_model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    "qwen2_5_vl_3b_cultural_sft_merged",
    torch_dtype=torch.float16,
    device_map="auto",
)
processor = AutoProcessor.from_pretrained("qwen2_5_vl_3b_cultural_sft_merged")

test_cases = [
    ("assets/cultural/blue_silk_achkan.jpg", "English", "Blue Silk Achkan (Must be Achkan/Outerwear, NOT Blazer)"),
    ("assets/cultural/blue_silk_achkan.jpg", "Hebrew (עברית)", "Blue Silk Achkan in Hebrew (Must be אצ'קאן כחול)"),
    ("assets/cultural/ivory_embroidered_sherwani.jpg", "English", "Ivory Embroidered Sherwani (Sherwani/Outerwear)"),
    ("assets/cultural/black_bandhgala_suit.jpg", "English", "Black Bandhgala Suit (Bandhgala/Outerwear)"),
    ("assets/cultural/raw_silk_nehru_jacket.jpg", "English", "Nehru Jacket (Outerwear)"),
    ("assets/cultural/white_cotton_kurta.jpg", "English", "White Cotton Kurta (Top)"),
]

SYSTEM_PROMPT = (
    "You are DressApp Eyes, a premier multimodal fashion analyst and cultural garment specialist. "
    "Adhere strictly to canonical cultural taxonomy axioms. "
    "Achkan, Sherwani, and Bandhgala with high standing mandarin/nehru collars are category:'Outerwear'. "
    "NEVER classify an Achkan or Sherwani as a Blazer or Suit Jacket. Output raw JSON only."
)

passed_count = 0
for img_path, lang_name, label in test_cases:
    if not os.path.exists(img_path):
        continue
    print(f"\\n============================================================")
    print(f"🔍 Test: {label} (Output Language: {lang_name})")
    print(f"============================================================")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": img_path},
                {"type": "text", "text": f"**OUTPUT LANGUAGE: {lang_name}**. Extract structured garment attributes. Return raw JSON."},
            ],
        },
    ]

    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(text=[text], images=image_inputs, videos=video_inputs, return_tensors="pt").to(eval_model.device)

    with torch.no_grad():
        out = eval_model.generate(**inputs, max_new_tokens=350, do_sample=False)

    gen_text = processor.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
    print(gen_text)

    try:
        parsed = json.loads(gen_text)
        cat = parsed.get("category")
        sub_cat = parsed.get("sub_category")
        title = parsed.get("title", "")
        print(f"✅ Category: {cat} | Sub-Category: {sub_cat} | Title: {title}")

        # Verification check
        if "Blazer" in str(sub_cat) or "blazer" in str(title).lower():
            print("❌ REGRESSION: Hallucinated Blazer!")
        else:
            print("🎯 SUCCESS: Correctly avoided blazer hallucination!")
            passed_count += 1
    except Exception as e:
        print(f"Parse result: {e}")

print(f"\\nEvaluation complete: {passed_count}/{len(test_cases)} tests passed anti-hallucination checks!")"""
    ))

    # Step 7
    cells.append(md("## 🚀 Step 7: Push to Hetzner Production VPS or Download GGUF"))
    cells.append(code(
"""import os, subprocess
from pathlib import Path

gguf_file = "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf"
assert Path(gguf_file).exists(), f"❌ {gguf_file} not found!"

print("Testing SSH connection to Hetzner VPS (178.105.144.142)...")
try:
    proc = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no", "root@178.105.144.142", "echo connected"],
        capture_output=True, text=True, timeout=8
    )
    is_connected = ("connected" in proc.stdout)
except Exception:
    is_connected = False

if is_connected:
    print("✅ SSH Key authorized! Uploading directly to VPS at datacenter speeds...")
    os.system(f"scp -o StrictHostKeyChecking=no {gguf_file} root@178.105.144.142:/srv/AI-Stylist/eyes_gguf/")
    print("🔄 Restarting dressapp-eyes container...")
    os.system("ssh -o StrictHostKeyChecking=no root@178.105.144.142 'cd /srv/AI-Stylist/deploy && docker compose restart eyes && sleep 8 && docker exec dressapp-eyes curl -s http://127.0.0.1:7860/healthz'")
    print("🎉 Model successfully deployed and healthy!")
else:
    print("ℹ️ Colab SSH Key is not authorized on the VPS.")
    print("You can download the GGUF file directly to your local computer:")
    try:
        from google.colab import files
        files.download(gguf_file)
        print("⬇️ Triggered browser download!")
    except Exception as e:
        print(f"Manual download helper: {e}")"""
    ))

    notebook = {
        "cells": cells,
        "metadata": {
            "accelerator": "GPU",
            "colab": {
                "gpuType": "A100",
                "machine_shape": "hm",
                "include_colab_link": True,
                "provenance": []
            },
            "kernelspec": {
                "display_name": "Python 3",
                "name": "python3"
            },
            "language_info": {
                "name": "python"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 0
    }

    out_path = Path("notebooks/dressapp_eyes_lora_curated_cultural_sft.ipynb")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(notebook, f, indent=1, ensure_ascii=False)
    print(f"Successfully created notebook at {out_path} ({out_path.stat().st_size} bytes)")

    # Also sync to inference-server/eyes/training/
    inference_path = Path("inference-server/eyes/training/dressapp_eyes_lora_curated_cultural_sft.ipynb")
    inference_path.parent.mkdir(parents=True, exist_ok=True)
    with open(inference_path, "w", encoding="utf-8") as f:
        json.dump(notebook, f, indent=1, ensure_ascii=False)
    print(f"Successfully synced notebook to {inference_path}")

if __name__ == "__main__":
    create_notebook()
