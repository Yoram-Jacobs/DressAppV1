import re
import glob
import json

def check_positional_fallbacks():
    pattern = re.compile(r't\(\s*[\'\"]([^\'\"]+)[\'\"]\s*,\s*[\'\"]([^\'\"]+)[\'\"]')
    violations = []
    files = glob.glob('frontend/src/**/*.jsx', recursive=True) + glob.glob('frontend/src/**/*.js', recursive=True)
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for idx, line in enumerate(f, 1):
                for m in pattern.finditer(line):
                    if 'defaultValue' not in line:
                        violations.append((filepath, idx, m.group(1), m.group(2)))
    print(f"--- Positional Fallback Violations: {len(violations)} ---")
    for v in violations:
        print(f"{v[0]}:{v[1]} -> t('{v[2]}', '{v[3]}')")
    return len(violations)

def sync_locale_keys():
    def flatten(d, prefix=''):
        keys = set()
        for k, v in d.items():
            full = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                keys |= flatten(v, full)
            else:
                keys.add(full)
        return keys

    en_path = 'frontend/src/locales/en.json'
    with open(en_path, 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    en_keys = flatten(en_data)

    locales = sorted(glob.glob('frontend/src/locales/*.json'))
    for loc_file in locales:
        if 'bak' in loc_file or loc_file.endswith('en.json'):
            continue
        with open(loc_file, 'r', encoding='utf-8') as f:
            loc_data = json.load(f)
        
        # Add missing keys to loc_data using EN values as fallback
        missing_count = 0
        def fill_missing(en_dict, loc_dict):
            nonlocal missing_count
            for k, v in en_dict.items():
                if k not in loc_dict:
                    loc_dict[k] = v
                    missing_count += 1
                elif isinstance(v, dict) and isinstance(loc_dict[k], dict):
                    fill_missing(v, loc_dict[k])

        fill_missing(en_data, loc_data)
        if missing_count > 0:
            with open(loc_file, 'w', encoding='utf-8') as f:
                json.dump(loc_data, f, ensure_ascii=False, indent=2)
            print(f"Updated {loc_file}: added {missing_count} missing keys.")

if __name__ == '__main__':
    check_positional_fallbacks()
    sync_locale_keys()
