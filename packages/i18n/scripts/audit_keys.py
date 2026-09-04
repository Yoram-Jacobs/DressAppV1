import os
import json
import re

mobile_src = r"C:\DressApp_AG\apps\mobile\src"
locales_dir = r"C:\DressApp_AG\packages\i18n\locales"

with open(os.path.join(locales_dir, "en.json"), "r", encoding="utf-8") as f:
    en_data = json.load(f)

def get_nested(data, key):
    parts = key.split(".")
    curr = data
    for p in parts:
        if isinstance(curr, dict) and p in curr:
            curr = curr[p]
        else:
            return None
    return curr

t_pattern = re.compile(r"t\(\s*['\"]([a-zA-Z0-9_.]+)['\"]\s*(?:,\s*\{([^}]*)\})?\s*\)")

all_keys = {}
for root, dirs, files in os.walk(mobile_src):
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            for match in t_pattern.finditer(content):
                key = match.group(1)
                opt_str = match.group(2) or ""
                default_val = ""
                def_m = re.search(r"defaultValue:\s*['\"]([^'\"]*)['\"]", opt_str)
                if def_m:
                    default_val = def_m.group(1)
                if key not in all_keys:
                    all_keys[key] = default_val

missing = []
for k, def_val in all_keys.items():
    val = get_nested(en_data, k)
    if val is None:
        missing.append((k, def_val))

print(f"Total keys in mobile: {len(all_keys)}")
print(f"Missing in en.json: {len(missing)}")
for k, def_v in sorted(missing):
    print(f"  {k}: \"{def_v}\"")
