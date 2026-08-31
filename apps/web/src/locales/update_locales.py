import json
import os

locales_dir = r"C:\DressApp_AG\frontend\src\locales"
locales = ["ar", "de", "es", "fr", "he", "hi", "it", "ja", "nl", "pt", "ru", "zh"]

translations = {
    "ar": {
        "syncGoogle": "مزامنة ملف تعريف Google",
        "googleSyncSuccess": "تمت مزامنة الملف الشخصي بنجاح.",
        "googleSyncFailed": "فشلت المزامنة."
    },
    "de": {
        "syncGoogle": "Google-Profil synchronisieren",
        "googleSyncSuccess": "Profil erfolgreich synchronisiert.",
        "googleSyncFailed": "Synchronisierung fehlgeschlagen."
    },
    "es": {
        "syncGoogle": "Sincronizar perfil de Google",
        "googleSyncSuccess": "Perfil sincronizado con éxito.",
        "googleSyncFailed": "Error en la sincronización."
    },
    "fr": {
        "syncGoogle": "Synchroniser le profil Google",
        "googleSyncSuccess": "Profil synchronisé avec succès.",
        "googleSyncFailed": "Échec de la synchronisation."
    },
    "he": {
        "syncGoogle": "סנכרון פרופיל Google",
        "googleSyncSuccess": "הפרופיל סונכרן בהצלחה.",
        "googleSyncFailed": "הסנכרון נכשל."
    },
    "hi": {
        "syncGoogle": "Google प्रोफ़ाइल सिंक करें",
        "googleSyncSuccess": "प्रोफ़ाइल सफलतापूर्वक सिंक हो गई।",
        "googleSyncFailed": "सिंक विफल रहा।"
    },
    "it": {
        "syncGoogle": "Sincronizza profilo Google",
        "googleSyncSuccess": "Profilo sincronizzato con successo.",
        "googleSyncFailed": "Sincronizzazione non riuscita."
    },
    "ja": {
        "syncGoogle": "Googleプロフィールを同期",
        "googleSyncSuccess": "プロフィールが正常に同期されました。",
        "googleSyncFailed": "同期に失敗しました。"
    },
    "nl": {
        "syncGoogle": "Google-profiel synchroniseren",
        "googleSyncSuccess": "Profiel succesvol gesynchroniseerd.",
        "googleSyncFailed": "Synchronisatie mislukt."
    },
    "pt": {
        "syncGoogle": "Sincronizar perfil do Google",
        "googleSyncSuccess": "Perfil sincronizado com sucesso.",
        "googleSyncFailed": "Falha na sincronização."
    },
    "ru": {
        "syncGoogle": "Синхронизировать профиль Google",
        "googleSyncSuccess": "Профиль успешно синхронизирован.",
        "googleSyncFailed": "Ошибка синхронизации."
    },
    "zh": {
        "syncGoogle": "同步 Google 个人资料",
        "googleSyncSuccess": "个人资料同步成功。",
        "googleSyncFailed": "同步失败。"
    }
}

for loc in locales:
    file_path = os.path.join(locales_dir, f"{loc}.json")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if "profile" in data:
        new_profile = {}
        for k, v in data["profile"].items():
            new_profile[k] = v
            if k == "autofilledFromGoogle":
                new_profile["syncGoogle"] = translations[loc]["syncGoogle"]
                new_profile["googleSyncSuccess"] = translations[loc]["googleSyncSuccess"]
                new_profile["googleSyncFailed"] = translations[loc]["googleSyncFailed"]
        
        if "syncGoogle" not in new_profile:
            new_profile["syncGoogle"] = translations[loc]["syncGoogle"]
            new_profile["googleSyncSuccess"] = translations[loc]["googleSyncSuccess"]
            new_profile["googleSyncFailed"] = translations[loc]["googleSyncFailed"]
            
        data["profile"] = new_profile
    else:
        data["profile"] = {
            "syncGoogle": translations[loc]["syncGoogle"],
            "googleSyncSuccess": translations[loc]["googleSyncSuccess"],
            "googleSyncFailed": translations[loc]["googleSyncFailed"]
        }
    
    with open(file_path, 'w', encoding='utf-8', newline='\r\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

print("All files updated successfully.")
