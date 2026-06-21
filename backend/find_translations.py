import os
import json

locales_dir = r"C:\DressApp_AG\frontend\src\locales"
locales = [f for f in os.listdir(locales_dir) if f.endswith(".json")]

def find_key(data, target_key, path=""):
    if isinstance(data, dict):
        for k, v in data.items():
            current_path = f"{path}.{k}" if path else k
            if k == target_key:
                print(f"    {current_path}: {v}")
            find_key(v, target_key, current_path)
    elif isinstance(data, list):
        for idx, item in enumerate(data):
            find_key(item, target_key, f"{path}[{idx}]")

for locale in locales:
    path = os.path.join(locales_dir, locale)
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            print(f"--- {locale} ---")
            find_key(data, "cancel")
        except Exception as e:
            print(f"Error reading {locale}: {e}")
