# ADR-0005: Eyes Vision Model Migration to Qwen2.5-VL-3B-Instruct

## Context

DressApp's on-premise vision service (`dressapp-eyes`) extracts structured garment metadata (category, sub_category, item_type, cut, fabric composition, color weights, pattern, formality, and localized captions) from uploaded photos and segmented crops. 

The previous model, `Gemma4-E4B` (4B parameters, fine-tuned on curated fashion datasets), exhibited critical operational deficiencies:
1. **Low Fidelity & Corruption**: Persistent hallucination and token corruption even after fine-tuning.
2. **Few-Shot Anchoring & Copycat Leakage**: When few-shot examples appeared in system prompts (e.g., `'Green Round-Toe Loafers'`, `'Navy Chinos'`, `'חצאית פליסה ירוקה'`), the model directly regurgitated those exact labels onto unrelated garments (e.g., tagging a white blouse as `חצאית פליסה ירוקה` [Green Pleated Skirt] or adding camouflage patterns to shoes).
3. **Cross-Language Token Bleed**: Frequent leakage of Korean/CJK subwords or English sentences into RTL Hebrew/Arabic outputs.
4. **Hardware Footprint**: Memory usage approached the upper limits of the Hetzner CPX32 VPS ($4 \text{ vCPU}, 8 \text{ GB RAM}$, with a hard ceiling of $\le 3.0 \text{ GB RAM}$ for the `dressapp-eyes` container).

## Decision

We replace `Gemma4-E4B` with **`Qwen2.5-VL-3B-Instruct`** (quantized via llama.cpp to `Q4_K_M.gguf`, file size ~2.1 GB).

### Architectural Implementation

1. **Deployment Architecture**:
   - `dressapp-eyes` runs `llama-server` compiled with multimodal support (`mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf` + `Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf`).
   - Container memory footprint is maintained at $\le 2.5 \text{ GB RAM}$, leaving headroom on the CPX32 VPS for MongoDB, Redis, and FastAPI.

2. **Prompt Hardening (Zero Hardcoded Examples)**:
   - System and user prompts in `backend/app/services/keyed_prompts.py` and `backend/app/services/vision/llm.py` replace concrete few-shot examples with abstract grammatical structures (`[Color] [Material/Cut] [Type]`).
   - Explicit negative instructions strictly prohibit copying features across distinct crops in a batch.

3. **Multilingual Taxonomy & Sanitization**:
   - Synchronized 47 missing taxonomy keys across all 13 supported languages in `packages/i18n/locales/*.json`.
   - Category classifier helpers (`_is_footwear`, `_is_bag`, `_is_top`, `_is_bottom`, etc.) in `backend/app/services/vision/service.py` support native Hebrew terms, preventing bipartite slot matching from collapsing to zero-score fallbacks.
   - Enforced SegFormer overrides (`_enforce_segformer_category` and `_sanitize_bag_or_accessory`) to strip conflicting cross-category attributes (e.g., preventing handbag titles from containing `כיסוי מזוודה` / luggage cover, and resetting bottom-garment metadata when SegFormer classifies a crop as a Top).
   - In `apps/web/src/pages/AddItem.jsx`, base noun derivation is category-gated, ensuring tops never inherit skirt titles and vice versa.

## Consequences

- **Positive**: Significantly higher zero-shot visual comprehension, accurately identifying obscure cuts, pleats, and patterns without regurgitating prompt artifacts.
- **Positive**: Native Hebrew and Arabic localization with correct gender/number grammatical agreement and zero English text leaks.
- **Positive**: Memory usage stable at ~2.5 GB, avoiding OOMs on the Hetzner host.
- **Positive**: Average crop inference reduced to under 3.5s per garment.
- **Neutral**: Requires maintenance of the GGUF model artifact and matching mmproj projector on the host storage volume.
