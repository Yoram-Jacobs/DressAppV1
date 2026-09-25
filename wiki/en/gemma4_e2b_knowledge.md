# Gemma 4 E4B / E2B — Agent Knowledge & Inference Guide

**Target Audience:** Future AI Agents, Maintainers, and ML Engineers working on the DressApp Eyes vision and styling pipeline.  
**Date:** September 2026  
**Status:** Active in Production (`gemma-4-E4B-it-Q3_K_M.gguf` + `mmproj-BF16.gguf`)

This document preserves the concrete logic, architectural specifications, and inference rules for the fine-tuned `gemma-4-E4B-it` model in the DressApp ecosystem.

---

## 1. Architectural Facts
- **Model Profile:** Google Gemma-4-E4B is an Effective 4 Billion parameter (~4.5B total) multimodal vision-language model utilizing Per-Layer Embeddings (PLE). In production, it is quantized to `Q3_K_M` (~2.7 GB disk, ~2.85 GB resident RAM), making it performant on the CPU-only Hetzner Cloud CPX32 VPS (4 AMD vCPUs).
- **Context Window:** Up to 128K tokens (configured to 4,096 tokens in `dressapp-eyes` for fast memory throughput).
- **Multimodal Inputs:** Native image, audio, and text input support via multimodal projector (`mmproj-BF16.gguf`).
- **Production Server:** Runs `llama-server` on port 7860 in the `dressapp-eyes` Docker container, wrapped with FastAPI endpoint security (`EYES_API_TOKEN`).

## 2. Production Roles & Multi-Tier Routing
1. **Free Tier Core**: Powers interactive conversational styling and garment attribute extraction for Free Tier accounts and users without custom API keys.
2. **Background Cron Jobs**: Executes automated daily wardrobe indexing and morning styling recommendations without incurring commercial cloud API costs.
3. **Safety Quota Fallback**: Seamlessly catches custom API rate limits (`429`), `RESOURCE_EXHAUSTED`, and spending cap errors from third-party providers (Google Gemini), rerouting queries to on-prem Gemma without crashing or returning errors to the user.
4. **Tier Boundaries**: High-cost generative cloud endpoints (Trend Scout and Nano Banana photo reconstruction) require personal user-supplied API keys.

## 3. Inference & Prompting Rules
- **Thinking Mode**: Gemma-4 supports Chain-of-Thought reasoning. In production stylist and vision JSON pipelines, thinking is budgeted or set to direct emission to prevent JSON payload truncation.
- **Sampling Parameters**:
  - `temperature = 0.3` (for structured JSON stylist outputs and garment extraction).
  - `max_tokens = 3000`.
- **Measured Benchmarks (Hetzner CPX32)**:
  - Prompt processing: ~32 tokens/second.
  - Token generation: ~16.5 tokens/second.
  - Resident RAM: ~2.85 GB within the 8 GB envelope.
