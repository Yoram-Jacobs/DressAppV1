"""Unit tests for studio background cavity carving in underarm/armpit gaps."""
import numpy as np
from PIL import Image

from app.services.background_matting import carve_studio_background_cavities


def test_carve_studio_background_cavities_purple_fleece():
    """Verify that armpit gaps on colored garments on studio white background are carved."""
    # Synthetic 400x500 image with purple fabric and white armpit gaps
    arr = np.zeros((500, 400, 4), dtype=np.uint8)

    # Torso: x in [130..270], y in [100..450]
    # Left sleeve: x in [40..110], y in [120..380]
    # Right sleeve: x in [290..360], y in [120..380]
    # Armpit gaps: left [110..130, 200..350], right [270..290, 200..350]
    # Outside is transparent (alpha = 0, RGB = [255, 255, 255])
    arr[:, :, :3] = [255, 255, 255]

    # Fabric is purple [80, 45, 110]
    arr[100:450, 130:270, :3] = [80, 45, 110]
    arr[100:450, 130:270, 3] = 255
    arr[120:380, 40:110, :3] = [80, 45, 110]
    arr[120:380, 40:110, 3] = 255
    arr[120:380, 290:360, :3] = [80, 45, 110]
    arr[120:380, 290:360, 3] = 255

    # Erroneous opaque white armpit gaps
    arr[200:350, 110:130, :3] = [245, 245, 247]
    arr[200:350, 110:130, 3] = 245
    arr[200:350, 270:290, :3] = [245, 245, 247]
    arr[200:350, 270:290, 3] = 245

    # Chest logo in center torso (white text [250, 250, 250])
    arr[150:165, 180:220, :3] = [250, 250, 250]
    arr[150:165, 180:220, 3] = 255

    im = Image.fromarray(arr, "RGBA")
    cleaned = carve_studio_background_cavities(im)
    out_arr = np.array(cleaned)

    # 1. Chest logo should be preserved
    assert out_arr[155, 200, 3] == 255, "Central chest logo must remain opaque"

    # 2. Both armpit gaps should be carved to transparent
    assert out_arr[270, 120, 3] == 0, "Left armpit gap must be carved to alpha=0"
    assert out_arr[270, 280, 3] == 0, "Right armpit gap must be carved to alpha=0"

    # 3. Torso and sleeves fabric must remain intact
    assert out_arr[270, 200, 3] == 255, "Torso fabric must remain opaque"
    assert out_arr[270, 75, 3] == 255, "Left sleeve fabric must remain opaque"
    assert out_arr[270, 325, 3] == 255, "Right sleeve fabric must remain opaque"


def test_carve_studio_background_cavities_white_clothing_safety():
    """Verify that white / cream clothing is protected and not carved."""
    arr = np.zeros((500, 400, 4), dtype=np.uint8)
    arr[:, :, :3] = [255, 255, 255]

    # White shirt fabric is [242, 242, 244]
    arr[100:450, 130:270, :3] = [242, 242, 244]
    arr[100:450, 130:270, 3] = 255
    arr[120:380, 40:110, :3] = [242, 242, 244]
    arr[120:380, 40:110, 3] = 255

    im = Image.fromarray(arr, "RGBA")
    result = carve_studio_background_cavities(im)
    out_arr = np.array(result)

    # White shirt torso must be completely preserved
    assert out_arr[250, 200, 3] == 255, "White shirt fabric must not be carved"


def test_carve_studio_background_cavities_nude_strapless_dress():
    """Verify that nude / champagne / light beige strapless dresses are never carved or perforated."""
    # Synthetic 500x350 strapless dress with nude color [227, 200, 183]
    # No sleeves (single central torso column [x=100..250, y=80..460])
    arr = np.zeros((500, 350, 4), dtype=np.uint8)
    arr[:, :, :3] = [245, 245, 245]  # Studio white background

    # Nude fabric
    arr[80:460, 100:250, :3] = [227, 200, 183]
    arr[80:460, 100:250, 3] = 255

    # Lighter fabric highlight in ruched folds on flank [242, 230, 220]
    arr[150:250, 105:135, :3] = [242, 230, 220]
    arr[150:250, 105:135, 3] = 255

    im = Image.fromarray(arr, "RGBA")
    result = carve_studio_background_cavities(im)
    out_arr = np.array(result)

    # Flanks and highlights must remain 100% intact without any holes
    assert np.all(out_arr[80:460, 100:250, 3] == 255), "Nude strapless dress fabric must not be carved"

