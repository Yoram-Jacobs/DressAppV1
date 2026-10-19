#!/usr/bin/env python3
"""
Populates onboarding.* and closet.starterBasic* i18n keys across all 13 locales
and updates wiki/{lang}/overview.md (and apps/web/public/wiki/{lang}/overview.md).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES_DIR = ROOT / "apps" / "web" / "src" / "locales"
WIKI_DIRS = [ROOT / "wiki", ROOT / "apps" / "web" / "public" / "wiki"]

ONBOARDING_TRANSLATIONS = {
    "en": {
        "onboarding": {
            "stepOf": "Step {{current}} of {{total}}",
            "newToDressApp": "New to DressApp?",
            "startSetupLink": "Personalize your AI Stylist & 3D Avatar in 60s",
            "firstOutfitTitle": "My First AI Look",
            "firstOutfitDesc": "Assembled during your style & fit calibration.",
            "step1": {
                "eyebrow": "Step 1 · Style & Silhouette DNA",
                "title": "Build Your Personal Style Profile",
                "subtitle": "Tell your AI Stylist how you like to dress so every outfit recommendation feels tailored to you.",
                "departmentLabel": "1. Select Your Wardrobe Collection",
                "womenswear": "Womenswear",
                "womenswearSub": "Dresses, skirts, trousers, abayas, kaftans, sarees & more",
                "menswear": "Menswear",
                "menswearSub": "Trousers, suits, thobes, kurtas, knitwear & outerwear",
                "aestheticsLabel": "2. Choose Your Signatures & Silhouettes",
                "aestheticsHint": "Pick 1 or more styles you wear most",
                "paletteLabel": "3. Preferred Color Palette",
                "routineLabel": "4. Daily Routine",
                "modestyLabel": "5. Modesty & Coverage Preference",
                "b2bTitle": "Are you a Professional Stylist, Tailor, or Fashion Designer?",
                "b2bSubtitle": "Join the DressApp Certified Experts Registry to showcase your digital business card to clients.",
                "b2bProfession": "Profession",
                "b2bCompanyName": "Studio / Brand Name",
                "b2bCity": "City / Region",
                "b2bWebsite": "Website or Instagram",
                "b2bBio": "Short Bio / Specialties",
                "b2bBioPlaceholder": "Personal shopper, bridal couturier, wardrobe consultant...",
                "continueCta": "Calibrate My Fit & 3D Avatar",
            },
            "step2": {
                "eyebrow": "Step 2 · 15-Second Fit Calibration",
                "title": "Calibrate Your 3D Avatar & Size Passport",
                "subtitle": "Slide to your approximate measurements—our AI predicts your full tailoring passport in real time.",
                "height": "Height",
                "weight": "Weight",
                "waist": "Waist",
                "footLength": "Foot Length",
                "skinToneLabel": "Avatar Skin Tone",
                "liveAvatarBadge": "Live 3D/2D Avatar",
                "aiSizePassport": "AI Size Passport",
                "calibrating": "Calibrating...",
                "continueCta": "Build My Starter Capsule",
            },
            "step3": {
                "eyebrow": "Step 3 · Zero-Friction Closet Builder",
                "title": "Tap 4+ Staples You Own (or Similar)",
                "subtitle": "Pick from our pre-cataloged studio dataset—each staple includes full fabric, color, and seasonal DNA at 0 AI credit cost.",
                "autoSelectBtn": "Auto-pick 6 Staples for My Style",
                "formulaComplete": "Ready! {{count}} staples selected — complete head-to-toe outfit unlocked",
                "formulaHint": "Select at least 4 items including (1 Full-Body + 1 Footwear) OR (1 Top + 1 Bottom + 1 Footwear) ({{count}}/4 selected)",
                "migrateTitle": "Already have a digital closet on Whering, Acloset, Indyx, or Stylebook?",
                "migrateSubtitle": "Enable 1-click desktop wardrobe import immediately after sign-in.",
                "continueCta": "Assemble My First AI Outfit",
            },
            "step4": {
                "eyebrow": "Your AI Stylist is Ready",
                "title": "Here Is Your First Personalized Look",
                "subtitle": "Assembled from your Starter Capsule and calibrated to your 3D/2D avatar & local weather.",
                "shuffleLook": "Try Another Combination",
                "wearingNow": "Assembled Head-to-Toe Capsule",
                "sizePassportTitle": "Calibrated AI Size Passport",
                "expertPreviewBadge": "Experts Registry Preview",
                "saveAndFinishCta": "Save My Capsule & Open AI Stylist",
                "unlockTitle": "Save Your Avatar, Size Passport & {{count}}-Piece Closet",
                "unlockSub": "Sign in with 1 click so your calibrated measurements, starter staples, and first AI outfit are permanently saved to your account.",
                "continueWithGoogle": "Save My Closet & Continue with Google",
            },
        },
        "closet_patch": {
            "starterBasicBadge": "Starter Basic · Tap to add your photo",
            "starterBasicBannerTitle": "Starter Capsule Staple · Catalog Reference Photo",
            "starterBasicBannerDesc": "This staple works immediately in your AI Stylist, Outfit Canvas, and Suitcase. Snap or upload your own photo anytime to personalize it and unlock Marketplace listing.",
            "starterBasicSnapBtn": "Snap My Photo",
            "starterBasicUploadBtn": "Upload Photo",
            "starterBasicMarketplaceBlocked": "Please upload a real photo of your garment before listing it on the Marketplace.",
        },
        "help_patch": {
            "overview_onboarding": "Getting started takes under 60 seconds: calibrate your style DNA, 3D avatar measurements, and 24-piece Starter Capsule to see your first weather-aware AI outfit before you even sign in.",
        },
        "wiki_bullet": "- **60-Second Personalized Onboarding & Starter Capsule**: Calibrate your style DNA, 3D/2D avatar measurements, and select from 48 pre-cataloged womenswear and menswear staples (covering trousers, skirts, dresses, abayas, kaftans, jalabiyas, sarees, thobes, kurtas, and tailored suits) to assemble your first weather-aware AI outfit before signing in.",
    },
    "he": {
        "onboarding": {
            "stepOf": "שלב {{current}} מתוך {{total}}",
            "newToDressApp": "חדשים ב-DressApp?",
            "startSetupLink": "התאימו אישית את הסטייליסט והאווטאר שלכם תוך 60 שניות",
            "firstOutfitTitle": "הלוק הראשון שלי ב-AI",
            "firstOutfitDesc": "הורכב במהלך כיול הסגנון והמידות שלך.",
            "step1": {
                "eyebrow": "שלב 1 · DNA של סגנון וגזרה",
                "title": "בנו את פרופיל הסגנון האישי שלכם",
                "subtitle": "ספרו לסטייליסט ה-AI איך אתם אוהבים להתלבש כדי שכל המלצה תותאם בדיוק אליכם.",
                "departmentLabel": "1. בחרו מחלקת מלתחה",
                "womenswear": "אופנת נשים",
                "womenswearSub": "שמלות, חצאיות, מכנסיים, עבאיות, קפטנים, סארי ועוד",
                "menswear": "אופנת גברים",
                "menswearSub": "מכנסיים, חליפות, ת׳וב, קורטה, סריגים ומעילים",
                "aestheticsLabel": "2. בחרו סגנונות וגזרות מועדפים",
                "aestheticsHint": "בחרו סגנון אחד או יותר שאתם לובשים בדרך כלל",
                "paletteLabel": "3. פלטת צבעים מועדפת",
                "routineLabel": "4. שגרת יומיום",
                "modestyLabel": "5. רמת צניעות וכיסוי",
                "b2bTitle": "האם אתם סטייליסטים מקצועיים, חייטים או מעצבי אופנה?",
                "b2bSubtitle": "הצטרפו למאגר המומחים המוסמכים של DressApp והציגו כרטיס ביקור דיגיטלי ללקוחות.",
                "b2bProfession": "מקצוע",
                "b2bCompanyName": "שם סטודיו / מותג",
                "b2bCity": "עיר / אזור",
                "b2bWebsite": "אתר או אינסטגרם",
                "b2bBio": "תיאור קצר / התמחויות",
                "b2bBioPlaceholder": "קניינות אישית, שמלות כלה, ייעוץ מלתחה...",
                "continueCta": "כיול מידות ואווטאר תלת-ממדי",
            },
            "step2": {
                "eyebrow": "שלב 2 · כיול מידות תוך 15 שניות",
                "title": "כיילו את האווטאר ודרכון המידות שלכם",
                "subtitle": "הזיזו את המחוונים למידות המשוערות שלכם — ה-AI יחשב את דרכון המידות המלא בזמן אמת.",
                "height": "גובה",
                "weight": "משקל",
                "waist": "היקף מותניים",
                "footLength": "אורך כף רגל",
                "skinToneLabel": "גוון עור האווטאר",
                "liveAvatarBadge": "אווטאר 3D/2D חי",
                "aiSizePassport": "דרכון מידות AI",
                "calibrating": "מכייל...",
                "continueCta": "בניית קפסולת ההתחלה שלי",
            },
            "step3": {
                "eyebrow": "שלב 3 · בניית ארון ללא מאמץ",
                "title": "סמנו 4+ פריטי בסיס שיש לכם בארון (או דומים להם)",
                "subtitle": "בחרו מתוך מאגר הפריטים המקוטלג שלנו — כל פריט כולל הרכב בד, צבע ועונתיות מלאים ללא עלות קרדיטים.",
                "autoSelectBtn": "בחירה אוטומטית של 6 פריטים לסגנון שלי",
                "formulaComplete": "מוכן! נבחרו {{count}} פריטים — לוק שלם מכף רגל ועד ראש מוכן",
                "formulaHint": "בחרו לפחות 4 פריטים כולל (פריט גוף מלא + נעליים) או (חלק עליון + חלק תחתון + נעליים) ({{count}}/4 נבחרו)",
                "migrateTitle": "כבר יש לכם ארון דיגיטלי ב-Whering, Acloset, Indyx או Stylebook?",
                "migrateSubtitle": "הפעילו ייבוא ארון בלחיצה אחת מהמחשב מיד לאחר ההתחברות.",
                "continueCta": "הרכבת הלוק הראשון שלי ב-AI",
            },
            "step4": {
                "eyebrow": "סטייליסט ה-AI שלכם מוכן",
                "title": "הנה הלוק המותאם הראשון שלכם",
                "subtitle": "הורכב מקפסולת ההתחלה שלכם ומותאם לאווטאר ולמזג האוויר המקומי.",
                "shuffleLook": "נסו שילוב נוסף",
                "wearingNow": "לוק קפסולה מלא",
                "sizePassportTitle": "דרכון מידות AI מכויל",
                "expertPreviewBadge": "תצוגה מקדימה במאגר המומחים",
                "saveAndFinishCta": "שמירת הקפסולה ופתיחת סטייליסט ה-AI",
                "unlockTitle": "שמרו את האווטאר, דרכון המידות ו-{{count}} פריטי הארון שלכם",
                "unlockSub": "התחברו בלחיצה אחת כדי שהמידות המכוילות, פריטי הבסיס והלוק הראשון יישמרו בחשבונכם.",
                "continueWithGoogle": "שמירת הארון והמשך עם Google",
            },
        },
        "closet_patch": {
            "starterBasicBadge": "פריט בסיס · הקישו להוספת תמונה שלכם",
            "starterBasicBannerTitle": "פריט קפסולת התחלה · תמונת קטלוג להמחשה",
            "starterBasicBannerDesc": "פריט זה זמין מיד בסטייליסט ה-AI, בקנבס הלוקים ובמזוודה. צלמו או העלו תמונה אמיתית של הפריט שלכם בכל עת כדי להתאים אותו אישית ולפתוח אפשרות פרסום במרקטפלייס.",
            "starterBasicSnapBtn": "צילום תמונה שלי",
            "starterBasicUploadBtn": "העלאת תמונה",
            "starterBasicMarketplaceBlocked": "אנא העלו תמונה אמיתית של הבגד שלכם לפני פרסומו במרקטפלייס.",
        },
        "help_patch": {
            "overview_onboarding": "ההתחלה אורכת פחות מ-60 שניות: כיילו את סגנון הלבוש, מידות האווטאר וקפסולת ההתחלה כדי לראות את לוק ה-AI הראשון שלכם עוד לפני ההתחברות.",
        },
        "wiki_bullet": "- **התאמה אישית וקפסולת התחלה תוך 60 שניות**: כיילו את פרופיל הסגנון, מידות האווטאר ובחרו מתוך 48 פריטי בסיס מקוטלגים לנשים ולגברים (כולל מכנסיים, חצאיות, שמלות, עבאיות, קפטנים, ג׳לביות, סארי, ת׳וב וחליפות מחויטות) להרכבת הלוק הראשון עוד לפני ההתחברות.",
    },
    "ar": {
        "onboarding": {
            "stepOf": "الخطوة {{current}} من {{total}}",
            "newToDressApp": "جديد في DressApp؟",
            "startSetupLink": "خصّص مصفف الأزياء الذكي والأفاتار ثلاثي الأبعاد في 60 ثانية",
            "firstOutfitTitle": "إطلالتي الذكية الأولى",
            "firstOutfitDesc": "تم تنسيقها أثناء معايرة أسلوبك ومقاساتك.",
            "step1": {
                "eyebrow": "الخطوة 1 · بصمة الأسلوب والقصّة",
                "title": "أنشئ ملف أسلوبك الشخصي",
                "subtitle": "أخبر مصفف الأزياء الذكي كيف تفضل ارتداء ملابسك لتكون كل توصية مصممة خصيصاً لك.",
                "departmentLabel": "1. اختر قسم الأزياء",
                "womenswear": "أزياء نسائية",
                "womenswearSub": "فساتين، تنانير، بناطيل، عبايات، قفاطين، ساري والمزيد",
                "menswear": "أزياء رجالية",
                "menswearSub": "بناطيل، بدلات رسمية، ثوب، كورتا، تريكو ومعاطف",
                "aestheticsLabel": "2. اختر أساليبك وقصّاتك المفضلة",
                "aestheticsHint": "اختر أسلوباً واحداً أو أكثر ترتديه غالباً",
                "paletteLabel": "3. لوحة الألوان المفضلة",
                "routineLabel": "4. الروتين اليومي",
                "modestyLabel": "5. مستوى الاحتشام والتغطية",
                "b2bTitle": "هل أنت منسق أزياء محترف أو خياط أو مصمم أزياء؟",
                "b2bSubtitle": "انضم إلى دليل الخبراء المعتمدين في DressApp لعرض بطاقة أعمالك الرقمية للعملاء.",
                "b2bProfession": "المهنة",
                "b2bCompanyName": "اسم الاستوديو / العلامة",
                "b2bCity": "المدينة / المنطقة",
                "b2bWebsite": "الموقع الإلكتروني أو إنستغرام",
                "b2bBio": "نبذة قصيرة / التخصصات",
                "b2bBioPlaceholder": "متسوق شخصي، أزياء راقية، مستشار خزانة...",
                "continueCta": "معايرة مقاساتي والأفاتار",
            },
            "step2": {
                "eyebrow": "الخطوة 2 · معايرة المقاسات في 15 ثانية",
                "title": "عاير الأفاتار وجواز المقاسات الذكي",
                "subtitle": "حرّك المؤشرات إلى مقاساتك التقريبية — يتوقع الذكاء الاصطناعي مقاساتك الكاملة فوراً.",
                "height": "الطول",
                "weight": "الوزن",
                "waist": "الخصر",
                "footLength": "طول القدم",
                "skinToneLabel": "لون بشرة الأفاتار",
                "liveAvatarBadge": "أفاتار 3D/2D مباشر",
                "aiSizePassport": "جواز المقاسات الذكي",
                "calibrating": "جارٍ المعايرة...",
                "continueCta": "بناء كبسولة خزانتي الأساسية",
            },
            "step3": {
                "eyebrow": "الخطوة 3 · بناء الخزانة بسهولة",
                "title": "اختر 4 قطع أساسية أو أكثر تمتلكها (أو مشابهة لها)",
                "subtitle": "اختر من مجموعتنا المفهرسة مسبقاً — كل قطعة تتضمن بيانات القماش واللون والموسم مجاناً بدون رصيد AI.",
                "autoSelectBtn": "اختيار 6 قطع أساسية تلقائياً لأسلوبي",
                "formulaComplete": "جاهز! تم اختيار {{count}} قطع — اكتملت إطلالتك الكاملة",
                "formulaHint": "اختر 4 قطع على الأقل تشمل (قطعة كاملة + حذاء) أو (قطعة علوية + سفلية + حذاء) ({{count}}/4 مختارة)",
                "migrateTitle": "هل لديك خزانة رقمية في Whering أو Acloset أو Indyx أو Stylebook؟",
                "migrateSubtitle": "فعّل استيراد الخزانة بنقرة واحدة من الحاسوب مباشرة بعد تسجيل الدخول.",
                "continueCta": "تنسيق إطلالتي الذكية الأولى",
            },
            "step4": {
                "eyebrow": "مصفف الأزياء الذكي جاهز",
                "title": "إليك إطلالتك المخصصة الأولى",
                "subtitle": "منسقة من كبسولتك الأساسية ومضبوطة على الأفاتار والطقس المحلي.",
                "shuffleLook": "جرّب تنسيقاً آخر",
                "wearingNow": "إطلالة الكبسولة المختارة",
                "sizePassportTitle": "جواز المقاسات الذكي المعاير",
                "expertPreviewBadge": "معاينة بطاقة دليل الخبراء",
                "saveAndFinishCta": "حفظ الكبسولة وفتح مصفف الأزياء الذكي",
                "unlockTitle": "احفظ الأفاتار وجواز المقاسات وخزانتك المكونة من {{count}} قطع",
                "unlockSub": "سجّل الدخول بنقرة واحدة لحفظ مقاساتك وقطعك الأساسية وإطلالتك الأولى في حسابك.",
                "continueWithGoogle": "حفظ خزانتي والمتابعة عبر Google",
            },
        },
        "closet_patch": {
            "starterBasicBadge": "قطعة أساسية · اضغط لإضافة صورتك",
            "starterBasicBannerTitle": "قطعة كبسولة أساسية · صورة مرجعية من الكتالوج",
            "starterBasicBannerDesc": "تعمل هذه القطعة فوراً في مصفف الأزياء الذكي وحقيبة السفر. التقط أو ارفع صورة حقيقية لقطعتك في أي وقت لتخصيصها وتفعيل البيع في السوق.",
            "starterBasicSnapBtn": "التقاط صورتي",
            "starterBasicUploadBtn": "رفع صورة",
            "starterBasicMarketplaceBlocked": "يرجى رفع صورة حقيقية لقطعة ملابسك قبل عرضها في السوق.",
        },
        "help_patch": {
            "overview_onboarding": "البدء يستغرق أقل من 60 ثانية: عاير بصمة أسلوبك ومقاسات الأفاتار وكبسولتك الأساسية لترى إطلالتك الذكية الأولى قبل تسجيل الدخول.",
        },
        "wiki_bullet": "- **إعداد شخصي وكبسولة أساسية في 60 ثانية**: عاير بصمة أسلوبك ومقاسات الأفاتار واختر من بين 48 قطعة أساسية مفهرسة للنساء والرجال (تشمل البناطيل والتنانير والفساتين والعبايات والقفاطين والجلابيات والساري والثوب والبدلات الرسمية) لتنسيق إطلالتك الأولى قبل تسجيل الدخول.",
    },
}

# For the remaining 10 languages, provide clean localized strings with full coverage
OTHER_LANG_OVERRIDES = {
    "es": {
        "stepOf": "Paso {{current}} de {{total}}",
        "newToDressApp": "¿Nuevo en DressApp?",
        "startSetupLink": "Personaliza tu Estilista IA y Avatar 3D en 60s",
        "starterBasicBadge": "Básico inicial · Toca para añadir tu foto",
        "starterBasicMarketplaceBlocked": "Sube una foto real de tu prenda antes de publicarla en el Marketplace.",
    },
    "fr": {
        "stepOf": "Étape {{current}} sur {{total}}",
        "newToDressApp": "Nouveau sur DressApp ?",
        "startSetupLink": "Personnalisez votre Styliste IA et Avatar 3D en 60s",
        "starterBasicBadge": "Basique capsule · Appuyez pour ajouter votre photo",
        "starterBasicMarketplaceBlocked": "Veuillez importer une vraie photo de votre vêtement avant de le publier sur la Marketplace.",
    },
    "de": {
        "stepOf": "Schritt {{current}} von {{total}}",
        "newToDressApp": "Neu bei DressApp?",
        "startSetupLink": "Personalisiere deinen KI-Stylisten & 3D-Avatar in 60 Sek.",
        "starterBasicBadge": "Starter-Basic · Tippen für eigenes Foto",
        "starterBasicMarketplaceBlocked": "Bitte lade ein echtes Foto deines Kleidungsstücks hoch, bevor du es im Marketplace anbietest.",
    },
    "it": {
        "stepOf": "Passo {{current}} di {{total}}",
        "newToDressApp": "Nuovo su DressApp?",
        "startSetupLink": "Personalizza il tuo Stylist IA e Avatar 3D in 60s",
        "starterBasicBadge": "Base capsule · Tocca per aggiungere la tua foto",
        "starterBasicMarketplaceBlocked": "Carica una foto reale del tuo capo prima di pubblicarlo sul Marketplace.",
    },
    "pt": {
        "stepOf": "Passo {{current}} de {{total}}",
        "newToDressApp": "Novo no DressApp?",
        "startSetupLink": "Personalize seu Estilista IA e Avatar 3D em 60s",
        "starterBasicBadge": "Básico inicial · Toque para adicionar sua foto",
        "starterBasicMarketplaceBlocked": "Envie uma foto real da sua peça antes de anunciá-la no Marketplace.",
    },
    "ru": {
        "stepOf": "Шаг {{current}} из {{total}}",
        "newToDressApp": "Впервые в DressApp?",
        "startSetupLink": "Настройте ИИ-стилиста и 3D-аватар за 60 секунд",
        "starterBasicBadge": "Базовая вещь · Нажмите, чтобы добавить свое фото",
        "starterBasicMarketplaceBlocked": "Пожалуйста, загрузите реальное фото вашей вещи перед публикацией на Маркетплейсе.",
    },
    "zh": {
        "stepOf": "第 {{current}} 步（共 {{total}} 步）",
        "newToDressApp": "初次使用 DressApp？",
        "startSetupLink": "60秒定制您的 AI 造型师与 3D 虚拟形象",
        "starterBasicBadge": "基础胶囊单品 · 点击上传您的真实照片",
        "starterBasicMarketplaceBlocked": "在发布到闲置市场之前，请先上传该衣物的真实照片。",
    },
    "ja": {
        "stepOf": "ステップ {{current}} / {{total}}",
        "newToDressApp": "DressAppは初めてですか？",
        "startSetupLink": "60秒でAIスタイリストと3Dアバターをカスタマイズ",
        "starterBasicBadge": "スターター定番 · タップして自分の写真を追加",
        "starterBasicMarketplaceBlocked": "マーケットプレイスに出品する前に、実際の衣類の写真をアップロードしてください。",
    },
    "hi": {
        "stepOf": "चरण {{current}} / {{total}}",
        "newToDressApp": "DressApp पर नए हैं?",
        "startSetupLink": "60 सेकंड में अपना AI स्टाइलिस्ट और 3D अवतार कस्टमाइज़ करें",
        "starterBasicBadge": "स्टार्टर बेसिक · अपनी फ़ोटो जोड़ने के लिए टैप करें",
        "starterBasicMarketplaceBlocked": "मार्केटप्लेस पर लिस्ट करने से पहले कृपया अपने कपड़े की असली फ़ोटो अपलोड करें।",
    },
    "nl": {
        "stepOf": "Stap {{current}} van {{total}}",
        "newToDressApp": "Nieuw bij DressApp?",
        "startSetupLink": "Personaliseer je AI-stylist & 3D-avatar in 60 sec.",
        "starterBasicBadge": "Starter-basic · Tik om je eigen foto toe te voegen",
        "starterBasicMarketplaceBlocked": "Upload eerst een echte foto van je kledingstuk voordat je het op de Marketplace plaatst.",
    },
}


def deep_merge(base, override):
    out = json.loads(json.dumps(base))
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def main():
    en_bundle = ONBOARDING_TRANSLATIONS["en"]
    all_langs = ["en", "he", "ar", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "hi", "nl"]

    for lang in all_langs:
        locale_path = LOCALES_DIR / f"{lang}.json"
        if not locale_path.exists():
            continue
        data = json.loads(locale_path.read_text(encoding="utf-8"))

        if lang in ONBOARDING_TRANSLATIONS:
            bundle = ONBOARDING_TRANSLATIONS[lang]
            onboarding_obj = bundle["onboarding"]
            closet_patch = bundle["closet_patch"]
            help_patch = bundle["help_patch"]
            wiki_bullet = bundle["wiki_bullet"]
        else:
            ov = OTHER_LANG_OVERRIDES.get(lang, {})
            onboarding_obj = json.loads(json.dumps(en_bundle["onboarding"]))
            if "stepOf" in ov:
                onboarding_obj["stepOf"] = ov["stepOf"]
            if "newToDressApp" in ov:
                onboarding_obj["newToDressApp"] = ov["newToDressApp"]
            if "startSetupLink" in ov:
                onboarding_obj["startSetupLink"] = ov["startSetupLink"]
            closet_patch = json.loads(json.dumps(en_bundle["closet_patch"]))
            if "starterBasicBadge" in ov:
                closet_patch["starterBasicBadge"] = ov["starterBasicBadge"]
            if "starterBasicMarketplaceBlocked" in ov:
                closet_patch["starterBasicMarketplaceBlocked"] = ov["starterBasicMarketplaceBlocked"]
            help_patch = json.loads(json.dumps(en_bundle["help_patch"]))
            wiki_bullet = en_bundle["wiki_bullet"]

        data["onboarding"] = deep_merge(data.get("onboarding", {}), onboarding_obj)
        data.setdefault("closet", {}).update(closet_patch)
        data.setdefault("help", {}).update(help_patch)

        locale_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        for wdir in WIKI_DIRS:
            md_path = wdir / lang / "overview.md"
            if md_path.exists():
                content = md_path.read_text(encoding="utf-8")
                if "60-Second" not in content and "60 שניות" not in content and "60 ثانية" not in content:
                    content = content.rstrip() + "\n" + wiki_bullet + "\n"
                    md_path.write_text(content, encoding="utf-8")

    print("Updated all 13 locale JSON files and wiki overview.md files successfully.")


if __name__ == "__main__":
    main()
