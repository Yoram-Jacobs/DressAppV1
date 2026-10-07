from __future__ import annotations
import logging
import re
logger = logging.getLogger(__name__)

from typing import Any

_VALID_GENDER = {"men", "women", "unisex", "kids"}
_GENDER_ALIASES = {
    "male": "men", "man": "men", "m": "men", "זכר": "men", "גבר": "men",
    "female": "women", "woman": "women", "f": "women", "w": "women", "נקבה": "women", "אישה": "women",
    "uni": "unisex",
    "kid": "kids", "child": "kids", "children": "kids", "boy": "kids", "boys": "kids", "girl": "kids", "girls": "kids", "ילד": "kids", "ילדה": "kids", "ילדים": "kids",
}


def resolve_garment_gender(val: Any) -> str | None:
    """Normalize user object, dict, or raw string to 'men' | 'women' | 'unisex' | 'kids' | None."""
    if not val:
        return None
    if isinstance(val, dict):
        raw = val.get("gender") or val.get("sex") or val.get("avatar_gender")
        if not raw and isinstance(val.get("profile"), dict):
            raw = val["profile"].get("gender") or val["profile"].get("sex")
    else:
        raw = val
    if not raw:
        return None
    s = str(raw).strip().lower()
    if s in _VALID_GENDER:
        return s
    return _GENDER_ALIASES.get(s)


_FEMININE_CUT_KEYWORDS = {
    "skirt", "blouse", "heels", "pumps", "stiletto", "stilettos",
    "sandal", "sandals", "strappy sandals", "heeled sandals", "open-toe sandals", "gladiator sandals",
    "wedges", "wedge sandals", "espadrilles", "mules", "heeled mules", "open-toe", "peep-toe",
    "knee-high boots", "over-the-knee boots", "thigh-high boots",
    "kimono", "robe", "kaftan", "sarong", "pleated skirt", "midi skirt", "maxi skirt",
    "peplum", "sweetheart", "bra", "camisole", "corset", "lingerie", "halter",
    "crop top", "cropped top", "croptop", "crop-top", "crop", "bustier", "bralette",
    "cropped blazer", "crop blazer", "bolero", "shrug", "tights", "stockings", "pantyhose",
    "tunic", "babydoll", "floral crop", "tube top", "slip dress",
    "floral top", "floral print top", "floral print shirt", "floral shirt", "floral blouse",
    "floral tee", "floral t-shirt", "floral print t-shirt", "floral lace",
    "lace top", "lace blouse", "lace shirt", "puff sleeve", "ruffle", "ruffled", "chiffon",
    "scallop", "bell sleeve", "off-shoulder", "off the shoulder", "cold shoulder",
    "handbag", "purse", "clutch", "tote bag", "shoulder bag", "crossbody bag", "satchel", "hobo bag",
    "skinny jeans", "jeggings",
    "בלוזה", "שמלה", "חצאית", "עקב", "עקבים", "חזייה", "מחוך", "סנדל", "סנדלים",
    "תיק יד", "תיק צד", "תיק כתף", "קלאץ'", "ארנק", "סקיני", "ג'ינס סקיני",
    "חולצת בטן", "טוניקה", "סטרפלס", "גופיית בטן", "פרחוני", "תחרה", "חולצה פרחונית",
    "גרביונים", "שראג", "בולרו",
}
_MASCULINE_CUT_KEYWORDS = {
    "boxers", "briefs", "tuxedo", "בוקסר", "טוקסידו",
}
_UNISEX_CUT_KEYWORDS = {
    "athletic tank top", "athletic tank", "tank top", "singlet", "running tank",
    "gym tank", "sports tank", "workout tank", "גופיית ספורט", "גופיית ריצה",
}


def is_distinctly_feminine_garment(
    cat: str | None,
    sub: str | None,
    itype: str | None,
    name: str | None = None,
    full_text: str | None = None,
    pattern: str | None = None,
) -> bool:
    """Check if a garment is strictly feminine by silhouette/design."""
    cat_l = str(cat or "").strip().lower()
    sub_l = str(sub or "").strip().lower()
    it_l = str(itype or "").strip().lower()
    pat_l = str(pattern or "").strip().lower()
    extra_l = f"{name or ''} {full_text or ''} {pat_l}".lower()
    joined = f"{cat_l} {sub_l} {it_l} {extra_l}"

    # Footwear, tops, bottoms, socks that have "dress" in the name are formal/dressy, NOT dresses
    is_dress_compound = any(
        w in f"{cat_l} {sub_l} {it_l}"
        for w in ("shoe", "shirt", "pant", "trouser", "sock", "vest", "boot", "suit", "jacket", "tie")
    )

    is_dress = (
        (
            cat_l in {"full body", "dress"}
            or sub_l in {"dress", "dresses", "sundress", "gown", "שמלה", "שמלות"}
            or it_l in {"dress", "dresses", "sundress", "gown", "שמלה", "שמלות"}
            or it_l.endswith(" dress")
            or it_l.endswith(" gown")
            or "sundress" in it_l
        )
        and not is_dress_compound
    )
    if is_dress:
        return True

    if any(c in joined for c in _FEMININE_CUT_KEYWORDS):
        return True

    # Tops, shirts, tees, or blouses with floral patterns or lace styling are distinctly feminine
    if any(w in joined for w in ("floral", "פרחוני", "lace", "תחרה", "ruffle", "ruffles", "frill", "peplum", "sweetheart", "off-shoulder", "puff sleeve", "flutter", "wrap top", "wrap blouse")):
        if any(w in joined for w in ("top", "shirt", "blouse", "crop", "skirt", "cami", "tee", "t-shirt", "chiffon")):
            return True

    if pat_l == "floral" and (cat_l == "top" or any(w in joined for w in ("top", "shirt", "tee", "blouse", "t-shirt"))):
        return True

    return False


def is_distinctly_unisex_garment(
    cat: str | None,
    sub: str | None,
    itype: str | None,
    name: str | None = None,
    full_text: str | None = None,
    pattern: str | None = None,
) -> bool:
    """Check if a garment is distinctly unisex (activewear tanks, singlets, etc.)."""
    cat_l = str(cat or "").strip().lower()
    sub_l = str(sub or "").strip().lower()
    it_l = str(itype or "").strip().lower()
    extra_l = f"{name or ''} {full_text or ''}".lower()
    joined = f"{cat_l} {sub_l} {it_l} {extra_l}"

    # If it has a feminine cut (crop top, floral shirt, camisole, lingerie, etc.), it's not unisex
    if is_distinctly_feminine_garment(cat, sub, itype, name=name, full_text=full_text, pattern=pattern):
        return False
    if any(k in joined for k in _FEMININE_CUT_KEYWORDS):
        return False
    return any(c in joined for c in _UNISEX_CUT_KEYWORDS)


def is_distinctly_masculine_garment(cat: str | None, sub: str | None, itype: str | None) -> bool:
    """Check if a garment is strictly masculine by silhouette/design."""
    sub_l = str(sub or "").strip().lower()
    it_l = str(itype or "").strip().lower()
    return any(c in sub_l or c in it_l for c in _MASCULINE_CUT_KEYWORDS)



_CAPTION_TEMPLATES = {
    "en": {
        "coat": "Tailored {name} with classic silhouette and structured detailing.",
        "footwear": "Classic {name} featuring comfortable everyday styling.",
        "accessories": "{name} adding an essential finishing touch to any look.",
        "default": "{name} in versatile everyday styling.",
        "fallback_name": "garment",
    },
    "he": {
        "coat": "{name} מחויט ומעוצב בגזרה מחמיאה וקלאסית.",
        "footwear": "{name} בעל עיצוב אופנתי ונוח לשימוש יומיומי.",
        "accessories": "{name} המוסיף טאץ' מיוחד וסטייל לכל הופעה.",
        "default": "{name} ורסטילי ונוח בעיצוב מוקפד ונקי.",
        "fallback_name": "פריט",
    },
    "ar": {
        "coat": "{name} مصمم بقصة أنيقة ومتقنة ولمسات كلاسيكية.",
        "footwear": "{name} بتصميم أنيق ومريح للاستخدام اليومي.",
        "accessories": "{name} يضفي لمسة من الأناقة والجاذبية على أي إطلالة.",
        "default": "{name} عملي ومريح بتصميم متقن وعصري.",
        "fallback_name": "قطعة ملابس",
    },
    "de": {
        "coat": "Ein maßgeschneiderter {name} mit eleganter Silhouette und raffinierten Knöpfen.",
        "footwear": "Klassische {name} mit stilvollem Design und hohem Tragekomfort.",
        "accessories": "Ein eleganter {name}, der jedem Outfit eine stilvolle Note verleiht.",
        "default": "Ein vielseitiger {name} mit durchdachter Passform und klarem Design.",
        "fallback_name": "Kleidungsstück",
    },
    "es": {
        "coat": "Un elegante {name} con silueta estructurada y acabados de sastrería.",
        "footwear": "{name} con estilo contemporáneo y confort óptimo para el día a día.",
        "accessories": "Un distinguido {name} que aporta sofisticación a cualquier conjunto.",
        "default": "Un versátil {name} con proporciones equilibradas y diseño impecable.",
        "fallback_name": "prenda",
    },
    "fr": {
        "coat": "Une pièce élégante : {name} à la coupe structurée et aux finitions soignées.",
        "footwear": "{name} au style intemporel offrant confort et élégance au quotidien.",
        "accessories": "Un superbe {name} qui apporte une touche de raffinement à votre tenue.",
        "default": "Un modèle polyvalent : {name} aux proportions harmonieuses et au design épuré.",
        "fallback_name": "vêtement",
    },
    "hi": {
        "coat": "एक आकर्षक {name} जो संरचित बनावट और क्लासिक शैली से तैयार किया गया है।",
        "footwear": "स्टाइलिश और आरामदायक {name}, दैनिक उपयोग के लिए एकदम उपयुक्त।",
        "accessories": "एक सुरुचिपूर्ण {name} जो किसी भी परिधान में परिष्कार जोड़ता है।",
        "default": "एक बहुमुखी और सुंदर {name}, उत्तम फिट और सुरुचिपूर्ण डिज़ाइन के साथ।",
        "fallback_name": "परिधान",
    },
    "it": {
        "coat": "Un capo sartoriale : {name} dal taglio strutturato e dai dettagli ricercati.",
        "footwear": "{name} dallo stile sofisticato, ideale per unire comfort ed eleganza quotidiana.",
        "accessories": "Un elegante {name} che dona un tocco di raffinatezza a qualsiasi look.",
        "default": "Un capo versatile : {name} caratterizzato da linee pulite e proporzioni armoniose.",
        "fallback_name": "capo",
    },
    "ja": {
        "coat": "洗練されたシルエットと上質なディテールが魅力の{name}。",
        "footwear": "スタイリッシュなデザインで日常使いに最適な履き心地の{name}。",
        "accessories": "どんな装いにも洗練されたアクセントを添えるエレガントな{name}。",
        "default": "すっきりとしたプロポーションと汎用性の高いデザインが特徴の{name}。",
        "fallback_name": "アイテム",
    },
    "nl": {
        "coat": "Een getailleerde {name} met een gestructureerd silhouet en verfijnde afwerking.",
        "footwear": "Stijlvolle {name} met een tijdloos ontwerp en optimaal draagcomfort.",
        "accessories": "Een elegante {name} die een verfijnde toets toevoegt aan elke outfit.",
        "default": "Een veelzijdige {name} met doordachte proporties en een strak design.",
        "fallback_name": "kledingstuk",
    },
    "pt": {
        "coat": "Um elegante {name} com corte estruturado e acabamento impecável.",
        "footwear": "{name} clássico, que combina estilo moderno com conforto para o dia a dia.",
        "accessories": "Um charmoso {name} que confere sofisticação a qualquer combinação.",
        "default": "Um versátil {name} projetado com proporções equilibradas e design atemporal.",
        "fallback_name": "peça",
    },
    "ru": {
        "coat": "Элегантный {name} структурированного кроя с утонченными деталями.",
        "footwear": "Стильные {name}, сочетающие современный дизайн и комфорт на каждый день.",
        "accessories": "Изысканный {name}, добавляющий выразительный акцент любому образу.",
        "default": "Универсальный {name} гармоничных пропорций с лаконичным дизайном.",
        "fallback_name": "предмет гардероба",
    },
    "zh": {
        "coat": "版型挺括、剪裁利落的经典款{name}。",
        "footwear": "兼顾时尚设计与日常舒适穿着体验的{name}。",
        "accessories": "为任意穿搭增添优雅与精致细节的{name}。",
        "default": "比例协调、简约百搭的质感{name}。",
        "fallback_name": "单品",
    },
}


def _clean_truncated_caption(caption: str | None) -> str:
    """Ensure caption is a complete, well-formed sentence ending with proper punctuation.
    
    Removes trailing truncated fragments (e.g. 'offers a comfortable and d)')
    and repairs incomplete grammar caused by max_token limits.
    """
    if not caption:
        return ""
    text = str(caption).strip()
    if not text:
        return ""

    # Strip any dangling quotes, trailing commas, dashes, colons, or semicolons
    text = re.sub(r'[\s",\-_:;]+$', '', text)

    # Strip hanging unclosed parentheses/brackets (e.g. "and d)")
    if text.endswith(")") and "(" not in text:
        text = text[:-1].rstrip()
    if text.endswith("]") and "[" not in text:
        text = text[:-1].rstrip()

    # Check if there is already a sentence terminator followed by a broken trailing fragment
    # e.g. "A floral print blouse with soft fabric. It features a relaxed fit and"
    sentence_endings = [m.end() for m in re.finditer(r'[.!?。۔](\s|$)', text)]
    if sentence_endings:
        last_end = sentence_endings[-1]
        trailing = text[last_end:].strip()
        # If there's a trailing fragment without sentence termination, check if it's incomplete
        if trailing:
            trailing_words = trailing.split()
            last_word = trailing_words[-1].lower() if trailing_words else ""
            if len(trailing_words) <= 6 or last_word in ("and", "with", "for", "the", "a", "an", "or", "in", "to", "of", "d", "is", "its", "offers", "ו", "עם", "של"):
                text = text[:last_end].strip()

    # Strip dangling trailing 1-2 letter fragments preceded by conjunction/preposition (e.g. "and d", "with a", "for s")
    text = re.sub(r'\s+(?:and|with|for|or|the|in|on|at|to|of|a|an)\s+[a-zA-Z]{1,2}$', '', text, flags=re.IGNORECASE).rstrip()

    # Strip dangling trailing conjunctions/prepositions
    text = re.sub(r'\s+(?:and|with|for|or|in|on|at|to|of|the|a|an|but|ו|עם|של|ב|ל|על)$', '', text, flags=re.IGNORECASE).rstrip()

    # Sanitize known phonetic garbles
    if "קרוז דומים" in text:
        text = text.replace("קרוז דומים", 'דגמ"ח')

    # If Hebrew caption contains isolated English color, garment terms, or leaked dress_code enums, localize them
    if any("\u0590" <= ch <= "\u05ea" for ch in text):
        _en_to_he_terms = {
            r'[\.\s]*\bsmart-casual\b[\.\s]*': ' אלגנטי ',
            r'[\.\s]*\bsmart casual\b[\.\s]*': ' אלגנטי ',
            r'[\.\s]*(?<!smart[- ])\bcasual\b[\.\s]*': ' יומיומי ',
            r'[\.\s]*\bformal\b[\.\s]*': ' רשמי ',
            r'[\.\s]*\bathletic\b[\.\s]*': ' ספורטיבי ',
            r'[\.\s]*\bbusiness\b[\.\s]*': ' עסקי ',
            r'[\.\s]*\bloungewear\b[\.\s]*': ' נוח ',
            r'\bnavy\b': 'כחול נייבי',
            r'\bblack\b': 'שחור',
            r'\bwhite\b': 'לבן',
            r'\bblue\b': 'כחול',
            r'\bbrown\b': 'חום',
            r'\bgreen\b': 'ירוק',
            r'\bgray\b': 'אפור',
            r'\bgrey\b': 'אפור',
            r'\bbeige\b': "בז'",
            r'\bolive\b': 'זית',
            r'\bkhaki\b': 'חאקי',
            r'\bcamo\b': 'הסוואה',
            r'\bcamouflage\b': 'הסוואה',
            r'\bcargo\b': 'דגמ"ח',
            r'\bjackets?\b': "ז'קט",
            r'\bt-?shirts?\b': 'חולצת טי',
            r'\bshirts?\b': 'חולצה',
            r'\bpants?\b': 'מכנסיים',
            r'\btrousers?\b': 'מכנסיים',
            r'\bjeans?\b': "ג'ינס",
            r'\bshoes?\b': 'נעליים',
            r'\bsneakers?\b': 'סניקרס',
            r'\bboots?\b': 'מגפיים',
            r'\bloafers?\b': 'מוקסינים',
            r'\bhandbags?\b': 'תיק יד',
            r'\bbags?\b': 'תיק',
            r'\bskirts?\b': 'חצאית',
            r'\bdresses?\b': 'שמלה',
        }
        for pat, rep in _en_to_he_terms.items():
            text = re.sub(pat, rep, text, flags=re.IGNORECASE)

        # Fix plural agreement for common Hebrew plurals (ג'ינס, מכנסיים, נעליים, מגפיים, סניקרס)
        if any(w in text for w in ("ג'ינס", "מכנסיים", "נעליים", "מגפיים", "סניקרס", "סנדלים")):
            text = re.sub(r'\bהמתאים\b', 'המתאימים', text)
            text = re.sub(r'\bמתאים\b', 'מתאימים', text)

        # Normalize whitespace and strip bidi-punctuated edges
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'^[\.\,\s\-]+|[\.\,\s\-]+$', '', text).strip()

    # Remove any trailing dangling English enum words across all languages (e.g. "style .casual")
    text = re.sub(r'[\.\s\-_]+(?:casual|smart-casual|formal|athletic|business|loungewear)[\.\s\-_]*$', '', text, flags=re.IGNORECASE).strip()

    # Ensure text ends with a single sentence terminator
    if text and text[-1] not in ".!?。۔":
        text += "."

    return text


def _canonical_tag_key(tag: Any) -> str:
    """Return a lowercased, un-punctuated, stemmed canonical key for a tag to detect semantic duplicates."""
    if not tag or not isinstance(tag, str):
        return ""
    s = str(tag).strip().lower()
    s = re.sub(r"[\s\-_]+", " ", s)
    # Strip common plural suffixes
    if s.endswith("ies") and len(s) > 4:
        s = s[:-3] + "y"
    elif s.endswith("es") and len(s) > 3 and not s.endswith(("ss", "us", "is")):
        s = s[:-2]
    elif s.endswith("s") and len(s) > 2 and not s.endswith(("ss", "us", "is")):
        s = s[:-1]

    synonyms = {
        "pant": "trouser",
        "trouser": "trouser",
        "trousers": "trouser",
        "slacks": "trouser",
        "jean": "jeans",
        "tee": "t-shirt",
        "tshirt": "t-shirt",
        "t shirt": "t-shirt",
        "shirt": "shirt",
        "belt": "belt",
        "shoe": "shoe",
        "boot": "boot",
        "sneaker": "sneaker",
        "trainer": "sneaker",
        "sandal": "sandal",
        "sweater": "sweater",
        "jacket": "jacket",
        "coat": "coat",
        "bag": "bag",
        "handbag": "bag",
        "autumn": "fall",
        "gray": "grey",
    }
    return synonyms.get(s, s)


_CANONICAL_MATERIAL_MAP: dict[str, str] = {
    "革": "Leather", "皮革": "Leather", "皮": "Leather",
    "עור": "Leather", "جلد": "Leather", "cuir": "Leather", "leder": "Leather",
    "cuero": "Leather", "couro": "Leather", "pelle": "Leather", "кожа": "Leather", "चमड़ा": "Leather",
    "כותנה": "Cotton", "قطن": "Cotton", "coton": "Cotton", "baumwolle": "Cotton",
    "algodón": "Cotton", "algodao": "Cotton", "cotone": "Cotton", "хлопок": "Cotton", "कपास": "Cotton", "綿": "Cotton", "棉": "Cotton",
    "צמר": "Wool", "صوف": "Wool", "laine": "Wool", "wolle": "Wool", "lana": "Wool",
    "шерсть": "Wool", "ऊन": "Wool", "ウール": "Wool", "羊毛": "Wool",
    "משי": "Silk", "حرير": "Silk", "soie": "Silk", "seide": "Silk", "seda": "Silk",
    "seta": "Silk", "шелк": "Silk", "шёлк": "Silk", "रेशम": "Silk", "シルク": "Silk", "丝": "Silk",
    "פשתן": "Linen", "كتان": "Linen", "lin": "Linen", "leinen": "Linen", "lino": "Linen",
    "лен": "Linen", "лён": "Linen", "सन": "Linen", "リネン": "Linen", "亚麻": "Linen",
    "דנים": "Denim", "ג'ינס": "Denim", "גינס": "Denim", "джинс": "Denim", "डेनिम": "Denim", "デニム": "Denim", "牛仔": "Denim",
    "פוליאסטר": "Polyester", "بوليستر": "Polyester", "полиэстер": "Polyester", "पॉलिएस्टर": "Polyester", "ポリエステル": "Polyester", "聚酯": "Polyester",
    "ניילון": "Nylon", "نايلון": "Nylon", "нейлон": "Nylon", "नायलॉन": "Nylon", "ナイロン": "Nylon", "锦纶": "Nylon",
    "סינתטי": "Synthetic", "סינטטי": "Synthetic", "synthetic": "Synthetic", "synthetisch": "Synthetic",
    "synthétique": "Synthetic", "sintético": "Synthetic", "sintetico": "Synthetic", "синтетика": "Synthetic",
    "синтетический": "Synthetic", "синтетическое": "Synthetic", "اصطناعي": "Synthetic", "合成": "Synthetic",
}


def _clean_material_name(raw_name: str) -> str:
    if not raw_name:
        return ""
    name_clean = str(raw_name).strip()
    return _CANONICAL_MATERIAL_MAP.get(name_clean.lower(), _CANONICAL_MATERIAL_MAP.get(name_clean, name_clean.title()))


def normalize_weighted_tags(tags: Any) -> list[dict[str, Any]]:
    """Normalize a list of tags (strings or {name, pct} dicts) so that:
    1. Every entry is a dict {"name": str, "pct": int}.
    2. Missing, None, or 0 percentages are inferred.
    3. The sum of all percentages is strictly 100%.
    """
    if not tags:
        return []

    if isinstance(tags, str):
        tags = [tags]
    if not isinstance(tags, list):
        return []

    clean: list[dict[str, Any]] = []
    for item in tags:
        if isinstance(item, str) and item.strip():
            clean.append({"name": _clean_material_name(item), "pct": None})
        elif isinstance(item, dict) and item.get("name"):
            pct_val = item.get("pct")
            try:
                pct_int = int(pct_val) if pct_val is not None else None
            except (ValueError, TypeError):
                pct_int = None
            entry = dict(item)
            entry["name"] = _clean_material_name(str(item.get("name", "")))
            entry["pct"] = pct_int
            clean.append(entry)

    if not clean:
        return []

    if len(clean) == 1:
        clean[0]["pct"] = 100
        return clean

    known_sum = sum(c["pct"] for c in clean if c.get("pct") is not None and c["pct"] > 0)
    unassigned = [c for c in clean if c.get("pct") is None or c.get("pct") <= 0]

    if not unassigned and known_sum == 100:
        return clean

    if known_sum > 0 and known_sum < 100 and unassigned:
        rem = 100 - known_sum
        share = rem // len(unassigned)
        distributed = 0
        for i, c in enumerate(unassigned):
            if i == len(unassigned) - 1:
                c["pct"] = rem - distributed
            else:
                c["pct"] = share
                distributed += share
        return clean

    # All unassigned or invalid sum: distribute sensibly so first is dominant
    if len(clean) == 2:
        clean[0]["pct"] = 70
        clean[1]["pct"] = 30
    elif len(clean) == 3:
        clean[0]["pct"] = 60
        clean[1]["pct"] = 25
        clean[2]["pct"] = 15
    elif len(clean) == 4:
        clean[0]["pct"] = 50
        clean[1]["pct"] = 25
        clean[2]["pct"] = 15
        clean[3]["pct"] = 10
    else:
        share = 100 // len(clean)
        rem = 100 % len(clean)
        for i, c in enumerate(clean):
            c["pct"] = share + (rem if i == 0 else 0)

    return clean


def sanitize_fabric_materials(
    materials: Any,
    *,
    category: str | None = None,
    sub_category: str | None = None,
    item_type: str | None = None,
    full_text: str = "",
) -> list[dict[str, Any]]:
    """Sanitize fabric_materials against physically impossible combinations.

    Guarantees:
    - Footwear (heels/pumps/shoes/boots) never has Cotton (replaced with Leather or Suede).
    - Bags/Purses never default to generic 100% Polyester/Cotton (replaced with Leather or Faux Leather).
    - Knitwear/Sweaters never default to flat 100% Cotton (replaced with realistic knit yarn/blend).
    - Jeans always have Denim.
    - Percentages always sum strictly to 100%.
    """
    normalized = normalize_weighted_tags(materials) if materials else []
    cat_low = (category or "").lower()
    sub_low = (sub_category or "").lower()
    itype_low = (item_type or "").lower()
    text_low = f"{full_text} {sub_low} {itype_low}".lower()

    if not normalized:
        # Fallbacks when completely empty
        if cat_low == "footwear" or any(w in text_low for w in ("shoe", "heel", "pump", "boot", "loafer", "oxford", "sandal", "נעלי", "עקב", "מגפ")):
            return [{"name": "Suede", "pct": 100}] if any(w in text_low for w in ("suede", "זמש")) else [{"name": "Leather", "pct": 70}, {"name": "Rubber", "pct": 30}]
        if cat_low in ("accessories", "accessory", "bags") or any(w in text_low for w in ("bag", "handbag", "purse", "clutch", "crossbody", "תיק")):
            return [{"name": "Canvas", "pct": 80}, {"name": "Polyester", "pct": 20}] if any(w in text_low for w in ("canvas", "קנבס", "בד", "tote")) else [{"name": "Leather", "pct": 100}]
        if any(w in text_low for w in ("sweater", "knit", "knitwear", "pullover", "cardigan", "סוודר", "סריג", "סריגים")):
            return [{"name": "Wool", "pct": 70}, {"name": "Acrylic", "pct": 30}]
        if any(w in text_low for w in ("jean", "jeans", "denim", "דנים", "ג'ינס")):
            return [{"name": "Denim", "pct": 100}]
        return [{"name": "Cotton", "pct": 70}, {"name": "Polyester", "pct": 30}]

    # 1. Footwear sanity
    is_footwear = (
        cat_low == "footwear"
        or any(w in text_low for w in ("shoe", "heel", "pump", "boot", "loafer", "oxford", "sandal", "sneaker", "נעלי", "עקב", "מגפ", "סנדל", "מוקסין"))
    )
    if is_footwear:
        is_athletic = any(w in text_low for w in ("sneaker", "running", "athletic", "סניקרס", "ריצה", "ספורט"))
        is_canvas_or_textile = any(w in text_low for w in ("canvas", "קנבס", "בד", "textile", "espadrille", "slipper", "בית", "crocs", "rain boot"))
        has_cotton = any(str(m.get("name", "")).lower() in ("cotton", "כותנה") for m in normalized)
        is_generic_synth_or_poly = all(str(m.get("name", "")).lower() in ("synthetic", "סינתטי", "polyester", "פוליאסטר", "cotton", "כותנה", "fabric", "בד") for m in normalized)
        if (has_cotton or is_generic_synth_or_poly) and not is_canvas_or_textile and not is_athletic:
            if any(w in text_low for w in ("suede", "זמש", "velvet", "קטיפה")):
                return [{"name": "Suede", "pct": 100}]
            return [{"name": "Leather", "pct": 70}, {"name": "Rubber", "pct": 30}]

    # 2. Bag sanity
    is_bag = (
        cat_low in ("accessories", "accessory", "bags")
        or any(w in text_low for w in ("bag", "handbag", "purse", "clutch", "crossbody", "tote", "תיק", "ארנק"))
    )
    if is_bag:
        is_canvas_tote = any(w in text_low for w in ("canvas", "קנבס", "בד", "cotton tote", "canvas tote", "fabric tote", "straw", "קש", "wicker", "basket"))
        is_generic_poly_or_cotton = all(str(m.get("name", "")).lower() in ("polyester", "cotton", "כותנה", "פוליאסטר") for m in normalized)
        if is_generic_poly_or_cotton and not is_canvas_tote:
            return [{"name": "Leather", "pct": 100}]

    # 3. Knitwear / Sweaters sanity
    is_knitwear = any(w in text_low for w in ("sweater", "knit", "knitwear", "pullover", "cardigan", "סוודר", "סריג", "סריגים"))
    if is_knitwear:
        is_flat_cotton = all(str(m.get("name", "")).lower() in ("cotton", "כותנה") for m in normalized)
        if is_flat_cotton:
            return [{"name": "Wool", "pct": 70}, {"name": "Acrylic", "pct": 30}]

    # 4. Denim sanity
    is_denim = any(w in text_low for w in ("jean", "jeans", "denim", "דנים", "ג'ינס", "גינס"))
    if is_denim:
        has_denim = any(str(m.get("name", "")).lower() in ("denim", "דנים") for m in normalized)
        if not has_denim:
            return [{"name": "Denim", "pct": 98}, {"name": "Spandex", "pct": 2}]

    # 5. Outerwear / Coat sanity: resolve explicit wool vs. leather contradiction
    is_coat_or_outerwear = (
        cat_low in ("outerwear", "coat", "coats")
        or sub_low in ("coats", "coat", "overcoat", "peacoat", "winter coat", "wool coat", "trench", "blazer")
        or any(w in text_low for w in ("coat", "מעיל", "overcoat", "peacoat", "blazer", "בלייזר"))
    )
    if is_coat_or_outerwear:
        has_explicit_wool_cue = any(w in text_low for w in ("wool", "צמר", "cashmere", "קשמיר", "tweed", "טוויד", "melton", "wool coat", "מעיל צמר"))
        has_explicit_leather_cue = any(w in text_low for w in ("leather", "עור", "suede", "זמש", "shearling", "patent", "vinyl", "pleather", "pu leather", "faux leather", "דמוי עור"))
        has_leather_mat = any(str(m.get("name", "")).lower() in ("faux leather", "leather", "דמוי עור", "עור", "pleather", "pu") for m in normalized)
        # ONLY override if text explicitly specifies wool/cashmere/tweed AND there are NO leather cues anywhere in text!
        if has_leather_mat and has_explicit_wool_cue and not has_explicit_leather_cue:
            return [{"name": "Wool", "pct": 80}, {"name": "Polyester", "pct": 20}]

    return normalized


def _sanitize_sleeve_and_cut_for_non_tops(res: dict[str, Any]) -> None:
    """Strip hallucinated 'Short-Sleeve' / 'Long-Sleeve' from non-tops (Footwear, Bottom, Accessories).

    Also sanitizes Accessories/Sunglasses item_type so it can never be 'Shorts' or 'Shirt'.
    """
    cat_l = str(res.get("category") or "").strip().lower()
    sub_l = str(res.get("sub_category") or "").strip().lower()
    it_l = str(res.get("item_type") or "").strip().lower()

    is_top_or_dress = cat_l in ("top", "outerwear", "dress", "full body") or any(
        w in sub_l for w in ("shirt", "blouse", "sweater", "hoodie", "jacket", "coat", "dress", "top", "tee")
    )
    if not is_top_or_dress:
        sleeve_patterns = [
            r"(?i)\bshort[- ]sleeve\b\s*",
            r"(?i)\blong[- ]sleeve\b\s*",
            r"(?i)\bcap[- ]sleeve\b\s*",
            r"(?i)\bsleeveless\b\s*",
        ]
        for field in ("name", "title", "sub_category", "item_type", "cut"):
            val = res.get(field)
            if isinstance(val, str):
                cleaned = val
                for pat in sleeve_patterns:
                    cleaned = re.sub(pat, "", cleaned)
                cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
                if field == "cut" and not cleaned:
                    res["cut"] = None
                elif cleaned != val:
                    res[field] = cleaned

    # Accessories / Sunglasses: item_type can NEVER be 'Shorts', 'Shirt', 'T-Shirt', 'Pants', 'Garment'
    if cat_l in ("accessories", "accessory") or "sunglass" in sub_l or "glass" in sub_l:
        full_text = f"{res.get('name', '')} {res.get('title', '')} {sub_l} {it_l}".lower()
        if "sunglass" in sub_l or "glass" in sub_l or any(w in full_text for w in ("sunglass", "glasses", "shades", "משקפ")):
            res["category"] = "Accessories"
            res["sub_category"] = "Sunglasses"
            curr_it = str(res.get("item_type") or "").strip().lower()
            if curr_it in ("shorts", "shirt", "t-shirt", "pants", "garment", "clothing", "item", "top", "bottom", "") or "sleeve" in curr_it:
                res["item_type"] = "Classic Sunglasses"


def _sanitize_foreign_token_bleed(res: dict[str, Any], language: str | None = None) -> None:
    """Strip CJK ideographs and Korean Hangul from non-Asian target languages.

    Multilingual quantized models (like Gemma-4 Q3_K_M) occasionally leak
    Korean/Chinese subwords into Hebrew, Arabic, or English text (e.g. '길 색').
    """
    lang = (language or "en").lower().strip()
    if lang in ("zh", "ja", "ko"):
        return

    # Match Hangul syllables, Jamo, and CJK ideographs
    foreign_pattern = re.compile(r"[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u4e00-\u9fff\u3040-\u30ff]+")

    for field in ("caption", "name", "title", "item_type", "sub_category", "brand", "cut"):
        val = res.get(field)
        if isinstance(val, str):
            if foreign_pattern.search(val):
                cleaned = foreign_pattern.sub(" ", val)
                cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
                cleaned = re.sub(r"\s+([.,;:!?])", r"\1", cleaned)
                res[field] = cleaned
            # Strip trailing dot-joined artifact tokens like .primetime
            if "." in str(res.get(field, "")):
                res[field] = re.sub(r"\.(?:primetime|clothing|garment|apparel|model|outfit)\b", "", str(res[field]), flags=re.IGNORECASE).strip()

    # Note: Caption translation/synthesis for Hebrew/multilingual is handled after
    # Hebrew title & feature synthesis so visual cues from the model caption are preserved.

    tags = res.get("tags")
    if isinstance(tags, list):
        clean_tags = []
        for t in tags:
            if isinstance(t, str):
                t_clean = foreign_pattern.sub(" ", t)
                t_clean = re.sub(r"\s{2,}", " ", t_clean).strip()
                if t_clean:
                    clean_tags.append(t_clean)
            else:
                clean_tags.append(t)
        res["tags"] = clean_tags


def _sanitize_sandals_and_footwear(res: dict[str, Any]) -> None:
    """Ensure strappy/open-toe sandals are classified under Sandals, not Sneakers."""
    cat_l = str(res.get("category") or "").strip().lower()
    sub_l = str(res.get("sub_category") or "").strip().lower()
    it_l = str(res.get("item_type") or "").strip().lower()
    full_text = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {sub_l} {it_l}".lower()

    is_sandal_cues = any(w in full_text for w in (
        "sandal", "sandals", "סנדל", "סנדלים", "strappy", "open-toe", "open toe",
        "heeled sandal", "slide", "wedge", "espadrille", "gladiator", "peep-toe"
    ))
    if is_sandal_cues or (cat_l == "footwear" and any(w in full_text for w in ("straps", "open toe", "heeled"))):
        res["category"] = "Footwear"
        res["sub_category"] = "Sandals"
        if any(w in full_text for w in ("heel", "heeled", "wedge", "high")):
            res["item_type"] = "Heeled Sandals"
        elif any(w in full_text for w in ("strap", "gladiator")):
            res["item_type"] = "Strappy Sandals"
        elif any(w in full_text for w in ("slide", "slip")):
            res["item_type"] = "Slide Sandals"
        else:
            res["item_type"] = "Open-Toe Sandals"

        for field in ("name", "title"):
            val = res.get(field)
            if isinstance(val, str) and any(w in val.lower() for w in ("sneaker", "sneakers", "סניקרס")):
                cleaned = re.sub(r"(?i)\b(?:white\s+leather\s+)?classic\s+sneakers?\b", "Strappy Sandals", val)
                cleaned = re.sub(r"(?i)\bsneakers?\b", "Sandals", cleaned)
                res[field] = cleaned.strip()

        # Sandals are summer wear, never winter
        res["season"] = ["summer"]
        if str(res.get("dress_code", "")).lower() == "business":
            res["dress_code"] = "casual"

    is_boot_cues = any(w in full_text for w in (
        "boot", "boots", "מגפיים", "מגפונים", "ankle boot", "combat boot", "chelsea boot",
        "lace-up boot", "lace-up", "laces", "lacing", "lug sole", "high top boot"
    ))
    if is_boot_cues and (cat_l == "footwear" or "shoe" in full_text or "loaf" in full_text):
        res["category"] = "Footwear"
        res["sub_category"] = "Boots"
        if any(w in full_text for w in ("combat", "lug", "lace", "שרוכים", "רצועות")):
            res["item_type"] = "Combat Boots"
        elif any(w in full_text for w in ("chelsea", "elastic")):
            res["item_type"] = "Chelsea Boots"
        else:
            res["item_type"] = "Ankle Boots"
        for field in ("name", "title"):
            val = res.get(field)
            if isinstance(val, str) and any(w in val.lower() for w in ("loafer", "loafers", "לופר")):
                cleaned = re.sub(r"(?i)\bloafers?\b", "Boots", val)
                cleaned = re.sub(r"לופרים", "מגפיים", cleaned)
                res[field] = cleaned.strip()


def _sanitize_tshirt_and_tops(res: dict[str, Any]) -> None:
    """Ensure crewneck and casual t-shirts are classified under T-Shirt, never Button-Down Shirt."""
    cat_l = str(res.get("category") or "").strip().lower()
    sub_l = str(res.get("sub_category") or "").strip().lower()
    it_l = str(res.get("item_type") or "").strip().lower()
    full_text = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {sub_l} {it_l}".lower()

    is_tshirt_cues = any(w in full_text for w in (
        "t-shirt", "t shirt", "tee", "crew neck t-shirt", "crewneck t-shirt", "חולצת טי", "חולצת טי עגולה",
        "short sleeve crew", "crew neck tee"
    ))
    if is_tshirt_cues and not any(w in full_text for w in ("button-down", "button down", "collared", "מכופתר", "oxford")):
        res["category"] = "Top"
        res["sub_category"] = "T-Shirt"
        res["item_type"] = "Crew-Neck T-Shirt" if "crew" in full_text or "עגול" in full_text else "Short-Sleeve T-Shirt"


def _sanitize_sweatpants_and_trainer(res: dict[str, Any]) -> None:
    """Ensure footer/trainer/sweatpants are classified as Sweatpants/Joggers, not Wool Tailored Trousers."""
    cat_l = str(res.get("category") or "").strip().lower()
    sub_l = str(res.get("sub_category") or "").strip().lower()
    it_l = str(res.get("item_type") or "").strip().lower()
    full_text = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {sub_l} {it_l}".lower()

    is_trainer_sweats = any(w in full_text for w in (
        "trainer", "footer", "sweat", "jogger", "טרנינג", "פוטר", "track pant",
        "sweatpant", "fleece pant", "drawstring", "elastic cuff", "מכנסי אימון"
    ))
    if is_trainer_sweats and (cat_l in ("bottom", "bottoms", "") or sub_l in ("pants", "trousers", "jeans", "sweatpants", "joggers")):
        res["category"] = "Bottom"
        res["sub_category"] = "Pants"
        res["item_type"] = "Sweatpants"
        res["dress_code"] = "casual"

        fabrics = res.get("fabric_materials")
        if not fabrics or any(str(f.get("name", "")).lower() == "wool" for f in fabrics if isinstance(f, dict)):
            res["fabric_materials"] = [{"name": "Cotton", "pct": 80}, {"name": "Polyester", "pct": 20}]

        for field in ("name", "title"):
            val = res.get(field)
            if isinstance(val, str) and any(w in val.lower() for w in ("wool tailored", "tailored trouser", "tailored pant", "wool trouser", "chinos")):
                cleaned = re.sub(r"(?i)\bwool\s+tailored\s+trousers?\b", "Casual Sweatpants", val)
                cleaned = re.sub(r"(?i)\btailored\s+trousers?\b", "Sweatpants", cleaned)
                cleaned = re.sub(r"(?i)\btailored\s+pants?\b", "Sweatpants", cleaned)
                cleaned = re.sub(r"(?i)\bwool\s+trousers?\b", "Fleece Joggers", cleaned)
                cleaned = re.sub(r"(?i)\bchinos?\b", "Sweatpants", cleaned)
                res[field] = cleaned.strip()


_MULTILINGUAL_BOTTOM_TERMS = {
    # Hebrew
    "מכנסיים", "מכנסי", "מכנס", "חצאית", "דגמח", "דגמ\"ח", "טייץ", "שורט", "ברמודה",
    # English
    "pant", "pants", "trouser", "trousers", "jean", "jeans", "skirt", "skirts", "chino", "chinos", "slacks", "legging", "leggings", "shorts",
    # Arabic
    "بنطال", "بنطلون", "سروال", "تنورة", "جينز", "شورت",
    # German
    "hose", "hosen", "stoffhose", "rock", "kurze hose",
    # Spanish
    "pantalón", "pantalon", "pantalones", "falda", "faldas", "vaqueros", "bermudas",
    # French
    "pantalon", "pantalons", "jupe", "jupes", "bermuda",
    # Italian
    "pantalone", "pantaloni", "gonna", "gonne", "bermuda",
    # Portuguese
    "calça", "calças", "calca", "calcas", "saia", "saias", "bermuda",
    # Russian
    "брюки", "штаны", "джинсы", "юбка", "юбки", "шорты",
    # Dutch
    "broek", "broeken", "rok", "rokken",
    # Hindi
    "पतलून", "पैंट", "ट्राउजर", "स्कर्ट", "जींस",
    # Japanese
    "パンツ", "ズボン", "スラックス", "スカート", "ジーンズ", "ボトムス",
    # Chinese
    "裤子", "长裤", "短裤", "裙子", "半身裙", "牛仔裤",
}

_MULTILINGUAL_PANTS_TERMS = {
    "מכנסיים", "מכנסי", "מכנס", "דגמח", "דגמ\"ח", "טייץ",
    "pant", "pants", "trouser", "trousers", "jean", "jeans", "chino", "chinos", "slacks", "legging", "leggings",
    "بنطال", "بنطلون", "سروال", "جينز",
    "hose", "hosen", "stoffhose",
    "pantalón", "pantalon", "pantalones", "vaqueros",
    "pantalon", "pantalons",
    "pantalone", "pantaloni",
    "calça", "calças", "calca", "calcas",
    "брюки", "штаны", "джинсы",
    "broek", "broeken",
    "पतलून", "पैंट", "ट्राउजर",
    "パンツ", "ズボン", "スラックス",
    "裤子", "长裤", "牛仔裤",
}

_MULTILINGUAL_TOP_TERMS = {
    "jacket", "coat", "shirt", "blouse", "sweater", "hoodie", "windbreaker", "cardigan", "top", "tee",
    "ז'קט", "מעיל", "חולצה", "סוודר", "קפוצ'ון", "בלוזה", "סריג",
    "سترة", "جاكيت", "معطف", "قميص", "بلوزة", "كنزة",
    "jacke", "mantel", "hemd", "pullover", "bluse", "oberteil",
    "chaqueta", "abrigo", "camisa", "suéter", "sueter", "blusa",
    "veste", "manteau", "chemise", "pull", "chemisier", "haut",
    "giacca", "cappotto", "camicia", "maglione", "camicetta",
    "jaqueta", "casaco",
    "куртка", "пальто", "рубашка", "свитер", "блузка", "топ",
    "jas", "overhemd", "trui",
    "जैकेट", "कोट", "शर्ट", "स्वेटर", "ब्लाउज", "टॉप",
    "ジャケット", "コート", "シャツ", "セーター", "ブラウス", "トップス",
    "夹克", "大衣", "外套", "衬衫", "毛衣", "上衣",
}

_TOP_CUTS_BY_LANG = {
    "en": {"windbreaker": "Windbreaker Jacket", "sweater": "Casual Sweater", "blouse": "Elegant Blouse", "top": "Casual Top"},
    "he": {"windbreaker": "ז'קט רוח", "sweater": "סריג קז'ואל", "blouse": "בלוזה אלגנטית", "top": "חולצת קז'ואל"},
    "ar": {"windbreaker": "سترة واقية", "sweater": "كنزة كاجوال", "blouse": "بلوزة أنيقة", "top": "قميص كاجوال"},
    "de": {"windbreaker": "Windjacke", "sweater": "Freizeitpullover", "blouse": "Elegante Bluse", "top": "Freizeitoberteil"},
    "es": {"windbreaker": "Chaqueta cortavientos", "sweater": "Suéter casual", "blouse": "Blusa elegante", "top": "Top casual"},
    "fr": {"windbreaker": "Coupe-vent", "sweater": "Pull décontracté", "blouse": "Chemisier élégant", "top": "Haut décontracté"},
    "it": {"windbreaker": "Giacca a vento", "sweater": "Maglione casual", "blouse": "Camicetta elegante", "top": "Top casual"},
    "pt": {"windbreaker": "Jaqueta corta-vento", "sweater": "Suéter casual", "blouse": "Blusa elegante", "top": "Blusa casual"},
    "ru": {"windbreaker": "Ветровка", "sweater": "Повседневный свитер", "blouse": "Элегантная блузка", "top": "Повседневный топ"},
    "nl": {"windbreaker": "Windjack", "sweater": "Casual trui", "blouse": "Elegante blouse", "top": "Casual top"},
    "hi": {"windbreaker": "विंडब्रेकर जैकेट", "sweater": "कैजुअल स्वेटर", "blouse": "सुरुचिपूर्ण ब्लाउज", "top": "कैजुअल टॉप"},
    "ja": {"windbreaker": "ウインドブレーカー", "sweater": "カジュアルセーター", "blouse": "エレガントブラウス", "top": "カジュアルトップス"},
    "zh": {"windbreaker": "防风夹克", "sweater": "休闲毛衣", "blouse": "优雅衬衫", "top": "休闲上衣"},
}

_SKIRT_CUTS_BY_LANG = {
    "en": "A-Line Skirt",
    "he": "חצאית A-Line",
    "ar": "تنورة بقصة A-Line",
    "de": "A-Linien-Rock",
    "es": "Falda línea A",
    "fr": "Jupe trapèze",
    "it": "Gonna a ruota",
    "pt": "Saia evasê",
    "ru": "Юбка А-силуэта",
    "nl": "A-lijn rok",
    "hi": "ए-लाइन स्कर्ट",
    "ja": "Aラインスカート",
    "zh": "A字半身裙",
}

_HANDBAG_NAMES_BY_LANG = {
    "en": {"name": "Black Handbag", "item_type": "Handbag"},
    "he": {"name": "תיק צד שחור", "item_type": "תיק יד"},
    "ar": {"name": "حقيبة يد سوداء", "item_type": "حقيبة يد"},
    "de": {"name": "Schwarze Handtasche", "item_type": "Handtasche"},
    "es": {"name": "Bolso de mano negro", "item_type": "Bolso de mano"},
    "fr": {"name": "Sac à main noir", "item_type": "Sac à main"},
    "it": {"name": "Borsa a mano nera", "item_type": "Borsa a mano"},
    "pt": {"name": "Bolsa de mão preta", "item_type": "Bolsa de mão"},
    "ru": {"name": "Черная сумка", "item_type": "Сумка"},
    "nl": {"name": "Zwarte handtas", "item_type": "Handtas"},
    "hi": {"name": "काला हैंडबैग", "item_type": "हैंडबैग"},
    "ja": {"name": "黒のハンドバッグ", "item_type": "ハンドバッグ"},
    "zh": {"name": "黑色手提包", "item_type": "手提包"},
}


def _sanitize_cross_category_contamination(res: dict[str, Any], language: str | None = None) -> None:
    """Purge cross-category and anatomical contradictions across category, name, item_type, and caption across all 13 supported languages.
    
    Prevents hallucinated KV-cache bleed such as:
    - A Top/Outerwear/Jacket having item_type='מכנסיים ארוכים' / 'Pants' or caption mentioning pants
    - A Skirt having caption='מכנסיים גבריים...' / 'Men's pants...'
    - A Footwear item having sub_category='פיקוס' / nonsense
    - A Bag having item_type='נימוציד' / 'wall cover' or tag='# שקר'
    """
    if not isinstance(res, dict):
        return

    cat_l = str(res.get("category") or "").strip().lower()
    sub_l = str(res.get("sub_category") or "").strip().lower()
    name_str = str(res.get("name") or res.get("title") or "").strip()
    name_l = name_str.lower()
    cap_str = str(res.get("caption") or "").strip()
    cap_l = cap_str.lower()
    itype_str = str(res.get("item_type") or "").strip()
    itype_l = itype_str.lower()

    # Determine target language code
    lang_code = "en"
    if language:
        l_norm = language.strip().lower().replace("_", "-").split("-")[0]
        if l_norm in ("iw", "he"):
            lang_code = "he"
        elif l_norm in _CAPTION_TEMPLATES:
            lang_code = l_norm
    else:
        combined_txt = f"{name_str} {cap_str} {itype_str}"
        if any("\u0590" <= ch <= "\u05ea" for ch in combined_txt):
            lang_code = "he"
        elif any("\u0600" <= ch <= "\u06ff" for ch in combined_txt):
            lang_code = "ar"
        elif any("\u0400" <= ch <= "\u04ff" for ch in combined_txt):
            lang_code = "ru"
        elif any("\u0900" <= ch <= "\u097f" for ch in combined_txt):
            lang_code = "hi"
        elif any("\u3040" <= ch <= "\u30ff" for ch in combined_txt):
            lang_code = "ja"
        elif any("\u4e00" <= ch <= "\u9fff" for ch in combined_txt):
            lang_code = "zh"

    is_he = lang_code == "he"
    top_cuts = _TOP_CUTS_BY_LANG.get(lang_code, _TOP_CUTS_BY_LANG["en"])

    # 1. Top / Outerwear cleanup
    is_top_cat = cat_l in ("top", "outerwear") or any(w in sub_l or w in name_l for w in _MULTILINGUAL_TOP_TERMS)
    if is_top_cat:
        if any(w in itype_l for w in _MULTILINGUAL_BOTTOM_TERMS):
            if any(w in name_l or w in sub_l for w in ("jacket", "coat", "windbreaker", "ז'קט", "מעיל", "جاكيت", "jacke", "chaqueta", "veste", "куртка")):
                res["item_type"] = top_cuts["windbreaker"]
            elif any(w in name_l or w in sub_l for w in ("sweater", "cardigan", "hoodie", "סוודר", "סריג", "קפוצ", "كنزة", "pullover", "suéter", "pull", "свитер")):
                res["item_type"] = top_cuts["sweater"]
            elif any(w in name_l or w in sub_l for w in ("blouse", "בלוז", "بلوزة", "bluse", "chemisier", "блузка")):
                res["item_type"] = top_cuts["blouse"]
            else:
                res["item_type"] = top_cuts["top"]

        if any(w in cap_l for w in _MULTILINGUAL_BOTTOM_TERMS):
            if is_he:
                cleaned = re.sub(r"^(?:מכנסיים\s+(?:אדומים|שחורים|גבריים|נשיים)?|מכנסי\s+|מכנס\s+|חצאית\s+)", f"{name_str or 'זקט'} ", cap_str).strip()
                cleaned = re.sub(r"\b(מכנסיים|מכנסי|מכנס)\b", "ז'קט" if ("ז'קט" in name_l or "מעיל" in name_l) else "חולצה", cleaned)
                if any(w in cleaned for w in ("מכנסיים", "מכנסי", "מכנס")):
                    cleaned = f"{name_str or 'זקט'} מעוצב ונוח לשימוש יומיומי."
                res["caption"] = cleaned
            else:
                tpls = _CAPTION_TEMPLATES.get(lang_code, _CAPTION_TEMPLATES["en"])
                template_key = "coat" if ("jacket" in name_l or "coat" in name_l or cat_l == "outerwear") else "default"
                res["caption"] = tpls[template_key].format(name=name_str or tpls["fallback_name"])

    # 2. Skirt cleanup
    elif "skirt" in sub_l or "חצאית" in sub_l or "skirt" in itype_l or "חצאית" in itype_l or any(w in sub_l for w in ("تنورة", "falda", "jupe", "gonna", "saia", "rok", "юбка", "स्कर्ट", "スカート", "半身裙")):
        if any(w in itype_l for w in _MULTILINGUAL_PANTS_TERMS):
            res["item_type"] = _SKIRT_CUTS_BY_LANG.get(lang_code, _SKIRT_CUTS_BY_LANG["en"])
        if any(w in cap_l for w in _MULTILINGUAL_PANTS_TERMS):
            if is_he:
                cleaned = re.sub(r"^(?:מכנסיים\s+(?:גבריים|נשיים)?|מכנסי\s+|מכנס\s+)", "חצאית ", cap_str).strip()
                cleaned = re.sub(r"\b(מכנסיים|מכנסי|מכנס)\b", "חצאית", cleaned)
                if "מכנסי" in cleaned or "מכנס" in cleaned:
                    cleaned = f"{name_str or 'חצאית'} מחמיאה ואלגנטית להופעה יומיומית."
                res["caption"] = cleaned
            else:
                tpls = _CAPTION_TEMPLATES.get(lang_code, _CAPTION_TEMPLATES["en"])
                res["caption"] = tpls["default"].format(name=name_str or tpls["fallback_name"])

    # 3. Footwear cleanup (e.g. 'פיקוס', 'פקקים')
    elif cat_l == "footwear" or any(w in sub_l or w in name_l for w in ("shoe", "sneaker", "boot", "sandal", "heel", "נעלי", "סניקרס", "מגפ", "סנדל", "حذاء", "schuh", "zapato", "chaussure", "scarpa", "обувь", "鞋")):
        valid_fw_subs = {
            "shoes", "sneakers", "sandals", "boots", "loafers", "heels", "flats", "oxfords", "derbies",
            "נעליים", "סניקרס", "סנדלים", "מגפיים", "נעלי עקב", "מוקסינים",
            "أحذية", "سنيكرز", "صنادل", "أحذية بكعب", "لوفر",
            "schuhe", "stiefel", "sandalen", "sneaker",
            "zapatos", "botas", "sandalias", "zapatillas",
            "chaussures", "bottes", "sandales", "baskets",
            "scarpe", "stivali", "sandali",
            "sapatos", "botas", "sandálias", "tênis",
            "обувь", "ботинки", "сапоги", "сандалии", "кроссовки", "туфли",
            "schoenen", "laarzen",
            "जूते", "बूट", "सैंडल", "स्नीकर्स",
            "靴", "ブーツ", "サンダル", "スニーカー",
            "鞋", "鞋子", "靴子", "凉鞋", "运动鞋",
        }
        if sub_l not in valid_fw_subs:
            res["sub_category"] = "Shoes"
        tags = res.get("tags")
        if isinstance(tags, list):
            res["tags"] = [t for t in tags if str(t).strip().lower() not in ("# פקקים", "פקקים", "# שקר", "שקר", "lie", "fake", "# lie", "# fake")]

    # 4. Bags / Accessories cleanup (e.g. 'כיסוי קיר', 'נימוציד', '# שקר')
    elif cat_l in ("accessories", "accessory") or "bag" in sub_l or "תיק" in sub_l:
        if any(w in name_l for w in ("כיסוי קיר", "וילון", "wall cover", "curtain", "rideau", "vorhang", "cortina")):
            bag_meta = _HANDBAG_NAMES_BY_LANG.get(lang_code, _HANDBAG_NAMES_BY_LANG["en"])
            res["name"] = bag_meta["name"]
            res["title"] = bag_meta["name"]
            res["sub_category"] = "Handbag"
        if itype_str in ("נימוציד", "nimodicide") or not itype_str or itype_l == "accessories":
            bag_meta = _HANDBAG_NAMES_BY_LANG.get(lang_code, _HANDBAG_NAMES_BY_LANG["en"])
            res["item_type"] = bag_meta["item_type"]
        if any(w in cap_l for w in ("כיסוי קיר", "וילון", "wall cover", "curtain", "rideau", "vorhang", "cortina")):
            tpls = _CAPTION_TEMPLATES.get(lang_code, _CAPTION_TEMPLATES["en"])
            res["caption"] = tpls["accessories"].format(name=res.get("name") or tpls["fallback_name"])
        tags = res.get("tags")
        if isinstance(tags, list):
            res["tags"] = [t for t in tags if str(t).strip().lower() not in ("# שקר", "שקר", "lie", "fake", "# פקקים", "פקקים", "# lie", "# fake")]


def _norm_str(v: Any) -> str | None:
    if not isinstance(v, str):
        return None
    return v.strip().lower().replace("_", "-")


def _coerce_enum_field(
    parsed: dict[str, Any],
    key: str,
    valid: set[str],
    *,
    aliases: dict[str, str] | None = None,
    default: str | None = None,
) -> None:
    """Normalise ``parsed[key]`` to a value in ``valid`` (or ``None``).

    Steps: strip → lower via ``_norm_str`` → remap via ``aliases`` →
    accept only if in ``valid``. When the coerced value is invalid the
    field is set to ``default`` (typically ``None``) so Pydantic's
    optional-enum validators stay happy.
    """
    value = _norm_str(parsed.get(key))
    if value and aliases:
        value = aliases.get(value, value)
    parsed[key] = value if value in valid else default


def _coerce_seasons(parsed: dict[str, Any]) -> None:
    """Coerce ``parsed['season']`` to a validated list. Incurs a context-aware default if empty,
    and enforces strict seasonal realism (e.g. no summer for heavy outerwear/knitwear,
    no winter for shorts/sandals/swimwear, and eliminates indiscriminate 4-season tagging).
    """
    allowed = {"spring", "summer", "fall", "autumn", "winter", "all"}
    raw = parsed.get("season") or []
    if isinstance(raw, str):
        raw = [raw]
    seasons: list[str] = []
    for entry in raw:
        tok = _norm_str(entry)
        if tok == "autumn":
            tok = "fall"
        if tok in allowed and tok not in seasons:
            seasons.append(tok)

    cat_lower = (parsed.get("category") or "").strip().lower()
    sub_lower = (parsed.get("sub_category") or "").strip().lower()
    itype = (parsed.get("item_type") or "").strip().lower()
    txt = f"{cat_lower} {sub_lower} {itype} {parsed.get('name', '')} {parsed.get('title', '')} {parsed.get('caption', '')}".lower()

    is_heavy_cold = any(w in txt for w in (
        "coat", "jacket", "outerwear", "parka", "overcoat", "puffer", "down jacket", "fleece",
        "wool", "sweater", "cardigan", "knit", "knitwear", "hoodie", "hooded", "heavy",
        "מעיל", "ז'קט", "סוודר", "סריג", "קפוצ'ון", "צמר", "חורף", "פליז", "מגפיים", "boot"
    ))
    is_hot_summer = any(w in txt for w in (
        "shorts", "sandal", "sandals", "slide", "slides", "flip flop", "flip-flop",
        "swim", "bikini", "tank", "sleeveless", "crop top", "linen shorts", "cargo shorts",
        "סנדל", "סנדלים", "כפכף", "כפכפים", "בגד ים", "מכנסיים קצרים", "גופיה", "גופייה", "שורט"
    ))

    # Strip 'all' if heavy cold or hot summer
    if "all" in seasons:
        seasons.remove("all")
        if not seasons:
            if is_heavy_cold:
                seasons = ["fall", "winter"]
            elif is_hot_summer:
                seasons = ["spring", "summer"]
            else:
                seasons = ["spring", "summer", "fall"]

    # If empty, assign realistic seasons based on garment type
    if not seasons:
        if is_heavy_cold:
            seasons = ["fall", "winter"]
        elif is_hot_summer:
            seasons = ["spring", "summer"]
        else:
            seasons = ["spring", "summer", "fall"]

    # Rule 1: Heavy outerwear & knitwear & boots MUST NEVER include summer
    if is_heavy_cold:
        seasons = [s for s in seasons if s != "summer"]
        if not seasons:
            seasons = ["fall", "winter"]

    # Rule 2: Shorts, sandals, swimwear, sleeveless MUST NEVER include winter
    if is_hot_summer:
        seasons = [s for s in seasons if s != "winter"]
        if not seasons:
            seasons = ["spring", "summer"]

    # Rule 3: Eliminate indiscriminate 4-season check (spring, summer, fall, winter)
    if set(seasons) >= {"spring", "summer", "fall", "winter"}:
        if is_heavy_cold:
            seasons = ["fall", "winter", "spring"]
        elif is_hot_summer:
            seasons = ["spring", "summer"]
        else:
            seasons = ["spring", "summer", "fall"]

    order = ["spring", "summer", "fall", "winter"]
    parsed["season"] = [s for s in order if s in seasons]


def _coerce_single_garment(
    parsed: dict[str, Any] | list[dict[str, Any]],
    user_gender: str | None = None,
    language: str | None = None,
    *,
    model_gender: str | None = None,
) -> dict[str, Any]:
    """Collapse a list-of-garments response into the single-item contract.

    Eyes v3 (Gemma 4) sometimes returns ``[{...}, {...}]`` when a crop
    accidentally bundles two garments, or in the already-cropped fast
    path. ``analyze()`` is contractually single-garment, so we pick the
    first entry (model orders by prominence) and log so we can monitor
    how often this happens.
    """
    if isinstance(parsed, list):
        items = [x for x in parsed if isinstance(x, dict)]
        if not items:
            return {}
        if len(items) > 1:
            logger.info(
                "Eyes returned %d garments in one call; using the first "
                "(consider tightening crop or upgrading to multi-item path)",
                len(items),
            )
        res = dict(items[0])
    elif isinstance(parsed, dict):
        res = dict(parsed)
    else:
        return {}

    _sanitize_sleeve_and_cut_for_non_tops(res)
    _sanitize_sandals_and_footwear(res)
    _sanitize_sweatpants_and_trainer(res)
    _sanitize_foreign_token_bleed(res, language=language)
    _sanitize_cross_category_contamination(res, language=language)

    norm_model = resolve_garment_gender(model_gender)
    cat_lower = (res.get("category") or "").strip().lower()
    sub_lower = (res.get("sub_category") or "").strip().lower()
    full_text = f"{res.get('item_type', '')} {res.get('name', '')} {res.get('title', '')} {res.get('caption', '')}".lower()
    is_he = ((language or "").lower() in ("he", "iw")) or any("\u0590" <= ch <= "\u05ea" for ch in full_text)

    if not cat_lower:
        # If category is completely missing, infer from full_text or default to Top
        if any(w in full_text for w in ("jean", "pant", "short", "skirt", "trouser", "legging")):
            res["category"] = "Bottom"
            cat_lower = "bottom"
        elif any(w in full_text for w in ("coat", "jacket", "parka", "blazer", "cardigan")):
            res["category"] = "Outerwear"
            cat_lower = "outerwear"
        elif any(w in full_text for w in ("dress", "gown")):
            res["category"] = "Dress"
            cat_lower = "dress"
        elif any(w in full_text for w in ("shoe", "sneaker", "boot", "heel", "sandal")):
            res["category"] = "Footwear"
            cat_lower = "footwear"
        else:
            res["category"] = "Top"
            cat_lower = "top"

    # Subcategory collision prevention: NEVER allow sub_category to be identical to category or generic "Top"/"Tops"/"Bottom"/"Bottoms"
    if sub_lower in {"top", "tops", "bottom", "bottoms", "outerwear", "full body", "dress", "dresses", "footwear", "accessories", "clothing", "garment", ""} or sub_lower == cat_lower:
        if cat_lower == "top":
            if any(w in full_text for w in ("blouse", "בלוזה", "cap-sleeve", "cap sleeve", "flutter")) and norm_model != "men":
                res["sub_category"] = "Blouse"
            elif any(w in full_text for w in ("tee", "t-shirt", "tshirt", "טי")):
                res["sub_category"] = "T-Shirt"
            elif any(w in full_text for w in ("sweater", "cardigan", "knit", "סריג", "סוודר")):
                res["sub_category"] = "Sweater"
            elif any(w in full_text for w in ("tank", "camisole", "גופיי")):
                res["sub_category"] = "Tank Top"
            elif any(w in full_text for w in ("hoodie", "sweatshirt", "קפוצ")):
                res["sub_category"] = "Hoodie"
            else:
                res["sub_category"] = "Shirt" if norm_model == "men" else ("Blouse" if (res.get("gender") == "women" or norm_model == "women") else "Shirt")
        elif cat_lower == "bottom":
            if any(w in full_text for w in ("chino", "chinos", "צ'ינו", "slacks", "trouser", "trousers", "pleat", "tailored pant", "dress pant")):
                res["sub_category"] = "Pants"
            elif any(w in full_text for w in ("jean", "denim", "גינס")) and not any(w in full_text for w in ("chino", "chinos", "צ'ינו")):
                res["sub_category"] = "Jeans"
            elif any(w in full_text for w in ("short", "שורט", "קצר")):
                res["sub_category"] = "Shorts"
            elif any(w in full_text for w in ("skirt", "חצאית")):
                res["sub_category"] = "Skirt"
            elif any(w in full_text for w in ("legging", "טייץ")):
                res["sub_category"] = "Leggings"
            else:
                res["sub_category"] = "Pants"
        elif cat_lower == "outerwear":
            res["sub_category"] = "Coats" if any(w in full_text for w in ("coat", "מעיל", "parka")) else "Jackets"
        elif cat_lower in ("full body", "dress"):
            res["sub_category"] = "Dresses"
        elif cat_lower == "footwear":
            if any(w in full_text for w in ("sandal", "סנדל", "open-toe", "strappy", "wedge", "espadrille")):
                res["sub_category"] = "Sandals"
            elif any(w in full_text for w in ("heel", "pump", "עקב", "stiletto")):
                res["sub_category"] = "Heels"
            elif any(w in full_text for w in ("monk", "oxford", "derby", "brogue", "wingtip", "dress shoe")):
                res["sub_category"] = "Shoes"
            elif any(w in full_text for w in ("boot", "מגף", "מגפיים")):
                res["sub_category"] = "Boots"
            elif any(w in full_text for w in ("sneaker", "סניקרס", "running", "athletic")):
                res["sub_category"] = "Sneakers"
            elif any(w in full_text for w in ("loafer", "מוקסין", "slip-on", "flat")):
                res["sub_category"] = "Loafers"
            elif any(w in full_text for w in ("slide", "flip-flop", "כפכף", "clog")):
                res["sub_category"] = "Slides"
            else:
                res["sub_category"] = "Shoes"
        elif cat_lower in ("accessories", "accessory"):
            if any(w in full_text for w in ("sunglass", "glasses", "shades", "eyewear", "משקפ")):
                res["sub_category"] = "Sunglasses"
            elif any(w in full_text for w in ("hat", "cap", "beanie", "trapper", "beret", "fedora", "כובע")):
                res["sub_category"] = "Headwear"
            elif any(w in full_text for w in ("bag", "backpack", "tote", "purse", "clutch", "handbag", "תיק")):
                res["sub_category"] = "Bags"
            elif any(w in full_text for w in ("belt", "חגורה")):
                res["sub_category"] = "Belts"
            elif any(w in full_text for w in ("scarf", "shawl", "wrap", "צעיף")):
                res["sub_category"] = "Scarves & Wraps"
            elif any(w in full_text for w in ("glove", "mitten", "כפפה", "כפפות")):
                res["sub_category"] = "Gloves"
            else:
                res["sub_category"] = "Headwear"
        else:
            res["sub_category"] = "T-Shirt" if cat_lower == "top" else "Garment"
        sub_lower = (res.get("sub_category") or "").strip().lower()

    if cat_lower == "footwear" or sub_lower in {"shoes", "shoe", "casual shoes", "sneaker", "sneakers", "boots", "boot", "נעליים", "סניקרס"}:
        if any(w in full_text for w in ("sandal", "סנדל", "open-toe", "strappy", "wedge", "espadrille")):
            res["sub_category"] = "סנדלים" if is_he else "Sandals"
            sub_lower = "sandal" if not is_he else "סנדלים"
        elif any(w in full_text for w in ("monk", "oxford", "derby", "brogue", "wingtip", "dress shoe")) and not any(w in full_text for w in ("combat", "hiking", "timberland", "winter boot", "cowboy")):
            res["sub_category"] = "נעליים" if is_he else "Shoes"
            sub_lower = "shoes"
            if "monk" in full_text:
                res["item_type"] = "Double Monk Strap Shoes" if "double" in full_text else "Monk Strap Shoes"
            elif "oxford" in full_text:
                res["item_type"] = "Oxford Shoes"
            elif "derby" in full_text:
                res["item_type"] = "Derby Shoes"
            elif "brogue" in full_text:
                res["item_type"] = "Brogues"

    # Guarantee item_type is never blank or equal to category
    itype_lower = (res.get("item_type") or "").strip().lower()
    if not res.get("item_type") or itype_lower in {"top", "tops", "bottom", "bottoms", "outerwear", "full body", "footwear", "accessories", "clothing", "garment", ""} or itype_lower == cat_lower:
        res["item_type"] = res.get("sub_category") or "Shirt"
        itype_lower = (res["item_type"] or "").strip().lower()

    # Guarantee item_type and sub_category are distinct, aligned, and specific
    contradictory_footwear = (any(w in sub_lower for w in ("sandal", "סנדל")) and any(w in itype_lower for w in ("sneaker", "boot", "loafer", "shoe", "סניקרס", "מגף", "נעלי")))
    contradictory_bottom = (any(w in full_text for w in ("sweat", "jogger", "trainer", "טרנינג", "פוטר", "footer")) and any(w in itype_lower for w in ("tailor", "chino", "slacks", "suit", "צ'ינו")))
    if itype_lower == sub_lower or contradictory_footwear or contradictory_bottom:
        full_text_itype = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')}".lower()
        is_summer = any(s in res.get("season", []) for s in ("summer", "spring")) or any(w in full_text_itype for w in ("short", "cap", "summer", "קצר", "קיץ"))
        if any(w in sub_lower for w in ("t-shirt", "t_shirt", "tshirt", "tee", "טי")):
            if is_summer or any(w in full_text_itype for w in ("cap", "flutter", "short")):
                res["item_type"] = "חולצת טי שרוול קצר" if is_he else "Short-Sleeve T-Shirt"
            elif any(w in full_text_itype for w in ("long", "ארוך")):
                res["item_type"] = "חולצת טי שרוול ארוך" if is_he else "Long-Sleeve T-Shirt"
            else:
                res["item_type"] = "חולצת טי שרוול קצר" if is_he else "Short-Sleeve T-Shirt"
        elif any(w in sub_lower for w in ("shirt", "מכופתרת")):
            res["item_type"] = ("חולצה קצרה" if is_summer else "חולצה מכופתרת") if is_he else ("Short-Sleeve Shirt" if is_summer else "Button-Down Shirt")
        elif any(w in sub_lower for w in ("blouse", "בלוזה")):
            res["item_type"] = ("בלוזה קצרה" if is_summer else "בלוזה אלגנטית") if is_he else ("Cap-Sleeve Blouse" if is_summer else "Casual Blouse")
        elif any(w in sub_lower for w in ("jeans", "ג'ינס", "גינס")):
            if any(w in full_text_itype for w in ("chino", "chinos", "צ'ינו", "slacks")):
                res["sub_category"] = "מכנסיים" if is_he else "Pants"
                res["item_type"] = "מכנסי צ'ינו" if is_he else "Chinos"
            else:
                res["item_type"] = "ג'ינס גזרה ישרה" if is_he else "Straight Jeans"
        elif any(w in sub_lower for w in ("pants", "trousers", "מכנסי")):
            is_athletic_sweats = any(w in full_text_itype for w in (
                "sweat", "jogger", "trainer", "טרנינג", "פוטר", "fleece", "drawstring", "elastic", "track", "lounge", "sweatpant", "footer"
            ))
            if is_athletic_sweats:
                res["sub_category"] = "מכנסיים" if is_he else "Pants"
                res["item_type"] = "מכנסי טרנינג" if is_he else "Sweatpants"
                res["dress_code"] = "casual"
                fabrics = res.get("fabric_materials")
                if not fabrics or any(str(f.get("name", "")).lower() == "wool" for f in fabrics if isinstance(f, dict)):
                    res["fabric_materials"] = [{"name": "Cotton", "pct": 80}, {"name": "Polyester", "pct": 20}]
                for fld in ("name", "title"):
                    if res.get(fld):
                        val_s = str(res[fld])
                        cleaned_val = re.sub(r"(?i)\bwool\s+tailored\s+trousers?\b", "מכנסי טרנינג" if is_he else "Casual Sweatpants", val_s)
                        cleaned_val = re.sub(r"(?i)\btailored\s+trousers?\b", "מכנסי טרנינג" if is_he else "Sweatpants", cleaned_val)
                        cleaned_val = re.sub(r"(?i)\btailored\s+pants?\b", "מכנסי טרנינג" if is_he else "Sweatpants", cleaned_val)
                        cleaned_val = re.sub(r"(?i)\bwool\s+trousers?\b", "מכנסי טרנינג" if is_he else "Fleece Joggers", cleaned_val)
                        cleaned_val = re.sub(r"(?i)\bchinos?\b", "מכנסי טרנינג" if is_he else "Sweatpants", cleaned_val)
                        res[fld] = cleaned_val.strip()
            elif any(w in full_text_itype for w in ("chino", "chinos", "צ'ינו")):
                res["item_type"] = "מכנסי צ'ינו" if is_he else "Chinos"
            elif any(w in full_text_itype for w in ("cargo", "קארגו", "דגמח")):
                res["item_type"] = "מכנסי דגמ\"ח" if is_he else "Cargo Pants"
            elif any(w in full_text_itype for w in ("tailor", "suit", "formal", "dress pant", "crease", "pleat")):
                res["item_type"] = "מכנסיים מחויטים" if is_he else "Tailored Trousers"
                res["dress_code"] = "business"
            elif any(w in full_text_itype for w in ("cotton", "twill", "khaki", "tan", "beige")):
                res["item_type"] = "מכנסי צ'ינו" if is_he else "Chinos"
            else:
                res["item_type"] = "מכנסי קז'ואל" if is_he else "Casual Pants"
        elif any(w in sub_lower for w in ("sandal", "סנדל")):
            if any(w in full_text_itype for w in ("heel", "heeled", "wedge", "high")):
                res["item_type"] = "סנדלי עקב" if is_he else "Heeled Sandals"
            elif any(w in full_text_itype for w in ("strap", "gladiator")):
                res["item_type"] = "סנדלי רצועות" if is_he else "Strappy Sandals"
            elif any(w in full_text_itype for w in ("slide", "slip")):
                res["item_type"] = "כפכפי סלייד" if is_he else "Slide Sandals"
            else:
                res["item_type"] = ("סנדלים פתוחים" if any(w in full_text_itype for w in ("open", "toe", "pattern", "print")) else "סנדלים שטוחים") if is_he else ("Open-Toe Sandals" if any(w in full_text_itype for w in ("open", "toe", "pattern", "print")) else "Flat Sandals")
        elif any(w in sub_lower for w in ("sneaker", "סניקרס")):
            if any(w in full_text_itype for w in ("high-top", "high top")):
                res["item_type"] = "סניקרס גבוהות" if is_he else "High-Top Sneakers"
            elif any(w in full_text_itype for w in ("running", "athletic", "sport")):
                res["item_type"] = "סניקרס ריצה" if is_he else "Running Sneakers"
            else:
                res["item_type"] = "סניקרס נמוכות" if is_he else "Low-Top Sneakers"
        elif any(w in sub_lower for w in ("shoe", "נעלי")):
            res["item_type"] = "נעלי קז'ואל" if is_he else "Casual Shoes"
        elif any(w in sub_lower for w in ("sunglass", "glasses", "shades", "משקפ")):
            res["item_type"] = "משקפי שמש קלאסיים" if is_he else "Classic Sunglasses"
        elif any(w in sub_lower for w in ("coat", "מעיל")):
            res["item_type"] = "מעיל מחויט" if is_he else "Tailored Coat"
        elif any(w in sub_lower for w in ("jacket", "ג'קט")):
            res["item_type"] = "ג'קט קז'ואל" if is_he else "Casual Jacket"
        elif any(w in sub_lower for w in ("sweater", "סוודר", "סריג")):
            res["item_type"] = "סוודר צווארון עגול" if is_he else "Crew-Neck Sweater"
        elif any(w in sub_lower for w in ("skirt", "חצאית")):
            res["item_type"] = "חצאית A-Line" if is_he else "A-Line Skirt"
        elif any(w in sub_lower for w in ("dress", "שמלה")):
            res["item_type"] = "שמלת מידי" if is_he else "Midi Dress"
        elif any(w in sub_lower for w in ("headwear", "hat", "cap", "beanie", "כובע")):
            res["item_type"] = ("כובע גרב" if "beanie" in full_text_itype else "כובע קלאסי") if is_he else ("Beanie" if "beanie" in full_text_itype else ("Trapper Hat" if "trapper" in full_text_itype else "Classic Hat"))
        elif any(w in sub_lower for w in ("bag", "תיק")):
            res["item_type"] = "תיק יד" if is_he else "Handbag"
        elif any(w in sub_lower for w in ("belt", "חגורה")):
            res["item_type"] = "חגורת עור" if is_he else "Leather Belt"
        elif any(w in sub_lower for w in ("scarf", "צעיף")):
            res["item_type"] = "צעיף סרוג" if is_he else "Knit Scarf"
        elif any(w in sub_lower for w in ("glove", "כפפה")):
            res["item_type"] = "כפפות" if is_he else "Gloves"
        else:
            fallback_sub = res.get("sub_category") or ("פריט" if is_he else "Item")
            if cat_lower in ("top", "tops") or any(w in sub_lower for w in ("shirt", "top", "tee", "blouse")):
                res["item_type"] = ("חולצה קצרה" if is_summer else "חולצה קלאסית") if is_he else (f"Short-Sleeve {fallback_sub}" if is_summer else f"Classic {fallback_sub}")
            else:
                res["item_type"] = f"{fallback_sub} קלאסי" if is_he else f"Classic {fallback_sub}"
        itype_lower = (res["item_type"] or "").strip().lower()

    _sanitize_sleeve_and_cut_for_non_tops(res)
    _sanitize_sandals_and_footwear(res)
    _sanitize_sweatpants_and_trainer(res)
    _sanitize_tshirt_and_tops(res)
    cat_lower = (res.get("category") or "").strip().lower()
    sub_lower = (res.get("sub_category") or "").strip().lower()
    itype_lower = (res.get("item_type") or "").strip().lower()

    # Footwear pluralization and localization
    if cat_lower == "footwear" or sub_lower in {"boot", "shoe", "sneaker", "heel", "loafer", "sandal", "pump", "clog", "slide", "נעליים", "סנדלים", "כפכפים", "מגפיים"}:
        plural_map = {
            "boot": "Boots",
            "shoe": "Shoes",
            "sneaker": "Sneakers",
            "heel": "Heels",
            "loafer": "Loafers",
            "sandal": "Sandals",
            "pump": "Pumps",
            "ankle boot": "Ankle Boots",
            "knee-high boot": "Knee-High Boots",
            "leather boot": "Leather Boots",
            "clog": "Clogs",
            "slide": "Slides",
        }
        if is_he:
            he_footwear_map = {
                "boot": "מגפיים", "boots": "מגפיים", "ankle boot": "מגפונים", "ankle boots": "מגפונים",
                "shoe": "נעליים", "shoes": "נעליים", "casual shoe": "נעלי קז'ואל", "casual shoes": "נעלי קז'ואל",
                "sneaker": "סניקרס", "sneakers": "סניקרס", "heel": "נעלי עקב", "heels": "נעלי עקב",
                "loafer": "לופרים", "loafers": "לופרים", "sandal": "סנדלים", "sandals": "סנדלים",
                "clog": "כפכפים", "clogs": "כפכפים", "slide": "כפכפים", "slides": "כפכפים",
                "flopper": "כפכפים", "floppers": "כפכפים", "slipper": "נעלי בית", "slippers": "נעלי בית",
                "flat": "נעליים שטוחות", "flats": "נעליים שטוחות", "dress shoe": "נעליים אלגנטיות", "dress shoes": "נעליים אלגנטיות",
            }
            if sub_lower in he_footwear_map:
                res["sub_category"] = he_footwear_map[sub_lower]
            if itype_lower in he_footwear_map:
                res["item_type"] = he_footwear_map[itype_lower]
            if res.get("sub_category") and str(res.get("sub_category")).lower() in he_footwear_map:
                res["sub_category"] = he_footwear_map[str(res.get("sub_category")).lower()]
            if res.get("item_type") and str(res.get("item_type")).lower() in he_footwear_map:
                res["item_type"] = he_footwear_map[str(res.get("item_type")).lower()]
        else:
            if sub_lower in plural_map:
                res["sub_category"] = plural_map[sub_lower]
            elif res.get("sub_category") and not str(res.get("sub_category")).endswith("s"):
                res["sub_category"] = f"{res['sub_category']}s"

            if itype_lower in plural_map:
                res["item_type"] = plural_map[itype_lower]
            elif res.get("item_type") and not str(res.get("item_type")).endswith("s"):
                res["item_type"] = f"{res['item_type']}s"

    # Gender inference: analyze tailoring intent and respect user gender fallback
    norm_user = resolve_garment_gender(user_gender)
    norm_model = resolve_garment_gender(model_gender) or resolve_garment_gender(res.get("model_gender"))
    raw_g = (res.get("gender") or "").strip().lower()
    g_val = _GENDER_ALIASES.get(raw_g, raw_g)

    pat_val = (res.get("pattern") or "").strip().lower()
    is_fem_cut = is_distinctly_feminine_garment(cat_lower, sub_lower, itype_lower, name=res.get("name"), full_text=full_text, pattern=pat_val)
    is_masc_cut = is_distinctly_masculine_garment(cat_lower, sub_lower, itype_lower)
    is_unisex_cut = is_distinctly_unisex_garment(cat_lower, sub_lower, itype_lower, name=res.get("name"), full_text=full_text, pattern=pat_val)

    # Feminine tops with floral prints or feminine cuts should NEVER be "Tailored Shirts"
    if is_fem_cut or res.get("gender") == "women" or any(w in full_text for w in ("floral", "flower", "פרח", "blouse", "בלוזה")):
        if sub_lower in ("tailored shirts", "tailored shirt", "tailored_shirts", "tailored_shirt"):
            res["sub_category"] = "Blouse"
            sub_lower = "blouse"
        if itype_lower in ("tailored shirts", "tailored shirt", "crew-neck t-shi", "crew-neck t-shirt", "crew neck t-shirt") and any(w in full_text for w in ("floral", "flower", "פרח")):
            res["item_type"] = "Floral Print Blouse" if "blouse" in full_text else "Floral Print Short-Sleeve Top"
            itype_lower = res["item_type"].lower()

    if itype_lower.endswith("-shi") or itype_lower.endswith(" t-shi"):
        res["item_type"] = res["item_type"].replace("-shi", "-Shirt").replace(" t-shi", " T-Shirt")
        itype_lower = res["item_type"].lower()

    # Strict 3-step gender determination hierarchy:
    # 1. Human Model Gender: If an identifiable human model is detected in the photo, align with the model's gender.
    # 2. Garment Criteria (Singlet analysis): If no model (flat lay, hanger, product), analyze garment silhouette, cut, pattern, and LLM vision prediction.
    # 3. Uncertain basics: If the garment is a neutral basic without clear gender cues, fall back to user's profile gender.
    # RULE: NEVER use a default gender; NEVER default to "men".
    if norm_model in ("men", "women"):
        res["gender"] = norm_model
        if norm_model == "men":
            if sub_lower == "blouse":
                res["sub_category"] = "Shirt"
            if itype_lower in ("cap-sleeve blouse", "casual blouse", "blouse"):
                res["item_type"] = "Short-Sleeve Shirt" if any(w in full_text for w in ("short", "summer", "קצר")) else "Button-Down Shirt"
    elif is_fem_cut:
        res["gender"] = "women"
    elif is_masc_cut:
        res["gender"] = "men"
    elif is_unisex_cut or g_val == "unisex":
        res["gender"] = "unisex"
    elif g_val == "kids":
        res["gender"] = "kids"
    elif norm_user in ("men", "women"):
        # Anchor uncertain/neutral basics without clear gender cues to user's profile gender
        res["gender"] = norm_user
    elif g_val in ("women", "men"):
        # Honor model's visual prediction when no user profile gender
        res["gender"] = g_val
    elif g_val in _VALID_GENDER:
        res["gender"] = g_val
    else:
        # No model, no garment cues, and no user profile gender — safe neutral is unisex
        res["gender"] = "unisex"

    # Color refinement: upgrade generic "blue" / "כחול" to specific fine-grained shade if hinted
    full_color_text = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {' '.join(res.get('tags') or [])}".lower()
    is_he = (language in ("he", "iw")) or any("\u0590" <= ch <= "\u05ea" for ch in full_color_text)

    # Refine string color if present
    c_str = str(res.get("color") or "").strip().lower()
    if c_str in {"blue", "כחול"}:
        if any(w in full_color_text for w in ("light blue", "sky blue", "baby blue", "cyan", "turquoise", "תכלת", "כחול בהיר", "שמיים")):
            res["color"] = "תכלת" if is_he else "Light Blue"
    elif c_str in {"green", "ירוק"}:
        if any(w in full_color_text for w in ("olive", "זית")):
            res["color"] = "ירוק זית" if is_he else "Olive Green"
        elif any(w in full_color_text for w in ("mint", "sage", "מנטה")):
            res["color"] = "מנטה" if is_he else "Mint Green"

    colors = res.get("colors")
    if isinstance(colors, list) and colors:
        for c in colors:
            if isinstance(c, dict):
                c_name = str(c.get("name", "")).strip().lower()
                if c_name in {"blue", "כחול"}:
                    if any(w in full_color_text for w in ("light blue", "sky blue", "baby blue", "cyan", "turquoise", "תכלת", "כחול בהיר", "שמיים")):
                        c["name"] = "תכלת" if is_he else "Light Blue"
                        c["hex"] = "#7dd3fc"
                elif c_name in {"green", "ירוק"}:
                    if any(w in full_color_text for w in ("olive", "זית")):
                        c["name"] = "ירוק זית" if is_he else "Olive Green"
                        c["hex"] = "#808000"
                    elif any(w in full_color_text for w in ("mint", "sage", "מנטה")):
                        c["name"] = "מנטה" if is_he else "Mint Green"
                        c["hex"] = "#6ee7b7"

    # Guarantee valid percentages summing strictly to 100%
    raw_colors = res.get("colors") or res.get("color")
    if not raw_colors:
        _COLOR_KEYWORDS = [
            ("light blue", "Light Blue", "תכלת"),
            ("sky blue", "Light Blue", "תכלת"),
            ("navy", "Navy", "כחול כהה"),
            ("blue", "Blue", "כחול"),
            ("olive", "Olive Green", "ירוק זית"),
            ("mint", "Mint Green", "מנטה"),
            ("green", "Green", "ירוק"),
            ("burgundy", "Burgundy", "בורדו"),
            ("red", "Red", "אדום"),
            ("yellow", "Yellow", "צהוב"),
            ("orange", "Orange", "כתום"),
            ("pink", "Pink", "ורוד"),
            ("purple", "Purple", "סגול"),
            ("brown", "Brown", "חום"),
            ("beige", "Beige", "בז'"),
            ("tan", "Tan", "בז'"),
            ("cream", "Cream", "קרם"),
            ("khaki", "Khaki", "חאקי"),
            ("white", "White", "לבן"),
            ("black", "Black", "שחור"),
            ("grey", "Gray", "אפור"),
            ("gray", "Gray", "אפור"),
        ]
        found_c = None
        for kw, en_col, he_col in _COLOR_KEYWORDS:
            if kw in full_color_text or (is_he and he_col in full_color_text):
                found_c = he_col if is_he else en_col
                break
        if not found_c:
            if any(w in full_color_text for w in ("jean", "denim")):
                found_c = "כחול" if is_he else "Blue"
            elif any(w in full_color_text for w in ("sneaker", "athletic shoe", "running shoe")):
                found_c = "לבן" if is_he else "White"
            else:
                found_c = "אפור" if is_he else "Gray"
        raw_colors = [{"name": found_c, "pct": 100}]

    if raw_colors:
        res["colors"] = normalize_weighted_tags(raw_colors)
        if res["colors"] and not res.get("color"):
            res["color"] = res["colors"][0].get("name")

    # Unique name guarantee: ensure name is not generic ("בגד", "בגד ירוק", "Garment") and respects grammar & localization
    name_str = (res.get("name") or "").strip()
    sub_str = (res.get("sub_category") or "").strip()
    caption_str = (res.get("caption") or "").strip()
    has_hebrew_chars = any("\u0590" <= ch <= "\u05ea" for ch in name_str)
    has_latin_chars = any("a" <= ch.lower() <= "z" for ch in name_str)

    _generic_cat_words_he = {"בגד", "מכנסיים", "חולצה", "חולצת", "נעליים", "נעלי", "מעיל", "ז'קט", "שמלה", "חצאית", "סוודר", "תיק", "פריט"}
    _generic_cat_words_en = {"garment", "clothing", "item", "piece", "pants", "shirt", "shoes", "shoe", "coat", "jacket", "dress", "skirt", "sweater", "bag"}
    _color_words_all = {
        "black", "white", "grey", "gray", "blue", "green", "red", "yellow", "brown", "beige", "navy", "pink", "orange", "purple", "olive",
        "שחור", "לבן", "אפור", "כחול", "ירוק", "אדום", "צהוב", "חום", "בז'", "ורוד", "כתום", "סגול", "זית",
        "שחורה", "לבנה", "אפורה", "כחולה", "ירוקה", "אדומה", "צהובה", "חומה", "ורודה", "כתומה", "סגולה",
        "שחורים", "לבנים", "אפורים", "כחולים", "ירוקים", "אדומים", "צהובים", "חומים", "ורודים", "כתומים", "סגולים",
        "שחורות", "לבנות", "אפורות", "כחולות", "ירוקות", "אדומות", "צהובות", "חומות", "ורודות", "כתומות", "סגולות",
    }
    itype_str = (res.get("item_type") or "").strip()
    name_words = name_str.lower().split()
    is_bare_cat_color = (
        len(name_words) == 2
        and (
            (name_words[0] in _generic_cat_words_he and name_words[1] in _color_words_all)
            or (name_words[0] in _color_words_all and name_words[1] in _generic_cat_words_en)
            or (name_words[0] in _generic_cat_words_en and name_words[1] in _color_words_all)
        )
    )

    is_generic_name = (
        not name_str
        or name_str.lower() in (
            "בגד", "בגד ירוק", "בגד חום", "בגד שחור", "בגד לבן", "בגד כחול", "בגד אפור",
            "בגד צהוב", "בגד אדום", "בגד ורוד", "בגד כתום", "בגד סגול",
            "garment", "green garment", "brown garment", "black garment", "white garment",
            "blue garment", "gray garment", "grey garment", "clothing", "item", "solid shoes",
            "נעלי עקב", "נעליים", "מגפיים", "חולצה", "מכנסיים", "שמלה"
        )
        or name_str.startswith("בגד ")
        or name_str.lower().startswith("garment ")
        or name_str.lower() == sub_str.lower()
        or len(name_words) < 2
        or is_bare_cat_color
        or (is_he and (not has_hebrew_chars or (has_latin_chars and has_hebrew_chars)))
        or (any(w in f"{itype_str} {sub_str}".lower() for w in ("boot", "מגפ")) and any(w in name_str for w in ("נעלי עקב", "נעליים")))
    )

    if is_generic_name:
        color_name = ""
        colors = res.get("colors")
        if isinstance(colors, list) and colors and isinstance(colors[0], dict):
            color_name = colors[0].get("name", "")
        elif res.get("color"):
            color_name = str(res.get("color"))
        mat_name = ""
        mats = res.get("fabric_materials")
        if isinstance(mats, list) and mats and isinstance(mats[0], dict):
            m_val = mats[0].get("name", "")
            if m_val.lower() not in {"unknown", "n/a", "other", "none"}:
                mat_name = m_val
        itype = res.get("item_type") or sub_str or ""
        cat_lower = str(res.get("category") or "").strip().lower()

        if is_he:
            # Hebrew grammar: Noun first, followed by adjective (color/material) with proper gender agreement
            he_item_dict = {
                # Footwear cuts
                "oxford shoes": "נעלי אוקספורד",
                "oxford shoe": "נעלי אוקספורד",
                "oxfords": "נעלי אוקספורד",
                "oxford": "נעלי אוקספורד",
                "derby shoes": "נעלי דרבי",
                "derby shoe": "נעלי דרבי",
                "derbies": "נעלי דרבי",
                "derby": "נעלי דרבי",
                "monk strap shoes": "נעלי מאנק סטרפ",
                "monk strap": "נעלי מאנק סטרפ",
                "double monk strap shoes": "נעלי דאבל מאנק סטרפ",
                "double monk strap": "נעלי דאבל מאנק סטרפ",
                "brogues": "נעלי ברוג",
                "brogue shoes": "נעלי ברוג",
                "loafers": "לופרים",
                "loafer": "נעלי לופר",
                "round-toe loafers": "נעלי לופר",
                "moccasins": "מוקסינים",
                "moccasin": "מוקסין",
                "dress shoes": "נעליים אלגנטיות",
                "solid shoes": "נעליים אלגנטיות",
                "shoes": "נעליים",
                "casual shoes": "נעלי קז'ואל",
                "sneakers": "סניקרס",
                "running shoes": "נעלי ריצה",
                "low-top sneakers": "סניקרס נמוכות",
                "high-top sneakers": "סניקרס גבוהות",
                "sandals": "סנדלים",
                "platform sandals": "סנדלי פלטפורמה",
                "strappy sandals": "סנדלי רצועות",
                "boots": "מגפיים",
                "ankle boots": "מגפונים",
                "ankle_boots": "מגפונים",
                "combat boots": "מגפיים",
                "combat_boots": "מגפיים",
                "chelsea boots": "מגפוני צ'לסי",
                "flats": "נעליים שטוחות",
                "heels": "נעלי עקב",
                "pumps": "נעלי עקב",
                "clogs": "קבקבים",
                "slides": "כפכפים",
                "slippers": "נעלי בית",
                # Tops
                "printed skirt": "חצאית מודפסת",
                "skirt": "חצאית",
                "mini skirt": "חצאית מיני",
                "midi skirt": "חצאית מידי",
                "maxi skirt": "חצאית מקסי",
                "pleated skirt": "חצאית פליסה",
                "crew-neck t-shirt": "חולצת טי עגולה",
                "crew_neck_t_shirt": "חולצת טי עגולה",
                "short-sleeve t-shirt": "חולצת טי",
                "short_sleeve_t_shirt": "חולצת טי",
                "t-shirt": "חולצת טי",
                "v-neck t-shirt": "חולצת וי",
                "polo shirt": "חולצת פולו",
                "polo": "חולצת פולו",
                "tank top": "גופייה",
                "blouse": "בלוזה",
                "shirt": "חולצה",
                "button-down shirt": "חולצה מכופתרת",
                "dress shirt": "חולצה מכופתרת",
                "crew-neck sweater": "סוודר צווארון עגול",
                "crew neck sweater": "סוודר צווארון עגול",
                "sweater": "סוודר",
                "pullover": "סוודר",
                "cardigan": "קרדיגן",
                "hoodie": "קפוצ'ון",
                # Bottoms
                "cargo": "מכנסי דגמ\"ח",
                "cargos": "מכנסי דגמ\"ח",
                "cargo pants": "מכנסי דגמ\"ח",
                "cargo_pants": "מכנסי דגמ\"ח",
                "sweatpants": "מכנסי טרנינג",
                "joggers": "מכנסי ג'וגר",
                "pants": "מכנסיים",
                "trousers": "מכנסיים",
                "chinos": "מכנסי צ'ינו",
                "chino": "מכנסי צ'ינו",
                "shorts": "מכנסיים קצרים",
                "bermuda shorts": "ברמודה",
                "jeans": "ג'ינס",
                "straight jeans": "ג'ינס גזרה ישרה",
                "skinny jeans": "ג'ינס סקיני",
                # Outerwear & Dresses
                "jacket": "ז'קט",
                "blazer": "בלייזר",
                "coat": "מעיל",
                "trench coat": "מעיל טרנץ'",
                "dress": "שמלה",
                # Bags & Accessories
                "bag": "תיק",
                "bags": "תיקים",
                "handbag": "תיק יד",
                "crossbody bag": "תיק צד",
                "crossbody_bag": "תיק צד",
                "tote bag": "תיק טוט",
                "tote_bag": "תיק טוט",
                "clutch": "תיק קלאץ'",
                "belt": "חגורה",
                "sunglasses": "משקפי שמש",
                "hat": "כובע",
                "scarf": "צעיף",
                "cargo shorts": 'מכנסי דגמ"ח קצרים',
                "cargo_shorts": 'מכנסי דגמ"ח קצרים',
                "heeled boots": "מגפי עקב",
                "heeled ankle boots": "מגפוני עקב",
                "high heel boots": "מגפי עקב",
                "high heel ankle boots": "מגפוני עקב",
                "platform boots": "מגפי פלטפורמה",
                "platform ankle boots": "מגפוני פלטפורמה",
                "midi dress": "שמלת מידי",
                "maxi dress": "שמלת מקסי",
                "mini dress": "שמלת מיני",
                "peplum dress": "שמלת פפלום",
                "wrap dress": "שמלת מעטפת",
                "shirt dress": "שמלת חולצה",
                "slip dress": "שמלת סליפ",
                "skirt suit": "חליפת חצאית",
                "high heel pump": "נעלי עקב",
                "high heel pumps": "נעלי עקב",
                "high heels": "נעלי עקב",
                "pumps": "נעלי עקב",
                "long sleeve sv": "סוודר שרוול ארוך",
                "long sleeve sweater": "סוודר שרוול ארוך",
                "knit sweater": "סוודר סריג",
                "knitwear": "סריג",
                "casual jacket": "ז'קט קז'ואל",
                "hooded jacket": "ז'קט עם קפוצ'ון",
            }
            he_color_dict = {
                "white": "לבן", "grey": "אפור", "gray": "אפור", "black": "שחור",
                "blue": "כחול", "green": "ירוק", "yellow": "צהוב", "red": "אדום",
                "brown": "חום", "beige": "בז'", "navy": "כחול נייבי", "pink": "ורוד",
                "orange": "כתום", "purple": "סגול", "olive": "זית",
            }
            noun_he = None
            combined_txt = f"{itype} {sub_str} {caption_str}".lower()
            
            # 1. High-priority specific cuts from caption or itype
            # Footwear: Boots & Ankle boots (with or without heels) must take precedence over generic נעלי עקב
            is_ankle_boot = any(w in combined_txt for w in ("ankle boot", "ankle_boot", "מגפונ", "bootie", "chelsea"))
            is_boot = is_ankle_boot or any(w in combined_txt for w in ("boot", "מגפ"))
            has_heel = any(w in combined_txt for w in ("high heel", "heel", "pump", "עקב", "stiletto", "block heel"))

            if ("cargo" in combined_txt or "דגמח" in caption_str or 'דגמ"ח' in caption_str) and ("short" in combined_txt or "קצר" in combined_txt or "שורט" in combined_txt):
                noun_he = 'מכנסי דגמ"ח קצרים'
            elif "דגמח" in caption_str or 'דגמ"ח' in caption_str or "cargo" in combined_txt:
                noun_he = 'מכנסי דגמ"ח'
            elif is_ankle_boot and has_heel:
                noun_he = "מגפוני עקב"
            elif is_boot and has_heel:
                noun_he = "מגפי עקב"
            elif is_ankle_boot:
                noun_he = "מגפונים"
            elif is_boot:
                noun_he = "מגפיים"
            elif has_heel:
                noun_he = "נעלי עקב"
            elif any(w in combined_txt for w in ("long sleeve sv", "long sleeve sweater", "knit sweater", "סוודר סריג")):
                noun_he = "סוודר סריג"
            elif "אוקספורד" in caption_str or "oxford" in combined_txt:
                noun_he = "נעלי אוקספורד"
            elif "דרבי" in caption_str or "derby" in combined_txt:
                noun_he = "נעלי דרבי"
            elif "מאנק" in caption_str or "monk" in combined_txt:
                noun_he = "נעלי מאנק סטרפ"
            elif "ברוג" in caption_str or "brogue" in combined_txt:
                noun_he = "נעלי ברוג"
            elif "מוקסין" in caption_str:
                noun_he = "מוקסינים"
            elif "לופר" in caption_str or "loafer" in combined_txt:
                noun_he = "נעלי לופר"
            elif "סנדל" in caption_str or "sandal" in combined_txt:
                noun_he = "סנדלים"
            elif "סניקר" in caption_str or "sneaker" in combined_txt:
                noun_he = "סניקרס"
            elif any(w in combined_txt for w in ("peplum dress", "שמלת פפלום")):
                noun_he = "שמלת פפלום"
            elif any(w in combined_txt for w in ("midi dress", "שמלת מידי")):
                noun_he = "שמלת מידי"
            elif any(w in combined_txt for w in ("maxi dress", "שמלת מקסי")):
                noun_he = "שמלת מקסי"
            elif any(w in combined_txt for w in ("mini dress", "שמלת מיני")):
                noun_he = "שמלת מיני"
            elif any(w in combined_txt for w in ("wrap dress", "שמלת מעטפת")):
                noun_he = "שמלת מעטפת"
            elif any(w in combined_txt for w in ("skirt suit", "חליפת חצאית")):
                noun_he = "חליפת חצאית"
            elif "שמל" in caption_str or "dress" in combined_txt:
                noun_he = "שמלה"
            elif "פולו" in caption_str or "polo" in combined_txt:
                noun_he = "חולצת פולו"
            elif "מכופתרת" in caption_str or "button-down" in combined_txt:
                noun_he = "חולצה מכופתרת"
            elif "פליסה" in caption_str or "pleated" in combined_txt:
                noun_he = "חצאית פליסה"
            elif "צ'ינו" in caption_str or "chino" in combined_txt:
                noun_he = "מכנסי צ'ינו"
            elif "טרנץ'" in caption_str or "trench" in combined_txt:
                noun_he = "מעיל טרנץ'"
            elif "בלייזר" in caption_str or "blazer" in combined_txt:
                noun_he = "בלייזר"
            elif "קרדיגן" in caption_str or "cardigan" in combined_txt:
                noun_he = "קרדיגן"
            elif "משקפי שמש" in caption_str or "sunglass" in combined_txt:
                noun_he = "משקפי שמש"
            elif "תיק" in caption_str or "bag" in combined_txt:
                noun_he = "תיק"

            if not noun_he:
                noun_he = he_item_dict.get(itype.lower()) or he_item_dict.get(sub_str.lower())

            if not noun_he:
                # If itype already contains Hebrew letters, strip any English words
                he_words = [w for w in itype.split() if any("\u0590" <= ch <= "\u05ea" for ch in w)]
                if he_words and "בגד" not in he_words:
                    noun_he = " ".join(he_words)

            # Strict category fallbacks — NEVER generic "בגד"
            if not noun_he or noun_he == "בגד":
                if cat_lower == "footwear" or "shoe" in sub_str.lower() or "נעלי" in sub_str:
                    noun_he = "נעליים"
                elif cat_lower == "bottom" or "pant" in sub_str.lower() or "מכנסי" in sub_str:
                    noun_he = "מכנסיים"
                elif cat_lower == "top" or "shirt" in sub_str.lower() or "חולצ" in sub_str:
                    noun_he = "חולצה"
                elif cat_lower == "outerwear" or "coat" in sub_str.lower() or "מעיל" in sub_str:
                    noun_he = "מעיל"
                elif "bag" in sub_str.lower() or "תיק" in sub_str:
                    noun_he = "תיק"
                elif cat_lower == "accessories" or "חגור" in sub_str:
                    noun_he = "חגורה" if "חגור" in sub_str or "belt" in sub_str.lower() else "משקפי שמש"
                elif cat_lower == "full body" or "שמל" in sub_str:
                    noun_he = "שמלה"
                else:
                    noun_he = "פריט לבוש"

            # Enrich with camouflage pattern if detected
            is_camo = (
                res.get("pattern") == "camouflage"
                or any(w in combined_txt for w in ("camo", "camouflage", "הסוואה", "צבאי", "קמופלאז", "קמופלאז'"))
            )
            if is_camo and "הסוואה" not in noun_he:
                if noun_he in ("מכנסי דגמ\"ח", "דגמ\"ח"):
                    noun_he = "מכנסי דגמ\"ח הסוואה"
                elif noun_he == "מכנסיים":
                    noun_he = "מכנסי הסוואה"
                elif noun_he in ("חולצה", "חולצת טי"):
                    noun_he = "חולצת הסוואה"
                elif noun_he in ("מעיל", "ז'קט", "קפוצ'ון"):
                    noun_he = f"{noun_he} הסוואה"

            col_he = he_color_dict.get(color_name.lower(), color_name)
            if col_he:
                _inflections = {
                    "ירוק": ("ירוקה", "ירוקות", "ירוקים"),
                    "לבן": ("לבנה", "לבנות", "לבנים"),
                    "שחור": ("שחורה", "שחורות", "שחורים"),
                    "אפור": ("אפורה", "אפורות", "אפורים"),
                    "צהוב": ("צהובה", "צהובות", "צהובים"),
                    "אדום": ("אדומה", "אדומות", "אדומים"),
                    "חום": ("חומה", "חומות", "חומים"),
                    "כחול": ("כחולה", "כחולות", "כחולים"),
                    "ורוד": ("ורודה", "ורודות", "ורודים"),
                    "כתום": ("כתומה", "כתומות", "כתומים"),
                    "סגול": ("סגולה", "סגולות", "סגולים"),
                }
                # Masculine plural (ends in ים, or specific footwear/bottoms, or construct state מכנסי... / מגפוני... / מגפי...)
                is_masc_plur = noun_he.endswith("ים") or noun_he.startswith(("מכנסי ", "מגפוני ", "מגפי ")) or noun_he in ("מכנסיים", "מוקסינים", "לופרים", "מגפיים", "מגפונים", "כפכפים", "קבקבים", "משקפי שמש", "סנדלים")
                # Feminine plural / dual (ends in ות, or נעליים)
                is_fem_plur = noun_he.endswith("ות") or noun_he in ("נעליים", "נעלי אוקספורד", "נעלי דרבי", "נעלי לופר", "נעלי מאנק סטרפ", "נעלי ברוג", "נעלי קז'ואל", "נעלי עקב", "נעליים שטוחות", "נעליים אלגנטיות", "סניקרס")
                # Feminine singular (ends in ה or ת, or construct state שמלת... / חליפת... / חולצת..., but not dual/plural like נעליים / מגפיים, and not masculine plural like מכנסי...)
                is_fem_sing = not is_masc_plur and not is_fem_plur and (
                    noun_he.endswith(("ה", "ת")) or noun_he.startswith(("שמלת ", "חליפת ", "חולצת "))
                ) and not noun_he.endswith("ות") and noun_he not in ("נעליים", "מגפיים", "סנדלים")

                if col_he in _inflections:
                    fem_s, fem_p, masc_p = _inflections[col_he]
                    if is_masc_plur:
                        col_he = masc_p
                    elif is_fem_plur:
                        col_he = fem_p
                    elif is_fem_sing:
                        col_he = fem_s

            parts = [p for p in [noun_he, col_he] if p]
            # Attribute extract: if leather mentioned and not yet in parts
            if ("עור" in f"{mat_name} {caption_str}".lower() or "leather" in f"{mat_name} {caption_str}".lower()) and "מעור" not in parts and noun_he in ("נעלי אוקספורד", "נעלי דרבי", "נעלי לופר", "נעלי עקב", "נעליים", "תיק", "ז'קט", "מגפיים", "מגפונים", "מגפוני עקב", "מגפי עקב"):
                parts.append("מעור")
            res["name"] = " ".join(parts)
            res["title"] = res["name"]
            if noun_he:
                res["item_type"] = noun_he
        else:
            # English naming: Color + Pattern + Attribute/Cut + Item Noun (e.g. "Green Round-Toe Loafers", "Brown Camouflage Cargo Pants", "Brown Leather Oxford Shoes")
            attr_cut = ""
            comb_lower = f"{itype} {caption_str}".lower()
            if "round-toe" in comb_lower or "round toe" in comb_lower:
                attr_cut = "Round-Toe"
            elif "pointed-toe" in comb_lower or "pointed toe" in comb_lower:
                attr_cut = "Pointed-Toe"
            elif "pleated" in comb_lower:
                attr_cut = "Pleated"
            elif mat_name and mat_name.lower() in ("leather", "linen", "silk", "wool", "denim", "cotton", "cashmere"):
                attr_cut = mat_name.title()
            
            noun_en = itype
            if "cargo" in comb_lower or "דגמח" in comb_lower:
                noun_en = "Cargo Pants"
            elif "oxford" in comb_lower:
                noun_en = "Oxford Shoes"
            elif "derby" in comb_lower:
                noun_en = "Derby Shoes"
            elif "monk" in comb_lower:
                noun_en = "Monk Strap Shoes"
            elif "loafer" in comb_lower:
                noun_en = "Loafers"
            elif "chino" in comb_lower:
                noun_en = "Chinos"
            elif not noun_en or noun_en.lower() in ("garment", "clothing", "item", "solid shoes"):
                noun_en = sub_str if sub_str and sub_str.lower() != "footwear" else "Shoes"

            is_camo = (
                res.get("pattern") == "camouflage"
                or any(w in comb_lower for w in ("camo", "camouflage"))
            )
            attr_pat = "Camouflage" if is_camo and "camouflage" not in noun_en.lower() and "camo" not in noun_en.lower() else ""

            parts = [p for p in [color_name.title() if color_name else "", attr_pat, attr_cut, noun_en] if p]
            if len(parts) >= 2:
                res["name"] = " ".join(parts).title()
            else:
                res["name"] = f"{color_name.title()} {noun_en}".strip().title()
            res["title"] = res["name"]

    # Materials normalization & domain sanity check (Footwear!=Cotton, Bag!=generic Poly, Sweaters=knit yarn)
    mats = res.get("fabric_materials")
    if not mats or (isinstance(mats, list) and all(str(m.get("name", "")).lower() in {"unknown", "n/a", "other", "none", ""} for m in mats if isinstance(m, dict))):
        mats = []
    res["fabric_materials"] = sanitize_fabric_materials(
        mats,
        category=res.get("category"),
        sub_category=res.get("sub_category"),
        item_type=res.get("item_type"),
        full_text=f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')}",
    )

    # Sweaters / Knitwear / Pullovers belong to category 'Top', NOT 'Outerwear'
    if cat_lower == "outerwear" and any(w in f"{sub_lower} {itype_lower} {res.get('name', '')} {res.get('title', '')}".lower() for w in ("sweater", "knitwear", "pullover", "סוודר", "סריג", "סריגים", "jumper", "cardigan")):
        if not any(w in f"{sub_lower} {itype_lower} {res.get('name', '')}".lower() for w in ("coat", "overcoat", "parka", "trench", "blazer", "מעיל", "ז'קט")):
            res["category"] = "Top"
            cat_lower = "top"

    # Coat vs Dress auto-correction: Only convert Full Body to Outerwear if item_type/title is explicitly a heavy coat (and NOT a dress, skirt, gown, peplum, or suit)
    outerwear_coat_types = ("trench coat", "overcoat", "winter coat", "parka", "duster coat", "raincoat", "puffer coat", "מעיל טרנץ'", "מעיל חורף", "מעיל פוך")
    itype_l = str(res.get("item_type") or "").strip().lower()
    title_l = str(res.get("title") or "").strip().lower()
    sub_l = str(res.get("sub_category") or "").strip().lower()
    name_l = str(res.get("name") or "").strip().lower()
    is_explicit_dress = any(w in f"{itype_l} {title_l} {sub_l} {name_l}" for w in ("dress", "skirt", "gown", "peplum", "two-piece", "two piece", "suit", "שמלה", "חצאית", "חליפה"))
    if not is_explicit_dress and (cat_lower in {"full body", "dress"} or sub_l in {"dress", "dresses"}):
        if any(c in itype_l or c in title_l for c in outerwear_coat_types):
            res["category"] = "Outerwear"
            cat_lower = "outerwear"
            res["sub_category"] = "Coats"
            sub_lower = "coats"

    # Peplum & Skirt Suit auto-correction: Peplum dresses/waists and matching skirt suits are Full Body, NEVER Outerwear/Coats
    comb_peplum = f"{name_l} {title_l} {itype_l} {sub_l} {str(res.get('caption') or '').lower()}"
    if any(w in comb_peplum for w in ("peplum", "פפלום", "skirt suit", "pencil skirt suit", "two-piece skirt", "two piece skirt", "חליפת חצאית")):
        if cat_lower == "outerwear" or sub_l in ("coats", "coat", "jackets", "jacket", "מעילים", "מעיל", "ז'קטים", "ז'קט"):
            res["category"] = "Full Body"
            cat_lower = "full body"
            res["sub_category"] = "שמלות" if is_he else "Dresses"
            sub_lower = "dresses"
            is_pep = "peplum" in comb_peplum or "פפלום" in comb_peplum
            res["item_type"] = ("שמלת פפלום" if is_pep else "חליפת חצאית") if is_he else ("Peplum Dress" if is_pep else "Skirt Suit")
            import re as _re
            if is_he:
                if any(w in res.get("name", "") for w in ("מעיל", "ז'קט")):
                    res["name"] = _re.sub(r"\b(מעיל|ז'קט)\b", "שמלת פפלום" if is_pep else "חליפת חצאית", res["name"]).strip()
                if any(w in res.get("title", "") for w in ("מעיל", "ז'קט")):
                    res["title"] = _re.sub(r"\b(מעיל|ז'קט)\b", "שמלת פפלום" if is_pep else "חליפת חצאית", res["title"]).strip()
                if any(w in res.get("caption", "") for w in ("מעיל", "ז'קט")):
                    res["caption"] = _re.sub(r"\b(מעיל|ז'קט)\b", "שמלת פפלום" if is_pep else "חליפת חצאית", res["caption"]).strip()
            else:
                if any(w in res.get("name", "").lower() for w in ("coat", "jacket")):
                    res["name"] = _re.sub(r"(?i)\b(coat|jacket)\b", "Peplum Dress" if is_pep else "Skirt Suit", res["name"]).strip()
                if any(w in res.get("title", "").lower() for w in ("coat", "jacket")):
                    res["title"] = _re.sub(r"(?i)\b(coat|jacket)\b", "Peplum Dress" if is_pep else "Skirt Suit", res["title"]).strip()
                if any(w in res.get("caption", "").lower() for w in ("coat", "jacket")):
                    res["caption"] = _re.sub(r"(?i)\b(coat|jacket)\b", "peplum dress" if is_pep else "skirt suit", res["caption"]).strip()

    # Caption guarantee: ensure caption is never empty or blank
    cap = (res.get("caption") or "").strip()
    if not cap:
        lang_code = "en"
        if language:
            l_norm = language.strip().lower().replace("_", "-").split("-")[0]
            if l_norm in _CAPTION_TEMPLATES:
                lang_code = l_norm
            elif l_norm in ("iw", "he"):
                lang_code = "he"
        elif is_he:
            lang_code = "he"

        tpls = _CAPTION_TEMPLATES.get(lang_code, _CAPTION_TEMPLATES["en"])
        default_name = tpls["fallback_name"]
        name_val = res.get("name") or res.get("title") or default_name
        itype = (res.get("item_type") or res.get("sub_category") or default_name).lower()

        if "coat" in itype or cat_lower == "outerwear" or any(w in itype for w in ("מעיל", "ז'קט", "معطف", "mantel", "abrigo", "manteau", "cappotto", "пальто", "大衣")):
            res["caption"] = tpls["coat"].format(name=name_val)
        elif cat_lower == "footwear" or "boot" in itype or any(w in itype for w in ("shoe", "נעלי", "כפכפ", "סנדל", "מגפ", "حذاء", "schuh", "zapato", "chaussure", "scarpa", "обувь", "鞋")):
            res["caption"] = tpls["footwear"].format(name=name_val)
        elif "bag" in itype or "belt" in itype or cat_lower == "accessories" or any(w in itype for w in ("תיק", "חגור", "כובע", "حقيبة", "tasche", "bolso", "sac", "borsa", "сумка", "包")):
            res["caption"] = tpls["accessories"].format(name=name_val)
        else:
            res["caption"] = tpls["default"].format(name=name_val)
    res["caption"] = _clean_truncated_caption(res.get("caption"))

    # Rich descriptive caption synthesis for Hebrew
    if is_he:
        curr_cap = (res.get("caption") or "").strip()
        has_he_cap = any("\u0590" <= ch <= "\u05ea" for ch in curr_cap)
        has_latin_cap = any(ch.isalpha() and ord(ch) < 128 for ch in curr_cap)
        is_generic_fallback = curr_cap in (
            "פריט אופנה איכותי ונוח להשלמת המראה.",
            "פריט ורסטילי ונוח בעיצוב מוקפד ונקי.",
            "פריט בעל עיצוב אופנתי ונוח לשימוש יומיומי.",
            "פריט המוסיף טאץ' מיוחד וסטייל לכל הופעה.",
            "פריט מחויט ומעוצב בגזרה מחמיאה וקלאסית."
        ) or curr_cap.startswith("פריט ")

        if not curr_cap or (has_latin_cap and not has_he_cap) or is_generic_fallback:
            title_val = res.get("title") or res.get("name") or "פריט אופנה"
            cues = []
            comb_desc = f"{curr_cap} {' '.join(str(t) for t in res.get('tags') or [])}".lower()
            if any(w in comb_desc for w in ("hood", "hooded", "קפוצ'ון")) and "קפוצ'ון" not in title_val:
                cues.append("עם קפוצ'ון")
            if any(w in comb_desc for w in ("zipper", "zip-up", "full zip", "רוכסן")) and "רוכסן" not in title_val:
                cues.append("ורוכסן קדמי" if cues else "עם רוכסן קדמי")
            if any(w in comb_desc for w in ("cargo", "multi-pocket", "pockets", "utility", 'דגמ"ח', "כיסים")) and not any(k in title_val for k in ('דגמ"ח', "כיסים")):
                cues.append("וכיסים שימושיים" if cues else "עם כיסים שימושיים")
            if any(w in comb_desc for w in ("camo", "camouflage", "הסוואה")) and "הסוואה" not in title_val:
                cues.append("בהדפס הסוואה")
            if any(w in comb_desc for w in ("knit", "knitwear", "סרוג", "סריג")) and "סריג" not in title_val:
                cues.append("במרקם סרוג נעים")
            if any(w in comb_desc for w in ("heel", "high heel", "pump", "stiletto", "עקב")) and "עקב" not in title_val:
                cues.append("עם עקב אלגנטי ומחמיא")

            cue_suffix = f" {' '.join(cues)}" if cues else ""
            if cat_lower == "outerwear" or any(w in title_val for w in ("מעיל", "ז'קט", "קפוצ'ון")):
                res["caption"] = f"{title_val}{cue_suffix} מושלם לעונות הקרירות ולהשלמת המראה."
            elif cat_lower == "footwear" or any(w in title_val for w in ("נעלי", "מוקסין", "סנדל", "מגפ", "סניקרס")):
                res["caption"] = f"{title_val}{cue_suffix} המשלב נוחות וסטייל לכל הופעה."
            elif any(w in title_val for w in ("מכנסי", 'דגמ"ח', "חצאית", "ג'ינס")):
                res["caption"] = f"{title_val}{cue_suffix} בעיצוב יומיומי מחמיא ונוח."
            else:
                res["caption"] = f"{title_val}{cue_suffix} בעיצוב איכותי להשלמת המראה."

    # Pattern fallback: if model returned solid/empty/printed, check text for camouflage or graphics
    pat_str = (res.get("pattern") or "").strip().lower()
    full_pat_text = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {' '.join(str(t) for t in res.get('tags') or [])}".lower()
    is_camo = any(w in full_pat_text for w in ("camo", "camouflage", "צבאי", "הסוואה", "קמופלאז", "קמופלאז'"))

    if pat_str in ("camo", "camouflage", "camouflaged", "צבאי", "הסוואה", "קמופלאז", "קמופלאז'") or is_camo:
        res["pattern"] = "camouflage"
    elif not pat_str or pat_str in ("solid", "printed", "print", "none", "unknown", "other"):
        if any(w in full_pat_text for w in ("print", "printed", "graphic", "logo", "lettering", "artwork", "illustration", "slogan", "הדפס", "הדפסה", "גרפי", "לוגו", "איור", "כיתוב")):
            res["pattern"] = "printed"
        elif any(w in full_pat_text for w in ("geometric", "geometry", "texture", "textured", "weave", "waffle", "jacquard", "pique", "dot", "dots", "polka", "eyelet", "perforated", "mesh", "ribbed", "subtle", "גיאומטרי", "מרקם", "טקסטורה", "נקודות", "עיגולים", "מחורר", "דוגמה")):
            res["pattern"] = "geometric"
        elif any(w in full_pat_text for w in ("stripe", "striped", "פסים")):
            # Prevent footwear gloss/straps from triggering striped pattern unless zebra
            if cat_lower != "footwear" or "zebra" in full_pat_text or "זברה" in full_pat_text:
                res["pattern"] = "striped"
        elif any(w in full_pat_text for w in ("plaid", "check", "checker", "משובץ")):
            res["pattern"] = "plaid"
        elif any(w in full_pat_text for w in ("floral", "flower", "פרח")):
            res["pattern"] = "floral"

    # Eagle vs Deer correction: American Eagle / eagle bird emblem is often mistranslated or confused with deer ("אייל")
    full_text_lower = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {res.get('brand', '')} {' '.join(res.get('tags') or [])}".lower()
    has_eagle = any(w in full_text_lower for w in ("eagle", "עיט", "נשר", "איגל", "american eagle", "aeo"))
    has_deer_he = any(w in full_text_lower for w in ("אייל", "הדפס אייל", "ציור אייל", "איור אייל"))
    if has_deer_he and (has_eagle or "eagle" in str(res.get("brand", "")).lower() or any("eagle" in str(t).lower() for t in (res.get("tags") or []))):
        import re as _re
        for field in ("name", "title", "caption"):
            if res.get(field):
                res[field] = _re.sub(r"הדפס\s+אייל", "הדפס עיט", res[field])
                res[field] = _re.sub(r"\bאייל\b", "עיט", res[field])
        if isinstance(res.get("tags"), list):
            res["tags"] = [
                _re.sub(r"\bאייל\b", "עיט", t) if isinstance(t, str) else t
                for t in res["tags"]
            ]

    # Clean, deduplicate, and ensure tags are populated with 3-6 relevant unique tags
    raw_tags = res.get("tags") if isinstance(res.get("tags"), list) else []

    # Pre-clean existing tags and filter semantic duplicates
    seen_canonical: set[str] = set()
    cleaned_tags: list[str] = []
    for t in raw_tags:
        if not t or not isinstance(t, str):
            continue
        clean_t = t.strip()
        if not clean_t:
            continue
        ck = _canonical_tag_key(clean_t)
        if ck and ck not in seen_canonical:
            seen_canonical.add(ck)
            cleaned_tags.append(clean_t)

    # If tags are missing or fewer than 3, supplement with relevant style/occasion attributes (NEVER colors)
    color_words = {
        "black", "white", "grey", "gray", "blue", "green", "red", "yellow", "brown", "beige", "navy", "pink", "orange", "purple", "olive",
        "שחור", "לבן", "אפור", "כחול", "ירוק", "אדום", "צהוב", "חום", "בז'", "ורוד", "כתום", "סגול", "זית",
        "שחורה", "לבנה", "אפורה", "כחולה", "ירוקה", "אדומה", "צהובה", "חומה", "ורודה", "כתומה", "סגולה",
    }
    # Filter any color words from existing raw tags
    cleaned_tags = [t for t in cleaned_tags if t.strip().lower() not in color_words]

    if len(cleaned_tags) < 3:
        candidates = []
        if res.get("sub_category"):
            candidates.append(str(res["sub_category"]))
        if res.get("item_type") and str(res["item_type"]).lower() != str(res.get("sub_category", "")).lower():
            candidates.append(str(res["item_type"]))
        if res.get("pattern") and str(res["pattern"]).lower() not in ("none", "other", "unknown", "solid"):
            candidates.append(str(res["pattern"]))
        if res.get("dress_code"):
            dc = str(res["dress_code"]).strip().lower()
            sub_l = str(res.get("sub_category", "")).lower()
            it_l = str(res.get("item_type", "")).lower()
            is_non_athletic = any(k in sub_l or k in it_l for k in ("skirt", "dress", "heel", "pump", "blazer", "blouse", "bag", "חצאית", "שמלה", "עקב", "בלייזר", "תיק", "clutch"))
            if not (dc in ("athletic", "sports") and is_non_athletic):
                candidates.append(str(res["dress_code"]))
        if res.get("season") and isinstance(res["season"], list):
            for s in res["season"]:
                if s and s != "all":
                    candidates.append(str(s))
                    break
        if res.get("brand"):
            candidates.append(str(res["brand"]))

        for cand in candidates:
            cand_str = cand.strip()
            if not cand_str or cand_str.lower() in color_words:
                continue
            ck = _canonical_tag_key(cand_str)
            if ck and ck not in seen_canonical and ck not in color_words:
                seen_canonical.add(ck)
                cleaned_tags.append(cand_str)
            if len(cleaned_tags) >= 5:
                break

    res["tags"] = cleaned_tags[:5]

    # Tag localization fallback for Hebrew output
    is_lang_he = (language or "").lower() in ("he", "iw") or any("\u0590" <= ch <= "\u05ea" for ch in f"{res.get('name', '')} {res.get('title', '')}")
    if is_lang_he and isinstance(res.get("tags"), list):
        he_tag_map = {
            "eagle": "עיט",
            "deer": "אייל",
            "casual": "יומיומי",
            "casual wear": "יומיומי",
            "casual-wear": "יומיומי",
            "casualwear": "יומיומי",
            "smart-casual": "אלגנטי־יומיומי",
            "formal": "רשמי",
            "business": "עסקי",
            "athletic": "ספורטיבי",
            "utility": "יוטיליטי",
            "multi-pocket": "מרובה כיסים",
            "multipocket": "מרובה כיסים",
            "multi-pockets": "מרובה כיסים",
            "cargo": 'דגמ"ח',
            "cargo shorts": 'מכנסי דגמ"ח קצרים',
            "cargo pants": 'מכנסי דגמ"ח',
            "camo": "הסוואה",
            "camouflage": "הסוואה",
            "hood": "קפוצ'ון",
            "hooded": "עם קפוצ'ון",
            "zipper": "רוכסן",
            "zip": "רוכסן",
            "knit": "סרוג",
            "knitwear": "סריג",
            "sweater": "סוודר",
            "hoodie": "קפוצ'ון",
            "jacket": "ז'קט",
            "coat": "מעיל",
            "belt": "חגורה",
            "belts": "חגורה",
            "accessory": "אקססוריז",
            "accessories": "אקססוריז",
            "shoe": "נעליים",
            "shoes": "נעליים",
            "boot": "מגפיים",
            "boots": "מגפיים",
            "sandal": "סנדלים",
            "sandals": "סנדלים",
            "sneaker": "סניקרס",
            "sneakers": "סניקרס",
            "heel": "נעלי עקב",
            "heels": "נעלי עקב",
            "high heel": "נעלי עקב",
            "high heels": "נעלי עקב",
            "pump": "נעלי עקב",
            "pumps": "נעלי עקב",
            "high heel pump": "נעלי עקב",
            "loafer": "מוקסין",
            "loafers": "מוקסינים",
            "bag": "תיק",
            "bags": "תיקים",
            "handbag": "תיק יד",
            "t-shirt": "חולצת טי",
            "t_shirt": "חולצת טי",
            "tshirt": "חולצת טי",
            "tee": "חולצת טי",
            "shirt": "חולצה",
            "jeans": "ג'ינס",
            "pants": "מכנסיים",
            "trouser": "מכנסיים",
            "trousers": "מכנסיים",
            "shorts": "מכנסיים קצרים",
            "burgundy": "בורדו",
            "red": "אדום",
            "blue": "כחול",
            "navy": "כחול כהה",
            "light blue": "תכלת",
            "black": "שחור",
            "white": "לבן",
            "grey": "אפור",
            "gray": "אפור",
            "green": "ירוק",
            "olive": "ירוק זית",
            "brown": "חום",
            "beige": "בז'",
            "yellow": "צהוב",
            "cotton": "כותנה",
            "polyester": "פוליאסטר",
            "synthetic": "סינתטי",
            "denim": "דנים",
            "wool": "צמר",
            "leather": "עור",
            "linen": "פשתן",
            "printed": "הדפס",
            "print": "הדפס",
            "graphic": "גרפי",
            "logo": "לוגו",
            "summer": "קיץ",
            "winter": "חורף",
            "spring": "אביב",
            "fall": "סתיו",
            "autumn": "סתיו",
            "vintage": "וינטג'",
            "streetwear": "אופנת רחוב",
        }
        category_echoes = {
            "women's footwear", "womens footwear", "men's footwear", "mens footwear",
            "footwear", "women's clothing", "womens clothing", "men's clothing", "mens clothing",
            "clothing", "apparel", "garment", "fashion", "נעלי נשים", "נעלי גברים", "הנעלה", "ביגוד"
        }
        # Strip striped tag on footwear unless zebra
        if cat_lower == "footwear" and "zebra" not in full_pat_text and "זברה" not in full_pat_text:
            category_echoes.add("striped")
            category_echoes.add("stripe")
            category_echoes.add("פסים")

        translated_tags = [he_tag_map.get(str(t).strip().lower(), t) for t in res["tags"] if t]
        seen_he: set[str] = set()
        dedup_he: list[str] = []
        for t in translated_tags:
            t_str = str(t).strip()
            if not t_str or t_str.lower() in category_echoes:
                continue
            # Drop tags that still contain Latin characters in Hebrew mode to prevent English leaks
            if any(ord(ch) < 128 and ch.isalpha() for ch in t_str):
                continue
            if t_str not in seen_he:
                seen_he.add(t_str)
                dedup_he.append(t_str)
        res["tags"] = dedup_he[:6]

    # Ensure title and name are always synchronized
    if not res.get("title") and res.get("name"):
        res["title"] = res["name"]
    elif not res.get("name") and res.get("title"):
        res["name"] = res["title"]

    # Price estimation guarantee: provide realistic fallback if omitted or 0
    p = res.get("price_cents")
    if p is None or p <= 0:
        base_prices = {
            "top": 2500,
            "bottom": 4500,
            "outerwear": 9500,
            "full body": 6500,
            "footwear": 6000,
            "accessories": 2500,
            "underwear": 1500,
        }
        mult = {"budget": 0.6, "mid": 1.0, "premium": 2.2, "luxury": 5.0}.get(res.get("quality"), 1.0)
        res["price_cents"] = int(base_prices.get(cat_lower, 3000) * mult)

    _coerce_seasons(res)
    _sanitize_cross_category_contamination(res, language=language)
    return res


# -------------------- enum sanitisers --------------------
# The Flash tier of Gemini occasionally confuses ``state`` (new/used) with
# ``condition`` (bad/fair/good/excellent) or returns values in slightly
# different casing (e.g. "Smart Casual" vs "smart-casual"). Rather than
# reject those responses with a 422 at save time, we coerce them to the
# nearest valid enum value so the auto-fill stays useful and the user
# can still edit freely.
_VALID_STATE = {"new", "used"}
_VALID_CONDITION = {"bad", "fair", "good", "excellent"}
_VALID_QUALITY = {"budget", "mid", "premium", "luxury"}
_VALID_GENDER = {"men", "women", "unisex", "kids"}
_VALID_DRESS_CODE = {
    "casual", "smart-casual", "business", "formal", "athletic", "loungewear",
}
_VALID_PATTERN = {
    "solid", "striped", "plaid", "floral", "herringbone",
    "polka", "polka-dot", "polka_dot", "paisley", "geometric",
    "animal_print", "animal-print", "graphic", "tie_dye", "tie-dye", "abstract",
    "printed", "print", "camouflage",
}
_PATTERN_ALIASES = {
    "polka-dot": "polka_dot",
    "polka": "polka_dot",
    "animal-print": "animal_print",
    "tie-dye": "tie_dye",
    "print": "printed",
    "printed": "printed",
    "graphic": "printed",
    "graphic-print": "printed",
    "text": "printed",
    "slogan": "printed",
    "lettering": "printed",
    "logo": "printed",
    "camo": "camouflage",
    "camouflage": "camouflage",
    "camouflaged": "camouflage",
    "צבאי": "camouflage",
    "הסוואה": "camouflage",
    "קמופלאז": "camouflage",
    "קמופלאז'": "camouflage",
}





# Alias tables for the model's common off-spec echoes. Keeping these at
# module scope lets us unit-test them directly without instantiating the
# vision service.
_CONDITION_ALIASES = {"poor": "bad", "very-good": "excellent"}
_QUALITY_ALIASES = {
    "cheap": "budget", "entry": "budget", "basic": "budget",
    "mid-range": "mid", "standard": "mid",
    "high": "premium", "high-end": "premium",
}


_DRESS_CODE_ALIASES = {
    "athleisure": "athletic",
    "sport": "athletic",
    "sports": "athletic",
    "active": "athletic",
    "activewear": "athletic",
    "gym": "athletic",
    "workout": "athletic",
    "lounge": "loungewear",
    "sleepwear": "loungewear",
    "pajamas": "loungewear",
    "pyjamas": "loungewear",
    "homewear": "loungewear",
    "business-casual": "smart-casual",
    "business_casual": "smart-casual",
    "smart_casual": "smart-casual",
    "smartcasual": "smart-casual",
    "semi-formal": "smart-casual",
    "work": "business",
    "office": "business",
    "workwear": "business",
    "cocktail": "formal",
    "black-tie": "formal",
    "gala": "formal",
    "יומיומי": "casual",
    "אלגנטי-יומיומי": "smart-casual",
    "אלגנטי־יומיומי": "smart-casual",
    "עסקי": "business",
    "רשמי": "formal",
    "ספורטיבי": "athletic",
    "בגדי בית": "loungewear",
}


def _normalise_dress_code(raw: str | None) -> str | None:
    """Return the dress-code token after space→hyphen + common renames."""
    value = _norm_str(raw)
    if not value:
        return None
    value = value.replace(" ", "-")
    return _DRESS_CODE_ALIASES.get(value, value)


def _infer_garment_dress_code(parsed: dict[str, Any]) -> str:
    """Infer the dress code of a garment from its taxonomy, cut, and description.

    Valid dress codes: 'casual', 'smart-casual', 'business', 'formal', 'athletic', 'loungewear'.
    """
    raw_dc = _normalise_dress_code(parsed.get("dress_code"))
    sub = (parsed.get("sub_category") or "").lower().strip()
    itype = (parsed.get("item_type") or "").lower().strip()
    full_text = f"{parsed.get('title', '')} {parsed.get('name', '')} {sub} {itype} {parsed.get('caption', '')}".lower()

    # Athletic fleece pants, trainer pants, joggers, and sweatpants should NEVER be business
    if any(w in full_text for w in (
        "sweat", "jogger", "trainer", "טרנינג", "פוטר", "track pant", "sweatpant", "fleece pant", "footer"
    )) or itype in ("sweatpants", "joggers", "track pants") or sub in ("sweatpants", "joggers"):
        return "casual" if raw_dc not in ("athletic", "loungewear") else raw_dc

    # Casual garments (tees, sneakers, sandals, sunglasses) should NEVER be business
    if any(w in full_text for w in ("t-shirt", "tee", "sneaker", "sandal", "sunglass", "shorts")):
        if raw_dc in ("business", "formal"):
            return "casual"

    if raw_dc in _VALID_DRESS_CODE and raw_dc != "casual":
        return raw_dc

    # 1. Formal (Black tie, evening gowns, tuxedos, cocktail)
    if any(w in full_text for w in (
        "tuxedo", "ballgown", "evening gown", "cocktail dress", "formal gown",
        "cufflinks", "cummerbund", "black tie", "טוקסידו", "שמלת ערב"
    )):
        return "formal"

    # 2. Business (Suits, blazers, dress trousers, tailored suits, oxford dress shoes)
    if any(w in full_text for w in (
        "suit jacket", "suit pant", "business suit", "blazer", "dress trouser",
        "tailored suit", "pencil skirt", "oxford shoe", "derby shoe",
        "dress shoe", "חליפה", "בלייזר", "חצאית עיפרון"
    )):
        return "business"

    # Outerwear (jackets, coats, windbreakers, parkas) should NEVER be loungewear
    is_outerwear = (
        parsed.get("category") == "Outerwear"
        or sub in ("jackets", "jacket", "coats", "coat", "parka", "windbreaker")
        or itype in ("jacket", "hooded jacket", "windbreaker", "parka", "coat", "bomber jacket")
        or any(w in full_text for w in ("jacket", "coat", "windbreaker", "parka", "hooded jacket", "מעיל", "ז'קט"))
    )

    # 3. Loungewear / Sleepwear (Check before smart-casual so silk pajamas/robes are loungewear)
    # Hoodies and jackets are NOT loungewear (they are casual/athletic).
    if not is_outerwear and any(w in full_text for w in (
        "pajama", "pajamas", "pyjama", "sleepwear", "nightgown", "bathrobe", "robe",
        "lounge", "loungewear", "slippers", "פיג'מה", "חלוק"
    )):
        return "loungewear"

    # 4. Athletic / Activewear
    if any(w in full_text for w in (
        "athletic", "running", "gym", "workout", "activewear", "sports bra", "sportswear",
        "yoga", "sweatband", "swim", "swimsuit", "bikini", "rashguard", "track pants",
        "cycling", "cleats", "jogging", "performance", "גופיית ספורט", "אימון"
    )):
        if not any(w in full_text for w in ("casual sneaker", "fashion sneaker", "classic sneaker")):
            return "athletic"

    # 5. Smart-Casual (Button-down shirts, tailored shirts, collared shirts, chinos, loafers, blouses, sweaters, trench coats)
    if any(w in full_text for w in (
        "button-down", "button down", "tailored shirt", "collared shirt", "dress shirt",
        "blouse", "chino", "chinos", "loafer", "loafers", "trench coat", "cardigan",
        "sweater", "pullover", "turtleneck", "polo", "polo shirt", "wrap dress", "midi dress",
        "ankle boot", "chelsea boot", "derby", "oxford", "brogue", "trouser", "trousers",
        "slacks", "tailored pant", "dress pant", "pleated", "heels", "pumps",
        "silk blouse", "silk shirt", "linen shirt", "linen pant", "linen trouser",
        "מכופתרת", "פולו", "בלוזה", "לופר", "סוודר", "סריג", "צ'ינו", "מכנסי בד"
    )) or sub in ("sweater", "blouse") or itype in ("chinos", "tailored trousers", "button-down shirt", "crew-neck sweater"):
        return "smart-casual"

    if raw_dc in _VALID_DRESS_CODE:
        return raw_dc
    return "casual"


def _coerce_enums(
    parsed: dict[str, Any],
    user_gender: str | None = None,
    *,
    model_gender: str | None = None,
) -> dict[str, Any]:
    """Best-effort coercion of AI-returned enum values.

    * Unknown / empty values are defaulted to sensible fallbacks rather than
      dropped, so the user never sees empty dashes ("—").
    * ``state`` defaults to ``used``; the user can flip to ``new`` in the form.
    * ``gender`` defaults to user's profile gender if unrecognized, else 'unisex'.
    """
    _sanitize_sleeve_and_cut_for_non_tops(parsed)
    _sanitize_sandals_and_footwear(parsed)
    _sanitize_sweatpants_and_trainer(parsed)

    norm_user = resolve_garment_gender(user_gender)
    norm_model = resolve_garment_gender(model_gender) or resolve_garment_gender(parsed.get("model_gender"))
    cat_lower = str(parsed.get("category") or "").strip().lower()
    sub_lower = str(parsed.get("sub_category") or "").strip().lower()
    itype_lower = str(parsed.get("item_type") or "").strip().lower()
    raw_g = str(parsed.get("gender") or "").strip().lower()
    g_val = _GENDER_ALIASES.get(raw_g, raw_g)
    full_text_enum = f"{parsed.get('name', '')} {parsed.get('title', '')} {parsed.get('caption', '')}".lower()

    # Discard non-clothing objects misclassified as garments/accessories (water bottles, cups, phones)
    full_combined = f"{full_text_enum} {sub_lower} {itype_lower}".lower()
    if any(w in full_combined for w in (
        "water bottle", "plastic bottle", "bottle", "disposable bottle", "water flask", "flask",
        "tumbler", "drink cup", "beverage", "thermos", "drinking glass", "coffee mug", "coffee cup",
        "smartphone", "cell phone", "mobile phone", "telephone", "iphone", "android phone",
    )):
        parsed["is_clothing"] = False
        parsed["category"] = "Accessories"
        parsed["sub_category"] = "non-clothing"
        parsed["item_type"] = "non-clothing"
        parsed["title"] = "Non-clothing item"
        sub_lower = "non-clothing"
        itype_lower = "non-clothing"

    # Chinos vs Jeans: Chinos are specifically cotton twill chinos, NEVER generic trousers
    has_twill = any(w in full_combined for w in ("twill", "cotton twill", "chino", "chinos", "צ'ינו"))
    is_denim = "denim" in full_combined or "5-pocket" in full_combined or "rivet" in full_combined
    is_chinos = (
        any(w in full_combined for w in ("chino", "chinos", "צ'ינו"))
        or (has_twill and not is_denim)
    )
    if is_chinos:
        parsed["sub_category"] = "Pants"
        if itype_lower in ("straight jeans", "skinny jeans", "jeans", "pants", "garment") or "jean" in itype_lower:
            parsed["item_type"] = "Chinos"
            itype_lower = "chinos"
        sub_lower = "pants"
        import re as _re
        for key in ("name", "title"):
            if parsed.get(key) and "jean" in str(parsed[key]).lower():
                parsed[key] = _re.sub(r"(?i)\bjeans?\b", "Chinos", str(parsed[key])).strip()

    _sanitize_sleeve_and_cut_for_non_tops(parsed)
    _sanitize_sandals_and_footwear(parsed)
    _sanitize_sweatpants_and_trainer(parsed)
    cat_lower = str(parsed.get("category") or "").strip().lower()
    sub_lower = str(parsed.get("sub_category") or "").strip().lower()
    itype_lower = str(parsed.get("item_type") or "").strip().lower()

    pat_val = (parsed.get("pattern") or "").strip().lower()
    is_fem_cut = is_distinctly_feminine_garment(cat_lower, sub_lower, itype_lower, name=parsed.get("name"), full_text=full_text_enum, pattern=pat_val)
    is_masc_cut = is_distinctly_masculine_garment(cat_lower, sub_lower, itype_lower)
    is_unisex_cut = is_distinctly_unisex_garment(cat_lower, sub_lower, itype_lower, name=parsed.get("name"), full_text=full_text_enum, pattern=pat_val)

    # Feminine tops with floral prints or feminine cuts should NEVER be "Tailored Shirts"
    if is_fem_cut or parsed.get("gender") == "women" or any(w in full_text_enum for w in ("floral", "flower", "פרח", "blouse", "בלוזה")):
        if sub_lower in ("tailored shirts", "tailored shirt", "tailored_shirts", "tailored_shirt"):
            parsed["sub_category"] = "Blouse"
            sub_lower = "blouse"
        if itype_lower in ("tailored shirts", "tailored shirt", "crew-neck t-shi", "crew-neck t-shirt", "crew neck t-shirt") and any(w in full_text_enum for w in ("floral", "flower", "פרח")):
            parsed["item_type"] = "Floral Print Blouse" if "blouse" in full_text_enum else "Floral Print Short-Sleeve Top"
            itype_lower = parsed["item_type"].lower()

    if itype_lower.endswith("-shi") or itype_lower.endswith(" t-shi"):
        parsed["item_type"] = parsed["item_type"].replace("-shi", "-Shirt").replace(" t-shi", " T-Shirt")
        itype_lower = parsed["item_type"].lower()

    # Strict 3-step gender determination hierarchy:
    # 1. Human Model Gender: If an identifiable human model is detected in the photo, align with the model's gender.
    # 2. Garment Criteria (Singlet analysis): If no model (flat lay, hanger, product), analyze garment silhouette, cut, pattern, and LLM vision prediction.
    # 3. Uncertain basics: If the garment is a neutral basic without clear gender cues, fall back to user's profile gender.
    # RULE: NEVER use a default gender; NEVER default to "men".
    if norm_model in ("men", "women"):
        parsed["gender"] = norm_model
        if norm_model == "men":
            if sub_lower == "blouse":
                parsed["sub_category"] = "Shirt"
            if itype_lower in ("cap-sleeve blouse", "casual blouse", "blouse"):
                parsed["item_type"] = "Short-Sleeve Shirt" if ("summer" in full_text_enum or "short" in full_text_enum) else "Button-Down Shirt"
    elif is_fem_cut:
        parsed["gender"] = "women"
    elif is_masc_cut:
        parsed["gender"] = "men"
    elif is_unisex_cut or g_val == "unisex":
        parsed["gender"] = "unisex"
    elif g_val == "kids":
        parsed["gender"] = "kids"
    elif norm_user in ("men", "women"):
        # Anchor uncertain/neutral basics without clear gender cues to user's profile gender
        parsed["gender"] = norm_user
    elif g_val in ("women", "men"):
        # Honor model's visual prediction over user profile fallback
        parsed["gender"] = g_val
    elif g_val in _VALID_GENDER:
        parsed["gender"] = g_val
    else:
        parsed["gender"] = "unisex"

    inferred_dc = _infer_garment_dress_code(parsed)
    parsed["dress_code"] = inferred_dc if inferred_dc in _VALID_DRESS_CODE else "casual"

    if parsed.get("caption"):
        parsed["caption"] = _clean_truncated_caption(parsed["caption"])
    _coerce_enum_field(
        parsed, "condition", _VALID_CONDITION, aliases=_CONDITION_ALIASES, default="good"
    )
    s = _norm_str(parsed.get("state"))
    parsed["state"] = s if s in _VALID_STATE else "used"
    _coerce_enum_field(
        parsed, "quality", _VALID_QUALITY, aliases=_QUALITY_ALIASES, default="mid"
    )
    _coerce_enum_field(
        parsed, "pattern", _VALID_PATTERN, aliases=_PATTERN_ALIASES, default="solid"
    )
    _coerce_seasons(parsed)
    if parsed.get("colors"):
        parsed["colors"] = normalize_weighted_tags(parsed["colors"])
    if parsed.get("fabric_materials"):
        parsed["fabric_materials"] = normalize_weighted_tags(parsed["fabric_materials"])
    return parsed


# ---------------------------------------------------------------------------
# Patch M21 (May 2026) — SegFormer-anchored category enforcement.
# ---------------------------------------------------------------------------
# SegFormer (``clothing_parser.parse_garments``) returns a per-pixel
# garment classification that we use to crop the source photo into
# per-garment images. The internal category it assigns (top, bottom,
# dress, footwear, accessory, headwear) is HIGHLY reliable on the
# pixels it claims — it's trained on the ATR clothes-parsing dataset
# and rarely confuses pant-leg pixels for a coat sleeve at the mask
# level.
#
# Gemini, on the other hand, is a free-form vision LLM that classifies
# the WHOLE CROP. When a bbox is loose and a sliver of an adjacent
# garment leaks in (e.g. coat tails over pants), Gemini can be lured
# into mis-labeling. Real example from the May 2026 closet test:
# pants crop with charcoal coat tails leaking into the top edge →
# Gemini returned ``{"category": "Outerwear", "sub_category":
# "Overcoat"}`` → user saw a "Charcoal Overcoat" card in their closet
# that was actually pants.
#
# Fix: anchor Gemini's ``category`` to the SegFormer ``kind``. For
# unambiguous SegFormer kinds (bottom, dress, footwear, accessory,
# headwear) we REJECT any Gemini category outside the compatible set
# and overwrite it. For ambiguous kinds (``top`` — could legitimately
# be Top or Outerwear) we leave Gemini's classification alone so it
# can still distinguish a t-shirt from a parka.
#
# Two-layer defence:
#   1. PROMPT HINT — every batched Gemini call now embeds the per-
#      crop SegFormer kind in the system prompt so the model has the
#      hint up-front. Cheaper than overriding; usually enough.
#   2. POST-VALIDATION — applied after _coerce_enums on every analysis
#      coming back from Gemini, regardless of which path produced it.
#      Catches the cases where Gemini ignored the hint.

# Internal SegFormer kind → set of acceptable Gemini ``category`` values
# (case-insensitive match). Any Gemini answer OUTSIDE this set is
# treated as an error and overridden.
_SEGFORMER_KIND_TO_ALLOWED_CATEGORIES: dict[str, set[str]] = {
    # SegFormer's "top" covers shirts, tees, blouses, sweaters.
    "top": {"top", "outerwear"},
    # SegFormer fashion's "outerwear" covers jackets, coats, cardigans, capes.
    "outerwear": {"outerwear", "top"},
    # SegFormer's "bottom" covers pants / skirts / shorts / tights — unambiguous.
    "bottom": {"bottom"},
    # SegFormer's "dress" ATR dataset class has no outerwear/coat class, so long
    # coats/trench/dusters are also segmented as dress. We allow Outerwear and Full Body.
    "dress": {"full body", "dress", "outerwear"},
    "footwear": {"footwear"},
    "accessory": {"accessories", "accessory"},
    "headwear": {"accessories", "accessory"},
    "bag": {"accessories", "accessory"},
}

# When we have to overwrite a bad Gemini answer, what should the
# canonical ``category`` value be? Same rule as a human reading the
# SegFormer kind: if SegFormer said "bottom", set category="Bottom".
_SEGFORMER_KIND_TO_DEFAULT_CATEGORY: dict[str, str] = {
    "outerwear": "Outerwear",
    "top": "Top",
    "bottom": "Bottom",
    "dress": "Full Body",
    "footwear": "Footwear",
    "accessory": "Accessories",
    "headwear": "Accessories",
    "bag": "Accessories",
}

# Human-readable label injected into the Gemini system prompt as a
# hint. Phrased as the *category the user would expect on the closet
# card*, not the raw SegFormer label, so Gemini interprets it in the
# same vocabulary as its ``category`` field.
_SEGFORMER_KIND_HUMAN_LABEL: dict[str, str] = {
    "outerwear": "Outerwear (jacket / coat / cardigan / blazer)",
    "top": "Top (shirt / t-shirt / sweater / top)",
    "bottom": "Bottom (pants / skirt / shorts)",
    "dress": "Outerwear (coat / trench / jacket) or Full Body (dress / jumpsuit)",
    "footwear": "Footwear (shoes / boots / sneakers)",
    "accessory": "Accessories (belt / scarf / sunglasses / bag)",
    "headwear": "Accessories (hat / cap / beanie)",
    "bag": "Accessories (bag / handbag / tote / basket)",
}


_APPAREL_KEYWORDS_BY_LANG: dict[str, set[str]] = {
    "en": {
        "cardigan", "sweater", "knit", "knitwear", "pullover", "jumper", "shirt",
        "t-shirt", "top", "blouse", "hoodie", "jacket", "coat", "pants", "jeans",
        "trousers", "shorts", "skirt", "dress", "tank", "vest", "sweatshirt",
    },
    "he": {
        "קרדיגן", "סוודר", "סריג", "חולצה", "גופיה", "שמלה", "חצאית", "מכנסיים",
        "מכנס", "ג'ינס", "גקט", "ג'קט", "מעיל", "סווטשירט", "סריגים", "חולצות", "שורט",
    },
    "ar": {
        "كارديجان", "كارديغان", "سترة", "سويتر", "قميص", "بلوزة", "كنزة", "فستان",
        "تنورة", "بنطال", "بنطلون", "جينز", "معطف", "جاكيت", "هودي", "شورت", "توب",
    },
    "de": {
        "strickjacke", "pullover", "pulli", "hemd", "bluse", "t-shirt", "jacke",
        "mantel", "hose", "jeans", "rock", "kleid", "weste", "kapuzenpullover", "oberteil",
    },
    "es": {
        "cárdigan", "cardigan", "suéter", "sueter", "jersey", "camisa", "camiseta",
        "blusa", "chaqueta", "abrigo", "pantalón", "pantalon", "pantalones",
        "vaqueros", "jeans", "falda", "vestido", "chaleco", "sudadera",
    },
    "fr": {
        "cardigan", "gilet", "pull", "chandail", "chemise", "chemisier", "t-shirt",
        "veste", "manteau", "pantalon", "jean", "jupe", "robe", "sweat", "haut",
    },
    "hi": {
        "कार्डिगन", "स्वेटर", "कमीज़", "शर्ट", "ब्लाउज", "जैकेट", "कोट", "पैंट",
        "पतलून", "जींस", "स्कर्ट", "पोशाक", "कुर्ता", "टॉप",
    },
    "it": {
        "cardigan", "maglione", "maglia", "camicia", "camicetta", "maglietta",
        "giacca", "cappotto", "pantaloni", "jeans", "gonna", "vestito", "abito", "felpa",
    },
    "ja": {
        "カーディガン", "セーター", "ニット", "シャツ", "ブラウス", "ジャケット",
        "コート", "パンツ", "ズボン", "ジーンズ", "スカート", "ワンピース", "ドレス", "トップス", "パーカー",
    },
    "nl": {
        "vest", "trui", "cardigan", "overhemd", "hemd", "blouse", "jas", "mantel",
        "broek", "spijkerbroek", "rok", "jurk", "sweatshirt",
    },
    "pt": {
        "cardigã", "cardigan", "suéter", "camisa", "blusa", "camiseta", "jaqueta",
        "casaco", "calça", "calças", "jeans", "saia", "vestido", "moletom", "colete",
    },
    "ru": {
        "кардиган", "свитер", "джемпер", "кофта", "рубашка", "блузка", "футболка",
        "куртка", "пальто", "брюки", "штаны", "джинсы", "юбка", "платье", "толстовка", "худи",
    },
    "zh": {
        "开衫", "毛衣", "针织衫", "衬衫", "t恤", "短袖", "外套", "大衣", "裤子",
        "牛仔裤", "裙子", "连衣裙", "卫衣", "背心", "上衣",
    },
}

_ALL_APPAREL_KEYWORDS: set[str] = {
    kw for kw_set in _APPAREL_KEYWORDS_BY_LANG.values() for kw in kw_set
}

_BAG_DETECTION_TERMS: set[str] = {
    # en
    "bag", "handbag", "tote", "basket", "crossbody", "shoulder bag", "backpack", "clutch", "wicker bag", "basket bag",
    # he
    "תיק", "תיק יד", "סל קש", "תיק סל", "תרמיל", "קלאץ",
    # ar
    "حقيبة", "حقيبه", "شنطة", "شنطه", "سلة قش", "حقيبة يد", "كلاتش",
    # de
    "tasche", "handtasche", "korbtasche", "umhängetasche", "rucksack", "beuteltasche",
    # es
    "bolso", "bolsa", "capazo", "cesta", "cartera", "mochila", "bandolera",
    # fr
    "sac", "sac à main", "sac a main", "panier", "cabas", "sacoche", "sac à dos", "sac a dos", "pochette",
    # hi
    "बैग", "थैला", "हैंडबैग", "टोकरी बैग", "झोला", "पर्स",
    # it
    "borsa", "borsetta", "borsa a cesto", "cestino", "zaino",
    # ja
    "バッグ", "ハンドバッグ", "かごバッグ", "カゴバッグ", "トートバッグ", "リュック",
    # nl
    "tas", "handtas", "mandtas", "korftas", "rugzak", "schoudertas",
    # pt
    "bolsa", "bolsa de palha", "cesto", "mochila", "bolsa de mão", "bolsa de mao", "carteira",
    # ru
    "сумка", "сумочка", "плетеная сумка", "корзина", "рюкзак",
    # zh
    "包", "手提包", "草编包", "菜篮子包", "单肩包", "背包", "手拿包",
}

_STRAW_DETECTION_TERMS: set[str] = {
    # en
    "straw", "wicker", "basket", "woven", "raffia", "rattan", "cane", "beige",
    # he
    "קש", "סל", "קלוע", "בז'", "בז", "ראפיה", "קש קלוע",
    # ar
    "قش", "سلة", "سله", "مغزول", "منسوج", "بيج", "خيزران", "رافيا",
    # de
    "stroh", "korb", "geflochten", "bast", "rattan", "beige",
    # es
    "paja", "cesta", "capazo", "mimbre", "trenzado", "tejido", "rafia", "beige",
    # fr
    "paille", "panier", "osier", "tressé", "tresse", "raphia", "rotin", "beige",
    # hi
    "पुआल", "टोकरी", "बुना हुआ", "रतन", "बेज",
    # it
    "paglia", "cesto", "cestino", "intrecciato", "vimini", "rafia", "beige",
    # ja
    "ストロー", "かご", "カゴ", "編み", "ラフィア", "籐", "ベージュ",
    # nl
    "stro", "mand", "korf", "geweven", "riet", "rotan", "beige",
    # pt
    "palha", "cesto", "vime", "trançado", "trancado", "ráfia", "rafia", "bege",
    # ru
    "солома", "соломенная", "корзина", "плетеная", "плетеный", "рафия", "ротанг", "бежевый",
    # zh
    "草编", "竹编", "藤编", "编织", "草", "篮子", "米色", "拉菲草",
}

_LOCALIZED_BAG_ATTRS: dict[str, dict[str, Any]] = {
    "en": {
        "basket_name": "Textured Basket Bag",
        "basket_item_type": "Basket Bag",
        "basket_caption": "An elegant woven basket bag crafted with natural texture, adding effortless sophistication to the outfit.",
        "bag_name": "Classic Handbag",
        "bag_item_type": "Handbag",
        "bag_caption": "An elegant handbag crafted with clean lines, perfect for everyday styling.",
        "straw_material": "Straw",
        "leather_material": "Leather",
    },
    "he": {
        "basket_name": "תיק סל קש",
        "basket_item_type": "תיק סל קש",
        "basket_caption": "תיק סל קש מעוצב בעל מרקם טבעי ואיכותי להשלמת המראה.",
        "bag_name": "תיק יד מעוצב",
        "bag_item_type": "תיק יד",
        "bag_caption": "תיק מעוצב ואלגנטי להשלמת המראה היומיומי.",
        "straw_material": "קש",
        "leather_material": "עור",
    },
    "ar": {
        "basket_name": "حقيبة سلة قش",
        "basket_item_type": "حقيبة سلة قش",
        "basket_caption": "حقيبة سلة قش أنيقة منسوجة بلمسة طبيعية تضفي جاذبية راقية على الإطلالة.",
        "bag_name": "حقيبة يد كلاسيكية",
        "bag_item_type": "حقيبة يد",
        "bag_caption": "حقيبة يد أنيقة بخطوط متقنة، مثالية للإطلالات اليومية الراقية.",
        "straw_material": "قش",
        "leather_material": "جلد",
    },
    "de": {
        "basket_name": "Geflochtene Korbtasche",
        "basket_item_type": "Korbtasche",
        "basket_caption": "Eine elegante geflochtene Korbtasche mit natürlicher Textur, die dem Outfit mühelose Raffinesse verleiht.",
        "bag_name": "Klassische Handtasche",
        "bag_item_type": "Handtasche",
        "bag_caption": "Eine elegante Handtasche mit klaren Linien, perfekt für das tägliche Styling.",
        "straw_material": "Stroh",
        "leather_material": "Leder",
    },
    "es": {
        "basket_name": "Capazo Tejido",
        "basket_item_type": "Capazo",
        "basket_caption": "Un elegante capazo tejido con textura natural que aporta sofisticación sin esfuerzo al atuendo.",
        "bag_name": "Bolso Clásico",
        "bag_item_type": "Bolso de mano",
        "bag_caption": "Un bolso elegante de líneas limpias, perfecto para el estilo diario.",
        "straw_material": "Paja",
        "leather_material": "Cuero",
    },
    "fr": {
        "basket_name": "Sac Panier Tressé",
        "basket_item_type": "Sac panier",
        "basket_caption": "Un élégant sac panier tressé à la texture naturelle, apportant une touche de sophistication à la tenue.",
        "bag_name": "Sac à Main Classique",
        "bag_item_type": "Sac à main",
        "bag_caption": "Un sac élégant aux lignes épurées, idéal pour le style quotidien.",
        "straw_material": "Paille",
        "leather_material": "Cuir",
    },
    "hi": {
        "basket_name": "बुना हुआ बास्केट बैग",
        "basket_item_type": "बास्केट बैग",
        "basket_caption": "प्राकृतिक बनावट से तैयार किया गया सुरुचिपूर्ण बुना हुआ बास्केट बैग, जो परिधान में सहज आकर्षण जोड़ता है।",
        "bag_name": "क्लासिक हैंडबैग",
        "bag_item_type": "हैंडबैग",
        "bag_caption": "साफ रेखाओं और सुरुचिपूर्ण डिज़ाइन वाला हैंडबैग, दैनिक स्टाइलिंग के लिए उत्तम।",
        "straw_material": "पुआल",
        "leather_material": "चमड़ा",
    },
    "it": {
        "basket_name": "Borsa a Cesto Intrecciata",
        "basket_item_type": "Borsa a cesto",
        "basket_caption": "Un'elegante borsa a cesto intrecciata con trama naturale, che dona raffinatezza al look.",
        "bag_name": "Borsa a Mano Classica",
        "bag_item_type": "Borsa a mano",
        "bag_caption": "Un'elegante borsa a mano dalle linee pulite, ideale per lo stile quotidiano.",
        "straw_material": "Paglia",
        "leather_material": "Pelle",
    },
    "ja": {
        "basket_name": "編み込みかごバッグ",
        "basket_item_type": "かごバッグ",
        "basket_caption": "自然な風合いの美しい編み込みかごバッグ。コーディネートに洗練された魅力を添えます。",
        "bag_name": "クラシックハンドバッグ",
        "bag_item_type": "ハンドバッグ",
        "bag_caption": "すっきりとしたラインが美しいエレガントなハンドバッグ。普段のスタイリングに最適です。",
        "straw_material": "ストロー",
        "leather_material": "レザー",
    },
    "nl": {
        "basket_name": "Geweven Mandtas",
        "basket_item_type": "Mandtas",
        "basket_caption": "Een elegante geweven mandtas met natuurlijke textuur die een verfijnde touch geeft aan de outfit.",
        "bag_name": "Klassieke Handtas",
        "bag_item_type": "Handtas",
        "bag_caption": "Een stijlvolle handtas met strakke lijnen, perfect voor dagelijkse styling.",
        "straw_material": "Stro",
        "leather_material": "Leer",
    },
    "pt": {
        "basket_name": "Bolsa de Palha Trançada",
        "basket_item_type": "Bolsa de palha",
        "basket_caption": "Uma elegante bolsa de palha trançada com textura natural, trazendo sofisticação sem esforço ao visual.",
        "bag_name": "Bolsa de Mão Clássica",
        "bag_item_type": "Bolsa de mão",
        "bag_caption": "Uma bolsa elegante com linhas limpas, perfeita para o estilo diário.",
        "straw_material": "Palha",
        "leather_material": "Couro",
    },
    "ru": {
        "basket_name": "Плетеная сумка-корзина",
        "basket_item_type": "Сумка-корзина",
        "basket_caption": "Элегантная плетеная сумка-корзина с естественной текстурой, придающая образу непринужденный шарм.",
        "bag_name": "Классическая сумка",
        "bag_item_type": "Сумка",
        "bag_caption": "Изящная сумка с чистыми линиями, идеально подходящая для повседневного стиля.",
        "straw_material": "Солома",
        "leather_material": "Кожа",
    },
    "zh": {
        "basket_name": "编织草编包",
        "basket_item_type": "草编包",
        "basket_caption": "优雅的天然编织草编包，质感自然，为整体穿搭增添从容精致之感。",
        "bag_name": "经典手提包",
        "bag_item_type": "手提包",
        "bag_caption": "线条简约利落的优雅手提包，百搭于日常各种造型。",
        "straw_material": "草编",
        "leather_material": "皮革",
    },
}


def _detect_language(text: str, explicit_language: str | None = None) -> str:
    """Resolve ISO 639-1 code among the 13 supported DressApp languages."""
    if explicit_language:
        norm = str(explicit_language).strip().lower().replace("_", "-").split("-")[0]
        if norm in _LOCALIZED_BAG_ATTRS:
            return norm
    # Script-based heuristics if explicit_language is missing or fallback
    if any("\u0590" <= ch <= "\u05ea" for ch in text):
        return "he"
    if any("\u0600" <= ch <= "\u06ff" for ch in text):
        return "ar"
    if any("\u0400" <= ch <= "\u04ff" for ch in text):
        return "ru"
    if any("\u3040" <= ch <= "\u30ff" or "\u31f0" <= ch <= "\u31ff" for ch in text):
        return "ja"
    if any("\u4e00" <= ch <= "\u9fff" for ch in text):
        return "zh"
    if any("\u0900" <= ch <= "\u097f" for ch in text):
        return "hi"
    return "en"


def _sanitize_bag_or_accessory(
    analysis: dict[str, Any],
    *,
    label: str | None = None,
    kind: str | None = None,
    language: str | None = None,
) -> None:
    """Purge misplaced apparel keywords (cardigan, sweater, shirt, etc.) from bags and accessories across 13 languages."""
    import re as _re
    curr_name = str(analysis.get("name") or "").strip()
    curr_title = str(analysis.get("title") or "").strip()
    curr_cap = str(analysis.get("caption") or "").strip()
    sub = str(analysis.get("sub_category") or "").strip()
    itype = str(analysis.get("item_type") or "").strip()

    combined = f"{curr_name} {curr_title} {curr_cap} {sub} {itype}".lower()
    lbl_low = (label or "").lower()
    kind_low = (kind or "").lower()

    if analysis.get("is_clothing") is False or any(w in combined for w in ("bottle", "water bottle", "flask", "tumbler", "cup", "phone", "smartphone", "non-clothing", "non_clothing")):
        return

    # Determine if this item is a bag / handbag / basket
    is_bag = (
        kind_low == "bag"
        or "bag" in lbl_low
        or any(term in lbl_low for term in _BAG_DETECTION_TERMS)
        or any(term in sub.lower() for term in _BAG_DETECTION_TERMS)
        or any(term in itype.lower() for term in _BAG_DETECTION_TERMS)
        or any(term in combined for term in _BAG_DETECTION_TERMS)
    )

    # Check whether contaminated with any apparel keywords or luggage/suitcase cover terms
    has_apparel = False
    for lang_code, kw_set in _APPAREL_KEYWORDS_BY_LANG.items():
        if lang_code in ("zh", "ja"):
            if any(w in combined for w in kw_set):
                has_apparel = True
                break
        else:
            if any(_re.search(rf"(?:\b|_){_re.escape(w)}(?:\b|_)", combined) for w in kw_set):
                has_apparel = True
                break
            if any(w in sub.lower() or w in itype.lower() for w in kw_set):
                has_apparel = True
                break

    has_luggage_cover = any(w in combined for w in (
        "כיסוי מזוודה", "כיסוי למזוודה", "מזוודה", "מזוודות", "suitcase cover", "luggage cover", "suitcase", "luggage"
    )) and not any(w in combined for w in ("עליונית", "cover-up", "cover up"))

    if is_bag and (has_apparel or has_luggage_cover or sub.lower() in _ALL_APPAREL_KEYWORDS or itype.lower() in _ALL_APPAREL_KEYWORDS):
        lang = _detect_language(combined, explicit_language=language)
        attrs = _LOCALIZED_BAG_ATTRS.get(lang, _LOCALIZED_BAG_ATTRS["en"])
        is_straw = any(term in combined for term in _STRAW_DETECTION_TERMS)

        analysis["category"] = "Accessories"
        analysis["sub_category"] = "Bag"

        if is_straw:
            name = attrs["basket_name"]
            analysis["item_type"] = attrs["basket_item_type"]
            analysis["caption"] = attrs["basket_caption"]
            analysis["fabric_materials"] = [
                {"name": attrs["straw_material"], "pct": 80},
                {"name": attrs["leather_material"], "pct": 20},
            ]
        else:
            name = attrs["bag_name"]
            analysis["item_type"] = attrs["bag_item_type"]
            analysis["caption"] = attrs["bag_caption"]

        analysis["name"] = name
        analysis["title"] = name

        # Purge apparel contamination from tags if present
        if isinstance(analysis.get("tags"), list):
            sanitized_tags = []
            for t in analysis["tags"]:
                t_str = str(t).strip().lower()
                if not any(w in t_str for w in _ALL_APPAREL_KEYWORDS):
                    sanitized_tags.append(t)
            analysis["tags"] = sanitized_tags

        analysis["_subcategory_overridden_by"] = "segformer-bag-apparel-purged"
        logger.warning(
            "garment_vision: Sanitized bag naming/caption from apparel contamination (lang=%s). New name=%r, sub_category=%r",
            lang, analysis["name"], analysis["sub_category"],
        )


def _enforce_segformer_category(
    analysis: dict[str, Any] | None,
    *,
    segformer_kind: str | None,
    label: str | None = None,
    is_single_item: bool = False,
    language: str | None = None,
) -> dict[str, Any] | None:
    """Anchor Gemini's category classification to the SegFormer kind.

    Mutates and returns ``analysis``. If SegFormer's kind is in the
    enforcement table AND Gemini's category is outside the allowed
    set, we:

    * Overwrite ``analysis["category"]`` with the table default.
    * Clear ``analysis["sub_category"]`` so a stale value like
      "Overcoat" doesn't survive on a now-"Bottom" item — the user
      can re-name in /closet if needed; better an empty sub_category
      than a wrong one.
    * Stamp ``analysis["_category_overridden_by"] = "segformer"`` for
      triage / observability.
    * Log a WARNING with before/after.

    For ambiguous kinds (``top``) we leave Gemini alone — both Top
    and Outerwear are legitimate matches for a SegFormer "top" mask.

    Idempotent: calling on an already-correct or already-overridden
    analysis is a no-op.
    """
    if not isinstance(analysis, dict):
        return analysis
    if analysis.get("is_clothing") is False:
        return analysis
    if (analysis.get("sub_category") or "").strip().lower() in ("non-clothing", "non_clothing"):
        return analysis
    if "non-clothing" in str(analysis.get("title") or "").lower():
        return analysis
    if not segformer_kind:
        return analysis
    kind = segformer_kind.strip().lower()
    if is_single_item and kind not in ("footwear", "bottom", "accessory", "headwear"):
        return analysis
    allowed = _SEGFORMER_KIND_TO_ALLOWED_CATEGORIES.get(kind)
    if not allowed:
        # Unknown SegFormer kind (e.g. "garment" from the Gemini-only
        # detection fallback) — no anchor available, bail out.
        return analysis
    current = (analysis.get("category") or "").strip()
    if not current:
        # Gemini didn't assign one — fill in from SegFormer rather
        # than leaving a blank category that would default to "Top"
        # in the frontend.
        default = _SEGFORMER_KIND_TO_DEFAULT_CATEGORY.get(kind)
        if default:
            analysis["category"] = default
            analysis["_category_overridden_by"] = "segformer-fill"
        return analysis
    lbl_low = (label or "").lower()

    if current.lower() in allowed:
        # Category is compatible with SegFormer, but check sub_category & item_type anchors
        # (e.g. prevent straw basket bag from being classified as a Belt under Accessories,
        # and prevent white low-top sneakers from being classified as Ankle Boots under Footwear).
        if "bag" in lbl_low or kind == "bag":
            combined_item_txt = f"{analysis.get('name', '')} {analysis.get('title', '')} {analysis.get('caption', '')} {analysis.get('sub_category', '')} {analysis.get('item_type', '')}".lower()
            if any(w in combined_item_txt for w in ("bottle", "water bottle", "flask", "tumbler", "cup", "phone", "smartphone", "non-clothing", "non_clothing")):
                analysis["is_clothing"] = False
                analysis["category"] = "Accessories"
                analysis["sub_category"] = "non-clothing"
                analysis["item_type"] = "non-clothing"
                analysis["title"] = "Non-clothing item"
                return analysis

            # Never coerce sunglasses/eyewear into Bag
            if any(w in combined_item_txt for w in ("sunglass", "glasses", "shades", "eyewear", "משקפ", "משקפיים")):
                analysis["category"] = "Accessories"
                analysis["sub_category"] = "Sunglasses"
                if not analysis.get("item_type") or str(analysis.get("item_type")).lower() in ("bag", "handbag", "shorts", "shirt", "t-shirt"):
                    analysis["item_type"] = "Classic Sunglasses"
                _sanitize_cross_category_contamination(analysis, language=language)
                return analysis

            sub_low = (analysis.get("sub_category") or "").lower()
            item_low = (analysis.get("item_type") or "").lower()
            curr_name = (analysis.get("name") or analysis.get("title") or "").lower()
            is_genuine_belt = any(w in curr_name or w in item_low for w in ("leather belt", "waist belt", "buckle", "red belt", "black belt", "brown belt", "belt strap"))
            if not is_genuine_belt and ("rope belt" in curr_name or "basket" in curr_name or "straw" in curr_name or (sub_low == "belt" and "belt" not in curr_name)):
                logger.warning(
                    "garment_vision: SegFormer-anchored bag override label=%r kind=%r sub_category=%r -> Bag",
                    label, kind, analysis.get("sub_category"),
                )
                analysis["sub_category"] = "Bag"
                analysis["item_type"] = "Handbag"
                curr_name_raw = analysis.get("name") or analysis.get("title") or ""
                if "belt" in curr_name_raw.lower():
                    import re
                    new_name = re.sub(r"(?i)\b(rope\s+)?belt(\s+accessory)?\b", "Basket Bag", curr_name_raw).strip()
                    if not new_name or new_name.lower() == curr_name_raw.lower():
                        new_name = "Textured Basket Bag"
                    analysis["name"] = new_name
                    analysis["title"] = new_name
                analysis["_subcategory_overridden_by"] = "segformer-bag"
            _sanitize_bag_or_accessory(analysis, label=label, kind=kind, language=language)

        elif ("shoe" in lbl_low or kind == "footwear") and "boot" not in lbl_low:
            sub_low = (analysis.get("sub_category") or "").lower()
            item_low = (analysis.get("item_type") or "").lower()
            curr_name = (analysis.get("name") or analysis.get("title") or "").lower()
            all_shoe_text = f"{sub_low} {item_low} {curr_name}"
            is_monk_or_dress = any(w in all_shoe_text for w in ("monk", "oxford", "derby", "brogue", "wingtip", "dress shoe", "casual shoe", "flat shoe"))
            if is_monk_or_dress:
                if sub_low in ("boot", "boots", "booties"):
                    analysis["sub_category"] = "Shoes"
                if not analysis.get("item_type") or item_low in ("shoes", "shoe", "boot", "boots", "footwear"):
                    if "monk" in all_shoe_text:
                        analysis["item_type"] = "Double Monk Strap Shoes" if "double" in all_shoe_text else "Monk Strap Shoes"
                    elif "oxford" in all_shoe_text:
                        analysis["item_type"] = "Oxford Shoes"
                    elif "derby" in all_shoe_text:
                        analysis["item_type"] = "Derby Shoes"
                    elif "brogue" in all_shoe_text:
                        analysis["item_type"] = "Brogues"
                analysis["_subcategory_overridden_by"] = "segformer-shoes"
            else:
                is_real_boot = any(w in curr_name or w in item_low for w in ("work boot", "chukka", "desert boot", "timberland", "winter boot", "hiking boot", "combat boot", "chelsea boot", "riding boot", "cowboy boot", "knee-high", "knee high", "thigh-high", "thigh high"))
                if not is_real_boot and ("platform ankle boots" in curr_name or ("ankle boots" in curr_name and "white" in curr_name)):
                    logger.warning(
                        "garment_vision: SegFormer-anchored footwear override label=%r kind=%r sub_category=%r -> Sneakers",
                        label, kind, analysis.get("sub_category"),
                    )
                    analysis["sub_category"] = "Sneakers"
                    analysis["item_type"] = "Low-Top Sneakers"
                    import re
                    orig_name = analysis.get("name") or analysis.get("title") or "White Sneakers"
                    new_name = re.sub(r"(?i)\b(ankle\s+)?boots?\b", "Sneakers", orig_name).strip()
                    analysis["name"] = new_name
                    analysis["title"] = new_name
                    analysis["_subcategory_overridden_by"] = "segformer-shoes"

        elif "skirt" in lbl_low:
            sub_low = (analysis.get("sub_category") or "").lower()
            item_low = (analysis.get("item_type") or "").lower()
            curr_name = (analysis.get("name") or analysis.get("title") or "").lower()
            combined_txt = f"{sub_low} {item_low} {curr_name} {str(analysis.get('caption') or '').lower()}"
            is_skirt = sub_low in ("skirt", "skirts") and not any(p in item_low for p in ("pant", "trouser", "jean", "chino", "slack"))
            if not is_skirt:
                logger.warning(
                    "garment_vision: SegFormer-anchored skirt override label=%r kind=%r sub_category=%r item_type=%r -> Skirt",
                    label, kind, analysis.get("sub_category"), analysis.get("item_type"),
                )
                analysis["category"] = "Bottom"
                analysis["sub_category"] = "Skirt"
                if "pleat" in combined_txt or "פליסה" in combined_txt:
                    analysis["item_type"] = "Pleated Skirt"
                elif "mini" in combined_txt or "מיני" in combined_txt:
                    analysis["item_type"] = "Mini Skirt"
                elif "maxi" in combined_txt or "מקסי" in combined_txt:
                    analysis["item_type"] = "Maxi Skirt"
                elif "a-line" in combined_txt or "aline" in combined_txt:
                    analysis["item_type"] = "A-Line Skirt"
                else:
                    analysis["item_type"] = "Midi Skirt"

                if (analysis.get("gender") or "").lower() not in ("women", "kids"):
                    analysis["gender"] = "women"
                if (analysis.get("dress_code") or "").lower() == "business":
                    analysis["dress_code"] = "smart-casual"
                analysis["_subcategory_overridden_by"] = "segformer-skirt"

            # Check if colors were hallucinated as pure black due to pants misclassification
            colors = analysis.get("colors")
            is_pure_black = isinstance(colors, list) and len(colors) == 1 and str(colors[0].get("name", "")).lower() in ("black", "שחור")
            if is_pure_black:
                # If caption, name, or description has hints of grey, olive, charcoal, or khaki
                if any(w in combined_txt for w in ("grey", "gray", "olive", "charcoal", "khaki", "אפור", "זית", "חאקי")):
                    corrected_c = "Olive Green" if any(w in combined_txt for w in ("olive", "זית")) else "Gray"
                    if language == "he":
                        corrected_c = "ירוק זית" if ("זית" in corrected_c or "olive" in combined_txt) else "אפור"
                    analysis["colors"] = [{"name": corrected_c, "pct": 100}]
                    analysis["color"] = corrected_c

            # Sanitize name and title to ensure no residual pants/trousers terms
            curr_name_raw = analysis.get("name") or analysis.get("title") or ""
            if any(w in curr_name_raw.lower() for w in ("trouser", "pant", "chino", "slack", "מכנסיים")):
                if language == "he":
                    col_str = ""
                    if analysis.get("colors") and isinstance(analysis["colors"], list):
                        c0 = str(analysis["colors"][0].get("name", "")).strip().lower()
                        if "אפור" in c0 or "gray" in c0 or "grey" in c0:
                            col_str = "אפורה"
                        elif "שחור" in c0 or "black" in c0:
                            col_str = "שחורה"
                        elif "זית" in c0 or "olive" in c0:
                            col_str = "ירוק זית"
                    itype_str = "חצאית פליסה" if analysis.get("item_type") == "Pleated Skirt" else "חצאית מידי"
                    new_name = f"{itype_str} {col_str}".strip() if col_str else itype_str
                else:
                    col_str = ""
                    if analysis.get("colors") and isinstance(analysis["colors"], list):
                        c0 = str(analysis["colors"][0].get("name", "")).strip()
                        if c0.lower() not in ("unknown", "other"):
                            col_str = c0
                    itype_str = analysis.get("item_type") or "Midi Skirt"
                    new_name = f"{col_str} {itype_str}".strip() if col_str else itype_str
                analysis["name"] = new_name
                analysis["title"] = new_name

        elif ("pants" in lbl_low or kind == "bottom") and "skirt" not in lbl_low:
            sub_low = (analysis.get("sub_category") or "").lower()
            item_low = (analysis.get("item_type") or "").lower()
            curr_name = (analysis.get("name") or analysis.get("title") or "").lower()
            is_footwear_conflict = any(w in f"{sub_low} {item_low} {curr_name}" for w in ("boot", "shoe", "sneaker", "heel", "sandal", "loafer", "oxford", "מגפ", "נעל", "סניקרס"))
            if is_footwear_conflict:
                logger.warning(
                    "garment_vision: SegFormer-anchored bottom override label=%r kind=%r sub_category=%r -> Pants",
                    label, kind, analysis.get("sub_category"),
                )
                is_he_local = (language in ("he", "iw")) or any("\u0590" <= ch <= "\u05ea" for ch in f"{curr_name} {str(analysis.get('caption', ''))}")
                is_legging = any(w in curr_name or w in str(analysis.get("caption", "")).lower() for w in ("legging", "skinny", "tight", "טייץ", "סקיני"))
                analysis["sub_category"] = "מכנסיים" if is_he_local else "Pants"
                if is_legging:
                    analysis["item_type"] = "טייץ" if is_he_local else "Leggings"
                else:
                    analysis["item_type"] = "מכנסי קז'ואל" if is_he_local else "Casual Pants"

                col_str = ""
                colors = analysis.get("colors")
                if isinstance(colors, list) and colors:
                    c0 = str(colors[0].get("name", "")).strip()
                    if c0.lower() not in ("unknown", "other"):
                        col_str = c0
                item_noun = analysis["item_type"]
                new_title = f"{col_str} {item_noun}".strip() if col_str else item_noun
                analysis["name"] = new_title
                analysis["title"] = new_title
                analysis["caption"] = "מכנסיים נוחים ומחמיאים בגזרה מחטבת." if is_he_local else f"Classic {item_noun.lower()} designed for versatile everyday styling."
                curr_size = str(analysis.get("size") or "").strip()
                if curr_size and (curr_size.replace(".", "").isdigit() or curr_size in ("7.0", "7", "8", "8.5", "9", "9.5", "10", "11", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45")):
                    analysis["size"] = "M"
                analysis["_subcategory_overridden_by"] = "segformer-bottom"

        elif kind == "dress" or "dress" in lbl_low:
            comb_dress_txt = f"{analysis.get('name', '')} {analysis.get('title', '')} {analysis.get('caption', '')} {analysis.get('sub_category', '')} {analysis.get('item_type', '')}".lower()
            is_real_long_coat = any(w in comb_dress_txt for w in ("trench coat", "overcoat", "winter parka", "duster coat", "raincoat", "puffer coat")) and not any(w in comb_dress_txt for w in ("peplum", "skirt", "dress", "gown", "suit", "פפלום", "חצאית", "שמלה"))
            if current.lower() == "outerwear" and not is_real_long_coat:
                logger.warning(
                    "garment_vision: Overriding Gemini Outerwear to Full Body for dress mask: %r",
                    analysis.get("name"),
                )
                analysis["category"] = "Full Body"
                is_he_local = (language in ("he", "iw")) or any("\u0590" <= ch <= "\u05ea" for ch in comb_dress_txt)
                is_pep = "peplum" in comb_dress_txt or "פפלום" in comb_dress_txt
                analysis["sub_category"] = "שמלות" if is_he_local else "Dresses"
                analysis["item_type"] = ("שמלת פפלום" if is_pep else "חליפת חצאית") if is_he_local else ("Peplum Dress" if is_pep else "Skirt Suit")
                import re as _re
                if is_he_local:
                    if any(w in analysis.get("name", "") for w in ("מעיל", "ז'קט")):
                        analysis["name"] = _re.sub(r"\b(מעיל|ז'קט)\b", "שמלת פפלום" if is_pep else "חליפת חצאית", analysis["name"]).strip()
                    if any(w in analysis.get("title", "") for w in ("מעיל", "ז'קט")):
                        analysis["title"] = _re.sub(r"\b(מעיל|ז'קט)\b", "שמלת פפלום" if is_pep else "חליפת חצאית", analysis["title"]).strip()
                    if any(w in analysis.get("caption", "") for w in ("מעיל", "ז'קט")):
                        analysis["caption"] = _re.sub(r"\b(מעיל|ז'קט)\b", "שמלת פפלום" if is_pep else "חליפת חצאית", analysis["caption"]).strip()
                else:
                    if any(w in analysis.get("name", "").lower() for w in ("coat", "jacket")):
                        analysis["name"] = _re.sub(r"(?i)\b(coat|jacket)\b", "Peplum Dress" if is_pep else "Skirt Suit", analysis["name"]).strip()
                    if any(w in analysis.get("title", "").lower() for w in ("coat", "jacket")):
                        analysis["title"] = _re.sub(r"(?i)\b(coat|jacket)\b", "Peplum Dress" if is_pep else "Skirt Suit", analysis["title"]).strip()
                    if any(w in analysis.get("caption", "").lower() for w in ("coat", "jacket")):
                        analysis["caption"] = _re.sub(r"(?i)\b(coat|jacket)\b", "peplum dress" if is_pep else "skirt suit", analysis["caption"]).strip()

        # Ensure sub_category and item_type are not identical
        if analysis.get("sub_category") and analysis.get("item_type"):
            sub_str = str(analysis["sub_category"]).strip()
            item_str = str(analysis["item_type"]).strip()
            if sub_str.lower() == item_str.lower():
                is_he_local = (language in ("he", "iw")) or any("\u0590" <= ch <= "\u05ea" for ch in f"{sub_str} {item_str} {str(analysis.get('name', ''))}")
                if sub_str.lower() in ("skirt", "skirts", "חצאית"):
                    analysis["item_type"] = "חצאית קלאסית" if is_he_local else "Classic Skirt"
                elif sub_str.lower() in ("sneakers", "shoes", "סניקרס", "נעליים"):
                    if is_he_local:
                        analysis["item_type"] = "סניקרס נמוכות" if (sub_str.lower() in ("sneakers", "סניקרס")) else "נעלי קז'ואל"
                    else:
                        analysis["item_type"] = "Low-Top Sneakers" if sub_str.lower() == "sneakers" else "Casual Shoes"
                elif sub_str.lower() in ("sandals", "sandal", "סנדלים"):
                    analysis["item_type"] = "סנדלי רצועות" if is_he_local else "Strappy Sandals"
                elif sub_str.lower() in ("sunglasses", "glasses", "משקפיים", "משקפי שמש"):
                    analysis["item_type"] = "משקפי שמש קלאסיים" if is_he_local else "Classic Sunglasses"
                elif sub_str.lower() in ("bag", "handbag", "תיק", "תיקים"):
                    analysis["sub_category"] = "תיקים" if is_he_local else "Bag"
                    analysis["item_type"] = "תיק יד" if is_he_local else "Handbag"
                elif sub_str.lower() in ("t-shirt", "t_shirt", "חולצת טי"):
                    analysis["item_type"] = "חולצת טי שרוול קצר" if is_he_local else "Short-Sleeve T-Shirt"
                elif sub_str.lower() in ("jeans", "ג'ינס", "גינס"):
                    analysis["item_type"] = "ג'ינס גזרה ישרה" if is_he_local else "Straight-Leg Jeans"
                elif sub_str.lower() in ("pants", "pant", "מכנסיים", "מכנס"):
                    txt_comb = f"{analysis.get('name', '')} {analysis.get('caption', '')} {' '.join(analysis.get('tags') or [])}".lower()
                    if "cargo" in txt_comb or "דגמח" in txt_comb or "דגמ\"ח" in txt_comb:
                        analysis["item_type"] = "מכנסי דגמ\"ח" if is_he_local else "Cargo Pants"
                    elif "chino" in txt_comb or "צ'ינו" in txt_comb:
                        analysis["item_type"] = "מכנסי צ'ינו" if is_he_local else "Chinos"
                    elif "jogger" in txt_comb or "sweat" in txt_comb or "טרנינג" in txt_comb:
                        analysis["item_type"] = "מכנסי ג'וגר" if is_he_local else "Joggers"
                    else:
                        analysis["item_type"] = "מכנסי קז'ואל" if is_he_local else "Casual Pants"
                else:
                    analysis["item_type"] = f"קלאסי {sub_str}" if is_he_local else f"Classic {sub_str}"
        return analysis

    # Flat lay tops and t-shirts are frequently misclassified by SegFormer as 'dress'.
    # If Gemini classified it as a Top or Outerwear, preserve Gemini's rich classification UNLESS it is clearly a dress or skirt suit.
    if current.lower() in ("top", "tops", "outerwear") and kind == "dress":
        comb_dress_txt = f"{analysis.get('name', '')} {analysis.get('title', '')} {analysis.get('caption', '')} {analysis.get('sub_category', '')} {analysis.get('item_type', '')}".lower()
        is_pep_or_skirt = any(w in comb_dress_txt for w in ("peplum", "skirt", "pencil", "maxi", "midi", "dress", "gown", "פפלום", "חצאית", "שמלה"))
        if is_pep_or_skirt:
            logger.warning(
                "garment_vision: Overriding Gemini %r to Full Body for dress/suit mask: %r",
                current, analysis.get("name"),
            )
            analysis["category"] = "Full Body"
            is_he_local = (language in ("he", "iw")) or any("\u0590" <= ch <= "\u05ea" for ch in comb_dress_txt)
            is_pep = "peplum" in comb_dress_txt or "פפלום" in comb_dress_txt
            analysis["sub_category"] = "שמלות" if is_he_local else "Dresses"
            analysis["item_type"] = ("שמלת פפלום" if is_pep else "חליפת חצאית") if is_he_local else ("Peplum Dress" if is_pep else "Skirt Suit")
            import re as _re
            if is_he_local:
                if any(w in analysis.get("name", "") for w in ("מעיל", "ז'קט")):
                    analysis["name"] = _re.sub(r"\b(מעיל|ז'קט)\b", "שמלת פפלום" if is_pep else "חליפת חצאית", analysis["name"]).strip()
                if any(w in analysis.get("title", "") for w in ("מעיל", "ז'קט")):
                    analysis["title"] = _re.sub(r"\b(מעיל|ז'קט)\b", "שמלת פפלום" if is_pep else "חליפת חצאית", analysis["title"]).strip()
                if any(w in analysis.get("caption", "") for w in ("מעיל", "ז'קט")):
                    analysis["caption"] = _re.sub(r"\b(מעיל|ז'קט)\b", "שמלת פפלום" if is_pep else "חליפת חצאית", analysis["caption"]).strip()
            else:
                if any(w in analysis.get("name", "").lower() for w in ("coat", "jacket")):
                    analysis["name"] = _re.sub(r"(?i)\b(coat|jacket)\b", "Peplum Dress" if is_pep else "Skirt Suit", analysis["name"]).strip()
                if any(w in analysis.get("title", "").lower() for w in ("coat", "jacket")):
                    analysis["title"] = _re.sub(r"(?i)\b(coat|jacket)\b", "Peplum Dress" if is_pep else "Skirt Suit", analysis["title"]).strip()
                if any(w in analysis.get("caption", "").lower() for w in ("coat", "jacket")):
                    analysis["caption"] = _re.sub(r"(?i)\b(coat|jacket)\b", "peplum dress" if is_pep else "skirt suit", analysis["caption"]).strip()
            return analysis
        logger.info(
            "garment_vision: Preserving Gemini %r (%r) over SegFormer 'dress' label",
            current,
            analysis.get("sub_category"),
        )
        return analysis
    # Override.
    default = _SEGFORMER_KIND_TO_DEFAULT_CATEGORY.get(kind, current)
    old_subcategory = analysis.get("sub_category")
    logger.warning(
        "garment_vision: SegFormer-anchored category override "
        "label=%r kind=%r gemini_category=%r gemini_subcategory=%r "
        "-> category=%r",
        label, kind, current, old_subcategory, default,
    )
    analysis["category"] = default
    curr_name_raw = str(analysis.get("name") or analysis.get("title") or "").strip()
    curr_name_low = curr_name_raw.lower()
    curr_cap_raw = str(analysis.get("caption") or "").strip()
    is_he_override = (language in ("he", "iw")) or any("\u0590" <= ch <= "\u05ea" for ch in f"{curr_name_raw} {curr_cap_raw}")

    if default == "Top":
        is_blouse = any(w in lbl_low or w in curr_name_low for w in ("blouse", "בלוזה")) or (analysis.get("gender") == "women")
        analysis["sub_category"] = ("בלוזה" if is_blouse else "חולצה") if is_he_override else ("Blouse" if is_blouse else "Shirt")
        analysis["item_type"] = ("בלוזה אלגנטית" if is_blouse else "חולצה מכופתרת") if is_he_override else ("Elegant Blouse" if is_blouse else "Button-Down Shirt")
        
        # Purge conflicting bottom/skirt/pants names and captions (e.g. white blouse labeled 'חצאית פליסה ירוקה')
        has_bottom_conflict = any(w in curr_name_low for w in ("skirt", "pant", "trouser", "jean", "short", "חצאית", "מכנס", "פליסה", "דגמח", "טייץ", "שורט"))
        if has_bottom_conflict:
            col_name = ""
            colors = analysis.get("colors")
            if isinstance(colors, list) and colors:
                c0 = str(colors[0].get("name", "")).strip().lower()
                if "white" in c0 or "לבן" in c0:
                    col_name = "לבנה" if is_he_override else "White"
                elif "black" in c0 or "שחור" in c0:
                    col_name = "שחורה" if is_he_override else "Black"
                elif "blue" in c0 or "כחול" in c0:
                    col_name = "כחולה" if is_he_override else "Blue"
                elif "green" in c0 or "ירוק" in c0:
                    col_name = "ירוקה" if is_he_override else "Green"
                elif "gray" in c0 or "grey" in c0 or "אפור" in c0:
                    col_name = "אפורה" if is_he_override else "Gray"
            noun = ("בלוזה" if is_blouse else "חולצה") if is_he_override else ("Blouse" if is_blouse else "Shirt")
            new_title = f"{noun} {col_name} אלגנטית".strip() if is_he_override else f"Elegant {col_name} {noun}".strip()
            analysis["name"] = new_title
            analysis["title"] = new_title
            if any(w in curr_cap_raw.lower() for w in ("skirt", "pant", "חצאית", "מכנס", "פליסה")):
                analysis["caption"] = "חולצה אלגנטית ונוחה להשלמת המראה." if is_he_override else "An elegant, comfortable top."

    elif default == "Footwear":
        analysis["sub_category"] = ("סניקרס" if "sneaker" in lbl_low else "נעליים") if is_he_override else ("Sneakers" if "sneaker" in lbl_low else "Shoes")
        analysis["item_type"] = ("סניקרס נמוכות" if "sneaker" in lbl_low else "נעלי קז'ואל") if is_he_override else ("Low-Top Sneakers" if "sneaker" in lbl_low else "Casual Shoes")
        if any(w in curr_name_low for w in ("sweater", "shirt", "top", "hoodie", "cardigan", "jacket", "coat", "pants", "skirt", "dress", "חולצה", "סוודר", "מעיל", "חצאית", "מכנסיים", "שמלה")):
            col = (analysis.get("colors") or [""])[0]
            col_name = str(col.get("name") if isinstance(col, dict) else col).strip()
            if is_he_override:
                analysis["name"] = "נעליים אלגנטיות"
            else:
                color_prefix = f"{col_name.capitalize()} " if col_name and col_name.lower() not in ("unknown", "") else ""
                analysis["name"] = f"{color_prefix}Shoes".strip()
            analysis["title"] = analysis["name"]
    elif default == "Bottom":
        if "skirt" in lbl_low:
            analysis["sub_category"] = "חצאית" if is_he_override else "Skirt"
            analysis["item_type"] = ("חצאית פליסה" if ("pleat" in curr_name_low or "פליסה" in curr_name_low) else "חצאית קלאסית") if is_he_override else ("Pleated Skirt" if "pleat" in curr_name_low else "Classic Skirt")
            if (analysis.get("gender") or "").lower() not in ("women", "kids", "נשים"):
                analysis["gender"] = "נשים" if is_he_override else "women"
        elif "pants" in lbl_low or "trousers" in lbl_low:
            analysis["sub_category"] = "מכנסיים" if is_he_override else "Pants"
            txt_comb = f"{analysis.get('name', '')} {analysis.get('caption', '')} {' '.join(analysis.get('tags') or [])}".lower()
            if "cargo" in txt_comb or "דגמח" in txt_comb or "דגמ\"ח" in txt_comb:
                analysis["item_type"] = "מכנסי דגמ\"ח" if is_he_override else "Cargo Pants"
            elif "chino" in txt_comb or "צ'ינו" in txt_comb:
                analysis["item_type"] = "מכנסי צ'ינו" if is_he_override else "Chinos"
            elif "jogger" in txt_comb or "sweat" in txt_comb or "טרנינג" in txt_comb:
                analysis["item_type"] = "מכנסי ג'וגר" if is_he_override else "Joggers"
            else:
                analysis["item_type"] = "מכנסי קז'ואל" if is_he_override else "Casual Pants"
        else:
            analysis["sub_category"] = "חלק תחתון" if is_he_override else None
            analysis["item_type"] = "מכנסי קז'ואל" if is_he_override else None
        
        # Purge top/shirt conflicts from bottoms
        if any(w in curr_name_low for w in ("shirt", "blouse", "sweater", "top", "חולצה", "סוודר", "בלוזה")):
            analysis["name"] = "מכנסיים אלגנטיים" if is_he_override else "Classic Pants"
            analysis["title"] = analysis["name"]
        # Purge footwear (boots/shoes) conflicts from bottoms
        if any(w in curr_name_low for w in ("boot", "boots", "shoe", "shoes", "sneaker", "sneakers", "heel", "heels", "sandal", "sandals", "מגפ", "נעל")):
            col_str = ""
            colors = analysis.get("colors")
            if isinstance(colors, list) and colors:
                c0 = str(colors[0].get("name", "")).strip()
                if c0.lower() not in ("unknown", "other"):
                    col_str = c0
            analysis["name"] = f"{col_str} Casual Pants".strip() if col_str else "Casual Pants"
            analysis["title"] = analysis["name"]
            analysis["caption"] = "Classic pants designed for versatile everyday styling."
            curr_size = str(analysis.get("size") or "").strip()
            if curr_size and (curr_size.replace(".", "").isdigit() or curr_size in ("7.0", "7", "8", "8.5", "9", "9.5", "10", "11", "36", "37", "38", "39", "40", "41", "42")):
                analysis["size"] = "M"
    elif default == "Accessories":
        if "bag" in lbl_low or kind == "bag":
            analysis["sub_category"] = "תיקים" if is_he_override else "Bags"
            analysis["item_type"] = "תיק יד" if is_he_override else "Handbag"
        elif kind == "headwear" or any(h in lbl_low for h in ("hat", "cap", "beanie", "trapper", "beret", "fedora", "כובע")):
            analysis["sub_category"] = "כובעים" if is_he_override else "Headwear"
            analysis["item_type"] = "כובע קלאסי" if is_he_override else "Classic Hat"
        elif any(b in lbl_low for b in ("belt", "waistband", "חגור")):
            analysis["sub_category"] = "חגורות" if is_he_override else "Belts"
            analysis["item_type"] = "חגורת עור" if is_he_override else "Leather Belt"
        elif any(s in lbl_low for s in ("scarf", "shawl", "wrap", "צעיף")):
            analysis["sub_category"] = "צעיפים ועליוניות" if is_he_override else "Scarves & Wraps"
            analysis["item_type"] = "צעיף סרוג" if is_he_override else "Knit Scarf"
        elif any(g in lbl_low for g in ("glove", "mitten", "כפפ")):
            analysis["sub_category"] = "כפפות" if is_he_override else "Gloves"
            analysis["item_type"] = "כפפות" if is_he_override else "Gloves"
        else:
            sub_curr = (old_subcategory or analysis.get("item_type") or "").lower()
            if any(h in sub_curr for h in ("hat", "cap", "beanie", "trapper", "headwear", "beret", "כובע")):
                analysis["sub_category"] = "כובעים" if is_he_override else "Headwear"
                analysis["item_type"] = "כובע קלאסי" if is_he_override else "Classic Hat"
            elif any(b in sub_curr for b in ("bag", "backpack", "tote", "purse", "תיק")):
                analysis["sub_category"] = "תיקים" if is_he_override else "Bags"
                analysis["item_type"] = "תיק יד" if is_he_override else "Handbag"
            elif "belt" in sub_curr or "חגור" in sub_curr:
                analysis["sub_category"] = "חגורות" if is_he_override else "Belts"
                analysis["item_type"] = "חגורת עור" if is_he_override else "Leather Belt"
            elif "scarf" in sub_curr or "צעיף" in sub_curr:
                analysis["sub_category"] = "צעיפים ועליוניות" if is_he_override else "Scarves & Wraps"
                analysis["item_type"] = "צעיף סרוג" if is_he_override else "Knit Scarf"
            elif "glove" in sub_curr or "כפפ" in sub_curr:
                analysis["sub_category"] = "כפפות" if is_he_override else "Gloves"
                analysis["item_type"] = "כפפות" if is_he_override else "Gloves"
            else:
                analysis["sub_category"] = "כובעים" if (kind == "headwear" and is_he_override) else ("תיקים" if is_he_override else ("Headwear" if kind == "headwear" else "Bags"))
        _sanitize_bag_or_accessory(analysis, label=label, kind=kind, language=language)
    else:
        analysis["sub_category"] = None
    analysis["_category_overridden_by"] = "segformer"

    # Ensure sub_category and item_type are not identical
    if analysis.get("sub_category") and analysis.get("item_type"):
        sub_str = str(analysis["sub_category"]).strip()
        item_str = str(analysis["item_type"]).strip()
        if sub_str.lower() == item_str.lower():
            is_he_post = (language in ("he", "iw")) or any("\u0590" <= ch <= "\u05ea" for ch in f"{sub_str} {item_str}")
            if sub_str.lower() in ("pants", "pant", "מכנסיים"):
                txt_comb = f"{analysis.get('name', '')} {analysis.get('caption', '')} {' '.join(analysis.get('tags') or [])}".lower()
                if "cargo" in txt_comb or "דגמח" in txt_comb or "דגמ\"ח" in txt_comb:
                    analysis["item_type"] = "מכנסי דגמ\"ח" if is_he_post else "Cargo Pants"
                elif "chino" in txt_comb or "צ'ינו" in txt_comb:
                    analysis["item_type"] = "מכנסי צ'ינו" if is_he_post else "Chinos"
                elif "jogger" in txt_comb or "sweat" in txt_comb or "טרנינג" in txt_comb:
                    analysis["item_type"] = "מכנסי ג'וגר" if is_he_post else "Joggers"
                else:
                    analysis["item_type"] = "מכנסי קז'ואל" if is_he_post else "Casual Pants"
            elif sub_str.lower() in ("sneakers", "shoes", "סניקרס", "נעליים"):
                analysis["item_type"] = ("סניקרס נמוכות" if sub_str.lower() in ("sneakers", "סניקרס") else "נעלי קז'ואל") if is_he_post else ("Low-Top Sneakers" if sub_str.lower() == "sneakers" else "Casual Shoes")
            elif sub_str.lower() in ("bag", "bags", "handbag", "תיק", "תיקים"):
                analysis["sub_category"] = "תיקים" if is_he_post else "Bags"
                analysis["item_type"] = "תיק יד" if is_he_post else "Handbag"
            elif sub_str.lower() in ("headwear", "hat", "כובע", "כובעים"):
                analysis["sub_category"] = "כובעים" if is_he_post else "Headwear"
                analysis["item_type"] = "כובע קלאסי" if is_he_post else "Classic Hat"
            else:
                analysis["item_type"] = f"קלאסי {sub_str}" if is_he_post else f"Classic {sub_str}"

    _sanitize_cross_category_contamination(analysis, language=language)
    return analysis

