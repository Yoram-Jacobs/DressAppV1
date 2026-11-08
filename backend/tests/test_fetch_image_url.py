import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.api.v1.closet.dpp_receipts import fetch_image_url, FetchImageUrlIn


@pytest.mark.asyncio
async def test_fetch_image_url_direct_image():
    payload = FetchImageUrlIn(
        url="https://images.asos-media.com/products/topshop-alexi-real-suede-2-part-heeled-sandal-in-black/208581834-3?$n_640w$&wid=513&fit=constrain"
    )
    fake_user = {"id": "user123"}

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "image/avif"}
    mock_resp.content = b"fake-avif-bytes"
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        res = await fetch_image_url(payload=payload, user=fake_user)
        assert "image_b64" in res
        assert res["mime_type"] == "image/avif"

        # Verify headers passed to client.get
        _, kwargs = mock_client_cls.call_args
        headers = kwargs.get("headers", {})
        assert headers.get("Sec-Fetch-Dest") == "image"
        assert headers.get("Sec-Fetch-Mode") == "no-cors"
        assert "Chromium" in headers.get("Sec-Ch-Ua", "")
        assert "asos.com" in headers.get("Referer", "")


@pytest.mark.asyncio
async def test_fetch_image_url_html_page():
    payload = FetchImageUrlIn(url="https://www.example.com/product/123")
    fake_user = {"id": "user123"}

    html_content = """
    <html>
      <head>
        <meta property="og:image" content="https://cdn.example.com/item.jpg" />
      </head>
      <body><h1>Product</h1></body>
    </html>
    """

    mock_page_resp = MagicMock()
    mock_page_resp.status_code = 200
    mock_page_resp.headers = {"content-type": "text/html; charset=utf-8"}
    mock_page_resp.text = html_content
    mock_page_resp.content = html_content.encode("utf-8")
    mock_page_resp.raise_for_status = MagicMock()

    mock_img_resp = MagicMock()
    mock_img_resp.status_code = 200
    mock_img_resp.headers = {"content-type": "image/jpeg"}
    mock_img_resp.content = b"fake-jpeg-bytes"
    mock_img_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[mock_page_resp, mock_img_resp])
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        res = await fetch_image_url(payload=payload, user=fake_user)
        assert "image_b64" in res
        assert res["mime_type"] == "image/jpeg"
        assert mock_client.get.call_count == 2
