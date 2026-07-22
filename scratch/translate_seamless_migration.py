import json
import os

LOCALES_DIR = r"C:\DressApp_AG\frontend\src\locales"

TRANSLATIONS = {
    "en": {
        "seamlessTitle": "Connect & Log In to Previous App",
        "seamlessSub": "Select or enter your previous app. DressApp will open the secure login portal to connect your account.",
        "searchAppLabel": "Popular Digital Wardrobes:",
        "searchAppPlaceholder": "e.g. Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "Log in to {{appName}} & Connect",
        "permissionTitle": "Authorize Wardrobe & Outfits Migration",
        "permissionSub": "You are authenticated with {{appName}}. Do you grant DressApp permission to access your database and sync all your Closet items and Saved Outfits?",
        "grantPermissionBtn": "Grant & Sync",
        "syncingTitle": "Syncing Database from {{appName}}...",
        "statusConnecting": "Connecting to {{appName}} database...",
        "statusItems": "Extracting wardrobe garments...",
        "statusOutfits": "Mapping saved outfit combinations...",
        "statusFinalizing": "Finalizing DressApp closet database sync...",
        "successTitle": "Migration Completed Successfully!",
        "successSub": "Your wardrobe items and saved outfits from {{appName}} have been fully imported into your DressApp closet.",
        "summaryItems": "{{count}} Clothes Imported",
        "summaryOutfits": "{{count}} Outfits Imported",
        "okToCloset": "OK - Open Closet"
    },
    "es": {
        "seamlessTitle": "Conectar e Iniciar Sesión en App Anterior",
        "seamlessSub": "Selecciona tu aplicación de armario anterior. DressApp abrirá el portal de inicio de sesión seguro.",
        "searchAppLabel": "Armarios Digitales Populares:",
        "searchAppPlaceholder": "ej. Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "Iniciar sesión en {{appName}} y Conectar",
        "permissionTitle": "Autorizar Migración de Armario y Conjuntos",
        "permissionSub": "Estás autenticado con {{appName}}. ¿Concedes permiso a DressApp para acceder a tu base de datos y sincronizar ropa y conjuntos?",
        "grantPermissionBtn": "Conceder y Sincronizar",
        "syncingTitle": "Sincronizando Base de Datos desde {{appName}}...",
        "statusConnecting": "Conectando a la base de datos de {{appName}}...",
        "statusItems": "Extrayendo prendas de vestir...",
        "statusOutfits": "Mapeando combinaciones de conjuntos guardados...",
        "statusFinalizing": "Finalizando sincronización del armario de DressApp...",
        "successTitle": "¡Migración Completada con Éxito!",
        "successSub": "Tus prendas y conjuntos guardados de {{appName}} se han importado completamente en tu armario de DressApp.",
        "summaryItems": "{{count}} Prendas Importadas",
        "summaryOutfits": "{{count}} Conjuntos Importados",
        "okToCloset": "Aceptar - Abrir Armario"
    },
    "fr": {
        "seamlessTitle": "Se Connecter à l'Ancienne Application",
        "seamlessSub": "Sélectionnez votre ancienne application de garde-robe. DressApp ouvrira le portail de connexion sécurisé.",
        "searchAppLabel": "Garde-robes Numériques Populaires:",
        "searchAppPlaceholder": "ex. Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "Se connecter à {{appName}} et Connecter",
        "permissionTitle": "Autoriser la Migration de la Garde-robe et des Tenues",
        "permissionSub": "Vous êtes authentifié avec {{appName}}. Autorisez-vous DressApp à accéder à votre base de données et à synchroniser vos vêtements et tenues?",
        "grantPermissionBtn": "Autoriser et Synchroniser",
        "syncingTitle": "Synchronisation de la Base de Données depuis {{appName}}...",
        "statusConnecting": "Connexion à la base de données {{appName}}...",
        "statusItems": "Extraction des vêtements...",
        "statusOutfits": "Cartographie des combinaisons de tenues enregistrées...",
        "statusFinalizing": "Finalisation de la synchronisation de la garde-robe DressApp...",
        "successTitle": "Migration Terminée avec Succès!",
        "successSub": "Vos vêtements et tenues sauvegardées de {{appName}} ont été entièrement importés dans votre dressing DressApp.",
        "summaryItems": "{{count}} Vêtements Importés",
        "summaryOutfits": "{{count}} Tenues Importées",
        "okToCloset": "OK - Ouvrir le Dressing"
    },
    "de": {
        "seamlessTitle": "Mit Vorheriger App Verbinden & Anmelden",
        "seamlessSub": "Wählen Sie Ihre vorherige Kleiderschrank-App aus. DressApp öffnet das sichere Anmeldeportal.",
        "searchAppLabel": "Beliebte Digitale Kleiderschränke:",
        "searchAppPlaceholder": "z.B. Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "Bei {{appName}} Anmelden & Verbinden",
        "permissionTitle": "Migration von Kleiderschrank & Outfits Autorisieren",
        "permissionSub": "Sie sind bei {{appName}} angemeldet. Erteilen Sie DressApp die Berechtigung, auf Ihre Datenbank zuzugreifen und Kleidung & Outfits zu synchronisieren?",
        "grantPermissionBtn": "Genehmigen & Synchronisieren",
        "syncingTitle": "Datenbank wird von {{appName}} Synchronisiert...",
        "statusConnecting": "Verbindung zur {{appName}}-Datenbank wird hergestellt...",
        "statusItems": "Kleidungsstücke werden extrahiert...",
        "statusOutfits": "Gespeicherte Outfit-Kombinationen werden zugeordnet...",
        "statusFinalizing": "DressApp Kleiderschrank-Synchronisation wird abgeschlossen...",
        "successTitle": "Migration Erfolgreich Abgeschlossen!",
        "successSub": "Ihre Kleidungsstücke und gespeicherten Outfits aus {{appName}} wurden vollständig in Ihren DressApp-Kleiderschrank importiert.",
        "summaryItems": "{{count}} Kleidungsstücke Importiert",
        "summaryOutfits": "{{count}} Outfits Importiert",
        "okToCloset": "OK - Kleiderschrank Öffnen"
    },
    "it": {
        "seamlessTitle": "Connetti e Accedi all'App Precedente",
        "seamlessSub": "Seleziona la tua precedente app per il guardaroba. DressApp aprirà il portale di accesso sicuro.",
        "searchAppLabel": "Guardaroba Digitali Popolari:",
        "searchAppPlaceholder": "es. Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "Accedi a {{appName}} e Connetti",
        "permissionTitle": "Autorizza la Migrazione del Guardaroba e degli Outfit",
        "permissionSub": "Sei autenticato con {{appName}}. Concedi a DressApp il permesso di accedere al tuo database e sincronizzare vestiti e outfit salvati?",
        "grantPermissionBtn": "Autorizza e Sincronizza",
        "syncingTitle": "Sincronizzazione Database da {{appName}}...",
        "statusConnecting": "Connessione al database di {{appName}} in corso...",
        "statusItems": "Estrazione dei capi di abbigliamento...",
        "statusOutfits": "Mappatura delle combinazioni di outfit salvate...",
        "statusFinalizing": "Finalizzazione della sincronizzazione del guardaroba DressApp...",
        "successTitle": "Migrazione Completata con Successo!",
        "successSub": "I tuoi vestiti e outfit salvati da {{appName}} sono stati completamente importati nel tuo guardaroba DressApp.",
        "summaryItems": "{{count}} Capi Importati",
        "summaryOutfits": "{{count}} Outfit Importati",
        "okToCloset": "OK - Apri Guardaroba"
    },
    "pt": {
        "seamlessTitle": "Conectar e Entrar na Aplicação Anterior",
        "seamlessSub": "Selecione a sua aplicação de guarda-roupa anterior. O DressApp abrirá o portal de início de sessão seguro.",
        "searchAppLabel": "Guarda-Roupas Digitais Populares:",
        "searchAppPlaceholder": "ex. Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "Entrar no {{appName}} e Conectar",
        "permissionTitle": "Autorizar Migração de Guarda-Roupa e Conjuntos",
        "permissionSub": "Está autenticado no {{appName}}. Concede permissão ao DressApp para aceder à sua base de dados e sincronizar roupas e conjuntos?",
        "grantPermissionBtn": "Conceder e Sincronizar",
        "syncingTitle": "A Sincronizar Base de Dados do {{appName}}...",
        "statusConnecting": "A ligar à base de dados do {{appName}}...",
        "statusItems": "A extrair peças de vestuário...",
        "statusOutfits": "A mapear combinações de conjuntos guardados...",
        "statusFinalizing": "A finalizar sincronização do guarda-roupa do DressApp...",
        "successTitle": "Migração Concluída com Sucesso!",
        "successSub": "As suas roupas e conjuntos guardados do {{appName}} foram totalmente importados para o seu guarda-roupa DressApp.",
        "summaryItems": "{{count}} Roupas Importadas",
        "summaryOutfits": "{{count}} Conjuntos Importados",
        "okToCloset": "OK - Abrir Guarda-Roupa"
    },
    "ru": {
        "seamlessTitle": "Подключение и Вход в Предыдущее Приложение",
        "seamlessSub": "Выберите ваше предыдущее приложение гардероба. DressApp откроет безопасный портал входа.",
        "searchAppLabel": "Популярные Цифровые Гардеробы:",
        "searchAppPlaceholder": "напр. Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "Войти в {{appName}} и Подключить",
        "permissionTitle": "Разрешить Миграцию Гардероба и Образов",
        "permissionSub": "Вы авторизованы в {{appName}}. Разрешаете ли вы DressApp доступ к вашей базе данных для синхронизации одежды и образов?",
        "grantPermissionBtn": "Разрешить и Синхронизировать",
        "syncingTitle": "Синхронизация Базы Данных из {{appName}}...",
        "statusConnecting": "Подключение к базе данных {{appName}}...",
        "statusItems": "Извлечение предметов одежды...",
        "statusOutfits": "Сопоставление сохраненных комбинаций образов...",
        "statusFinalizing": "Завершение синхронизации гардероба DressApp...",
        "successTitle": "Миграция Успешно Завершена!",
        "successSub": "Ваша одежда и сохраненные образы из {{appName}} полностью импортированы в ваш гардероб DressApp.",
        "summaryItems": "Импортировано одежды: {{count}}",
        "summaryOutfits": "Импортировано образов: {{count}}",
        "okToCloset": "ОК - Открыть Гардероб"
    },
    "zh": {
        "seamlessTitle": "无缝连接并登录原衣橱应用",
        "seamlessSub": "选择或输入您之前使用的数字衣橱应用，DressApp 将打开安全登录入口连接您的账户。",
        "searchAppLabel": "热门数字衣橱:",
        "searchAppPlaceholder": "例如 Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "登录 {{appName}} 并连接",
        "permissionTitle": "授权衣橱与搭配数据库迁移",
        "permissionSub": "您已成功验证 {{appName}} 身份。是否授权 DressApp 访问该数据库并同步所有衣物及已保存搭配？",
        "grantPermissionBtn": "授权并开始同步",
        "syncingTitle": "正在从 {{appName}} 同步数据库...",
        "statusConnecting": "正在连接 {{appName}} 数据库...",
        "statusItems": "正在提取衣物数据...",
        "statusOutfits": "正在匹配已保存搭配组合...",
        "statusFinalizing": "正在完成 DressApp 衣橱数据库同步...",
        "successTitle": "迁移成功完成！",
        "successSub": "您来自 {{appName}} 的所有衣物与已保存搭配已完整导入您的 DressApp 衣橱。",
        "summaryItems": "已导入 {{count}} 件衣物",
        "summaryOutfits": "已导入 {{count}} 套搭配",
        "okToCloset": "确定 - 打开衣橱"
    },
    "ja": {
        "seamlessTitle": "以前のアプリに接続＆ログイン",
        "seamlessSub": "以前使用していたクローゼットアプリを選択してください。DressAppが安全なログインポータルを開きます。",
        "searchAppLabel": "人気のデジタルクローゼット:",
        "searchAppPlaceholder": "例: Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "{{appName}} にログインして接続",
        "permissionTitle": "クローゼット＆コーディネート移行の承認",
        "permissionSub": "{{appName}} で認証されました。DressAppがデータベースにアクセスし、服とコーディネートを同期することを許可しますか？",
        "grantPermissionBtn": "許可して同期開始",
        "syncingTitle": "{{appName}} からデータベースを同期中...",
        "statusConnecting": "{{appName}} データベースに接続中...",
        "statusItems": "衣类データを抽出中...",
        "statusOutfits": "保存されたコーディネートをマッピング中...",
        "statusFinalizing": "DressAppクローゼットの同期を完了中...",
        "successTitle": "移行が正常に完了しました！",
        "successSub": "{{appName}} の服と保存されたコーディネートがDressAppクローゼットに正常にインポートされました。",
        "summaryItems": "インポートした服: {{count}}着",
        "summaryOutfits": "インポートしたコーデ: {{count}}件",
        "okToCloset": "OK - クローゼットを開く"
    },
    "ar": {
        "seamlessTitle": "الاتصال وتسجيل الدخول إلى التطبيق السابق",
        "seamlessSub": "اختر تطبيق الخزانة الرقمية السابق. سيفتح DressApp بوابة تسجيل الدخول الآمنة.",
        "searchAppLabel": "الخزانات الرقمية الشائعة:",
        "searchAppPlaceholder": "مثل Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "تسجيل الدخول إلى {{appName}} والاتصال",
        "permissionTitle": "الترخيص بنقل الملابس والتنسيقات",
        "permissionSub": "لقد تم التحقق من حسابك في {{appName}}. هل تمنح DressApp الإذن للوصول إلى قاعدة البيانات ومزامنة الملابس والتنسيقات؟",
        "grantPermissionBtn": "منح الإذن والمزامنة",
        "syncingTitle": "جاري مزامنة قاعدة البيانات من {{appName}}...",
        "statusConnecting": "جاري الاتصال بقاعدة بيانات {{appName}}...",
        "statusItems": "جاري استخراج قطع الملابس...",
        "statusOutfits": "جاري تعيين تنسيقات الملابس المحفوظة...",
        "statusFinalizing": "جاري إنهاء مزامنة خزانة DressApp...",
        "successTitle": "تمت عملية النقل بنجاح!",
        "successSub": "تم استيراد ملابسك وتنسيقاتك المحفوظة من {{appName}} بنجاح إلى خزانة DressApp.",
        "summaryItems": "تم استيراد {{count}} قطعة ملابس",
        "summaryOutfits": "تم استيراد {{count}} إطلالة",
        "okToCloset": "موافق - فتح الخزانة"
    },
    "hi": {
        "seamlessTitle": "पिछले ऐप से कनेक्ट और लॉगिन करें",
        "seamlessSub": "अपना पिछला अलमारी ऐप चुनें। DressApp आपका अकाउंट कनेक्ट करने के लिए सुरक्षित लॉगिन पोर्टल खोलेगा।",
        "searchAppLabel": "लोकप्रिय डिजिटल अलमारियां:",
        "searchAppPlaceholder": "जैसे Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "{{appName}} में लॉगिन करें और कनेक्ट करें",
        "permissionTitle": "कपड़ों और आउटफिट्स माइग्रेशन को अधिकृत करें",
        "permissionSub": "आप {{appName}} के साथ प्रमाणित हैं। क्या आप DressApp को अपने डेटाबेस तक पहुँचने और कपड़ों तथा आउटफिट्स को सिंक करने की अनुमति देते हैं?",
        "grantPermissionBtn": "अनुमति दें और सिंक करें",
        "syncingTitle": "{{appName}} से डेटाबेस सिंक हो रहा है...",
        "statusConnecting": "{{appName}} डेटाबेस से कनेक्ट हो रहा है...",
        "statusItems": "कपड़े निकाले जा रहे हैं...",
        "statusOutfits": "सेव किए गए आउटफिट्स मैप किए जा रहे हैं...",
        "statusFinalizing": "DressApp अलमारी डेटाबेस सिंक पूरा किया जा रहा है...",
        "successTitle": "माइग्रेशन सफलतापूर्वक पूरा हुआ!",
        "successSub": "{{appName}} से आपके कपड़े और सेव किए गए आउटफिट्स पूरी तरह से आपकी DressApp अलमारी में इम्पोर्ट कर लिए गए हैं।",
        "summaryItems": "{{count}} कपड़े इम्पोर्ट किए गए",
        "summaryOutfits": "{{count}} आउटफिट्स इम्पोर्ट किए गए",
        "okToCloset": "ओके - अलमारी खोलें"
    },
    "he": {
        "seamlessTitle": "התחברות וחיבור לאפליקציה הקודמת",
        "seamlessSub": "בחר את אפליקציית הארון הקודמת שלך. DressApp תפתח פורטל התחברות מאובטח.",
        "searchAppLabel": "ארונות דיגיטליים פופולריים:",
        "searchAppPlaceholder": "למשל Acloset, Stylebook, Whering, Smartli, BeautyAI",
        "loginToAppBtn": "התחבר ל-{{appName}} והתחבר",
        "permissionTitle": "אישור העברת ארון ותלבושות",
        "permissionSub": "אומתת בהצלחה ב-{{appName}}. האם אתה מעניק ל-DressApp הרשאה לגשת למסד הנתונים ולסנכרן בגדים ותלבושות שמורות?",
        "grantPermissionBtn": "אשר וסנכרן",
        "syncingTitle": "מסנכרן מסד נתונים מ-{{appName}}...",
        "statusConnecting": "מתחבר למסד הנתונים של {{appName}}...",
        "statusItems": "מחלץ פריטי לבוש...",
        "statusOutfits": "ממפה שילובי תלבושות שמורות...",
        "statusFinalizing": "משלים סנכרון ארון DressApp...",
        "successTitle": "ההעברה הושלמה בהצלחה!",
        "successSub": "פריטי הלבוש והתלבושות השמורות מ-{{appName}} יובאו במלואם לארון DressApp שלך.",
        "summaryItems": "{{count}} פריטי לבוש יובאו",
        "summaryOutfits": "{{count}} תלבושות יובאו",
        "okToCloset": "אישור - פתח ארון"
    }
}

def main():
    for lang, translations in TRANSLATIONS.items():
        file_path = os.path.join(LOCALES_DIR, f"{lang}.json")
        if not os.path.exists(file_path):
            print(f"Skipping missing file: {file_path}")
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "migration" not in data:
            data["migration"] = {}

        for k, v in translations.items():
            data["migration"][k] = v

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"Updated {lang}.json with {len(translations)} migration keys.")

if __name__ == "__main__":
    main()
