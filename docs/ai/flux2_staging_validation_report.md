# FLUX.2 Klein 4B — Gate 5 Staging Validation Report

**Document Version:** 1.0.0  
**Date:** 2026-09-25  
**Status:** VALIDATED & READY FOR REVIEW  
**Evaluation Scope:** Web & Mobile ItemDetails, Zero-BYOK Ingestion, Storage Contracts, Multilingual i18n  

---

## 1. Executive Summary

This report documents the staging validation of the **FLUX.2 Klein 4B** image-editing and reconstruction subsystem, replacing Google Nano Banana in DressApp's **ItemDetails → Re-Analyze** and conversational editing pipelines.

All staging validation criteria have been met:
- **Zero-BYOK Verified:** Users are never prompted for personal Gemini API keys during garment reconstruction, repair, or inpainting.
- **Frontend Alignment:** Web (`ItemDetail.jsx`) and Mobile (`ItemAIAnalysisCard.tsx`) have been synchronized with vendor-neutral AI Reconstructor branding, retaining model badges dynamically.
- **i18next Localization:** All 13 supported languages (`en`, `he`, `ar`, `de`, `es`, `fr`, `hi`, `it`, `ja`, `nl`, `pt`, `ru`, `zh`) have been audited and updated in both `packages/i18n` and `apps/web/src/locales`.
- **Storage & Schema Contract Preserved:** Denoised images pass through `UploadManager` to Cloudflare R2 or local disk storage; MongoDB Atlas stores only verified HTTPS URL strings. Original garment photos are preserved in `image_url_history`.
- **Automated Verification:** 19/19 backend tests passing without regressions.

---

## 2. Zero-BYOK Audit & User Journey Verification

### 2.1 Backend Endpoint Audit
The following endpoints in `backend/app/api/v1/closet/ingestion.py` were audited:
- `POST /api/v1/closet/{item_id}/chat-analyse`
- `POST /api/v1/closet/{item_id}/repair`
- `POST /api/v1/closet/{item_id}/edit-image`

| Provider Configuration | BYOK Check Triggered? | Behavior |
| :--- | :--- | :--- |
| `IMAGE_GENERATION_PROVIDER=runpod` | **NO** (Bypassed) | Uses platform-managed RunPod Serverless worker with `RUNPOD_API_KEY`. No client Gemini key requested. |
| `IMAGE_GENERATION_PROVIDER=mock` | **NO** (Bypassed) | Generates test cutout without key validation. |
| `IMAGE_GENERATION_PROVIDER=gemini` | **YES** (Legacy Fallback) | Resolves user's custom Gemini key; falls back to system key if configured. |

**Result:** Zero-BYOK requirement is completely satisfied. Standard users can edit and reconstruct garments out of the box with zero setup.

---

## 3. Frontend UI/UX Inspection

### 3.1 Web Interface (`apps/web/src/pages/ItemDetail.jsx`)
- **Subtitle:** Updated to generic AI Reconstructor branding (`t('itemDetail.reanalyze.subtitle')`).
- **Badge Indicators:** Updated fallback badge from `Nano Banana` to `AI Reconstructed` (`t('itemDetail.reanalyze.aiGeneratedBadge')`), while preserving dynamic model naming when provided by backend (`turn.model_used`).
- **Non-Destructive Action Flow:**
  1. The Eyes analyzes garment context (category, subcategory, colors, fabric).
  2. FLUX.2 Klein reconstructs the image with strict identity conditioning ($0.35 \le \text{strength} \le 0.65$).
  3. Reconstructed image is rendered as an in-chat interactive preview.
  4. The original image remains completely intact until user clicks `"Apply as garment photo"` and saves the closet item.

### 3.2 Mobile Interface (`apps/mobile/src/components/itemDetail/ItemAIAnalysisCard.tsx`)
- **Subtitle:** Updated default string to `'Chat with The Eyes to remove unwanted objects, complete cutoffs, or refine garment details using AI Reconstructor.'`.
- **Action Badge:** Updated fallback badge from `nanoBananaBadge` to `aiGeneratedBadge` with default `'AI Reconstructed'`.
- **RTL Alignment:** Verified full Hebrew and Arabic right-to-left layout compliance (`flexDirection: isRtl ? 'row-reverse' : 'row'`).

---

## 4. i18next Localization Audit Across All 13 Languages

Both locale directories (`packages/i18n/locales/` and `apps/web/src/locales/`) were synchronized across all 13 supported languages.

| Language Code | Language | Subtitle Updated | AI Reconstructed Badge | FLUX.2 Klein Badge |
| :--- | :--- | :--- | :--- | :--- |
| `en` | English | Verified | "AI Reconstructed" | "FLUX.2 Klein Generated" |
| `he` | Hebrew | Verified | "שוחזר ע״י AI" | "נוצר ע״י FLUX.2 Klein" |
| `ar` | Arabic | Verified | "تمت إعادة البناء بواسطة الذكاء الاصطناعي" | "تم الإنشاء بواسطة FLUX.2 Klein" |
| `de` | German | Verified | "KI-rekonstruiert" | "Mit FLUX.2 Klein generiert" |
| `es` | Spanish | Verified | "Reconstruido por IA" | "Generado por FLUX.2 Klein" |
| `fr` | French | Verified | "Reconstruit par l'IA" | "Généré par FLUX.2 Klein" |
| `hi` | Hindi | Verified | "AI द्वारा पुनर्गठित" | "FLUX.2 Klein द्वारा जनरेट किया गया" |
| `it` | Italian | Verified | "Ricostruito con IA" | "Generato con FLUX.2 Klein" |
| `ja` | Japanese | Verified | "AI再構築済み" | "FLUX.2 Klein で生成" |
| `nl` | Dutch | Verified | "AI-gereconstrueerd" | "Gegenereerd door FLUX.2 Klein" |
| `pt` | Portuguese | Verified | "Reconstruído por IA" | "Gerado por FLUX.2 Klein" |
| `ru` | Russian | Verified | "Восстановлено ИИ" | "Создано FLUX.2 Klein" |
| `zh` | Chinese | Verified | "AI重构完成" | "由 FLUX.2 Klein 生成" |

**Zero Hard-Coded Strings:** All user-facing strings are dispatched through `t('itemDetail.reanalyze.*')`.

---

## 5. Storage & Database Contract Audit

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE FLOW AUDIT                                │
└─────────────────────────────────────────────────────────────────────────────┘
  FLUX.2 Klein (RunPod)
         │  (Raw PNG image bytes)
         ▼
  RunpodFluxProvider
         │  ImageGenerationResult(image_bytes=...)
         ▼
  Closet Ingestion Route (/chat-analyse, /repair, /edit-image)
         │
         ├──► UploadManager.save_image(image_bytes, filename=f"item_{id}_...png")
         │          │
         │          ├──► Cloudflare R2 / Local Disk (/static/uploads/...)
         │          └──► Returns clean URL: "https://.../static/uploads/..."
         │
         ├──► closet_items.update_one(
         │          {"_id": ObjectId(item_id)},
         │          {"$set": {"image_url": clean_url},
         │           "$push": {"image_url_history": clean_url}}
         │    )  <-- Only verified URLs written to MongoDB Atlas.
         │
         └──► Response to Client:
                    {"image_url": clean_url, "model_used": "FLUX.2 Klein 4B"}
```

- **No base64 in MongoDB Atlas:** Confirmed zero data URIs or base64 blobs are written to `closet_items`.
- **Original preservation:** `original_image_url` is never overwritten by reconstruction edits.
- **Audit trail:** Every applied reconstruction is appended to `image_url_history`.

---

## 6. Automated Test Results

Executed with `pytest` on Python 3.14.6 + AnyIO 4.13.0:

```
backend/tests/test_image_generation.py::test_mock_image_provider_edit PASSED
backend/tests/test_image_generation.py::test_mock_image_provider_generate PASSED
backend/tests/test_image_generation.py::test_mock_image_provider_health PASSED
backend/tests/test_image_generation.py::test_runpod_strength_clamping PASSED
backend/tests/test_image_generation.py::test_build_flux_prompt PASSED
backend/tests/test_image_generation.py::test_runpod_provider_init_validation PASSED
backend/tests/test_image_generation.py::test_runpod_flux_provider_edit_success PASSED
backend/tests/test_image_generation.py::test_runpod_flux_provider_async_polling_fallback PASSED
backend/tests/test_image_generation.py::test_factory_mock_override PASSED
backend/tests/test_image_generation.py::test_factory_runpod_instantiation PASSED
backend/tests/test_image_generation.py::test_api_provider_health PASSED
backend/tests/test_image_generation.py::test_api_image_generation_test_text PASSED
backend/tests/test_image_generation.py::test_api_image_generation_test_with_image_upload PASSED
backend/tests/test_chat_analyse.py::test_chat_analyse_unauthenticated PASSED
backend/tests/test_chat_analyse.py::test_chat_analyse_item_not_found[asyncio] PASSED
backend/tests/test_chat_analyse.py::test_chat_analyse_image_edit_success[asyncio] PASSED
backend/tests/test_chat_analyse.py::test_chat_analyse_metadata_update[asyncio] PASSED
backend/tests/test_chat_analyse.py::test_chat_analyse_clarification[asyncio] PASSED
backend/tests/test_chat_analyse.py::test_chat_analyse_hebrew_image_edit[asyncio] PASSED

====================== 19 passed in 12.69s ======================
```

---

## 7. Staging Sign-Off Checklist

- [x] Zero-BYOK verified across all reconstruction and edit endpoints.
- [x] User-facing API key prompts removed from primary reconstruction journeys.
- [x] Non-destructive editing confirmed: previews required before committing image replacements.
- [x] Web frontend updated (`ItemDetail.jsx`).
- [x] Mobile frontend updated (`ItemAIAnalysisCard.tsx`).
- [x] Full i18next localization across all 13 supported languages (en, he, ar, de, es, fr, hi, it, ja, nl, pt, ru, zh).
- [x] Local storage & Cloudflare R2 UploadManager routing verified.
- [x] MongoDB Atlas document schema validated (only clean URL strings).
- [x] 19/19 backend integration and unit tests passing.
- [x] Backward-compatibility with legacy Nano Banana intact as opt-in fallback.

---

## 8. Conclusion & Recommendation

Gate 5 (Staging Validation) is **complete and verified**. The subsystem is ready to proceed to **Gate 6 (Production Readiness: Concurrency, Timeouts, Error Backoff, and Operational Hardening)** upon user approval.
