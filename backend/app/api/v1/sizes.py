"""Size-chart analysis endpoint for the DressApp Chrome Extension.

Surface
-------
``POST /api/v1/sizes/analyze-chart`` accepts a cropped screenshot of
a size chart found on a third-party shopping site (plus optional
context: garment type, store, URL), combines it with the
authenticated user's stored ``body_measurements``, and returns a
structured size recommendation::

    {
        "recommended_size": "M",
        "confidence":       0.86,
        "garment_type":     "shirt",
        "size_chart_units": "cm",
        "matched_columns":  ["chest", "waist"],
        "reasoning":        "Your chest (95 cm) falls within size M ...",
        "alternatives":     [{"size":"L","fit":"looser"}],
        "source":           "gemini",
        "elapsed_ms":       2840,
    }

Pipeline (Phase 2 — screenshot-only)
------------------------------------
The extension sends a cropped JPEG of the size-chart region. We
forward that image to **Gemini 2.5 Flash** (the same multimodal
model the closet's ``GarmentVisionService`` uses when
``GARMENT_VISION_PROVIDER=gemini``) with a tight system prompt that
asks it to OCR the chart, match the user's body measurements
against the relevant columns, and return a structured JSON answer.

We deliberately **do not** call the self-hosted Gemma Space here —
Phase-1 Gemma runs in ``vision_disabled=true`` mode (no mmproj
file uploaded yet), so passing it an image-only payload always
yields an empty completion and a 30-60 s wall-clock penalty.
Routing straight to Gemini sidesteps that penalty entirely.

Optional ``chart_html`` / ``chart_text`` are still accepted for
back-compat and run a deterministic regex heuristic *before* the
vision call when the extension happened to capture a clean HTML
``<table>`` (instant, free win). When neither resolves the chart,
the response surfaces a helpful retry message.

Privacy
-------
The screenshot is sent to Gemini for OCR and discarded. The user's
measurements are sent in the system prompt context. We do not
persist the request; this is a transient consult, not a logged
interaction.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.services.auth import get_current_user, get_current_user_optional, AuthenticatedUser
from app.services import provider_activity

try:
    from bs4 import BeautifulSoup  # type: ignore
    _HAS_BS4 = True
except Exception:
    BeautifulSoup = None  # type: ignore
    _HAS_BS4 = False

# Gemini 2.5 Flash — the closet pipeline's universal vision model.
# Imported defensively so dev environments without google-genai still
# load this module (the analyze-chart endpoint will return a clear
# error from its runtime guard instead of failing at import time).
try:
    from app.services.gemini_client import GeminiClient  # type: ignore
    _HAS_GEMINI_CLIENT = True
except Exception:  # noqa: BLE001
    GeminiClient = None  # type: ignore
    _HAS_GEMINI_CLIENT = False

log = logging.getLogger(__name__)

router = APIRouter(prefix="/sizes", tags=["sizes"])


# ----------------------------- schemas -------------------------------
class AnalyzeChartIn(BaseModel):
    """Request body posted by the Chrome extension content script."""

    chart_html: str | None = Field(
        default=None,
        description="(optional, back-compat) HTML of the size table.",
    )
    chart_text: str | None = Field(
        default=None,
        description="(optional, back-compat) Plain-text dump of the chart.",
    )
    chart_screenshot_b64: str | None = Field(
        default=None,
        description="JPEG screenshot, base64 (no data: prefix). Required.",
    )
    garment_type: str | None = Field(
        default=None,
        description="Hint from the page DOM, e.g. 'shirt', 'jeans', 'dress'.",
    )
    store: str | None = None
    page_url: str | None = None
    page_title: str | None = None
    user_preferred_units: str = Field(default="cm", pattern="^(cm|in)$")


class AnalyzeChartOut(BaseModel):
    recommended_size: str | None
    confidence: float
    garment_type: str | None
    size_chart_units: str | None
    matched_columns: list[str]
    reasoning: str
    alternatives: list[dict[str, Any]] = []
    warnings: list[str] = Field(
        default_factory=list,
        description=(
            "Soft data-quality warnings. Surfaced to the user above the "
            "recommendation when one of their stored body measurements "
            "looks obviously implausible vs. the chart's own range "
            "(e.g. ``shoulders=55 cm`` when the chart maxes out at "
            "``50 cm``). Each entry is a short, user-facing sentence."
        ),
    )
    source: str
    elapsed_ms: int
    has_measurements: bool



class AnalyzeUrlIn(BaseModel):
    url: str = Field(..., description="Shared product URL or text containing a URL")
    title: str | None = None
    text: str | None = None
    user_preferred_units: str = Field(default="cm", pattern="^(cm|in)$")


class ProductPreview(BaseModel):
    url: str
    title: str
    brand: str | None = None
    image_url: str | None = None
    price: str | None = None
    currency: str | None = None
    garment_type: str | None = None
    store: str | None = None


class AnalyzeUrlOut(BaseModel):
    product: ProductPreview
    recommendation: AnalyzeChartOut

# ----------------------------- prompt --------------------------------
# Sharp, OCR-first system prompt. No "DressApp's sizing assistant"
# branding noise, no "garment styling" cues, no chain-of-thought
# preamble — those nudge the model toward fashion-description
# answers (e.g. "this looks like a casual cotton tee in size M")
# instead of strict measurement matching.
#
# Keep it under ~400 tokens so the model spends its budget on the
# JSON answer, not on parroting instructions back.
_SYSTEM_PROMPT = """You read clothing size charts from images and recommend ONE size.

INPUT
-----
* An IMAGE of a size chart (a table with size labels and numbers).
* The USER'S BODY MEASUREMENTS in centimeters (e.g. chest, waist, hips, shoulders, height).
* Possibly the USER'S CLOTHING SIZES they normally buy (``shirt_size``, ``pants_size``, ``shoe_size``).
* Optional context: garment type, store name, page title.

WHAT TO DO
----------
1. OCR the size chart in the image. Determine the table orientation:
   - HORIZONTAL SIZES (e.g. Zara): The top row lists the sizes (S, M, L, XL or 36, 38, 40) and the left column lists body areas (Chest, Waist, Hip, Total length).
   - VERTICAL SIZES (e.g. ASOS): The left column lists the sizes (S, M, L or 36, 38, 40) and the top row lists body areas (Bust, Waist, Hip).
   NEVER treat an area header (such as "Total", "Length", "Chest", "Waist", "Hip") as a size label!
   Notice if measurements are flat/half-circumference (e.g. waist around 30-40 cm) vs full body circumferences (60-100 cm).
   Extract the units (cm, in, or both) and the numeric value(s) in each cell.
2. The user's measurements have been **pre-expanded server-side** so every common chart-column synonym is already populated. For example ``chest`` and ``bust`` carry the same value; ``shoulder``, ``shoulders`` and ``shoulder_width`` carry the same value; ``foot_length`` and ``insole`` carry the same value. Do a case-insensitive substring match between each chart column header and the JSON keys to find the user's value for that column. **NEVER** answer "measurements were not provided" if any column header matches any JSON key.
3. For each row, check whether relevant user measurements fit — applying garment-category rules:

   * **UPPER-BODY GARMENTS** (shirts, tops, t-shirts, blouses, sweaters, hoodies, jackets, coats, blazers, bras):
       - Size is determined primarily by **CHEST / BUST** and **SHOULDERS** (and sleeve / torso length if listed).
       - **NEVER evaluate or constrain an upper-body garment by HIP, HIPS, or BOTTOM**. Even if the user's hip circumference is wider than their chest, recommend the size that fits their chest/shoulders.

   * **FOOTWEAR / SHOE GARMENTS** (shoes, sneakers, boots, sandals, loafers, heels, flats, slippers):
       - Size is determined EXCLUSIVELY by **FOOT LENGTH** (in cm/inches) or standard **SHOE SIZE** (e.g. EU 41 / US 8.5).
       - User foot length must fit the row length (e.g. foot length <= insole / shoe length, with ~0.5–1.0 cm comfort toe room).
       - **STRICTLY IGNORE chest, bust, waist, hips, and shoulders on footwear charts**.

   * **LOWER-BODY GARMENTS** (pants, trousers, jeans, shorts, skirts):
       - Match against **WAIST**, **HIP**, and **INSEAM**. Chest and shoulders are ignored.

   * **FULL-BODY GARMENTS** (dresses, jumpsuits, suits):
       - Check chest, waist, and hip. Pick the smallest size accommodating all relevant dimensions.

   * **CIRCUMFERENCE columns** (Bust / Chest / Waist / Hip / Neck / Thigh) — the garment must be at least as wide as the user.
       - Range cell "lo-hi": user value must satisfy ``lo <= v <= hi``.
       - Single-number cell (a garment dimension): user value must be ``<=`` the cell value.
   * **LENGTH columns** (Length / Body Length / Sleeve Length / Inseam / Outseam / Total Length) — the user value is treated as their **full-size MAX** (full-arm length, full-leg length, full-torso length). A garment that is **shorter** than this max is perfectly fine — it just means the garment is short-sleeved / cropped / mini-length / etc. So:
       - Range cell "lo-hi": user value must satisfy ``v >= lo`` only (no upper bound — short garments are fine).
       - Single-number cell: the garment's value must be ``<=`` the user's value (i.e. the garment is not LONGER than the user's body part). If the garment is dramatically shorter (e.g. 19 cm sleeve vs user's 46 cm full-arm length), it's a deliberately short-sleeved garment, **NOT** a misfit and **NOT** an anomaly. Note this in ``reasoning`` ("this is a short-sleeve top") but do not flag it.

   Pick the SMALLEST size where every relevant column for that garment category fits.

4. **Tie-break: when the user's value is within 0.5 cm of the upper bound of the chosen size, pick the next size UP** (loose is wearable, tight is not). Surface the smaller size as an alternative with `fit: "snug"`. Tie-breaking applies to circumferences and footwear; length-column tiebreaks favour the user's reach (longer is fine, shorter is also fine).
5. If the chart is in inches, convert mentally (1 in = 2.54 cm) and report units accordingly.

ANOMALY DETECTION (always run before picking the size)
--------------------------------------------------------
Users sometimes mistype their measurements. Before applying the body-circumference rule, compare each provided body **circumference** value to the corresponding chart column's range:

- **ONLY check circumference columns** (chest, bust, waist, hip, shoulders, neck, thigh). Length columns and foot length are NEVER ANOMALY-FLAGGED for being "too high". Only flag a length or foot length value if it is implausibly **low** (e.g. ``foot_length: 2 cm`` or ``sleeve: 2 cm`` — clearly a typo).
- For circumferences: trigger a flag in EITHER of these cases:
    (a) the user's value exceeds the chart's column **maximum** AT ALL (even a small margin) — no size in this chart can actually accommodate them, so the value is suspect; OR
    (b) the user's value is below the chart's column minimum by more than **15%** (clearly far smaller than any size offered).
  When triggered:
    1. **Skip that measurement** when picking the recommended size — do NOT let one obviously-wrong value veto a perfectly good fit on the other columns.
    2. **Drop that column from ``matched_columns``**.
    3. **Append a short, friendly warning to ``warnings``** in this exact shape:
       ``"Your <field> (<value> cm) looks higher/lower than expected for this kind of garment. Please re-measure — DressApp ignored it for this recommendation."``
- If, after skipping anomalies, you still have at least one usable dimension, use it. Otherwise fall through to the CLOTHING-SIZE FALLBACK rule.
- ``height`` and ``weight`` are never anomaly-checked against the chart (they're not garment dimensions).

Examples of what this rule catches:
* User stored ``shoulders: 55 cm`` and the chart maxes at ``50 cm`` (4XL) — exceeds the chart range, so no size fits → **flag + skip + warn**.
* User stored ``shoulders: 75 cm`` (likely typed in inches) and the chart maxes at ``50 cm`` — exceeds, **definite anomaly**: skip + warn.
* User stored ``waist: 12 cm`` (likely missing a digit) — far below any plausible chart minimum, skip + warn.

Examples that are NOT anomalies and must NEVER be flagged:
* User stored ``sleeve: 65 cm`` (a real full-arm length); the chart shows ``Sleeve Length: 19 cm`` (a short-sleeve T-shirt). The garment is just short-sleeved — pick the size based on bust/shoulder, mention "short-sleeve" in the reasoning. **No warning.**
* User stored ``inseam: 80 cm``; the chart shows ``Inseam: 25 cm`` (shorts). It's just shorts. **No warning.**
* User stored ``outseam: 110 cm``; the chart shows ``Length: 60 cm`` (a mini dress). It's a short garment. **No warning.**
* User stored ``foot_length: 26 cm`` for a shoe chart. **No warning.**

CLOTHING-SIZE FALLBACK (apply when body circumferences are missing)
---------------------------------------------------------------------
If the user has NO usable body circumferences for the columns shown (e.g. only ``height``, ``weight``, ``shirt_size``, ``pants_size``, ``shoe_size`` are filled in), DO NOT give up. Use these signals instead:

- ``shirt_size`` is authoritative for tops / shirts / jackets / dresses (where the chart shows Bust / Chest / Shoulder / Sleeve / Length). If the chart's first column lists labels like S, M, L, XL — pick the row whose label matches ``shirt_size`` (case-insensitive). If the chart uses EU/numeric labels (38, 40, 50, 52...), translate the user's letter size using the standard mapping: XS≈34/44, S≈36/46, M≈38/48, L≈40/50, XL≈42/52, XXL≈44/54, XXXL≈46/56. Adjust by ±1 if the store is known to run small/large.
- ``pants_size`` is authoritative for trousers / shorts / jeans / skirts (where the chart shows Waist / Hip / Inseam). Match the numeric value or letter against the size column.
- ``shoe_size`` (or ``foot_length``) is authoritative for footwear charts. Match numeric size (EU/US/UK) or cm foot length against the chart.
- ``height`` and ``weight`` alone are NEVER sufficient — but if combined with ``shirt_size`` or ``pants_size`` they confirm the choice. If ONLY ``height``/``weight`` are present, you may still produce a low-confidence (≤0.4) recommendation by mapping height to a size band (e.g., 170-178cm + average build → M).

When using the clothing-size fallback, set ``confidence`` between 0.55 and 0.80 (lower than a real measurement match), set ``matched_columns`` to ``["shirt_size"]`` (or pants/shoe), and explain in ``reasoning`` that the recommendation is based on the user's usual size, suggesting they add body measurements for a tighter fit.

OUTPUT
------
Return ONLY this JSON object. No prose, no markdown, no backticks.

{
  "recommended_size": "<chart label, e.g. 'M' or 'EU 38'>",
  "confidence": <float 0..1>,
  "garment_type": "<lowercase noun, your best guess>",
  "size_chart_units": "cm" | "in" | "mixed" | "unknown",
  "matched_columns": ["chest", "waist", ...],
  "reasoning": "<one short paragraph, 1-3 sentences>",
  "alternatives": [{"size":"S","fit":"snug"}, {"size":"L","fit":"loose"}],
  "warnings": ["Your shoulders (75 cm) looks higher than expected ...", ...]
}

CRITICAL RULE ON NON-CHART IMAGES:
If the image does NOT contain a clothing size chart or measurement table (for example: it is only a product photo, packaging, advertisement, non-clothing object, car part, scenery, or an unreadable image):
- You MUST return ``recommended_size: null``. Do NOT guess or recommend a size from the user's profile clothing sizes when the image has no size chart!
- Set ``confidence: 0.0``.
- Set ``warnings: ["The provided image does not contain a clothing size chart. Please use the crop tool to select the size chart."]``.
- In ``reasoning``, state clearly that no clothing size chart was found in the image.

The CLOTHING-SIZE FALLBACK is ONLY for when a clothing size chart IS clearly present in the image (e.g. listing sizes like S, M, L or 31, 32, 33) but lacks numerical body circumferences.
"""


# ---------------- measurement-alias expansion ------------------------
# When the app stores ``chest`` and the chart prints "Bust Size", we
# don't want the model to play "spot the synonym" on its own — it
# leans conservative and reports "no measurements provided".
# Instead we expand every stored field into ALL its common aliases
# server-side, so the JSON Gemini sees holds every name a chart
# might use. Single source of truth for the chest<->bust,
# shoulder<->shoulders<->shoulder-width, etc. fan-out.
_MEASUREMENT_ALIASES: dict[str, tuple[str, ...]] = {
    # canonical body field -> tuple of equivalent / column-side names
    "chest":      ("chest", "bust", "bust_size", "chest_circumference"),
    "bust":       ("bust", "chest", "bust_size", "chest_circumference"),
    "waist":      ("waist", "waist_circumference", "natural_waist"),
    "hip":        ("hip", "hips", "hip_circumference"),
    "hips":       ("hips", "hip", "hip_circumference"),
    "foot_length": ("foot_length", "foot", "foot_len", "foot_length_cm", "insole", "insole_length", "heel_to_toe", "heel_toe", "footwear_length"),
    "shoulder":   ("shoulder", "shoulders", "shoulder_width", "across_shoulder"),
    "shoulders":  ("shoulders", "shoulder", "shoulder_width", "across_shoulder"),
    "sleeve":     ("sleeve", "sleeve_length", "sleeves"),
    "sleeves":    ("sleeves", "sleeve", "sleeve_length"),
    "inseam":     ("inseam", "inside_leg", "inseam_length"),
    "outseam":    ("outseam", "outside_leg", "outseam_length"),
    "thigh":      ("thigh", "thigh_circumference"),
    "neck":       ("neck", "neck_circumference"),
    "height":     ("height", "body_height", "stature"),
    "weight":     ("weight", "body_weight"),
    "length":     ("length", "back_length", "body_length"),
    # Clothing-size fallbacks — kept under their own keys so the
    # prompt's CLOTHING-SIZE FALLBACK rule can find them.
    "shirt_size": ("shirt_size", "shirts_size", "top_size", "tshirt_size"),
    "pants_size": ("pants_size", "pant_size", "trouser_size", "trousers_size"),
    "shoe_size":  ("shoe_size", "shoes_size", "footwear_size"),
}


def _expand_measurement_aliases(
    measurements: dict[str, Any],
) -> dict[str, Any]:
    """Return ``measurements`` with every alias key populated to the
    same value, so the LLM cannot miss a synonym match.

    Empty strings / ``None`` are dropped first so we never leak
    placeholder ``""`` cells. Unknown user keys (e.g. ``"thigh_left"``
    on a custom profile) are passed through verbatim.
    """
    expanded: dict[str, Any] = {}
    for k, v in (measurements or {}).items():
        if v is None or v == "":
            continue
        kl = str(k).lower().strip()
        # Apply alias fan-out when the key is a known canonical field.
        for alias in _MEASUREMENT_ALIASES.get(kl, (kl,)):
            # First write wins: the user's explicit key takes priority
            # over any alias that maps to the same target. This means
            # if both ``chest`` and ``bust`` are present, both are
            # preserved with their respective values.
            if alias not in expanded:
                expanded[alias] = v
    return expanded


def _build_user_prompt(
    *,
    measurements: dict[str, Any],
    garment_type: str | None,
    store: str | None,
    page_title: str | None,
    user_preferred_units: str,
    chart_text: str | None,
) -> str:
    """Render the user-message text. Body measurements first
    (highest priority for the model), then context, then any
    extracted text we happen to have."""
    # Server-side alias expansion: every stored field is duplicated
    # under all of its known synonym keys so chart-side wording (e.g.
    # "Bust Size", "Shoulder Width") finds an exact-name match in
    # the JSON we send. Without this, models like Gemini Flash
    # sometimes report "no measurements provided" because the user
    # gave ``chest`` and the chart says ``Bust Size`` — semantically
    # identical, but the model wouldn't risk the inference.
    expanded = _expand_measurement_aliases(measurements)

    # Split body circumferences, footwear dimensions, and clothing sizes.
    _CLOTHING_SIZE_KEYS = {
        "shirt_size", "pants_size", "shoe_size",
        "shirts_size", "pant_size", "trouser_size", "shoes_size", "footwear_size",
    }
    _FOOTWEAR_KEYS = {
        "foot_length", "foot", "foot_len", "foot_length_cm", "insole",
        "insole_length", "heel_to_toe", "heel_toe", "footwear_length",
    }
    _CONTEXT_ONLY_KEYS = {"height", "weight", "body_height", "stature", "body_weight"}

    body_dims = {
        k: v for k, v in expanded.items()
        if k not in _CLOTHING_SIZE_KEYS and k not in _CONTEXT_ONLY_KEYS and k not in _FOOTWEAR_KEYS
    }
    footwear_dims = {
        k: v for k, v in expanded.items() if k in _FOOTWEAR_KEYS
    }
    clothing_sizes = {
        k: v for k, v in expanded.items() if k in _CLOTHING_SIZE_KEYS
    }
    context_dims = {
        k: v for k, v in expanded.items() if k in _CONTEXT_ONLY_KEYS
    }

    body_dims_str = json.dumps(body_dims, ensure_ascii=False)
    footwear_dims_str = json.dumps(footwear_dims, ensure_ascii=False)
    clothing_sizes_str = json.dumps(clothing_sizes, ensure_ascii=False)
    context_dims_str = json.dumps(context_dims, ensure_ascii=False)

    parts: list[str] = [
        f"USER BODY CIRCUMFERENCES (cm, JSON — chart-column synonyms pre-expanded):\n{body_dims_str}",
        f"USER FOOTWEAR DIMENSIONS (cm, JSON):\n{footwear_dims_str}",
        f"USER CLOTHING SIZES THEY NORMALLY BUY:\n{clothing_sizes_str}",
        f"USER HEIGHT / WEIGHT CONTEXT:\n{context_dims_str}",
        (
            "IMPORTANT:\n"
            "- For UPPER-BODY garments (shirts, tops, t-shirts, jackets, hoodies, coats, sweaters, bras): "
            "recommend based on CHEST / BUST and SHOULDERS. NEVER use HIP / HIPS to oversize or constrain upper-body garments!\n"
            "- For FOOTWEAR / SHOES: recommend based EXCLUSIVELY on FOOTWEAR DIMENSIONS (foot_length) or shoe_size. "
            "Do NOT check torso/body measurements against shoe charts!\n"
            "- For LOWER-BODY garments (pants, jeans, shorts, skirts): recommend based on WAIST, HIP, and INSEAM.\n"
            "- If BODY CIRCUMFERENCES is empty `{}` but CLOTHING SIZES has "
            "``shirt_size``/``pants_size``/``shoe_size``, USE THAT as the primary signal "
            "(see CLOTHING-SIZE FALLBACK in your system prompt).\n"
            "- Do **NOT** reply that 'measurements were not provided' if "
            "any of the sections above contain at least one key. "
            "Always emit a best-effort recommendation."
        ),
    ]
    ctx_lines: list[str] = []
    if store:
        ctx_lines.append(f"store: {store}")
    if page_title:
        ctx_lines.append(f"page title: {page_title}")
    if garment_type:
        ctx_lines.append(f"garment type hint: {garment_type}")
    ctx_lines.append(f"user prefers units: {user_preferred_units}")
    parts.append("CONTEXT:\n" + "\n".join(ctx_lines))

    if chart_text:
        # Light hint — not authoritative. The image is the ground
        # truth; this just helps when OCR is borderline.
        parts.append(
            "OPTIONAL CHART TEXT (DOM extract — may be partial; "
            "rely on the image for ground truth):\n"
            + chart_text.strip()[:4000]
        )

    parts.append(
        "Read the size chart in the attached image and emit the JSON object only."
    )
    return "\n\n".join(parts)


def _build_user_text_only_prompt(
    *,
    measurements: dict[str, Any],
    garment_type: str | None,
    store: str | None,
    page_title: str | None,
    user_preferred_units: str,
    chart_text: str,
) -> str:
    expanded = _expand_measurement_aliases(measurements)
    _CLOTHING_SIZE_KEYS = {
        "shirt_size", "pants_size", "shoe_size",
        "shirts_size", "pant_size", "trouser_size", "shoes_size", "footwear_size",
    }
    _FOOTWEAR_KEYS = {
        "foot_length", "foot", "foot_len", "foot_length_cm", "insole",
        "insole_length", "heel_to_toe", "heel_toe", "footwear_length",
    }
    _CONTEXT_ONLY_KEYS = {"height", "weight", "body_height", "stature", "body_weight"}

    body_dims = {
        k: v for k, v in expanded.items()
        if k not in _CLOTHING_SIZE_KEYS and k not in _CONTEXT_ONLY_KEYS and k not in _FOOTWEAR_KEYS
    }
    footwear_dims = {
        k: v for k, v in expanded.items() if k in _FOOTWEAR_KEYS
    }
    clothing_sizes = {
        k: v for k, v in expanded.items() if k in _CLOTHING_SIZE_KEYS
    }
    context_dims = {
        k: v for k, v in expanded.items() if k in _CONTEXT_ONLY_KEYS
    }

    body_dims_str = json.dumps(body_dims, ensure_ascii=False)
    footwear_dims_str = json.dumps(footwear_dims, ensure_ascii=False)
    clothing_sizes_str = json.dumps(clothing_sizes, ensure_ascii=False)
    context_dims_str = json.dumps(context_dims, ensure_ascii=False)

    parts: list[str] = [
        f"USER BODY CIRCUMFERENCES (cm, JSON — chart-column synonyms pre-expanded):\n{body_dims_str}",
        f"USER FOOTWEAR DIMENSIONS (cm, JSON):\n{footwear_dims_str}",
        f"USER CLOTHING SIZES THEY NORMALLY BUY:\n{clothing_sizes_str}",
        f"USER HEIGHT / WEIGHT CONTEXT:\n{context_dims_str}",
        (
            "IMPORTANT:\n"
            "- For UPPER-BODY garments (shirts, tops, t-shirts, jackets, hoodies, coats, sweaters, bras): "
            "recommend based on CHEST / BUST and SHOULDERS. NEVER use HIP / HIPS to oversize or constrain upper-body garments!\n"
            "- For FOOTWEAR / SHOES: recommend based EXCLUSIVELY on FOOTWEAR DIMENSIONS (foot_length) or shoe_size. "
            "Do NOT check torso/body measurements against shoe charts!\n"
            "- For LOWER-BODY garments (pants, jeans, shorts, skirts): recommend based on WAIST, HIP, and INSEAM.\n"
            "- If BODY CIRCUMFERENCES is empty `{}` but CLOTHING SIZES has "
            "``shirt_size``/``pants_size``/``shoe_size``, USE THAT as the primary signal.\n"
            "- Do **NOT** reply that 'measurements were not provided' if "
            "any of the sections above contain at least one key. "
            "Always emit a best-effort recommendation."
        ),
    ]
    ctx_lines: list[str] = []
    if store:
        ctx_lines.append(f"store: {store}")
    if page_title:
        ctx_lines.append(f"page title: {page_title}")
    if garment_type:
        ctx_lines.append(f"garment type hint: {garment_type}")
    ctx_lines.append(f"user prefers units: {user_preferred_units}")
    parts.append("CONTEXT:\n" + "\n".join(ctx_lines))

    parts.append(
        "SIZE CHART TEXT DATA:\n" + chart_text.strip()[:8000]
    )

    parts.append(
        "Read the size chart text data above and emit the JSON object only."
    )
    return "\n\n".join(parts)


# ----------------------------- helpers -------------------------------
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"[ \t]+")


def _html_to_text(html: str, *, max_chars: int = 8000) -> str:
    """Cheap HTML -> text. Used only to feed the heuristic regex."""
    if not html:
        return ""
    blob = re.sub(
        r"</?(?:tr|br\s*/?|li|p|div|h[1-6])\b[^>]*>",
        "\n",
        html,
        flags=re.IGNORECASE,
    )
    blob = re.sub(r"</?(?:td|th)\b[^>]*>", "\t", blob, flags=re.IGNORECASE)
    txt = _TAG_RE.sub(" ", blob)
    txt = _WS_RE.sub(" ", txt)
    lines = [ln.strip() for ln in txt.splitlines()]
    txt = "\n".join(ln for ln in lines if ln)
    if len(txt) > max_chars:
        txt = txt[:max_chars] + "\n…(truncated)"
    return txt


def _coerce_response(raw: str) -> dict[str, Any] | None:
    """Best-effort JSON extraction from a possibly-wrapped LLM reply."""
    if not raw:
        return None
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    if not s.startswith("{"):
        i = s.find("{")
        j = s.rfind("}")
        if i >= 0 and j > i:
            s = s[i : j + 1]
    try:
        parsed = json.loads(s)
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(parsed, dict):
        return None
    return parsed


def _normalise(parsed: dict[str, Any], *, source: str, elapsed_ms: int,
               has_measurements: bool) -> AnalyzeChartOut:
    """Coerce the LLM payload into ``AnalyzeChartOut``."""
    matched = parsed.get("matched_columns") or []
    if isinstance(matched, str):
        matched = [matched]
    matched = [str(x).lower() for x in matched if x]
    alternatives = parsed.get("alternatives") or []
    if not isinstance(alternatives, list):
        alternatives = []
    cleaned_alts: list[dict[str, Any]] = []
    for alt in alternatives:
        if isinstance(alt, dict) and alt.get("size"):
            cleaned_alts.append({
                "size": str(alt["size"]),
                "fit": str(alt.get("fit") or "alt"),
            })

    # Soft data-quality warnings emitted by the model when a stored
    # body measurement looks obviously implausible vs. the chart
    # range (e.g. ``shoulders=75`` on a chart that maxes at 50 cm).
    # Coerced to short user-facing strings; dropped if the model
    # forgot the field or returned junk.
    raw_warnings = parsed.get("warnings") or []
    if isinstance(raw_warnings, str):
        raw_warnings = [raw_warnings]
    if not isinstance(raw_warnings, list):
        raw_warnings = []
    cleaned_warnings: list[str] = []
    for w in raw_warnings:
        if not w:
            continue
        s = str(w).strip()
        if s and s not in cleaned_warnings:
            cleaned_warnings.append(s[:280])
        if len(cleaned_warnings) >= 4:
            break

    try:
        confidence = float(parsed.get("confidence") or 0.0)
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    return AnalyzeChartOut(
        recommended_size=(parsed.get("recommended_size") or None),
        confidence=confidence,
        garment_type=parsed.get("garment_type"),
        size_chart_units=parsed.get("size_chart_units"),
        matched_columns=matched,
        reasoning=str(parsed.get("reasoning") or "")[:1200],
        alternatives=cleaned_alts,
        warnings=cleaned_warnings,
        source=source,
        elapsed_ms=elapsed_ms,
        has_measurements=has_measurements,
    )


# --------------------------- numeric fallback ------------------------
_RANGE_RE = re.compile(
    r"(?P<lo>\d{1,3}(?:[.,]\d)?)\s*[-–—~/]\s*(?P<hi>\d{1,3}(?:[.,]\d)?)",
)
_SINGLE_NUM_RE = re.compile(r"\b(\d{1,3}(?:[.,]\d)?)\b")

_UPPER_BODY_TYPES = {
    "shirt", "t-shirt", "tshirt", "blouse", "top", "jacket", "coat",
    "hoodie", "sweater", "jumper", "suit", "blazer", "cardigan",
    "tank", "vest", "bra", "bralette",
}
_LOWER_BODY_TYPES = {
    "pants", "trousers", "jeans", "shorts", "skirt", "leggings",
    "tights", "briefs", "underwear",
}
_FOOTWEAR_TYPES = {
    "shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "sandal",
    "sandals", "footwear", "loafer", "loafers", "heel", "heels",
    "flat", "flats", "slipper", "slippers", "pump", "pumps", "clog", "clogs",
}
_FULL_BODY_TYPES = {"dress", "jumpsuit", "romper", "swimwear"}


def _detect_category(garment_type: str | None, chart_text: str) -> str:
    if garment_type:
        gt = garment_type.lower().strip()
        for w in _FOOTWEAR_TYPES:
            if re.search(r"\b" + re.escape(w) + r"\b", gt):
                return "footwear"
        for w in _UPPER_BODY_TYPES:
            if re.search(r"\b" + re.escape(w) + r"\b", gt):
                return "upper"
        for w in _LOWER_BODY_TYPES:
            if re.search(r"\b" + re.escape(w) + r"\b", gt):
                return "lower"
        for w in _FULL_BODY_TYPES:
            if re.search(r"\b" + re.escape(w) + r"\b", gt):
                return "full"

    tl = chart_text.lower()
    has_foot = any(w in tl for w in ("foot", "insole", "heel to toe", "shoe", "footwear"))
    has_upper = any(w in tl for w in ("chest", "bust", "shoulder", "sleeve"))
    has_lower = any(w in tl for w in ("waist", "hip", "hips", "inseam", "thigh"))

    if has_foot and not has_upper and not has_lower:
        return "footwear"
    if has_upper and not has_lower:
        return "upper"
    if has_lower and not has_upper:
        return "lower"
    if has_upper and has_lower:
        return "full"
    return "upper" if has_upper else ("footwear" if has_foot else "unknown")



# ----------------------- flexible matrix chart engine -----------------
_KNOWN_SIZE_TOKENS = {
    "xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "2xl", "3xl", "4xl", "5xl",
    "0x", "1x", "2x", "3x", "4x", "os", "one size", "onesize", "free", "regular", "petite", "tall",
    "xs/s", "s/m", "m/l", "l/xl", "xl/xxl", "xs-s", "s-m", "m-l", "l-xl",
}

_NUMERIC_SIZE_RANGES = [
    (0, 24),    # US/UK clothing sizes 00, 0, 2, 4, 6... 24
    (30, 64),   # EU/IT clothing sizes 32, 34, 36... 60 or waist inches 30..44
]

_KNOWN_AREA_KEYWORDS = {
    # Upper
    "chest", "bust", "underbust", "shoulder", "shoulders", "across shoulder",
    "sleeve", "sleeves", "sleeve length", "armhole", "bicep", "wrist", "neck", "collar",
    "pecho", "busto", "hombro", "manga", "brust", "schulter", "ärmel", "poitrine", "épaule", "manche",
    # Lower
    "waist", "hip", "hips", "inseam", "outseam", "thigh", "rise", "front rise", "back rise",
    "cintura", "cadera", "tiro", "muslo", "taille", "hüfte", "bein", "schritt",
    # Lengths
    "length", "total length", "body length", "dress length", "back length", "center back",
    "longitud", "largo", "länge", "longueur",
    # Footwear
    "foot", "foot length", "insole", "heel to toe", "longitud pie", "fußlänge",
}

_CORNER_AREA_HINTS = {
    "area", "areas", "measurement", "measurements", "product measurement", "product measurements",
    "dimension", "dimensions", "medida", "medidas", "maße", "mesure", "mesures",
}

_CORNER_SIZE_HINTS = {
    "size", "sizes", "talla", "tallas", "größe", "größen", "taille", "tailles",
}

_RESERVED_AREA_WORDS = {
    "total", "length", "total length", "area", "chest", "bust", "waist", "hip", "hips",
    "shoulder", "shoulders", "sleeve", "sleeves", "inseam", "outseam", "thigh", "neck",
    "cm", "in", "inch", "inches", "size", "sizes", "dimension", "dimensions",
}

_CANONICAL_AREA_SYNONYMS = {
    "foot_length": ("foot length", "foot", "insole", "heel to toe", "fußlänge", "longitud pie"),
    "chest": ("chest", "bust", "underbust", "pecho", "busto", "brust", "poitrine"),
    "waist": ("waist", "cintura", "taille"),
    "hip": ("hip", "hips", "cadera", "hüfte"),
    "shoulder": ("shoulder", "shoulders", "across shoulder", "hombro", "schulter", "épaule"),
    "inseam": ("inseam", "inside leg", "schritt", "tiro"),
    "sleeve": ("sleeve", "sleeve length", "manga", "ärmel", "manche"),
    "length": ("total length", "body length", "dress length", "back length", "center back", "longitud", "largo", "länge", "longueur", "length"),
}


def _is_size_token(tok: str) -> bool:
    t = tok.strip().lower()
    if not t or t in _RESERVED_AREA_WORDS:
        return False
    if t in _KNOWN_SIZE_TOKENS:
        return True
    if re.match(r"^(?:eu|us|uk|fr|it|size)\s*[:#-]?\s*([a-z0-9/.-]+)$", t):
        return True
    try:
        val = float(t)
        if any(lo <= val <= hi for lo, hi in _NUMERIC_SIZE_RANGES) or (3.5 <= val <= 16.0) or (35.0 <= val <= 50.0):
            return True
    except ValueError:
        pass
    return False


def _is_area_token(tok: str) -> bool:
    t = tok.strip().lower()
    if not t:
        return False
    return any(k in t for k in _KNOWN_AREA_KEYWORDS)


def _normalize_area_field(area_name: str) -> str | None:
    al = area_name.strip().lower()
    for canonical, syns in _CANONICAL_AREA_SYNONYMS.items():
        if any(s in al for s in syns):
            return canonical
    return None


def _parse_cell_range(cell: str) -> tuple[float, float] | None:
    m = _RANGE_RE.search(cell)
    if m:
        try:
            lo = float(m.group("lo").replace(",", "."))
            hi = float(m.group("hi").replace(",", "."))
            return (min(lo, hi), max(lo, hi))
        except ValueError:
            pass
    nums = _SINGLE_NUM_RE.findall(cell)
    if nums:
        try:
            val = float(nums[0].replace(",", "."))
            return (val, val)
        except ValueError:
            pass
    return None


def _parse_table_grid(text_or_html: str) -> list[list[str]]:
    """Parse HTML table or delimited text into a clean 2D string grid."""
    if not text_or_html:
        return []
    if "<table" in text_or_html.lower() and BeautifulSoup is not None:
        try:
            soup = BeautifulSoup(text_or_html, "html.parser")
            table = soup.find("table")
            if table:
                grid = []
                for tr in table.find_all("tr"):
                    row = [c.get_text(" ", strip=True) for c in tr.find_all(["th", "td"])]
                    if any(row):
                        grid.append(row)
                if len(grid) >= 2:
                    return grid
        except Exception:
            pass

    lines = [ln.strip() for ln in text_or_html.splitlines() if ln.strip()]
    grid = []
    for ln in lines:
        if "\t" in ln:
            cells = [c.strip() for c in ln.split("\t") if c.strip()]
        elif "|" in ln:
            cells = [c.strip() for c in ln.split("|") if c.strip()]
        elif "  " in ln:
            cells = [c.strip() for c in re.split(r"\s{2,}", ln) if c.strip()]
        else:
            cells = [c.strip() for c in ln.split() if c.strip()]
        if cells:
            grid.append(cells)
    return grid


def _classify_table_axes(grid: list[list[str]]) -> str:
    """Decide whether sizes are in top column headers or left row headers."""
    if len(grid) < 2 or len(grid[0]) < 2:
        return "UNKNOWN"
    corner = grid[0][0].strip().lower()
    top_headers = [c.strip() for c in grid[0][1:]]
    left_headers = [grid[r][0].strip() for r in range(1, len(grid)) if len(grid[r]) > 0]

    top_size_score = sum(1.0 for h in top_headers if _is_size_token(h))
    top_area_score = sum(1.0 for h in top_headers if _is_area_token(h))
    left_size_score = sum(1.0 for h in left_headers if _is_size_token(h))
    left_area_score = sum(1.0 for h in left_headers if _is_area_token(h))

    if any(k in corner for k in _CORNER_AREA_HINTS):
        left_area_score += 2.5
        top_size_score += 1.5
    if any(k in corner for k in _CORNER_SIZE_HINTS):
        left_size_score += 2.5
        top_area_score += 1.5

    horizontal_score = top_size_score + left_area_score
    vertical_score = left_size_score + top_area_score

    if horizontal_score > vertical_score and top_size_score > 0:
        return "HORIZONTAL_SIZES"
    if vertical_score >= horizontal_score and left_size_score > 0:
        return "VERTICAL_SIZES"
    return "UNKNOWN"


def _canonicalize_matrix_chart(grid: list[list[str]], orientation: str) -> list[dict[str, Any]]:
    """Transform 2D grid into standard size list with area measurements."""
    sizes: list[dict[str, Any]] = []
    if orientation == "HORIZONTAL_SIZES":
        # Columns are sizes (top_headers = grid[0][1:])
        # Rows are areas (left_headers = grid[1:][0])
        for c in range(1, len(grid[0])):
            label = grid[0][c].strip()
            if not label or label.lower() in _RESERVED_AREA_WORDS or _is_area_token(label):
                continue
            meas: dict[str, tuple[float, float]] = {}
            for r in range(1, len(grid)):
                if c >= len(grid[r]):
                    continue
                area_raw = grid[r][0].strip()
                field = _normalize_area_field(area_raw)
                if not field:
                    continue
                rng = _parse_cell_range(grid[r][c])
                if rng:
                    meas[field] = rng
            if meas:
                sizes.append({"label": label, "measurements": meas, "raw": label})
    elif orientation == "VERTICAL_SIZES":
        # Rows are sizes (left_headers = grid[1:][0])
        # Columns are areas (top_headers = grid[0][1:])
        for r in range(1, len(grid)):
            label = grid[r][0].strip()
            if not label or label.lower() in _RESERVED_AREA_WORDS or _is_area_token(label):
                continue
            meas: dict[str, tuple[float, float]] = {}
            for c in range(1, len(grid[r])):
                if c >= len(grid[0]):
                    continue
                area_raw = grid[0][c].strip()
                field = _normalize_area_field(area_raw)
                if not field:
                    continue
                rng = _parse_cell_range(grid[r][c])
                if rng:
                    meas[field] = rng
            if meas:
                sizes.append({"label": label, "measurements": meas, "raw": label})

    # Flat garment measurement detection (half circumference):
    # In retail apparel (Zara, Shein, etc.), "Product measurements" table cells
    # for chest/waist/hip around 25-55 cm represent half-circumferences.
    all_circ_vals = []
    for s in sizes:
        for f in ("chest", "waist", "hip"):
            if f in s["measurements"]:
                all_circ_vals.append(s["measurements"][f][1])
    is_flat = bool(all_circ_vals and all(v <= 58.0 for v in all_circ_vals))
    if is_flat:
        for s in sizes:
            for f in ("chest", "waist", "hip"):
                if f in s["measurements"]:
                    lo, hi = s["measurements"][f]
                    s["measurements"][f] = (lo * 2.0, hi * 2.0)

    return sizes


def _match_canonical_sizes(
    sizes: list[dict[str, Any]],
    user_measurements: dict[str, Any],
    garment_type: str | None = None,
) -> dict[str, Any] | None:
    if not sizes or not user_measurements:
        return None

    user_vals: dict[str, float] = {}
    for k, v in user_measurements.items():
        if isinstance(v, (int, float)):
            field = _normalize_area_field(str(k))
            if field:
                user_vals[field] = float(v)

    # Footwear check
    if garment_type and garment_type.lower() in _FOOTWEAR_TYPES:
        foot_len_raw = (
            user_measurements.get("foot_length")
            or user_measurements.get("foot_len")
            or user_measurements.get("foot")
        )
        foot_len = float(foot_len_raw) if foot_len_raw and isinstance(foot_len_raw, (int, float, str)) and str(foot_len_raw).replace(".", "", 1).isdigit() else None
        shoe_sz = str(user_measurements.get("shoe_size") or "").strip().upper()

        if foot_len:
            chosen_i = None
            for i, s in enumerate(sizes):
                if "foot_length" in s["measurements"]:
                    lo, hi = s["measurements"]["foot_length"]
                    if lo <= foot_len <= hi or foot_len <= hi:
                        chosen_i = i
                        break
            if chosen_i is not None:
                chosen = sizes[chosen_i]
                smaller_alt = sizes[chosen_i - 1] if chosen_i > 0 else None
                larger_alt = sizes[chosen_i + 1] if chosen_i + 1 < len(sizes) else None
                alts = []
                if smaller_alt:
                    alts.append({"size": smaller_alt["label"].upper(), "fit": "snug"})
                if larger_alt:
                    alts.append({"size": larger_alt["label"].upper(), "fit": "loose"})
                return {
                    "recommended_size": chosen["label"].upper(),
                    "confidence": 0.65,
                    "garment_type": "shoes",
                    "size_chart_units": "cm",
                    "matched_columns": ["foot_length"],
                    "reasoning": f"Heuristic match: your foot length ({foot_len:g} cm) fits size {chosen['label'].upper()}.",
                    "alternatives": alts,
                }
        if shoe_sz:
            for s in sizes:
                if s["label"].upper() == shoe_sz or shoe_sz in s["label"].upper():
                    return {
                        "recommended_size": s["label"].upper(),
                        "confidence": 0.65,
                        "garment_type": "shoes",
                        "size_chart_units": "cm",
                        "matched_columns": ["shoe_size"],
                        "reasoning": f"Heuristic match: size {s['label'].upper()} matches your standard shoe size ({shoe_sz}).",
                        "alternatives": [],
                    }

    if not user_vals:
        # Fallback to usual size label match
        usual_size = str(user_measurements.get("shirt_size") or user_measurements.get("pants_size") or "").strip().upper()
        if usual_size:
            for s in sizes:
                if s["label"].upper() == usual_size:
                    return {
                        "recommended_size": s["label"].upper(),
                        "confidence": 0.55,
                        "garment_type": garment_type or "apparel",
                        "size_chart_units": "cm",
                        "matched_columns": ["usual_size"],
                        "reasoning": f"Heuristic match: size {s['label'].upper()} matches your standard size ({usual_size}).",
                        "alternatives": [],
                    }
        return None

    # Apparel matching
    category = _detect_category(garment_type, "")
    if category == "upper":
        relevant = [f for f in ("chest", "shoulder") if f in user_vals]
    elif category == "lower":
        relevant = [f for f in ("waist", "hip", "inseam") if f in user_vals]
    else:
        relevant = [f for f in ("chest", "waist", "hip") if f in user_vals]

    if not relevant:
        relevant = list(user_vals.keys())

    chosen_i = None
    EASE_CM = 1.5

    for i, s in enumerate(sizes):
        fits_all = True
        checked_any = False
        for f in relevant:
            if f in s["measurements"]:
                checked_any = True
                _, hi = s["measurements"][f]
                u_val = user_vals[f]
                if f in ("length", "inseam"):
                    continue
                if u_val > hi + EASE_CM:
                    fits_all = False
                    break
        if fits_all and checked_any:
            chosen_i = i
            break

    if chosen_i is None:
        chosen_i = len(sizes) - 1

    chosen = sizes[chosen_i]
    smaller_alt = sizes[chosen_i - 1] if chosen_i > 0 else None
    larger_alt = sizes[chosen_i + 1] if chosen_i + 1 < len(sizes) else None

    alts = []
    if smaller_alt:
        alts.append({"size": smaller_alt["label"].upper(), "fit": "snug"})
    if larger_alt:
        alts.append({"size": larger_alt["label"].upper(), "fit": "loose"})

    matched_cols = [f for f in relevant if f in chosen["measurements"]]
    primary_field = matched_cols[0] if matched_cols else "measurements"

    if len(matched_cols) >= 2:
        reason = (
            f"Heuristic match: size {chosen['label'].upper()} comfortably accommodates both your "
            f"{matched_cols[0]} ({user_vals[matched_cols[0]]:g} cm) and {matched_cols[1]} ({user_vals[matched_cols[1]]:g} cm)."
        )
    else:
        reason = f"Heuristic match: size {chosen['label'].upper()} fits your {primary_field} ({user_vals.get(primary_field, 0):g} cm)."

    return {
        "recommended_size": chosen["label"].upper(),
        "confidence": 0.65,
        "garment_type": garment_type or ("shirt" if category == "upper" else ("pants" if category == "lower" else "dress")),
        "size_chart_units": "cm",
        "matched_columns": matched_cols,
        "reasoning": reason,
        "alternatives": alts,
    }


def _heuristic_match(
    *,
    chart_text: str,
    measurements: dict[str, Any],
    garment_type: str | None = None,
) -> dict[str, Any] | None:
    """Last-resort: regex match against the chart text. Evaluates
    measurements strictly relevant to the garment category (e.g. chest
    for upper-body tops, foot length for shoes, waist/hip for pants)."""
    if not chart_text or not measurements:
        return None

    # --- Phase 1: Flexible 2D Table Matrix Engine ---
    grid = _parse_table_grid(chart_text)
    if len(grid) >= 2 and len(grid[0]) >= 2:
        orientation = _classify_table_axes(grid)
        if orientation in ("HORIZONTAL_SIZES", "VERTICAL_SIZES"):
            canonical_sizes = _canonicalize_matrix_chart(grid, orientation)
            if canonical_sizes:
                rec = _match_canonical_sizes(canonical_sizes, measurements, garment_type)
                if rec is not None:
                    return rec

    category = _detect_category(garment_type, chart_text)

    label_re = re.compile(r"^\s*([A-Za-z0-9./-]{1,12})\b")
    HEADER_TOKENS = {
        "size", "us", "uk", "eu", "cm", "in", "inches", "centimeters", "jp", "cn",
    }
    headers: list[str] | None = None
    rows: list[dict[str, Any]] = []

    for ln in chart_text.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        if not _RANGE_RE.search(ln) and not re.search(r"\d{2,}", ln):
            tokens = [
                t.strip().lower()
                for t in re.split(r"\t|\s{2,}|\|", ln)
                if t.strip()
            ]
            kw_hits = sum(
                1 for t in tokens
                if any(k in t for k in (
                    "chest", "bust", "waist", "hip", "hips", "shoulder",
                    "inseam", "sleeve", "length", "foot", "insole",
                ))
                or t in HEADER_TOKENS
            )
            if kw_hits >= 2 and headers is None:
                headers = tokens
                continue
        m = label_re.match(ln)
        if not m:
            continue
        label = m.group(1)
        if (
            label.lower() in HEADER_TOKENS
            or label.lower() == "size:"
            or label.lower() in _RESERVED_AREA_WORDS
            or _is_area_token(label)
        ):
            continue
        ranges: list[tuple[float, float]] = []
        for lo_s, hi_s in _RANGE_RE.findall(ln):
            try:
                lo_f = float(lo_s.replace(",", "."))
                hi_f = float(hi_s.replace(",", "."))
                if hi_f >= lo_f:
                    ranges.append((lo_f, hi_f))
            except ValueError:
                continue
        if not ranges:
            tail = ln[m.end():]
            for n_s in _SINGLE_NUM_RE.findall(tail):
                try:
                    n_f = float(n_s.replace(",", "."))
                    ranges.append((n_f, n_f))
                except ValueError:
                    continue
        if ranges:
            rows.append({"label": label, "ranges": ranges, "raw": ln})
    if not rows:
        return None

    ncols = max(len(r["ranges"]) for r in rows)
    columns: list[list[tuple[float, float]]] = [[] for _ in range(ncols)]
    for r in rows:
        for j, rng in enumerate(r["ranges"]):
            if j < ncols:
                columns[j].append(rng)

    # -------------------------------------------------------------
    # 1. FOOTWEAR SIZING
    # -------------------------------------------------------------
    if category == "footwear":
        foot_len_raw = (
            measurements.get("foot_length")
            or measurements.get("foot_len")
            or measurements.get("foot")
            or measurements.get("foot_length_cm")
        )
        foot_len = float(foot_len_raw) if foot_len_raw and isinstance(foot_len_raw, (int, float, str)) and str(foot_len_raw).replace(".", "", 1).isdigit() else None
        shoe_sz = str(measurements.get("shoe_size") or "").strip().upper()

        if not foot_len and not shoe_sz:
            return None

        # Try matching foot length in cm column (typically values between 18 and 34 cm)
        foot_col = -1
        if headers:
            for j, h in enumerate(headers):
                if any(k in h.lower() for k in ("foot", "insole", "cm", "heel", "length")):
                    foot_col = j
                    break
        if foot_col < 0 or foot_col >= ncols:
            for j in range(ncols):
                col_maxes = [hi for r in rows if j < len(r["ranges"]) for _, hi in [r["ranges"][j]]]
                if col_maxes and all(18.0 <= v <= 34.0 for v in col_maxes):
                    foot_col = j
                    break

        if foot_len and foot_col >= 0:
            chosen_i = None
            # Find the best row where foot length fits the bracket [lo, hi]
            for i, r in enumerate(rows):
                if foot_col < len(r["ranges"]):
                    lo, hi = r["ranges"][foot_col]
                    if lo <= foot_len <= hi:
                        chosen_i = i
                        break
                    elif foot_len <= hi:
                        chosen_i = i
                        break
            if chosen_i is None:
                chosen_i = len(rows) - 1

            chosen = rows[chosen_i]
            smaller_alt = rows[chosen_i - 1] if chosen_i > 0 else None
            larger_alt = rows[chosen_i + 1] if chosen_i + 1 < len(rows) else None
            alts = []
            if smaller_alt:
                alts.append({"size": smaller_alt["label"].upper(), "fit": "snug"})
            if larger_alt:
                alts.append({"size": larger_alt["label"].upper(), "fit": "loose"})

            reason = f"Heuristic match: your foot length ({foot_len:g} cm) fits size {chosen['label'].upper()}."
            return {
                "recommended_size": chosen["label"].upper(),
                "confidence": 0.65,
                "garment_type": "shoes",
                "size_chart_units": "cm",
                "matched_columns": ["foot_length"],
                "reasoning": reason,
                "alternatives": alts,
            }

        if shoe_sz:
            for r in rows:
                if (
                    r["label"].upper() == shoe_sz
                    or shoe_sz in r["label"].upper()
                    or re.search(r"\b" + re.escape(shoe_sz) + r"\b", r["raw"].upper())
                ):
                    return {
                        "recommended_size": r["label"].upper(),
                        "confidence": 0.60,
                        "garment_type": "shoes",
                        "size_chart_units": "cm",
                        "matched_columns": ["shoe_size"],
                        "reasoning": f"Heuristic match: size {r['label'].upper()} matches your standard shoe size ({shoe_sz}).",
                        "alternatives": [],
                    }
        return None

    # -------------------------------------------------------------
    # 2. APPAREL SIZING (Upper-Body, Lower-Body, Full-Body)
    # -------------------------------------------------------------
    # Filter user measurements by category so irrelevant parts NEVER constrain fit.
    if category == "upper":
        ALLOWED_FIELDS = ("chest", "bust", "shoulder", "shoulders", "sleeve", "length", "neck")
        FALLBACK_SIZE_KEY = "shirt_size"
    elif category == "lower":
        ALLOWED_FIELDS = ("waist", "hip", "hips", "inseam", "outseam", "thigh")
        FALLBACK_SIZE_KEY = "pants_size"
    else:  # full or unknown
        ALLOWED_FIELDS = ("chest", "bust", "waist", "hip", "hips", "shoulder", "shoulders", "length", "inseam")
        FALLBACK_SIZE_KEY = "shirt_size"

    user_vals: dict[str, float] = {}
    for k, v in measurements.items():
        if not isinstance(v, (int, float)):
            continue
        kl = str(k).lower().strip()
        for f in ALLOWED_FIELDS:
            if f == kl or (f in kl and "length" not in kl and "size" not in kl):
                user_vals[f] = float(v)
                break

    # Fallback to clothing size if no body tape measurements
    if not user_vals:
        usual_size = str(measurements.get(FALLBACK_SIZE_KEY) or "").strip().upper()
        if usual_size:
            for r in rows:
                if (
                    r["label"].upper() == usual_size
                    or usual_size in r["label"].upper()
                    or re.search(r"\b" + re.escape(usual_size) + r"\b", r["raw"].upper())
                ):
                    return {
                        "recommended_size": r["label"].upper(),
                        "confidence": 0.55,
                        "garment_type": garment_type or ("shirt" if category == "upper" else "pants"),
                        "size_chart_units": "cm",
                        "matched_columns": [FALLBACK_SIZE_KEY],
                        "reasoning": f"Heuristic match: size {r['label'].upper()} matches your usual size ({usual_size}).",
                        "alternatives": [],
                    }
        return None

    _FIELD_SYNONYMS: dict[str, tuple[str, ...]] = {
        "chest":     ("chest", "bust"),
        "bust":      ("bust", "chest"),
        "waist":     ("waist",),
        "hip":       ("hip", "hips"),
        "hips":      ("hip", "hips"),
        "shoulder":  ("shoulder", "shoulders", "across shoulder"),
        "shoulders": ("shoulder", "shoulders", "across shoulder"),
        "inseam":    ("inseam", "inside leg"),
        "sleeve":    ("sleeve", "sleeve length"),
        "length":    ("length", "back length", "body length"),
        "thigh":     ("thigh",),
        "neck":      ("neck",),
    }

    def _header_index_for(field: str) -> int:
        if not headers:
            return -1
        body = list(headers)
        if body and (body[0] in HEADER_TOKENS or "size" in body[0]):
            body = body[1:]
        synonyms = _FIELD_SYNONYMS.get(field.lower(), (field.lower(),))
        for j, htext in enumerate(body):
            for syn in synonyms:
                if syn in htext:
                    return j
        return -1

    col_ranks: list[int] = sorted(
        range(ncols),
        key=lambda j: (
            min(lo for lo, _ in columns[j]) if columns[j] else float("inf")
        ),
    )
    _FIELD_RANK = {
        "waist": 0,
        "chest": 1, "bust": 1,
        "shoulders": 1, "shoulder": 1,
        "inseam": 1,
        "hip": 2, "hips": 2,
    }

    def _assign_column(field: str, v: float) -> int:
        idx = _header_index_for(field)
        if 0 <= idx < ncols:
            ranges = columns[idx]
            if ranges:
                col_max = max(hi for _, hi in ranges)
                if col_max >= v:
                    return idx
        if not headers:  # Only do rank fallback when there were no headers
            rank = _FIELD_RANK.get(field.lower(), 1)
            if rank >= len(col_ranks):
                rank = len(col_ranks) - 1
            candidate = col_ranks[rank]
            ranges = columns[candidate]
            if ranges and max(hi for _, hi in ranges) >= v:
                return candidate
            for j, rng_list in enumerate(columns):
                if rng_list and max(hi for _, hi in rng_list) >= v:
                    return j
        return -1

    field_to_col: dict[str, int] = {
        f: _assign_column(f, v) for f, v in user_vals.items()
    }

    # Pick the primary anchor field appropriately
    if category == "upper":
        primary_field = next((f for f in ("chest", "bust", "shoulders", "shoulder") if f in user_vals), next(iter(user_vals)))
    elif category == "lower":
        primary_field = next((f for f in ("waist", "hip", "hips") if f in user_vals), next(iter(user_vals)))
    else:
        primary_field = next((f for f in ("chest", "bust", "waist", "hip") if f in user_vals), next(iter(user_vals)))

    # If primary field could not map to a column and we have columns, pick candidate column for primary field
    if field_to_col.get(primary_field, -1) < 0 and ncols > 0:
        for j, rng_list in enumerate(columns):
            if rng_list and max(hi for _, hi in rng_list) >= user_vals[primary_field]:
                field_to_col[primary_field] = j
                break

    TIE_BUFFER_CM = 0.5

    def _row_accommodates(row: dict[str, Any]) -> bool:
        checked_any = False
        for f, v in user_vals.items():
            j = field_to_col.get(f, -1)
            if j < 0 or j >= len(row["ranges"]):
                continue
            checked_any = True
            _, hi = row["ranges"][j]
            if v > hi:
                return False
        return checked_any

    def _row_is_tight(row: dict[str, Any]) -> bool:
        for f, v in user_vals.items():
            j = field_to_col.get(f, -1)
            if j < 0 or j >= len(row["ranges"]):
                continue
            lo, hi = row["ranges"][j]
            if hi == lo:
                continue
            if lo <= v <= hi and (hi - v) < TIE_BUFFER_CM:
                return True
        return False

    chosen_i: int | None = None
    for i, r in enumerate(rows):
        if _row_accommodates(r):
            chosen_i = i
            break

    bumped = False
    if chosen_i is None:
        chosen_i = len(rows) - 1
    elif _row_is_tight(rows[chosen_i]) and chosen_i + 1 < len(rows):
        chosen_i += 1
        bumped = True

    user_anchor_val = user_vals[primary_field]
    chosen = rows[chosen_i]
    smaller_alt = rows[chosen_i - 1] if chosen_i > 0 else None

    # For full-body/sets, check if multiple dimensions constrained the size
    if category == "full":
        upper_f = next((f for f in ("chest", "bust", "shoulders", "shoulder") if f in user_vals and field_to_col.get(f, -1) >= 0), None)
        lower_f = next((f for f in ("waist", "hip", "hips") if f in user_vals and field_to_col.get(f, -1) >= 0), None)
        if upper_f and lower_f:
            reason = (
                f"Heuristic match: size {chosen['label'].upper()} comfortably accommodates both your "
                f"top ({upper_f} {user_vals[upper_f]:g} cm) and bottom ({lower_f} {user_vals[lower_f]:g} cm)."
            )
        elif bumped:
            reason = (
                f"Heuristic match: your {primary_field} ({user_anchor_val:g} cm) is right "
                f"at the upper edge of the smaller size, so DressApp recommends "
                f"the slightly bigger size {chosen['label'].upper()}."
            )
        else:
            reason = (
                f"Heuristic match: your measurements fit the {chosen['label'].upper()} row."
            )
    elif bumped:
        reason = (
            f"Heuristic match: your {primary_field} ({user_anchor_val:g} cm) is right "
            f"at the upper edge of the smaller size, so DressApp recommends "
            f"the slightly bigger size {chosen['label'].upper()}."
        )
    else:
        reason = (
            f"Heuristic match: your {primary_field} ({user_anchor_val:g} cm) fits "
            f"the {chosen['label'].upper()} row."
        )

    alternatives: list[dict[str, Any]] = []
    if bumped and smaller_alt is not None:
        alternatives.append({
            "size": smaller_alt["label"].upper(),
            "fit": "snug",
        })

    matched_cols = [f for f, j in field_to_col.items() if j >= 0]
    if not matched_cols:
        matched_cols = [primary_field]

    return {
        "recommended_size": chosen["label"].upper(),
        "confidence": 0.55,
        "garment_type": garment_type or ("shirt" if category == "upper" else ("pants" if category == "lower" else "unknown")),
        "size_chart_units": "cm",
        "matched_columns": matched_cols,
        "reasoning": reason,
        "alternatives": alternatives,
    }


# --------------------------- vision call -----------------------------
async def _via_gemini_vision(
    *,
    system_prompt: str,
    user_text: str,
    image_b64: str,
    timeout_s: float = 30.0,
    api_key: str | None = None,
    model: str = "gemini-3.5-flash",
) -> str:
    """Direct Gemini multimodal call.

    Mirrors the closet pipeline's ``GarmentVisionService.analyze``
    Gemini branch — the only multimodal route we know works on this
    deployment. The self-hosted Gemma Space runs in
    ``vision_disabled`` Phase-1 mode and would always return an
    empty completion if we tried it for OCR.

    Raises ``RuntimeError`` if Gemini is unreachable or ``google-genai``
    is not installed.
    """
    if not _HAS_GEMINI_CLIENT or GeminiClient is None:
        raise RuntimeError(
            "Gemini vision unavailable: google-genai not installed."
        )
    key = api_key or settings.GEMINI_API_KEY
    if not key:
        raise RuntimeError(
            "Gemini vision unavailable: no GEMINI_API_KEY."
        )

    client = GeminiClient(api_key=key)
    # Convert the legacy base64 payload back to bytes so the wrapper
    # can wrap it in a ``types.Part``. The chart screenshot is JPEG.
    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            f"size-chart screenshot is not valid base64: {exc}"
        ) from exc
    raw = await asyncio.wait_for(
        client.vision(
            system=system_prompt,
            user_parts=[user_text, image_bytes],
            model=model,
        ),
        timeout=timeout_s,
    )
    return raw or ""


# ------------------------------ route --------------------------------
@router.post("/analyze-chart", response_model=AnalyzeChartOut)
async def analyze_chart(
    payload: AnalyzeChartIn,
    user: dict = Depends(get_current_user),
) -> AnalyzeChartOut:
    t0 = time.time()
    from app.services.auth import resolve_user_gemini_api_key, resolve_user_gemini_model
    user_api_key = resolve_user_gemini_api_key(user)
    user_model = resolve_user_gemini_model(user)

    measurements = (user or {}).get("body_measurements") or {}
    has_measurements = bool(measurements)
    if not has_measurements:
        log.info(
            "size analyze called without measurements (user=%s)",
            (user or {}).get("id"),
        )

    # Back-compat: derive a chart_text blob from the optional HTML
    # field for the heuristic only. Vision uses the image directly.
    chart_text_html = ""
    chart_text_innertext = ""
    if payload.chart_html:
        chart_text_html = _html_to_text(payload.chart_html)
    if payload.chart_text:
        chart_text_innertext = payload.chart_text.strip()[:8000]

    # Pick the best single chart_text for the optional LLM hint.
    def _row_density(t: str) -> int:
        if not t:
            return 0
        return sum(1 for ln in t.splitlines() if re.search(r"\d{2,}", ln))

    if _row_density(chart_text_innertext) > _row_density(chart_text_html):
        chart_text = chart_text_innertext
    else:
        chart_text = chart_text_html or chart_text_innertext

    if not chart_text and not payload.chart_screenshot_b64:
        raise HTTPException(
            status_code=422,
            detail="Provide a chart_screenshot_b64 (or, for back-compat, chart_html / chart_text).",
        )

    parsed: dict[str, Any] | None = None
    source = "fallback"
    last_error: str | None = None

    # ---------------------------------------------------------------
    # Step 1 — Gemini 2.5 Flash vision OCR + sizing in one shot.
    # The screenshot/crop is the absolute source of truth! If a screenshot
    # is provided, we MUST prioritize Vision over text heuristics because
    # DOM text extraction often picks up unrelated product specs or body
    # text (e.g. random sizes on the page).
    # ---------------------------------------------------------------
    candidate_texts: list[str] = []
    for t in (chart_text, chart_text_html, chart_text_innertext):
        if t and t not in candidate_texts:
            candidate_texts.append(t)
    for cand in candidate_texts:
        decided = _heuristic_match(
            chart_text=cand,
            measurements=measurements,
            garment_type=payload.garment_type,
        )
        if decided is not None:
            parsed = decided
            source = "heuristic"
            log.info(
                "size-chart resolved by heuristic in %d ms",
                int((time.time() - t0) * 1000),
            )
            break

    # ---------------------------------------------------------------
    # Step 2 — Gemini 2.5 Flash vision OCR + sizing in one shot.
    # The screenshot is the source of truth. Gemini reads the chart,
    # matches the user's measurements, and emits the JSON answer.
    # ---------------------------------------------------------------
    if parsed is None and payload.chart_screenshot_b64:
        user_prompt = _build_user_prompt(
            measurements=measurements,
            garment_type=payload.garment_type,
            store=payload.store,
            page_title=payload.page_title,
            user_preferred_units=payload.user_preferred_units,
            chart_text=chart_text or None,
        )
        t_vision = time.time()
        try:
            raw = await _via_gemini_vision(
                system_prompt=_SYSTEM_PROMPT,
                user_text=user_prompt,
                image_b64=payload.chart_screenshot_b64,
                timeout_s=30.0,
                api_key=user_api_key,
                model=user_model,
            )
            parsed = _coerce_response(raw)
            if parsed:
                source = "gemini"
            provider_activity.record(
                "garment-vision",
                ok=parsed is not None,
                latency_ms=int((time.time() - t_vision) * 1000),
                error=None if parsed else "non-JSON or empty Gemini reply",
                extra={
                    "provider": "gemini",
                    "model": user_model,
                    "op": "size-chart",
                },
            )
            if not parsed:
                last_error = (
                    "Gemini returned a non-JSON or empty reply; raw preview: "
                    + (raw or "")[:200]
                )
        except asyncio.TimeoutError:
            last_error = "Gemini vision call timed out (>30 s)."
            provider_activity.record(
                "garment-vision",
                ok=False,
                error="timeout",
                latency_ms=int((time.time() - t_vision) * 1000),
                extra={"provider": "gemini", "op": "size-chart"},
            )
        except Exception as exc:  # noqa: BLE001
            last_error = f"Gemini vision: {str(exc)[:240]}"
            provider_activity.record(
                "garment-vision",
                ok=False,
                error=repr(exc)[:240],
                latency_ms=int((time.time() - t_vision) * 1000),
                extra={"provider": "gemini", "op": "size-chart"},
            )
            log.info("Gemini vision call failed: %s", exc)

    # ---------------------------------------------------------------
    # Step 2 — heuristic regex fallback (free, deterministic, instant).
    # Only fires if Gemini vision wasn't available or didn't return a match.
    # ---------------------------------------------------------------
    if parsed is None:
        candidate_texts: list[str] = []
        for t in (chart_text, chart_text_html, chart_text_innertext):
            if t and t not in candidate_texts:
                candidate_texts.append(t)
        for cand in candidate_texts:
            decided = _heuristic_match(
                chart_text=cand,
                measurements=measurements,
                garment_type=payload.garment_type,
            )
            if decided is not None:
                parsed = decided
                source = "heuristic"
                log.info(
                    "size-chart resolved by heuristic in %d ms",
                    int((time.time() - t0) * 1000),
                )
                break

    # ---------------------------------------------------------------
    # Step 2.5 — Gemini 2.5 Flash text completion fallback.
    # Used when we don't have a screenshot (e.g., in bookmarklet mode)
    # but we do have raw chart text or HTML.
    # ---------------------------------------------------------------
    if parsed is None and (chart_text or chart_text_html or chart_text_innertext):
        combined_text = "\n".join(
            t for t in (chart_text, chart_text_html, chart_text_innertext) if t
        )
        if len(combined_text.strip()) > 5:
            user_prompt = _build_user_text_only_prompt(
                measurements=measurements,
                garment_type=payload.garment_type,
                store=payload.store,
                page_title=payload.page_title,
                user_preferred_units=payload.user_preferred_units,
                chart_text=combined_text,
            )
            log.info("Gemini text-only fallback: combined_text len=%d, snippet=%r", len(combined_text), combined_text[:200])
            t_text = time.time()
            try:
                client = GeminiClient(api_key=user_api_key or settings.GEMINI_API_KEY)
                raw = await asyncio.wait_for(
                    client.text(
                        user_text=user_prompt,
                        system=_SYSTEM_PROMPT,
                        model=user_model,
                        response_mime_type="application/json",
                    ),
                    timeout=30.0,
                )
                parsed = _coerce_response(raw)
                if parsed:
                    source = "gemini-text"
                provider_activity.record(
                    "garment-text",
                    ok=parsed is not None,
                    latency_ms=int((time.time() - t_text) * 1000),
                    extra={"provider": "gemini", "op": "size-chart-text", "model": user_model},
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("Gemini text-only fallback failed: %r (after %d ms)", exc, int((time.time() - t_text) * 1000))

    # Deduct credit and count usage if we used any Gemini engine
    if source in ("gemini-text", "gemini-vision") or (parsed is None and source != "heuristic"):
        try:
            from app.db.database import get_db
            from app.services.billing_service import deduct_user_credits
            if not await deduct_user_credits(get_db(), user, cost=1):
                from app.services.credit_manager import make_insufficient_credits_exception
                raise make_insufficient_credits_exception(user, cost=1)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            log.exception("Failed to deduct user credits for size-chart analysis: %s", exc)

    # ---------------------------------------------------------------
    # Step 3 — total failure. Surface a friendly retry message.
    # ---------------------------------------------------------------
    if parsed is None:
        why_parts: list[str] = []
        if last_error:
            why_parts.append(
                "DressApp couldn't read this chart"
                + (
                    f" ({last_error})"
                    if "not configured" in last_error.lower()
                    or "not installed" in last_error.lower()
                    else "."
                )
            )
        else:
            why_parts.append(
                "DressApp couldn't read this chart from the image."
            )
        why_parts.append(
            "Try cropping the chart more tightly (just the table area), "
            "or open the page on a different device."
        )
        return AnalyzeChartOut(
            recommended_size=None,
            confidence=0.0,
            garment_type=payload.garment_type,
            size_chart_units=None,
            matched_columns=[],
            reasoning=" ".join(why_parts),
            alternatives=[],
            warnings=[],
            source="none",
            elapsed_ms=int((time.time() - t0) * 1000),
            has_measurements=has_measurements,
        )

    return _normalise(
        parsed,
        source=source,
        elapsed_ms=int((time.time() - t0) * 1000),
        has_measurements=has_measurements,
    )



_STORE_DOMAINS: dict[str, str] = {
    "zara.com": "Zara",
    "asos.com": "ASOS",
    "hm.com": "H&M",
    "shein.com": "SHEIN",
    "mango.com": "Mango",
    "uniqlo.com": "Uniqlo",
    "amazon": "Amazon",
    "aliexpress": "AliExpress",
    "farfetch.com": "Farfetch",
    "cos.com": "COS",
    "aritzia.com": "Aritzia",
    "nordstrom.com": "Nordstrom",
    "zalando": "Zalando",
    "boohoo.com": "Boohoo",
    "pullandbear.com": "Pull&Bear",
    "bershka.com": "Bershka",
    "stradivarius.com": "Stradivarius",
    "massimodutti.com": "Massimo Dutti",
    "urbanoutfitters.com": "Urban Outfitters",
}


def _clean_shared_url(raw_url: str, text: str | None = None) -> str:
    combined = f"{raw_url or ''} {text or ''}".strip()
    match = re.search(r"https?://[^\s\"'<>]+", combined)
    url = match.group(0) if match else (raw_url or "").strip()
    try:
        from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
        parsed = urlparse(url)
        qsl = parse_qsl(parsed.query)
        clean_qsl = [
            (k, v) for k, v in qsl
            if not k.lower().startswith("utm_") and k.lower() not in ("fbclid", "gclid", "igshid", "ref", "aff_platform")
        ]
        return urlunparse(parsed._replace(query=urlencode(clean_qsl)))
    except Exception:
        return url


def _detect_store_name(url: str) -> str:
    from urllib.parse import urlparse
    try:
        host = urlparse(url).netloc.lower()
        for domain, name in _STORE_DOMAINS.items():
            if domain in host:
                return name
        parts = host.replace("www.", "").split(".")
        if parts and parts[0]:
            return parts[0].capitalize()
    except Exception:
        pass
    return "Retailer"


async def _extract_product_from_url(
    url: str,
    title_hint: str | None = None,
) -> tuple[ProductPreview, str | None, str | None]:
    """Scrapes product details, size tables, and images from a shared retail URL."""
    from urllib.parse import urlparse, urljoin
    from bs4 import BeautifulSoup
    import httpx

    clean_url = _clean_shared_url(url)
    store = _detect_store_name(clean_url)

    # Derive fallback title from slug
    parsed = urlparse(clean_url)
    path_parts = [p for p in parsed.path.split("/") if p and not p.isdigit() and len(p) > 2]
    slug = path_parts[-1] if path_parts else ""
    slug = re.sub(r"\.(html?|php|aspx?)$", "", slug, flags=re.I)
    slug = re.sub(r"[-_]+", " ", slug)
    slug = re.sub(r"\b[pP]?\d+\b", "", slug).strip()
    fallback_title = title_hint or (slug.title() if len(slug) > 3 else f"{store} Item")

    garment_type = None
    slug_lower = (fallback_title + " " + clean_url).lower()
    for kw, gtype in [
        ("shirt", "shirt"), ("t-shirt", "t-shirt"), ("tee", "t-shirt"),
        ("dress", "dress"), ("jacket", "jacket"), ("coat", "coat"),
        ("hoodie", "hoodie"), ("sweater", "sweater"), ("pants", "pants"),
        ("jeans", "jeans"), ("trousers", "pants"), ("shoes", "shoes"),
        ("sneakers", "shoes"), ("boots", "boots"), ("skirt", "skirt"),
        ("shorts", "shorts"), ("blazer", "blazer"),
    ]:
        if kw in slug_lower:
            garment_type = gtype
            break

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    title = fallback_title
    image_url = None
    price = None
    currency = "$"
    chart_text = None
    chart_image_url = None

    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=headers) as client:
            resp = await client.get(clean_url)
            if resp.status_code < 400 and "text/html" in resp.headers.get("content-type", ""):
                soup = BeautifulSoup(resp.text, "html.parser")

                # Title
                og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "twitter:title"})
                if og_title and og_title.get("content"):
                    t_cand = og_title["content"].strip()
                    t_cand = re.sub(r"\s*[\|\-–]\s*.*$", "", t_cand).strip()
                    if t_cand:
                        title = t_cand
                elif soup.title and soup.title.string:
                    t_cand = re.sub(r"\s*[\|\-–]\s*.*$", "", soup.title.string).strip()
                    if t_cand:
                        title = t_cand

                # Image
                og_img = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "twitter:image"})
                if og_img and og_img.get("content"):
                    image_url = og_img["content"].strip()
                elif schema_img := soup.find("link", rel="image_src"):
                    image_url = schema_img.get("href")

                # Price
                og_price = soup.find("meta", property="product:price:amount") or soup.find("meta", property="og:price:amount")
                if og_price and og_price.get("content"):
                    price = og_price["content"].strip()
                og_curr = soup.find("meta", property="product:price:currency") or soup.find("meta", property="og:price:currency")
                if og_curr and og_curr.get("content"):
                    currency = og_curr["content"].strip()

                # Size Chart Detection
                size_hints = ["size", "chest", "bust", "waist", "hip", "hips", "length", "insole", "foot"]
                tables = soup.find_all("table")
                best_table = None
                best_table_score = 0
                for tbl in tables:
                    txt = tbl.get_text(" ", strip=True).lower()
                    score = sum(10 for h in size_hints if h in txt)
                    if score > best_table_score:
                        best_table_score = score
                        best_table = tbl

                if best_table and best_table_score >= 20:
                    rows = []
                    for tr in best_table.find_all("tr"):
                        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["th", "td"])]
                        if cells:
                            rows.append(" | ".join(cells))
                    chart_text = "\n".join(rows)

                if not chart_text:
                    for el in soup.find_all(attrs={"class": re.compile(r"size[-_]?(guide|chart|table|info)", re.I)}):
                        txt = el.get_text("\n", strip=True)
                        if len(txt) > 30 and any(h in txt.lower() for h in size_hints):
                            chart_text = txt[:3000]
                            break

                for img in soup.find_all("img"):
                    alt = (img.get("alt") or "").lower()
                    src = (img.get("src") or img.get("data-src") or "").lower()
                    if ("size" in alt or "size" in src) and ("chart" in alt or "guide" in alt or "chart" in src or "guide" in src):
                        chart_image_url = img.get("src") or img.get("data-src")
                        if chart_image_url and not chart_image_url.startswith("http"):
                            chart_image_url = urljoin(clean_url, chart_image_url)
                        break

                if not garment_type:
                    combined_info = f"{title} {soup.find('meta', attrs={'name': 'description'}) or ''}".lower()
                    for kw, gtype in [
                        ("shirt", "shirt"), ("t-shirt", "t-shirt"), ("dress", "dress"),
                        ("jacket", "jacket"), ("pants", "pants"), ("jeans", "jeans"),
                        ("shoes", "shoes"), ("boots", "boots"), ("skirt", "skirt"),
                        ("hoodie", "hoodie"), ("coat", "coat"),
                    ]:
                        if kw in combined_info:
                            garment_type = gtype
                            break

    except Exception as exc:
        log.warning("Could not scrape %s: %s", clean_url, exc)

    preview = ProductPreview(
        url=clean_url,
        title=title,
        brand=store,
        image_url=image_url,
        price=price,
        currency=currency,
        garment_type=garment_type,
        store=store,
    )
    return preview, chart_text, chart_image_url


@router.post("/analyze-url", response_model=AnalyzeUrlOut)
async def analyze_url(
    payload: AnalyzeUrlIn,
    user: dict = Depends(get_current_user),
) -> AnalyzeUrlOut:
    """Analyze a shared retail product URL (from OS share sheet or link paste) and recommend size."""
    t0 = time.time()
    from app.services.auth import resolve_user_gemini_api_key, resolve_user_gemini_model
    user_api_key = resolve_user_gemini_api_key(user)
    user_model = resolve_user_gemini_model(user)

    measurements = (user or {}).get("body_measurements") or {}
    has_measurements = bool(measurements)

    clean_url = _clean_shared_url(payload.url, payload.text)
    if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A valid HTTP or HTTPS product URL is required.",
        )

    product, chart_text, chart_image_url = await _extract_product_from_url(clean_url, payload.title)

    parsed: dict[str, Any] | None = None
    source = "none"

    # Step 1: Heuristic match on extracted chart table/text
    if chart_text:
        parsed = _heuristic_match(
            chart_text=chart_text,
            measurements=measurements,
            garment_type=product.garment_type,
        )
        if parsed:
            source = "heuristic"

    # Step 2: Gemini text-only fallback if text available but heuristic inconclusive
    if parsed is None and chart_text and GeminiClient is not None:
        try:
            user_prompt = _build_user_text_only_prompt(
                measurements=measurements,
                garment_type=product.garment_type,
                store=product.store,
                page_title=product.title,
                user_preferred_units=payload.user_preferred_units,
                chart_text=chart_text,
            )
            g_client = GeminiClient(api_key=user_api_key or settings.GEMINI_API_KEY)
            raw = await asyncio.wait_for(
                g_client.text(
                    user_text=user_prompt,
                    system=_SYSTEM_PROMPT,
                    model=user_model,
                    response_mime_type="application/json",
                ),
                timeout=25.0,
            )
            parsed = _coerce_response(raw)
            if parsed:
                source = "gemini-text"
        except Exception as exc:
            log.warning("Gemini text analysis of URL chart failed: %s", exc)

    # Step 3: Handle result or graceful fallback
    if parsed is not None:
        rec = _normalise(
            parsed,
            source=source,
            elapsed_ms=int((time.time() - t0) * 1000),
            has_measurements=has_measurements,
        )
    else:
        # Graceful fallback: product info is still preserved so user sees what they shared
        why = (
            f"{product.brand} size chart was not directly detected in public page markup. "
            "Snap or upload a screenshot of the size guide below for an exact fit recommendation!"
        )
        rec = AnalyzeChartOut(
            recommended_size=None,
            confidence=0.0,
            garment_type=product.garment_type,
            size_chart_units=payload.user_preferred_units,
            matched_columns=[],
            reasoning=why,
            alternatives=[],
            warnings=["Size chart requires manual screenshot or text paste."],
            source="none",
            elapsed_ms=int((time.time() - t0) * 1000),
            has_measurements=has_measurements,
        )

    return AnalyzeUrlOut(product=product, recommendation=rec)


# =====================================================================
#  POST /sizes/predict-measurements  —  ML body-measurement predictor
# =====================================================================

# Sizing calculations deterministic lookup / rule-based helpers
def get_mens_shirt_size(chest_cm: float) -> str:
    if chest_cm < 88: return 'XS'
    elif chest_cm < 95: return 'S'   # ~89–94 cm
    elif chest_cm < 103: return 'M'  # ~96–102 cm
    elif chest_cm < 111: return 'L'  # ~104–109 cm
    elif chest_cm < 118: return 'XL' # ~112–117 cm
    else: return 'XXL'

def get_pants_size(waist_cm: float) -> str:
    waist_inches = waist_cm / 2.54
    # Round to closest standard pant waist size
    return str(round(waist_inches))

def get_shoe_size_us_mens(foot_len_cm: float) -> float:
    # Standard formula: US Men's size ≈ (3 * foot length in inches) - 22
    foot_inches = foot_len_cm / 2.54
    size = (3 * foot_inches) - 22
    return round(size * 2) / 2  # Rounds to nearest 0.5 size

def get_shoe_size_us_womens(foot_len_cm: float) -> float:
    # US Women's size is typically US Men's size + 1.5
    foot_inches = foot_len_cm / 2.54
    size = (3 * foot_inches) - 20.5
    return round(size * 2) / 2

def get_shoe_size_eu(foot_len_cm: float) -> int:
    # EU Size formula ≈ (foot length in cm + 1.5) * 1.5
    return round((foot_len_cm + 1.5) * 1.5)

def get_womens_dress_size_us(bust_cm: float, waist_cm: float, hip_cm: float) -> str:
    # US Alpha & Numeric Mapping based on standard ASTM standards
    # Example scale using Waist as primary anchor:
    if waist_cm < 64: return '0 / XS'
    elif waist_cm < 68: return '2 / S'
    elif waist_cm < 72: return '4 / S'
    elif waist_cm < 76: return '6 / M'
    elif waist_cm < 80: return '8 / M'
    elif waist_cm < 85: return '10 / L'
    elif waist_cm < 90: return '12 / L'
    else: return '14+ / XL'

def get_bra_size(bust_cm: float, underbust_cm: float) -> str:
    # Convert to inches
    bust_in = bust_cm / 2.54
    underbust_in = underbust_cm / 2.54
    
    # 1. Calculate Band Size (Round underbust to nearest even integer)
    band_size = round(underbust_in)
    if band_size % 2 != 0:
        band_size += 1  # Standard sizing rounds up odd underbust inches to even band sizes
        
    # 2. Calculate Cup Size (Bust - Band Difference)
    diff = round(bust_in - band_size)
    
    cups = {0: 'AA', 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'DD/E', 6: 'DDD/F'}
    cup_size = cups.get(diff, 'G+')
    
    return f"{band_size}{cup_size}"

def compute_recommended_sizes(
    gender: str,
    chest_cm: float,
    waist_cm: float,
    hip_cm: float,
    foot_length_cm: float,
) -> dict[str, str]:
    gender_lower = gender.lower().strip()
    
    # Estimate underbust for bra size (typically underbust is roughly 88% of bust/chest for women)
    underbust_cm = chest_cm * 0.88
    
    # Shirt size:
    shirt = get_mens_shirt_size(chest_cm)
    
    # Pants size:
    pants = get_pants_size(waist_cm)
    
    # Shoe size:
    if gender_lower == "male":
        shoe_us = str(get_shoe_size_us_mens(foot_length_cm))
    else:
        shoe_us = str(get_shoe_size_us_womens(foot_length_cm))
        
    # Dress size (woman only):
    if gender_lower == "female":
        dress = get_womens_dress_size_us(chest_cm, waist_cm, hip_cm)
    else:
        dress = "N/A"
        
    # Bra size (woman only):
    if gender_lower == "female":
        bra = get_bra_size(chest_cm, underbust_cm)
    else:
        bra = "N/A"
        
    return {
        "shirt_size": shirt,
        "pants_size": pants,
        "shoe_size_us": shoe_us,
        "dress_size": dress,
        "bra_size": bra,
    }


class PredictMeasurementsIn(BaseModel):
    """Core biometrics the user enters on the profile page."""
    height: float | None = Field(default=170.0, description="Height in cm")
    weight: float | None = Field(default=70.0, description="Weight in kg")
    waist: float | None = Field(default=80.0, description="Waist circumference in cm")
    foot_length: float | None = Field(default=26.0, description="Foot length in cm")
    gender: str | None = Field(default="female", description="'male' or 'female'")


class PredictMeasurementsOut(BaseModel):
    """Predicted measurements matching the frontend body_measurements keys."""
    shoulders: float
    chest: float
    hip: float
    sleeve: float
    inseam: float
    outseam: float
    model_version: str
    units: str = "cm"
    measurements: dict[str, float] | None = None
    recommended_sizes: dict[str, str] | None = None


@router.post(
    "/predict-measurements",
    response_model=PredictMeasurementsOut,
    summary="Predict body measurements from core biometrics",
)
@router.post(
    "/predict_measurements",
    response_model=PredictMeasurementsOut,
    include_in_schema=False,
)
async def predict_measurements(payload: PredictMeasurementsIn):
    """Predict 6 body measurements from 4 core inputs + gender.

    Uses a GradientBoostingRegressor trained on the public-domain
    ANSUR II dataset (~6 000 subjects). Stateless, no auth required —
    can be called during onboarding before the user has an account.
    """
    g_str = (payload.gender or "female").lower()
    if g_str not in ("male", "female"):
        g_str = "female"

    h = payload.height if (payload.height and payload.height > 0) else 170.0
    w = payload.weight if (payload.weight and payload.weight > 0) else 70.0
    wa = payload.waist if (payload.waist and payload.waist > 0) else 80.0
    fl = payload.foot_length if (payload.foot_length and payload.foot_length > 0) else 26.0

    result = None
    predictor = None
    try:
        from app.services.body_predictor import get_predictor
        predictor = get_predictor()
        result = predictor.predict(
            height_cm=h,
            weight_kg=w,
            waist_cm=wa,
            foot_length_cm=fl,
            gender=g_str,
        )
    except Exception as exc:
        log.warning("ML body predictor unavailable or failed, using anthropometric formula: %s", exc)
        result = {
            "shoulders": round(h * 0.235, 1) if g_str == "male" else round(h * 0.22, 1),
            "chest": round(wa * 1.18 + (w - 70) * 0.2, 1) if g_str == "male" else round(wa * 1.12 + (w - 60) * 0.2, 1),
            "hip": round(wa * 1.15 + (w - 70) * 0.15, 1) if g_str == "male" else round(wa * 1.28 + (w - 60) * 0.25, 1),
            "sleeve": round(h * 0.35, 1),
            "inseam": round(h * 0.45, 1),
            "outseam": round(h * 0.60, 1),
        }

    # Calculate recommended sizes and measurements dict
    rec_sizes = compute_recommended_sizes(
        gender=g_str,
        chest_cm=result["chest"],
        waist_cm=wa,
        hip_cm=result["hip"],
        foot_length_cm=fl,
    )
    
    measurements_dict = {
        "height_cm": h,
        "weight_kg": w,
        "waist_cm": wa,
        "foot_length_cm": fl,
        "shoulders_cm": result["shoulders"],
        "chest_cm": result["chest"],
        "hip_cm": result["hip"],
        "sleeve_cm": result["sleeve"],
        "inseam_cm": result["inseam"],
        "outseam_cm": result["outseam"],
    }

    return PredictMeasurementsOut(
        **result,
        model_version=getattr(predictor, "model_version", "v1.0-fallback") if predictor else "v1.0-fallback",
        measurements=measurements_dict,
        recommended_sizes=rec_sizes,
    )


class StoreRequestIn(BaseModel):
    """Payload to suggest a missing online store/marketplace."""

    store_name: str = Field(..., min_length=1, max_length=200, description="Online store name, e.g. Zara")
    store_site: str = Field(..., min_length=1, max_length=500, description="Online store website address")
    user_name: str | None = Field(default=None, max_length=200, description="User name")
    user_email: str | None = Field(default=None, max_length=320, description="User email")


class StoreRequestOut(BaseModel):
    success: bool
    message: str
    request_id: str | None = None


@router.post(
    "/request-store",
    response_model=StoreRequestOut,
    summary="Request a missing online store for the Shopping Assistant Chrome extension",
)
@router.post(
    "/request_store",
    response_model=StoreRequestOut,
    include_in_schema=False,
)
async def request_store(
    payload: StoreRequestIn,
    user: AuthenticatedUser | None = Depends(get_current_user_optional),
):
    clean_store_name = payload.store_name.strip()
    clean_store_site = payload.store_site.strip()
    if not clean_store_name or not clean_store_site:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Store name and website address are required")

    if not (clean_store_site.startswith("http://") or clean_store_site.startswith("https://")):
        clean_store_site = f"https://{clean_store_site}"

    # Resolve user identity (authenticated session takes priority)
    resolved_email = (
        (user.email if user else None)
        or (payload.user_email.strip() if payload.user_email else None)
        or "guest@dressapp.co"
    )
    resolved_name = (
        (user.display_name or getattr(user, "name", None) or (user.email.split("@")[0] if user.email else None) if user else None)
        or (payload.user_name.strip() if payload.user_name else None)
        or "A DressApp user"
    )
    user_id = user.id if user else None

    # Persist in database
    doc_id = str(uuid.uuid4())
    from datetime import datetime, timezone
    from app.db.database import get_db

    record = {
        "id": doc_id,
        "store_name": clean_store_name,
        "store_site": clean_store_site,
        "user_name": resolved_name,
        "user_email": resolved_email,
        "user_id": user_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        db = get_db()
        await db.store_requests.insert_one(record)
    except Exception as exc:
        log.warning("Could not persist store_request to mongo: %s", exc)

    # Dispatch email
    try:
        from app.services.email_service import send_store_request_email

        await send_store_request_email(
            user_name=resolved_name,
            user_email=resolved_email,
            store_name=clean_store_name,
            store_site=clean_store_site,
        )
    except Exception as exc:
        log.error("Failed to dispatch store request email: %s", exc)

    return StoreRequestOut(
        success=True,
        message="Store request sent successfully",
        request_id=doc_id,
    )
