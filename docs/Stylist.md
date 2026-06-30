# DressApp AI Stylist: Architecture, User Manual & Technology Guide

This document provides an in-depth architectural analysis, operational user manual, and technical specification for the **DressApp AI Stylist** ecosystem, anchored by `frontend/src/pages/Stylist.jsx` and its supporting frontend/backend services.

---

## 1. Executive Summary & Value Proposition

The DressApp AI Stylist is an advanced, multimodal artificial intelligence styling consultant and automated wardrobe manager. Designed to function as both a highly personalized fashion advisor and an intelligent wardrobe optimizer, it operates seamlessly across text, voice, images, and environmental context.

```mermaid
graph TD
    UI[Stylist.jsx UI] -->|Multimodal Input| API[/api/v1/stylist]
    API --> Logic[logic.py Orchestrator]
    Logic --> Context[Context Aggregator]
    Context -->|Weather| W[weather_service.py]
    Context -->|Calendar| C[calendar_service.py]
    Context -->|Prefs| P[user_preferences.py]
    Logic --> Brain[stylist_brain.py / Gemini 2.5 Pro]
    Brain --> Widen[stylist_widen.py / Horizon Expansion]
    Widen -->|Marketplace| M[marketplace_search]
    Widen -->|Trends| T[trend_scout]
    Widen -->|Nano Banana| NB[Generative Visualizations]
```

### Key Points & Core Architecture
* **Triple-Tab Workspace Layout**: The interface is divided into three specialized workspaces: Conversational Chat (`chat`), Outfit Planner / Power-Up Composer (`shuffle`), and Daily Suggestions / Scheduler (`match`).
* **Multi-Layered Context**: Every AI recommendation dynamically synthesizes user input with real-time external data streams, including hyper-local weather conditions, upcoming Google Calendar events, personal style profiles, regional modesty/cultural constraints, and full closet inventory summaries.
* **Flawless Internationalization (i18n)**: Fully localized across 12 languages (`en`, `he`, `ar`, `de`, `es`, `fr`, `hi`, `it`, `ja`, `pt`, `ru`, `zh`) with integrated Right-to-Left (RTL) mirroring, dynamic auto-layout text wrapping, and locale-aware date formatting.

### Value to the User
* **Maximum Wardrobe ROI (Zero Dead-Stock)**: Through advanced wardrobe rotation algorithms (`stylist_scheduler_brain.py`), the AI actively surfaces forgotten or rarely-worn garments, ensuring users get complete utility out of their physical wardrobe investments.
* **Repeat-Wear & Social Embarrassment Protection**: The platform tracks historical outfit usage across specific dates, locations, and events. It proactively warns users if a proposed outfit has a high visual similarity ($\ge 80\%$ garment overlap) to an outfit previously worn to a similar event or location.
* **Frictionless, Hands-Free Engagement**: With built-in Whisper Speech-to-Text (STT) and high-fidelity Text-to-Speech (TTS) audio players, users can converse with their stylist hands-free while getting ready or commuting.
* **Seamless Gap Filling**: When an ideal outfit requires a piece the user does not own, the AI automatically identifies the gap and matches it against live marketplace listings and professional styling services.

---

## 2. Comprehensive User Manual

The AI Stylist interface (`Stylist.jsx`) is split into three primary tabs accessible at the top of the screen: **Chat**, **Outfit Planner**, and **Daily Suggestion**.

```
+------------------------------------------------------------------------------------+
|                         [ Chat ]  [ Outfit Planner ]  [ Daily Suggestion ]         |
+------------------------------------------------------------------------------------+
|                                                                                    |
|   [Conversation Sidebar]           Active Tab Workspace                            |
|   - Work Day Casual                                                                |
|   - Weekend Brunch                 [ Tag Filter: e.g. Work ] [ Style: Business ]   |
|                                                                                    |
|                                    +------------------------------------------+    |
|                                    |               T O P                      |    |
|                                    |         <--- [ Item ] --->               |    |
|                                    +------------------------------------------+    |
|                                                                                    |
|                                    [ Daily Suggestion ] [ Plan Event ] [ Trends ]  |
|                                                                                    |
|   +----------------------------------------------------------------------------+   |
|   | [Img] [Mic] Tell your stylist what you need...                       [Send]|   |
|   +----------------------------------------------------------------------------+   |
+------------------------------------------------------------------------------------+
```

### Mode 1: Conversational Chat (`chat`)
The Chat tab offers an interactive, two-way conversational interface with your AI fashion advisor.

* **Text & Voice Interaction**:
  * **Text Input**: Enter styling questions into the bottom text bar (e.g., *"What should I wear for a rainy dinner date tonight?"*).
  * **Voice Input**: Tap the `Mic` icon to initiate hands-free audio recording. Tap again to stop. The system automatically transcribes your voice and submits the prompt.
  * **Voice Playback (TTS)**: When the AI responds, it generates a natural-sounding spoken reply. Use the floating audio waveform player to listen, pause, or mute the playback.
* **Image Context Uploads**:
  * Tap the `Image` icon in the input bar to attach a photo of a garment you are considering buying or currently trying on.
  * The AI analyzes the visible garment characteristics (color, fabric, fit, silhouette) and factors them into its recommendations alongside your existing closet items.
* **Context Controls & Sidebar History**:
  * **Include Calendar Toggle**: Flip the switch to automatically pull today's schedule from Google Calendar into the AI's reasoning context.
  * **View Calendar**: Opens a modal showing your synced active schedule.
  * **History Sidebar**: Tap the sidebar toggle (`PanelLeft`) to open a list of past styling sessions. Tap any session to instantly restore its full conversation history.

### Mode 2: Outfit Planner & Power-Up Composer (`shuffle`)
The Outfit Planner tab is a visual canvas featuring automatic slot carousels (Tops, Bottoms, and Footwear) that lets you dynamically filter and compose outfits from your saved wardrobe.

* **Style & Tag Filtering**:
  * **Tag Filter**: Type a text keyword (e.g., "Work", "Gym", "Uniforms") into the **Tag** input. An autocomplete overlay displays matches from your closet's existing tags.
  * **Style Filter**: Choose a dress code (e.g., "Casual", "Smart-Casual", "Business", "Formal", "Athletic", "Loungewear") from the **Style** dropdown.
  * *Filtering Effect:* The slots will instantly update to show only closet items matching both filters, and your scroll/focus positions will safely reset.
* **Shuffling and Combining (Refresh)**:
  * Click **Refresh** (`Sparkles`). The carousels for Tops, Bottoms, and Shoes execute a slot-machine style spin and land on a coordinated outfit selected exclusively from your filtered items.
  * Adjust items individually by swiping/scrolling the respective category carousel.
* **Saving Outfits**:
  * Click **Save** (`Save`) to record the combined outfit to your diary. The system automatically generates a descriptive title (e.g., *"Sporty Blue Summer Hangout"*) and details based on the selected garments.

### Mode 3: Daily Suggestion & Scheduler (`match`)
The Daily Suggestion tab provides proactive, automated wardrobe planning, notification routing, and calendar scheduling.

* **Routing & Notification Fallbacks**:
  * Clicking an outfit recommendation notification opens this tab and presents the suggested outfit details panel.
  * If the AI recommendation fails or fallback logic is triggered (e.g., due to quota limits), the header displays a clear reason (e.g., *"(Fallback. Quota exhausted)"*).
* **Responsive Scrolling**:
  * The outfit detail view uses non-shrinking flex properties (`shrink-0`), allowing the card layout to maintain its height. If content extends below the fold, a scrollbar automatically activates, ensuring all elements (including footwear) are fully visible.
* **Event & Location Planning**:
  * Enter a target event name and location (e.g., *"Tech Conference"* at *"Moscone Center"*) to get highly tailored proposals.
  * **Repeat-Wear Warnings:** If an AI proposal shares $80\%$ or more of its items with an outfit you previously wore to a similar event or location, a prominent warning note appears: *"This outfit was in use on [Date] and place [Location] for [Event]"*.

---

## 3. Technology Stack & Capability Deep-Dive

The AI Stylist platform achieves its capabilities through a robust, highly optimized multi-tier architecture spanning modern frontend frameworks, asynchronous backend microservices, and cutting-edge AI orchestration.

```
+-------------------------------------------------------------------------+
|                              UI & CLIENT LAYER                          |
|  React 18 | Tailwind CSS | Framer Motion | i18next | Browser STT / TTS  |
+-------------------------------------------------------------------------+
                                     |  HTTPS / NDJSON Streaming
                                     v
+-------------------------------------------------------------------------+
|                           FASTAPI ORCHESTRATION                         |
|   api/v1/stylist.py | logic.py | outfit_composer.py | stylist_widen.py  |
+-------------------------------------------------------------------------+
       |                        |                         |
       v                        v                         v
+--------------+        +---------------+        +------------------------+
|  CONTEXT DB  |        | AI & SERVICES |        |   HORIZON ENRICHMENT   |
| MongoDB Atlas|        | Gemini 2.5 Pro|        | Marketplace Search     |
| Closet Items |        | Whisper STT   |        | Trend Scout Feeds      |
| Session Logs |        | Deepgram TTS  |        | Nano Banana Visualizer |
+--------------+        +---------------+        +------------------------+
```

### Core AI & LLM Orchestration
* **Model & Provider**: All primary conversational reasoning and outfit composition run on **Google Gemini 2.5 Pro** (`gemini_stylist.py`, `gemini_client.py`). The architecture utilizes a Protocol-based abstraction (`StylistBrain` in `stylist_brain.py`) ensuring clean separation of concerns and fallback capabilities.
* **Strict Schema Guardrails**: The system prompt enforces a rigorous TypeScript-aligned JSON output contract. This guarantees that the AI returns highly structured payloads containing exact arrays for `outfit_recommendations`, `shopping_suggestions`, `do_dont`, `reasoning_summary`, and `spoken_reply`.
* **Dynamic Preference Injection**: Before calling the LLM, `user_preferences.py` compiles the user's explicit preferences (age, body profile, regional modesty rules, style aesthetics, and avoid lists) into a dense system block. 

### Multimodal Vision & Audio Pipelines
* **Vision & Deduplication Engine**: 
  * The `outfit_composer.py` service processes up to 8 image uploads concurrently via `garment_vision_service`.
  * To eliminate near-twins and duplicate photos, `_dedup_candidates` executes a two-tier filtering pass: a high-speed 64-bit block-hash comparison (`DEDUP_HASH_PREFIX_BITS = 64`) followed by a perceptual fallback, retaining only the highest-quality survivor.
* **Speech-to-Text (STT)**: Voice recordings are decoded in real-time via `stt_service.py` using Whisper models, converting compressed web audio (`audio/webm`) into text transcripts.
* **Text-to-Speech (TTS)**: The `tts_service.py` engine converts the AI's concise `spoken_reply` into broadcast-quality audio streams using state-of-the-art voice models (e.g., `aura-2-thalia-en`). On the client side, `src/lib/speech.js` manages Web Speech API fallbacks and buffer playback inside `WaveformAudioPlayer`.

### Contextual Services & Wardrobe Rotation
* **Hyper-Local Weather Service**: The `weather_service.py` module integrates with OpenWeather to pull real-time meteorological conditions based on user geo-coordinates (`lat`/`lng`). It extracts localized condition strings and formats language-neutral summaries (`22°C · Clear Sky · Paris`) to prevent language mixing.
* **Google Calendar Integration**: The `calendar_service.py` engine securely syncs with Google Calendar, parsing event titles and extracting implicit formality hints (e.g., `Work day [formal]`, `Brunch [casual]`).
* **Wardrobe Rotation Brain**: The `stylist_scheduler_brain.py` service executes a MongoDB aggregation pipeline (`get_rotation_prioritized_closet`). It filters out duplicate items (`is_duplicate: False`) and sorts closet inventory using a composite key:
  1. `last_suggested_at` (null first, then ascending)
  2. `last_worn_at` (null first, then ascending)
  3. `wear_count` (ascending)
  This ensures that forgotten closet items are systematically brought to the top of the AI's recommendation pool.
* **Event Similarity Engine**: The `check_event_similarities` algorithm inspects proposed outfits against historical MongoDB `outfits` collections. If it detects an intersection score of $\ge 0.8$ (80% garment overlap) with an outfit worn to a matching location or event title, it automatically appends a historical warning note to the proposal's rationale.

### Horizon Expansion & Multi-Source Enrichment
To prevent dead-ends in user styling, `stylist_widen.py` acts as a multi-source enrichment pipeline that catches missing closet categories and orchestrates external discoveries:
* **Inference Lexicon**: Uses a bilingual (English + Hebrew) category lexicon (`_CATEGORY_LEXICON`) to inspect the AI's generated advice and detect unowned item references (e.g., identifying `shoes`, `outerwear`, `accessory`, `נעל`, `ז'קט`).
* **Concurrent Gathering**: When gaps are found or "Search wider" is toggled, it dispatches parallel asynchronous tasks (`asyncio.gather`) to:
  * `marketplace_search.py`: Querying the community database for up to 6 highly relevant secondhand/curated listings.
  * `trend_scout.py`: Fetching up to 4 real-time fashion trend cards for aesthetic inspiration.
* **Generative Visualizations (Nano Banana)**: Uses a compiled regular expression (`_VISUALIZE_RE`) to detect explicit visual requests (`show`, `display`, `render`, `תראי`, `תציירי`). If triggered—or if both closet and marketplace searches return empty—it escalates to the Nano Banana generative visualization pipeline to dynamically render synthetic garment examples.

### Frontend Layout & Localization (i18n)
* **High-Performance UI & Streaming**: Built on React 18, Tailwind CSS, and Framer Motion (`AnimatePresence`). Complex workflows like the outfit composer utilize custom NDJSON streaming (`streamNdjson` in `src/lib/api.js`) to parse and render stream chunks in real-time.
* **Desktop Space Optimization**: The bottom bar of the Stylist chat page layout organizes buttons ("Daily Suggestion", "Plan Event Outfit", "Trends", and "Ask a Professional") on a single flex-wrapping row. This aligns cleanly with the chat input box and optimizes screen space, while the "TRENDS" carousel has been removed from message response payloads to prevent redundant visual nesting.
* **RTL & Mirroring Integrity**: Full support for Right-to-Left languages (Arabic, Hebrew) utilizing logical Tailwind padding/margin utilities (`ps--, `pe-`, `ms-`, `me-`). Directional icons (like chevrons and back arrows) flip dynamically (`rtl:rotate-180`), and clear `(X)` buttons in input fields shift position (`right-3 rtl:right-auto rtl:left-3`) to maintain mirroring integrity.
* **i18next Options-Based Translations**: The codebase enforces standard options-based syntax with explicit fallbacks (`t('key', { defaultValue: 'Default text' })`) to prevent parser errors.
* **Dynamic Auto-Layout & Tab Expansion**: Container layouts handle text expansion. The main tab header container is set to `max-w-md` (`448px`), allowing verbose localized labels (like German "Tägliche Empfehlung") to wrap or sit comfortably without text clipping or layout breaks.
* **Locale-Aware Date Rendering**: Calendar dates and diaries render dynamic, locale-specific formats using JavaScript's native `.toLocaleDateString(i18n.language)` interface rather than hardcoded string templates.
