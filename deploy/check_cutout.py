import asyncio
from app.services.clothing_parser import parse_garments
from PIL import Image

async def run():
    # Read the latest uploaded original image or test image
    with open('/var/lib/docker/volumes/dressapp_static-uploads/_data/uploads/items/2026/10/13/bb780080978d4b768e37e11660f3c8ef.png', 'rb') as f:
        data = f.read()
    items = await parse_garments(data)
    print(f'Items found: {len(items)}')
    for i, it in enumerate(items):
        print(f'[{i}] label={it.get(\ label\)} category={it.get(\category\)} bbox={it.get(\bbox\)}')

asyncio.run(run())
