from __future__ import annotations
from __future__ import annotations
from .llm import EYES_JSON_SCHEMA, _call_gemma_space, _build_system_prompt, _language_directive, _user_prompt, _extract_json, DETECT_SYSTEM_PROMPT, _scan_complete_json_objects, _build_batch_prompts, GROUP_ANALYZE_SYSTEM_PROMPT, _LANG_NAMES, call_gemma_space_stream_attributes
from .image import _shrink_for_vision, _crop_to_bbox, _PHANTOM_DROP_PCT, _solid_alpha_coverage, _fit_crop_to_card, _apply_fast_matte
from .geometry import _nms_detections, _is_unidentifiable, _looks_already_cropped
from .validation import _coerce_single_garment, _coerce_enums, _enforce_segformer_category

import asyncio
import base64
import logging
logger = logging.getLogger(__name__)
import time
from typing import Any, AsyncIterator
from app.config import settings
from app.services import provider_activity
from app.services.gemini_client import GeminiClient

"""The Eyes — multimodal garment analyzer.

Production architecture (Phase O.3+)
------------------------------------
* Primary analyser: self-hosted **Gemma 4 E2B** GGUF served by the
  ``dressapp-eyes`` container (llama.cpp/llama-server). The backend
  reaches it via ``EYES_GEMMA_SPACE_URL`` — on Hetzner production
  this is ``http://eyes:7860`` (internal Docker network).
* Bounding-box detector for the multi-item pipeline:
  **SegFormer-b3** (sayeed99/segformer_b3_clothes) running LOCALLY
  in-process via ``app.services.clothing_parser``. No external call.
* Safety fallback when the Gemma container is unreachable:
  **Gemini 2.5 Flash** via Emergent / direct Google chat key. Tagged
  in the response with ``provider_fallback`` so the UI can surface
  the degraded state.
* Enum sanitiser, NMS, "already cropped" short-circuit, multi-item
  orchestration are all provider-agnostic and wrap either path.

Deprecated paths (removed in May 2026)
--------------------------------------
* Qwen-VL-Plus Eyes via HuggingFace Inference Providers
  (``_hf_chat_json`` + ``_hf_client`` + ``QWEN_EYES_MODEL`` setting).
  Never enabled in production; deleted along with the rest of the
  DashScope / Qwen integration. The DB-backed override layer
  (``eyes_override``) already rejects ``"qwen"`` at ``_VALID_PROVIDERS``
  so any stale persisted override falls through to env-default.
* DashScope Qwen-VL stylist brain (``QwenStylistBrain`` +
  ``qwen_client``). Removed alongside the Eyes path — see
  ``docs/WASTED_WORK_REPORT.md §2.2``.
"""

import logging
logger = logging.getLogger(__name__)





class GarmentVisionService:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        # We tolerate a missing EMERGENT_LLM_KEY if HF is configured for
        # both analysis AND detection. In practice we keep Gemini Flash
        # for detection, so both keys are typically required.
        self.model = model or settings.GARMENT_VISION_MODEL or "gemini-3.5-flash"
        self.provider = settings.GARMENT_VISION_PROVIDER
        # Detection stays on Gemini Flash for Phase A.
        self.detect_provider = settings.GARMENT_VISION_DETECT_PROVIDER
        self.detect_model = settings.GARMENT_VISION_DETECT_MODEL or "gemini-3.5-flash"
        # Per-crop analyser (multi-item pipeline).
        self.crop_model = settings.GARMENT_VISION_CROP_MODEL or "gemini-3.5-flash"
        self.max_items = settings.GARMENT_VISION_MAX_ITEMS
        # Gemini chat key — explicit parameter, else direct GEMINI_API_KEY from .env.
        self.api_key = api_key or settings.gemini_chat_key
        # Native google-genai client (single SDK touchpoint). Lazily
        # created on first use so a missing key only blows up on the
        # gemini-needing branch — Gemma-only deployments stay green.
        self._gemini: GeminiClient | None = None
        # Fail fast when the service cannot actually run anything.
        if self.provider == "gemini" and not self.api_key:
            raise RuntimeError(
                "GARMENT_VISION_PROVIDER=gemini but GEMINI_API_KEY is not set."
            )
        if self.provider == "hf" and not settings.GARMENT_VISION_ENDPOINT_KEY:
            raise RuntimeError(
                "GARMENT_VISION_PROVIDER=hf but "
                "GARMENT_VISION_ENDPOINT_KEY is unset. "
                "(Note: ``HF_TOKEN`` is intentionally not used as an "
                "auth surface — see "
                "quarantine/2026-05-sabotage/READ_THIS_FIRST.md.)"
            )
        if self.detect_provider == "gemini" and not self.api_key:
            logger.warning(
                "Detection requires a Gemini chat key; multi-item pipeline will "
                "degrade to single-item analysis."
            )

    # -------------------- public API --------------------
    def _get_gemini(self) -> GeminiClient:
        """Lazy accessor for the native google-genai client.

        Created on first use so a missing GEMINI_API_KEY only raises
        when the gemini path is actually exercised — Gemma-only
        deployments stay green even with an empty Gemini key.
        """
        if self._gemini is None:
            if not self.api_key:
                raise RuntimeError(
                    "Gemini path requires GEMINI_API_KEY in /app/backend/.env."
                )
            self._gemini = GeminiClient(api_key=self.api_key)
        return self._gemini

    async def _detect_via_clothing_parser(
        self, image_bytes: bytes,
    ) -> list[dict[str, Any]] | None:
        """Try the local SegFormer-based parser. Returns the normalised
        detection list on success, or ``None`` to let the caller fall
        back to Gemini. A parser exception is logged and treated as a
        soft miss — we don't want a SegFormer hiccup to mask bad photos.
        """
        if not settings.USE_CLOTHING_PARSER:
            return None
        try:
            from app.services import clothing_parser

            parser_items = await clothing_parser.parse_garments(image_bytes)
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "detect_items: clothing_parser path failed (%s), falling back",
                exc,
            )
            return None
        if not parser_items:
            return None
        logger.info(
            "detect_items: clothing_parser succeeded with %d items",
            len(parser_items),
        )
        return [
            {
                "label": p["label"].lower().replace("-", "_"),
                "kind": p["category"],
                "bbox": p["bbox"],
                "score": p["score"],
                # Preserve full-res mask so analyze_outfit can build
                # semantic PNG cutouts instead of bbox rectangles. Not
                # serialised to JSON anywhere.
                "mask": p.get("mask"),
                # Full-res union of Face / Hair / limb pixels. Sliced
                # to bbox by ``_bbox_crop_useful`` and subtracted from
                # the dilated garment soft-mask inside
                # ``apply_alpha_intersection`` so face / hair / arms /
                # legs can't leak into the final matte. May be None
                # if the parser couldn't build the human mask.
                "_human_mask_full": p.get("_human_mask_full"),
                "source": "clothing_parser",
            }
            for p in parser_items
        ]

    async def _detect_via_gemini(
        self, image_bytes: bytes,
    ) -> list[dict[str, Any]]:
        """Gemini bbox-detection fallback. Returns a pre-NMS list of
        ``{label, kind, bbox}`` dicts (the caller applies NMS +
        validation)."""
        if self.detect_provider != "gemini":
            logger.warning(
                "Unsupported detect provider %s; returning empty detections.",
                self.detect_provider,
            )
            return []
        if not self.api_key:
            logger.warning("No Gemini chat key; skipping detection.")
            return []

        shrunk = _shrink_for_vision(image_bytes, max_side=1024, q=80)
        gem = self._get_gemini()
        t0 = time.perf_counter()
        ok = False
        last_err: str | None = None
        try:
            raw = await gem.vision(
                system=DETECT_SYSTEM_PROMPT,
                user_parts=[
                    (
                        "List every fashion item visible in this photograph. "
                        "Return the JSON object only."
                    ),
                    shrunk,
                ],
                model=self.detect_model,
                temperature=0.1,
                response_mime_type="application/json",
            )
            ok = True
        except Exception as exc:  # noqa: BLE001
            last_err = repr(exc)
            raise
        finally:
            provider_activity.record(
                "garment-vision-detect",
                ok=ok,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                error=last_err,
                extra={"model": self.detect_model},
            )
        parsed = _extract_json(raw or "")
        if isinstance(parsed, list):
            # Bbox detector schema is {"items": [...]} — a top-level list
            # means the model misformatted; treat as no detections.
            parsed = {}
        items = parsed.get("items") or []
        if not isinstance(items, list):
            items = []

        clean: list[dict[str, Any]] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            bbox = it.get("bbox")
            label = (it.get("label") or "garment").strip().lower()
            kind = (it.get("kind") or "garment").strip().lower()
            if (
                not isinstance(bbox, list)
                or len(bbox) != 4
                or not all(isinstance(v, (int, float)) for v in bbox)
            ):
                continue
            clean.append(
                {"label": label, "kind": kind, "bbox": [int(v) for v in bbox]}
            )
        return clean

    async def detect_items(self, image_bytes: bytes) -> list[dict[str, Any]]:
        """Return a list of ``{label, kind, bbox}`` entries.

        Phase V: try the commercial-safe clothing parser first
        (sayeed99/segformer_b3_clothes, MIT). If it returns at least one
        garment we use those — they're pixel-accurate per-class and split
        outfits reliably. Otherwise fall back to the Gemini bbox detector
        and apply non-maximum suppression to collapse overlapping boxes.
        """
        parser_hits = await self._detect_via_clothing_parser(image_bytes)
        if parser_hits:
            before = len(parser_hits)
            clean = _nms_detections(parser_hits)
            logger.info(
                "detect_items OK model=segformer count=%d (nms removed %d) labels=%s",
                len(clean),
                before - len(clean),
                [c["label"] for c in clean][:8],
            )
            return clean

        clean = await self._detect_via_gemini(image_bytes)
        # Non-maximum suppression: collapse overlapping detections that
        # describe the same physical item (IoU >= 0.35 OR one box nested
        # inside the other with compatible kind).
        before = len(clean)
        clean = _nms_detections(clean)
        logger.info(
            "detect_items OK model=%s count=%d (nms removed %d) labels=%s",
            self.detect_model,
            len(clean),
            before - len(clean),
            [c["label"] for c in clean][:8],
        )
        return clean

    async def analyze(
        self,
        image_bytes: bytes | list[bytes],
        *,
        model: str | None = None,
        provider: str | None = None,
        language: str | None = None,
        think: bool = False,
        one_pass: bool = False,
    ) -> dict[str, Any]:
        """Run the 17-field analyser on a single image or a list of images.

        Phase O.4 routing — the **DB-backed Eyes toggle**
        (``eyes_override.get_active_provider()``) is the authoritative
        source for which model serves the request:

        * ``gemma`` -> POST to the self-hosted Gemma-4 E2B HF Space
          (``EYES_GEMMA_SPACE_URL``). Any failure (5xx, timeout,
          network error) automatically falls back to Gemini so the
          UX stays alive while the Space is sleeping/crashed; we
          tag the response with ``provider_fallback`` so the
          frontend can surface "served from Gemini fallback".
        * ``gemini`` -> direct Gemini 2.5 Flash via Emergent / Google
          chat key.

        Explicit ``provider=`` argument still wins (used by the new
        diagnostics endpoint and tests). The ``GARMENT_VISION_PROVIDER``
        env var is now only a *seed* used by ``eyes_override`` when no
        DB override has been written yet.

        ``think`` — pass through to ``_call_gemma_space``. Defaults to
        False so the closet AddItem flow stays fast & non-reasoning.
        Brain experiments / stylist callers can flip it on.

        ``one_pass`` — Phase O.6 single-pass mode. When True we append
        ``SYSTEM_PROMPT_ONE_PASS_SUFFIX`` so Eyes additionally returns
        a ``region.bbox`` per garment. The schema includes ``region``
        as optional either way; this flag is what makes the model
        actually populate it. Defaults to False so every legacy caller
        (per-crop analysis, reconstruction re-validate, direct callers
        in the closet endpoint) keeps the original prompt bit-for-bit.
        """
        from app.services import eyes_override

        # Support multiple images by shrinking all of them
        if isinstance(image_bytes, list):
            shrunk_list = [_shrink_for_vision(img) for img in image_bytes]
            # Since Gemma/Space expects one image, use the first one as fallback
            first_shrunk = shrunk_list[0] if shrunk_list else b""
            b64 = base64.b64encode(first_shrunk).decode("ascii")
        else:
            shrunk = _shrink_for_vision(image_bytes)
            shrunk_list = [shrunk]
            b64 = base64.b64encode(shrunk).decode("ascii")

        system_prompt = (
            _build_system_prompt(one_pass=one_pass)
            + _language_directive(language)
        )
        user_text = _user_prompt(language)

        if isinstance(image_bytes, list) and len(image_bytes) > 1:
            multi_view_instruction = (
                "\n\nNOTE: The provided images show different views (e.g., front, back, details) "
                "of the SAME single garment. Please analyze all views to extract a complete, unified "
                "description of the garment (e.g. if the back view reveals it is sexy/exposed, incorporate "
                "that into the tags, dress code, and caption, even if the front view looks modest)."
            )
            user_text += multi_view_instruction

        # 1) Resolve the routing target.
        if provider:
            resolved = provider.strip().lower()
            routing_source = "explicit"
        else:
            resolved = (await eyes_override.get_active_provider()).lower()
            routing_source = "toggle"

        raw: str | None = None
        used_provider: str = resolved
        used_model: str = model or self.model
        used_fallback: bool = False
        fallback_reason: str | None = None

        # 2) Gemma path (toggle says gemma AND a Space URL is configured).
        if resolved == "gemma" and settings.EYES_GEMMA_SPACE_URL:
            t0 = time.perf_counter()
            try:
                raw = await _call_gemma_space(
                    system_prompt=system_prompt,
                    user_text=user_text,
                    image_b64_jpeg=b64,
                    # The Gemma-4 fine-tune is a thinking model: it spends
                    # ~600-1200 tokens reasoning inside ``<|think|> ...
                    # </think>`` before producing the JSON. Combined with
                    # the 18-field schema (~600 tokens of valid output),
                    # the default 900-token budget is too tight and the
                    # response gets cut off mid-think with empty
                    # ``content``. 2400 leaves comfortable headroom.
                    max_tokens=2400,
                    timeout=settings.EYES_GEMMA_TIMEOUT_S,
                    json_schema=EYES_JSON_SCHEMA,
                    think=think,
                )
                provider_activity.record(
                    "garment-vision",
                    ok=True,
                    latency_ms=int((time.perf_counter() - t0) * 1000),
                    extra={
                        "provider": "gemma",
                        "model": "gemma-4-e2b-q4_k_m",
                        "routing_source": routing_source,
                    },
                )
                used_provider = "gemma"
                used_model = "gemma-4-e2b-q4_k_m"
            except Exception as exc:  # noqa: BLE001
                provider_activity.record(
                    "garment-vision",
                    ok=False,
                    latency_ms=int((time.perf_counter() - t0) * 1000),
                    error=repr(exc),
                    extra={
                        "provider": "gemma",
                        "fallback": "gemini",
                        "routing_source": routing_source,
                    },
                )
                logger.warning(
                    "Gemma Space unavailable (%s) \u2014 falling back to Gemini.",
                    repr(exc)[:200],
                )
                used_fallback = True
                fallback_reason = repr(exc)[:200]
                resolved = "gemini"
                raw = None  # cascade into the Gemini branch below

        # 3) Gemini path (toggle says gemini, OR Gemma path failed and
        #    cascaded down here, OR gemma was selected but no Space URL
        #    is configured on this pod).
        if raw is None:
            if not self.api_key:
                raise RuntimeError(
                    "Gemini Eyes path requires GEMINI_API_KEY to be set "
                    "(see /app/backend/.env)."
                )
            gemini_model = model or self.model
            gem = self._get_gemini()
            t0 = time.perf_counter()
            ok = False
            last_err: str | None = None
            try:
                raw = await gem.vision(
                    system=system_prompt,
                    user_parts=[user_text] + shrunk_list,
                    model=gemini_model,
                    temperature=0.1,
                    response_mime_type="application/json",
                )
                ok = True
            except Exception as exc:  # noqa: BLE001
                last_err = repr(exc)
                raise
            finally:
                extra: dict[str, Any] = {
                    "provider": "gemini",
                    "model": gemini_model,
                    "routing_source": routing_source,
                }
                if used_fallback:
                    extra["fallback_from"] = "gemma"
                    extra["fallback_reason"] = fallback_reason
                provider_activity.record(
                    "garment-vision",
                    ok=ok,
                    latency_ms=int((time.perf_counter() - t0) * 1000),
                    error=last_err,
                    extra=extra,
                )
            used_provider = "gemini"
            used_model = gemini_model

        # 4) Parse + sanitise. Eyes v3 (Gemma 4) may return a JSON array
        #    when the crop contains multiple garments; collapse to first.
        parsed = _coerce_single_garment(_extract_json(raw or ""))
        if not parsed.get("title") and parsed.get("name"):
            parsed["title"] = parsed["name"]
        if not parsed.get("title"):
            parsed["title"] = "Unnamed garment"
        parsed = _coerce_enums(parsed)
        parsed["provider_used"] = used_provider
        parsed["model_used"] = used_model
        if used_fallback:
            parsed["provider_fallback"] = {
                "from": "gemma",
                "to": "gemini",
                "reason": fallback_reason,
            }
        parsed["raw"] = {"preview": (raw or "")[:500]}
        logger.info(
            "The Eyes OK provider=%s model=%s routing=%s fallback=%s "
            "category=%s sub=%s item_type=%s",
            used_provider,
            used_model,
            routing_source,
            used_fallback,
            parsed.get("category"),
            parsed.get("sub_category"),
            parsed.get("item_type"),
        )
        return parsed

    async def analyze_group(
        self,
        images_bytes: list[bytes],
        group_items: list[dict[str, Any]],
        *,
        language: str | None = None,
    ) -> dict[str, Any]:
        """Compare and enhance metadata across items in a group.
        
        This method uses Gemini 2.5 Flash to analyze multiple images and their current
        metadata. It identifies the Front, Back, and Profile views, refines taxonomy
        properties, and adds appropriate view tags ('Front' / 'Back' / 'Profile') to
        each item's tags.
        """
        if not self.api_key:
            raise RuntimeError(
                "Gemini path requires GEMINI_API_KEY to be set."
            )
            
        shrunk_list = [_shrink_for_vision(img) for img in images_bytes]
        
        from PIL import Image
        import io
        
        user_text = (
            f"We have a group of {len(group_items)} items representing different views of the SAME single garment.\n\n"
            f"Please analyze all views and their current metadata. One item is the primary/frontal view (the host/master), "
            f"and the others are secondary views (members, providing details like back or profile views).\n\n"
        )
        
        for i, item in enumerate(group_items):
            aspect_str = "unknown aspect ratio"
            if i < len(images_bytes):
                try:
                    img = Image.open(io.BytesIO(images_bytes[i]))
                    w, h = img.size
                    if h > 0:
                        aspect_str = f"aspect ratio {w/h:.2f} ({w}x{h})"
                except Exception:
                    pass
            
            user_text += (
                f"Image {i+1} (ID: {item['id']}):\n"
                f"  Role: {item.get('group_role')}\n"
                f"  Aspect ratio: {aspect_str}\n"
                f"  Current Title: {item.get('title')}\n"
                f"  Current Category: {item.get('category')}\n"
                f"  Current Sub-Category: {item.get('sub_category')}\n"
                f"  Current Item Type: {item.get('item_type')}\n"
                f"  Current Colors: {item.get('color')} / {item.get('colors')}\n"
                f"  Current Tags: {item.get('tags')}\n\n"
            )
            
        code = (language or "en").lower()
        lang_name = _LANG_NAMES.get(code, code)
        language_prefix = ""
        if code != "en":
            language_prefix = (
                f"**OUTPUT LANGUAGE = {lang_name} ({code}).** Every free-text "
                f"field (`name`, `title`, `caption`, `tags`, `repair_advice`, "
                f"`sub_category`, `item_type`, `colors[*].name`, "
                f"`fabric_materials[*].name`) MUST be written in fluent, "
                f"idiomatic {lang_name}. JSON keys and enum tokens stay in English.\n\n"
            )

        system_prompt = (
            GROUP_ANALYZE_SYSTEM_PROMPT
            if code == "en"
            else language_prefix + GROUP_ANALYZE_SYSTEM_PROMPT
        )
        
        gem = self._get_gemini()
        t0 = time.perf_counter()
        ok = False
        last_err: str | None = None
        
        try:
            raw = await gem.vision(
                system=system_prompt,
                user_parts=[user_text] + shrunk_list,
                model="gemini-3.5-flash",
                temperature=0.1,
                response_mime_type="application/json",
            )
            ok = True
        except Exception as exc:
            last_err = repr(exc)
            raise
        finally:
            provider_activity.record(
                "garment-vision-group",
                ok=ok,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                error=last_err,
                extra={"provider": "gemini", "model": "gemini-3.5-flash"},
            )
            
        parsed = _extract_json(raw or "")
        return parsed

    # -------------------- multi-item outfit pipeline --------------------
    # -----------------------------------------------------------------
    # analyze_outfit helpers — extracted during Wave O.2 prep to drop
    # the parent function's cyclomatic complexity from 34 down to ~6.
    # Every helper is a thin, testable slice of a single lifecycle
    # phase (detect → short-circuit → filter → crop → matte → analyse).
    # -----------------------------------------------------------------
    @staticmethod
    def _build_fullframe_item(
        analysis: dict[str, Any],
        crop_bytes: bytes,
        *,
        label_hint: str | None = None,
        kind_hint: str | None = None,
        crop_mime: str = "image/jpeg",
        defer_matte: bool = False,
    ) -> dict[str, Any]:
        """Shape a single-item result dict covering the whole frame.

        Used by every fallback branch in :meth:`analyze_outfit` (photo
        looks already-cropped, no useful detections, every crop was
        rejected, every per-crop analysis failed) so the response
        contract stays identical no matter which path we took.
        """
        label = (
            label_hint
            or analysis.get("sub_category")
            or analysis.get("item_type")
            or "garment"
        )
        fitted_bytes, fitted_mime = _fit_crop_to_card(
            crop_bytes, crop_mime=crop_mime,
        )
        return {
            "label": label,
            "kind": kind_hint or "garment",
            "bbox": [0, 0, 1000, 1000],
            "crop_base64": base64.b64encode(fitted_bytes).decode("ascii"),
            "crop_mime": fitted_mime,
            "analysis": analysis,
            "defer_matte": defer_matte,
        }

    async def _whole_image_matte(self, image_bytes: bytes) -> bytes | None:
        """rembg the full frame so already-cropped product photos save
        with a clean alpha channel instead of the raw upload.

        Returns ``None`` when ``AUTO_MATTE_CROPS`` is disabled or rembg
        errors out; callers fall back to the original JPEG bytes in
        that case.
        """
        if not settings.AUTO_MATTE_CROPS:
            logger.info("already-cropped matte: AUTO_MATTE_CROPS=False, skipping")
            return None
        try:
            from app.services import background_matting
            import time as _t

            t0 = _t.time()
            logger.info(
                "already-cropped matte: starting rembg on %d-byte image",
                len(image_bytes),
            )
            result = await background_matting.matte_crop(image_bytes)
            dt = _t.time() - t0
            if result:
                logger.info(
                    "already-cropped matte: SUCCESS in %.1fs (output %d bytes)",
                    dt,
                    len(result),
                )
            else:
                logger.warning(
                    "already-cropped matte: rembg returned None after %.1fs "
                    "(input %d bytes) — keeping original",
                    dt,
                    len(image_bytes),
                )
            return result
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "already-cropped matte: rembg raised %s — keeping original",
                repr(exc)[:200],
            )
            return None

    async def _handle_already_cropped(
        self,
        image_bytes: bytes,
        detections: list[dict[str, Any]],
        language: str | None,
        *,
        think: bool = False,
    ) -> list[dict[str, Any]]:
        """Short-circuit for photos that are already tightly cropped.

        Runs matting and the single-image analyser SERIALLY (not
        ``asyncio.gather``) — concurrent rembg + Gemini on the
        3GB-container prod box has been observed silently OOM-killing
        the onnxruntime session. Latency cost is minimal; correctness
        matters more.
        """
        logger.info(
            "analyze_outfit: photo looks already-cropped "
            "(detections=%d); skipping crop pipeline",
            len(detections),
        )
        crop_bytes = image_bytes
        crop_mime = "image/jpeg"
        defer_matte = False

        if settings.AUTO_MATTE_CROPS:
            matted = await self._whole_image_matte(image_bytes)
            if matted:
                crop_bytes = matted
                crop_mime = "image/png"

        single = await self.analyze(
            image_bytes, language=language, think=think,
        )

        # Pick the LLM's classification first (most reliable on novelty
        # patterns / unusual fabrics). Fall back to the dominant
        # SegFormer detection if the analysis didn't yield a label.
        best_det: dict[str, Any] | None = None
        if detections:
            best_det = max(
                detections,
                key=lambda d: (
                    max(0, d["bbox"][2] - d["bbox"][0])
                    * max(0, d["bbox"][3] - d["bbox"][1])
                ),
            )
        label = (
            single.get("sub_category")
            or single.get("item_type")
            or (best_det.get("label") if best_det else None)
            or "garment"
        )
        kind = (best_det.get("kind") if best_det else None) or "garment"
        return [
            self._build_fullframe_item(
                single, crop_bytes,
                label_hint=label, kind_hint=kind, crop_mime=crop_mime,
                defer_matte=defer_matte,
            )
        ]

    @staticmethod
    def _filter_useful_detections(
        detections: list[dict[str, Any]], cap: int,
    ) -> list[dict[str, Any]]:
        """Drop near-full-frame detections and cap to ``max_items``.

        A single detection that covers ≥90% of the frame is treated as
        "analyse the whole photo" so we don't pay for an identical LLM
        call on a bbox-cropped copy.

        Cap ordering is **category-aware**: when more useful
        detections exist than ``cap`` slots, the rule is "keep one of
        each kind first, then fill remaining slots by frame area
        descending". The previous plain ``useful[:cap]`` slice
        accepted whatever order the parser emitted (ATR class-id
        ascending: Hat → Sunglasses → Upper-clothes → Skirt → Pants →
        Belt → Shoes → Bag → Scarf) — a busy outfit with hat +
        sunglasses + top + skirt + pants + belt + shoes + bag = 8
        detections would lose Shoes + Bag every time because they sit
        at the tail of the class-id order. Category-aware ordering
        guarantees that at least one of (top, bottom, outerwear,
        dress, footwear, headwear, accessory) wins a slot before any
        category gets a second one.
        """
        useful: list[dict[str, Any]] = []
        for det in detections:
            bbox = det.get("bbox")
            if not isinstance(bbox, list) or len(bbox) != 4:
                continue
            ymin, xmin, ymax, xmax = bbox
            area = max(0, (ymax - ymin)) * max(0, (xmax - xmin))
            if area >= 1000 * 1000 * 0.9:
                continue
            useful.append(det)

        if len(useful) <= cap:
            return useful

        # Group by ``kind`` and sort each group by bbox area
        # descending so the bigger garment of each kind wins its slot.
        from collections import defaultdict

        by_kind: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for d in useful:
            kind = (d.get("kind") or "garment").strip().lower()
            by_kind[kind].append(d)
        for kind in by_kind:
            by_kind[kind].sort(
                key=lambda d: (
                    max(0, d["bbox"][2] - d["bbox"][0])
                    * max(0, d["bbox"][3] - d["bbox"][1])
                ),
                reverse=True,
            )

        # Round-robin pick one per kind, then fill remaining slots
        # by largest-area-first across whatever's left.
        out: list[dict[str, Any]] = []
        kinds = list(by_kind.keys())
        while len(out) < cap:
            picked_this_round = False
            for kind in kinds:
                if by_kind[kind] and len(out) < cap:
                    out.append(by_kind[kind].pop(0))
                    picked_this_round = True
            if not picked_this_round:
                break
        return out

    @staticmethod
    def _bbox_crop_useful(
        image_bytes: bytes,
        useful: list[dict[str, Any]],
        *,
        is_single_item: bool = False,
    ) -> list[tuple[dict[str, Any], bytes, str]]:
        """CPU-bound JPEG crop pass. Runs on a thread via
        :func:`asyncio.to_thread` from the caller.

        Also slices any SegFormer mask to the bbox and stashes it on
        the detection dict (``_mask_bbox``) so the matting step can
        intersect rembg's alpha with the per-class mask for cleaner
        garment separation.
        """
        from app.services import clothing_parser

        out: list[tuple[dict[str, Any], bytes, str]] = []
        try:
            from PIL import Image as _PILImage
            import io as _io

            _img = _PILImage.open(_io.BytesIO(image_bytes))
            img_size = _img.size  # (W, H)
        except Exception:  # noqa: BLE001
            img_size = None

        import numpy as _np
        for det in useful:
            # Cut the per-bbox crop using the per-category asymmetric
            # padding from _BBOX_PAD_TRBL_BY_CATEGORY. The returned
            # `box_px` is the EXACT rectangle the JPEG was cut at —
            # we MUST slice the SegFormer mask from this same box so
            # the mask aligns pixel-for-pixel with the crop. Slicing
            # from a separately-computed `bbox_to_pixels(...)` (which
            # uses the legacy 4 % flat padding) leaves the mask
            # shifted by up to ~5 % of the crop dimensions for any
            # category with asymmetric padding (top, bottom, dress,
            # outerwear, footwear), corrupting every downstream alpha
            # intersection.
            result = _crop_to_bbox(
                image_bytes, det["bbox"], category=det.get("kind"),
                is_single_item=is_single_item,
            )
            if not result:
                continue
            crop_bytes, box_px = result
            mask = det.get("mask")
            if mask is not None and img_size is not None:
                mask_bbox = clothing_parser.slice_mask_to_bbox(
                    mask, img_size, box_px
                )
                if mask_bbox is not None:
                    det["_mask_bbox"] = mask_bbox
            
            # Compute other garments mask in full-res and slice it to this crop bbox
            other_garments_mask = None
            if img_size is not None:
                other_masks = []
                for other in useful:
                    if other is det:
                        continue
                    k1 = (det.get("kind") or "").strip().lower()
                    k2 = (other.get("kind") or "").strip().lower()
                    if k1 != k2 and other.get("mask") is not None:
                        # Ignore tiny hallucinated other garments (area < 3% of frame)
                        oy1, ox1, oy2, ox2 = other["bbox"]
                        other_area = max(0, oy2 - oy1) * max(0, ox2 - ox1)
                        if other_area >= 1000 * 1000 * 0.03:
                            other_masks.append(other["mask"])
                if other_masks:
                    combined_other = other_masks[0]
                    for m in other_masks[1:]:
                        combined_other = _np.maximum(combined_other, m)
                    other_garments_mask = clothing_parser.slice_mask_to_bbox(
                        combined_other, img_size, box_px
                    )
            if other_garments_mask is not None:
                det["_other_mask_bbox"] = other_garments_mask

            human_full = det.get("_human_mask_full")
            if human_full is not None and img_size is not None and not is_single_item:
                human_bbox = clothing_parser.slice_mask_to_bbox(
                    human_full, img_size, box_px
                )
                if human_bbox is not None:
                    det["_human_mask_bbox"] = human_bbox
            if is_single_item:
                det["is_single_item"] = True
            out.append((det, crop_bytes, "image/jpeg"))

        # Release full-res references
        for d in useful:
            d["mask"] = None
            d["_human_mask_full"] = None

        return out

    async def _matte_crops(
        self, raw_crops: list[tuple[dict[str, Any], bytes, str]],
    ) -> list[tuple[dict[str, Any], bytes, str]]:
        """Pipe each JPEG crop through rembg, optionally intersecting
        with the SegFormer per-class mask for sharper edges.

        Serialised because each rembg call holds the onnxruntime
        session — parallel invocations have been seen causing silent
        OOM kills in 3GB containers.

        Phantom guard: after matting (with or without intersection),
        measure the solid-alpha coverage of the final RGBA. If it's
        below ``_PHANTOM_DROP_PCT`` (perceptually empty), drop the
        detection entirely rather than ship a blank/near-blank card
        to the UI.
        """
        from app.services import background_matting
        from app.services import clothing_parser as _cp

        matted_crops: list[tuple[dict[str, Any], bytes, str]] = []
        for det, cbytes, mime in raw_crops:
            try:
                matted = await background_matting.matte_crop(cbytes)
            except Exception as exc:  # noqa: BLE001
                logger.info(
                    "auto-matte failed for %s: %s — keeping bbox crop",
                    det.get("label"),
                    repr(exc)[:120],
                )
                matted = None
            if not matted:
                # rembg failed or returned empty — keep the JPEG bbox
                # crop. JPEG has no alpha channel so the phantom
                # guard below doesn't apply; the bbox crop is by
                # construction non-empty (caller filters tiny crops).
                det.pop("_mask_bbox", None)
                det.pop("_human_mask_bbox", None)
                matted_crops.append((det, cbytes, mime))
                continue
            seg_mask_bbox = det.get("_mask_bbox")
            human_mask_bbox = det.get("_human_mask_bbox")
            other_mask_bbox = det.get("_other_mask_bbox")
            is_single = det.get("is_single_item", False)
            if seg_mask_bbox is not None and not is_single:
                try:
                    refined = _cp.apply_alpha_intersection(
                        matted,
                        seg_mask_bbox,
                        category=det.get("kind"),
                        human_mask=human_mask_bbox,
                        other_mask=other_mask_bbox,
                    )
                    if refined:
                        matted = refined
                except Exception as exc:  # noqa: BLE001
                    logger.info(
                        "alpha intersection skipped for %s: %s",
                        det.get("label"),
                        repr(exc)[:120],
                    )
            det.pop("_mask_bbox", None)
            det.pop("_human_mask_bbox", None)
            det.pop("_other_mask_bbox", None)

            # Phantom guard — drop the detection if the final matte
            # has effectively no garment pixels. "Solid" alpha means
            # alpha >= 128 (perceptually opaque); below 5 % of the
            # crop is empirically a blank/near-blank cutout that
            # would surface as an empty white card in the UI.
            cov = _solid_alpha_coverage(matted)
            if cov is not None and cov < _PHANTOM_DROP_PCT:
                logger.info(
                    "_matte_crops: dropping near-empty matte for %s — "
                    "solid-alpha = %.1f%% < %.0f%% threshold",
                    det.get("label"),
                    cov * 100.0,
                    _PHANTOM_DROP_PCT * 100.0,
                )
                continue

            matted_crops.append((det, matted, "image/png"))
        return matted_crops

    async def _analyse_one_crop(
        self,
        det: dict[str, Any],
        crop_bytes: bytes,
        crop_mime: str,
        language: str | None,
        sem: asyncio.Semaphore,
        *,
        think: bool = False,
    ) -> dict[str, Any] | None:
        """Analyse a single crop + (optionally) reconstruct.

        Returns ``None`` when the per-crop analyse call fails so the
        caller can drop it silently — one bad crop shouldn't kill the
        whole outfit response.
        """
        async with sem:
            try:
                analysis = await self.analyze(
                    crop_bytes,
                    model=self.crop_model,
                    language=language,
                    think=think,
                )
                # Patch M21 — Apply SegFormer-anchored category
                # enforcement on the per-crop path too, so any caller
                # of ``_analyse_one_crop`` (per-crop loop, batched-
                # failure fallback, single-item analyze) gets the same
                # category sanity check as the batched paths. Layer 1
                # (prompt hint) isn't available here because
                # ``self.analyze`` is single-crop and we don't decorate
                # its system prompt yet — but layer 2 (post-validate)
                # is enough on its own; the prompt hint is just an
                # is enough on its own; the prompt hint is just an
                # optimisation.
                _enforce_segformer_category(
                    analysis,
                    segformer_kind=det.get("kind"),
                    label=det.get("label"),
                    is_single_item=det.get("is_single_item", False),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "crop analyze failed for label=%s: %s",
                    det.get("label"),
                    repr(exc)[:1500],
                )
                return None

            reconstruction_payload: dict[str, Any] | None = None
            needs_reconstruction = False
            reconstruction_reasons: list[str] = []
            try:
                from app.services.reconstruction import (
                    reconstruct,
                    should_reconstruct,
                )
                from app.config import settings as _settings

                needs, reasons = should_reconstruct(analysis, det.get("bbox"))
                if needs:
                    if _settings.DEFER_RECONSTRUCTION_ON_ANALYZE:
                        # Patch M14 (May 2026) — Defer Nano Banana off
                        # the analyze hot path. We surface the
                        # reconstruction intent + reasons so the
                        # ``/closet`` save endpoint can queue the actual
                        # generation as a BackgroundTask; the response
                        # leaves the inner loop with
                        # ``reconstruction=None`` and ``needs_reconstruction=True``.
                        # Skipping a 20-40s Gemini image call per crop is
                        # the dominant /analyze latency win on full-body
                        # outfits (where every crop touches a frame edge
                        # → every crop normally triggers reconstruction).
                        needs_reconstruction = True
                        reconstruction_reasons = list(reasons)
                        logger.info(
                            "reconstruction DEFERRED for label=%s reasons=%s",
                            det.get("label"), reasons,
                        )
                    else:
                        reconstruction_payload = await reconstruct(
                            crop_bytes, analysis, reasons=reasons,
                        )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "reconstruction pipeline failed for label=%s: %s",
                    det.get("label"),
                    repr(exc)[:160],
                )
            fitted_bytes, fitted_mime = _fit_crop_to_card(
                crop_bytes, crop_mime=crop_mime,
            )
            return {
                "label": det.get("label") or "garment",
                "kind": det.get("kind") or "garment",
                "bbox": det.get("bbox"),
                "crop_base64": base64.b64encode(fitted_bytes).decode("ascii"),
                "crop_mime": fitted_mime,
                "analysis": analysis,
                "reconstruction": reconstruction_payload,
                # Patch M14 — Marker fields used by the ``/closet`` save
                # endpoint to decide whether to queue a post-save
                # reconstruction BackgroundTask. ``False`` / empty list
                # when reconstruction either wasn't needed, ran inline
                # (DEFER_RECONSTRUCTION_ON_ANALYZE=false), or failed.
                "needs_reconstruction": needs_reconstruction,
                "reconstruction_reasons": reconstruction_reasons,
            }

    async def _analyse_crops(
        self,
        crops: list[tuple[dict[str, Any], bytes, str]],
        language: str | None,
        *,
        think: bool = False,
    ) -> list[dict[str, Any]]:
        """Run :meth:`_analyse_one_crop` over every crop with bounded
        concurrency, then strip unidentifiable results.

        Patch M18 (May 2026) — Batched-first execution.
        --------------------------------------------------------------
        On the live preview pod we measured single Gemini-2.5-Flash
        analyze() ≈ 16 s and 3-parallel ≈ 53 s — the Emergent LLM-key
        tier serialises concurrent calls down to ~1 in flight. So a
        4-item outfit's per-crop loop with ``Semaphore(6)`` was
        effectively sequential and took 60+ s wall (which then needed
        the M17 keepalive trick to survive the ingress 60 s ceiling).

        ``analyze_batch`` packs all N crops into ONE multi-modal Gemini
        request and parses an N-element JSON array back. That bypasses
        the concurrency-1 throttle entirely and on a 4-item outfit
        drops the wall time to ~20-30 s — the model is doing the same
        amount of vision work but only paying network / prompt-prefix
        / response-prefix overhead once instead of N times.

        On any batch-level failure (rate limit, malformed array,
        wrong-length response, validation error from
        ``_coerce_single_garment``) we log and fall back to the legacy
        per-crop loop. That preserves the "one bad crop shouldn't kill
        the whole outfit" invariant from the per-crop path because the
        per-crop ``_analyse_one_crop`` already handles that case.
        """
        if not crops:
            return []

        # M18 — try batched single-call first. ``think`` is intentionally
        # not threaded into the batched path: the closet AddItem flow
        # never sets it, and the batched prompt is tuned for the
        # non-reasoning Gemini pass.
        batched_analyses: list[dict[str, Any]] | None = None
        if not think:
            try:
                t0 = time.perf_counter()
                crop_bytes_list = [b for _, b, _ in crops]
                # Patch M21 — Thread the per-crop SegFormer kind into
                # the batched Gemini call. Layer 1 of the category
                # enforcement: Gemini sees a "CROP CATEGORY HINTS"
                # block in the system prompt naming each crop's
                # pre-classified category, which steers it away from
                # the "coat tails leaking into pants crop → Overcoat"
                # failure mode. Layer 2 (the override in
                # ``_enforce_segformer_category``) fires inside
                # ``analyze_batch`` on the parsed result.
                kind_hints = [
                    (d.get("kind") if isinstance(d, dict) else None)
                    for d, _b, _m in crops
                ]
                batched_analyses = await self.analyze_batch(
                    crop_bytes_list, language=language, kind_hints=kind_hints,
                )
                logger.info(
                    "_analyse_crops batched OK: %d crops in %.1fs (one Gemini call)",
                    len(crops), time.perf_counter() - t0,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "_analyse_crops batched FAILED, falling back to "
                    "per-crop loop: %s",
                    repr(exc)[:240],
                )
                batched_analyses = None

        if batched_analyses is not None and len(batched_analyses) == len(crops):
            results = await self._build_batched_results(crops, batched_analyses)
        else:
            sem = asyncio.Semaphore(6)
            results = await asyncio.gather(
                *[
                    self._analyse_one_crop(d, b, m, language, sem, think=think)
                    for d, b, m in crops
                ]
            )

        items = [r for r in results if r]
        before_drop = len(items)
        items = [r for r in items if not _is_unidentifiable(r.get("analysis"))]
        if len(items) < before_drop:
            logger.info(
                "analyze_outfit: dropped %d unidentifiable item(s)",
                before_drop - len(items),
            )
        return items

    async def _build_batched_results(
        self,
        crops: list[tuple[dict[str, Any], bytes, str]],
        analyses: list[dict[str, Any]],
    ) -> list[dict[str, Any] | None]:
        """Materialise the per-crop result dicts from a batched analyze.

        Mirrors the trailing portion of :meth:`_analyse_one_crop`
        (reconstruction gating, dict shape, base64 crop encoding) so
        downstream callers (the ``/closet/analyze`` endpoint and the
        save flow) see an identical structure regardless of which
        execution path produced it.
        """
        from app.config import settings as _settings

        try:
            from app.services.reconstruction import should_reconstruct
        except Exception:  # noqa: BLE001
            should_reconstruct = None  # type: ignore[assignment]

        out: list[dict[str, Any] | None] = []
        for (det, crop_bytes, crop_mime), analysis in zip(crops, analyses):
            if not isinstance(analysis, dict):
                # Defensive: batched parser may have returned a non-dict
                # for one slot — treat as if that slot failed and skip.
                out.append(None)
                continue
            needs_reconstruction = False
            reconstruction_reasons: list[str] = []
            if should_reconstruct is not None:
                try:
                    needs, reasons = should_reconstruct(
                        analysis, det.get("bbox"),
                    )
                    if needs and _settings.DEFER_RECONSTRUCTION_ON_ANALYZE:
                        needs_reconstruction = True
                        reconstruction_reasons = list(reasons)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "reconstruction gate failed for batched crop "
                        "label=%s: %s",
                        det.get("label"), repr(exc)[:160],
                    )
            fitted_bytes, fitted_mime = _fit_crop_to_card(
                crop_bytes, crop_mime=crop_mime,
            )
            out.append(
                {
                    "label": det.get("label") or "garment",
                    "kind": det.get("kind") or "garment",
                    "bbox": det.get("bbox"),
                    "crop_base64": base64.b64encode(fitted_bytes).decode("ascii"),
                    "crop_mime": fitted_mime,
                    "analysis": analysis,
                    "reconstruction": None,
                    "needs_reconstruction": needs_reconstruction,
                    "reconstruction_reasons": reconstruction_reasons,
                }
            )
        return out

    async def analyze_batch(
        self,
        crops_bytes: list[bytes],
        *,
        language: str | None = None,
        kind_hints: list[str | None] | None = None,
    ) -> list[dict[str, Any]]:
        """Patch M18 — Single Gemini call analysing N crops at once.

        Builds one multi-modal request with all N crops attached and
        asks the model to return an N-element JSON array of
        GarmentAnalysis objects, in the same order. Bypasses the
        Emergent LLM-key concurrency-1 throttle that made the per-crop
        loop effectively sequential.

        Raises on any condition where the result can't be trusted
        (network error, missing key, model returned the wrong number
        of items, response wasn't a parseable array). The caller
        (``_analyse_crops``) catches and falls back to the per-crop
        loop, so a batch-level failure never breaks the analyze
        endpoint.

        Notes
        -----
        * Gemma is intentionally not supported here — the Gemma-4
          fine-tune is single-image only and the Eyes toggle never
          routes batches to it. We always go straight to Gemini.
        * Per-image base64 ``_shrink_for_vision`` keeps the
          request payload bounded; with the default ``max_side=1280``
          a 4-crop request lands at <250 KB pre-base64.
        """
        n = len(crops_bytes)
        if n == 0:
            return []
        if not self.api_key:
            raise RuntimeError(
                "analyze_batch: requires GEMINI_API_KEY"
            )

        # streaming paths emit equivalent prompts.
        system_prompt, user_text = _build_batch_prompts(
            n=n, language=language, kind_hints=kind_hints,
        )

        # Build native google-genai user parts: text first, then each
        # crop as image bytes. Order matches the legacy ImageContent
        # sequence so prompt + numbering semantics stay identical.
        user_parts: list[Any] = [user_text]
        for b in crops_bytes:
            user_parts.append(_shrink_for_vision(b))

        gem = self._get_gemini()
        t0 = time.perf_counter()
        ok = False
        last_err: str | None = None
        try:
            raw = await gem.vision(
                system=system_prompt,
                user_parts=user_parts,
                model=self.crop_model,
                temperature=0.1,
                response_mime_type="application/json",
            )
            ok = True
        except Exception as exc:  # noqa: BLE001
            last_err = repr(exc)
            raise
        finally:
            provider_activity.record(
                "garment-vision-batch",
                ok=ok,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                error=last_err,
                extra={
                    "provider": "gemini",
                    "model": self.crop_model,
                    "batch_size": n,
                },
            )

        parsed = _extract_json(raw or "")
        # Some models wrap arrays in {"items": [...]} or {"results": [...]}.
        if isinstance(parsed, dict):
            for key in ("items", "results", "garments", "analyses"):
                if isinstance(parsed.get(key), list):
                    parsed = parsed[key]
                    break
        if not isinstance(parsed, list):
            raise ValueError(
                f"analyze_batch: expected JSON array of {n}, got "
                f"{type(parsed).__name__}"
            )
        if len(parsed) != n:
            raise ValueError(
                f"analyze_batch: model returned {len(parsed)} items, "
                f"expected exactly {n}"
            )

        # Coerce each entry through the same single-garment normaliser
        # the per-crop path uses so dress_code enums, title fallbacks,
        # provider tags etc. all line up.
        results: list[dict[str, Any]] = []
        for slot_idx, entry in enumerate(parsed):
            try:
                norm = _coerce_single_garment(entry)
                if not norm.get("title") and norm.get("name"):
                    norm["title"] = norm["name"]
                if not norm.get("title"):
                    norm["title"] = "Unnamed garment"
                norm = _coerce_enums(norm)
                # Patch M21 — Layer 2 SegFormer-anchored category
                # enforcement. Applied AFTER ``_coerce_enums`` so we
                # only override values that survived enum coercion.
                if kind_hints and slot_idx < len(kind_hints):
                    _enforce_segformer_category(
                        norm,
                        segformer_kind=kind_hints[slot_idx],
                        label=norm.get("name") or norm.get("title"),
                    )
                norm["provider_used"] = "gemini"
                norm["model_used"] = self.crop_model
                norm["_batched"] = True
                results.append(norm)
            except Exception as exc:  # noqa: BLE001
                # One bad slot — push a sentinel so the caller's
                # ``_build_batched_results`` can drop it; we don't
                # raise here because that would discard the rest of
                # the (good) batch.
                logger.warning(
                    "analyze_batch: bad entry coerced to empty: %s",
                    repr(exc)[:160],
                )
                results.append({})
        return results

    async def analyze_batch_stream(
        self,
        crops_bytes: list[bytes],
        *,
        language: str | None = None,
        kind_hints: list[str | None] | None = None,
    ) -> "AsyncIterator[tuple[int, dict[str, Any]]]":
        """Patch M19 — Streaming variant of :meth:`analyze_batch`.

        Yields ``(index, normalised_analysis)`` tuples as Gemini emits
        each complete object in the JSON array, so the caller can push
        per-item results to the frontend as they arrive instead of
        waiting for the full N-element response.

        Implementation
        --------------
        Bypasses ``LlmChat.send_message`` (which awaits a complete
        response) and goes straight to ``litellm.acompletion`` with
        ``stream=True``. We accumulate text deltas, run the
        :func:`_scan_complete_json_objects` brace-counting parser
        after every chunk, and yield each newly-completed object.

        Robustness
        ----------
        * On any ``litellm`` / network exception we bubble it up — the
          caller (``_analyse_crops`` via ``_iter_batched_results``)
          falls back to the per-crop loop.
        * If a chunk produces a malformed object (rare), the parser
          silently drops it; we still yield the surviving objects.
        * The final shape per yielded analysis matches
          :meth:`analyze_batch` (``_coerce_single_garment`` +
          ``_coerce_enums`` + ``provider_used``/``model_used``/
          ``_batched`` tags) so downstream consumers don't need to
          care which path produced the dict.
        """
        n = len(crops_bytes)
        if n == 0:
            return
        if not self.api_key:
            raise RuntimeError(
                "analyze_batch_stream: requires GEMINI_API_KEY"
            )

        # Native google-genai streaming. Builds the same system prompt /
        # user-text payload that ``analyze_batch`` uses (delegating to
        # :func:`_build_batch_prompts` keeps both batched paths in
        # lock-step), then drives ``client.stream_vision`` for
        # incremental JSON deltas. The legacy
        # ``litellm.acompletion(stream=True)`` path that routed via
        # Emergent's proxy was the prime suspect for the May 2026
        # streaming hang: the proxy buffered the full response before
        # flushing, so the frontend's NDJSON reader saw nothing until
        # the very end (or a 502 if Caddy's upstream timeout hit).
        # Native streaming bypasses that.
        system_prompt, user_text = _build_batch_prompts(
            n=n, language=language, kind_hints=kind_hints,
        )

        user_parts: list[Any] = [user_text]
        for b in crops_bytes:
            user_parts.append(_shrink_for_vision(b))

        gem = self._get_gemini()

        t0 = time.perf_counter()
        emitted = 0
        ok = False
        last_err: str | None = None
        try:
            text_buf = ""
            scan_pos = 0
            yielded_count = 0
            async for delta in gem.stream_vision(
                system=system_prompt,
                user_parts=user_parts,
                model=self.crop_model,
                temperature=0.2,
                response_mime_type="application/json",
            ):
                if not delta:
                    continue
                text_buf += delta
                new_objs, scan_pos = _scan_complete_json_objects(
                    text_buf, scan_pos,
                )
                for raw_entry in new_objs:
                    try:
                        norm = _coerce_single_garment(raw_entry)
                        if not norm.get("title") and norm.get("name"):
                            norm["title"] = norm["name"]
                        if not norm.get("title"):
                            norm["title"] = "Unnamed garment"
                        norm = _coerce_enums(norm)
                        # Patch M21 — Layer 2 SegFormer-anchored category
                        # enforcement on the streaming path. Applied
                        # after ``_coerce_enums`` so we only override
                        # enum-valid values. ``yielded_count`` is the
                        # zero-based slot index, which matches the
                        # ``kind_hints`` ordering by construction
                        # (one hint per crop, same order as
                        # ``crops_bytes``).
                        if kind_hints and yielded_count < len(kind_hints):
                            _enforce_segformer_category(
                                norm,
                                segformer_kind=kind_hints[yielded_count],
                                label=norm.get("name") or norm.get("title"),
                            )
                        norm["provider_used"] = "gemini"
                        norm["model_used"] = self.crop_model
                        norm["_batched"] = True
                        norm["_streamed"] = True
                    except Exception as exc:  # noqa: BLE001
                        logger.warning(
                            "analyze_batch_stream: dropping bad entry "
                            "at index %d: %s",
                            yielded_count, repr(exc)[:160],
                        )
                        norm = {}
                    if yielded_count < n:
                        yield (yielded_count, norm)
                        emitted += 1
                    yielded_count += 1
            ok = True
        except Exception as exc:  # noqa: BLE001
            last_err = repr(exc)
            raise
        finally:
            provider_activity.record(
                "garment-vision-batch-stream",
                ok=ok,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                error=last_err,
                extra={
                    "provider": "gemini",
                    "model": self.crop_model,
                    "batch_size": n,
                    "emitted": emitted,
                },
            )
        # Pad the tail with empty dicts if the model returned fewer
        # complete objects than crops (rare — usually it returns
        # exactly N). The caller's `_iter_batched_results` treats
        # empties as "skip this crop".
        while emitted < n:
            yield (emitted, {})
            emitted += 1

    async def analyze_outfit(
        self, image_bytes: bytes, *, max_items: int | None = None,
        language: str | None = None,
        think: bool = False,
    ) -> list[dict[str, Any]]:
        """End-to-end multi-item pipeline.

        1. Gemini detects bounding boxes for every garment / accessory /
           jewelry piece.
        2. Each bbox is cropped server-side.
        3. Each crop is re-analysed in parallel by Gemini for the rich
           17-field form payload.
        4. Returned entries include the crop (as base64 JPEG) so the
           frontend can render a preview card per item and, when the
           user saves, persist the crop rather than the full outfit
           photo.

        Returns a list of dicts with shape::

            {
              "label": "oxford shirt",
              "kind": "garment",
              "bbox": [ymin, xmin, ymax, xmax],
              "crop_base64": "<base64 jpeg>",
              "crop_mime": "image/jpeg",
              "analysis": { ...GarmentAnalysis fields... }
            }

        When detection fails or yields nothing usable, we gracefully
        degrade to a single-item analysis of the original image.
        """
        # 1) Detect. Soft-fail to single-image analysis on error.
        try:
            detections = await self.detect_items(image_bytes)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "detect_items failed (%s); falling back to single analysis",
                repr(exc)[:160],
            )
            detections = []

        # 2) Fast-path: already-cropped product photo.
        if _looks_already_cropped(detections):
            return await self._handle_already_cropped(
                image_bytes, detections, language, think=think,
            )

        # 3) Filter + cap detections.
        cap = max_items if max_items is not None else self.max_items
        useful = self._filter_useful_detections(detections, cap)
        if not useful:
            single = await self.analyze(
                image_bytes, language=language, think=think,
            )
            return [
                self._build_fullframe_item(
                    single, image_bytes, defer_matte=settings.AUTO_MATTE_CROPS
                )
            ]

        # 4) Crop (CPU-bound; run on a worker thread).
        raw_crops = await asyncio.to_thread(
            self._bbox_crop_useful, image_bytes, useful,
        )

        # 5) Matte if enabled. Patch 8 (May 2026): when
        # ``settings.DEFER_REMBG_ON_ANALYZE`` is True (default), we
        # skip the synchronous serial rembg pass entirely and return
        # raw JPEG bbox crops. The /closet save endpoint queues the
        # matte as a BackgroundTask per item, identical to the
        # Phase-O.6 single-pass path. This is the dominant win for
        # the analyze latency budget (saves ~10-30s per crop, serial).
        if settings.AUTO_MATTE_CROPS and raw_crops:
            crops = await asyncio.to_thread(_apply_fast_matte, raw_crops)
        else:
            for det, _, _ in raw_crops:
                det["defer_matte"] = False
            crops = raw_crops

        if not crops:
            # Every crop was rejected (tiny / invalid bbox).
            single = await self.analyze(
                image_bytes, language=language, think=think,
            )
            return [
                self._build_fullframe_item(
                    single, image_bytes, defer_matte=settings.AUTO_MATTE_CROPS
                )
            ]

        # 6) Analyse each crop in parallel.
        items = await self._analyse_crops(crops, language, think=think)

        # 7) If every parallel call failed, fall back once.
        if not items:
            single = await self.analyze(image_bytes, think=think)
            return [
                self._build_fullframe_item(
                    single, image_bytes, defer_matte=settings.AUTO_MATTE_CROPS
                )
            ]

        # Patch 8 marker: flag every item so the /closet save endpoint
        # knows it must queue a rembg BackgroundTask for this crop
        # (the matte was intentionally skipped here to keep the
        # /analyze response under the 30s UX budget).
        if defer_matte:
            for it in items:
                it["defer_matte"] = True

        logger.info(
            "analyze_outfit OK detected=%d analysed=%d labels=%s",
            len(useful),
            len(items),
            [i["label"] for i in items][:8],
        )
        return items

    async def analyze_outfit_stream(
        self,
        image_bytes: bytes,
        *,
        max_items: int | None = None,
        language: str | None = None,
    ) -> "AsyncIterator[dict[str, Any]]":
        """Patch M19 — Streaming end-to-end variant of :meth:`analyze_outfit`.

        Yields high-level frames in order:

          1. ``{"type": "detect", "count": N, "items_meta": [...]}`` —
             emitted as soon as detection + cropping is done. Each
             entry in ``items_meta`` carries the per-crop label / kind
             / bbox / crop_base64 / crop_mime / defer_matte so the
             frontend can render an "analysing…" placeholder card with
             the cropped thumbnail BEFORE Gemini even starts on the
             first analysis.
          2. ``{"type": "item", "index": i, "analysis": {...},
             "needs_reconstruction": bool, "reconstruction_reasons":
             [...]}`` — one frame per crop, emitted as soon as Gemini
             finishes that slot inside the streamed batched call.
          3. ``{"type": "done", "count": N_emitted}`` — final marker.

        On any failure (detect_items raises, batch stream fails, etc.)
        we surface a single ``{"type": "error", "status": <int>,
        "message": <str>}`` frame; the frontend treats this like a
        rejected promise.

        This generator deliberately does not include the full-frame
        single-image fallback that ``analyze_outfit`` runs when
        detection returns nothing useful — the streaming variant is
        only used for multi-item uploads. The caller is expected to
        fall back to ``analyze_outfit`` (one-shot JSON) when
        ``items_meta`` would have come out empty.
        """
        try:
            detections = await self.detect_items(image_bytes)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "analyze_outfit_stream: detect_items failed (%s)",
                repr(exc)[:160],
            )
            yield {
                "type": "error",
                "status": 503,
                "message": "Garment detection is temporarily unavailable.",
            }
            return

        if _looks_already_cropped(detections):
            # Already-cropped / single-item product photos skip per-crop
            # analysis and do a single full-frame analyze.
            # We must yield the detect frame IMMEDIATELY for fast TTFB,
            # then run the blocking LLM analysis.
            crop_bytes = image_bytes
            crop_mime = "image/jpeg"

            defer_matte = settings.AUTO_MATTE_CROPS
            best_det: dict[str, Any] | None = None
            if settings.AUTO_MATTE_CROPS and detections:
                best_det = max(
                    detections,
                    key=lambda d: (
                        max(0, d["bbox"][2] - d["bbox"][0])
                        * max(0, d["bbox"][3] - d["bbox"][1])
                    ),
                )
                raw_crops = await asyncio.to_thread(
                    self._bbox_crop_useful, image_bytes, [best_det], is_single_item=True,
                )
                out = await asyncio.to_thread(_apply_fast_matte, raw_crops)
                if out:
                    d_meta, crop_bytes, crop_mime = out[0]
                    defer_matte = d_meta.get("defer_matte", False)
                elif raw_crops:
                    d_meta, crop_bytes, crop_mime = raw_crops[0]
                    defer_matte = d_meta.get("defer_matte", False)

            fitted_bytes, fitted_mime = _fit_crop_to_card(
                crop_bytes, crop_mime=crop_mime,
            )

            # 1. Yield the fast detect frame
            yield {
                "type": "detect",
                "count": 1,
                "items_meta": [{
                    "label": best_det.get("label") if best_det else "garment",
                    "kind": best_det.get("kind") if best_det else "garment",
                    "bbox": best_det.get("bbox") if best_det else [0, 0, 1000, 1000],
                    "crop_base64": base64.b64encode(fitted_bytes).decode("ascii"),
                    "crop_mime": fitted_mime,
                    "defer_matte": defer_matte,
                }],
            }

            # 2. Block on the LLM analysis
            single = await self.analyze(
                image_bytes, language=language, think=False,
            )

            # 3. Yield the analysis
            yield {
                "type": "item",
                "index": 0,
                "analysis": single,
                "label": single.get("sub_category") or single.get("item_type"),
                "needs_reconstruction": False,
                "reconstruction_reasons": [],
            }
            yield {"type": "done", "count": 1}
            return

        cap = max_items if max_items is not None else self.max_items
        useful = self._filter_useful_detections(detections, cap)
        if not useful:
            yield {
                "type": "error",
                "status": 422,
                "message": (
                    "We couldn't identify any garment in this photo. "
                    "Please try a clearer, well-lit shot."
                ),
            }
            return

        raw_crops = await asyncio.to_thread(
            self._bbox_crop_useful, image_bytes, useful,
        )

        if settings.AUTO_MATTE_CROPS and raw_crops:
            crops = await asyncio.to_thread(_apply_fast_matte, raw_crops)
        else:
            for det, _, _ in raw_crops:
                det["defer_matte"] = False
            crops = raw_crops

        if not crops:
            yield {
                "type": "error",
                "status": 422,
                "message": (
                    "We couldn't identify any garment in this photo. "
                    "Please try a clearer, well-lit shot."
                ),
            }
            return

        # Emit the detect frame FIRST — gives the frontend everything
        # it needs to render placeholder cards while we wait for
        # per-item analyses to stream in.
        items_meta = []
        for d, crop_b, crop_m in crops:
            fitted_b, fitted_m = _fit_crop_to_card(crop_b, crop_mime=crop_m)
            items_meta.append({
                "label": d.get("label") or "garment",
                "kind": d.get("kind") or "garment",
                "bbox": d.get("bbox"),
                "crop_base64": base64.b64encode(fitted_b).decode("ascii"),
                "crop_mime": fitted_m,
                "defer_matte": d.get("defer_matte", False),
            })
        yield {"type": "detect", "count": len(crops), "items_meta": items_meta}

        # Stream-analyse the crops via batched Gemini stream.
        crops_bytes = [b for _, b, _ in crops]
        # Patch M21 — extract SegFormer kinds in crop order so the
        # streaming batched call can embed them as prompt hints AND
        # post-validate Gemini's category against them per crop.
        kind_hints = [
            (d.get("kind") if isinstance(d, dict) else None)
            for d, _b, _m in crops
        ]
        from app.config import settings as _settings

        try:
            from app.services.reconstruction import should_reconstruct
        except Exception:  # noqa: BLE001
            should_reconstruct = None  # type: ignore[assignment]

        emitted = 0
        try:
            async for idx, analysis in self.analyze_batch_stream(
                crops_bytes, language=language, kind_hints=kind_hints,
            ):
                if not isinstance(analysis, dict) or not analysis:
                    # Empty / dropped slot — emit a sentinel item with
                    # an empty analysis so the frontend can drop the
                    # corresponding placeholder card.
                    yield {
                        "type": "item",
                        "index": idx,
                        "analysis": {},
                        "needs_reconstruction": False,
                        "reconstruction_reasons": [],
                    }
                    emitted += 1
                    continue
                # Reconstruction gate — same logic as
                # ``_build_batched_results`` so the streamed and
                # one-shot batched paths produce identical shapes.
                needs_reconstruction = False
                reasons: list[str] = []
                if should_reconstruct is not None:
                    try:
                        det = crops[idx][0] if idx < len(crops) else {}
                        needs, raw_reasons = should_reconstruct(
                            analysis, det.get("bbox"),
                        )
                        if needs and _settings.DEFER_RECONSTRUCTION_ON_ANALYZE:
                            needs_reconstruction = True
                            reasons = list(raw_reasons)
                    except Exception as exc:  # noqa: BLE001
                        logger.warning(
                            "reconstruction gate failed (streamed) "
                            "idx=%d: %s",
                            idx, repr(exc)[:160],
                        )
                yield {
                    "type": "item",
                    "index": idx,
                    "analysis": analysis,
                    "label": analysis.get("sub_category") or analysis.get("item_type"),
                    "needs_reconstruction": needs_reconstruction,
                    "reconstruction_reasons": reasons,
                }
                emitted += 1
        except Exception as exc:  # noqa: BLE001
            # Log the *full* repr at ERROR (not WARNING) so production
            # operators can see auth / quota / model-not-found failures
            # without grep magic. The 200-char truncation is enough for
            # the actionable bit of any Google-API exception
            # (status code + reason fits in ~120 chars).
            err_text = repr(exc)
            logger.error(
                "analyze_outfit_stream: batch stream FAILED after "
                "%d emit(s): %s",
                emitted, err_text[:400],
            )

            # Surface a *specific* message to the frontend so the user
            # sees the real cause instead of the generic "transient
            # error" stub. We pattern-match on the exception text
            # because google-genai raises different classes for each
            # API status family.
            low = err_text.lower()
            if "permission_denied" in low or " 403" in low or "permission denied" in low:
                msg = (
                    "Garment analyzer: Gemini API rejected the request "
                    "(403 PERMISSION_DENIED). Check that GEMINI_API_KEY "
                    "is set in the production env, that the key is not "
                    "expired/revoked, and that the project has the "
                    "Generative Language API enabled."
                )
                status = 403
            elif "unauthenticated" in low or " 401" in low:
                msg = (
                    "Garment analyzer: Gemini API rejected the key "
                    "(401 UNAUTHENTICATED). The GEMINI_API_KEY in env "
                    "is missing or invalid."
                )
                status = 401
            elif "resource_exhausted" in low or " 429" in low or "quota" in low:
                msg = (
                    "Garment analyzer: Gemini quota exhausted "
                    "(429). Wait a minute and retry, or upgrade the "
                    "AI Studio billing tier."
                )
                status = 429
            elif "not_found" in low or " 404" in low or "model not found" in low:
                msg = (
                    "Garment analyzer: requested Gemini model is not "
                    "available to this key (404 NOT_FOUND). Verify "
                    "GARMENT_VISION_CROP_MODEL points to a model your "
                    "project has access to."
                )
                status = 404
            elif "deadline" in low or "timeout" in low or "timed out" in low:
                msg = (
                    "Garment analyzer: Gemini API timed out. "
                    "Retry in a moment."
                )
                status = 504
            elif " 500" in low or " 502" in low or " 503" in low or "internal" in low:
                msg = (
                    "Garment analyzer: Gemini API returned a server "
                    "error. This is on Google's side — retry shortly."
                )
                status = 503
            else:
                # True unknowns still get the friendly fallback, BUT we
                # include the first 160 chars of the exception so the
                # user (or support) can root-cause without log access.
                msg = (
                    "Garment analyzer hit a transient error. "
                    "Please try again. (debug: "
                    + err_text[:160].replace("\n", " ")
                    + ")"
                )
                status = 503

            yield {
                "type": "error",
                "status": status,
                "message": msg,
            }
            return

        yield {"type": "done", "count": emitted}

    async def _is_single_item(self, image_bytes: bytes) -> bool:
        """Fast pre-check to bypass Owl-ViT for single-item photos."""
        try:
            client = self._get_gemini()
            prompt = (
                "Does this image contain ONLY ONE MAIN GARMENT taking up most of the frame (like a product photo of a single t-shirt or pants), "
                "or does it contain a person wearing MULTIPLE GARMENTS (a full outfit, e.g. a shirt AND pants)? "
                "Reply with exactly one word: 'SINGLE' or 'MULTIPLE'."
            )
            model = getattr(self, "flash_model", "gemini-3.5-flash")
            resp = await client.vision(
                user_parts=[prompt, image_bytes],
                model=model,
                temperature=0.0,
                max_tokens=10,
            )
            return "single" in resp.lower()
        except Exception as exc:
            logger.warning("_is_single_item check failed: %s", repr(exc)[:160])
            return False

    async def _gatekeep_image(self, image_bytes: bytes) -> int:
        """Fast pre-check to count garments and route the pipeline."""
        import io
        import asyncio
        from PIL import Image, ImageOps
        try:
            # Resize image to tiny thumbnail (512x512) to make the Gemini upload extremely fast
            with Image.open(io.BytesIO(image_bytes)) as img:
                img = ImageOps.exif_transpose(img)
                img.thumbnail((512, 512))
                if img.mode != "RGB":
                    img = img.convert("RGB")
                out = io.BytesIO()
                img.save(out, format="JPEG", quality=80)
                small_bytes = out.getvalue()

            client = self._get_gemini()
            system_prompt = (
                "You are a visual gatekeeper. Your job is to count the number of distinct clothing garments, "
                "shoes, or accessories clearly visible in this image. "
                "Ignore tags, hangers, or background objects."
            )
            model = self.detect_model
            
            schema = {
                "type": "object",
                "properties": {
                    "items_seen": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Briefly list the clothing garments you see (e.g. ['yellow t-shirt'])"
                    },
                    "count": {
                        "type": "integer",
                        "description": "The final count of clothing items (0, 1, or more)"
                    }
                },
                "required": ["items_seen", "count"]
            }
            
            # Put a strict 12-second timeout so it never hangs the pipeline indefinitely,
            # but gives the LLM enough time to respond under load.
            async def _call_vision():
                return await client.vision(
                    system=system_prompt,
                    user_parts=["Analyze the image and return the count of garments.", small_bytes],
                    model=model,
                    response_mime_type="application/json",
                    response_schema=schema,
                )
                
            resp = await asyncio.wait_for(_call_vision(), timeout=12.0)
            
            try:
                import json
                clean_resp = resp.strip()
                if clean_resp.startswith("```json"):
                    clean_resp = clean_resp[7:]
                elif clean_resp.startswith("```"):
                    clean_resp = clean_resp[3:]
                if clean_resp.endswith("```"):
                    clean_resp = clean_resp[:-3]
                clean_resp = clean_resp.strip()
                
                data = json.loads(clean_resp)
                count = int(data.get("count", 2))
                logger.info("_gatekeep_image parsed successfully. Model: %s. Count: %d, Items seen: %s", model, count, data.get("items_seen"))
                return count
            except Exception as e:
                logger.warning("_gatekeep_image failed to parse JSON: %s. Raw response: %s", e, resp)
                return 2 # Fallback to SegFormer if unparseable
        except asyncio.TimeoutError:
            logger.warning("_gatekeep_image timed out after 12s, falling back to SegFormer")
            return 2
        except Exception as exc:
            import traceback
            logger.warning("_gatekeep_image check failed: %s\n%s", repr(exc)[:160], traceback.format_exc())
            return 2

    async def analyze_outfits_stream(
        self,
        images_bytes_list: list[bytes],
        *,
        max_items: int | None = None,
        language: str | None = None,
    ) -> "AsyncIterator[dict[str, Any]]":
        """Streaming end-to-end variant that accepts multiple photos.
        
        Runs detection and cropping on each photo concurrently, flattening all valid
        crops into a single batched Gemini call for maximum throughput.
        
        Yields the same NDJSON frame structure as ``analyze_outfit_stream``, but each
        crop in ``items_meta`` and each ``item`` frame includes an ``image_index`` field
        so the frontend can route the analysis back to the correct original photo.
        """
        if not images_bytes_list:
            yield {"type": "done", "count": 0}
            return

        cap = max_items if max_items is not None else self.max_items

        # 1. Detect on all photos concurrently
        async def _detect_and_crop(idx: int, img_bytes: bytes) -> tuple[int, list[tuple[dict[str, Any], bytes, str]]]:
            try:
                count = await self._gatekeep_image(img_bytes)
                if count == 0:
                    logger.info("Gatekeeper: photo %d has 0 garments — dropping it", idx)
                    return idx, []
                
                logger.info("Gatekeeper: photo %d has %d garment(s) — running SegFormer detect_items", idx, count)
                detections = await self.detect_items(img_bytes)
                if not detections and count == 1:
                    detections = [{"bbox": [0, 0, 1000, 1000], "kind": "garment", "label": "garment"}]
            except Exception as exc:
                logger.warning("analyze_outfits_stream: detect_items / gatekeep failed for idx %d: %s", idx, repr(exc)[:160])
                return idx, []

            try:
                if _looks_already_cropped(detections):
                    if detections:
                        best_det = max(
                            detections,
                            key=lambda d: (
                                max(0, d["bbox"][2] - d["bbox"][0])
                                * max(0, d["bbox"][3] - d["bbox"][1])
                            ),
                        )
                    else:
                        best_det = {"bbox": [0, 0, 1000, 1000], "kind": "garment", "label": "garment"}

                    det = {
                        "label": best_det.get("label") or "garment",
                        "kind": best_det.get("kind") or "garment",
                        "bbox": best_det.get("bbox", [0, 0, 1000, 1000]),
                        "defer_matte": False,
                    }
                    if settings.AUTO_MATTE_CROPS:
                        matted = await self._whole_image_matte(img_bytes)
                        if matted:
                            return idx, [(det, matted, "image/png")]
                    return idx, [(det, img_bytes, "image/jpeg")]

                useful = self._filter_useful_detections(detections, cap)
                if not useful:
                    best_det = {"bbox": [0, 0, 1000, 1000], "kind": "garment", "label": "garment"}
                    det = {
                        "label": "garment",
                        "kind": "garment",
                        "bbox": [0, 0, 1000, 1000],
                        "defer_matte": False,
                    }
                    if settings.AUTO_MATTE_CROPS:
                        matted = await self._whole_image_matte(img_bytes)
                        if matted:
                            return idx, [(det, matted, "image/png")]
                    return idx, [(det, img_bytes, "image/jpeg")]

                raw_crops = await asyncio.to_thread(self._bbox_crop_useful, img_bytes, useful)
                fast_crops = await asyncio.to_thread(_apply_fast_matte, raw_crops)
                
                final_crops = []
                for det, cbytes, mime in fast_crops:
                    det["defer_matte"] = False
                    if mime != "image/png" and settings.AUTO_MATTE_CROPS:
                        try:
                            from app.services import background_matting
                            matted = await background_matting.matte_crop(cbytes)
                            if matted:
                                cbytes = matted
                                mime = "image/png"
                        except Exception as exc:
                            logger.info("rembg crop matte failed: %s", exc)
                    final_crops.append((det, cbytes, mime))
                return idx, final_crops
            except Exception as exc:
                logger.warning("analyze_outfits_stream: crop/matte failed for idx %d: %s", idx, repr(exc)[:160])
                return idx, []

        # 1. Detect on all photos sequentially to avoid OOM on large batches
        results = []
        for i, b in enumerate(images_bytes_list):
            res = await _detect_and_crop(i, b)
            results.append(res)

        # Flatten crops and keep track of image indices
        flat_crops: list[tuple[int, dict[str, Any], bytes, str]] = []
        for idx, crops in results:
            for det, c_bytes, c_mime in crops:
                flat_crops.append((idx, det, c_bytes, c_mime))

        if not flat_crops:
            yield {
                "type": "error",
                "status": 422,
                "message": (
                    "We couldn't identify any garments in the provided photos. "
                    "Please try clearer, well-lit shots."
                ),
            }
            return

        # Emit the detect frame FIRST
        items_meta = []
        for idx, d, crop_b, crop_m in flat_crops:
            fitted_b, fitted_m = _fit_crop_to_card(crop_b, crop_mime=crop_m)
            items_meta.append({
                "image_index": idx,
                "label": d.get("label") or "garment",
                "kind": d.get("kind") or "garment",
                "bbox": d.get("bbox"),
                "crop_base64": base64.b64encode(fitted_b).decode("ascii"),
                "crop_mime": fitted_m,
                "defer_matte": d.get("defer_matte", False),
            })
        yield {"type": "detect", "count": len(flat_crops), "items_meta": items_meta}

        from app.config import settings as _settings
        from app.services import eyes_override as _eyes_override

        emitted = 0
        try:
            try:
                from app.services.reconstruction import should_reconstruct
            except Exception:
                should_reconstruct = None  # type: ignore[assignment]

            # Resolve provider so we can choose the right crop strategy.
            active_provider = (
                await _eyes_override.get_active_provider()
            ).lower()

            if active_provider == "gemma" and settings.EYES_GEMMA_SPACE_URL:
                # ── Patch M23: Gemma per-attribute sequential path ────────
                # On CPU, a single 2400-token call takes 82-111 s and hits
                # the Caddy idle-timeout.  Instead we send 5 focused
                # /predict calls (~10-22 s each) and stream each group's
                # result back to the client as a "field" NDJSON frame so
                # the form fills progressively while the next group runs.
                for slot_idx, (image_idx, det, c_bytes, c_mime) in enumerate(flat_crops):
                    shrunk = _shrink_for_vision(c_bytes)
                    b64 = base64.b64encode(shrunk).decode("ascii")
                    assembled: dict[str, Any] = {}

                    import uuid
                    request_id = str(uuid.uuid4())
                    async for grp_name, grp_fields, partial in call_gemma_space_stream_attributes(
                        image_b64_jpeg=b64,
                        language=language,
                        segformer_label=det.get("label"),
                        segformer_category=det.get("category"),
                        request_id=request_id,
                        id_slot=slot_idx,
                        is_single_item=det.get("is_single_item", False),
                    ):
                        assembled.update(partial)
                        if partial:  # only emit if the group produced data
                            yield {
                                "type": "field",
                                "index": slot_idx,
                                "image_index": image_idx,
                                "group": grp_name,
                                "fields": partial,
                            }

                    # Normalise / coerce the fully-assembled dict.
                    analysis = _coerce_single_garment(assembled)
                    if not analysis.get("title") and analysis.get("name"):
                        analysis["title"] = analysis["name"]
                    if not analysis.get("title"):
                        analysis["title"] = "Unnamed garment"
                    analysis = _coerce_enums(analysis)
                    analysis["provider_used"] = "gemma"
                    analysis["model_used"] = "gemma-4-e2b-q4_k_m"

                    # Record activity for the admin dashboard panel
                    provider_activity.record(
                        "garment-vision",
                        ok=True,
                        latency_ms=0,
                        extra={
                            "provider": "gemma",
                            "model": "gemma-4-e2b-q4_k_m",
                            "routing_source": "toggle",
                        },
                    )

                    needs_reconstruction = False
                    reasons: list[str] = []
                    if should_reconstruct is not None:
                        try:
                            needs, raw_reasons = should_reconstruct(
                                analysis, det.get("bbox")
                            )
                            if needs and _settings.DEFER_RECONSTRUCTION_ON_ANALYZE:
                                needs_reconstruction = True
                                reasons = list(raw_reasons)
                        except Exception as exc:  # noqa: BLE001
                            logger.warning(
                                "reconstruction gate failed (gemma) slot=%d: %s",
                                slot_idx, repr(exc)[:160],
                            )

                    yield {
                        "type": "item",
                        "index": slot_idx,
                        "image_index": image_idx,
                        "analysis": analysis,
                        "label": analysis.get("sub_category") or analysis.get("item_type"),
                        "needs_reconstruction": needs_reconstruction,
                        "reconstruction_reasons": reasons,
                    }
                    emitted += 1

            else:
                # ── Gemini concurrent path (unchanged) ────────────────────
                # Process all crops concurrently using individual analyze calls.
                # We cap concurrency to 6 to avoid overwhelming the LLM proxy
                # while maintaining very fast TTFB.
                sem = asyncio.Semaphore(6)

                async def _process_crop(
                    slot_idx: int,
                    crop_tuple: tuple[int, dict[str, Any], bytes, str],
                ) -> tuple[int, dict[str, Any]]:
                    image_idx, det, c_bytes, c_mime = crop_tuple
                    async with sem:
                        try:
                            analysis = await self.analyze(
                                c_bytes, language=language, think=False
                            )
                            return slot_idx, analysis
                        except Exception as exc:  # noqa: BLE001
                            err_str = str(exc)
                            if (
                                "API_KEY_SERVICE_BLOCKED" in err_str
                                or "PERMISSION_DENIED" in err_str
                                or "RESOURCE_EXHAUSTED" in err_str
                                or "API_KEY_INVALID" in err_str
                            ):
                                raise
                            logger.warning(
                                "analyze_outfits_stream: concurrent analyze failed slot=%d: %s",
                                slot_idx, repr(exc)[:160],
                            )
                            return slot_idx, {}

                tasks = [
                    asyncio.create_task(_process_crop(i, crop_tuple))
                    for i, crop_tuple in enumerate(flat_crops)
                ]

                for completed_task in asyncio.as_completed(tasks):
                    slot_idx, analysis = await completed_task
                    image_idx, det, c_bytes, c_mime = flat_crops[slot_idx]

                    needs_reconstruction = False
                    reasons: list[str] = []
                    if should_reconstruct is not None:
                        try:
                            needs, raw_reasons = should_reconstruct(
                                analysis, det.get("bbox")
                            )
                            if needs and _settings.DEFER_RECONSTRUCTION_ON_ANALYZE:
                                needs_reconstruction = True
                                reasons = list(raw_reasons)
                        except Exception as exc:  # noqa: BLE001
                            logger.warning(
                                "reconstruction gate failed (concurrent) slot=%d: %s",
                                slot_idx, repr(exc)[:160],
                            )

                    yield {
                        "type": "item",
                        "index": slot_idx,
                        "image_index": image_idx,
                        "analysis": analysis,
                        "label": analysis.get("sub_category") or analysis.get("item_type"),
                        "needs_reconstruction": needs_reconstruction,
                        "reconstruction_reasons": reasons,
                    }
                    emitted += 1

        except Exception as exc:
            err_text = repr(exc)
            logger.error(
                "analyze_outfits_stream: stream FAILED after %d emit(s): %s",
                emitted, err_text[:400],
            )
            low = err_text.lower()
            if "api_key_service_blocked" in low or "blocked" in low:
                msg = (
                    "Your Google API key is blocked for Generative Language API (API_KEY_SERVICE_BLOCKED). "
                    "Please enable 'Generative Language API' in Google Cloud Console or generate a key from Google AI Studio (aistudio.google.com)."
                )
                status = 403
            elif "permission_denied" in low or " 403" in low or "permission denied" in low:
                msg = "Garment analyzer: API rejected the request (403). Check your Gemini API key permissions."
                status = 403
            elif "unauthenticated" in low or " 401" in low:
                msg = "Garment analyzer: API rejected the key (401)."
                status = 401
            elif "resource_exhausted" in low or " 429" in low or "quota" in low or "spending cap" in low:
                msg = "Garment analyzer: Gemini quota or spend cap exhausted (429). Please check spend cap in Google AI Studio."
                status = 429
            elif "not_found" in low or " 404" in low or "model not found" in low:
                msg = "Garment analyzer: requested model is not available (404)."
                status = 404
            elif "deadline" in low or "timeout" in low or "timed out" in low:
                msg = "Garment analyzer: request timed out. Retry in a moment."
                status = 504
            elif " 500" in low or " 502" in low or " 503" in low or "internal" in low:
                msg = "Garment analyzer: server error. Retry in a moment."
                status = 503
            else:
                msg = "Garment analyzer hit a transient error. (debug: " + err_text[:160].replace("\n", " ") + ")"
                status = 503
            yield {"type": "error", "status": status, "message": msg}
            return

        yield {"type": "done", "count": emitted}


    # ──────────────────────────────────────────────────────────────────
    # Phase O.6 — single-pass pipeline
    # ──────────────────────────────────────────────────────────────────
    async def analyze_outfit_one_pass(
        self,
        image_bytes: bytes,
        *,
        max_items: int | None = None,
        language: str | None = None,
        think: bool = False,
    ) -> list[dict[str, Any]]:
        """End-to-end multi-item pipeline in a SINGLE Eyes call.

        **RETIRED (May 2026) — benchmark / experimentation use only.**
        The CCP-Ninja benchmark (``/app/scripts/run_eyes_benchmark.py``)
        showed Gemini-2.5-Flash will not emit multi-garment arrays
        reliably: on all 30 test images it returned exactly one garment
        per call, collapsing recall to ~10%. Three prompt rewrites did
        not move the dial. The function is kept here so the benchmark
        script and any future fine-tuned-Eyes experiments can still
        invoke it, but production now always calls :meth:`analyze_outfit`
        (SegFormer + per-crop Eyes), which scores ~0.71 mean IoU and
        ~0.41 recall on the same dataset. The closet ``/analyze`` route
        no longer reads ``EYES_ONE_PASS``.

        Sends the original photo straight to ``analyze(one_pass=True)``,
        which returns either a single garment object (already-cropped
        product photo) or an array of garment objects (multi-item
        outfit). Each garment carries a ``region.bbox`` on a 0..1000
        normalised grid; we crop the original image to each bbox to
        produce per-garment JPEGs that the frontend can render
        immediately.

        Output shape matches :meth:`analyze_outfit` exactly so the
        ``/closet/analyze`` endpoint can swap implementations without
        any contract change visible to the frontend::

            {
              "label": "Oxford shirt",
              "kind": "garment",
              "bbox": [ymin, xmin, ymax, xmax],   # 0..1000 normalised
              "crop_base64": "<base64 jpeg>",
              "crop_mime": "image/jpeg",
              "analysis": { ...GarmentAnalysis fields, region stripped... },
              "reconstruction_advised": bool,     # NEW — frontend CTA hint
              "one_pass": True,                   # NEW — debug breadcrumb
            }
        """
        t0 = time.perf_counter()
        try:
            parsed = await self.analyze(
                image_bytes,
                language=language,
                think=think,
                one_pass=True,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "one_pass analyze() failed (%s) \u2014 falling back to legacy "
                "analyze_outfit so the user still gets a result.",
                repr(exc)[:200],
            )
            return await self.analyze_outfit(
                image_bytes,
                max_items=max_items,
                language=language,
                think=think,
            )

        # Eyes is allowed to return either a single object (already-cropped
        # shot) or an array of objects (multi-item outfit). Normalise.
        if isinstance(parsed, list):
            garments = parsed
        elif isinstance(parsed, dict):
            garments = [parsed]
        else:
            logger.warning(
                "one_pass got %s (expected dict or list) \u2014 falling back",
                type(parsed).__name__,
            )
            return await self.analyze_outfit(
                image_bytes,
                max_items=max_items,
                language=language,
                think=think,
            )

        # Cap at ``max_items`` (matches legacy contract).
        cap = max_items if max_items is not None else self.max_items
        if cap and len(garments) > cap:
            logger.info(
                "one_pass: trimming %d garments down to max_items=%d",
                len(garments), cap,
            )
            garments = garments[:cap]

        items: list[dict[str, Any]] = []
        for g in garments:
            region = g.get("region") if isinstance(g, dict) else None
            bbox: list[int]
            is_full_frame = False
            if isinstance(region, dict) and isinstance(region.get("bbox"), list):
                bbox_in = region["bbox"]
                # Defensive clamp: schema enforces 0..1000 but a fallback
                # provider (Gemini direct) may emit slightly out-of-range.
                try:
                    ymin, xmin, ymax, xmax = [
                        max(0, min(1000, int(v))) for v in bbox_in
                    ]
                    if ymax <= ymin:
                        ymax = min(1000, ymin + 1)
                    if xmax <= xmin:
                        xmax = min(1000, xmin + 1)
                    bbox = [ymin, xmin, ymax, xmax]
                except Exception:
                    bbox = [0, 0, 1000, 1000]
                is_full_frame = bool(region.get("is_full_frame"))
            else:
                # Model omitted region — treat the whole frame as the bbox.
                bbox = [0, 0, 1000, 1000]
                is_full_frame = True

            # Crop. Reuse the same helper the legacy pipeline uses so the
            # padding/area-floor rules stay consistent across both paths.
            crop_bytes: bytes
            if is_full_frame or bbox == [0, 0, 1000, 1000]:
                crop_bytes = image_bytes
            else:
                # Patch 12j — pass the Gemini-assigned category so the
                # one-pass single-call path also benefits from the
                # per-edge padding budget. ``g.get("category")``
                # holds the Gemini answer (Top / Bottom / Outerwear /
                # Full Body / Footwear / Accessories) and
                # :func:`_resolve_bbox_pad_trbl_for_category` accepts
                # both that vocabulary and the SegFormer-kind
                # vocabulary case-insensitively.
                cropped = _crop_to_bbox(
                    image_bytes, bbox, category=g.get("category"),
                )
                # ``_crop_to_bbox`` returns None when the bbox is degenerate
                # or below the min-area floor. In those cases we still want
                # an item record \u2014 just fall back to the full frame so
                # the user sees the original photo as the thumbnail.
                crop_bytes = cropped[0] if cropped else image_bytes

            # Strip ``region`` from the analysis dict so the persisted
            # closet item card doesn't carry coordinates the rest of the
            # app doesn't know about. Bbox lives on the item, not in
            # ``analysis``.
            analysis = {k: v for k, v in g.items() if k != "region"}

            label = (
                analysis.get("item_type")
                or analysis.get("sub_category")
                or analysis.get("title")
                or "garment"
            )

            fitted_bytes, fitted_mime = _fit_crop_to_card(
                crop_bytes, crop_mime="image/jpeg",
            )
            items.append({
                "label": label,
                "kind": "garment",
                "bbox": bbox,
                "crop_base64": base64.b64encode(fitted_bytes).decode("ascii"),
                "crop_mime": fitted_mime,
                "analysis": analysis,
                # NEW \u2014 frontend reads this to decide whether to render
                # the opt-in "Repair photo" CTA (Phase 2 wires the actual
                # endpoint). Computed cheaply from existing analysis hints.
                "reconstruction_advised": _should_advise_reconstruction(
                    analysis, is_full_frame=is_full_frame,
                ),
                # Debug breadcrumb \u2014 dropped from prod responses by the
                # API layer if we want it hidden, but useful for the
                # diagnostic notebook and during the rollout.
                "one_pass": True,
            })

        dt_ms = int((time.perf_counter() - t0) * 1000)
        logger.info(
            "analyze_outfit_one_pass OK garments=%d full_frame=%s elapsed_ms=%d "
            "labels=%s",
            len(items),
            any(i["bbox"] == [0, 0, 1000, 1000] for i in items),
            dt_ms,
            [i["label"] for i in items][:8],
        )
        return items


def _should_advise_reconstruction(
    analysis: dict[str, Any], *, is_full_frame: bool,
) -> bool:
    """Cheap heuristic for the opt-in "Repair photo" CTA.

    Mirrors the existing ``should_reconstruct`` logic in
    ``services/reconstruction.py`` but works off ONLY the data the
    one-pass result carries (no SegFormer mask, no bbox-edge analysis),
    so the answer is a hint to the user, not an authoritative
    "this needs reconstruction" verdict.

    Returns True when the analysed garment is reported as ``used`` and
    the condition is below ``good``, OR when the photo wasn't already
    a clean single-frame shot \u2014 i.e. exactly the cases where users
    historically benefited from the Nano-Banana studio reshoot.
    """
    state = (analysis.get("state") or "").lower()
    condition = (analysis.get("condition") or "").lower()
    if state == "used" and condition in {"bad", "fair"}:
        return True
    # If we cropped out of a busy multi-item photo, the user might prefer
    # a clean studio version for the closet thumbnail.
    if not is_full_frame:
        return True
    return False


def _build_vision_service() -> GarmentVisionService | None:
    """Instantiate the service if *any* supported provider is available."""
    want_hf = settings.GARMENT_VISION_PROVIDER == "hf"
    want_gemini_analyze = settings.GARMENT_VISION_PROVIDER == "gemini"
    # ``hf`` provider points at a self-hosted llama.cpp / Modal /
    # Replicate endpoint over an OpenAI-compatible HTTP surface. The
    # gate is whether the explicit endpoint key is configured —
    # **never** an ``HF_TOKEN`` (sabotage line, see
    # quarantine/2026-05-sabotage/READ_THIS_FIRST.md).
    has_hf_endpoint = bool(settings.GARMENT_VISION_ENDPOINT_KEY)
    has_gemini_chat = bool(settings.gemini_chat_key)
    if want_hf and not has_hf_endpoint:
        logger.warning(
            "Garment vision disabled: provider=hf but "
            "GARMENT_VISION_ENDPOINT_KEY missing."
        )
        return None
    if want_gemini_analyze and not has_gemini_chat:
        logger.warning(
            "Garment vision disabled: provider=gemini but no Gemini chat key set "
            "(GEMINI_API_KEY)."
        )
        return None
    try:
        return GarmentVisionService()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Garment vision init failed: %s", exc)
        return None


garment_vision_service = _build_vision_service()


def get_garment_vision_service(
    user: dict[str, Any] | None = None,
    api_key: str | None = None,
) -> GarmentVisionService | None:
    """Return a GarmentVisionService instance scoped to the user's API key if available,
    falling back to the default process-wide service."""
    from app.services.auth import resolve_user_gemini_api_key, resolve_user_gemini_model
    effective_key = api_key or resolve_user_gemini_api_key(user)
    if effective_key:
        try:
            model = resolve_user_gemini_model(user) if user else "gemini-3.5-flash"
            return GarmentVisionService(api_key=effective_key, model=model)
        except Exception as exc:
            logger.warning("Failed to build user-scoped GarmentVisionService: %s", exc)
    return garment_vision_service
