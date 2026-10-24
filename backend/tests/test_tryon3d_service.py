"""Unit test suite for the CPU-only 2D-to-3D garment modeling microservice.

Covers:
1. Handling of fully transparent RGBA images (raises GarmentValidationError / HTTP 422).
2. Rejection of non-RGBA (3-channel RGB) or corrupt uploads.
3. Exact bounding box, aspect ratio, silhouette keypoint, and category heuristic derivation.
4. Canonical `.glb` template integrity (`tshirt_base.glb`, `hoodie_base.glb`, `pants_base.glb`, `dress_base.glb`).
5. Anisotropic scaling, parabolic Z-depth displacement, PBR material properties, and `.glb` round-trip integrity via `trimesh`.
6. FastAPI `POST /api/v1/models/generate-3d` streaming and JSON responses within the < 400ms CPU target.
"""
from __future__ import annotations

import io
import json
import time
from typing import Tuple

import cv2
from fastapi.testclient import TestClient
import numpy as np
from PIL import Image
import pytest
import trimesh

from garment_analyzer import GarmentValidationError, analyze_garment_image
from mesh_fitter import fit_garment_to_mesh, generate_3d_garment_glb
from service import app
from template_engine import TEMPLATE_FILENAMES, ensure_templates, load_template_mesh


def _encode_png_bytes(arr: np.ndarray) -> bytes:
    """Encode an RGB or RGBA uint8 numpy array into PNG bytes."""
    mode = "RGBA" if (arr.ndim == 3 and arr.shape[2] == 4) else "RGB"
    pil_img = Image.fromarray(arr, mode=mode)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def _make_rect_garment_rgba(
    canvas_size: Tuple[int, int] = (300, 400),
    rect: Tuple[int, int, int, int] = (40, 30, 180, 240),
    color: Tuple[int, int, int, int] = (35, 95, 190, 255),
) -> np.ndarray:
    """Create a clean RGBA image with a solid garment rectangle at (x, y, w, h)."""
    cw, ch = canvas_size
    x, y, w, h = rect
    rgba = np.zeros((ch, cw, 4), dtype=np.uint8)
    rgba[y : y + h, x : x + w] = color
    return rgba


def _make_pants_silhouette_rgba() -> np.ndarray:
    """Create a synthetic trousers RGBA image with waistband and two distinct legs."""
    h, w = 360, 220
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    # Waistband & hip block (y: 20..130, x: 40..180)
    rgba[20:130, 40:180] = (40, 55, 90, 255)
    # Left leg (y: 130..330, x: 42..98)
    rgba[130:330, 42:98] = (40, 55, 90, 255)
    # Right leg (y: 130..330, x: 122..178)
    rgba[130:330, 122:178] = (40, 55, 90, 255)
    return rgba


def _make_dress_silhouette_rgba() -> np.ndarray:
    """Create a synthetic A-line dress RGBA image with fitted waist and wide flared skirt."""
    h, w = 400, 260
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for row in range(30, 370):
        t = (row - 30) / 340.0
        if t < 0.35:
            # Bodice
            half_span = int(42 + 8 * np.sin(np.pi * (t / 0.35)))
        else:
            # Flared skirt expanding from 38px half-width at waist to 95px at hem
            skirt_t = (t - 0.35) / 0.65
            half_span = int(38 + 57 * skirt_t)
        cx = w // 2
        rgba[row, cx - half_span : cx + half_span] = (180, 40, 75, 255)
    return rgba


def _make_hoodie_silhouette_rgba() -> np.ndarray:
    """Create a synthetic hoodie RGBA image with narrow top hood dome and wide sleeves."""
    h, w = 320, 300
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    cx = w // 2
    # Narrow hood dome at top (y: 20..75, half-width: 32px)
    rgba[20:75, cx - 32 : cx + 32] = (70, 75, 82, 255)
    # Wide shoulders and sleeves (y: 75..220, half-width: 125px)
    rgba[75:220, cx - 125 : cx + 125] = (70, 75, 82, 255)
    # Lower torso hem (y: 220..295, half-width: 85px)
    rgba[220:295, cx - 85 : cx + 85] = (70, 75, 82, 255)
    return rgba


class TestGarmentAnalyzer:
    """Tests for `garment_analyzer.py` contour and metric extraction."""

    def test_fully_transparent_image_raises_validation_error(self):
        transparent_rgba = np.zeros((256, 256, 4), dtype=np.uint8)
        with pytest.raises(GarmentValidationError, match="transparent"):
            analyze_garment_image(transparent_rgba)

        png_bytes = _encode_png_bytes(transparent_rgba)
        with pytest.raises(GarmentValidationError, match="transparent"):
            analyze_garment_image(png_bytes)

    def test_non_rgba_rgb_image_raises_validation_error(self):
        rgb_only = np.full((128, 128, 3), 200, dtype=np.uint8)
        with pytest.raises(GarmentValidationError, match="alpha channel"):
            analyze_garment_image(rgb_only)

        rgb_png_bytes = _encode_png_bytes(rgb_only)
        with pytest.raises(GarmentValidationError, match="alpha channel"):
            analyze_garment_image(rgb_png_bytes)

    def test_exact_aspect_ratio_and_bounding_box_derivation(self):
        rgba = _make_rect_garment_rgba(canvas_size=(320, 420), rect=(40, 30, 180, 240))
        metrics = analyze_garment_image(rgba, garment_type="tshirt")

        assert metrics.bbox == (40, 30, 180, 240)
        expected_aspect = 180.0 / 240.0
        assert metrics.aspect_ratio == pytest.approx(expected_aspect, rel=1e-4)
        assert metrics.category == "tshirt"
        assert metrics.cropped_rgba.shape == (240, 180, 4)
        assert metrics.keypoints["shoulder_width_px"] == pytest.approx(180.0, rel=1e-2)
        assert metrics.keypoints["hem_width_px"] == pytest.approx(180.0, rel=1e-2)
        assert metrics.keypoints["torso_length_px"] == pytest.approx(240.0, rel=1e-2)

    def test_heuristic_category_classification(self):
        pants_metrics = analyze_garment_image(_make_pants_silhouette_rgba(), garment_type="auto")
        assert pants_metrics.category == "pants"
        assert pants_metrics.keypoints["leg_split_ratio"] >= 0.25

        dress_metrics = analyze_garment_image(_make_dress_silhouette_rgba(), garment_type="auto")
        assert dress_metrics.category == "dress"

        hoodie_metrics = analyze_garment_image(_make_hoodie_silhouette_rgba(), garment_type="auto")
        assert hoodie_metrics.category == "hoodie"


class TestTemplateEngineAndMeshFitter:
    """Tests for `template_engine.py` and `mesh_fitter.py` 3D `.glb` generation."""

    def test_canonical_templates_exist_and_are_manifold(self):
        paths = ensure_templates()
        assert set(paths.keys()) == set(TEMPLATE_FILENAMES.keys())

        for gtype, path in paths.items():
            assert path.is_file(), f"Missing template file for {gtype}"
            assert path.stat().st_size > 1000
            mesh = load_template_mesh(gtype)
            assert isinstance(mesh, trimesh.Trimesh)
            assert mesh.is_watertight, f"Template {gtype} must be watertight 2-manifold"
            assert mesh.is_winding_consistent, f"Template {gtype} must have consistent face winding"
            assert mesh.visual.uv is not None
            assert mesh.visual.uv.shape == (len(mesh.vertices), 2)
            assert float(np.min(mesh.visual.uv)) >= -1e-5
            assert float(np.max(mesh.visual.uv)) <= 1.0 + 1e-5

    def test_glb_binary_export_integrity_and_pbr_material(self):
        rgba = _make_rect_garment_rgba(canvas_size=(256, 256), rect=(28, 18, 200, 220))
        t0 = time.perf_counter()
        result = generate_3d_garment_glb(
            source=rgba,
            garment_type="tshirt",
            target_dimensions={"width": 0.66, "height": 0.72},
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        # Performance target: < 400ms on CPU
        assert elapsed_ms < 400.0, f"Expected < 400ms, took {elapsed_ms:.2f}ms"

        # Verify GLB binary magic header ('glTF' = 0x46546C67)
        assert len(result.glb_bytes) > 1024
        assert result.glb_bytes[:4] == b"glTF"

        # Verify PBR material properties on fitted mesh
        mat = result.mesh.visual.material
        assert isinstance(mat, trimesh.visual.material.PBRMaterial)
        assert mat.roughnessFactor == pytest.approx(0.8)
        assert mat.metallicFactor == pytest.approx(0.0)
        assert mat.doubleSided is True
        assert mat.baseColorTexture is not None

        # Verify round-trip reload via trimesh
        reloaded = trimesh.load(io.BytesIO(result.glb_bytes), file_type="glb", force="mesh", process=False)
        if isinstance(reloaded, trimesh.Scene):
            reloaded = reloaded.dump(concatenate=True)

        assert len(reloaded.vertices) == len(result.mesh.vertices)
        assert len(reloaded.faces) == len(result.mesh.faces)
        assert reloaded.is_watertight
        assert reloaded.is_winding_consistent

        # Verify scaled bounds and parabolic Z-depth curve
        bounds = reloaded.bounds
        width_m = float(bounds[1, 0] - bounds[0, 0])
        height_m = float(bounds[1, 1] - bounds[0, 1])
        depth_m = float(bounds[1, 2] - bounds[0, 2])
        assert width_m == pytest.approx(0.66, rel=1e-2)
        assert height_m == pytest.approx(0.72, rel=1e-2)
        assert depth_m > 0.045  # Base thickness + parabolic Z arch


class TestFastAPIServiceEndpoint:
    """Tests for `POST /api/v1/models/generate-3d` route in `service.py`."""

    def setup_method(self):
        self.client = TestClient(app)

    def test_post_generate_3d_streams_valid_glb_under_400ms(self):
        rgba = _make_rect_garment_rgba(canvas_size=(256, 300), rect=(30, 20, 196, 260))
        png_bytes = _encode_png_bytes(rgba)

        t0 = time.perf_counter()
        response = self.client.post(
            "/api/v1/models/generate-3d?garment_type=tshirt",
            files={"file": ("garment.png", png_bytes, "image/png")},
            data={"target_dimensions": json.dumps({"scale_x": 1.05, "scale_y": 1.0})},
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        assert response.status_code == 200
        assert response.headers["content-type"] == "model/gltf-binary"
        assert response.headers["x-garment-category"] == "tshirt"
        assert float(response.headers["x-aspect-ratio"]) == pytest.approx(196.0 / 260.0, rel=1e-2)
        assert elapsed_ms < 400.0

        glb_payload = response.content
        assert glb_payload[:4] == b"glTF"
        loaded = trimesh.load(io.BytesIO(glb_payload), file_type="glb", force="mesh")
        assert len(loaded.vertices) > 100
        assert len(loaded.faces) > 100

    def test_post_generate_3d_rejects_fully_transparent_upload(self):
        transparent_rgba = np.zeros((128, 128, 4), dtype=np.uint8)
        png_bytes = _encode_png_bytes(transparent_rgba)

        response = self.client.post(
            "/api/v1/models/generate-3d",
            files={"file": ("empty_alpha.png", png_bytes, "image/png")},
        )
        assert response.status_code == 422
        assert "transparent" in response.json()["detail"].lower()

    def test_post_generate_3d_rejects_non_rgba_rgb_upload(self):
        rgb_arr = np.full((128, 128, 3), 120, dtype=np.uint8)
        png_bytes = _encode_png_bytes(rgb_arr)

        response = self.client.post(
            "/api/v1/models/generate-3d",
            files={"file": ("opaque_rgb.png", png_bytes, "image/png")},
        )
        assert response.status_code == 422
        assert "alpha channel" in response.json()["detail"].lower()

    def test_post_generate_3d_json_response_format(self):
        from pathlib import Path

        rgba = _make_pants_silhouette_rgba()
        png_bytes = _encode_png_bytes(rgba)

        response = self.client.post(
            "/api/v1/models/generate-3d?garment_type=auto&response_format=json",
            files={"file": ("pants.png", png_bytes, "image/png")},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ok"
        assert payload["garment_type"] == "pants"
        assert payload["url"].endswith(".glb")
        assert payload["processing_time_ms"] < 400.0

        saved_path = Path(__file__).resolve().parent.parent / payload["url"].lstrip("/")
        if saved_path.is_file():
            saved_path.unlink()
