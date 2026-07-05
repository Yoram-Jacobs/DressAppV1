import json
import os

locales_dir = r"c:\DressApp_AG\frontend\src\locales"
languages = [d for d in os.listdir(locales_dir) if d.endswith(".json")]

translations_to_add = {
    "en": {
        "todayEvents": "Today's Agenda",
        "calendarSyncOn": "Syncing calendar items",
        "calendarSyncOff": "Toggle to check events",
        "todaysAgenda": "Today's Schedule",
        "noEventsToday": "No events scheduled for today.",
        "aiRationale": "Stylist's Advice"
    },
    "he": {
        "todayEvents": "לוז יומי",
        "calendarSyncOn": "מסנכרן אירועי יומן",
        "calendarSyncOff": "הפעל כדי לבדוק אירועים",
        "todaysAgenda": "לוז יומי",
        "noEventsToday": "אין אירועים מתוכננים להיום.",
        "aiRationale": "עצת הסטייליסט"
    }
}

for lang_file in languages:
    lang_code = lang_file.split(".")[0]
    filepath = os.path.join(locales_dir, lang_file)
    
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    if "stylist" not in data:
        data["stylist"] = {}
        
    source = translations_to_add.get(lang_code, translations_to_add["en"])
    for key, val in source.items():
        if key not in data["stylist"]:
            data["stylist"][key] = val
            
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("Injected missing translations.")
