"""Unit tests for the 'Add my store' feature in backend/app/api/v1/sizes.py and email_service."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from server import app
from app.services.auth import get_current_user_optional, AuthenticatedUser
from app.services.email_service import send_store_request_email

client = TestClient(app)


@pytest.mark.anyio
async def test_send_store_request_email_payload():
    """Verify that send_store_request_email formats recipient, subject, body, and reply_to as specified."""
    with patch("app.services.email_service._send", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"id": "msg_test_123"}

        res = await send_store_request_email(
            user_name="Jane Doe",
            user_email="jane@example.com",
            store_name="Zara",
            store_site="https://www.zara.com",
        )

        assert res == {"id": "msg_test_123"}
        mock_send.assert_awaited_once()

        kwargs = mock_send.await_args.kwargs
        assert kwargs["to"] == "dev@dressapp.co"
        assert kwargs["subject"] == "Add my store"
        assert kwargs["reply_to"] == "jane@example.com"
        expected_text = (
            "Jane Doe suggests adding Zara to the Shopping Assistant Chrome extension.\n"
            "https://www.zara.com  \n"
            "---\n"
        )
        assert kwargs["text"] == expected_text
        assert "Zara" in kwargs["html"]
        assert "Jane Doe" in kwargs["html"]


@pytest.mark.anyio
async def test_request_store_endpoint_authenticated():
    """Verify POST /api/v1/sizes/request-store resolves logged-in user identity and persists record."""
    mock_user = AuthenticatedUser(
        id="usr_abc",
        email="shopper@dressapp.co",
        display_name="Fashion Lover",
        roles=["user"],
    )
    app.dependency_overrides[get_current_user_optional] = lambda: mock_user

    mock_db = AsyncMock()
    mock_db.store_requests = AsyncMock()
    mock_db.store_requests.insert_one = AsyncMock(return_value=AsyncMock(inserted_id="doc_123"))

    try:
        with patch("app.db.database.get_db", return_value=mock_db), \
             patch("app.services.email_service.send_store_request_email", new_callable=AsyncMock) as mock_email:
            mock_email.return_value = {"id": "msg_123"}

            response = client.post(
                "/api/v1/sizes/request-store",
                json={
                    "store_name": "Zara",
                    "store_site": "https://www.zara.com",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["request_id"] is not None

            # Verify email dispatch arguments
            mock_email.assert_awaited_once_with(
                user_name="Fashion Lover",
                user_email="shopper@dressapp.co",
                store_name="Zara",
                store_site="https://www.zara.com",
            )

            # Verify mongo insertion
            mock_db.store_requests.insert_one.assert_awaited_once()
            inserted_doc = mock_db.store_requests.insert_one.await_args[0][0]
            assert inserted_doc["store_name"] == "Zara"
            assert inserted_doc["store_site"] == "https://www.zara.com"
            assert inserted_doc["user_name"] == "Fashion Lover"
            assert inserted_doc["user_email"] == "shopper@dressapp.co"
            assert inserted_doc["user_id"] == "usr_abc"
            assert inserted_doc["status"] == "pending"
    finally:
        app.dependency_overrides.pop(get_current_user_optional, None)


@pytest.mark.anyio
async def test_request_store_endpoint_guest():
    """Verify POST /api/v1/sizes/request-store works for unauthenticated guests and prepends https://."""
    app.dependency_overrides[get_current_user_optional] = lambda: None

    mock_db = AsyncMock()
    mock_db.store_requests = AsyncMock()
    mock_db.store_requests.insert_one = AsyncMock()

    try:
        with patch("app.db.database.get_db", return_value=mock_db), \
             patch("app.services.email_service.send_store_request_email", new_callable=AsyncMock) as mock_email:
            mock_email.return_value = {"id": "msg_456"}

            response = client.post(
                "/api/v1/sizes/request-store",
                json={
                    "store_name": "ASOS",
                    "store_site": "asos.com",
                    "user_name": "Guest Stylist",
                    "user_email": "guest@example.com",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

            # Verify store_site was prefixed with https://
            mock_email.assert_awaited_once_with(
                user_name="Guest Stylist",
                user_email="guest@example.com",
                store_name="ASOS",
                store_site="https://asos.com",
            )
    finally:
        app.dependency_overrides.pop(get_current_user_optional, None)


def test_request_store_endpoint_validation():
    """Verify validation error when store_name or store_site is empty."""
    res = client.post("/api/v1/sizes/request-store", json={"store_name": "", "store_site": "https://zara.com"})
    assert res.status_code == 422

    res2 = client.post("/api/v1/sizes/request-store", json={"store_name": "Zara", "store_site": ""})
    assert res2.status_code == 422
