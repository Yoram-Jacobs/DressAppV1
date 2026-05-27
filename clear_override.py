import asyncio
from app.services.eyes_override import set_override

async def main():
    res = await set_override(None, by_email='ops@dressapp.co')
    print("CLEAR OVERRIDE SUCCESS:", res)

asyncio.run(main())
