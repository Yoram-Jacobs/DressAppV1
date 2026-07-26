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

Note: Translations for all topic files are organized into language subdirectories (e.g. `he/` for Hebrew, `ar/` for Arabic, `de/` for German, etc.).
