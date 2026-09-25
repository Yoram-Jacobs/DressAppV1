import json
from pathlib import Path

locales_data = {
    "en": {
        "subtitle": "Chat with The Eyes to remove unwanted objects, complete cutoffs, or refine garment details using AI Reconstructor.",
        "aiGeneratedBadge": "AI Reconstructed",
        "fluxKleinBadge": "FLUX.2 Klein Generated",
        "aiGenerating": "AI is generating pixels…",
    },
    "he": {
        "subtitle": "שוחח עם The Eyes כדי להסיר אובייקטים לא רצויים, להשלים חיתוכים או לדייק פרטי פריט בעזרת AI Reconstructor.",
        "aiGeneratedBadge": "שוחזר ע״י AI",
        "fluxKleinBadge": "נוצר ע״י FLUX.2 Klein",
        "aiGenerating": "ה-AI מייצר פיקסלים…",
    },
    "ar": {
        "subtitle": "تحدث مع The Eyes لإزالة العناصر غير المرغوب فيها، أو إكمال الأجزاء المقطوعة، أو تحسين تفاصيل الملابس باستخدام AI Reconstructor.",
        "aiGeneratedBadge": "تمت إعادة البناء بواسطة الذكاء الاصطناعي",
        "fluxKleinBadge": "تم الإنشاء بواسطة FLUX.2 Klein",
        "aiGenerating": "الذكاء الاصطناعي يقوم بإنشاء البكسلات…",
    },
    "de": {
        "subtitle": "Chatten Sie mit The Eyes, um unerwünschte Objekte zu entfernen, abgeschnittene Bereiche zu vervollständigen oder Kleidungsdetails mit AI Reconstructor zu verfeinern.",
        "aiGeneratedBadge": "KI-rekonstruiert",
        "fluxKleinBadge": "Mit FLUX.2 Klein generiert",
        "aiGenerating": "KI generiert Pixel…",
    },
    "es": {
        "subtitle": "Chatea con The Eyes para eliminar objetos no deseados, completar recortes o refinar detalles de la prenda con AI Reconstructor.",
        "aiGeneratedBadge": "Reconstruido por IA",
        "fluxKleinBadge": "Generado por FLUX.2 Klein",
        "aiGenerating": "La IA está generando píxeles…",
    },
    "fr": {
        "subtitle": "Discutez avec The Eyes pour supprimer des objets indésirables, compléter des parties coupées ou affiner les détails du vêtement avec AI Reconstructor.",
        "aiGeneratedBadge": "Reconstruit par l'IA",
        "fluxKleinBadge": "Généré par FLUX.2 Klein",
        "aiGenerating": "L'IA génère les pixels…",
    },
    "hi": {
        "subtitle": "AI Reconstructor का उपयोग करके अनचाहे ऑब्जेक्ट हटाने, कटे हुए हिस्सों को पूरा करने या कपड़ों के विवरण को परिष्कृत करने के लिए The Eyes से चैट करें।",
        "aiGeneratedBadge": "AI द्वारा पुनर्गठित",
        "fluxKleinBadge": "FLUX.2 Klein द्वारा जनरेट किया गया",
        "aiGenerating": "AI पिक्सेल उत्पन्न कर रहा है…",
    },
    "it": {
        "subtitle": "Chatta con The Eyes per rimuovere oggetti indesiderati, completare parti tagliate o perfezionare i dettagli del capo con AI Reconstructor.",
        "aiGeneratedBadge": "Ricostruito con IA",
        "fluxKleinBadge": "Generato con FLUX.2 Klein",
        "aiGenerating": "L'IA sta generando pixel…",
    },
    "ja": {
        "subtitle": "The Eyes とチャットして、不要なオブジェクトの削除、欠けた部分の補完、または AI Reconstructor を使用した服の詳細の調整を行います。",
        "aiGeneratedBadge": "AI再構築済み",
        "fluxKleinBadge": "FLUX.2 Klein で生成",
        "aiGenerating": "AIがピクセルを生成中…",
    },
    "nl": {
        "subtitle": "Chat met The Eyes om ongewenste objecten te verwijderen, afgesneden delen aan te vullen of kledingdetails te verfijnen met AI Reconstructor.",
        "aiGeneratedBadge": "AI-gereconstrueerd",
        "fluxKleinBadge": "Gegenereerd door FLUX.2 Klein",
        "aiGenerating": "AI genereert pixels…",
    },
    "pt": {
        "subtitle": "Converse com The Eyes para remover objetos indesejados, completar partes cortadas ou refinar detalhes da roupa usando o AI Reconstructor.",
        "aiGeneratedBadge": "Reconstruído por IA",
        "fluxKleinBadge": "Gerado por FLUX.2 Klein",
        "aiGenerating": "A IA está gerando pixels…",
    },
    "ru": {
        "subtitle": "Общайтесь с The Eyes, чтобы удалить нежелательные объекты, дорисовать обрезанные части или улучшить детали одежды с помощью AI Reconstructor.",
        "aiGeneratedBadge": "Восстановлено ИИ",
        "fluxKleinBadge": "Создано FLUX.2 Klein",
        "aiGenerating": "ИИ генерирует пиксели…",
    },
    "zh": {
        "subtitle": "与 The Eyes 对话，使用 AI Reconstructor 移除多余物体、补全裁剪部分或优化服饰细节。",
        "aiGeneratedBadge": "AI重构完成",
        "fluxKleinBadge": "由 FLUX.2 Klein 生成",
        "aiGenerating": "AI正在生成像素…",
    },
}

directories = [
    Path("packages/i18n/locales"),
    Path("apps/web/src/locales"),
]

for d in directories:
    for lang, trans in locales_data.items():
        file_path = d / f"{lang}.json"
        if not file_path.exists():
            print(f"Skipping {file_path}, does not exist")
            continue
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        reanalyze = data.get("itemDetail", {}).get("reanalyze")
        if reanalyze is not None:
            reanalyze["subtitle"] = trans["subtitle"]
            reanalyze["aiGeneratedBadge"] = trans["aiGeneratedBadge"]
            reanalyze["fluxKleinBadge"] = trans["fluxKleinBadge"]
            reanalyze["aiGenerating"] = trans["aiGenerating"]
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(f"Updated {file_path}")
        else:
            print(f"reanalyze block not found in {file_path}")
