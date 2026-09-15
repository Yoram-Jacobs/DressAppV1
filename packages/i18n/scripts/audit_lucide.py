import os
import re

with open('node_modules/lucide-react/dist/esm/lucide-react.js', 'r', encoding='utf-8') as f:
    esm_content = f.read()

# Capture all exported identifier names from lucide-react.js
# e.g. export { default as AlertCircle } or export { AlertCircle }
exported_names = set(re.findall(r'as\s+([A-Za-z0-9_]+)', esm_content))
if not exported_names:
    exported_names = set(re.findall(r'\b([A-Za-z0-9_]+)\b', esm_content))

print(f"Total exported lucide icons in ESM bundle: {len(exported_names)}")

missing_count = 0
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
                    clean = n.strip()
                    if not clean:
                        continue
                    icon_name = clean.split()[0].strip()
                    if icon_name and icon_name not in exported_names:
                        print(f"MISSING: {icon_name} in {filepath}")
                        missing_count += 1

print(f"Total missing icon imports: {missing_count}")
