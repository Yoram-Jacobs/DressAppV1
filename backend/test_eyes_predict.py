import asyncio
import os
import httpx

async def test():
    token = os.environ.get("EYES_API_TOKEN", "847f687b4808542b177238478b69b00bf01485a36e503389f3487c8caf77b7a1")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "prompt": "Hello!",
        "max_tokens": 10,
    }
    async with httpx.AsyncClient(timeout=30.0) as cli:
        res = await cli.post("http://eyes:7860/predict", json=payload, headers=headers)
        print("Status code:", res.status_code)
        print("Response:", res.text)

if __name__ == "__main__":
    asyncio.run(test())
