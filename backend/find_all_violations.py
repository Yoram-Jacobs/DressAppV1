import asyncio
import os
import sys
from pymongo import MongoClient

# Add backend to path to import settings
sys.path.insert(0, r"C:\DressApp_AG\backend")
from app.config import settings

client = MongoClient(settings.MONGO_URL)
db = client[settings.DB_NAME]

print("Connected to DB:", settings.DB_NAME)
items = list(db.closet_items.find({}))
print(f"Found {len(items)} closet items.")

for item in items:
    season = item.get("season")
    if season is not None:
        print(f"Item ID: {item.get('id')}, title: {item.get('title')}, season: {season} ({type(season)})")
