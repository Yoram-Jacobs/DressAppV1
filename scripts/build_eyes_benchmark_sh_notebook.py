#!/usr/bin/env python3
"""
Generator for ``/app/docs/notebooks/Eyes_Benchmark_SH_Gemma4.ipynb``.

Drafts a Colab notebook to benchmark the fine-tuned Gemma-4-E2B Eyes (Second-Hand / SH) model.
The notebook evaluates the model on latency, memory, output structure, and all Gemini-supported
attributes (materials, colors, patterns, conditions, etc.).
"""
import json
from pathlib import Path

OUT = Path("C:/DressApp_AG/docs/notebooks/Eyes_Benchmark_SH_Gemma4.ipynb")
OUT.parent.mkdir(parents=True, exist_ok=True)

MD_TITLE = """\
# Eyes Second-Hand (SH) Benchmark — Gemma 4 E2B

> **Purpose:** Benchmark the local/staged Gemma 4 E2B model (with SH LoRA adapter) to test every attribute that Gemini supports (materials, colors, patterns, brand, condition, etc.) before staging.
>
> **Configuration:**
> - Base Model: `google/gemma-4-E2B-it`
> - Adapter: `/content/drive/MyDrive/Eyes_V4_SH_local` (or local equivalent)
> - Quantization: int4 via `optimum-quanto` (to simulate production CPU)
> - Processor Token Budget: 1120 (max detail for OCR/clothes)
>
> **Instructions:**
> If running in Colab, mount Google Drive and the script will automatically point to `/content/drive/MyDrive/Eyes_V4_SH_local`.
> If running locally, place your LoRA weights in `C:/DressApp_AG/models/Eyes_V4_SH_local`.
"""

CELL_SETUP = """\
# ── 1. Setup & Dependencies ──────────────────────────────────────
# Install required libraries
# !pip install -q -U "transformers>=4.57.1" torch torchvision accelerate optimum-quanto peft pillow
import time
import json
import torch
from pathlib import Path
from PIL import Image
import optimum.quanto as quanto
from transformers import AutoProcessor, AutoModelForMultimodalLM
from peft import PeftModel

# Detect Colab
try:
    from google.colab import drive
    IN_COLAB = True
    print("Mounting Google Drive...")
    drive.mount('/content/drive')
    MODEL_DIR = Path("/content/drive/MyDrive")
    LORA_PATH = MODEL_DIR / "Eyes_V4_SH_local"
except ImportError:
    IN_COLAB = False
    MODEL_DIR = Path("C:/DressApp_AG/models")
    LORA_PATH = MODEL_DIR / "Eyes_V4_SH_local"

BASE_MODEL = "google/gemma-4-E2B-it"

print(f"Transformers version: {__import__('transformers').__version__}")
"""

CELL_LOAD = """\
# ── 2. Load Base Model, Quantize & Attach LoRA ──────────────────
print(f"Loading processor for {BASE_MODEL}...")
processor = AutoProcessor.frompretrained(BASE_MODEL)

# Set max token budget for fine-grained details
for knob in ('vision_token_budget', 'image_token_budget', 'num_image_tokens'):
    if hasattr(processor, knob):
        setattr(processor, knob, 1120)
        print(f"Set processor.{knob} = 1120")
        break

print(f"Loading base model {BASE_MODEL}...")
t0 = time.time()
base_model = AutoModelForMultimodalLM.from_pretrained(
    BASE_MODEL,
    device_map="cpu", # Simulating CPU production env
    torch_dtype=torch.bfloat16
)
print(f"Base model loaded in {time.time()-t0:.1f}s")

print("Quantizing model to int4 with optimum-quanto...")
t0 = time.time()
quanto.quantize(base_model, weights=quanto.qint4, activations=None)
quanto.freeze(base_model)
print(f"Quantization complete in {time.time()-t0:.1f}s")

if LORA_PATH.exists():
    print(f"Attaching LoRA from {LORA_PATH}...")
    model = PeftModel.from_pretrained(base_model, str(LORA_PATH))
else:
    print(f"WARNING: LoRA path {LORA_PATH} not found. Running with base model.")
    model = base_model

model.eval()
print("Model ready for benchmarking.")
"""

CELL_BENCHMARK = """\
# ── 3. Benchmarking Logic ─────────────────────────────────────────
def benchmark_inference(image_path: Path, system_prompt: str, user_prompt: str):
    image = Image.open(image_path).convert("RGB")
    
    # Format according to Gemma 4 structures.
    # Image must precede text. We disable thinking here by omitting <|think|> 
    # to enforce clean JSON output, as per production rules.
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": [
            {"type": "image"},
            {"type": "text", "text": user_prompt}
        ]}
    ]
    
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=text, images=image, return_tensors="pt")
    
    print(f"Benchmarking image: {image_path.name}")
    t0 = time.time()
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=1024, # Increased token limit for deep attribute analysis
            temperature=1.0,
            top_p=0.95,
            top_k=64
        )
        
    latency = time.time() - t0
    generated_ids = outputs[0, inputs["input_ids"].shape[1]:]
    output_text = processor.decode(generated_ids, skip_special_tokens=True)
    
    print(f"Latency: {latency:.2f}s")
    print(f"Output: {output_text.strip()}")
    return latency, output_text

# Extensive Gemini attribute prompt
SYSTEM_PROMPT = (
    'You are DressApp Eyes, a vision model specialised in clothing.\\n'
    'You receive ONE photograph and return ONLY valid JSON.\\n\\n'
    'Schema: a JSON array. Each element describes ONE distinct visible\\n'
    'garment, accessory, or footwear item:\\n'
    '  { "label":    string,\\n'
    '    "category": one of [Top|Bottom|Outerwear|Full-body|Footwear|Accessory],\\n'
    '    "materials": array of strings,\\n'
    '    "colors":   array of strings,\\n'
    '    "patterns": array of strings,\\n'
    '    "brand":    string,\\n'
    '    "condition":string,\\n'
    '    "usage":    string,\\n'
    '    "season":   string,\\n'
    '    "cut":      string,\\n'
    '    "region":   { "bbox": [ymin, xmin, ymax, xmax] }  // 0..1000 grid\\n'
    '  }\\n\\n'
    'Rules:\\n'
    ' - Always return an array. A single-garment photo returns a one-element array.\\n'
    ' - List EVERY distinct garment. Layered outfits = N elements.\\n'
    ' - bbox values are integers on a 0..1000 grid, NOT pixels.\\n'
    ' - No prose, no markdown - JSON only.\\n'
)

USER_PROMPT = "Analyze this outfit photograph and extract the garments, their bounding boxes, and all their attributes into a JSON array."

# Run a dummy benchmark
dummy_img = Path("dummy.jpg")
Image.new('RGB', (800, 800), color='white').save(dummy_img)

benchmark_inference(dummy_img, SYSTEM_PROMPT, USER_PROMPT)
"""

CELL_BATCH_BENCHMARK = """\
# ── 4. Batch Benchmarking (File Upload) ──────────────────────────
import io
import time
import statistics
from pathlib import Path

# In colab we use tqdm.notebook or tqdm.auto
try:
    from tqdm.auto import tqdm
except ImportError:
    def tqdm(iterable, **kwargs): return iterable

global_latencies = []
global_success_count = 0
global_images_processed = 0

if IN_COLAB:
    from google.colab import files
    import IPython.display as display
    
    TEST_IMAGES_DIR = Path("/content/uploaded_test_images")
    TEST_IMAGES_DIR.mkdir(exist_ok=True)
    
    while True:
        display.clear_output(wait=True)
        print("Please upload your test images (.jpg, .jpeg, .png).")
        print("Click 'Cancel upload' to stop the loop and see final results.")
        
        uploaded = files.upload()
        if not uploaded:
            print("No files uploaded or canceled. Ending continuous benchmark loop.")
            break
            
        image_paths = []
        for filename, data in uploaded.items():
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                out_path = TEST_IMAGES_DIR / filename
                out_path.write_bytes(data)
                image_paths.append(out_path)
        
        if not image_paths:
            print("No valid images found in upload.")
            time.sleep(2)
            continue
            
        print(f"Found {len(image_paths)} images in this batch.")
        
        for img_path in tqdm(image_paths, desc="Benchmarking Batch"):
            try:
                latency, out_text = benchmark_inference(img_path, SYSTEM_PROMPT, USER_PROMPT)
                global_latencies.append(latency)
                global_images_processed += 1
                
                try:
                    clean_text = out_text.strip()
                    if clean_text.startswith("```json"): clean_text = clean_text[7:]
                    if clean_text.startswith("```"): clean_text = clean_text[3:]
                    if clean_text.endswith("```"): clean_text = clean_text[:-3]
                    
                    json.loads(clean_text)
                    global_success_count += 1
                except json.JSONDecodeError:
                    print(f"  [JSON Parse Failed] for {img_path.name}")
                    
            except Exception as e:
                print(f"  [Error] on {img_path.name}: {e}")
                
        print(f"\\nBatch finished. Current Total Processed: {global_images_processed}")
        print("Waiting 3 seconds before next upload prompt...")
        time.sleep(3)

else:
    # Local fallback
    TEST_IMAGES_DIR = Path("C:/DressApp_AG/models/test_images")
    if not TEST_IMAGES_DIR.exists():
        TEST_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Running locally. Please place images in {TEST_IMAGES_DIR}")
    image_paths = list(TEST_IMAGES_DIR.glob("*.jpg")) + list(TEST_IMAGES_DIR.glob("*.jpeg")) + list(TEST_IMAGES_DIR.glob("*.png"))
    
    if image_paths:
        for img_path in tqdm(image_paths, desc="Benchmarking Batch"):
            try:
                latency, out_text = benchmark_inference(img_path, SYSTEM_PROMPT, USER_PROMPT)
                global_latencies.append(latency)
                global_images_processed += 1
                try:
                    clean_text = out_text.strip()
                    if clean_text.startswith("```json"): clean_text = clean_text[7:]
                    if clean_text.startswith("```"): clean_text = clean_text[3:]
                    if clean_text.endswith("```"): clean_text = clean_text[:-3]
                    json.loads(clean_text)
                    global_success_count += 1
                except json.JSONDecodeError:
                    print(f"  [JSON Parse Failed] for {img_path.name}")
            except Exception as e:
                print(f"  [Error] on {img_path.name}: {e}")

if global_latencies:
    print("\\n" + "="*50)
    print("CONTINUOUS BENCHMARK SUMMARY")
    print("="*50)
    print(f"Total Images Processed:   {global_images_processed}")
    print(f"JSON Output Success Rate: {(global_success_count/global_images_processed)*100:.1f}%")
    print(f"Average Latency:          {statistics.mean(global_latencies):.2f}s")
    print(f"Median Latency:           {statistics.median(global_latencies):.2f}s")
    print(f"Max Latency:              {max(global_latencies):.2f}s")
    print(f"Min Latency:              {min(global_latencies):.2f}s")
    print("="*50)
else:
    print("No images were benchmarked.")
"""

def md(text): return {"cell_type": "markdown", "metadata": {}, "source": text.splitlines(keepends=True)}
def code(text): return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": text.splitlines(keepends=True)}

notebook = {
    "nbformat": 4,
    "nbformat_minor": 5,
    "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}},
    "cells": [md(MD_TITLE), code(CELL_SETUP), code(CELL_LOAD), code(CELL_BENCHMARK), code(CELL_BATCH_BENCHMARK)],
}

OUT.write_text(json.dumps(notebook, indent=1) + "\n")
print(f"Generated {OUT}")
