import pytest
from unittest.mock import AsyncMock, patch
"""Tests for size chart analysis logic in backend/app/api/v1/sizes.py.

Verifies:
1. Upper-body garments (shirts, t-shirts, jackets, hoodies) use chest/bust/shoulders,
   and NEVER use hip/bottom measurements or oversize based on hip.
2. Footwear (shoes, sneakers, boots) use foot_length (cm) and shoe_size,
   and NEVER evaluate torso circumferences (chest, waist, hip).
3. Lower-body garments (pants, jeans, skirts) evaluate waist and hip.
"""

from app.api.v1.sizes import (
    _detect_category,
    _heuristic_match,
    _MEASUREMENT_ALIASES,
    _clean_shared_url,
    _detect_store_name,
)


def test_measurement_aliases_no_bottom_in_hip():
    """'bottom' and 'bottom_hem' must not map to hip."""
    assert "bottom" not in _MEASUREMENT_ALIASES["hip"]
    assert "bottom_hem" not in _MEASUREMENT_ALIASES["hip"]
    assert "foot_length" in _MEASUREMENT_ALIASES
    assert "insole" in _MEASUREMENT_ALIASES["foot_length"]
    assert "foot" in _MEASUREMENT_ALIASES["foot_length"]


def test_detect_category():
    # Explicit garment_type
    assert _detect_category("shirt", "") == "upper"
    assert _detect_category("t-shirt", "") == "upper"
    assert _detect_category("jacket", "") == "upper"
    assert _detect_category("blouse", "") == "upper"
    assert _detect_category("hoodie", "") == "upper"
    assert _detect_category("shoes", "") == "footwear"
    assert _detect_category("sneakers", "") == "footwear"
    assert _detect_category("boots", "") == "footwear"
    assert _detect_category("pants", "") == "lower"
    assert _detect_category("jeans", "") == "lower"
    assert _detect_category("skirt", "") == "lower"
    assert _detect_category("dress", "") == "full"

    # From chart text fallback when garment_type is missing/generic
    assert _detect_category(None, "Size | Insole Length (cm) | Foot Length\n38 | 24.5 | 24.0") == "footwear"
    assert _detect_category(None, "Size | Chest (cm) | Shoulder (cm)\nS | 92 | 42") == "upper"
    assert _detect_category(None, "Size | Waist (cm) | Hip (cm) | Inseam\n30 | 76 | 96 | 80") == "lower"


def test_upper_body_sizing_ignores_hip():
    """A user with Chest=90 (Small) and Hip=104 (Large) buying a shirt must get S/M, NOT L/XL."""
    chart_text = """
    Size | Chest (cm) | Length (cm)
    S    | 88-92      | 68
    M    | 93-98      | 70
    L    | 99-104     | 72
    XL   | 105-110    | 74
    """
    user_measurements = {
        "chest": 90,
        "waist": 76,
        "hip": 104,
    }

    result = _heuristic_match(
        chart_text=chart_text,
        measurements=user_measurements,
        garment_type="shirt",
    )
    assert result is not None
    assert result["recommended_size"] == "S"
    assert "chest" in result["matched_columns"]
    assert "hip" not in result["matched_columns"]


def test_footwear_sizing_ignores_torso_measurements():
    """A user with foot_length=26.0 buying shoes must get size 41 (26.0cm), NOT fail on hip=100."""
    chart_text = """
    EU Size | Foot Length (cm)
    39      | 24.5 - 25.0
    40      | 25.1 - 25.5
    41      | 25.6 - 26.2
    42      | 26.3 - 26.8
    43      | 26.9 - 27.5
    """
    user_measurements = {
        "chest": 96,
        "waist": 82,
        "hip": 102,
        "foot_length": 26.0,
    }

    result = _heuristic_match(
        chart_text=chart_text,
        measurements=user_measurements,
        garment_type="sneakers",
    )
    assert result is not None
    assert result["recommended_size"] == "41"
    assert "foot_length" in result["matched_columns"]
    assert "hip" not in result["matched_columns"]
    assert "chest" not in result["matched_columns"]


def test_lower_body_sizing_evaluates_waist_and_hip():
    """Lower body pants chart evaluates waist and hip correctly."""
    chart_text = """
    Size | Waist (cm) | Hip (cm)
    S    | 70-75      | 90-95
    M    | 76-81      | 96-101
    L    | 82-87      | 102-107
    XL   | 88-93      | 108-113
    """
    user_measurements = {
        "chest": 90,
        "waist": 78,
        "hip": 98,
    }

    result = _heuristic_match(
        chart_text=chart_text,
        measurements=user_measurements,
        garment_type="pants",
    )
    assert result is not None
    assert result["recommended_size"] == "M"
    assert "waist" in result["matched_columns"] or "hip" in result["matched_columns"]


def test_clean_shared_url_and_detect_store():
    # 1. URL embedded in social share text with tracking query parameters
    raw = "Look at this shirt! https://www.zara.com/us/en/oversized-linen-shirt-p12345.html?utm_source=share&utm_medium=mobile_app&fbclid=abc123"
    cleaned = _clean_shared_url(raw)
    assert cleaned == "https://www.zara.com/us/en/oversized-linen-shirt-p12345.html"
    assert _detect_store_name(cleaned) == "Zara"

    # 2. ASOS share
    raw_asos = "https://www.asos.com/prd/54321?ref=share"
    assert _clean_shared_url(raw_asos) == "https://www.asos.com/prd/54321"
    assert _detect_store_name(raw_asos) == "ASOS"


@pytest.mark.anyio
async def test_analyze_url_endpoint():
    from app.api.v1.sizes import analyze_url, AnalyzeUrlIn, ProductPreview

    mock_user = {
        "id": "usr_test_share",
        "email": "test@dressapp.co",
        "body_measurements": {"chest": 96, "waist": 82, "hip": 100},
    }

    mock_product = ProductPreview(
        url="https://www.zara.com/us/en/linen-shirt-p123.html",
        title="Linen Blend Overshirt",
        brand="Zara",
        image_url="https://static.zara.net/photos/shirt.jpg",
        price="49.90",
        currency="USD",
        garment_type="shirt",
        store="Zara",
    )
    mock_chart = """
    Size | Chest (cm) | Waist (cm)
    S    | 88-92      | 74-78
    M    | 94-98      | 80-84
    L    | 100-106    | 86-92
    """

    with patch("app.api.v1.sizes._extract_product_from_url", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = (mock_product, mock_chart, None)
        payload = AnalyzeUrlIn(url="Check this out! https://www.zara.com/us/en/linen-shirt-p123.html?utm_source=app")
        res = await analyze_url(payload=payload, user=mock_user)
        assert res.product.title == "Linen Blend Overshirt"
        assert res.product.brand == "Zara"
        assert res.recommendation.recommended_size == "M"
        assert "chest" in res.recommendation.matched_columns



def test_zara_transposed_chart_recommendation():
    """Zara size chart has AREA in corner, sizes across columns (S, M, L), and body parts down rows.
    Must recommend L (or M), and MUST NEVER recommend 'TOTAL' as a size."""
    zara_chart = """
    AREA\tS\tM\tL
    Chest\t36.5\t37.5\t38.5
    Waist\t33.5\t34.5\t35.5
    Hip\t46.5\t47.5\t48.5
    Total length\t75.0\t76.0\t77.0
    """
    user_measurements = {
        "shoulder": 36.9,
        "waist": 72,
        "chest": 74,
        "hip": 94,
    }

    result = _heuristic_match(
        chart_text=zara_chart,
        measurements=user_measurements,
        garment_type="dress",
    )
    assert result is not None
    assert result["recommended_size"] == "L"
    assert result["recommended_size"] != "TOTAL"
    assert "TOTAL" not in result["reasoning"]
    assert "waist" in result["matched_columns"] or "chest" in result["matched_columns"]


def test_zara_html_table_transposed():
    """HTML table format from Zara with <th>AREA</th><th>S</th><th>M</th><th>L</th>."""
    html_table = """
    <table>
      <thead>
        <tr><th>AREA</th><th>S</th><th>M</th><th>L</th></tr>
      </thead>
      <tbody>
        <tr><td>Chest</td><td>36.5</td><td>37.5</td><td>38.5</td></tr>
        <tr><td>Waist</td><td>33.5</td><td>34.5</td><td>35.5</td></tr>
        <tr><td>Hip</td><td>46.5</td><td>47.5</td><td>48.5</td></tr>
        <tr><td>Total length</td><td>75.0</td><td>76.0</td><td>77.0</td></tr>
      </tbody>
    </table>
    """
    user_measurements = {
        "shoulder": 36.9,
        "waist": 72,
        "chest": 74,
        "hip": 94,
    }

    result = _heuristic_match(
        chart_text=html_table,
        measurements=user_measurements,
        garment_type="dress",
    )
    assert result is not None
    assert result["recommended_size"] == "L"
    assert result["recommended_size"] != "TOTAL"


def test_numeric_transposed_chart():
    """Numeric sizes across columns (AREA | 36 | 38 | 40 | 42) must transpose correctly."""
    numeric_chart = """
    AREA | 36 | 38 | 40 | 42
    Waist | 34 | 36 | 38 | 40
    Hip | 46 | 48 | 50 | 52
    Total length | 98 | 99 | 100 | 101
    """
    user_measurements = {
        "waist": 75,
        "hip": 99,
    }

    result = _heuristic_match(
        chart_text=numeric_chart,
        measurements=user_measurements,
        garment_type="pants",
    )
    assert result is not None
    # 38 flat waist is 72 cm (tight for 75), 40 flat waist is 76 cm (fits 75 cm)
    assert result["recommended_size"] == "40"
    assert result["recommended_size"] != "TOTAL"
    assert result["recommended_size"] != "LENGTH"
