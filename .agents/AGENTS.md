# DressApp AI Agent Guide

Welcome, AI coding agent! This file defines the repository rules, design guidelines, and provides entry points to the project's knowledge base.

## Deployment Facts

**Read [CONCRETE_FACTS.md](file:///C:/DressApp_AG/CONCRETE_FACTS.md) at the start of every session.** It contains locked, never-changing facts about the DressApp deployment topology: VPS hardware, container layout, env vars, backend↔eyes wiring, and reference commands. Anything in that document is authoritative for production operations.

## Knowledge Base (Wiki)

To prevent context stuffing, the documentation for this repository is modularly structured inside the [wiki/](file:///C:/DressApp_AG/wiki/) directory. Please read the specific topic file corresponding to the module you are working on:

- **Overview**: [overview.md](file:///C:/DressApp_AG/wiki/en/overview.md) - High-level project summary.
- **Prerequisites**: [prerequisites.md](file:///C:/DressApp_AG/wiki/en/prerequisites.md) - Hardware and API key requirements.
- **Adding Clothes**: [adding_clothes.md](file:///C:/DressApp_AG/wiki/en/adding_clothes.md) - Scanner, photo cutout, and attributes pipeline.
- **Closet Management**: [closet_management.md](file:///C:/DressApp_AG/wiki/en/closet_management.md) - Grid browsing, grouping, and set logic.
- **AI Stylist**: [ai_stylist.md](file:///C:/DressApp_AG/wiki/en/ai_stylist.md) - Voice streaming and outfit generation pipeline.
- **Profile Management**: [profile_management.md](file:///C:/DressApp_AG/wiki/en/profile_management.md) - User parameters and Gemini model configuration.
- **Wardrobe Insights**: [wardrobe_insights.md](file:///C:/DressApp_AG/wiki/en/wardrobe_insights.md) - Statistics and color palette breakdowns.
- **Outfit Planner**: [outfit_planner.md](file:///C:/DressApp_AG/wiki/en/outfit_planner.md) - Outfit Canvas and layering interfaces.
- **Suitcase Packing**: [suitcase_packing.md](file:///C:/DressApp_AG/wiki/en/suitcase_packing.md) - Trip planning and packing list assistant.
- **Marketplace Listing**: [marketplace_listing.md](file:///C:/DressApp_AG/wiki/en/marketplace_listing.md) - Swap & sell listings and sandbox room.
- **Trend Scout**: [trend_scout.md](file:///C:/DressApp_AG/wiki/en/trend_scout.md) - Curated daily fashion feeds.
- **Experts Registry**: [experts_registry.md](file:///C:/DressApp_AG/wiki/en/experts_registry.md) - Certified professional stylist contact directory.
- **Troubleshooting**: [troubleshooting.md](file:///C:/DressApp_AG/wiki/en/troubleshooting.md) - Common errors and limits.
- **Pricing Plan**: [Pricing-Plane.md](file:///D:/ai/Emergent/Appendix/docs/Pricing-Plane.md) - Hybrid pricing model, tiers, credit system, and monetization strategy.

Note: Translations for all topic files are organized into language subdirectories (e.g. `he/` for Hebrew, `ar/` for Arabic, `de/` for German, etc.).

## Help File Rules

Every subject in the help tree (`HelpMenu.jsx`) follows a **two-layer structure**:

### Layer 1: Simplified Summary (HelpMenu.jsx)
- Displayed directly in the Help Menu UI
- Uses translation keys (e.g., `help.shopping_assistant_title`, `help.shopping_assistant_p1`, `help.shopping_assistant_step1` through `step6`)
- Content must be **concise, friendly, and easy to understand**
- Maximum 6 steps for any feature
- No technical jargon — focus on user actions and outcomes

### Layer 2: "Learn More" Detailed Guide (Wiki Markdown Files)
- Loaded when user clicks **"Learn More"** button
- Stored in `wiki/{language}/{topic}.md` (e.g., `wiki/en/shopping-assistant.md`)
- Content must be **comprehensive but accessible**
- Includes: Overview, Prerequisites, Step-by-Step instructions, Expected Results, Troubleshooting, Limitations
- Uses the same friendly, helpful tone as Layer 1 but provides deeper detail
- Must be translated to all 13 supported languages

### When Updating or Creating Help Files
1. **Always follow the two-layer structure** — Layer 1 in HelpMenu.jsx, Layer 2 in wiki markdown
2. **Maintain consistent tone** — friendly, helpful, user-focused
3. **Translate to all languages** — use `/translate` to translate after creating/updating the English version
4. **Test the "Learn More" link** — ensure the wiki file loads correctly from the Help Menu

## Available Skills

| Command | Skill | Description |
|---------|-------|-------------|
| `/translate` | [translator](skills/translator/SKILL.md) | Translate markdown, JSON locales, and user manuals into all 13 languages |
| `/prune` | [codebase-pruning](skills/codebase-pruning/SKILL.md) | Deep codebase pruning and dead-code elimination |
| `/strategy` | [strategy-consultant](skills/strategy-consultant/SKILL.md) | Strategic analysis and decision-making framework |
| `/i18n` | [i18next-localizer](skills/i18next-localizer/SKILL.md) | UI/UX inspection across 12 languages |
| `/uiux` | [uiux-designer-dressapp](skills/uiux-designer-dressapp/SKILL.md) | UI/UX design for DressApp screens |
| `/deploy` | [deploy-dressapp](skills/deploy-dressapp/SKILL.md) | Deployment and DevOps for DressApp |
| `/local-deploy` | [local-deploy](skills/local-deploy/SKILL.md) | Local container deployment and testing guide for DressApp in WSL |
| `/narrate` | [narrator](skills/narrator/SKILL.md) | Technical authoring and architectural overviews |
| `/compete` | [competitor-ux-strategist](skills/competitor-ux-strategist/SKILL.md) | Competitor UX analysis and strategy |
| `/pricing` | [pricing-strategist](skills/pricing-strategist/SKILL.md) | Pricing plan design, tier recommendations, credit system architecture |
| `/pricing-info` | [pricing](skills/pricing/SKILL.md) | AI credit management, billing, and subscription operations |
| `/billing` | [billing](skills/billing/SKILL.md) | Billing and payment processing services |
