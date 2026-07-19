"""DressApp — ANSUR II body-measurement model trainer.

Downloads the public-domain ANSUR II (US Army Anthropometric Survey 2012)
male and female CSVs, maps the raw columns to DressApp's UI metric keys,
trains a MultiOutputRegressor(GradientBoostingRegressor) pipeline, evaluates
MAE per target, and serialises the fitted artefact to
``backend/ml_models/body_predictor.joblib``.

Usage
-----
    cd C:\\DressApp_AG\\backend
    python scripts/train_body_model.py

The script is idempotent — re-running overwrites the existing model file.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler
from sklearn.compose import ColumnTransformer

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("train_body_model")

# ── Paths ────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
BACKEND_DIR = SCRIPT_DIR.parent
MODEL_DIR = BACKEND_DIR / "ml_models"

# ── ANSUR II public-domain download URLs ────────────────────────────
# GitHub raw mirror of the original DTIC release. Files are ~1–2 MB each.
ANSUR_URLS = {
    "male": (
        "https://raw.githubusercontent.com/senihberkay/US-Army-ANSUR-II/"
        "master/ANSUR%20II%20MALE%20Public.csv"
    ),
    "female": (
        "https://raw.githubusercontent.com/senihberkay/US-Army-ANSUR-II/"
        "master/ANSUR%20II%20FEMALE%20Public.csv"
    ),
}

# ── Column mappings ──────────────────────────────────────────────────────
# ANSUR II measurements are in mm (except weightkg which is in
# hectograms, i.e. 1/10 kg).

FEATURE_COLS_ANSUR = ["stature", "weightkg", "waistcircumference", "footlength"]
FEATURE_NAMES_UI = ["height", "weight", "waist", "foot_length"]

TARGET_COLS_ANSUR = [
    "biacromialbreadth",     # → shoulders
    "chestcircumference",    # → chest
    "buttockcircumference",  # → hip
    "sleeveoutseam",         # → sleeve (UI label: "Sleeve length")
    "crotchheight",          # → inseam
    "functionalleglength",   # → outseam (floor to hip joint)
]
TARGET_NAMES_UI = ["shoulders", "chest", "hip", "sleeve", "inseam", "outseam"]

ALL_ANSUR_COLS = FEATURE_COLS_ANSUR + TARGET_COLS_ANSUR


# ── Helpers ──────────────────────────────────────────────────────────────

def _download_csv(url: str, dest: Path) -> Path:
    """Download *url* to *dest* if not already cached."""
    if dest.exists():
        log.info("Cached  → %s", dest.name)
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    log.info("Downloading %s …", url[:90])
    try:
        urllib.request.urlretrieve(url, dest)
    except Exception as exc:
        log.warning("Primary URL failed (%s), trying fallback …", exc)
        raise
    log.info("Saved   → %s  (%d KB)", dest.name, dest.stat().st_size // 1024)
    return dest


def download_ansur_data() -> pd.DataFrame:
    """Download & concatenate ANSUR II male + female CSVs.

    Returns a DataFrame with a ``gender`` column (``male`` / ``female``)
    and all anthropometric columns in **mm** (raw, unconverted).
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    frames = []

    for sex in ("male", "female"):
        dest = DATA_DIR / f"ANSUR_II_{sex.upper()}.csv"

        # Download if not already cached
        if not dest.exists():
            _download_csv(ANSUR_URLS[sex], dest)

        # Read with flexible encoding (ANSUR files sometimes use latin-1)
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                df = pd.read_csv(dest, encoding=enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise RuntimeError(f"Cannot decode {dest}")

        # Normalise column names to lowercase
        df.columns = df.columns.str.strip().str.lower()
        df["gender"] = sex
        frames.append(df)
        log.info("Loaded  %s: %d rows × %d cols", sex, len(df), len(df.columns))

    combined = pd.concat(frames, ignore_index=True)
    log.info("Combined dataset: %d rows", len(combined))
    return combined


def prepare_dataset(raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Convert raw ANSUR columns → DressApp units and return (X, y).

    Conversions:
      - All mm columns  → cm  (÷ 10)
      - weightkg (hectograms) → kg (÷ 10)
      - gender → kept as string (encoded later in the pipeline)
    """
    # Validate required columns exist
    missing = [c for c in ALL_ANSUR_COLS if c not in raw.columns]
    if missing:
        available = sorted(raw.columns.tolist())
        raise KeyError(
            f"Missing ANSUR columns: {missing}.\n"
            f"Available columns ({len(available)}): {available[:30]}…"
        )

    # Drop rows with NaN in any column we need
    subset = raw[ALL_ANSUR_COLS + ["gender"]].dropna()
    dropped = len(raw) - len(subset)
    if dropped:
        log.info("Dropped %d rows with NaN values", dropped)

    # Convert units
    X = pd.DataFrame()
    for ansur_col, ui_name in zip(FEATURE_COLS_ANSUR, FEATURE_NAMES_UI):
        if ansur_col == "weightkg":
            # Hectograms → kg
            X[ui_name] = subset[ansur_col].values / 10.0
        else:
            # mm → cm
            X[ui_name] = subset[ansur_col].values / 10.0

    X["gender"] = subset["gender"].values

    y = pd.DataFrame()
    for ansur_col, ui_name in zip(TARGET_COLS_ANSUR, TARGET_NAMES_UI):
        # All targets are mm → cm
        y[ui_name] = subset[ansur_col].values / 10.0

    log.info("Feature matrix: %s, Target matrix: %s", X.shape, y.shape)
    log.info("Gender distribution:\n%s", X["gender"].value_counts().to_string())

    return X, y


def build_pipeline() -> Pipeline:
    """Build a scikit-learn Pipeline with preprocessing + multi-output GBR."""

    # Column transformer: scale numeric features, ordinal-encode gender
    numeric_features = FEATURE_NAMES_UI  # height, weight, waist, foot_length
    categorical_features = ["gender"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric_features),
            ("cat", OrdinalEncoder(categories=[["female", "male"]]), categorical_features),
        ],
        remainder="drop",
    )

    model = MultiOutputRegressor(
        GradientBoostingRegressor(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            random_state=42,
        )
    )

    return Pipeline([
        ("preprocessor", preprocessor),
        ("model", model),
    ])


def evaluate(pipeline: Pipeline, X_test: pd.DataFrame, y_test: pd.DataFrame) -> dict:
    """Compute per-target MAE (in cm) and print a summary table."""
    y_pred = pipeline.predict(X_test)
    results = {}

    print("\n" + "=" * 60)
    print("  Model Evaluation — Mean Absolute Error (cm)")
    print("=" * 60)

    total_mae = 0.0
    for i, name in enumerate(TARGET_NAMES_UI):
        mae = mean_absolute_error(y_test.iloc[:, i], y_pred[:, i])
        results[name] = round(mae, 3)
        total_mae += mae
        print(f"  {name:>12s}:  {mae:.2f} cm")

    overall = total_mae / len(TARGET_NAMES_UI)
    results["overall"] = round(overall, 3)
    print(f"  {'OVERALL':>12s}:  {overall:.2f} cm")
    print("=" * 60 + "\n")

    return results


def main() -> None:
    # ── 1. Download & load data ──
    log.info("Step 1/5 — Downloading ANSUR II data …")
    raw = download_ansur_data()

    # ── 2. Prepare features & targets ──
    log.info("Step 2/5 — Preparing dataset …")
    X, y = prepare_dataset(raw)

    # ── 3. Train/test split (80/20, stratified by gender) ──
    log.info("Step 3/5 — Splitting train/test …")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=X["gender"]
    )
    log.info("Train: %d, Test: %d", len(X_train), len(X_test))

    # ── 4. Train ──
    log.info("Step 4/5 — Training MultiOutput GBR pipeline …")
    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    log.info("Training complete.")

    # ── 5. Evaluate ──
    log.info("Step 5/5 — Evaluating on held-out test set …")
    mae_scores = evaluate(pipeline, X_test, y_test)

    # ── 6. Export ──
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODEL_DIR / "body_predictor.joblib"
    joblib.dump(pipeline, model_path, compress=3)
    log.info("Model saved → %s  (%.1f MB)", model_path, model_path.stat().st_size / 1e6)

    # Save metadata
    metadata = {
        "model_version": "ansur2-gbr-v1",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset": "ANSUR II (2012) — US Army Anthropometric Survey",
        "n_train": len(X_train),
        "n_test": len(X_test),
        "features": FEATURE_NAMES_UI + ["gender"],
        "targets": TARGET_NAMES_UI,
        "mae_scores_cm": mae_scores,
        "model_type": "MultiOutputRegressor(GradientBoostingRegressor)",
        "hyperparameters": {
            "n_estimators": 300,
            "max_depth": 5,
            "learning_rate": 0.05,
            "subsample": 0.8,
        },
    }
    meta_path = MODEL_DIR / "model_metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2))
    log.info("Metadata saved → %s", meta_path)

    # Quick sanity check
    print("\n── Sanity check (female, 170cm/64kg/84cm waist/23.5cm foot) ──")
    test_input = pd.DataFrame([{
        "height": 170.0, "weight": 64.0, "waist": 84.0,
        "foot_length": 23.5, "gender": "female",
    }])
    pred = pipeline.predict(test_input)[0]
    for name, val in zip(TARGET_NAMES_UI, pred):
        print(f"  {name:>12s}: {val:.1f} cm")
    print()


if __name__ == "__main__":
    main()
