import os
import sys

# Mock env vars before importing anything else
os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["DB_NAME"] = "dressapp_test"
os.environ["JWT_SECRET"] = "test_jwt_secret"

import unittest
from fastapi.testclient import TestClient

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import app

class TestShareCardRoutes(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_outfit_share_card_not_found(self):
        # GET should return 404 for non-existent outfit card
        response = self.client.get("/api/v1/outfits/non-existent-id/share-card/image")
        self.assertEqual(response.status_code, 404)

    def test_shared_outfit_image_not_found(self):
        # GET should return 404 for non-existent shared outfit card
        response = self.client.get("/api/v1/share/outfit/non-existent-id/image")
        self.assertEqual(response.status_code, 404)

if __name__ == "__main__":
    unittest.main()
