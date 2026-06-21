import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['dressapp']
    suitcase = await db.suitcases.find_one({'status': {'$ne': 'completed'}})
    if suitcase:
        print("Active Suitcase Found. Keys:", suitcase.keys())
        # Print a sanitized version of the JSON for inspection
        suitcase['_id'] = str(suitcase['_id'])
        # Truncate image strings if any
        if 'packing_list' in suitcase and isinstance(suitcase['packing_list'], list):
            for item in suitcase['packing_list']:
                for k in ['thumbnail_data_url', 'reconstructed_image_url', 'clean_image_url', 'segmented_image_url', 'original_image_url']:
                    if item.get(k): item[k] = "URL_TRUNCATED"
        print(json.dumps(suitcase, indent=2))
    else:
        print('No active suitcase found')

if __name__ == "__main__":
    asyncio.run(main())
