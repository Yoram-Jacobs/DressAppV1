from __future__ import annotations
from __future__ import annotations
from .llm import EYES_JSON_SCHEMA, _GARMENT_OBJECT_SCHEMA, _call_gemma_space, _build_system_prompt, _language_directive, _user_prompt, _extract_json, DETECT_SYSTEM_PROMPT, _scan_complete_json_objects, _build_batch_prompts, GROUP_ANALYZE_SYSTEM_PROMPT, _LANG_NAMES, call_gemma_space_stream_attributes
from .image import _shrink_for_vision, _crop_to_bbox, _PHANTOM_DROP_PCT, _solid_alpha_coverage, _fit_crop_to_card, _apply_fast_matte, _create_batch_collage
from .geometry import _nms_detections, _is_unidentifiable, _looks_already_cropped, _iou_norm, _containment, _detect_human_presence
from .validation import (
    _coerce_single_garment,
    _coerce_enums,
    _enforce_segformer_category,
    resolve_garment_gender,
    is_distinctly_feminine_garment,
    is_distinctly_masculine_garment,
)

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


def _align_analyses_to_crops(
    slot_crop_list: list[tuple[int, tuple[int, dict[str, Any], bytes, str]]],
    parsed_items: list[dict[str, Any]],
) -> list[tuple[int, tuple[int, dict[str, Any], bytes, str], dict[str, Any] | None]]:
    """Align LLM-generated parsed_items to crops via semantic affinity bipartite matching.
    
    Prevents category swapping (e.g. Shoes receiving Belt metadata or vice versa)
    when the model outputs items in a different order than SegFormer detected them.
    """
    import numpy as np
    n_crops = len(slot_crop_list)
    n_items = len(parsed_items)
    if n_crops == 0:
        return []
    if n_items == 0:
        return [(slot_idx, crop_info, None) for slot_idx, crop_info in slot_crop_list]
    
    # Pre-extract normalized info for crops
    crop_data = []
    for sub_i, (slot_idx, (image_idx, det, c_bytes, c_mime)) in enumerate(slot_crop_list):
        cat = (det.get("category") or det.get("kind") or "").lower().strip()
        lbl = (det.get("label") or "").lower().strip()
        crop_data.append({
            "sub_i": sub_i,
            "slot_idx": slot_idx,
            "crop_info": (image_idx, det, c_bytes, c_mime),
            "category": cat,
            "label": lbl,
            "bbox": det.get("bbox") or [0, 0, 1000, 1000],
        })
    
    # Pre-extract normalized info for parsed items
    item_data = []
    for item_idx, item in enumerate(parsed_items):
        if not isinstance(item, dict):
            continue
        cat = (item.get("category") or "").lower().strip()
        sub = (item.get("sub_category") or "").lower().strip()
        itype = (item.get("item_type") or "").lower().strip()
        title = (item.get("title") or item.get("name") or "").lower().strip()
        caption = (item.get("caption") or "").lower().strip()
        all_text = f"{cat} {sub} {itype} {title} {caption}"
        slot_idx_hint = item.get("slot_index")
        if slot_idx_hint is None:
            slot_idx_hint = item.get("index") or item.get("item_index")
        item_data.append({
            "orig_idx": item_idx,
            "item": item,
            "category": cat,
            "sub_category": sub,
            "item_type": itype,
            "all_text": all_text,
            "slot_hint": slot_idx_hint,
        })
    
    if not item_data:
        return [(slot_idx, crop_info, None) for slot_idx, crop_info in slot_crop_list]

    scores = np.zeros((n_crops, len(item_data)), dtype=float)
    
    def _is_footwear(cat: str, lbl: str, all_text: str) -> bool:
        return (
            cat in ("footwear", "shoes", "shoe") or
            "shoe" in lbl or "boot" in lbl or "sneaker" in lbl or "sandal" in lbl or
            any(w in all_text for w in ("shoe", "sneaker", "boot", "sandal", "loafer", "heel", "oxford", "clog", "slide", "footwear"))
        )
    
    def _is_belt(cat: str, lbl: str, all_text: str) -> bool:
        return "belt" in lbl or "belt" in all_text
    
    def _is_bag(cat: str, lbl: str, all_text: str) -> bool:
        return "bag" in lbl or any(w in all_text for w in ("bag", "tote", "purse", "backpack", "clutch", "handbag", "crossbody"))
    
    def _is_glasses(cat: str, lbl: str, all_text: str) -> bool:
        return "sunglass" in lbl or "glass" in lbl or any(w in all_text for w in ("sunglass", "glasses", "shades", "eyewear"))
    
    def _is_accessory(cat: str, lbl: str, all_text: str) -> bool:
        return cat in ("accessory", "accessories") or _is_belt(cat, lbl, all_text) or _is_bag(cat, lbl, all_text) or _is_glasses(cat, lbl, all_text)
    
    def _is_top(cat: str, lbl: str, all_text: str) -> bool:
        return (
            cat in ("top", "outerwear") or
            any(w in lbl for w in ("upper", "top", "shirt", "jacket", "coat", "sweater", "blouse", "hoodie", "cardigan")) or
            any(w in all_text for w in ("shirt", "t-shirt", "top", "jacket", "coat", "sweater", "cardigan", "blouse", "hoodie", "polo", "tank"))
        )
    
    def _is_bottom(cat: str, lbl: str, all_text: str) -> bool:
        return (
            cat in ("bottom", "pants", "skirt") or
            any(w in lbl for w in ("pant", "skirt", "trouser", "jean", "short", "bottom")) or
            any(w in all_text for w in ("pant", "pants", "chinos", "trousers", "jeans", "shorts", "skirt", "leggings", "bottom", "culottes"))
        )
    
    def _is_headwear(cat: str, lbl: str, all_text: str) -> bool:
        return (
            cat in ("headwear", "hat") or
            "hat" in lbl or "cap" in lbl or
            any(w in all_text for w in ("hat", "cap", "beanie", "beret", "fedora"))
        )

    for i, c in enumerate(crop_data):
        c_cat, c_lbl = c["category"], c["label"]
        c_is_fw = _is_footwear(c_cat, c_lbl, "")
        c_is_belt = _is_belt(c_cat, c_lbl, "")
        c_is_bag = _is_bag(c_cat, c_lbl, "")
        c_is_glasses = _is_glasses(c_cat, c_lbl, "")
        c_is_acc = _is_accessory(c_cat, c_lbl, "")
        c_is_top = _is_top(c_cat, c_lbl, "")
        c_is_bot = _is_bottom(c_cat, c_lbl, "")
        c_is_head = _is_headwear(c_cat, c_lbl, "")
        
        for j, it in enumerate(item_data):
            i_text = it["all_text"]
            i_cat = it["category"]
            i_is_fw = _is_footwear(i_cat, "", i_text)
            i_is_belt = _is_belt(i_cat, "", i_text)
            i_is_bag = _is_bag(i_cat, "", i_text)
            i_is_glasses = _is_glasses(i_cat, "", i_text)
            i_is_acc = _is_accessory(i_cat, "", i_text)
            i_is_top = _is_top(i_cat, "", i_text)
            i_is_bot = _is_bottom(i_cat, "", i_text)
            i_is_head = _is_headwear(i_cat, "", i_text)
            
            score = 0.0
            # Strong specific accessory separation
            if c_is_belt and i_is_belt:
                score += 150.0
            elif c_is_belt and not i_is_belt:
                score -= 150.0
            elif not c_is_belt and i_is_belt:
                score -= 150.0

            if c_is_fw and i_is_fw:
                score += 150.0
            elif c_is_fw and not i_is_fw:
                score -= 150.0
            elif not c_is_fw and i_is_fw:
                score -= 150.0

            if c_is_bag and i_is_bag:
                score += 150.0
            elif c_is_bag and not i_is_bag:
                score -= 150.0

            if c_is_glasses and i_is_glasses:
                score += 150.0
            elif c_is_glasses and not i_is_glasses:
                score -= 150.0

            if c_is_top and i_is_top:
                score += 120.0
            elif c_is_top and (i_is_bot or i_is_fw):
                score -= 120.0

            if c_is_bot and i_is_bot:
                score += 120.0
            elif c_is_bot and (i_is_top or i_is_fw):
                score -= 120.0

            if c_is_head and i_is_head:
                score += 120.0

            # General category match
            if c_cat and i_cat and (c_cat in i_cat or i_cat in c_cat):
                score += 40.0

            # Model slot hint
            if it["slot_hint"] is not None:
                try:
                    if int(it["slot_hint"]) == i:
                        score += 35.0
                except (ValueError, TypeError):
                    pass

            # Same order tie-breaker
            if i == j:
                score += 10.0

            scores[i, j] = score

    matched_assignment: dict[int, int] = {}
    try:
        from scipy.optimize import linear_sum_assignment
        row_ind, col_ind = linear_sum_assignment(-scores)
        for r, c in zip(row_ind, col_ind):
            if scores[r, c] >= 0:
                matched_assignment[r] = c
    except Exception as assign_err:
        logger.warning("_align_analyses_to_crops linear_sum_assignment failed: %s", assign_err)
        used_cols = set()
        for r in range(n_crops):
            best_c = None
            best_val = -float("inf")
            for c in range(len(item_data)):
                if c not in used_cols and scores[r, c] > best_val:
                    best_val = scores[r, c]
                    best_c = c
            if best_c is not None and best_val >= 0:
                matched_assignment[r] = best_c
                used_cols.add(best_c)

    out = []
    for i, c in enumerate(crop_data):
        item_raw = None
        if i in matched_assignment:
            col = matched_assignment[i]
            item_raw = item_data[col]["item"]
            logger.info(
                "_align_analyses_to_crops: Crop %d (slot %d, label='%s', cat='%s') matched item %d ('%s', cat='%s', score=%.1f)",
                i, c["slot_idx"], c["label"], c["category"], col,
                item_raw.get("title") or item_raw.get("name"), item_raw.get("category"), scores[i, col]
            )
        else:
            logger.warning(
                "_align_analyses_to_crops: Crop %d (slot %d, label='%s', cat='%s') had no positive semantic match",
                i, c["slot_idx"], c["label"], c["category"]
            )
        out.append((c["slot_idx"], c["crop_info"], item_raw))
    return out


def _match_batch_entry_to_slot(
    entry: dict[str, Any],
    kind_hints: list[str | None] | None,
    available_slots: set[int],
    default_idx: int,
) -> int:
    """Map a parsed batch entry to its best-matching crop slot using slot hints & semantic affinity."""
    if not available_slots:
        return default_idx

    slot_hint = entry.get("slot_index")
    if slot_hint is None:
        slot_hint = entry.get("index")

    # If slot_hint is valid int and directly in available_slots
    if isinstance(slot_hint, int) and slot_hint in available_slots:
        hint = (kind_hints[slot_hint] if (kind_hints and slot_hint < len(kind_hints) and kind_hints[slot_hint]) else "").lower()
        sub = (entry.get("sub_category") or entry.get("item_type") or entry.get("name") or "").lower()
        cat = (entry.get("category") or "").lower()
        nm = (entry.get("name") or entry.get("title") or "").lower()
        all_text = f"{cat} {sub} {nm}"

        is_fw = any(w in all_text for w in ("shoe", "boot", "sneaker", "footwear", "sandal", "heel", "loafer", "clog", "slide"))
        is_belt = "belt" in all_text
        is_sunglasses = any(w in all_text for w in ("sunglass", "glasses", "shades", "eyewear"))
        is_bag = any(w in all_text for w in ("bag", "tote", "purse", "backpack", "clutch", "handbag"))

        conflict = False
        if is_fw and any(w in hint for w in ("belt", "bag", "top", "upper", "bottom", "pants", "skirt")):
            conflict = True
        elif is_belt and any(w in hint for w in ("shoe", "footwear", "top", "upper", "bottom", "pants", "skirt")):
            conflict = True
        elif is_sunglasses and any(w in hint for w in ("shoe", "footwear", "top", "upper", "bottom", "pants", "skirt")):
            conflict = True
        elif is_bag and any(w in hint for w in ("shoe", "footwear", "top", "upper", "bottom", "pants", "skirt")):
            conflict = True

        if not conflict:
            return slot_hint

    # Otherwise, score all available slots
    sub = (entry.get("sub_category") or entry.get("item_type") or entry.get("name") or "").lower()
    cat = (entry.get("category") or "").lower()
    nm = (entry.get("name") or entry.get("title") or "").lower()
    all_text = f"{cat} {sub} {nm}"

    best_slot = min(available_slots)
    best_score = -999.0

    for s in sorted(available_slots):
        score = 0.0
        hint = (kind_hints[s] if (kind_hints and s < len(kind_hints) and kind_hints[s]) else "").lower()

        # Category/hint alignment
        if any(w in all_text for w in ("shoe", "boot", "sneaker", "footwear", "sandal", "heel", "loafer")) and any(w in hint for w in ("shoe", "boot", "footwear", "sneaker")):
            score += 120.0
        elif "belt" in all_text and ("belt" in hint or "acc" in hint):
            score += 120.0
        elif any(w in all_text for w in ("sunglass", "glasses", "shades")) and ("sunglass" in hint or "acc" in hint):
            score += 120.0
        elif any(w in all_text for w in ("bag", "tote", "purse", "backpack", "handbag")) and ("bag" in hint or "acc" in hint):
            score += 120.0
        elif any(w in all_text for w in ("top", "shirt", "blouse", "sweater", "jacket", "coat", "hoodie", "cardigan")) and any(w in hint for w in ("top", "upper")):
            score += 100.0
        elif any(w in all_text for w in ("bottom", "pants", "skirt", "jeans", "shorts", "trousers")) and any(w in hint for w in ("bottom", "pants", "skirt")):
            score += 100.0

        if isinstance(slot_hint, int) and s == slot_hint:
            score += 30.0

        if s == default_idx:
            score += 5.0

        if score > best_score:
            best_score = score
            best_slot = s

    return best_slot


class GarmentVisionService:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        provider: str | None = None,
        user_gender: str | None = None,
    ) -> None:
        self.user_gender = resolve_garment_gender(user_gender)
        # We tolerate a missing EMERGENT_LLM_KEY if HF is configured for
        # both analysis AND detection. In practice we keep Gemini Flash
        # for detection, so both keys are typically required.
        # If provider is not explicitly passed, provider=None enables dynamic
        # DB-backed runtime resolution via eyes_override.get_active_provider().
        self.provider = provider
        if self.provider == "gemini":
            self.model = model if (model and model.lower().startswith("gemini")) else "gemini-3.5-flash-lite"
        elif self.provider:
            self.model = model or settings.GARMENT_VISION_MODEL or "Eyes v1"
        else:
            self.model = model or "gemini-3.5-flash-lite"
        # Detection stays on Gemini Flash until we upgrade to a fine-tuned vision model.
        self.detect_provider = settings.GARMENT_VISION_DETECT_PROVIDER
        self.detect_model = (
            model if (model and model.lower().startswith("gemini"))
            else (settings.GARMENT_VISION_DETECT_MODEL or "gemini-3.5-flash-lite")
        )
        # Per-crop analyser (multi-item pipeline).
        self.crop_model = (
            model if (model and model.lower().startswith("gemini"))
            else (settings.GARMENT_VISION_CROP_MODEL or "gemini-3.5-flash-lite")
        )
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
        self, image_bytes: bytes, *, count_hint: int | None = None,
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

            parser_items = await clothing_parser.parse_garments(image_bytes, count_hint=count_hint)
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
                "category": p["category"],
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
                "_global_human_mask": p.get("_global_human_mask"),
                "has_human_head": p.get("has_human_head", False),
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

        _NON_FASHION_KEYWORDS = frozenset({
            "bottle", "water bottle", "cup", "mug", "flask", "tumbler", "can",
            "phone", "smartphone", "iphone", "cellphone", "camera", "food",
            "drink", "coffee", "beverage", "laptop", "tablet", "book", "keys",
            "wallet", "furniture", "chair", "table", "umbrella", "groceries",
            "pet", "dog", "cat",
        })

        clean: list[dict[str, Any]] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            bbox = it.get("bbox")
            label = (it.get("label") or "garment").strip().lower()
            kind = (it.get("kind") or "garment").strip().lower()
            if any(k in label or k in kind for k in _NON_FASHION_KEYWORDS):
                logger.info("detect_items: ignoring non-fashion item '%s' (kind=%s)", label, kind)
                continue
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

    async def detect_items(
        self, image_bytes: bytes, *, count_hint: int | None = None,
    ) -> list[dict[str, Any]]:
        """Return a list of ``{label, kind, bbox}`` entries.

        Tries the commercial-safe clothing parser first (sayeed99/segformer_b3_clothes).
        If SegFormer returns detections, we keep its pixel-accurate per-class masks.
        When Gatekeeper or detection hints at missed garments/accessories (e.g. bags,
        sunglasses, jewelry that SegFormer's 18 classes miss or under-detect), we query
        the Gemini bbox detector and merge any non-overlapping candidate items.
        """
        parser_hits = await self._detect_via_clothing_parser(image_bytes, count_hint=count_hint)
        gemini_hits: list[dict[str, Any]] = []

        should_query_gemini = (not parser_hits) or (
            count_hint is not None and count_hint > len(parser_hits)
        )
        if should_query_gemini:
            try:
                gemini_hits = await self._detect_via_gemini(image_bytes)
            except Exception as exc:  # noqa: BLE001
                logger.info("detect_items: Gemini detection fallback skipped: %s", exc)

        if parser_hits and gemini_hits:
            merged: list[dict[str, Any]] = list(parser_hits)
            _NON_FASHION_KEYWORDS = frozenset({
                "bottle", "water bottle", "cup", "mug", "flask", "tumbler", "can",
                "phone", "smartphone", "iphone", "cellphone", "camera", "food",
                "drink", "coffee", "beverage", "laptop", "tablet", "book", "keys",
                "wallet", "furniture", "chair", "table", "umbrella", "groceries",
                "pet", "dog", "cat",
            })
            global_human = next(
                (p.get("_global_human_mask") or p.get("_human_mask_full") for p in parser_hits if (p.get("_global_human_mask") is not None or p.get("_human_mask_full") is not None)),
                None,
            )
            has_head = any(p.get("has_human_head", False) for p in parser_hits)
            for gd in gemini_hits:
                g_bbox = gd.get("bbox")
                g_label = (gd.get("label") or "garment").lower()
                g_kind = (gd.get("kind") or "garment").lower()
                if any(k in g_label or k in g_kind for k in _NON_FASHION_KEYWORDS):
                    continue
                covered = False
                for sh in parser_hits:
                    s_bbox = sh.get("bbox")
                    s_kind = (sh.get("kind") or "garment").lower()
                    iou = _iou_norm(g_bbox, s_bbox)
                    contain = _containment(g_bbox, s_bbox)
                    # If high IoU or high containment with matching garment kind, it's already covered
                    if iou >= 0.40 or (
                        contain >= 0.70
                        and (
                            s_kind == g_kind
                            or (
                                s_kind in {"dress", "top", "bottom"}
                                and g_kind in {"dress", "top", "bottom"}
                            )
                        )
                    ):
                        covered = True
                        break
                if not covered:
                    merged.append({
                        "label": gd.get("label") or "garment",
                        "kind": gd.get("kind") or "garment",
                        "category": gd.get("kind") or "garment",
                        "bbox": g_bbox,
                        "score": 0.90,
                        "mask": None,
                        "_human_mask_full": global_human,
                        "_global_human_mask": global_human,
                        "has_human_head": has_head,
                        "source": "gemini",
                    })
            before = len(merged)
            clean = _nms_detections(merged)
            logger.info(
                "detect_items OK model=segformer+gemini count=%d (nms removed %d) labels=%s",
                len(clean),
                before - len(clean),
                [c["label"] for c in clean][:8],
            )
            return clean

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

        if not gemini_hits:
            gemini_hits = await self._detect_via_gemini(image_bytes)
        before = len(gemini_hits)
        clean = _nms_detections(gemini_hits)
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
        user_gender: str | None = None,
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

        eff_gender = resolve_garment_gender(user_gender) or self.user_gender

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
            _build_system_prompt(one_pass=one_pass, user_gender=eff_gender)
            + _language_directive(language)
        )
        user_text = _user_prompt(language, user_gender=eff_gender)

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
        elif self.provider:
            resolved = self.provider.strip().lower()
            routing_source = "instance"
        else:
            resolved = (await eyes_override.get_active_provider()).lower()
            routing_source = "toggle"

        raw: str | None = None
        used_provider: str = resolved
        gemma_model = model if (model and "gemini" not in model.lower()) else "garment_vision"
        used_model: str = gemma_model if resolved in ("gemma", "dressapp") else (model or self.model)
        used_fallback: bool = False
        fallback_reason: str | None = None

        # 2) Gemma path (toggle says gemma AND a Space URL is configured).
        if resolved in ("gemma", "dressapp") and settings.EYES_GEMMA_SPACE_URL:
            t0 = time.perf_counter()
            try:
                raw = await _call_gemma_space(
                    system_prompt=system_prompt,
                    user_text=user_text,
                    image_b64_jpeg=b64,
                    # Thinking is explicitly disabled in the prompt and proxy,
                    # so garment JSON is cleanly produced in ~350 tokens.
                    # 500 tokens guarantees fast CPU execution (<25s).
                    max_tokens=500,
                    timeout=settings.EYES_GEMMA_TIMEOUT_S,
                    json_schema=EYES_JSON_SCHEMA,
                    think=think,
                    model=gemma_model,
                )
                provider_activity.record(
                    "garment-vision",
                    ok=True,
                    latency_ms=int((time.perf_counter() - t0) * 1000),
                    extra={
                        "provider": "gemma",
                        "model": gemma_model,
                        "routing_source": routing_source,
                    },
                )
                used_provider = "gemma"
                used_model = gemma_model
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
                    "Gemma Space unavailable (%s) — falling back to Gemini.",
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
                if settings.EYES_GEMMA_SPACE_URL and used_provider != "gemma":
                    logger.info("No Gemini API key provided; falling back to platform Gemma Eyes")
                    raw = await _call_gemma_space(
                        system_prompt=system_prompt,
                        user_text=user_text,
                        image_b64_jpeg=b64,
                        max_tokens=500,
                        timeout=settings.EYES_GEMMA_TIMEOUT_S,
                        json_schema=EYES_JSON_SCHEMA,
                        think=think,
                        model=model or self.model or "garment_vision",
                    )
                    used_provider = "gemma"
                    used_model = model or self.model or "garment_vision"
                else:
                    raise RuntimeError(
                        "Gemini Eyes path requires GEMINI_API_KEY to be set "
                        "(see /app/backend/.env)."
                    )
            else:
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
                    exc_str = str(exc).lower()
                    is_quota = (
                        "resource_exhausted" in exc_str
                        or "429" in exc_str
                        or "quota" in exc_str
                        or "spending cap" in exc_str
                    )
                    if is_quota and settings.EYES_GEMMA_SPACE_URL:
                        logger.warning(
                            "Custom provider hit quota / 429 (%s); falling back to platform Gemma Eyes",
                            repr(exc)[:200],
                        )
                        raw = await _call_gemma_space(
                            system_prompt=system_prompt,
                            user_text=user_text,
                            image_b64_jpeg=b64,
                            max_tokens=500,
                            timeout=settings.EYES_GEMMA_TIMEOUT_S,
                            json_schema=EYES_JSON_SCHEMA,
                            think=think,
                            model=model or self.model or "garment_vision",
                        )
                        used_provider = "gemma"
                        used_model = model or self.model or "garment_vision"
                        used_fallback = True
                        fallback_reason = repr(exc)[:200]
                        ok = True
                    else:
                        raise
                finally:
                    extra: dict[str, Any] = {
                        "provider": used_provider,
                        "model": used_model,
                        "routing_source": routing_source,
                    }
                    if used_fallback:
                        extra["fallback_from"] = "gemini" if used_provider == "gemma" else "gemma"
                        extra["fallback_reason"] = fallback_reason
                    provider_activity.record(
                        "garment-vision",
                        ok=ok,
                        latency_ms=int((time.perf_counter() - t0) * 1000),
                        error=last_err if not ok else None,
                        extra=extra,
                    )
                if not used_fallback:
                    used_provider = "gemini"
                    used_model = gemini_model

        # 4) Parse + sanitise. Eyes v3 (Gemma 4) may return a JSON array
        #    when the crop contains multiple garments; collapse to first.
        parsed = _coerce_single_garment(_extract_json(raw or ""), user_gender=eff_gender, language=language)
        if not parsed.get("title") and parsed.get("name"):
            parsed["title"] = parsed["name"]
        if not parsed.get("title"):
            parsed["title"] = "Unnamed garment"
        parsed = _coerce_enums(parsed, user_gender=eff_gender)
        parsed["provider_used"] = used_provider
        parsed["model_used"] = used_model
        if used_fallback:
            is_quota_fb = bool(
                fallback_reason and any(q in fallback_reason.lower() for q in ("429", "quota", "resource_exhausted", "spending cap"))
            )
            parsed["provider_fallback"] = {
                "from": "gemini" if used_provider == "gemma" else "gemma",
                "to": used_provider,
                "reason": fallback_reason,
                "quota_exhausted": is_quota_fb,
            }
            parsed["fallback_from_quota"] = is_quota_fb
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
        
        group_model = getattr(self, "model", "gemini-3.5-flash-lite")
        try:
            raw = await gem.vision(
                system=system_prompt,
                user_parts=[user_text] + shrunk_list,
                model=group_model,
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
                extra={"provider": "gemini", "model": group_model},
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

    async def _whole_image_matte(
        self,
        image_bytes: bytes,
        detections: list[dict[str, Any]] | None = None,
    ) -> bytes | None:
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
                try:
                    from app.services.background_matting import drop_disconnected_islands
                    result = drop_disconnected_islands(result, min_area_ratio=0.01)
                except Exception as exc:
                    logger.debug("_whole_image_matte island filter failed: %s", exc)
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
        user_gender: str | None = None,
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
            matted = await self._whole_image_matte(image_bytes, detections=detections)
            if matted:
                crop_bytes = matted
                crop_mime = "image/png"

        eff_gender = resolve_garment_gender(user_gender) or self.user_gender
        single = await self.analyze(
            image_bytes, language=language, think=think, user_gender=eff_gender,
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
            
            human_full = det.get("_human_mask_full")
            if human_full is not None and img_size is not None and not is_single_item:
                human_bbox = clothing_parser.slice_mask_to_bbox(
                    human_full, img_size, box_px
                )
                if human_bbox is not None:
                    det["_human_mask_bbox"] = human_bbox

            # Sliced union of all OTHER garments' masks in multi-item photos
            if not is_single_item and len(useful) > 1 and img_size is not None:
                other_masks = [d["mask"] for d in useful if d is not det and d.get("mask") is not None]
                if other_masks:
                    try:
                        other_full = _np.maximum.reduce(other_masks)
                        other_bbox = clothing_parser.slice_mask_to_bbox(
                            other_full, img_size, box_px
                        )
                        if other_bbox is not None and bool(other_bbox.any()):
                            det["_other_mask_bbox"] = other_bbox
                    except Exception as _exc:  # noqa: BLE001
                        pass

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
        import numpy as _np

        matted_crops: list[tuple[dict[str, Any], bytes, str]] = []
        for det, cbytes, mime in raw_crops:
            try:
                matted = await background_matting.matte_crop(cbytes)
            except Exception as exc:  # noqa: BLE001
                logger.info(
                    "auto-matte failed for %s: %s — checking mask fallback",
                    det.get("label"),
                    repr(exc)[:120],
                )
                matted = None

            seg_mask_bbox = det.get("_mask_bbox")
            human_mask_bbox = det.get("_human_mask_bbox")
            other_mask_bbox = det.get("_other_mask_bbox")
            is_single = det.get("is_single_item", False)

            m_cov = _solid_alpha_coverage(matted) if matted else None
            norm_seg_u8 = _cp._normalize_mask_to_u8(seg_mask_bbox) if seg_mask_bbox is not None else None
            seg_mask_pixels = 0
            seg_mask_cov = 0.0
            if norm_seg_u8 is not None and bool(norm_seg_u8.any()):
                seg_mask_pixels = int(_np.sum(norm_seg_u8 > 50))
                seg_mask_cov = float(_np.mean(norm_seg_u8 > 50))

            # Detect rembg collapse:
            # Rembg collapsed if it returned None, OR if SegFormer found a confident garment (>= 20 px)
            # but rembg returned < 2% solid alpha or lost > 70% of SegFormer's garment mass.
            rembg_collapsed = bool(
                not matted
                or (
                    seg_mask_pixels >= 20
                    and (
                        m_cov is None
                        or m_cov < 0.02
                        or (m_cov < 0.30 * seg_mask_cov)
                    )
                )
            )

            if rembg_collapsed:
                if norm_seg_u8 is not None and seg_mask_pixels >= 20:
                    # Use SegFormer semantic mask directly to produce an alpha cutout!
                    # Smooth with anti-aliasing Gaussian blur so edges are clean and not blocky.
                    try:
                        from PIL import Image, ImageFilter
                        import io
                        im = Image.open(io.BytesIO(cbytes)).convert("RGBA")
                        Hc, Wc = im.size[1], im.size[0]
                        if norm_seg_u8.shape != (Hc, Wc):
                            mask_res = _np.array(Image.fromarray(norm_seg_u8, mode="L").resize((Wc, Hc), Image.BILINEAR))
                        else:
                            mask_res = norm_seg_u8
                        if human_mask_bbox is not None and bool(human_mask_bbox.any()):
                            norm_human = _cp._normalize_mask_to_u8(human_mask_bbox)
                            if norm_human.shape != (Hc, Wc):
                                human_res = _np.array(Image.fromarray(norm_human, mode="L").resize((Wc, Hc), Image.BILINEAR))
                            else:
                                human_res = norm_human
                            mask_res = _np.where(human_res > 120, _np.uint8(0), mask_res)
                        alpha_im = Image.fromarray(mask_res, mode="L").filter(ImageFilter.GaussianBlur(radius=1.2))
                        im.putalpha(alpha_im)
                        buf = io.BytesIO()
                        im.save(buf, format="PNG", optimize=True)
                        matted = buf.getvalue()
                        mime = "image/png"
                        logger.info(
                            "reconstructed alpha cutout from SegFormer mask for %s (pixels=%d, cov=%.3f)",
                            det.get("label"), seg_mask_pixels, seg_mask_cov,
                        )
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("SegFormer alpha synthesis failed for %s: %s", det.get("label"), exc)
                        matted = None

                if not matted:
                    # If we have human mask or other garments mask, excise them from cbytes so human parts don't leak
                    if (human_mask_bbox is not None and bool(human_mask_bbox.any())) or (other_mask_bbox is not None and bool(other_mask_bbox.any())):
                        try:
                            from PIL import Image, ImageFilter
                            import io
                            im = Image.open(io.BytesIO(cbytes)).convert("RGBA")
                            Hc, Wc = im.size[1], im.size[0]
                            cut_alpha = _np.full((Hc, Wc), 255, dtype=_np.uint8)
                            if human_mask_bbox is not None and bool(human_mask_bbox.any()):
                                norm_human = _cp._normalize_mask_to_u8(human_mask_bbox)
                                if norm_human.shape != (Hc, Wc):
                                    human_res = _np.array(Image.fromarray(norm_human, mode="L").resize((Wc, Hc), Image.BILINEAR))
                                else:
                                    human_res = norm_human
                                cut_alpha = _np.where(human_res > 120, _np.uint8(0), cut_alpha)
                            if other_mask_bbox is not None and bool(other_mask_bbox.any()):
                                norm_other = _cp._normalize_mask_to_u8(other_mask_bbox)
                                if norm_other.shape != (Hc, Wc):
                                    other_res = _np.array(Image.fromarray(norm_other, mode="L").resize((Wc, Hc), Image.BILINEAR))
                                else:
                                    other_res = norm_other
                                cut_alpha = _np.where(other_res > 120, _np.uint8(0), cut_alpha)
                            alpha_im = Image.fromarray(cut_alpha, mode="L").filter(ImageFilter.GaussianBlur(radius=1.2))
                            im.putalpha(alpha_im)
                            buf = io.BytesIO()
                            im.save(buf, format="PNG", optimize=True)
                            matted = buf.getvalue()
                            mime = "image/png"
                        except Exception:
                            matted = None

                if not matted:
                    det.pop("_mask_bbox", None)
                    det.pop("_human_mask_bbox", None)
                    det.pop("_other_mask_bbox", None)
                    matted_crops.append((det, cbytes, mime))
                    continue

            if not rembg_collapsed and not is_single and (
                seg_mask_bbox is not None
                or human_mask_bbox is not None
                or other_mask_bbox is not None
            ):
                try:
                    refined = _cp.apply_alpha_intersection(
                        matted,
                        seg_mask_bbox,
                        category=det.get("kind"),
                        label=det.get("label"),
                        human_mask=human_mask_bbox,
                        other_mask=other_mask_bbox,
                        is_single_item=is_single,
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

            # Phantom guard — verify that the matte has solid garment pixels.
            # Small items (sunglasses, belts, footwear) legitimately occupy < 5% of their crop box.
            # Drop near-empty phantom masks to prevent 50x scaled ghost artifacts.
            cov = _solid_alpha_coverage(matted)
            cat_kind = (det.get("kind") or det.get("category") or "").lower()
            lbl_kind = (det.get("label") or "").lower()
            if "sunglass" in lbl_kind or "glass" in lbl_kind or "eyewear" in cat_kind or cat_kind == "accessory":
                effective_phantom_pct = 0.001  # 0.1%
            elif cat_kind == "footwear" or "shoe" in lbl_kind:
                effective_phantom_pct = 0.002  # 0.2%
            else:
                effective_phantom_pct = 0.005  # 0.5%

            if cov is not None and cov < effective_phantom_pct:
                logger.info(
                    "_matte_crops: dropping phantom item %s (coverage %.3f%% < %.3f%%)",
                    det.get("label"),
                    cov * 100.0,
                    effective_phantom_pct * 100.0,
                )
                continue

            if matted:
                try:
                    from app.services.background_matting import drop_disconnected_islands
                    matted = drop_disconnected_islands(matted, min_area_ratio=0.01)
                except Exception as exc:
                    logger.debug("_matte_crops island filter failed: %s", exc)

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
        user_gender: str | None = None,
        model_gender: str | None = None,
    ) -> dict[str, Any] | None:
        """Analyse a single crop + (optionally) reconstruct.

        Returns ``None`` when the per-crop analyse call fails so the
        caller can drop it silently — one bad crop shouldn't kill the
        whole outfit response.
        """
        eff_gender = resolve_garment_gender(user_gender) or self.user_gender
        norm_mg = resolve_garment_gender(model_gender)
        async with sem:
            try:
                analysis = await self.analyze(
                    crop_bytes,
                    model=self.crop_model,
                    language=language,
                    think=think,
                    user_gender=norm_mg or eff_gender,
                )
                # Patch M21 — Apply SegFormer-anchored category
                # enforcement on the per-crop path too, so any caller
                # of ``_analyse_one_crop`` (per-crop loop, batched-
                # failure fallback, single-item analyze) gets the same
                # category sanity check as the batched paths.
                _enforce_segformer_category(
                    analysis,
                    segformer_kind=det.get("kind"),
                    label=det.get("label"),
                    is_single_item=det.get("is_single_item", False),
                    language=language,
                )
                if norm_mg in ("men", "women"):
                    analysis["gender"] = norm_mg
                    _coerce_enums(analysis, user_gender=eff_gender, model_gender=norm_mg)
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
        user_gender: str | None = None,
        model_gender: str | None = None,
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

        eff_gender = resolve_garment_gender(user_gender) or self.user_gender
        norm_mg = resolve_garment_gender(model_gender)

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
                    crop_bytes_list, language=language, kind_hints=kind_hints, user_gender=eff_gender, model_gender=norm_mg,
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
            results = await self._build_batched_results(crops, batched_analyses, model_gender=norm_mg)
        else:
            sem = asyncio.Semaphore(6)
            results = await asyncio.gather(
                *[
                    self._analyse_one_crop(d, b, m, language, sem, think=think, user_gender=eff_gender, model_gender=norm_mg)
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
        *,
        model_gender: str | None = None,
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

        norm_mg = resolve_garment_gender(model_gender)
        out: list[dict[str, Any] | None] = []
        for (det, crop_bytes, crop_mime), analysis in zip(crops, analyses):
            if not isinstance(analysis, dict):
                # Defensive: batched parser may have returned a non-dict
                # for one slot — treat as if that slot failed and skip.
                out.append(None)
                continue
            if norm_mg in ("men", "women"):
                analysis["gender"] = norm_mg
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
        user_gender: str | None = None,
        model_gender: str | None = None,
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
        * fine-tune is single-image only and the Eyes toggle never
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

        eff_gender = resolve_garment_gender(user_gender) or self.user_gender
        norm_mg = resolve_garment_gender(model_gender)

        # streaming paths emit equivalent prompts.
        system_prompt, user_text = _build_batch_prompts(
            n=n, language=language, kind_hints=kind_hints, user_gender=eff_gender, model_gender=norm_mg,
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
                norm = _coerce_single_garment(entry, user_gender=eff_gender, model_gender=norm_mg, language=language)
                if not norm.get("title") and norm.get("name"):
                    norm["title"] = norm["name"]
                if not norm.get("title"):
                    norm["title"] = "Unnamed garment"
                norm = _coerce_enums(norm, user_gender=eff_gender, model_gender=norm_mg)
                if norm_mg in ("men", "women"):
                    norm["gender"] = norm_mg
                # Patch M21 — Layer 2 SegFormer-anchored category
                # enforcement. Applied AFTER ``_coerce_enums`` so we
                # only override values that survived enum coercion.
                if kind_hints and slot_idx < len(kind_hints):
                    _enforce_segformer_category(
                        norm,
                        segformer_kind=kind_hints[slot_idx],
                        label=norm.get("name") or norm.get("title"),
                        language=language,
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
        user_gender: str | None = None,
        model_gender: str | None = None,
    ) -> "AsyncIterator[tuple[int, dict[str, Any]]]":
        """Patch M19 — Streaming variant of :meth:`analyze_batch`.

        Yields ``(index, normalised_analysis)`` tuples as Gemini emits
        each complete object in the JSON array, so the caller can push
        per-item results to the frontend as they arrive instead of
        waiting for the full N-element response.
        """
        n = len(crops_bytes)
        if n == 0:
            return
        if not self.api_key:
            raise RuntimeError(
                "analyze_batch_stream: requires GEMINI_API_KEY"
            )

        eff_gender = resolve_garment_gender(user_gender) or self.user_gender
        norm_mg = resolve_garment_gender(model_gender)

        # Native google-genai streaming. Builds the same system prompt /
        # user-text payload that ``analyze_batch`` uses (delegating to
        # :func:`_build_batch_prompts` keeps both batched paths in
        # lock-step), then drives ``client.stream_vision`` for
        # incremental JSON deltas.
        system_prompt, user_text = _build_batch_prompts(
            n=n, language=language, kind_hints=kind_hints, user_gender=eff_gender, model_gender=norm_mg,
        )

        user_parts: list[Any] = [user_text]
        for i, b in enumerate(crops_bytes):
            hint_txt = f" (hint: {kind_hints[i]})" if (kind_hints and i < len(kind_hints) and kind_hints[i]) else ""
            user_parts.append(f"Image {i + 1} of {n} (index [{i}]{hint_txt}):")
            user_parts.append(_shrink_for_vision(b))

        gem = self._get_gemini()

        t0 = time.perf_counter()
        emitted = 0
        ok = False
        last_err: str | None = None
        try:
            text_buf = ""
            scan_pos = 0
            available_slots = set(range(n))
            incoming_idx = 0
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
                    slot = _match_batch_entry_to_slot(
                        raw_entry, kind_hints, available_slots, default_idx=incoming_idx
                    )
                    available_slots.discard(slot)
                    incoming_idx += 1
                    try:
                        norm = _coerce_single_garment(raw_entry, user_gender=eff_gender, model_gender=norm_mg, language=language)
                        if not norm.get("title") and norm.get("name"):
                            norm["title"] = norm["name"]
                        if not norm.get("title"):
                            norm["title"] = "Unnamed garment"
                        norm = _coerce_enums(norm, user_gender=eff_gender, model_gender=norm_mg)
                        if norm_mg in ("men", "women"):
                            norm["gender"] = norm_mg
                        elif not eff_gender and norm.get("gender") in ("men", "women"):
                            eff_gender = norm.get("gender")

                        if kind_hints and slot < len(kind_hints):
                            _enforce_segformer_category(
                                norm,
                                segformer_kind=kind_hints[slot],
                                label=norm.get("name") or norm.get("title"),
                                language=language,
                            )
                        norm["provider_used"] = "gemini"
                        norm["model_used"] = self.crop_model
                        norm["_batched"] = True
                        norm["_streamed"] = True
                    except Exception as exc:  # noqa: BLE001
                        logger.warning(
                            "analyze_batch_stream: dropping bad entry for slot %d: %s",
                            slot, repr(exc)[:160],
                        )
                        norm = {}
                    yield (slot, norm)
                    emitted += 1
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
        # Emit empty dict for any missing/unassigned slots so caller can run fallback
        for s in sorted(available_slots):
            yield (s, {})
            emitted += 1

    async def analyze_outfit(
        self, image_bytes: bytes, *, max_items: int | None = None,
        language: str | None = None,
        think: bool = False,
        user_gender: str | None = None,
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
        eff_gender = resolve_garment_gender(user_gender) or self.user_gender
        # 1) Detect. Soft-fail to single-image analysis on error.
        try:
            detections = await self.detect_items(image_bytes)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "detect_items failed (%s); falling back to single analysis",
                repr(exc)[:160],
            )
            detections = []

        has_human_wearer = _detect_human_presence(detections)
        photo_model_gender = None
        if has_human_wearer:
            photo_model_gender = await self.detect_model_gender(image_bytes, detections=detections)

        # 2) Fast-path: already-cropped product photo.
        is_single = (
            (not has_human_wearer and len(detections) <= 1)
            or _looks_already_cropped(detections)
        )
        if is_single:
            res = await self._handle_already_cropped(
                image_bytes, detections, language, think=think, user_gender=photo_model_gender or eff_gender,
            )
            if photo_model_gender in ("men", "women"):
                for it in res:
                    if isinstance(it, dict) and "analysis" in it and isinstance(it["analysis"], dict):
                        it["analysis"]["gender"] = photo_model_gender
                        _coerce_enums(it["analysis"], user_gender=eff_gender, model_gender=photo_model_gender)
            return res

        # 3) Filter + cap detections.
        cap = max_items if max_items is not None else self.max_items
        useful = self._filter_useful_detections(detections, cap)
        if not useful:
            single = await self.analyze(
                image_bytes, language=language, think=think, user_gender=photo_model_gender or eff_gender,
            )
            if photo_model_gender in ("men", "women") and isinstance(single, dict):
                single["gender"] = photo_model_gender
                _coerce_enums(single, user_gender=eff_gender, model_gender=photo_model_gender)
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
            fast_crops = await asyncio.to_thread(_apply_fast_matte, raw_crops)
            crops = []
            for det, cbytes, mime in fast_crops:
                det["defer_matte"] = False
                if mime != "image/png":
                    try:
                        from app.services import background_matting
                        matted = await background_matting.matte_crop(cbytes)
                        if matted:
                            cbytes = matted
                            mime = "image/png"
                    except Exception as exc:
                        logger.info("rembg crop matte failed: %s", exc)
                crops.append((det, cbytes, mime))
        else:
            for det, _, _ in raw_crops:
                det["defer_matte"] = False
            crops = raw_crops

        if not crops:
            # Every crop was rejected (tiny / invalid bbox).
            single = await self.analyze(
                image_bytes, language=language, think=think, user_gender=eff_gender,
            )
            return [
                self._build_fullframe_item(
                    single, image_bytes, defer_matte=settings.AUTO_MATTE_CROPS
                )
            ]

        # 6) Analyse each crop in parallel.
        items = await self._analyse_crops(crops, language, think=think, user_gender=eff_gender, model_gender=photo_model_gender)

        # 7) If every parallel call failed, fall back once.
        if not items:
            single = await self.analyze(image_bytes, think=think, user_gender=photo_model_gender or eff_gender)
            if photo_model_gender in ("men", "women") and isinstance(single, dict):
                single["gender"] = photo_model_gender
                _coerce_enums(single, user_gender=eff_gender, model_gender=photo_model_gender)
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
        cutout_only: bool = False,
        user_gender: str | None = None,
        **kwargs: Any,
    ) -> "AsyncIterator[dict[str, Any]]":
        """Streaming end-to-end multi-garment ingestion for a single image.

        Enforces GarmentVision Rule 1 (Multi-Item Single-Prompt Ingestion)
        and Rule 3 (single system prompt sequence) by delegating directly
        to analyze_outfits_stream with a single-image list.
        """
        async for frame in self.analyze_outfits_stream(
            [image_bytes],
            max_items=max_items,
            language=language,
            cutout_only=cutout_only,
            user_gender=user_gender,
            **kwargs,
        ):
            yield frame

    async def _is_single_item(self, image_bytes: bytes) -> bool:
        """Fast pre-check to bypass Owl-ViT for single-item photos."""
        try:
            client = self._get_gemini()
            prompt = (
                "Does this image contain ONLY ONE MAIN GARMENT taking up most of the frame (like a product photo of a single t-shirt or pants), "
                "or does it contain a person wearing MULTIPLE GARMENTS (a full outfit, e.g. a shirt AND pants)? "
                "Reply with exactly one word: 'SINGLE' or 'MULTIPLE'."
            )
            model = getattr(self, "flash_model", "gemini-3.5-flash-lite")
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

    async def _gatekeep_image(self, image_bytes: bytes) -> tuple[int | None, str | None]:
        """Fast pre-check to count garments and determine human model presence and gender.

        Local SegFormer handles detection, segmentation, and human presence in ~100ms.
        Returns (None, None) so downstream relies on local SegFormer and executes
        one unified system prompt for the entire photo batch.
        """
        return None, None

    async def detect_model_gender(
        self,
        image_bytes: bytes,
        detections: list[dict[str, Any]] | None = None,
    ) -> str | None:
        """Determine the apparent gender ('men' or 'women') of the human model in a photo.

        Returns 'men', 'women', or None if no human model is present.
        """
        from .validation import resolve_garment_gender
        if detections is not None and len(detections) <= 1 and not _detect_human_presence(detections):
            return None

        import io
        import asyncio
        from PIL import Image, ImageOps
        small_bytes = None
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                img = ImageOps.exif_transpose(img)
                img.thumbnail((512, 512))
                if img.mode != "RGB":
                    img = img.convert("RGB")
                out = io.BytesIO()
                img.save(out, format="JPEG", quality=80)
                small_bytes = out.getvalue()
        except Exception as prep_exc:
            logger.info("detect_model_gender: image prep failed: %s", repr(prep_exc)[:120])

        if self.api_key and small_bytes:
            try:
                client = self._get_gemini()
                system_prompt = (
                    "You are a fashion analyst. Analyze whether a human model or person is visible wearing the outfit in this photo.\n"
                    "If a human model is present, determine their apparent gender ('men' or 'women').\n"
                    "If no human person/model is wearing the clothes (e.g. flat lay, hanger, product-only photo), respond with 'none'."
                )
                schema = {
                    "type": "object",
                    "properties": {
                        "has_human_model": {"type": "boolean"},
                        "model_gender": {"type": "string", "enum": ["men", "women", "none"]},
                    },
                    "required": ["has_human_model", "model_gender"],
                }
                resp = await asyncio.wait_for(
                    client.vision(
                        system=system_prompt,
                        user_parts=["Analyze the wearer's gender.", small_bytes],
                        model=self.detect_model,
                        response_mime_type="application/json",
                        response_schema=schema,
                    ),
                    timeout=10.0,
                )
                parsed = _extract_json(resp or "")
                if isinstance(parsed, dict) and parsed.get("has_human_model"):
                    mg = resolve_garment_gender(parsed.get("model_gender"))
                    if mg in ("men", "women"):
                        logger.info("detect_model_gender (Gemini): detected model_gender=%s", mg)
                        return mg
            except Exception as exc:
                logger.info("detect_model_gender: Gemini check failed: %s", repr(exc)[:120])


        if detections:
            cat_labels = {
                (d.get("label") or d.get("category") or "").lower()
                for d in detections
            }
            if any(k in cat_labels for k in ("skirt", "dress")):
                return "women"

        return None

    async def analyze_outfits_stream(
        self,
        images_bytes_list: list[bytes],
        *,
        max_items: int | None = None,
        language: str | None = None,
        cutout_only: bool = False,
        user_gender: str | None = None,
        **kwargs: Any,
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

        logger.info(
            "analyze_outfits_stream: starting stream for %d photo(s), provider=%s",
            len(images_bytes_list),
            self.provider,
        )

        eff_gender = resolve_garment_gender(user_gender) or self.user_gender
        cap = max_items if max_items is not None else self.max_items

        # 1. Detect on all photos sequentially
        async def _detect_and_crop(idx: int, img_bytes: bytes) -> tuple[int, list[tuple[dict[str, Any], bytes, str]]]:
            count = None
            photo_model_gender = None
            try:
                detections = await self.detect_items(img_bytes)
                if not detections:
                    detections = [{"bbox": [0, 0, 1000, 1000], "kind": "garment", "label": "garment"}]
            except Exception as exc:
                logger.warning("analyze_outfits_stream: detect_items failed for idx %d: %s", idx, repr(exc)[:160])
                return idx, [({"bbox": [0, 0, 1000, 1000], "kind": "garment", "label": "garment", "is_single_item": True, "_photo_model_gender": photo_model_gender}, img_bytes, "image/jpeg")]

            try:
                has_human_wearer = _detect_human_presence(detections)
                if detections and has_human_wearer:
                    cat_labels = {
                        (d.get("label") or d.get("category") or "").lower()
                        for d in detections
                    }
                    has_fem_cue = any(
                        is_distinctly_feminine_garment(d.get("category"), d.get("label"), d.get("label"))
                        for d in detections
                    ) or any(k in cat_labels for k in (
                        "skirt", "dress", "sandal", "sandals", "blouse", "heels", "crop", "halter",
                        "camisole", "flats", "slip dress", "peplum", "ruffle", "floral",
                        "handbag", "purse", "clutch", "tote bag", "shoulder bag", "crossbody bag",
                        "skinny jeans", "jeggings", "leggings", "bag",
                    )) or any(w in str(d.get("label", "")).lower() for d in detections for w in (
                        "sandal", "skirt", "dress", "blouse", "heel", "handbag", "purse", "clutch",
                    ))
                    has_masc_cue = any(
                        is_distinctly_masculine_garment(d.get("category"), d.get("label"), d.get("label"))
                        for d in detections
                    ) or any(k in cat_labels for k in ("boxers", "tuxedo"))
                    if has_fem_cue:
                        photo_model_gender = "women"
                    elif has_masc_cue:
                        photo_model_gender = "men"

                is_footwear_only = bool(
                    detections
                    and not has_human_wearer
                    and all(
                        (d.get("category") or d.get("kind") or "").lower() in ("footwear", "shoes", "sandals", "sneakers", "boots", "floppers", "clogs", "slides")
                        for d in detections
                    )
                )

                top_dets = [
                    d for d in detections
                    if any(k in f"{d.get('category') or ''} {d.get('kind') or ''} {d.get('label') or ''}".lower()
                           for k in ("top", "upper", "shirt", "jacket", "blazer", "coat", "sweater", "dress", "hoodie", "cardigan", "blouse", "suit", "vest", "t-shirt", "tee"))
                ]
                bottom_dets = [
                    d for d in detections
                    if any(k in f"{d.get('category') or ''} {d.get('kind') or ''} {d.get('label') or ''}".lower()
                           for k in ("bottom", "pant", "trousers", "skirt", "jean", "short", "legging", "chinos", "trouser", "sweatpant", "jogger", "slack"))
                ]
                shoe_dets = [
                    d for d in detections
                    if any(k in f"{d.get('category') or ''} {d.get('kind') or ''} {d.get('label') or ''}".lower()
                           for k in ("footwear", "shoe", "sandal", "sneaker", "boot", "loafer", "heel", "clog", "slide", "flopper", "flip-flop", "mule", "pump", "oxford", "derby", "monk"))
                ]

                has_multi_body_zones = bool(
                    (top_dets and bottom_dets and min(d["bbox"][0] for d in top_dets) < min(d["bbox"][0] for d in bottom_dets))
                    or (bottom_dets and shoe_dets and min(d["bbox"][0] for d in bottom_dets) < min(d["bbox"][0] for d in shoe_dets))
                    or (top_dets and shoe_dets and min(d["bbox"][0] for d in top_dets) < min(d["bbox"][0] for d in shoe_dets))
                )

                same_zone_or_category = False
                if not has_human_wearer and not has_multi_body_zones and detections and len(detections) <= 2:
                    det_cats = {
                        (d.get("category") or d.get("kind") or "garment").lower()
                        for d in detections
                    }
                    clothing_cats = det_cats & {"top", "bottom", "dress", "outerwear", "footwear"}
                    if len(clothing_cats) <= 1:
                        same_zone_or_category = True
                    elif (bool(top_dets) + bool(bottom_dets) + bool(shoe_dets)) <= 1:
                        same_zone_or_category = True

                is_single = (
                    not has_multi_body_zones
                    and (
                        (count is not None and count <= 1 and not has_human_wearer)
                        or is_footwear_only
                        or same_zone_or_category
                        or _looks_already_cropped(detections, count_hint=count)
                    )
                )
                if (count is None or count <= 1 or is_footwear_only) and is_single:
                    if detections:
                        ymin = min(d["bbox"][0] for d in detections)
                        xmin = min(d["bbox"][1] for d in detections)
                        ymax = max(d["bbox"][2] for d in detections)
                        xmax = max(d["bbox"][3] for d in detections)
                        union_bbox = [ymin, xmin, ymax, xmax]
                        best_det = max(
                            detections,
                            key=lambda d: (
                                max(0, d["bbox"][2] - d["bbox"][0])
                                * max(0, d["bbox"][3] - d["bbox"][1])
                            ),
                        )
                    else:
                        union_bbox = [0, 0, 1000, 1000]
                        best_det = {"bbox": union_bbox, "kind": "garment", "label": "garment"}

                    det = {
                        "label": "Shoes" if is_footwear_only else (best_det.get("label") or "garment"),
                        "kind": "footwear" if is_footwear_only else (best_det.get("kind") or "garment"),
                        "category": "footwear" if is_footwear_only else (best_det.get("category") or best_det.get("kind") or "garment"),
                        "bbox": union_bbox,
                        "defer_matte": False,
                        "is_single_item": True,
                        "_photo_model_gender": photo_model_gender,
                        "_raw_image_bytes": img_bytes,
                        "_raw_image_mime": "image/jpeg",
                    }
                    if settings.AUTO_MATTE_CROPS:
                        matted = await self._whole_image_matte(img_bytes, detections=detections)
                        if matted:
                            return idx, [(det, matted, "image/png")]
                    return idx, [(det, img_bytes, "image/jpeg")]

                useful = self._filter_useful_detections(detections, cap)
                if not useful:
                    best_det = {"bbox": [0, 0, 1000, 1000], "kind": "garment", "label": "garment"}
                    det = {
                        "label": "garment",
                        "kind": "garment",
                        "category": "garment",
                        "bbox": [0, 0, 1000, 1000],
                        "defer_matte": False,
                        "is_single_item": True,
                        "_photo_model_gender": photo_model_gender,
                        "_raw_image_bytes": img_bytes,
                        "_raw_image_mime": "image/jpeg",
                    }
                    if settings.AUTO_MATTE_CROPS:
                        matted = await self._whole_image_matte(img_bytes, detections=detections)
                        if matted:
                            return idx, [(det, matted, "image/png")]
                    return idx, [(det, img_bytes, "image/jpeg")]

                has_human = _detect_human_presence(detections)
                is_single = (count is None or count <= 1) and len(useful) <= 1 and not has_human
                for d in useful:
                    d["is_single_item"] = is_single
                    d["_photo_model_gender"] = photo_model_gender

                raw_crops = await asyncio.to_thread(
                    self._bbox_crop_useful, img_bytes, useful, is_single_item=is_single
                )
                if settings.AUTO_MATTE_CROPS:
                    final_crops = await self._matte_crops(raw_crops)
                else:
                    final_crops = raw_crops

                is_final_single = (count is None or count <= 1) and len(final_crops) <= 1 and not has_human
                for i_c, (det, cbytes, mime) in enumerate(final_crops):
                    det["defer_matte"] = False
                    det["is_single_item"] = is_final_single
                    det["_photo_model_gender"] = photo_model_gender
                    if "_raw_image_bytes" not in det:
                        raw_b = raw_crops[i_c][1] if i_c < len(raw_crops) else cbytes
                        det["_raw_image_bytes"] = raw_b
                        det["_raw_image_mime"] = "image/jpeg"
                return idx, final_crops

            except Exception as exc:
                logger.warning("analyze_outfits_stream: crop/matte failed for idx %d: %s", idx, repr(exc)[:160])
                return idx, [({"bbox": [0, 0, 1000, 1000], "kind": "garment", "label": "garment", "is_single_item": True, "_photo_model_gender": photo_model_gender}, img_bytes, "image/jpeg")]

        # 1. Detect on all photos sequentially to avoid OOM on large batches
        import gc
        results = []
        for i, b in enumerate(images_bytes_list):
            res = await _detect_and_crop(i, b)
            results.append(res)
            gc.collect()

        # Flatten crops and keep track of image indices
        flat_crops: list[tuple[int, dict[str, Any], bytes, str]] = []
        for idx, crops in results:
            for det, c_bytes, c_mime in crops:
                flat_crops.append((idx, det, c_bytes, c_mime))
        if len(flat_crops) == 1 and not flat_crops[0][1].get("has_human_head") and flat_crops[0][1].get("is_single_item") is not False:
            flat_crops[0][1]["is_single_item"] = True
        del results
        gc.collect()

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
        if cutout_only:
            logger.info("analyze_outfits_stream: cutout_only is True — returning after detect frame")
            yield {"type": "done", "count": len(flat_crops)}
            return

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
                self.provider if self.provider in ("gemma", "gemini")
                else await _eyes_override.get_active_provider()
            ).lower()

            if active_provider in ("gemma", "dressapp") and settings.EYES_GEMMA_SPACE_URL:
                # Build ONE static system prompt for the entire batch to preserve llama-server KV-cache prefix
                batch_system_prompt = _build_system_prompt(one_pass=False, user_gender=eff_gender)

                # Pre-scan detections across photos to detect human model gender (Strict 3-Tier Hierarchy)
                photo_model_genders: dict[int, str] = {}
                from collections import defaultdict
                photo_fem_cues: dict[int, list[str]] = defaultdict(list)
                photo_masc_cues: dict[int, list[str]] = defaultdict(list)
                photo_has_model: dict[int, bool] = defaultdict(bool)

                for slot_idx, (image_idx, det, c_bytes, c_mime) in enumerate(flat_crops):
                    has_human = bool(
                        det.get("has_human_head")
                        or det.get("has_human_skin")
                        or det.get("_photo_model_gender") in ("women", "men")
                    )
                    if has_human:
                        photo_has_model[image_idx] = True

                    if det.get("_photo_model_gender") == "women":
                        photo_fem_cues[image_idx].append("det_women")
                    elif det.get("_photo_model_gender") == "men":
                        photo_masc_cues[image_idx].append("det_men")

                    lbl = (det.get("label") or "").lower()
                    cat = (det.get("category") or det.get("kind") or "").lower()
                    if is_distinctly_feminine_garment(cat, lbl, lbl):
                        photo_fem_cues[image_idx].append("fem_garment")
                    elif is_distinctly_masculine_garment(cat, lbl, lbl):
                        photo_masc_cues[image_idx].append("masc_garment")

                all_img_indices = set(idx for idx, _, _, _ in flat_crops)
                for img_i in all_img_indices:
                    if photo_has_model.get(img_i):
                        if photo_fem_cues.get(img_i):
                            photo_model_genders[img_i] = "women"
                        elif photo_masc_cues.get(img_i):
                            photo_model_genders[img_i] = "men"

                # Progressive streaming loop for each crop in flat_crops:
                # 1. Clean cutout image composited onto pure white background via _shrink_for_vision(c_bytes)
                # 2. Streams fields progressively
                # 3. Emits 'item' frame immediately as each garment analysis finishes
                for slot_idx, (image_idx, det, c_bytes, c_mime) in enumerate(flat_crops):
                    item_mg = photo_model_genders.get(image_idx) or det.get("_photo_model_gender")
                    # Clean cutout on pure white background
                    shrunk = _shrink_for_vision(c_bytes)
                    b64 = base64.b64encode(shrunk).decode("ascii")
                    assembled: dict[str, Any] = {}
                    import uuid
                    request_id = str(uuid.uuid4())
                    gemma_failed = False
                    try:
                        async for grp_name, grp_fields, partial in call_gemma_space_stream_attributes(
                            image_b64_jpeg=b64,
                            language=language,
                            segformer_label=det.get("label"),
                            segformer_category=det.get("category"),
                            request_id=request_id,
                            id_slot=slot_idx,
                            is_single_item=det.get("is_single_item", False),
                            user_gender=item_mg or eff_gender,
                            model_gender=item_mg,
                            system_prompt=batch_system_prompt,
                        ):
                            assembled.update(partial)
                            if partial:
                                yield {
                                    "type": "field",
                                    "index": slot_idx,
                                    "image_index": image_idx,
                                    "group": grp_name,
                                    "fields": partial,
                                }
                    except Exception as gemma_exc:
                        logger.warning(
                            "Gemma stream attributes failed for slot %d: %s; falling back to Gemini",
                            slot_idx, repr(gemma_exc)[:160],
                        )
                        gemma_failed = True

                    if gemma_failed or not assembled or len(assembled) < 2:
                        try:
                            gem_analysis = await self.analyze(
                                c_bytes, language=language, think=False, provider="gemini", user_gender=item_mg or eff_gender,
                            )
                            if isinstance(gem_analysis, dict) and gem_analysis:
                                assembled = gem_analysis
                        except Exception as gem_exc:
                            logger.error("Gemini fallback also failed for slot %d: %s", slot_idx, gem_exc)

                    if not assembled.get("category"):
                        assembled["category"] = (det.get("category") or det.get("kind") or "Top").capitalize()
                    if not assembled.get("sub_category") and not assembled.get("item_type"):
                        fallback_type = (det.get("label") or det.get("kind") or "garment").lower()
                        assembled["item_type"] = fallback_type
                        assembled["sub_category"] = fallback_type.capitalize()
                    if not assembled.get("title") and (det.get("label") or det.get("kind")):
                        assembled["title"] = (det.get("label") or det.get("kind")).capitalize()

                    has_human = bool(det.get("has_human_head") or det.get("has_human_skin") or photo_has_model.get(image_idx))
                    model_g = assembled.get("model_gender") or item_mg
                    if not model_g and has_human:
                        if assembled.get("gender") == "women" or assembled.get("model_gender") == "women" or is_distinctly_feminine_garment(
                            assembled.get("category"), assembled.get("sub_category"), assembled.get("item_type"),
                            name=assembled.get("name"), full_text=f"{assembled.get('title', '')} {assembled.get('caption', '')}",
                            pattern=assembled.get("pattern"),
                        ):
                            model_g = "women"
                        elif assembled.get("gender") == "men" or assembled.get("model_gender") == "men":
                            model_g = "men"

                    if model_g in ("men", "women"):
                        assembled["model_gender"] = model_g
                        assembled["gender"] = model_g
                        photo_model_genders[image_idx] = model_g

                    # Robust taxonomy defaults for zero-token auxiliary fields
                    assembled.setdefault("condition", "used")
                    assembled.setdefault("quality_tier", "good")
                    assembled.setdefault("price_tier", "mid")
                    assembled.setdefault("fit_style", "regular")
                    assembled.setdefault("clothing_condition", "Good")
                    if not assembled.get("fabric_materials"):
                        cat_k = (assembled.get("category") or "").lower()
                        sub_k = (assembled.get("sub_category") or "").lower()
                        full_desc = f"{assembled.get('name', '')} {assembled.get('title', '')} {assembled.get('caption', '')}".lower()
                        if cat_k == "footwear":
                            assembled["fabric_materials"] = [{"name": "Leather", "pct": 70}, {"name": "Rubber", "pct": 30}]
                        elif "jeans" in sub_k or "denim" in sub_k:
                            assembled["fabric_materials"] = [{"name": "Cotton", "pct": 98}, {"name": "Elastane", "pct": 2}]
                        elif "sweat" in sub_k or "jogger" in sub_k or "track" in sub_k:
                            assembled["fabric_materials"] = [{"name": "Cotton", "pct": 80}, {"name": "Polyester", "pct": 20}]
                        elif "bag" in sub_k or cat_k == "accessories":
                            assembled["fabric_materials"] = [{"name": "Leather", "pct": 100}] if "leather" in full_desc else [{"name": "Canvas", "pct": 80}, {"name": "Polyester", "pct": 20}]
                        elif "jacket" in sub_k or "coat" in sub_k or cat_k == "outerwear":
                            if "leather" in full_desc:
                                assembled["fabric_materials"] = [{"name": "Leather", "pct": 100}]
                            elif any(w in full_desc for w in ("wool", "trench", "blazer", "suit")):
                                assembled["fabric_materials"] = [{"name": "Wool", "pct": 70}, {"name": "Polyester", "pct": 30}]
                            else:
                                assembled["fabric_materials"] = [{"name": "Polyester", "pct": 70}, {"name": "Cotton", "pct": 30}]
                        elif any(w in full_desc for w in ("silk", "satin", "chiffon", "blouse")):
                            assembled["fabric_materials"] = [{"name": "Silk", "pct": 100}] if "silk" in full_desc else [{"name": "Viscose", "pct": 60}, {"name": "Polyester", "pct": 40}]
                        elif any(w in full_desc for w in ("knit", "sweater", "cardigan")):
                            assembled["fabric_materials"] = [{"name": "Wool", "pct": 80}, {"name": "Polyamide", "pct": 20}]
                        else:
                            assembled["fabric_materials"] = [{"name": "Cotton", "pct": 100}]
                    if not assembled.get("care_instructions"):
                        assembled["care_instructions"] = ["Machine wash cold", "Line dry"]

                    analysis = _coerce_single_garment(assembled, user_gender=eff_gender, model_gender=model_g, language=language)
                    if not analysis.get("title") and analysis.get("name"):
                        analysis["title"] = analysis["name"]
                    if not analysis.get("title"):
                        analysis["title"] = "Unnamed garment"
                    analysis = _coerce_enums(analysis, user_gender=eff_gender, model_gender=model_g)
                    if model_g in ("men", "women"):
                        analysis["gender"] = model_g
                    _enforce_segformer_category(
                        analysis,
                        segformer_kind=det.get("kind") or det.get("category"),
                        label=det.get("label"),
                        is_single_item=det.get("is_single_item", False),
                        language=language,
                    )
                    analysis["provider_used"] = assembled.get("provider_used", "gemma")
                    analysis["model_used"] = assembled.get("model_used", "gemma-4-e2b-q4_k_m")

                    if _is_unidentifiable(analysis):
                        logger.info("analyze_outfits_stream: skipping unidentifiable/non-clothing item at slot %d (%s)", slot_idx, analysis.get("title"))
                        yield {
                            "type": "item_skip",
                            "index": slot_idx,
                            "image_index": image_idx,
                            "reason": "non_clothing",
                        }
                        continue

                    needs_reconstruction = False
                    reasons: list[str] = []
                    if should_reconstruct is not None:
                        try:
                            needs, raw_reasons = should_reconstruct(analysis, det.get("bbox"))
                            if needs and _settings.DEFER_RECONSTRUCTION_ON_ANALYZE:
                                needs_reconstruction = True
                                reasons = list(raw_reasons)
                        except Exception:
                            pass

                    yield {
                        "type": "field",
                        "index": slot_idx,
                        "image_index": image_idx,
                        "group": "category",
                        "fields": {
                            "category": analysis.get("category"),
                            "sub_category": analysis.get("sub_category"),
                            "item_type": analysis.get("item_type"),
                            "title": analysis.get("title"),
                        },
                    }

                    meta_crop = items_meta[slot_idx] if slot_idx < len(items_meta) else {}
                    yield {
                        "type": "item",
                        "index": slot_idx,
                        "image_index": image_idx,
                        "analysis": analysis,
                        "crop_base64": meta_crop.get("crop_base64"),
                        "crop_mime": meta_crop.get("crop_mime", "image/png"),
                        "label": analysis.get("sub_category") or analysis.get("item_type"),
                        "needs_reconstruction": needs_reconstruction,
                        "reconstruction_reasons": reasons,
                    }
                    emitted += 1

            else:
                # ── Gemini batched path (single system prompt for whole batch) ──
                # Run the system prompt ONCE for the whole batch sequence!
                # Uses analyze_batch_stream to feed all crops in flat_crops to
                # Gemini with a single system prompt, streaming back each garment.
                if len(flat_crops) == 1:
                    slot_idx = 0
                    image_idx, det, c_bytes, c_mime = flat_crops[0]
                    item_mg = det.get("_photo_model_gender")
                    raw_for_vision = c_bytes
                    try:
                        analysis = await self.analyze(
                            raw_for_vision, language=language, think=False, user_gender=item_mg or eff_gender
                        )
                        if isinstance(analysis, dict):
                            _enforce_segformer_category(
                                analysis,
                                segformer_kind=det.get("kind") or det.get("category"),
                                label=det.get("label"),
                                is_single_item=det.get("is_single_item", False),
                                language=language,
                            )
                            if not analysis.get("title") and analysis.get("name"):
                                analysis["title"] = analysis["name"]
                            if not analysis.get("title") and (det.get("label") or det.get("kind")):
                                analysis["title"] = (det.get("label") or det.get("kind")).capitalize()
                            if not analysis.get("item_type") and not analysis.get("sub_category"):
                                fallback_type = (det.get("label") or det.get("kind") or "garment").lower()
                                analysis["item_type"] = fallback_type
                                analysis["sub_category"] = fallback_type.capitalize()
                            if item_mg in ("men", "women"):
                                analysis["gender"] = item_mg
                            analysis = _coerce_single_garment(analysis, user_gender=eff_gender, model_gender=item_mg, language=language)
                            analysis = _coerce_enums(analysis, user_gender=eff_gender, model_gender=item_mg)
                            if item_mg in ("men", "women"):
                                analysis["gender"] = item_mg
                    except Exception as exc:
                        err_str = str(exc)
                        is_quota = (
                            "RESOURCE_EXHAUSTED" in err_str
                            or "429" in err_str
                            or "quota" in err_str.lower()
                            or "spending cap" in err_str.lower()
                        )
                        analysis = None
                        if is_quota and settings.EYES_GEMMA_SPACE_URL:
                            logger.warning(
                                "Stream crop analysis hit quota on slot %d (%s); falling back to Gemma Eyes",
                                slot_idx, repr(exc)[:160],
                            )
                            try:
                                analysis = await self.analyze(
                                    raw_for_vision, language=language, think=False, provider="gemma", user_gender=item_mg or eff_gender
                                )
                            except Exception as fallback_exc:
                                logger.error("Gemma fallback also failed for slot %d: %s", slot_idx, fallback_exc)
                        if not analysis:
                            if (
                                "API_KEY_SERVICE_BLOCKED" in err_str
                                or "PERMISSION_DENIED" in err_str
                                or "API_KEY_INVALID" in err_str
                            ):
                                raise
                            analysis = {
                                "category": (det.get("category") or det.get("kind") or "Top").capitalize(),
                                "sub_category": (det.get("label") or det.get("kind") or "T-Shirt").capitalize(),
                                "item_type": (det.get("label") or det.get("kind") or "T-Shirt").capitalize(),
                                "title": (det.get("label") or det.get("kind") or "Garment").capitalize(),
                                "caption": "Garment detected from photo upload.",
                                "gender": item_mg or eff_gender or "unisex",
                            }

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
                                "reconstruction gate failed slot=0: %s",
                                repr(exc)[:160],
                            )

                    if _is_unidentifiable(analysis):
                        logger.info("analyze_outfits_stream: skipping unidentifiable/non-clothing item at slot 0 (%s)", analysis.get("title"))
                        yield {
                            "type": "item_skip",
                            "index": 0,
                            "image_index": image_idx,
                            "reason": "non_clothing",
                        }
                        return

                    meta_crop = items_meta[0] if items_meta else {}
                    yield {
                        "type": "item",
                        "index": 0,
                        "image_index": image_idx,
                        "analysis": analysis,
                        "crop_base64": meta_crop.get("crop_base64"),
                        "crop_mime": meta_crop.get("crop_mime", "image/png"),
                        "label": analysis.get("sub_category") or analysis.get("item_type"),
                        "needs_reconstruction": needs_reconstruction,
                        "reconstruction_reasons": reasons,
                    }
                    emitted += 1

                else:
                    # Multiple crops: run system prompt ONCE for the entire batch sequence!
                    CHUNK_SIZE = max(30, len(flat_crops))
                    for chunk_start in range(0, len(flat_crops), CHUNK_SIZE):
                        chunk_crops = flat_crops[chunk_start : chunk_start + CHUNK_SIZE]
                        chunk_bytes = [c[2] for c in chunk_crops]
                        chunk_hints = [
                            (c[1].get("kind") or c[1].get("category") or c[1].get("label"))
                            for c in chunk_crops
                        ]
                        photo_ids = {c[0] for c in chunk_crops}
                        chunk_mgs = {c[1].get("_photo_model_gender") for c in chunk_crops if c[1].get("_photo_model_gender")}
                        if len(photo_ids) == 1 and len(chunk_mgs) == 1:
                            chunk_mg = next(iter(chunk_mgs))
                        else:
                            chunk_mg = None

                        chunk_emitted: set[int] = set()
                        try:
                            logger.info(
                                "analyze_outfits_stream: running unified batch Gemini stream for %d crops (chunk [%d..%d]) with 1 system prompt, chunk_mg=%s",
                                len(chunk_crops), chunk_start, chunk_start + len(chunk_crops), chunk_mg,
                            )
                            batch_kwargs: dict[str, Any] = {
                                "language": language,
                                "kind_hints": chunk_hints,
                                "user_gender": eff_gender,
                            }
                            if chunk_mg is not None:
                                batch_kwargs["model_gender"] = chunk_mg
                            async for local_idx, analysis in self.analyze_batch_stream(
                                chunk_bytes,
                                **batch_kwargs,
                            ):
                                slot_idx = chunk_start + local_idx
                                if slot_idx >= len(flat_crops):
                                    continue
                                image_idx, det, c_bytes, c_mime = flat_crops[slot_idx]
                                chunk_emitted.add(local_idx)
                                item_mg = det.get("_photo_model_gender") or chunk_mg

                                # If batch returned empty/invalid dict, fallback for this slot
                                if not analysis or not isinstance(analysis, dict) or not (
                                    analysis.get("category") or analysis.get("sub_category") or analysis.get("item_type")
                                ):
                                    try:
                                        raw_fb = c_bytes
                                        fb = await self.analyze(
                                            raw_fb, language=language, think=False, user_gender=item_mg or eff_gender
                                        )
                                        if isinstance(fb, dict) and fb:
                                            analysis = fb
                                    except Exception:
                                        analysis = {
                                            "category": (det.get("category") or det.get("kind") or "Top").capitalize(),
                                            "sub_category": (det.get("label") or det.get("kind") or "T-Shirt").capitalize(),
                                            "item_type": (det.get("label") or det.get("kind") or "T-Shirt").capitalize(),
                                            "title": (det.get("label") or det.get("kind") or "Garment").capitalize(),
                                            "caption": "Garment detected from photo upload.",
                                            "gender": item_mg or eff_gender or "unisex",
                                        }

                                _enforce_segformer_category(
                                    analysis,
                                    segformer_kind=det.get("kind") or det.get("category"),
                                    label=det.get("label"),
                                    is_single_item=det.get("is_single_item", False),
                                    language=language,
                                )
                                if not analysis.get("title") and analysis.get("name"):
                                    analysis["title"] = analysis["name"]
                                if not analysis.get("title") and (det.get("label") or det.get("kind")):
                                    analysis["title"] = (det.get("label") or det.get("kind")).capitalize()
                                if not analysis.get("item_type") and not analysis.get("sub_category"):
                                    fallback_type = (det.get("label") or det.get("kind") or "garment").lower()
                                    analysis["item_type"] = fallback_type
                                    analysis["sub_category"] = fallback_type.capitalize()

                                if item_mg in ("men", "women"):
                                    analysis["gender"] = item_mg
                                analysis = _coerce_single_garment(analysis, user_gender=eff_gender, model_gender=item_mg, language=language)
                                analysis = _coerce_enums(analysis, user_gender=eff_gender, model_gender=item_mg)
                                if item_mg in ("men", "women"):
                                    analysis["gender"] = item_mg

                                if _is_unidentifiable(analysis):
                                    logger.info("analyze_outfits_stream: skipping unidentifiable/non-clothing item at slot %d (%s)", slot_idx, analysis.get("title"))
                                    yield {
                                        "type": "item_skip",
                                        "index": slot_idx,
                                        "image_index": image_idx,
                                        "reason": "non_clothing",
                                    }
                                    continue

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
                                            "reconstruction gate failed slot=%d: %s",
                                            slot_idx, repr(exc)[:160],
                                        )

                                meta_crop = items_meta[slot_idx] if slot_idx < len(items_meta) else {}
                                yield {
                                    "type": "item",
                                    "index": slot_idx,
                                    "image_index": image_idx,
                                    "analysis": analysis,
                                    "crop_base64": meta_crop.get("crop_base64"),
                                    "crop_mime": meta_crop.get("crop_mime", "image/png"),
                                    "label": analysis.get("sub_category") or analysis.get("item_type"),
                                    "needs_reconstruction": needs_reconstruction,
                                    "reconstruction_reasons": reasons,
                                }
                                emitted += 1

                        except Exception as batch_exc:
                            logger.warning(
                                "analyze_outfits_stream: batch stream failed for chunk [%d..%d]: %s — falling back to per-crop",
                                chunk_start, chunk_start + len(chunk_crops), repr(batch_exc)[:200],
                            )
                            err_str = str(batch_exc)
                            is_quota = (
                                "RESOURCE_EXHAUSTED" in err_str
                                or "429" in err_str
                                or "quota" in err_str.lower()
                                or "spending cap" in err_str.lower()
                            )
                            for local_i, (image_idx, det, c_bytes, c_mime) in enumerate(chunk_crops):
                                if local_i in chunk_emitted:
                                    continue
                                slot_idx = chunk_start + local_i
                                item_mg = det.get("_photo_model_gender")
                                fallback_analysis = None
                                raw_fb = c_bytes
                                if is_quota and settings.EYES_GEMMA_SPACE_URL:
                                    try:
                                        fallback_analysis = await self.analyze(
                                            raw_fb, language=language, think=False, provider="gemma", user_gender=item_mg or eff_gender
                                        )
                                    except Exception:
                                        fallback_analysis = None
                                if not fallback_analysis:
                                    try:
                                        fallback_analysis = await self.analyze(
                                            raw_fb, language=language, think=False, user_gender=item_mg or eff_gender
                                        )
                                    except Exception:
                                        fallback_analysis = {
                                            "category": (det.get("category") or det.get("kind") or "Top").capitalize(),
                                            "sub_category": (det.get("label") or det.get("kind") or "T-Shirt").capitalize(),
                                            "item_type": (det.get("label") or det.get("kind") or "T-Shirt").capitalize(),
                                            "title": (det.get("label") or det.get("kind") or "Garment").capitalize(),
                                            "caption": "Garment detected from photo upload.",
                                            "gender": item_mg or eff_gender or "unisex",
                                        }

                                _enforce_segformer_category(
                                    fallback_analysis,
                                    segformer_kind=det.get("kind") or det.get("category"),
                                    label=det.get("label"),
                                    is_single_item=det.get("is_single_item", False),
                                    language=language,
                                )
                                if not fallback_analysis.get("title") and fallback_analysis.get("name"):
                                    fallback_analysis["title"] = fallback_analysis["name"]
                                if not fallback_analysis.get("title") and (det.get("label") or det.get("kind")):
                                    fallback_analysis["title"] = (det.get("label") or det.get("kind")).capitalize()
                                if not fallback_analysis.get("item_type") and not fallback_analysis.get("sub_category"):
                                    fallback_type = (det.get("label") or det.get("kind") or "garment").lower()
                                    fallback_analysis["item_type"] = fallback_type
                                    fallback_analysis["sub_category"] = fallback_type.capitalize()

                                if item_mg in ("men", "women"):
                                    fallback_analysis["gender"] = item_mg
                                fallback_analysis = _coerce_single_garment(fallback_analysis, user_gender=eff_gender, model_gender=item_mg, language=language)
                                fallback_analysis = _coerce_enums(fallback_analysis, user_gender=eff_gender, model_gender=item_mg)
                                if item_mg in ("men", "women"):
                                    fallback_analysis["gender"] = item_mg

                                if _is_unidentifiable(fallback_analysis):
                                    logger.info("analyze_outfits_stream: skipping unidentifiable/non-clothing item at slot %d (%s)", slot_idx, fallback_analysis.get("title"))
                                    yield {
                                        "type": "item_skip",
                                        "index": slot_idx,
                                        "image_index": image_idx,
                                        "reason": "non_clothing",
                                    }
                                    continue

                                meta_crop = items_meta[slot_idx] if slot_idx < len(items_meta) else {}
                                yield {
                                    "type": "item",
                                    "index": slot_idx,
                                    "image_index": image_idx,
                                    "analysis": fallback_analysis,
                                    "crop_base64": meta_crop.get("crop_base64"),
                                    "crop_mime": meta_crop.get("crop_mime", "image/png"),
                                    "label": fallback_analysis.get("sub_category") or fallback_analysis.get("item_type"),
                                    "needs_reconstruction": False,
                                    "reconstruction_reasons": [],
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
    """Instantiate the default service (defaults to self-hosted Eyes Gemma 4 container if enabled, else Gemini)."""
    want_gemma = (
        settings.EYES_PROVIDER in ("gemma", "dressapp")
        and settings.GARMENT_VISION_PROVIDER in ("gemma", "dressapp")
    )
    if want_gemma:
        try:
            return GarmentVisionService(provider="gemma", model="Eyes v1")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Garment vision default gemma init note: %s", exc)

    from app.services import eyes_override
    active_server_provider = eyes_override.get_cached_active_provider()
    want_hf = active_server_provider == "hf"
    want_gemini_analyze = active_server_provider == "gemini"
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
        return GarmentVisionService(provider=active_server_provider)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Garment vision init failed: %s", exc)
        return None


garment_vision_service = _build_vision_service()


def get_garment_vision_service(
    user: dict[str, Any] | None = None,
    api_key: str | None = None,
) -> GarmentVisionService | None:
    """Return a GarmentVisionService instance scoped to the user's provider / API key if available,
    falling back to the server-configured Eyes provider (respecting DB runtime override)."""
    from app.services.auth import (
        is_tester_user,
        resolve_effective_provider,
        resolve_user_custom_gemini_api_key,
        resolve_user_custom_key,
        resolve_user_ai_provider,
        resolve_user_ai_model,
        resolve_user_gemini_model,
    )
    from app.services import eyes_override

    user_gender = resolve_garment_gender(user) if user and isinstance(user, dict) else None

    if user and isinstance(user, dict):
        provider = resolve_user_ai_provider(user)
        model = resolve_user_ai_model(user)

        # 1) If user has selected Google Gemini explicitly
        if provider in ("google_ai", "gemini"):
            user_gemini_key = api_key or resolve_user_custom_gemini_api_key(user)
            gemini_model = resolve_user_gemini_model(user)
            if user_gemini_key:
                try:
                    return GarmentVisionService(api_key=user_gemini_key, model=gemini_model, provider="gemini", user_gender=user_gender)
                except Exception as exc:
                    logger.warning("Failed to build user-scoped Gemini GarmentVisionService: %s", exc)
            elif is_tester_user(user):
                # Tester evaluating Gemini via server key
                try:
                    return GarmentVisionService(model=gemini_model or "gemini-3.5-flash-lite", provider="gemini", user_gender=user_gender)
                except Exception as exc:
                    logger.warning("Failed to build tester Gemini GarmentVisionService: %s", exc)

        # 2) If user selected another supplier and entered a custom API key
        elif provider not in ("dressapp", "gemma", "eyes"):
            custom_key = api_key or resolve_user_custom_key(user, provider)
            if custom_key:
                try:
                    return GarmentVisionService(api_key=custom_key, model=model, provider=provider, user_gender=user_gender)
                except Exception as exc:
                    logger.warning("Failed to build user-scoped %s GarmentVisionService: %s", provider, exc)

        # 3) If user explicitly selected Gemma (local/self-hosted)
        if provider in ("gemma", "eyes"):
            try:
                return GarmentVisionService(provider="gemma", model=model or "Eyes v1", user_gender=user_gender)
            except Exception as exc:
                logger.warning("Failed to build DressApp Eyes GarmentVisionService: %s", exc)

        # 4) If provider is dressapp:
        # Check if the user is a tester who has configured an effective provider switch
        eff_provider = resolve_effective_provider(user)
        if eff_provider == "gemma":
            try:
                return GarmentVisionService(provider="gemma", model=model or "Eyes v1", user_gender=user_gender)
            except Exception as exc:
                logger.warning("Failed to build tester DressApp Eyes Gemma GarmentVisionService: %s", exc)
        elif eff_provider == "gemini":
            try:
                return GarmentVisionService(provider="gemini", model=model or "gemini-3.5-flash-lite", user_gender=user_gender)
            except Exception as exc:
                logger.warning("Failed to build tester Gemini GarmentVisionService: %s", exc)

        # 5) Platform default:
        # Resolve against the authoritative DB runtime override from eyes_override
        active_server_provider = eyes_override.get_cached_active_provider()
        try:
            default_m = "gemini-3.5-flash-lite" if active_server_provider == "gemini" else "Eyes v1"
            return GarmentVisionService(provider=active_server_provider, model=model or default_m, user_gender=user_gender)
        except Exception as exc:
            logger.warning("Failed to build DressApp platform GarmentVisionService: %s", exc)

    if api_key:
        try:
            return GarmentVisionService(api_key=api_key, model="gemini-3.5-flash-lite", provider="gemini", user_gender=user_gender)
        except Exception as exc:
            logger.warning("Failed to build explicit key GarmentVisionService: %s", exc)

    if user_gender:
        try:
            from app.services import eyes_override
            active_server_provider = eyes_override.get_cached_active_provider()
            return GarmentVisionService(
                provider=active_server_provider,
                user_gender=user_gender,
            )
        except Exception as exc:
            logger.warning("Failed to build gender-scoped fallback GarmentVisionService: %s", exc)

    return garment_vision_service
