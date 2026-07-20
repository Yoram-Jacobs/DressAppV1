"""Avatar shape calculation service."""
from typing import Any, Dict


def get_default_measurements(gender: str = "female") -> Dict[str, Any]:
    """Get anatomical baseline measurements in cm for male or female."""
    if gender == "male":
        return {
            "height": 178.0,
            "shoulders": 44.0,
            "chest": 98.0,
            "waist": 82.0,
            "hips": 96.0,
            "arm_length": 64.0,
            "inseam": 82.0,
            "gender": "male"
        }
    return {
        "height": 168.0,
        "shoulders": 38.0,
        "chest": 88.0,
        "waist": 68.0,
        "hips": 94.0,
        "arm_length": 58.0,
        "inseam": 76.0,
        "gender": "female"
    }


def calculate_shape_parameters(measurements: Dict[str, Any], sex: str = "female") -> Dict[str, float]:
    """
    Calculate 3D morph target weights from body measurements.
    """
    if not measurements:
        measurements = {}

    defaults = get_default_measurements(sex)
    height = float(measurements.get("height", defaults["height"]))
    weight = float(measurements.get("weight", 65.0))
    chest = float(measurements.get("chest", defaults["chest"]))
    waist = float(measurements.get("waist", defaults["waist"]))
    hips = float(measurements.get("hips", defaults["hips"]))

    baseline_height = defaults["height"]
    baseline_weight = 65.0
    baseline_chest = defaults["chest"]
    baseline_waist = defaults["waist"]
    baseline_hips = defaults["hips"]

    # Calculate differences from baseline
    height_diff = (height - baseline_height) / 20.0  # normalize
    weight_diff = (weight - baseline_weight) / 15.0
    
    # Simple heuristic morph targets
    shape_params = {
        "tall": max(0.0, height_diff),
        "short": max(0.0, -height_diff),
        "heavy": max(0.0, weight_diff),
        "thin": max(0.0, -weight_diff),
        "busty": max(0.0, (chest - baseline_chest) / 10.0),
        "waist_thick": max(0.0, (waist - baseline_waist) / 10.0),
        "waist_thin": max(0.0, -(waist - baseline_waist) / 10.0),
        "hips_wide": max(0.0, (hips - baseline_hips) / 10.0),
        "hips_narrow": max(0.0, -(hips - baseline_hips) / 10.0),
    }

    # Cap parameters between 0.0 and 1.0
    for k, v in shape_params.items():
        shape_params[k] = min(1.0, max(0.0, v))

    return shape_params

