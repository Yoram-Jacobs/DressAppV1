"""FastAPI route module for 2D-to-3D garment modeling (`routes/tryon3d.py`)."""
from __future__ import annotations

from service import app, generate_3d_model_endpoint, router, v1_models_router

__all__ = ["app", "router", "v1_models_router", "generate_3d_model_endpoint"]
