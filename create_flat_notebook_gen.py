import pathlib

src_path = pathlib.Path(r"C:\DressApp_AG\scripts\build_eyes_finetune_v4_notebook.py")
dest_path = pathlib.Path(r"C:\DressApp_AG\scripts\build_eyes_finetune_flat_notebook.py")

content = src_path.read_text(encoding="utf-8")

# 1. Update output path
content = content.replace('OUT = Path("/app/docs/notebooks/Eyes_FineTune_v4_Gemma4.ipynb")',
                          'OUT = Path("C:/DressApp_AG/docs/notebooks/Eyes_FineTune_Flat_Gemma4.ipynb")')

# 2. Update Title
content = content.replace('# Eyes v4 — Fine-Tune Gemma-4 E2B on DeepFashion + CCP',
                          '# Eyes v4 — Further Fine-Tune on ghoumrassi/clothes_sample (Flat Garments)')

# 3. Update Inputs table in MD_TITLE
content = content.replace('| DeepFashion-Multimodal | Kaggle dataset `silverstone1903/deep-fashion-multimodal` |',
                          '| Clothes Sample | HuggingFace dataset `ghoumrassi/clothes_sample` |')
content = content.replace('| CCP-DatasetNinja | `/content/drive/MyDrive/ccp-DatasetNinja` |', '')

# 4. Remove Kaggle auth
content = content.replace('* `KAGGLE_USERNAME`  | Your Kaggle username                    |\n| `KAGGLE_KEY`       | Your Kaggle API key                     |', '')
content = content.replace("* `KAGGLE_USERNAME` — your Kaggle username.\n* `KAGGLE_KEY` — the `key` value from a Kaggle API token JSON.", '')

content = content.replace("CODE_KAGGLE_AUTH = \"\"\"\\\nimport os\nfrom google.colab import userdata\n\nfor key in ('KAGGLE_USERNAME', 'KAGGLE_KEY'):\n    try:\n        os.environ[key] = userdata.get(key)\n    except userdata.SecretNotFoundError as e:\n        raise RuntimeError(\n            f\\\"Colab secret '{key}' is missing. Open Tools -> Secrets, \\\"\n            f\\\"add {key}, and toggle 'Notebook access' ON.\\\"\n        ) from e\n\nprint(f'Kaggle creds in env for user: {os.environ[\\\"KAGGLE_USERNAME\\\"]}')\n\"\"\"", "CODE_KAGGLE_AUTH = \"\"")

# 5. Replace CODE_DF_DOWNLOAD with GH_DOWNLOAD
old_df_download = """CODE_DF_DOWNLOAD = \"\"\"\\
# Marqo/deepfashion-multimodal (HF Hub)"""

new_gh_download = """CODE_DF_DOWNLOAD = \"\"\"\\
# ghoumrassi/clothes_sample loader
%pip install -q -U 'datasets>=4.0.0'

import re, json
from datasets import load_dataset
from pathlib import Path

# Load dataset from HF
ds = load_dataset('ghoumrassi/clothes_sample', split='train')
print(f'ghoumrassi/clothes_sample: {len(ds):,} rows')

IMG_DIR = Path('/content/clothes_sample_images')
IMG_DIR.mkdir(parents=True, exist_ok=True)

GARMENT_PATTERNS = [
    (r'\\b(dress|gown|romper|jumpsuit|onesie)\\b',                 'dress',     'Full-body'),
    (r'\\bouter clothing\\b',                                       'outerwear', 'Outerwear'),
    (r'\\b(jacket|coat|blazer|cardigan|cape|parka|trench)\\b',     None,        'Outerwear'),
    (r'\\b(t[-\\s]?shirt|tee)\\b',                                  't-shirt',   'Top'),
    (r'\\btank(?:\\s+(?:top|shirt))?\\b',                           'tank top',  'Top'),
    (r'\\b(blouse|shirt|sweater|hoodie|sweatshirt|polo|vest|top)\\b', None,      'Top'),
    (r'\\b(jeans|denim pants)\\b',                                  'jeans',     'Bottom'),
    (r'\\b(trousers|pants|shorts|leggings|skirt)\\b',               None,        'Bottom'),
    (r'\\b(hat|cap|beanie)\\b',                                     'hat',       'Accessory'),
    (r'\\b(sunglasses|glasses)\\b',                                 None,        'Accessory'),
    (r'\\b(bag|purse|wallet|backpack|handbag|backpack)\\b',         'bag',       'Accessory'),
    (r'\\bbelt\\b',                                                 'belt',      'Accessory'),
    (r'\\b(scarf|tie|gloves|necklace|bracelet|ring|watch)\\b',      None,        'Accessory'),
]
WHOLE_FRAME = [0, 0, 1000, 1000]

def parse_caption(text):
    text_l = (text or '').lower()
    items, seen = [], set()
    for pat, default_label, cat in GARMENT_PATTERNS:
        m = re.search(pat, text_l)
        if not m or cat in seen:
            continue
        seen.add(cat)
        items.append({
            'label': default_label or m.group(0).strip(),
            'category': cat,
            'region': {'bbox': WHOLE_FRAME[:]},
        })
    if not items:
        items.append({
            'label': 'garment',
            'category': 'Top',
            'region': {'bbox': WHOLE_FRAME[:]},
        })
    return items

df_records = []
for i, row in enumerate(ds):
    img_path = IMG_DIR / f'{i}.jpg'
    row['image'].convert('RGB').save(img_path, 'JPEG', quality=92)
    items = parse_caption(row['text'])
    target = json.dumps(items, ensure_ascii=False, separators=(',', ':'))
    df_records.append((str(img_path), target, 'clothes_sample'))
    if i and i % 500 == 0:
        print(f'  materialized {i:>6,}/{len(ds):,}  df_records={len(df_records):,}')

print(f'\\nfinal df_records: {len(df_records):,}')
print('sample target :', df_records[0][1][:400])
\"\"\""""

import re
content = re.sub(r'CODE_DF_DOWNLOAD = """\\.*?"""', lambda m: new_gh_download, content, flags=re.DOTALL)

# 6. Remove CCP dataset logic (Section 5)
# Find MD_CCP, CODE_CCP_LOADER
content = re.sub(r'MD_CCP = """\\.*?"""', 'MD_CCP = ""', content, flags=re.DOTALL)
content = re.sub(r'CODE_CCP_LOADER = """\\.*?"""', 'CODE_CCP_LOADER = ""', content, flags=re.DOTALL)
content = content.replace("ccp_records = load_ccp_records()", "ccp_records = []")

# Update Base Model to the previous merged model if possible, but the notebook uses `google/gemma-4-E2B-it`.
# I'll leave it as `google/gemma-4-E2B-it` for base, but mention it in the title.
# Wait, let me replace OUT_MERGED and OUT_GGUF so it doesn't overwrite the original v4.
content = content.replace("Eyes_v4_Gemma4_merged", "Eyes_v4_Flat_Gemma4_merged")
content = content.replace("Eyes_v4_Gemma4-Q4_K_M.gguf", "Eyes_v4_Flat_Gemma4-Q4_K_M.gguf")

dest_path.write_text(content, encoding="utf-8")
print("Written", dest_path)
