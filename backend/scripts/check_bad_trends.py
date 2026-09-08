import os
from pymongo import MongoClient

mongo_url = os.getenv("MONGO_URL")
db_name = os.getenv("DB_NAME", "dressapp")
client = MongoClient(mongo_url)
db = client[db_name]

docs = list(db.trend_reports.find())
print("TOTAL CARDS IN DB:", len(docs))

bad = []
for d in docs:
    url = str(d.get("source_url") or "").lower()
    headline = str(d.get("headline") or "")
    if any(bad_word in url for bad_word in ["ynetnews", "fashionbeans", "youtube.com/watch?v=r9_1q_yf0l0", "table_of_content"]):
        bad.append(d)

print("BAD CARDS FOUND:", len(bad))
for b in bad:
    print(f" - ID: {b.get('id')} | LANG: {b.get('language')} | URL: {b.get('source_url')} | HEADLINE: {b.get('headline')}")
