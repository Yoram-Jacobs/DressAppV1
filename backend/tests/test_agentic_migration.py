"""
Unit tests for the Agentic Wardrobe Migration Agent.
"""

import pytest
from unittest.mock import AsyncMock, patch
from PIL import Image
from app.services.migration.wardrobe_migration_agent import WardrobeMigrationAgent


@pytest.mark.anyio
async def test_agentic_migration_step():
    # 1. Create a mock PIL image
    img = Image.new("RGB", (300, 600), color="white")

    # 2. Mock GeminiClient.vision call response text for detection and classification
    mock_detect = '{"garments": [{"box_2d": [50, 50, 250, 250], "label": "test red top", "category": "Top", "color": "Red"}], "should_scroll": true}'
    mock_classify = '{"category": "Top", "color": "Red", "label": "test red top", "is_model_fit_pic": false}'

    # 3. Instantiate agent and mock the client call
    agent = WardrobeMigrationAgent(api_key="mock_key")
    agent.client.vision = AsyncMock(side_effect=[mock_detect, mock_classify])

    # 4. Patch database and background matting
    with patch("app.services.migration.wardrobe_migration_agent.get_db") as mock_get_db, \
         patch("app.services.background_matting.matte_crop", new_callable=AsyncMock) as mock_matte:

        mock_db = AsyncMock()
        mock_db.migration_sessions.find_one = AsyncMock(return_value={
            "id": "test_session_id",
            "parsed_hashes": []
        })
        mock_db.migration_sessions.update_one = AsyncMock()
        mock_db.closet_items.insert_one = AsyncMock()
        mock_get_db.return_value = mock_db

        mock_matte.return_value = b"fake_png_bytes"

        # Execute process_step
        result = await agent.process_step(
            session_id="test_session_id",
            user_id="test_user_id",
            app_name="Whering",
            pil_img=img,
        )

        assert result["status"] == "active"
        assert result["action"] == "scroll"
        assert len(result["new_items_found"]) == 1
        assert result["new_items_found"][0]["title"] == "test red top"
        assert result["new_items_found"][0]["category"] == "Top"

        # Verify db insert was called
        mock_db.closet_items.insert_one.assert_called_once()


@pytest.mark.anyio
async def test_agentic_migration_with_card_rects():
    img = Image.new("RGB", (300, 600), color="white")

    # Mock GeminiClient.vision call response text for single item classification
    mock_response = '{"category": "Top", "color": "Blue", "label": "blue crewneck top"}'

    agent = WardrobeMigrationAgent(api_key="mock_key")
    agent.client.vision = AsyncMock(return_value=mock_response)

    with patch("app.services.migration.wardrobe_migration_agent.get_db") as mock_get_db, \
         patch("app.services.background_matting.matte_crop", new_callable=AsyncMock) as mock_matte:

        mock_db = AsyncMock()
        mock_db.migration_sessions.find_one = AsyncMock(return_value={
            "id": "test_session_id",
            "parsed_hashes": []
        })
        mock_db.migration_sessions.update_one = AsyncMock()
        mock_db.closet_items.insert_one = AsyncMock()
        mock_get_db.return_value = mock_db

        mock_matte.return_value = b"fake_png_bytes"

        # Execute process_step with card rects and reached_bottom=True
        result = await agent.process_step(
            session_id="test_session_id",
            user_id="test_user_id",
            app_name="Whering",
            pil_img=img,
            viewport_width=300.0,
            viewport_height=600.0,
            reached_bottom=True,
            card_rects=[
                {"left": 50.0, "top": 50.0, "width": 200.0, "height": 200.0}
            ]
        )

        assert result["status"] == "completed"
        assert result["action"] == "done"
        assert len(result["new_items_found"]) == 1
        assert result["new_items_found"][0]["title"] == "blue crewneck top"
        assert result["new_items_found"][0]["category"] == "Top"
        assert result["new_items_found"][0]["color"] == "Blue"

        mock_db.closet_items.insert_one.assert_called_once()


@pytest.mark.anyio
async def test_agentic_migration_with_fit_pic_tight_crop():
    import base64
    img = Image.new("RGB", (300, 600), color="white")

    # Mock GeminiClient.vision classification response indicating a fit pic
    mock_response = (
        '{"category": "Top", "color": "Yellow", "label": "yellow fit pic top", '
        '"is_model_fit_pic": true}'
    )

    agent = WardrobeMigrationAgent(api_key="mock_key")
    agent.client.vision = AsyncMock(return_value=mock_response)

    with patch("app.services.migration.wardrobe_migration_agent.get_db") as mock_get_db, \
         patch("app.services.background_matting.matte_crop", new_callable=AsyncMock) as mock_matte, \
         patch("app.services.vision.GarmentVisionService") as mock_gv_service_class:

        mock_db = AsyncMock()
        mock_db.migration_sessions.find_one = AsyncMock(return_value={
            "id": "test_session_id",
            "parsed_hashes": []
        })
        mock_db.migration_sessions.update_one = AsyncMock()
        mock_db.closet_items.insert_one = AsyncMock()
        mock_get_db.return_value = mock_db

        mock_matte.return_value = b"fake_png_bytes"

        # Save a real 10x10 mock image to JPEG bytes
        import io
        mock_tile = Image.new("RGB", (10, 10), color="yellow")
        buf = io.BytesIO()
        mock_tile.save(buf, format="JPEG")
        real_mock_bytes = buf.getvalue()

        # Mock the GarmentVisionService analyze_outfit output
        mock_gv_service = AsyncMock()
        mock_gv_service.analyze_outfit = AsyncMock(return_value=[
            {
                "label": "yellow fit pic top",
                "crop_base64": base64.b64encode(real_mock_bytes).decode("utf-8"),
                "analysis": {"category": "Top", "color": "Yellow", "pattern": "Solid", "material": "Cotton"}
            }
        ])
        mock_gv_service_class.return_value = mock_gv_service

        # Execute process_step
        result = await agent.process_step(
            session_id="test_session_id",
            user_id="test_user_id",
            app_name="Whering",
            pil_img=img,
            viewport_width=300.0,
            viewport_height=600.0,
            reached_bottom=True,
            card_rects=[
                {"left": 50.0, "top": 50.0, "width": 200.0, "height": 200.0}
            ]
        )

        assert result["status"] == "completed"
        assert result["action"] == "done"
        assert len(result["new_items_found"]) == 1
        assert result["new_items_found"][0]["title"] == "Yellow fit pic top"
        assert result["new_items_found"][0]["color"] == "Yellow"

        # Verify background matting was called
        mock_matte.assert_called_once()



