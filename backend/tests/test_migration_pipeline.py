"""
Unit tests for Screenshot-Scroller & Deduplication Migration Pipeline.
"""

from PIL import Image, ImageDraw

from app.services.migration.scroller_engine import ScrollerEngine, compute_frame_difference
from app.services.migration.grid_slicer import GridSlicer, extract_tiles_grid_geometry
from app.services.migration.dedup_engine import DedupEngine, compute_perceptual_hash, is_duplicate
from app.services.image_hash import hamming_distance


def create_mock_garment_frame(color: str = "red", shape: str = "rect") -> Image.Image:
    """Helper to create synthetic viewport frame for test execution."""
    img = Image.new("RGB", (300, 600), color="white")
    draw = ImageDraw.Draw(img)
    if shape == "rect":
        draw.rectangle([50, 50, 250, 250], fill=color)
        draw.rectangle([50, 300, 250, 550], fill="black")
    else:
        # Left half vs right half contrast for distinct horizontal dHash
        draw.rectangle([0, 0, 150, 600], fill="black")
        draw.rectangle([151, 0, 300, 600], fill="white")
    return img


def test_frame_difference_identical():
    img1 = create_mock_garment_frame("red")
    img2 = create_mock_garment_frame("red")
    diff = compute_frame_difference(img1, img2)
    assert diff == 0.0, f"Expected 0.0, got {diff}"


def test_frame_difference_distinct():
    img1 = create_mock_garment_frame("red")
    img2 = create_mock_garment_frame("yellow", shape="split")
    diff = compute_frame_difference(img1, img2)
    assert diff > 0.05, f"Expected > 0.05, got {diff}"


def test_scroller_engine():
    f1 = create_mock_garment_frame("red")
    f2 = create_mock_garment_frame("blue", shape="split")
    f3 = create_mock_garment_frame("blue", shape="split")  # Identical to f2 -> zero difference

    engine = ScrollerEngine(scroll_amount=300, max_iterations=10, diff_threshold=0.01)
    result = engine.process_frame_sequence([f1, f2, f3])

    assert result["total_processed"] == 2, f"Expected 2, got {result['total_processed']}"
    assert result["terminated_reason"] == "zero_difference"
    assert len(result["captured_frames"]) == 2


def test_grid_slicer():
    img = create_mock_garment_frame("red")
    slicer = GridSlicer(grid_columns=2)
    tiles = slicer.slice_viewport_frames([img])
    assert len(tiles) >= 2


def test_dedup_engine():
    img1 = create_mock_garment_frame("red", shape="rect")
    img2 = create_mock_garment_frame("red", shape="rect")  # Duplicate frame
    img3 = create_mock_garment_frame("green", shape="split")  # Structurally unique frame

    h1 = compute_perceptual_hash(img1)
    h2 = compute_perceptual_hash(img2)
    h3 = compute_perceptual_hash(img3)

    print(f"h1: {h1}, h2: {h2}, h3: {h3}")
    dist_12 = hamming_distance(h1, h2)
    dist_13 = hamming_distance(h1, h3)
    print(f"dist_12: {dist_12}, dist_13: {dist_13}")

    assert dist_12 == 0, f"Identical images should have 0 Hamming distance, got {dist_12}"
    assert dist_13 > 5, f"Distinct images should have > 5 Hamming distance, got {dist_13}"
    assert is_duplicate(h2, [h1], threshold=5)[0], "img2 should be identified as duplicate of img1"

    dedup = DedupEngine(threshold=5)
    unique_tiles = dedup.deduplicate_tiles([img1, img2, img3])
    assert len(unique_tiles) == 2, f"Expected 2 unique tiles, got {len(unique_tiles)}"


if __name__ == "__main__":
    print("Running migration pipeline tests...")
    test_frame_difference_identical()
    print("✓ test_frame_difference_identical passed")
    test_frame_difference_distinct()
    print("✓ test_frame_difference_distinct passed")
    test_scroller_engine()
    print("✓ test_scroller_engine passed")
    test_grid_slicer()
    print("✓ test_grid_slicer passed")
    test_dedup_engine()
    print("✓ test_dedup_engine passed")
    print("ALL MIGRATION PIPELINE TESTS PASSED!")
