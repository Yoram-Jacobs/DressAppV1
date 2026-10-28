import io
import numpy as np
from PIL import Image
import pytest

from app.services.background_matting import drop_disconnected_islands, strip_hanger_hook
from app.services.clothing_parser import apply_alpha_intersection
from app.services.vision.validation import (
    _enforce_segformer_category,
    _sanitize_cross_category_contamination,
)


def test_strip_hanger_hook():
    """Verify strip_hanger_hook zeroes out the narrow hanger hook stalk above shoulders."""
    arr = np.zeros((300, 300, 4), dtype=np.uint8)
    # 12px wide hanger hook from y=20 to y=70 (x=144..156)
    arr[20:70, 144:156] = [200, 200, 200, 255]
    # Garment shoulders 180px wide from y=70 to y=250 (x=60..240)
    arr[70:250, 60:240] = [220, 180, 140, 255]

    im = Image.fromarray(arr, "RGBA")
    cleaned = strip_hanger_hook(im)
    out_arr = np.array(cleaned)

    # Hook must be wiped out
    assert (out_arr[20:65, 144:156, 3] == 0).all()
    # Garment body must be intact
    assert (out_arr[75:240, 65:235, 3] == 255).all()


def test_drop_disconnected_islands_plant_leaf():
    """Verify drop_disconnected_islands drops secondary plant leaf clutter near garment."""
    arr = np.zeros((400, 400, 4), dtype=np.uint8)
    # Dominant garment: 200x200 = 40,000 px
    arr[100:300, 100:300] = [100, 150, 200, 255]
    # Plant leaf on left: 30x30 = 900 px (2.25% of dominant mass), 30px away from garment
    arr[180:210, 40:70] = [50, 180, 50, 255]

    im = Image.fromarray(arr, "RGBA")
    cleaned = drop_disconnected_islands(im, min_area_ratio=0.05)
    out_arr = np.array(cleaned)

    # Plant leaf must be zeroed out
    assert (out_arr[180:210, 40:70, 3] == 0).all()
    # Garment must be 100% preserved
    assert (out_arr[100:300, 100:300, 3] == 255).all()


def test_apply_alpha_intersection_isolates_single_item():
    """Verify apply_alpha_intersection on single items trims apex hanger and outside plants."""
    # rembg output: garment + plant leaf on left + hanger hook on top
    rembg_arr = np.zeros((400, 400, 4), dtype=np.uint8)
    rembg_arr[100:300, 100:300] = [240, 230, 210, 255] # Garment
    rembg_arr[180:220, 20:60] = [30, 150, 40, 255]     # Plant
    rembg_arr[30:100, 195:205] = [180, 180, 180, 255]  # Hanger hook

    buf = io.BytesIO()
    Image.fromarray(rembg_arr, "RGBA").save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    # SegFormer mask: strictly sees the garment (100:300, 100:300)
    seg_mask = np.zeros((400, 400), dtype=np.uint8)
    seg_mask[100:300, 100:300] = 255

    res = apply_alpha_intersection(
        matted_bytes,
        seg_mask,
        category="top",
        label="sweater",
        is_single_item=True,
    )
    assert res is not None
    res_im = Image.open(io.BytesIO(res)).convert("RGBA")
    res_arr = np.array(res_im)

    # Outside plant leaf must be eliminated
    assert (res_arr[180:220, 20:60, 3] == 0).all()
    # Hanger hook above apex must be eliminated
    assert (res_arr[30:95, 195:205, 3] == 0).all()
    # Garment interior must be preserved
    assert (res_arr[120:280, 120:280, 3] > 0).all()


def test_hanger_induced_polo_misclassification_auto_correction():
    """Verify hanger-induced polo misclassification is corrected to knit fringe poncho."""
    analysis = {
        "category": "Accessories",
        "sub_category": "חולצת פולו",
        "item_type": "חולצת פולו קלאסי",
        "name": "חולצת פולו שמנת",
        "title": "חולצת פולו שמנת",
        "caption": "חולצת פולו אלגנטית סרוגה עם פרנזים.",
        "colors": [{"name": "שמנת", "pct": 100}],
        "tags": ["סריג", "פרנזים", "פולו"],
    }
    _sanitize_cross_category_contamination(analysis, language="he")

    assert analysis["category"] == "Outerwear"
    assert "פונצ" in analysis["sub_category"] or "שכמי" in analysis["sub_category"]
    assert "פונצ'ו סרוג" in analysis["name"]
    assert analysis["_category_overridden_by"] == "hanger-polo-to-poncho"


def test_category_integrity_polo_cannot_be_accessories():
    """Verify category integrity guard prevents polo shirt / tops from having category='Accessories'."""
    analysis = {
        "category": "Accessories",
        "sub_category": "חולצת פולו",
        "item_type": "חולצת פולו קלאסי",
        "name": "חולצת פולו",
        "title": "חולצת פולו",
        "caption": "חולצת פולו איכותית.",
    }
    _sanitize_cross_category_contamination(analysis, language="he")

    assert analysis["category"] == "Top"


def test_enforce_segformer_category_preserves_upper_apparel():
    """Verify SegFormer accessory kind does not override LLM top/polo/poncho to Accessories."""
    analysis = {
        "category": "Top",
        "sub_category": "חולצת פולו",
        "item_type": "חולצת פולו קלאסי",
        "name": "חולצת פולו",
        "title": "חולצת פולו",
    }
    # SegFormer predicted scarf (kind="accessory")
    res = _enforce_segformer_category(
        analysis,
        segformer_kind="accessory",
        label="scarf",
        is_single_item=True,
        language="he",
    )
    assert res is not None
    # Category must remain Top, NEVER overridden to Accessories
    assert res["category"] == "Top"
