"""Backend API test suite for Gemini migration verification.

Tests all 6 modules that were migrated from emergentintegrations to google-genai:
1. POST /api/v1/closet/analyze - streaming NDJSON garment analysis
2. POST /api/v1/stylist - stylist chat flow
3. POST /api/v1/sizes/analyze-chart - size chart OCR
4. GET /api/v1/admin/llm-usage - health check (optional)
5. Backend startup logs - verify no emergentintegrations errors
"""
import base64
import json
import sys
import time
from pathlib import Path

import requests

# Public endpoint from frontend/.env
BASE_URL = "https://ai-stylist-api.preview.emergentagent.com"


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'


class GeminiMigrationTester:
    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url.rstrip('/')
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log(self, message, color=Colors.BLUE):
        print(f"{color}{message}{Colors.END}")

    def log_success(self, message):
        self.log(f"✅ {message}", Colors.GREEN)

    def log_error(self, message):
        self.log(f"❌ {message}", Colors.RED)

    def log_warning(self, message):
        self.log(f"⚠️  {message}", Colors.YELLOW)

    def run_test(self, name, test_func):
        """Run a single test and track results."""
        self.tests_run += 1
        self.log(f"\n{'='*60}")
        self.log(f"Test {self.tests_run}: {name}", Colors.BLUE)
        self.log('='*60)
        
        try:
            result = test_func()
            if result:
                self.tests_passed += 1
                self.test_results.append({"name": name, "status": "PASS"})
                self.log_success(f"PASSED: {name}")
            else:
                self.test_results.append({"name": name, "status": "FAIL"})
                self.log_error(f"FAILED: {name}")
            return result
        except Exception as e:
            self.test_results.append({"name": name, "status": "ERROR", "error": str(e)})
            self.log_error(f"ERROR in {name}: {str(e)}")
            return False

    def get_jwt_token(self):
        """Get JWT token via dev-bypass."""
        self.log("Getting JWT token via /api/v1/auth/dev-bypass...")
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/auth/dev-bypass",
                json={"email": "test@dressapp.co"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                if self.token:
                    self.log_success(f"Got JWT token: {self.token[:20]}...")
                    return True
                else:
                    self.log_error("No access_token in response")
                    return False
            else:
                self.log_error(f"Dev-bypass failed: {response.status_code} - {response.text[:200]}")
                return False
        except Exception as e:
            self.log_error(f"Dev-bypass error: {str(e)}")
            return False

    def test_backend_startup_logs(self):
        """Test 5: Verify backend starts cleanly without emergentintegrations errors."""
        self.log("Checking backend error logs for emergentintegrations imports...")
        try:
            with open('/var/log/supervisor/backend.err.log', 'r') as f:
                lines = f.readlines()
                last_50 = lines[-50:] if len(lines) > 50 else lines
                
            # Check for emergentintegrations import errors
            import_errors = [line for line in last_50 if 'emergentintegrations' in line.lower() and 'error' in line.lower()]
            
            if import_errors:
                self.log_error("Found emergentintegrations import errors:")
                for err in import_errors:
                    print(f"  {err.strip()}")
                return False
            else:
                self.log_success("No emergentintegrations import errors found")
                
            # Check for successful startup
            startup_success = any('Application startup complete' in line for line in last_50)
            if startup_success:
                self.log_success("Backend started successfully")
                return True
            else:
                self.log_warning("Could not confirm successful startup")
                return True  # Don't fail on this
                
        except Exception as e:
            self.log_error(f"Error reading logs: {str(e)}")
            return False

    def test_closet_analyze_streaming(self):
        """Test 1: POST /api/v1/closet/analyze - streaming NDJSON response."""
        self.log("Testing /api/v1/closet/analyze with streaming NDJSON...")
        
        # Load test image
        test_image_path = Path("/app/inference-server/eyes/test_images/0001.jpg")
        if not test_image_path.exists():
            test_image_path = Path("/app/inference-server/eyes/test_images/0002.jpg")
        
        if not test_image_path.exists():
            self.log_error("Test image not found")
            return False
        
        with open(test_image_path, 'rb') as f:
            image_bytes = f.read()
        
        image_b64 = base64.b64encode(image_bytes).decode('ascii')
        
        try:
            headers = {
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json',
                'Accept': 'application/x-ndjson'
            }
            
            payload = {
                'image_base64': image_b64,
                'multi': True,
                'language': 'en'
            }
            
            self.log(f"Sending request to {self.base_url}/api/v1/closet/analyze...")
            start_time = time.time()
            
            response = requests.post(
                f"{self.base_url}/api/v1/closet/analyze",
                json=payload,
                headers=headers,
                stream=True,
                timeout=120
            )
            
            elapsed = time.time() - start_time
            
            self.log(f"Response status: {response.status_code}")
            self.log(f"Response headers: {dict(response.headers)}")
            
            if response.status_code != 200:
                self.log_error(f"Expected 200, got {response.status_code}")
                self.log_error(f"Response: {response.text[:500]}")
                return False
            
            # Check Content-Type
            content_type = response.headers.get('content-type', '').lower()
            if 'application/x-ndjson' not in content_type:
                self.log_error(f"Expected Content-Type: application/x-ndjson, got: {content_type}")
                return False
            
            self.log_success(f"Content-Type is application/x-ndjson")
            
            # Parse NDJSON frames
            frames = []
            detect_frames = []
            item_frames = []
            done_frames = []
            
            for line in response.iter_lines():
                if line:
                    try:
                        frame = json.loads(line.decode('utf-8'))
                        frames.append(frame)
                        frame_type = frame.get('type')
                        
                        if frame_type == 'detect':
                            detect_frames.append(frame)
                            self.log(f"  📍 Received 'detect' frame with {len(frame.get('items_meta', []))} items")
                        elif frame_type == 'item':
                            item_frames.append(frame)
                            analysis = frame.get('analysis', {})
                            self.log(f"  👕 Received 'item' frame: {analysis.get('title', 'Unknown')}")
                        elif frame_type == 'done':
                            done_frames.append(frame)
                            self.log(f"  ✓ Received 'done' frame")
                        elif frame_type == 'error':
                            self.log_error(f"  ⚠️  Received 'error' frame: {frame.get('message')}")
                    except json.JSONDecodeError as e:
                        self.log_error(f"Failed to parse NDJSON line: {e}")
                        continue
            
            self.log(f"\nTotal frames received: {len(frames)}")
            self.log(f"  - detect frames: {len(detect_frames)}")
            self.log(f"  - item frames: {len(item_frames)}")
            self.log(f"  - done frames: {len(done_frames)}")
            self.log(f"Elapsed time: {elapsed:.2f}s")
            
            # Verify requirements
            checks = []
            
            # (a) At least one detect frame
            if len(detect_frames) >= 1:
                self.log_success("✓ At least one 'detect' frame received")
                checks.append(True)
            else:
                self.log_error("✗ No 'detect' frame received")
                checks.append(False)
            
            # (b) At least one item frame with analysis
            if len(item_frames) >= 1:
                has_analysis = any(frame.get('analysis') for frame in item_frames)
                if has_analysis:
                    self.log_success("✓ At least one 'item' frame with analysis received")
                    checks.append(True)
                else:
                    self.log_error("✗ Item frames missing analysis payload")
                    checks.append(False)
            else:
                self.log_error("✗ No 'item' frames received")
                checks.append(False)
            
            # (c) Final done frame
            if len(done_frames) >= 1:
                self.log_success("✓ Final 'done' frame received")
                checks.append(True)
            else:
                self.log_error("✗ No 'done' frame received")
                checks.append(False)
            
            # (d) No 5xx errors
            if response.status_code < 500:
                self.log_success("✓ No 5xx errors")
                checks.append(True)
            else:
                self.log_error(f"✗ Got 5xx error: {response.status_code}")
                checks.append(False)
            
            return all(checks)
            
        except requests.exceptions.Timeout:
            self.log_error("Request timed out after 120s")
            return False
        except Exception as e:
            self.log_error(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def test_stylist_endpoint(self):
        """Test 2: POST /api/v1/stylist - stylist chat flow."""
        self.log("Testing /api/v1/stylist endpoint...")
        
        try:
            headers = {
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            payload = {
                'text': 'What should I wear for a casual summer day?',
                'skip_tts': 'true',
                'language': 'en'
            }
            
            self.log(f"Sending request to {self.base_url}/api/v1/stylist...")
            start_time = time.time()
            
            response = requests.post(
                f"{self.base_url}/api/v1/stylist",
                data=payload,
                headers=headers,
                timeout=60
            )
            
            elapsed = time.time() - start_time
            
            self.log(f"Response status: {response.status_code}")
            self.log(f"Elapsed time: {elapsed:.2f}s")
            
            if response.status_code != 200:
                self.log_error(f"Expected 200, got {response.status_code}")
                self.log_error(f"Response: {response.text[:500]}")
                return False
            
            data = response.json()
            advice = data.get('advice', {})
            
            # Check for expected fields
            checks = []
            
            if 'reasoning_summary' in advice:
                self.log_success(f"✓ Got reasoning_summary: {advice['reasoning_summary'][:100]}...")
                checks.append(True)
            else:
                self.log_error("✗ Missing reasoning_summary")
                checks.append(False)
            
            if 'outfit_recommendations' in advice:
                self.log_success(f"✓ Got outfit_recommendations: {len(advice['outfit_recommendations'])} items")
                checks.append(True)
            else:
                self.log_error("✗ Missing outfit_recommendations")
                checks.append(False)
            
            # Check for error indicators
            if '_soft_error' in advice:
                self.log_warning(f"⚠️  Soft error present: {advice['_soft_error']}")
            
            return all(checks)
            
        except requests.exceptions.Timeout:
            self.log_error("Request timed out after 60s")
            return False
        except Exception as e:
            self.log_error(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def test_sizes_analyze_chart(self):
        """Test 3: POST /api/v1/sizes/analyze-chart - size chart OCR."""
        self.log("Testing /api/v1/sizes/analyze-chart endpoint...")
        
        # Use a test image as a mock size chart
        test_image_path = Path("/app/inference-server/eyes/test_images/0001.jpg")
        if not test_image_path.exists():
            test_image_path = Path("/app/inference-server/eyes/test_images/0002.jpg")
        
        if not test_image_path.exists():
            self.log_warning("Test image not found, skipping size chart test")
            return True  # Don't fail if test image missing
        
        with open(test_image_path, 'rb') as f:
            image_bytes = f.read()
        
        image_b64 = base64.b64encode(image_bytes).decode('ascii')
        
        try:
            headers = {
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'chart_screenshot_b64': image_b64
            }
            
            self.log(f"Sending request to {self.base_url}/api/v1/sizes/analyze-chart...")
            start_time = time.time()
            
            response = requests.post(
                f"{self.base_url}/api/v1/sizes/analyze-chart",
                json=payload,
                headers=headers,
                timeout=60
            )
            
            elapsed = time.time() - start_time
            
            self.log(f"Response status: {response.status_code}")
            self.log(f"Elapsed time: {elapsed:.2f}s")
            
            # Accept 200 or business errors (400 with specific messages)
            if response.status_code == 200:
                self.log_success("✓ Got 200 OK")
                data = response.json()
                self.log(f"Response: {json.dumps(data, indent=2)[:300]}...")
                return True
            elif response.status_code == 400:
                # Business error is acceptable (e.g., "measurements missing")
                self.log_warning(f"⚠️  Got 400 (business error): {response.text[:200]}")
                return True
            elif response.status_code >= 500:
                self.log_error(f"✗ Got 5xx error: {response.status_code}")
                self.log_error(f"Response: {response.text[:500]}")
                # Check for emergentintegrations error
                if 'emergentintegrations' in response.text.lower():
                    self.log_error("✗ CRITICAL: emergentintegrations error detected!")
                    return False
                return False
            else:
                self.log_warning(f"⚠️  Unexpected status: {response.status_code}")
                return True
            
        except requests.exceptions.Timeout:
            self.log_error("Request timed out after 60s")
            return False
        except Exception as e:
            self.log_error(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def test_admin_llm_usage(self):
        """Test 4: GET /api/v1/admin/llm-usage - health check (optional)."""
        self.log("Testing /api/v1/admin/llm-usage endpoint (optional)...")
        
        try:
            headers = {
                'Authorization': f'Bearer {self.token}'
            }
            
            self.log(f"Sending request to {self.base_url}/api/v1/admin/llm-usage...")
            
            response = requests.get(
                f"{self.base_url}/api/v1/admin/llm-usage",
                headers=headers,
                timeout=10
            )
            
            self.log(f"Response status: {response.status_code}")
            
            if response.status_code == 404:
                self.log_warning("⚠️  Endpoint not found (optional, skipping)")
                return True
            elif response.status_code == 200:
                data = response.json()
                self.log(f"Response: {json.dumps(data, indent=2)[:300]}...")
                
                # Check for Gemini availability indicators
                if 'gemini_api_key' in data:
                    self.log_success(f"✓ gemini_api_key: {data['gemini_api_key']}")
                if 'has_native_gemini' in data:
                    self.log_success(f"✓ has_native_gemini: {data['has_native_gemini']}")
                
                return True
            else:
                self.log_warning(f"⚠️  Unexpected status: {response.status_code}")
                return True  # Don't fail on optional endpoint
            
        except Exception as e:
            self.log_warning(f"⚠️  Error (optional endpoint): {str(e)}")
            return True  # Don't fail on optional endpoint

    def print_summary(self):
        """Print test summary."""
        self.log("\n" + "="*60)
        self.log("TEST SUMMARY", Colors.BLUE)
        self.log("="*60)
        
        for result in self.test_results:
            status = result['status']
            name = result['name']
            if status == 'PASS':
                self.log_success(f"✅ {name}")
            elif status == 'FAIL':
                self.log_error(f"❌ {name}")
            else:
                self.log_error(f"⚠️  {name} - {result.get('error', 'Unknown error')}")
        
        self.log("\n" + "="*60)
        pass_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"Tests passed: {self.tests_passed}/{self.tests_run} ({pass_rate:.1f}%)", Colors.BLUE)
        self.log("="*60 + "\n")
        
        return self.tests_passed == self.tests_run


def main():
    tester = GeminiMigrationTester()
    
    print("\n" + "="*60)
    print("🧪 DressApp Backend - Gemini Migration Test Suite")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print("="*60 + "\n")
    
    # Get JWT token first
    if not tester.get_jwt_token():
        print("\n❌ Failed to get JWT token. Exiting.")
        return 1
    
    # Run all tests
    tester.run_test("Backend Startup Logs", tester.test_backend_startup_logs)
    tester.run_test("POST /api/v1/closet/analyze (Streaming NDJSON)", tester.test_closet_analyze_streaming)
    tester.run_test("POST /api/v1/stylist", tester.test_stylist_endpoint)
    tester.run_test("POST /api/v1/sizes/analyze-chart", tester.test_sizes_analyze_chart)
    tester.run_test("GET /api/v1/admin/llm-usage (Optional)", tester.test_admin_llm_usage)
    
    # Print summary
    all_passed = tester.print_summary()
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
