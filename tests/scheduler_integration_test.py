#!/usr/bin/env python3
"""
Integration test suite for the AI Stylist Scheduler and Outfits Wardrobe Diary.
Tests user profile settings, saved outfits CRUD, suggestion/rotation logic,
rejections, simulated notifications, and similar event location alerts.
"""
import sys
import os
import requests
from datetime import datetime, timezone

# Public endpoint from environment or fallback
BASE_URL = os.environ.get("BACKEND_URL", "https://ai-stylist-api.emergent.host").rstrip('/') + "/api/v1"

class SchedulerIntegrationTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_item_ids = []
        self.created_outfit_ids = []

    def log(self, msg, level="INFO"):
        prefix = {
            "INFO": "🔍",
            "PASS": "✅",
            "FAIL": "❌",
            "WARN": "⚠️"
        }.get(level, "•")
        print(f"{prefix} [{level}] {msg}")

    def test(self, name, fn):
        self.tests_run += 1
        self.log(f"Starting test: {name}")
        try:
            fn()
            self.tests_passed += 1
            self.log(f"PASS: {name}", "PASS")
            return True
        except AssertionError as e:
            self.log(f"FAIL: {name} — {e}", "FAIL")
            return False
        except Exception as e:
            self.log(f"ERROR: {name} — {e}", "ERROR")
            return False

    def assert_status(self, resp, expected, msg=""):
        if resp.status_code != expected:
            raise AssertionError(
                f"Expected HTTP {expected}, got {resp.status_code}. "
                f"{msg} Response: {resp.text[:300]}"
            )

    def assert_field(self, data, field, msg=""):
        if field not in data:
            raise AssertionError(f"Missing field '{field}'. {msg}")

    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    # ────────────────────────────────────────────────────────────────
    # Test Steps
    # ────────────────────────────────────────────────────────────────

    def step_auth(self):
        """1. Authenticate via dev-bypass to get JWT"""
        resp = requests.post(f"{BASE_URL}/auth/dev-bypass", timeout=15)
        self.assert_status(resp, 200, "dev-bypass auth failed")
        data = resp.json()
        self.assert_field(data, "access_token", "Auth response")
        self.token = data["access_token"]
        self.user_id = data.get("user", {}).get("id")
        self.log(f"Authenticated as user {self.user_id}")

    def step_create_closet_items(self):
        """2. Setup test closet garments in the database"""
        items_to_create = [
            {"title": "Scheduler Test Jeans", "category": "Bottom", "color": "Blue"},
            {"title": "Scheduler Test T-Shirt", "category": "Top", "color": "White"},
            {"title": "Scheduler Test Sneakers", "category": "Shoes", "color": "Black"}
        ]
        for payload in items_to_create:
            resp = requests.post(
                f"{BASE_URL}/closet",
                json=payload,
                headers=self.headers(),
                timeout=10
            )
            self.assert_status(resp, 201, "Failed to create test closet item")
            item_data = resp.json()
            self.assert_field(item_data, "id", "Created closet item")
            self.created_item_ids.append(item_data["id"])
            self.log(f"Created test closet item: {item_data['title']} (ID: {item_data['id']})")

    def step_user_scheduler_settings(self):
        """3. Verify PATCH user scheduler_settings works"""
        settings_payload = {
            "scheduler_settings": {
                "enabled": True,
                "frequency": "twice_a_week",
                "weekday": "wednesday",
                "time": "09:30",
                "style_dress_for": "business smart"
            }
        }
        resp = requests.patch(
            f"{BASE_URL}/users/me",
            json=settings_payload,
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(resp, 200, "PATCH user settings failed")
        user_data = resp.json()
        self.assert_field(user_data, "scheduler_settings", "PATCH user response")
        settings = user_data["scheduler_settings"]
        
        assert settings.get("enabled") is True, "enabled not set"
        assert settings.get("frequency") == "twice_a_week", "frequency not set"
        assert settings.get("weekday") == "wednesday", "weekday not set"
        assert settings.get("time") == "09:30", "time not set"
        assert settings.get("style_dress_for") == "business smart", "style_dress_for not set"
        self.log("Verified user scheduler settings successfully updated")

    def step_rejection_tracking(self):
        """4. Verify /reject-item increments counts and flags marketplace sharing at 3 rejections"""
        item_id = self.created_item_ids[0]
        
        # First rejection
        resp = requests.post(
            f"{BASE_URL}/outfits/reject-item",
            json={"item_id": item_id},
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(resp, 200, "First rejection failed")
        data = resp.json()
        assert data.get("rejection_count") >= 1, f"Expected count >= 1, got {data.get('rejection_count')}"
        assert data.get("offer_marketplace") is False, "Should not offer marketplace on first rejection"

        # Second rejection
        resp = requests.post(
            f"{BASE_URL}/outfits/reject-item",
            json={"item_id": item_id},
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(resp, 200, "Second rejection failed")
        data = resp.json()
        assert data.get("offer_marketplace") is False, "Should not offer marketplace on second rejection"

        # Third rejection
        resp = requests.post(
            f"{BASE_URL}/outfits/reject-item",
            json={"item_id": item_id},
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(resp, 200, "Third rejection failed")
        data = resp.json()
        assert data.get("offer_marketplace") is True, "Should offer marketplace on third rejection!"
        self.log(f"Rejection tracking works correctly (marketplace offered: {data.get('offer_marketplace')})")

    def step_proposals_scheduled(self):
        """5. Trigger scheduled daily proposals check"""
        resp = requests.post(
            f"{BASE_URL}/outfits/proposal/scheduled",
            headers=self.headers(),
            timeout=40
        )
        self.assert_status(resp, 200, "Trigger scheduled proposals failed")
        data = resp.json()
        self.assert_field(data, "advice", "Scheduled proposal response")
        advice = data["advice"]
        self.assert_field(advice, "outfit_recommendations", "Scheduled proposal advice")
        recs = advice["outfit_recommendations"]
        assert len(recs) == 3, f"Expected 3 proposals, got {len(recs)}"
        for i, rec in enumerate(recs):
            self.assert_field(rec, "name", f"Rec {i}")
            self.assert_field(rec, "items", f"Rec {i}")
            self.assert_field(rec, "why", f"Rec {i}")
        self.log("Daily scheduled proposals successfully generated 3 outfits")

    def step_proposals_event(self):
        """6. Trigger event proposal check with location details"""
        payload = {
            "prompt": "Sleek casual rooftop cocktail party",
            "date": "2026-06-01",
            "time": "20:00",
            "location": "Skyline Lounge, Tel Aviv",
            "event_name": "Tech Meetup Networking"
        }
        resp = requests.post(
            f"{BASE_URL}/outfits/proposal/event",
            json=payload,
            headers=self.headers(),
            timeout=40
        )
        self.assert_status(resp, 200, "Trigger event proposals failed")
        data = resp.json()
        self.assert_field(data, "advice", "Event proposal response")
        advice = data["advice"]
        self.assert_field(advice, "outfit_recommendations", "Event proposal advice")
        recs = advice["outfit_recommendations"]
        assert len(recs) == 3, f"Expected 3 proposals, got {len(recs)}"
        self.log("Event proposals successfully generated 3 outfits")

    def step_save_outfit_and_crud(self):
        """7. Verify outfit saving, listing, and updates to closet item wear stats"""
        # Save outfit payload mapping to our created test items
        save_payload = {
            "name": "Cocktail Casual Chic",
            "source_workflow": "event",
            "prompt": "Rooftop cocktail party",
            "garments": [
                {"closet_item_id": self.created_item_ids[1], "role": "top"},
                {"closet_item_id": self.created_item_ids[2], "role": "shoes"}
            ],
            "usage": {
                "date": "2026-06-01",
                "time": "20:00",
                "location": "Skyline Lounge, Tel Aviv",
                "event_name": "Tech Meetup Networking"
            }
        }
        
        # Save outfit
        resp = requests.post(
            f"{BASE_URL}/outfits",
            json=save_payload,
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(resp, 201, "POST outfit failed")
        outfit = resp.json()
        self.assert_field(outfit, "id", "Saved outfit response")
        outfit_id = outfit["id"]
        self.created_outfit_ids.append(outfit_id)

        # List saved outfits
        resp = requests.get(
            f"{BASE_URL}/outfits",
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(resp, 200, "GET outfits list failed")
        list_data = resp.json()
        self.assert_field(list_data, "outfits", "List outfits response")
        saved_ids = [o["id"] for o in list_data["outfits"]]
        assert outfit_id in saved_ids, "Saved outfit not found in GET outfits list"

        # Check that item wear count was incremented and last worn timestamp set
        item_resp = requests.get(
            f"{BASE_URL}/closet/{self.created_item_ids[1]}",
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(item_resp, 200, "Failed to get closet item")
        item_data = item_resp.json()
        assert item_data.get("wear_count", 0) >= 1, f"Expected wear_count >= 1, got {item_data.get('wear_count')}"
        assert item_data.get("last_worn_at") == "2026-06-01", f"Expected last_worn_at '2026-06-01', got {item_data.get('last_worn_at')}"
        
        self.log("Outfit successfully saved and increments closet item wear statistics")

    def step_similarity_safeguard(self):
        """8. Verify similar occasion location alerts triggers warning notes"""
        # Save an outfit with item 1 and 2 for "Skyline Lounge"
        # We did this in step 7! Now we query event proposals with the same location "Skyline Lounge, Tel Aviv"
        # Since the closet only has a few items, it will suggest them again, triggering a location warning.
        payload = {
            "prompt": "Another rooftop networking event",
            "date": "2026-06-05",
            "time": "19:00",
            "location": "Skyline Lounge, Tel Aviv",
            "event_name": "Venture Capital Mixer"
        }
        resp = requests.post(
            f"{BASE_URL}/outfits/proposal/event",
            json=payload,
            headers=self.headers(),
            timeout=40
        )
        self.assert_status(resp, 200, "Similarity safeguard check failed")
        data = resp.json()
        advice = data["advice"]
        recs = advice["outfit_recommendations"]
        
        # Check if the warning note is in the 'why' field of any matching recommendation
        has_warning = False
        warning_sub = "This outfit was in use on"
        for rec in recs:
            why = rec.get("why") or ""
            if warning_sub in why:
                has_warning = True
                self.log(f"Warning triggered in rec: '{rec['name']}' why: '{why}'")
                break
                
        assert has_warning is True, "Similarity warning should be appended to why description!"
        self.log("Similarity safeguard successfully detected duplicate location/items usage and appended warning notes")

    def step_simulated_notifications(self):
        """9. Verify mock notifications can be retrieved and cleared"""
        resp = requests.get(
            f"{BASE_URL}/outfits/notifications",
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(resp, 200, "GET notifications failed")
        data = resp.json()
        self.assert_field(data, "notifications", "Notifications response")
        initial_count = len(data["notifications"])
        self.log(f"Currently have {initial_count} simulated notifications")

        # Clear notifications
        clear_resp = requests.post(
            f"{BASE_URL}/outfits/notifications/clear",
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(clear_resp, 200, "POST notifications clear failed")
        clear_data = clear_resp.json()
        assert clear_data.get("cleared") is True, "Cleared status false"

        # Verify they are cleared
        check_resp = requests.get(
            f"{BASE_URL}/outfits/notifications",
            headers=self.headers(),
            timeout=10
        )
        self.assert_status(check_resp, 200, "GET notifications verify failed")
        check_data = check_resp.json()
        assert len(check_data["notifications"]) == 0, f"Expected 0 notifications, got {len(check_data['notifications'])}"
        self.log("Simulated notifications center correctly retrieves and clears mock log entries")

    def cleanup(self):
        """10. Cleanup database created items and outfits"""
        self.log("Running cleanup...")
        # Delete outfits
        for oid in self.created_outfit_ids:
            try:
                resp = requests.delete(
                    f"{BASE_URL}/outfits/{oid}",
                    headers=self.headers(),
                    timeout=10
                )
                if resp.status_code == 200:
                    self.log(f"Cleaned up outfit {oid}")
            except Exception as e:
                self.log(f"Failed to cleanup outfit {oid}: {e}", "WARN")

        # Delete closet items
        for cid in self.created_item_ids:
            try:
                resp = requests.delete(
                    f"{BASE_URL}/closet/{cid}",
                    headers=self.headers(),
                    timeout=10
                )
                if resp.status_code in (200, 204):
                    self.log(f"Cleaned up closet item {cid}")
            except Exception as e:
                self.log(f"Failed to cleanup closet item {cid}: {e}", "WARN")

    # ────────────────────────────────────────────────────────────────
    # Test Runner
    # ────────────────────────────────────────────────────────────────

    def run_all(self):
        self.log("=" * 65)
        self.log("AI Stylist Scheduler & Outfits Integration Tests")
        self.log("=" * 65)

        try:
            self.test("Authentication via Dev-Bypass", self.step_auth)
            if not self.token:
                self.log("Critical failure: No auth token. Aborting rest of tests.", "FAIL")
                return 1

            self.test("Setup test closet garments", self.step_create_closet_items)
            self.test("Verify user scheduler settings PATCH", self.step_user_scheduler_settings)
            self.test("Verify garment suggestion rejection tracking", self.step_rejection_tracking)
            self.test("Trigger scheduled daily suggestions", self.step_proposals_scheduled)
            self.test("Trigger event suggestions", self.step_proposals_event)
            self.test("Verify saved outfits diary CRUD & statistics", self.step_save_outfit_and_crud)
            self.test("Verify occasion/location similarities warning safeguard", self.step_similarity_safeguard)
            self.test("Verify simulated notifications center logs", self.step_simulated_notifications)

        finally:
            self.cleanup()

        self.log("=" * 65)
        self.log(f"Tests Completed: Passed {self.tests_passed}/{self.tests_run}")
        self.log("=" * 65)
        return 0 if self.tests_passed == self.tests_run else 1

if __name__ == "__main__":
    tester = SchedulerIntegrationTester()
    sys.exit(tester.run_all())
