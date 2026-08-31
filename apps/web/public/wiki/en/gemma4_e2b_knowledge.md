# Gemma 4 E2B — Agent Knowledge & Inference Guide

**Target Audience:** Future AI Agents, Maintainers, and ML Engineers working on the DressApp Eyes vision pipeline.
**Date:** May 2026

This document preserves the concrete logic, architectural quirks, and inference rules required for successfully staging and benchmarking the `google/gemma-4-E2B-it` model with a LoRA adapter in the DressApp ecosystem. 

---

## 1. Architectural Facts
- **Model Profile:** E2B stands for *Effective 2 Billion* parameters (5.1B total). It leverages Per-Layer Embeddings (PLE) to radically reduce memory footprint, making it the only viable variant for DressApp's CPU-only Hetzner VPS environment.
- **Context Window:** Up to 128K tokens.
- **Native Multimodality:** Supports Text, Image, and Audio inputs. Outputs Text.
- **Attention Mechanism:** Hybrid local sliding-window and global attention.

## 2. Dependencies & Tooling (Critical)
Gemma 4 is a fundamentally new family (released March-April 2026), NOT a revision of Gemma-3. Loading it incorrectly corrupts the multimodal projection tensors.
- **Transformers Version:** `transformers >= 4.57.1` (or `5.5.0+` depending on local release naming). You **must** use `AutoProcessor` and `AutoModelForMultimodalLM`. Never hand-roll `Gemma4*ForConditionalGeneration`.
- **Quantization:** Use `optimum-quanto` for CPU inference (int4 quantization). `bitsandbytes` is highly unstable/unsupported for pure x86 CPU deployments.
- **LoRA Adapter:** Use `peft` to attach the trained LoRA adapter to the base model. The base text-decoder layers are wrapped with rank-16 adapters, while the vision/audio towers remain frozen.

## 3. Prompting & Inference Rules

### Modality Ordering
For optimal attention mapping and zero-shot performance, **Image/Audio tokens must always precede text** within the message content structure.
```python
# Correct payload structure for the AutoProcessor:
messages = [
    {"role": "user", "content": [
        {"type": "image"},
        {"type": "text", "text": "Analyze this outfit..."}
    ]}
]
```

### Visual Token Budgets
Gemma 4 does not treat all images equally. You control visual resolution via a `vision_token_budget` (sometimes named `image_token_budget` or `num_image_tokens` depending on the `transformers` version branch).
- Allowed budgets: `70`, `140`, `280`, `560`, `1120`.
- **DressApp Specifics:** Because garment boundary detection and detail extraction require high precision, always force the `AutoProcessor` budget to **1120** (maximum detail).

### Thinking Mode (Reasoning)
Gemma-4 natively supports CoT (Chain-of-Thought) reasoning.
- **Activation:** To enable thinking, insert the `<|think|>` token at the very beginning of the system prompt.
- **Output Channel Format:** When reasoning, the model emits tags:
  `<|channel>thought\n[Internal reasoning]<channel|>[Final answer]`
- **Disabling:** If strict JSON is required and latency is paramount (as in our `EYES_ONE_PASS` pipeline), omit the `<|think|>` token to force direct emission.
- **History Rule:** In multi-turn chats, strip the reasoning (`<|channel>thought...<channel|>`) from history. Only feed the `[Final answer]` back into the context buffer.

### Sampling Best Practices
Do not use standard LLM temperature defaults. Google's explicit standard for Gemma-4 sampling is:
- `temperature = 1.0`
- `top_p = 0.95`
- `top_k = 64`

## 4. Production Environment Notes
- Auth for gated models (`HF_TOKEN`) is NOT shipped with the DressApp runtime. The container relies on pre-downloaded weights and merged adapters (`/adapter:ro`) mounted locally.
- Keep the `EYES_ONE_PASS=true` flag logic in mind: it bypasses legacy SegFormer clipping by relying entirely on Gemma-4's native coordinate output (`response_format=json_schema`).
