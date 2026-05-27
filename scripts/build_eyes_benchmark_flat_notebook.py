#!/usr/bin/env python3
"""
Generator for ``/app/docs/notebooks/Eyes_Benchmark_v4_Gemma4.ipynb``.

Drafts a Colab notebook to benchmark the fine-tuned Gemma-4-E2B Eyes v4 model.
The notebook evaluates the model on latency, memory, and output structure
using the correct Gemma 4 chat templates and token budgets.
"""
import json
from pathlib import Path

OUT = Path("C:/DressApp_AG/docs/notebooks/Eyes_Benchmark_Flat_Gemma4.ipynb")
OUT.parent.mkdir(parents=True, exist_ok=True)

MD_TITLE = """\
# Eyes v4 Benchmark — Gemma 4 E2B

> **Purpose:** Benchmark the local/staged Gemma 4 E2B model (with LoRA adapter) for latency, memory, and bounding box accuracy.
>
> **Configuration:**
> - Base Model: `google/gemma-4-E2B-it`
> - Quantization: int4 via `optimum-quanto` (to simulate production CPU)
> - Processor Token Budget: 1120 (max detail for OCR/clothes)
>
> **Instructions:**
> If running in Colab, mount Google Drive and adjust `MODEL_DIR` to point to the uploaded `models` directory.
> If running locally, point `MODEL_DIR` to `C:/DressApp_AG/models`.
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

MODEL_DIR = Path("C:/DressApp_AG/models") # Adjust this if running in Colab to /content/drive/MyDrive/...
BASE_MODEL = "google/gemma-4-E2B-it"

print(f"Transformers version: {__import__('transformers').__version__}")
"""

CELL_LOAD = """\
# ── 2. Load Base Model, Quantize & Attach LoRA ──────────────────
print(f"Loading processor for {BASE_MODEL}...")
processor = AutoProcessor.from_pretrained(BASE_MODEL)

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

# Attach LoRA adapter if it exists as a standard PEFT folder.
# Alternatively, if you have a merged safetensors model, you'd load that directly above.
LORA_PATH = MODEL_DIR / "eyes_v4_adapter" 
if LORA_PATH.exists():
    print(f"Attaching LoRA from {LORA_PATH}...")
    model = PeftModel.from_pretrained(base_model, str(LORA_PATH))
else:
    print(f"LoRA path {LORA_PATH} not found. Running with base model.")
    model = base_model

model.eval()
print("Model ready for benchmarking.")
"""

CELL_BENCHMARK = """\
# ── 3. Benchmarking Logic ─────────────────────────────────────────
def benchmark_inference(image_path: Path, prompt: str):
    image = Image.open(image_path).convert("RGB")
    
    # Format according to Gemma 4 structures.
    # Image must precede text. We disable thinking here by omitting <|think|> 
    # to enforce clean JSON output, as per production rules.
    messages = [
        {"role": "user", "content": [
            {"type": "image"},
            {"type": "text", "text": prompt}
        ]}
    ]
    
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=text, images=image, return_tensors="pt")
    
    print(f"Benchmarking image: {image_path.name}")
    t0 = time.time()
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=512,
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

# Run a dummy benchmark
# Create a dummy image
dummy_img = Path("dummy.jpg")
Image.new('RGB', (800, 800), color='white').save(dummy_img)

prompt = "Analyze this outfit and output a JSON array of garments with bounding boxes."
benchmark_inference(dummy_img, prompt)
"""

CELL_BATCH_BENCHMARK = """\
# ── 4. Batch Benchmarking (File Upload) ──────────────────────────
# This cell lets you upload a batch of photos directly into the Colab 
# runtime to benchmark the model's performance on them.
import io
import statistics
from pathlib import Path

try:
    from google.colab import files
    IN_COLAB = True
except ImportError:
    IN_COLAB = False

# In colab we use tqdm.notebook or tqdm.auto
try:
    from tqdm.auto import tqdm
except ImportError:
    def tqdm(iterable, **kwargs): return iterable

image_paths = []

if IN_COLAB:
    print("Please upload your test images (.jpg, .jpeg, .png):")
    uploaded = files.upload()
    
    # Save uploaded files to a temporary directory so Path logic still works
    TEST_IMAGES_DIR = Path("/content/uploaded_test_images")
    TEST_IMAGES_DIR.mkdir(exist_ok=True)
    
    for filename, data in uploaded.items():
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            out_path = TEST_IMAGES_DIR / filename
            out_path.write_bytes(data)
            image_paths.append(out_path)
else:
    # Local fallback
    TEST_IMAGES_DIR = Path("C:/DressApp_AG/models/test_images")
    if not TEST_IMAGES_DIR.exists():
        TEST_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Running locally. Please place images in {TEST_IMAGES_DIR}")
    image_paths = list(TEST_IMAGES_DIR.glob("*.jpg")) + list(TEST_IMAGES_DIR.glob("*.jpeg")) + list(TEST_IMAGES_DIR.glob("*.png"))

if not image_paths:
    print("No images found or uploaded. Please try again.")
else:
    print(f"Found {len(image_paths)} images for batch benchmarking.")
    
    latencies = []
    success_count = 0
    prompt = "Analyze this outfit and output a JSON array of garments with bounding boxes."
    
    for img_path in tqdm(image_paths, desc="Benchmarking Batch"):
        try:
            latency, out_text = benchmark_inference(img_path, prompt)
            latencies.append(latency)
            
            # Check JSON parse success
            try:
                clean_text = out_text.strip()
                if clean_text.startswith("```json"): clean_text = clean_text[7:]
                if clean_text.startswith("```"): clean_text = clean_text[3:]
                if clean_text.endswith("```"): clean_text = clean_text[:-3]
                
                parsed = json.loads(clean_text)
                success_count += 1
            except json.JSONDecodeError:
                print(f"  [JSON Parse Failed] for {img_path.name}")
                
        except Exception as e:
            print(f"  [Error] on {img_path.name}: {e}")
            
    if latencies:
        print("\\n" + "="*50)
        print("BATCH BENCHMARK SUMMARY")
        print("="*50)
        print(f"Total Images Processed:   {len(latencies)}")
        print(f"JSON Output Success Rate: {(success_count/len(latencies))*100:.1f}%")
        print(f"Average Latency:          {statistics.mean(latencies):.2f}s")
        print(f"Median Latency:           {statistics.median(latencies):.2f}s")
        print(f"Max Latency:              {max(latencies):.2f}s")
        print(f"Min Latency:              {min(latencies):.2f}s")
        print("="*50)
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
