# plan.md — Native Gemini (google-genai) migration + streaming fix

## Objectives
- Replace `emergentintegrations` usage with native `google-genai` SDK across backend modules: `garment_vision`, `gemini_stylist`, `vision_verifier`, `session_titles`, `trend_scout`, `api/v1/sizes`.
- Fix `/api/v1/closet/analyze` NDJSON streaming reliability by using native Gemini streaming (expected side-effect).
- Keep `EMERGENT_LLM_KEY` env var defined (rollback safety) but remove it from runtime decision paths.
- Update `/app/CONCRETE_FACTS.md` to document `GEMINI_API_KEY` in the env contract.

---

## Phase 1 — Core POC (isolation): prove native streaming works end-to-end
**User stories**
1. As a user, I can upload a photo and see garment results stream in progressively without the request hanging.
2. As a user, I can upload a batch and receive results for each card even if one card fails analysis.
3. As a user, I can rely on the backend to stream valid NDJSON lines that the frontend can parse.
4. As a developer, I can reproduce the stream via `curl --no-buffer` and a Python script.
5. As a developer, I can swap SDK versions in one place without touching every module.

**Steps**
1. Websearch best practices for `google-genai` streaming + JSON mode (Gemini Developer API) and confirm API surface for multimodal.
2. Create `backend/app/services/gemini_client.py` (single SDK touchpoint):
   - `build_client(api_key)`
   - `generate_text(...) -> str`
   - `generate_vision(...) -> str`
   - `stream_vision(...) -> AsyncIterator[str]` (yields text chunks)
   - helper: `extract_json(raw: str)` reuse existing logic where possible.
3. Add minimal POC script `backend/scripts/test_gemini_stream.py`:
   - loads `/app/inference-server/eyes/test_images/0001.jpg`
   - calls `stream_vision()`
   - prints each chunk and confirms it can reconstruct valid JSON.
4. Run `curl --no-buffer` against `/api/v1/closet/analyze` after only wiring `garment_vision.analyze_batch_stream` to the new client (temporary branch), confirming NDJSON emits lines continuously.
5. Do not proceed until: streaming is stable in both script + curl and no mid-stream exceptions.

---

## Phase 2 — V1 App Development: full backend migration (keep contracts stable)
**User stories**
1. As a user, the Add Items GOLD pipeline works the same but is more reliable.
2. As a user, I still get accurate categories and no change to garment-card JSON fields.
3. As a user, when Gemini is unavailable, I get a clear backend error rather than silent failure.
4. As a developer, requirements are clean (no deprecated Gemini libs).
5. As an operator, I can keep `EMERGENT_LLM_KEY` set without it affecting provider routing.

**Dependency surgery**
1. Update `/app/backend/requirements.txt`:
   - bump `google-genai==1.71.0` → `google-genai==2.4.0`
   - remove `emergentintegrations==0.1.0`
   - remove `google-generativeai==0.8.6`
2. Update `/app/backend/requirements-ml.txt`: add `google-genai==2.4.0` (explicit availability in ML builds).
3. Rebuild/install and confirm imports: `gemini_image_service.py` still works.

**Code refactor (preserve prompts + response shape)**
1. `garment_vision.py` (P0):
   - Replace all `LlmChat/ImageContent/UserMessage` usage with `gemini_client`.
   - Ensure `analyze_batch_stream` uses native streaming and yields the *same* NDJSON objects as before.
   - Preserve: prompt strings, enum coercion, `_enforce_segformer_category`, phantom-drop logic, `provider_fallback` tagging (rename only if required, but keep field stable for UI).
2. Refactor remaining modules to use `gemini_client`:
   - `gemini_stylist.py`
   - `vision_verifier.py`
   - `session_titles.py`
   - `trend_scout.py`
   - `api/v1/sizes.py`
3. Config contract:
   - Keep `EMERGENT_LLM_KEY` in `config.py`, `.env.example`, `secrets_template.py`.
   - Remove/disable runtime selection that uses it (native calls should use `settings.GEMINI_API_KEY` / `settings.GOOGLE_API_KEY` only).

**Documentation**
1. Update `/app/CONCRETE_FACTS.md`:
   - add `GEMINI_API_KEY` row under env contract
   - clarify Gemini fallback usage (native Google SDK).

---

## Phase 3 — Testing & verification (backend + unchanged frontend)
**User stories**
1. As a user, I can upload 2–5 photos and see streamed results populate cards without manual refresh.
2. As a user, I can upload 6+ photos silently and still get complete processing.
3. As a user, I don’t get phantom empty cards saved.
4. As a developer, I can validate streaming via curl in production-like ingress.
5. As a developer, I can confirm non-closet Gemini features (stylist/sizes) still work.

**Tests**
1. Backend: run `backend/scripts/test_gemini_stream.py` (POC) + a non-streaming vision call test.
2. Backend: `curl --no-buffer` POST `/api/v1/closet/analyze` with `/app/inference-server/eyes/test_images/0001.jpg` and confirm:
   - NDJSON lines arrive progressively
   - each line is valid JSON
   - stream completes.
3. Backend: run existing backend tests (`backend_test.py` / `m20_backend_test.py`) as smoke.
4. Frontend: do not refactor `AddItem.jsx`; verify in browser that streamed updates render.
5. Regression: hit `/api/v1/stylist`, sizes endpoint, and any verifier endpoint used by closet edit flows.

---

## Phase 4 — Hardening + rollout notes (small, production-friendly)
**User stories**
1. As an operator, I can spot Gemini failures quickly via logs/metrics.
2. As a user, partial failures don’t kill the whole upload.
3. As a developer, timeouts are consistent across modules.
4. As an operator, secrets remain safe and rotated after leakage.
5. As a developer, future SDK updates touch one wrapper file.

**Steps**
1. Add consistent timeout/retry policy inside `gemini_client`.
2. Improve exception boundaries so one bad item doesn’t abort streaming.
3. Add a lightweight `/admin/health/llm` probe (if not already present) that checks Gemini credentials without streaming.

---

## Next actions (immediate)
1. Implement Phase 1 POC: `gemini_client.py` + `test_gemini_stream.py`.
2. Update requirements and rebuild backend environment.
3. Migrate `garment_vision.py` streaming path first, verify `/closet/analyze` via curl.
4. Migrate remaining 5 modules.

## Success criteria
- `/api/v1/closet/analyze` streams valid NDJSON reliably (curl + browser), no 502/mid-stream aborts.
- All 6 modules use native `google-genai` (no `emergentintegrations` import remains).
- `requirements.txt` no longer includes `emergentintegrations` or `google-generativeai` and pins `google-genai==2.4.0`.
- `CONCRETE_FACTS.md` includes `GEMINI_API_KEY` in env contract.
- `EMERGENT_LLM_KEY` remains defined in env/config but is not required for runtime behavior.