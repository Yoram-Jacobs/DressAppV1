import os
import httpx
import json

key = os.environ.get("RUNPOD_API_KEY", "")
headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}

# Check public endpoints
query = """
query {
  myself {
    id
  }
}
"""
res = httpx.post("https://api.runpod.io/graphql", json={"query": query}, headers=headers, timeout=10.0)
print("User check:", res.json())

# Search for flux / serverless repos
query_hub = """
query {
  hubRepos {
    id
    name
    displayName
  }
}
"""
try:
    res = httpx.post("https://api.runpod.io/graphql", json={"query": query_hub}, headers=headers, timeout=10.0)
    repos = res.json().get("data", {}).get("hubRepos", [])
    print(f"Hub repos count: {len(repos)}")
    for r in repos:
        name = (r.get("displayName") or r.get("name") or "").lower()
        if "flux" in name or "klein" in name or "image" in name or "comfy" in name:
            print("Match:", r)
except Exception as e:
    print("Hub error:", e)
