import json
import os

locales_dir = r"C:\DressApp_AG\packages\i18n\locales"
LANGUAGES = ["en", "de", "he", "ar", "es", "fr", "it", "nl", "pt", "ru", "zh", "ja", "hi"]

TRANSLATIONS = {
    "addItem.heroSubtitle": {
        "en": "Snap a photo or import a document — our AI detects, crops, and catalogs every detail into your closet.",
        "he": "צלם תמונה או ייבא מסמך — ה-AI שלנו מזהה, חותך ומקטלג כל פרט לארון שלך.",
        "ar": "التقط صورة أو استورد مستنداً — سيتولى الذكاء الاصطناعي اكتشاف وقص وتصنيف كل تفصيل في خزانتك.",
        "de": "Mache ein Foto oder importiere ein Dokument – unsere KI erkennt, schneidet zu und katalogisiert jedes Detail für deinen Kleiderschrank.",
        "es": "Toma una foto o importa un documento: nuestra IA detecta, recorta y cataloga cada detalle en tu armario.",
        "fr": "Prenez une photo ou importez un document — notre IA détecte, recadre et catalogue chaque détail dans votre garde-robe.",
        "it": "Scatta una foto o importa un documento: la nostra IA rileva, ritaglia e cataloga ogni dettaglio nel tuo guardaroba.",
        "nl": "Maak een foto of importeer een document — onze AI detecteert, snijdt bij en catalogiseert elk detail in je kledingkast.",
        "pt": "Tire uma foto ou importe um documento — nossa IA detecta, corta e cataloga cada detalhe no seu guarda-roupa.",
        "ru": "Сделайте фото или импортируйте документ — наш ИИ распознает, обрежет и добавит каждую деталь в ваш гардероб.",
        "zh": "拍照或导入文档——我们的 AI 会自动识别、裁剪并整理衣物细节至您的衣橱。",
        "ja": "写真を撮影またはドキュメントを取り込み — AI が細部を自動検出・切り抜き・クローゼットに登録します。",
        "hi": "फ़ोटो लें या दस्तावेज़ आयात करें — हमारा AI हर विवरण को पहचानकर, क्रॉप करके आपकी अलमारी में जोड़ता है।"
    },
    "addItem.batchSaveSuccess": {
        "en": "Successfully added {{count}} garments to your closet!",
        "he": "נוספו בהצלחה {{count}} פריטים לארון שלך!",
        "ar": "تمت إضافة {{count}} من الملابس بنجاح إلى خزانتك!",
        "de": "{{count}} Kleidungsstücke erfolgreich zu deinem Kleiderschrank hinzugefügt!",
        "es": "¡Se añadieron con éxito {{count}} prendas a tu armario!",
        "fr": "{{count}} vêtements ajoutés avec succès à votre garde-robe !",
        "it": "{{count}} capi aggiunti con successo al tuo guardaroba!",
        "nl": "{{count}} kledingstukken succesvol toegevoegd aan je kledingkast!",
        "pt": "{{count}} peças adicionadas com sucesso ao seu guarda-roupa!",
        "ru": "{{count}} вещей успешно добавлено в ваш гардероб!",
        "zh": "已成功将 {{count}} 件衣物添加到您的衣橱！",
        "ja": "{{count}} 点のアイテムをクローゼットに追加しました！",
        "hi": "आपकी अलमारी में {{count}} कपड़े सफलतापूर्वक जोड़े गए!"
    },
    "addItem.cameraError": {
        "en": "Failed to access camera",
        "he": "הגישה למצלמה נכשלה",
        "ar": "فشل الوصول إلى الكاميرا",
        "de": "Kamerazugriff fehlgeschlagen",
        "es": "Error al acceder a la cámara",
        "fr": "Échec de l'accès à la caméra",
        "it": "Impossibile accedere alla fotocamera",
        "nl": "Geen toegang tot camera",
        "pt": "Falha ao acessar a câmera",
        "ru": "Не удалось получить доступ к камере",
        "zh": "无法访问相机",
        "ja": "カメラにアクセスできませんでした",
        "hi": "कैमरे तक पहुँचने में विफल"
    },
    "addItem.cameraPermission": {
        "en": "Camera Permission",
        "he": "הרשאת מצלמה",
        "ar": "إذن الكاميرا",
        "de": "Kameraberechtigung",
        "es": "Permiso de cámara",
        "fr": "Autorisation de la caméra",
        "it": "Autorizzazione fotocamera",
        "nl": "Cameratoestemming",
        "pt": "Permissão de câmera",
        "ru": "Разрешение для камеры",
        "zh": "相机权限",
        "ja": "カメラの権限",
        "hi": "कैमरा अनुमति"
    },
    "addItem.cameraPermissionPrompt": {
        "en": "Camera permission is required to photograph clothing.",
        "he": "נדרשת הרשאת מצלמה כדי לצלם בגדים.",
        "ar": "إذن الكاميرا مطلوب لتصوير الملابس.",
        "de": "Kameraberechtigung ist erforderlich, um Kleidung zu fotografieren.",
        "es": "Se requiere permiso de cámara para fotografiar ropa.",
        "fr": "L'autorisation de la caméra est requise pour photographier les vêtements.",
        "it": "È necessaria l'autorizzazione della fotocamera per fotografare i capi.",
        "nl": "Cameratoestemming is vereist om kleding te fotograferen.",
        "pt": "A permissão de câmera é necessária para fotografar roupas.",
        "ru": "Для фотосъемки одежды требуется доступ к камере.",
        "zh": "需要相机权限来拍摄衣物。",
        "ja": "服を撮影するにはカメラの権限が必要です。",
        "hi": "कपड़ों की तस्वीर लेने के लिए कैमरे की अनुमति आवश्यक है।"
    },
    "addItem.photosPermission": {
        "en": "Photo Library Permission",
        "he": "הרשאת גישה לתמונות",
        "ar": "إذن مكتبة الصور",
        "de": "Fotomediathek-Berechtigung",
        "es": "Permiso de galería",
        "fr": "Autorisation d'accès aux photos",
        "it": "Autorizzazione libreria foto",
        "nl": "Fototoestemming",
        "pt": "Permissão da biblioteca de fotos",
        "ru": "Разрешение для фотогалереи",
        "zh": "照片库权限",
        "ja": "写真ライブラリの権限",
        "hi": "फ़ोटो लाइब्रेरी अनुमति"
    },
    "addItem.chooseFromLibrary": {
        "en": "Choose from Library",
        "he": "בחר מגלריית התמונות",
        "ar": "اختر من المعرض",
        "de": "Aus Mediathek wählen",
        "es": "Elegir de la galería",
        "fr": "Choisir depuis la bibliothèque",
        "it": "Scegli dalla libreria",
        "nl": "Kies uit bibliotheek",
        "pt": "Escolher da galeria",
        "ru": "Выбрать из галереи",
        "zh": "从相册选择",
        "ja": "ライブラリから選択",
        "hi": "लाइब्रेरी से चुनें"
    },
    "addItem.fabricComposition": {
        "en": "Fabric Composition",
        "he": "הרכב בדים",
        "ar": "تركيب القماش",
        "de": "Stoffzusammensetzung",
        "es": "Composición del tejido",
        "fr": "Composition du tissu",
        "it": "Composizione tessuto",
        "nl": "Stofsamenstelling",
        "pt": "Composição do tecido",
        "ru": "Состав ткани",
        "zh": "面料成分",
        "ja": "生地の組成",
        "hi": "कपड़े की संरचना"
    },
    "addItem.import.enterUrlPrompt": {
        "en": "Please enter a valid product or image URL",
        "he": "אנא הזן קישור תקין למוצר או לתמונה",
        "ar": "يرجى إدخال رابط صالح للمنتج أو الصورة",
        "de": "Bitte gib eine gültige Produkt- oder Bild-URL ein",
        "es": "Por favor, introduce una URL válida de producto o imagen",
        "fr": "Veuillez entrer une URL valide de produit ou d'image",
        "it": "Inserisci un URL valido del prodotto o dell'immagine",
        "nl": "Voer een geldige product- of afbeeldings-URL in",
        "pt": "Insira uma URL válida de produto ou imagem",
        "ru": "Пожалуйста, укажите действительный URL товара или изображения",
        "zh": "请输入有效的商品或图片链接",
        "ja": "有効な商品または画像のURLを入力してください",
        "hi": "कृपया एक मान्य उत्पाद या छवि URL दर्ज करें"
    },
    "addItem.import.extractBtn": {
        "en": "Extract Garment Details",
        "he": "חלץ פרטי פריט",
        "ar": "استخراج تفاصيل القطعة",
        "de": "Kleidungsdetails extrahieren",
        "es": "Extraer detalles de la prenda",
        "fr": "Extraire les détails du vêtement",
        "it": "Estrai dettagli capo",
        "nl": "Kledingdetails extraheren",
        "pt": "Extrair detalhes da peça",
        "ru": "Извлечь детали одежды",
        "zh": "提取衣物详情",
        "ja": "アイテムの詳細を抽出",
        "hi": "कपड़े के विवरण निकालें"
    },
    "addItem.import.failed": {
        "en": "Failed to parse receipt or import items",
        "he": "פענוח הקבלה או ייבוא הפריטים נכשל",
        "ar": "فشل تحليل الإيصال أو استيراد العناصر",
        "de": "Beleg konnte nicht analysiert oder importiert werden",
        "es": "Error al analizar el recibo o importar prendas",
        "fr": "Échec de l'analyse du reçu ou de l'importation",
        "it": "Analisi dello scontrino o importazione fallita",
        "nl": "Kan bon niet analyseren of items importeren",
        "pt": "Falha ao processar recibo ou importar itens",
        "ru": "Не удалось распознать чек или импортировать вещи",
        "zh": "解析收据或导入物品失败",
        "ja": "レシートの解析またはアイテムの取り込みに失敗しました",
        "hi": "रसीद का विश्लेषण या आइटम आयात करने में विफल"
    },
    "addItem.import.noItemsFound": {
        "en": "No garments found in imported content",
        "he": "לא נמצאו בגדים בתוכן המיובא",
        "ar": "لم يتم العثور على ملابس في المحتوى المستورد",
        "de": "Keine Kleidungsstücke im importierten Inhalt gefunden",
        "es": "No se encontraron prendas en el contenido importado",
        "fr": "Aucun vêtement trouvé dans le contenu importé",
        "it": "Nessun capo trovato nel contenuto importato",
        "nl": "Geen kledingstukken gevonden in geïmporteerde inhoud",
        "pt": "Nenhuma peça de roupa encontrada no conteúdo importado",
        "ru": "В импортированном содержимом не найдено предметов одежды",
        "zh": "在导入内容中未找到任何衣物",
        "ja": "取り込んだコンテンツに衣類が見つかりませんでした",
        "hi": "आयात की गई सामग्री में कोई कपड़े नहीं मिले"
    },
    "addItem.import.pastePrompt": {
        "en": "Please paste receipt text or confirmation email",
        "he": "אנא הדבק טקסט קבלה או הודעת אישור הזמנה",
        "ar": "يرجى لصق نص الإيصال أو رسالة تأكيد الطلب",
        "de": "Bitte füge den Belegtext oder die Bestätigungs-E-Mail ein",
        "es": "Por favor, pega el texto del recibo o el correo de confirmación",
        "fr": "Veuillez coller le texte du reçu ou l'e-mail de confirmation",
        "it": "Incolla il testo dello scontrino o l'email di conferma",
        "nl": "Plak hier de tekst van het aankoopbewijs of de bevestigingsmail",
        "pt": "Cole o texto do recibo ou e-mail de confirmação",
        "ru": "Пожалуйста, вставьте текст чека или письмо с подтверждением",
        "zh": "请粘贴收据文本或订单确认邮件",
        "ja": "レシートのテキストまたは確認メールを貼り付けてください",
        "hi": "कृपया रसीद का टेक्स्ट या पुष्टि ईमेल पेस्ट करें"
    },
    "addItem.import.receiptParsed": {
        "en": "Parsed {{count}} garments from receipt",
        "he": "פוענחו {{count}} פריטים מהקבלה",
        "ar": "تم تحليل {{count}} من الملابس من الإيصال",
        "de": "{{count}} Kleidungsstücke aus Beleg erfasst",
        "es": "{{count}} prendas analizadas del recibo",
        "fr": "{{count}} vêtements extraits du reçu",
        "it": "{{count}} capi estratti dallo scontrino",
        "nl": "{{count}} kledingstukken uit bon verwerkt",
        "pt": "{{count}} peças identificadas no recibo",
        "ru": "Распознано вещей из чека: {{count}}",
        "zh": "从收据中解析出 {{count}} 件衣物",
        "ja": "レシートから {{count}} 点のアイテムを解析しました",
        "hi": "रसीद से {{count}} कपड़े निकाले गए"
    },
    "addItem.import.selectFilePrompt": {
        "en": "Please select a file to import",
        "he": "אנא בחר קובץ לייבוא",
        "ar": "يرجى اختيار ملف للاستيراد",
        "de": "Bitte wähle eine Datei zum Importieren aus",
        "es": "Por favor, selecciona un archivo para importar",
        "fr": "Veuillez sélectionner un fichier à importer",
        "it": "Seleziona un file da importare",
        "nl": "Selecteer een bestand om te importeren",
        "pt": "Selecione um arquivo para importar",
        "ru": "Пожалуйста, выберите файл для импорта",
        "zh": "请选择要导入的文件",
        "ja": "取り込むファイルを選択してください",
        "hi": "कृपया आयात करने के लिए एक फ़ाइल चुनें"
    },
    "addItem.limitReachedMsg": {
        "en": "You have reached your free closet capacity limit (50 items). Upgrade to manage unlimited garments.",
        "he": "הגעת למגבלת הקיבולת של ארון הבגדים החינמי (50 פריטים). שדרג כדי לנהל פריטים ללא הגבלה.",
        "ar": "لقد وصلت إلى الحد الأقصى لسعة الخزانة المجانية (50 قطعة). قم بالترقية لإدارة عدد غير محدود من الملابس.",
        "de": "Du hast das Limit deines kostenlosen Kleiderschranks erreicht (50 Teile). Führe ein Upgrade durch, um unbegrenzt Kleidung zu verwalten.",
        "es": "Has alcanzado el límite de tu armario gratuito (50 prendas). Mejora tu plan para gestionar prendas ilimitadas.",
        "fr": "Vous avez atteint la limite de votre garde-robe gratuite (50 articles). Passez à la version supérieure pour gérer un nombre illimité de vêtements.",
        "it": "Hai raggiunto il limite del tuo guardaroba gratuito (50 capi). Effettua l'upgrade per gestire capi illimitati.",
        "nl": "Je hebt de limiet van je gratis kledingkast bereikt (50 items). Upgrade om onbeperkt kleding te beheren.",
        "pt": "Você atingiu o limite do seu guarda-roupa gratuito (50 peças). Faça upgrade para gerenciar roupas ilimitadas.",
        "ru": "Вы достигли лимита бесплатного гардероба (50 вещей). Перейдите на премиум, чтобы управлять неограниченным количеством вещей.",
        "zh": "您已达到免费衣橱容量上限（50件）。升级以管理无限量衣物。",
        "ja": "無料クローゼットの上限（50点）に達しました。アップグレードして無制限にアイテムを管理しましょう。",
        "hi": "आप अपनी निःशुल्क अलमारी क्षमता सीमा (50 आइटम) तक पहुँच चुके हैं। असीमित कपड़े प्रबंधित करने के लिए अपग्रेड करें।"
    },
    "addItem.limitReachedTitle": {
        "en": "Closet Capacity Reached",
        "he": "הגעת לתפוסת הארון המרבית",
        "ar": "تم الوصول إلى سعة الخزانة القصوى",
        "de": "Kapazitätsgrenze des Kleiderschranks erreicht",
        "es": "Capacidad del armario alcanzada",
        "fr": "Capacité de la garde-robe atteinte",
        "it": "Capacità massima guardaroba raggiunta",
        "nl": "Capaciteit kledingkast bereikt",
        "pt": "Capacidade do guarda-roupa atingida",
        "ru": "Лимит гардероба исчерпан",
        "zh": "已达衣橱容量上限",
        "ja": "クローゼットの容量上限に達しました",
        "hi": "अलमारी की क्षमता समाप्त"
    },
    "profile.upgradeBtn": {
        "en": "Upgrade Plan",
        "he": "שדרוג תוכנית",
        "ar": "ترقية الخطة",
        "de": "Plan upgraden",
        "es": "Mejorar plan",
        "fr": "Changer de forfait",
        "it": "Aggiorna piano",
        "nl": "Plan upgraden",
        "pt": "Fazer upgrade do plano",
        "ru": "Сменить тариф",
        "zh": "升级计划",
        "ja": "プランをアップグレード",
        "hi": "प्लान अपग्रेड करें"
    },
    "marketplace.retail": {
        "en": "Retail",
        "he": "קמעונאות",
        "ar": "بيع بالتجزئة",
        "de": "Einzelhandel",
        "es": "Minorista",
        "fr": "Commerce",
        "it": "Vendita al dettaglio",
        "nl": "Detailhandel",
        "pt": "Varejo",
        "ru": "Магазин",
        "zh": "零售",
        "ja": "リテール",
        "hi": "खुदरा"
    },
    "closet.retail": {
        "en": "Retail",
        "he": "קמעונאות",
        "ar": "بيع بالتجزئة",
        "de": "Einzelhandel",
        "es": "Minorista",
        "fr": "Commerce",
        "it": "Vendita al dettaglio",
        "nl": "Detailhandel",
        "pt": "Varejo",
        "ru": "Магазин",
        "zh": "零售",
        "ja": "リテール",
        "hi": "खुदरा"
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

for lang in LANGUAGES:
    fpath = os.path.join(locales_dir, f"{lang}.json")
    if not os.path.exists(fpath):
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    count = 0
    for key, lang_map in TRANSLATIONS.items():
        val = lang_map.get(lang, lang_map.get("en"))
        if val:
            set_nested(data, key, val)
            count += 1
            
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[{lang}] Updated {count} keys.")

print("All locales updated successfully!")
