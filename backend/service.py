"""FastAPI 2D-to-3D Garment Modeling Microservice (`service.py`).

Exposes `POST /api/v1/models/generate-3d` to convert pre-cleaned RGBA garment
images (PNG/WebP) into manifold, PBR-textured `.glb` 3D assets on CPU in < 400ms.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
import io
import json
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Iterator, Optional

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from garment_analyzer import GarmentValidationError, normalize_garment_type
from mesh_fitter import generate_3d_garment_glb
from template_engine import ensure_templates

router = APIRouter(tags=["tryon3d"])
v1_models_router = APIRouter(prefix="/models", tags=["tryon3d"])


def _parse_target_dimensions(raw_payload: Optional[str]) -> Optional[Dict[str, Any]]:
    """Parse optional JSON string containing target body scaling/dimension parameters."""
    if raw_payload is None:
        return None
    cleaned = raw_payload.strip()
    if not cleaned:
        return None
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid JSON in target_dimensions: {exc.msg}",
        ) from exc
    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=422,
            detail="target_dimensions must be a JSON object mapping dimension keys to numeric values.",
        )
    return parsed


def _stream_and_cleanup_buffer(buf: io.BytesIO, chunk_size: int = 65536) -> Iterator[bytes]:
    """Yield binary chunks from an in-memory BytesIO buffer and guarantee cleanup on completion."""
    try:
        buf.seek(0)
        while True:
            chunk = buf.read(chunk_size)
            if not chunk:
                break
            yield chunk
    finally:
        buf.close()


async def _handle_generate_3d(
    file: UploadFile,
    garment_type: str = "auto",
    target_dimensions_raw: Optional[str] = None,
    response_format: str = "glb",
) -> StreamingResponse | JSONResponse:
    """Core handler for `POST /api/v1/models/generate-3d` with deterministic buffer cleanup."""
    t_start = time.perf_counter()
    input_buffer: Optional[io.BytesIO] = None

    try:
        raw_bytes = await file.read()
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        input_buffer = io.BytesIO(raw_bytes)
        normalized_type = normalize_garment_type(garment_type)
        target_dims = _parse_target_dimensions(target_dimensions_raw)

        result = generate_3d_garment_glb(
            source=input_buffer.getvalue(),
            garment_type=normalized_type,
            target_dimensions=target_dims,
        )
    except GarmentValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        if input_buffer is not None:
            input_buffer.close()
        await file.close()

    elapsed_ms = (time.perf_counter() - t_start) * 1000.0
    category = result.metrics.category
    aspect = result.metrics.aspect_ratio

    if response_format.strip().lower() == "json":
        here = Path(__file__).resolve().parent
        out_dir = here / "static" / "uploads" / "models3d"
        out_dir.mkdir(parents=True, exist_ok=True)
        asset_id = uuid.uuid4().hex[:12]
        filename = f"{category}_{asset_id}.glb"
        out_path = out_dir / filename
        out_path.write_bytes(result.glb_bytes)

        return JSONResponse(
            content={
                "status": "ok",
                "url": f"/static/uploads/models3d/{filename}",
                "garment_type": category,
                "aspect_ratio": round(aspect, 4),
                "scale_factors": {
                    "sx": round(result.scale_factors[0], 4),
                    "sy": round(result.scale_factors[1], 4),
                    "sz": round(result.scale_factors[2], 4),
                },
                "dimensions": result.target_dimensions,
                "keypoints": {k: round(float(v), 4) for k, v in result.metrics.keypoints.items()},
                "processing_time_ms": round(elapsed_ms, 2),
                "size_bytes": len(result.glb_bytes),
            }
        )

    output_buffer = io.BytesIO(result.glb_bytes)
    headers = {
        "Content-Disposition": f'attachment; filename="{category}_fitted.glb"',
        "Content-Length": str(len(result.glb_bytes)),
        "X-Garment-Category": category,
        "X-Aspect-Ratio": f"{aspect:.4f}",
        "X-Scale-Factors": f"{result.scale_factors[0]:.4f},{result.scale_factors[1]:.4f},{result.scale_factors[2]:.4f}",
        "X-Processing-Time-Ms": f"{elapsed_ms:.2f}",
    }
    return StreamingResponse(
        _stream_and_cleanup_buffer(output_buffer),
        media_type="model/gltf-binary",
        headers=headers,
    )


@router.post("/api/v1/models/generate-3d")
@v1_models_router.post("/generate-3d")
async def generate_3d_model_endpoint(
    file: UploadFile = File(..., description="Pre-cleaned RGBA garment image (PNG/WebP with alpha channel)"),
    garment_type: str = Query(
        "auto",
        description="Garment archetype: 'tshirt', 'hoodie', 'pants', 'dress', or 'auto'",
    ),
    target_dimensions: Optional[str] = Query(
        None,
        description="Optional JSON object with target body scaling factors (width, height, scale_x, scale_y, depth_curve)",
    ),
    target_dimensions_form: Optional[str] = Form(
        None,
        alias="target_dimensions",
        description="Optional JSON payload passed as multipart form field",
    ),
    response_format: str = Query(
        "glb",
        description="Response format: 'glb' (streams model/gltf-binary) or 'json' (returns storage URL & metrics)",
    ),
):
    """Generate a manifold, PBR-textured `.glb` 3D garment model from a clean 2D RGBA image."""
    effective_dims = target_dimensions if target_dimensions is not None else target_dimensions_form
    return await _handle_generate_3d(
        file=file,
        garment_type=garment_type,
        target_dimensions_raw=effective_dims,
        response_format=response_format,
    )


@asynccontextmanager
async def _lifespan(_: FastAPI):
    ensure_templates()
    yield


app = FastAPI(
    title="DressApp 2D-to-3D Garment Modeling Microservice",
    version="1.0.0",
    lifespan=_lifespan,
)
app.include_router(router)
