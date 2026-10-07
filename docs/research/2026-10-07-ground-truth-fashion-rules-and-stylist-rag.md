# Ground Truth Fashion Rules & AI Stylist Brain Architecture

**Date**: 2026-10-07  
**Status**: Proposal / Research Document  
**Target Engine**: On-Premises Qwen2.5-VL-3B-Instruct (DressApp Eyes) & Multi-tier Stylist Brain  
**Author**: Antigravity AI & Fashion Strategy Team  

---

## 1. Executive Summary

Curating an outfit is not an arbitrary assembly or shuffling of clothes in a user's closet. In professional fashion design, styling is a deterministic discipline governed by centuries of visual art theory, textiles physics, anatomical proportions, social semiotics, and environmental constraints.

To transform DressApp's Stylist from a basic "closet shuffler" into an **experienced fashion designer persona**, the Stylist Brain must operate on:
1. A **Ground-Truth Fashion Knowledge Base** containing formal design axioms (Color Theory, Texture/Material Balance, Silhouette Proportions, Dress Codes, Contextual/Cultural Restrictions).
2. A **RAG Optimization Engine** that dynamically retrieves and injects *only the contextually relevant fashion axioms* based on user input, weather, venue, culture, and wardrobe inventory, keeping prompt payloads compact and lightning-fast on CPU-constrained on-premises models (Qwen2.5-VL-3B).
3. A **Structured Reasoning Chain (CoT)** that evaluates constraints in strict hierarchical stages: Hard Constraints (Weather/Culture) $\rightarrow$ Anchor Garment $\rightarrow$ Color/Texture Harmony $\rightarrow$ Silhouette Balance $\rightarrow$ Functional Footwear & Accessorizing.

---

## 2. Ground-Truth Fashion Styling Axioms

### 2.1 Color Theory & Harmony Rules

Fashion color theory derives from Johannes Itten's color wheel and the Munsell color system, adapted for wearable textiles:

1. **The 60-30-10 Composition Axiom**:
   - **60% Dominant Base**: Neutral anchor or main color (e.g. suit, coat, trousers + knit).
   - **30% Secondary Supporting Color**: Harmonic partner (creates structure, e.g. shirt, jacket, skirt).
   - **10% Accent Color**: High-chroma or contrasting highlight (tie, scarf, shoes, bag, jewelry).

2. **Color Harmonies**:
   - **Monochromatic**: Variations in lightness and saturation of a single hue (e.g. Navy, Slate Blue, Powder Blue). Requires texture variation to avoid looking flat.
   - **Analogous**: 2-3 hues adjacent on the 12-spoke color wheel (e.g. Olive Green + Mustard Yellow, or Camel + Rust). Evokes organic elegance.
   - **Complementary**: Exact opposites across the color wheel (e.g. Navy + Cognac/Orange-Brown, Burgundy + Olive). High visual tension; one hue must dominate (60/30) while the other serves as an accent.
   - **Split-Complementary**: Base hue paired with the two hues adjacent to its complement (e.g. Forest Green with Terracotta and Plum). Softer than pure complementary.
   - **Neutral Anchors**: True neutrals (Black, White, Cream, Charcoal Grey, Navy, Beige, Khaki, Camel). Neutrals can pair with any chromatic hue and stabilize saturated garments.

3. **Value & Saturation Contrast**:
   - High value contrast (e.g. Crisp White shirt with Deep Charcoal suit) conveys authority, formality, and crispness.
   - Low value contrast (e.g. Oatmeal cashmere sweater with Ecru linen pants) conveys relaxed luxury and tonal calm.
   - Avoid clashing undertones: Mixing warm beige (yellow/peach undertone) with cool grey (blue undertone) without a transitional bridging piece causes visual disharmony.

---

### 2.2 Material, Texture, & Fabric Physics

Garments possess physical properties—weight, sheen, stiffness, drape, and porosity:

1. **Texture Contrast (Tactile Balance)**:
   - Never combine flat, lifeless fabrics without variation.
   - Pair rough/matte with smooth/sheen:
     - Chunky cable-knit wool + crisp cotton poplin.
     - Structured denim + soft cashmere knitwear.
     - Matte suede + smooth glazed leather or raw denim.
     - Fluid silk/satin + structured tailored wool.

2. **Visual Weight Matching**:
   - Garments must physically and visually support each other:
     - Heavy outerwear (e.g. thick wool overcoat, shearling) requires substantial footwear (e.g. Chelsea boots, lug-sole brogues), not delicate canvas slip-ons.
     - Lightweight summer tops (linen, silk) require lightweight bottoms (cotton chinos, linen trousers).

3. **Sheen Balancing**:
   - Daytime/casual outfits should limit high-sheen fabrics (satin, patent leather) to small accent pieces.
   - Evening/formal occasions embrace controlled lustre (silk lapels, velvet blazers, polished leather).

---

### 2.3 Proportions, Silhouette, & Anatomy (Rule of Thirds)

Human visual aesthetics reject uncalibrated 50/50 bisection:

1. **The Golden Ratio (1:2 / Rule of Thirds)**:
   - A silhouette should break into roughly 1/3 and 2/3 proportions:
     - **1/3 Top + 2/3 Bottom**: High-waisted trousers/skirt with tucked-in or cropped shirt (elongates legs).
     - **2/3 Top + 1/3 Bottom**: Longline tunic or overcoat over shorter base.
   - Avoid equal 1/2:1/2 bisecting cuts (e.g. an untucked square polo shirt hitting mid-hip over untapered straight jeans), which foreshortens the body.

2. **Volume Counterbalance**:
   - Volume on top requires structure on bottom (e.g. Oversized chunky sweater + slim/straight pants).
   - Volume on bottom requires structure or snugness on top (e.g. Wide-leg palazzo trousers + fitted ribbed top).
   - All-over volume requires deliberate waist cinch (belt or tailored drape).

3. **Breakpoint Alignment**:
   - Trouser break: No break (modern/casual), half break (business standard), full break (traditional tailoring).
   - Outerwear length: Jacket should cover the seat; coats should terminate either mid-thigh or below the knee—avoiding terminating directly at the widest point of the calf.

---

### 2.4 Contextual, Environmental, & Social Ground Truths

1. **Weather & Thermodynamic Logic**:
   - Temperature $\le 5^\circ\text{C}$: Multi-layer thermal regulation (Base thermal/cotton $\rightarrow$ Mid insulating knit/cardigan $\rightarrow$ Shell wool overcoat/down coat + weather-sealed boots).
   - Temperature $6^\circ\text{C} - 16^\circ\text{C}$: Transitional layering (Shirt + light knit + trench coat or blazer).
   - Temperature $17^\circ\text{C} - 24^\circ\text{C}$: Single layer breathable (Cotton, chambray, tropical wool, knit polo).
   - Temperature $\ge 25^\circ\text{C}$: High-breathability, moisture-wicking natural fibers (Linen, seersucker, open-weave cotton; sandals/loafers).
   - Precipitation: Zero raw suede or untreated canvas without waterproof shell; dark bottoms preferred over white trousers.

2. **Dress Codes & Social Formality Spectrum**:
   - **White Tie / Black Tie**: Strict tuxedos/dinner suits, satin lapels, patent leather oxford shoes, formal floor-length evening gowns.
   - **Business Formal**: Dark 2-piece suits (Navy/Charcoal), white/pale blue collared dress shirts, silk neckwear, leather dress shoes (Oxfords/Derbies).
   - **Business Casual / Smart Casual**: Tailored blazer + chinos/dark jeans, knit polos, collared shirts, loafers/clean leather dress sneakers.
   - **Casual / Lounge / Athletic**: T-shirts, hoodies, sneakers, denim, joggers.

3. **Cultural & Modesty Restrictions**:
   - Strict modesty profiles: Sleeves beyond elbow, hemlines below knee/ankle, high necklines, no transparent fabrics.
   - Religious etiquette: Head covering accommodation, absence of prohibited animal products, modesty during worship or sacred venue entry.
   - Avoid socially taboo color associations (e.g. wearing solid white to a traditional Western wedding, wearing solid black to certain traditional festive ceremonies).

---

## 3. RAG Architecture for the On-Premises Stylist Brain

Because on-premises inference runs on CPU (AMD EPYC, 4 vCPUs, 8 GB RAM on Hetzner VPS), injecting all hundreds of fashion axioms into every prompt would cause high token latency.

### 3.1 Three-Stage RAG Pipeline

```
  [User Request + Weather + Venue + Modesty]
                     │
                     ▼
         ┌───────────────────────┐
         │ 1. Metadata Filtering │ ─── Filters Hard Rules (Dress Code, Weather, Culture)
         └───────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ 2. Semantic Search    │ ─── Reranks Fashion Axioms via FashionCLIP/MiniLM
         │    & Graph Retrieval  │     (Color Harmonies, Fabric Matching, Silhouette)
         └───────────────────────┘
                     │ Top 3-5 Relevant Axioms
                     ▼
         ┌───────────────────────┐
         │ 3. Keyed Prompt with  │ ─── Compact Prompt (<1,200 tokens)
         │    Ground-Truth Rules │     Sent to Qwen2.5-VL-3B
         └───────────────────────┘
                     │
                     ▼
        [Reasoned, Curated Outfit Recommendations]
```

### 3.2 Knowledge Base Schema (`fashion_rules` collection)

```json
{
  "_id": "rule_color_60_30_10",
  "category": "color_harmony",
  "name": "60-30-10 Color Balance",
  "tags": ["color", "proportion", "balance"],
  "conditions": {
    "dress_code": ["smart-casual", "business", "formal", "casual"],
    "requires_layers": true
  },
  "rule_text": "Distribute outfit colors into 60% dominant base/neutral, 30% secondary structure hue, and 10% high-contrast or complementary accent.",
  "negative_constraint": "Do not combine three intensely saturated, competing colors in equal 33% thirds.",
  "priority": 10
}
```

---

## 4. Reasoning Chain for the Stylist Persona

Instead of randomly picking a top and bottom, the prompt forces the model to reason through 5 explicit steps:

1. **Step 1: Environmental & Modesty Filter**: Reject any garments violating temperature, rain, or user modesty levels.
2. **Step 2: Anchor Selection (The Hero Piece)**: Select the centerpiece garment that best anchors the user's intent or event (e.g., a statement blazer, an elegant dress, or selvedge denim).
3. **Step 3: Color & Texture Coordination**: Use the color wheel axioms (monochromatic, analogous, complementary) and tactile balance (matte vs sheen, structured vs fluid) to pick the second piece.
4. **Step 4: Anatomical Completeness & Footwear**: Select footwear that matches the silhouette volume and terrain, followed by weather layering (outerwear).
5. **Step 5: Professional Rationale**: Produce the explanation detailing *why* the pieces harmonize (citing color relationship, proportion, and occasion suitability).

---

## 5. Next Steps & Prototyping Roadmap

1. **Seed Ground-Truth Rules Database**: Create `fashion_rules` dataset containing ~60 canonical fashion rules across color, fabric, silhouette, weather, and occasion.
2. **Implement Rule Retrieval Engine**: Build a lightweight RAG matcher (`app.services.fashion_rules_rag`) that selects top relevant rules based on context.
3. **Upgrade Stylist System Prompt**: Replace the basic `PROMPT_STYLIST_CHAT` with the Fashion Designer Persona & Reasoning Chain prompt.
4. **Verify on VPS Qwen2.5-VL-3B**: Benchmark inference latency, JSON compliance, and styling quality on the live Hetzner CPX32 instance.
