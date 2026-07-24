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

    # 2. Mock GeminiClient.vision call response text
    mock_response = '{"garments": [{"box_2d": [50, 50, 250, 250], "label": "test red top", "category": "Top", "color": "Red"}], "should_scroll": true}'

    # 3. Instantiate agent and mock the client call
    agent = WardrobeMigrationAgent(api_key="mock_key")
    agent.client.vision = AsyncMock(return_value=mock_response)

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
