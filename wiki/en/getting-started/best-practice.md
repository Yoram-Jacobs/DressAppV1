# DressApp Getting Started: Best Practices Guide

Welcome to **DressApp**! This guide covers the essential best practices for photographing your clothes, digitizing your closet efficiently using DressApp’s cumulative AI credit system, verifying item metadata, and writing high-precision prompts for the On-Premises AI Stylist.

---

## 1. Understanding Your Free AI Credit Budget

As a Free tier user, DressApp gives you two specialized AI credit pools so you can digitize, restore, and style your wardrobe without friction:

| Credit Pool | Allocation & Rollover | What It Powers | Cost per Action |
| :--- | :--- | :--- | :--- |
| **On-Premises AI Credits** *(DressApp Eyes)* | **10 free credits / day**, cumulative over up to **30 days (up to 300 credits)**, then resets | Garment analysis, multi-garment detection, AI Stylist chat, and Suitcase curation | • **Single garment analysis**: 1 credit<br>• **Multi-garment analysis (e.g., 5 garments)**: 5 credits (1 per garment)<br>• **AI Stylist prompt**: 1 credit<br>• **Suitcase curation**: 1 credit per garment curated |
| **Reconstruction Credits** *(Nano Banana)* | **5 free onboarding credits** (top up anytime on the Pricing page) | Generative garment studio reconstruction, crop repair, and AI image editing | • **1 Reconstruction credit** per generative studio repair |

> [!TIP]
> **Why Cumulative Credits Matter for Onboarding:** Because your **10 daily On-Premises AI Credits** accumulate up to **300 credits over 30 days**, you never lose a day's progress if you prefer to photograph clothes in batches. After just **5 days**, you will have **50 AI credits**—the exact amount needed to digitize a complete 50-item Free Plan closet!

---

## 2. Garment Photography Best Practices

DressApp’s **GarmentVision** pipeline automatically removes backgrounds, extracts fabric colors, and identifies garment cuts. Taking clean, consistent flat-lay photos ensures 100% accurate cutouts and color detection on the first try—saving your **5 Nano Banana Reconstruction Credits** for truly tricky garments.

### The 4 Golden Rules of Flat-Lay Photography

1. **Use a Bright Area & a Contrasting Mat**
   - Lay the garment flat on the floor in a bright, naturally well-lit room.
   - Place the garment on a **contrasting-color mat or surface** (for example, use a dark mat or wood floor for white, cream, or pastel clothes, and a light neutral sheet or mat for black, navy, or dark garments).
   - High edge contrast lets the segmentation engine trace hems, collars, and straps cleanly while rejecting background surface colors.

2. **Center the Garment Straight with Small Margins**
   - Smooth out folds and wrinkles, and spread sleeves, legs, or straps naturally so the full silhouette is visible.
   - Align the garment **straight in the center of the camera frame**, leaving **small, even margins** around all four edges. Avoid cropping off collars, cuffs, or hemlines, and avoid standing too far back.

3. **Cast Zero Shadows on the Garment**
   - Check your stance before tapping the shutter to make sure neither your body nor your phone casts a shadow across the fabric.
   - Shadows alter perceived color temperature (turning white into grey or navy into black) and can confuse fabric texture detection. Indirect daylight near a window or even overhead room lighting works best.

4. **Hold Steady While Taking the Shot**
   - Hold your phone parallel to the floor directly above the garment and **stay completely still** when pressing the shutter.
   - A crisp, motion-free frame allows the on-premises vision model to distinguish fine weaves (such as linen vs. cotton, or wool vs. synthetic knit) and subtle patterns.

---

## 3. Closet Digitizing: 5-Day Onboarding Plans

Digitizing an entire wardrobe at once can feel overwhelming. By breaking your closet into **5 logical daily categories (10 items per day)**—or photographing one shelf a day and batch-uploading on Day 5—you can digitize your **50 core wardrobe essentials in 5 days** using your free daily On-Premises AI Credits.

### Option A: The "10 Items a Day" Steady Plan (10 Credits / Day)

Upload and verify 10 garments each day in under 6 minutes:

| Day | Focus Category | Target Items (10 Garments) | Credits Used |
| :--- | :--- | :--- | :--- |
| **Day 1** | **Core Bottoms** | Your 10 most-worn jeans, chinos, tailored trousers, skirts, and shorts | 10 credits |
| **Day 2** | **Everyday Tops & Tees** | 10 foundational T-shirts, polos, tank tops, and casual blouses | 10 credits |
| **Day 3** | **Smart Shirts, Knitwear & Dresses** | 10 button-down shirts, sweaters, cardigans, or one-piece dresses | 10 credits |
| **Day 4** | **Outerwear & Layering Pieces** | 10 blazers, jackets, coats, overshirts, and vests | 10 credits |
| **Day 5** | **Footwear & Signature Accessories** | 6–7 essential pairs of shoes (sneakers, loafers, boots, dress shoes/heels) + 3–4 belts, bags, or headwear | 10 credits |

### Option B: The "Shelf-by-Shelf Accumulator" Batch Plan (50 Credits on Day 5)

If you prefer to separate photography from app uploading, take advantage of **30-day credit accumulation**:

- **Days 1–4 (Photograph & Accumulate):** Spend 5 minutes each day photographing one shelf or category (Day 1: Jeans & Pants; Day 2: Tees & Tops; Day 3: Shirts & Knitwear; Day 4: Jackets & Shoes) into a dedicated album on your phone. While you shoot, your On-Premises AI Credits automatically accumulate (**10 → 20 → 30 → 40 credits**).
- **Day 5 (Batch Upload 50 Garments):** On Day 5, your balance reaches **50 On-Premises AI Credits**. Open **Add Item**, select your photographed garments (or use multi-garment photos where 5 garments in one frame cost 5 credits), and digitize your entire 50-item core wardrobe in one sitting!

---

## 4. Item Editing: Always Inspect & Verify Newly Uploaded Garments

> [!IMPORTANT]
> **Basic and advanced AI Stylist functions depend directly on accurate garment metadata.** Make it a habit to open every newly uploaded item card, review its extracted tags, and fix any errors manually right away.

When the On-Premises AI Stylist builds an outfit or packs a suitcase, it does **not** re-examine your raw photos every time—it reads the structured metadata stored on each item card. Furthermore, DressApp’s **Stylist QA Engine** enforces strict anatomical and dress-code rules before authorizing any outfit.

### The 5 Metadata Fields to Check on Every New Item

1. **Category & Sub-Category** (`Top`, `Bottom`, `Outerwear`, `Full Body`, `Footwear`, `Accessories`)
   - *Why it matters:* Every outfit curated by the Stylist must contain a valid anatomical combination (`Top + Bottom + Footwear`, or `Full Body Dress + Footwear`). If a blazer is accidentally saved as a `Top` instead of `Outerwear`, or shorts are saved with the wrong sub-category, the QA Engine will block or misplace the item.
2. **Colors** (Primary & Secondary Fabric Colors)
   - *Why it matters:* Even with background rejection, extreme lighting can occasionally shift navy to black or cream to white. Correcting the color ensures accurate **60-30-10 color harmony** and prevents etiquette mistakes (such as wearing prohibited colors to formal or religious events).
3. **Material / Fabric** (`Cotton`, `Linen`, `Wool`, `Denim`, `Leather`, `Silk`, etc.)
   - *Why it matters:* Used for weather-appropriate layering (breathable linen/cotton in summer heat vs. insulating wool in winter) and cultural rules (such as non-leather footwear requirements on Yom Kippur, Tisha B'Av, or inside Hindu temples).
4. **Dress Code / Formality** (`Casual`, `Smart-Casual`, `Business`, `Formal`, `Athletic`, `Traditional`)
   - *Why it matters:* The AI Stylist uses a strict **Formality Degradation Hierarchy** (Formal → Semi-Formal → Smart-Casual). Tagging your suit trousers as `Formal` and your chinos as `Smart-Casual` ensures the Stylist never recommends gym wear or cargo pants for a wedding or executive meeting.
5. **Season & Pattern** (`Spring`, `Summer`, `Fall`, `Winter` • `Solid`, `Striped`, `Plaid`, `Floral`)
   - *Why it matters:* Prevents pairing clashing patterns and keeps heavy winter coats out of warm-weather recommendations.

---

## 5. Stylist Prompts: How to Prompt the On-Premises AI Stylist for Best Results

Every AI Stylist prompt on the Free plan costs **1 On-Premises AI Credit**. Understanding how DressApp’s on-premises **Gemma / Eyes Stylist Brain** processes your message helps you get the exact outfit or wardrobe analysis you need in a single prompt.

### How the On-Premises Stylist Brain Works Under the Hood

When you send a message to the Stylist, DressApp runs a 4-stage pipeline:

1. **Native Language Translation:** You can write in any of DressApp’s 13 supported languages. The backend automatically translates your prompt into canonical English for the on-premises model and translates the resulting styling advice back into your language.
2. **Intent Routing (Outfit Curation vs. Wardrobe Audit Q&A):**
   - **Mode 1 — Outfit Curation ("Dress Me"):** Triggered when you ask *what to wear* or request a look. The model returns **1–2 complete, distinct outfits** built strictly from items in your closet, complete with styling rationale and Do's & Don'ts.
   - **Mode 2 — Analytical Wardrobe Audit ("Audit My Closet"):** Triggered when you ask *what basic essentials am I missing?*, *audit my closet*, or *what should I buy to complete my wardrobe?*. Instead of generating mannequin outfits, the engine analyzes your category distribution across **4 Essential Wardrobe Pillars** (Formal Tailoring, Smart-Casual Core, Outerwear & Weather, Footwear & Accessories) and returns **5–7 concrete missing garment specifications**.
3. **4-Signal Fashion RAG Retrieval & Pre-Filtering:**
   - Before the AI model generates an answer, DressApp’s Fashion Knowledge Base scans your prompt for **4 key signals**:
     1. **Occasion / Activity** (e.g., *job interview, wedding guest, date night, restaurant dinner, black-tie gala, DIY chores, hiking*)
     2. **Cultural, Religious, or Regional Protocol** (e.g., *Shabbat, Shiva mourning, Synagogue, Church/Vatican, Mosque/Jumu'ah, Hindu wedding/temple, Buddhist temple, Sikh Gurdwara*)
     3. **Weather & Temperature** (e.g., *rainy, cold 8°C evening, hot humid afternoon*)
     4. **Anchor Garment or Palette Preference** (e.g., *build around my navy blazer, earth tones, smart-casual*)
   - Any closet items that violate the occasion’s etiquette (such as shorts, graphic tees, or flip-flops for a formal or sacred venue) are automatically filtered out before styling.
4. **Autonomous QA Verification:** Finally, the Stylist QA Engine verifies that every recommended outfit has a valid top, bottom (or dress), and footwear from your actual closet inventory.

### The Winning 4-Part Prompt Structure

To get the sharpest recommendation in **1 credit**, structure your prompt using this simple formula:

> **`[1. Goal / Intent]` + `[2. Specific Occasion & Venue]` + `[3. Weather / Time of Day]` + `[4. Optional Anchor Item or Style Preference]`**

### Best-Practice Prompt Templates

#### A. Requesting a Complete Outfit (Mode 1 — Curation)
* **Good Prompt:** *"Build an outfit for a business-formal job interview in finance tomorrow morning. It will be cool and rainy (12°C). Prefer a navy and white palette."*
* **Why it works:** Triggers business-formal tailoring rules, activates precipitation/rain outerwear rules, and anchors the color harmony.

#### B. Styling Around a Specific Closet Item
* **Good Prompt:** *"What should I wear for a smart-casual dinner date tonight using my olive chinos? Warm evening weather."*
* **Why it works:** Tells the Stylist to lock in your olive chinos as the `bottom` role and curate a matching shirt, footwear, and accessory for a smart-casual romantic setting.

#### C. Cultural, Religious, or Travel Etiquette Outfits
* **Good Prompt:** *"Recommend a respectful outfit from my closet for visiting a church in Rome on a sunny afternoon."* (or *"What should I wear to a Shiva condolence visit?"* / *"Build a festive outfit for a Hindu wedding sangeet."*)
* **Why it works:** Directly triggers DressApp’s cultural and modesty RAG rules, automatically filtering out forbidden items (like shorts, sleeveless tops, or loud graphics) and selecting appropriate modest or festive attire.

#### D. Auditing Your Wardrobe for Missing Essentials (Mode 2 — Audit Q&A)
* **Good Prompt:** *"Audit my closet and tell me what basic wardrobe essentials I am missing to complete a versatile smart-casual and formal capsule."*
* **Why it works:** Explicitly activates **Analytical / Wardrobe Essentials Mode**, returning a concise overview of your current closet strengths plus 5–7 specific garment specifications to complete your wardrobe.

### Common Prompt Pitfalls to Avoid

* **Avoid ultra-vague one-word prompts** like *"Outfit"* or *"Help"*—without an occasion or vibe, the Stylist can only guess your day’s dress code.
* **Don't mix an audit request with an outfit request in the same message**—ask *"What should I wear to a wedding?"* in one turn (1 credit) and *"What basic essentials am I missing in my closet?"* in a separate turn (1 credit) so the Intent Router can give you the full output for each mode.
* **Keep Profile Details Updated:** Make sure your **Gender/Sex**, **Modesty Level**, and **Location** are saved in your Profile—the On-Premises Stylist automatically uses them on every turn so you never have to repeat them in your prompt!
