import os
import json

locales_dir = r"C:\DressApp_AG\frontend\src\locales"
locales = [f for f in os.listdir(locales_dir) if f.endswith(".json")]

for locale in locales:
    path = os.path.join(locales_dir, locale)
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            print(f"--- {locale} ---")
            # Closet gatekeeper
            closet = data.get("closet", {})
            closet_gk = closet.get("gatekeeper", {})
            print(f"  closet.gatekeeper.title: {closet_gk.get('title')}")
            print(f"  closet.gatekeeper.body: {closet_gk.get('body')}")
            
            # ItemDetail gatekeeper
            item_detail = data.get("itemDetail", {})
            item_detail_gk = item_detail.get("gatekeeper", {})
            print(f"  itemDetail.gatekeeper.title: {item_detail_gk.get('title')}")
            print(f"  itemDetail.gatekeeper.body: {item_detail_gk.get('body')}")
        except Exception as e:
            print(f"Error reading {locale}: {e}")
