from __future__ import annotations
import logging
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



_CAPTION_TEMPLATES = {
    "en": {
        "coat": "A tailored {name} crafted with structured silhouette and refined button detailing.",
        "footwear": "Classic {name} featuring sleek styling and premium construction.",
        "accessories": "An elegant {name} that adds functional sophistication to any ensemble.",
        "default": "A versatile {name} designed with thoughtful proportions and clean detailing.",
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


def _coerce_single_garment(
    parsed: dict[str, Any] | list[dict[str, Any]],
    user_gender: str | None = None,
    language: str | None = None,
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
            if any(w in full_text for w in ("blouse", "בלוזה", "cap-sleeve", "cap sleeve", "flutter")):
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
                res["sub_category"] = "Blouse" if res.get("gender") == "women" else "Shirt"
        elif cat_lower == "bottom":
            if any(w in full_text for w in ("jean", "denim", "גינס")):
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
            res["sub_category"] = "Sneakers"
        else:
            res["sub_category"] = "T-Shirt" if cat_lower == "top" else "Garment"
        sub_lower = (res.get("sub_category") or "").strip().lower()

    # Guarantee item_type is never blank or equal to category
    itype_lower = (res.get("item_type") or "").strip().lower()
    if not res.get("item_type") or itype_lower in {"top", "tops", "bottom", "bottoms", "outerwear", "full body", "footwear", "accessories", "clothing", "garment", ""} or itype_lower == cat_lower:
        res["item_type"] = res.get("sub_category") or "Shirt"
        itype_lower = (res["item_type"] or "").strip().lower()

    # Guarantee item_type and sub_category are distinct and specific
    if itype_lower == sub_lower:
        full_text_itype = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')}".lower()
        is_summer = any(s in res.get("season", []) for s in ("summer", "spring")) or any(w in full_text_itype for w in ("short", "cap", "summer", "קצר", "קיץ"))
        if any(w in sub_lower for w in ("t-shirt", "t_shirt", "tshirt", "tee", "טי")):
            if is_summer or any(w in full_text_itype for w in ("cap", "flutter", "short")):
                res["item_type"] = "Short-Sleeve T-Shirt"
            elif any(w in full_text_itype for w in ("long", "ארוך")):
                res["item_type"] = "Long-Sleeve T-Shirt"
            else:
                res["item_type"] = "Short-Sleeve T-Shirt"
        elif any(w in sub_lower for w in ("shirt", "מכופתרת")):
            res["item_type"] = "Short-Sleeve Shirt" if is_summer else "Button-Down Shirt"
        elif any(w in sub_lower for w in ("blouse", "בלוזה")):
            res["item_type"] = "Cap-Sleeve Blouse" if is_summer else "Casual Blouse"
        elif any(w in sub_lower for w in ("jeans", "ג'ינס", "גינס")):
            res["item_type"] = "Straight Jeans"
        elif any(w in sub_lower for w in ("pants", "trousers", "מכנסי")):
            res["item_type"] = "Tailored Trousers"
        elif any(w in sub_lower for w in ("coat", "מעיל")):
            res["item_type"] = "Tailored Coat"
        elif any(w in sub_lower for w in ("jacket", "ג'קט")):
            res["item_type"] = "Casual Jacket"
        elif any(w in sub_lower for w in ("sweater", "סוודר", "סריג")):
            res["item_type"] = "Crew-Neck Sweater"
        elif any(w in sub_lower for w in ("skirt", "חצאית")):
            res["item_type"] = "A-Line Skirt"
        elif any(w in sub_lower for w in ("dress", "שמלה")):
            res["item_type"] = "Midi Dress"
        else:
            fallback_sub = res.get("sub_category") or "Item"
            res["item_type"] = f"Short-Sleeve {fallback_sub}" if is_summer else f"Classic {fallback_sub}"
        itype_lower = (res["item_type"] or "").strip().lower()

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
    raw_g = (res.get("gender") or "").strip().lower()
    g_val = _GENDER_ALIASES.get(raw_g, raw_g)

    # Distinctly feminine cuts
    fem_cuts = {
        "dress", "skirt", "blouse", "heels", "pumps", "knee-high boots",
        "peplum", "sweetheart", "bra", "camisole",
        "בלוזה", "שמלה", "חצאית", "עקבים",
    }
    # Distinctly masculine cuts
    masc_cuts = {
        "boxers", "briefs", "tuxedo", "בוקסר", "טוקסידו",
    }

    is_fem_cut = (
        cat_lower in {"full body", "dress"}
        or any(c in sub_lower or c in itype_lower for c in fem_cuts)
    )
    is_masc_cut = any(c in sub_lower or c in itype_lower for c in masc_cuts)

    if is_fem_cut:
        res["gender"] = "women"
    elif is_masc_cut:
        res["gender"] = "men"
    elif g_val in _VALID_GENDER:
        res["gender"] = g_val
    else:
        # Unrecognized gender — default to user profile gender if known, otherwise unisex
        res["gender"] = norm_user or "unisex"

    # Color refinement: upgrade generic "blue" / "כחול" to specific fine-grained shade if hinted
    full_color_text = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {' '.join(res.get('tags') or [])}".lower()
    is_he = any("\u0590" <= ch <= "\u05ea" for ch in full_color_text)

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

    # Unique name guarantee: ensure name is not just the subcategory name
    name_str = (res.get("name") or "").strip()
    sub_str = (res.get("sub_category") or "").strip()
    if not name_str or name_str.lower() == sub_str.lower() or len(name_str.split()) < 2:
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
        itype = res.get("item_type") or sub_str or "Garment"
        parts = [p for p in [color_name, mat_name, itype] if p]
        if len(parts) >= 2:
            res["name"] = " ".join(parts).title()
            if not res.get("title") or res.get("title").lower() == sub_str.lower():
                res["title"] = res["name"]

    # Materials fallback: ensure never "Unknown"
    mats = res.get("fabric_materials")
    if not mats or (isinstance(mats, list) and all(str(m.get("name", "")).lower() in {"unknown", "n/a", "other", "none", ""} for m in mats if isinstance(m, dict))):
        if cat_lower == "footwear" or "boot" in sub_lower or "belt" in sub_lower or "bag" in sub_lower:
            res["fabric_materials"] = [{"name": "Leather", "pct": 100}]
        elif "jean" in sub_lower or "denim" in sub_lower:
            res["fabric_materials"] = [{"name": "Denim", "pct": 100}]
        elif "coat" in sub_lower or "jacket" in sub_lower or cat_lower == "outerwear":
            res["fabric_materials"] = [{"name": "Wool", "pct": 70}, {"name": "Polyester", "pct": 30}]
        else:
            res["fabric_materials"] = [{"name": "Cotton", "pct": 70}, {"name": "Polyester", "pct": 30}]

    # Coat vs Dress auto-correction: long tailored outerwear with lapels/buttons is Outerwear, not Dress
    coat_keywords = ("coat", "trench", "duster", "jacket", "overcoat", "parka", "blazer", "double-breasted")
    name_and_type = f"{res.get('name', '')} {res.get('item_type', '')} {res.get('caption', '')}".lower()
    if cat_lower in {"full body", "dress"} or sub_lower in {"dress", "dresses"}:
        if any(w in name_and_type for w in coat_keywords):
            res["category"] = "Outerwear"
            cat_lower = "outerwear"
            if sub_lower in {"dress", "dresses"}:
                res["sub_category"] = "Coats"
                sub_lower = "coats"
            if res.get("item_type", "").lower() in {"dress", "dresses", "coat dress", "midi dress"}:
                res["item_type"] = "Double-Breasted Coat" if "double-breasted" in name_and_type else "Tailored Long Coat"
            if "dress" in res.get("name", "").lower():
                import re as _re
                res["name"] = _re.sub(r"(?i)\bdress\b", "Coat", res["name"]).strip()
            if "dress" in res.get("title", "").lower():
                import re as _re
                res["title"] = _re.sub(r"(?i)\bdress\b", "Coat", res["title"]).strip()

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

    # Pattern fallback: if model returned solid/empty, check text for subtle geometric, striped, or floral patterns
    pat_str = (res.get("pattern") or "").strip().lower()
    if not pat_str or pat_str == "solid":
        full_pat_text = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {' '.join(res.get('tags') or [])}".lower()
        if any(w in full_pat_text for w in ("geometric", "geometry", "texture", "textured", "weave", "waffle", "jacquard", "pique", "dot", "dots", "polka", "eyelet", "perforated", "mesh", "ribbed", "subtle", "גיאומטרי", "מרקם", "טקסטורה", "נקודות", "עיגולים", "מחורר", "דוגמה")):
            res["pattern"] = "geometric"
        elif any(w in full_pat_text for w in ("stripe", "striped", "פסים")):
            res["pattern"] = "striped"
        elif any(w in full_pat_text for w in ("plaid", "check", "checker", "משובץ")):
            res["pattern"] = "plaid"
        elif any(w in full_pat_text for w in ("floral", "flower", "פרח")):
            res["pattern"] = "floral"


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
}
_PATTERN_ALIASES = {
    "polka-dot": "polka_dot",
    "polka": "polka_dot",
    "animal-print": "animal_print",
    "tie-dye": "tie_dye",
    "print": "graphic",
    "graphic-print": "graphic",
    "text": "graphic",
    "slogan": "graphic",
    "lettering": "graphic",
    "logo": "graphic",
}


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
    """Coerce ``parsed['season']`` to a validated list. Incurs a context-aware default if empty."""
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

    # Short-sleeve, cap-sleeve, or lightweight tops must be summer wear, NEVER "all"
    if not seasons or seasons == ["all"]:
        if any(w in txt for w in ("short sleeve", "short-sleeve", "cap sleeve", "cap-sleeve", "sleeveless", "tank", "swim", "sandal", "linen", "shorts", "sundress", "blouse", "בלוזה", "קיץ", "קצר")):
            seasons = ["summer"]
        elif any(w in txt for w in ("coat", "jacket", "outerwear", "boot", "wool", "sweater", "cardigan", "scarf", "parka", "overcoat", "puffer", "down", "fleece", "חורף", "מעיל", "סוודר")):
            seasons = ["fall", "winter"]
        elif not seasons:
            seasons = ["all"]

    parsed["season"] = seasons


# Alias tables for the model's common off-spec echoes. Keeping these at
# module scope lets us unit-test them directly without instantiating the
# vision service.
_CONDITION_ALIASES = {"poor": "bad", "very-good": "excellent"}
_QUALITY_ALIASES = {
    "cheap": "budget", "entry": "budget", "basic": "budget",
    "mid-range": "mid", "standard": "mid",
    "high": "premium", "high-end": "premium",
}


def _normalise_dress_code(raw: str | None) -> str | None:
    """Return the dress-code token after space→hyphen + common renames."""
    value = _norm_str(raw)
    if not value:
        return None
    value = value.replace(" ", "-")
    if value == "athleisure":
        value = "athletic"
    if value == "lounge":
        value = "loungewear"
    return value


def _coerce_enums(
    parsed: dict[str, Any],
    user_gender: str | None = None,
) -> dict[str, Any]:
    """Best-effort coercion of AI-returned enum values.

    * Unknown / empty values are defaulted to sensible fallbacks rather than
      dropped, so the user never sees empty dashes ("—").
    * ``state`` defaults to ``used``; the user can flip to ``new`` in the form.
    * ``gender`` defaults to user's profile gender if unrecognized, else 'unisex'.
    """
    norm_user = resolve_garment_gender(user_gender)
    _coerce_enum_field(
        parsed, "gender", _VALID_GENDER, aliases=_GENDER_ALIASES, default=norm_user or "unisex",
    )
    if not parsed.get("gender"):
        parsed["gender"] = norm_user or "unisex"
    parsed["dress_code"] = (
        _normalise_dress_code(parsed.get("dress_code"))
        if _normalise_dress_code(parsed.get("dress_code")) in _VALID_DRESS_CODE
        else "casual"
    )
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
    # SegFormer's "top" covers everything upper-body — shirts, tees,
    # blouses, sweaters, jackets, coats. We let Gemini decide between
    # Top and Outerwear because it has the vocabulary to distinguish
    # a t-shirt from a parka, and either is a legitimate match for
    # the SegFormer kind.
    "top": {"top", "outerwear"},
    # SegFormer's "bottom" covers pants / skirts / shorts — unambiguous.
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
    "top": "Top or Outerwear (upper-body garment)",
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

    # Determine if this item is a bag / handbag / basket
    is_bag = (
        kind_low == "bag"
        or "bag" in lbl_low
        or any(term in lbl_low for term in _BAG_DETECTION_TERMS)
        or any(term in sub.lower() for term in _BAG_DETECTION_TERMS)
        or any(term in itype.lower() for term in _BAG_DETECTION_TERMS)
        or any(term in combined for term in _BAG_DETECTION_TERMS)
    )

    # Check whether contaminated with any apparel keywords
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

    if is_bag and (has_apparel or sub.lower() in _ALL_APPAREL_KEYWORDS or itype.lower() in _ALL_APPAREL_KEYWORDS):
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
            sub_low = (analysis.get("sub_category") or "").lower()
            item_low = (analysis.get("item_type") or "").lower()
            if sub_low in ("belt", "scarf", "hat", "gloves", "tie", "jewelry", "glasses", "sunglasses") or "belt" in sub_low or "belt" in item_low:
                logger.warning(
                    "garment_vision: SegFormer-anchored bag override label=%r kind=%r sub_category=%r -> Bag",
                    label, kind, analysis.get("sub_category"),
                )
                analysis["sub_category"] = "Bag"
                analysis["item_type"] = "Handbag"
                curr_name = analysis.get("name") or analysis.get("title") or ""
                if "belt" in curr_name.lower():
                    import re
                    new_name = re.sub(r"(?i)\b(rope\s+)?belt(\s+accessory)?\b", "Basket Bag", curr_name).strip()
                    if not new_name or new_name.lower() == curr_name.lower():
                        new_name = "Textured Basket Bag"
                    analysis["name"] = new_name
                    analysis["title"] = new_name
                analysis["_subcategory_overridden_by"] = "segformer-bag"
            _sanitize_bag_or_accessory(analysis, label=label, kind=kind, language=language)

        elif ("shoe" in lbl_low or kind == "footwear") and "boot" not in lbl_low:
            sub_low = (analysis.get("sub_category") or "").lower()
            item_low = (analysis.get("item_type") or "").lower()
            curr_name = (analysis.get("name") or analysis.get("title") or "").lower()
            if sub_low in ("boots", "boot") or item_low in ("boots", "boot") or "ankle boots" in curr_name or "platform boots" in curr_name:
                if not any(tall in curr_name for tall in ("knee", "thigh", "riding", "cowboy", "combat", "chelsea")):
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

        # Ensure sub_category and item_type are not identical
        if analysis.get("sub_category") and analysis.get("item_type"):
            sub_str = str(analysis["sub_category"]).strip()
            item_str = str(analysis["item_type"]).strip()
            if sub_str.lower() == item_str.lower():
                if sub_str.lower() in ("sneakers", "shoes"):
                    analysis["item_type"] = "Low-Top Sneakers" if sub_str.lower() == "sneakers" else "Casual Shoes"
                elif sub_str.lower() in ("bag", "handbag"):
                    analysis["sub_category"] = "Bag"
                    analysis["item_type"] = "Handbag"
                elif sub_str.lower() == "t-shirt":
                    analysis["item_type"] = "Short-Sleeve T-Shirt"
                elif sub_str.lower() == "jeans":
                    analysis["item_type"] = "Straight-Leg Jeans"
                elif sub_str.lower() == "pants":
                    analysis["item_type"] = "Casual Pants"
                else:
                    analysis["item_type"] = f"Classic {sub_str}"
        return analysis

    # Flat lay tops and t-shirts are frequently misclassified by SegFormer as 'dress'.
    # If Gemini classified it as a Top or Outerwear, preserve Gemini's rich classification.
    if current.lower() in ("top", "tops", "outerwear") and kind == "dress":
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
    if default == "Footwear":
        analysis["sub_category"] = "Sneakers" if "sneaker" in lbl_low else "Shoes"
        analysis["item_type"] = "sneakers" if "sneaker" in lbl_low else "shoes"
        curr_name = (analysis.get("name") or analysis.get("title") or "").lower()
        if any(w in curr_name for w in ("sweater", "shirt", "top", "hoodie", "cardigan", "jacket", "coat", "pants", "skirt", "dress")):
            color = (analysis.get("colors") or [""])[0]
            color_prefix = f"{color.capitalize()} " if color and isinstance(color, str) else ""
            analysis["name"] = f"{color_prefix}Shoes".strip()
            analysis["title"] = analysis["name"]
    elif default == "Bottom":
        if "skirt" in lbl_low:
            analysis["sub_category"] = "Skirt"
            analysis["item_type"] = "skirt"
        elif "pants" in lbl_low or "trousers" in lbl_low:
            analysis["sub_category"] = "Pants"
            analysis["item_type"] = "pants"
        else:
            analysis["sub_category"] = None
    elif default == "Accessories":
        if "bag" in lbl_low or kind == "bag":
            analysis["sub_category"] = "Bag"
            analysis["item_type"] = "handbag"
        else:
            analysis["sub_category"] = None
        _sanitize_bag_or_accessory(analysis, label=label, kind=kind, language=language)
    else:
        analysis["sub_category"] = None
    analysis["_category_overridden_by"] = "segformer"

    # Ensure sub_category and item_type are not identical
    if analysis.get("sub_category") and analysis.get("item_type"):
        sub_str = str(analysis["sub_category"]).strip()
        item_str = str(analysis["item_type"]).strip()
        if sub_str.lower() == item_str.lower():
            if sub_str.lower() in ("sneakers", "shoes"):
                analysis["item_type"] = "Low-Top Sneakers" if sub_str.lower() == "sneakers" else "Casual Shoes"
            elif sub_str.lower() in ("bag", "handbag"):
                analysis["sub_category"] = "Bag"
                analysis["item_type"] = "Handbag"
            else:
                analysis["item_type"] = f"Classic {sub_str}"

    return analysis

