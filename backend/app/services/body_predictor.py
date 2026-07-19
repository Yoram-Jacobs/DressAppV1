"""DressApp — Body-measurement ML predictor service.

Singleton that loads the trained ANSUR II model once and predicts 6 body
measurements from 4 core biometrics + gender.  Thread-safe, lazy-loading.

Predicted fields (all in cm, rounded to 1 d.p.):
    shoulders, chest, hip, sleeve, inseam, outseam

Usage::

    from app.services.body_predictor import get_predictor

    predictor = get_predictor()
    result = predictor.predict(
        height_cm=170.0,
        weight_kg=64.0,
        waist_cm=84.0,
        foot_length_cm=23.5,
        gender="female",
    )
    # → {"shoulders": 44.2, "chest": 89.3, "hip": 90.1, ...}
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────

MODEL_PATH = Path(__file__).resolve().parent.parent.parent / "ml_models" / "body_predictor.joblib"
METADATA_PATH = MODEL_PATH.with_name("model_metadata.json")

TARGET_NAMES = ["shoulders", "chest", "hip", "sleeve", "inseam", "outseam"]
FEATURE_NAMES = ["height", "weight", "waist", "foot_length", "gender"]

# Plausibility bounds (generous — we reject clearly impossible inputs)
_BOUNDS = {
    "height_cm":      (100.0, 230.0),
    "weight_kg":      (25.0,  250.0),
    "waist_cm":       (40.0,  180.0),
    "foot_length_cm": (15.0,  40.0),
}

VALID_GENDERS = ("male", "female")


# ── Predictor class ─────────────────────────────────────────────────────

class BodyPredictor:
    """Lazy-loading, thread-safe body-measurement predictor."""

    def __init__(self) -> None:
        self._pipeline: Any | None = None
        self._lock = threading.Lock()
        self._model_version: str = "ansur2-gbr-v1"

    # ------------------------------------------------------------------ #
    #  Lazy model loading
    # ------------------------------------------------------------------ #

    def _ensure_loaded(self) -> None:
        """Load the joblib model on first call (thread-safe)."""
        if self._pipeline is not None:
            return
        with self._lock:
            if self._pipeline is not None:
                return  # double-check after acquiring lock
            if not MODEL_PATH.exists():
                raise FileNotFoundError(
                    f"Model file not found at {MODEL_PATH}. "
                    "Run `python scripts/train_body_model.py` first."
                )
            import joblib
            self._pipeline = joblib.load(MODEL_PATH)
            log.info(
                "BodyPredictor loaded model from %s (%.1f MB)",
                MODEL_PATH.name,
                MODEL_PATH.stat().st_size / 1e6,
            )
            # Load version from metadata if available
            if METADATA_PATH.exists():
                import json
                meta = json.loads(METADATA_PATH.read_text())
                self._model_version = meta.get("model_version", self._model_version)

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #

    def predict(
        self,
        height_cm: float,
        weight_kg: float,
        waist_cm: float,
        foot_length_cm: float,
        gender: str,
    ) -> dict[str, float]:
        """Predict 6 body measurements from 4 core biometrics + gender.

        Parameters
        ----------
        height_cm : float
            Height in centimetres (100–230).
        weight_kg : float
            Weight in kilograms (25–250).
        waist_cm : float
            Waist circumference in centimetres (40–180).
        foot_length_cm : float
            Foot length in centimetres (15–40).
        gender : str
            ``"male"`` or ``"female"``.

        Returns
        -------
        dict[str, float]
            Predicted measurements rounded to 1 d.p.::

                {"shoulders": 44.2, "chest": 89.3, "hip": 90.1,
                 "sleeve": 24.0, "inseam": 70.4, "outseam": 73.2}

        Raises
        ------
        ValueError
            If any input is outside plausible bounds or gender is invalid.
        FileNotFoundError
            If the model artefact hasn't been trained yet.
        """
        # ── Validate ──
        self._validate(height_cm, weight_kg, waist_cm, foot_length_cm, gender)

        # ── Load model ──
        self._ensure_loaded()

        # ── Build input DataFrame ──
        input_df = pd.DataFrame([{
            "height": float(height_cm),
            "weight": float(weight_kg),
            "waist": float(waist_cm),
            "foot_length": float(foot_length_cm),
            "gender": gender.lower().strip(),
        }])

        # ── Predict ──
        raw_pred = self._pipeline.predict(input_df)[0]

        # ── Round & package ──
        result = {}
        for name, val in zip(TARGET_NAMES, raw_pred):
            result[name] = round(float(val), 1)

        return result

    @property
    def model_version(self) -> str:
        return self._model_version

    # ------------------------------------------------------------------ #
    #  Validation
    # ------------------------------------------------------------------ #

    @staticmethod
    def _validate(
        height_cm: float,
        weight_kg: float,
        waist_cm: float,
        foot_length_cm: float,
        gender: str,
    ) -> None:
        gender_lower = gender.lower().strip() if isinstance(gender, str) else ""
        if gender_lower not in VALID_GENDERS:
            raise ValueError(
                f"gender must be 'male' or 'female', got '{gender}'"
            )

        checks = {
            "height_cm": height_cm,
            "weight_kg": weight_kg,
            "waist_cm": waist_cm,
            "foot_length_cm": foot_length_cm,
        }
        for name, value in checks.items():
            try:
                value = float(value)
            except (TypeError, ValueError):
                raise ValueError(f"{name} must be a number, got {value!r}")
            lo, hi = _BOUNDS[name]
            if not (lo <= value <= hi):
                raise ValueError(
                    f"{name}={value} is outside plausible range [{lo}, {hi}]"
                )


# ── Module-level singleton ───────────────────────────────────────────────

_instance: BodyPredictor | None = None
_instance_lock = threading.Lock()


def get_predictor() -> BodyPredictor:
    """Return the module-level singleton (creates on first call)."""
    global _instance
    if _instance is not None:
        return _instance
    with _instance_lock:
        if _instance is None:
            _instance = BodyPredictor()
        return _instance
