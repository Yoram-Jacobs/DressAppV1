import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.services import atzmai_client
from app.services.auth import get_current_user
from server import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_is_mock_mode():
    with patch("app.services.atzmai_client.is_mock_mode", return_value=True):
        yield

@pytest.mark.anyio
async def test_atzmai_client_mock_methods():
    # Verify that mock mode generates correctly structured responses
    res = await atzmai_client.generate_payment_link(
        items=[{"amount": 10.0, "description": "Test"}],
        customer_name="Test User",
        email="test@user.com",
    )
    assert res["body"]["atzmai_payment_id"].startswith("mock_atz_")
    assert "url" in res["body"]

    res_rec = await atzmai_client.generate_recurring_payment_link(
        amount=10.0,
        description="Recur test",
        email="test@user.com",
        phone="0500000000",
        customer_name="Test User",
        recurring_period=3,
        payments_count=12,
        start_date="01/01/2027",
    )
    assert res_rec["body"]["atzmai_payment_id"].startswith("mock_atz_rec_")

    res_bit = await atzmai_client.generate_bit_payment_link(
        amount=10.0,
        description="Bit test",
        customer_name="Test User",
        phone="0500000000",
        email="test@user.com",
    )
    assert res_bit["body"]["atzmai_payment_id"].startswith("mock_atz_bit_")

    res_cancel = await atzmai_client.cancel_subscription("some_id")
    assert res_cancel["body"]["result"] == 0


@pytest.mark.anyio
async def test_create_topup_endpoint():
    # Test POST /api/v1/atzmai/topup
    mock_user = {"id": "test_user_id", "email": "test@user.com", "first_name": "Test"}
    app.dependency_overrides[get_current_user] = lambda: mock_user

    mock_db = AsyncMock()
    mock_db.atzmai_topups = AsyncMock()
    mock_db.atzmai_topups.insert_one = AsyncMock()

    try:
        with patch("app.api.v1.atzmai.get_db", return_value=mock_db):
            response = client.post(
                "/api/v1/atzmai/topup",
                json={
                    "pack": "10",
                    "method": "regular"
                }
            )
            assert response.status_code == 400
            data = response.json()
            assert "detail" in data
    finally:
        app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_get_topup_status_endpoint():
    # Test GET /api/v1/atzmai/topup/{atzmai_payment_id}
    mock_user = {"id": "test_user_id", "email": "test@user.com"}
    app.dependency_overrides[get_current_user] = lambda: mock_user

    mock_db = AsyncMock()
    mock_db.atzmai_topups.find_one = AsyncMock(return_value={
        "id": "atz_123",
        "atzmai_payment_id": "payment_123",
        "user_id": "test_user_id",
        "status": "pending",
        "amount_cents": 1000
    })

    try:
        with patch("app.api.v1.atzmai.get_db", return_value=mock_db):
            response = client.get("/api/v1/atzmai/topup/payment_123")
            assert response.status_code == 200
            data = response.json()
            assert data["atzmai_payment_id"] == "payment_123"
            assert data["status"] == "pending"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_webhook_endpoint_success():
    # Test POST /api/v1/atzmai/webhook
    mock_db = AsyncMock()
    mock_db.atzmai_topups.find_one = AsyncMock(return_value={
        "id": "atz_123",
        "atzmai_payment_id": "payment_123",
        "user_id": "test_user_id",
        "status": "pending",
        "amount_cents": 1000,
        "currency": "ILS"
    })
    mock_db.atzmai_topups.update_one = AsyncMock()
    mock_db.user_credits.update_one = AsyncMock()
    
    mock_user_record = {
        "id": "test_user_id",
        "email": "test@user.com",
        "ai_configuration": {
            "current_credits": 100
        }
    }
    mock_db.users.find_one = AsyncMock(return_value=mock_user_record)
    mock_db.users.update_one = AsyncMock()

    with patch("app.api.v1.atzmai.get_db", return_value=mock_db), \
         patch("app.services.email_service.send_thank_you_payment", new_callable=AsyncMock) as mock_email:
        
        response = client.post(
            "/api/v1/atzmai/webhook",
            json={
                "atzmai_payment_id": "payment_123",
                "status": "completed",
                "transaction_amount": "10.0"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["status"] == "captured"

        # Verify DB updates
        mock_db.atzmai_topups.update_one.assert_called_once()
        mock_db.user_credits.update_one.assert_called_once()
        mock_db.users.update_one.assert_called_once()


@pytest.mark.anyio
async def test_atzmai_client_invoices_receipts():
    # Verify mock responses for invoicing and receipting endpoints
    inv = await atzmai_client.get_invoices(123, size=2)
    assert "list" in inv["body"]
    assert len(inv["body"]["list"]) > 0
    assert inv["body"]["list"][0]["number"] == 100001
    
    inv_pdf = await atzmai_client.get_invoice_pdf(123, 100001)
    assert inv_pdf["body"]["url"] == "https://example.com/mock-invoice.pdf"

    rec = await atzmai_client.get_receipts(123, size=2)
    assert "list" in rec["body"]
    assert len(rec["body"]["list"]) > 0
    assert rec["body"]["list"][0]["number"] == 200001

    rec_pdf = await atzmai_client.get_receipt_pdf(123, 200001)
    assert rec_pdf["body"]["url"] == "https://example.com/mock-receipt.pdf"


@pytest.mark.anyio
async def test_fetch_invoice_and_receipt_attachments():
    from app.services.email_service import fetch_invoice_and_receipt_attachments
    # Test fetch_invoice_and_receipt_attachments under mock conditions (amount: $10.00 / 1000 cents)
    attachments = await fetch_invoice_and_receipt_attachments(1000)
    assert len(attachments) == 2
    assert attachments[0]["filename"] == "invoice_100001.pdf"
    assert attachments[0]["path"] == "https://example.com/mock-invoice.pdf"
    assert attachments[1]["filename"] == "receipt_200001.pdf"
    assert attachments[1]["path"] == "https://example.com/mock-receipt.pdf"
