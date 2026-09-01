import os
import re

with open('node_modules/lucide-react/dist/esm/lucide-react.js', 'r', encoding='utf-8') as f:
    esm_content = f.read()

# All exported symbols in ESM index
exported_names = set(re.findall(r'export\s*\{\s*([A-Za-z0-9_]+)\s*\}', esm_content))
if not exported_names:
    exported_names = set(re.findall(r'as\s+([A-Za-z0-9_]+)', esm_content))

# Look at actual files in dist/esm/icons
icons_dir = 'node_modules/lucide-react/dist/esm/icons'
icon_files = set(os.listdir(icons_dir))

def to_kebab(s):
    s = re.sub(r'^Lucide', '', s)
    s = re.sub(r'([a-z0-9])([A-Z])', r'\1-\2', s)
    s = re.sub(r'([a-zA-Z])([0-9])', r'\1-\2', s)
    return s.lower()

found = []
for root, dirs, files in os.walk('apps/web/src'):
    for file in files:
        if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            matches = re.finditer(r'import\s*\{([^}]+)\}\s*from\s*[\'"]lucide-react[\'"]', content)
            for m in matches:
                names = m.group(1).split(',')
                for n in names:
                    raw = n.strip()
                    if not raw:
                        continue
                    clean = raw.split()[0].strip()
                    kebab = f"{to_kebab(clean)}.js"
                    if kebab not in icon_files:
                        found.append((clean, kebab, filepath))
                        print(f"MISSING: {clean} (kebab: {kebab}) in {filepath}")

print(f"Total missing: {len(found)}")
