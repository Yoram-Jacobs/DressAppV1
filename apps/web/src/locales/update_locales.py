import json
import os

locales = ['en', 'he', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'nl', 'pt', 'ru', 'zh']

translations = {
    'en': {
        'trend_scout_title': 'Trend Scout',
        'trend_scout_p1': 'Stay inspired with our daily curated fashion radar and style recommendations:',
        'trend_feed_title': 'Daily Fashion Radar (7 Curated Channels)',
        'trend_feed_desc': 'Explore 📍 Local News, 👑 Runway, 👟 Street Style, 🌿 Sustainability, ✨ Influencers & Icons, ♻️ Vintage / Archival, and 🔧 Care & Repairs.',
        'trend_closet_title': '1-Tap "Style with My Closet"',
        'trend_closet_desc': 'Tap the button on any trend card to let our AI Stylist match the trend\'s colors and silhouette directly to clothes already hanging in your digitized wardrobe.',
        'trend_personalization_title': 'Personalization & Social Feeds (⚙️)',
        'trend_personalization_desc': 'Customize style aesthetics (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalist, Y2K), connect social accounts, and view your automated closet profile.',
        'trend_gender_title': 'Gender Targeting & Live Refresh',
        'trend_gender_desc': 'Toggle effortlessly between Women\'s and Men\'s fashion, read verified articles on Vogue/GQ, and tap Refresh (🔄) for instant real-time updates.',
        'trend_buckets_title': 'Trend Channels',
        'trend_buckets_desc': 'Explore 7 curated channels: Local News, SS26 Runway, Street Style, Sustainability, Influencers & Icons, Vintage & Archival, and Garment Care & Repairs.'
    },
    'he': {
        'trend_scout_title': 'סייר הטרנדים (Trend Scout)',
        'trend_scout_p1': 'הישארו מעודכנים עם רדאר האופנה היומי והמלצות הסטייל המותאמות אישית:',
        'trend_feed_title': 'רדאר אופנה יומי (7 ערוצים נבחרים)',
        'trend_feed_desc': 'גלו 📍 חדשות מקומיות, 👑 מסלול, 👟 אופנת רחוב, 🌿 קיימות, ✨ משפיענים ואייקונים, ♻️ וינטג\' וארכיון, ו-🔧 טיפול ותיקונים.',
        'trend_closet_title': 'עיצוב בלחיצה אחת: "עצב עם הארון שלי"',
        'trend_closet_desc': 'לחצו על הכפתור בכל כרטיס טרנד כדי שהסטייליסט החכם יתאים את צבעי וגזרת הטרנד ישירות לבגדים שכבר תלויים בארון הדיגיטלי שלכם.',
        'trend_personalization_title': 'התאמה אישית ורשתות חברתיות (⚙️)',
        'trend_personalization_desc': 'הגדירו אסתטיקות סגנון (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalist, Y2K), חברו חשבונות חברתיים וצפו בפרופיל הארון האוטומטי.',
        'trend_gender_title': 'התאמה מגדרית ורענון בזמן אמת',
        'trend_gender_desc': 'עברו בקלות בין אופנת נשים לאופנת גברים, קראו כתבות מקוריות ב-Vogue/GQ, ולחצו על רענון (🔄) לעדכונים חיים ומיידיים.',
        'trend_buckets_title': 'ערוצי טרנדים נבחרים',
        'trend_buckets_desc': 'חקרו 7 ערוצים ייעודיים: חדשות מקומיות, מסלול SS26, אופנת רחוב, קיימות, משפיענים, וינטג\' וארכיון, וטיפול בבגדים.'
    },
    'ar': {
        'trend_scout_title': 'مستكشف الصيحات (Trend Scout)',
        'trend_scout_p1': 'ابقَ على اطلاع بأحدث صيحات الموضة العالمية والمحلية وتوصيات الأناقة اليومية:',
        'trend_feed_title': 'رادار الموضة اليومي (7 قنوات مختارة)',
        'trend_feed_desc': 'استكشف 📍 الأخبار المحلية، 👑 منصات العرض، 👟 أزياء الشارع، 🌿 الاستدامة، ✨ المؤثرون والأيقونات، ♻️ الفينتاج والأرشيف، و🔧 العناية والإصلاح.',
        'trend_closet_title': 'بنقرة واحدة: "تنسيق مع خزانتي"',
        'trend_closet_desc': 'انقر على الزر في أي بطاقة صيحة ليقوم المنسق الذكي بمطابقة ألوان وقصات الصيحة مع الملابس الموجودة بالفعل في خزانك الرقمية.',
        'trend_personalization_title': 'التخصيص وموجزات التواصل (⚙️)',
        'trend_personalization_desc': 'حدد جماليات أسلوبك (Quiet Luxury، Vintage، Streetwear، Old Money، Minimalist، Y2K)، واربط وسائل التواصل، وشاهد ملف خزانك التلقائي.',
        'trend_gender_title': 'تحديد الفئة والرادار المباشر',
        'trend_gender_desc': 'تنقل بسهولة بين الأزياء النسائية والرجالية، واقرأ المقالات الأصلية على Vogue وGQ، واضغط تحديث (🔄) للحصول على أحدث التقارير فوراً.',
        'trend_buckets_title': 'قنوات الصيحات',
        'trend_buckets_desc': 'استكشف 7 قنوات منسقة: الأخبار المحلية، عروض SS26، أزياء الشارع، الاستدامة، المؤثرون، الفينتاج، والعناية بالملابس.'
    },
    'de': {
        'trend_scout_title': 'Trend Scout',
        'trend_scout_p1': 'Bleiben Sie inspiriert mit unserem täglich kuratierten Modedar und persönlichen Style-Empfehlungen:',
        'trend_feed_title': 'Täglicher Modedar (7 kuratierte Kanäle)',
        'trend_feed_desc': 'Entdecken Sie 📍 Lokale News, 👑 Laufsteg, 👟 Street Style, 🌿 Nachhaltigkeit, ✨ Influencer & Ikonen, ♻️ Vintage & Archiv und 🔧 Pflege & Reparatur.',
        'trend_closet_title': '1-Klick "Mit meinem Kleiderschrank stylen"',
        'trend_closet_desc': 'Tippen Sie auf die Schaltfläche einer Trendkarte, damit der KI-Stylist Farben und Silhouetten direkt mit Kleidungsstücken aus Ihrem Kleiderschrank abgleicht.',
        'trend_personalization_title': 'Personalisierung & Social Feeds (⚙️)',
        'trend_personalization_desc': 'Wählen Sie Stil-Ästhetiken (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalist, Y2K), verknüpfen Sie Social Accounts und prüfen Sie Ihr Kleiderschrank-Profil.',
        'trend_gender_title': 'Geschlechterauswahl & Live-Aktualisierung',
        'trend_gender_desc': 'Wechseln Sie mühelos zwischen Damen- und Herrenmode, lesen Sie verifizierte Artikel auf Vogue/GQ und tippen Sie auf Aktualisieren (🔄) für Sofort-Updates.',
        'trend_buckets_title': 'Trend-Kanäle',
        'trend_buckets_desc': 'Erkunden Sie 7 kuratierte Kanäle: Lokale News, SS26 Runway, Street Style, Nachhaltigkeit, Influencer, Vintage und Textilpflege.'
    },
    'es': {
        'trend_scout_title': 'Explorador de Tendencias',
        'trend_scout_p1': 'Mantén tu estilo a la vanguardia con nuestro radar diario de moda y recomendaciones personalizadas:',
        'trend_feed_title': 'Radar Diario de Moda (7 Canales Curados)',
        'trend_feed_desc': 'Explora 📍 Noticias Locales, 👑 Pasarela, 👟 Estilo Callejero, 🌿 Sostenibilidad, ✨ Creadores e Iconos, ♻️ Vintage y Archivo, y 🔧 Cuidado y Arreglos.',
        'trend_closet_title': '1 Toque: "Combinar con mi Armario"',
        'trend_closet_desc': 'Toca el botón en cualquier tarjeta de tendencia para que nuestro Estilista IA busque prendas en tu armario digital que repliquen el look.',
        'trend_personalization_title': 'Personalización y Redes Sociales (⚙️)',
        'trend_personalization_desc': 'Personaliza estéticas de estilo (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalista, Y2K), vincula tus redes y consulta tu perfil de armario.',
        'trend_gender_title': 'Filtro por Género y Actualización en Vivo',
        'trend_gender_desc': 'Cambia con facilidad entre moda femenina y masculina, lee artículos verificados en Vogue/GQ y toca Actualizar (🔄) para novedades al instante.',
        'trend_buckets_title': 'Canales de Tendencias',
        'trend_buckets_desc': 'Explora 7 canales exclusivos: Noticias Locales, Pasarela SS26, Street Style, Sostenibilidad, Influencers, Vintage y Cuidado de Prendas.'
    },
    'fr': {
        'trend_scout_title': 'Éclaireur de Tendances (Trend Scout)',
        'trend_scout_p1': 'Restez à la pointe du style avec notre radar de mode quotidien et nos recommandations personnalisées :',
        'trend_feed_title': 'Radar Mode Quotidien (7 Canaux Thématiques)',
        'trend_feed_desc': 'Explorez 📍 Actualités Locales, 👑 Défilés, 👟 Street Style, 🌿 Éco-responsabilité, ✨ Influenceurs & Icônes, ♻️ Vintage & Archives, et 🔧 Entretien & Réparations.',
        'trend_closet_title': 'En 1 Clic : "Créer avec ma Garde-robe"',
        'trend_closet_desc': 'Appuyez sur le bouton de n\'importe quelle carte pour que notre Styliste IA associe les couleurs et silhouettes directement aux vêtements de votre dressing.',
        'trend_personalization_title': 'Personnalisation & Réseaux Sociaux (⚙️)',
        'trend_personalization_desc': 'Personnalisez vos esthétiques (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalisme, Y2K), liez vos réseaux et consultez le profil de votre dressing.',
        'trend_gender_title': 'Ciblage Genre & Actualisation en Direct',
        'trend_gender_desc': 'Basculez facilement entre mode Femme et Homme, lisez les articles officiels sur Vogue/GQ et cliquez sur Actualiser (🔄) pour les dernières actus.',
        'trend_buckets_title': 'Canaux de Tendances',
        'trend_buckets_desc': 'Explorez 7 canaux thématiques : Actualités Locales, Défilés SS26, Street Style, Éco-responsabilité, Influenceurs, Vintage et Entretien textile.'
    },
    'hi': {
        'trend_scout_title': 'ट्रेंड स्काउट (Trend Scout)',
        'trend_scout_p1': 'हमारे दैनिक फैशन रडार और वैयक्तिकृत स्टाइल सुझावों के साथ हमेशा सबसे आगे रहें:',
        'trend_feed_title': 'दैनिक फैशन रडार (7 विशेष चैनल)',
        'trend_feed_desc': '📍 स्थानीय समाचार, 👑 रनवे, 👟 स्ट्रीट स्टाइल, 🌿 स्थिरता, ✨ इन्फ्लुएंसर्स, ♻️ विंटेज और 🔧 देखभाल व मरम्मत का अन्वेषण करें।',
        'trend_closet_title': '1-टैप "मेरी अलमारी से स्टाइल करें"',
        'trend_closet_desc': 'किसी भी ट्रेंड कार्ड पर बटन दबाएं ताकि एआई स्टाइलिस्ट ट्रेंड के रंगों और सिल्हूट को आपकी डिजिटल अलमारी के कपड़ों से तुरंत मिला सके।',
        'trend_personalization_title': 'निजीकरण और सोशल फ़ीड (⚙️)',
        'trend_personalization_desc': 'स्टाइल शैलियों (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalist, Y2K) को अनुकूलित करें, सोशल खाते जोड़ें और अपनी अलमारी प्रोफ़ाइल देखें।',
        'trend_gender_title': 'जेंडर लक्ष्यीकरण और लाइव ताज़ा करें',
        'trend_gender_desc': 'महिला और पुरुष फैशन के बीच आसानी से स्विच करें, Vogue/GQ पर प्रामाणिक लेख पढ़ें, और तुरंत अपडेट के लिए रिफ्रेश (🔄) दबाएं।',
        'trend_buckets_title': 'ट्रेंड चैनल',
        'trend_buckets_desc': '7 विशेष चैनल देखें: स्थानीय समाचार, रनवे, स्ट्रीट स्टाइल, स्थिरता, इन्फ्लुएंसर्स, विंटेज, और कपड़ों की देखभाल।'
    },
    'it': {
        'trend_scout_title': 'Trend Scout (Esploratore Tendenze)',
        'trend_scout_p1': 'Rimani sempre al passo con il nostro radar di moda quotidiano e i consigli di stile su misura:',
        'trend_feed_title': 'Radar Quotidiano della Moda (7 Canali Curati)',
        'trend_feed_desc': 'Esplora 📍 Notizie Locali, 👑 Passerella, 👟 Street Style, 🌿 Sostenibilità, ✨ Influencer & Icone, ♻️ Vintage & Archivio e 🔧 Cura & Riparazioni.',
        'trend_closet_title': '1 Tocco: "Abbina con il mio Armadio"',
        'trend_closet_desc': 'Tocca il pulsante su qualsiasi scheda di tendenza: lo Stylist IA abbinerà colori e silhouette direttamente ai capi presenti nel tuo armadio digitale.',
        'trend_personalization_title': 'Personalizzazione e Feed Social (⚙️)',
        'trend_personalization_desc': 'Personalizza gli stili estetici (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalist, Y2K), collega i tuoi account social e visualizza il profilo armadio.',
        'trend_gender_title': 'Selezione Genere e Aggiornamento Live',
        'trend_gender_desc': 'Passa facilmente dalla moda Donna a quella Uomo, leggi articoli verificati su Vogue/GQ e tocca Aggiorna (🔄) per novità in tempo reale.',
        'trend_buckets_title': 'Canali di Tendenza',
        'trend_buckets_desc': 'Esplora 7 canali curati: Notizie Locali, Passerelle SS26, Street Style, Sostenibilità, Influencer, Vintage e Cura dei Capi.'
    },
    'ja': {
        'trend_scout_title': 'トレンドスカウト (Trend Scout)',
        'trend_scout_p1': '毎朝厳選されるファッションレーダーと個別スタイリング提案で、最先端のトレンドをいち早くキャッチ:',
        'trend_feed_title': 'デイリー・ファッションレーダー（厳選7チャンネル）',
        'trend_feed_desc': '📍 地域ニュース、👑 ランウェイ、👟 ストリートスタイル、🌿 サステナビリティ、✨ インフルエンサー、♻️ ヴィンテージ、🔧 お手入れ・補修を探索。',
        'trend_closet_title': 'ワンタップ「マイクローゼットでスタイリング」',
        'trend_closet_desc': 'トレンドカードのボタンをタップすると、AIスタイリストがトレンドの色やシルエットをクローゼット内の服と瞬時にマッチングします。',
        'trend_personalization_title': 'パーソナライズ＆ソーシャル連携 (⚙️)',
        'trend_personalization_desc': '好みのテイスト（クワイエット・ラグジュアリー、ヴィンテージ、ストリート、Y2Kなど）を選び、SNS連携やクローゼット診断を活用できます。',
        'trend_gender_title': '性別切り替え＆リアルタイム更新',
        'trend_gender_desc': 'ウィメンズとメンズのファッションをワンタップで切り替え、VogueやGQの記事を閲覧し、更新ボタン（🔄）で最新速報を受信できます。',
        'trend_buckets_title': 'トレンドチャンネル',
        'trend_buckets_desc': '7つの専門チャンネル：ローカルニュース、ランウェイ、ストリート、サステナビリティ、インフルエンサー、ヴィンテージ、衣服ケア。'
    },
    'nl': {
        'trend_scout_title': 'Trend Scout',
        'trend_scout_p1': 'Blijf vooroplopen met onze dagelijks gecureerde moderadar en gepersonaliseerde stijlaanbevelingen:',
        'trend_feed_title': 'Dagelijkse Moderadar (7 Gecureerde Kanalen)',
        'trend_feed_desc': 'Ontdek 📍 Lokaal Nieuws, 👑 Catwalk, 👟 Streetstyle, 🌿 Duurzaamheid, ✨ Influencers & Iconen, ♻️ Vintage & Archief, en 🔧 Verzorging & Reparaties.',
        'trend_closet_title': '1 Tik: "Stylen met mijn Kledingkast"',
        'trend_closet_desc': 'Tik op de knop op een trendkaart en laat de AI Stylist kleuren en silhouetten direct matchen met kledingstukken die al in je kast hangen.',
        'trend_personalization_title': 'Personalisatie & Social Feeds (⚙️)',
        'trend_personalization_desc': 'Kies stijlesthetieken (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalistisch, Y2K), koppel sociale accounts en bekijk je kastprofiel.',
        'trend_gender_title': 'Doelgroepselectie & Live Vernieuwen',
        'trend_gender_desc': 'Schakel soepel tussen Dames- en Herenmode, lees geverifieerde artikelen op Vogue/GQ en tik op Vernieuwen (🔄) voor realtime updates.',
        'trend_buckets_title': 'Trendkanalen',
        'trend_buckets_desc': 'Ontdek 7 gecureerde kanalen: Lokaal Nieuws, SS26 Runway, Streetstyle, Duurzaamheid, Influencers, Vintage en Kledingonderhoud.'
    },
    'pt': {
        'trend_scout_title': 'Explorador de Tendências (Trend Scout)',
        'trend_scout_p1': 'Mantenha seu estilo sempre à frente com nosso radar diário de moda e recomendações personalizadas:',
        'trend_feed_title': 'Radar Diário de Moda (7 Canais Selecionados)',
        'trend_feed_desc': 'Explore 📍 Notícias Locais, 👑 Passarela, 👟 Moda Urbana, 🌿 Sustentabilidade, ✨ Criadores e Ícones, ♻️ Vintage e Arquivo, e 🔧 Cuidados e Reparos.',
        'trend_closet_title': '1 Toque: "Estilizar com Meu Guarda-Roupa"',
        'trend_closet_desc': 'Toque no botão em qualquer cartão de tendência para que a Estilista IA combine cores e silhuetas diretamente com as roupas do seu closet.',
        'trend_personalization_title': 'Personalização e Redes Sociais (⚙️)',
        'trend_personalization_desc': 'Personalize estéticas (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalista, Y2K), conecte redes sociais e veja o perfil automático do closet.',
        'trend_gender_title': 'Filtro por Gênero e Atualização ao Vivo',
        'trend_gender_desc': 'Alterne facilmente entre moda Feminina e Masculina, leia matérias na Vogue/GQ e toque em Atualizar (🔄) para novidades instantâneas.',
        'trend_buckets_title': 'Canais de Tendências',
        'trend_buckets_desc': 'Explore 7 canais selecionados: Notícias Locais, Desfiles SS26, Street Style, Sustentabilidade, Influenciadores, Vintage e Cuidado com Roupas.'
    },
    'ru': {
        'trend_scout_title': 'Радар трендов (Trend Scout)',
        'trend_scout_p1': 'Опережайте тренды с нашим ежедневным модным радаром и персональными рекомендациями по стилю:',
        'trend_feed_title': 'Ежедневный модный радар (7 тематических каналов)',
        'trend_feed_desc': 'Исследуйте 📍 Местные новости, 👑 Подиум, 👟 Уличный стиль, 🌿 Экологичность, ✨ Инфлюенсеры, ♻️ Винтаж и архив, 🔧 Уход и ремонт.',
        'trend_closet_title': 'В 1 касание: "Стилизовать из гардероба"',
        'trend_closet_desc': 'Нажмите кнопку на любой карточке тренда, и AI-стилист подберет вещи нужных оттенков и силуэтов прямо из вашего цифрового гардероба.',
        'trend_personalization_title': 'Персонализация и соцсети (⚙️)',
        'trend_personalization_desc': 'Выбирайте эстетику стиля (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalist, Y2K), подключайте профили и смотрите авто-анализ гардероба.',
        'trend_gender_title': 'Переключение пола и обновление в реальном времени',
        'trend_gender_desc': 'Легко переключайтесь между женской и мужской модой, читайте статьи в Vogue/GQ и нажимайте Обновить (🔄) для свежих сводок.',
        'trend_buckets_title': 'Каналы трендов',
        'trend_buckets_desc': 'Исследуйте 7 каналов: Местные новости, Подиум SS26, Уличная мода, Экологичность, Инфлюенсеры, Винтаж и Уход за одеждой.'
    },
    'zh': {
        'trend_scout_title': '潮流侦探 (Trend Scout)',
        'trend_scout_p1': '通过我们每日精选的全球时尚雷达与个性化穿搭建议，始终走在潮流前沿：',
        'trend_feed_title': '每日时尚雷达（7大精选频道）',
        'trend_feed_desc': '探索 📍 本地资讯、👑 秀场精选、👟 街头潮流、🌿 环保时尚、✨ 顶流红人、♻️ 古着档案与 🔧 衣服养护。',
        'trend_closet_title': '一键直达：“用我的衣橱搭同款”',
        'trend_closet_desc': '点击任意趋势卡片上的按钮，AI 造型师立即提取该趋势的色彩与轮廓，从您已录入的衣橱中寻找最匹配的服饰重现搭配。',
        'trend_personalization_title': '个性化与社交平台偏好设置 (⚙️)',
        'trend_personalization_desc': '自选风格美学（老钱风、静奢风、街头风、复古、极简、Y2K等），关联社交账号，查看系统自动生成的衣橱风格档案。',
        'trend_gender_title': '性别精准定位与实时刷新',
        'trend_gender_desc': '一键轻松切换女士与男士时尚板块，阅读 Vogue/GQ 正版权威报道，点击刷新按钮（🔄）即刻获取最新潮流情报。',
        'trend_buckets_title': '趋势精选频道',
        'trend_buckets_desc': '探索7大精选频道：本地资讯、SS26 秀场、街头穿搭、环保可持续、时尚红人、古着档案和衣物养护。'
    }
}

base_dir = r"c:\DressApp_AG"

# 1. Update packages/i18n/locales/{lang}.json
for lang in locales:
    pkg_path = os.path.join(base_dir, "packages", "i18n", "locales", f"{lang}.json")
    if os.path.exists(pkg_path):
        with open(pkg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "help" not in data:
            data["help"] = {}
        for k, v in translations[lang].items():
            data["help"][k] = v
        with open(pkg_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"Updated {pkg_path}")

# 2. Update apps/web/src/locales/{lang}.json
for lang in locales:
    web_path = os.path.join(base_dir, "apps", "web", "src", "locales", f"{lang}.json")
    if os.path.exists(web_path):
        with open(web_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "help" not in data:
            data["help"] = {}
        for k, v in translations[lang].items():
            data["help"][k] = v
        with open(web_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"Updated {web_path}")

# 3. Update apps/web/public/locales/help_{lang}.json
for lang in locales:
    pub_path = os.path.join(base_dir, "apps", "web", "public", "locales", f"help_{lang}.json")
    if os.path.exists(pub_path):
        with open(pub_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "sections" not in data:
            data["sections"] = {}
        for k, v in translations[lang].items():
            data["sections"][k] = v
        with open(pub_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"Updated {pub_path}")

print("ALL JSON LOCALES UPDATED SUCCESSFULLY!")

he_wiki = """# סייר הטרנדים והשראה אישית (Trend Scout)

גלו טרנדים עולמיים יומיים, רדאר סגנון מקומי, ושחזרו מראות אופנתיים עדכניים באופן מיידי בעזרת בגדים שכבר קיימים בארון שלכם.

---

## 1. סקירה כללית
סייר הטרנדים (Trend Scout) הוא רדאר המודיעין האופנתי היומי שלכם בתוך DressApp. מדי בוקר הוא אוסף דיווחי אופנה חדשותיים, ביקורות מתצוגות מסלול, פיתוחי טקסטיל בני-קיימא ותנועות אופנת רחוב ממגזיני האופנה המובילים והמהימנים בעולם.

התוכן מאורגן ב-**7 ערוצים נבחרים**, וסייר הטרנדים מתאים אישית את סיפורי האופנה לפרופיל הדמוגרפי ולמיקום הגאוגרפי שלכם. בעזרת תכונת החתימה בלחיצה אחת **"עצב עם הארון שלי"**, הסטייליסט החכם (AI Stylist) מנתח את מאפייני האסתטיקה של כל טרנד (פלטת צבעים, גזרה, מרקמי בדים) ומציג בגדים תואמים שכבר תלויים בארון הדיגיטלי שלכם—כך שתוכלו ללבוש את הטרנדים החמים ביותר כבר היום מבלי לקנות שום בגד חדש!

---

## 2. דרישות מוקדמות
כדי להפיק את המרב מסייר הטרנדים, ודאו שברשותכם:
- **מנוי פעיל**: סייר הטרנדים זמין במסלולי **Manager** ($4.99 לחודש) ו-**Professional** ($9.99 לחודש). משתמשים במסלול החינמי יכולים לצפות בתצוגה מקדימה ולשדרג בכל עת.
- **פריטים בארון הדיגיטלי**: לפחות 5 עד 10 בגדים סרוקים בארון שלכם, כדי שהסטייליסט יוכל להציע הצעות לבוש מדויקות ומגוונות.
- **הרשאת מיקום**: מאפשרת לסייר הטרנדים להתאים חדשות מקומיות, בוטיקים אזוריים ואירועי אופנה לעיר ולמדינה שלכם.
- **הגדרות פרופיל**: הגדרת המגדר, סגנון החיים וההעדפות האסתטיות מבטיחה שהפיד יתעדף מראות התואמים במדויק את טעמכם האישי.

---

## 3. הוראות שלב אחר שלב

### שלב 1: פתיחת סייר הטרנדים
1. מתפריט הניווט הראשי, לחצו על **Trend Scout** (חפשו את סמל הטרנדים 📈 בתפריט או בסרגל הצד של הסטייליסט).
2. העמוד ייפתח עם פיד ה-Daily Edit המותאם אישית למדינת המגורים שלכם.

### שלב 2: גלישה ב-7 הערוצים הנבחרים
סננו כתבות בלחיצה על לשוניות הקטגוריה בראש הפיד:
- 📍 **חדשות מקומיות (Local News)**: אירועי אופנה אזוריים, השקות של מעצבים מקומיים וחדשות בוטיקים באזורכם.
- 👑 **מסלול (Runway)**: סקירות אופנה עילית (Haute Couture), תצוגות עונתיות וטרנדים של מעצבים בולטים.
- 👟 **אופנת רחוב (Street Style)**: לבוש עירוני יומיומי, תרבות סניקרס ושילובי קז'ואל מודרניים.
- 🌿 **קיימות (Sustainability)**: אופנה אקולוגית, טקסטיל מעגלי, יוזמות אפס פסולת וטיפול מודע בבגדים.
- ✨ **משפיענים ואייקונים (Influencers & Icons)**: מגמות סטיילינג ויראליות, שטיחים אדומים ואסתטיקות בהובלת יוצרי תוכן.
- ♻️ **וינטג' וארכיון (Vintage / Archival)**: תרבות יד שנייה (Thrift), גזרות רטרו, דנים קלאסי ואופנת ארכיון על-זמנית.
- 🔧 **טיפול ותיקונים (Care & Repairs)**: מדריכים מעשיים לשמירה על אורך חיי הבגד, טיפול בבדים עדינים, תיקונים וחידוש נעליים.

### שלב 3: מעבר בין אופנת נשים לגברים
- החליפו בקלות בין **אופנת נשים** ל**אופנת גברים** בכל רגע באמצעות בורר הכפתורים בראש המסך.
- הפיד יסנן את הכתבות ויחשב מחדש את ההמלצות לפי הבחירה שלכם.

### שלב 4: עיצוב בלחיצה אחת: "עצב עם הארון שלי"
1. כאשר ראיתם טרנד שאהבתם, הביטו בכרטיס הטרנד.
2. לחצו על כפתור **"עצב עם הארון שלי"**.
3. הסטייליסט החכם ייפתח מיד עם הפרמטרים האסתטיים של הטרנד ויציג בגדים מהארון שלכם שמשחזרים את המראה במדויק.
4. צפו במראה המורכב על גבי דמות האוואטר הדו-ממדית שלכם ושמרו אותו ביומן התלבושות שלכם!

### שלב 5: התאמה אישית ורשתות חברתיות (הגדרות ⚙️)
1. לחצו על סמל ה**הגדרות (גלגל שיניים ⚙️)** בראש סייר הטרנדים.
2. **אסתטיקות סגנון**: בחרו מתוך 10 תגיות סגנון מובנות (כמו *Quiet Luxury*, *Vintage*, *Minimalist*, *Streetwear*, *Old Money*, *Boho & Casual*, *Cyberpunk*, *Y2K*, *Classic Business*, או *Athleisure*), או הקלידו סגנון אישי משלכם.
3. **פלטפורמות מקושרות**: חברו את חשבונות המדיה החברתית שלכם (אינסטגרם, פינטרסט, טיקטוק, פייסבוק, ת'רדס או X) כדי ש-DressApp תתאים את הפיד לתחומי העניין הרחבים שלכם.
4. **פרופיל ארון**: סקרו את פרופיל הצבעים והגזרות של הארון שלכם המחושב אוטומטית על ידי DressApp.
5. לחצו על **שמור ורענן פיד** כדי לעדכן מיד את כרטיסי הטרנדים שלכם.

### שלב 6: קריאת כתבות מקור מלאות ורענון חי
- לחצו על **"קרא במגזין [שם הפרסום]"** על כל כרטיס כדי לפתוח את הכתבה המקורית במגזינים כמו Vogue, GQ, Elle, או Hypebeast.
- רוצים את העדכונים הכי טריים עכשיו? לחצו על כפתור ה**רענון (🔄)** בראש העמוד להרצת סריקת רדאר חיה ומיידית.

---

## 4. תוצאות צפויות
- פיד עיתונאי יפהפה ברמת מגזין עם תמונות ברזולוציה גבוהה, תגיות קטגוריה, מחווני מגדר ותאריכים.
- כרטיסי טרנד מותאמים במדויק לטעמכם האישי ולאזור הגאוגרפי שלכם.
- הצעות לבוש מיידיות המדגימות כיצד ללבוש את הטרנדים האחרונים בעזרת הבגדים שכבר ברשותכם.

---

## 5. פתרון בעיות

### מופיעה הודעה: "סייר הטרנדים זמין בתוכנית Premium"
- **סיבה**: החשבון שלכם נמצא כרגע במסלול החינמי (Free).
- **פתרון**: לחצו על **שדרוג תוכנית** כדי להירשם למסלול Manager ($4.99 לחודש) או Professional ($9.99 לחודש).

### הכרטיסים אינם מציגים חדשות מהמדינה שלי
- **סיבה**: הרשאות המיקום כבויות או שכתובת המגורים בפרופיל אינה מוגדרת.
- **פתרון**: בדקו את הרשאות המיקום בדפדפן או באפליקציה, או הגדירו את מדינת המגורים שלכם תחת **פרופיל > הגדרות > שירותי מיקום**.

### מופיעות כתבות שאינן מתאימות לסגנון או למגדר המועדף עליי
- **סיבה**: בורר המגדר מוגדר למצב ההפוך, או שתגיות האסתטיקה ריקות.
- **פתרון**: שנו את מתג **נשים / גברים** בראש העמוד, או פתחו את **הגדרות ⚙️** ובחרו את אסתטיקות הסגנון המועדפות עליכם.

### הכרטיסים אינם מתעדכנים או מציגים תאריכים ישנים
- **סיבה**: בעיית חיבור לרשת או נתוני פיד שמורים בזיכרון מטמון.
- **פתרון**: לחצו על כפתור ה**רענון (🔄)** בראש העמוד (או משכו את המסך כלפי מטה לרענון בנייד) לקבלת נתונים חיים.

---

## 6. מגבלות
- **מיקוד מערכתי**: סייר הטרנדים מיועד להשראה וללמידה אופנתית בלבד. הוא מסנן באופן מכוון פרסומות קנייה אגרסיביות, חלונות קופצים שיווקיים ועגלות מסחר.
- **התאמה לארון**: הבינה המלאכותית יכולה לעצב טרנדים אך ורק בעזרת פריטים שסרקתם לארון. ככל שתסרקו יותר בגדים, כך הצעות הלבוש לטרנדים יהיו מגוונות ויצירתיות יותר!
- **מצב לא מקוון**: כרטיסים ומדריכים שנצפו בעבר נשמרים במטמון, אך סריקה חיה וקריאת כתבות מקור חיצוניות דורשות חיבור אינטרנט פעיל.
"""

ar_wiki = """# مستكشف الصيحات والإلهام الشخصي (Trend Scout)

اكتشف صيحات الموضة العالمية اليومية، ورادار الأناقة المحلي، وأعد ابتكار الإطلالات الرائجة فوراً باستخدام الملابس الموجودة بالفعل في خزانتك.

---

## 1. نظرة عامة
مستكشف الصيحات (Trend Scout) هو رادارك اليومي للذكاء والأناقة داخل DressApp. في كل صباح، يجمع أحدث تقارير الموضة العالمية، ومراجعات عروض الأزياء الكبرى، وابتكارات الأقمشة المستدامة، وحركات أزياء الشارع من أرقى المجلات العالمية الموثوقة.

الرادار منظم في **7 قنوات منسقة بعناية**، ويعمل مستكشف الصيحات على تخصيص القصص لتناسب ملفك الشخصي وموقعك الجغرافي. وبفضل الميزة الحصرية بنقرة واحدة **"تنسيق مع خزانتي"**، يقوم المنسق الذكي (AI Stylist) بتحليل السمات الجمالية لأي صيحة (لوحة الألوان، القصة، ملمس الأقمشة) ويبرز قطع الملابس المطابقة المعلقة بالفعل في خزانتك الرقمية—مما يتيح لك التألق بأحدث صيحات الموضة اليوم دون الحاجة لشراء أي شيء جديد!

---

## 2. المتطلبات الأساسية
لتحقيق أقصى استفادة من مستكشف الصيحات، تأكد من توفر ما يلي:
- **اشتراك نشط**: مستكشف الصيحات متاح في باقتي **Manager** (4.99 دولار/شهر) و**Professional** (9.99 دولار/شهر). يمكن لأصحاب الحسابات المجانية الاطلاع على معاينة والترقية في أي وقت.
- **ملابس مسجلة في الخزانة الرقمية**: وجود 5 إلى 10 قطع ملابس على الأقل في خزانتك الرقمية لتمكين المنسق الذكي من تقديم اقتراحات دقيقة ومبتكرة لإعادة ابتكار الإطلالات.
- **إذن الموقع الجغرافي**: يتيح لمستكشف الصيحات تقديم الأخبار المحلية، وإبراز متاجر البوتيك الإقليمية، وفعاليات الموضة في مدينتك وبلدك.
- **البيانات في الإعدادات**: تحديد تفضيلاتك الجمالية ونمط حياتك يضمن تخصيص الإطلالات بما يناسب ذوقك الرفيع.

---

## 3. تعليمات خطوة بخطوة

### الخطوة 1: فتح مستكشف الصيحات
1. من شريط التنقل الرئيسي، اضغط على **Trend Scout** (ابحث عن أيقونة المؤشر الصاعد 📈 في القائمة أو الشريط الجانبي للمنسق).
2. تفتح الصفحة مع موجز Daily Edit اليومي المخصص والمحدد جغرافياً لبلدك.

### الخطوة 2: استكشاف القنوات الـ 7 المنسقة
قم بتصفية المقالات بالنقر على علامات تبويب الفئات في أعلى الموجز:
- 📍 **الأخبار المحلية (Local News)**: فعاليات الموضة الإقليمية، وعروض المصممين المحليين، وأخبار البوتيكات في منطقتك.
- 👑 **منصات العرض (Runway)**: مراجعات الأزياء الراقية (Haute Couture)، وعروض المواسم، وصيحات كبار المصممين.
- 👟 **أزياء الشارع (Street Style)**: الإطلالات الحضرية اليومية، وثقافة الأحذية الرياضية، وتنسيقات الكاجوال العصرية.
- 🌿 **الاستدامة (Sustainability)**: الموضة الصديقة للبيئة، والمنسوجات الدائرية، ومبادرات تقليل الهدر، والعناية بالملابس.
- ✨ **المؤثرون والأيقونات (Influencers & Icons)**: تنسيقات المشاهير الفيروسية، وإطلالات السجادة الحمراء، والجماليات المستوحاة من صناع المحتوى.
- ♻️ **الفينتاج والأرشيف (Vintage / Archival)**: ثقافة متاجر السلع المستعملة، والجينز الكلاسيكي، وتنسيقات الأرشيف الخالدة.
- 🔧 **العناية والإصلاح (Care & Repairs)**: أدلة عملية لإطالة عمر الملابس، والعناية بالأقمشة الحساسة، والإصلاح وتجديد الأحذية.

### الخطوة 3: التبديل بين الأزياء النسائية والرجالية
- تنقل بسهولة بين **أزياء النساء** و**أزياء الرجال** في أي وقت باستخدام زر التبديل في الشريط العلوي.
- يتم تحديث الموجز وتصفية المقالات وإعادة حساب التوصيات فوراً وفقاً لاختيارك.

### الخطوة 4: بنقرة واحدة: "تنسيق مع خزانتي"
1. عندما تجد صيحة تنال إعجابك، انظر إلى بطاقة الصيحة.
2. اضغط على زر **"تنسيق مع خزانتي"**.
3. يفتح المنسق الذكي فوراً مع المعايير الجمالية للصيحة ويعرض قطع الملابس من خزانتك التي تعيد ابتكار الإطلالة بدقة.
4. عاين الإطلالة الناتجة على مجسمك الرمزي ثنائي الأبعاد (Avatar) واحفظها في سجل خزانتك!

### الخطوة 5: التخصيص وموجزات التواصل (الإعدادات ⚙️)
1. اضغط على **الإعدادات (أيقونة الترس ⚙️)** في أعلى شاشة مستكشف الصيحات.
2. **جماليات الأسلوب**: اختر من بين 10 وسوم أسلوب مختارة (مثل *Quiet Luxury*، *Vintage*، *Minimalist*، *Streetwear*، *Old Money*، *Boho & Casual*، *Cyberpunk*، *Y2K*، *Classic Business*، أو *Athleisure*)، أو اكتب أسلوبك الخاص.
3. **المنصات المرتبطة**: اربط حساباتك على وسائل التواصل (Instagram، Pinterest، TikTok، Facebook، Threads، أو X) ليتوافق التطبيق مع اهتماماتك.
4. **ملف الخزانة الشخصي**: استعرض توزيع الألوان والقصات في خزانتك المحسوب تلقائياً بواسطة التطبيق.
5. اضغط على **حفظ وتحديث الموجز** لإعادة توجيه بطاقات الصيحات فوراً.

### الخطوة 6: قراءة المقالات الأصلية والتحديث المباشر
- اضغط على **"قراءة في [اسم المجلة]"** على أي بطاقة لفتح المقال الأصلي مباشرة في مجلات مثل Vogue، GQ، Elle، أو Hypebeast.
- هل تريد أحدث الأخبار العاجلة الآن؟ اضغط على زر **التحديث (🔄)** في الأعلى لتشغيل مسح راداري مباشر وفوري.

---

## 4. النتائج المتوقعة
- موجز تحريري رائع بجودة المجلات مع صور عالية الدقة، وشارات الفئات، ومؤشرات النوع، والطوابع الزمنية.
- بطاقات صيحات متوافقة بدقة مع ذوقك الشخصي ومحيطك الجغرافي.
- اقتراحات فورية من خزانتك توضح كيف ترتدي أحدث صيحات الموضة بالملابس التي تمتلكها بالفعل.

---

## 5. استكشاف الأخطاء وإصلاحها

### يظهر إشعار: "مستكشف الصيحات ميزة بريميوم"
- **السبب**: حسابك حالياً في الباقة المجانية.
- **الحل**: اضغط على **ترقية الباقة** للاشتراك في باقة Manager (4.99 دولار/شهر) أو Professional (9.99 دولار/شهر).

### البطاقات لا تعرض أخبار بلدي المحلي
- **السبب**: أذونات الموقع الجغرافي معطلة أو لم يتم تحديد الدولة في ملفك.
- **الحل**: تحقق من أذونات الموقع في المتصفح أو الهاتف، أو حدد دولتك من **الملف الشخصي > الإعدادات > خدمات الموقع**.

### تظهر مقالات لا تناسب أسلوبي المفضل أو نوعي
- **السبب**: مفتاح التبديل محدد على الفئة الأخرى، أو أن وسوم الأسلوب فارغة.
- **الحل**: اضغط على مفتاح **النساء / الرجال** في الأعلى، أو افتح **الإعدادات ⚙️** واختر جمالياتك المفضلة.

### البطاقات لا تتحدث أو تعرض تواريخ قديمة
- **السبب**: مشكلة في الاتصال بالإنترنت أو تخزين مؤقت للبيانات.
- **الحل**: اضغط على زر **التحديث (🔄)** في الأعلى (أو اسحب الشاشة للأسفل في الهاتف) لجلب أحدث البيانات.

---

## 6. القيود
- **التركيز التحريري**: صُمم مستكشف الصيحات للإلهام الثقافي والتعليمي النقي في عالم الأناقة، ويستبعد عمداً الإعلانات التجارية المزعجة.
- **مطابقة الخزانة**: يستطيع الذكاء الاصطناعي تنسيق الملابس التي قمت برقمنتها فقط. كلما أضفت ملابس أكثر، كانت الاقتراحات أكثر ثراءً وإبداعاً!
- **الوضع غير المتصل**: تتوفر البطاقات المفتوحة سابقاً دون اتصال، لكن التحديث المباشر وقراءة الروابط الخارجية يتطلبان اتصالاً نشطاً بالإنترنت.
"""

de_wiki = """# Trend Scout & Persönliche Inspiration

Entdecken Sie tägliche globale Modetrends, lokales Stilradar und kreieren Sie Trend-Looks sofort mit Kleidung aus Ihrem eigenen Kleiderschrank nach.

---

## 1. Übersicht
Trend Scout ist Ihr tägliches Fashion-Intelligence-Radar in DressApp. Jeden Morgen bündelt es aktuelle Modeberichte, Runway-Analysen, nachhaltige Textilinnovationen und Street-Style-Trends aus weltweit führenden Modemagazinen.

Organisiert in **7 kuratierten Kanälen**, personalisiert Trend Scout Style-Stories passend zu Ihrem Profil und Standort. Mit der exklusiven 1-Klick-Funktion **"Mit meinem Kleiderschrank stylen"** analysiert unser KI-Stylist die Ästhetik jedes Trends (Farbpalette, Schnitt, Texturen) und hebt passende Kleidungsstücke hervor, die bereits in Ihrem digitalen Kleiderschrank hängen – so tragen Sie High-Fashion-Trends heute, ohne Neues zu kaufen!

---

## 2. Voraussetzungen
Um Trend Scout optimal zu nutzen:
- **Aktives Abonnement**: Verfügbar in den Plänen **Manager** (4,99 $/Monat) und **Professional** (9,99 $/Monat). Kostenlose Konten können eine Vorschau ansehen und jederzeit upgraden.
- **Digitalisierte Kleidungsstücke**: Mindestens 5 bis 10 Kleidungsstücke in Ihrer digitalen Garderobe für präzise Outfit-Vorschläge.
- **Standortfreigabe**: Ermöglicht Trend Scout, lokale Fashion-News, regionale Boutiquen und Events für Ihre Stadt und Ihr Land bereitzustellen.
- **Profil-Einstellungen**: Die Angabe Ihres Stils und Ihrer ästhetischen Vorlieben stellt sicher, dass der Feed Looks nach Ihrem Geschmack priorisiert.

---

## 3. Schritt-für-Schritt-Anleitung

### Schritt 1: Trend Scout öffnen
1. Klicken oder tippen Sie in der Hauptnavigation auf **Trend Scout** (Trending-Symbol 📈 im Menü oder in der Stylist-Seitenleiste).
2. Die Seite öffnet sich mit Ihrem personalisierten Daily Edit Feed für Ihr Land.

### Schritt 2: Die 7 kuratierten Kanäle durchstöbern
Filtern Sie Artikel über die Kategorie-Reiter oben im Feed:
- 📍 **Lokale News (Local News)**: Regionale Mode-Events, Designer-Debüts und lokale Boutique-News.
- 👑 **Laufsteg (Runway)**: Haute-Couture-Kritiken, saisonale Schauen und Trends renommierter Designer.
- 👟 **Street Style**: Alltägliche Urban Wear, Sneaker-Kultur und zeitgemäße Casual-Ensembles.
- 🌿 **Nachhaltigkeit (Sustainability)**: Umweltfreundliche Mode, Kreislauftextilien, Zero-Waste-Initiativen und bewusste Textilpflege.
- ✨ **Influencer & Ikonen (Influencers & Icons)**: Virale Social-Media-Styles, Red-Carpet-Highlights und Creator-Trends.
- ♻️ **Vintage & Archiv (Vintage / Archival)**: Secondhand-Kultur, Retro-Denim und zeitlose Archivmode.
- 🔧 **Pflege & Reparatur (Care & Repairs)**: Praktische Tipps für Langlebigkeit, Feinwäsche, Ausbessern und Schuhpflege.

### Schritt 3: Damen- und Herrenmode wechseln
- Wechseln Sie jederzeit über den Wahlschalter im Header zwischen **Damenmode** und **Herrenmode**.
- Der Feed passt Artikel und Empfehlungen sofort dynamisch an.

### Schritt 4: 1-Klick "Mit meinem Kleiderschrank stylen"
1. Wenn Ihnen ein Trend gefällt, sehen Sie sich die Trendkarte an.
2. Klicken Sie auf die Schaltfläche **"Mit meinem Kleiderschrank stylen"**.
3. Der KI-Stylist öffnet sich direkt mit den Parametern des Trends und zeigt Stücke aus Ihrem Schrank, die den Look nachbilden.
4. Betrachten Sie das Outfit auf Ihrem 2D-Avatar und speichern Sie es im Tagebuch!

### Schritt 5: Personalisierung & Social Feeds anpassen (⚙️ Einstellungen)
1. Klicken Sie auf das **Zahnrad-Symbol (⚙️)** im Header.
2. **Stil-Ästhetiken**: Wählen Sie aus 10 kuratierten Tags (*Quiet Luxury*, *Vintage*, *Minimalist*, *Streetwear*, *Old Money*, *Boho & Casual*, *Cyberpunk*, *Y2K*, *Classic Business*, *Athleisure*) oder geben Sie eigene Stile ein.
3. **Verknüpfte Plattformen**: Verbinden Sie soziale Kanäle (Instagram, Pinterest, TikTok, Facebook, Threads oder X).
4. **Kleiderschrank-Profil**: Prüfen Sie Ihr automatisch berechnetes Farb- und Silhouettenprofil.
5. Tippen Sie auf **Speichern & Feed aktualisieren**.

### Schritt 6: Vollständige Artikel lesen & Live-Aktualisierung
- Tippen Sie auf **"Lesen auf [Magazin]"**, um den Originalartikel direkt bei Vogue, GQ, Elle oder Hypebeast zu öffnen.
- Brauchen Sie brandaktuelle Neuigkeiten? Tippen Sie auf den **Aktualisieren-Button (🔄)** für einen Live-Radar-Scan.

---

## 4. Erwartete Ergebnisse
- Ein magazinartiger Feed mit hochauflösenden Bildern, Kategorie-Badges und Datumsangaben.
- Exakt auf Ihren Geschmack und Standort abgestimmte Trendkarten.
- Sofortige Outfitvorschläge mit Kleidungsstücken, die Sie bereits besitzen.

---

## 5. Fehlerbehebung

### Meldung: "Trend Scout ist ein Premium-Feature"
- **Ursache**: Ihr Konto nutzt den kostenlosen Plan.
- **Lösung**: Tippen Sie auf **Plan upgraden** für den Manager- oder Professional-Plan.

### Keine lokalen Nachrichten aus meinem Land
- **Ursache**: Standortfreigabe deaktiviert oder Heimatland nicht eingetragen.
- **Lösung**: Überprüfen Sie die Berechtigungen oder stellen Sie Ihr Land unter **Profil > Einstellungen > Standortdienste** ein.

### Artikel passen nicht zu meinem Stil oder Geschlecht
- **Ursache**: Schalter auf falsches Geschlecht eingestellt oder Stil-Tags leer.
- **Lösung**: Ändern Sie den Schalter im Header oder wählen Sie Ästhetiken in den **Einstellungen ⚙️**.

### Karten aktualisieren nicht
- **Ursache**: Verbindungsprobleme oder Cache.
- **Lösung**: Tippen Sie auf **Aktualisieren (🔄)** im Header oder wischen Sie auf dem Smartphone nach unten.

---

## 6. Einschränkungen
- **Redaktioneller Fokus**: Trend Scout dient reiner Inspiration und filtert aggressive Shopping-Werbung heraus.
- **Schrankabgleich**: Es können nur digitalisierte Kleidungsstücke berücksichtigt werden.
- **Offline-Modus**: Gespeicherte Karten sind offline lesbar, Live-Suchen erfordern eine Internetverbindung.
"""

es_wiki = """# Explorador de Tendencias e Inspiración Personal (Trend Scout)

Descubre las tendencias globales diarias, el radar de estilo local y recrea looks de pasarela al instante con la ropa de tu propio armario.

---

## 1. Visión General
Trend Scout es tu radar diario de inteligencia de moda dentro de DressApp. Cada mañana recopila noticias de moda, análisis de pasarela, innovaciones textiles sostenibles y movimientos de estilo urbano de prestigiosas publicaciones internacionales.

Organizado en **7 canales temáticos**, Trend Scout personaliza las historias según tu perfil y ubicación. Con la función exclusiva de 1 toque **"Combinar con mi Armario"**, nuestro Estilista IA analiza la estética de cualquier tendencia (paleta de colores, silueta, texturas) y resalta prendas similares que ya cuelgan en tu armario digital, ¡permitiéndote lucir lo último en moda hoy mismo sin gastar nada!

---

## 2. Requisitos Previos
Para aprovechar al máximo Trend Scout, asegúrate de contar con:
- **Un Plan Activo**: Disponible en los planes **Manager** ($4.99/mes) y **Professional** ($9.99/mes). Las cuentas gratuitas pueden ver una vista previa y actualizar en cualquier momento.
- **Prendas Digitalizadas**: Al menos 5 a 10 prendas en tu armario digital para que el Estilista IA proponga combinaciones precisas.
- **Acceso a Ubicación**: Permite mostrar noticias locales, diseñadores de tu región y eventos de moda en tu ciudad y país.
- **Preferencias en Perfil**: Especificar tus gustos estéticos y estilo de vida asegura que el radar priorice looks afines a ti.

---

## 3. Instrucciones Paso a Paso

### Paso 1: Abrir Trend Scout
1. En el menú principal, haz clic o pulsa en **Trend Scout** (busca el icono de tendencia 📈 en el menú o barra de Estilista).
2. Se cargará tu feed Daily Edit personalizado para tu país.

### Paso 2: Explorar los 7 Canales Temáticos
Filtra las publicaciones con las pestañas superiores:
- 📍 **Noticias Locales (Local News)**: Eventos de moda regionales, debut de diseñadores y tiendas boutique en tu zona.
- 👑 **Pasarela (Runway)**: Reseñas de alta costura, desfiles de temporada y tendencias de diseñadores internacionales.
- 👟 **Estilo Callejero (Street Style)**: Moda urbana diaria, cultura sneaker y conjuntos casuales contemporáneos.
- 🌿 **Sostenibilidad (Sustainability)**: Moda ecológica, textiles circulares, iniciativas de cero residuos y cuidado consciente.
- ✨ **Creadores e Iconos (Influencers & Icons)**: Looks virales en redes, alfombras rojas y estéticas destacadas.
- ♻️ **Vintage y Archivo (Vintage / Archival)**: Cultura de segunda mano, denim clásico y moda retro atemporal.
- 🔧 **Cuidado y Arreglos (Care & Repairs)**: Guías prácticas para extender la vida útil de tus prendas y restauración de calzado.

### Paso 3: Alternar entre Moda Femenina y Masculina
- Cambia fácilmente entre **Moda Femenina** y **Moda Masculina** usando el selector en el encabezado.
- El feed filtrará al instante los artículos y recomendaciones según tu elección.

### Paso 4: 1 Toque: "Combinar con mi Armario"
1. Cuando encuentres una tendencia que te encante, mira su tarjeta.
2. Pulsa en **"Combinar con mi Armario"**.
3. El Estilista IA se abrirá con los parámetros de la tendencia y mostrará prendas de tu armario que replican el look.
4. ¡Prueba el outfit en tu avatar 2D y guárdalo en tu Diario de Estilo!

### Paso 5: Personalización y Redes Sociales (⚙️ Ajustes)
1. Pulsa el icono de **Ajustes (engranaje ⚙️)** en el encabezado.
2. **Estéticas de Estilo**: Elige entre 10 etiquetas (*Quiet Luxury*, *Vintage*, *Minimalist*, *Streetwear*, *Old Money*, *Boho & Casual*, *Cyberpunk*, *Y2K*, *Classic Business*, *Athleisure*) o escribe las tuyas.
3. **Plataformas Conectadas**: Vincula tus cuentas de Instagram, Pinterest, TikTok, Facebook, Threads o X.
4. **Perfil del Armario**: Consulta el análisis automático de colores y cortes de tu ropa.
5. Pulsa **Guardar y Actualizar Feed**.

### Paso 6: Leer Artículos Completos y Actualización en Vivo
- Toca **"Leer en [Publicación]"** para ver la noticia original en Vogue, GQ, Elle o Hypebeast.
- ¿Quieres las noticias de último minuto? Pulsa el botón **Actualizar (🔄)** para un escaneo en vivo.

---

## 4. Resultados Esperados
- Un feed editorial de calidad de revista con imágenes en alta resolución, etiquetas de categoría y fechas.
- Tarjetas de tendencias ajustadas a tu estilo personal y entorno geográfico.
- Sugerencias inmediatas para vestir las tendencias actuales usando la ropa que ya tienes.

---

## 5. Solución de Problemas

### Dice "Trend Scout es Premium"
- **Causa**: Tu cuenta está en el plan Gratuito.
- **Solución**: Pulsa **Mejorar Plan** para suscribirte a Manager ($4.99/mes) o Professional ($9.99/mes).

### No veo noticias de mi país
- **Causa**: Permisos de ubicación desactivados o país no configurado.
- **Solución**: Activa los permisos de ubicación o define tu país en **Perfil > Ajustes > Ubicación**.

### Artículos no coinciden con mi género o estilo
- **Causa**: Selector en la categoría opuesta o etiquetas estéticas vacías.
- **Solución**: Cambia el selector Femenino/Masculino o elige estilos en **Ajustes ⚙️**.

### Las tarjetas no se actualizan
- **Causa**: Conexión a internet inestable o caché local.
- **Solución**: Pulsa el botón **Actualizar (🔄)** o desliza hacia abajo en el móvil.

---

## 6. Limitaciones
- **Enfoque Editorial**: Diseñado puramente para inspiración y aprendizaje de moda, filtrando anuncios agresivos.
- **Prendas del Armario**: Solo se pueden combinar prendas previamente digitalizadas en tu armario.
- **Modo sin Conexión**: Las tarjetas guardadas se pueden leer sin conexión, pero la actualización requiere internet.
"""

fr_wiki = """# Éclaireur de Tendances et Inspiration Personnelle (Trend Scout)

Découvrez les tendances mondiales quotidiennes, le radar de style local et recréez les looks phares instantanément avec les vêtements de votre propre garde-robe.

---

## 1. Vue d'ensemble
Trend Scout est votre radar quotidien d'intelligence mode dans DressApp. Chaque matin, il rassemble les derniers rapports de mode, les comptes-rendus de défilés, les innovations textiles durables et les tendances streetwear des publications les plus prestigieuses au monde.

Organisé en **7 canaux thématiques**, Trend Scout personnalise les actualités en fonction de votre profil et de votre localisation. Grâce à la fonctionnalité signature en 1 clic **"Créer avec ma Garde-robe"**, notre Styliste IA analyse les caractéristiques esthétiques de chaque tendance (palette de couleurs, silhouette, textures) et met en avant les vêtements correspondants déjà présents dans votre dressing numérique—vous permettant de porter les tendances du moment sans rien acheter de nouveau !

---

## 2. Prérequis
Pour profiter pleinement de Trend Scout, assurez-vous de disposer de :
- **Un abonnement actif** : Disponible avec les forfaits **Manager** (4,99 $/mois) et **Professional** (9,99 $/mois). Les comptes gratuits peuvent consulter un aperçu et mettre à niveau leur formule à tout moment.
- **Des vêtements numérisés** : Au moins 5 à 10 vêtements dans votre dressing numérique pour que le Styliste IA vous propose des tenues pertinentes.
- **Accès à la géolocalisation** : Permet à Trend Scout d'adapter les actualités régionales, les créateurs locaux et les événements mode à votre ville et votre pays.
- **Paramètres du profil** : Renseigner vos préférences esthétiques et votre style de vie garantit un fil d'actualités aligné sur vos goûts.

---

## 3. Instructions Étape par Étape

### Étape 1 : Ouvrir Trend Scout
1. Depuis la navigation principale, cliquez ou appuyez sur **Trend Scout** (icône de tendance 📈 dans le menu ou la barre Styliste).
2. La page s'ouvre sur votre flux Daily Edit personnalisé ancré dans votre pays.

### Étape 2 : Parcourir les 7 Canaux Thématiques
Filtrez les articles à l'aide des onglets situés en haut du flux :
- 📍 **Actualités Locales (Local News)** : Événements régionaux, lancements de créateurs locaux et boutiques de votre région.
- 👑 **Défilés (Runway)** : Analyses Haute Couture, défilés saisonniers et tendances des grands créateurs.
- 👟 **Street Style** : Mode urbaine du quotidien, culture sneakers et looks décontractés modernes.
- 🌿 **Éco-responsabilité (Sustainability)** : Mode circulaire, textiles écologiques, zéro déchet et entretien responsable.
- ✨ **Influenceurs & Icônes (Influencers & Icons)** : Tendances virales des réseaux, tapis rouges et looks de créateurs de contenu.
- ♻️ **Vintage & Archives (Vintage / Archival)** : Friperies, denim rétro et pièces d'archives intemporelles.
- 🔧 **Entretien & Réparations (Care & Repairs)** : Guides pratiques pour prolonger la vie de vos vêtements et restaurer vos souliers.

### Étape 3 : Basculer entre Mode Femme et Mode Homme
- Alternez facilement entre **Mode Femme** et **Mode Homme** à tout moment grâce au sélecteur en en-tête.
- Le flux filtre dynamiquement les articles et recalcule les propositions selon votre choix.

### Étape 4 : En 1 Clic : "Créer avec ma Garde-robe"
1. Lorsqu'une tendance vous séduit, observez sa carte.
2. Cliquez sur le bouton **"Créer avec ma Garde-robe"**.
3. Le Styliste IA s'ouvre instantanément avec les paramètres de la tendance et sélectionne dans votre dressing les pièces idéales.
4. Prévisualisez la tenue sur votre avatar 2D et enregistrez-la dans votre Journal de Style !

### Étape 5 : Personnalisation et Réseaux Sociaux (⚙️ Paramètres)
1. Cliquez sur l'icône des **Paramètres (engrenage ⚙️)** dans l'en-tête de Trend Scout.
2. **Esthétiques de style** : Choisissez parmi 10 étiquettes (*Quiet Luxury*, *Vintage*, *Minimalist*, *Streetwear*, *Old Money*, *Boho & Casual*, *Cyberpunk*, *Y2K*, *Classic Business*, *Athleisure*) ou ajoutez votre propre style.
3. **Plateformes connectées** : Liez vos comptes Instagram, Pinterest, TikTok, Facebook, Threads ou X.
4. **Profil du dressing** : Consultez l'analyse automatique des couleurs et des coupes de votre garde-robe.
5. Cliquez sur **Enregistrer et actualiser**.

### Étape 6 : Lire les Articles Complets et Actualisation en Direct
- Appuyez sur **"Lire sur [Publication]"** pour consulter l'article d'origine sur Vogue, GQ, Elle ou Hypebeast.
- Besoin des toutes dernières actualités ? Cliquez sur le bouton **Actualiser (🔄)** pour lancer une recherche en direct.

---

## 4. Résultats Attendus
- Un fil éditorial digne d'un magazine avec des visuels haute définition, des badges thématiques et des dates de publication.
- Des cartes de tendances en parfaite harmonie avec vos goûts et votre région.
- Des propositions immédiates pour porter les tendances avec vos propres vêtements.

---

## 5. Dépannage

### Message : "Trend Scout est réservé aux membres Premium"
- **Cause** : Votre compte utilise actuellement l'offre gratuite.
- **Solution** : Appuyez sur **Changer de forfait** pour souscrire au plan Manager (4,99 $/mois) ou Professional (9,99 $/mois).

### Les actualités locales ne correspondent pas à mon pays
- **Cause** : La géolocalisation est désactivée ou le pays n'est pas renseigné dans votre profil.
- **Solution** : Vérifiez les autorisations de localisation ou indiquez votre pays dans **Profil > Paramètres > Géolocalisation**.

### Les articles ne correspondent pas à mon style ou mon genre
- **Cause** : Le bouton est positionné sur le genre opposé ou vos étiquettes de style sont vides.
- **Solution** : Changez le sélecteur Femme/Homme en haut ou configurez vos préférences dans **Paramètres ⚙️**.

### Les cartes ne s'actualisent pas
- **Cause** : Problème de connexion ou données en cache.
- **Solution** : Cliquez sur **Actualiser (🔄)** ou glissez vers le bas sur mobile.

---

## 6. Limites
- **Ligne Éditoriale** : Dédié à l'inspiration et à la culture mode, Trend Scout filtre rigoureusement les publicités d'achat agressives.
- **Compatibilité Garde-robe** : Le Styliste IA ne peut composer qu'avec les pièces déjà numérisées dans votre dressing.
- **Mode Hors-ligne** : Les cartes déjà consultées restent accessibles, mais la mise à jour en direct requiert une connexion internet.
"""

wiki_map = {
    'ar': ar_wiki,
    'de': de_wiki,
    'es': es_wiki,
    'fr': fr_wiki
}

hi_wiki = """# ट्रेंड स्काउट और व्यक्तिगत प्रेरणा (Trend Scout)

दैनिक वैश्विक फैशन रुझानों, स्थानीय स्टाइल रडार का अन्वेषण करें, और अपनी खुद की अलमारी के कपड़ों का उपयोग करके ट्रेंडिंग लुक्स तुरंत पुनः बनाएं।

---

## 1. अवलोकन
ट्रेंड स्काउट (Trend Scout) DressApp के भीतर आपका दैनिक फैशन इंटेलिजेंस रडार है। हर सुबह, यह दुनिया भर के प्रतिष्ठित फैशन पत्रिकाओं से नवीनतम फैशन रिपोर्ट, रनवे समीक्षाएं, टिकाऊ वस्त्र नवाचार और स्ट्रीट स्टाइल रुझानों को एकत्रित करता है।

**7 विशेष चैनलों** में व्यवस्थित, ट्रेंड स्काउट आपकी प्रोफ़ाइल और स्थान के अनुसार स्टाइल कहानियों को अनुकूलित करता है। विशेष 1-टैप **"मेरी अलमारी से स्टाइल करें"** सुविधा के साथ, हमारा एआई स्टाइलिस्ट किसी भी ट्रेंड के सौंदर्य गुणों (रंग पैलेट, सिल्हूट, बनावट) को स्कैन करता है और आपकी डिजिटल अलमारी में पहले से मौजूद मिलते-जुलते कपड़ों को हाइलाइट करता है—जिससे आप बिना कुछ नया खरीदे आज ही हाई-फैशन ट्रेंड पहन सकते हैं!

---

## 2. पूर्वापेक्षाएँ
ट्रेंड स्काउट का अधिकतम लाभ उठाने के लिए:
- **सक्रिय योजना**: ट्रेंड स्काउट **Manager** ($4.99/माह) और **Professional** ($9.99/माह) योजनाओं पर उपलब्ध है। नि:शुल्क खाते पूर्वावलोकन देख सकते हैं और कभी भी अपग्रेड कर सकते हैं।
- **डिजिटल अलमारी के कपड़े**: आपकी डिजिटल अलमारी में कम से कम 5 से 10 वस्त्र होने चाहिए ताकि एआई स्टाइलिस्ट सटीक परिधान प्रस्ताव दे सके।
- **स्थान अनुमति**: ट्रेंड स्काउट को आपके शहर और देश के लिए स्थानीय फैशन समाचार, बुटीक और फैशन कार्यक्रम प्रदर्शित करने की अनुमति देता है।
- **प्रोफ़ाइल प्राथमिकताएं**: अपनी पसंद और जीवनशैली का चयन सुनिश्चित करता है कि फ़ीड आपकी व्यक्तिगत पसंद के अनुसार लुक्स को प्राथमिकता दे।

---

## 3. चरण-दर-चरण निर्देश

### चरण 1: ट्रेंड स्काउट खोलें
1. मुख्य नेविगेशन से, **Trend Scout** पर क्लिक या टैप करें (मेनू या स्टाइलिस्ट साइडबार में ट्रेंडिंग आइकन 📈 देखें)।
2. पृष्ठ आपके देश के लिए तैयार किए गए वैयक्तिकृत Daily Edit फ़ीड के साथ लोड होता है।

### चरण 2: 7 विशेष चैनलों को ब्राउज़ करें
फ़ीड के शीर्ष पर स्थित श्रेणी टैब का चयन करके लेखों को फ़िल्टर करें:
- 📍 **स्थानीय समाचार (Local News)**: क्षेत्रीय फैशन कार्यक्रम, घरेलू डिजाइनर डेब्यू और आपके क्षेत्र में स्थानीय बुटीक समाचार।
- 👑 **रनवे (Runway)**: हाउते कॉउचर समीक्षाएं, मौसमी शो और प्रमुख डिजाइनरों के रुझान।
- 👟 **स्ट्रीट स्टाइल (Street Style)**: रोज़मर्रा के शहरी पहनावे, स्नीकर संस्कृति और समकालीन कैज़ुअल पहनावे।
- 🌿 **स्थिरता (Sustainability)**: पर्यावरण-अनुकूल फैशन, चक्रीय वस्त्र, शून्य-अपशिष्ट पहल और जिम्मेदार कपड़ों की देखभाल।
- ✨ **इन्फ्लुएंसर्स और प्रतीक (Influencers & Icons)**: वायरल सोशल स्टाइलिंग ट्रेंड, रेड कार्पेट हाइलाइट्स और क्रिएटर-आधारित लुक्स।
- ♻️ **विंटेज और संग्रह (Vintage / Archival)**: पुरानी वस्तुओं की संस्कृति, रेट्रो डेनिम और कालातीत विंटेज फैशन।
- 🔧 **देखभाल और मरम्मत (Care & Repairs)**: कपड़ों के लंबे जीवन, नाजुक कपड़ों की देखभाल, सिलाई और जूतों की मरम्मत के व्यावहारिक सुझाव।

### चरण 3: महिला और पुरुष फैशन के बीच स्विच करें
- हेडर में दिए गए चयनकर्ता का उपयोग करके किसी भी समय **महिला फैशन** और **पुरुष फैशन** के बीच आसानी से स्विच करें।
- फ़ीड तुरंत लेखों को फ़िल्टर करता है और आपकी पसंद के अनुसार सुझावों की पुनर्गणना करता है।

### चरण 4: 1-टैप "मेरी अलमारी से स्टाइल करें"
1. जब आपको कोई पसंदीदा ट्रेंड दिखे, तो ट्रेंड कार्ड देखें।
2. **"मेरी अलमारी से स्टाइल करें"** बटन पर क्लिक करें।
3. एआई स्टाइलिस्ट तुरंत ट्रेंड के मापदंडों के साथ खुलता है और आपकी अलमारी से उन टुकड़ों को प्रदर्शित करता है जो उस लुक को दोहराते हैं।
4. अपने 2D अवतार पर परिणामी पोशाक का पूर्वावलोकन करें और इसे अपनी अलमारी डायरी में सहेजें!

### चरण 5: वैयक्तिकरण और सोशल फ़ीड अनुकूलित करें (⚙️ सेटिंग्स)
1. ट्रेंड स्काउट हेडर में **सेटिंग्स (गियर आइकन ⚙️)** पर क्लिक करें।
2. **स्टाइल सौंदर्यशास्त्र**: 10 विशेष स्टाइल टैग (*Quiet Luxury*, *Vintage*, *Minimalist*, *Streetwear*, *Old Money*, *Boho & Casual*, *Cyberpunk*, *Y2K*, *Classic Business*, या *Athleisure*) में से चुनें, या अपना स्वयं का स्टाइल टाइप करें।
3. **कनेक्टेड प्लेटफॉर्म**: अपने सोशल मीडिया हैंडल (Instagram, Pinterest, TikTok, Facebook, Threads, या X) को लिंक करें।
4. **अलमारी प्रोफ़ाइल**: अपनी अलमारी के रंग और सिल्हूट प्रोफ़ाइल की समीक्षा करें।
5. दैनिक ट्रेंड कार्ड्स को तुरंत पुनः लक्षित करने के लिए **सहेजें और फ़ीड ताज़ा करें** पर टैप करें।

### चरण 6: पूरे प्रामाणिक लेख पढ़ें और लाइव रीफ़्रेश करें
- Vogue, GQ, Elle, या Hypebeast पर मूल लेख पढ़ने के लिए किसी भी कार्ड पर **"[प्रकाशन] पर पढ़ें"** पर टैप करें।
- क्या आपको अभी ताज़ा समाचार चाहिए? लाइव रडार स्कैन चलाने के लिए हेडर में **रिफ्रेश (🔄)** बटन दबाएं।

---

## 4. अपेक्षित परिणाम
- उच्च-रिज़ॉल्यूशन छवियों, श्रेणी बैज, लिंग संकेतक और दिनांक टिकटों के साथ एक साफ, पत्रिका-गुणवत्ता वाला फ़ीड।
- आपकी व्यक्तिगत शैली और स्थानीय परिवेश से सटीक रूप से मेल खाने वाले ट्रेंड कार्ड।
- तत्काल अलमारी सुझाव जो दिखाते हैं कि आपके पास पहले से मौजूद कपड़ों का उपयोग करके नवीनतम रुझान कैसे पहनें।

---

## 5. समस्या निवारण

### संदेश: "ट्रेंड स्काउट प्रीमियम है"
- **कारण**: आपका खाता वर्तमान में नि:शुल्क योजना पर है।
- **समाधान**: Manager ($4.99/माह) या Professional ($9.99/माह) योजना की सदस्यता लेने के लिए **अपग्रेड योजना** पर टैप करें।

### कार्ड मेरे देश के स्थानीय समाचार नहीं दिखा रहे हैं
- **कारण**: स्थान अनुमतियां बंद हो सकती हैं या प्रोफ़ाइल में देश सेट नहीं है।
- **समाधान**: स्थान अनुमतियों की जांच करें या **प्रोफ़ाइल > सेटिंग्स > स्थान सेवाएं** में अपना देश सेट करें।

### मुझे ऐसे लेख दिखाई देते हैं जो मेरी शैली या लिंग से मेल नहीं खाते
- **कारण**: चयनकर्ता विपरीत लिंग पर सेट हो सकता है, या स्टाइल टैग खाली हैं।
- **समाधान**: हेडर में स्विच करें या **सेटिंग्स ⚙️** में अपनी पसंदीदा शैलियाँ चुनें।

### कार्ड ताज़ा नहीं हो रहे हैं या पुरानी तारीखें दिखा रहे हैं
- **कारण**: नेटवर्क कनेक्टिविटी समस्याएं या कैश्ड फ़ीड डेटा।
- **समाधान**: लाइव डेटा प्राप्त करने के लिए हेडर में **रिफ्रेश (🔄)** बटन टैप करें या मोबाइल पर नीचे स्वाइप करें।

---

## 6. सीमाएं
- **संपादकीय फोकस**: ट्रेंड स्काउट शुद्ध फैशन प्रेरणा और शिक्षा के लिए डिज़ाइन किया गया है। यह आक्रामक विज्ञापनों को फ़िल्टर करता है।
- **अलमारी मिलान**: एआई केवल उन्हीं वस्तुओं का उपयोग कर सकता है जिन्हें आपने डिजिटाइज़ किया है।
- **ऑफ़लाइन मोड**: पहले देखे गए कार्ड ऑफ़लाइन उपलब्ध हैं, लेकिन लाइव खोज और बाहरी लेख पढ़ने के लिए इंटरनेट आवश्यक है।
"""

it_wiki = """# Trend Scout & Ispirazione Personale

Scopri le tendenze globali quotidiane della moda, il radar di stile locale e ricrea immediatamente i look più in voga usando i capi del tuo armadio.

---

## 1. Panoramica
Trend Scout è il tuo radar quotidiano di fashion intelligence all'interno di DressApp. Ogni mattina raccoglie le ultime notizie di moda, le analisi delle sfilate di alta moda, le innovazioni tessili sostenibili e i movimenti street style dalle riviste più prestigiose al mondo.

Organizzato in **7 canali curati**, Trend Scout personalizza le tendenze in base al tuo profilo e alla tua posizione geografica. Con l'esclusiva funzione con 1 tocco **"Abbina con il mio Armadio"**, il nostro Stylist IA esamina l'estetica di qualsiasi trend (palette cromatica, silhouette, tessuti) e seleziona i capi compatibili già presenti nel tuo armadio digitale, permettendoti di indossare i trend del momento senza dover acquistare nulla di nuovo!

---

## 2. Prerequisiti
Per utilizzare al meglio Trend Scout:
- **Un Piano Attivo**: Disponibile con i piani **Manager** ($4.99/mese) e **Professional** ($9.99/mese). Gli account gratuiti possono visualizzare un'anteprima e passare a un piano superiore in qualsiasi momento.
- **Capi Digitalizzati**: Almeno 5-10 capi nel tuo armadio digitale per consentire allo Stylist IA di formulare proposte di outfit accurate.
- **Accesso alla Posizione**: Permette a Trend Scout di mostrare eventi locali, boutique regionali e notizie del settore per la tua città e nazione.
- **Preferenze del Profilo**: Configurare i tuoi gusti estetici e lo stile di vita garantisce che il feed dia priorità a look su misura per te.

---

## 3. Istruzioni Passo dopo Passo

### Passo 1: Aprire Trend Scout
1. Dalla barra di navigazione principale, tocca **Trend Scout** (icona del grafico con freccia verso l'alto 📈 nel menu o nella barra laterale Stylist).
2. La pagina si apre con il feed personalizzato Daily Edit ancorato al tuo Paese.

### Passo 2: Esplorare i 7 Canali Curati
Filtra gli articoli selezionando le schede di categoria in cima al feed:
- 📍 **Notizie Locali (Local News)**: Eventi regionali di moda, debutti di designer emergenti e novità delle boutique della tua zona.
- 👑 **Passerella (Runway)**: Recensioni di Alta Moda, collezioni stagionali e tendenze dei più celebri stilisti.
- 👟 **Street Style**: Abbigliamento urbano quotidiano, sneaker culture e outfit casual contemporanei.
- 🌿 **Sostenibilità (Sustainability)**: Moda circolare, tessuti ecologici, iniziative zero sprechi e cura consapevole dei capi.
- ✨ **Influencer & Icone (Influencers & Icons)**: Look virali sui social, red carpet e ispirazioni create dai fashion creator.
- ♻️ **Vintage & Archivio (Vintage / Archival)**: Cultura del second hand, denim retrò e moda d'archivio senza tempo.
- 🔧 **Cura & Riparazioni (Care & Repairs)**: Guide pratiche per far durare i capi più a lungo, lavaggio delicato, rammendo e manutenzione scarpe.

### Passo 3: Passare dalla Moda Donna a quella Uomo
- Alterna in qualsiasi momento tra **Moda Donna** e **Moda Uomo** tramite il selettore nell'intestazione.
- Il feed aggiorna immediatamente gli articoli e ricalcola i consigli in base alla scelta effettuata.

### Passo 4: 1 Tocco: "Abbina con il mio Armadio"
1. Quando trovi una tendenza che ti conquista, guarda la scheda del trend.
2. Tocca il pulsante **"Abbina con il mio Armadio"**.
3. Lo Stylist IA si apre subito con i parametri del trend e mostra i capi del tuo armadio che replicano perfettamente il look.
4. Guarda l'outfit sul tuo avatar 2D e salvalo nel Diario del Guardaroba!

### Passo 5: Personalizzazione e Feed Social (⚙️ Impostazioni)
1. Clicca sull'icona delle **Impostazioni (ingranaggio ⚙️)** nell'intestazione.
2. **Stili Estetici**: Scegli tra 10 tag curati (*Quiet Luxury*, *Vintage*, *Minimalist*, *Streetwear*, *Old Money*, *Boho & Casual*, *Cyberpunk*, *Y2K*, *Classic Business*, *Athleisure*) o inserisci il tuo stile personalizzato.
3. **Piattaforme Collegate**: Collega i tuoi account Instagram, Pinterest, TikTok, Facebook, Threads o X.
4. **Profilo Armadio**: Consulta l'analisi cromatica e delle forme del tuo guardaroba generata automaticamente.
5. Tocca **Salva e Aggiorna Feed**.

### Passo 6: Leggere Articoli Completi e Aggiornamento Live
- Tocca **"Leggi su [Rivista]"** per aprire l'articolo originale su testate come Vogue, GQ, Elle o Hypebeast.
- Desideri le ultime notizie dell'ultim'ora? Tocca il pulsante **Aggiorna (🔄)** per eseguire una scansione radar in tempo reale.

---

## 4. Risultati Attesi
- Un feed editoriale con immagini in alta risoluzione, badge di categoria e date di pubblicazione.
- Schede di tendenza allineate al tuo stile personale e al tuo contesto geografico.
- Consigli immediati per indossare i trend del momento sfruttando i capi che già possiedi.

---

## 5. Risoluzione dei Problemi

### Messaggio: "Trend Scout è una funzione Premium"
- **Causa**: Il tuo account è attualmente sul piano Gratuito.
- **Soluzione**: Tocca **Aggiorna Piano** per attivare il piano Manager ($4.99/mese) o Professional ($9.99/mese).

### Le schede non mostrano notizie del mio Paese
- **Causa**: Autorizzazione alla posizione disattivata o Paese non impostato nel profilo.
- **Soluzione**: Verifica i permessi nel browser/app o imposta la nazione in **Profilo > Impostazioni > Posizione**.

### Articoli non adatti al mio genere o gusto
- **Causa**: Selettore impostato sul genere opposto o tag di stile non configurati.
- **Soluzione**: Cambia il selettore Donna/Uomo o imposta le tue estetiche preferite in **Impostazioni ⚙️**.

### Le schede non si aggiornano
- **Causa**: Problema di connessione o cache del feed.
- **Soluzione**: Tocca il pulsante **Aggiorna (🔄)** o trascina verso il basso sullo smartphone.

---

## 6. Limitazioni
- **Focus Editoriale**: Progettato unicamente per ispirazione e cultura della moda, filtrando annunci pubblicitari invadenti.
- **Abbinamento Guardaroba**: Lo Stylist IA può creare combinazioni solo a partire dai capi che hai scansionato.
- **Modalità Offline**: Le schede già consultate sono disponibili offline, ma gli aggiornamenti live richiedono una connessione internet attiva.
"""

ja_wiki = """# トレンドスカウト＆パーソナル・インスピレーション (Trend Scout)

毎日の世界的なファッショントレンドと地域のスタイルレーダーを発見し、手持ちのクローゼットの服を使って旬のルックを瞬時に再現できます。

---

## 1. 概要
トレンドスカウト（Trend Scout）は、DressApp内のデイリー・ファッションインテリジェンス・レーダーです。毎朝、世界の一流ファッション誌から最新のトレンドレポート、ランウェイ解説、サステナブルな新素材、ストリートスナップを収集します。

**7つの厳選チャンネル**で構成されており、ユーザーのプロフィールや現在地に合わせて記事をパーソナライズ。DressApp独自のワンタップ**「マイクローゼットでスタイリング」**機能により、AIスタイリストがトレンドの美学（カラーパレット、シルエット、素材感）を分析し、登録済みクローゼットの中からぴったりの服を提案—新しい服を買い足さなくても、今すぐハイファッショントレンドを楽しめます！

---

## 2. 前提条件
トレンドスカウトを最大限に活用するために：
- **有効なプラン**: **Manager**（月額$4.99）または **Professional**（月額$9.99）プランでご利用いただけます。無料アカウントでもプレビュー確認といつでもアップグレードが可能です。
- **登録済みのお洋服**: AIスタイリストが的確なコーディネート提案を行えるよう、デジタルクローゼットに5〜10着以上のアイテムを登録してください。
- **位置情報の許可**: お住まいの国や都市に合わせたローカルニュース、国内ブティック、ファッションイベントを表示するために必要です。
- **プロフィールの設定**: 好みのテイストやライフスタイルを設定することで、好みにマッチしたルックが優先表示されます。

---

## 3. ステップ・バイ・ステップ手順

### ステップ 1: トレンドスカウトを開く
1. メインナビゲーションから**Trend Scout**をタップまたはクリックします（メニューまたはスタイリスト画面の上昇グラフアイコン 📈 を選択）。
2. あなたの居住地域に合わせたパーソナライズ版Daily Editフィードが表示されます。

### ステップ 2: 厳選7チャンネルを探索する
フィード上部のカテゴリタブをタップして記事を絞り込みます：
- 📍 **地域ニュース (Local News)**: 国内のファッションイベント、地元デザイナーの新作、お近くのブティック情報。
- 👑 **ランウェイ (Runway)**: オートクチュール速報、シーズンごとのコレクション解説、注目メゾンの最新トレンド。
- 👟 **ストリートスタイル (Street Style)**: リアルなストリートスナップ、スニーカーカルチャー、現代的なカジュアルコーデ。
- 🌿 **サステナビリティ (Sustainability)**: エコファッション、循環型テキスタイル、ゼロウェイストの取り組み、衣服のお手入れ法。
- ✨ **インフルエンサー＆アイコン (Influencers & Icons)**: SNSで話題のスタイリング、レッドカーペットの装い、クリエイター発のトレンド。
- ♻️ **ヴィンテージ＆アーカイブ (Vintage / Archival)**: 古着カルチャー、レトロデニム、時代を超越した名作アーカイブ。
- 🔧 **お手入れ・補修 (Care & Repairs)**: 服を長持ちさせる実用ガイド、デリケート素材のケア、お直しやシューズリペア。

### ステップ 3: ウィメンズとメンズの切り替え
- ヘッダーの切り替えスイッチを使って、いつでも**ウィメンズ**と**メンズ**のトレンドを切り替えられます。
- 選択に合わせて、フィードの記事とおすすめが瞬時に再計算されます。

### ステップ 4: ワンタップ「マイクローゼットでスタイリング」
1. 気に入ったトレンドカードを見つけたら、カードの詳細を確認します。
2. **「マイクローゼットでスタイリング」**ボタンをタップします。
3. AIスタイリストがトレンドのスタイル要素を抽出し、クローゼットの中からそのルックを再現できるアイテムを自動提案します。
4. 2Dアバター上で仕上がりを確認し、クローゼット日記に保存しましょう！

### ステップ 5: パーソナライズ＆ソーシャル連携（⚙️ 設定）
1. トレンドスカウト画面のヘッダーにある**設定（歯車アイコン ⚙️）**をタップします。
2. **スタイルテイスト**: 10種類のスタイルタグ（*Quiet Luxury*、*Vintage*、*Minimalist*、*Streetwear*、*Old Money*、*Boho & Casual*、*Cyberpunk*、*Y2K*、*Classic Business*、*Athleisure*）から選ぶか、自由にカスタム入力します。
3. **SNSアカウント連携**: Instagram、Pinterest、TikTok、Facebook、Threads、Xを連携して、興味関心を反映させます。
4. **クローゼットプロファイル**: 自動分析されたカラー構成やシルエットを確認できます。
5. **保存してフィードを更新**をタップして反映します。

### ステップ 6: 正式な元記事の閲覧とリアルタイム更新
- 各カードの**「[雑誌名]で読む」**をタップすると、Vogue、GQ、Elle、Hypebeastなどの公式Webサイトで記事全文を読めます。
- 最新ニュースを今すぐ取得したい場合は、ヘッダーの**更新ボタン（🔄）**をタップしてライブスキャンを実行してください。

---

## 4. 期待される結果
- 高解像度写真、カテゴリバッジ、対象性別、日付が綺麗に整理されたマガジン品質のフィード。
- 個人の好みと地域性にマッチしたトレンドカード。
- 手持ちの服だけで流行のスタイリングをすぐに実践できる具体的な提案。

---

## 5. トラブルシューティング

### 「トレンドスカウトはプレミアム限定です」と表示される
- **原因**: アカウントが無料プランになっています。
- **解決策**: **プランをアップグレード**をタップして、Manager（月額$4.99）またはProfessional（月額$9.99）にご加入ください。

### 自国のローカルニュースが表示されない
- **原因**: 位置情報が無効になっているか、プロフィールで国が設定されていません。
- **解決策**: ブラウザやアプリの位置情報権限を確認するか、**プロフィール > 設定 > 位置情報**で国を設定してください。

### 好みのスタイルや性別と合わない記事が出る
- **原因**: 性別の切り替えが異なっているか、スタイルタグが未設定です。
- **解決策**: ヘッダーの性別ボタンを切り替えるか、**設定 ⚙️**で好きなスタイルを選択してください。

### カードが更新されない、または日付が古い
- **原因**: 通信状態の不良、または古いキャッシュが残っている可能性があります。
- **解決策**: ヘッダーの**更新ボタン（🔄）**をタップするか、画面を下方向にスワイプして再読み込みしてください。

---

## 6. 注意事項・制限事項
- **エディトリアル重視**: 純粋なファッションのインスピレーションと学びを目的としており、押しつけがましい広告やアフィリエイトは排除しています。
- **クローゼット連携**: 提案できるのはデジタルクローゼットに登録された服のみです。登録アイテムが多いほど、提案の幅が広がります！
- **オフライン利用**: 閲覧済みのカードはオフラインでも表示されますが、最新データの取得や外部記事の閲覧にはインターネット接続が必要です。
"""

nl_wiki = """# Trend Scout & Persoonlijke Inspiratie

Ontdek dagelijkse wereldwijde modetrends, je lokale stijlradar en creëer trending looks direct na met kleding uit je eigen kast.

---

## 1. Overzicht
Trend Scout is jouw dagelijkse mode-radar binnen DressApp. Elke ochtend verzamelt het actuele modereportages, catwalk-analyses, innovaties op het gebied van duurzame textielen en streetstyle-bewegingen van toonaangevende modebladen wereldwijd.

Georganiseerd in **7 gecureerde kanalen**, stemt Trend Scout verhalen af op jouw profiel en locatie. Met de kenmerkende 1-tiksfunctie **"Stylen met mijn Kledingkast"** scant onze AI Stylist de esthetische kenmerken van elke trend (kleurenpalet, silhouet, textuur) en toont passende kledingstukken die al in je digitale garderobe hangen—zodat je vandaag nog de nieuwste trends kunt dragen zonder iets nieuws te kopen!

---

## 2. Vereisten
Om het meeste uit Trend Scout te halen:
- **Een Actief Abonnement**: Trend Scout is beschikbaar op de abonnementen **Manager** ($4,99/mnd) en **Professional** ($9,99/mnd). Gratis accounts kunnen een preview bekijken en op elk moment upgraden.
- **Gedigitaliseerde Kledingstukken**: Minimaal 5 tot 10 kledingstukken in je digitale kledingkast voor nauwkeurige outfitvoorstellen van de AI Stylist.
- **Toegang tot Locatie**: Hiermee kan Trend Scout regionaal modenieuws, lokale boetieks en evenementen tonen voor jouw stad en land.
- **Profielinstellingen**: Door je voorkeuren en levensstijl op te geven, geeft de feed voorrang aan looks die passen bij jouw smaak.

---

## 3. Stapsgewijze Instructies

### Stap 1: Trend Scout openen
1. Klik of tik in het hoofdmenu op **Trend Scout** (zoek het stijgende grafiekicoon 📈 in het menu of de Stylist-zijbalk).
2. De pagina opent met jouw gepersonaliseerde Daily Edit feed, afgestemd op jouw land.

### Stap 2: Bladeren door de 7 Gecureerde Kanalen
Filter artikelen met de categorietabbladen bovenaan de feed:
- 📍 **Lokaal Nieuws (Local News)**: Regionale mode-evenementen, debuten van lokale ontwerpers en boetieknieuws uit jouw regio.
- 👑 **Catwalk (Runway)**: Haute couture-recensies, seizoensshows en opkomende ontwerptrends.
- 👟 **Streetstyle (Street Style)**: Dagelijkse stadsmode, sneaker-cultuur en eigentijdse casual combinaties.
- 🌿 **Duurzaamheid (Sustainability)**: Ecologische mode, circulaire stoffen, zero-waste initiatieven en kledingonderhoud.
- ✨ **Influencers & Iconen (Influencers & Icons)**: Virale social styling trends, rode loper-hoogtepunten en stijlen van contentmakers.
- ♻️ **Vintage & Archief (Vintage / Archival)**: Vintage cultuur, retro denim en tijdloze archiefmode.
- 🔧 **Verzorging & Reparaties (Care & Repairs)**: Praktische handleidingen voor kledingbehoud, delicate stoffen en schoenherstel.

### Stap 3: Schakelen tussen Dames- en Herenmode
- Wissel op elk moment eenvoudig tussen **Damesmode** en **Herenmode** met de keuzeknop in de koptekst.
- De feed past artikelen en aanbevelingen direct aan op basis van jouw keuze.

### Stap 4: 1 Tik: "Stylen met mijn Kledingkast"
1. Zie je een trend die je aanspreekt? Bekijk de trendkaart.
2. Klik op de knop **"Stylen met mijn Kledingkast"**.
3. De AI Stylist opent direct met de stijlelementen van de trend en toont kledingstukken uit je kast die de look nabootsen.
4. Bekijk de outfit op je 2D-avatar en sla hem op in je garderobedagboek!

### Stap 5: Personalisatie & Social Feeds aanpassen (⚙️ Instellingen)
1. Klik op het **tandwielicoon (⚙️)** in de Trend Scout koptekst.
2. **Stijlesthetiek**: Kies uit 10 tags (*Quiet Luxury*, *Vintage*, *Minimalist*, *Streetwear*, *Old Money*, *Boho & Casual*, *Cyberpunk*, *Y2K*, *Classic Business*, *Athleisure*) of voer je eigen stijl in.
3. **Gekoppelde Accounts**: Koppel je social media (Instagram, Pinterest, TikTok, Facebook, Threads of X).
4. **Kledingkastprofiel**: Bekijk de automatische analyse van de kleuren en vormen in jouw kast.
5. Klik op **Opslaan & Feed Vernieuwen**.

### Stap 6: Volledige Artikelen Lezen & Live Vernieuwen
- Tik op **"Lees op [Tijdschrift]"** om het originele artikel direct te lezen op Vogue, GQ, Elle of Hypebeast.
- Wil je het allerlaatste nieuws meteen zien? Tik op de **Vernieuwen-knop (🔄)** voor een realtime radar-scan.

---

## 4. Verwachte Resultaten
- Een redactionele feed van tijdschriftkwaliteit met scherpe foto's, categoriebadges en publicatiedatums.
- Trendkaarten die nauwkeurig aansluiten op jouw persoonlijke stijl en geografische regio.
- Directe outfitideeën die laten zien hoe je de nieuwste trends draagt met de kleren die je al hebt.

---

## 5. Problemen Oplossen

### Melding: "Trend Scout is een Premium functie"
- **Oorzaak**: Je account staat momenteel op het gratis abonnement.
- **Oplossing**: Tik op **Abonnement Upgraden** om lid te worden van Manager ($4,99/mnd) of Professional ($9,99/mnd).

### Geen lokaal nieuws uit mijn land
- **Oorzaak**: Locatietoegang staat uit of land is niet ingesteld in je profiel.
- **Oplossing**: Controleer browser-/app-machtigingen of stel je land in onder **Profiel > Instellingen > Locatievoorzieningen**.

### Artikelen passen niet bij mijn stijl of geslacht
- **Oorzaak**: Schakelaar staat op het verkeerde geslacht of stijltags zijn leeg.
- **Oplossing**: Wissel van selectie in de koptekst of stel je voorkeuren in via **Instellingen ⚙️**.

### Kaarten vernieuwen niet
- **Oorzaak**: Verbindingsproblemen of cachegegevens.
- **Oplossing**: Tik op de **Vernieuwen-knop (🔄)** of veeg omlaag op je telefoon.

---

## 6. Beperkingen
- **Redactionele Focus**: Gericht op pure inspiratie en modekennis; hinderlijke koopadvertenties worden weggefilterd.
- **Kledingkast Match**: De AI kan alleen combineren met kleding die je gedigitaliseerd hebt.
- **Offline Modus**: Eerder geopende kaarten zijn offline beschikbaar, maar live zoeken vereist internet.
"""

wiki_map_2 = {
    'hi': hi_wiki,
    'it': it_wiki,
    'ja': ja_wiki,
    'nl': nl_wiki
}

for lang, content in wiki_map_2.items():
    for folder in ['wiki', 'apps/web/public/wiki']:
        target_file = os.path.join(base_dir, folder, lang, 'trend_scout.md')
pt_wiki = """# Explorador de Tendências e Inspiração Pessoal (Trend Scout)

Descubra tendências globais diárias, o radar de estilo local e recrie looks em alta instantaneamente com as roupas do seu próprio guarda-roupa.

---

## 1. Visão Geral
Trend Scout é o seu radar diário de inteligência de moda dentro do DressApp. Todas as manhãs, ele reúne as principais reportagens de moda, resenhas de desfiles de alta-costura, inovações têxteis sustentáveis e movimentos de moda urbana das publicações mais respeitadas do mundo.

Organizado em **7 canais selecionados**, o Trend Scout personaliza as histórias para o seu perfil e localização geográfica. Com o exclusivo recurso de 1 toque **"Estilizar com Meu Guarda-Roupa"**, nosso Estilista IA analisa a estética de qualquer tendência (paleta de cores, silhueta, texturas) e destaca peças correspondentes que já estão no seu closet digital—permitindo que você use o melhor da moda hoje mesmo sem comprar nada novo!

---

## 2. Pré-requisitos
Para aproveitar o Trend Scout ao máximo:
- **Um Plano Ativo**: O Trend Scout está disponível nos planos **Manager** ($4.99/mês) e **Professional** ($9.99/mês). Contas gratuitas podem visualizar uma prévia e fazer upgrade a qualquer momento.
- **Peças no Guarda-Roupa Digital**: Pelo menos 5 a 10 roupas cadastradas no closet para que o Estilista IA possa sugerir looks precisos.
- **Permissão de Localização**: Permite que o Trend Scout ancore notícias locais, estilistas regionais e eventos de moda da sua cidade e país.
- **Preferências no Perfil**: Indicar seu estilo e preferências estéticas garante que o radar priorize looks alinhados ao seu gosto.

---

## 3. Instruções Passo a Passo

### Passo 1: Abrir o Trend Scout
1. Na navegação principal, clique ou toque em **Trend Scout** (procure o ícone de tendência 📈 no menu ou na barra lateral do Estilista).
2. A página abre com seu feed Daily Edit personalizado para o seu país.

### Passo 2: Navegar pelos 7 Canais Selecionados
Filtre as matérias selecionando as abas no topo do feed:
- 📍 **Notícias Locais (Local News)**: Eventos de moda da sua região, estreia de designers locais e novidades de boutiques.
- 👑 **Passarela (Runway)**: Análises de alta-costura, desfiles sazonais e tendências dos maiores estilistas.
- 👟 **Moda Urbana (Street Style)**: Looks urbanos do dia a dia, cultura sneaker e combinações casuais modernas.
- 🌿 **Sustentabilidade (Sustainability)**: Moda ecológica, tecidos circulares, iniciativas de desperdício zero e cuidados conscientes.
- ✨ **Criadores e Ícones (Influencers & Icons)**: Estilos virais das redes sociais, tapetes vermelhos e estéticas em alta.
- ♻️ **Vintage e Arquivo (Vintage / Archival)**: Cultura de brechó, jeans clássico e moda retrô atemporal.
- 🔧 **Cuidados e Reparos (Care & Repairs)**: Dicas práticas de conservação, lavagem de tecidos delicados e reforma de calçados.

### Passo 3: Alternar entre Moda Feminina e Masculina
- Alterne facilmente entre **Moda Feminina** e **Moda Masculina** a qualquer momento pelo seletor no cabeçalho.
- O feed atualiza os artigos e recalcula as sugestões na hora com base na sua escolha.

### Passo 4: 1 Toque: "Estilizar com Meu Guarda-Roupa"
1. Quando avistar uma tendência que adorar, veja o cartão da tendência.
2. Toque no botão **"Estilizar com Meu Guarda-Roupa"**.
3. O Estilista IA abre na hora com os parâmetros da tendência e exibe peças do seu closet que recriam o visual.
4. Veja o resultado no seu avatar 2D e salve a combinação no seu Diário de Looks!

### Passo 5: Personalização e Redes Sociais (⚙️ Ajustes)
1. Clique no ícone de **Configurações (engrenagem ⚙️)** no cabeçalho do Trend Scout.
2. **Estilos Estéticos**: Escolha entre 10 tags selecionadas (*Quiet Luxury*, *Vintage*, *Minimalist*, *Streetwear*, *Old Money*, *Boho & Casual*, *Cyberpunk*, *Y2K*, *Classic Business*, *Athleisure*) ou digite seu estilo personalizado.
3. **Plataformas Conectadas**: Vincule suas redes sociais (Instagram, Pinterest, TikTok, Facebook, Threads ou X).
4. **Perfil do Closet**: Veja a distribuição automática de cores e cortes das suas roupas.
5. Toque em **Salvar e Atualizar Feed**.

### Passo 6: Ler Matérias Originais e Atualização ao Vivo
- Toque em **"Ler na [Publicação]"** para abrir o artigo original na Vogue, GQ, Elle ou Hypebeast.
- Quer ver as notícias mais quentes do momento? Toque no botão **Atualizar (🔄)** para uma busca em tempo real.

---

## 4. Resultados Esperados
- Um feed editorial com padrão de revista, fotos em alta resolução, selos de categoria e datas.
- Cartões de tendências combinando perfeitamente com seu gosto e sua região.
- Sugestões imediatas de looks mostrando como vestir as novas tendências usando as roupas que você já tem.

---

## 5. Solução de Problemas

### Mensagem: "Trend Scout é um recurso Premium"
- **Causa**: Sua conta está no plano Gratuito.
- **Solução**: Toque em **Fazer Upgrade** para assinar o plano Manager ($4.99/mês) ou Professional ($9.99/mês).

### Os cartões não mostram notícias do meu país
- **Causa**: A localização está desativada ou o país não foi definido no perfil.
- **Solução**: Verifique as permissões de localização ou defina seu país em **Perfil > Configurações > Localização**.

### Artigos não combinam com meu gênero ou estilo
- **Causa**: O seletor de gênero está invertido ou suas tags estéticas estão em branco.
- **Solução**: Alterne o botão no cabeçalho ou selecione suas estéticas em **Configurações ⚙️**.

### Os cartões não atualizam
- **Causa**: Instabilidade na conexão ou dados em cache.
- **Solução**: Toque em **Atualizar (🔄)** no cabeçalho ou deslize a tela para baixo no celular.

---

## 6. Limitações
- **Foco Editorial**: Feito exclusivamente para inspiração e aprendizado de moda, eliminando propagandas invasivas de compras.
- **Compatibilidade do Closet**: A IA só consegue combinar peças que já foram cadastradas no seu guarda-roupa.
- **Modo Offline**: Cartões abertos anteriormente continuam disponíveis, mas buscas ao vivo requerem internet.
"""

ru_wiki = """# Радар трендов и персональное вдохновение (Trend Scout)

Узнавайте о главных мировых модных трендах, следите за локальным стилем и мгновенно воссоздавайте подиумные образы из вещей собственного гардероба.

---

## 1. Обзор
Trend Scout — это ваш ежедневный гид и радар модной индустрии внутри DressApp. Каждое утро он собирает свежие репортажи, обзоры показов Haute Couture, инновации в эко-текстиле и тренды уличной моды из ведущих мировых глянцевых изданий.

Информация сгруппирована по **7 тематическим каналам**, а Trend Scout персонализирует ленту под ваш профиль и геолокацию. Благодаря фирменной функции в 1 касание **\"Стилизовать из гардероба\"**, наш AI-стилист анализирует эстетику любого тренда (цветовую гамму, силуэт, фактуры) и находит похожие вещи, уже висящие в вашем цифровом гардеробе — позволяя вам носить тренды прямо сейчас без лишних покупок!

---

## 2. Предварительные требования
Чтобы получить максимум от Trend Scout:
- **Активная подписка**: Trend Scout доступен на тарифах **Manager** ($4.99/мес) и **Professional** ($9.99/мес). На бесплатном тарифе можно ознакомиться с превью и повысить план в любое время.
- **Оцифрованные вещи**: Не менее 5–10 предметов одежды в вашем цифровом гардеробе для точного подбора образов.
- **Доступ к геолокации**: Позволяет Trend Scout показывать новости моды, региональных дизайнеров и бутики вашего города и страны.
- **Настройки профиля**: Указание пола, стиля жизни и эстетических предпочтений помогает формировать подборки по вашему вкусу.

---

## 3. Пошаговая инструкция

### Шаг 1: Открыть Trend Scout
1. В главном меню нажмите или коснитесь **Trend Scout** (иконка восходящего графика 📈 в меню или на панели Стилиста).
2. Загрузится персональная подборка Daily Edit с привязкой к вашей стране.

### Шаг 2: Просмотр 7 тематических каналов
Фильтруйте публикации с помощью вкладок категорий в верхней части ленты:
- 📍 **Местные новости (Local News)**: События региональной моды, дебюты местных модельеров и новости бутиков.
- 👑 **Подиум (Runway)**: Обзоры коллекций от кутюр, сезонные недели моды и новинки ведущих модных домов.
- 👟 **Уличный стиль (Street Style)**: Повседневная городская мода, сникер-культура и актуальные кэжуал-комплекты.
- 🌿 **Экологичность (Sustainability)**: Эко-мода, цикличный текстиль, безотходное производство и осознанный уход за одеждой.
- ✨ **Инфлюенсеры и иконы стиля (Influencers & Icons)**: Вирусные тренды из соцсетей, образы с красных дорожек и луки от стилистов.
- ♻️ **Винтаж и архив (Vintage / Archival)**: Культура секонд-хендов, классический деним и культовые винтажные силуэты.
- 🔧 **Уход и ремонт (Care & Repairs)**: Практические советы по долговечности одежды, стирке деликатных тканей и реставрации обуви.

### Шаг 3: Переключение между женской и мужской модой
- Легко переключайтесь между **Женской модой** и **Мужской модой** в любой момент с помощью селектора в шапке.
- Лента мгновенно обновит публикации и пересчитает рекомендации.

### Шаг 4: В 1 касание: \"Стилизовать из гардероба\"
1. Увидев понравившийся тренд, откройте его карточку.
2. Нажмите кнопку **\"Стилизовать из гардероба\"**.
3. AI-стилист моментально считает эстетические параметры тренда и выберет из вашего шкафа вещи, повторяющие этот образ.
4. Оцените образ на вашем 2D-аватаре и сохраните его в Дневник образов!

### Шаг 5: Персонализация и соцсети (⚙️ Настройки)
1. Нажмите на иконку **Настроек (шестеренка ⚙️)** в шапке Trend Scout.
2. **Эстетика стиля**: Выберите из 10 готовых тегов (*Quiet Luxury*, *Vintage*, *Minimalist*, *Streetwear*, *Old Money*, *Boho & Casual*, *Cyberpunk*, *Y2K*, *Classic Business*, *Athleisure*) или введите свой.
3. **Привязка соцсетей**: Подключите аккаунты (Instagram, Pinterest, TikTok, Facebook, Threads или X).
4. **Профиль гардероба**: Изучите автоматически сформированный цветовой баланс и анализ силуэтов.
5. Нажмите **Сохранить и обновить ленту**.

### Шаг 6: Чтение полных статей и обновление в реальном времени
- Нажмите **\"Читать на [Издание]\"**, чтобы открыть первоисточник на сайтах Vogue, GQ, Elle или Hypebeast.
- Нужны самые свежие новости прямо сейчас? Нажмите кнопку **Обновить (🔄)** в шапке для мгновенного сканирования.

---

## 4. Ожидаемые результаты
- Стильная журнальная лента с фотографиями высокого качества, бейджами категорий и датами.
- Карточки трендов, точно соответствующие вашим вкусам и региону проживания.
- Готовые формулы образов, показывающие, как носить тренды с помощью уже имеющейся одежды.

---

## 5. Устранение неполадок

### Сообщение: \"Trend Scout доступен на тарифе Premium\"
- **Причина**: Ваш аккаунт на бесплатном тарифе.
- **Решение**: Нажмите **Улучшить тариф**, чтобы выбрать план Manager ($4.99/мес) или Professional ($9.99/мес).

### В ленте нет новостей моей страны
- **Причина**: Отключен доступ к геолокации или в профиле не указана страна.
- **Решение**: Проверьте разрешения геолокации или выберите страну в **Профиль > Настройки > Местоположение**.

### Статьи не соответствуют стилю или полу
- **Причина**: Переключатель пола установлен неверно либо теги стиля не выбраны.
- **Решение**: Переключите пол в шапке или укажите стили в **Настройках ⚙️**.

### Карточки не обновляются
- **Причина**: Нестабильное интернет-соединение или кэш.
- **Решение**: Нажмите кнопку **Обновить (🔄)** или потяните экран вниз на смартфоне.

---

## 6. Ограничения
- **Редакционный фокус**: Сервис создан исключительно для вдохновения и стиля, агрессивная реклама покупок отфильтрована.
- **Подбор из гардероба**: ИИ подбирает сочетания только из тех вещей, которые вы оцифровали в приложении.
- **Офлайн-режим**: Ранее просмотренные карточки доступны без интернета, но свежие сводки требуют сети.
"""

zh_wiki = """# 潮流侦探与个人穿搭灵感 (Trend Scout)

发现每日全球时尚资讯与本地潮流风向标，无需添置新衣，一键使用自有数字衣橱服饰即刻复刻秀场大热造型。

---

## 1. 概述
潮流侦探（Trend Scout）是 DressApp 为您打造的每日时尚情报雷达。每天早晨，它汇聚全球权威时尚杂志的突发报道、四大时装周秀场深度解析、环保可持续面料创新以及全球街拍风尚。

系统精选 **7 大核心频道**，并根据您的个人偏好与所在地理位置提供个性化资讯流。通过标志性的一键直达功能——**“用我的衣橱搭同款”**，AI 造型师将深度提炼任意趋势的色彩搭配、轮廓廓形与面料质感，并在您已录入的数字化衣橱中快速匹配同款单品，让您今天就能穿出走秀同款高街时髦！

---

## 2. 前提条件
为充分发挥潮流侦探的强大功能，请确保：
- **有效会员计划**：潮流侦探面向 **Manager**（4.99 美元/月）及 **Professional**（9.99 美元/月）订阅用户开放。免费版用户可查看精选预览并支持随时一键升级。
- **已录入衣橱服饰**：数字衣橱中建议至少录入 5 至 10 件衣服，以便 AI 造型师能够生成精准且富有创意的同款穿搭提案。
- **地理位置权限**：授权位置权限后，潮流侦探可根据您所在的城市与国家精确定位本地时尚盛事、本土设计师新作与本土精品店资讯。
- **完善个人资料偏好**：明确性别偏好、穿搭风格与生活场景，确保趋势流优先推荐契合您品味的造型。

---

## 3. 分步操作指南

### 第 1 步：打开潮流侦探
1. 在主导航栏中，点击或轻触 **Trend Scout**（在菜单或造型师侧边栏中找到上升趋势图标 📈）。
2. 页面将自动加载根据您所在国家与喜好量身定制的 Daily Edit 每日精选潮流资讯。

### 第 2 步：浏览 7 大精选频道
轻触资讯流顶部的分类标签，可按主题快速筛选内容：
- 📍 **本地资讯 (Local News)**：本地时尚盛事、本土原创设计师新品发布与周边精选买手店动态。
- 👑 **秀场精选 (Runway)**：高级定制时装周盘点、各大品牌最新季大秀解析与前沿设计趋势。
- 👟 **街头潮流 (Street Style)**：都市日常穿搭、球鞋流行文化与现代休闲混搭指南。
- 🌿 **环保时尚 (Sustainability)**：绿色环保时装、循环纺织创新面料、零废弃倡议与科学护衣理念。
- ✨ **顶流红人 (Influencers & Icons)**：社交网络病毒式流行风格、红毯焦点造型与时尚博主穿搭公式。
- ♻️ **古着档案 (Vintage / Archival)**：中古二手服饰文化、经典复古丹宁与历久弥新的典藏时装。
- 🔧 **衣服养护 (Care & Repairs)**：延长衣物寿命的实用教程、娇贵面料养护、衣物织补改制与球鞋清洗修复。

### 第 3 步：切换女士与男士时尚板块
- 随时通过顶部导航栏的药丸式切换按钮，在**女士时尚**与**男士时尚**之间自由切换。
- 资讯流将实时过滤文章，并根据所选分类动态重新计算穿搭推荐。

### 第 4 步：一键直达：“用我的衣橱搭同款”
1. 当您在潮流流中发现心仪的趋势卡片时，点击卡片上的 **“用我的衣橱搭同款”** 按钮。
2. AI 造型师将立即提取该趋势的风格特征（色调、宽松度、叠穿逻辑），并在您的数字衣橱中挑选最契合的单品完成复刻。
3. 在您的 2D 拟真虚拟模特（Avatar）上即时预览试穿效果，满意后可一键保存至穿搭日记！

### 第 5 步：个性化与社交平台偏好设置 (⚙️ 设置)
1. 点击潮流侦探顶部的 **设置（齿轮图标 ⚙️）**。
2. **风格美学选择**：轻触选择 10 种精选风格标签（如*老钱风 Old Money*、*静奢风 Quiet Luxury*、*复古风 Vintage*、*街头风 Streetwear*、*极简主义 Minimalist*、*Y2K 千禧风*、*经典商务 Classic Business*、*波西米亚度假*、*赛博朋克 Cyberpunk* 或 *运动休闲 Athleisure*），亦可输入自定义风格。
3. **关联社交平台**：连接您的 Instagram、Pinterest、TikTok、Facebook、Threads 或 X 账号，使时尚雷达更好契合您的社交审美偏好。
4. **衣橱风格档案**：查看系统根据您录入的衣物自动分析的色系分布与轮廓报告。
5. 点击 **保存并刷新资讯流**，每日卡片将立即按新偏好重新生成。

### 第 6 步：阅读正版权威全文与实时刷新
- 点击卡片上的 **“在 [媒体名称] 上阅读”**，可直接跳转至 Vogue、GQ、Elle 或 Hypebeast 等原刊官网查阅完整深度报道。
- 想立即获取刚刚发布的突发时尚快讯？点击顶部 **刷新按钮（🔄）**，即刻触发实时雷达全面扫描。

---

## 4. 预期效果
- 呈现如同翻阅精美时尚杂志般的视觉资讯流，包含高清图集、频道标签、性别标识与发布时间。
- 趋势卡片与您的个人穿搭品味及所在城市时尚生态高度契合。
- 针对每一项潮流，系统均能利用您现有衣服给出即学即用的搭配方案。

---

## 5. 常见问题排查

### 页面提示“潮流侦探为高级会员专享”
- **原因**：当前账号处于免费版层级。
- **解决办法**：点击 **升级计划**，订阅 Manager（4.99 美元/月）或 Professional（9.99 美元/月）即可解锁全部权益。

### 卡片没有显示我所在国家的本地新闻
- **原因**：未开启地理位置权限，或个人资料中未设定国家。
- **解决办法**：检查浏览器或手机应用的位置权限，或前往 **个人资料 > 设置 > 位置服务** 设定您的国家。

### 推荐的资讯文章与我的偏好或性别不符
- **原因**：顶部性别切换器误触，或未勾选风格美学标签。
- **解决办法**：切换顶部的女士/男士选项，或点击 **设置 ⚙️** 重新勾选您钟爱的风格美学。

### 卡片没有更新或显示较旧日期
- **原因**：网络连接波动或本地资讯缓存未刷新。
- **解决办法**：点击顶部的 **刷新（🔄）** 按钮，或在移动设备上下拉屏幕以重新拉取最新数据。

---

## 6. 使用限制说明
- **纯粹编辑视角**：潮流侦探专注时尚灵感与审美教育，系统主动过滤了骚扰式电商购物广告与导购弹窗。
- **衣橱匹配机制**：AI 仅能调用您已录入数字衣橱中的服饰；衣橱单品越丰富，生成的同款复刻方案越惊艳多元！
- **离线模式**：已浏览缓存的卡片支持离线查阅，但获取最新实时雷达数据与跳转阅读外网报道需保持网络连接。
"""

wiki_map_3 = {
    'pt': pt_wiki,
    'ru': ru_wiki,
    'zh': zh_wiki
}

for lang, content in wiki_map_3.items():
    for folder in ['wiki', 'apps/web/public/wiki']:
        target_file = os.path.join(base_dir, folder, lang, 'trend_scout.md')
        with open(target_file, 'w', encoding='utf-8') as f:
            f.write(content)
    print(f"Written wiki for {lang}")

print("Generating apps/mobile/src/lib/bundledWiki.ts...")

all_langs = ['en', 'he', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'nl', 'pt', 'ru', 'zh']
wiki_root = os.path.join(base_dir, 'wiki')

bundle_data = {}

for lang in all_langs:
    lang_dir = os.path.join(wiki_root, lang)
    bundle_data[lang] = {}
    if not os.path.exists(lang_dir):
        continue
    for fname in os.listdir(lang_dir):
        if not fname.endswith('.md'):
            continue
        slug = fname[:-3]
        fpath = os.path.join(lang_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        bundle_data[lang][slug] = content
        # Also include dash / underscore alias
        slug_hyphen = slug.replace('_', '-')
        slug_underscore = slug.replace('-', '_')
        bundle_data[lang][slug_hyphen] = content
        bundle_data[lang][slug_underscore] = content

ts_output = """/**
 * apps/mobile/src/lib/bundledWiki.ts
 *
 * Pre-bundled DressApp Wiki Markdown Guides across 13 languages.
 * Provides instant, zero-latency, offline-capable Layer 2 detailed help.
 * Generated automatically from wiki/{lang}/*.md.
 */

const BUNDLED_WIKI: Record<string, Record<string, string>> = """

ts_output += json.dumps(bundle_data, ensure_ascii=False, indent=2)
ts_output += """;

export function getBundledWiki(lang: string, topic: string): string | null {
  const normLang = (lang || 'en').split('-')[0].toLowerCase();
  const langPack = BUNDLED_WIKI[normLang] || BUNDLED_WIKI['en'];
  if (!langPack) return null;

  // Direct hit
  if (langPack[topic]) return langPack[topic];

  // Try underscore / dash variants
  const withUnderscores = topic.replace(/-/g, '_');
  if (langPack[withUnderscores]) return langPack[withUnderscores];

  const withDashes = topic.replace(/_/g, '-');
  if (langPack[withDashes]) return langPack[withDashes];

  // Fallback to English
  const enPack = BUNDLED_WIKI['en'];
  if (enPack) {
    if (enPack[topic]) return enPack[topic];
    if (enPack[withUnderscores]) return enPack[withUnderscores];
    if (enPack[withDashes]) return enPack[withDashes];
  }

  return null;
}
"""

bundled_wiki_path = os.path.join(base_dir, 'apps', 'mobile', 'src', 'lib', 'bundledWiki.ts')
with open(bundled_wiki_path, 'w', encoding='utf-8') as f:
    f.write(ts_output)
print(f"Successfully generated {bundled_wiki_path} (size: {os.path.getsize(bundled_wiki_path)} bytes)")






