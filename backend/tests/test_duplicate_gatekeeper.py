import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.duplicate_detection import (
    _canonical_category,
    _canonical_color,
    _dominant_color,
    find_potential_duplicate,
)
from app.services.image_hash import average_hash, compute_sha256
from PIL import Image
import io
import base64


def _create_test_image_b64(color=(100, 150, 80), size=(100, 100)) -> str:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def test_canonical_category_normalization():
    assert _canonical_category("ז'קט") == "outerwear"
    assert _canonical_category("בולרו") == "outerwear"
    assert _canonical_category("jacket") == "outerwear"
    assert _canonical_category("מכנסיים") == "bottom"
    assert _canonical_category("חולצה") == "top"
    assert _canonical_category("חגורה") == "belt"
    assert _canonical_category("תיק") == "bag"


def test_canonical_color_normalization():
    assert _canonical_color("זית") == "green"
    assert _canonical_color("ירוק כהה") == "green"
    assert _canonical_color("olive") == "green"
    assert _canonical_color("שחור") == "black"
    assert _canonical_color("לבן") == "white"
    assert _canonical_color("כחול כהה") == "blue"


def test_dominant_color_extraction():
    assert _dominant_color({"colors": [{"name": "זית", "pct": 80}]}) == "זית"
    assert _dominant_color({"colors": ["ירוק", "שחור"]}) == "ירוק"
    assert _dominant_color({"color": "navy"}) == "navy"
    assert _dominant_color({}) == ""


@pytest.mark.anyio
async def test_find_potential_duplicate_by_metadata():
    user_id = "test-user-123"
    existing_item = {
        "id": "item-existing-1",
        "title": "ז'קט בולרו שרוולים תפוחים",
        "name": "ז'קט בולרו",
        "category": "outerwear",
        "sub_category": "ז'קט",
        "item_type": "jacket",
        "brand": "",
        "colors": [{"name": "זית"}],
        "thumbnail_data_url": "data:image/jpeg;base64,123",
        "source_phash": None,
        "source_sha256": None,
    }

    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[existing_item])
    mock_db.closet_items.find.return_value = mock_cursor

    with patch("app.services.duplicate_detection.get_db", return_value=mock_db):
        incoming_analysis = {
            "title": "ז'קט בולרו שרוולים תפוחים ומחוך",
            "category": "outerwear",
            "sub_category": "ז'קט",
            "item_type": "jacket",
            "colors": [{"name": "זית"}],
        }
        dup = await find_potential_duplicate(user_id, incoming_analysis)
        assert dup is not None
        assert dup["id"] == "item-existing-1"
        assert dup["match_reason"] == "metadata_match"


@pytest.mark.anyio
async def test_find_potential_duplicate_by_visual_hash():
    user_id = "test-user-123"
    img_b64 = _create_test_image_b64()
    phash = average_hash(img_b64)
    sha = compute_sha256(img_b64)

    existing_item = {
        "id": "item-existing-visual",
        "title": "Dark Olive Bolero",
        "name": "Bolero",
        "category": "outerwear",
        "sub_category": "jacket",
        "item_type": "jacket",
        "thumbnail_data_url": f"data:image/jpeg;base64,{img_b64}",
        "source_phash": phash,
        "source_sha256": sha,
    }

    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[existing_item])
    mock_db.closet_items.find.return_value = mock_cursor

    with patch("app.services.duplicate_detection.get_db", return_value=mock_db):
        incoming_analysis = {
            "title": "Different Title Here",
            "crop_base64": img_b64,
            "category": "outerwear",
            "sub_category": "jacket",
            "colors": [{"name": "green"}],
        }
        dup = await find_potential_duplicate(user_id, incoming_analysis)
        assert dup is not None
        assert dup["id"] == "item-existing-visual"
        assert "visual_hash" in dup["match_reason"]


@pytest.mark.anyio
async def test_different_black_tops_are_not_duplicates():
    """Verify that a black sweater is never flagged as a duplicate of a black patterned mesh top."""
    user_id = "test-user-123"
    existing_item = {
        "id": "item-mesh-top",
        "title": "Geometric Patterned Mesh Top",
        "name": "Geometric Patterned Mesh Top",
        "category": "top",
        "sub_category": "mesh top",
        "item_type": "top",
        "brand": "",
        "colors": [{"name": "black"}],
        "thumbnail_data_url": "data:image/jpeg;base64,different1",
        "source_phash": "0000000000000000",
        "source_sha256": "sha_mesh_top",
    }

    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[existing_item])
    mock_db.closet_items.find.return_value = mock_cursor

    with patch("app.services.duplicate_detection.get_db", return_value=mock_db):
        incoming_sweater = {
            "title": "סוודר שחור בסיסי",
            "name": "סוודר שחור בסיסי",
            "category": "top",
            "sub_category": "סוודר",
            "item_type": "sweater",
            "colors": [{"name": "שחור"}],
            "crop_base64": _create_test_image_b64(color=(20, 20, 20)),
        }
        dup = await find_potential_duplicate(user_id, incoming_sweater)
        assert dup is None, f"Expected no duplicate, but got {dup}"


@pytest.mark.anyio
async def test_distinct_graphic_shirts_not_flagged_as_duplicate():
    """Verify that two visually distinct graphic shirts (even if sharing category,
    sub_category, dominant color, and generic terms like 'graphic' and 'shirt')
    are never falsely flagged as duplicates."""
    user_id = "test-user-456"
    existing_item = {
        "id": "1d24b558-49dd-4c85-8e2b-f245bd966c14",
        "title": "Navy long sleeve shirt with red graphic accents",
        "name": "Graphic print long sleeve + tee",
        "category": "top",
        "sub_category": "t-shirt",
        "item_type": "long_sleeve_t_shirt",
        "brand": "",
        "colors": [{"name": "black", "pct": 85}, {"name": "red", "pct": 15}],
        "source_phash": "3c3c7e7e3c180000",
        "source_sha256": "sha_existing_shirt",
    }

    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[existing_item])
    mock_db.closet_items.find.return_value = mock_cursor

    with patch("app.services.duplicate_detection.get_db", return_value=mock_db):
        incoming_new_shirt = {
            "title": "Black Cotton Graphic T-Shirt",
            "name": "Black Cotton Graphic T-Shirt",
            "category": "Top",
            "sub_category": "T-Shirt",
            "item_type": "Short-Sleeve T-Shirt",
            "colors": [{"name": "Black", "pct": 90}],
            "source_phash": "ffff0000ffff0000",  # clearly distinct phash (Hamming > 6)
            "source_sha256": "sha_new_cartoon_shirt",
        }
        dup = await find_potential_duplicate(user_id, incoming_new_shirt)
        assert dup is None, f"Expected no duplicate for distinct graphic shirts, but got: {dup}"


