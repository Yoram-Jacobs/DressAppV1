---
description: Automatically deep-crawls the frontend UI using the Browser subagent, profiles performance (TTFB, TTF), and captures state screenshots across all locales.
---

# Browser UI/UX Crawler Workflow

This workflow automates deep-crawling of the DressApp frontend UI, profiling performance metrics, verifying language/i18n state transitions across all 12 locales, and capturing visual render snapshots.

## Steps

### General: Never hallucinate or invent facts. Report it as an error instead.

### 1. Initialization and Authentication
*   **Target URL**: Open the DressApp frontend (default: `https://dressapp.co/`) in the Antigravity Browser.
*   **Authentication Bypass**: Find the 'Continue as dev user' developer bypass button to access authenticated views.
*   **Viewport Configuration**: Ensure viewports are configured for desktop (1440x900) or mobile web (375x812) responsiveness to test layouts.

### 2. Deep UI Crawling & Action Actuation
*   **Element Discovery**: Walk the DOM tree recursively to identify all interactive components (buttons, links, select inputs, dropdown tabs, and modal triggers).
*   **Sequential Interaction**: Systematically click through navigation views:
    *   **Closet Page**: Trigger filters, category views, and the search bar.
    *   **Stylist Page**: Cycle through AI Chat, Dress Me (vertical shuffler), and Daily Match tabs.
    *   **Marketplace Page**: Open listings, inspect items, and click "Style with my Wardrobe" to open the styling sandbox.
    *   **Profile Page**: Open settings, view wardrobe stats, and check unit/preference options.
*   **Locale Iteration**: Change languages to verify that standard dictionary strings load successfully and that layout elements do not break or overflow.

### 3. Metric Recording & Error Logging
*   **Performance Monitoring**: Trace network interactions and load metrics:
    *   Measure Time to First Byte (TTFB) and Time to Fetch (TTF) for asset pipelines and segmented crops.
    *   Log any slow-performing endpoints (e.g. SegFormer/Gemini-heavy analysis endpoints taking > 15s).
*   **Console Auditing**: Monitor Chrome console outputs for React/JS warnings, network failures (4xx, 5xx), and uncaught exceptions.

### 4. Screenshot Capture & Archiving
*   **Save Location**: Save state screenshots to a timestamped folder inside `frontend/Tests/Screenshots/YYYY-MM-DD_HH-MM-SS/`.
*   **Filename Rules**: Name screenshots clearly based on page state and locale (e.g., `closet_en.png`, `stylist_chat_he.png`, `market_sandbox_overflow_error.png`).
*   **Classification**: Label snapshots as `Good` or `Bad` (for layout overflows, empty elements, or slow renders).

### 5. Report Compilation & Summary
*   **Artifact Generation**: Create a detailed markdown **Artifact** summarizing the crawl:
    *   Tabular list of crawled views.
    *   Average TTFB/TTF statistics and error counts.
    *   Visual catalog of captured screenshots.
*   **Conclusion**: Output a summary of found visual regressions, localization defects, and slow endpoints.