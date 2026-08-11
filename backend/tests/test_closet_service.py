import pytest
import numpy as np
from app.services import closet_service

def test_bytes_from_data_url():
    # Valid data URL
    data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    res = closet_service.bytes_from_data_url(data_url)
    assert res is not None
    assert isinstance(res, bytes)

    # Invalid URL
    assert closet_service.bytes_from_data_url("invalid-url") is None


def test_pick_segformer_mask_for_category():
    # Mock mask
    mock_mask = np.ones((10, 10), dtype=np.uint8)
    garments = [
        {"category": "top", "mask": mock_mask, "_human_mask_full": mock_mask},
        {"category": "bottom", "mask": np.zeros((10, 10), dtype=np.uint8), "_human_mask_full": None}
    ]

    # Matching category
    mask, human_mask = closet_service.pick_segformer_mask_for_category(garments, "top")
    assert mask is not None
    assert np.array_equal(mask, mock_mask)

    # Fallback to largest mask
    mask, human_mask = closet_service.pick_segformer_mask_for_category(garments, "invalid_category")
    assert mask is not None
    assert np.array_equal(mask, mock_mask)

def test_safe_analysis():
    # Valid fields
    parsed = {"title": "Red Dress", "category": "Full Body"}
    res = closet_service.safe_analysis(parsed)
    assert res["title"] == "Red Dress"
    assert res["category"] == "Full Body"
    # Verify defaults are set
    assert res["pattern"] == "solid"
    assert res["gender"] == "unisex"

    # Invalid fields fallback (trigger validation error with incorrect type for colors)
    res_fail = closet_service.safe_analysis({"title": "Test Title", "colors": "not-a-list"})
    assert res_fail["title"] == "Test Title"

    res_fail_no_title = closet_service.safe_analysis({"colors": "not-a-list"})
    assert res_fail_no_title["title"] == "Unnamed garment"
