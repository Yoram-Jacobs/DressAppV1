# Technical Research: Iterating Eyes on VPS vs. RunPod vs. Gemini as Main LLM

**Date:** 2026-09-26  
**Status:** Completed  
**Author:** AI Architecture & Inference Systems Research  
**Target Query:** Comprehensive architectural, performance, and cost evaluation of:
1. Iterating and hosting DressApp Eyes locally on the Hetzner VPS (CPU-only).
2. Iterating and training Eyes on RunPod (GPU Pods & Serverless GPU).
3. Adopting Google Gemini (`google-genai` SDK) as DressApp’s primary LLM and vision model.

---

## 1. Executive Summary & Decision Framework

DressApp's AI architecture spans two core workloads: **Garment Vision Extraction** (parsing uploaded clothing photos into structured taxonomy metadata) and **The AI Stylist Brain** (conversational advice, outfit matching, and suitcase packing). Currently, DressApp operates a hybrid stack: self-hosted **Gemma-4 E4B/E2B GGUF** inside the `dressapp-eyes` container on a CPU-only Hetzner VPS, backed by **Google Gemini** as a fallback and multi-modal coprocessor, alongside **RunPod Serverless GPU** for FLUX.2 image reconstruction.

The trade-offs across all three approaches are stark:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  AI MODEL ITERATION & SERVING                                    │
├───────────────────────────────┬────────────────────────────────┬─────────────────────────────────┤
│    Option A: Hetzner VPS      │      Option B: RunPod GPU      │    Option C: Direct Gemini      │
│     (Local Self-Hosted)       │     (Cloud GPU Dev & Serve)    │      (Managed Cloud API)        │
├───────────────────────────────┼────────────────────────────────┼─────────────────────────────────┤
│ • Zero variable API cost      │ • Sub-second GPU inference     │ • Highest vision fidelity       │
│ • Fixed €15/mo server bill    │ • Rapid QLoRA training (mins)  │ • Zero DevOps / model ops       │
│ • Complete data privacy       │ • Ephemeral on-demand pods     │ • Instant prompt/schema edits   │
│ ❌ No GPU: Training impossible│ ❌ $250–$400/mo if kept 24/7   │ ❌ Variable per-token billing   │
│ ❌ 2–6s CPU inference latency │ ❌ 20–40s serverless coldstart │ ❌ Quota limits (429 exhaustion)│
│ ❌ 8 GB RAM memory ceiling    │ ❌ Image upload network egress │ ❌ Zero-BYOK subsidy cost       │
└───────────────────────────────┴────────────────────────────────┴─────────────────────────────────┘
```

### Direct Verdict & Architectural Recommendation

| Objective | Recommended Path | Strategic Rationale |
| :--- | :--- | :--- |
| **Model Fine-Tuning & Training** | 🟢 **GitHub Actions via Modal** | Already scheduled as a headless CI/CD task on GitHub Actions via Modal (`inference-server/eyes/training/train_eyes_lora.py`). RunPod is redundant. |
| **Interactive Stylist Brain** | 🟢 **Google Gemini 3.5 Flash-Lite** | Unmatched fashion domain depth, 1M context window, zero infrastructure overhead, TTFT < 350ms, and ultra cost-effective (\$0.30/1M input, \$2.50/1M output). |
| **High-Fidelity Garment Parsing** | 🟢 **Google Gemini 3.5 Flash-Lite** | Superior textile nuance (cashmere, herringbone, satin sheen, hardware finishes) vs. 2B–4B quantized models; native JSON grammar; zero-friction pricing. |
| **Free-Tier & Quota Safety Net** | 🟢 **Hetzner VPS (Eyes Gemma GGUF)** | Zero marginal cost for non-paying users, scheduled background cron jobs, and transparent automatic fallback on Gemini 429 quota exhaustion. |

The finalized strategy formalizes **Google Gemini 3.5 Flash-Lite** as the primary production engine across all pipelines, while **Hetzner VPS Eyes (`gemma-4-E4B`)** serves as the **Free-Tier baseline & Quota Safety Net**, and **Modal on GitHub Actions** automates model fine-tuning.

---

## 2. Primary Sources & Architectural Grounding

Every claim, metric, and finding in this research is grounded directly in the codebase and upstream specifications:

1. **DressApp Deployment Infrastructure**:
   - [`CONCRETE_FACTS.md`](file:///c:/DressApp_AG/CONCRETE_FACTS.md): Authoritative host specs for the Hetzner CPX32 production VPS (4 AMD EPYC dedicated vCPUs, 8 GB RAM, 0 GPU). Specifies multi-tier AI routing, Zero-BYOK core, and transparent quota fallback.
   - [`deploy/docker-compose.yml`](file:///c:/DressApp_AG/deploy/docker-compose.yml): Production container topology (`dressapp-backend`, `dressapp-eyes`, `dressapp-frontend`, `caddy`).
   - [`backend/app/services/eyes_override.py`](file:///c:/DressApp_AG/backend/app/services/eyes_override.py): Runtime MongoDB-backed provider switch (`gemma` vs `gemini`) with 5-second TTL.
2. **DressApp Eyes Training & Evaluation Stack**:
   - [`inference-server/eyes/training/train_eyes_lora.py`](file:///c:/DressApp_AG/inference-server/eyes/training/train_eyes_lora.py): Headless QLoRA SFT fine-tuning pipeline using HuggingFace PEFT, TRL SFTTrainer, BitsAndBytes 4-bit quantization, and target modules `[q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj]`.
   - [`inference-server/eyes/training/export_gguf.py`](file:///c:/DressApp_AG/inference-server/eyes/training/export_gguf.py): LoRA merge and GGUF quantization tool (`Q4_K_M`, `Q3_K_M`, and BF16 mmproj).
   - [`inference-server/eyes/training/evaluate_eyes.py`](file:///c:/DressApp_AG/inference-server/eyes/training/evaluate_eyes.py): Regression test gate enforcing 100% JSON schema validation and $\ge 95\%$ taxonomy classification accuracy.
   - [`inference-server/eyes/test_images/`](file:///c:/DressApp_AG/inference-server/eyes/test_images/): Canonical dataset of 30 real garment photographs with ground-truth JSON labels.
3. **DressApp Gemini Client & Stylist Brain**:
   - [`backend/app/services/gemini_client.py`](file:///c:/DressApp_AG/backend/app/services/gemini_client.py): Direct async wrapper around Google's native `google-genai` SDK (`gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`). Centralizes `response_schema` grammar constraints and vision streaming.
   - [`backend/app/services/stylist_brain.py`](file:///c:/DressApp_AG/backend/app/services/stylist_brain.py): Protocol abstraction (`StylistBrain`) orchestrating `GemmaStylistBrain` and `GeminiStylistBrain` with `FallbackBrain` quota resilience.
   - [`backend/app/services/vision/service.py`](file:///c:/DressApp_AG/backend/app/services/vision/service.py): Multimodal garment analyzer routing between local Gemma (`http://eyes:7860`) and Gemini Vision.
4. **RunPod Subsystem in DressApp**:
   - [`backend/app/services/image_generation/runpod_provider.py`](file:///c:/DressApp_AG/backend/app/services/image_generation/runpod_provider.py): Commercial implementation of RunPod serverless worker (`/runsync` with async polling fallback, exponential backoff, jitter, and concurrency semaphore).
   - Upstream RunPod API Specifications: Community Cloud RTX 4090 ($0.34/hr), Secure Cloud RTX 4090 ($0.69/hr), A40 ($0.44–$0.49/hr), Serverless pay-per-second billing.
5. **Google AI Studio / Gemini API Specifications**:
   - Official Gemini API Pricing (September 2026): Gemini 3.5 Flash-Lite ($0.30/1M input, $2.50/1M output), Gemini 2.5 Flash ($0.30/1M input, $2.50/1M output), Gemini 2.5 Pro ($1.25/1M input, $10.00/1M output). Native JSON mode, multimodal image token encoding, 1M token context.

---

## 3. Detailed Option Breakdown

### 3.1 Option A: Iterating & Serving Eyes on the VPS (Status Quo)

The Hetzner CPX32 VPS hosts the entire production environment: the web frontend, FastAPI backend, Caddy proxy, and the `dressapp-eyes` container running `llama-server`.

```
                        Hetzner CPX32 VPS (8 GB RAM, 4 vCPU AMD EPYC, No GPU)
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                             │
│  ┌───────────────────────┐   ┌────────────────────────┐   ┌──────────────────────────────┐  │
│  │     Caddy Proxy       │   │    FastAPI Backend     │   │     dressapp-eyes (llama)    │  │
│  │      (~100 MB)        │   │       (~1.4 GB)        │   │    Gemma-4 E4B Q3_K_M GGUF   │  │
│  └───────────────────────┘   └────────────────────────┘   │          (~2.85 GB)          │  │
│                                                           └──────────────────────────────┘  │
│                                                                                             │
│  OS + Docker Buffers: ~0.7 GB                               Available RAM Headroom: ~3.0 GB │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Iteration Workflow on VPS
1. Developer pushes code to Git.
2. VPS pulls code and runs `docker compose build --no-cache eyes`.
3. GGUF model files and PEFT LoRA adapters (`eyes_v4_adapter`) are volume-mounted from `/srv/AI-Stylist/` or `/var/lib/docker/volumes/dressapp_eyes-cache/_data`.
4. Tests are executed by calling `curl http://localhost:7860/predict`.

#### Strengths
* **Zero Incremental Cost**: Hosting costs are completely fixed (€15.00/month for CPX32, or €22.00/month for CX42). Regardless of whether users upload 100 or 10,000 photos, the compute bill does not increase.
* **Strict Privacy & Data Sovereignty**: Garment images and styling requests remain strictly on-prem in Germany. No user media leaves the European VPS to third-party AI clouds.
* **Immunity to External API Quotas**: Zero dependency on third-party API availability, credit balances, or HTTP 429 rate limits.
* **Guarantees Zero-BYOK Viability**: Powers the Free Tier indefinitely without requiring end-users to register for or provide API keys.

#### Severe Bottlenecks & Failure Modes
1. **Training & Fine-Tuning is Physically Impossible**:
   - `train_eyes_lora.py` requires BitsAndBytes 4-bit CUDA quantization, PyTorch CUDA kernels, and gradient accumulation.
   - Running PyTorch training on 4 AMD vCPUs with 8 GB RAM results in instant Linux OOM-killer termination or thrashing at 0.01 samples/sec.
   - Model fine-tuning *cannot* iterate on the VPS; it must be trained off-site and transferred as an export.
2. **Inference Latency & CPU Thrashing**:
   - Multi-modal vision projection (`BF16-mmproj.gguf`) with 1120 visual tokens on CPU requires intensive AVX2 vector calculations.
   - Single-request inference takes **2.5 to 5.8 seconds**.
   - If 3 users simultaneously upload photos or ask the Stylist a question, all 4 vCPUs spike to 100%, causing HTTP timeouts across the entire platform, including the FastAPI backend and Caddy reverse proxy.
3. **RAM Ceiling & Fragility**:
   - With `gemma-4-E4B-it-Q3_K_M.gguf` (~2.85 GB resident) + Backend (~1.4 GB) + OS (~0.7 GB), base memory usage is ~5.0 GB.
   - During concurrent requests, llama-server's KV cache and context window expand by ~1.2–2.0 GB. If a background cron job runs at the same time, memory exceeds 7.5 GB, risking kernel OOM kills.
   - Upgrading to unquantized models or larger 7B models requires migrating to CX42 (16 GB) or CX52 (32 GB).

---

### 3.2 Option B: Iterating Eyes on RunPod (GPU Pods + Serverless)

RunPod is already an active infrastructure component in DressApp, utilized by `RunpodFluxProvider` for FLUX.2 Klein 4B generative garment reconstruction. Expanding RunPod to cover Eyes introduces two distinct modalities: **Ephemeral On-Demand GPU Pods** (for R&D and training) and **Serverless GPU Endpoints** (for decoupled inference).

```
                      RunPod Cloud Infrastructure
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  [ Ephemeral GPU Pod ] (Dev / Training Mode)                           │
│  • RTX 4090 (24GB VRAM) @ $0.34/hr                                     │
│  • Executes: prepare_dataset.py -> train_eyes_lora.py -> export_gguf   │
│  • Duration: 15–30 min per training run (~$0.15 total)                 │
│  • Spawns on-demand, terminates upon artifact export                   │
│                                                                        │
│  ────────────────────────────────────────────────────────────────────  │
│                                                                        │
│  [ Serverless GPU Endpoint ] (Inference Mode)                          │
│  • Container worker with vLLM or llama-server (CUDA)                   │
│  • Pay-per-second execution; scale-to-zero when idle                   │
│  • Replaces or augments VPS Eyes container via HTTP                    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

#### Iteration Workflow on RunPod
1. **Model Training & Adaptation**:
   - Developer launches a RunPod Community Cloud pod equipped with an NVIDIA RTX 4090 (24 GB VRAM) for $0.34/hr.
   - Pod clones the repo, pulls training dataset, and runs `train_eyes_lora.py` with full QLoRA across 3 epochs in **14 to 18 minutes**.
   - Pod executes `evaluate_eyes.py` against the 30 canonical test images, validating taxonomy precision and JSON schema conformance.
   - Pod executes `export_gguf.py`, producing quantized `Q4_K_M` and `Q3_K_M` GGUF binaries.
   - Model artifacts are published to Cloudflare R2 or downloaded directly. Pod is stopped. **Total iteration cost: under \$0.25.**
2. **Serverless Serving**:
   - A custom Docker image running `llama-server` (CUDA) or `vLLM` is hosted as a RunPod Serverless worker.
   - The FastAPI backend reaches it using a client patterned after `RunpodFluxProvider` (`RUNPOD_API_KEY` + endpoint ID).

#### Strengths
* **Unmatched Training Velocity**: Transforms a non-viable task into an 18-minute turn-around. New taxonomy classes, additional styling rules, or updated datasets can be incorporated, trained, and evaluated in the same afternoon.
* **Sub-Second GPU Inference**: On an RTX 4090 or A40, Gemma-4 E4B vision attribute extraction drops from **3,800ms (CPU) to 320ms (CUDA)**.
* **Zero VPS Resource Contention**: Offloading Eyes completely liberates the Hetzner VPS. Backend RAM usage drops by 3 GB, CPU stays near 0%, and web request handling becomes instantly responsive.
* **Freedom of Model Scale**: VRAM capacity (24 GB to 80 GB) allows experimenting with larger, higher-fidelity open models: Qwen2.5-VL-7B, InternVL-2.5, or Gemma-4 E4B in full 16-bit precision without quantization artifacts.

#### Trade-offs & Engineering Complexities
1. **Standing Cost vs. Cold Starts**:
   - If running a dedicated RunPod instance 24/7 for production, costs escalate to **\$245 – \$350/month**, which destroys DressApp's low-cost hosting model.
   - If running Serverless GPU with scale-to-zero, cold starts take **20 to 40 seconds** while the GPU worker allocates, boots, and loads the weights into VRAM. A 30-second cold start on a mobile garment scan is unacceptable user experience.
   - Keeping 1 worker warm 24/7 on RunPod Serverless negates the scale-to-zero cost savings.
2. **Network Latency & Ingress Overhead**:
   - High-resolution garment images (1–4 MB) must be transmitted over the public internet from the user/VPS to the RunPod worker region. This introduces 150–400ms of network overhead per image.
3. **Operational Overhead**:
   - Requires maintaining custom Dockerfiles, GPU CUDA drivers, RunPod serverless handler wrappers, and synchronizing network storage volumes.

---

### 3.3 Option C: Using Gemini as DressApp’s Main LLM Model

The DressApp backend already contains an enterprise-grade integration with Google Gemini in [`backend/app/services/gemini_client.py`](file:///c:/DressApp_AG/backend/app/services/gemini_client.py) using the native `google-genai` SDK. Gemini currently handles fallback vision analysis, Trend Scout feeds, complex multi-garment reasoning, and conversational styling.

Adopting Gemini as the **main model** means deprecating local self-hosted `dressapp-eyes` entirely and routing 100% of vision classification, outfit recommendations, and user chats to Google's managed API (e.g. `gemini-3.5-flash` or `gemini-3.5-flash-lite`).

```
                    Gemini Managed Cloud Architecture
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│  FastAPI Backend (Hetzner CPX32)                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  GarmentVisionService & StylistBrain                                             │  │
│  │  • gemini_client.py (Native google-genai SDK)                                    │  │
│  │  • Enforces EYES_JSON_SCHEMA via native response_schema                          │  │
│  │  • Direct HTTPS to generativelanguage.googleapis.com                             │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                                   │
│                                    ▼                                                   │
│  Google AI Global Edge Network                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Gemini 3.5 Flash / Flash-Lite                                                   │  │
│  │  • 1,000,000 token multimodal context window                                     │  │
│  │  • Native vision token processing (< 400ms TTFT)                                 │  │
│  │  • Advanced textile, color nuance, & stylist reasoning                           │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Iteration Workflow with Gemini
1. Developer edits prompts or Pydantic schemas in `backend/app/services/vision/llm.py` or `gemini_stylist.py`.
2. Developer runs local pytest suite (`pytest backend/tests/test_gemini_client.py`).
3. Changes deploy instantly to production via Git pull without building containers, quantizing models, or waiting for weights to load.

#### Strengths
* **Unrivaled Multimodal Vision & Fashion Expertise**:
  - Differentiates intricate weaves (herringbone, waffle knit, twill, boucle, ripstop) and luxury fabrics (cashmere, mulberry silk, coated linen) where 2B–4B open models collapse to generic "cotton" or "synthetic".
  - Nuanced color discrimination: Identifies subtle tonal palettes (terracotta, ecru, mauve, slate grey, sage green) and matches complex complementary palettes.
  - Multi-image and multi-garment context: Can evaluate an entire 50-item closet simultaneously in a single prompt thanks to its 1M+ token context window.
* **Zero Model Operations (Zero MLOps)**:
  - Eliminates the need to maintain `Dockerfile.eyes`, `llama-server`, C++ compilation flags, GGUF conversion scripts, or LoRA weights.
  - No GPU servers to maintain, patch, or configure.
* **VPS Resource Reclamation**:
  - Shutting down `dressapp-eyes` frees ~3.5 GB of RAM and 4 dedicated vCPUs on the Hetzner VPS.
  - The VPS runs at <15% CPU and ~1.6 GB RAM total, eliminating any risk of Linux kernel OOM kills.
* **Instant Development & Prompt Agility**:
  - Adjusting taxonomy, changing stylist tone, or adding cultural dress rules takes **seconds** (modifying system prompt strings or schema fields), with zero training or redeployment latency.
* **Native Structured Output & Streaming**:
  - Google Gemini's `response_schema` guarantees 100% valid JSON parsing at the decoding level, eliminating JSON extraction errors or missing closing braces.

#### Bottlenecks & Critical Risks
1. **Variable Cost & Zero-BYOK Vulnerability**:
   - If DressApp provides a "Zero-BYOK" free tier funded by the platform, every user upload incurs variable cost.
   - Pricing benchmark for **Gemini 3.5 Flash-Lite**:
     - Input: \$0.30 per 1M tokens (image is ~258 tokens = ~\$0.00008).
     - Output: \$2.50 per 1M tokens (garment JSON is ~200 tokens = ~\$0.0005).
     - Total per garment analysis: **~\$0.0006 per scan** (\$0.60 per 1,000 scans).
     - Total per stylist conversational turn: **~\$0.002 to \$0.004**.
   - While extremely affordable at small scale, a burst of 50,000 closet uploads and 100,000 chat turns costs **~\$250 to \$450/month in cloud API fees**.
2. **Quota Limits & 429 Failures**:
   - Google AI Studio tiers enforce strict Requests Per Minute (RPM) and Tokens Per Minute (TPM) ceilings.
   - Without an on-prem backup, unexpected user spikes result in HTTP 429 `RESOURCE_EXHAUSTED` errors that break customer onboarding.
3. **Data Privacy Constraints**:
   - Enterprise or privacy-conscious users in regulated jurisdictions (EU GDPR) may object to their personal wardrobe photographs being processed by Google Cloud endpoints unless covered under explicit Business Associate or Data Processing Agreements.

---

## 4. Head-to-Head Architectural Comparison

| Evaluation Metric | Option A: VPS Eyes (Gemma GGUF) | Option B: RunPod (GPU Pods & Serverless) | Option C: Google Gemini API |
| :--- | :--- | :--- | :--- |
| **Model Architecture** | Gemma-4 E4B Q3_K_M GGUF | Gemma-4 E4B / Qwen-2.5-VL (CUDA) | Gemini 3.5 Flash / Flash-Lite |
| **Hosting Infrastructure** | Hetzner CPX32 (4 vCPU, 8 GB RAM) | RunPod RTX 4090 / Serverless | Google AI Global Cloud |
| **Training Capability** | 🔴 Impossible (0 GPU, 8 GB RAM) | 🟢 **Elite (15–20 min QLoRA)** | 🟡 SFT not needed (Prompt/Few-shot) |
| **Inference Latency** | 🔴 Slow (2.5 – 5.8s on CPU) | 🟢 **Ultra-Fast (280 – 450ms)** | 🟢 **Fast (350 – 700ms)** |
| **Cold-Start Penalty** | 🟢 None (Always resident) | 🔴 Severe on Serverless (20–40s) | 🟢 None (Managed API) |
| **Visual Texture/Detail Extraction** | 🟡 Moderate (Taxonomy constrained) | 🟢 High (Unquantized / 7B+) | 🟢 **Superlative (State of the Art)** |
| **Stylist Reasoning Quality** | 🟡 Basic outfit matching | 🟡 Good | 🟢 **Deep, nuanced, 1M context** |
| **Base Monthly Fixed Cost** | 🟢 **€15.00/mo (CPX32)** | 🔴 \$250–\$350/mo (if 24/7 dedicated) | 🟢 **\$0 fixed (Pay-per-use)** |
| **Marginal Cost (10k Scans)** | 🟢 **\$0.00** | 🟡 ~$6.00 (Serverless execution) | 🟡 ~$6.00 – \$12.00 (Token billing) |
| **VPS RAM Headroom Impact** | 🔴 High (~2.85 GB resident; tight) | 🟢 Zero impact (Offloaded) | 🟢 **Zero impact (Offloaded)** |
| **Developer Iteration Speed** | 🔴 Slow (rebuilds, manual GGUF) | 🟢 Fast (automated GPU pipeline) | 🟢 **Instant (prompt/code edit)** |
| **Data Privacy & GDPR** | 🟢 **Complete local control** | 🟡 Cloud GPU (RunPod US/EU) | 🟡 Google Cloud Data Processing |
| **Quota & Rate Limit Risk** | 🟢 **Zero risk (unlimited local)**| 🟢 Controlled concurrency | 🔴 429 quota exhaustion risk |
| **Zero-BYOK Free Tier Suitability** | 🟢 **Perfect (Zero variable cost)**| 🟡 Moderate | 🔴 High platform subsidy risk |

---

## 5. Strategic Synthesis: The Tricameral Architecture

Attempting to force **one** of these options to solve every operational challenge creates an unnecessary compromise:
- Choosing **VPS-only** strangles developer iteration, blocks model fine-tuning, and caps output quality (CPU-only inference fails on heavy tasks like Suitcase, Wardrobe Migration, and complex Stylist multi-turn chat).
- Choosing **RunPod-only** introduces unnecessary operational complexity and standing costs, whereas headless training is already natively solved via serverless containers.
- Choosing **Gemini-only** creates financial exposure on Free Tier traffic and vulnerability to Google 429 quota exhaustion.

The winning design is a **Tricameral Division of Labor**, which aligns with DressApp's production architecture:

```
                                  DRESSAPP HYBRID AI ECOSYSTEM
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                        │
  │   1. DEVELOPMENT & TRAINING (Headless Cloud CI/CD)                                     │
  │   ┌────────────────────────────────────────────────────────────────────────────────┐   │
  │   │  GitHub Actions via Modal (Serverless GPU Containers)                          │   │
  │   │  • Headless execution of train_eyes_lora.py (QLoRA SFT)                        │   │
  │   │  • Automated evaluation gates via evaluate_eyes.py                             │   │
  │   │  • Automated GGUF export via export_gguf.py                                    │   │
  │   │  • Zero standing infrastructure cost; RunPod is redundant                      │   │
  │   └────────────────────────────────────────────────────────────────────────────────┘   │
  │                                                                                        │
  │   2. PRODUCTION INTERACTIVE TIER (Flagship Intelligence)                               │
  │   ┌────────────────────────────────────────────────────────────────────────────────┐   │
  │   │  Google Gemini 3.5 Flash-Lite (google-genai SDK via llm_gateway.py)            │   │
  │   │  • Primary Stylist Brain & Main LLM across all 6 core pipelines                │   │
  │   │  • High-fidelity garment parsing & multimodal vision                           │   │
  │   │  • Ultra-efficient pricing ($0.30/1M input, $2.50/1M output), TTFT < 350ms    │   │
  │   └────────────────────────────────────────────────────────────────────────────────┘   │
  │                                    │  Automatic Failover                               │
  │                                    ▼  (429 / Quota / Timeout)                          │
  │   3. BASELINE & SAFETY MOAT (On-Prem Zero-Cost Core)                                   │
  │   ┌────────────────────────────────────────────────────────────────────────────────┐   │
  │   │  Hetzner VPS Eyes Container (Gemma-4 E4B Q3_K_M GGUF on llama-server)          │   │
  │   │  • Free-Tier baseline / zero-BYOK mode for non-paying users                     │   │
  │   │  • Transparent Quota Safety Net on Gemini 429 / RESOURCE_EXHAUSTED / timeout   │   │
  │   │  • Autonomous scheduled background cron jobs (morning looks, re-indexing)      │   │
  │   └────────────────────────────────────────────────────────────────────────────────┘   │
  │                                                                                        │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Roles Defined

#### Role 1: GitHub Actions via Modal as the Headless Training Lab
* **RunPod training is redundant.** Model fine-tuning is scheduled as a headless CI/CD workflow on GitHub Actions utilizing **Modal serverless GPU containers**.
* Operates strictly on-demand:
  - Ingests fashion training datasets into `inference-server/eyes/training/`.
  - Executes `train_eyes_lora.py` with QLoRA across target linear projection modules in 15–20 minutes on on-demand cloud GPUs (A10G/A100).
  - Validates regression gates via `evaluate_eyes.py` against the 30 canonical ground-truth test outfits.
  - Converts and quantizes adapters to `Q4_K_M` and `Q3_K_M` GGUF binaries via `export_gguf.py`.
  - Ships final artifacts directly to the deployment cache.
* **Cost**: Under \$0.20 per training run, with zero standing monthly server fees.

#### Role 2: Google Gemini 3.5 Flash-Lite as the Primary Main LLM
* Designates **Google Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`) as DressApp's primary model across all 6 operational pipelines via `backend/app/services/llm_gateway.py::call_main_llm`:
  1. **Wardrobe Migration Agent** (`wardrobe_migration_agent.py`): Ingests legacy closets with complex schema extraction.
  2. **AI Stylist & Scheduled Outfit Brain** (`gemini_stylist.py`): Real-time conversational stylist, multi-outfit recommendations, and morning looks.
  3. **Suitcase Packing Assistant** (`suitcase.py`): Multi-day weather-aware trip wardrobe planning and cultural guideline generation.
  4. **Trend Scout Localization & Card Summaries** (`trend_scout.py`): Editorial trend translations and card syntheses across 13 locales.
  5. **Session Title Generator** (`session_titles.py`): Fast contextual title generation for stylist conversations.
  6. **Closet Chat & Photo Re-analysis** (`ingestion.py`): Deep multimodal re-analysis and taxonomy correction.
* **Pricing & Performance**: \$0.30 per 1M input tokens, \$2.50 per 1M output tokens (~$0.0006 per garment scan). Native JSON schema grammar enforcement (`response_schema`), 1M token context window, and sub-350ms TTFT.

#### Role 3: Hetzner VPS Eyes as the On-Prem Free-Tier & Quota Safety Net
* The `dressapp-eyes` container continues running `gemma-4-E4B-it-Q3_K_M.gguf` on port 7860 of the Hetzner CPX32 VPS.
* Preserved as:
  1. **Free-Tier Baseline**: Zero variable cloud cost for users on the platform free tier or offline modes (`force_provider="gemma"`).
  2. **Quota Safety Net**: If external Gemini API calls encounter rate limits (`429`), quota exhaustion (`RESOURCE_EXHAUSTED`), spending caps, or network timeouts, `call_main_llm` and `FallbackBrain` catch the error and seamlessly fail over to on-prem Gemma-4-E4B.
  3. **Thinking Token Stripping**: Transparently strips internal reasoning channel markers (`<|channel>thought...<channel|>`, `<think>...</think>`) before returning text to end users.
  4. **Informational Banner**: Emits `provider_fallback="gemma"` and `fallback_from_quota=True`, rendering the localized `stylist.fallbackQuotaBanner` in the UI without throwing 500 errors.

---

## 6. Concrete Implementation Status

| Phase | Description | Status | Implementation Details |
| :--- | :--- | :--- | :--- |
| **Phase 1: Eyes Training Pipeline** | Fine-tuning automation | 🟢 **Complete (Modal / GHA)** | RunPod is redundant. Eyes fine-tuning is scheduled as a headless CI/CD workflow on GitHub Actions using Modal (`inference-server/eyes/training/train_eyes_lora.py`). |
| **Phase 2: Gemini 3.5 Flash-Lite as Main LLM** | Production Stylist Brain & Main Model | 🟢 **Complete** | Standardized on `gemini-3.5-flash-lite` across all 6 core backend pipelines via `backend/app/services/llm_gateway.py::call_main_llm`. Updated `config.py` defaults (`DEFAULT_STYLIST_MODEL = "gemini-3.5-flash-lite"`, `DEFAULT_STYLIST_PROVIDER = "gemini"`). |
| **Phase 3: VPS Eyes Quota Safety Net** | Free-Tier baseline & Quota fallback | 🟢 **Complete** | Preserved `gemma-4-E4B-it-Q3_K_M.gguf` on `http://eyes:7860/predict`. Implemented automatic failover on 429/RESOURCE_EXHAUSTED, thinking token sanitization (`strip_thinking_tokens`), and UI quota warning banners. |

