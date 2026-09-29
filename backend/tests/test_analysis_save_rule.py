import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import Request
from app.api.v1.closet.ingestion import AnalyzeIn, analyze_item_image


def _dummy_user():
    return {
        "id": "usr-test-12345",
        "email": "tester@dressapp.co",
        "roles": ["user"],
        "preferred_language": "en",
        "tier": "pro",
    }


@pytest.mark.anyio
async def test_analyze_does_not_save_to_closet_by_default():
    """Verify the integrated rule:
    By default (auto_save=False), analyzing an image does NOT save results to the closet.
    Items remain purely in-memory on the frontend until the user explicitly hits Save.
    """
    user = _dummy_user()
    payload = AnalyzeIn(image_base64="dGVzdGltYWdl", auto_save=False)

    # Mock request headers so wants_ndjson is True
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"accept": "application/x-ndjson"}

    # Mock vision service
    mock_vision = MagicMock()
    async def mock_streamer(*args, **kwargs):
        yield {"type": "detect", "count": 1, "items_meta": [{"label": "shirt", "crop_base64": "Y3JvcA==", "crop_mime": "image/jpeg"}]}
        yield {
            "type": "item",
            "index": 0,
            "image_index": 0,
            "analysis": {
                "title": "Vintage Striped Linen Shirt",
                "category": "top",
                "sub_category": "shirt",
                "item_type": "button_up",
                "colors": [{"name": "blue"}],
            },
        }
        yield {"type": "done", "count": 1}

    mock_vision.analyze_outfits_stream = mock_streamer

    with patch("app.api.v1.closet.ingestion.get_garment_vision_service", return_value=mock_vision), \
         patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock, return_value=True), \
         patch("app.api.v1.closet.ingestion.get_db", return_value=MagicMock()), \
         patch("app.api.v1.closet.ingestion.find_potential_duplicate", new_callable=AsyncMock, return_value=None), \
         patch("app.api.v1.closet.items.save_closet_item_document", new_callable=AsyncMock) as mock_save:

        resp = await analyze_item_image(payload=payload, request=mock_request, user=user)
        # Read the streamed frames
        frames = []
        import json
        async for chunk in resp.body_iterator:
            chunk_str = chunk.decode("utf-8") if isinstance(chunk, bytes) else str(chunk)
            for line in chunk_str.strip().split("\n"):
                if line.strip():
                    try:
                        frames.append(json.loads(line.strip()))
                    except Exception:
                        pass

        # Verify save_closet_item_document was NEVER called!
        assert mock_save.call_count == 0, "save_closet_item_document must NOT be called by default"

        # Verify the item frame has saved=False and item_id=None
        item_frames = [f for f in frames if f.get("type") == "item"]
        assert len(item_frames) == 1
        item_frame = item_frames[0]
        assert item_frame.get("saved") is False
        assert item_frame.get("item_id") is None
        assert item_frame.get("analysis", {}).get("title") == "Vintage Striped Linen Shirt"


@pytest.mark.anyio
async def test_analyze_saves_only_when_explicitly_requested():
    """Verify that auto-saving ONLY happens if auto_save=True is explicitly specified."""
    user = _dummy_user()
    payload = AnalyzeIn(image_base64="dGVzdGltYWdl", auto_save=True)

    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"accept": "application/x-ndjson"}

    mock_vision = MagicMock()
    async def mock_streamer(*args, **kwargs):
        yield {"type": "detect", "count": 1, "items_meta": [{"label": "shirt", "crop_base64": "Y3JvcA==", "crop_mime": "image/jpeg"}]}
        yield {
            "type": "item",
            "index": 0,
            "image_index": 0,
            "analysis": {
                "title": "Vintage Striped Linen Shirt",
                "category": "top",
                "sub_category": "shirt",
                "item_type": "button_up",
                "colors": [{"name": "blue"}],
            },
        }
        yield {"type": "done", "count": 1}

    mock_vision.analyze_outfits_stream = mock_streamer
    saved_doc = {"id": "saved-doc-999", "title": "Vintage Striped Linen Shirt", "category": "top"}

    with patch("app.api.v1.closet.ingestion.get_garment_vision_service", return_value=mock_vision), \
         patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock, return_value=True), \
         patch("app.api.v1.closet.ingestion.get_db", return_value=MagicMock()), \
         patch("app.api.v1.closet.ingestion.find_potential_duplicate", new_callable=AsyncMock, return_value=None), \
         patch("app.api.v1.closet.items.save_closet_item_document", new_callable=AsyncMock, return_value=saved_doc) as mock_save:

        resp = await analyze_item_image(payload=payload, request=mock_request, user=user)
        frames = []
        import json
        async for chunk in resp.body_iterator:
            chunk_str = chunk.decode("utf-8") if isinstance(chunk, bytes) else str(chunk)
            for line in chunk_str.strip().split("\n"):
                if line.strip():
                    try:
                        frames.append(json.loads(line.strip()))
                    except Exception:
                        pass

        # Verify save_closet_item_document WAS called because auto_save=True
        assert mock_save.call_count == 1
        item_frames = [f for f in frames if f.get("type") == "item"]
        assert len(item_frames) == 1
        assert item_frames[0].get("saved") is True
        assert item_frames[0].get("item_id") == "saved-doc-999"


@pytest.mark.anyio
async def test_batch_sync_does_not_save_by_default():
    """Verify non-streaming path also adheres to the rule: auto_save=False does not save."""
    user = _dummy_user()
    payload = AnalyzeIn(image_base64="dGVzdGltYWdl", auto_save=False)

    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"accept": "application/json"}

    mock_vision = MagicMock()
    async def mock_streamer(*args, **kwargs):
        yield {"type": "detect", "count": 1, "items_meta": [{"label": "pants", "crop_base64": "cGFudHM=", "crop_mime": "image/jpeg"}]}
        yield {
            "type": "item",
            "index": 0,
            "image_index": 0,
            "analysis": {
                "title": "Black Slim Jeans",
                "category": "bottom",
                "sub_category": "jeans",
                "item_type": "pants",
                "colors": [{"name": "black"}],
            },
        }
        yield {"type": "done", "count": 1}

    mock_vision.analyze_outfits_stream = mock_streamer

    with patch("app.api.v1.closet.ingestion.get_garment_vision_service", return_value=mock_vision), \
         patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock, return_value=True), \
         patch("app.api.v1.closet.ingestion.get_db", return_value=MagicMock()), \
         patch("app.api.v1.closet.ingestion.find_potential_duplicate", new_callable=AsyncMock, return_value=None), \
         patch("app.api.v1.closet.items.save_closet_item_document", new_callable=AsyncMock) as mock_save:

        resp = await analyze_item_image(payload=payload, request=mock_request, user=user)
        body_bytes = b"".join([chunk async for chunk in resp.body_iterator])
        import json
        data = json.loads(body_bytes.decode("utf-8").strip())

        assert mock_save.call_count == 0
        assert data.get("count") == 1
        assert data.get("items")[0].get("saved") is False
        assert data.get("items")[0].get("item_id") is None
