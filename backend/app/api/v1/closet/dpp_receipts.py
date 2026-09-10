from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ReturnDocument

from app.db.database import get_db
from app.config import settings
from app.models.schemas import (
    ClosetItem,
    DressCode,
    FinancialMetadata,
    Formality,
    GarmentAnalysis,
    GarmentCondition,
    GarmentGender,
    GarmentQuality,
    GarmentState,
    Listing,
    MarketplaceIntent,
    RetailMetadata,
    Source,
    WeightedTag,
)
from app.services import repos
from app.services.auth import (
    get_current_user,
    resolve_user_gemini_api_key,
    resolve_user_gemini_model,
)
from app.services.fees import compute_fees
from app.services.vision import garment_vision_service, get_garment_vision_service
from app.services.fashion_clip import fashion_clip_service
from app.services.gemini_image_service import gemini_image_service, get_gemini_image_service
from app.services.image_compression import (
    compress_b64_image,
    compress_image_bytes,
    compress_image_url_or_b64,
)
from app.services import closet_service
from app.api.v1.closet.common import (
    _active_background_tasks,
    _track_task,
    _ANALYZE_CONCURRENCY,
    _ANALYZE_LOCK,
    _get_item_image_url,
    _pick_segformer_mask_for_category,
    _bytes_from_data_url,
    _ensure_min_resolution,
    _read_image_bytes_from_url,
    _maybe_retry_stale_matte,
    _run_background_matte,
    _run_background_matte_and_analyze,
    _run_background_reconstruction,
    CreateItemIn,
    UpdateItemIn,
    logger,
)

router = APIRouter()

# -------------------------------------------------------------------
class FetchImageUrlIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str


@router.post("/fetch-image-url")
async def fetch_image_url(
    payload: FetchImageUrlIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Fetch an image from a URL and return it in base64 format to bypass CORS."""
    import httpx
    from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode, urljoin
    from bs4 import BeautifulSoup
    import base64

    # Clean the URL by stripping UTM and ad-tracking parameters
    try:
        parsed = urlparse(payload.url)
        qsl = parse_qsl(parsed.query)
        clean_qsl = [
            (k, v) for k, v in qsl
            if not k.lower().startswith("utm_") and k.lower() not in ("cto_pld", "fbclid", "gclid")
        ]
        query = urlencode(clean_qsl)
        url = urlunparse(parsed._replace(query=query))
    except Exception:
        url = payload.url

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }
    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, headers=headers
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content = resp.content
            content_type = resp.headers.get("content-type", "")

            # If it is an HTML page, extract the product image link from metadata
            if "text/html" in content_type:
                soup = BeautifulSoup(resp.text, "html.parser")
                img_url = None
                
                # Check OpenGraph image metadata
                og_img = soup.find("meta", property="og:image")
                if og_img and og_img.get("content"):
                    img_url = og_img["content"]
                
                # Check Twitter card image metadata
                if not img_url:
                    tw_img = soup.find("meta", name="twitter:image")
                    if tw_img and tw_img.get("content"):
                        img_url = tw_img["content"]
                
                # Check link image_src
                if not img_url:
                    schema_img = soup.find("link", rel="image_src")
                    if schema_img and schema_img.get("href"):
                        img_url = schema_img["href"]
                
                # Fallback to first large image
                if not img_url:
                    for img in soup.find_all("img"):
                        src = img.get("src") or img.get("data-src")
                        if src and src.startswith("http") and not any(x in src.lower() for x in ("logo", "icon", "banner")):
                            img_url = src
                            break
                
                if not img_url:
                    raise HTTPException(
                        status_code=400,
                        detail="Could not find any product image on this webpage."
                    )
                
                resolved_img_url = urljoin(url, img_url)
                
                # Download the actual image from the resolved CDN link
                img_resp = await client.get(resolved_img_url)
                img_resp.raise_for_status()
                content = img_resp.content
                content_type = img_resp.headers.get("content-type", "image/jpeg")

            b64_str = base64.b64encode(content).decode("ascii")
            return {"image_b64": b64_str, "mime_type": content_type}
    except httpx.HTTPStatusError as http_err:
        status_code = http_err.response.status_code
        if status_code in (403, 429):
            detail_msg = (
                f"Webpage returned status {status_code}. "
                "The site blocks automated scrapers. To bypass this, "
                "please right-click the product image and select 'Copy image address' "
                "to import it directly."
            )
        else:
            detail_msg = f"Failed to load image (status {status_code})."
        raise HTTPException(status_code=400, detail=detail_msg)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch image from URL: {str(e)}"
        )



class ImportDppIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Either the full URL decoded from the QR, or the inline JSON payload
    # embedded directly in the code (some small-data pilots do this).
    qr_payload: str


@router.post("/import-dpp")
async def import_dpp(
    payload: ImportDppIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """**Scan DPP** — decode a QR payload into a draft closet item.

    Accepts an EU Digital Product Passport QR payload (a URL pointing to
    a passport document, or inline JSON). Parses JSON-LD / Schema.org
    `Product` nodes and returns a response shaped like ``/analyze`` so
    the existing Add-Item form can hydrate from it without special-
    casing.
    """
    from app.services.dpp_parser import parse_dpp

    result = await parse_dpp(payload.qr_payload)
    analysis = _safe_analysis(dict(result.get("analysis") or {}))
    dpp_data = result.get("dpp_data") or {}

    crop_bytes: bytes | None = result.get("image_bytes")
    crop_mime: str = result.get("image_mime") or "image/jpeg"
    crop_b64: str | None = (
        base64.b64encode(crop_bytes).decode("ascii") if crop_bytes else None
    )

    item_entry: dict[str, Any] = {
        "label": analysis.get("sub_category")
        or analysis.get("item_type")
        or analysis.get("category")
        or "garment",
        "kind": "garment",
        "bbox": [0, 0, 1000, 1000],
        "crop_base64": crop_b64,
        "crop_mime": crop_mime if crop_b64 else None,
        "analysis": analysis,
        "dpp_data": dpp_data,
        "source": "dpp",
    }

    return {
        "items": [item_entry],
        "count": 1,
        "source": "dpp",
        "has_image": crop_b64 is not None,
        "parse_error": dpp_data.get("parse_error"),
        **analysis,
    }



@router.post("/extract-pdf-text")
async def extract_pdf_text(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Extract raw text from an uploaded file (PDF/Image) using Gemini's native OCR with a local pypdf fallback for PDFs."""
    from app.services.gemini_client import get_default_client
    from fastapi import HTTPException
    import mimetypes
    import pypdf
    import io

    try:
        file_bytes = await file.read()
        mime_type = file.content_type
        if not mime_type or mime_type == "application/octet-stream":
            mime_type = mimetypes.guess_type(file.filename)[0] or "application/pdf"

        is_pdf = mime_type == "application/pdf" or file.filename.endswith(".pdf")

        # Deduct AI credits for the OCR model call
        from app.db.database import get_db
        from app.services.billing_service import deduct_user_credits
        db = get_db()
        if not await deduct_user_credits(db, user, cost=1):
            raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

        # Try Gemini Multimodal OCR first
        try:
            from app.services.gemini_client import get_gemini_client
            user_api_key = resolve_user_gemini_api_key(user)
            user_model = resolve_user_gemini_model(user)
            gemini = get_gemini_client(user=user, api_key=user_api_key)
            prompt = (
                "You are a high-precision, multilingual OCR engine. "
                "Extract and transcribe ALL text from the attached document row-by-row (horizontally across the page). "
                "Crucially, do NOT extract text in separate vertical columns. Instead, merge columns line-by-line horizontally "
                "so that each line shows the item name, description, code, and price/discount aligned together on the same row. "
                "Reduce unnecessary whitespace between columns to ensure each item's details fit neatly on a single line. "
                "Do not add any preamble, summary, explanation, markdown formatting, or notes. "
                "Start directly with the transcribed text."
            )

            user_parts = [
                prompt,
                (file_bytes, mime_type)
            ]

            ocr_text = await gemini.vision(
                user_parts=user_parts,
                model=user_model,
                temperature=0.0
            )
            if ocr_text and ocr_text.strip():
                return {"text": ocr_text.strip()}
        except Exception as e:
            logger.warning("Gemini OCR failed, trying fallback: %s", e)

        # Fallback for PDFs: Use local pypdf parser
        if is_pdf:
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
                if text.strip():
                    return {"text": text.strip()}
            except Exception as e:
                logger.error("pypdf fallback failed: %s", e)

        raise HTTPException(status_code=500, detail="Failed to extract readable text from document.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to process document: {e}")



@router.post("/parse-receipt")
async def parse_receipt(
    text: str | None = Form(None),
    url: str | None = Form(None),
    file: UploadFile | None = File(None),
    user: dict = Depends(get_current_user),
):
    """Extract garment information from pasted text, a URL, or an uploaded receipt image/PDF."""
    from app.services.gemini_client import get_default_client
    import httpx
    import mimetypes
    import base64
    
    parts = []
    is_image = False
    image_bytes = None
    image_mime = None
    
    if text and text.strip():
        parts.append(text.strip())
    elif file and file.filename:
        file_bytes = await file.read()
        mime_type = file.content_type
        if not mime_type or mime_type == "application/octet-stream":
            mime_type = mimetypes.guess_type(file.filename)[0] or "image/jpeg"
        
        is_text = False
        if mime_type:
            mime_lower = mime_type.lower()
            if (
                mime_lower.startswith("text/")
                or mime_lower in ["application/json", "application/rtf", "application/javascript", "text/csv"]
                or file.filename.endswith((".txt", ".csv", ".json", ".html", ".htm", ".rtf"))
            ):
                is_text = True
                
        if is_text:
            try:
                decoded_text = file_bytes.decode("utf-8", errors="ignore")
                parts.append(decoded_text)
            except Exception:
                parts.append((file_bytes, mime_type))
        else:
            parts.append((file_bytes, mime_type))
            if mime_type and "image" in mime_type.lower():
                is_image = True
                image_bytes = file_bytes
                image_mime = mime_type
    elif url and url.strip():
        url_str = url.strip()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                resp = await client.get(url_str, headers=headers, follow_redirects=True)
                if resp.status_code == 200:
                    ct = resp.headers.get("content-type", "").split(";")[0].strip().lower()
                    if not ct or ct == "application/octet-stream":
                        ct = mimetypes.guess_type(url_str)[0] or ct
                    
                    if ct and ("image" in ct or "pdf" in ct):
                        parts.append((resp.content, ct))
                        if "image" in ct:
                            is_image = True
                            image_bytes = resp.content
                            image_mime = ct
                    else:
                        parts.append(resp.text)
                else:
                    raise HTTPException(400, f"Failed to fetch URL, status code: {resp.status_code}")
        except Exception as e:
            logger.error("Failed to fetch URL %s: %s", url_str, e)
            raise HTTPException(400, f"Failed to fetch receipt from URL: {e}")
    else:
        raise HTTPException(400, "Either text, file, or url is required and must not be blank")

    system_instructions = """
    You are an expert wardrobe cataloging assistant. Your job is to analyze receipt text, receipt files (PDF/Images), or merchant invoice content, identify the garment/accessory purchased, and extract key details into a structured JSON object.

    Extract the following fields:
    1. brand: The brand of the clothing item (e.g., Zara, Nike, AliExpress). If not specified, infer a likely value or use "Generic".
    2. item_type: The type of garment (e.g., shirt, t-shirt, pants, jeans, jacket, sneakers, dress, socks). Use a simple singular lowercase noun.
    3. size: The size of the item (e.g., S, M, L, XL, XXL).
    4. price_cents: The purchase price of the item converted to integer cents (e.g., if price is ₪79.66 or $79.66, price_cents is 7966. If discount is applied, use the final item price).
    5. colors: A list of primary colors of the garment (e.g., ["black"], ["blue", "white"]). Use lowercase simple color names.
    6. category: The wardrobe category. Must be exactly one of: "Top", "Bottom", "Outerwear", "Full Body", "Footwear", "Underwear", "Accessories".
    7. name: A friendly descriptive name for the garment combining brand and description (e.g., "Wosawe Wind Jacket Lightweight").
    8. gender: The target gender of the garment. Must be exactly one of: "men", "women", "unisex", "kids". If the receipt mentions gender (e.g. "Men's", "Women's", "unisex"), use that. Otherwise, infer from item characteristics or use "unisex" as fallback.

    If multiple items are found in the receipt, return details for the FIRST garment item found.
    Return ONLY a valid JSON object matching this schema. Do not include markdown code fences or other text.
    """

    async def run_ocr():
        from app.db.database import get_db
        from app.services.billing_service import deduct_user_credits
        db = get_db()
        if not await deduct_user_credits(db, user, cost=1):
            raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

        from app.services.gemini_client import get_gemini_client
        user_api_key = resolve_user_gemini_api_key(user)
        user_model = resolve_user_gemini_model(user)
        gemini = get_gemini_client(user=user, api_key=user_api_key)
        response_text = await gemini.vision(
            user_parts=parts,
            system=system_instructions,
            response_mime_type="application/json",
            model=user_model,
        )
        
        # Clean any code fences
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```"):
            lines = cleaned_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned_text = "\n".join(lines).strip()
            
        return json.loads(cleaned_text)

    async def run_visual():
        vision_service = get_garment_vision_service(user=user)
        if not is_image or vision_service is None or not image_bytes:
            return None
        try:
            detections = await vision_service.detect_items(image_bytes)
            if not detections:
                return None
            best_det = max(
                detections,
                key=lambda d: (
                    max(0, d["bbox"][2] - d["bbox"][0])
                    * max(0, d["bbox"][3] - d["bbox"][1])
                ),
            )
            raw_crops = await asyncio.to_thread(
                vision_service._bbox_crop_useful, image_bytes, [best_det]
            )
            if not raw_crops:
                return None
            
            _, crop_bytes, crop_mime = raw_crops[0]
            
            # Apply the full garment vision background matting pipeline (SegFormer + rembg + alpha intersection)
            from app.services import background_matting
            from app.services import clothing_parser as _cp
            from app.config import settings
            
            category = best_det.get("label") or best_det.get("kind")
            seg_mask = None
            human_mask = None
            if settings.USE_LOCAL_CLOTHING_PARSER:
                try:
                    garments = await _cp.parse_garments(crop_bytes)
                    seg_mask, human_mask = _pick_segformer_mask_for_category(garments, category)
                except Exception as exc:
                    logger.info("Background matte SegFormer skipped in visual receipt parse: %s", exc)
                    
            try:
                bg_res = await background_matting.remove_background(crop_bytes)
                result_png = bg_res.get("image_png") if isinstance(bg_res, dict) else None
                if result_png:
                    if seg_mask is not None:
                        try:
                            refined = _cp.apply_alpha_intersection(
                                result_png,
                                seg_mask,
                                category=category,
                                human_mask=human_mask,
                                is_padded_canvas=True,
                            )
                            if refined:
                                result_png = refined
                        except Exception as exc:
                            logger.info("Background matte alpha intersection skipped in visual receipt parse: %s", exc)
                    
                    crop_bytes = result_png
                    crop_mime = "image/png"
            except Exception as bg_err:
                logger.warning("Background removal failed on receipt visual crop: %s", bg_err)

            user_lang = user.get("preferred_language") or "en"
            analysis_raw = await vision_service.analyze(
                crop_bytes,
                language=user_lang,
            )
            analysis_clean = _safe_analysis(analysis_raw)
            crop_b64 = base64.b64encode(crop_bytes).decode("ascii")
            
            return {
                "visual_analysis": analysis_clean,
                "image_base64": crop_b64,
                "image_mime": crop_mime or "image/jpeg",
            }
        except Exception as exc:
            logger.warning("Receipt image item detection/analysis failed: %r", exc)
            return None

    try:
        ocr_result, visual_result = await asyncio.gather(run_ocr(), run_visual())
        
        final_data = {}
        if visual_result and "visual_analysis" in visual_result:
            final_data.update(visual_result["visual_analysis"])
            
        # Override with authoritative OCR fields
        for field in ["brand", "size", "price_cents", "category", "item_type", "gender"]:
            if field in ocr_result and ocr_result[field] not in [None, "", "null"]:
                final_data[field] = ocr_result[field]
                
        # Merge name / title
        if "name" in ocr_result and ocr_result["name"] not in [None, "", "null"]:
            final_data["name"] = ocr_result["name"]
            final_data["title"] = ocr_result["name"]
        elif "title" in final_data:
            final_data["name"] = final_data["title"]
            
        # Merge colors and distribute percentages evenly to total 100%
        if "colors" in ocr_result and ocr_result["colors"]:
            raw_colors = []
            for col in ocr_result["colors"]:
                if isinstance(col, str):
                    raw_colors.append({"name": col, "pct": None})
                elif isinstance(col, dict) and "name" in col:
                    raw_colors.append({"name": col["name"], "pct": col.get("pct")})
            
            has_pct = [c for c in raw_colors if c["pct"] is not None]
            total_known = sum(c["pct"] for c in has_pct)
            
            if len(has_pct) == len(raw_colors):
                final_colors = raw_colors
            else:
                remaining = max(0, 100 - total_known)
                null_count = len(raw_colors) - len(has_pct)
                share = remaining // null_count
                distributed = 0
                
                final_colors = []
                null_seen = 0
                for c in raw_colors:
                    if c["pct"] is not None:
                        final_colors.append(c)
                    else:
                        null_seen += 1
                        val = (remaining - distributed) if null_seen == null_count else share
                        distributed += val
                        final_colors.append({"name": c["name"], "pct": val})
            
            if final_colors:
                final_data["colors"] = final_colors
                
        # Fill standard defaults if not present
        if not final_data.get("brand"):
            final_data["brand"] = "Generic"
        if not final_data.get("item_type"):
            final_data["item_type"] = "garment"
        if not final_data.get("size"):
            final_data["size"] = "M"
        if not final_data.get("category"):
            final_data["category"] = "Top"
        if not final_data.get("gender"):
            final_data["gender"] = "unisex"
        if not final_data.get("name"):
            brand_val = final_data.get("brand") or "Generic"
            type_val = final_data.get("item_type") or "garment"
            final_data["name"] = f"{brand_val} {type_val}"
            final_data["title"] = final_data["name"]
            
        # Add image fields if cropped
        if visual_result and "image_base64" in visual_result:
            final_data["image_base64"] = visual_result["image_base64"]
            final_data["image_mime"] = visual_result["image_mime"]
            
        return final_data
    except Exception as e:
        logger.error("Failed parsing receipt: %s", e)
        raise HTTPException(500, f"Error processing receipt: {e}")

