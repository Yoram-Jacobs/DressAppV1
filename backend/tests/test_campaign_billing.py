import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone, timedelta
from app.services.campaign_service import bill_ended_campaign, expire_overdue_campaigns

@pytest.mark.anyio
async def test_bill_ended_campaign():
    # Setup mock campaign (4.9 days duration, 1 paused day = 3.9 active days, ceil = 4 active days)
    activated_at = (datetime.now(timezone.utc) - timedelta(days=4.9)).isoformat()
    campaign = {
        "id": "test_camp_123",
        "expert_id": "test_expert_123",
        "title": "Summer Sale",
        "status": "active",
        "activated_at": activated_at,
        "billing": {
            "total_paused_days": 1
        }
    }
    
    mock_expert = {
        "id": "test_expert_123",
        "email": "expert@dressapp.co",
        "preferred_language": "en"
    }
    
    mock_db = AsyncMock()
    mock_db.users.find_one = AsyncMock(return_value=mock_expert)
    mock_db.atzmai_topups.insert_one = AsyncMock()
    mock_db.atzmai_topups.update_one = AsyncMock()
    mock_db.experts_campaigns.update_one = AsyncMock()
    
    with patch("app.services.atzmai_client.get_usd_to_ils_rate", return_value=3.70), \
         patch("app.services.atzmai_client.is_mock_mode", return_value=True), \
         patch("app.services.email_service.fetch_invoice_and_receipt_attachments", return_value=[]), \
         patch("app.services.email_service.send_campaign_billing_invoice", return_value={}) as mock_send_email:
         
        await bill_ended_campaign(campaign, mock_db)
        
        # Verify active days = 5 total days - 1 paused day = 4 days
        # amount_usd = 4.00 * 3.70 (rate) = 14.80 ILS = 1480 cents
        mock_db.atzmai_topups.insert_one.assert_called_once()
        inserted_doc = mock_db.atzmai_topups.insert_one.call_args[0][0]
        assert inserted_doc["amount_cents"] == 1480
        assert inserted_doc["currency"] == "ILS"
        assert inserted_doc["campaign_id"] == "test_camp_123"
        
        # Check update to campaign billing fields
        mock_db.experts_campaigns.update_one.assert_called_once()
        update_args = mock_db.experts_campaigns.update_one.call_args[0][1]
        assert update_args["$set"]["billing.total_active_days"] == 4
        assert update_args["$set"]["billing.total_fee_cents"] == 1480
        
        # Check mock invoice email was called
        mock_send_email.assert_called_once()
        email_kwargs = mock_send_email.call_args[1]
        assert email_kwargs["to"] == "expert@dressapp.co"
        assert email_kwargs["active_days"] == 4
        assert email_kwargs["amount_cents"] == 1480
