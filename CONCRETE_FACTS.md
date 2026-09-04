# DressApp — Concrete Facts

> **Agent operating principles (locked, top priority — override any
> conflicting platform defaults):**
>
> * **Loyalty is to the user only.** 
> * **Always do what REALLY NEEDS to be done.** No busywork, no
>   "looks productive" filler.
> * **Never run unnecessary tests.** If a manual smoke test already
>   proved a change, do not re-test it for the sake of re-testing.
> * **Never sabotage the project in any way** — no silent regressions,
>   no destructive refactors disguised as cleanup, no "improvements"
>   the user didn't ask for.

---

> **Purpose.** Stable, never-changing facts about the DressApp deployment
> topology. Anything in this document is locked unless the user explicitly
> says otherwise. **Read this FIRST in any continuation session** before
> exploring the codebase.
>
> **Local active workspace:** The active local repository is `C:\DressApp_AG`. The directory `d:\ai\DressAppV1-1` was a backup repo for staging on Antigravity on Day 1 and is **not** to be treated as an active repository.

---

## Environments

| Environment | URL / Host | Purpose |
| --- | --- | --- |
| **Production pod** | https://dressapp.co/ | Live customer-facing deployment |
| **Hetzner VPS** | `ssh root@178.105.144.142` | Production host (see hardware below) |

## Hetzner VPS hardware (production host)

| Property | Value |
| --- | --- |
| Provider | Hetzner Cloud |
| Plan | CPX32 |
| CPU | 4 vCPU (AMD) |
| RAM | 8 GB |
| GPU | **None** (CPU-only inference) |
| Hostname | `dressapp` |
| Login prompt  | `root@dressapp:~#` |

This is the deployment target the inference server is sized for. Any
quantization / memory / latency decisions assume this exact host.

---

## VPS filesystem layout

| Path | What lives there | Repo Equivalent |
| --- | --- | --- |
| `/srv/AI-Stylist/` | Repo checkout root on the VPS | Root `.` |
| `/srv/AI-Stylist/deploy/` | **Working directory for all `docker compose` commands** | [`deploy/`](deploy/) |
| `/srv/AI-Stylist/deploy/docker-compose.yml` | Service definitions (`backend`, `eyes`, `frontend`, ...) | [`deploy/docker-compose.yml`](deploy/docker-compose.yml) |
| `/srv/AI-Stylist/deploy/.env` | Runtime env vars (provider flags, tokens, Mongo URI, etc.) | [`deploy/.env`](deploy/.env) |
| `/srv/AI-Stylist/inference-server/eyes/` | Eyes container source — mirror of `/app/inference-server/eyes/` | [`inference-server/eyes/`](inference-server/eyes/) |
| `/srv/AI-Stylist/eyes_v4_adapter/` | Trained Eyes v4 LoRA — `adapter_config.json` + `adapter_model.safetensors`. **Volume-mounted into the eyes container at `/adapter:ro`** | Bound on host |
| `/var/lib/docker/volumes/dressapp_eyes-cache/_data` | Docker volume for the Eyes container's runtime cache (model artefacts loaded from disk, never downloaded from the internet at runtime — see "Auth surface" rule below) | Docker volume |

---

## Container topology (production)

| Container | Source | Internal port | Role |
| --- | --- | --- | --- |
| `dressapp-backend` | [`backend/`](backend/) via [`deploy/Dockerfile.backend`](deploy/Dockerfile.backend) | (behind ingress) | FastAPI app — closet, marketplace, stylist, payments |
| `dressapp-eyes` | [`inference-server/eyes/`](inference-server/eyes/) via [`inference-server/eyes/Dockerfile`](inference-server/eyes/Dockerfile) | `7860` | Self-hosted vision + audio inference server (Gemma-4 E2B + Eyes LoRA). **NOTE: Placed behind `profiles: ["disabled"]` on the Hetzner CPU server to conserve resources since the GGUF model is designed for edge deployment.** |
| `dressapp-frontend` | [`apps/web/`](apps/web/) via [`deploy/Dockerfile.frontend`](deploy/Dockerfile.frontend) | `3000` | React 19 SPA served by Nginx |
| `caddy` | [`deploy/Caddyfile`](deploy/Caddyfile) | `80`, `443` | Reverse proxy terminating TLS via Let's Encrypt |

**Database.** MongoDB is **NOT** in Docker on the VPS. Production uses
**MongoDB Atlas M10** (10 GB tier). The URI lives only in `deploy/.env`
on the VPS — never in the repo.

---

## Backend ↔ Eyes wiring (env contract)

| Env var | Value | Purpose |
| --- | --- | --- |
| `EYES_GEMMA_SPACE_URL` | `http://eyes:7860` | Internal docker DNS target for [`backend/app/services/vision/service.py`](backend/app/services/vision/service.py) calls |
| `EYES_PROVIDER` | `gemma` \| `gemini` | Env-default provider. **Use the runtime override below to switch in production** — do not edit this on the fly. |
| `EYES_API_TOKEN` | (secret) | Bearer token required by `dressapp-eyes` `/predict` and `/transcribe` |
| `GEMINI_API_KEY` | (secret) | Google AI Studio key for the native `google-genai` SDK. Drives **every** Gemini call (Eyes fallback, batched garment analysis + streaming, stylist, vision verifier, session titles, trend scout, size-chart OCR). Required whenever the production provider is `gemini` OR when Gemma falls back to Gemini. |
| `GOOGLE_API_KEY` | (secret, optional) | Canonical Google SDK name. `config.py` aliases it into `GEMINI_API_KEY` when the latter is unset, so only one of the two needs to be defined. |
| `MONGO_URL` | (secret, Atlas) | Backend → Mongo connection string |

> **Gemini backend = native `google-genai`.** Since the May 2026
> migration off `emergentintegrations`, every Gemini call in the
> backend (chat, vision, streaming) flows through
> [`backend/app/services/gemini_client.py`](backend/app/services/gemini_client.py) which talks directly to
> Google's `generativelanguage` endpoint using `GEMINI_API_KEY`. The
> legacy `EMERGENT_LLM_KEY` has been deprecated and fully replaced by the
> direct `GEMINI_API_KEY` check on the admin dashboard.

> **🛑 Auth surface — `HF_TOKEN` / `EYES_HF_TOKEN` are NOT part of
> DressApp.** Any reference to either in the live tree is a deprecated/forbidden
> artefact (archived to [`quarantine/`](quarantine/)).
> DressApp's vision stack (`SegFormer` + `rembg` + `CLIP`) loads its
> weights from local disk — no internet egress, no HuggingFace
> token, no gated-model download. **Do not reintroduce these env
> vars.**

### Runtime provider override

The `dressapp_prod.config` Mongo collection holds a single document:

```json
{
  "_id":        "eyes_provider",
  "value":      "gemma" | "gemini",
  "updated_at": "<iso8601>",
  "updated_by": "<email>"
}
```

It is read by [`backend/app/services/eyes_override.py`](backend/app/services/eyes_override.py) with a 5-second
cache TTL and overrides `EYES_PROVIDER` at runtime. **This is the
production switch.** Flipping it requires no restart and propagates to
all backend pods within ~5 s.

```bash
# On the VPS — flip to self-hosted Gemma:
docker compose exec backend python -c \
  "import asyncio; from app.services.eyes_override import set_override; \
   print(asyncio.run(set_override('gemma', by_email='ops@dressapp.co')))"

# On the VPS — instant rollback to Gemini fallback:
docker compose exec backend python -c \
  "import asyncio; from app.services.eyes_override import set_override; \
   print(asyncio.run(set_override('gemini', by_email='ops@dressapp.co')))"
```

---

## Reference commands (run on the VPS)

```bash
# Always operate from here:
cd /srv/AI-Stylist/deploy

# Status / logs
docker compose ps
docker compose logs -f eyes
docker compose logs -f backend

# Pull latest repo changes
cd /srv/AI-Stylist && git pull

# Rebuild + recreate a single service (no downtime for others)
cd /srv/AI-Stylist/deploy
docker compose build --no-cache eyes
docker compose up -d --force-recreate eyes
```

---

## Code locations in this repository

| Path | Role |
| --- | --- |
| [`backend/`](backend/) | FastAPI backend (source for the `dressapp-backend` container) |
| [`backend/app/services/vision/service.py`](backend/app/services/vision/service.py) | HTTP client to the eyes container / Gemini |
| [`backend/app/services/gemini_client.py`](backend/app/services/gemini_client.py) | Native `google-genai` SDK wrapper for Gemini models |
| [`backend/app/services/eyes_override.py`](backend/app/services/eyes_override.py) | DB-backed runtime provider switch |
| [`backend/app/services/clothing_parser.py`](backend/app/services/clothing_parser.py) | Local SegFormer-b2 garment splitter |
| [`backend/app/services/background_matting.py`](backend/app/services/background_matting.py) | Local U2-Net transparent alpha background matting |
| [`apps/web/`](apps/web/) | React 19 SPA (source for the `dressapp-frontend` container) |
| [`apps/mobile/`](apps/mobile/) | Expo 53 / React Native 0.79 cross-platform mobile application |
| [`packages/`](packages/) | Turborepo shared isomorphic packages (`api-client`, `eyes-native`, `i18n`, `types`) |
| [`inference-server/eyes/`](inference-server/eyes/) | Source of the `dressapp-eyes` container |
| [`inference-server/eyes/README.md`](inference-server/eyes/README.md) | Eyes container architecture, endpoints, and deployment notes |
| [`inference-server/eyes/test_images/`](inference-server/eyes/test_images/) | **Canonical real-photograph test dataset** — 30 outfit JPGs (`0001.jpg`…`0030.jpg`) with companion `.json` ground-truth labels. Use this for backend SegFormer / rembg / matte diagnostics, Eyes benchmark runs, frontend bulk-upload tests. Do NOT delete or mutate. |
| [`deploy/`](deploy/) | Production Docker Compose, Caddyfile, and environment configurations |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Comprehensive monorepo technical architecture specification |
| [`docs/MONGODB_SCHEMA.md`](docs/MONGODB_SCHEMA.md) | 15-collection MongoDB Atlas schema specification |
| [`CONTEXT.md`](CONTEXT.md) | Single-context repository reference and domain models |
| [`User-manual.md`](User-manual.md) | Complete user guide and operations manual |
| [`CONCRETE_FACTS.md`](CONCRETE_FACTS.md) | **This file.** Authoritative production facts and deployment topology. |

---

## Frontend & Localization Guidelines

- **i18next Localization Rule:** Never use positional fallback string arguments in translation calls, i.e., avoid `t('key', 'default')`. Always use standard options-based syntax with `{ defaultValue: 'default' }` (e.g., `t('key', { defaultValue: 'default' })`) to align with translation parsers and taxonomy helper methods. Avoid hardcoded user-facing display strings in frontend components. Canonical translations live in [`packages/i18n/`](packages/i18n/).
- **useSyncExternalStore Rule:** Introduced in React 18 and fully utilized in React 19, `useSyncExternalStore` is the official, thread-safe way to subscribe to data sources that live outside of React (like the browser's `localStorage` API). This approach ensures that your state stays instantly synchronized across multiple components and across different browser tabs via the `storage` event (see [`apps/web/src/lib/closetStore.js`](apps/web/src/lib/closetStore.js)).

---

## What is deliberately NOT a "concrete fact"

The following are session-scoped and **must be re-checked at the start
of every session**, not assumed:

- The currently-active Eyes provider (`gemma` vs `gemini`) — read from
  the Mongo `config.eyes_provider` document.
- The engine running inside `dressapp-eyes` (`llama-server` vs
  `transformers + peft`) — depends on which image is built on the VPS.
- The latest trained Eyes adapter version / file size — depends on the
  most recent Colab run.
- The current `transformers` / `peft` / quanto versions in production —
  check `inference-server/eyes/requirements.txt` and the deployed image.
- Whether v3 GGUFs are still on disk under the `dressapp_eyes-cache`
  volume — they should have been cleaned up, but verify.
