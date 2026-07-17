# DressApp — Technical Architecture Document (FARM Stack & Subsystems)

> **Version:** 1.1 (Phase 6 / Current Production)  
> **Runtime:** FARM stack (FastAPI + React + MongoDB)  
> **Reference Runtime:** Cloudflare Workers + Durable Objects + Vectorize (see `wrangler.toml` for historical/future parity)  
> **Status:** Fully shipped production deployment on Hetzner VPS (`dressapp.co`).

---

## 1. System Overview

DressApp is a comprehensive digital wardrobe ecosystem combining five core subsystems:

1.  **Personal Closet Ingestion**: Unified wardrobe gateway (live camera capture, local photo upload, remote URL upload, QR-code DPP scanning, and OCR receipt parser) running client-side fingerprinting and sequential deduplication.
2.  **Closet Refinement & Matting**: Hybrid local segmentation (SegFormer-b2 + rembg) with live client-side background polishing, category-aware re-refinement, and synchronous WebP thumbnail generation.
3.  **Conversational AI Stylist**: A hands-free agent supporting audio/text inputs. Speech queries are routed between local Gemma4 weights and Gemini 2.5 Flash API, utilizing browser Web Speech and mobile Piper ONNX fallbacks.
4.  **Community Marketplace & Monetization**: A sell/swap/donate ecosystem for digitized clothes. Unlimited slots (Pro tier) are managed via the PayPal Subscriptions REST API (baseline limit of 150 items for free accounts). A viral referral system grants +10 slots per signup.
5.  **Localized Help & Modular Wiki**: An instant-render Help dialog and 13-topic Wiki system localized in 12 languages. Manuals are statically bundled inside i18next resource catalogs to run offline, with dynamic locale-specific Wiki routing.

---

## 2. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          React Frontend (Phase 3)                      │
│  Closet · Camera (live canvas) · Stylist Chat · Marketplace · Profile │
│  HelpMenu (static i18n) · DppScanner · Receipt Crop · URL Ingest       │
└───────────────┬──────────────────────────┬─────────────────────────────┘
                │ REST / WebSocket         │
┌───────────────▼──────────────────────────▼─────────────────────────────┐
│                       FastAPI Edge Layer  (/api/v1/*)                  │
│  auth · closet · stylist (multimodal) · payments · admin · webhooks    │
│  polish-crop · parse-receipt · import-dpp · fetch-image-url            │
└───────────────┬──────────────────────────┬─────────────────────────────┘
                │                          │
    ┌───────────▼──────────┐   ┌───────────▼──────────┐
    │  Application Services │   │ Background Scheduler │
    │  (logic & model loops)│   │  (APScheduler)       │
    │  STT/TTS · PayPal    │   │  Trends-Scout Agent  │
    └───────────┬──────────┘   └───────────┬──────────┘
                │                          │
┌───────────────▼──────────────────────────▼─────────────────────────────┐
│                            MongoDB (Motor)                             │
│  users · closet_items · listings · transactions · stylist_sessions     │
│  embeddings (Atlas Vector Search) · trend_reports · translation_cache  │
└────────────────────────────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────────────┐
│                        External API / ML Providers                     │
│  Gemini 2.5 Flash/Pro (Direct API Key) · OpenWeatherMap                │
│  Google Calendar (OAuth) · PayPal Subscriptions REST API               │
└────────────────────────────────────────────────────────────────────────┘
```

Detailed routing and logic files reside in:
*   FastAPI Entrypoint: [server.py](file:///C:/DressApp_AG/backend/server.py)
*   API Router: [router.py](file:///C:/DressApp_AG/backend/app/api/v1/router.py)
*   Core App logic: [logic.py](file:///C:/DressApp_AG/backend/app/services/logic.py)
*   Database entry: [database.py](file:///C:/DressApp_AG/backend/app/db/database.py)

---

## 3. Mapping: Cloudflare Canonical Design → FARM Implementation

| Cloudflare Canonical Concept | Purpose in DressApp | FARM Equivalent |
| --- | --- | --- |
| Cloudflare Worker entrypoint | Edge request handler | `FastAPI` app in [server.py](file:///C:/DressApp_AG/backend/server.py) |
| Agents SDK (2026) | Long-lived agent orchestration | `StylistAgent` in [logic.py](file:///C:/DressApp_AG/backend/app/services/logic.py) + `stylist_sessions` database collection |
| Durable Object (per-user state) | Persistent per-user memory | MongoDB collection `stylist_sessions` managed by [stylist_memory.py](file:///C:/DressApp_AG/backend/app/services/stylist_memory.py) |
| Cloudflare Vectorize | Vector search for garments | MongoDB Atlas Vector Search index on `embeddings.vector` (see [encoder_pipeline.py](file:///C:/DressApp_AG/backend/app/services/encoder_pipeline.py)) |
| Workers AI / AI Gateway | Multilingual TTS routing | Multimodal Gemini 2.5 Flash AUDIO response + browser Web Speech + local ONNX (see [tts_service.py](file:///C:/DressApp_AG/backend/app/services/tts_service.py)) |
| Workers KV | Feature flags & fast configuration | MongoDB `config` collection with LRU memory caching |
| Cron Triggers | Trends-Scout daily news scrape | `APScheduler` daily triggers in [scheduler.py](file:///C:/DressApp_AG/backend/app/services/scheduler.py) |
| R2 Object Storage | Image & audio assets | local file uploads directory `static/` (production paths mapped in Caddy/Docker volume) |

---

## 4. Subsystem Deep-Dives

### 4.1 Audio & Speech Pipeline (STT / TTS)

The DressApp chat loop supports full hands-free bidirectional audio communication:

*   **Speech-to-Text (STT)**: Processes user microphone inputs. Handled by `EyesSTTService` in [stt_service.py](file:///C:/DressApp_AG/backend/app/services/stt_service.py).
    *   **Gemma4 Container**: If `EYES_PROVIDER=gemma` is active, routes requests to the local Gemma4 container weights (`gemma-4-E2B-it-Q8_0.gguf`).
    *   **Native Multimodal Fallback**: If the local Gemma container is offline, it falls back to a direct Gemini 2.5 Flash transcription request with temperature `0.0`.
    *   **Browser Speech Recognition**: In supported browsers, real-time transcription is processed client-side via the browser's `SpeechRecognition` API.
*   **Text-to-Speech (TTS)**: Translates the AI's response text into spoken audio. Handled by `GeminiTTSService` in [tts_service.py](file:///C:/DressApp_AG/backend/app/services/tts_service.py).
    *   **Native Gemini Audio**: Requests Gemini 2.5 Flash to generate responses directly in `AUDIO` modality, utilizing voice profiles (`puck`, `aoede`, `charon`).
    *   **Client Fallback**: If server-side generation fails, browser-native synthesis (`window.speechSynthesis`) is triggered locally on the client.
    *   **Mobile Offline Pods**: React Native / Mobile apps support offline speech synthesis using ONNX-based VITS models (Piper/Sherpa-ONNX) packaged inside the client distribution.

### 4.2 Ingestion, Closet & Cutout Pipeline

Handles garment uploads, classification, background matting, and visual refinement:

*   **Matting & Segmentation**: Local U2-Net (`rembg`) for background removal and SegFormer-b2-clothes for parsing, eliminating external Fal.ai / SAM-2 API dependencies. Managed in [clothing_parser.py](file:///C:/DressApp_AG/backend/app/services/clothing_parser.py) and [background_matting.py](file:///C:/DressApp_AG/backend/app/services/background_matting.py).
*   **Live Background Polishing**: As soon as `/closet/analyze` returns a card, a non-blocking `useEffect` on the review screen fires a background call to `/closet/polish-crop`. The rough crop is swapped out for a high-quality transparent PNG with zero UI interaction lag.
*   **Category-Aware Re-Refinement**: Changing the category of a card triggers a re-polish. The backend dynamically updates the SegFormer segmenter targeting mask (e.g. swapping top mask for bottom mask) based on the new category.
*   **Deduplication & Fingerprinting**: In-browser SHA-256 and horizontal difference-hash (dHash) checking detect duplicates within ~150 ms before upload. Perceptual matches evaluate dHash Hamming distance ($\le 10$ bits).
*   **Double-Prefix Mitigation**: The backend automatically normalizes crop base64 strings during creation (`POST /closet`), preventing double data URL prefix nesting.
*   **Synchronous WebP Thumbnail Generation**: To prevent empty cards/grey flashes on grid load, `POST /closet` pre-generates low-resolution WebP thumbnails and placeholder data URLs synchronously before persisting.
*   **Locked Receipt Ingest**: Attributes extracted from physical receipts are locked against vision parser overwrite via `receipt_locked_fields` persisted in MongoDB.

### 4.3 Monetization & Billing Engine

DressApp employs a hybrid freemium and referral expansion architecture:

*   **Garment Capacity Limits**: Free users have a 150-item limit. Gated in [closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py) with an `HTTP 402 Payment Required` exception.
*   **PayPal Subscriptions**: Integrates the PayPal Subscriptions REST API in [payments.py](file:///C:/DressApp_AG/backend/app/api/v1/payments.py) and [paypal_client.py](file:///C:/DressApp_AG/backend/app/services/paypal_client.py) (supporting Monthly $4.99 / Yearly $29.99 plans).
*   **Mock Billing Mode**: Dev/Staging environments can use `PAYPAL_MOCK_MODE=true` to simulate subscription activation instantly.
*   **Viral Referral Loop**: Users can share links containing their registration referral ID. Signups increment the referrer's `closet_capacity_bonus` by `10` slots in the MongoDB `users` collection.

### 4.4 Trends-Scout System

An agentic news parsing and personalization system:

*   **Scraper Loop**: Daily scheduler runs [trend_scout.py](file:///C:/DressApp_AG/backend/app/services/trend_scout.py) to scrape fashion articles using BeautifulSoup (`BS4`), converting HTML anchors to clean markdown links for Gemini.
*   **Link Verification**: Validates crawled deep links to ensure no URL hallucinations are returned in the final card.
*   **Translation & Caching**: Translated cards are generated dynamically and stored in `trend_reports` to prevent duplicate translation requests.
*   **Runtime Scoring**: Personalizes the flat feed for each user based on the rating algorithm in `rank_cards_for_user`:
    
    $$\text{Score} = \text{Keyword Overlap} + \text{Bucket Affinity} + \text{Country Boost} + \text{Gender Penalty}$$
    
    Country boosts match crawled cards directly to the user's location ($+8.0$). Gender mismatch is penalized ($-2.0$).

### 4.5 Localised Help & Modular Wiki System

A comprehensive multi-language support network built natively into the application:

*   **Static Resource Injection**: Easy manuals for all 12 languages are injected directly into the main `i18next` locale resource files (e.g. `en.json`, `he.json`, `ar.json`). This ensures help content renders instantly offline without dynamic backend fetch queries.
*   **RTL Mirroring**: The help layout detects active right-to-left locales (`he`, `ar`) and mirrors layouts, buttons, and text alignments automatically.
*   **Dynamic Wiki Routing**: Direct "View more in Wiki" links dynamically format targeted paths based on active language (`/wiki/{lang}/{topic}.md`) to load pre-localized stubs and detailed markdown guides.
*   **Agent Pointers (`AGENTS.md`)**: Roots-level [.agents/AGENTS.md](file:///C:/DressApp_AG/.agents/AGENTS.md) acts as a directory index mapping AI agent lookups directly to modular, context-specific markdown guides inside `wiki/`, bypassing token-heavy codebase analysis context-stuffing.

---

## 5. Security, Privacy & Observability

*   **Credential Security**: Secrets are loaded locally from `backend/.env` (never committed). Webhooks are verified using cryptographic signatures.
*   **Dev-Auth Bypass**: Exposes a developer-only `/api/v1/auth/dev-bypass` router in [auth.py](file:///C:/DressApp_AG/backend/app/api/v1/auth.py) behind `ALLOW_DEV_BYPASS=true` for testing without actual Google/OAuth loops (disabled in production).
*   **PII Controls**: Minimizes stored user data, encryption is used for OAuth tokens, and image assets are stored as anonymized files on disk.

---

## 6. Deployment Concurrency Guards

*   **Concurrency Lock**: To prevent memory OOM crashes on VPS hosting during heavy ML tasks, closet analysis endpoints share a global process-wide `asyncio.Semaphore(1)` lock (`_ANALYZE_LOCK` in [closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py)).
*   **Active Versatility**: The `GET /api/v1/closet/analyze/version` endpoint exposes system-level verification indicators (`torch_installed`, `rembg_installed`) to ensure the correct local execution path is active.

---

## 7. Roadmap & Historical Alignment

*   **Phase 1**: Initial scaffolding and specifications (Stripe and Fal.ai placeholders).
*   **Phase 2**: Vector search and session history persistence implemented.
*   **Phase 3**: React frontend routing and design system finalized.
*   **Phase 4**: PayPal checkout integration, Google OAuth integrations, and Trend-Scout.
*   **Phase 5**: Admin metrics console, monitoring, and validation.
*   **Phase 6 (Current)**: Local Matting CPU compile, Speech dual-tier routing, OutfitCanvas avatar, 12-language Wiki system, Static i18n manual, Live Background Polishing, URL Ingestion, and `.agents/AGENTS.md` context mapping.
