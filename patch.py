import re

with open('backend/app/services/garment_vision.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert SINGLE_ITEM_SYSTEM_PROMPT
single_item_prompt = '''

SINGLE_ITEM_SYSTEM_PROMPT = (
    "You are The Eyes \\u2014 DressApp's visual garment analyst. You look at "
    "a single cropped photograph of a garment. Analyse the photograph and "
    "describe the item in exhaustive, merchandisable detail. Your output "
    "is used to auto-fill an Add-Item form that a user will review, so be "
    "confident but never invent sensitive claims (e.g. do not guess a "
    "specific brand unless clearly visible; leave brand blank otherwise).\\n\\n"
    "Return ONLY a single JSON object representing the garment.\\n"
    "Never wrap the result in extra commentary or markdown.\\n"
    "The garment object has the following shape (all keys optional except "
    "`title`):\\n"
    "{\\n"
    '  "name": string,                     // 2\\u20135 words. Must be UNIQUE & distinguishing \\u2014 weave in a defining detail (material, fit, vibe, pattern, era, hardware, neckline, wash) so the user never ends up with 12 generic "Black T-shirt" rows. The pattern is "<distinguishing detail> + <core garment>" \\u2014 e.g. heavyweight boxy + tee, ribbed slim + crewneck, vintage pocket + tee. Render that pattern in the OUTPUT LANGUAGE specified by the user message; do NOT echo English examples verbatim.\\n'
    '  "title": string,                    // fallback short title (required). Same uniqueness rules as `name`. Same output language as `name`.\\n'
    '  "caption": string,                  // ONE confident, vivid sentence in the OUTPUT LANGUAGE describing what makes this piece tick \\u2014 silhouette, surface detail, what it pairs with. Max 240 chars. NEVER hedge: forbid "seems", "appears", "probably", "looks like", "might be". State observations directly. If `state` is "used" and `condition` is "bad", end with one short repair/enhancement tip.\\n'
    '  "category": string,                 // top bucket: "Top", "Bottom", "Outerwear", "Full Body", "Footwear", "Accessories", "Underwear"\\n'
    '  "sub_category": string,             // e.g. "Shirt", "Pants", "Dress", "Coat", "Sneakers"\\n'
    '  "item_type": string,                // specific type: "Oxford shirt", "Mini-dress", "Crew-neck sweater"\\n'
    '  "brand": string|null,               // only if legibly visible\\n'
    '  "gender": "men"|"women"|"unisex"|"kids",\\n'
    '  "dress_code": "casual"|"smart-casual"|"business"|"formal"|"athletic"|"loungewear",\\n'
    '  "season": string[],                 // any of: "spring","summer","fall","winter","all"\\n'
    '  "tradition": string|null,           // cultural/religious pattern if clearly present (e.g. "arabic","jewish","indian"), else null\\n'
    '  "colors":           [{"name": string, "pct": integer 0..100}, ...],  // sum \\u2248 100\\n'
    '  "fabric_materials": [{"name": string, "pct": integer 0..100}, ...],  // sum \\u2248 100; infer likely composition\\n'
    '  "pattern": string,                  // "solid","striped","plaid","floral","herringbone","polka","paisley","geometric","abstract"\\n'
    '  "state": "new"|"used",\\n'
    '  "condition": "bad"|"fair"|"good"|"excellent",\\n'
    '  "quality": "budget"|"mid"|"premium"|"luxury",\\n'
    '  "size": string|null,                // only if a label/tag is readable, else null\\n'
    '  "price_cents": integer|null,        // estimated resale value in USD cents, only if confident; else null\\n'
    '  "repair_advice": string|null,       // a short, warm, actionable tip if condition=\\"bad\\" (e.g. \\"Minor pilling on the sleeves \\u2014 a fabric shaver will restore the surface.\\"); null otherwise\\n'
    '  "tags": string[]                    // 3\\u20138 searchable keywords\\n'
    "}\\n\\n"
    "Style rules for the free-text fields (`name`, `title`, `caption`, "
    "`tags`, `repair_advice`):\\n"
    "  1. LANGUAGE \\u2014 honour the OUTPUT LANGUAGE specified at the "
    "top of the user message. It applies equally to short label-like "
    "fields (`name`, `title`) and long descriptive ones (`caption`). "
    "JSON keys and the listed enum tokens always stay in English.\\n"
    "  2. CONFIDENCE \\u2014 state observations directly. Never hedge "
    "with \\"seems\\", \\"appears\\", \\"probably\\", \\"looks like\\", "
    "\\"might be\\", \\"possibly\\", \\"kind of\\". You are the expert; "
    "commit to the call. \\"There's a cute cat print.\\" not \\"There "
    "seems to be an animal print, probably a cat.\\"\\n"
    "  3. UNIQUENESS \\u2014 `name` and `title` must be distinguishing. "
    "Imagine the user already owns ten black tees; pick a detail no "
    "other shirt in a closet would share (texture, weight, neckline, "
    "wash, hardware, vibe, era).\\n"
    "  4. VOICE \\u2014 thoughtful editor, never salesy, never robotic. "
    "No emojis, no markdown, no hashtags, no #tags inside text "
    "fields."
)
'''

system_prompt_end_str = '    "fields."\n)'
if system_prompt_end_str in content:
    content = content.replace(system_prompt_end_str, system_prompt_end_str + single_item_prompt, 1)
else:
    print('SYSTEM_PROMPT end not found')

# 2. Update _build_batch_prompts
old_build_prompts = '''    user_text = (
        f"Analyse the {n} cropped garment image(s) below in order. "
        f"Return a JSON array of {n} GarmentAnalysis entries."
    )
    code = (language or "en").lower()
    if code != "en":
        lang_name = _LANG_NAMES.get(code, code)
        user_text = (
            f"**OUTPUT LANGUAGE = {lang_name} ({code}).** Every free-text "
            f"field (`name`, `title`, `caption`, `tags`, `repair_advice`, "
            f"`sub_category`, `item_type`, `colors[*].name`, "
            f"`fabric_materials[*].name`) MUST be written in fluent, "
            f"idiomatic {lang_name}. JSON keys and enum tokens "
            f"(`category`, `gender`, `dress_code`, `season`, `pattern`, "
            f"`state`, `condition`, `quality`) stay in English.\\n\\n"
            + user_text
        )

    system_prompt = (
        _build_system_prompt(one_pass=False)
        + _language_directive(language)
        + (
            "\\n\\nBATCH MODE — You will be given multiple cropped "
            "garment photographs in a single message. They appear "
            "in numbered order (image 1, image 2, ...). You MUST "
            f"return a JSON ARRAY of EXACTLY {n} objects, one "
            "per crop, in the same order, each following the "
            "GarmentAnalysis schema described above. Do NOT "
            "merge crops, do NOT skip crops, do NOT add explanatory "
            "text outside the array. The response MUST start with "
            "`[` and end with `]`."
        )
        + hint_block
    )
    user_text = (
        f"Analyse the {n} cropped garment image(s) below in order. "
        f"Return a JSON array of {n} GarmentAnalysis entries."
    )'''

new_build_prompts = '''    code = (language or "en").lower()
    lang_instruction = ""
    if code != "en":
        lang_name = _LANG_NAMES.get(code, code)
        lang_instruction = (
            f"**OUTPUT LANGUAGE = {lang_name} ({code}).** Every free-text "
            f"field (`name`, `title`, `caption`, `tags`, `repair_advice`, "
            f"`sub_category`, `item_type`, `colors[*].name`, "
            f"`fabric_materials[*].name`) MUST be written in fluent, "
            f"idiomatic {lang_name}. JSON keys and enum tokens "
            f"(`category`, `gender`, `dress_code`, `season`, `pattern`, "
            f"`state`, `condition`, `quality`) stay in English.\\n\\n"
        )

    if n == 1:
        system_prompt = (
            SINGLE_ITEM_SYSTEM_PROMPT
            + _language_directive(language)
            + hint_block
        )
        user_text = lang_instruction + "Analyse the cropped garment image below. Return a single JSON object."
    else:
        system_prompt = (
            _build_system_prompt(one_pass=False)
            + _language_directive(language)
            + (
                "\\n\\nBATCH MODE — You will be given multiple cropped "
                "garment photographs in a single message. They appear "
                "in numbered order (image 1, image 2, ...). You MUST "
                f"return a JSON ARRAY of EXACTLY {n} objects, one "
                "per crop, in the same order, each following the "
                "GarmentAnalysis schema described above. Do NOT "
                "merge crops, do NOT skip crops, do NOT add explanatory "
                "text outside the array. The response MUST start with "
                "`[` and end with `]`."
            )
            + hint_block
        )
        user_text = lang_instruction + (
            f"Analyse the {n} cropped garment image(s) below in order. "
            f"Return a JSON array of {n} GarmentAnalysis entries."
        )'''

if old_build_prompts in content:
    content = content.replace(old_build_prompts, new_build_prompts)
else:
    print('old_build_prompts not found')

with open('backend/app/services/garment_vision.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
