import os
import json
import re

mobile_src = r"C:\DressApp_AG\apps\mobile\src"
web_src = r"C:\DressApp_AG\apps\web\src"
locales_dir = r"C:\DressApp_AG\packages\i18n\locales"

LANGUAGES = ["en", "he", "ar", "es", "fr", "de", "it", "pt", "nl", "ru", "zh", "ja", "hi"]

# Regex to capture t('key.path', { defaultValue: '...' }) or t("key.path", { defaultValue: "..." })
t_pattern = re.compile(r"t\(\s*['\"]([a-zA-Z0-9_.]+)['\"]\s*(?:,\s*\{([^}]*)\})?\s*\)")

def extract_keys_from_dir(dir_path):
    keys = {}
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith((".tsx", ".ts", ".jsx", ".js")):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                except Exception:
                    continue
                for match in t_pattern.finditer(content):
                    key = match.group(1)
                    opt_str = match.group(2) or ""
                    def_m = re.search(r"defaultValue:\s*['\"]([^'\"]*)['\"]", opt_str)
                    default_val = def_m.group(1) if def_m else ""
                    if key not in keys or (not keys[key] and default_val):
                        keys[key] = default_val
    return keys

mobile_keys = extract_keys_from_dir(mobile_src)
print(f"Extracted {len(mobile_keys)} keys from mobile")

def set_nested(data, key, value):
    parts = key.split(".")
    curr = data
    for i, p in enumerate(parts[:-1]):
        if p not in curr or not isinstance(curr[p], dict):
            curr[p] = {}
        curr = curr[p]
    last = parts[-1]
    if last not in curr or not curr[last]:
        curr[last] = value

def get_nested(data, key):
    parts = key.split(".")
    curr = data
    for p in parts:
        if isinstance(curr, dict) and p in curr:
            curr = curr[p]
        else:
            return None
    return curr

# Load all locale files
locale_data = {}
for lang in LANGUAGES:
    fpath = os.path.join(locales_dir, f"{lang}.json")
    if os.path.exists(fpath):
        with open(fpath, "r", encoding="utf-8") as f:
            locale_data[lang] = json.load(f)
    else:
        locale_data[lang] = {}

# Comprehensive Hebrew translations for DressApp terms
hebrew_translations = {
    "profile.sections.aiConfig": "הגדרות סטייליסט AI ומודלים",
    "profile.sections.subscription": "מנוי וקרדיטים של AI",
    "profile.sections.scheduler": "מתזמן תלבושות יומי",
    "profile.sections.styleProfile": "פרופיל סגנון ואסתטיקה",
    "profile.sections.shopping": "עוזר קניות AI ומציאת פערים",
    "profile.sections.developer": "כלי מפתח וניקוי מטמון",
    "profile.devEnvironment": "סביבה",
    "profile.devProduction": "ייצור (EAS)",
    "profile.devAppVersion": "גרסת אפליקציה",
    "profile.devApiHost": "שרת API",
    "profile.clearCacheBtn": "נקה מטמון אפליקציה מקומי",
    "profile.clearCache": "ניקוי מטמון מקומי",
    "profile.confirmClearCache": "פעולה זו תאפס את מטמון התמונות והטקסונומיה המקומיים.",
    "profile.cachePurged": "המטמון נוקה בהצלחה.",
    "profile.clearCacheFailed": "ניקוי המטמון נכשל.",
    "profile.signOutConfirm": "האם אתה בטוח שברצונך להתנתק מ-DressApp?",
    "profile.payouts.sectionTitle": "חשבונות תשלום (PayPal)",
    "profile.payouts.linked": "מחובר",
    "profile.payouts.description": "הזן את כתובת ה-PayPal המאומתת שלך לקבלת תשלומים ממכירות במרקטפלייס וייעוץ סטיילינג.",
    "profile.payouts.paypalEmail": "אימייל PayPal לקבלת כספים",
    "profile.inviteTitle": "הזמן חברים וסטייליסטים",
    "profile.shareLink": "שתף קישור הזמנה",
    "profile.shareFailed": "שיתוף קישור ההזמנה נכשל.",
    "profile.importWardrobeTitle": "ייבוא מלתחה מאפליקציות אחרות",
    "profile.importWardrobeDesc": "העבר את הקטלוג הקיים שלך בקלות מ-Whering, Acloset, Stylebook ואפליקציות מלתחה דיגיטליות נוספות.",
    "profile.importWardrobe": "ייבוא מלתחה",
    "profile.supportedPlatforms": "פלטפורמות מלתחה נתמכות",
    "profile.shoppingAssistant": "עוזר קניות AI ומציאת פערים במלתחה",
    "profile.shoppingAssistantDesc": "מנתח פערים במלתחה שלך וממליץ על פריטים בעלי תועלת גבוהה.",
    "profile.monthlyBudget": "תקציב ביגוד חודשי מוגדר ($ USD)",
    "profile.sustainableFocus": "תעדוף מותגים בני-קיימא",
    "profile.sustainableFocusDesc": "סינון הצעות לאופנה אקולוגית, מעגלית וסחר הוגן מאומתת.",
    "profile.favoriteStores": "חנויות ומותגים מועדפים",
    "profile.favoriteStoresPlaceholder": "לדוגמה: Zara, COS, Arket, Acne Studios",
    "profile.styleAesthetics": "אסתטיקה וסגנונות אופנה מועדפים",
    "profile.fitPreference": "גזרה וסילואט מועדפים לבגדים",
    "profile.dressForDemandsPlaceholder": "לדוגמה: פגישות עבודה, ימי גשם, אירועי ערב, חתונות",
    "profile.managePlanBtn": "נהל מנוי והוסף קרדיטים",
    "profile.upgradeClubBtn": "שדרג ל-DressApp Club",
    "profile.freeBenefits": "שדרג ל-DressApp Club לקבלת פריטים ללא הגבלה, סטייליסטים VIP ותזמון יומי.",
    "profile.managerBenefits": "יש לך פריטי ארון ללא הגבלה, גישה ל-Trend Scout וסטיילינג בוקר אוטומטי יומי.",
    "profile.proBenefits": "יש לך גישה מלאה לסטיילינג ללא הגבלה, דרכוני מוצר דיגיטליים ומונטיזציה במרקטפלייס.",
    "profile.selectedModel": "מודל AI פעיל",
    "profile.voiceSelection": "קול ודיבור סטייליסט AI",
    "profile.usingServerDefaults": "משתמש בקרדיטים מערכתיים משותפים.",
    "profile.uploadFace": "העלה פנים",
    "profile.uploadBody": "העלה גוף",
    "profile.height": "גובה",
    "profile.weight": "משקל",
    "profile.waist": "מותניים",
    "profile.hips": "ירכיים",
    "profile.chest": "חזה",
    "profile.shoulders": "כתפיים",
    "profile.sleeve": "שרוול",
    "profile.inseam": "תפר פנימי",
    "profile.outseam": "תפר חיצוני",
    "profile.footLength": "אורך כף רגל",
    "profile.gender": "מגדר",
    "profile.female": "נקבה",
    "profile.male": "זכר",
    "profile.maritalStatus": "מצב משפחתי",
    "profile.frequency": "תדירות",
    "profile.weatherSync": "סנכרון מזג אוויר",
    "profile.weatherSyncDesc": "התאמת המלצות באופן דינמי לגשם, טמפרטורה ושמש.",
    "profile.missingCore": "חסרות מידות ליבה",
    "profile.missingCoreDesc": "אנא הזן גובה, משקל, מותניים ואורך כף רגל להרצת חיזוי AI חכם.",
    "profile.measurementsDesc": "הזן 4 מדדי ליבה לחישוב אוטומטי של פרופורציות הגוף המלאות והמידות.",
    "profile.standardTopSize": "מידת חולצה / חלק עליון סטנדרטית",
    "profile.standardBottomSize": "מידת מכנסיים / מותניים סטנדרטית",
    "profile.shoeSize": "מידת נעליים (EU/US)",
    "profile.shoeSizePlaceholder": "EU 42 / US 9",
    "profile.dressSize": "מידת שמלה",
    "profile.dressSizePlaceholder": "US 6 / EU 38",
    "profile.firstNamePlaceholder": "שם פרטי",
    "profile.lastNamePlaceholder": "שם משפחה",
    "profile.occupationPlaceholder": "מעצב, מהנדס וכו'",
    "profile.hairColorPlaceholder": "לדוגמה: חום כהה, בלונד",
    "profile.hairStylePlaceholder": "לדוגמה: קארה מדורג, קצוץ",
    "profile.hourlyRate": "תעריף שעתי ($)",
    "profile.specialties": "התמחויות סטיילינג",
    "profile.professional.businessNamePlaceholder": "לדוגמה: סטודיו אטלייה סטייל",
    "profile.professional.businessAddressPlaceholder": "שדרות האופנה 123, פריז",
    "profile.professional.calendlyPlaceholder": "calendly.com/your-name",
    "profile.professional.bioPlaceholder": "תאר את גישת הסטיילינג שלך, הסמכות וניסיון...",
    "itemDetail.aiAnalysisTitle": "ניתוח ראייה ממוחשבת AI",
    "itemDetail.aiAnalysisDesc": "זיהוי אוטומטי של חומרים, הרמוניות צבע, רמת רשמיות ודפוסי בגדים באמצעות Gemini Vision.",
    "itemDetail.reAnalyze": "נתח מחדש",
    "itemDetail.applySuggestions": "החל הצעות AI",
    "itemDetail.outfitPairingsTitle": "שילובי תלבושות חכמים",
    "itemDetail.outfitPairingsDesc": "גלה כיצד פריט זה משתלב עם שאר פריטי המלתחה שלך לאירועים שונים.",
    "itemDetail.generateLooks": "צור לוקים",
    "itemDetail.stylistChatTitle": "ייעוץ סטייליסט AI",
    "itemDetail.stylistGreeting": "שלום! אני הסטייליסט האישי שלך. שאל אותי כל דבר על התאמה, אביזרים או שכבות עבור \"{{name}}\".",
    "itemDetail.defaultItemName": "פריט",
    "itemDetail.quickPrompt1": "איך כדאי לי להתאים את זה לדייט בערב?",
    "itemDetail.quickPrompt2": "אילו צבעים הכי מתאימים לפריט זה?",
    "itemDetail.quickPrompt3": "הצע נעליים ואביזרים לפריט זה.",
    "itemDetail.title": "פרטי פריט",
    "itemDetail.loading": "טוען פרטי פריט...",
    "itemDetail.cutout": "גזיר שקוף",
    "itemDetail.originalPhoto": "תמונה מקורית",
    "itemDetail.askStylist": "שאל סטייליסט",
    "itemDetail.findPairings": "צור לוקים",
    "itemDetail.basicInfo": "פרטים בסיסיים",
    "itemDetail.name": "שם הפריט",
    "itemDetail.namePlaceholder": "לדוגמה: חולצת משי בצבע קרם",
    "itemDetail.brand": "מותג / מעצב",
    "itemDetail.brandPlaceholder": "לדוגמה: COS, Zara, Gucci",
    "itemDetail.size": "מידה",
    "itemDetail.sizePlaceholder": "לדוגמה: M, 38, 42",
    "itemDetail.price": "מחיר רכישה ($)",
    "itemDetail.fabric": "חומר / בד",
    "itemDetail.fabricPlaceholder": "100% משי, כותנה",
    "itemDetail.classification": "טקסונומיה ומאפייני סגנון",
    "itemDetail.category": "קטגוריה",
    "itemDetail.selectCategory": "בחר קטגוריה",
    "itemDetail.subcategory": "תת-קטגוריה",
    "itemDetail.selectSubcategory": "בחר תת-קטגוריה",
    "itemDetail.colors": "צבעי פריט דומיננטיים",
    "itemDetail.formality": "רשמיות",
    "itemDetail.selectFormality": "בחר רמת רשמיות",
    "itemDetail.condition": "מצב",
    "itemDetail.selectCondition": "בחר מצב",
    "itemDetail.wardrobeIntent": "כוונת מלתחה",
    "itemDetail.keep": "לשמור",
    "itemDetail.pattern": "דפוס",
    "itemDetail.solid": "חלק",
    "itemDetail.selectIntent": "בחר כוונה",
    "itemDetail.selectPattern": "בחר דפוס",
    "itemDetail.notes": "הערות אישיות והוראות כביסה",
    "itemDetail.notesPlaceholder": "ניקוי יבש בלבד, מתאים לפנינים...",
    "itemDetail.deleteGarment": "הסר מהארון",
    "itemDetail.deleteTitle": "מחיקת פריט",
    "itemDetail.deleteConfirm": "האם אתה בטוח שברצונך להסיר פריט זה מהארון שלך? לא ניתן לבטל פעולה זו.",
    "itemDetail.deleteFailed": "מחיקת הפריט נכשלה.",
    "itemDetail.analysisComplete": "ניתוח הראייה הממוחשבת של AI הושלם!",
    "itemDetail.appliedSuggestions": "הצעות ה-AI הוחלו על הטופס.",
    "stylist.superTitle": "סטייליסט AI ואטלייה",
    "stylist.title": "הסטייליסט שלך",
    "stylist.savedOutfits": "תלבושות שמורות",
    "stylist.chatPanel": "צ'אט AI",
    "stylist.tabDaily": "לוק יומי",
    "stylist.outfitPlanner": "מתכנן",
    "stylist.virtualFitting": "מדידה",
    "stylist.tryOn": "מדידה",
    "stylist.tryOnAvatar": "מדוד על אווטאר",
    "stylist.editBody": "ערוך גוף",
    "stylist.fittingRoom": "חדר מדידה וירטואלי",
    "stylist.fittingRoomSub": "בגדים ממופים לסילואט האווטאר המותאם אישית שלך",
    "stylist.fittingLayers": "שכבות מדידה",
    "stylist.outfitCanvas": "קנבס תלבושות",
    "stylist.outfitCanvasSub": "נעל פריטים שאהבת וערבב את השאר",
    "stylist.rollShuffle": "ערבב / שילוב חדש",
    "stylist.todayProposal": "הצעת היום",
    "stylist.harmonyScore": "{{score}}% הרמוניה",
    "stylist.wearAndSave": "לבש ושמור לוק",
    "stylist.saveLook": "שמור לוק",
    "stylist.saveLookToCloset": "שמור לוק לתלבושות שלי",
    "stylist.sharedLook": "תלבושת משותפת",
    "stylist.suggestedLook": "לוק מומלץ",
    "stylist.garmentsInLook": "בגדים בלוק זה",
    "stylist.loadingLook": "טוען לוק מותאם...",
    "stylist.refreshSuccess": "נוצר לוק יומי חלופי!",
    "stylist.outfitSaved": "התלבושת נשמרה ביומן המראות שלך!",
    "stylist.saveFailed": "שמירת התלבושת נכשלה.",
    "stylist.welcomeMsg": "שלום! אני סטייליסט האופנה האישי שלך ב-AI. שאל אותי מה ללבוש, בקש לוקים לאירוע, או הקש על אחת ההצעות המהירות למטה!",
    "stylist.quickPrompts.dinnerDate": "✨ הצע לוק לדייט בערב",
    "stylist.quickPrompts.casualFriday": "💼 תלבושת קז'ואל אלגנטית למשרד",
    "stylist.quickPrompts.rainyDay": "🌧️ שכבות אלגנטיות ליום קריר וגשום",
    "stylist.quickPrompts.sneakers": "👟 מה מתאים לנעלי הספורט שלי?",
    "stylist.quickPrompts.cocktail": "🎉 מסיבת קוקטייל אלגנטית בערב",
    "stylist.quickPrompts.coffeeWalk": "☕ טיול קפה קליל בסוף השבוע",
    "stylist.prompt_date": "✨ הצע לוק לדייט בערב",
    "stylist.prompt_work": "💼 תלבושת קז'ואל למשרד",
    "stylist.prompt_rain": "🌧️ שכבות אלגנטיות ליום קריר וגשום",
    "stylist.prompt_sneakers": "👟 מה מתאים לנעלי הספורט שלי?",
    "stylist.prompt_party": "🎉 מסיבת קוקטייל אלגנטית בערב",
    "stylist.prompt_coffee": "☕ טיול קפה קליל בסוף השבוע",
    "stylist.addGarmentsFirst": "הוסף תחילה בגדים לקנבס התלבושות שלך.",
    "stylist.plannedCanvasLook": "לוק קנבס מתוכנן",
    "stylist.assembledViaCanvas": "הורכב באמצעות קנבס מתכנן התלבושות",
    "stylist.lookNumber": "לוק מס' {{num}}",
    "stylist.micPermissionDesc": "אנא הענק גישה למיקרופון כדי לדבר עם הסטייליסט שלך.",
    "stylist.micStartFailed": "הפעלת הקלטת המיקרופון נכשלה.",
    "stylist.audioProcessFailed": "עיבוד קובץ השמע נכשל.",
    "outfits.lookGarments": "בגדים בלוק זה",
    "outfits.pieces": "פריטים",
    "outfits.shareMessage": "צפו בתלבושת שלי ב-DressApp: {{name}}! {{url}}",
    "outfits.defaultLookName": "לוק מעוצב",
    "outfits.deleteTitle": "מחיקת תלבושת",
    "outfits.deleteMessage": "האם להסיר לוק זה מהאוסף השמור שלך?",
    "suitcase.assistant": "עוזר מזוודה",
    "suitcase.title": "מתכנן מזוודה חכם",
    "suitcase.tripDetails": "1. יעד ומשך נסיעה",
    "suitcase.destPlaceholder": "לדוגמה: רומא, איטליה",
    "suitcase.destination": "יעד (לדוגמה: פריז, צרפת)",
    "suitcase.destRequired": "אנא הזן יעד.",
    "suitcase.destinationRequired": "נדרש יעד",
    "suitcase.enterDestination": "אנא הזן יעד.",
    "suitcase.duration": "משך הנסיעה",
    "suitcase.days": "ימים",
    "suitcase.purpose": "מטרת הנסיעה",
    "suitcase.vacation": "🏖️ חופשה ופנאי",
    "suitcase.business": "💼 עסקים ופגישות",
    "suitcase.cityBreak": "🏙️ חופשה עירונית",
    "suitcase.event": "🥂 אירוע רשמי / חתונה",
    "suitcase.active": "🏔️ טיולים וספורט",
    "suitcase.generateList": "צור רשימת אריזה חכמה",
    "suitcase.packForMe": "ארוז עבורי באמצעות AI",
    "suitcase.packingList": "רשימת אריזה",
    "suitcase.packingProgress": "צ'ק ליסט מזוודה",
    "suitcase.emptyList": "עדיין לא נארזו פריטים.",
    "suitcase.removeItem": "הסר פריט",
    "suitcase.removeItemMsg": "להסיר פריט זה מרשימת האריזה?",
    "suitcase.startDate": "מתאריך (YYYY-MM-DD)",
    "suitcase.endDate": "עד תאריך (YYYY-MM-DD)",
    "suitcase.startTrip": "התחל נסיעה",
    "suitcase.updateTrip": "עדכן נסיעה",
    "trends.trendScout": "סייר הטרנדים",
    "trends.scout": "מודיעין אופנה עולמי",
    "trends.empty": "עדיין לא נטענו טרנדים.",
    "trends.noTrendsFound": "אין כתבות זמינות כרגע",
    "trends.noTrendsDesc": "בדוק שוב מאוחר יותר לעדכוני מסלול וסטריט סטייל יומיים חדשים.",
    "trends.readFullStory": "קרא ניתוח מלא",
    "trends.runway": "מסלול ואופנה עילית",
    "trends.street": "אופנת רחוב גלובלית",
    "trends.sustainable": "אופנה אקולוגית ומעגלית",
    "trends.colors": "תחזיות צבעים",
    "trends.influencers": "סלבריטאים ושטיח אדום",
    "trends.news": "חדשות התעשייה",
    "stats.title": "תובנות מלתחה",
    "stats.utilisation": "ניצולת",
    "stats.utilisationSub": "פריטים שנלבשו",
    "stats.carbon": "טביעת פחמן",
    "stats.cpwTrend": "מגמת עלות לפי לבישה",
    "stats.intake": "כיצד נוספו הפריטים",
    "stats.receipt": "מתוך קבלות",
    "stats.manual": "נוספו ידנית",
    "market.forSale": "למכירה",
    "market.swap": "החלפה",
    "market.donate": "תרומה",
    "market.rent": "השכרה",
    "market.retail": "קמעונאות",
    "market.garment": "פריט לבוש",
    "market.free": "חינם",
    "market.swapLabel": "הצע החלפה",
    "market.claimDonate": "קבל בחינם",
    "market.proposeSwap": "הצע החלפה",
    "market.buy": "קנה עכשיו",
    "market.seller": "מוכר",
    "market.itemRequired": "בחר פריט",
    "market.pickFromCloset": "בחר פריט מהארון שלך לפרסום.",
    "market.listingType": "סוג פרסום",
    "market.selectItem": "פריט מהארון *",
    "market.sale": "מכירה",
    "campaigns.adsManagerTitle": "מודעות ומסעות פרסום",
    "campaigns.overview": "ביצועי מפרסם",
    "campaigns.totalImpressions": "סה\"כ חשיפות",
    "campaigns.totalClicks": "סה\"כ קליקים",
    "campaigns.totalSpend": "סה\"כ הוצאות",
    "campaigns.avgCtr": "שיעור קליקים ממוצע",
    "campaigns.create.title": "צור מסע פרסום",
    "campaigns.create.basic.titlePlaceholder": "שם מסע הפרסום",
    "campaigns.create.basic.shortDescriptionPlaceholder": "תיאור קצר",
    "campaigns.noCampaigns": "אין מבצעים פעילים כרגע",
    "campaigns.nameAndHeadlineRequired": "אנא ספק שם וכותרת למסע הפרסום.",
    "campaigns.campaignCreatedSuccess": "מסע הפרסום נוצר ונשלח לבדיקה!",
    "campaigns.campaignCreateFailed": "יצירת מסע הפרסום נכשלה.",
    "campaigns.loading": "טוען מסעות פרסום...",
    "campaigns.cancelTitle": "ביטול מסע פרסום",
    "campaigns.cancelMsg": "פעולה זו היא לצמיתות ולא ניתנת לביטול. מסע הפרסום יבוטל לצמיתות.",
    "campaigns.confirmCancel": "בטל מסע פרסום",
    "campaigns.shareMessage": "בדוק את מסע הפרסום הזה: {{title}}",
    "experts.bookingTitle": "הזמן פגישת סטיילינג",
    "experts.standardSession": "ביקורת וסטיילינג אישיים של המלתחה (1 על 1)",
    "experts.serviceDesc": "ייעוץ וידאו של 45 דקות לבדיקת הארון הדיגיטלי שלך, פרופורציות הגוף ותוכנית תלבושות מותאמת אישית.",
    "experts.sendBookingRequest": "אשר הזמנה",
    "experts.bookingSent": "בקשת הסטיילינג נשלחה! הסטייליסט יצור איתך קשר לתיאום.",
    "experts.professional": "סטייליסט אופנה",
    "experts.professions.all": "כל המומחים",
    "experts.professions.stylist": "סטייליסט אישי",
    "experts.professions.consultant": "יועץ מלתחה",
    "experts.professions.shopper": "קניין אישי",
    "experts.professions.designer": "מעצב אופנה",
    "experts.professions.tailor": "חייט / תופרת",
    "experts.professions.color": "אנליסט צבעים",
    "closet.bulkDeleteTitle": "מחיקת פריטים",
    "closet.bulkDeleteConfirm": "האם להסיר {{count}} פריטים נבחרים מהארון שלך?",
    "closet.bulkDeleteSuccess": "הבגדים הנבחרים הוסרו בהצלחה.",
    "closet.bulkDeleteFailed": "מחיקת חלק מהפריטים נכשלה.",
    "closet.garmentsRemoved": "הבגדים הנבחרים הוסרו בהצלחה.",
    "closet.deleteFailed": "מחיקת חלק מהפריטים נכשלה.",
    "closet.unnamedItem": "פריט לבוש",
    "closet.filterAll": "הכל",
    "closetAdd.gallery": "גלריה",
    "closetAdd.camera": "מצלמה",
    "closetAdd.itemDetails": "פרטי פריט",
    "closetAdd.name": "שם הפריט",
    "closetAdd.selectCategory": "בחר קטגוריה",
    "closetAdd.color": "צבע",
    "closetAdd.size": "מידה",
    "closetAdd.brand": "מותג",
    "closetAdd.submit": "הוסף לארון",
    "closetAdd.photoPermission": "אנא אפשר גישה לגלריית התמונות שלך.",
    "closetAdd.imageRequired": "נדרשת תמונה",
    "closetAdd.pleaseAddImage": "אנא הוסף תמונה של הפריט שלך.",
    "auth.tagline": "מלתחת ה-AI החכמה שלך",
    "auth.welcomeBack": "ברוך שובך",
    "auth.signInSub": "התחבר כדי להמשיך ל-DressApp",
    "auth.continueWithGoogle": "המשך עם Google",
    "auth.continueAsGuest": "חקור כאורח",
    "auth.noAccount": "אין לך חשבון? הירשם עכשיו",
    "auth.guestLoginError": "ההתחברות כאורח נכשלה.",
    "deleteAccount.title": "מחיקת חשבון",
    "deleteAccount.subtitle": "פעולה זו היא לצמיתות ולא ניתנת לביטול. כל פריטי הארון, התלבושות וההעדפות שלך יימחקו.",
    "deleteAccount.passwordLabel": "אשר את הסיסמה שלך (אופציונלי)",
    "deleteAccount.confirm": "מחק את החשבון שלי לצמיתות",
    "deleteAccount.confirmTitle": "מחיקת חשבון",
    "deleteAccount.confirmMsg": "פעולה זו תמחק לצמיתות את חשבונך ואת כל הנתונים שלך. לא ניתן לבטל פעולה זו.",
    "extension.title": "סנכרון תוסף Chrome",
    "extension.heroTitle": "חבר את תוסף הדפדפן של DressApp",
    "extension.heroDesc": "לכוד וייבא באופן מיידי פריטי לבוש, מידות וטבלאות מידות לארון הנייד שלך בעת גלישה בחנויות מקוונות (Zara, ASOS, Mango, Farfetch ועוד).",
    "extension.codeCopied": "קוד ההצמדה הועתק ללוח!",
    "transactions.mockSuccess": "תשלום הדגמה אושר בהצלחה! העסקה שלך אושרה.",
    "transactions.mockFailed": "השלמת עסקת הדגמה נכשלה.",
    "transactions.cancelled": "התשלום בוטל",
    "transactions.cancelledDesc": "העסקה לא הושלמה.",
    "admin.campaignApproved": "מסע פרסום {{id}} אושר ופורסם.",
    "admin.campaignRejected": "מסע פרסום {{id}} נדחה.",
    "aiConfig.apiKeyRequired": "אנא הזן מפתח API תקין.",
    "aiConfig.apiKeySaved": "מפתח ה-API נשמר בצורה מאובטחת.",
    "aiConfig.apiKeyFailed": "שמירת מפתח ה-API נכשלה.",
    "avatar.selectImageFailed": "בחירת התמונה נכשלה.",
    "avatar.saveAvatarFailed": "שמירת הגדרות האווטאר נכשלה.",
    "common.photoLibraryPermissionDesc": "נדרשת גישה לגלריית התמונות כדי לבחור תמונה.",
}

# Update en.json with fallback defaultValue
for key, def_val in mobile_keys.items():
    if not def_val:
        continue
    existing_en = get_nested(locale_data["en"], key)
    if existing_en is None:
        set_nested(locale_data["en"], key, def_val)

# Update he.json with rich Hebrew translations
for key, def_val in mobile_keys.items():
    if key in hebrew_translations:
        set_nested(locale_data["he"], key, hebrew_translations[key])
    else:
        existing_he = get_nested(locale_data["he"], key)
        if existing_he is None:
            # Fallback to English value if specific Hebrew not provided
            set_nested(locale_data["he"], key, def_val or key.split(".")[-1])

# For all other languages, ensure key exists
for lang in LANGUAGES:
    if lang in ["en", "he"]:
        continue
    for key, def_val in mobile_keys.items():
        existing = get_nested(locale_data[lang], key)
        if existing is None:
            # Inherit from en defaultValue
            set_nested(locale_data[lang], key, def_val or key.split(".")[-1])

# Save all updated locale files
for lang in LANGUAGES:
    fpath = os.path.join(locales_dir, f"{lang}.json")
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(locale_data[lang], f, ensure_ascii=False, indent=2)
    print(f"Updated {lang}.json successfully.")

print("All 13 locales synchronized!")
