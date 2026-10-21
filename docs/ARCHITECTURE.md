# DressApp — Technical Architecture Document

> **Version:** 2.0 (Turborepo Monorepo & FARM Stack)  
> **Runtime:** FastAPI (Python 3.11) + React 19 (Web SPA) + Expo 53 (React Native) + MongoDB 7.0 (On-Prem Docker / NVMe)  
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
│MongoDB 7.0   │ │dressapp-eyes│ │External Cloud Services                  │
│dressapp-mongo│ │Container    │ ├─────────────────────────────────────────┤
│(Users, Items,│ │Qwen2.5-VL-3B│ │• Google Gemini 3.5 Flash / Nano Banana  │
│Listings,     │ │llama-server │ │• Deepgram Speech API (STT/TTS)          │
│Vector Embed) │ │(:7860)      │ │• OpenWeatherMap & Google Calendar APIs  │
└──────────────┘ └─────────────┘ │• PayPal Subscriptions & Atzmai ILS API  │
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
├── inference-server/            # On-prem Eyes inference server (Qwen2.5-VL-3B-Instruct)
├── deploy/                      # Production Docker Compose, Caddyfile, and Dockerfiles
├── docs/                        # Technical documentation, ADRs, and schema references
│   ├── adr/                     # Architectural Decision Records (0001 - 0005)
│   ├── agents/                  # AI agent guidelines and domain documentation
│   ├── ARCHITECTURE.md          # This technical architecture document
│   └── MONGODB_SCHEMA.md        # Complete MongoDB collection & index schema
├── quarantine/                  # Archived historical session notes and debug logs
└── wiki/                        # Two-layer modular help system translated into 13 languages
```

---

## 4. Subsystems & Data Pipelines

### 4.1 Ingestion, Automatic 3-Pipeline Routing & Inpainting Pipeline

When one or more images (with any mix of characteristics) are ingested via camera, file upload, or external URL:
1. **Automatic 3-Pipeline Routing (`parse_clothing_items_auto`)**: Each photo is analyzed by `backend/app/services/clothing_parser.py` using HuggingFace `SegFormer-b2-clothes` on CPU, border-aware skin filtering (`_filter_border_touching_skin`), and anatomical stack verification (`_has_worn_outfit_stack`):
   - **`single` pipeline**: Single isolated garment on a hanger, flat surface, or mannequin (`total == 1`). Streams live `matte` and progressive `field` frames.
   - **`multi` pipeline**: Multiple garments worn on a human body or vertically aligned anatomical outfit stack (`has_human == True`). Segments tops, bottoms, outerwear, footwear, and headwear (guarded by `has_face_or_hair`) while subtracting human skin/face/hair.
   - **`mass` pipeline**: Unworn multi-item clusters (`has_human == False`, $\ge 2$ items or side-by-side hanging/folded layout). Isolates each item and triggers **Nano Banana** (`gemini-3.1-flash-lite-image`) studio product reconstruction for folded or occluded pieces.
2. **Background Matting**: Handled by `backend/app/services/background_matting.py` using `rembg` (U2-Net) intersected with the SegFormer category mask ($\text{Alpha}_\text{final} = \text{Alpha}_\text{rembg} \cap \text{Mask}_\text{SegFormer}$).
3. **Deep Module `GarmentVisuals`** (`backend/app/services/garment_visuals.py`): Enforces the Transparency Invariant across all operations. Ensures thumbnails and layered crops have zero bounding-box artifacts when composited onto canvases or 2D avatars.
4. **Garment Attribute Analysis, Taxonomy Enforcement & Cultural RAG**: Analyzes cropped garments via `GarmentVisionService` and `llm_gateway.py`. Deterministic post-processing (`_sanitize_hoodie_and_sweatshirts`, cultural RAG grounding, and frontend `hydrate()`) enforces canonical taxonomy across all 13 languages (e.g., `Sweatshirts & Hoodies` vs. `T-Shirt`, and 60+ traditional cultural garments mapped to `dress_code: "traditional"`).
5. **Nano Banana Inpainting**: In the Item Details editor, users can request conversational edits (*"remove the shoes"*, *"complete the hole where the hand was"*) via `gemini-3.1-flash-lite-image` (`gemini_image_service.py`).

### 4.2 Conversational AI Stylist & Speech Pipeline

The stylist provides contextually-grounded outfit suggestions:
- **`StylingContext`** (`backend/app/services/styling_context.py`): Synthesizes user preferences, body sizing, wardrobe inventory, localized weather conditions (via OpenWeatherMap), and Google Calendar events into an optimized prompt.
- **Zero-BYOK Multi-Tier LLM Routing (`llm_gateway.py` & `stylist_brain.py`)**:
  - **Manager & Professional Plans — Fast Cloud Engine (Google Gemini 3.5 Flash-Lite)**: Paid subscribers route across all 6 core pipelines (Stylist Brain, Wardrobe Migration, Suitcase Planner, Trend Scout localization, Session Titles, and Closet Ingestion) to Google Gemini (`gemini-3.5-flash-lite`) via `llm_gateway.py` with strict JSON schema enforcement and sub-350ms TTFT.
  - **Free Tier & Quota Safety Net — On-Prem VPS Eyes (`Qwen2.5-VL-3B-Instruct`)**: `dressapp-eyes` container running fine-tuned `Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf` on port 7860 of the Hetzner CPX32 VPS. Serves as the zero-cost engine for Free Tier users and transparently intercepts cloud quota exhaustion (`429` / `RESOURCE_EXHAUSTED`) without raising 500 errors.
  - **Developer Authentication**: Standardized on Google OAuth sign-in (`dressapdeveloper@gmail.com`) with permanent Admin rights.
- **Audio Routing**:
  - *Speech-to-Text (STT)*: Routes microphone audio between Deepgram Aura STT, direct Gemini audio transcription, and client-side browser Web Speech Recognition.
  - *Text-to-Speech (TTS)*: Generates spoken responses using native Gemini Audio voice profiles (`puck`, `aoede`, `charon`), falling back to Deepgram TTS, local Piper ONNX, or browser `speechSynthesis`.

### 4.3 Monetization & Credit Bucket System

The billing engine in `backend/app/services/pricing.py` and `backend/app/models/credit.py` supports a hybrid monetization model:
- **Closet Capacity Limit**: Free-tier accounts start at 50 garments baseline, expandable up to 150 garments via invite referral loops (+10 slots per verified user), or unlimited storage on the **Manager** ($10/mo) and **Professional** ($15/mo) plans via PayPal Subscriptions REST API and Atzmai ILS gateway.
- **Pre-Paid AI Credit Buckets**:
  - *Daily Free Credits*: 10 credits granted daily with a strict 30-day expiration window.
  - *Paid Credit Packs*: Purchased via PayPal/Atzmai (10, 25, 50, 100 credits); paid credits **never expire**.
  - *Consumption Order*: The oldest expiring free credits are consumed first before dipping into permanent paid credits.
  - *Token Metering*: `TokenMeter` (`backend/app/services/token_meter.py`) tracks and attributes exact credit burn per AI operation.

### 4.4 Client State Synchronization

- **Web SPA (`apps/web`)**: Utilizes React 19's `useSyncExternalStore` for external state stores across Closet, Stylist, Marketplace, and Daily Suggestions. Implements in-flight request deduplication, 15-minute caching, and tab focus revalidation (`visibilitychange`).
- **Mobile (`apps/mobile`)**: Implements `MobileClosetRepository` (`apps/mobile/src/lib/repositories/closetRepository.ts`) providing instant offline hydration from `AsyncStorage`, optimistic item mutations, and stale-while-revalidate (SWR) background syncing.

### 4.5 Trends-Scout Autonomous Fashion Intelligence Pipeline

- **Access Gating**: Available to **Manager** and **Professional** plan subscribers.
- **Dual Gender Intelligence**: Curates 7 independent channels separately for Men's and Women's fashion ecosystems (`local`, `runway`, `street`, `sustainability`, `influencers`, `vintage`, `maintenance_repairs`).
- **Discovery & Crawling Engine** (`backend/app/services/trend_scout.py`): Scheduled cron sweeps (monthly on the 1st at midnight UTC, daily at 07:00 UTC) scrape authoritative publications via `httpx` + `BeautifulSoup`, extracting OpenGraph metadata and inline anchors.
- **Strict Heuristic & Quality Shield (`_verify_trend_card`)**: Validates HTTP 200 responses, rejects commercial checkout links (`/cart`, `/buy`, Shopify/WooCommerce), filters paywalls/login gates, identifies soft-404 strings across languages, and verifies high-resolution OpenGraph hero imagery.
- **Demographic Personalization Engine (`rank_cards_for_user`)**: Evaluates user profile attributes, closet lead dress code, style tags, and linked social channels (Instagram, Pinterest, TikTok, etc.) to re-rank card relevance.
- **Multilingual Localization & Offline Caching**: Priority translation tier with `asyncio.gather` (top 8 cards, 3.5s timeout) and background queue for remaining cards using Gemini Flash across 13 locales, with complete two-layer help integration and pre-bundled offline wiki support.
- **1-Tap Closet Styling**: Passes extracted trend aesthetic tokens (silhouette, fabric drape, color palette) directly to the conversational AI Stylist to propose outfits from garments the user already owns.

### 4.6 3D Dynamic Avatar & Anatomical Closet Garment Fitter (`DynamicAvatar.jsx`, `AvatarViewer2D.jsx` & `closetGarmentFitter.js`)

- **Realistic 3D MB-Lab WebGL Avatar (`DynamicAvatar.jsx`)**:
  - Renders realistic 3D male (`apps/web/public/models/avatar_male_1.glb`, `h = 1.7877 m`, `ymin = -0.0061 m`) and female (`apps/web/public/models/avatar_female_1.glb`, `h = 1.6873 m`, `ymin = -0.0061 m`) meshes generated via Blender MB-Lab in a relaxed A-stance (standing straight with slightly spread feet and hands hanging loosely with space between the palms and hips).
  - Rendered via `@react-three/fiber` and `@react-three/drei` inside an orthographic projection matched to the `200 x 450` coordinate space (`zoom = 109`, `position = [0, 0, 5]`), with automatic fallback to the 2D Bezier SVG mannequin in headless/non-WebGL environments.
  - Decouples `scaleXZ` (driven by chest, waist, hip, and shoulder ratios) from `scaleY` (driven by height ratio) so vertical height changes match `targetSvgHeight` 1-to-1 without distorting horizontal body widths, and applies a PBR skin material (`roughness: 0.58`, `clearcoat: 0.08`) tinted dynamically across 8 realistic Monk skin tone swatches (`SkinTonePicker.jsx`).
- **3D Orthographic Silhouette Landmarks (`getFullAvatarAnatomy`)**:
  - Computes exact `200 x 450` anatomical coordinates calibrated from 1-SVG-unit triangle rasterization of the 3D meshes: vertical zones (`yChin`, `yShoulders`, `yChest`, `yWaist`, `yHip`, `yCrotch`, `yKnees`, `yAnkles`, `yFeet`, `yElbow`, `yWrist`, `yHandTip`), torso half-widths (`wNeck`, `wShoulders`, `wChest`, `wWaist`, `wHip`), outstretched arm bounds (`wElbowOut`, `wElbowIn`, `wWristOut`, `wWristIn`), and A-stance leg/foot bounds (`wOuterKnee`, `wInnerKnee`, `wOuterAnkle`, `wInnerAnkle`, `wFootTip`, `wFootHeel`).
- **Two-Tier Hybrid Garment Fitter (`closetGarmentFitter.js` & `scripts/fit_onboarding_garments_to_avatar.py`)**:
  - **Pre-Fitted Starter Capsule**: 48 starter garments (24 women's + 24 men's, $900 \times 1500$ RGBA PNGs/JPGs) generated by `scripts/fit_onboarding_garments_to_avatar.py` and mapped in `onboardingDataset.js` (`default_viewbox` + `point_cloud`) to the 3D avatar's exact shoulders, outstretched sleeves, torso, A-stance legs, and spread feet.
  - **Runtime Closet Garment Fitter (`closetGarmentFitter.js`, `v3::` cache)**: Dynamically fits any user-uploaded closet garment via **Tier 1** (`warpRealGarmentPhotoToDefaultCanvas` row-by-row alpha-contour warping) or **Tier 2** (`renderProceduralBezierFittedGarment` Cubic-Bezier anatomical reconstruction) onto the 3D avatar coordinate envelope (`getGarmentAnatomicalEnvelope`).
- **Live Horizontal Slice Warping & Accessory Anchoring (`AvatarViewer2D.jsx`)**:
  - **Slice Warping (`FittedGarmentLayer`)**: Slices fitted garments into horizontal bands (`NUM_SLICES = 28`) that dynamically translate and scale across all vertical body zones (`y0Mid`) as the user adjusts their measurements while preserving `photo_contour` garment cuts.
  - **Dynamic Accessory Landmarks (`renderGarment`)**: Positions headwear, glasses, earrings, scarves/neckwear, necklaces/ties, belts, watches/bracelets, and gloves dynamically from `liveAnatomy` coordinates (`yCrown`, `yHeadCenter`, `yNeckBase`, `yWaist`, `yHip`, `yWrist`, `wHead`, `wNeck`, `wWaist`, `wWristOut`, `wWristIn`).
  - **Full-Body Photo Anatomy Extractor (`extractBodyPhotoAnatomy`)**: Scans user-uploaded full-body cutout photos (`body_photo_url`) to extract real-body landmarks and feeds them into `getGarmentAnatomicalEnvelope` and the interactive **2D Point-Cloud Fit Mesh (`PointCloudMeshOverlay`)**.

---

## 5. Deployment Topology

The production application is deployed on a Hetzner Cloud CPX32 VPS (4 AMD vCPUs, 8 GB RAM, Ubuntu 24.04 LTS) at `dressapp.co`:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           Hetzner CPX32 Host                                           │
│                                                                                                        │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐   ┌──────────────────┐  ┌─────────────┐ │
│  │ dressapp-caddy  │   │ dressapp-backend │   │dressapp-     │   │ dressapp-eyes    │  │dressapp-    │ │
│  │ Ports 80, 443   │──▶│ Internal :8001   │──▶│frontend      │   │ Internal :7860   │  │mongo (:27017│ │
│  │ (Caddy 2 Alpine)│   │ (FastAPI + ML)   │   │Internal :3000│   │ (Qwen2.5-VL-3B)  │  │NVMe Storage)│ │
│  └────────┬────────┘   └────────┬─────────┘   └──────┬───────┘   └────────┬─────────┘  └──────┬──────┘ │
│           │                     │                    │                    │                   │        │
│           └─────────────────────┴────────────────────┴────────────────────┴───────────────────┘        │
│                                           Bridge Network: "dress"                                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Reverse Proxy**: Caddy 2 terminates TLS with automatic Let's Encrypt certificates, proxying `/api/*` to `dressapp-backend:8001` and static requests to `dressapp-frontend:3000`.
- **Backend Service**: Runs `backend/server.py` via Uvicorn. Model weights for SegFormer and U2-Net persist across container restarts in named Docker volumes (`model-cache`, `rembg-cache`).
- **Eyes Inference Service**: Dedicated `dressapp-eyes` container running `llama-server` on port 7860 with fine-tuned `Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf` (~2.8 GB RAM), authenticated via `EYES_API_TOKEN`.
- **Frontend Service**: Static React 19 SPA bundle served by Nginx with client-side routing fallback (`try_files $uri /index.html`).
- **Database**: On-prem MongoDB 7.0 Community containerized (`dressapp-mongo`) with persistent storage on high-speed local NVMe SSD at `/mnt/dressapp-db-data`, automated nightly backups at 03:00 UTC, and optimized WiredTiger cache capped at 0.75 GB.

