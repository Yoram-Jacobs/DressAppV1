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
│MongoDB Atlas │ │Inference    │ │External Cloud Services                  │
│M10 Cluster   │ │Server (opt) │ ├─────────────────────────────────────────┤
│(Users, Items,│ │Gemma-4 E2B  │ │• Google Gemini API (gemini-2.5-flash)   │
│Listings,     │ │/ BiRefNet   │ │• Deepgram Speech API (STT/TTS)          │
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
│   ├── eyes-native/             # Native vision processing bindings for mobile
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
4. **Nano Banana Inpainting**: If the user requests corrections via the interactive chat prompt (*"remove the belt"*, *"complete the sleeve where the hand was"*), the image is sent to `gemini-3.1-flash-lite-image` via `gemini_image_service.py` to perform photorealistic inpainting.

### 4.2 Conversational AI Stylist & Speech Pipeline

The stylist provides contextually-grounded outfit suggestions:
- **`StylingContext`** (`backend/app/services/styling_context.py`): Synthesizes user preferences, body sizing, wardrobe inventory, localized weather conditions (via OpenWeatherMap), and Google Calendar events into an optimized prompt.
- **LLM Reasoning**: Driven by direct Google AI Studio API (`GEMINI_API_KEY`) targeting `gemini-2.5-flash` or `gemini-2.5-pro` using the native `google-genai` SDK.
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

---

## 5. Deployment Topology

The production application is deployed on a Hetzner Cloud CPX32 VPS (4 AMD vCPUs, 8 GB RAM, Ubuntu 24.04 LTS) at `dressapp.co`:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Hetzner CPX32 Host                         │
│                                                                 │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │ dressapp-caddy  │   │ dressapp-backend │   │dressapp-     │  │
│  │ Ports 80, 443   │──▶│ Internal :8001   │   │frontend      │  │
│  │ (Caddy 2 Alpine)│   │ (FastAPI + ML)   │   │Internal :3000│  │
│  └────────┬────────┘   └────────┬─────────┘   └──────┬───────┘  │
│           │                     │                    │          │
│           └─────────────────────┴────────────────────┘          │
│                       Bridge Network: "dress"                   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ TLS
                                  ▼
                    ┌───────────────────────────┐
                    │ MongoDB Atlas M10 Cluster │
                    │ (Hosted Cloud Database)   │
                    └───────────────────────────┘
```

- **Reverse Proxy**: Caddy 2 terminates TLS with automatic Let's Encrypt certificates, proxying `/api/*` to `dressapp-backend:8001` and static requests to `dressapp-frontend:3000`.
- **Backend Service**: Runs `backend/server.py` via Uvicorn. Model weights for SegFormer and U2-Net persist across container restarts in named Docker volumes (`model-cache`, `rembg-cache`).
- **Frontend Service**: Static SPA bundle served by Nginx with client-side routing fallback (`try_files $uri /index.html`).
- **Database**: External MongoDB Atlas M10 cluster (10 GB storage, automated daily snapshots, Atlas Vector Search).
