"""Avatar shape calculation service."""
from typing import Any, Dict


def calculate_shape_parameters(measurements: Dict[str, Any]) -> Dict[str, float]:
    """
    Calculate 3D morph target weights from body measurements.
    
    This is a simplified mapping function. In a production scenario with SMPL or MakeHuman,
    this would involve a learned regressor or a more complex statistical mapping.
    
    Expected measurements (in cm / kg):
    - height: float
    - weight: float
    - chest: float
    - waist: float
    - hips: float
    """
    if not measurements:
        return {}

    # Basic baseline values for an "average" reference model
    baseline_height = 170.0
    baseline_weight = 65.0
    baseline_chest = 90.0
    baseline_waist = 75.0
    baseline_hips = 95.0

    height = float(measurements.get("height", baseline_height))
    weight = float(measurements.get("weight", baseline_weight))
    chest = float(measurements.get("chest", baseline_chest))
    waist = float(measurements.get("waist", baseline_waist))
    hips = float(measurements.get("hips", baseline_hips))

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
