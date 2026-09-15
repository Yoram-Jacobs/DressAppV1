import os
import re

PRIMARY_MAP = {
    'PlayCircle': 'CirclePlay',
    'PauseCircle': 'CirclePause',
    'StopCircle': 'CircleStop',
    'HelpCircle': 'CircleHelp',
    'AlertCircle': 'CircleAlert',
    'CheckCircle': 'CircleCheck',
    'PlusCircle': 'CirclePlus',
    'MinusCircle': 'CircleMinus',
    'XCircle': 'CircleX',
    'ShirtIcon': 'Shirt',
    'Coins': 'CircleDollarSign',
    'Layers3': 'Layers',
    'ZoomIn': 'Search',
}

def fix_imports_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    def replace_import(m):
        nonlocal changed
        import_body = m.group(1)
        names = import_body.split(',')
        new_names = []
        for n in names:
            stripped = n.strip()
            if not stripped:
                continue
            # If already has 'as', check the source
            if ' as ' in stripped:
                src, alias = stripped.split(' as ')
                src = src.strip()
                alias = alias.strip()
                if src in PRIMARY_MAP:
                    canonical = PRIMARY_MAP[src]
                    new_names.append(f"{canonical} as {alias}")
                    changed = True
                else:
                    new_names.append(stripped)
            else:
                if stripped in PRIMARY_MAP:
                    canonical = PRIMARY_MAP[stripped]
                    new_names.append(f"{canonical} as {stripped}")
                    changed = True
                else:
                    new_names.append(stripped)

        # Preserve reasonable formatting
        if '\n' in import_body:
            return "import {\n  " + ",\n  ".join(new_names) + ",\n} from 'lucide-react';"
        else:
            return "import { " + ", ".join(new_names) + " } from 'lucide-react';"

    new_content = re.sub(r'import\s*\{([^}]+)\}\s*from\s*[\'"]lucide-react[\'"]\;?', replace_import, content)

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated canonical icon imports in: {filepath}")

for root, dirs, files in os.walk('apps/web/src'):
    for file in files:
        if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
            fix_imports_in_file(os.path.join(root, file))

print("Canonical icon replacement complete!")
