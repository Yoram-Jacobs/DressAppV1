import json
import os

LANGUAGES = ["en", "de", "he", "ar", "es", "fr", "it", "nl", "pt", "ru", "zh", "ja", "hi"]

EXTRA_TRANSLATIONS = {
  "home.aiEditor.tones.forest": {
    "de": "Waldgrün",
    "he": "ירוק יער",
    "ar": "أخضر غابي",
    "es": "Verde bosque",
    "fr": "Vert forêt",
    "it": "Verde foresta",
    "nl": "Bosgroen",
    "pt": "Verde floresta",
    "ru": "Лесной зеленый",
    "zh": "森林绿",
    "ja": "フォレストグリーン",
    "hi": "फॉरेस्ट ग्रीन"
  },
  "home.aiEditor.tones.charcoal": {
    "de": "Anthrazit",
    "he": "פחם",
    "ar": "فحمي",
    "es": "Carbón",
    "fr": "Anthracite",
    "it": "Antracite",
    "nl": "Antraciet",
    "pt": "Carvão",
    "ru": "Угольный",
    "zh": "炭灰色",
    "ja": "チャコール",
    "hi": "चारकोल"
  },
  "home.aiEditor.tones.camel": {
    "de": "Kamelbraun",
    "he": "קאמל",
    "ar": "جملي",
    "es": "Camel",
    "fr": "Camel",
    "it": "Cammello",
    "nl": "Kameel",
    "pt": "Camelo",
    "ru": "Верблюжий",
    "zh": "驼色",
    "ja": "キャメル",
    "hi": "ऊंट रंग (कैमल)"
  },
  "home.aiEditor.tones.slate": {
    "de": "Schieferblau",
    "he": "כחול צפחה",
    "ar": "أزرق إردوازي",
    "es": "Azul pizarra",
    "fr": "Bleu ardoise",
    "it": "Blu ardesia",
    "nl": "Leiblauw",
    "pt": "Azul ardósia",
    "ru": "Сланцево-синий",
    "zh": "板岩蓝",
    "ja": "スレートブルー",
    "hi": "स्लेट नीला"
  },
  "home.aiEditor.tones.ivory": {
    "de": "Elfenbein",
    "he": "שנהב",
    "ar": "عاجي",
    "es": "Marfil",
    "fr": "Ivoire",
    "it": "Avorio",
    "nl": "Ivoor",
    "pt": "Marfim",
    "ru": "Слоновая кость",
    "zh": "象牙白",
    "ja": "アイボリー",
    "hi": "हाथीदांत (आइवरी)"
  },
  "home.aiEditor.silhouettes.slim": {
    "de": "Körpernah",
    "he": "צמוד (סלים)",
    "ar": "ضيق (سليم)",
    "es": "Ajustado",
    "fr": "Ajusté",
    "it": "Aderente",
    "nl": "Aansluitend",
    "pt": "Ajustado",
    "ru": "Облегающий",
    "zh": "修身版型",
    "ja": "スリムフィット",
    "hi": "स्लिम फिट"
  },
  "home.aiEditor.silhouettes.relaxed": {
    "de": "Locker",
    "he": "נינוח (רילקסד)",
    "ar": "مريح",
    "es": "Relajado",
    "fr": "Décontracté",
    "it": "Rilassato",
    "nl": "Losvallend",
    "pt": "Descontraído",
    "ru": "Свободный",
    "zh": "宽松版型",
    "ja": "リラックスフィット",
    "hi": "रिलैक्स्ड फिट"
  },
  "home.aiEditor.silhouettes.oversized": {
    "de": "Oversized",
    "he": "אוברסייז",
    "ar": "فضفاض واسع (أوفرسايز)",
    "es": "Oversize",
    "fr": "Oversize",
    "it": "Oversize",
    "nl": "Oversized",
    "pt": "Oversized",
    "ru": "Оверсайз",
    "zh": "超大版型 (Oversized)",
    "ja": "オーバーサイズ",
    "hi": "ओवरसाइज़्ड"
  },
  "home.stylist.tag": {
    "de": "Einfühlsame Design-Intelligenz",
    "he": "אינטליגנציית סטייל אמפתית",
    "ar": "ذكاء تصميم متفهم وعاطفي",
    "es": "Inteligencia de diseño empática",
    "fr": "Intelligence de style empathique",
    "it": "Intelligenza sartoriale empatica",
    "nl": "Empathische ontwerpintelligentie",
    "pt": "Inteligência de estilo empática",
    "ru": "Чуткий искусственный интеллект стиля",
    "zh": "懂你的共情设计智能",
    "ja": "ライフスタイルに寄り添うデザイン知能",
    "hi": "सहानुभूतिपूर्ण डिज़ाइन बुद्धिमत्ता"
  },
  "home.stylist.heading": {
    "de": "Der KI-Stylist, der das Leben versteht",
    "he": "הסטייליסט ב-AI שמבין את החיים שלך",
    "ar": "منسق الذكاء الاصطناعي الذي يفهم تفاصيل حياتك",
    "es": "El estilista de IA que entiende la vida",
    "fr": "Le styliste IA qui comprend votre vie",
    "it": "Lo stilista IA che capisce la vita",
    "nl": "De AI-stylist die het leven begrijpt",
    "pt": "O estilista de IA que compreende a vida",
    "ru": "AI-стилист, который понимает ваш ритм жизни",
    "zh": "真正读懂生活节奏的AI造型师",
    "ja": "あなたの日常を深く理解するAIスタイリスト",
    "hi": "एआई स्टाइलिस्ट जो जीवन को समझता है"
  },
  "home.stylist.description1": {
    "de": "Ihre Modeauswahl sollte nicht im luftleeren Raum existieren. DressApp verbindet sich direkt mit Ihren Kalender-Feeds und präzisen lokalen Wettervorhersagen, um jeden Tag optimale Outfits zu entwerfen.",
    "he": "בחירות האופנה שלך לא צריכות להתקיים בחלל ריק. DressApp מתחברת ישירות ללוח השנה ולתחזית מזג האוויר המדויקת כדי לעצב עבורך אאוטפיטים מושלמים מדי יום.",
    "ar": "لا ينبغي لخياراتك في الموضة أن تكون معزولة عن واقعك. يتصل DressApp مباشرة بجدول مواعيدك وتوقعات الطقس المحلية الدقيقة لتصميم أزياء مثالية يومياً.",
    "es": "Tus elecciones de moda no deberían existir en el vacío. DressApp se conecta a tu calendario y al pronóstico meteorológico local para diseñar conjuntos óptimos cada día.",
    "fr": "Vos choix de mode ne doivent pas exister dans le vide. DressApp se synchronise avec votre calendrier et la météo locale pour composer des tenues idéales au quotidien.",
    "it": "Le tue scelte di stile non devono esistere nel vuoto. DressApp si collega al calendario e al meteo locale per creare outfit perfetti ogni giorno.",
    "nl": "Jouw kledingkeuzes moeten niet losstaan van de realiteit. DressApp koppelt met je agenda en weersverwachting om dagelijks optimale outfits te ontwerpen.",
    "pt": "As suas escolhas de moda não devem existir no vazio. A DressApp conecta-se à sua agenda e à meteorologia local para criar visuais perfeitos todos os dias.",
    "ru": "Ваш стиль не должен существовать отдельно от жизни. DressApp учитывает ваш календарь встреч и прогноз погоды, чтобы каждый день подбирать идеальный наряд.",
    "zh": "日常穿搭不应脱离实际。DressApp 直连您的日历日程与实时精准天气，为您量身定制每日最佳穿搭方案。",
    "ja": "毎日のコーディネートを、ただの思いつきで選ぶ必要はありません。DressAppがカレンダーと現地の天気に連動し、その日に最適な装いを提案します。",
    "hi": "आपके फैशन विकल्प अलग-थलग नहीं होने चाहिए। ड्रेसऐप हर दिन इष्टतम कपड़े डिजाइन करने के लिए आपके कैलेंडर और सटीक स्थानीय मौसम से सीधे जुड़ता है।"
  },
  "home.stylist.description2": {
    "de": "Gehen Sie nie wieder unpassend gekleidet zu wichtigen Geschäftsterminen oder unvorbereitet bei plötzlichem Regen aus dem Haus. Es ist, als hätten Sie einen erstklassigen Modeberater auf Ihrem Smartphone, der vollen Zugriff auf Ihre Garderobe hat.",
    "he": "לעולם אל תצאו לא מתאימים לפגישות עסקיות חשובות או לא מוכנים לגשם פתאומי. זה מרגיש כמו סטייליסט אישי ברמה עולמית בטלפון שלכם, עם גישה מלאה לכל מה שבארון.",
    "ar": "لا تخرج أبداً بملابس غير ملائمة للاجتماعات الهامة أو غير مستعد لأمطار مفاجئة. يبدو الأمر وكأن لديك مستشار أزياء عالمي في هاتفك مع وصول كامل لخزانتك.",
    "es": "Nunca salgas mal vestido para reuniones de negocios clave ni desprevenido ante una lluvia repentina. Es como tener un asesor de moda de talla mundial en tu teléfono.",
    "fr": "Ne soyez plus jamais pris au dépourvu pour un rendez-vous important ou une pluie soudaine. C'est comme avoir un styliste de renom dans votre poche, avec accès à tout votre dressing.",
    "it": "Non uscire mai più con l'abito sbagliato per una riunione importante o impreparato alla pioggia. È come avere un consulente di moda d'élite sempre a portata di mano.",
    "nl": "Stap nooit meer ongepast gekleed naar een belangrijke vergadering of onvoorbereid in een regenbui. Alsof je een topstylist in je zak hebt met zicht op je hele kledingkast.",
    "pt": "Nunca mais saia mal vestido para uma reunião importante ou desprevenido para uma chuva repentina. É como ter um consultor de moda de topo no seu telemóvel.",
    "ru": "Больше никаких сомнений перед важной встречей или неожиданным дождем. Это ваш личный звездный стилист в телефоне, знающий весь ваш гардероб.",
    "zh": "不再因商务会谈着装不当而尴尬，也无需担忧突如其来的降雨。宛如随身拥有一位顶级专属时尚造型顾问，洞悉你衣橱里的每一件单品。",
    "ja": "大事な商談での服装選びに迷ったり、突然の雨に慌てることはもうありません。クローゼットを知り尽くした世界最高峰のスタイリストがいつも手元にいる感覚です。",
    "hi": "महत्वपूर्ण व्यावसायिक सत्रों के लिए कभी भी कम कपड़े पहनकर या अचानक बारिश के लिए बिना तैयारी के बाहर न निकलें।"
  },
  "home.stylist.cta": {
    "de": "Stylist fragen",
    "he": "שאל את הסטייליסט",
    "ar": "اسأل المنسق",
    "es": "Preguntar al estilista",
    "fr": "Demander au styliste",
    "it": "Chiedi allo stilista",
    "nl": "Vraag de stylist",
    "pt": "Perguntar ao estilista",
    "ru": "Спросить стилиста",
    "zh": "咨询造型师",
    "ja": "スタイリストに相談",
    "hi": "स्टाइलिस्ट से पूछें"
  },
  "home.stylistPreview.brandName": {
    "de": "DressApp KI-Personal-Stylist",
    "he": "סטייליסט אישי ב-AI של DressApp",
    "ar": "منسق الأزياء الشخصي الذكي من DressApp",
    "es": "Estilista personal IA de DressApp",
    "fr": "Styliste personnel IA DressApp",
    "it": "Personal Stylist IA DressApp",
    "nl": "DressApp AI Personal Stylist",
    "pt": "Personal Stylist IA DressApp",
    "ru": "Персональный AI-стилист DressApp",
    "zh": "DressApp AI 专属个人造型师",
    "ja": "DressApp AI パーソナルスタイリスト",
    "hi": "ड्रेसऐप एआई पर्सनल स्टाइलिस्ट"
  },
  "home.stylistPreview.activeStatus": {
    "de": "Aktiv & Bereit zur Beratung",
    "he": "פעיל ומוכן לייעוץ",
    "ar": "نشط وجاهز للاستشارة",
    "es": "Activo y listo para consultar",
    "fr": "Actif et prêt à vous conseiller",
    "it": "Attivo e pronto a consigliarti",
    "nl": "Actief & klaar voor advies",
    "pt": "Ativo e pronto para consultar",
    "ru": "В сети и готов к консультации",
    "zh": "已就绪，随时为您提供造型建议",
    "ja": "オンライン・相談可能",
    "hi": "सक्रिय और परामर्श के लिए तैयार"
  },
  "home.stylistPreview.userMessage": {
    "de": "„Was soll ich morgen anziehen?“",
    "he": "״מה כדאי לי ללבוש מחר?״",
    "ar": "«ماذا يجب أن أرتدي غداً؟»",
    "es": "“¿Qué debería ponerme mañana?”",
    "fr": "« Que devrais-je porter demain ? »",
    "it": "“Cosa dovrei indossare domani?”",
    "nl": "“Wat zal ik morgen aandoen?”",
    "pt": "“O que devo vestir amanhã?”",
    "ru": "«Что мне надеть завтра?»",
    "zh": "“明天我该穿什么？”",
    "ja": "「明日は何を着ればいい？」",
    "hi": "“मुझे कल क्या पहनना चाहिए?”"
  },
  "home.stylistPreview.aiMessageCalendarLead": {
    "de": "und Ihr Kalender vermerkt ein",
    "he": "ולוח השנה שלך מציין",
    "ar": "وجدول مواعيدك يتضمن",
    "es": "y tu calendario indica una",
    "fr": "et que votre agenda note une",
    "it": "e il tuo calendario indica una",
    "nl": "en je agenda vermeldt een",
    "pt": "e a sua agenda indica uma",
    "ru": "а в вашем календаре запланирована",
    "zh": "并且您的日历日程安排了",
    "ja": "カレンダーには次の予定が登録されています：",
    "hi": "और आपके कैलेंडर में दर्ज है एक"
  }
}

def set_nested(data, key, value):
    parts = key.split(".")
    curr = data
    for p in parts[:-1]:
        if p not in curr or not isinstance(curr[p], dict):
            curr[p] = {}
        curr = curr[p]
    curr[parts[-1]] = value

# Load canonical English
with open("apps/web/src/locales/en.json", "r", encoding="utf-8-sig") as f:
    en_data = json.load(f)

for lang in LANGUAGES:
    if lang == "en":
        target_data = en_data
    else:
        target_path = f"apps/web/src/locales/{lang}.json"
        with open(target_path, "r", encoding="utf-8-sig") as f:
            target_data = json.load(f)
            
        for key, lang_map in EXTRA_TRANSLATIONS.items():
            val = lang_map.get(lang) or lang_map.get("en")
            if val:
                set_nested(target_data, key, val)
                
    with open(f"apps/web/src/locales/{lang}.json", "w", encoding="utf-8") as f:
        json.dump(target_data, f, indent=2, ensure_ascii=False)
        f.write("\n")
        
    os.makedirs("packages/i18n/locales", exist_ok=True)
    with open(f"packages/i18n/locales/{lang}.json", "w", encoding="utf-8") as f:
        json.dump(target_data, f, indent=2, ensure_ascii=False)
        f.write("\n")

print("All extra 17 keys successfully merged and synced!")
