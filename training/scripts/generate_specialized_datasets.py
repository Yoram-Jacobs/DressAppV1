#!/usr/bin/env python3
"""Dataset Generator for DressApp Specialized Multi-LoRA Adapters:
  1. trend_scout
  2. stylist_chat
  3. suitcase
  4. scheduled_outfit
"""

import json
from pathlib import Path

DATASETS_DIR = Path("training/datasets")
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

# ==============================================================================
# 1. TREND SCOUT DATASET
# ==============================================================================
TREND_SCOUT_SAMPLES = [
    {
        "query": "Analyze the trending 'Quiet Luxury' aesthetic for Autumn/Winter and break down key wardrobe elements, color palettes, and styling rules.",
        "analysis": {
            "aesthetic": "Quiet Luxury",
            "season": "Autumn/Winter",
            "defining_characteristics": [
                "Unbranded, ultra-high-quality tactile fabrics (cashmere, merino wool, silk-blend, supple calfskin)",
                "Neutral monochrome and tonal layering (camel, oat, ivory, charcoal, rich espresso)",
                "Tailored, relaxed silhouettes with impeccable draping and zero ostentatious logos",
                "Subtle, understated accessories (minimalist leather loafers, sleek structured leather tote, tortoiseshell eyewear)"
            ],
            "core_wardrobe_pieces": [
                {"category": "Top", "sub_category": "Sweaters", "item_type": "Crewneck Cashmere Knit", "key_colors": ["Oatmeal", "Charcoal"]},
                {"category": "Outerwear", "sub_category": "Coats", "item_type": "Double-Faced Wool Overcoat", "key_colors": ["Camel", "Navy"]},
                {"category": "Bottom", "sub_category": "Pants", "item_type": "Pleated Wool Trousers", "key_colors": ["Taupe", "Charcoal Grey"]},
                {"category": "Footwear", "sub_category": "Loafers", "item_type": "Suede Penny Loafers", "key_colors": ["Chocolate Brown", "Black"]},
                {"category": "Accessories", "sub_category": "Sunglasses", "item_type": "Classic Acetate Sunglasses", "key_colors": ["Tortoiseshell"]}
            ],
            "color_palette": [
                {"name": "Warm Cashmere Oatmeal", "hex": "#D8C7B5"},
                {"name": "Deep Espresso Brown", "hex": "#3E2723"},
                {"name": "Charcoal Flannel", "hex": "#37474F"},
                {"name": "Crisp Poplin Ivory", "hex": "#F5F5F0"}
            ],
            "styling_rule": "Anchor the outfit around one hero luxury texture (such as a chunky knit or tailored overcoat), keeping jewelry delicate and hardware strictly brushed gold or silver."
        }
    },
    {
        "query": "Identify the key components of the 'Gorpcore & Technical Urban' trend for trans-seasonal spring styling.",
        "analysis": {
            "aesthetic": "Gorpcore / Technical Urban",
            "season": "Spring",
            "defining_characteristics": [
                "High-performance outdoor fabrics engineered for urban utility (ripstop nylon, Gore-Tex, Pertex, Cordura)",
                "Utilitarian functional details (waterproof taping, quick-release buckles, bungee cinch cords, modular cargo pockets)",
                "Earthy natural tones contrasted with high-visibility tactical accents (sage, slate, black with safety orange or cobalt)"
            ],
            "core_wardrobe_pieces": [
                {"category": "Outerwear", "sub_category": "Jackets", "item_type": "3-Layer Waterproof Shell Jacket", "key_colors": ["Forest Green", "Slate Grey"]},
                {"category": "Bottom", "sub_category": "Pants", "item_type": "Articulated Cargo Trousers", "key_colors": ["Olive Drab", "Black"]},
                {"category": "Footwear", "sub_category": "Sneakers", "item_type": "Technical Trail Runners", "key_colors": ["Stone / Orange", "Triple Black"]},
                {"category": "Accessories", "sub_category": "Bags", "item_type": "Crossbody Cordura Sling Bag", "key_colors": ["Coyote Tan", "Black"]}
            ],
            "color_palette": [
                {"name": "Moss Olive", "hex": "#556B2F"},
                {"name": "Slate Rock", "hex": "#708090"},
                {"name": "High-Vis Accent Tangerine", "hex": "#FF6F00"},
                {"name": "Stealth Carbon", "hex": "#1A1A1A"}
            ],
            "styling_rule": "Balance hyper-technical outerwear with grounded, minimalist basics (like a heavyweight cotton tee or clean-line trousers) to avoid looking like you are hiking Mount Rainier in a city subway."
        }
    },
    {
        "query": "What is the 'Coastal Grandmother / Coastal Minimalist' trend and how can users style it for warm summer weekends?",
        "analysis": {
            "aesthetic": "Coastal Minimalist",
            "season": "Summer",
            "defining_characteristics": [
                "Airy, breathable natural textiles (100% Belgian linen, open-weave cotton gauze, woven raffia, light canvas)",
                "Relaxed, breezy cuts designed for movement and seaside leisure",
                "Sun-bleached, oceanic neutrals (chalk white, chambray blue, sandy beige, soft terracotta)"
            ],
            "core_wardrobe_pieces": [
                {"category": "Top", "sub_category": "Shirt", "item_type": "Oversized Linen Button-Down", "key_colors": ["Chalk White", "French Blue Stripe"]},
                {"category": "Bottom", "sub_category": "Pants", "item_type": "Wide-Leg Drawstring Linen Trousers", "key_colors": ["Sand Beige", "White"]},
                {"category": "Footwear", "sub_category": "Sandals", "item_type": "Slide Sandals / Espadrilles", "key_colors": ["Natural Tan", "Ecru"]},
                {"category": "Accessories", "sub_category": "Bags", "item_type": "Woven Raffia Tote Bag", "key_colors": ["Natural Straw"]},
                {"category": "Accessories", "sub_category": "Sunglasses", "item_type": "Square Tortoise Frame Sunglasses", "key_colors": ["Amber Tortoise"]}
            ],
            "color_palette": [
                {"name": "Sun-Bleached Linen", "hex": "#FAF0E6"},
                {"name": "Coastal Chambray", "hex": "#A4D3EE"},
                {"name": "Sand Dune", "hex": "#D2B48C"},
                {"name": "Soft Terracotta", "hex": "#CD5C5C"}
            ],
            "styling_rule": "Drape a lightweight cotton cable-knit sweater loosely over the shoulders and leave the linen button-down partially unbuttoned with rolled sleeves for that effortless Hamptons elegance."
        }
    },
    {
        "query": "Break down the 'Modern Preppy / Ivy Tailoring' aesthetic for spring workwear.",
        "analysis": {
            "aesthetic": "Modern Preppy",
            "season": "Spring",
            "defining_characteristics": [
                "Heritage collegiate elements modernized with contemporary relaxed cuts",
                "Mix of structured tailoring (blazers) with casual foundations (chinos, rugby shirts, polo tops)",
                "Collegiate primary shades grounded in navy and forest green"
            ],
            "core_wardrobe_pieces": [
                {"category": "Outerwear", "sub_category": "Jackets", "item_type": "Navy Wool Hopsack Blazer", "key_colors": ["Deep Navy"]},
                {"category": "Top", "sub_category": "Shirt", "item_type": "Oxford Cloth Button-Down (OCBD)", "key_colors": ["Light Blue", "Pink"]},
                {"category": "Bottom", "sub_category": "Pants", "item_type": "Tapered Chinos", "key_colors": ["British Khaki", "Olive"]},
                {"category": "Footwear", "sub_category": "Loafers", "item_type": "Beefroll Penny Loafers", "key_colors": ["Color 8 Cordovan", "Black"]},
                {"category": "Accessories", "sub_category": "Belts", "item_type": "Surcingle Striped Belt", "key_colors": ["Navy/Green"]}
            ],
            "color_palette": [
                {"name": "Collegiate Navy", "hex": "#000080"},
                {"name": "Oxford Light Blue", "hex": "#B0E0E6"},
                {"name": "British Khaki", "hex": "#C3B091"},
                {"name": "Forest Ivy Green", "hex": "#228B22"}
            ],
            "styling_rule": "Keep the blazer unlined and soft-shouldered, paired with crisp cuff breaks on the chinos to maintain a fresh, youthful collegiate vibe."
        }
    }
]

# ==============================================================================
# 2. STYLIST CHAT DATASET
# ==============================================================================
STYLIST_CHAT_SAMPLES = [
    {
        "user": "I have an outdoor summer rooftop wedding coming up next Saturday. Dress code is Smart Casual / Cocktail. What should I wear?",
        "assistant": "For a summer rooftop wedding with a smart casual / cocktail dress code, the key is balancing elegance with warm-weather breathability:\n\n1. **Men / Masculine Styling:**\n   • **Top & Outerwear:** A breathable deconstructed linen-blend or tropical wool blazer in soft sage, light navy, or sand. Pair with a crisp white or light blue open-collar cotton-linen dress shirt (skip the tie for a relaxed rooftop vibe).\n   • **Bottoms:** Tailored cream or taupe pleated trousers.\n   • **Footwear:** Dark brown suede penny loafers or leather double monk straps with invisible no-show socks.\n   • **Finishing Touches:** A linen pocket square and classic dark tortoiseshell sunglasses for daytime sun.\n\n2. **Women / Feminine Styling:**\n   • **The Look:** A breezy floral silk or chiffon midi dress with an asymmetrical hemline or halter neckline, or a sleek pastel linen-blend tailored jumpsuit.\n   • **Footwear:** Block-heel strappy sandals (essential for rooftop wooden decking where stilettos can catch).\n   • **Accessories:** A compact woven raffia or metallic clutch, delicate gold drop earrings, and cat-eye sunglasses.\n\n💡 *Pro-Stylist Tip:* Rooftops can get breezy after sunset. Bring along a lightweight cashmere wrap or unstructured blazer that coordinates with your palette!"
    },
    {
        "user": "Can I wear black leather Chelsea boots with navy blue chinos, or does that clash?",
        "assistant": "Yes, absolutely! The old-school rule that 'black and navy never mix' is thoroughly outdated in modern menswear and tailoring. In fact, navy and black create a very sophisticated, European-inspired high-contrast look when styled intentionally.\n\nHere is how to make it look cohesive:\n1. **The Bridge Piece:** Wear a black leather belt with brushed silver or gunmetal hardware to echo the black boots.\n2. **Upper Layer:** Pair with a charcoal, grey melange, or off-white knit sweater or an ivory Oxford shirt. If you wear an outer jacket, a black overcoat or dark grey bomber ties the boots and chinos together seamlessly.\n3. **Trouser Fit:** Ensure your navy chinos have a clean, slight taper and a neat single cuff or no-break hem that sits cleanly on top of the Chelsea boot shaft without bunching up.\n\nThis look is sleek, urban, and perfect for smart-casual office settings or evening drinks!"
    },
    {
        "user": "I'm going to a job interview at a high-growth tech startup. What is the best business casual outfit that looks polished without looking too stiff?",
        "assistant": "At a modern tech startup, wearing a traditional corporate suit can make you seem culturally out of touch, while showing up in a graphic tee and sneakers looks under-prepared. The sweet spot is **'Elevated Contemporary Business Casual'**:\n\n• **Upper Body:** A fine-gauge merino wool knit polo or a crisp light blue button-down shirt worn beneath an unstructured navy or charcoal blazer. Soft shoulders give an approachable yet professional aura.\n• **Trousers:** Clean-front slim or straight-leg chinos in olive, khaki, or dark slate grey. Avoid denim with visible distress or fading; dark raw denim is acceptable only if tailored.\n• **Footwear:** Clean, minimalist leather dress shoes (Derbies or loafers) or pristine, unbranded luxury low-top white leather sneakers.\n• **Accessories:** A minimalist leather watch and a structured leather laptop bag or portfolio.\n\nThis ensemble signals that you take the opportunity seriously while fitting effortlessly into a collaborative, modern workplace."
    }
]

# ==============================================================================
# 3. SUITCASE PACKING DATASET
# ==============================================================================
SUITCASE_SAMPLES = [
    {
        "query": "Generate a 5-day capsule packing manifest for a trip to Tokyo in mid-November. The weather is cool (10°C - 17°C) with light rain. Trip includes 2 days of client meetings and 3 days of city exploration.",
        "manifest": {
            "destination": "Tokyo, Japan",
            "duration_days": 5,
            "season": "Autumn",
            "forecast_summary": "Cool temperatures (10-17°C), crisp breezes, occasional light showers.",
            "capsule_formula": "3 Tops + 2 Bottoms + 1 Outerwear + 2 Footwear + Core Accessories = 8 Unique Outfits",
            "packing_list": {
                "outerwear": [
                    {"name": "Water-Repellent Trench Coat or Wool Car Coat", "color": "Beige / Navy", "role": "Weather protection and client-meeting sophistication."}
                ],
                "tops": [
                    {"name": "White Wrinkle-Resistant Oxford Shirt", "color": "White", "role": "Business meeting staple."},
                    {"name": "Fine-Gauge Merino Crewneck Sweater", "color": "Charcoal Grey", "role": "Layering piece for meetings and evening dinners."},
                    {"name": "Heavyweight Cotton Long-Sleeve Tee", "color": "Heather Grey", "role": "Casual day exploration."}
                ],
                "bottoms": [
                    {"name": "Tailored Stretch Chinos", "color": "Navy", "role": "Dual-use for business and dinners."},
                    {"name": "Dark Wash Straight Jeans", "color": "Indigo", "role": "Weekend and walking comfort."}
                ],
                "footwear": [
                    {"name": "Sleek Waterproof Leather Walking Shoes / Chelsea Boots", "color": "Black", "role": "Dual-purpose for client meetings and rainy streets."},
                    {"name": "Cushioned Low-Top Leather Sneakers", "color": "White", "role": "Comfortable for 15,000+ daily Tokyo walking steps."}
                ],
                "accessories": [
                    {"name": "Compact Travel Umbrella", "color": "Black"},
                    {"name": "Merino Wool Scarf", "color": "Oatmeal"},
                    {"name": "Leather Cardholder & Crossbody Bag", "color": "Black"}
                ]
            },
            "packing_tips": [
                "Japanese cultural etiquette: Wear slip-on or easy-to-remove shoes (like Chelsea boots or loafers) as many dining rooms and cultural venues require shoe removal.",
                "Wear your heaviest piece (the overcoat and Chelsea boots) on the flight to conserve luggage space."
            ]
        }
    },
    {
        "query": "Create a 3-day weekend carry-on packing plan for a beach getaway in Santorini in July. Very hot (28-33°C), sunny and breezy.",
        "manifest": {
            "destination": "Santorini, Greece",
            "duration_days": 3,
            "season": "Summer",
            "forecast_summary": "High sun, intense heat (30°C+), coastal sea breeze.",
            "capsule_formula": "Carry-on only: 3 Linen/Cotton Tops + 2 Light Bottoms/Swim + 2 Shoes",
            "packing_list": {
                "tops": [
                    {"name": "Relaxed Linen Camp Collar Shirt", "color": "White", "role": "Daytime sun protection and evening dining."},
                    {"name": "Breathable Striped Cotton Tee", "color": "Navy/White", "role": "Casual island cruising."},
                    {"name": "Breezy Linen Sleeveless Blouse / Linen Tank", "color": "Sky Blue", "role": "High-noon exploration."}
                ],
                "bottoms": [
                    {"name": "Drawstring Linen Shorts", "color": "Sand Beige", "role": "Daily walking around Oia."},
                    {"name": "Quick-Dry Tailored Swim Shorts / Sarong", "color": "Olive Green", "role": "Beach club to seaside taverna transition."}
                ],
                "footwear": [
                    {"name": "Ergonomic Leather Slide Sandals", "color": "Cognac Brown", "role": "Beach and casual dining."},
                    {"name": "Breathable Espadrilles or Canvas Slip-ons", "color": "Ecru", "role": "Gripping cobblestone paths and Caldera steps."}
                ],
                "accessories": [
                    {"name": "Polarized UV Sunglasses", "color": "Tortoiseshell"},
                    {"name": "Packable Straw Fedora / Wide-Brim Sun Hat", "color": "Natural"},
                    {"name": "Mineral SPF 50 & Canvas Tote Bag", "color": "Natural Cotton"}
                ]
            },
            "packing_tips": [
                "Santorini cobblestones are notoriously slippery; avoid smooth leather soles or high heels.",
                "Roll linen garments with tissue paper or steam them immediately in the hotel shower to release travel creases."
            ]
        }
    }
]

# ==============================================================================
# 4. SCHEDULED OUTFIT DATASET
# ==============================================================================
SCHEDULED_OUTFIT_SAMPLES = [
    {
        "context": {
            "date": "Tuesday, October 14",
            "weather": {"morning_temp": "12°C", "afternoon_temp": "20°C", "condition": "Morning drizzle clearing to afternoon sunshine"},
            "agenda": [
                {"time": "09:00", "event": "Executive Board Presentation", "dress_code": "Smart Casual / Business"},
                {"time": "13:00", "event": "Lunch with Marketing Partner", "dress_code": "Casual"},
                {"time": "18:30", "event": "Team Dinner & Drinks", "dress_code": "Smart Casual"}
            ]
        },
        "recommendation": {
            "outfit_title": "The Temperature-Adaptive Tailored Layers",
            "pieces": {
                "base_layer": "Off-White Silk-Cotton Knit Crewneck",
                "mid_layer": "Navy Unstructured Wool-Blend Blazer (wear buttoned in morning meeting, drape over shoulders at dinner)",
                "outer_shell": "Water-Resistant Beige Single-Breasted Trench Coat (commute only)",
                "bottom": "Tailored Charcoal Grey Stretch Trousers",
                "shoes": "Dark Brown Polished Leather Penny Loafers",
                "accessories": ["Black Compact Umbrella", "Brushed Silver Watch", "Leather Laptop Briefcase"]
            },
            "weather_transition_strategy": "The trench coat shields your tailored blazer from the 12°C morning drizzle. Once the sun warms the afternoon to 20°C, stash the trench coat and umbrella in the office, letting the fine-gauge knit and blazer carry you smoothly from board meeting to evening drinks."
        }
    },
    {
        "context": {
            "date": "Friday, July 18",
            "weather": {"morning_temp": "24°C", "afternoon_temp": "31°C", "condition": "Sunny, high humidity, clear skies"},
            "agenda": [
                {"time": "10:00", "event": "Work from Creative Co-working Space", "dress_code": "Casual"},
                {"time": "19:00", "event": "Outdoor Garden Party with Friends", "dress_code": "Summer Chic"}
            ]
        },
        "recommendation": {
            "outfit_title": "The Breathable Linen Garden Ensemble",
            "pieces": {
                "base_layer": "Crisp White Linen Camp-Collar Shirt (unbuttoned top two buttons)",
                "bottom": "Olive Green Tailored Linen-Cotton Blend Chinos (neat single cuff)",
                "shoes": "Natural Suede Woven Espadrilles or Minimalist Tan Slides",
                "accessories": ["Tortoiseshell Classic Sunglasses", "Woven Braided Belt", "Canvas Tote"]
            },
            "weather_transition_strategy": "The 100% linen weave maximizes airflow during the 31°C afternoon heat. The olive and white palette transitions effortlessly from day creative work to golden-hour garden drinks without requiring a mid-day wardrobe change."
        }
    }
]


def export_jsonl(filename: str, records: list):
    out_file = DATASETS_DIR / filename
    with open(out_file, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"Exported {len(records)} records to {out_file} ({out_file.stat().st_size / 1024:.1f} KB)")


def main():
    # 1. Trend scout
    trend_records = [
        {
            "messages": [
                {"role": "user", "content": item["query"]},
                {"role": "assistant", "content": json.dumps(item["analysis"], ensure_ascii=False)}
            ]
        }
        for item in TREND_SCOUT_SAMPLES
    ]
    export_jsonl("trend_scout.jsonl", trend_records)

    # 2. Stylist chat
    chat_records = [
        {
            "messages": [
                {"role": "user", "content": item["user"]},
                {"role": "assistant", "content": item["assistant"]}
            ]
        }
        for item in STYLIST_CHAT_SAMPLES
    ]
    export_jsonl("stylist_chat.jsonl", chat_records)

    # 3. Suitcase
    suitcase_records = [
        {
            "messages": [
                {"role": "user", "content": item["query"]},
                {"role": "assistant", "content": json.dumps(item["manifest"], ensure_ascii=False)}
            ]
        }
        for item in SUITCASE_SAMPLES
    ]
    export_jsonl("suitcase.jsonl", suitcase_records)

    # 4. Scheduled outfit
    scheduled_records = [
        {
            "messages": [
                {"role": "user", "content": f"Plan my daily outfit based on this schedule and weather:\n{json.dumps(item['context'], ensure_ascii=False)}"},
                {"role": "assistant", "content": json.dumps(item["recommendation"], ensure_ascii=False)}
            ]
        }
        for item in SCHEDULED_OUTFIT_SAMPLES
    ]
    export_jsonl("scheduled_outfit.jsonl", scheduled_records)


if __name__ == "__main__":
    main()
