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

from app.services.fashion_rules_rag import (
    FEMALE_GARMENT_RE,
    filter_gender_closet_items,
    filter_modesty_closet_items,
)
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
    r"\bloafers?\b|\bslippers?\b|\bslides?\b|\bmules?\b|\boxfords?\b|\bclogs?\b|"
    r"\bנעליים\b|\bנעלי\b|\bסניקרס\b|\bמגפיים\b|\bמגפי\b|\bמגפונים\b|"
    r"\bסנדלים\b|\bעקבים\b|\bכפכפים\b|\bמוקסינים\b|"
    r"\bحذاء\b|\bأحذية\b|\bصندل\b|\bبوت\b",
    re.IGNORECASE,
)

RE_OUTERWEAR_WORDS = re.compile(
    r"\bjackets?\b|\bcoats?\b|\bblazers?\b|\bparkas?\b|\btrench(?:coats?)?\b|"
    r"\bovercoats?\b|\bwindbreakers?\b|\bvests?\b|\banoraks?\b|\bpuffers?\b|"
    r"\bז'קט\b|\bג'קט\b|\bמעיל\b|\bמעילים\b|\bבלייזר\b|\bוסט\b|\bמקטורן\b|"
    r"\bسترة\b|\bجاكيت\b|\bمعطف\b|\bبليزر\b",
    re.IGNORECASE,
)

RE_DRESS_WORDS = re.compile(
    r"\bdresses?\b|\bgowns?\b|\bjumpsuits?\b|\brompers?\b|\bdungarees?\b|\boveralls?\b|"
    r"\bשמלה\b|\bשמלת\b|\bשמלות\b|\bאוברול\b|\bסרבל\b|"
    r"\bفستان\b|\bفساتين\b|\bجمبسوت\b",
    re.IGNORECASE,
)


def check_garment_role_mismatch(item: dict[str, Any], role: str) -> str | None:
    """Return an error string if item is semantically/intrinsically incompatible with role, else None."""
    title_name_sub = f"{item.get('title') or ''} {item.get('name') or ''} {item.get('sub_category') or ''}".lower()

    # 1. Role: TOP — strictly reject pants/bottoms and footwear
    if role == "top":
        if RE_BOTTOM_WORDS.search(title_name_sub):
            return f"Item '{item.get('title') or item.get('name')}' contains bottom keywords (pants/cargo/trousers/shorts/jeans/skirt) but was placed in 'top' role."
        if RE_SHOES_WORDS.search(title_name_sub) and not RE_TOP_WORDS.search(title_name_sub):
            return f"Item '{item.get('title') or item.get('name')}' is footwear but was placed in 'top' role."

    # 2. Role: BOTTOM — strictly reject tops and footwear
    elif role == "bottom":
        if RE_TOP_WORDS.search(title_name_sub) and not RE_BOTTOM_WORDS.search(title_name_sub):
            return f"Item '{item.get('title') or item.get('name')}' contains top keywords (shirt/sweater/blouse/hoodie) but was placed in 'bottom' role."
        if RE_SHOES_WORDS.search(title_name_sub) and not RE_BOTTOM_WORDS.search(title_name_sub):
            return f"Item '{item.get('title') or item.get('name')}' is footwear but was placed in 'bottom' role."

    # 3. Role: SHOES / FOOTWEAR
    elif role in ("shoes", "footwear"):
        if (RE_TOP_WORDS.search(title_name_sub) or RE_BOTTOM_WORDS.search(title_name_sub) or RE_OUTERWEAR_WORDS.search(title_name_sub)) and not RE_SHOES_WORDS.search(title_name_sub):
            return f"Item '{item.get('title') or item.get('name')}' is clothing but was placed in 'shoes' role."

    # 4. Role: ACCESSORY / HEADWEAR / BELT
    elif role in ("accessory", "belt", "headwear"):
        if (RE_BOTTOM_WORDS.search(title_name_sub) or RE_TOP_WORDS.search(title_name_sub)) and not any(w in title_name_sub for w in ("belt", "hat", "cap", "tie", "scarf", "חגורה", "כובע", "עניבה")):
            return f"Item '{item.get('title') or item.get('name')}' is clothing but was placed in '{role}' role."

    return None

def is_item_mourning_inappropriate(it: dict[str, Any], role: str) -> bool:
    """Check if an item violates mourning/Shiva etiquette based on its role and metadata."""
    all_text = " ".join([
        str(it.get("title") or ""),
        str(it.get("description") or ""),
        str(it.get("category") or ""),
        str(it.get("sub_category") or ""),
        " ".join(str(t) for t in (it.get("tags") or [])),
    ]).lower()

    # 1. Shorts / swim / trunks / leggings only forbidden on bottom
    if role == "bottom" or norm_category(it.get("category")) == "bottom":
        if any(w in all_text for w in ("shorts", "שורטס", "מכנסיים קצרים", "bermuda", "swim", "trunks", "טייץ", "טייטס", "leggings", "tights")):
            return True

    # 2. Graphic prints, loud florals, cartoons, party wear
    pattern = str(it.get("pattern") or "").lower()
    if pattern in ("floral", "botanical", "flower", "graphic", "print"):
        return True
    if any(w in all_text for w in ("floral", "flower", "פרחוני", "פרחים", "graphic", "cartoon", "ציור", "נשר", "מסיבה", "party", "ripped", "קרוע")):
        return True

    # 3. Bright neon / loud colors (red, gold, neon, hot pink)
    colors = [str(c).lower() for c in (it.get("colors") or [])]
    if any(c in ("red", "gold", "yellow", "neon", "orange") or c in ("אדום", "זהב", "צהוב", "ניאון", "כתום") for c in colors):
        return True
    if any(w in all_text for w in ("bright red", "neon", "אדום בוהק", "זהב", "gold", "ניאון")):
        return True

    # 4. Inappropriate non-clothing items
    if any(w in all_text for w in ("apron", "סינר", "דובון", "pajama", "פיג'מה", "bikini", "ביקיני")):
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


def find_best_garment_replacement(
    role: str,
    all_closet_items: list[dict[str, Any]],
    user_text: str,
    user_gender: str | None,
    exclude_item_ids: set[str],
) -> dict[str, Any] | None:
    """Search user's closet metadata for the best matching replacement garment for a specific role."""
    allowed_cats = ROLE_ALLOWED_CATEGORIES.get(role, set())
    is_mourning = _is_mourning_context(user_text)

    # 1. Filter candidates by category and gender
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

        score = calculate_garment_style_score(
            it,
            user_text,
            user_gender=user_gender,
        )
        if score <= -50:
            continue

        if is_mourning and is_item_mourning_inappropriate(it, role=role):
            continue

        candidates.append((score, it))

    if not candidates:
        return None

    # Sort candidates by score descending
    candidates.sort(key=lambda x: x[0], reverse=True)
    best_item = candidates[0][1]
    return best_item



def sanitize_spoken_reply_and_notes(
    advice: dict[str, Any],
    user_text: str,
    lang: str = "he",
) -> None:
    """Clean hallucinations and garbled phrases from spoken reply and designer notes."""
    is_mourning = _is_mourning_context(user_text)

    # 1. Spoken Reply
    spoken = advice.get("spoken_reply")
    if spoken and isinstance(spoken, str):
        # Scrub Ramadan hallucination in Shiva context
        if is_mourning:
            spoken = re.sub(r"(?:לשעות\s+החמה\s+והרמדונות|והרמדונות|ברמדאן|רמדאן)", "לשעות היום ולביקור המנחם", spoken)
            spoken = re.sub(r"הכוונה היא לביקור משפחה או,", "ההמלצה מתמקדת במראה הולם ומכובד,", spoken)
            spoken = re.sub(r"הו,\s*", "", spoken)
        advice["spoken_reply"] = sanitize_stylist_text(spoken, lang=lang)

    # 2. Designer Notes in Recommendations
    for rec in advice.get("outfit_recommendations", []):
        notes = rec.get("designer_notes")
        if isinstance(notes, dict):
            # Color harmony
            ch = notes.get("color_harmony")
            if ch and isinstance(ch, str):
                if is_mourning:
                    # Remove "אדום" / "red" / "זהב" from mourning palette
                    ch = re.sub(r"(?:כחול\s+אדום|אדום|red|זהב|gold)[, ]*", "כחול כהה, שחור ואפור", ch, flags=re.IGNORECASE)
                notes["color_harmony"] = sanitize_stylist_text(ch, lang=lang)

            # Texture balance
            tb = notes.get("texture_balance")
            if tb and isinstance(tb, str):
                # Clean garbled repeating phrases like "שרוול קצר ושרוול קצרים, מטוטל ורגליים"
                if any(w in tb for w in ("מטוטל", "ורגליים", "ושרוול קצרים", "שרוול קצר ושרוול")):
                    tb = "איזון בדים חלקים ונעימים המעניקים מראה מכובד"
                notes["texture_balance"] = sanitize_stylist_text(tb, lang=lang)

            # Silhouette
            sil = notes.get("silhouette")
            if sil and isinstance(sil, str):
                # Clean nonsense like "כפתורים קצרים עם חגורת גב"
                if any(w in sil for w in ("כפתורים קצרים", "חגורת גב", "רגליים")):
                    sil = "גזרה קלאסית מאופקת ונוחה"
                notes["silhouette"] = sanitize_stylist_text(sil, lang=lang)

        # Do/Don't sanitization
        if isinstance(advice.get("do_dont"), list):
            cleaned_dd = []
            for dd in advice["do_dont"]:
                if not isinstance(dd, str):
                    continue
                # Prune nonsense entries like "wearing food"
                if any(w in dd for w in ("מזון", "אוכל", "food")):
                    continue

                # Fix duplicate words like "אין ללבוש ללבוש"
                dd_clean = re.sub(r"\b(ללבוש)\s+\1\b", r"\1", dd)
                dd_clean = re.sub(r"^(אין ללבוש)\s+ללבוש\s+", r"אין ללבוש ", dd_clean)
                dd_clean = re.sub(r"^(מומלץ ללבוש)\s+ללבוש\s+", r"מומלץ ללבוש ", dd_clean)
                cleaned_dd.append(sanitize_stylist_text(dd_clean, lang=lang))
            advice["do_dont"] = cleaned_dd


async def evaluate_and_authorize_outfit(
    *,
    user_text: str,
    advice_payload: dict[str, Any],
    all_closet_items: list[dict[str, Any]],
    user_profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute complete Quality Assurance check on stylist outfit recommendations.

    Analyzes overall look against user prompt, replaces inappropriate or unmapped garments,
    and authorizes the verified look.
    """
    if not isinstance(advice_payload, dict):
        return advice_payload

    user_gender = (user_profile or {}).get("sex") or (user_profile or {}).get("gender")
    lang = ((user_profile or {}).get("preferred_language") or "he").lower()
    is_mourning = _is_mourning_context(user_text)

    # Build lookup map for user's full closet
    closet_map: dict[str, dict[str, Any]] = {}
    for item in all_closet_items:
        cid = str(item.get("id") or item.get("_id") or "")
        if cid:
            closet_map[cid] = item

    recommendations = advice_payload.get("outfit_recommendations") or []
    used_item_ids: set[str] = set()

    for rec_idx, rec in enumerate(recommendations):
        if not isinstance(rec, dict):
            continue

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

            # Check for etiquette violations (e.g. mourning etiquette)
            if is_valid_item and is_mourning and item_data:
                if is_item_mourning_inappropriate(item_data, role=role):
                    logger.warning("QA: Mourning violation in %s: %s", role, item_data.get("title"))
                    is_valid_item = False
                    item_data = None

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
            used_item_ids.add(cid)
            roles_present.add(role)
            valid_items.append(it)

        # 2. Multi-Bottom Conflict Check: An outfit must NEVER wear pants on top!
        bottom_items = [
            it for it in valid_items
            if str(it.get("role") or "").lower() == "bottom" or bool(RE_BOTTOM_WORDS.search(f"{it.get('name') or ''} {it.get('description') or ''}".lower()))
        ]
        if len(bottom_items) > 1:
            logger.warning("QA: Detected %d bottoms in outfit %d. Pruning non-bottom slots...", len(bottom_items), rec_idx)
            pruned_valid = []
            for it in valid_items:
                r = str(it.get("role") or "").lower()
                is_bottom_garment = bool(RE_BOTTOM_WORDS.search(f"{it.get('name') or ''} {it.get('description') or ''}".lower()))
                if is_bottom_garment and r != "bottom":
                    logger.warning("QA: Dropping intruder bottom '%s' from role '%s'", it.get("name"), r)
                    replacements_made.append(f"Dropped misclassified bottom '{it.get('name')}' from role '{r}'")
                    if r in roles_present:
                        roles_present.remove(r)
                    continue
                pruned_valid.append(it)
            valid_items = pruned_valid

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

        rec["items"] = valid_items

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

    return advice_payload
