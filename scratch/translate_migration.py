import json
import os

locales_dir = r"C:\DressApp_AG\frontend\src\locales"
en_path = os.path.join(locales_dir, "en.json")

with open(en_path, "r", encoding="utf-8") as f:
    en_data = json.load(f)

migration_en = en_data.get("migration", {})

locale_files = [f for f in os.listdir(locales_dir) if f.endswith(".json") and f != "en.json"]

for lf in locale_files:
    path = os.path.join(locales_dir, lf)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "migration" not in data:
        data["migration"] = {}

    for k, v in migration_en.items():
        if k not in data["migration"]:
            data["migration"][k] = v

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Successfully updated migration keys across {len(locale_files)} locale files.")
