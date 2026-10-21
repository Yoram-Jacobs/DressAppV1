# DressApp

Your AI fashion editor: photograph any garment, get weather + calendar-aware outfits, scan EU DPP QR tags, and resell from a polished marketplace — all in your pocket.

**Live demo**

- 🟢 Production · <https://dressapp.co> (Hetzner VPS, custom domain)

---

## What it does

DressApp turns a closet of physical clothes into a structured, quarriable wardrobe and uses that wardrobe to drive everyday styling decisions.

### Core flows

| Flow | What it does |
| --- | --- |
| **Capture & Auto-Route** | Snap or upload any mix of photos (single items, full-body worn outfits, or multi-item unworn clusters). **GarmentVision** automatically routes each photo to the **Single**, **Multi-Garment**, or **Mass** pipeline, removes backgrounds (`rembg ∩ SegFormer`), unfolds/reconstructs clustered items via **Nano Banana**, and auto-fills 20+ attributes (including **Sweatshirts & Hoodies** vs. **T-Shirts** and 60+ **Traditional & Cultural** garments across 13 languages). |
| **Auto-fill & Re-analyse** | Combines local SegFormer-b2 + U2-Net matting + multimodal LLM extraction. The **Re-analyse Photo** card features an interactive AI prompt box allowing users to ask **The Eyes** for specific modifications (*"Remove the shoes"*, *"Complete the hole where the hand was"*, *"Remove metal studs"*) executing photorealistic inpainting via **Nano Banana** (`gemini-3.1-flash-lite-image`). |
| **DPP QR scan** | Scans EU Digital Product Passport QR codes (JSON-LD or inline JSON), imports brand, fibre composition, supply-chain trace and care info — even without a photo. |
| **AI Stylist & Audio** | Conversational chat (text or voice) that pulls weather, your calendar, your closet, and your cultural context to suggest complete outfits. Speaks 13 languages. Integrated STT/TTS routes between on-prem `Qwen 2.5 VL 3B` and `Gemini 3.5 Flash`, with native Web Speech transcription fallback and mobile offline VITS models (Piper/Sherpa-ONNX). |
| **Marketplace** | Sell, swap or donate pieces. Region-matched feed, Live PayPal checkout, transparent platform fee (7% after processing). |
| **Experts directory** | Find vetted stylists, tailors and designers. Self-serve promotion campaigns (Draft/Pending/Active/Paused/Rejected lifecycles) with daily billing options ($1.00 USD/day PayPal checkout), customizable notification timing, and detailed performance reports drive a region-aware ticker on the home screen. Includes a dedicated My Campaigns dashboard for active expert tracking. |
| **Trend Scout** | Daily and monthly background scheduler curating 7 distinct channels across Men's and Women's fashion ecosystems — Local News, Runway, Street Style, Sustainability, Influencers & Icons, Vintage / Archival, and Care & Repairs. Employs web scraping (httpx + BeautifulSoup), Gemini JSON synthesis, strict anti-commerce/anti-paywall heuristic shields, dynamic translation across 13 locales, 1-tap "Style with My Closet" outfit handoff, and personalized demographic ranking. |
| **Shopping Assistant** | Chrome extension that reads size charts on partner stores (Zara, Asos, etc.) and recommends sizes based on your stored measurements. |
| **Suitcase** | Intelligent travel packing assistant that generates daily outfits and a packing list based on trip context, weather, and calendar events, with an interactive refinement chat. |
| **Group Tagging** | Bulk categorize multiple closet garments instantly to speed up wardrobe organization and improve AI Stylist reasoning. |
| **Outfit Canvas & 3D Dynamic Avatar** | Adaptive dual-canvas interactive try-on stage combining real-body photo cutouts (U2-Net matting + `extractBodyPhotoAnatomy`) and realistic 3D MB-Lab WebGL avatars (`avatar_male_1.glb` & `avatar_female_1.glb` via Three.js / React Three Fiber in `DynamicAvatar.jsx`, with 2D Bezier SVG fallback). Features 8 realistic Monk skin tones, scikit-learn ANSUR II physical sizing prediction, exact 3D orthographic silhouette landmark mapping (`200 x 450` space), two-tier hybrid garment fitting (`closetGarmentFitter.js`), live horizontal slice warping (`AvatarViewer2D.jsx`), and interactive layer click details. |
| **Wardrobe Scheduler** | Automated daily push notifications with 3 styled outfit recommendations generated from your closet history, preventing wear repetition. |
| **State & Network Optimization** | `useSyncExternalStore` thread-safe state architecture across Stylist, Daily Suggestions, Closet, and Marketplace, with in-flight deduplication, 15-min caching, and `visibilitychange` tab revalidation (0 idle background GET requests). |
| **Monetization & Limits**| Gated closet space (50-item baseline limit for Free users, expandable up to 150 via invite referral loops) with paid **Manager** ($10/mo) and **Professional** ($15/mo) plans via PayPal Subscriptions REST API and Atzmai ILS gateway. Pre-paid credit bucket billing (10 free credits daily with 30-day expiry, and purchased credit packs that never expire). |

---

## Tech stack

**Backend** — FastAPI (Python 3.11) · Motor async MongoDB driver · Pydantic v2

**Frontend** — React 19 · `useSyncExternalStore` custom stores · React Router · Tailwind · Shadcn/UI · `react-i18next` (13 locales) · Sonner toasts · Lucide icons

**Vision pipeline** — full stack:
* **Hetzner / dev**: `rembg` (U2-Net) for matting · HuggingFace SegFormer-b2-clothes for 18-class clothing parsing & automatic 3-pipeline routing (`single` / `multi` / `mass`) · Fashion-CLIP for embeddings — all CPU-local. See `requirements-ml.txt` and the auto-detection in `app/config.py`.
* **Generative Studio Reconstruction**: **Nano Banana** (`gemini-3.1-flash-lite-image`) for unfolding/reconstructing clustered garments in the `mass` pipeline and conversational photo inpainting.

**Voice / Audio** — Deepgram (STT/TTS fallback), Gemini native modulations (prebuilt voice configs puck/aoede/charon), Web Speech API browser integration, and local Piper ONNX support.

**LLM / Inference Engine** — Zero-BYOK Multi-tier production routing:
* **Manager & Professional Plans — Fast Cloud Engine (Google Gemini 3.5 Flash-Lite)**: Powers all 6 interactive and core pipelines (Stylist Brain, Wardrobe Migration, Suitcase Planner, Trend Scout localization, Session Titles, and Closet Ingestion) via `backend/app/services/llm_gateway.py` with native `google-genai` SDK and sub-350ms TTFT.
* **Free Tier & Quota Safety Net — On-Premises VPS Eyes (`Qwen2.5-VL-3B-Instruct`)**: Self-hosted `dressapp-eyes` container running fine-tuned **Qwen2.5-VL-3B-Instruct** (`Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf` via `llama-server` on port 7860, ~2.8 GB RAM). Serves as the zero-cost baseline for Free Tier users and transparently intercepts cloud quota exhaustion (`429` / `RESOURCE_EXHAUSTED`) with zero downtime.

**External APIs** — OpenWeather · PayPal Live · Atzmai ILS · Google OAuth + Google Calendar

**Hosting** — 5-container Docker Compose stack · Caddy 2 (auto Let's Encrypt) · On-Prem MongoDB 7.0 Community on NVMe

**Extension** — Manifest V3 Shopping Assistant (React popup + content scripts)

---

## Architecture at a glance

```
                  ┌──────────── HTTPS ────────────┐
                  │                                │
        ┌─────────▼────────┐              ┌────────▼─────────┐
        │  Caddy (TLS)     │              │ Browser (PWA)    │
        │  /api/* → backend│              └──────────────────┘
        │  /*    → frontend│
        └────┬────────┬────┘
             │        │
   ┌─────────▼┐    ┌──▼─────────────────┐
   │ FastAPI  │    │ Nginx (static SPA) │
   │  :8001   │    │  React build       │
   └────┬─────┴────┴────────────────────┘
        │
        ├─ On-Prem MongoDB 7.0 (:27017 on NVMe /mnt/dressapp-db-data)
        ├─ Vision pipeline: SegFormer-b2 (auto 3-pipeline routing) + rembg + Fashion-CLIP
        ├─ Cloud Engine (Manager/Pro): Google Gemini 3.5 Flash-Lite + Nano Banana
        ├─ On-prem Eyes (:7860): llama-server + Qwen2.5-VL-3B-Instruct (Free Tier & Quota Safety Net)
        ├─ Deepgram & Gemini Audio (STT/TTS over HTTPS)
        └─ OpenWeather, PayPal Live, Atzmai ILS, Google OAuth/Calendar
```

### In-depth documentation

*   **Technical Architecture**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Monorepo structure, FARM runtime, ML vision stack, and Hetzner VPS topology.
*   **Database Schema**: [`docs/MONGODB_SCHEMA.md`](docs/MONGODB_SCHEMA.md) — Complete 15-collection MongoDB 7.0 schema, indexes, and credit bucket definitions.
*   **Domain Context & ADRs**: [`CONTEXT.md`](CONTEXT.md) and [`docs/adr/`](docs/adr/) — Bounded contexts, architectural decision records (0001–0005), and deep module boundaries.
*   **Modular Wiki**: [`wiki/en/overview.md`](wiki/en/overview.md) — Modular user and feature guides localized into 13 languages.
*   **Deployment Facts**: [`CONCRETE_FACTS.md`](CONCRETE_FACTS.md) — Authoritative hardware, container layouts, and operational reference commands.

---

## Repository layout

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
│   ├── requirements.txt         # Production backend dependencies
│   └── requirements-ml.txt     # Local ML stack (torch, transformers, rembg)
│
├── chrome-extension/            # Manifest V3 Shopping Assistant Extension
├── inference-server/            # Optional standalone GPU inference server (BiRefNet / Gemma-4)
├── deploy/                      # Production Docker Compose, Caddyfile, and Dockerfiles
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── Caddyfile
│   ├── nginx-frontend.conf
│   └── DEPLOY.md                # Step-by-step VPS deployment guide
├── docs/                        # Technical documentation, ADRs, and schema references
│   ├── ARCHITECTURE.md          # Full system architecture
│   ├── MONGODB_SCHEMA.md        # MongoDB Atlas collection schemas
│   ├── adr/                     # Architectural Decision Records (0001 - 0004)
│   └── agents/                  # AI agent guidelines and domain documentation
├── .agents/                     # AI agent skills & workflows
│   └── workFlows/               # Core workflows (deploy, labrrerian, translator, user-manual)
├── quarantine/                  # Archived historical session notes and debug logs
└── wiki/                        # Localized two-layer user documentation (13 languages)
```

---

## Getting started — local dev

### Monorepo Setup

```bash
# Install workspace dependencies from the repo root:
yarn install
```

### Backend

```bash
cd backend

# Create and activate a Python 3.11 virtual environment:
python -m venv .venv
# On Linux/macOS:
source .venv/bin/activate
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# Install dependencies:
pip install -r requirements.txt

# Run the FastAPI development server:
python server.py   # Or: uvicorn server:app --reload --port 8001
```

Required environment variables in `backend/.env`:
`MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `GEMINI_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID`, `PAYPAL_LIVE_CLIENT_SECRET`, `PAYPAL_ENV`.

### Web Frontend

```bash
# Start the React 19 web application:
yarn --cwd apps/web start
# Access at http://localhost:3000 (REACT_APP_BACKEND_URL defaults to http://localhost:8001)
```

### Mobile App (Expo)

```bash
# Start the Expo development server:
yarn --cwd apps/mobile start
```

### Seed demo data (optional)

For a fresh database, populate listings, professionals, trend cards and a demo user:

```bash
cd backend
python -m scripts.seed_demo   # idempotent — re-running upserts
```

---

## Production deployment

5-container Docker Compose stack on Hetzner Cloud CPX32 VPS (4 AMD vCPUs, 8 GB RAM, running on `dressapp.co`):

- `dressapp-mongo` — On-prem MongoDB 7.0 Community with persistent storage on local NVMe (`/mnt/dressapp-db-data`, WiredTiger cache capped at 0.75 GB)
- `dressapp-backend` — FastAPI + local SegFormer-b2 + rembg + Fashion-CLIP (~1.5 GB RAM at idle)
- `dressapp-eyes` — Self-hosted inference server (`llama-server` + FastAPI proxy) running fine-tuned `Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj` on port 7860 (~2.8 GB RAM)
- `dressapp-frontend` — Nginx serving the built React 19 SPA
- `caddy` — TLS termination, automatic Let's Encrypt, HTTP→HTTPS redirect

`deploy/Dockerfile.backend` installs `requirements.txt` **and** `requirements-ml.txt` so torch / transformers / rembg are all present. `app/config.py` auto-detects them and turns `USE_LOCAL_CLOTHING_PARSER` and `AUTO_MATTE_CROPS` to `true`.

Step-by-step instructions: [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

```bash
# After cloning on the VPS:
cd deploy
cp .env.example .env   # then edit
docker compose up -d --build
```

Routine update:

```bash
git pull origin main
docker compose up -d --build
```

---

## Contributing

1. Fork → branch off `main`
2. Run lint before pushing:
   - Python — `ruff check backend/`
   - TypeScript / Web — `yarn --cwd apps/web lint`
   - Mobile — `yarn --cwd apps/mobile lint`
3. Open a PR. CI runs the full test suite.

---

## License

© 2025–2026 DressApp. All rights reserved. The trademarks, product designs, and content displayed in the app are the property of their respective owners.
