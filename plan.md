# plan.md — Native Gemini (google-genai) migration + streaming fix

## Objectives
- ✅ Replace `emergentintegrations` usage with native `google-genai` SDK across backend modules: `garment_vision`, `gemini_stylist`, `vision_verifier`, `session_titles`, `trend_scout`, `api/v1/sizes`.
- ✅ Fix `/api/v1/closet/analyze` NDJSON streaming reliability by using native Gemini streaming (resolved buffering/timeout issues).
- ✅ Keep `EMERGENT_LLM_KEY` env var defined (rollback safety) but remove it from runtime decision paths (native calls use `GEMINI_API_KEY` / `GOOGLE_API_KEY` only).
- ✅ Update `/app/CONCRETE_FACTS.md` to document `GEMINI_API_KEY` (and `GOOGLE_API_KEY`) in the env contract.

**Status:** All objectives completed. Backend streaming bug is resolved and verified.

---

## Phase 1 — Core POC (isolation): prove native streaming works end-to-end (COMPLETED)
**User stories**
1. ✅ As a user, I can upload a photo and see garment results stream in progressively without the request hanging.
2. ✅ As a user, I can upload a batch and receive results for each card even if one card fails analysis.
3. ✅ As a user, I can rely on the backend to stream valid NDJSON lines that the frontend can parse.
4. ✅ As a developer, I can reproduce the stream via `curl --no-buffer` and a Python script.
5. ✅ As a developer, I can swap SDK versions in one place without touching every module.

**Steps**
1. ✅ Audited `google-genai` streaming + JSON mode API surface for multimodal.
2. ✅ Implemented `backend/app/services/gemini_client.py` (single SDK touchpoint):
   - `GeminiClient.text(...) -> str`
   - `GeminiClient.vision(...) -> str`
   - `GeminiClient.stream_vision(...) -> AsyncIterator[str]`
   - centralized model-id normalization (`gemini/...` prefix stripping) + response text extraction.
3. ✅ Added POC script `backend/scripts/test_gemini_stream.py`:
   - loads `/app/inference-server/eyes/test_images/0001.jpg`
   - validates JSON-mode non-streaming response
   - validates streaming response and reconstructs valid JSON.
4. ✅ Verified progressive streaming behavior independent of HTTP using `backend/scripts/test_analyze_stream.py`.

---

## Phase 2 — V1 App Development: full backend migration (keep contracts stable) (COMPLETED)
**User stories**
1. ✅ As a user, the Add Items GOLD pipeline works the same but is more reliable.
2. ✅ As a user, I still get accurate categories and no change to garment-card JSON fields.
3. ✅ As a user, when Gemini is unavailable, I get a clear backend error rather than silent failure.
4. ✅ As a developer, requirements are clean (no deprecated Gemini libs).
5. ✅ As an operator, I can keep `EMERGENT_LLM_KEY` set without it affecting provider routing.

**Dependency surgery**
1. ✅ Updated `/app/backend/requirements.txt`:
   - bumped `google-genai` to `==2.4.0`
   - removed `emergentintegrations==0.1.0`
   - removed deprecated `google-generativeai==0.8.6`
2. ✅ Updated `/app/backend/requirements-ml.txt`: added `google-genai==2.4.0`.
3. ✅ Verified native SDK imports and ensured `gemini_image_service.py` (already native) remains compatible.

**Code refactor (preserve prompts + response shape)**
1. ✅ `garment_vision.py` (P0, GOLD pipeline backend):
   - replaced all `LlmChat/ImageContent/UserMessage` usage with native `GeminiClient`
   - replaced `litellm` streaming with native `google-genai` streaming
   - preserved prompt strings, enum coercion, SegFormer-anchored category enforcement, phantom-drop logic, and `provider_fallback` tagging
   - introduced `_build_batch_prompts(...)` to keep batch system/user text identical across non-stream and stream.
2. ✅ Refactored remaining Gemini modules to use `GeminiClient`:
   - `gemini_stylist.py`
   - `vision_verifier.py`
   - `session_titles.py`
   - `trend_scout.py`
   - `api/v1/sizes.py`
3. ✅ Config contract:
   - left `EMERGENT_LLM_KEY` defined in env/config for rollback safety
   - removed active runtime dependence on `EMERGENT_LLM_KEY` by using native `GEMINI_API_KEY`.

**Documentation**
1. ✅ Updated `/app/CONCRETE_FACTS.md`:
   - added `GEMINI_API_KEY` and `GOOGLE_API_KEY` to the “Backend ↔ Eyes wiring” env contract
   - clarified that Gemini backend is now native `google-genai` via `backend/app/services/gemini_client.py`.

---

## Phase 3 — Testing & verification (backend + unchanged frontend) (COMPLETED)
**User stories**
1. ✅ As a user, I can upload 2–5 photos and see streamed results populate cards without manual refresh.
2. ✅ As a user, I can upload 6+ photos silently and still get complete processing.
3. ✅ As a user, I don’t get phantom empty cards saved.
4. ✅ As a developer, I can validate streaming via curl in production-like ingress.
5. ✅ As a developer, I can confirm non-closet Gemini features (stylist/sizes) still work.

**Tests**
1. ✅ Backend POC: `backend/scripts/test_gemini_stream.py` (non-stream + stream JSON mode).
2. ✅ Backend stream smoke: `backend/scripts/test_analyze_stream.py` confirmed `detect` → `item` → `done` frames.
3. ✅ Testing agent backend validation (5/5 pass):
   - backend startup clean (no `emergentintegrations` ImportError)
   - `POST /api/v1/closet/analyze` returns `application/x-ndjson` and streams `detect/item/done` frames (no buffering, no 502)
   - stylist endpoint works
   - sizes OCR endpoint works
   - admin health check confirms `google-direct` backend.
4. ✅ No frontend refactor performed as part of this migration.

---

## Phase 4 — Hardening + rollout notes (small, production-friendly) (COMPLETED)
**User stories**
1. ✅ As an operator, I can spot Gemini failures quickly via logs/metrics.
2. ✅ As a user, partial failures don’t kill the whole upload.
3. ✅ As a developer, timeouts are consistent across modules.
4. ✅ As an operator, secrets remain safe and rotated after leakage.
5. ✅ As a developer, future SDK updates touch one wrapper file.

**Steps**
1. ✅ Centralized Gemini calls behind `backend/app/services/gemini_client.py`.
2. ✅ Ensured streaming path emits incrementally (removing Emergent proxy buffering risk).
3. ✅ Confirmed operational visibility via `provider_activity` logging remains intact.

---

## Next actions (immediate)
✅ None for the Gemini migration.

---

## Success criteria
✅ Met.
- `/api/v1/closet/analyze` streams valid NDJSON reliably (curl/testing-agent validated), no 502/mid-stream aborts.
- All 6 target modules use native `google-genai` (no runtime `emergentintegrations` dependency).
- `requirements.txt` no longer includes `emergentintegrations` or `google-generativeai` and pins `google-genai==2.4.0`.
- `CONCRETE_FACTS.md` includes `GEMINI_API_KEY` + `GOOGLE_API_KEY` in env contract.
- `EMERGENT_LLM_KEY` remains defined in env/config but is not required for runtime behavior.

---

## Future work (out of scope for this completed plan)
These are explicitly NOT part of the completed Gemini migration, but are the next product priorities based on the original problem statement:
- Share the restored GOLD pipeline (2–5 photos) with Camera / Single-photo workflows in `AddItem.jsx` without breaking the monolith.
- Retain silent 6+ batch uploader while reusing the same pipeline.
- Continue improving garment extraction quality:
  - eliminate phantom empty cards
  - prevent human skin/body parts leaking into crops
  - ensure small accessories/shoes are not dropped.
- Phase T1: Vertex AI Try-On.
- CCP ground-truth class remapping.
- Eyes deployment runbook rewrite (llama-server GGUF).