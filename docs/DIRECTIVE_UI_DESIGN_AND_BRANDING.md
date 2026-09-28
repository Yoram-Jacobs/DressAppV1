# Directive Document: DressApp UI Design & Branding System
## Mandatory Architecture & Styling Guidelines for Design Agents

> **Document Classification:** Canonical Design Directive  
> **Target Audience:** All UI/UX Designers, Frontend Engineers, and Autonomous Design Agents  
> **Scope:** Web Application (`apps/web`), Mobile Application (`apps/mobile`), Browser Extensions, and Marketing Surfaces  
> **Status:** Active & Enforced  

---

## 1. Executive Summary & Brand North Star

DressApp is an AI-powered personal fashion operating system designed to manage wardrobe assets throughout their entire lifecycle. The visual and interactive experience must reflect our core brand north star:

> ### The North Star
> *"Make every screen feel like a curated spread in an editorial boutique magazine: strong typography, generous negative space, tactile card surfaces, and fast, confident interactions—especially on mobile."*

### The Five Brand Personalities
Every component, screen layout, motion curve, and color choice must reflect these five pillars:
1. **Editorial Boutique Magazine**: High visual contrast, dramatic typographic hierarchy, and carefully art-directed composition. It feels like *Vogue* or *Monocle*, never like a sterile SaaS dashboard.
2. **Quiet-Luxury Minimal**: Elegance achieved through restraint. Soft ambient elevation, tactile borders, zero visual clutter, and absence of harsh drop shadows.
3. **Camera-First Utility Hidden Behind Polish**: Garment cutouts, automatic tagging, and visual wardrobe grids feel effortless. Complex computer vision and AI pipelines operate quietly in the background without clunky technical UI.
4. **Sustainability-Forward**: Circular economy cues (cost-per-wear analytics, swapping, resale, repair, and donation) are treated as first-class lifestyle choices, not guilt-driven warnings.
5. **AI as a Trusted Fashion Editor**: The conversational AI stylist behaves like a knowledgeable personal fashion director—calm, observant, and discerning. It never feels like a generic customer support chatbot.

---

## 2. Core Brand Prohibitions (Zero Tolerance)

Design agents and engineers **MUST NEVER** violate the following rules:

* 🛑 **NO PURPLE / INDIGO FOR AI SURFACES**: Modern tech apps over-rely on purple, lavender, and neon blue gradients for AI features. DressApp strictly forbids purple/violet palettes. AI and stylist surfaces must use **Ocean Teal (`#1F6F6B`)**, **Emerald Green (`#1F5C45`)**, **Persimmon (`#E8603C`)**, and **Ink Neutrals**.
* 🛑 **NO AI CLICHÉ EMOJIS**: Never use robot or sparkle emojis (🤖, 🧠, 💡, 🔮) in UI headers, buttons, or assistant messages. Use clean, geometric Lucide icons (e.g., `Sparkles`, `Wand2`, `Shirt`, `Layers`, `Eye`) or typography labels.
* 🛑 **NO TEXT OVER GRADIENTS**: Never render readable copy, metrics, or labels directly on top of gradient backgrounds. All text must sit on solid, accessible card surfaces (`bg-card` or `bg-background`).
* 🛑 **NO HARSH PURE-BLACK SHADOWS**: Never use saturated or high-spread drop shadows (`box-shadow: 0 10px 20px #000000`). Use soft, layered ambient shadows with subtle keylines (`--shadow-sm`, `--shadow-md`).
* 🛑 **NO RAW HTML FORM CONTROLS**: Never render unstyled `<select>`, `<dialog>`, or alert boxes. Always use the standardized Shadcn/UI component primitives from `/app/frontend/src/components/ui/`.
* 🛑 **NO UNCONSTRAINED `transition: all`**: Never use generic `transition: all` as it causes layout thrashing and breaks coordinate transforms. Specify exact properties (e.g., `transition: transform 160ms ease, opacity 160ms ease`).

---

## 3. Canonical Design Tokens & Color Palette

### 3.1 Color System Specifications

The DressApp color system is inspired by high-end paper, organic textiles, and natural mineral dyes:

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           COLOR TOKEN PALETTE                          │
  ├───────────────┬───────────┬──────────────────┬─────────────────────────┤
  │ Name          │ Hex       │ HSL Equivalent   │ Semantic Role           │
  ├───────────────┼───────────┼──────────────────┼─────────────────────────┤
  │ Paper         │ #FBF8F2   │ 36 33% 97%       │ Primary Background      │
  │ Ink           │ #14161B   │ 222 22% 12%      │ Primary Foreground/Text │
  │ Ocean Teal    │ #1F6F6B   │ 174 44% 33%      │ Primary Accent & Focus  │
  │ Emerald Green │ #1F5C45   │ 153 49% 24%      │ Primary Brand Action    │
  │ Persimmon     │ #E8603C   │ 18 78% 56%       │ Warm Accent & Alerts    │
  │ Sand          │ #E9E1D6   │ 36 20% 93%       │ Secondary Surface       │
  │ Sea Glass     │ #BFD8D2   │ 170 30% 80%      │ Soft Badge/Pill Tint    │
  │ Graphite      │ #2A2E36   │ 222 14% 18%      │ Dark Mode Card Surface  │
  └───────────────┴───────────┴──────────────────┴─────────────────────────┘
```

### 3.2 CSS Custom Properties (`index.css`)

#### Light Mode (`:root`)
```css
:root {
  --background: 36 33% 97%;         /* Paper (#FBF8F2) */
  --foreground: 222 22% 12%;        /* Ink (#14161B) */

  --card: 0 0% 100%;                /* Pure White */
  --card-foreground: 222 22% 12%;

  --popover: 0 0% 100%;
  --popover-foreground: 222 22% 12%;

  --primary: 153 49% 24%;           /* Emerald Forest Green (#1F5C45) */
  --primary-foreground: 0 0% 100%;

  --secondary: 36 20% 93%;          /* Sand (#E9E1D6) */
  --secondary-foreground: 222 22% 12%;

  --muted: 36 18% 92%;
  --muted-foreground: 222 10% 42%;

  --accent: 174 44% 33%;            /* Ocean Teal (#1F6F6B) */
  --accent-foreground: 0 0% 100%;

  --persimmon: 18 78% 56%;          /* Persimmon (#E8603C) */
  --destructive: 0 72% 52%;
  --destructive-foreground: 0 0% 100%;

  --border: 30 14% 86%;
  --input: 30 14% 86%;
  --ring: 174 44% 33%;

  --radius: 0.9rem;
}
```

#### Dark Mode (`.dark`)
```css
.dark {
  --background: 222 22% 8%;         /* Deep Ink Charcoal */
  --foreground: 36 33% 97%;         /* Paper White */

  --card: 222 22% 10%;              /* Dark Graphite */
  --card-foreground: 36 33% 97%;

  --popover: 222 22% 10%;
  --popover-foreground: 36 33% 97%;

  --primary: 36 33% 97%;
  --primary-foreground: 222 22% 10%;

  --secondary: 222 16% 14%;
  --secondary-foreground: 36 33% 97%;

  --muted: 222 16% 14%;
  --muted-foreground: 36 10% 72%;

  --accent: 174 46% 38%;            /* Luminous Ocean Teal */
  --accent-foreground: 222 22% 8%;

  --destructive: 0 62% 42%;
  --destructive-foreground: 0 0% 100%;

  --border: 222 14% 18%;
  --input: 222 14% 18%;
  --ring: 174 46% 38%;
}
```

### 3.3 Decorative Gradients & Hero Washes
* **Rule**: Gradients are decorative only and must occupy **less than 20% of the viewport**.
* **Usage**: Top-of-screen ambient washes behind headers or section divider accents.
* **Approved Hero Wash**:
  ```css
  /* Light Mode Hero Ambient */
  background-image: 
    radial-gradient(900px circle at 20% 10%, rgba(31, 111, 107, 0.14), transparent 55%),
    radial-gradient(700px circle at 85% 0%, rgba(232, 96, 60, 0.10), transparent 50%);

  /* Dark Mode Hero Ambient */
  background-image: 
    radial-gradient(900px circle at 20% 10%, rgba(31, 111, 107, 0.22), transparent 55%),
    radial-gradient(700px circle at 85% 0%, rgba(232, 96, 60, 0.14), transparent 50%);
  ```

---

## 4. Typography Hierarchy & Multilingual Standardization

### 4.1 Font Families
* **Display / Editorial Titles**: `Plus Jakarta Sans` / `Gloock`
  - High-impact, elegant letterforms with tight tracking (`tracking-[-0.02em]`).
  - Font Variable: `--font-display: "Plus Jakarta Sans", 'Heebo', 'Assistant', 'Cairo', sans-serif;`
* **Body & Interactive UI**: `Plus Jakarta Sans` / `Manrope`
  - Clean, open geometric grotesque for high readability on dense mobile screens.
  - Font Variable: `--font-body: "Plus Jakarta Sans", 'Heebo', 'Assistant', 'Rubik', 'Cairo', sans-serif;`

> **Note on RTL & Non-Latin Scripts:**  
> Plus Jakarta Sans is paired with Heebo/Assistant (Hebrew) and Cairo/Rubik (Arabic) to guarantee uniform vertical alignment, eliminating baseline shifts and text clipping when toggling between languages.

### 4.2 Type Scale (Tailwind Class Matrix)

| Level | Classes | Font Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Hero H1** | `text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.02em]` | 800 | `1.02` | Major page banners & landing heroes |
| **Editorial H2** | `text-2xl sm:text-3xl font-bold tracking-[-0.015em]` | 700 | `1.15` | Section headers & feature titles |
| **Section Title** | `text-xl sm:text-2xl font-semibold tracking-[-0.01em]` | 600 | `1.25` | Modal titles, card cluster headers |
| **Body (Default)** | `text-sm sm:text-base leading-relaxed` | 400 / 500 | `1.6` | Narrative paragraphs & dialog descriptions |
| **Small / Caption** | `text-xs sm:text-sm text-muted-foreground` | 400 | `1.4` | Timestamps, secondary metadata |
| **Caps Label** | `text-[11px] uppercase tracking-[0.18em] font-semibold` | 600 | `1.0` | Category badges, status chips, breadcrumbs |

---

## 5. Spacing, Elevation & Tactile Surfaces

### 5.1 The 2–3× Whitespace Golden Rule
* **Base Unit**: 4px.
* **Vertical Section Rhythm**: Maintain 24px–32px minimum vertical spacing between cards and content modules (`py-8 sm:py-12`, section gaps `gap-6` to `gap-8`).
* **Design Philosophy**: *"Cramped layouts feel cheap; generous whitespace conveys quiet luxury."* Give every visual garment room to breathe.

### 5.2 Container Dimensions
* **Mobile Container**: `px-4 max-w-[480px] mx-auto`.
* **Tablet / Form Layouts**: `max-w-2xl px-6 mx-auto`.
* **Desktop Editorial & Dashboards**: `max-w-6xl px-6 mx-auto`.
* **Safe Area Padding**: Mobile bottom navigation requires explicit clearance:
  ```css
  padding-bottom: calc(env(safe-area-inset-bottom) + 88px);
  ```

### 5.3 Radii & Tactile Borders
```css
--radius: 0.9rem;                        /* Base 14.4px */
Card Radius:     rounded-[calc(var(--radius)+6px)]; /* ~20px */
Button Radius:   rounded-xl;             /* 12px */
Chip / Badge:    rounded-full;           /* 9999px */
Drawer / Sheet:  rounded-t-[28px];       /* Top sheet curve */
```

### 5.4 Elevation & Ambient Shadows
Never apply harsh black drop shadows. Use dual-layer ambient elevation:
* **Card Elevation (`--shadow-sm`)**:
  `box-shadow: 0 1px 0 rgba(20,22,27,0.06), 0 8px 24px rgba(20,22,27,0.06);`
* **Modal / Sheet Elevation (`--shadow-md`)**:
  `box-shadow: 0 1px 0 rgba(20,22,27,0.08), 0 18px 50px rgba(20,22,27,0.10);`
* **Focus Ring (`--shadow-focus`)**:
  `box-shadow: 0 0 0 4px rgba(31,111,107,0.22);`

### 5.5 Tactile Print Noise Texture
To avoid flat digital sterility and evoke physical editorial paper, hero containers and large image showcases should incorporate subtle fractal noise:
```css
.noise::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Cfilter id="n"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="120" height="120" filter="url(%23n)" opacity="0.08"/%3E%3C/svg%3E');
  mix-blend-mode: multiply;
  pointer-events: none;
  border-radius: inherit;
}
```
*Note: Never apply noise texture over dense text reading areas.*

---

## 6. Component Blueprints & Patterns

### 6.1 Buttons & Interactive Triggers
```jsx
// Primary Action Button (Editorial Luxury Style)
<Button 
  data-testid="primary-action-btn"
  className="rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5 shadow-[var(--shadow-sm)] transition-smooth hover:bg-primary/92 hover:-translate-y-[1px] active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
>
  {label}
</Button>

// Secondary / Subtle Action Button
<Button 
  variant="secondary"
  data-testid="secondary-action-btn"
  className="rounded-xl border border-border bg-card text-foreground font-medium hover:bg-secondary transition-smooth"
>
  {label}
</Button>
```

### 6.2 Garment & Item Cards
* **The Transparency Invariant**: Garment assets must always be transparent PNG cutouts (`clean_image_url`). Never display garments with white solid bounding boxes.
* **Layout**: Image pinned to the top inside an `AspectRatio` container; metadata sits on a solid card surface below.
```jsx
<Card className="rounded-[calc(var(--radius)+6px)] border border-border bg-card overflow-hidden shadow-[var(--shadow-sm)] hover:border-accent/40 transition-smooth">
  <div className="relative aspect-[3/4] w-full bg-secondary/40 flex items-center justify-center p-4">
    <img 
      src={clean_image_url} 
      alt={name} 
      className="max-h-full max-w-full object-contain filter drop-shadow-sm" 
    />
    <Badge className="absolute top-3 end-3 caps-label bg-background/80 backdrop-blur border-border text-foreground">
      {season}
    </Badge>
  </div>
  <div className="p-4">
    <h4 className="text-sm font-semibold truncate text-foreground">{name}</h4>
    <p className="text-xs text-muted-foreground mt-1">{brand} • {category}</p>
    <div className="mt-3 flex items-center justify-between text-xs">
      <span className="text-accent font-medium">{costPerWear}</span>
      <span className="text-muted-foreground">{wearCount} wears</span>
    </div>
  </div>
</Card>
```

### 6.3 Source & Status Badges
Badges communicate category and origin with intentional color coding:
* **Private Closet Item**: `bg-secondary border border-border text-foreground`
* **Shared / Community Item**: `bg-accent/10 text-accent border border-accent/25`
* **Retail / Shopping Partner**: `bg-[rgba(232,96,60,0.10)] text-[rgb(232,96,60)] border border-[rgba(232,96,60,0.25)]`
* **Sustainability / Circular**: `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20`

### 6.4 Fixed Mobile Navigation (5-Tab Bar)
Mobile navigation is fixed to the bottom viewport with safe-area spacing:
* **Height**: 64px + `env(safe-area-inset-bottom)`.
* **Surface**: `bg-background/95 backdrop-blur border-t border-border`.
* **The 5 Core Tabs**:
  1. `Home` (`/home`)
  2. `Closet` (`/closet`)
  3. `Stylist` (`/stylist`)
  4. `Market` (`/market`)
  5. `Me` (`/me`)
* **Active Indicator**: Accent dot or subtle bottom keyline with filled icon (`text-accent`). Touch targets must satisfy the minimum 44px standard.

---

## 7. Motion & Micro-Interactions (Framer Motion)

Animations must feel mechanical and intentional, evoking the physical tactile snap of luxury goods:

| Animation Type | Duration | Easing Curve | Motion Formula |
| :--- | :--- | :--- | :--- |
| **Micro Lift / Hover** | 120ms–160ms | `[0.2, 0.8, 0.2, 1]` | `translateY(-1px)` |
| **Button Click / Tap** | 80ms–100ms | `[0.2, 0.8, 0.2, 1]` | `scale(0.98)` |
| **Card Transition** | 180ms–240ms | `[0.2, 0.8, 0.2, 1]` | `opacity: 0 ➔ 1`, `y: 8px ➔ 0` |
| **Drawer / Sheet Slide** | 320ms–420ms | `[0.2, 0.8, 0.2, 1]` | `y: 100% ➔ 0%` + backdrop blur |

### Accessibility Guardrail: Reduced Motion
Always wrap transform transitions in `prefers-reduced-motion` checks:
```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 8. Internationalization (i18n) & RTL Layout Rules

DressApp supports **13 languages** with comprehensive Right-to-Left (RTL) mirroring for Hebrew (`he`) and Arabic (`ar`).

### 8.1 The Positional Argument Prohibition
* 🛑 **NEVER** write positional fallback strings: `t('key', 'Fallback string')`.
* ✅ **ALWAYS** use options-based syntax: `t('key', { defaultValue: 'Fallback string' })`.

### 8.2 Physical vs. Logical CSS Mapping (Mandatory RTL Compliance)
All design agents must strictly write **Logical CSS Classes**. Physical left/right properties break layout mirroring in Hebrew and Arabic:

| Forbidden Physical Class | Required Logical Replacement | Purpose |
| :--- | :--- | :--- |
| `ml-*` | `ms-*` | Margin Inline Start |
| `mr-*` | `me-*` | Margin Inline End |
| `pl-*` | `ps-*` | Padding Inline Start |
| `pr-*` | `pe-*` | Padding Inline End |
| `left-*` | `start-*` | Positioning Start |
| `right-*` | `end-*` | Positioning End |
| `text-left` | `text-start` | Text Alignment Start |
| `text-right` | `text-end` | Text Alignment End |

### 8.3 Directional Icon Mirroring
* **Must Mirror in RTL**: Chevrons, back/forward arrows, send buttons.
  ```jsx
  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
  ```
* **Must NEVER Mirror in RTL**: Media controls (play/pause), circular progress rings, checkmarks, star ratings, and brand wordmarks.

### 8.4 Bi-Directional Numeric Protection
Numerals, currency symbols, and dates stay LTR even inside RTL paragraphs. Wrap them with `<bdi>` or `dir="ltr"` to prevent text scrambling:
```jsx
<span className="text-foreground">
  <bdi dir="ltr">{formattedPrice}</bdi> {t('marketplace.perDay', { defaultValue: 'per day' })}
</span>
```

---

## 9. Testing & Quality Assurance Protocol (`data-testid`)

Every interactive element, filter control, and key data point must feature a standardized kebab-case `data-testid`:

```jsx
// Examples of Canonical Test IDs:
data-testid="bottom-tab-closet"
data-testid="closet-grid-item"
data-testid="closet-filter-category"
data-testid="stylist-input-textarea"
data-testid="stylist-send-button"
data-testid="marketplace-listing-card"
data-testid="avatar-try-on-canvas"
data-testid="suitcase-item-checkbox"
```

---

## 10. Design Agent Self-Check Gate (Pre-Ship Validation)

Before generating any frontend JSX, React component, or CSS stylesheet, every autonomous agent must verify:
1. [ ] **Color Check**: Are AI surfaces completely free of purple or violet hues? Are they anchored in Ocean Teal, Emerald Green, Persimmon, or Ink?
2. [ ] **Typography Check**: Is the font hierarchy rooted in `Plus Jakarta Sans` or `Gloock` with `tracking-[-0.02em]` on titles and `text-[11px] uppercase tracking-[0.18em]` on category pills?
3. [ ] **Whitespace Check**: Is there at least 24px–32px vertical breathing room between content sections?
4. [ ] **Elevation Check**: Are cards using `--shadow-sm` instead of pure black drop shadows?
5. [ ] **RTL Check**: Are all spacing and alignment classes logical (`ms-*`, `me-*`, `text-start`) with zero physical `ml-*` or `text-left` classes?
6. [ ] **Localization Check**: Is all user-facing text wrapped in `t('key', { defaultValue: '...' })`?
7. [ ] **Testability Check**: Does every interactive button, input, and card have a kebab-case `data-testid`?
