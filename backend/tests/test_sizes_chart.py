"""Tests for size chart analysis logic in backend/app/api/v1/sizes.py.

Verifies:
1. Upper-body garments (shirts, t-shirts, jackets, hoodies) use chest/bust/shoulders,
   and NEVER use hip/bottom measurements or oversize based on hip.
2. Footwear (shoes, sneakers, boots) use foot_length (cm) and shoe_size,
   and NEVER evaluate torso circumferences (chest, waist, hip).
3. Lower-body garments (pants, jeans, skirts) evaluate waist and hip.
4. Full-body garments, sets, suits, jumpsuits, and overalls evaluate BOTH top and bottom,
   recommending the safe bounding size so neither top nor bottom is too small.
"""

from app.api.v1.sizes import (
    _detect_category,
    _heuristic_match,
    _MEASUREMENT_ALIASES,
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
    assert _detect_category("jumpsuit", "") == "full"
    assert _detect_category("suit", "") == "full"
    assert _detect_category("2-pieces", "") == "full"
    assert _detect_category("2 piece outfit", "") == "full"
    assert _detect_category("pants set", "") == "full"

    # From chart text fallback when garment_type is missing or generic
    assert _detect_category(None, "Size | Insole Length (cm) | Foot Length\n38 | 24.5 | 24.0") == "footwear"
    assert _detect_category(None, "Size | Chest (cm) | Shoulder (cm)\nS | 92 | 42") == "upper"
    assert _detect_category(None, "Size | Waist (cm) | Hip (cm) | Inseam\n30 | 76 | 96 | 80") == "lower"
    assert _detect_category(None, "Size | Bust | Waist Size | Hip Size | Inseam\n1XL | 126 | 83 | 124 | 71") == "full"
    # Even if garment_type was given as shirt, chart with both upper and lower columns detects as full/set
    assert _detect_category("shirt", "Size | Shoulder | Bust | Waist Size | Hip Size | Top Length | Inseam\n1XL | 52 | 126 | 83 | 124 | 80 | 71") == "full"


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


def test_two_piece_set_evaluates_top_and_bottom_bounding_size():
    """Shein 2-piece outfit test:
    User has Chest=91.8 (fits 1XL chest 126), Waist=84 (1XL waist 83 is too small!).
    Must recommend 2XL (waist 89 >= 84) so the pants are not too small!
    """
    shein_chart = """
    Size | Shoulder | Bust | Waist Size | Hip Size | Length | Top Length | Inseam | Sleeve Length
    1XL  | 52       | 126  | 83         | 124      | 103    | 80         | 71     | 65
    2XL  | 54       | 134  | 89         | 130      | 104.5  | 81.5       | 72.5   | 66
    3XL  | 56       | 142  | 95         | 136      | 106    | 83         | 74     | 67
    4XL  | 58       | 150  | 101        | 142      | 107.5  | 84.5       | 75.5   | 68
    5XL  | 60       | 158  | 107        | 148      | 109    | 86         | 77     | 69
    6XL  | 62       | 166  | 113        | 154      | 110.5  | 87.5       | 78.5   | 70
    """
    user_measurements = {
        "chest": 91.8,
        "shoulder": 48.0,
        "waist": 84.0,  # 84 cm exceeds 1XL (83 cm), fits 2XL (89 cm)
        "hip": 98.0,
    }

    result = _heuristic_match(
        chart_text=shein_chart,
        measurements=user_measurements,
        garment_type="2-pieces outfit set",
    )
    assert result is not None
    # 1XL must NOT be recommended because waist 83 < 84!
    assert result["recommended_size"] == "2XL"
    assert "chest" in result["matched_columns"] or "bust" in result["matched_columns"]
    assert "waist" in result["matched_columns"]
    assert "accommodates both your top" in result["reasoning"] or "fits" in result["reasoning"]


if __name__ == "__main__":
    for name, func in list(globals().items()):
        if name.startswith("test_") and callable(func):
            print(f"Running {name}...")
            func()
            print(f"PASS: {name}")
    print("\nAll tests passed successfully!")
