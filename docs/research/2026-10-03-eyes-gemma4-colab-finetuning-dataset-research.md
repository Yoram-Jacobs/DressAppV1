# Research Report: DressApp Eyes Gemma4-E4B Colab Fine-Tuning & Multi-Dataset Architecture

**Date:** 2026-10-03  
**Status:** Completed  
**Author:** AI Architecture & Vision Modeling Research  
**Target:** Deep dive into DressApp's analysis requirements across all 5 workflows, identify the optimal Hugging Face dataset combination for multi-category garment grounding, and design the complete Google Colab IPYNB workflow (GGUF VPS import, HF dataset ETL, QLoRA fine-tuning, GGUF quantization, evaluation, and VPS push).

---

## 1. Executive Summary

DressApp operates an on-premise inference engine (`dressapp-eyes`) running on a CPU-only Hetzner VPS (CPX32: 4 vCPUs, 8 GB RAM) powered by `llama-server` and `google/gemma-4-e4b-it`. 

In previous iterations, fine-tuning suffered from severe regressions (e.g., dress shoes becoming "Combat Boots", tank tops misclassified as "T-Shirts", model gender defaulting to "men", and hallucinations on accessories). Our forensic codebase inspection revealed the root causes:
1. **Randomized Synthetic Annotations:** Previous dataset preparation scripts (`prepare_dataset.py`) assigned random category enums (`random.choice`) to unlabelled images, destroying visual grounding.
2. **Missing Negative & Accessory Anchors:** Over-representing basic apparel while lacking clean cutouts of footwear (loafers, oxfords, boots, sandals) and accessories (sunglasses, handbags, belts, hats).
3. **Schema Drift:** Failing to constrain training targets to DressApp's exact JSON schema and the newly standardized Keyed Prompts.

### The Winning Dataset Combination:
To give the base Gemma-4 model definitive fashion comprehension across all categories without visual distortion, we select a **Tri-Dataset Hybrid Blend**:

| Dataset | Hub Source | Volume & Format | Primary Purpose in DressApp |
| :--- | :--- | :--- | :--- |
| **Primary: Studio Cutouts & Taxonomy** | [`ashraq/fashion-product-images-small`](https://huggingface.co/datasets/ashraq/fashion-product-images-small) | 44,072 items (271 MB Parquet with embedded PIL images) | **Visual grounding on clean cutouts** matching SegFormer/rembg output. Perfectly balanced across Tops, Bottoms, Footwear (loafers, heels, boots, sneakers), and Accessories (sunglasses, bags, belts, hats). |
| **Secondary: Dense Attribute & Texture** | [`Marqo/deepfashion-multimodal`](https://huggingface.co/datasets/Marqo/deepfashion-multimodal) | 42,537 image-text pairs (153 MB metadata) | **Fabric materials, textures, cuts, and patterns** (e.g. camouflage, herringbone, silk, linen, denim washes, neckline, collars). |
| **Tertiary: Outfits & Styling** | [`ArtmeScienceLab/Garments2Look`](https://huggingface.co/datasets/ArtmeScienceLab/Garments2Look) | 80,000 outfit pairs across 40+ categories | **Head-to-toe outfit coordination** with mandatory footwear and anatomical ordering for Scheduled Outfit and Stylist workflows. |

---

## 2. DressApp Analysis Requirements Across Workflows

The fine-tuning dataset must strictly reflect the contracts defined in [`backend/app/services/keyed_prompts.py`](file:///c:/DressApp_AG/backend/app/services/keyed_prompts.py):

### Workflow 1: `<garmentVision>` (Visual Clothing Analysis)
- **Descriptive Naming:** 2–4 unique words extracting cut and key attributes (e.g. *"Green Round-Toe Loafers"*, *"Navy Chinos"*, *"Camo Cargo Pants"*). Never generic (*"Green Garment"*, *"Clothing"*).
- **Taxonomy Differentiation:**
  - `category`: `Top`, `Bottom`, `Outerwear`, `Full Body`, `Footwear`, `Accessories`, `Underwear`.
  - `sub_category`: Specific cut (`T-Shirt`, `Sweater`, `Jeans`, `Pants`, `Skirt`, `Shoes`, `Sneakers`, `Sandals`, `Boots`, `Loafers`, `Sunglasses`, `Handbag`).
  - `item_type`: Detailed cut (`Crew-Neck T-Shirt`, `Chinos`, `Straight Jeans`, `Double Monk Strap Shoes`).
- **Strict 3-Tier Gender Hierarchy:**
  1. Human Model: Anchor to model's physical gender (`women` or `men`).
  2. Garment Cut Criteria: Flat-lays determined by cut (`women` for floral/blouses/skirts/sandals; `men` for masculine cuts; `unisex` for neutral basics).
  3. Neutral basics fallback to profile gender or `unisex`. Never default to `men`.
- **Attribute Math:** `colors` and `fabric_materials` arrays must sum to exactly 100%.
- **Pattern Vocabulary:** `solid`, `printed`, `geometric`, `striped`, `plaid`, `floral`, `camouflage`.

### Workflow 2: `<Scheduled Outfit>` (Daily Proposals)
- Complete looks only: (top+bottom OR dress) + mandatory footwear.
- Context matching: Forecast temperature, rain, calendar events, and occupation.

### Workflow 3: `<Stylist Chat>` (Conversational Stylist)
- Anatomical piece order: top/dress -> outerwear -> bottom -> shoes -> accessory.
- Spoken reply: 2–3 fluent sentences suitable for text-to-speech.

### Workflow 4: `<Suitcase>` (Capsule Packing Planner)
- Capsule efficiency: Reusing bottoms and outerwear across multiple days.
- Safety context & local boutique store recommendations.

### Workflow 5: `<Trend Scout>` (Fashion Journalism)
- Zero marketplaces (no Amazon/ASOS/Shein checkout links).
- Zero paywalls or dead links.

---

## 3. Colab IPYNB End-to-End Execution Architecture

The notebook is structured into 7 sequential, automated cells designed for Google Colab (Free T4 or Pro A100/L4):

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Environment & GPU Setup (PyTorch, PEFT, Unsloth/bitsandbytes, llama.cpp) │
├────────────────────────────────────────────────────────────────────────┤
│ 2. VPS Import: Fetch Base GGUF & MMPROJ from 178.105.144.142 via SCP   │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Hugging Face Dataset Ingestion & Category-Balanced ETL Matrix       │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Gemma-4 E4B Multimodal QLoRA Fine-Tuning (Rank 16, Alpha 32)        │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Model Merge & GGUF Quantization (Q3_K_M + Q4_K_M + mmproj-BF16)     │
├────────────────────────────────────────────────────────────────────────┤
│ 6. Validation & Regression Test Suite (Naming, Gender, Attributes)     │
├────────────────────────────────────────────────────────────────────────┤
│ 7. Deployment: Push Optimized GGUF to VPS & Restart dressapp-eyes      │
└────────────────────────────────────────────────────────────────────────┘
```

### Detailed Pipeline Mechanics:

1. **Import from VPS (`root@178.105.144.142`):**
   - Downloads `/srv/AI-Stylist/eyes_gguf/mmproj-BF16.gguf` (946 MB) and optionally existing `gemma-4-E4B-it-Q3_K_M.gguf`.
   - Uses `paramiko` or native `scp` with user-provided SSH key / password.

2. **Hugging Face Dataset Download:**
   - Loads `ashraq/fashion-product-images-small` (271 MB) with direct PIL image decoding.
   - Extracts 2,500 balanced samples (500 Tops, 500 Bottoms, 500 Footwear, 500 Accessories, 500 Outerwear/Dresses).
   - Formats input/target pairs using `PROMPT_GARMENT_VISION` and the canonical JSON schema.

3. **Fine-Tuning Execution:**
   - Base model: `google/gemma-4-e4b-it` loaded in 4-bit NF4 with double quantization.
   - LoRA target modules: Attention (`q_proj`, `k_proj`, `v_proj`, `o_proj`) and MLP (`gate_proj`, `up_proj`, `down_proj`).
   - Freeze vision tower to preserve native feature representation while tuning multimodal projection and language generation layers.
   - Training params: 3 epochs, effective batch size 16 (batch 4, gradient accumulation 4), learning rate 2e-4 with cosine decay.

4. **Quantization with `llama.cpp`:**
   - Merge LoRA adapter with base weights using `peft.merge_and_unload()`.
   - Convert merged Hugging Face checkpoint to intermediate F16 GGUF via `llama.cpp/convert_hf_to_gguf.py`.
   - Quantize to production CPX32 VPS target: `Q3_K_M` (~2.85 GB) and `Q4_K_M` (~3.4 GB) via `llama.cpp/llama-quantize`.

5. **Local Verification:**
   - Runs inference on canonical test images from `inference-server/eyes/test_images/`.
   - Verifies 100% JSON compliance, no generic names, correct 3-tier gender resolution, and camouflage attribute parsing.

6. **Push to VPS:**
   - Uploads new `gemma-4-E4B-it-Q3_K_M.gguf` to `/srv/AI-Stylist/eyes_gguf/`.
   - Executes remote container reload: `docker compose restart eyes`.
   - Validates `curl http://127.0.0.1:7860/healthz` returns `status: ok` and `mode: keyed_prompt_injection`.
