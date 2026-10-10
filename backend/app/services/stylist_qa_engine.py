"""stylist_qa_engine.py - Autonomous Quality Assurance and Authorization for DressApp Stylist Outfits.

Architectural Workflow:
1. Input:
   - User prompt/query (`user_text`)
   - Proposed outfit recommendations from Stylist Brain (`advice_payload`)
   - Complete closet inventory (`all_closet_items`)
   - User profile (gender, modesty, occasion, weather)
2. QA Analysis & Verification:
   - Overall look analysis against user prompt & occasion rules (e.g. mourning/shiva, formal, casual).
   - Completeness check: ensures every outfit has top, bottom, shoes (or dress + shoes).
   - Garment verification & replacement:
     - Detects missing essential slots or unmapped items (`closet_item_id is None`).
     - Detects etiquette-violating garments (e.g. bright red or shorts in Shiva mourning).
     - Searches all closet metadata for the best match and replaces inappropriate/unmapped items.
   - Text & narrative validation:
     - Prunes out-of-context hallucinations (e.g. "והרמדונות" in Jewish Shiva, "סינר לבן", "נעלי דובון", "wearing food").
     - Cleans garbled designer notes (texture balance, silhouette, color harmony).
     - Fixes duplicate words in Do/Don't.
3. Authorization:
   - Sets `qa_status: "authorized"`.
   - Records QA notes detailing any replacements made.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from app.services.gemini_stylist import sanitize_stylist_text
from app.services.stylist_scheduler_brain import (
    calculate_garment_style_score,
    norm_category,
)

logger = logging.getLogger(__name__)

ROLE_ALLOWED_CATEGORIES: dict[str, set[str]] = {
    "top": {"top", "tops", "shirt", "blouse", "sweater", "hoodie", "cardigan", "t-shirt", "polo"},
    "bottom": {"bottom", "bottoms", "pants", "trousers", "jeans", "shorts", "skirt"},
    "shoes": {"shoes", "footwear", "sneakers", "boots", "loafers", "sandals", "heels", "slippers", "shoe"},
    "outerwear": {"outerwear", "jacket", "coat", "blazer", "cardigan", "trench", "vest"},
    "accessory": {"accessory", "accessories", "bag", "belt", "hat", "glasses", "jewelry", "scarf", "tie", "necktie"},
    "dress": {"dress", "dresses", "one-piece", "jumpsuit"},
    "headwear": {"accessory", "accessories", "hat", "headwear"},
    "glasses": {"accessory", "accessories", "glasses", "eyewear"},
    "belt": {"accessory", "accessories", "belt"},
    "bag": {"accessory", "accessories", "bag", "handbag"},
}

RE_BOTTOM_WORDS = re.compile(
    r"\b(?:cargo\s+)?pants\b|\bpant\b|\btrousers?\b|\bjeans?\b|\bdenim\s+pants?\b|"
    r"\bshorts?\b|\bskirts?\b|\bsweatpants?\b|\bjoggers?\b|\bchinos?\b|\bslacks?\b|"
    r"\bleggings?\b|\bbermuda\b|\bculottes?\b|\btrunks?\b|\bboxers?\b|\bbriefs?\b|"
    r"\bמכנסיים\b|\bמכנס\b|\bמכנסי\b|\bג'ינס\b|\bג'ינסים\b|\bשורטס\b|"
    r"\bחצאית\b|\bחצאיות\b|\bברמודה\b|\bטייץ\b|\bטייטס\b|\bטרנינג\b|"
    r"\bבוקסר\b|\bתחתונים\b|\bبنطلون\b|\bبنطال\b|\bسروال\b|\bشورت\b|\bتنورة\b|\bجينز\b",
    re.IGNORECASE,
)

RE_TOP_WORDS = re.compile(
    r"\bshirts?\b|\bt-shirts?\b|\btees?\b|\bblouses?\b|\bsweaters?\b|"
    r"\bsweatshirts?\b|\bhoodies?\b|\btank(?:\s+tops?)?\b|\bcrop\s+tops?\b|"
    r"\bpullovers?\b|\bturtlenecks?\b|\bpolos?\b|\bbutton-downs?\b|\bcamisoles?\b|"
    r"\bcardigans?\b|\bknitwears?\b|"
    r"\bחולצה\b|\bחולצת\b|\bחולצות\b|\bגופייה\b|\bגופיית\b|\bגופיות\b|"
    r"\bסוודר\b|\bסוודרים\b|\bקפוצ'ון\b|\bסווטשירט\b|\bפולו\b|\bמכופתרת\b|"
    r"\bקרדיגן\b|\bסריג\b|\bסריגים\b|"
    r"\bقميص\b|\bبلوزة\b|\bكنزة\b|\bتي\s*ש?שירט\b|\bهودي\b",
    re.IGNORECASE,
)

RE_SHOES_WORDS = re.compile(
    r"\bshoes?\b|\bsneakers?\b|\bboots?\b|\bsandals?\b|\bheels?\b|"
    r"\bloafers?\b|\bslippers?\b|\bslides?\b|\bmules?\b|"
    r"\boxford\s+shoes?\b|\boxfords\b|\boxford\b(?!\s+(?:shirts?|cloth|cotton|button))\b|\bclogs?\b|"
    r"\bנעליים\b|\bנעלי\b|\bסניקרס\b|\bמגפיים\b|\bמגפי\b|\bמגפונים\b|"
    r"\bסנדלים\b|\bעקבים\b|\bכפכפים\b|\bמוקסינים\b|"
    r"\bحذاء\b|\bأحذية\b|\bصندل\b|\bبوت\b",
    re.IGNORECASE,
)

RE_OUTERWEAR_WORDS = re.compile(
    r"\bjackets?\b|\bcoats?\b|\bblazers?\b|\bparkas?\b|\btrench(?:coats?)?\b|"
    r"\bovercoats?\b|\bwindbreakers?\b|\bvests?\b|\banoraks?\b|\bpuffers?\b|"
    r"\bז'קט\b|\bג'קט\b|\bמעיל\b|\bמעילים\b|\bבלייזר\b|\bוסט\b|\bמקטורן\b|"
    r"\bעליונית\b|\bسترة\b|\bجاكيت\b|\bمعطف\b|\bبليزر\b",
    re.IGNORECASE,
)

RE_DRESS_WORDS = re.compile(
    r"\bdresses\b|\bdress\b(?!\s+(?:pants|trousers|shirts?|shoes?|boots?|code|socks|belt|suit))\b|"
    r"\bgowns?\b|\bjumpsuits?\b|\brompers?\b|\bdungarees?\b|\boveralls?\b|"
    r"\bשמלה\b|\bשמלת\b|\bשמלות\b|\bאוברול\b|\bסרבל\b|"
    r"\bفستان\b|\bفساتين\b|\bجمبسوت\b",
    re.IGNORECASE,
)

RE_HEADWEAR_WORDS = re.compile(
    r"\b(?:hats?|caps?|beanies?|berets?|fedora|visors?|bucket\s+hats?|bonnets?|helmets?|"
    r"flat\s+caps?|panama\s+hats?|"
    r"כובע|כובעים|ברט|מצחייה|קסקט|כובע\s+טמבל|"
    r"קובע|"
    r"قبعة|طاقية)\b",
    re.IGNORECASE,
)

RE_GLASSES_WORDS = re.compile(
    r"\b(?:glasses|sunglasses|eyewear|spectacles|shades|"
    r"משקפיים|משקפי\s+שמש|משקפי\s+ראייה|"
    r"نظارات|نظارة)\b",
    re.IGNORECASE,
)

RE_BELT_WORDS = re.compile(
    r"\b(?:belts?|waistbands?|sashes?|"
    r"חגורה|חגורות|חגורת|"
    r"חגור|"
    r"حزام)\b",
    re.IGNORECASE,
)

RE_BAG_WORDS = re.compile(
    r"\b(?:bags?|handbags?|backpacks?|totes?|clutches?|purses?|crossbod(?:y|ies)|"
    r"satchels?|briefcases?|duffels?|fanny\s+packs?|"
    r"תיק|תיקי|תיקים|תיק\s+יד|תיק\s+גב|ארנק|ארנקים|"
    r"حقيبة|شنطة)\b",
    re.IGNORECASE,
)

RE_ACCESSORY_WORDS = re.compile(
    r"\b(?:belts?|hats?|caps?|beanies?|berets?|glasses|sunglasses|eyewear|spectacles|"
    r"bags?|handbags?|backpacks?|totes?|clutches?|purses?|crossbody|satchels?|"
    r"scarves|scarf|neckties?|bow\s*ties?|necklaces?|bracelets?|watches?|earrings?|"
    r"socks?|stockings?|hosiery|"
    r"ties?\b(?!\s*dye)|"
    r"חגורה|חגורות|כובע|כובעים|משקפיים|משקפי\s+שמש|תיק|תיקים|ארנק|"
    r"צעיף|צעיפים|עניבה|עניבות|שרשרת|שרשראות|צמיד|צמידים|שעון|שעונים|עגילים|"
    r"גרביים|גרב|"
    r"חגור|"
    r"حزام|قبعة|نظارات|حقيبة|وشاح|ربطة\s+عنق|ساعة|سوار|قلادة|أقراط|جوارب)\b",
    re.IGNORECASE,
)


def check_garment_role_mismatch(item: dict[str, Any], role: str) -> str | None:
    """Return an error string if item is semantically/intrinsically incompatible with role, else None."""
    role_norm = str(role or "").lower().strip()
    title_name_sub = f"{item.get('title') or ''} {item.get('name') or ''} {item.get('sub_category') or ''}".lower()
    item_label = item.get('title') or item.get('name') or 'Item'

    is_bottom = bool(RE_BOTTOM_WORDS.search(title_name_sub))
    is_top = bool(RE_TOP_WORDS.search(title_name_sub))
    is_shoes = bool(RE_SHOES_WORDS.search(title_name_sub))
    is_outerwear = bool(RE_OUTERWEAR_WORDS.search(title_name_sub))
    is_dress = bool(RE_DRESS_WORDS.search(title_name_sub))
    is_accessory = bool(RE_ACCESSORY_WORDS.search(title_name_sub))

    # 1. Role: TOP — strictly reject bottoms, footwear, dresses, accessories, heavy outerwear
    if role_norm == "top":
        if is_bottom and not is_top:
            return f"Item '{item_label}' contains bottom keywords (pants/cargo/trousers/shorts/jeans/skirt) but was placed in 'top' role."
        if is_shoes and not is_top:
            return f"Item '{item_label}' is footwear but was placed in 'top' role."
        if is_dress and not is_top:
            return f"Item '{item_label}' is a full-body dress but was placed in 'top' role."
        if is_accessory and not (is_top or is_outerwear):
            return f"Item '{item_label}' is an accessory but was placed in 'top' role."
        if is_outerwear and not is_top and any(w in title_name_sub for w in ("trench", "coat", "parka", "puffer", "מעיל", "overcoat")):
            return f"Item '{item_label}' is heavy outerwear but was placed in 'top' role."

    # 2. Role: BOTTOM — strictly reject tops, footwear, dresses, outerwear, accessories
    elif role_norm == "bottom":
        if is_top and not is_bottom:
            return f"Item '{item_label}' contains top keywords (shirt/sweater/blouse/hoodie) but was placed in 'bottom' role."
        if is_shoes and not is_bottom:
            return f"Item '{item_label}' is footwear but was placed in 'bottom' role."
        if is_dress and not is_bottom:
            return f"Item '{item_label}' is a full-body dress but was placed in 'bottom' role."
        if is_outerwear and not is_bottom:
            return f"Item '{item_label}' is outerwear but was placed in 'bottom' role."
        if is_accessory and not is_bottom:
            return f"Item '{item_label}' is an accessory but was placed in 'bottom' role."

    # 3. Role: SHOES / FOOTWEAR — strictly reject clothing and accessories
    elif role_norm in ("shoes", "footwear"):
        if re.search(r"\b(?:socks?|stockings?|hosiery|גרביים|גרב|ג'ווארב|جوارب)\b", title_name_sub, re.IGNORECASE):
            return f"Item '{item_label}' is socks/hosiery but was placed in 'shoes' role."
        if (is_top or is_bottom or is_outerwear or is_dress or is_accessory) and not is_shoes:
            return f"Item '{item_label}' is clothing/accessory but was placed in 'shoes' role."

    # 4. Role: OUTERWEAR — strictly reject bottoms, footwear, dresses, accessories
    elif role_norm in ("outerwear", "jacket"):
        if is_bottom and not is_outerwear:
            return f"Item '{item_label}' is a bottom garment but was placed in 'outerwear' role."
        if is_shoes and not is_outerwear:
            return f"Item '{item_label}' is footwear but was placed in 'outerwear' role."
        if is_dress and not is_outerwear:
            return f"Item '{item_label}' is a full-body dress but was placed in 'outerwear' role."
        if is_accessory and not is_outerwear:
            return f"Item '{item_label}' is an accessory but was placed in 'outerwear' role."

    # 5. Role: FULL BODY / DRESS — strictly reject separates, shoes, accessories
    elif role_norm in ("dress", "full_body", "dresses", "one_piece"):
        if is_shoes and not is_dress:
            return f"Item '{item_label}' is footwear but was placed in 'dress' role."
        if is_bottom and not is_dress:
            return f"Item '{item_label}' is a separate bottom garment but was placed in 'dress' role."
        if is_top and not is_dress:
            return f"Item '{item_label}' is a separate top garment but was placed in 'dress' role."
        if is_accessory and not is_dress:
            return f"Item '{item_label}' is an accessory but was placed in 'dress' role."

    # 6. Role: ACCESSORIES
    elif role_norm in ("accessory", "accessories"):
        if (is_top or is_bottom or is_shoes or is_outerwear or is_dress) and not is_accessory:
            return f"Item '{item_label}' is clothing/footwear but was placed in 'accessory' role."

    # 7. Sub-accessories: headwear, glasses, belt, bag
    elif role_norm in ("headwear", "hat"):
        if (is_bottom or is_top or is_shoes or is_outerwear or is_dress or bool(RE_BELT_WORDS.search(title_name_sub)) or bool(RE_BAG_WORDS.search(title_name_sub)) or bool(RE_GLASSES_WORDS.search(title_name_sub))) and not bool(RE_HEADWEAR_WORDS.search(title_name_sub)):
            return f"Item '{item_label}' is not headwear but was placed in '{role_norm}' role."

    elif role_norm in ("glasses", "eyewear"):
        if (is_bottom or is_top or is_shoes or is_outerwear or is_dress or bool(RE_BELT_WORDS.search(title_name_sub)) or bool(RE_BAG_WORDS.search(title_name_sub)) or bool(RE_HEADWEAR_WORDS.search(title_name_sub))) and not bool(RE_GLASSES_WORDS.search(title_name_sub)):
            return f"Item '{item_label}' is not glasses but was placed in '{role_norm}' role."

    elif role_norm == "belt":
        if (is_bottom or is_top or is_shoes or is_outerwear or is_dress or bool(RE_HEADWEAR_WORDS.search(title_name_sub)) or bool(RE_BAG_WORDS.search(title_name_sub)) or bool(RE_GLASSES_WORDS.search(title_name_sub))) and not bool(RE_BELT_WORDS.search(title_name_sub)):
            return f"Item '{item_label}' is not a belt but was placed in 'belt' role."

    elif role_norm in ("bag", "handbag"):
        if (is_bottom or is_top or is_shoes or is_outerwear or is_dress or bool(RE_HEADWEAR_WORDS.search(title_name_sub)) or bool(RE_BELT_WORDS.search(title_name_sub)) or bool(RE_GLASSES_WORDS.search(title_name_sub))) and not bool(RE_BAG_WORDS.search(title_name_sub)):
            return f"Item '{item_label}' is not a bag but was placed in 'bag' role."

    return None

def is_item_mourning_inappropriate(it: dict[str, Any], role: str) -> bool:
    """Check if an item violates mourning/Shiva etiquette based on its role and metadata."""
    all_text = " ".join([
        str(it.get("title") or ""),
        str(it.get("description") or ""),
        str(it.get("category") or ""),
        str(it.get("sub_category") or ""),
        str(it.get("material") or ""),
        " ".join(str(t) for t in (it.get("tags") or [])),
    ]).lower()

    # 1. Shorts / swim / trunks / leggings / cargo only forbidden on bottom
    if role == "bottom" or norm_category(it.get("category")) == "bottom":
        if any(w in all_text for w in (
            "shorts", "שורטס", "מכנסיים קצרים", "bermuda", "swim", "trunks",
            "טייץ", "טייטס", "leggings", "tights", "cargo", "דגמ\"ח", "דגמח",
        )):
            return True

    # 2. Graphic prints, loud florals, cartoons, party wear, mesh, sheer, geometric, optical, psychedelic, rave
    pattern = str(it.get("pattern") or "").lower()
    if pattern in (
        "floral", "botanical", "flower", "graphic", "print", "geometric",
        "mesh", "psychedelic", "optical", "checkerboard", "checkered", "abstract",
    ):
        return True
    if any(w in all_text for w in (
        "floral", "flower", "פרחוני", "פרחים", "graphic", "cartoon", "ציור", "נשר", "מסיבה", "party",
        "ripped", "קרוע", "distressed", "faded", "משופשף", "שפשופים",
        "mesh", "sheer", "geometric", "optical", "psychedelic", "vortex", "checkerboard", "checkered",
        "net", "see-through", "transparent", "lace", "sequin", "sequins", "glitter", "rave", "trippy",
        "רשת", "שקוף", "שקופה", "משובץ", "גיאומטרי", "פסיכדלי",
        "شبكة", "شفاف", "هندسي",
    )):
        return True

    # 3. Sheer / mesh materials
    material = str(it.get("material") or "").lower()
    if any(w in material for w in ("mesh", "sheer", "net", "lace", "sequin", "רשת", "שקוף")):
        return True

    # 4. Bright neon / loud colors (red, gold, neon, hot pink, orange, yellow)
    colors = [str(c).lower() for c in (it.get("colors") or [])]
    if any(c in ("red", "gold", "yellow", "neon", "orange", "pink") or c in ("אדום", "זהב", "צהוב", "ניאון", "כתום", "ורוד") for c in colors):
        return True
    if any(w in all_text for w in ("bright red", "neon", "אדום בוהק", "זהב", "gold", "ניאון", "צהוב", "כתום")):
        return True

    # 5. Inappropriate non-clothing items or sleepwear/beachwear
    if any(w in all_text for w in (
        "apron", "סינר", "דובון", "pajama", "פיג'מה", "bikini", "ביקיני",
        "tank top", "tank", "sleeveless", "גופייה", "גופיה",
    )):
        return True

    return False


def _is_mourning_context(text: str | None) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(w in t for w in (
        "שבעה", "אבל", "ניחום", "לוויה", "הלוויה", "אבלים", "ניחום אבלים", "בית אבלים",
        "shiva", "mourning", "condolence", "condolences", "funeral", "memorial", "bereavement"
    ))


def _is_church_context(text: str | None) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(w in t for w in (
        "church", "mass", "bethlehem", "cathedral", "vatican", "basilica",
        "sunday mass", "midnight mass", "holy sepulchre", "nativity",
        "כנסייה", "כנסיית", "מיסה", "בית לחם", "כנסיית המולד", "כנסיית הקבר",
        "كنيسة", "قداس", "بيت لحم"
    ))


COLOR_SYNONYMS: dict[str, set[str]] = {
    "black": {"black", "שחור", "أسود", "काला", "черный", "黒", "preto", "noir", "schwarz", "nero"},
    "white": {"white", "לבן", "أبيض", "सफेद", "белый", "白", "branco", "blanc", "weiß", "weiss", "bianco", "ivory", "cream", "שמנת"},
    "red": {"red", "אדום", "أحمر", "लाल", "красный", "红", "赤", "vermelho", "rouge", "rot", "rosso", "crimson", "scarlet", "burgundy", "בורדו"},
    "gold": {"gold", "זהב", "ذهب", "सुनहरा", "золотой", "金", "dourado", "or", "oro"},
    "yellow": {"yellow", "צהוב", "أصفر", "पीला", "желтый", "黄", "amarelo", "jaune", "gelb", "giallo"},
    "pink": {"pink", "ורוד", "ورדי", "गुलाबी", "розовый", "粉", "rosa", "rose", "fuchsia", "פוקסיה"},
    "orange": {"orange", "כתום", "ברتقالي", "नारंगी", "оранжевый", "橙", "laranja", "arancione"},
    "green": {"green", "ירוק", "أخضر", "हरा", "зеленый", "绿", "緑", "verde", "vert", "grün"},
}


def _item_has_color(it: dict[str, Any], target_color_family: str) -> bool:
    """Check if garment has a color belonging to target family."""
    syns = COLOR_SYNONYMS.get(target_color_family, {target_color_family})
    raw_colors = it.get("colors") or it.get("color") or it.get("colour") or []
    if isinstance(raw_colors, str):
        raw_colors = [raw_colors]
    for c in raw_colors:
        c_name = c.get("name") if isinstance(c, dict) else c
        c_str = str(c_name or "").lower().strip()
        if c_str in syns or any(s in c_str for s in syns):
            return True
    title_desc = f"{it.get('title') or ''} {it.get('name') or ''} {it.get('description') or ''}".lower()
    for s in syns:
        if re.search(rf"\b{re.escape(s)}\b", title_desc):
            return True
    return False


def is_predominantly_white_garment(item: dict[str, Any]) -> bool:
    """Return True only if garment is predominantly/solidly white, cream, or off-white.

    Strictly rejects items whose primary color is dark or vibrant (e.g. blue striped shirts,
    navy polo shirts, grey tops, red shirts, black shirts) even if they contain secondary white trim.
    """
    primary_col = str(item.get("color") or item.get("colour") or "").lower().strip()
    title = str(item.get("title") or item.get("name") or "").lower()

    # If primary color is explicitly non-white / colored, it is NOT white
    non_white_colors = (
        "blue", "navy", "black", "red", "green", "brown", "dark", "charcoal", "burgundy", "yellow", "orange", "rust",
        "כחול", "שחור", "אדום", "ירוק", "חום", "כהה", "בורדו", "צהוב", "כתום", "חלודה",
    )
    if any(c in primary_col for c in non_white_colors):
        return False

    # If title explicitly highlights a non-white color
    if any(re.search(rf"\b{re.escape(c)}\b", title) for c in (
        "blue", "navy", "black", "red", "green", "brown", "dark", "grey", "gray",
        "כחול", "כחולה", "שחור", "שחורה", "אדום", "אדומה", "ירוק", "ירוקה", "חום", "חומה", "אפור", "אפורה",
    )):
        return False

    # Check color breakdown percentages if present
    cols = item.get("colors") or []
    if isinstance(cols, list) and len(cols) > 0 and isinstance(cols[0], dict):
        white_pct = 0
        max_other_pct = 0
        for c in cols:
            cname = str(c.get("name") or "").lower()
            cpct = c.get("pct") or 0
            if any(w in cname for w in ("white", "off-white", "cream", "ivory", "לבן", "שמנת", "קרם")):
                white_pct += cpct
            else:
                max_other_pct = max(max_other_pct, cpct)
        if white_pct > 0 and white_pct >= 60 and white_pct >= max_other_pct:
            return True
        if white_pct < max_other_pct or white_pct < 50:
            return False

    # Fallback to _item_has_color
    return _item_has_color(item, "white")


RE_SHORTS_TERMS = re.compile(
    r"\b("
    # English
    r"shorts?|short\s+pants|bermuda|bermudas|swim\s+trunks|trunks|boardshorts|cut-?offs?|hot\s+pants|"
    # Spanish
    r"pantalones?\s+cortos?|pantal[oó]n\s+corto|bermudas?|ba[ñn]ador|"
    # French
    r"shorts?|pantacourts?|bermudas?|culottes?\s+courtes?|cale[cç]on\s+de\s+bain|"
    # German
    r"kurze\s+hosen?|shorts?|bermudas?|badehosen?|"
    # Italian
    r"pantaloncini|pantaloni\s+corti|shorts?|bermuda|costume\s+da\s+bagno|"
    # Portuguese
    r"cal[cç][oõ]es|cal[cç][aã]o|bermudas?|shorts?|"
    # Dutch
    r"korte\s+broek|shorts?|bermudas?|zwembroek|"
    # Russian
    r"шорты|короткие\s+штаны|бермуды|плавки|"
    # Chinese
    r"短裤|五分裤|热裤|沙滩裤|"
    # Japanese
    r"ショートパンツ|短パン|ハーフパンツ|水着|"
    # Hindi
    r"शॉर्ट्स|निक्कर|हाफ\s+पैंट"
    r")\b|"
    # Hebrew
    r"(?:מכנסיים\s+קצרים|מכנס\s+קצר|שורטס|ברמודה|מכנסי\s+קצרים|בגד\s+ים|בגדי\s+ים)|"
    # Arabic
    r"(?:شورت|سروال\s+قصير|بنطال\s+قصير|سراويل\s+قصيرة|برמודה|مايوه|ملابس\s+سباحة)",
    re.IGNORECASE | re.UNICODE,
)

RE_ANIMAL_PRINT_TERMS = re.compile(
    r"\b("
    # English
    r"animal\s+prints?|leopards?|cheetahs?|tigers?|zebras?|snakes?|snakeskins?|reptiles?|crocodiles?|alligators?|python|"
    # Spanish
    r"estampado\s+animal|leopardo|cebra|serpiente|cocodrilo|"
    # French
    r"imprim[eé]\s+animal|l[eé]opard|z[eè]bre|serpent|"
    # German
    r"tierprints?|leopardenmuster|zebramuster|schlangenmuster|"
    # Italian
    r"stampa\s+animalier|maculato|leopardato|zebrato|"
    # Portuguese
    r"estampa\s+animal|oncinha|leopardo|zebra|"
    # Dutch
    r"dierenprint|luipaardprint|zebraprint|"
    # Russian
    r"леопардовый|животный\s+принт|зебра|змеиный|леопард|"
    # Chinese
    r"豹纹|动物纹|斑马纹|蛇纹|"
    # Japanese
    r"ヒョウ柄|アニマル柄|ゼブラ柄|蛇柄|"
    # Hindi
    r"तेंदुआ\s+प्रिंट|एनिमल\s+प्रिंट|चीता\s+प्रिंट"
    r")\b|"
    # Hebrew
    r"(?:מנומר|מנומרת|הדפס\s+נמר|הדפס\s+זברה|זברה|חברבורות|הדפס\s+חיה|עור\s+נחש)|"
    # Arabic
    r"(?:نقشة\s+نمر|نقشة\s+فهد|جلد\s+الثعبان|طباعة\s+حيوان|نمر|فهد|زيبرا)",
    re.IGNORECASE | re.UNICODE,
)

RE_GRAPHIC_DISTRESSED_TERMS = re.compile(
    r"\b("
    # English
    r"graphics?|graphic\s+tees?|cartoons?|slogans?|distressed|ripped|torn|frayed|acid\s+wash|eagle\s+prints?|band\s+tees?|skulls?|"
    # Spanish
    r"gr[aá]ficos?|estampados?|dibujos?|rotos?|rasgados?|[aá]guila|"
    # French
    r"graphiques?|imprim[eé]s?|dessins?|d[eé]chir[eé]s?|aigles?|"
    # German
    r"grafik|comics?|zerrissen|adler|"
    # Italian
    r"grafica|stampe?|strappato|aquila|"
    # Portuguese
    r"gr[aá]ficos?|estampas?|rasgados?|[aá]guia|"
    # Russian
    r"графический|принт|рисунок|рваный|орел|череп|"
    # Chinese
    r"图案|印花|卡通|破洞|老鹰|"
    # Japanese
    r"グラフィック|プリント|イラスト|ダメージ|ワシ|"
    # Hindi
    r"ग्राफिक|प्रिंट|कार्टून|फटा\s+हुआ"
    r")\b|"
    # Hebrew
    r"(?:גרפי|הדפס\s+גרפי|ציור|קרוע|קרועים|משופשף|בלוי|נשר|גולגולת|סלוגן)|"
    # Arabic
    r"(?:غرافيك|طباعة|رسوم|ممزق|مهترئ|نسر|جمجمة)",
    re.IGNORECASE | re.UNICODE,
)

RE_REVEALING_BEACH_TERMS = re.compile(
    r"\b("
    # English
    r"crop\s+tops?|tank\s+tops?|tanks?|sleeveless|bralettes?|tube\s+tops?|strapless|halters?|mini\s+skirts?|micro\s+skirts?|sheer|see-?through|bodycon|bikinis?|swimwear|beachwear|flip-?flops?|slides?|"
    # Spanish
    r"sin\s+mangas|tirantes|minifaldas?|transparente|bikinis?|ba[ñn]ador|chanclas?|"
    # French
    r"sans\s+manches|d[eé]bardeurs?|minijupes?|transparent|bikinis?|claquettes?|tongs?|"
    # German
    r"[aä]rmellos|unterhemd|minirock|durchsichtig|bikinis?|badelatschen?|"
    # Italian
    r"senza\s+maniche|canottiere?|minigonne?|trasparente|bikinis?|ciabatte?|infradito|"
    # Portuguese
    r"sem\s+mangas|regatas?|minissaias?|transparente|bikinis?|chinelos?|"
    # Russian
    r"без\s+рукавов|майка|мини-юбка|прозрачный|бикини|шлепанцы|сланцы|"
    # Chinese
    r"无袖|背心|超短裙|透视|比基尼|泳衣|人字拖|拖鞋|"
    # Japanese
    r"ノースリーブ|タンクトップ|ミニスカート|シースルー|ビキニ|水着|ビーチサンダル|"
    # Hindi
    r"बिना\s+बांह|स्लीवलेस|टैंक\s+टॉप|मिनी\s+स्कर्ट|पारदर्शी|बिकनी|चप्पल"
    r")\b|"
    # Hebrew
    r"(?:חולצת\s+בטן|גופיית\s+בטן|גופייה|גופיה|ללא\s+שרוולים|סטרפלס|חצאית\s+מיני|שקוף|שקופה|ביקיני|בגד\s+ים|כפכפים|כפכפי\s+ים)|"
    # Arabic
    r"(?:بدون\s+أكمام|كاشف\s+البطن|تنورة\s+قصيرة|شفاف|بيكيني|ملابس\s+سباحة|شبشب)",
    re.IGNORECASE | re.UNICODE,
)


def is_shorts_garment(it: dict[str, Any], all_text: str = "", role: str | None = None) -> bool:
    """Return True if garment is shorts, short pants, trunks, or beach swimwear."""
    cat = norm_category(it.get("category"))
    sub_cat = str(it.get("sub_category") or "").lower().strip()
    cut = str(it.get("cut") or "").lower().strip()
    if sub_cat in {"shorts", "short_pants", "bermuda", "swimwear", "beachwear", "trunks", "swim_trunks", "boardshorts", "bikini", "hot_pants"}:
        return True
    if cut in {"short", "mini"} and (role == "bottom" or cat == "bottom"):
        return True
    if not all_text:
        all_text = " ".join([
            str(it.get("title") or ""),
            str(it.get("name") or ""),
            str(it.get("description") or ""),
            str(it.get("category") or ""),
            str(it.get("sub_category") or ""),
            " ".join(str(t) for t in (it.get("tags") or [])),
        ]).lower()
    return bool(RE_SHORTS_TERMS.search(all_text))


def has_animal_or_distracted_print(it: dict[str, Any], all_text: str = "") -> bool:
    """Return True if garment has animal print (leopard, cheetah, zebra, tiger, snake)."""
    pattern = str(it.get("pattern") or "").lower().strip()
    if pattern in {"animal", "animal_print", "leopard", "cheetah", "zebra", "tiger", "snake", "camo", "camouflage"}:
        return True
    if not all_text:
        all_text = " ".join([
            str(it.get("title") or ""),
            str(it.get("name") or ""),
            str(it.get("description") or ""),
            str(it.get("pattern") or ""),
            " ".join(str(t) for t in (it.get("tags") or [])),
        ]).lower()
    return bool(RE_ANIMAL_PRINT_TERMS.search(all_text))


def is_distressed_or_graphic(it: dict[str, Any], all_text: str = "") -> bool:
    """Return True if garment has graphic prints, cartoons, slogans, or distressed/ripped finish."""
    pattern = str(it.get("pattern") or "").lower().strip()
    if pattern in {"graphic", "print", "cartoon", "camo", "camouflage", "psychedelic"}:
        return True
    if not all_text:
        all_text = " ".join([
            str(it.get("title") or ""),
            str(it.get("name") or ""),
            str(it.get("description") or ""),
            str(it.get("pattern") or ""),
            " ".join(str(t) for t in (it.get("tags") or [])),
        ]).lower()
    return bool(RE_GRAPHIC_DISTRESSED_TERMS.search(all_text))


def is_revealing_or_beachwear(it: dict[str, Any], all_text: str = "", role: str | None = None) -> bool:
    """Return True if garment has revealing cuts (crop top, tank, sleeveless, sheer, mini) or beachwear."""
    sub_cat = str(it.get("sub_category") or "").lower().strip()
    if sub_cat in {"tank_top", "crop_top", "mini_skirt", "bralette", "tube_top", "swimwear", "bikini"}:
        return True
    if not all_text:
        all_text = " ".join([
            str(it.get("title") or ""),
            str(it.get("name") or ""),
            str(it.get("description") or ""),
            str(it.get("sub_category") or ""),
            " ".join(str(t) for t in (it.get("tags") or [])),
        ]).lower()
    return bool(RE_REVEALING_BEACH_TERMS.search(all_text))


RE_SHORT_SLEEVE_TERMS = re.compile(
    r"\b("
    # English
    r"short\s+sleeves?|short-sleeved?|short\s+sleeved?|t-?shirts?|tees?|polos?|tank\s+tops?|tanks?|muscle\s+tees?|cap\s+sleeves?|"
    # Spanish
    r"mangas?\s+cortas?|camisetas?|polos?|sin\s+mangas|"
    # French
    r"manches?\s+courtes?|t-?shirts?|polos?|sans\s+manches|"
    # German
    r"kurzarm|kurz[eä]rmelig|kurze\s+[aä]rmel|t-?shirts?|polos?|[aä]rmellos|"
    # Italian
    r"maniche?\s+corte?|magliette?|polos?|senza\s+maniche|"
    # Portuguese
    r"mangas?\s+curtas?|camisetas?|polos?|sem\s+mangas|"
    # Dutch
    r"korte\s+mouwen?|t-?shirts?|polos?|mouwloos|"
    # Russian
    r"короткий\s+рукав|короткими\s+рукавами|футболк[аи]|поло|без\s+рукавов|"
    # Chinese
    r"短袖|半袖|t恤|polo衫|无袖|"
    # Japanese
    r"半袖|ショートスリーブ|tシャツ|ポロシャツ|ノースリーブ|"
    # Hindi
    r"छोटी\s+आस्तीन|हाफ\s+स्लीव|टी-?शर्ट|पोलो|बिना\s+आस्तीन"
    r")\b|"
    # Hebrew
    r"(?:שרוול\s+קצר|שרוולים\s+קצרים|חולצה\s+קצרה|חולצות\s+קצרות|חולצת\s+טי|טי\s+שירט|פולו|גופייה|גופיה)|"
    # Arabic
    r"(?:أكمام\s+قصيرة|كم\s+قصير|نصف\s+كم|تي\s+شيرت|بولو|بدون\s+أكمام)",
    re.IGNORECASE | re.UNICODE,
)


def is_short_sleeve_top(it: dict[str, Any], all_text: str = "") -> bool:
    """Return True if garment is a short-sleeve top, t-shirt, polo, tank top, or sleeveless upper garment."""
    cat = norm_category(it.get("category"))
    if cat in {"bottom", "shoes", "accessory", "belt", "bag", "headwear", "eyewear", "footwear"}:
        return False

    title = str(it.get("title") or it.get("name") or "").lower()
    sub_cat = str(it.get("sub_category") or "").lower().strip()
    sleeve_len = str(it.get("sleeve_length") or "").lower().strip()

    # 1. Explicit sleeve_length field
    if sleeve_len in {"short", "short-sleeve", "short_sleeve", "sleeveless", "cap", "elbow"}:
        return True
    if sleeve_len in {"long", "long-sleeve", "long_sleeve", "full"}:
        return False

    # Check if title explicitly specifies long sleeves
    is_explicit_long = any(w in title for w in (
        "long sleeve", "long-sleeve", "longsleeve", "שרוול ארוך", "أكمام طويلة",
        "manga larga", "manches longues", "langarm", "maniche lunghe", "manga comprida",
        "lange mouwen", "длинный рукав", "长袖", "長袖", "फुल स्लीव"
    ))
    if is_explicit_long:
        return False

    # Outerwear & knitwear with full sleeves are not short-sleeve
    if sub_cat in {"sweater", "hoodie", "cardigan", "jacket", "coat", "blazer", "trench", "parka", "overcoat"}:
        return False
    if any(w in title for w in ("sweater", "hoodie", "cardigan", "jacket", "coat", "blazer", "סוודר", "קפוצ'ון", "מעיל", "ז'קט")):
        return False

    # 2. Inherently short-sleeved or sleeveless sub-categories (T-shirts, polos, tanks)
    if sub_cat in {"t-shirt", "tshirt", "tee", "polo", "tank_top", "tank", "crop_top", "camisole", "tube_top", "sleeveless"}:
        return True

    # 3. Text inspection across tags, description, title
    if not all_text:
        all_text = " ".join([
            title,
            str(it.get("description") or ""),
            str(it.get("sub_category") or ""),
            " ".join(str(t) for t in (it.get("tags") or [])),
        ]).lower()

    if bool(RE_SHORT_SLEEVE_TERMS.search(all_text)):
        return True

    return False


def validate_garment_against_negative_constraints(
    it: dict[str, Any],
    rule: Any,
    role: str | None = None,
    user_gender: str | None = None,
) -> tuple[bool, str | None]:
    """Validate a garment against the negative_constraint of a FashionRule or dict.

    Returns:
        (True, None) if compliant.
        (False, reason_str) if non-compliant with negative constraint.
    """
    rule_id = getattr(rule, "id", None) or (rule.get("id") if isinstance(rule, dict) else "")
    neg_constraint = getattr(rule, "negative_constraint", None) or (rule.get("negative_constraint") if isinstance(rule, dict) else "")
    if not neg_constraint:
        return True, None

    all_text = " ".join([
        str(it.get("title") or ""),
        str(it.get("name") or ""),
        str(it.get("description") or ""),
        str(it.get("category") or ""),
        str(it.get("sub_category") or ""),
        str(it.get("material") or ""),
        str(it.get("pattern") or ""),
        " ".join(str(t) for t in (it.get("tags") or [])),
    ]).lower()

    # 1. Hindu Funerals (Antyeshti)
    if rule_id == "rule_cultural_hindu_antyeshti" or "hindu funeral" in neg_constraint.lower() or "antyeshti" in neg_constraint.lower():
        if _item_has_color(it, "black"):
            return False, "Black clothing is strictly forbidden in Hindu funerals."
        if any(w in all_text for w in ("charcoal", "dark slate", "dark grey", "dark gray")):
            return False, "Dark charcoal/slate garments are forbidden in Hindu funerals."
        for col in ("red", "gold", "yellow", "orange", "pink"):
            if _item_has_color(it, col):
                return False, f"Vibrant celebratory color '{col}' is forbidden in Hindu funerals."
        cat = norm_category(it.get("category"))
        if role in ("shoes", "accessory", "belt", "footwear") or cat in ("shoes", "accessory", "belt", "footwear"):
            mat = str(it.get("material") or "").lower()
            if any(w in mat or w in all_text for w in ("leather", "suede", "עור", "جلد", "चमड़ा", "cuir", "leder", "pelle")):
                return False, "Leather shoes or belts are forbidden inside sacred Hindu cremation rituals."

    # 2. Hindu Weddings & Diwali (Vivaha)
    elif rule_id == "rule_cultural_hindu_vivaha" or "hindu wedding" in neg_constraint.lower() or "vivaha" in neg_constraint.lower():
        if _item_has_color(it, "black"):
            if not any(_item_has_color(it, c) for c in ("gold", "red", "yellow")):
                return False, "Solid black is inauspicious and strictly avoided at Hindu weddings."
        if _item_has_color(it, "white"):
            if not any(w in all_text for w in ("embroidered", "embroidery", "gold", "silk", "brocade", "nehru", "festive", "ריקמה", "זהב")):
                if not any(_item_has_color(it, c) for c in ("gold", "red", "yellow", "orange", "pink", "maroon")):
                    return False, "Plain unadorned white is associated with mourning and avoided by wedding guests."

    # 3. Shiva & Mourning Etiquette
    elif rule_id == "rule_cultural_mourning_shiva" or "shiva" in neg_constraint.lower() or "shiva mourning" in neg_constraint.lower():
        if is_item_mourning_inappropriate(it, role=role or norm_category(it.get("category"))):
            return False, "Garment violates Shiva mourning etiquette (graphic prints, shorts, or vibrant loud colors)."

    # 4. East Asian Funerals
    elif rule_id == "rule_cultural_east_asian_funeral" or "east asian funeral" in neg_constraint.lower() or "red and gold" in neg_constraint.lower():
        if _item_has_color(it, "red") or _item_has_color(it, "gold"):
            return False, "Red and gold are celebratory symbols and strictly taboo at East Asian funerals."

    # 5. East Asian Weddings
    elif rule_id == "rule_cultural_east_asian_wedding" or "chinese weddings" in neg_constraint.lower():
        cat = norm_category(it.get("category"))
        if role in ("dress", "top") or cat in ("dress", "top", "one-piece"):
            if _item_has_color(it, "red"):
                return False, "Solid red is reserved exclusively for the bride at Chinese weddings."
            if _item_has_color(it, "white") and (role == "dress" or cat == "dress"):
                return False, "Solid white bridal dresses are reserved exclusively for the bride."

    # 6. Western Wedding Guest Etiquette
    elif rule_id == "rule_cultural_ceremony_etiquette" or "solid white lace dress" in neg_constraint.lower() or "wedding" in neg_constraint.lower():
        cat = norm_category(it.get("category"))
        if role == "dress" or cat == "dress" or "dress" in all_text or "gown" in all_text or "שמלה" in all_text:
            if _item_has_color(it, "white"):
                return False, "Solid white, ivory, or cream dresses are reserved exclusively for the bride."

    # 7. Western Black Tie & Gala Protocol
    elif rule_id == "rule_cultural_western_black_tie" or "black tie" in neg_constraint.lower() or "tuxedo" in neg_constraint.lower():
        cat = norm_category(it.get("category"))
        if role in ("shoes", "footwear") or cat in ("shoes", "footwear"):
            if any(w in all_text for w in ("sneaker", "sneakers", "running", "sport", "סניקרס", "נעלי ספורט", "sandal", "sandals", "סנדלים", "slides", "flip")):
                return False, "Casual sneakers, sandals, and sports shoes are strictly forbidden for Black Tie galas."
        if role == "bottom" or cat == "bottom":
            if any(w in all_text for w in ("shorts", "שורטס", "cargo", "דגמח", "jeans", "ג'ינס", "sweatpants", "joggers")):
                return False, "Jeans, shorts, and casual pants are forbidden for Black Tie galas."

    # 8. Orthodox Jewish Modesty (Tzniut)
    elif rule_id == "rule_cultural_jewish_tzniut" or "tzniut" in neg_constraint.lower():
        gen = (user_gender or "").lower()
        cat = norm_category(it.get("category"))
        if gen in ("female", "women", "woman", "אישה"):
            if role == "bottom" or cat == "bottom":
                if any(w in all_text for w in ("pants", "trousers", "jeans", "shorts", "מכנסיים", "מכנס", "ג'ינס", "שורטס")):
                    return False, "Pants and shorts are prohibited for women under Orthodox Tzniut modesty."
        if role in ("top", "dress") or cat in ("top", "dress"):
            if any(w in all_text for w in ("sleeveless", "tank", "strapless", "גופייה", "גופיה", "crop top", "mini skirt", "חצאית מיני")):
                return False, "Sleeveless tops, crop tops, and mini skirts violate Orthodox Tzniut modesty."

    # 9. Islamic Friday Prayer & Mosque (Jumu'ah)
    elif (
        rule_id == "rule_cultural_islamic_jumuah"
        or "jumuah" in neg_constraint.lower()
        or "mosque" in neg_constraint.lower()
        or "masjid" in neg_constraint.lower()
        or "مسجد" in neg_constraint
        or "מסגד" in neg_constraint
        or "пятничная молитва" in neg_constraint.lower()
        or "islamic prayer" in neg_constraint.lower()
    ):
        cat = norm_category(it.get("category"))
        # 1. Shorts and short bottoms strictly forbidden for all genders (knees and legs must be fully covered)
        if role == "bottom" or cat == "bottom" or is_shorts_garment(it, all_text, role=role):
            if is_shorts_garment(it, all_text, role=role):
                return False, "Shorts and beachwear are strictly forbidden in mosque prayer (knees and legs must be fully covered)."
        # 2. Animal prints (leopard, cheetah, tiger, zebra, snake, eagle) strictly forbidden
        if has_animal_or_distracted_print(it, all_text):
            return False, "Garments or accessories with animal prints (leopard, zebra, etc.) are strictly forbidden in mosque prayer."
        # 3. Graphic tees, cartoons, slogan prints, distressed/ripped clothing forbidden
        if is_distressed_or_graphic(it, all_text):
            return False, "Graphic tees, slogan prints, and distressed/ripped garments are inappropriate for mosque prayer."
        # 4. Revealing cuts (crop top, tank, sleeveless, sheer, mini skirt) and beach footwear forbidden
        if is_revealing_or_beachwear(it, all_text, role=role):
            return False, "Revealing garments (sleeveless tops, crop tops, sheer fabrics, mini skirts) and flip-flops are strictly forbidden in mosque prayer."
        # 5. Short-sleeve tops strictly forbidden when specified in negative constraint or when arms must be covered
        if role in ("top", "upper") or cat in ("top", "upper") or is_short_sleeve_top(it, all_text):
            if any(w in neg_constraint.lower() for w in ("short-sleeve", "short sleeve", "shortsleeve", "שרוול קצר", "أكمام قصيرة", "sleeveless", "arms")):
                if is_short_sleeve_top(it, all_text):
                    return False, "Short-sleeve tops and t-shirts are inappropriate for mosque prayer (arms must be covered with long sleeves)."

    # 10. Conservative Modesty
    elif rule_id == "rule_cultural_modesty_conservative" or "unlayered sleeveless" in neg_constraint.lower():
        if any(w in all_text for w in ("crop top", "bralette", "tube top", "mini skirt", "חצאית מיני", "גופיית בטן")):
            return False, "Revealing garments violate conservative modesty standards."

    # 11. Christian Church, Mass & Holy Sanctuary Etiquette
    elif (
        rule_id == "rule_cultural_christian_church_mass"
        or "church" in neg_constraint.lower()
        or "mass" in neg_constraint.lower()
        or "bethlehem" in neg_constraint.lower()
        or "sanctuary" in neg_constraint.lower()
        or "כנסייה" in neg_constraint
        or "מיסה" in neg_constraint
    ):
        cat = norm_category(it.get("category"))
        # 1. Reject flip-flops and athletic beach footwear
        if role in ("shoes", "footwear") or cat in ("shoes", "footwear"):
            if any(w in all_text for w in ("flip-flop", "flip flop", "כפכפים", "כפכפי ים", "slides")):
                return False, "Flip-flops and beach slides are forbidden in holy sanctuaries."

        # 2. Reject casual headwear inside sanctuary
        if role in ("headwear", "hat") or cat in ("headwear", "hat"):
            if not any(w in all_text for w in ("mantilla", "veil", "כיסוי ראש", "צעיף")):
                return False, "Caps and casual hats must be removed inside Christian sanctuaries."

        # 3. Reject shorts and ripped bottoms
        if role == "bottom" or cat == "bottom" or is_shorts_garment(it, all_text, role=role):
            if is_shorts_garment(it, all_text, role=role):
                return False, "Shorts and athletic tights are strictly forbidden in church services and holy sanctuaries."
            if is_distressed_or_graphic(it, all_text):
                return False, "Ripped or distressed garments violate church etiquette."

        # 4. Reject animal prints
        if has_animal_or_distracted_print(it, all_text):
            return False, "Animal prints (leopard, zebra, etc.) are inappropriate for church services and holy sanctuaries."

        # 5. Reject graphic tees, cartoon prints, animal graphics, slogan tees, tank tops, crop tops
        if is_distressed_or_graphic(it, all_text):
            return False, "Graphic tees, eagle/tribal prints, and slogan shirts are inappropriate for church services and holy sites."
        if is_revealing_or_beachwear(it, all_text, role=role):
            return False, "Revealing garments (tank tops, crop tops, sheer fabrics, mini skirts) and beachwear are forbidden in holy sanctuaries."

    # 12. Buddhist Temple Visitation & Monastic Color Taboo
    elif (
        rule_id == "rule_cultural_buddhist_temple_etiquette"
        or "monastic robes" in neg_constraint.lower()
        or "saffron" in neg_constraint.lower()
    ):
        cat = norm_category(it.get("category"))
        # Laypersons must never wear saffron/monastic orange robes
        if role in ("top", "outerwear", "dress", "one-piece") or cat in ("top", "outerwear", "dress", "one-piece"):
            if _item_has_color(it, "orange"):
                if any(w in all_text for w in ("saffron", "ochre", "monk", "כתום", "נזיר", "robe", "tunic")):
                    return False, "Saffron and monastic orange robes are strictly reserved for ordained monks."
        # Modesty & Respect
        if role == "bottom" or cat == "bottom":
            if any(w in all_text for w in ("shorts", "שורטס", "מכנסיים קצרים", "mini skirt", "חצאית מיני")):
                return False, "Shorts and mini skirts are strictly forbidden in Buddhist temples (knees must be covered)."
        if any(w in all_text for w in ("sleeveless", "tank", "גופייה", "גופיה", "crop top", "חולצת בטן")):
            return False, "Sleeveless tops and crop tops are strictly forbidden in Buddhist temples."
        if any(w in all_text for w in ("buddha print", "buddha graphic", "הדפס בודהה")):
            return False, "Disrespectful prints depicting sacred religious figures on garments are forbidden."

    # 13. Buddhist Lay Meditation (White Attire)
    elif (
        rule_id == "rule_cultural_buddhist_lay_meditation_white"
        or "chut khao" in neg_constraint.lower()
        or ("solid white" in neg_constraint.lower() and "meditation" in neg_constraint.lower())
    ):
        if not _item_has_color(it, "white"):
            return False, "Lay meditation and precept observance strictly mandates pure white attire (Chut Khao)."
        pattern = str(it.get("pattern") or "").lower()
        if pattern in ("loud", "floral", "graphic", "print", "geometric"):
            return False, "Patterned garments violate simple white meditation guidelines."

    # 14. Sikh Gurdwara Protocol
    elif (
        rule_id == "rule_cultural_sikh_gurdwara_protocol"
        or "gurdwara" in neg_constraint.lower()
        or ("head covering" in neg_constraint.lower() and "sikh" in neg_constraint.lower())
    ):
        cat = norm_category(it.get("category"))
        # Headwear must be a cloth scarf / Rumal / Dastar, NOT a baseball cap / fedora / beanie
        if role in ("headwear", "hat") or cat in ("headwear", "hat"):
            if any(w in all_text for w in ("cap", "baseball", "fedora", "beanie", "visor", "קסקט", "כובע מצחייה", "כובע גרב")):
                return False, "Baseball caps and casual hats are strictly forbidden inside a Gurdwara (use a Rumāl or Dastar)."
        if role == "bottom" or cat == "bottom":
            if any(w in all_text for w in ("shorts", "שורטס", "מכנסיים קצרים", "mini skirt", "חצאית מיני")):
                return False, "Shorts and mini skirts are strictly forbidden in a Gurdwara."
        if any(w in all_text for w in ("sleeveless", "tank", "גופייה", "גופיה", "crop top")):
            return False, "Bare shoulders and sleeveless garments are strictly forbidden in a Gurdwara."

    # 15. Chinese Green Hat Taboo
    elif (
        rule_id == "rule_cultural_chinese_green_hat_taboo"
        or "green hat" in neg_constraint.lower()
        or "dài lǜ màozi" in neg_constraint.lower()
        or "戴绿帽子" in neg_constraint
    ):
        cat = norm_category(it.get("category"))
        if role in ("headwear", "hat", "accessory") or cat in ("headwear", "hat"):
            if _item_has_color(it, "green"):
                return False, "Green hats/caps for men are an extreme cultural taboo in Chinese tradition (dài lǜ màozi)."

    # 16. Hindu Temple Darshan & Non-Leather Sanctum
    elif (
        rule_id == "rule_cultural_hindu_temple_darshan"
        or "temple sanctum" in neg_constraint.lower()
        or ("ritual impurity" in neg_constraint.lower() and "leather" in neg_constraint.lower())
    ):
        cat = norm_category(it.get("category"))
        # Strictly purge all leather articles
        mat = str(it.get("material") or "").lower()
        if any(w in mat or w in all_text for w in ("leather", "suede", "עור", "جلد", "चमड़ा", "cuir", "leder")):
            return False, "All leather articles (shoes, belts, wallets, bags) are strictly forbidden in Hindu temple sanctums (Ahimsa)."
        if role == "bottom" or cat == "bottom":
            if any(w in all_text for w in ("shorts", "שורטס", "mini skirt", "חצאית מיני")):
                return False, "Shorts and mini skirts are forbidden for Hindu temple Darshan."
        if any(w in all_text for w in ("sleeveless", "tank", "גופייה", "crop top")):
            return False, "Sleeveless tops and crop tops are forbidden for Hindu temple Darshan."

    # 17. South Indian Kerala Temple (Mundu)
    elif (
        rule_id == "rule_cultural_hindu_kerala_mundu"
        or "kerala temple" in neg_constraint.lower()
    ):
        cat = norm_category(it.get("category"))
        gen = (user_gender or "").lower()
        if gen in ("male", "man", "men", "גבר") or not gen:
            if role in ("top", "outerwear") or cat in ("top", "outerwear"):
                if not any(w in all_text for w in ("melmundu", "angavastram", "stole", "צעיף")):
                    return False, "Stitched shirts and tops are strictly barred for men in traditional Kerala temple inner courtyards."
            if role == "bottom" or cat == "bottom":
                if any(w in all_text for w in ("trousers", "pants", "jeans", "shorts", "מכנסיים", "ג'ינס")):
                    return False, "Western pants and trousers are forbidden in Kerala temple courtyards (Mundu required)."

    # 18. Tisha B'Av & Yom Kippur Footwear Protocol
    elif (
        rule_id == "rule_cultural_jewish_tisha_bav_fast"
        or "ne'ilat hasandal" in neg_constraint.lower()
        or "נעילת הסנדל" in neg_constraint
    ):
        cat = norm_category(it.get("category"))
        if role in ("shoes", "footwear", "accessory", "belt") or cat in ("shoes", "footwear", "accessory", "belt"):
            mat = str(it.get("material") or "").lower()
            if any(w in mat or w in all_text for w in ("leather", "suede", "עור", "جلد", "cuir", "leder")):
                return False, "Leather footwear is strictly forbidden on Yom Kippur and Tisha B'Av (Ne'ilat HaSandal)."

    # 19. Synagogue Worship & Western Wall (Kotel)
    elif (
        rule_id == "rule_cultural_jewish_synagogue_prayer"
        or "synagogue services" in neg_constraint.lower()
        or "synagogue" in neg_constraint.lower()
        or "בית כנסת" in neg_constraint
        or "כותל" in neg_constraint
    ):
        cat = norm_category(it.get("category"))
        if role in ("shoes", "footwear") or cat in ("shoes", "footwear"):
            if any(w in all_text for w in ("flip-flop", "flip flop", "slides", "כפכפים", "כפכפי ים")):
                return False, "Beach flip-flops and athletic slides are forbidden in synagogue services."
        if role == "bottom" or cat == "bottom" or is_shorts_garment(it, all_text, role=role):
            if is_shorts_garment(it, all_text, role=role):
                return False, "Shorts and swimwear are forbidden in synagogue services."
            if is_distressed_or_graphic(it, all_text):
                return False, "Ripped, distressed, or slogan bottoms violate synagogue reverence standards."
        if has_animal_or_distracted_print(it, all_text):
            return False, "Animal prints (leopard, zebra, etc.) violate synagogue reverence standards."
        if is_distressed_or_graphic(it, all_text):
            return False, "Graphic tees, band prints, and distressed garments violate synagogue reverence standards."
        if is_revealing_or_beachwear(it, all_text, role=role):
            return False, "Sleeveless tops, crop tops, and revealing cuts violate synagogue reverence standards."

    # 20. Vatican & Papal Audience Protocol
    elif (
        rule_id == "rule_cultural_vatican_papal_audience"
        or "privilège du blanc" in neg_constraint.lower()
        or "papal audience" in neg_constraint.lower()
    ):
        cat = norm_category(it.get("category"))
        # White dresses strictly reserved for Catholic queens/monarchs
        if role == "dress" or cat == "dress" or "dress" in all_text or "שמלה" in all_text:
            if _item_has_color(it, "white"):
                return False, "White dresses are strictly forbidden at papal audiences (Privilège du blanc reserved for Catholic queens)."
        if role in ("shoes", "footwear") or cat in ("shoes", "footwear"):
            if any(w in all_text for w in ("open-toe", "sandals", "סנדלים", "slides", "sneaker", "sneakers")):
                return False, "Open-toed sandals and athletic shoes are strictly forbidden at papal audiences."
        if any(w in all_text for w in ("sleeveless", "tank", "גופייה", "crop top", "shorts", "שורטס")):
            return False, "Revealing garments and shorts are forbidden at papal audiences."

    # 21. Islamic Hajj & Umrah Pilgrimage (Ihram)
    elif (
        rule_id == "rule_cultural_islamic_hajj_umrah_ihram"
        or "ihram" in neg_constraint.lower()
    ):
        cat = norm_category(it.get("category"))
        gen = (user_gender or "").lower()
        if gen in ("male", "man", "men", "גבר") or not gen:
            # Stitched clothes strictly barred for men in Ihram
            if role in ("top", "bottom", "outerwear") or cat in ("top", "bottom", "outerwear"):
                if not any(w in all_text for w in ("unstitched", "seamless", "izar", "rida", "towel")):
                    if any(w in all_text for w in ("shirt", "pants", "trousers", "jacket", "coat", "boxer", "underwear", "חולצה", "מכנסיים")):
                        return False, "Stitched and tailored garments are strictly forbidden for men in Ihram."
            if role in ("headwear", "hat") or cat in ("headwear", "hat"):
                return False, "Head coverings are strictly forbidden for men in Ihram."

    # 22. Western White Tie Protocol
    elif (
        rule_id == "rule_cultural_western_white_tie"
        or ("white tie" in neg_constraint.lower() and "tailcoat" in neg_constraint.lower())
    ):
        cat = norm_category(it.get("category"))
        if role in ("shoes", "footwear") or cat in ("shoes", "footwear"):
            if any(w in all_text for w in ("sneaker", "sneakers", "loafer", "sandals", "boots")):
                return False, "Casual shoes, sneakers, and loafers are strictly forbidden for White Tie (patent court shoes/oxfords required)."
        if role in ("top", "outerwear") or cat in ("top", "outerwear"):
            if any(w in all_text for w in ("t-shirt", "polo", "hoodie", "denim", "sweater")):
                return False, "Casual garments are strictly forbidden for White Tie protocol."

    # 23. Latin American Guayabera Protocol
    elif (
        rule_id == "rule_cultural_guayabera_formal_protocol"
        or "guayabera" in neg_constraint.lower()
    ):
        cat = norm_category(it.get("category"))
        if role == "bottom" or cat == "bottom":
            if any(w in all_text for w in ("shorts", "שורטס", "swim", "trunks")):
                return False, "Casual shorts and swimwear are strictly forbidden with formal Guayabera de gala."
        if role in ("shoes", "footwear") or cat in ("shoes", "footwear"):
            if any(w in all_text for w in ("flip-flop", "slides", "sneakers", "סניקרס")):
                return False, "Athletic sneakers and flip-flops are strictly forbidden with formal Guayabera de gala."

    # 24. Latin American Quinceañera Guest Protocol
    elif (
        rule_id == "rule_cultural_latin_quinceanera_guest"
        or "quinceañera" in neg_constraint.lower()
        or "quinceanera" in neg_constraint.lower()
    ):
        cat = norm_category(it.get("category"))
        if role == "dress" or cat == "dress" or "dress" in all_text or "gown" in all_text:
            if _item_has_color(it, "white") or any(w in all_text for w in ("ivory", "שמנת")):
                return False, "White or ivory formal gowns are strictly reserved for the Quinceañera celebrant."

    # 25. Ghanaian Funeral Kente Taboo
    elif (
        rule_id == "rule_cultural_ghanaian_kente_protocol"
        or "kobene" in neg_constraint.lower()
    ):
        if any(w in all_text for w in ("funeral", "mourning", "לוויה", "אבל")):
            if _item_has_color(it, "gold") or any(w in all_text for w in ("multicolor", "joyous", "celebratory kente")):
                return False, "Joyous gold or multicolored Kente is strictly forbidden at Ghanaian funerals (Kobene/Kuntunkuni required)."

    # 26. Sigd Holiday (Beta Israel Ethiopian Jewish Tradition)
    elif (
        rule_id == "rule_cultural_jewish_sigd"
        or "sigd" in neg_constraint.lower()
        or "סיגד" in neg_constraint
    ):
        cat = norm_category(it.get("category"))
        # Strictly forbid black or dark funeral mourning garments
        if _item_has_color(it, "black"):
            return False, "Black clothing is strictly forbidden on the sacred Sigd holiday."
        if any(w in all_text for w in ("charcoal", "dark grey", "dark gray", "mourning")):
            return False, "Dark somber mourning colors are forbidden on the festive Sigd holiday."
        # Strictly forbid graphic tees, eagle prints, loud prints, slogan tees
        pattern = str(it.get("pattern") or "").lower()
        if pattern in ("graphic", "print", "cartoon", "camo", "camouflage"):
            return False, "Graphic and printed tees are inappropriate for the sacred Sigd holiday."
        if any(w in all_text for w in (
            "graphic", "cartoon", "ציור", "נשר", "eagle", "slogan", "הדפס", "tribal", "טריבל"
        )):
            return False, "Graphic tees and animal/eagle prints are strictly forbidden on Sigd."
        # Sigd Tradition Mandate: Tops & Dresses MUST be predominantly pure white, off-white, or cream
        if role in ("top", "dress") or cat in ("top", "dress"):
            if not is_predominantly_white_garment(it):
                return False, "Sigd holiday sacred tradition requires predominantly pure white or light celebratory attire (white shirt/Habesha Kemis). Colored, striped, or dark tops are strictly forbidden."
        # Outerwear: must not clash with white festive attire (reject rust, terracotta, bright orange, red, black)
        if role in ("outerwear", "jacket") or cat in ("outerwear", "jacket"):
            if _item_has_color(it, "rust") or _item_has_color(it, "orange") or _item_has_color(it, "red") or _item_has_color(it, "black"):
                return False, "Loud rust/terracotta or dark black jackets clash with festive white Sigd attire."
        # Modesty & Respect: forbid shorts, mini skirts, distressed/ripped jeans, tank tops
        if role == "bottom" or cat == "bottom":
            if any(w in all_text for w in (
                "shorts", "שורטס", "מכנסיים קצרים", "ripped", "קרוע", "קרעים", "distressed", "משופשף", "swim", "mini skirt", "חצאית מיני", "ברמודה", "טייץ"
            )):
                return False, "Shorts, mini skirts, distressed and ripped jeans violate Sigd sanctity."
        if any(w in all_text for w in ("tank top", "tank", "sleeveless", "גופייה", "גופיה", "crop top", "חולצת בטן")):
            return False, "Sleeveless tops and crop tops violate Sigd sanctity."
        if role in ("shoes", "footwear") or cat in ("shoes", "footwear"):
            if any(w in all_text for w in ("flip-flop", "flip flop", "כפכפים", "כפכפי ים", "slides")):
                return False, "Beach flip-flops and casual slides are forbidden on Sigd."

    # 27. Inuit Sinck Tuck & Winter Drum Dancing
    elif (
        rule_id == "rule_cultural_inuit_sinck_tuck"
        or "sinck tuck" in neg_constraint.lower()
        or "sink tuck" in neg_constraint.lower()
    ):
        cat = norm_category(it.get("category"))
        if role in ("shoes", "footwear") or cat in ("shoes", "footwear"):
            if any(w in all_text for w in ("canvas", "sneaker", "sneakers", "flip-flop", "sandal", "sandals", "סנדלים", "כפכפים")):
                return False, "Thin canvas sneakers and sandals are strictly forbidden in Arctic Sinck Tuck winter conditions."
        if role in ("top", "outerwear") or cat in ("top", "outerwear"):
            if any(w in all_text for w in ("sleeveless", "tank", "crop top", "thin jacket", "unlined")):
                return False, "Un-insulated or sleeveless clothing is dangerous in Arctic winter conditions."

    # 28. Thai Songkran Water Festival
    elif (
        rule_id == "rule_cultural_thai_songkran"
        or "songkran" in neg_constraint.lower()
        or "สงกรานต์" in neg_constraint
    ):
        mat = str(it.get("material") or "").lower()
        if any(w in mat or w in all_text for w in ("silk", "משי", "cashmere", "suede")):
            return False, "Dry-clean-only silk and delicate fabrics will be permanently ruined during Songkran water splashing."
        if any(w in all_text for w in ("transparent", "sheer", "שקוף", "bikini", "ביקיני")):
            return False, "Translucent or revealing swimwear violates Thai public modesty laws during Songkran."

    # 29. Hindu Holi Festival of Colors
    elif (
        rule_id == "rule_cultural_hindu_holi"
        or "holi" in neg_constraint.lower()
        or "होली" in neg_constraint
    ):
        mat = str(it.get("material") or "").lower()
        if any(w in mat or w in all_text for w in ("silk", "משי", "wool", "צמר", "cashmere", "קשמיר")):
            return False, "Silk and wool garments will be permanently ruined by colored Holi powders (Gulal)."
        cat = norm_category(it.get("category"))
        if role in ("shoes", "footwear", "accessory", "belt") or cat in ("shoes", "footwear", "accessory", "belt"):
            if any(w in mat or w in all_text for w in ("leather", "suede", "עור")):
                return False, "Leather footwear and accessories will be ruined by wet Holi dyes."

    # 30. Lag BaOmer Bonfire Safety
    elif (
        rule_id == "rule_cultural_jewish_lag_baomer"
        or "lag baomer" in neg_constraint.lower()
        or "ל\"ג בעומר" in neg_constraint
    ):
        mat = str(it.get("material") or "").lower()
        if any(w in mat or w in all_text for w in ("100% polyester", "thin nylon", "windbreaker", "מעיל רוח ניילון")):
            return False, "Meltable synthetic fabrics pose a severe burn hazard near active Lag BaOmer bonfires."
        if role in ("shoes", "footwear") or norm_category(it.get("category")) in ("shoes", "footwear"):
            if any(w in all_text for w in ("high heel", "stiletto", "flip-flop", "עקבים", "כפכפים")):
                return False, "High heels and flip-flops are hazardous around rough bonfire terrain."

    # 31. Tu B'Av White Vineyard Attire
    elif (
        rule_id == "rule_cultural_jewish_tu_bav"
        or "tu b'av" in neg_constraint.lower()
        or "ט\"ו באב" in neg_constraint
    ):
        if _item_has_color(it, "black"):
            return False, "Black clothing is avoided on Tu B'Av (celebrated traditionally in pure white garments)."

    # 32. Bavarian Oktoberfest Trachten
    elif (
        rule_id == "rule_cultural_bavarian_oktoberfest_dirndl"
        or "oktoberfest" in neg_constraint.lower()
        or "dirndl" in neg_constraint.lower()
    ):
        if any(w in all_text for w in ("mini dirndl", "halloween dirndl", "costume dirndl", "mini skirt", "חצאית מיני")):
            return False, "Mini-length synthetic carnival dirndls are considered vulgar and strictly avoided at Oktoberfest."

    # 33. Intertribal Powwow Protocol
    elif (
        rule_id == "rule_cultural_native_powwow_ribbonwork"
        or "powwow" in neg_constraint.lower()
    ):
        cat = norm_category(it.get("category"))
        if role == "bottom" or cat == "bottom":
            if any(w in all_text for w in ("short shorts", "mini skirt", "חצאית מיני", "shorts")):
                return False, "Shorts and mini skirts are inappropriate for sacred Powwow grounds (ribbon skirts must cover knees)."
        if any(w in all_text for w in ("crop top", "revealing", "גופיית בטן")):
            return False, "Revealing garments violate Powwow protocol."

    return True, None


def filter_candidate_closet_by_axioms(
    closet_items: list[dict[str, Any]] | None,
    axioms: list[Any] | None,
    *,
    user_profile: dict[str, Any] | None = None,
    user_gender: str | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Pre-filter candidate closet items against negative constraints of retrieved RAG axioms.

    Executed BEFORE LLM inference so that prohibited garments (e.g. black clothes at Hindu funerals,
    red/gold at East Asian funerals, solid white dresses at weddings, bright prints at Shiva)
    are purged from candidate inventory and never presented to the model.

    Returns:
        tuple(compliant_items, purged_items)
    """
    if not closet_items:
        return [], []
    if not axioms:
        return list(closet_items), []

    user_gender = user_gender or (user_profile or {}).get("sex") or (user_profile or {}).get("gender")

    active_negative_axioms = [
        ax for ax in axioms
        if getattr(ax, "negative_constraint", None) or (isinstance(ax, dict) and ax.get("negative_constraint"))
    ]
    if not active_negative_axioms:
        return list(closet_items), []

    compliant: list[dict[str, Any]] = []
    purged: list[dict[str, Any]] = []

    for it in closet_items:
        cid = str(it.get("id") or it.get("_id") or "")
        title = it.get("title") or it.get("name") or cid
        role = norm_category(it.get("category"))
        is_clean = True
        violation_reason = None
        violation_rule = None

        for ax in active_negative_axioms:
            is_valid, reason = validate_garment_against_negative_constraints(
                it, ax, role=role, user_gender=user_gender
            )
            if not is_valid:
                is_clean = False
                violation_reason = reason
                violation_rule = getattr(ax, "id", None) or (ax.get("id") if isinstance(ax, dict) else "")
                break

        if is_clean:
            compliant.append(it)
        else:
            it_copy = dict(it)
            it_copy["_purged_reason"] = violation_reason
            it_copy["_purged_rule_id"] = violation_rule
            purged.append(it_copy)
            logger.info(
                "Axiom candidate pre-filter purged non-compliant item '%s' (cid=%s) due to %s: %s",
                title, cid, violation_rule, violation_reason
            )

    # Safety guard: ensure critical categories (top, bottom, shoes) do not become completely empty
    cat_counts: dict[str, int] = {}
    for it in compliant:
        cat = norm_category(it.get("category"))
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    essential_roles = ("top", "bottom", "shoes")
    for r in essential_roles:
        if cat_counts.get(r, 0) == 0:
            purged_for_role = [it for it in purged if norm_category(it.get("category")) == r]
            if purged_for_role:
                logger.warning(
                    "Axiom pre-filter warning: Category '%s' was completely emptied by negative constraints. User has no compliant items in this slot.",
                    r,
                )

    return compliant, purged


def find_best_garment_replacement(
    role: str,
    all_closet_items: list[dict[str, Any]],
    user_text: str,
    user_gender: str | None,
    exclude_item_ids: set[str],
    axioms: list[Any] | None = None,
    recent_item_ids: set[str] | list[str] | None = None,
    do_dont_negative_rules: list[str] | None = None,
) -> dict[str, Any] | None:
    """Search user's closet metadata for the best matching replacement garment for a specific role."""
    allowed_cats = ROLE_ALLOWED_CATEGORIES.get(role, set())
    is_mourning = _is_mourning_context(user_text)
    recent_set = {str(x) for x in recent_item_ids} if recent_item_ids else set()

    # Prune opposite-gender items immediately from replacement candidates
    from app.services.fashion_rules_rag import filter_gender_closet_items
    all_closet_items = filter_gender_closet_items(all_closet_items, user_gender)

    # 1. Filter candidates by category, gender, and axiom negative constraints
    candidates = []
    for it in all_closet_items:
        cid = str(it.get("id") or it.get("_id") or "")
        if not cid or cid in exclude_item_ids:
            continue

        cat = norm_category(it.get("category"))
        if cat not in allowed_cats and str(it.get("category") or "").lower() not in allowed_cats:
            continue

        if check_garment_role_mismatch(it, role=role) is not None:
            continue

        if axioms:
            is_axiom_clean = True
            for ax in axioms:
                is_comp, _ = validate_garment_against_negative_constraints(
                    it, ax, role=role, user_gender=user_gender
                )
                if not is_comp:
                    is_axiom_clean = False
                    break
            if not is_axiom_clean:
                continue

        if do_dont_negative_rules:
            is_dd_clean = True
            for dd in do_dont_negative_rules:
                dd_low = dd.lower()
                if any(w in dd_low for w in ("shorts", "beachwear", "מכנסיים קצרים", "בגדי ים", "בגד ים", "شورט", "سروال قصير", "bermuda", "kurze hose", "pantalon corto", "pantacourt")):
                    if is_shorts_garment(it, role=role):
                        is_dd_clean = False
                        break
                if any(w in dd_low for w in ("animal", "leopard", "cheetah", "zebra", "eagle", "graphic", "print", "tees", "מנומר", "הדפס", "חיות", "נשר", "ציור", "نقشة نمر", "tierprint")):
                    if has_animal_or_distracted_print(it) or is_distressed_or_graphic(it):
                        is_dd_clean = False
                        break
                if any(w in dd_low for w in ("sleeveless", "tank", "crop top", "mini skirt", "גופייה", "גופיה", "חולצת בטן", "חצאית מיני", "بدון أكمام", "sin mangas")):
                    if is_revealing_or_beachwear(it, role=role):
                        is_dd_clean = False
                        break
                if any(w in dd_low for w in ("flip-flop", "slides", "sandals", "כפכפים", "כפכפי ים", "סנדלים", "شبشب", "chanclas")):
                    all_text_check = f"{it.get('title') or ''} {it.get('name') or ''} {it.get('sub_category') or ''}".lower()
                    if any(w in all_text_check for w in ("flip-flop", "flip flop", "slides", "כפכפים", "כפכפי ים")):
                        is_dd_clean = False
                        break
                if any(w in dd_low for w in (
                    "short-sleeve", "short sleeve", "short sleeves", "shortsleeve",
                    "שרוול קצר", "שרוולים קצרים", "חולצות קצרות", "חולצה קצרה",
                    "أكمام قصيرة", "كم قصير", "نصف كم",
                    "manga corta", "mangas cortas",
                    "manches courtes", "manche courte",
                    "kurzarm", "kurzärmelig", "kurze ärmel",
                    "maniche corte", "manica corta",
                    "mangas curtas", "manga curta",
                    "korte mouwen", "korte mouw",
                    "короткий рукав", "короткими рукавами",
                    "短袖", "半袖", "छोटी आस्तीन"
                )):
                    if is_short_sleeve_top(it):
                        is_dd_clean = False
                        break
            if not is_dd_clean:
                continue

        score = calculate_garment_style_score(
            it,
            user_text,
            user_gender=user_gender,
        )
        if score <= -50:
            continue

        if is_mourning and is_item_mourning_inappropriate(it, role=role):
            continue

        is_recent = 1 if cid in recent_set else 0
        last_sug = str(it.get("last_suggested_at") or "")
        last_worn = str(it.get("last_worn_at") or "")
        wear_count = int(it.get("wear_count") or 0)
        sug_val = last_sug if last_sug else "0000-00-00"
        worn_val = last_worn if last_worn else "0000-00-00"

        # Deterministic rotation hash based on query + cid + role so tied items rotate
        rot_hash = abs(hash(f"{user_text}_{cid}_{role}")) % 1000

        candidates.append((is_recent, -score, sug_val, worn_val, wear_count, rot_hash, it))

    if not candidates:
        return None

    # Sort candidates by:
    # 1. Non-recent first (is_recent=0)
    # 2. Highest style score first (-score)
    # 3. Oldest suggested timestamp first (sug_val == "0000-00-00" first)
    # 4. Oldest worn timestamp first (worn_val)
    # 5. Lowest wear count
    # 6. Rotational hash to break ties evenly
    candidates.sort(key=lambda x: (x[0], x[1], x[2], x[3], x[4], x[5]))
    best_item = candidates[0][6]
    return best_item



LOCALIZED_SILHOUETTE_MOURNING: dict[str, str] = {
    "en": "Classic, understated, and comfortable silhouette",
    "he": "גזרה קלאסית מאופקת ונוחה",
    "ar": "قصة كلاسيكية هادئة ومريحة",
    "es": "Corte clásico, sobrio y cómodo",
    "fr": "Coupe classique, sobre et confortable",
    "de": "Klassischer, dezenter und bequemer Schnitt",
    "it": "Taglio classico, sobrio e confortevole",
    "pt": "Corte clássico, sóbrio e confortável",
    "nl": "Klassiek, ingetogen en comfortabel model",
    "ru": "Классический, сдержанный и удобный крой",
    "zh": "经典、内敛且舒适的版型",
    "ja": "クラシックで控えめな、着心地の良いシルエット",
    "hi": "क्लासिक, शालीन और आरामदायक कट",
}

LOCALIZED_SILHOUETTE_DEFAULT: dict[str, str] = {
    "en": "Clean, well-proportioned, and comfortable silhouette",
    "he": "גזרה נקייה, מאוזנת ונוחה",
    "ar": "قصة نظيفة ومتناسقة ومريحة",
    "es": "Corte limpio, equilibrado y cómodo",
    "fr": "Coupe nette, bien équilibrée et confortable",
    "de": "Klarer, gut proportionierter und bequemer Schnitt",
    "it": "Taglio pulito, proporzionato e confortevole",
    "pt": "Corte limpo, bem proporcionado e confortável",
    "nl": "Strak, evenwichtig en comfortabel model",
    "ru": "Чистый, пропорциональный и удобный крой",
    "zh": "利落、比例协调且舒适的版型",
    "ja": "すっきりとしたバランスの良い着心地の良いシルエット",
    "hi": "साफ, संतुलित और आरामदायक कट",
}

LOCALIZED_TEXTURE_MOURNING: dict[str, str] = {
    "en": "Smooth, comfortable fabrics providing a dignified appearance",
    "he": "איזון בדים חלקים ונעימים המעניקים מראה מכובד",
    "ar": "أقمشة ناعمة ومريحة تمنح مظهراً لائقاً ومحترماً",
    "es": "Telas suaves y cómodas que aportan una apariencia digna",
    "fr": "Tissus lisses et confortables offrant une allure digne",
    "de": "Glatte, angenehme Stoffe für ein würdevolles Erscheinungsbild",
    "it": "Tessuti lisci e confortevoli per un aspetto dignitoso",
    "pt": "Tecidos suaves e confortáveis que conferem uma aparência digna",
    "nl": "Gladde, comfortabele stoffen voor een waardige uitstraling",
    "ru": "Гладкие, приятные ткани, создающие достойный вид",
    "zh": "平滑舒适的面料，展现庄重得体的外观",
    "ja": "品位ある印象を与える、滑らかで着心地の良い生地",
    "hi": "सौम्य और आरामदायक कपड़े जो गरिमापूर्ण रूप प्रदान करते हैं",
}

LOCALIZED_TEXTURE_DEFAULT: dict[str, str] = {
    "en": "Balanced fabric textures creating a harmonious appearance",
    "he": "איזון מרקמים והרמוניה בין הבדים",
    "ar": "توازن في ملمس الأقمشة يمنح مظهراً متناسقاً",
    "es": "Equilibrio de texturas que crea una apariencia armoniosa",
    "fr": "Équilibre des textures créant une allure harmonieuse",
    "de": "Ausgewogene Stoffstrukturen für ein harmonisches Gesamtbild",
    "it": "Equilibrio di trame per un aspetto armonioso",
    "pt": "Equilíbrio de texturas criando uma aparência harmoniosa",
    "nl": "Harmonieus evenwicht tussen verschillende stoftexturen",
    "ru": "Гармоничное сочетание фактур тканей",
    "zh": "面料质感平衡，呈现和谐视觉效果",
    "ja": "調和の取れた生地の質感による美しい組み合わせ",
    "hi": "कपड़ों की बुनावट का संतुलित और सामंजस्यपूर्ण संयोजन",
}

LOCALIZED_PALETTE_MOURNING: dict[str, str] = {
    "en": "Dark navy, black, and charcoal gray",
    "he": "כחול כהה, שחור ואפור",
    "ar": "كحلي داكن، أسود ورمادي",
    "es": "Azul marino oscuro, negro y gris marengo",
    "fr": "Bleu marine foncé, noir et gris anthracite",
    "de": "Dunkles Marineblau, Schwarz und Anthrazitgrau",
    "it": "Blu navy scuro, nero e grigio antracite",
    "pt": "Azul-marinho escuro, preto e cinza-escuro",
    "nl": "Donker marineblauw, zwart en antracietgrijs",
    "ru": "Темно-синий, черный и темно-серый",
    "zh": "深藏青、黑色与炭灰色",
    "ja": "ダークネイビー、ブラック、チャコールグレー",
    "hi": "गहरा नेवी ब्लू, काला और चारकोल ग्रे",
}

LOCALIZED_DAYTIME_CONDOLENCE: dict[str, str] = {
    "en": "for daytime and the condolence visit",
    "he": "לשעות היום ולביקור המנחם",
    "ar": "لساعات النهار وزيارة التعزية",
    "es": "para el día y la visita de pésame",
    "fr": "pour la journée et la visite de condoléances",
    "de": "für den Tag und den Kondolenzbesuch",
    "it": "per il giorno e la visita di condoglianze",
    "pt": "para o dia e a visita de pêsames",
    "nl": "voor overdag en het condoleancebezoek",
    "ru": "для дневного времени и визита соболезнования",
    "zh": "适合白天及吊唁探访",
    "ja": "日中および弔問の訪問に最適です",
    "hi": "दिन के समय और शोक संवेदना यात्रा के लिए",
}

LOCALIZED_DIGNIFIED_INTRO: dict[str, str] = {
    "en": "The recommendation focuses on a dignified look,",
    "he": "ההמלצה מתמקדת במראה הולם ומכובד,",
    "ar": "تركز التوصية على مظهر لائق ومحترم،",
    "es": "La recomendación se centra en un aspecto digno,",
    "fr": "La recommandation mise sur une tenue digne,",
    "de": "Die Empfehlung zielt auf ein würdevolles Erscheinungsbild ab,",
    "it": "La raccomandazione punta su un aspetto dignitoso,",
    "pt": "A recomendação foca em uma aparência digna,",
    "nl": "Het advies richt zich op een waardige uitstraling,",
    "ru": "Рекомендация ориентирована на достойный образ,",
    "zh": "该建议聚焦于庄重得体的着装，",
    "ja": "品位ある装いに重点を置いた提案です、",
    "hi": "यह अनुशंसा गरिमापूर्ण रूप पर केंद्रित है,",
}

LOCALIZED_OUTFIT_NAME_MOURNING: dict[str, str] = {
    "he": "לבוש מכובד וצנוע לביקור אבלים",
    "en": "Dignified Shiva Condolence Attire",
    "ar": "زي لائق ومحترم للعزاء",
    "de": "Würdevolle Kondolenzkleidung",
    "es": "Atuendo digno para condolencias",
    "fr": "Tenue digne pour condoléances",
    "hi": "शोक सभा के लिए गरिमापूर्ण पोशाक",
    "it": "Abbigliamento dignitoso per condoglianze",
    "ja": "弔問・お悔やみのための端正な装い",
    "nl": "Waardige condoleancekleding",
    "pt": "Traje solene e digno para condolências",
    "ru": "Достойный наряд для соболезнований",
    "zh": "庄重得体的慰问吊唁着装",
}

LOCALIZED_OUTFIT_NAME_DEFAULT: dict[str, str] = {
    "he": "מראה מעוצב ומותאם אישית",
    "en": "Curated Designer Look",
    "ar": "إطلالة منسقة ומصممة خصيصاً",
    "de": "Kuratierter Designer-Look",
    "es": "Look de diseñador personalizado",
    "fr": "Look stylisé sur mesure",
    "hi": "क्यूरेटेड डिज़ाइनर लुक",
    "it": "Look curato dallo stilista",
    "ja": "キュレーションされたデザイナーズコーデ",
    "nl": "Gecureerde designerlook",
    "pt": "Visual curado pelo estilista",
    "ru": "Подобранный дизайнерский образ",
    "zh": "专属精选设计师造型",
}

LOCALIZED_OUTFIT_NAME_CHURCH: dict[str, str] = {
    "he": "מראה מכובד והולם לכנסייה",
    "en": "Dignified Church & Sanctuary Attire",
    "ar": "إطلالة محتشمة ولائقة للكنيسة",
    "de": "Würdevolles Kirchen- und Festoutfit",
    "es": "Atuendo respetuoso para iglesia",
    "fr": "Tenue digne et respectueuse pour l'église",
    "hi": "चर्च के लिए गरिमापूर्ण और शालीन परिधान",
    "it": "Abbigliamento sobrio e rispettoso per la chiesa",
    "ja": "教会・聖堂参拝のための品格ある装い",
    "nl": "Respectvolle kleding voor de kerk",
    "pt": "Traje solene e respeitoso para igreja",
    "ru": "Достойный наряд для посещения храма",
    "zh": "庄重得体的教堂礼拜着装",
}

GARBLED_TEXTURE_PATTERNS: tuple[str, ...] = (
    # Hebrew
    "מטוטל", "ורגליים", "רגליים", "ושרוול קצרים", "שרוול קצר ושרוול",
    "שרוול קצרים מודרנ", "שרוול קצרים", "מחוטים ימיומיים", "חורים ימיומיים",
    "אביזר מזדמן מודרני", "אביזר מזדמן", "תצוגה ותאורה", "תאורה מודרנית", "הזהב של תצוגה", "חורים",
    # English
    "pendulum", "and legs", "short buttons", "back belt", "short sleeves and short sleeves", "short sleeve and short sleeves",
    "modern short sleeves", "daily threads", "daily holes", "casual modern accessory", "modern casual accessory",
    "display and lighting", "golden display",
    # Arabic
    "بندول", "وأرجل", "أزرار قصيرة", "حزام ظهر", "إضاءة وعرض",
)

GARBLED_SILHOUETTE_PATTERNS: tuple[str, ...] = (
    # Hebrew
    "כפתורים קצרים", "חגורת גב", "רגליים", "שרוול קצרים מודרנ", "שרוול קצרים", "אביזר מזדמן", "תצוגה ותאורה",
    # English
    "short buttons", "back belt", "legs", "modern short sleeves", "casual accessory", "display and lighting",
    # Arabic
    "أزرار قصيرة", "حزام ظهر",
)


def _clean_shiva_grammar(text: str) -> str:
    """Fix awkward/literal Hebrew translations of sitting shiva / attending a shiva and machine translation gibberish."""
    if not text or not isinstance(text, str):
        return text
    # Fix garbled Hebrew phrases
    text = re.sub(r"להולך\s+בישיבה\s+שבעה", "לביקור שבעה", text)
    text = re.sub(r"להולך\s+בישיבה", "לביקור שבעה", text)
    text = re.sub(r"הולך\s+בישיבה\s+שבעה", "הולך לשבעה", text)
    text = re.sub(r"הולך\s+בישיבה", "הולך לשבעה", text)
    text = re.sub(r"לישיבה\s+שבעה", "לשבעה", text)
    text = re.sub(r"בישיבה\s+שבעה", "בשבעה", text)
    text = re.sub(r"יושב\s+בישיבה\s+שבעה", "יושב שבעה", text)
    text = re.sub(r"להולך\s+לשבעה", "לביקור שבעה", text)
    # Fix literal English phrasing
    text = re.sub(r"going\s+(?:in|to)\s+a\s+sitting\s+shiva", "attending a shiva", text, flags=re.IGNORECASE)

    # Typo fixes in Shiva / condolence context
    text = re.sub(r"\bלניקום\b", "לניחום", text)

    # Machine translation gibberish fixes ("שילוב מונה" -> "שילוב")
    text = re.sub(r"ה?שילוב\s+מונה\s+מושלם", "השילוב המושלם", text)
    text = re.sub(r"שילוב\s+מונה\s+הולם", "שילוב הולם ומכובד", text)
    text = re.sub(r"השילוב\s+מונה\s+הולם", "השילוב ההולם", text)
    text = re.sub(r"\bשילוב\s+מונה\b", "שילוב", text)
    text = re.sub(r"\bהשילוב\s+מונה\b", "השילוב", text)
    text = re.sub(r"\bמונה\s+מושלם\b", "מושלם", text)
    text = re.sub(r"\bמונה\s+הולם\b", "הולם", text)

    # Machine-translation fixes for footwear ("עקבות נוחות" -> "נעליים נוחות")
    text = re.sub(r"ועקבות\s+נוחות\b", "ונעליים נוחות", text)
    text = re.sub(r"\bעקבות\s+נוחות\b", "נעליים נוחות", text)
    text = re.sub(r"\bעקבות\b(?=\s+(?:נוחות|גמישות|אלגנטיות|מעור))", "נעליים", text)

    # Machine-translation fixes for centerpiece garment ("הגדולה היא" -> "הפריט המרכזי הוא")
    text = re.sub(r"\bהגדולה\s+היא\s+חולצת\b", "הפריט המרכזי הוא חולצת", text)
    text = re.sub(r"\bהגדולה\s+היא\b", "הפריט המרכזי הוא", text)

    # Do/Don't machine translation fixes ("מפוחיות פנים", "חולצות קצרים או מכנסיים")
    text = re.sub(r"מפוחיות\s+פנים", "כיסויי פנים", text)
    text = re.sub(r"מפוחית\s+פנים", "כיסוי פנים", text)
    text = re.sub(r"חולצות\s+קצרים\s+או\s+מכנסיים\b(?!\s*קצרים)", "חולצות קצרות או מכנסיים קצרים", text)
    text = re.sub(r"חולצות\s+קצרים", "חולצות קצרות", text)
    text = re.sub(r"חולצות\s+קצרות\s+או\s+מכנסיים\b(?!\s*קצרים)", "חולצות עם שרוול קצר או מכנסיים קצרים", text)
    text = re.sub(r"אין ללבוש מכנסיים\b(?!\s*קצרים)", "אין ללבוש מכנסיים קצרים", text)

    # Tone fixes for solemn context
    text = re.sub(r"מלבוש\s+יומיומי\s+מושלם|יומיומי\s+מושלם", "לבוש מאופק ומכובד", text)
    text = re.sub(r"\bמשובחת\b", "מכובדת", text)
    text = re.sub(r"\bמשובח\b", "מכובד", text)
    text = re.sub(r"\bמושלמת\b", "הולמת", text)
    text = re.sub(r"\bמושלם\b", "הולם", text)

    # Broken grammar & apron/vest corrections
    text = re.sub(r"חליפות\s+כחולה", "חולצה כחולה", text)
    text = re.sub(r"כחול\s+כחולה", "כחול", text)
    text = re.sub(r"סינר\s+אפור\s+בהי\b", "וסט אפור בהיר", text)
    text = re.sub(r"סינר\s+אפור\s+בהיר", "וסט אפור בהיר", text)
    text = re.sub(r"וסינר\b", "ו-וסט", text)
    text = re.sub(r"\bסינר\b", "וסט", text)

    # Corrupted multilingual tokens
    text = re.sub(r"\bמתא[a-zA-Z]+\b", "מתאים", text)
    text = re.sub(r"מתאistes", "מתאים", text)
    text = re.sub(r"התאוםשתאור", "וסט", text)
    text = re.sub(r"(?:ו?תאוםשת\s+האורודת|התאוםשת\s*האורודת|ו?תאוםשת|התאוםשת)", "וההתאמה", text)
    text = re.sub(r"\bשתאור\b", "מחויט", text)
    text = re.sub(r"\bправило\b", "כלל", text, flags=re.IGNORECASE)

    return text


def _clean_garment_title_for_lang(name: str, base_lang: str) -> str:
    """Localize known English titles and clean translation artifacts in garment names."""
    if not name or not isinstance(name, str):
        return ""
    clean = name
    if base_lang == "he":
        clean = re.sub(r"notched\s+lapel\s+tailored\s*\+?\s*vest", "וסט מחויט עם צווארון דש", clean, flags=re.IGNORECASE)
        clean = re.sub(r"\btailored\s*\+?\s*vest\b", "וסט מחויט", clean, flags=re.IGNORECASE)
        clean = re.sub(r"\bvest\b", "וסט", clean, flags=re.IGNORECASE)
        clean = re.sub(r"\bסינר\b", "וסט", clean)
        clean = re.sub(r"התאוםשתאור", "וסט", clean)
    return clean.strip()


def _format_garment_list_natural(items: list[dict[str, Any]], lang: str = "he") -> str:
    """Format actual authorized garments into a natural grammatically linked list."""
    base_lang = (lang or "en").lower().strip().split("-")[0].split("_")[0]
    garment_names = []
    for it in items:
        if not isinstance(it, dict):
            continue
        n = str(it.get("name") or it.get("title") or it.get("description") or "").strip()
        n = _clean_garment_title_for_lang(n, base_lang)
        if n and n not in garment_names:
            garment_names.append(n)

    if not garment_names:
        return ""
    if len(garment_names) == 1:
        return garment_names[0]

    if base_lang == "he":
        return ", ".join(garment_names[:-1]) + " ו-" + garment_names[-1]
    elif base_lang == "ar":
        return "، ".join(garment_names[:-1]) + " و" + garment_names[-1]
    elif base_lang == "zh":
        return "、".join(garment_names[:-1]) + "以及" + garment_names[-1]
    elif base_lang == "ja":
        return "、".join(garment_names)
    elif base_lang == "fr":
        return ", ".join(garment_names[:-1]) + " et " + garment_names[-1]
    elif base_lang == "es":
        return ", ".join(garment_names[:-1]) + " y " + garment_names[-1]
    elif base_lang == "de":
        return ", ".join(garment_names[:-1]) + " und " + garment_names[-1]
    elif base_lang == "it":
        return ", ".join(garment_names[:-1]) + " e " + garment_names[-1]
    elif base_lang == "pt":
        return ", ".join(garment_names[:-1]) + " e " + garment_names[-1]
    elif base_lang == "nl":
        return ", ".join(garment_names[:-1]) + " en " + garment_names[-1]
    elif base_lang == "ru":
        return ", ".join(garment_names[:-1]) + " и " + garment_names[-1]
    elif base_lang == "hi":
        return ", ".join(garment_names[:-1]) + " और " + garment_names[-1]
    else:
        return ", ".join(garment_names[:-1]) + ", and " + garment_names[-1]


def synchronize_outfit_why_narrative(
    rec: dict[str, Any],
    valid_items: list[dict[str, Any]],
    replacements_made: list[str],
    user_text: str,
    lang: str = "he",
) -> None:
    """Synchronize rec['why'] so it never hallucinates dropped items or false colors and accurately reflects authorized pieces."""
    is_mourning = _is_mourning_context(user_text)
    is_church = _is_church_context(user_text)
    base_lang = (lang or "he").lower().strip().split("-")[0].split("_")[0]
    why = str(rec.get("why") or "").strip()
    why = _clean_shiva_grammar(why)

    # Check for listing phrase after כולל / including / بما في ذلك
    has_including = bool(re.search(r"(?:כולל|הכולל|including|comprenant|incluyendo|bestehend aus|comprendente|inclusief|включая|包括|を含む|जिसमें शामिल)\s+", why, flags=re.IGNORECASE))

    # Check for dropped items mentioned in why that are not in valid_items
    valid_names_corpus = " ".join(
        str(it.get("name") or it.get("title") or it.get("description") or "").lower()
        for it in valid_items
        if isinstance(it, dict)
    )
    has_phantom_item = False
    if ("חולצת טי" in why or "חולצה לבנה" in why or "טי לבנה" in why) and ("חולצת טי" not in valid_names_corpus and "טי לבנה" not in valid_names_corpus):
        has_phantom_item = True
    if "t-shirt" in why.lower() and "t-shirt" not in valid_names_corpus and "tee" not in valid_names_corpus:
        has_phantom_item = True

    if is_mourning and "וקז'ואל" in why:
        why = re.sub(r"וקז'ואל", "ומכובד", why)
    if is_church and "וקז'ואל" in why:
        why = re.sub(r"וקז'ואל", "ומכובד", why)

    garments_str = _format_garment_list_natural(valid_items, lang=lang)

    if has_including:
        prefix = re.split(r"(?:כולל|הכולל|including|comprenant|incluyendo|bestehend aus|comprendente|inclusief|включая|包括|を含む|जिसमें शामिल)\s+", why, flags=re.IGNORECASE)[0].strip().rstrip(",.- ")
        if not prefix or len(prefix) < 5:
            if is_mourning and base_lang == "he":
                prefix = "לבוש מכובד וצנוע לביקור שבעה"
            elif is_church and base_lang == "he":
                prefix = "לבוש מכובד והולם לכנסייה"
            elif base_lang == "he":
                prefix = "מראה מעוצב ומותאם אישית"
            else:
                prefix = "Curated designer outfit"

        if base_lang == "he":
            rec["why"] = sanitize_stylist_text(f"{prefix}, הכולל {garments_str}.", lang=lang)
        elif base_lang == "ar":
            rec["why"] = sanitize_stylist_text(f"{prefix}، بما في ذلك {garments_str}.", lang=lang)
        elif base_lang == "zh":
            rec["why"] = sanitize_stylist_text(f"{prefix}，包括{garments_str}。", lang=lang)
        else:
            rec["why"] = sanitize_stylist_text(f"{prefix}, including {garments_str}.", lang=lang)
    elif has_phantom_item or replacements_made:
        if is_mourning and base_lang == "he":
            rec["why"] = sanitize_stylist_text(f"לבוש מכובד וצנוע לביקור שבעה, הכולל {garments_str}.", lang=lang)
        elif is_church and base_lang == "he":
            rec["why"] = sanitize_stylist_text(f"לבוש מכובד והולם לכנסייה, הכולל {garments_str}.", lang=lang)
        elif base_lang == "he":
            rec["why"] = sanitize_stylist_text(f"מראה מותאם אישית הכולל {garments_str}.", lang=lang)
        else:
            rec["why"] = sanitize_stylist_text(f"Curated outfit including {garments_str}.", lang=lang)
    else:
        rec["why"] = sanitize_stylist_text(why, lang=lang)


def sanitize_spoken_reply_and_notes(
    advice: dict[str, Any],
    user_text: str,
    lang: str = "he",
) -> None:
    """Clean hallucinations and garbled phrases from spoken reply and designer notes."""
    is_mourning = _is_mourning_context(user_text)
    is_church = _is_church_context(user_text)
    base_lang = (lang or "he").lower().strip().split("-")[0].split("_")[0]
    if base_lang not in LOCALIZED_SILHOUETTE_MOURNING:
        base_lang = "en"

    # 1. Spoken Reply
    spoken = advice.get("spoken_reply")
    if spoken and isinstance(spoken, str):
        spoken = _clean_shiva_grammar(spoken)
        # Scrub Ramadan hallucination in Shiva context
        if is_mourning:
            daytime_text = LOCALIZED_DAYTIME_CONDOLENCE.get(base_lang, LOCALIZED_DAYTIME_CONDOLENCE["en"])
            dignified_text = LOCALIZED_DIGNIFIED_INTRO.get(base_lang, LOCALIZED_DIGNIFIED_INTRO["en"])

            # Hebrew scrubbing
            spoken = re.sub(r"(?:לשעות\s+החמה\s+והרמדונות|והרמדונות|ברמדאן|רמדאן)", daytime_text, spoken)
            spoken = re.sub(r"הכוונה היא לביקור משפחה או,", dignified_text, spoken)
            spoken = re.sub(r"הו,\s*", "", spoken)

            # Scrub exhibition / lighting / casual accessory hallucinations in mourning context
            spoken = re.sub(r"(?:השילוב\s+הזהב\s+של\s+תצוגה\s+ותאורה|תצוגה\s+ותאורה|תאורה\s+מודרנית|הזהב\s+של\s+תצוגה)", "השילוב המכובד והמאופק", spoken)
            spoken = re.sub(r",?\s*(?:עם\s+)?אביזר\s+מזדמן\s+מודרני(?:\s+ותאורה\s+מודרנית)?", "", spoken)

            # English / Latin scrubbing
            spoken = re.sub(r"(?:for\s+the\s+hot\s+hours\s+and\s+ramadan|and\s+ramadan|in\s+ramadan|during\s+ramadan)", daytime_text, spoken, flags=re.IGNORECASE)
            spoken = re.sub(r"(?:the\s+intention\s+is\s+a\s+family\s+visit\s+or,|meaning\s+a\s+family\s+visit\s+or,)", dignified_text, spoken, flags=re.IGNORECASE)
            spoken = re.sub(r"^(?:oh,\s*|whoa,\s*)", "", spoken, flags=re.IGNORECASE)
            spoken = re.sub(r"(?:golden\s+combination\s+of\s+display\s+and\s+lighting|display\s+and\s+lighting|modern\s+lighting)", "dignified and understated combination", spoken, flags=re.IGNORECASE)
            spoken = re.sub(r",?\s*(?:with\s+a\s+)?modern\s+casual\s+accessory(?:\s+and\s+modern\s+lighting)?", "", spoken, flags=re.IGNORECASE)

        if is_church:
            # Clean casual or inappropriate words from spoken reply for church / mass
            spoken = re.sub(r"(?:חולצת\s+טי\s+עם\s+הדפס\s+נשר|חולצת\s+טי|טי\s+שירט|חולצת\s+טריקו|graphic\s+tee)", "חולצה מכופתרת אלגנטית", spoken)
            spoken = re.sub(r",?\s*(?:עם\s+)?כפתורים\s+כחולים\s+ושרוול\s+קצר", "", spoken)

        advice["spoken_reply"] = sanitize_stylist_text(spoken, lang=lang)

    # 2. Designer Notes & Outfit Names in Recommendations
    raw_recs = advice.get("outfit_recommendations", [])
    if isinstance(raw_recs, list):
        cleaned_recs = []
        for rec in raw_recs:
            if not isinstance(rec, dict):
                continue
            cleaned_recs.append(rec)

            # Clean and validate outfit name: NEVER copy single garment title
            rec_name = str(rec.get("name") or "").strip()
            rec_name = _clean_shiva_grammar(rec_name)
            if is_mourning:
                rec_name = re.sub(r"וקז'ואל|קז'ואל", "ומכובד", rec_name)
                rec_name = re.sub(r"להולך\s+לשבעה|להולך\s+בישיבה|להולך", "לביקור שבעה", rec_name)
                rec_name = re.sub(r"\bלניקום\b", "לניחום", rec_name)
                rec_name = re.sub(r"מלבוש\s+יומיומי\s+מושלם|יומיומי\s+מושלם|יומיומי", "מאופק ומכובד", rec_name)
                rec_name = re.sub(r"\bמשובחת\b", "מכובדת", rec_name)
                rec_name = re.sub(r"\bמשובח\b", "מכובד", rec_name)
                rec_name = re.sub(r"\bמושלמת\b", "הולמת", rec_name)
                rec_name = re.sub(r"\bמושלם\b", "הולם", rec_name)
            if is_church:
                rec_name = re.sub(r"וקז'ואל|קז'ואל", "ומכובד", rec_name)

            item_descriptions = [
                str(it.get("description") or it.get("title") or it.get("name") or "").strip().lower()
                for it in rec.get("items", [])
                if isinstance(it, dict)
            ]
            is_single_garment_name = (
                any(rec_name.lower() == idesc for idesc in item_descriptions if idesc) or
                re.match(r"^(?:חולצת|חולצה|מכנסי|מכנסיים|מעיל|ז'קט|ג'קט|שמלת|שמלה|נעלי|נעליים|shirt|pants|trousers|jacket|overcoat|dress|shoes)\b", rec_name, re.IGNORECASE) is not None
            )
            if not rec_name or is_single_garment_name:
                if is_mourning:
                    rec["name"] = LOCALIZED_OUTFIT_NAME_MOURNING.get(base_lang, LOCALIZED_OUTFIT_NAME_MOURNING["en"])
                elif is_church:
                    rec["name"] = LOCALIZED_OUTFIT_NAME_CHURCH.get(base_lang, LOCALIZED_OUTFIT_NAME_CHURCH["en"])
                else:
                    rec["name"] = LOCALIZED_OUTFIT_NAME_DEFAULT.get(base_lang, LOCALIZED_OUTFIT_NAME_DEFAULT["en"])
            else:
                rec["name"] = sanitize_stylist_text(rec_name, lang=lang)

            # Clean why narrative
            if rec.get("why"):
                rec["why"] = _clean_shiva_grammar(str(rec["why"]))
                rec["why"] = sanitize_stylist_text(rec["why"], lang=lang)

            notes = rec.get("designer_notes")
            if isinstance(notes, dict):
                # Color harmony
                ch = notes.get("color_harmony")
                if ch and isinstance(ch, str):
                    # Strip formulaic math tokens like "60-30-10"
                    ch = re.sub(r"^\s*(?:60[-/:]30[-/:]10|70[-/:]20[-/:]10|1:2(?:\s*Ratio)?|\d+[-/:]\d+[-/:]\d+)\s*[-—:]*\s*", "", ch, flags=re.IGNORECASE)
                    if is_mourning:
                        # Remove "אדום" / "red" / "זהב" from mourning palette
                        mourning_palette = LOCALIZED_PALETTE_MOURNING.get(base_lang, LOCALIZED_PALETTE_MOURNING["en"])
                        ch = re.sub(r"(?:כחול\s+אדום|אדום|red|זהב|gold)[, ]*", mourning_palette, ch, flags=re.IGNORECASE)
                    notes["color_harmony"] = sanitize_stylist_text(ch, lang=lang)

                # Texture balance
                tb = notes.get("texture_balance")
                if tb and isinstance(tb, str):
                    # Clean garbled repeating phrases
                    if any(w in tb.lower() for w in GARBLED_TEXTURE_PATTERNS):
                        if is_mourning:
                            tb = LOCALIZED_TEXTURE_MOURNING.get(base_lang, LOCALIZED_TEXTURE_MOURNING["en"])
                        else:
                            tb = LOCALIZED_TEXTURE_DEFAULT.get(base_lang, LOCALIZED_TEXTURE_DEFAULT["en"])
                    notes["texture_balance"] = sanitize_stylist_text(tb, lang=lang)

                # Silhouette
                sil = notes.get("silhouette")
                if sil and isinstance(sil, str):
                    # Clean nonsense like "כפתורים קצרים עם חגורת גב"
                    if any(w in sil.lower() for w in GARBLED_SILHOUETTE_PATTERNS):
                        if is_mourning:
                            sil = LOCALIZED_SILHOUETTE_MOURNING.get(base_lang, LOCALIZED_SILHOUETTE_MOURNING["en"])
                        else:
                            sil = LOCALIZED_SILHOUETTE_DEFAULT.get(base_lang, LOCALIZED_SILHOUETTE_DEFAULT["en"])
                    notes["silhouette"] = sanitize_stylist_text(sil, lang=lang)
            elif isinstance(notes, str) and notes.strip():
                clean_str = notes.strip()
                clean_str = re.sub(r"^\s*(?:60[-/:]30[-/:]10|70[-/:]20[-/:]10|1:2(?:\s*Ratio)?|\d+[-/:]\d+[-/:]\d+)\s*[-—:]*\s*", "", clean_str, flags=re.IGNORECASE)
                if any(w in clean_str.lower() for w in GARBLED_TEXTURE_PATTERNS + GARBLED_SILHOUETTE_PATTERNS):
                    clean_str = (
                        LOCALIZED_SILHOUETTE_MOURNING.get(base_lang, LOCALIZED_SILHOUETTE_MOURNING["en"])
                        if is_mourning
                        else LOCALIZED_SILHOUETTE_DEFAULT.get(base_lang, LOCALIZED_SILHOUETTE_DEFAULT["en"])
                    )
                rec["designer_notes"] = {"silhouette": sanitize_stylist_text(clean_str, lang=lang)}
        advice["outfit_recommendations"] = cleaned_recs

        # Do/Don't sanitization
        if isinstance(advice.get("do_dont"), list):
            cleaned_dd = []
            for dd in advice["do_dont"]:
                if not isinstance(dd, str):
                    continue
                # Prune nonsense entries like "wearing food"
                if any(w in dd.lower() for w in (
                    "מזון", "אוכל", "food", "طعام", "comida", "nourriture", "essen", "cibo", "eten", "еда", "食物", "食べ物", "भोजन"
                )):
                    continue

                # Fix duplicate words like "אין ללבוש ללבוש"
                dd_clean = re.sub(r"\b(ללבוש)\s+\1\b", r"\1", dd)
                dd_clean = re.sub(r"^(אין ללבוש)\s+ללבוש\s+", r"אין ללבוש ", dd_clean)
                dd_clean = re.sub(r"^(מומלץ ללבוש)\s+ללבוש\s+", r"מומלץ ללבוש ", dd_clean)
                dd_clean = re.sub(r"^(do not wear)\s+wear\s+", r"Do not wear ", dd_clean, flags=re.IGNORECASE)
                dd_clean = re.sub(r"^(do wear)\s+wear\s+", r"Do wear ", dd_clean, flags=re.IGNORECASE)
                cleaned_dd.append(sanitize_stylist_text(dd_clean, lang=lang))
            advice["do_dont"] = cleaned_dd


async def evaluate_and_authorize_outfit(
    *,
    user_text: str,
    advice_payload: dict[str, Any],
    all_closet_items: list[dict[str, Any]],
    user_profile: dict[str, Any] | None = None,
    axioms: list[Any] | None = None,
    recent_item_ids: set[str] | list[str] | None = None,
) -> dict[str, Any]:
    """Execute complete Quality Assurance check on stylist outfit recommendations.

    Analyzes overall look against user prompt, replaces inappropriate or unmapped garments,
    validates against negative constraints of retrieved RAG axioms, enforces wardrobe rotation,
    and authorizes the verified look.
    """
    if not isinstance(advice_payload, dict):
        return advice_payload

    if advice_payload.get("qa_authorized") is True:
        return advice_payload

    if axioms is None:
        try:
            from app.services.fashion_rules_rag import retrieve_fashion_axioms
            axioms = retrieve_fashion_axioms(
                user_profile=user_profile,
                user_text=user_text,
                closet_summary=all_closet_items,
                top_k=4,
            )
        except Exception as exc:
            logger.warning("Could not retrieve fashion axioms for QA evaluation: %s", exc)
            axioms = []

    user_gender = (user_profile or {}).get("sex") or (user_profile or {}).get("gender")
    lang_pref = (user_profile or {}).get("preferred_language")
    if lang_pref:
        lang = lang_pref.lower().strip()
    elif re.search(r"[\u0590-\u05fe]", user_text):
        lang = "he"
    elif re.search(r"[\u0600-\u06ff]", user_text):
        lang = "ar"
    elif re.search(r"[\u0400-\u04ff]", user_text):
        lang = "ru"
    elif re.search(r"[\u4e00-\u9fff]", user_text):
        lang = "zh"
    elif re.search(r"[\u3040-\u30ff]", user_text):
        lang = "ja"
    elif re.search(r"[\u0900-\u097f]", user_text):
        lang = "hi"
    else:
        lang = "en"

    base_lang = (lang or "en").lower().strip().split("-")[0].split("_")[0]

    # Resolve items suggested recently in this session to enforce wardrobe rotation
    recent_set: set[str] = {str(x) for x in recent_item_ids} if recent_item_ids else set()
    if not recent_set and isinstance(user_profile, dict):
        conv_hist = user_profile.get("conversation_history") or []
        for turn in conv_hist:
            payload = turn.get("payload") or {}
            for rec in payload.get("outfit_recommendations") or []:
                for itm in rec.get("items") or []:
                    cid = itm.get("closet_item_id")
                    if cid:
                        recent_set.add(str(cid))
    is_mourning = _is_mourning_context(user_text)

    # Build lookup map for user's full closet
    closet_map: dict[str, dict[str, Any]] = {}
    for item in all_closet_items:
        cid = str(item.get("id") or item.get("_id") or "")
        if cid:
            closet_map[cid] = item

    raw_recs = advice_payload.get("outfit_recommendations") or []
    if not isinstance(raw_recs, list):
        raw_recs = []
    recommendations = [r for r in raw_recs if isinstance(r, dict)]
    advice_payload["outfit_recommendations"] = recommendations
    used_item_ids: set[str] = set()

    # Extract dynamic negative constraints from generated advice do_dont list
    do_dont_list = advice_payload.get("do_dont") or []
    do_dont_negative_rules: list[str] = []
    if isinstance(do_dont_list, list):
        for dd in do_dont_list:
            if not isinstance(dd, str):
                continue
            dd_lower = dd.lower()
            if any(prefix in dd_lower for prefix in (
                "avoid", "do not", "don't", "never wear", "steer clear", "not appropriate", "forbidden",
                "אין ללבוש", "להימנע", "לא ללבוש", "אסור ללבוש", "אל תלבש", "לא מומלץ",
                "لا ترتد", "تجنب", "إياك", "لا ينبغي", "ممنوع",
                "evita", "no uses", "ne pas porter", "évitez", "vermeide", "trage keine", "nicht tragen",
                "non indossare", "não use", "избегайте", "не надевайте", "не носите", "不要穿", "穿かない", "न पहनें"
            )):
                do_dont_negative_rules.append(dd)

    for rec_idx, rec in enumerate(recommendations):

        items = rec.get("items") or []
        roles_present = set()
        replacements_made: list[str] = []

        # 1. Inspect existing items in the outfit
        valid_items = []
        for it in items:
            if not isinstance(it, dict):
                continue

            role = str(it.get("role") or "").lower().strip()
            allowed_cats = ROLE_ALLOWED_CATEGORIES.get(role, set())
            cid = str(it.get("closet_item_id") or "")

            item_data = closet_map.get(cid)
            is_valid_item = bool(item_data)

            # Check for semantic role mismatch (e.g. pants mistakenly tagged as top)
            if is_valid_item and item_data:
                mismatch_err = check_garment_role_mismatch(item_data, role)
                if mismatch_err:
                    logger.warning("QA: Semantic role conflict: %s (cid=%s)", mismatch_err, cid)
                    is_valid_item = False
                    item_data = None
                else:
                    cat = norm_category(item_data.get("category"))
                    if allowed_cats and cat not in allowed_cats and str(item_data.get("category") or "").lower() not in allowed_cats:
                        logger.warning("QA: Mismatch role=%s vs item_cat=%s for cid=%s", role, cat, cid)
                        is_valid_item = False
                        item_data = None

            # Also check item descriptor itself if not in closet_map
            if not is_valid_item and not item_data:
                it_pseudo = {"title": it.get("name") or it.get("description") or "", "name": it.get("name") or ""}
                if check_garment_role_mismatch(it_pseudo, role):
                    logger.warning("QA: Raw item description mismatch for role=%s: %s", role, it_pseudo["title"])

            # Check for gender conflict with user profile
            if is_valid_item and item_data and user_gender:
                gen_norm = str(user_gender).lower().strip()
                if gen_norm in ("male", "man", "men", "גבר"):
                    from app.services.fashion_rules_rag import FEMALE_GARMENT_RE
                    it_g = str(item_data.get("gender") or item_data.get("target_gender") or "").lower()
                    cat = norm_category(item_data.get("category"))
                    all_text_check = f"{item_data.get('title') or ''} {item_data.get('name') or ''} {item_data.get('sub_category') or ''}".lower()
                    if (
                        it_g in ("female", "women", "אישה", "נשים")
                        or cat in ("dress", "skirt")
                        or bool(FEMALE_GARMENT_RE.search(all_text_check))
                        or any(w in all_text_check for w in ("skirt", "חצאית", "mini skirt", "חצאית מיני", "bolero", "heels", "עקבים"))
                    ):
                        logger.warning("QA: Gender conflict: female garment '%s' for male user in role %s", item_data.get("title"), role)
                        is_valid_item = False
                        item_data = None
                elif gen_norm in ("female", "woman", "women", "אישה"):
                    it_g = str(item_data.get("gender") or item_data.get("target_gender") or "").lower()
                    all_text_check = f"{item_data.get('title') or ''} {item_data.get('name') or ''} {item_data.get('sub_category') or ''}".lower()
                    if it_g in ("male", "men", "גבר", "גברים") and any(w in all_text_check for w in ("men's", "mens", "גברים", "גבר", "boxers", "בוקסר", "תחתונים לגבר", "trunks")):
                        logger.warning("QA: Gender conflict: men's garment '%s' for female user in role %s", item_data.get("title"), role)
                        is_valid_item = False
                        item_data = None

            # Check for etiquette violations (e.g. mourning etiquette)
            if is_valid_item and is_mourning and item_data:
                if is_item_mourning_inappropriate(item_data, role=role):
                    logger.warning("QA: Mourning violation in %s: %s", role, item_data.get("title"))
                    is_valid_item = False
                    item_data = None

            # Check for negative constraint violations across all retrieved active axioms
            if is_valid_item and item_data and axioms:
                for ax in axioms:
                    is_comp, ax_reason = validate_garment_against_negative_constraints(
                        item_data, ax, role=role, user_gender=user_gender
                    )
                    if not is_comp:
                        logger.warning(
                            "QA: Axiom negative constraint violation in %s: %s (Rule %s: %s)",
                            role, item_data.get("title"), getattr(ax, "id", None) or (ax.get("id") if isinstance(ax, dict) else ""), ax_reason
                        )
                        is_valid_item = False
                        item_data = None
                        break

            # Check against generated advice DO/DON'T guidance
            if is_valid_item and item_data and do_dont_negative_rules:
                for dd in do_dont_negative_rules:
                    dd_low = dd.lower()
                    # 1. Shorts / beachwear restriction
                    if any(w in dd_low for w in ("shorts", "beachwear", "מכנסיים קצרים", "בגדי ים", "בגד ים", "شورט", "سروال قصير", "bermuda", "kurze hose", "pantalon corto", "pantacourt")):
                        if is_shorts_garment(item_data, role=role):
                            logger.warning("QA: Item '%s' violates DO/DON'T restriction: %s", item_data.get("title"), dd)
                            is_valid_item = False
                            item_data = None
                            break
                    # 2. Animal print / graphic print restriction
                    if any(w in dd_low for w in ("animal", "leopard", "cheetah", "zebra", "eagle", "graphic", "print", "tees", "מנומר", "הדפס", "חיות", "נשר", "ציור", "نقشة نمر", "غرافيك", "tierprint")):
                        if has_animal_or_distracted_print(item_data) or is_distressed_or_graphic(item_data):
                            logger.warning("QA: Item '%s' violates DO/DON'T restriction: %s", item_data.get("title"), dd)
                            is_valid_item = False
                            item_data = None
                            break
                    # 3. Revealing / sleeveless / crop top / mini skirt restriction
                    if any(w in dd_low for w in ("sleeveless", "tank", "crop top", "mini skirt", "גופייה", "גופיה", "חולצת בטן", "חצאית מיני", "بدון أكمام", "sin mangas")):
                        if is_revealing_or_beachwear(item_data, role=role):
                            logger.warning("QA: Item '%s' violates DO/DON'T restriction: %s", item_data.get("title"), dd)
                            is_valid_item = False
                            item_data = None
                            break
                    # 4. Flip-flops / slides restriction
                    if any(w in dd_low for w in ("flip-flop", "slides", "sandals", "כפכפים", "כפכפי ים", "סנדלים", "شبشب", "chanclas")):
                        all_text_check = f"{item_data.get('title') or ''} {item_data.get('name') or ''} {item_data.get('sub_category') or ''}".lower()
                        if any(w in all_text_check for w in ("flip-flop", "flip flop", "slides", "כפכפים", "כפכפי ים")):
                            logger.warning("QA: Item '%s' violates DO/DON'T restriction: %s", item_data.get("title"), dd)
                            is_valid_item = False
                            item_data = None
                            break
                    # 5. Short-sleeve restriction
                    if any(w in dd_low for w in (
                        "short-sleeve", "short sleeve", "short sleeves", "shortsleeve",
                        "שרוול קצר", "שרוולים קצרים", "חולצות קצרות", "חולצה קצרה",
                        "أكمام قصيرة", "كم قصير", "نصف كم",
                        "manga corta", "mangas cortas",
                        "manches courtes", "manche courte",
                        "kurzarm", "kurzärmelig", "kurze ärmel",
                        "maniche corte", "manica corta",
                        "mangas curtas", "manga curta",
                        "korte mouwen", "korte mouw",
                        "короткий рукав", "короткими рукавами",
                        "短袖", "半袖", "छोटी आस्तीन"
                    )):
                        if is_short_sleeve_top(item_data):
                            logger.warning("QA: Item '%s' violates DO/DON'T short-sleeve restriction: %s", item_data.get("title"), dd)
                            is_valid_item = False
                            item_data = None
                            break
                    # 6. Color restrictions: "avoid black" / "do not wear black" / "אין ללבוש שחור"
                    for col in ("black", "white", "red", "gold", "yellow", "orange"):
                        col_terms = COLOR_SYNONYMS.get(col, {col})
                        if any(f"avoid {col}" in dd_low or f"do not wear {col}" in dd_low or f"אין ללבוש {s}" in dd_low or f"להימנע מ{s}" in dd_low for s in col_terms):
                            if _item_has_color(item_data, col):
                                logger.warning("QA: Item '%s' has forbidden color '%s' per DO/DON'T: %s", item_data.get("title"), col, dd)
                                is_valid_item = False
                                item_data = None
                                break

            # If invalid or unmapped, attempt to find best replacement in closet metadata
            if not is_valid_item:
                # If it's a bizarre non-garment (e.g. apron / סינר), drop or replace
                desc = str(it.get("description") or it.get("name") or "").lower()
                if "סינר" in desc or "apron" in desc or "bear" in desc or "דובון" in desc:
                    if role in ("outerwear", "accessory"):
                        replacements_made.append(f"Pruned inappropriate {role} item '{desc}'")
                        continue

                replacement = find_best_garment_replacement(
                    role=role,
                    all_closet_items=all_closet_items,
                    user_text=user_text,
                    user_gender=user_gender,
                    exclude_item_ids=used_item_ids,
                    axioms=axioms,
                    recent_item_ids=recent_set,
                    do_dont_negative_rules=do_dont_negative_rules,
                )
                if replacement:
                    new_id = str(replacement.get("id") or replacement.get("_id"))
                    it["closet_item_id"] = new_id
                    it["name"] = replacement.get("title") or replacement.get("name")
                    it["description"] = replacement.get("title") or replacement.get("name")
                    it["image_url"] = replacement.get("image_url") or replacement.get("clean_image_url")
                    used_item_ids.add(new_id)
                    roles_present.add(role)
                    valid_items.append(it)
                    replacements_made.append(f"Replaced {role} with closet item '{it['name']}'")
                    continue
                else:
                    # Could not find replacement; drop invalid item so it is not displayed!
                    replacements_made.append(f"Dropped invalid/misclassified item from '{role}'")
                    continue

            # Item is valid and compliant!
            # Attribute Grounding: ensure item description does not hallucinate false colors that contradict closet item
            if item_data:
                item_title = item_data.get("title") or item_data.get("name") or ""
                raw_desc = str(it.get("description") or "")
                item_color_names = []
                for c in (item_data.get("colors") or []):
                    if isinstance(c, dict) and c.get("name"):
                        item_color_names.append(str(c["name"]).lower())
                    elif isinstance(c, str):
                        item_color_names.append(c.lower())
                if item_color_names:
                    # If item is red, but description falsely hallucinates blue
                    if any(c in ("red", "אדום") for c in item_color_names) and not any(c in ("blue", "כחול") for c in item_color_names):
                        if any(w in raw_desc.lower() for w in ("blue", "כחול", "כחולה", "כחולים")):
                            it["description"] = item_title
                            it["name"] = item_title
                if not it.get("description") or "מונה" in str(it.get("description") or ""):
                    it["description"] = item_title or str(it.get("description") or "")

            used_item_ids.add(cid)
            roles_present.add(role)
            valid_items.append(it)

        def get_item_score(it_entry: dict[str, Any]) -> int:
            cid = str(it_entry.get("closet_item_id") or "")
            item_data = closet_map.get(cid, it_entry)
            return calculate_garment_style_score(item_data, user_text, user_gender=user_gender)

        # -------------------------------------------------------------------------
        # Category Conflict Resolution: Apply across ALL 5 categories
        # 1) Outwear
        # 2) Full body (Dress)
        # 3) Top
        # 4) Footwear
        # 5) Accessories (sub-slots: headwear, glasses, belt, bag)
        # -------------------------------------------------------------------------

        # A. MULTI-BOTTOM CONFLICT & INTRUDER RESOLUTION
        pruned_valid = []
        for it in valid_items:
            r = str(it.get("role") or "").lower()
            text_desc = f"{it.get('name') or ''} {it.get('description') or ''}".lower()
            is_bottom_garment = bool(RE_BOTTOM_WORDS.search(text_desc)) and not bool(RE_TOP_WORDS.search(text_desc))
            if is_bottom_garment and r != "bottom":
                logger.warning("QA: Dropping intruder bottom '%s' from role '%s'", it.get("name"), r)
                replacements_made.append(f"Dropped misclassified bottom '{it.get('name')}' from role '{r}'")
                roles_present.discard(r)
                continue
            pruned_valid.append(it)
        valid_items = pruned_valid

        bottoms_in_outfit = [it for it in valid_items if str(it.get("role") or "").lower() == "bottom"]
        if len(bottoms_in_outfit) > 1:
            bottoms_in_outfit.sort(key=get_item_score, reverse=True)
            best_bottom = bottoms_in_outfit[0]
            logger.warning("QA: Detected %d bottoms. Keeping best '%s' and dropping duplicates.", len(bottoms_in_outfit), best_bottom.get("name"))
            valid_items = [it for it in valid_items if str(it.get("role") or "").lower() != "bottom"] + [best_bottom]
            replacements_made.append(f"Pruned duplicate bottoms, kept best '{best_bottom.get('name')}'")

        # B. MULTI-TOP CONFLICT & INTRUDER RESOLUTION
        pruned_valid = []
        for it in valid_items:
            r = str(it.get("role") or "").lower()
            text_desc = f"{it.get('name') or ''} {it.get('description') or ''}".lower()
            is_top_garment = bool(RE_TOP_WORDS.search(text_desc)) and not bool(RE_BOTTOM_WORDS.search(text_desc)) and not bool(RE_OUTERWEAR_WORDS.search(text_desc))
            if is_top_garment and r not in ("top", "outerwear"):
                logger.warning("QA: Dropping intruder top '%s' from role '%s'", it.get("name"), r)
                replacements_made.append(f"Dropped misclassified top '{it.get('name')}' from role '{r}'")
                roles_present.discard(r)
                continue
            pruned_valid.append(it)
        valid_items = pruned_valid

        tops_in_outfit = [it for it in valid_items if str(it.get("role") or "").lower() == "top"]
        if len(tops_in_outfit) > 1:
            tops_in_outfit.sort(key=get_item_score, reverse=True)
            best_top = tops_in_outfit[0]
            logger.warning("QA: Detected %d tops. Keeping best '%s' and dropping duplicates.", len(tops_in_outfit), best_top.get("name"))
            valid_items = [it for it in valid_items if str(it.get("role") or "").lower() != "top"] + [best_top]
            replacements_made.append(f"Pruned duplicate tops, kept best '{best_top.get('name')}'")

        # C. MULTI-FOOTWEAR CONFLICT & INTRUDER RESOLUTION
        pruned_valid = []
        for it in valid_items:
            r = str(it.get("role") or "").lower()
            text_desc = f"{it.get('name') or ''} {it.get('description') or ''}".lower()
            is_shoe_garment = bool(RE_SHOES_WORDS.search(text_desc))
            if is_shoe_garment and r not in ("shoes", "footwear"):
                logger.warning("QA: Dropping intruder shoes '%s' from role '%s'", it.get("name"), r)
                replacements_made.append(f"Dropped misclassified footwear '{it.get('name')}' from role '{r}'")
                roles_present.discard(r)
                continue
            pruned_valid.append(it)
        valid_items = pruned_valid

        shoes_in_outfit = [it for it in valid_items if str(it.get("role") or "").lower() in ("shoes", "footwear")]
        if len(shoes_in_outfit) > 1:
            shoes_in_outfit.sort(key=get_item_score, reverse=True)
            best_shoe = shoes_in_outfit[0]
            logger.warning("QA: Detected %d footwear items. Keeping best '%s' and dropping duplicates.", len(shoes_in_outfit), best_shoe.get("name"))
            valid_items = [it for it in valid_items if str(it.get("role") or "").lower() not in ("shoes", "footwear")] + [best_shoe]
            replacements_made.append(f"Pruned duplicate shoes, kept best '{best_shoe.get('name')}'")

        # D. MULTI-OUTERWEAR CONFLICT & INTRUDER RESOLUTION
        pruned_valid = []
        for it in valid_items:
            r = str(it.get("role") or "").lower()
            text_desc = f"{it.get('name') or ''} {it.get('description') or ''}".lower()
            is_outerwear_garment = bool(RE_OUTERWEAR_WORDS.search(text_desc)) and not bool(RE_BOTTOM_WORDS.search(text_desc))
            if is_outerwear_garment and r not in ("outerwear", "jacket", "top"):
                logger.warning("QA: Dropping intruder outerwear '%s' from role '%s'", it.get("name"), r)
                replacements_made.append(f"Dropped misclassified outerwear '{it.get('name')}' from role '{r}'")
                roles_present.discard(r)
                continue
            pruned_valid.append(it)
        valid_items = pruned_valid

        outerwear_in_outfit = [it for it in valid_items if str(it.get("role") or "").lower() in ("outerwear", "jacket")]
        if len(outerwear_in_outfit) > 1:
            outerwear_in_outfit.sort(key=get_item_score, reverse=True)
            best_outerwear = outerwear_in_outfit[0]
            logger.warning("QA: Detected %d outerwear items. Keeping best '%s' and dropping duplicates.", len(outerwear_in_outfit), best_outerwear.get("name"))
            valid_items = [it for it in valid_items if str(it.get("role") or "").lower() not in ("outerwear", "jacket")] + [best_outerwear]
            replacements_made.append(f"Pruned duplicate outerwear, kept best '{best_outerwear.get('name')}'")

        # E. FULL BODY (DRESS) VS SEPARATES RESOLUTION
        dresses_in_outfit = [
            it for it in valid_items
            if str(it.get("role") or "").lower() in ("dress", "full_body") or bool(RE_DRESS_WORDS.search(f"{it.get('name') or ''} {it.get('description') or ''}".lower()))
        ]
        if len(dresses_in_outfit) > 1:
            dresses_in_outfit.sort(key=get_item_score, reverse=True)
            best_dress = dresses_in_outfit[0]
            logger.warning("QA: Detected %d dresses. Keeping best '%s'.", len(dresses_in_outfit), best_dress.get("name"))
            valid_items = [it for it in valid_items if it not in dresses_in_outfit] + [best_dress]
            replacements_made.append(f"Pruned duplicate dresses, kept best '{best_dress.get('name')}'")
            dresses_in_outfit = [best_dress]

        if dresses_in_outfit:
            clashing_bottoms = [it for it in valid_items if str(it.get("role") or "").lower() == "bottom"]
            if clashing_bottoms:
                for cb in clashing_bottoms:
                    logger.warning("QA: Dropping colliding bottom '%s' because full-body dress is active", cb.get("name"))
                    replacements_made.append(f"Dropped colliding bottom '{cb.get('name')}' for full-body dress")
                    roles_present.discard("bottom")
                valid_items = [it for it in valid_items if str(it.get("role") or "").lower() != "bottom"]

        # F. ACCESSORY SUB-SLOT RESOLUTION
        pruned_valid = []
        for it in valid_items:
            r = str(it.get("role") or "").lower()
            text_desc = f"{it.get('name') or ''} {it.get('description') or ''}".lower()
            is_acc_garment = (
                bool(RE_ACCESSORY_WORDS.search(text_desc))
                and not bool(RE_TOP_WORDS.search(text_desc))
                and not bool(RE_BOTTOM_WORDS.search(text_desc))
                and not bool(RE_OUTERWEAR_WORDS.search(text_desc))
            )
            if is_acc_garment and r in ("top", "bottom", "shoes", "footwear", "outerwear", "dress"):
                logger.warning("QA: Dropping intruder accessory '%s' from clothing role '%s'", it.get("name"), r)
                replacements_made.append(f"Dropped misclassified accessory '{it.get('name')}' from role '{r}'")
                roles_present.discard(r)
                continue
            pruned_valid.append(it)
        valid_items = pruned_valid

        for sub_slot_name, sub_regex in (
            ("headwear", RE_HEADWEAR_WORDS),
            ("belt", RE_BELT_WORDS),
            ("glasses", RE_GLASSES_WORDS),
            ("bag", RE_BAG_WORDS),
        ):
            matching_sub = [
                it for it in valid_items
                if str(it.get("role") or "").lower() == sub_slot_name or bool(sub_regex.search(f"{it.get('name') or ''} {it.get('description') or ''}".lower()))
            ]
            if len(matching_sub) > 1:
                matching_sub.sort(key=get_item_score, reverse=True)
                best_sub = matching_sub[0]
                dropped_subs = matching_sub[1:]
                logger.warning("QA: Detected %d %s items. Keeping best '%s' and dropping duplicates.", len(matching_sub), sub_slot_name, best_sub.get("name"))
                valid_items = [it for it in valid_items if it not in dropped_subs]
                replacements_made.append(f"Pruned duplicate {sub_slot_name}, kept best '{best_sub.get('name')}'")


        # 3. Completeness Check: Ensure essential roles exist (top, bottom, shoes)
        for essential_role in ("top", "bottom", "shoes"):
            if essential_role not in roles_present and "dress" not in roles_present:
                logger.info("QA: Missing essential role '%s' in outfit %d. Searching closet...", essential_role, rec_idx)
                replacement = find_best_garment_replacement(
                    role=essential_role,
                    all_closet_items=all_closet_items,
                    user_text=user_text,
                    user_gender=user_gender,
                    exclude_item_ids=used_item_ids,
                    axioms=axioms,
                    recent_item_ids=recent_set,
                    do_dont_negative_rules=do_dont_negative_rules,
                )
                if replacement:
                    new_id = str(replacement.get("id") or replacement.get("_id"))
                    new_name = replacement.get("title") or replacement.get("name")
                    injected_item = {
                        "role": essential_role,
                        "name": new_name,
                        "description": new_name,
                        "closet_item_id": new_id,
                        "image_url": replacement.get("image_url") or replacement.get("clean_image_url"),
                    }
                    valid_items.append(injected_item)
                    used_item_ids.add(new_id)
                    roles_present.add(essential_role)
                    replacements_made.append(f"Added missing {essential_role}: '{new_name}'")

        # Sanitize item names and descriptions for target language
        for it in valid_items:
            if isinstance(it, dict):
                for key in ("name", "description"):
                    if it.get(key) and isinstance(it[key], str):
                        it[key] = _clean_garment_title_for_lang(it[key], base_lang)
                        it[key] = sanitize_stylist_text(it[key], lang=lang)

        rec["items"] = valid_items

        # Synchronize rec['why'] narrative with valid_items so it never hallucinates dropped garments or false colors
        synchronize_outfit_why_narrative(
            rec=rec,
            valid_items=valid_items,
            replacements_made=replacements_made,
            user_text=user_text,
            lang=lang,
        )

        # 4. Authorization Decision
        rec["qa_status"] = "authorized"
        rec["qa_authorized"] = True
        if replacements_made:
            rec["qa_notes"] = "; ".join(replacements_made)
            logger.info("QA Outfit %d authorized with adjustments: %s", rec_idx, rec["qa_notes"])
        else:
            rec["qa_notes"] = "Outfit verified and authorized against prompt criteria."
            logger.info("QA Outfit %d authorized cleanly.", rec_idx)

    # 4. Text & Narrative Validation
    sanitize_spoken_reply_and_notes(advice_payload, user_text=user_text, lang=lang)
    advice_payload["qa_authorized"] = True

    # 5. Cultural Audit Trail
    active_neg_rules = [
        getattr(r, "id", None) or (r.get("id") if isinstance(r, dict) else "")
        for r in (axioms or [])
        if getattr(r, "negative_constraint", None) or (isinstance(r, dict) and r.get("negative_constraint"))
    ]
    all_replacements = [
        note for rec in recommendations for note in (str(rec.get("qa_notes") or "").split("; "))
        if note and "Outfit verified" not in note
    ]
    advice_payload["cultural_audit"] = {
        "status": "authorized",
        "active_axioms": [r for r in active_neg_rules if r],
        "qa_replacements": all_replacements,
    }

    # 6. Filter Shopping Suggestions against user's closet inventory
    raw_shopping = advice_payload.get("shopping_suggestions") or []
    if isinstance(raw_shopping, list) and raw_shopping:
        advice_payload["shopping_suggestions"] = filter_shopping_suggestions_against_closet(
            raw_shopping,
            all_closet_items=all_closet_items,
            outfit_recommendations=advice_payload.get("outfit_recommendations"),
            lang=lang,
        )

    return advice_payload


SHOPPING_COLOR_FAMILIES: dict[str, set[str]] = {
    "white": {"white", "off-white", "cream", "ivory", "לבן", "לבנה", "שמנת", "קרם", "أبيض", "بيضاء", "كريمي", "blanc", "blanche", "blanco", "blanca", "weiß", "weiss", "bianco", "bianca", "branco", "branca", "wit", "белый", "белая", "白", "白色", "सफेद"},
    "black": {"black", "שחור", "שחורה", "أسود", "سوداء", "noir", "noire", "negro", "negra", "schwarz", "nero", "nera", "preto", "preta", "zwart", "черный", "черная", "黑", "黑色", "काला"},
    "grey": {"grey", "gray", "charcoal", "heather", "slate", "אפור", "אפורה", "צ'רקול", "ערפילי", "رمادي", "رمادية", "شاركول", "gris", "grau", "grigio", "cinza", "grijs", "серый", "серая", "灰", "灰色", "चारकोल", "स्लेटी"},
    "blue": {"blue", "navy", "indigo", "כחול", "כחולה", "נייבי", "אינדיגו", "أزرق", "زرقاء", "كحلي", "bleu", "bleue", "marine", "azul", "marino", "blau", "marineblau", "blu", "azur", "blauw", "синий", "синяя", "голубой", "голубая", "蓝", "蓝色", "藏青", "青", "深蓝", "नीला"},
    "brown": {"brown", "tan", "beige", "camel", "khaki", "חום", "חומה", "בז'", "חאקי", "קאמל", "בז", "בייג'", "בייג", "בני", "بني", "بنية", "بيج", "خاكي", "marron", "beige", "marrón", "braun", "marrone", "castanho", "bruin", "коричневый", "бежевый", "хаки", "棕", "褐色", "卡其", "米色", "茶色", "ベージュ", "カーキ", "भूरा"},
    "red": {"red", "burgundy", "maroon", "crimson", "אדום", "אדומה", "בורדו", "أحمر", "حمراء", "بورغندي", "rouge", "bordeaux", "rojo", "burdeos", "rot", "rosso", "vermelho", "rood", "красный", "бордовый", "红", "红色", "酒红", "赤", "लाल"},
    "green": {"green", "olive", "sage", "ירוק", "ירוקה", "זית", "أخضر", "خضراء", "زيتوني", "vert", "verde", "grün", "groen", "зеленый", "зеленая", "оливковый", "绿", "绿色", "橄榄绿", "緑", "हरा"},
    "yellow": {"yellow", "mustard", "gold", "צהוב", "צהובה", "חרדל", "זהב", "أصفر", "صفراء", "خردلي", "ذهبي", "jaune", "moutarde", "or", "amarillo", "mostaza", "oro", "gelb", "giallo", "amarelo", "geel", "желтый", "желтая", "горчичный", "золотой", "黄", "黄色", "金色", "黄色い", "पीला"},
    "pink": {"pink", "rose", "ורוד", "ורודה", "פוקסיה", "ورדי", "وردية", "rose", "rosa", "roze", "розовый", "розовая", "粉", "粉色", "ピンク", "गुलाबी"},
}

SHOPPING_GARMENT_FAMILIES: dict[str, set[str]] = {
    "cargo_pants": {"cargo", "cargos", "cargo pants", "דגמ\"ח", "דגמח", "מכנסי דגמ\"ח", "מכנסי דגמח", "דגמ\"חים", "كارغو", "سروال كارغو", "pantalones cargo", "pantalon cargo", "cargo-hose", "pantaloni cargo"},
    "pants": {"pants", "trousers", "slacks", "chinos", "joggers", "sweatpants", "jeans", "denim", "מכנסיים", "מכנס", "ג'ינס", "גינס", "דנים", "טרנינג", "צ'ינו", "בןטאל", "بنطال", "سروال", "جينز", "pantalones", "pantalon", "hose", "pantaloni", "calças", "broek", "брюки", "штаны", "牛仔裤", "裤子", "长裤", "パンツ", "ズボン", "जींस", "पैंट"},
    "shorts": {"shorts", "bermuda", "שורטס", "מכנסיים קצרים", "מכנס קצר", "ברמודה", "שورت", "سروال قصير", "pantalon corto", "short", "kurze hose", "pantaloncini", "calções", "korte broek", "шорты", "短裤", "ショートパンツ", "शॉर्ट्स"},
    "skirt": {"skirt", "skirts", "חצאית", "חצאיות", "تنورة", "falda", "jupe", "rock", "gonna", "saia", "rok", "юбка", "半身裙", "裙子", "スカート", "स्कर्ट"},
    "dress": {"dress", "dresses", "gown", "שמלה", "שמלות", "שמלת", "فستان", "vestido", "robe", "kleid", "abito", "jurk", "платье", "连衣裙", "ドレス", "पोशाक"},
    "v_neck": {"v-neck", "v neck", "vneck", "צווארון v", "מפתח v", "וי", "צווארון וי", "فتحة v", "ياقة v", "cuello v", "col v", "v-ausschnitt", "scollo a v", "gola v", "v-hals", "v-образный", "v领", "vネック", "वी-नेक"},
    "crewneck": {"crewneck", "crew-neck", "crew neck", "round neck", "צווארון עגול", "קרו נק", "ياقة مستديرة", "رقبة دائرية", "cuello redondo", "col rond", "rundhals", "girocollo", "gola redonda", "ronde hals", "круглый вырез", "圆领", "クルーネック", "क्रू नेक"},
    "t_shirt": {"t-shirt", "tshirt", "tee", "tees", "חולצת טי", "טי שירט", "טישירט", "טי", "חולצה קצרה", "טי-שירט", "טי שירטס", "חולצות טי", "تي شيرت", "تيشيرت", "camiseta", "maglietta", "футболка", "t恤", "tシャツ", "टी-शर्ट"},
    "knit_top": {"knit", "knitwear", "knit shirt", "knit top", "סריג", "חולצת סריג", "סריגים", "טריקוטאז'", "מחבוك", "محבוכה", "كنزة", "punto", "tricot", "strick", "maglia", "malha", "breisel", "трикотаж", "вязаный", "针织", "ニット", "बुना हुआ"},
    "polo": {"polo", "polo shirt", "פולו", "חולצת פולו", "בولو", "قميص بولو"},
    "shirt": {"shirt", "shirts", "button-down", "button down", "blouse", "חולצה", "חולצות", "חולצת כפתורים", "בלוזה", "قميص", "بلوزة", "camisa", "chemise", "hemd", "camicia", "overhemd", "рубашка", "блузка", "衬衫", "シャツ", "कमीज"},
    "sweater": {"sweater", "sweaters", "jumper", "pullover", "cardigan", "hoodie", "סוודר", "סוודרים", "קרדיגן", "קפוצ'ון", "סריג חם", "سترة", "كنزة صوف", "هودي", "suéter", "pull", "pullover", "maglione", "camisola", "trui", "свитер", "толстовка", "худи", "毛衣", "卫衣", "セーター", "パーカー", "स्वेटर", "हुडी"},
    "outerwear": {"jacket", "jackets", "blazer", "blazers", "coat", "coats", "outerwear", "bomber", "trench", "parka", "overcoat", "vest", "waistcoat", "ז'קט", "ג'קט", "בלייזר", "מעיל", "מעילים", "וסט", "סוודר", "جاكيت", "سترة", "معطف", "صديري", "chaqueta", "blazer", "manteau", "veste", "gilet", "jacke", "mantel", "weste", "giacca", "cappotto", "gilet", "jaqueta", "casaco", "colete", "jas", "vest", "куртка", "пиджак", "пальто", "жилет", "夹克", "外套", "西装", "大衣", "马甲", "ジャケット", "コート", "ベスト", "जैकेट", "ब्लेज़र", "कोट", "वास्कट"},
    "shoes": {"shoes", "shoe", "footwear", "sneakers", "boots", "loafers", "oxfords", "sandals", "flats", "heels", "נעליים", "נעל", "נעלי", "סניקרס", "מגפיים", "מוקסינים", "סנדלים", "עקבים", "חצי מגף", "חצי מגפיים", "חذاء", "أحذية", "سنيكرز", "بوت", "صندل", "كعب", "zapatos", "calzado", "zapatillas", "botas", "mocasines", "sandalias", "tacones", "chaussures", "baskets", "bottes", "mocassins", "sandales", "talons", "schuhe", "sneaker", "stiefel", "slipper", "sandalen", "absätze", "scarpe", "stivali", "mocassini", "sandali", "tacchi", "sapatos", "tênis", "botas", "sandálias", "saltos", "schoenen", "laarzen", "обувь", "кроссовки", "ботинки", "туфли", "сандалии", "каблуки", "鞋", "球鞋", "靴", "皮鞋", "凉鞋", "高跟鞋", "スニーカー", "ブーツ", "ローファー", "サンダル", "ヒール", "जूते", "स्नीकर्स", "बूट", "सैंडल", "हील"},
    "belt": {"belt", "belts", "חגורה", "חגורות", "חגורת עור", "חגור", "حزام", "cinturón", "ceinture", "gürtel", "cintura", "cinto", "riem", "ремень", "腰带", "皮带", "ベルト", "बेल्ट"},
    "headwear": {"hat", "hats", "cap", "caps", "beanie", "beret", "כובע", "כובעים", "מגבעת", "כיפה", "קסקט", "קפלוש", "ברט", "קסקט", "قبعة", "sombrero", "gorra", "chapeau", "casquette", "mütze", "hut", "cappello", "berretto", "chapéu", "boné", "hoed", "pet", "шапка", "шляпа", "кепка", "帽子", "ハット", "キャップ", "टोपी"},
    "bag": {"bag", "bags", "handbag", "handbags", "backpack", "backpacks", "tote", "clutch", "purse", "crossbody", "תיק", "תיקים", "תיק יד", "תיק גב", "ארנק", "حقيبة", "شنطة", "bolso", "mochila", "sac", "sac à dos", "tasche", "rucksack", "borsa", "zaino", "bolsa", "tas", "rugzak", "сумка", "рюкзак", "包", "手提包", "背包", "バッグ", "リュック", "बैग"},
}


def extract_shopping_color_families(text: str) -> set[str]:
    low = text.lower()
    matched = set()
    for col, terms in SHOPPING_COLOR_FAMILIES.items():
        for term in terms:
            if re.search(rf"\b{re.escape(term)}\b", low):
                matched.add(col)
                break
    return matched


def extract_shopping_garment_families(text: str) -> set[str]:
    low = text.lower()
    matched = set()
    for fam, terms in SHOPPING_GARMENT_FAMILIES.items():
        for term in terms:
            if re.search(rf"\b{re.escape(term)}\b", low):
                matched.add(fam)
                break
    return matched


def item_matches_shopping_suggestion(suggestion: str, item: dict[str, Any]) -> bool:
    """Return True if closet item matches the shopping suggestion's garment type and style/color."""
    s_low = suggestion.lower().strip()
    s_colors = extract_shopping_color_families(s_low)
    s_fams = extract_shopping_garment_families(s_low)

    item_text = " ".join([
        str(item.get("title") or ""),
        str(item.get("name") or ""),
        str(item.get("description") or ""),
        str(item.get("category") or ""),
        str(item.get("sub_category") or ""),
        str(item.get("material") or ""),
        " ".join(str(t) for t in (item.get("tags") or [])),
    ]).lower()

    # Direct substring match
    clean_title = str(item.get("title") or item.get("name") or "").lower().strip()
    if clean_title and len(clean_title) >= 5:
        if clean_title in s_low or s_low in clean_title:
            return True

    item_colors = extract_shopping_color_families(item_text)
    raw_col = item.get("colors") or item.get("color") or []
    if isinstance(raw_col, str):
        raw_col = [raw_col]
    for c in raw_col:
        c_str = (c.get("name") if isinstance(c, dict) else str(c)).lower()
        item_colors.update(extract_shopping_color_families(c_str))

    item_fams = extract_shopping_garment_families(item_text)
    cat = str(item.get("category") or "").lower()
    sub_cat = str(item.get("sub_category") or "").lower()
    item_fams.update(extract_shopping_garment_families(f"{cat} {sub_cat}"))

    common_fams = s_fams.intersection(item_fams)
    if not common_fams:
        return False

    # 1. Cargo pants
    if "cargo_pants" in s_fams:
        if "cargo_pants" in item_fams or "pants" in item_fams:
            if not s_colors or (s_colors and s_colors.intersection(item_colors)):
                return True
        return False

    # 2. V-neck knit / V-neck shirt / crewneck
    if "v_neck" in s_fams:
        if "v_neck" in item_fams:
            if not s_colors or (s_colors and s_colors.intersection(item_colors)):
                return True
        return False

    if "crewneck" in s_fams:
        if "crewneck" in item_fams or "t_shirt" in item_fams:
            if not s_colors or (s_colors and s_colors.intersection(item_colors)):
                return True
        return False

    # 3. T-shirt / Polo
    if "t_shirt" in s_fams or "polo" in s_fams:
        if "t_shirt" in item_fams or "polo" in item_fams or "shirt" in item_fams:
            if not s_colors or (s_colors and s_colors.intersection(item_colors)):
                return True
        return False

    # 4. General pants / jeans
    if "pants" in s_fams:
        if "pants" in item_fams or "cargo_pants" in item_fams:
            if s_colors and s_colors.intersection(item_colors):
                return True
            if not s_colors and len(common_fams) >= 1:
                return True
        return False

    # 5. Belt / Shoes / Outerwear / Bag / Headwear / Skirt / Dress
    for specific_fam in ("belt", "shoes", "outerwear", "bag", "headwear", "skirt", "dress"):
        if specific_fam in s_fams:
            if specific_fam in item_fams:
                if not s_colors or (s_colors and s_colors.intersection(item_colors)):
                    return True
            return False

    return False


def filter_shopping_suggestions_against_closet(
    suggestions: list[str] | None,
    all_closet_items: list[dict[str, Any]] | None,
    outfit_recommendations: list[dict[str, Any]] | None = None,
    lang: str = "en",
) -> list[str]:
    """Prune shopping suggestions that match items the user already owns in their closet or look."""
    if not suggestions or not isinstance(suggestions, list):
        return []

    # Gather all outfit items from recommendations
    outfit_items: list[dict[str, Any]] = []
    if outfit_recommendations and isinstance(outfit_recommendations, list):
        for rec in outfit_recommendations:
            if isinstance(rec, dict):
                for it in rec.get("items") or []:
                    if isinstance(it, dict):
                        outfit_items.append(it)

    closet_items_list = list(all_closet_items or []) + outfit_items
    filtered: list[str] = []

    for s in suggestions:
        if not isinstance(s, str):
            continue
        s_clean = sanitize_stylist_text(s, lang=lang).strip()
        if len(s_clean) < 3:
            continue
        # Drop fake URLs
        if re.search(r"https?://|www\.|\.example\.com|/products/|[a-f0-9]{8}-[a-f0-9]{4}", s_clean):
            continue

        is_owned = False
        for item in closet_items_list:
            if item_matches_shopping_suggestion(s_clean, item):
                logger.info(
                    "QA: Dropped redundant shopping suggestion '%s' (user already owns '%s')",
                    s_clean,
                    item.get("title") or item.get("name") or "closet item",
                )
                is_owned = True
                break

        if not is_owned:
            filtered.append(s_clean)

    return filtered

