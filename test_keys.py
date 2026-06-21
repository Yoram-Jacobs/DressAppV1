import asyncio
import os
from google import genai

async def test_key(name, val):
    if not val:
        print(f"{name} is empty")
        return
    try:
        client = genai.Client(api_key=val)
        resp = await client.aio.models.generate_content(model="gemini-2.5-flash", contents="hello")
        print(f"{name} works! Response: {resp.text[:50]}...")
    except Exception as e:
        print(f"{name} failed: {e}")

async def main():
    await test_key("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY"))
    await test_key("GOOGLE_API_KEY", os.environ.get("GOOGLE_API_KEY"))
    await test_key("GOOGLE_AI_STUDIO_KEY", os.environ.get("GOOGLE_AI_STUDIO_KEY"))

if __name__ == "__main__":
    asyncio.run(main())
