# DressApp — Technical Architecture Document

> **Version:** 2.0 (Turborepo Monorepo & FARM Stack)  
> **Runtime:** FastAPI (Python 3.11) + React 19 (Web SPA) + Expo 53 (React Native) + MongoDB Atlas  
> **Deployment Target:** Hetzner CPX32 VPS (`dressapp.co`) via Docker Compose + Caddy TLS  

---

## 1. System Overview

DressApp is an AI-powered fashion editor and digital wardrobe platform that turns physical clothes into a structured, queryable wardrobe. The system provides weather- and calendar-aware styling recommendations, EU Digital Product Passport (DPP) QR scanning, generative clothing inpainting via Nano Banana, and a community marketplace.

### Core Capabilities

1. **Wardrobe Ingestion & Computer Vision**:
   - Multi-garment photo cropping, category segmentation via HuggingFace `SegFormer-b2-clothes`, and background alpha matting via `rembg` (U2-Net).
   - Conversational re-analysis and inpainting ("The Eyes" & "Nano Banana" using `gemini-3.1-flash-lite-image`) for removing artifacts or restoring occluded sections.
   - Standard EU DPP QR-code ingestion parsing fabric composition, manufacturer traceability, and care guides.
2. **Conversational AI Stylist & Multimodal Audio**:
   - Hands-free stylist assistant processing voice and text inputs with local weather, Google Calendar events, user sizing profile, and wardrobe history.
   - Multi-tier speech pipeline routing between native Gemini Audio (`gemini-2.5-flash`), Deepgram STT/TTS, browser Web Speech API, and mobile offline VITS models (Piper ONNX).
3. **Monorepo Client Architecture**:
   - Web application (`apps/web`): React 19 SPA with `useSyncExternalStore` thread-safe state, Tailwind CSS, Shadcn UI primitives, and 13 localized languages.
   - Mobile application (`apps/mobile`): Expo SDK 53 / React Native 0.79 with React Navigation Native Stack, NativeWind styling, and offline SWR caching via `MobileClosetRepository`.
   - Chrome Extension (`chrome-extension`): Manifest V3 shopping assistant for automated size recommendation on partner retailers based on user body measurements.
4. **Marketplace & Community**:
   - Region-filtered feed supporting sell, swap, and donate workflows with PayPal Live checkout, integrated ledger, and order fulfillment states.
5. **Monetization & Credit Management**:
   - Tiered closet capacity (150 baseline garment limit on free tier, expandable via viral referral loops or PayPal Subscriptions Pro tier).
   - Pre-paid credit bucket billing engine (10 daily free credits with 30-day expiry, and permanent paid credit packs) with token metering and soft/hard quota enforcement.

---

## 2. High-Level Architecture

```
                                  ┌──────────────────────────┐
                                  │      Client Surface      │
                                  ├──────────────────────────┤
                                  │ • Web SPA (apps/web)     │
                                  │ • Mobile App (apps/mobile│
                                  │ • Extension / Android TWA│
                                  └─────────────┬────────────┘
                                                │ HTTPS / WSS
                                                ▼
                                  ┌──────────────────────────┐
                                  │     Caddy 2 Reverse Proxy│
                                  │   (Auto Let's Encrypt)   │
                                  └──────┬────────────┬──────┘
                   /api/v1/*             │            │  /* (Web SPA)
          ┌──────────────────────────────┘            └──────────────────────────────┐
          ▼                                                                          ▼
┌────────────────────────────────────────┐                       ┌────────────────────────────────────────┐
│  FastAPI Backend (:8001)               │                       │  Nginx Static Server (:3000)           │
│  (backend/server.py)                   │                       │  (React 19 Production Bundle)          │
├────────────────────────────────────────┤                       └────────────────────────────────────────┘
│ • Auth, Closet, Stylist, Marketplace   │
│ • Deep Modules:                        │
│   - GarmentVisuals (matting/fallback)  │
│   - StylingContext (weather/calendar)  │
│   - TokenMeter & Credit Buckets        │
│ • Local ML Pipeline:                   │
│   - SegFormer-b2 + rembg + Fashion-CLIP│
│ • Background APScheduler (Trend Scout) │
└───────┬──────────────┬──────────────┬──┘
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌─────────────┐ ┌─────────────────────────────────────────┐
│MongoDB Atlas │ │dressapp-eyes│ │External Cloud Services (BYOK)           │
│M10 Cluster   │ │Container    │ ├─────────────────────────────────────────┤
│(Users, Items,│ │Gemma-4 E4B  │ │• Google Gemini API (BYOK / Nano Banana) │
│Listings,     │ │llama-server │ │• Deepgram Speech API (STT/TTS)          │
│Vector Embed) │ │(:7860)      │ │• OpenWeatherMap & Google Calendar APIs  │
└──────────────┘ └─────────────┘ │• PayPal Subscriptions & Orders REST API │
                                 └─────────────────────────────────────────┘
```

---

## 3. Monorepo & Codebase Layout

The repository is organized as a Turborepo workspace linking applications and shared packages:

```
.
├── apps/
│   ├── web/                     # React 19 Web SPA (CRA + Craco, Tailwind, i18next)
│   ├── mobile/                  # Expo 53 / React Native 0.79 Mobile App (iOS / Android)
│   └── android-twa/             # Android Trusted Web Activity packaging wrapper
│
├── packages/
│   ├── api-client/              # Shared isomorphic REST & streaming NDJSON client
│   ├── i18n/                    # Canonical translation catalogs across 13 locales
│   └── types/                   # Shared TypeScript definitions for domain models
│
├── backend/                     # FastAPI Python 3.11 Backend Service
│   ├── server.py                # ASGI application root & CORS configuration
│   ├── app/
│   │   ├── api/v1/              # Versioned API routes (auth, closet, stylist, marketplace, etc.)
│   │   ├── core/                # Configuration, JWT security, and dependency injection
│   │   ├── db/                  # Motor MongoDB client and index initialization
│   │   ├── models/              # Pydantic v2 schemas (schemas.py, credit.py)
│   │   └── services/            # Business logic, vision matting, stylist agent, and billing
│   ├── scripts/                 # Seeding and maintenance utilities
│   └── requirements.txt         # Production backend dependencies
│
├── chrome-extension/            # Manifest V3 Shopping Assistant Extension
├── inference-server/            # Optional standalone GPU inference server (BiRefNet / Gemma-4)
├── deploy/                      # Production Docker Compose, Caddyfile, and Dockerfiles
├── docs/                        # Technical documentation, ADRs, and schema references
│   ├── adr/                     # Architectural Decision Records (0001 - 0004)
│   ├── agents/                  # AI agent guidelines and domain documentation
│   ├── ARCHITECTURE.md          # This technical architecture document
│   └── MONGODB_SCHEMA.md        # Complete MongoDB collection & index schema
├── quarantine/                  # Archived historical session notes and debug logs
└── wiki/                        # Two-layer modular help system translated into 13 languages
```

---

## 4. Subsystems & Data Pipelines

### 4.1 Ingestion, Segmentation & Inpainting Pipeline

When an image is ingested via camera, file upload, or external URL:
1. **Analysis & Bounding Boxes**: The request is routed to `backend/app/services/clothing_parser.py`, which utilizes HuggingFace `SegFormer-b2-clothes` running locally on CPU. The parser segments multi-garment photos into distinct items (tops, bottoms, outerwear, shoes, accessories).
2. **Background Matting**: Handled by `backend/app/services/background_matting.py` using `rembg` (U2-Net). Non-clothing background pixels are keyed out into a transparent PNG (`clean_image_url`).
3. **Deep Module `GarmentVisuals`** (`backend/app/services/garment_visuals.py`): Enforces the Transparency Invariant across all operations. Ensures thumbnails and layered crops have zero bounding-box artifacts when composited onto canvases or 2D avatars.
4. **Garment Attribute Analysis & Vision Routing**: Analyzes cropped garments via `GarmentVisionService`. Defaults to on-premises `dressapp-eyes` running fine-tuned `gemma-4-E4B-it-Q3_K_M.gguf`. For users with custom API keys, queries external vision models with transparent fallback to on-prem Gemma upon `429` / `RESOURCE_EXHAUSTED` quota limits.
5. **Nano Banana Inpainting**: If the user requests corrections via the interactive chat prompt (*"remove the belt"*, *"complete the sleeve where the hand was"*), the image is sent to `gemini-3.1-flash-lite-image` via `gemini_image_service.py` to perform photorealistic inpainting. This high-cost generative feature strictly requires a user-supplied BYOK key.

### 4.2 Conversational AI Stylist & Speech Pipeline

The stylist provides contextually-grounded outfit suggestions:
- **`StylingContext`** (`backend/app/services/styling_context.py`): Synthesizes user preferences, body sizing, wardrobe inventory, localized weather conditions (via OpenWeatherMap), and Google Calendar events into an optimized prompt.
- **Multi-Tier LLM Routing (`stylist_brain.py`)**:
  - **Free Tier / Zero-BYOK**: Evaluated via `GemmaStylistBrain` running against the on-prem `dressapp-eyes` container (:7860). Delivers full conversational styling and outfit assembly without third-party API keys or external costs.
  - **Custom BYOK Models**: Users with configured Google Gemini keys route to `GeminiStylistBrain` (`gemini-2.5-flash`, `gemini-2.5-pro`) wrapped in `FallbackBrain`.
  - **Automatic Quota Fallback**: If a custom BYOK key triggers rate limits (`429`), `RESOURCE_EXHAUSTED`, or billing caps, `FallbackBrain` intercepts the exception and seamlessly falls back to on-prem Gemma-4-E4B, annotating `provider_fallback="gemma"` and `fallback_from_quota=True` so the frontend displays a transparent status banner without failing.
  - **Autonomous Background Cron Jobs**: Daily wardrobe re-indexing and scheduled morning outfit proposals run via `GemmaStylistBrain`.
- **Audio Routing**:
  - *Speech-to-Text (STT)*: Routes microphone audio between Deepgram Aura STT, direct Gemini audio transcription, and client-side browser Web Speech Recognition.
  - *Text-to-Speech (TTS)*: Generates spoken responses using native Gemini Audio voice profiles (`puck`, `aoede`, `charon`), falling back to Deepgram TTS, local Piper ONNX, or browser `speechSynthesis`.

### 4.3 Monetization & Credit Bucket System

The billing engine in `backend/app/services/pricing.py` and `backend/app/models/credit.py` supports a hybrid monetization model:
- **Closet Capacity Limit**: Free-tier accounts have a hard cap of 150 garments. Users can expand capacity via invite referral loops (+10 slots per verified user) or upgrade to an unlimited Pro tier via the PayPal Subscriptions REST API.
- **Pre-Paid AI Credit Buckets**:
  - *Daily Free Credits*: 10 credits granted daily with a strict 30-day expiration window.
  - *Paid Credit Packs*: Purchased via PayPal/Stripe (10, 25, 50, 100 credits); paid credits **never expire**.
  - *Consumption Order*: The oldest expiring free credits are consumed first before dipping into permanent paid credits.
  - *Token Metering*: `TokenMeter` (`backend/app/services/token_meter.py`) tracks and attributes exact credit burn per AI operation.

### 4.4 Client State Synchronization

- **Web SPA (`apps/web`)**: Utilizes React 19's `useSyncExternalStore` for external state stores across Closet, Stylist, Marketplace, and Daily Suggestions. Implements in-flight request deduplication, 15-minute caching, and tab focus revalidation (`visibilitychange`).
- **Mobile (`apps/mobile`)**: Implements `MobileClosetRepository` (`apps/mobile/src/lib/repositories/closetRepository.ts`) providing instant offline hydration from `AsyncStorage`, optimistic item mutations, and stale-while-revalidate (SWR) background syncing.

### 4.5 Trends-Scout Autonomous Fashion Intelligence Pipeline

- **Access Gating**: Strictly requires a user-supplied custom AI supplier API key (`user_has_custom_api_key(user)`). Zero-BYOK users receive HTTP 403 to prevent unmetered web crawling and cloud synthesis costs.
- **Dual Gender Intelligence**: Curates 7 independent channels separately for Men's and Women's fashion ecosystems (`local`, `runway`, `street`, `sustainability`, `influencers`, `vintage`, `maintenance_repairs`).
- **Discovery & Crawling Engine** (`backend/app/services/trend_scout.py`): Scheduled cron sweeps (monthly on the 1st at midnight UTC, daily at 07:00 UTC) scrape authoritative publications via `httpx` + `BeautifulSoup`, extracting OpenGraph metadata and inline anchors.
- **Strict Heuristic & Quality Shield (`_verify_trend_card`)**: Validates HTTP 200 responses, rejects commercial checkout links (`/cart`, `/buy`, Shopify/WooCommerce), filters paywalls/login gates, identifies soft-404 strings across languages, and verifies high-resolution OpenGraph hero imagery.
- **Demographic Personalization Engine (`rank_cards_for_user`)**: Evaluates user profile attributes, closet lead dress code, style tags, and linked social channels (Instagram, Pinterest, TikTok, etc.) to re-rank card relevance.
- **Multilingual Localization & Offline Caching**: Priority translation tier with `asyncio.gather` (top 8 cards, 3.5s timeout) and background queue for remaining cards using Gemini Flash across 13 locales, with complete two-layer help integration and pre-bundled offline wiki support.
- **1-Tap Closet Styling**: Passes extracted trend aesthetic tokens (silhouette, fabric drape, color palette) directly to the conversational AI Stylist to propose outfits from garments the user already owns.

---

## 5. Deployment Topology

The production application is deployed on a Hetzner Cloud CPX32 VPS (4 AMD vCPUs, 8 GB RAM, Ubuntu 24.04 LTS) at `dressapp.co`:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Hetzner CPX32 Host                                     │
│                                                                                        │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ dressapp-caddy  │   │ dressapp-backend │   │dressapp-     │   │ dressapp-eyes    │  │
│  │ Ports 80, 443   │──▶│ Internal :8001   │──▶│frontend      │   │ Internal :7860   │  │
│  │ (Caddy 2 Alpine)│   │ (FastAPI + ML)   │   │Internal :3000│   │ (Gemma-4 E4B)    │  │
│  └────────┬────────┘   └────────┬─────────┘   └──────┬───────┘   └────────┬─────────┘  │
│           │                     │                    │                    │            │
│           └─────────────────────┴────────────────────┴────────────────────┘            │
│                               Bridge Network: "dress"                                  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ TLS
                                            ▼
                              ┌───────────────────────────┐
                              │ MongoDB Atlas M10 Cluster │
                              │ (Hosted Cloud Database)   │
                              └───────────────────────────┘
```

- **Reverse Proxy**: Caddy 2 terminates TLS with automatic Let's Encrypt certificates, proxying `/api/*` to `dressapp-backend:8001` and static requests to `dressapp-frontend:3000`.
- **Backend Service**: Runs `backend/server.py` via Uvicorn. Model weights for SegFormer and U2-Net persist across container restarts in named Docker volumes (`model-cache`, `rembg-cache`).
- **Eyes Inference Service**: Dedicated `dressapp-eyes` container running `llama-server` on port 7860 with fine-tuned `gemma-4-E4B-it-Q3_K_M.gguf` + `mmproj-BF16.gguf` (~2.85 GB RAM), authenticated via `EYES_API_TOKEN`.
- **Frontend Service**: Static React 19 SPA bundle served by Nginx with client-side routing fallback (`try_files $uri /index.html`).
- **Database**: External MongoDB Atlas M10 cluster (10 GB storage, automated daily snapshots, Atlas Vector Search).
