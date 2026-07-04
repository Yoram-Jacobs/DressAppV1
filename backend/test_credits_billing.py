import os
import sys
import unittest
from unittest.mock import AsyncMock, patch

# Mock env vars before importing anything else
os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["DB_NAME"] = "dressapp_test"
os.environ["JWT_SECRET"] = "test_jwt_secret"

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from server import app
from app.db.database import get_db

class TestCreditsBilling(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = get_db()

    @patch("app.api.v1.stylist.get_styling_advice")
    @patch("app.api.v1.users.get_current_user")
    @patch("app.api.v1.stylist.get_current_user")
    @patch("app.api.v1.payments.get_current_user")
    @patch("app.services.paypal_client.capture_order")
    @patch("app.services.email_service.send_thank_you_payment")
    def test_credit_deduction_and_billing_cycle(
        self, mock_send_email, mock_capture_order, mock_pay_user, mock_stylist_user, mock_users_user, mock_get_styling_advice
    ):
        import asyncio
        
        # 1. Setup mock user with standard credit configuration
        test_user = {
            "id": "test-user-billing-id",
            "email": "test-billing@dressapp.co",
            "preferred_language": "he",
            "ai_configuration": {
                "provider_mode": "standard",
                "current_credits": 100,
                "credits_used_this_month": 5
            }
        }
        
        # Inject test user into mock DB directly
        async def insert_user():
            await self.db.users.delete_many({"id": test_user["id"]})
            await self.db.users.insert_one(test_user)
        asyncio.run(insert_user())

        # Mock current user dependencies
        mock_users_user.return_value = test_user
        mock_stylist_user.return_value = test_user
        mock_pay_user.return_value = test_user

        # Mock styling advice response
        mock_get_styling_advice.return_value = {
            "reasoning_summary": "Looking sharp!",
            "outfit_recommendations": []
        }

        # 2. Trigger a stylist turn (which should deduct a credit and increment monthly count)
        headers = {"Authorization": "Bearer fake-token"}
        response = self.client.post(
            "/api/v1/stylist",
            data={"text": "Suggest an outfit for today"},
            headers=headers
        )
        self.assertEqual(response.status_code, 200)

        # Retrieve user from DB to verify deduction
        async def check_user_after_turn():
            usr = await self.db.users.find_one({"id": test_user["id"]})
            self.assertEqual(usr["ai_configuration"]["current_credits"], 99)
            self.assertEqual(usr["ai_configuration"]["credits_used_this_month"], 6)
        asyncio.run(check_user_after_turn())

        # 3. Simulate PayPal topup capture to reset fee
        # Set up a mock pending top-up document in database
        topup_doc = {
            "id": "topup-123",
            "user_id": test_user["id"],
            "amount_cents": 1000, # $10.00
            "currency": "USD",
            "status": "pending",
            "paypal_order_id": "order-123"
        }
        async def insert_topup():
            await self.db.credit_topups.delete_many({"id": topup_doc["id"]})
            await self.db.credit_topups.insert_one(topup_doc)
        asyncio.run(insert_topup())

        # Mock PayPal capture call returning COMPLETED
        mock_capture_order.return_value = {
            "status": "COMPLETED",
            "purchase_units": [
                {
                    "payments": {
                        "captures": [
                            {
                                "id": "capture-123",
                                "status": "COMPLETED"
                            }
                        ]
                    }
                }
            ],
            "payer": {
                "email_address": "payer@dressapp.co"
            }
        }
        
        # Call topup capture endpoint
        response = self.client.post(
            f"/api/v1/credits/topup/{topup_doc['id']}/capture",
            headers=headers
        )
        self.assertEqual(response.status_code, 200)

        # Retrieve user from DB to verify reset and credited amount
        # $10.00 topup -> adds 2000 credits. Balance should be 99 + 2000 = 2099.
        # credits_used_this_month should be reset to 0.
        async def check_user_after_capture():
            usr = await self.db.users.find_one({"id": test_user["id"]})
            self.assertEqual(usr["ai_configuration"]["current_credits"], 2099)
            self.assertEqual(usr["ai_configuration"]["credits_used_this_month"], 0)
        asyncio.run(check_user_after_capture())

        # Clean up database
        async def clean_db():
            await self.db.users.delete_many({"id": test_user["id"]})
            await self.db.credit_topups.delete_many({"id": topup_doc["id"]})
        asyncio.run(clean_db())

if __name__ == "__main__":
    unittest.main()
