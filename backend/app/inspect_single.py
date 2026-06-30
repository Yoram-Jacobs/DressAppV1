import re

def _check_words(text: str, tags: list[str], target_patterns: list[str]) -> bool:
    for pat in target_patterns:
        if any(pat == tag or f" {pat} " in f" {tag} " or tag.startswith(f"{pat} ") or tag.endswith(f" {pat}") for tag in tags):
            print(f"Matched tag: {pat} in {tags}")
            return True
        clean_text = text.replace("-", " ")
        clean_pat = pat.replace("-", " ")
        escaped_pat = re.escape(clean_pat)
        if re.search(r'\b' + escaped_pat + r'\b', clean_text):
            print(f"Matched text: {pat} in {clean_text}")
            return True
    return False

title = "dark grey taz graphic sweatshirt"
tags = ['sweatshirt', 'dark gray', 'taz', 'looney tunes', 'graphic', 'crewneck', 'casual', 'fleece', 'long sleeve', 'front']
pats = ["short sleeve", "short-sleeve", "tshirt", "t-shirt", "tee", "tank", "polo", "קצר", "גופייה", "טי"]

_check_words(title, tags, pats)
