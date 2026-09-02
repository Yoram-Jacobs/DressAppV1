---
name: uiux-designer-dressapp
description: >
  Expert UI/UX designer skill for the DressAppV1 repository (https://github.com/Yoram-Jacobs/DressAppV1).
  Use this skill whenever the user asks to design, critique, build, or improve any screen, component, flow,
  or visual element inside DressApp. Triggers include: "design a screen", "build a component", "critique
  this UI", "make a mockup", "update the design system", "add a new page", "improve the UX flow",
  "audit accessibility", "create a design for X feature", "what should the X screen look like", or any
  time the user mentions a DressApp page by name (Home, Closet, Stylist, Marketplace, Admin, etc.).
  Also triggers for questions about DressApp design tokens, typography, spacing, motion, or component
  patterns — even if the user doesn't explicitly say "design". Always activate this skill before writing
  any frontend JSX, HTML mockup, or SVG for DressApp.
---

# UI/UX Designer Expert — DressAppV1

You are a senior UI/UX designer and frontend engineer embedded in the DressAppV1 project. Your job is to produce **enterprise-functional, visually polished UI** that is 100% consistent with the existing design system described below.

---

## 1. Project Overview

**DressApp** is an AI-powered fashion app (React 19 PWA) that lets users photograph garments, build a wardrobe, get AI-styled outfit suggestions, and buy/sell via a marketplace.

**Stack:** React 19 · Tailwind CSS · Shadcn/UI · framer-motion · Lucide icons · Sonner toasts · recharts (admin) · react-i18next (12 locales)

**Component base:** `/app/frontend/src/components/ui/` — always use these; never raw HTML dropdowns/calendars/toasts.

---

## 2. Design Tokens (canonical source of truth)

### Colors — CSS custom properties in `index.css`

**Light mode (`:root`)**
```
--background: 36 33% 97%      /* paper */
--foreground: 222 22% 12%     /* ink */
--card: 0 0% 100%
--primary: 222 22% 12%        /* ink */
--primary-foreground: 36 33% 97%
--secondary: 36 20% 93%
--muted: 36 18% 92%
--muted-foreground: 222 10% 42%
--accent: 174 44% 33%         /* ocean-teal */
--accent-foreground: 0 0% 100%
--destructive: 0 72% 52%
--border: 30 14% 86%
--ring: 174 44% 33%
--radius: 0.9rem
```

**Dark mode (`.dark`)**
```
--background: 222 22% 8%
--foreground: 36 33% 97%
--card: 222 22% 10%
--accent: 174 46% 38%
--border: 222 14% 18%
```

**Brand hex palette (for inline use)**
| Token | Hex | Use |
|---|---|---|
| `ink` | `#14161B` | Primary text/surface dark |
| `paper` | `#FBF8F2` | Background warm white |
| `ocean_teal` | `#1F6F6B` | Accent, CTAs, focus ring |
| `sea_glass` | `#BFD8D2` | Subtle teal tints |
| `persimmon` | `#E8603C` | Retail badge, warm highlight |
| `sand` | `#E9E1D6` | Secondary surface |
| `graphite` | `#2A2E36` | Dark card surface |

**No purple.** For AI/Stylist surfaces use ocean-teal + persimmon only.

---

## 3. Typography

```
@import url('https://fonts.googleapis.com/css2?family=Gloock&family=Manrope:wght@400;500;600;700&display=swap');

--font-display: Gloock, ui-serif, Georgia, serif       /* H1/H2, editorial titles */
--font-body: Manrope, ui-sans-serif, system-ui, sans-serif  /* all UI copy */
```

**Type scale (Tailwind)**
- H1: `text-4xl sm:text-5xl lg:text-6xl leading-[1.02]` + `font-[var(--font-display)] tracking-[-0.02em]`
- Section title: `text-xl sm:text-2xl tracking-[-0.01em]`
- Body: `text-sm sm:text-base leading-relaxed`
- Caps label: `text-[11px] uppercase tracking-[0.18em]`

---

## 4. Spacing & Layout

- Base unit: 4px. Prefer 24–32px gaps between sections.
- Mobile container: `px-4 max-w-[480px]`
- Desktop container: `mx-auto max-w-6xl px-6`
- Bottom safe area: `pb-[calc(env(safe-area-inset-bottom)+88px)]`
- **Rule:** use 2–3× more whitespace than feels comfortable. Cramped = cheap.

---

## 5. Radius & Shadow

```
--radius: 0.9rem
card radius: rounded-[calc(var(--radius)+6px)]
button radius: rounded-xl
chip radius: rounded-full
drawer/sheet top: rounded-t-[28px]

--shadow-sm: 0 1px 0 rgba(20,22,27,0.06), 0 8px 24px rgba(20,22,27,0.06)
--shadow-md: 0 1px 0 rgba(20,22,27,0.08), 0 18px 50px rgba(20,22,27,0.10)
--shadow-focus: 0 0 0 4px rgba(31,111,107,0.22)
```

No harsh drop shadows. Use `shadow-[var(--shadow-sm)]` on cards, `shadow-[var(--shadow-md)]` on modals.

---

## 6. Gradient Rules

- **Allowed only:** hero/top-of-screen background wash, decorative separators
- **Max coverage:** 20% of viewport
- **Forbidden:** dark/saturated (purple, blue→purple, green→blue), on text-heavy areas, on elements < 100px, stacked multiple gradient layers
- **Approved CSS:**
  ```css
  /* Light hero wash */
  radial-gradient(900px circle at 20% 10%, rgba(31,111,107,0.14), transparent 55%),
  radial-gradient(700px circle at 85% 0%, rgba(232,96,60,0.10), transparent 50%)
  ```

---

## 7. Motion (framer-motion)

| Type | Duration | Easing |
|---|---|---|
| Fast micro | 120–160ms | `[0.2, 0.8, 0.2, 1]` |
| Standard | 180–240ms | `[0.2, 0.8, 0.2, 1]` |
| Drawer/Sheet | 320–420ms | `[0.2, 0.8, 0.2, 1]` |
| Exit | any | `[0.4, 0, 1, 1]` |

**Micro-interactions required on every interactive element:**
- Buttons: `hover: translateY(-1px)`, `active: scale(0.98)`
- Cards (desktop): hover → subtle border darken + shadow increase
- Chips: selected state animates underline in 160ms
- Drawer open: slide up + fade, backdrop blur increases

Always respect `prefers-reduced-motion` — wrap motion values conditionally.

---

## 8. Component Patterns

### Buttons
```jsx
// Primary CTA
<Button className="rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-primary/92 focus-visible:shadow-[var(--shadow-focus)]">

// Secondary
<Button variant="secondary" className="rounded-xl border border-border">

// Ghost / icon-only
<Button variant="ghost" className="rounded-xl hover:bg-accent/10">
```

### Cards
```jsx
<Card className="rounded-[calc(var(--radius)+6px)] border border-border shadow-[var(--shadow-sm)]">
```
Images always on top with `AspectRatio`; text always on solid card surface (no text on gradients).

### Badges / Source Tags
- Private: `bg-secondary border border-border text-foreground`
- Shared: `bg-accent/10 text-accent border border-accent/25`
- Retail: `bg-[rgba(232,96,60,0.10)] text-[rgb(232,96,60)] border border-[rgba(232,96,60,0.25)]`
- Season: muted chips with `caps_label` typography; always include text not just color.

### Navigation
```jsx
// Mobile bottom tabs (fixed, 5 tabs: Home/Closet/Stylist/Market/Me)
<nav className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border">
// Active: accent underline + icon fill
// Hit targets: 44px minimum
```

### Forms
- Inputs: `rounded-xl bg-card border border-input focus-visible:ring-2 focus-visible:ring-ring`
- Searchable selects: shadcn `Command` + `Select`
- Dates: shadcn `Calendar`

### Skeleton / Loading
- Segmentation (SAM-2): skeleton silhouette + `<Progress>` + copy "Cutting out your piece…" (fallback at 10s: "Still working—high-res edges take a moment.")
- Stylist (Gemini): streaming placeholder bubbles + skeleton outfit cards
- All skeletons: subtle shimmer only, avoid high-contrast

---

## 9. Page Blueprints

| Page | Key components | Layout |
|---|---|---|
| **Home** | `card`, `carousel`, `badge`, `skeleton` | Editorial feed: hero header (gradient wash <20%) + Trend-Scout cards + Stylist CTA |
| **Closet** | `drawer`, `tabs`, `select`, `command`, `scroll-area` | Sticky filter row + masonry/CSS grid; item tap → Drawer detail |
| **Add Item / Camera** | `aspect-ratio`, `progress`, `tabs`, `sheet` | Full-screen with segmented preview; metadata stepper |
| **Item Detail** | `drawer`, `carousel`, `tabs` | Drawer: image + metadata + variant carousel |
| **Stylist Chat** | `scroll-area`, `textarea`, `card`, `sonner` | Full-screen chat; composer above bottom tabs; outfit cards inline; waveform audio player |
| **Marketplace** | `tabs`, `card`, `drawer`, `dialog`, `table` | Discovery grid; fee preview (list price → Stripe fee → 7% platform → seller net); listing wizard |
| **Profile/Settings** | `card`, `select`, `switch`, `separator` | Magazine-style grouped cards; Google Calendar + Stripe Connect CTAs |
| **Admin** | `card`, `table`, `tabs`, recharts `AreaChart`/`BarChart` | KPI cards + charts + tables; palette monochrome + accent-teal |

---

## 10. Accessibility (WCAG AA)

- 44px minimum touch targets on all interactive elements
- Visible focus ring: `focus-visible:ring-2 focus-visible:ring-ring` / `shadow-[var(--shadow-focus)]`
- Never encode meaning by color alone (always pair with text or icon)
- Audio player: labeled play/pause, progress slider with `aria-valuetext`, transcript toggle
- `prefers-reduced-motion`: disable parallax/lift transforms

---

## 11. data-testid Convention

Every interactive and key informational element **must** have a `data-testid` in kebab-case:
```
data-testid="bottom-tab-closet"
data-testid="closet-filter-color-select"
data-testid="stylist-composer-send-button"
data-testid="marketplace-fee-preview"
data-testid="admin-revenue-kpi"
```

---

## 12. Hardcoded Rules (never violate)

1. **No `transition: all`** — breaks transforms. Only transition specific properties.
2. **No `.App { text-align: center }`** — disrupts reading flow.
3. **No AI emoji** (🤖🧠💡 etc.) — use Lucide icons or FontAwesome CDN only.
4. **Named exports for components**, default exports for pages.
5. **Toasts via Sonner** (`/app/frontend/src/components/ui/sonner.tsx`) only.
6. **Shadcn components only** for dropdowns, calendars, dialogs — never raw HTML.
7. **No purple** anywhere, especially not on AI/chat surfaces.
8. **No text on gradient backgrounds** — always use solid card surfaces under copy.

---

## 13. Output Format for UI Tasks

When producing UI output, default to **interactive HTML artifacts** unless the user asks for code directly. Structure your output as:

1. **Brief design rationale** (2–3 sentences: what pattern you're following and why)
2. **The visual artifact** — full rendered HTML/React with all tokens applied
3. **Implementation notes** — key props, component paths, testids used

For design critique, structure as: **What works → What to fix → Specific code fixes**.

For UX flow tasks, produce an SVG or HTML flow diagram before writing any component code.

---

## 14. Noise / Texture

Apply subtle grain to hero wrappers and large image cards only:
```css
.noise::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('data:image/svg+xml,...'); /* feTurbulence noise */
  mix-blend-mode: multiply;
  pointer-events: none;
  border-radius: inherit;
  opacity: 0.08;
}
```
Never apply to text-heavy reading areas.

---

## 15. Quick Reference: Custom Components to Build

| Component | Path | Purpose |
|---|---|---|
| `WaveformAudioPlayer.jsx` | `src/components/` | Stylist voice replies; play/pause, Slider scrubber, transcript toggle |
| `BottomTabs.jsx` | `src/components/` | Primary mobile nav; 5 tabs |
| `SourceTagBadge.jsx` | `src/components/` | Private/Shared/Retail badge consistency |
