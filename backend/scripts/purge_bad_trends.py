import os
from pymongo import MongoClient

mongo_url = os.getenv("MONGO_URL")
db_name = os.getenv("DB_NAME", "dressapp")
client = MongoClient(mongo_url)
db = client[db_name]

disallowed_patterns = [
    {"source_url": {"$regex": r"shopisrael\.com", "$options": "i"}},
    {"source_url": {"$regex": r"facebook\.com/login", "$options": "i"}},
    {"source_url": {"$regex": r"vertexaisearch\.cloud\.google\.com", "$options": "i"}},
    {"source_url": {"$regex": r"S12345678", "$options": "i"}},
    {"source_url": {"$regex": r"timeout\.co\.il/topic/", "$options": "i"}},
    {"source_url": {"$regex": r"ynetnews\.com", "$options": "i"}},
    {"source_url": {"$regex": r"fashionbeans\.com/table_of_content", "$options": "i"}},
    {"source_url": {"$regex": r"youtube\.com/watch\?v=R9_1q_yF0l0", "$options": "i"}},
]

total_deleted = 0
for pat in disallowed_patterns:
    res = db.trend_reports.delete_many(pat)
    if res.deleted_count > 0:
        print(f"Deleted {res.deleted_count} cards matching pattern: {pat}")
        total_deleted += res.deleted_count

print(f"Purge complete. Total cards deleted: {total_deleted}")
