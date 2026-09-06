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

### 2. Deep UI Crawling & Action Actuation (Task List)
Execute a systemic interaction pass across all primary views and their nested components. Capture a screenshot after each major state change.

*   **Home Dashboard (`/home`)**:
    *   Verify "Ask the stylist" and "Open closet" buttons.
    *   Verify dynamic pills (e.g., WEATHER-AWARE, CALENDAR-SMART).
    *   Click "Open" for "PIECES IN YOUR CLOSET" accordion/card.
    *   Click "Open" for "ACTIVE MARKETPLACE LISTINGS" accordion/card.
    *   Test floating action button (`+`).
*   **Closet Page (`/closet`)**:
    *   Trigger category filter drop-boxes (e.g., Tops, Bottoms, Shoes).
    *   Interact with the search bar.
    *   Click into a single item detail view (`/closet/:id`).
*   **Add Item / Camera Flow (`/closet/add`)**:
    *   Test file picker and camera actuation.
    *   Verify the single, 2-5 batch, and 6+ silent batch upload UI components.
*   **Stylist Page (`/stylist`)**:
    *   Cycle through top tabs: **Chat**, **Outfits**, **Daily Suggestion**.
    *   *Chat Tab*: Toggle "Include calendar" switch. Click "Ask a professional" button. Interact with text input box, image upload gallery button, and microphone icon.
    *   *Outfits Tab*: Trigger outfit shuffler or horizontal carousels.
    *   *Daily Suggestion Tab*: Verify weather/calendar-based suggestions.
*   **Marketplace Page (`/market`)**:
    *   Open and scroll through listing feeds.
    *   Click "Style with my Wardrobe" to open the styling sandbox modal.
    *   Navigate to Create Listing flow (`/market/create`).
*   **Profile / Settings (`/me`)**:
    *   Open unit/preference settings drop-boxes.
    *   Navigate to Wardrobe Stats (`/me/stats`) to verify chart renders.
    *   Navigate to Transactions (`/transactions`) and Avatar Page (`/avatar`).
*   **Global Elements**:
    *   Interact with bottom navigation bar (Closet, Stylist, Center Camera, Market, Me).
    *   Verify the global language switch overlay (top right globe icon).
    *   Monitor for toast notifications.
*   **Locale Iteration**: Change languages via the globe icon to verify that standard dictionary strings load successfully and that layout elements do not break or overflow.

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