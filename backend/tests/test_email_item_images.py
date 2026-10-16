"""Tests for email item image rendering and inline CID attachments."""
from __future__ import annotations

import base64
import io
import pytest
from unittest.mock import AsyncMock, patch
from PIL import Image

from app.services import email_service as es


def _make_dummy_image_data_url(fmt: str = "PNG", mode: str = "RGBA", color=(100, 150, 200, 255)) -> str:
    img = Image.new(mode, (100, 100), color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    mime = "png" if fmt.upper() == "PNG" else "webp" if fmt.upper() == "WEBP" else "jpeg"
    return f"data:image/{mime};base64,{b64}"


@pytest.mark.anyio
async def test_swap_request_embeds_cid_images_from_data_urls():
    """Verify swap_request converts data URLs into inline CID attachments and eliminates broken data: URIs."""
    webp_data = _make_dummy_image_data_url(fmt="WEBP", mode="RGB", color=(50, 100, 150))
    png_data = _make_dummy_image_data_url(fmt="PNG", mode="RGBA", color=(200, 50, 50, 128))

    listing_item = {
        "title": "Green T-Shirt",
        "brand": "Famous Men",
        "thumbnail_data_url": webp_data,
    }
    offered_item = {
        "title": "Black Jacket",
        "brand": "Zara",
        "thumbnail_data_url": png_data,
    }

    with patch("app.services.email_service._send", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"id": "msg_swap_1"}

        await es.swap_request(
            to="seller@example.com",
            lister={"display_name": "Alice"},
            swapper={"display_name": "Bob"},
            listing_item=listing_item,
            offered_item=offered_item,
            accept_url="https://dressapp.co/accept",
            deny_url="https://dressapp.co/deny",
        )

        mock_send.assert_awaited_once()
        args, kwargs = mock_send.await_args
        html = kwargs.get("html") or args[2]
        attachments = kwargs.get("attachments") or []

        # 1. HTML must NOT contain raw data: URIs in src (blocked by Gmail/Outlook)
        assert "src=\"data:" not in html
        assert "src='data:" not in html

        # 2. HTML must contain cid: references
        assert "src=\"cid:item_" in html

        # 3. Two CID attachments must be registered
        assert len(attachments) == 2
        for att in attachments:
            assert att["content_id"].startswith("item_")
            assert att["filename"].endswith(".jpg")
            assert att["content_type"] == "image/jpeg"
            assert len(att["content"]) > 0
            # Ensure attachment content is valid base64
            decoded = base64.b64decode(att["content"])
            assert len(decoded) > 0


@pytest.mark.anyio
async def test_swap_success_embeds_cid_images():
    """Verify swap_success converts both items into CID attachments."""
    webp_data = _make_dummy_image_data_url(fmt="WEBP", mode="RGB")

    counterpart_item = {"title": "Black Jacket", "reconstructed_image_url": webp_data}
    recipient_item = {"title": "Green T-Shirt", "clean_image_url": webp_data}

    with patch("app.services.email_service._send", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"id": "msg_swap_2"}

        await es.swap_success(
            to="user@example.com",
            recipient={"display_name": "Alice"},
            counterpart={"display_name": "Bob"},
            recipient_item=recipient_item,
            counterpart_item=counterpart_item,
            confirm_url="https://dressapp.co/confirm",
            role="lister",
        )

        mock_send.assert_awaited_once()
        args, kwargs = mock_send.await_args
        html = kwargs.get("html") or args[2]
        attachments = kwargs.get("attachments") or []

        assert "src=\"data:" not in html
        assert "src=\"cid:item_" in html
        assert len(attachments) == 2


@pytest.mark.anyio
async def test_sale_seller_and_buyer_embeds_cid_images():
    """Verify sale_seller and sale_buyer convert item images to CID attachments."""
    jpeg_data = _make_dummy_image_data_url(fmt="JPEG", mode="RGB")
    item = {"title": "Silk Scarf", "brand": "Hermes", "thumbnail_data_url": jpeg_data}

    with patch("app.services.email_service._send", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"id": "msg_sale"}

        await es.sale_seller(
            to="seller@example.com",
            seller={"display_name": "Seller"},
            buyer={"display_name": "Buyer"},
            item=item,
            gross_cents=5000,
            seller_net_cents=4500,
            currency="USD",
        )

        mock_send.assert_awaited_once()
        args, kwargs = mock_send.await_args
        html = kwargs.get("html") or args[2]
        attachments = kwargs.get("attachments") or []

        assert "src=\"data:" not in html
        assert "src=\"cid:item_" in html
        assert len(attachments) == 1


@pytest.mark.anyio
async def test_item_without_image_renders_clean_placeholder():
    """Verify items without any images render a clean fallback badge instead of broken image."""
    item = {"title": "Mystery Hat", "brand": "Vintage"}

    with patch("app.services.email_service._send", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"id": "msg_none"}

        await es.swap_denied(
            to="user@example.com",
            swapper={"display_name": "Alice"},
            lister={"display_name": "Bob"},
            listing_item=item,
            offered_item={},
        )

        mock_send.assert_awaited_once()
        args, kwargs = mock_send.await_args
        html = kwargs.get("html") or args[2]
        attachments = kwargs.get("attachments") or []

        assert "src=\"data:" not in html
        assert "Mystery Hat" in html
        assert len(attachments) == 0


@pytest.mark.anyio
async def test_local_static_file_converts_to_cid(tmp_path):
    """Verify local static file is read from disk, converted with PIL, and attached as CID."""
    from pathlib import Path
    backend_dir = Path(es.__file__).resolve().parent.parent.parent
    uploads_dir = backend_dir / "static" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    temp_img_path = uploads_dir / "test_local_email_item.png"

    img = Image.new("RGBA", (150, 150), (31, 111, 107, 200))
    img.save(temp_img_path, format="PNG")

    try:
        item = {
            "title": "Local Jacket",
            "clean_image_url": "/static/uploads/test_local_email_item.png"
        }

        with patch("app.services.email_service._send", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = {"id": "msg_local"}

            await es.donation_both(
                to=["user@example.com"],
                donor={"display_name": "Alice"},
                recipient={"display_name": "Bob"},
                item=item,
            )

            mock_send.assert_awaited_once()
            args, kwargs = mock_send.await_args
            html = kwargs.get("html") or args[2]
            attachments = kwargs.get("attachments") or []

            assert "src=\"cid:item_" in html
            assert len(attachments) == 1
            assert attachments[0]["content_type"] == "image/jpeg"
    finally:
        if temp_img_path.exists():
            temp_img_path.unlink()


@pytest.mark.anyio
async def test_remote_url_fallback_when_unreachable():
    """Verify unreachable remote URL falls back to public URL in src without crashing."""
    item = {
        "title": "Cloud Shoes",
        "clean_image_url": "https://nonexistent-dressapp-test-domain.invalid/shoes.jpg"
    }

    with patch("app.services.email_service._send", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"id": "msg_remote"}

        await es.sale_seller(
            to="seller@example.com",
            seller={"display_name": "Seller"},
            buyer={"display_name": "Buyer"},
            item=item,
            gross_cents=2000,
            seller_net_cents=1800,
            currency="USD",
        )

        mock_send.assert_awaited_once()
        args, kwargs = mock_send.await_args
        html = kwargs.get("html") or args[2]

        assert "https://nonexistent-dressapp-test-domain.invalid/shoes.jpg" in html
