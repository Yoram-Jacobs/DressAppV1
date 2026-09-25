import os
import httpx
import json

endpoint_id = os.environ.get("RUNPOD_FLUX_ENDPOINT_ID", "e0tfginw8wy3zw")
key = os.environ.get("RUNPOD_API_KEY", "")
headers = {
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
}

health_url = f"https://api.runpod.ai/v2/{endpoint_id}/health"
try:
    res = httpx.get(health_url, headers=headers, timeout=10.0)
    print("Health Status:", res.status_code, res.text)
except Exception as e:
    print("Health check error:", e)
