import pathlib
import re

src_path = pathlib.Path(r"C:\DressApp_AG\scripts\build_eyes_finetune_flat_notebook.py")
dest_path = pathlib.Path(r"C:\DressApp_AG\scripts\build_eyes_finetune_secondhand_notebook.py")

content = src_path.read_text(encoding="utf-8")

# 1. Update output notebook path
content = content.replace('OUT = Path("C:/DressApp_AG/docs/notebooks/Eyes_FineTune_Flat_Gemma4.ipynb")',
                          'OUT = Path("C:/DressApp_AG/docs/notebooks/Eyes_FineTune_SecondHand_Gemma4.ipynb")')

# 2. Update MD Title
content = content.replace('# Eyes v4 — Further Fine-Tune on ghoumrassi/clothes_sample (Flat Garments)',
                          '# Eyes v4 — Third Pass Fine-Tune on Second Hand Fashion')

# 3. Update Inputs table in MD_TITLE
content = content.replace('| Clothes Sample | HuggingFace dataset `ghoumrassi/clothes_sample` |',
                          '| Second Hand | HuggingFace dataset `Nilanjan-2002/fashion-second-hand-front-only-rgb` |')

# 4. Replace Dataset Loader
new_sh_download = """CODE_DF_DOWNLOAD = \"\"\"\\
# Nilanjan-2002/fashion-second-hand-front-only-rgb loader
%pip install -q -U 'datasets>=4.0.0'

import json
from datasets import load_dataset
from pathlib import Path

# Load dataset from HF
ds = load_dataset('Nilanjan-2002/fashion-second-hand-front-only-rgb', split='train')
print(f'Second Hand Fashion: {len(ds):,} rows')

IMG_DIR = Path('/content/secondhand_images')
IMG_DIR.mkdir(parents=True, exist_ok=True)

WHOLE_FRAME = [0, 0, 1000, 1000]

# Mapping dataset 'type' to DressApp Category
TYPE_MAP = {
    'Top': 'Top',
    'Bottom': 'Bottom',
    'Dress': 'Full-body',
    'Outerwear': 'Outerwear',
    'Jacket': 'Outerwear',
    'Coat': 'Outerwear',
    'Shoe': 'Footwear',
    'Shoes': 'Footwear',
    'Accessory': 'Accessory',
    'Bag': 'Accessory'
}

def parse_record(type_val, brand, colors):
    t = (type_val or 'Garment').strip()
    cat = TYPE_MAP.get(t, 'Top')  # Fallback to Top
    
    # Construct a rich label
    color_str = (colors or '').replace('[', '').replace(']', '').replace("'", "")
    label_parts = filter(None, [brand, color_str, t])
    label = " ".join(label_parts) if any(label_parts) else "Garment"
    
    return [{
        'label': label.lower(),
        'category': cat,
        'region': {'bbox': WHOLE_FRAME[:]},
    }]

df_records = []
for i, row in enumerate(ds):
    img_path = IMG_DIR / f'{i}.jpg'
    row['image'].convert('RGB').save(img_path, 'JPEG', quality=92)
    items = parse_record(row.get('type'), row.get('brand'), row.get('colors'))
    target = json.dumps(items, ensure_ascii=False, separators=(',', ':'))
    df_records.append((str(img_path), target, 'second_hand'))
    if i and i % 5000 == 0:
        print(f'  materialized {i:>6,}/{len(ds):,}  df_records={len(df_records):,}')

print(f'\\nfinal df_records: {len(df_records):,}')
print('sample target :', df_records[0][1][:400])
\"\"\""""

content = re.sub(r'CODE_DF_DOWNLOAD = """\\.*?"""', lambda m: new_sh_download, content, flags=re.DOTALL)

# 5. Update Base Model Path
# The previous flat notebook used "google/gemma-4-E2B-it". We want to use the flat-merged model now.
content = content.replace("BASE_MODEL = 'google/gemma-4-E2B-it'",
                          "BASE_MODEL = '/content/drive/MyDrive/DressApp_Gemma4_E2B_Training/Eyes_v4_Flat_Gemma4_merged'")
content = content.replace("processor = AutoProcessor.from_pretrained(BASE_MODEL)",
                          "processor = AutoProcessor.from_pretrained('/content/drive/MyDrive/DressApp_Gemma4_E2B_Training/Eyes_v4_Flat_Gemma4_merged')")

# Update output paths so they don't overwrite the flat ones
content = content.replace("Eyes_v4_Flat_Gemma4_merged", "Eyes_v4_SH_Gemma4_merged")
content = content.replace("Eyes_v4_Flat_Gemma4-Q4_K_M.gguf", "Eyes_v4_SH_Gemma4-Q4_K_M.gguf")
content = content.replace("Eyes_v4_run", "Eyes_v4_SH_run")

dest_path.write_text(content, encoding="utf-8")
print("Written", dest_path)
