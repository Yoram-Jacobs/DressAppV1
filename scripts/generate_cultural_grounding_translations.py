#!/usr/bin/env python3
"""generate_cultural_grounding_translations.py

Generates authentic, professional translations of cultural_traditional_grounding.md
for all 12 non-English supported languages in DressApp:
he, ar, de, es, fr, hi, it, ja, nl, pt, ru, zh.

Writes to both:
- wiki/{lang}/cultural_traditional_grounding.md
- apps/web/public/wiki/{lang}/cultural_traditional_grounding.md
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WIKI_DIR = BASE_DIR / "wiki"
PUBLIC_WIKI_DIR = BASE_DIR / "apps" / "web" / "public" / "wiki"

TRANSLATIONS = {}

# ---------------------------------------------------------------------------
# HEBREW (he)
# ---------------------------------------------------------------------------
TRANSLATIONS["he"] = """# מדריך עקרונות לבוש מסורתי ותרבותי

## סקירה כללית
DressApp מעניקה ייעוץ והתאמת סטיילינג מבוססי-תרבות ב-13 שפות. במקום להסתמך על ניחושים הסתברותיים של מודלי שפה קטנים (SLM) – הנוטים להזיות או לבלבול בין טקסים ומנהגים שונים – DressApp אוכפת **אקסיומות ביסוס מוגדרות ועקרוניות (Ground-Truth Axioms)** שעברו ביקורת אנושית קפדנית.

מסמך זה מגדיר את פרוטוקולי הלבוש הקנוניים, דרישות הגזרה, איסורים מחמירים ומינוחים לשוניים מקומיים בתרבויות ומסורות גלובליות שונות.

---

## 1. מסורת יהודית (יהדות)

### 1.1 כללי לבוש לשבעה ואבלות (שבעה, אבלות וניחום אבלים)
- **סוג האירוע**: מאופק, ניחום אבלים, אזכרה, לוויה.
- **רמת רשמיות**: מכובדת, צנועה ושקטה.
- **פלטת צבעים**: שחור מלא, אפור כהה (פחם), צפחה כהה, כחול נייבי עמוק, חום כהה או גווני אדמה רגועים ומאופקים. יש להימנע מצבעי יסוד זוהרים, פסטלים בהירים, לבן, זהב או אדום.
- **גזרות וצלליות**:
  - **גברים**: מכנסיים מחויטים נקיים או ג'ינס כהה וחלק ללא קרעים; חולצה מכופתרת כהה ופשוטה, חולצת פולו חלקה או טי-שירט חלקה בצווארון עגול; נעליים כהות ומאופקות או מוקסינים כהים.
  - **נשים**: שמלות מידי או מקסי צנועות, חצאיות ארוכות או מכנסיים מחויטים; חולצות עם שרוולים המכסים את הכתפיים והזרועות העליונות; קו צוואר סגור ושמרני.
- **איסורים מחמירים (Strict Negative Prohibitions)**:
  - אין ללבוש חולצות טי עם הדפסים גרפיים, לוגואים בולטים, הדפסי נשרים או בעלי חיים, כיתובים או אלמנטים הומוריסטיים.
  - אין ללבוש מכנסיים קצרים, ג'ינס קרוע או משופשף, בגדי אימון וספורט או כפכפי ים.
  - אין ללבוש צבעים בוהקים כגון אדום לוהט, צהוב, ורוד פוקסיה, זהב או גווני ניאון.
  - אין לענוד תכשיטי יוקרה מנקרים עיניים או שעונים ראוותניים.
- **שפה ומינוח תרבותי נכון**:
  - *מינוחים תקניים ומדויקים בעברית*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`.
  - *טעויות תרגום מכונה אסורות*: לעולם אין להשתמש בביטויים משובשים כגון `להולך בישיבה שבעה` או `בישיבה שבעה`.

### 1.2 צניעות אורתודוקסית (צניעות - Tzniut)
- **סוג האירוע**: יומיומי, בית כנסת, קהילה, מעמדים מקודשים.
- **רמת רשמיות**: שמרנית, מהוגנת ומכובדת.
- **דרישות לבוש**:
  - **נשים**: חצאיות ושמלות המגיעות מעבר לברך גם בישיבה; שרוולים המכסים את המרפקים; מפתח צוואר המכסה את עצמות הבריח; בדים אטומים שאינם נצמדים. לנשים נשואות מהמגזר האורתודוקסי – כיסוי ראש (פאה, מטפחת/טיכל או כובע).
  - **גברים**: מכנסיים ארוכים, חולצות מכופתרות בעלות שרוולים, כיסוי ראש (כיפה).
- **איסורים מחמירים**:
  - אין ללבוש מכנסיים, ג'ינס או מכנסיים קצרים עבור נשים אורתודוקסיות.
  - אין ללבוש חולצות ללא שרוולים (גופיות) ללא שכבה אטומה מעל (בלייזר או קרדיגן).
  - אין ללבוש מפתחי וי עמוקים, גב חשוף, בדים שקופים או חצאיות בעלות שסע גבוה.

### 1.3 שבת ומועדים (שבת וחגים)
- **סוג האירוע**: חגיגה דתית משמחת, סעודת ליל שבת, תפילות חג.
- **רמת רשמיות**: אלגנטית ומרוממת (Smart-Casual מוקפד עד רשמי).
- **פלטת צבעים**: לבן בוהק, שמנת, כחול נייבי, תכלת, גווני אבני חן ופסטלים מעודנים.
- **גזרות**:
  - **גברים**: חולצה מכופתרת לבנה או תכלת מגוהצת, מכנסיים מחויטים אלגנטיים, בלייזר או ז'קט, נעלי ערב מצוחצחות.
  - **נשים**: שמלות מידי או מקסי חגיגיות ואלגנטיות, חצאיות מחויטות בליווי חולצות משי או סריגים עדינים, אקססוריז אלגנטיים.
- **איסורים מחמירים**:
  - אין ללבוש בגדי עבודה, ביגוד ספורט, ג'ינס קרוע או בגדי בית ופנאי.

---

## 2. מסורת מוסלמית (الإسلام)

### 2.1 תפילת יום שישי וביקור במסגד (صلاة الجمعة وزيارة المسجد)
- **סוג האירוע**: תפילת יום שישי בציבור, כניסה למסגד מקודש.
- **רמת רשמיות**: נקייה, צנועה ומכובדת.
- **דרישות לבוש**:
  - **גברים**: מכנסיים ארוכים ונקיים, ת'וב (Thobe) או קורטה; כתפיים וחזה מכוסים לחלוטין; גרביים נקיות (חליצת נעליים בכניסה).
  - **נשים**: עבאיה רפויה, שמלת מקסי או טוניקה ארוכה מעל מכנסיים רפויים; כיסוי מלא עד שורש כף היד והקרסוליים; חיג'אב המכסה את השיער, האוזניים והצוואר.
- **איסורים מחמירים**:
  - אין ללבוש מכנסיים קצרים מעל הברך לגברים (חובת כיסוי עוורה - Awrah).
  - אין ללבוש בגדים צמודים לגוף, בדים שקופים או מחשופים נמוכים.
  - אין ללבוש בגדים עם הדפסי פנים, דמויות אדם או בעלי חיים בתוך חללי התפילה.
- **מינוח תרבותי בערבית**:
  - `لصلاة الجمعة`, `لزيارة المسجد`, `لباس محتشم ولائق`.

### 2.2 לבוש צנוע יומיומי (الحשמה והחיג'אב)
- **רמת רשמיות**: יומיומי עד יומיומי-אלגנטי.
- **דרישות**: בדים אטומים, גזרות זורמות ורפויות (A-line, מכנסי פלאצו, טרנץ' ארוך, קימונו או עבאיה), קווי צוואר סגורים ושרוולים ארוכים.
- **איסורים מחמירים**:
  - אין ללבוש פריטים עם רשת או שקיפות ללא שכבת בסיס אטומה.

---

## 3. מסורת הינדית (सनातन धर्म)

### 3.1 לוויות ואבלות (אנטיישטי - अंतिम संस्कार)
- **סוג האירוע**: טקס שריפת גופה הינדי, תהלוכת אבל, ניחומים.
- **רמת רשמיות**: שקטה, טהורה וסגפנית.
- **פלטת צבעים**: **לבן חלק, פשוט וללא קישוטים בלבד**.
- **גזרות**:
  - **גברים**: קורטה-פיג'מה לבנה ופשוטה או חולצת כותנה לבנה עם מכנסיים בהירים חלקים.
  - **נשים**: סארי כותנה לבן חלק או סלוואר קמיז לבן ופשוט ללא רקמה או עיטורים.
- **איסורים מחמירים**:
  - **איסור מוחלט על צבע שחור**: במסורת ההינדית, צבע שחור נחשב למביא מזל רע ואסור באיסור מוחלט בלוויות.
  - אין ללבוש צבעים עזים ושמחים (אדום, זהב, כתום, ורוד).
  - אין לנעול נעלי עור או חגורות עור בתוך מתחמי טקסי שריפה מקודשים או מקדשים.

### 3.2 חתונות וחגיגות (ויוואה ודיוואלי - विवाह उत्सव)
- **סוג האירוע**: טקסי נישואין הינדיים (סנגיט, בראאט, פהראס), פסטיבל דיוואלי, חגים מבורכים.
- **רמת רשמיות**: מפוארת, חגיגית ויוקרתית.
- **פלטת צבעים**: גווני אדום מבורכים, בורדו עמוק, זהב, זעפרן, ירוק אזמרגד מלכותי ורוד ראני.
- **גזרות**: שרוואני, בנדגאלה, קורטה עם ז'קט נהרו לגברים; להנגה, סארי בנארסי או קאנג'יבראם, אנרקלי לנשים.
- **איסורים מחמירים**:
  - **איסור על צבע שחור מלא**: שחור נחשב לצבע לא מבורך ונמנע לחלוטין בחתונות הינדיות.
  - **איסור על לבן חלק ופשוט**: לבן חלק מזוהה עם אלמנות ואבלות, ואורחי החתונה נמנעים ממנו לחלוטין.

---

## 4. מסורות מזרח אסיה (东亚礼仪 / 東アジアの儀礼)

### 4.1 לוויות ואזכרות (葬礼 / お葬式 / 장례식)
- **סוג האירוע**: לוויות ואזכרות אבות בסין, יפן וקוריאה.
- **רמת רשמיות**: אבל רשמי וכהה.
- **פלטת צבעים**: חליפה שחורה חלקה, חולצה לבנה, עניבה שחורה חלקה ללא ברק (לגברים); שמלת ערב שחורה ופשוטה או קימונו כהה וחלק (לנשים).
- **איסורים מחמירים**:
  - **איסור מוחלט על אדום או זהב**: בתרבות סין ומזרח אסיה, אדום וזהב מסמלים שמחה קיצונית וחגיגיות; לבישתם ללוויה נחשבת לפגיעה בלתי נסלחת בכבוד המשפחה.
  - אין לענוד עניבות צבעוניות, תכשיטי מתכת מבריקים או אביזרים ראוותניים.

### 4.2 חתונות וסעודות חגיגיות (婚礼 / 結婚披露宴)
- **פלטת צבעים**: צבעים חגיגיים ומעודנים (פסטל, נייבי, אפור אלגנטי, ורוד עדין, גווני אבני חן).
- **איסורים מחמירים**:
  - **אין ללבוש אדום מלא לאורחים**: בחתונות סיניות, הצבע האדום שמור באופן בלעדי לכלה.
  - **אין ללבוש לבן מלא לאורחים**: בחתונות מערביות ומודרניות במזרח אסיה, לבן שמור לכלה בלבד.

---

## 5. קודי לבוש מערביים רשמיים

### 5.1 אירועי בלאק טאי (Black Tie) ונשפים
- **סוג האירוע**: גאלות צדקה, פתיחת עונת האופרה, נשפים וקבלות פנים רשמיות בערב.
- **דרישות לבוש**:
  - **גברים**: טוקסידו שחור או כחול-לילה (Midnight Blue) בעל דשים מסאטן או גרוגרן, מכנסיים תואמים עם פס סאטן בצד, חולצת טוקסידו לבנה מגוהצת, פפיון משי שחור, אבנט (Cummerbund) או וסט נמוך, נעלי עור שחורות מצוחצחות או עור לק.
  - **נשים**: שמלת ערב רשמית ארוכה עד הרצפה, תכשיטי ערב אלגנטיים, תיק קלאץ' ערב קטן.
- **איסורים מחמירים**:
  - אין ללבוש חליפות עסקים רגילות או ז'קטים יומיומיים.
  - אין ללבוש עניבה רגילה ארוכה (עניבת פפיון שחורה היא חובה מוחלטת לגברים).
  - אין לנעול נעלי סניקרס, מוקסינים פשוטים או סנדלים פתוחים.

### 5.2 כללי לבוש לאורחים בחתונות מערביות
- **סוג האירוע**: חתונה בכנסייה, באולם אירועים, בחיק הטבע או בכרם.
- **דרישות**: חצי רשמי עד אלגנטי מוקפד; שמלות מידי או שמלות קוקטייל; חליפות מחויטות בצבע נייבי, פחם או גוונים עונתיים נעימים.
- **איסורים מחמירים**:
  - **איסור מוחלט על שמלה בצבע לבן, שמנת או שנהב**: שמורים אך ורק לכלה.
  - אין ללבוש מכנסי ג'ינס, טי-שירט, נעלי ספורט או בגדי פנאי.

---

## 6. ארכיטקטורת יישום ואינטגרציה במערכת

### חילוץ חוקים מבוסס RAG
1. כל סעיף לעיל ממופה לאקסיומה ייעודית בקובץ `backend/app/data/fashion_rules_seed.json`.
2. מנגנון השליפה הדינמי ב-`fashion_rules_rag.py` מופעל בעת זיהוי מילות מפתח בשפות השונות (עברית, ערבית, הינדית, יפנית, סינית, אנגלית, גרמנית, צרפתית וכו').
3. מנוע אבטחת האיכות (`stylist_qa_engine.py`) אוכף איסורים אלה בקוד פייתון דטרמיניסטי – מסיר אוטומטית פריטים בצבעים אסורים (כגון אדום בשבעה או שחור בלוויה הינדית) ומתקן שיבושי לשון טרם הצגת התוצאה למשתמש.
"""

# ---------------------------------------------------------------------------
# ARABIC (ar)
# ---------------------------------------------------------------------------
TRANSLATIONS["ar"] = """# دليل التأصيل الثقافي والتقليدي للأزياء

## نظرة عامة
يوفر DressApp ذكاءً متقدماً في تنسيق الأزياء مراعياً للخصوصيات الثقافية عبر 13 لغة. وبدلاً من الاعتماد على التخمينات الاحتمالية لنماذج اللغة الصغيرة (SLM) – والتي كثيراً ما تقع في الهلوسة أو الخلط بين الشعائر والطقوس الدينية المختلفة – يفرض DressApp **قواعد وبديهيات موثقة ومدققة بشرياً (Ground-Truth Axioms)**.

تحدد هذه الوثيقة بروتوكولات اللباس المعتمدة، ومتطلبات التصميم، والمحظورات الصارمة، والمصطلحات اللغوية المحلية عبر مختلف التقاليد العالمية.

---

## 1. التقاليد اليهودية (יהדות)

### 1.1 آداب العزاء والحداد (شيفعا والحداد)
- **نوع المناسبة**: واجب عزاء، تأبين، جنازة، مراسم حزينة.
- **درجة الرسمية**: محترمة، وقورة، هادئة وغير متكلفة.
- **لوحة الألوان**: أسود كامل، رمادي فحمي، إردوازي داكن، كحلي داكن، بني داكن أو درجات ترابية خافتة. تجنب الألوان الأساسية الزاهية، والباستيل الفاتح، والأبيض، والذهبي، والأحمر.
- **التصاميم والقصات**:
  - **الرجال**: بنطال قماشي أنيق ومرتب أو جينز داكن كلاسيكي دون تمزقات؛ قميص داكن سادة بأزرار، أو بولو سادة، أو قميص قطني برقبة دائرية سادة؛ حذاء كلاسيكي داكن ووقور أو حذاء لوفر داكن.
  - **النساء**: فساتين ميدي أو ماكسي محتشمة، تنانير طويلة أو بناطيل أنيقة؛ قمصان بأكمام تغطي الكتفين وأعلى الذراعين؛ فتحة رقبة محافظة ومحتشمة.
- **المحظورات الصارمة**:
  - يُمنع ارتداء القمصان ذات الطبعات الجرافيكية، أو الشعارات البارزة، أو طبعات الحيوانات والنسور، أو الشعارات الفكاهية.
  - يُمنع ارتداء السراويل القصيرة (الشورت)، أو الجينز الممزق، أو الملابس الرياضية، أو شباشب الشاطئ.
  - يُمنع ارتداء الألوان الصارخة كالأحمر الزاهي، والأصفر، والوردي الفاقع، والذهبي، وألوان النيون.
  - يُمنع ارتداء المجوهرات الفاخرة البراقة أو الساعات الاستعراضية اللافتة.
- **المصطلحات الثقافية المعتمدة**:
  - *المصطلحات العبرية الصحيحة*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`.
  - *تجنب الترجمات الحرفية الآلية*: لا تستخدم عبارات ركيكة مثل `להולך בישיבה שבעה`.

### 1.2 الحشمة الأرثوذكسية (تسنوعوت - Tzniut)
- **نوع المناسبة**: يومية، الكنيس، التجمعات الدينية والاجتماعية المقدسة.
- **درجة الرسمية**: محافظة، وقورة ومحتشمة.
- **المتطلبات**:
  - **النساء**: تنانير وفساتين تمتد إلى ما بعد الركبة حتى أثناء الجلوس؛ أكمام تمتد لتغطي المرفقين؛ فتحة ياقة تغطي عظام الترقوة؛ أقمشة سميكة وغير شفافة وغير ملتصقة بالجسم. وللنساء المتزوجات تغطية الرأس (باروكة شيتل، غطاء رأس تيكل، أو قبعة).
  - **الرجال**: بناطيل طويلة، قمصان ذات أكمام وياقة، وغطاء رأس (كيباه).
- **المحظورات الصارمة**:
  - يُمنع ارتداء البنطال أو الجينز أو الشورت للنساء الأرثوذكسيات.
  - يُمنع ارتداء الملابس عديمة الأكمام دون سترة خارجية أو كارديغان ساتر.
  - تُمنع فتحات الياقة العميقة، والظهر المكشوف، والأقمشة الشفافة، والتنانير ذات الفتحات العالية.

### 1.3 السبت والأعياد الدينية
- **نوع المناسبة**: احتفال ديني بهيج، عشاء ليلة السبت، صلوات الأعياد.
- **درجة الرسمية**: رسمية أو شبه رسمية راقية وأنيقة (Smart-Casual إلى Formal).
- **لوحة الألوان**: الأبيض الناصع، السكري، الأزرق الكحلي، السماوي، وألوان الجواهر الراقية.
- **المحظورات الصارمة**:
  - يُمنع ارتداء ملابس العمل، والملابس الرياضية، والجينز الممزق، وملابس الاسترخاء المنزلية.

---

## 2. التقاليد الإسلامية (الإسلام)

### 2.1 صلاة الجمعة وزيارة المسجد
- **نوع المناسبة**: صلاة الجمعة الجماعية، زيارة المساجد ودور العبادة.
- **درجة الرسمية**: طاهرة، نظيفة، محتشمة ووقورة.
- **المتطلبات**:
  - **الرجال**: ثوب أبيض أو داكن نظيف، أو قميص طويل مع بنطال ساتر؛ تغطية الكتفين والصدر بالكامل؛ جوارب نظيفة (خلع الأحذية عند المدخل).
  - **النساء**: عباءة فضفاضة غير ملفتة، أو فستان ماكسي، أو سترة طويلة وفضفاضة فوق بنطال واسع؛ ستر كامل للجسد حتى الرسغين والكاحلين؛ حجاب ساتر للشعر والأذنين والرقبة بالكامل.
- **المحظورات الصارمة**:
  - يُمنع ارتداء السراويل القصيرة فوق الركبة أو حولها للرجال (ستر العورة).
  - يُمنع ارتداء الملابس الضيقة المحددة لتفاصيل الجسد، أو الأقمشة الشفافة، أو الياقات المفتوحة.
  - يُمنع ارتداء الملابس التي تحتوي على رسومات لوجوه بشرية أو أرواح أو طبعات حيوانات داخل مصليات الصلاة.
- **المصطلحات المعتمدة**:
  - `لصلاة الجمعة`, `لزيارة المسجد`, `لباس محتشم ولائق`.

### 2.2 الحشمة اليومية والحجاب
- **درجة الرسمية**: مظهر يومي أنيق ومريح (Casual إلى Smart-Casual).
- **المتطلبات**: أقمشة غير شفافة، قصات انسيابية وواسعة (A-line، بناطيل بالازو، معاطف طويلة، كيمونو أو عباءات يومية)، ياقات مغلقة وأكمام طويلة.
- **المحظورات الصارمة**:
  - يُمنع ارتداء الملابس ذات الفتحات الشبكية أو الأقمشة الشفافة بدون بطانة داخلية ساترة.

---

## 3. التقاليد الهندوسية (सनातन धर्म)

### 3.1 الجنائز ومراسم الحداد (أنتييشتي - अंतिम संस्कार)
- **نوع المناسبة**: حرق الجثامين الهندوسي، مواكب العزاء، أيام الحداد.
- **درجة الرسمية**: خاشعة، نقية، مجردة وزاهدة.
- **لوحة الألوان**: **اللون الأبيض السادة البسيط تماماً والخالي من أي زخارف فقط**.
- **التصاميم**:
  - **الرجال**: كورتا وبيجاما قطنية بيضاء سادة، أو قميص قطني أبيض مع بنطال فاتح هادئ.
  - **النساء**: ساري قطني أبيض سادة أو سالوار كاميز أبيض سادة بدون أي تطريز أو بريق.
- **المحظورات الصارمة**:
  - **حظر قاطع على ارتداء اللون الأسود**: في الثقافة الهندوسية، يُعتبر الأسود لوناً شؤماً ويُحظر تماماً في الجنائز ومراسم الحداد.
  - يُمنع ارتداء الألوان المبهجة والمشرقة (الأحمر، الذهبي، البرتقالي، الوردي).
  - يُمنع ارتداء الأحذية أو الأحزمة الجلدية داخل ساحات حرق الجثامين المقدسة أو داخل المعابد.

### 3.2 الأعراس والاحتفالات (فيفاها وديوالي - विवाह उत्सव)
- **نوع المناسبة**: مراسم الزفاف الهندوسية (سانغيت، بارات، فيراس)، احتفالات ديوالي، والمهرجانات المباركة.
- **درجة الرسمية**: فاخرة، بهيجة، وغاية في الفخامة والرسمية.
- **لوحة الألوان**: درجات الأحمر الميمون، المارون الغني، الذهبي، الزعفراني، الأخضر الزمردي الملكي، والوردي الفخم (راني بينك).
- **المحظورات الصارمة**:
  - **حظر ارتداء اللون الأسود الكامل**: يعتبر الأسود نذير شؤم في الأعراس الهندوسية ويتم تفاديه تماماً.
  - **حظر ارتداء اللون الأبيض السادة**: يرتبط الأبيض السادة بالترمل ومراسم الحداد، ولذلك يتجنبه ضيوف الأعراس بالكامل.

---

## 4. تقاليد شرق آسيا (东亚礼仪 / 東アジアの儀礼)

### 4.1 الجنائز والتأبين (葬礼 / お葬式 / 장례식)
- **نوع المناسبة**: الجنائز وتأبين الأسلاف في الصين واليابان وكوريا.
- **درجة الرسمية**: حداد رسمي داكن.
- **لوحة الألوان**: بدلة سوداء سادة، قميص أبيض، وربطة عنق سوداء سادة بدون لمعان (للرجال)؛ فستان أسود محتشم أو كيمونو داكن سادة (للنساء).
- **المحظورات الصارمة**:
  - **حظر قاطع ومطلق على اللونين الأحمر والذهبي**: يمثل الأحمر والذهب في ثقافات شرق آسيا قمة الفرح والاحتفال، وارتداؤهما في الجنازة يُعد إهانة فادحة لا تغتفر للمتوفى وأسرته.
  - يُمنع ارتداء ربطات العنق الملونة، أو الإكسسوارات المعدنية اللامعة، أو الساعات البراقة.

### 4.2 الأعراس والولائم الاحتفالية (婚礼 / 結婚披露宴)
- **لوحة الألوان**: ألوان احتفالية راقية (ألوان الباستيل، الكحلي، الرمادي الأنيق، الوردي الناعم، وألوان الأحجار الكريمة).
- **المحظورات الصارمة**:
  - **يُمنع على الضيوف ارتداء اللون الأحمر الخالص**: في الأعراس الصينية، اللون الأحمر مخصص حصرياً للعروس.
  - **يُمنع على الضيوف ارتداء اللون الأبيض الخالص**: في الأعراس المعاصرة، يُحجز الفستان الأبيض للعروس وحدها.

---

## 5. المعايير الرسمية والاحتفالية الغربية

### 5.1 مناسبات البلاك تاي (Black Tie) وحفلات الغالا
- **نوع المناسبة**: حفلات الغالا الخيرية، افتتاح دور الأوبرا، وحفلات الاستقبال المسائية الرسمية.
- **المتطلبات**:
  - **الرجال**: بدلة سهرة (توكسيدو) سوداء أو زرقاء داكنة جداً (Midnight Blue) ذات طيات صدر من الساتان، بنطال مطابق مع شريط ساتان جانبي، قميص توكسيدو أبيض ناصع، ربطة عنق على شكل فراشة (Bow Tie) من الحرير الأسود، حذاء جلدي أسود لامع (ورنيش).
  - **النساء**: فستان سهرة طويل يصل إلى الأرض (Floor-length Gown)، مجوهرات مسائية راقية، وحقيبة سهرة مسائية صغيرة (Clutch).
- **المحظورات الصارمة**:
  - يُمنع ارتداء بدلات العمل العادية أو السترات النهارية.
  - تُمنع ربطات العنق الطويلة العادية (ربطة الفراشة السوداء إلزامية للرجال).
  - يُمنع ارتداء الأحذية الرياضية أو الأحذية الخفيفة اليومية.

### 5.2 إتيكيت ضيوف الأعراس الغربية
- **نوع المناسبة**: الزفاف في الكنيسة، القاعات الفاخرة، أو في الهواء الطلق.
- **المتطلبات**: مظهر أنيق شبه رسمي أو رسمي راقٍ؛ فساتين كوكتيل أو ميدي؛ بدلات رجالية أنيقة باللون الكحلي أو الفحمي.
- **المحظورات الصارمة**:
  - **حظر تام على ارتداء فساتين باللون الأبيض، أو السكري، أو العاجي، أو الشمبانيا**: هذه الألوان محجوزة حصرياً للعروس.
  - يُمنع ارتداء بنطال الجينز، أو التيشيرتات، أو الأحذية الرياضية.

---

## 6. بنية التنفيذ والدمج التقني في النظام

### استرجاع القواعد عبر تقنية RAG
1. يقابل كل قسم أعلاه بنداً وأكسيوماً مستقلاً في ملف القواعد التأسيسية `backend/app/data/fashion_rules_seed.json`.
2. يتم تفعيل محرك الاسترجاع الديناميكي في `fashion_rules_rag.py` تلقائياً عند اكتشاف كلمات مفتاحية بلغات متعددة.
3. يقوم محرك ضمان الجودة والتصريح (`stylist_qa_engine.py`) بفرض هذه الشروط والموانع عبر كود بايثون دقيق — فيقوم بإسقاط القطع ذات الألوان المحظورة تلقائياً (مثل استبعاد الأحمر في العزاء أو الأسود في الجنائز الهندوسية) وتصحيح الصياغات اللغوية قبل تقديم الإطلالة للمستخدم.
"""

# ---------------------------------------------------------------------------
# GERMAN (de)
# ---------------------------------------------------------------------------
TRANSLATIONS["de"] = """# Leitfaden zur kulturellen und traditionellen Kleidungsetikette

## Übersicht
DressApp bietet eine kulturbewusste Styling-Intelligenz in 13 Sprachen. Anstatt sich auf vage probabilistische Schätzungen kleiner Sprachmodelle (SLMs) zu verlassen – die häufig halluzinieren oder unterschiedliche religiöse Riten miteinander verwechseln –, setzt DressApp auf explizite, menschlich geprüfte **Ground-Truth-Axiome**.

Dieses Dokument definiert verbindliche Kleidungsprotokolle, Schnitt- und Silhouettenanforderungen, strikte Ausschlusskriterien (Negative Constraints) sowie lokalisierte Fachterminologien für weltweite Traditionen.

---

## 1. Jüdische Traditionen (יהדות)

### 1.1 Schiwa- und Traueretikette (שבעה, aberlut & Kondolenzbesuche)
- **Anlasstyp**: Würdevoller Kondolenzbesuch, Trauerfeier, Beisetzung, Totengedenken.
- **Formalitätsgrad**: Respektvoll, feierlich, zurückhaltend.
- **Farbpalette**: Durchgehendes Schwarz, Anthrazit, dunkles Schiefergrau, tiefes Marineblau, Dunkelbraun oder gedämpfte, dezente Erdtöne. Meiden Sie leuchtende Primärfarben, helle Pastelltöne, Weiß, Gold oder Rot.
- **Silhouetten & Schnitte**:
  - **Herren**: Gepflegte Stoffhosen oder schlichte, dunkle Jeans ohne Risse; unifarbenes, dunkles Hemd, Poloshirt oder dezentes Rundhals-Shirt; dunkle, unaufdringliche Halbschuhe oder Loafer.
  - **Damen**: Züchtige Midi- oder Maxikleider, lange Röcke oder gepflegte Stoffhosen; Oberteile mit Ärmeln, die Schultern und Oberarme bedecken; dezenter Halsausschnitt.
- **Strikte Verbote (Negative Constraints)**:
  - KEINE Grafik-T-Shirts, auffälligen Markenlogos, Adler-/Tiermotive, Slogan-Prints oder humorvollen Elemente.
  - KEINE Shorts, zerrissene Jeans, Sport-/Trainingskleidung oder Strandsandalen.
  - KEINE grellen Farben wie Signalrot, Gelb, Pink, Gold oder Neonfarben.
  - KEIN auffälliger Luxusschmuck oder protzige Armbanduhren.
- **Sprachliche und kulturelle Terminologie**:
  - *Zulässige hebräische Begriffe*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`.
  - *Unzulässige Maschinenübersetzungen*: Niemals fehlerhafte Wort-für-Wort-Übersetzungen wie `להולך בישיבה שבעה` verwenden.

### 1.2 Orthodoxe Sittsamkeit (Zniut - Tzniut / צניעות)
- **Anlasstyp**: Alltag, Synagoge, Gemeindezentren, religiöse Feierstunden.
- **Formalitätsgrad**: Konservativ, ehrwürdig, sittsam.
- **Anforderungen**:
  - **Damen**: Röcke und Kleider, die auch im Sitzen das Knie bedecken; Ärmel, die über den Ellbogen reichen; Ausschnitte, die das Schlüsselbein verdecken; blickdichte, nicht eng anliegende Stoffe. Für verheiratete orthodoxe Frauen: Kopfbedeckung (Scheitel, Tichel oder Hut).
  - **Herren**: Lange Hosen, langärmelige Hemden mit Kragen, Kopfbedeckung (Kippa).
- **Strikte Verbote**:
  - KEINE Hosen, Jeans oder Shorts für orthodoxe Frauen.
  - KEINE ärmellosen Tops ohne blickdichte Lage darüber (Blazer oder Cardigan).
  - KEINE tiefen V-Ausschnitte, rückenfreien Schnitte, transparenten Stoffe oder hohen Beinschlitze.

### 1.3 Schabbat und Festtage (שבת וחגים)
- **Anlasstyp**: Freudige religiöse Feier, Schabbatmahl am Freitagabend, Feiertagsgottesdienst.
- **Formalitätsgrad**: Gehobener Smart-Casual-Stil bis formelle Abendkleidung.
- **Farbpalette**: Reines Weiß, Creme, Marineblau, Hellblau, Juwelentöne, feine Pastelltöne.
- **Strikte Verbote**:
  - KEINE Arbeitskleidung, Sportbekleidung, Destroyed-Jeans oder legere Loungewear.

---

## 2. Islamische Traditionen (الإسلام)

### 2.1 Freitagsgebet (Dschum'a) und Moscheebesuche
- **Anlasstyp**: Freitägliches Gemeinschaftsgebet, Betreten einer Moschee.
- **Formalitätsgrad**: Rein, bescheiden, respektvoll.
- **Anforderungen**:
  - **Herren**: Saubere lange Hosen, Thawb oder Kurta; Schultern und Brust vollständig bedeckt; saubere Socken (Schuhe werden am Eingang ausgezogen).
  - **Damen**: Weit geschnittene Abaya, Maxikleid oder lange Tunika über weiter Hose; vollständige Bedeckung bis zu den Handgelenken und Knöcheln; Hidschāb, der Haare, Ohren und Hals vollständig verhüllt.
- **Strikte Verbote**:
  - KEINE Shorts oberhalb oder auf Kniehöhe für Männer (Awrah-Vorschrift).
  - KEINE eng anliegende Kleidung (Bodycon), transparente Stoffe oder tiefe Ausschnitte.
  - KEINE Kleidungsstücke mit Abbildungen von Gesichtern, Lebewesen oder Tiermotiven in den Gebetsräumen.

### 2.2 Alltägliche Sittsamkeit (Hischma & Hidschāb)
- **Formalitätsgrad**: Casual bis Smart-Casual.
- **Anforderungen**: Blickdichte Textilien, fließende Schnitte (A-Linie, Palazzo-Hosen, lange Mäntel, Kimonos oder Abayas), hochgeschlossene Kragen, lange Ärmel.
- **Strikte Verbote**:
  - KEINE transparenten Einsätze oder Mesh ohne blickdichtes Untergewand.

---

## 3. Hinduistische Traditionen (सनातन धर्म)

### 3.1 Beisetzung und Trauer (Antyeshti - अंतिम संस्कार)
- **Anlasstyp**: Hinduistische Feuerbestattung (Kremation), Trauerprozession, Kondolenz.
- **Formalitätsgrad**: Feierlich, rein, asketisch.
- **Farbpalette**: **Ausschließlich schlichtes, ungemustertes, reines Weiß**.
- **Silhouetten**:
  - **Herren**: Schlichte weiße Kurta-Pyjama oder weißes Baumwollhemd mit heller Stoffhose.
  - **Damen**: Einfacher weißer Baumwollsari oder weißer Salwar Kamiz ohne Stickereien oder Verzierungen.
- **Strikte Verbote**:
  - **ABSOLUTES VERBOT VON SCHWARZ**: In der hinduistischen Tradition gilt Schwarz als unheilvoll und ist bei Beerdigungen strikt untersagt.
  - KEINE leuchtenden oder fröhlichen Farben (Rot, Gold, Orange, Pink).
  - KEINE Lederschuhe oder Ledergürtel auf heiligen Verbrennungsplätzen oder in Tempelritualen.

### 3.2 Hochzeiten und Festtage (Vivaha & Diwali - विवाह उत्सव)
- **Anlasstyp**: Hinduistische Hochzeitszeremonien (Sangeet, Baraat, Pheras), Diwali, glückverheißende Feste.
- **Formalitätsgrad**: Prachtvoll, festlich, hochoffiziell.
- **Farbpalette**: Glückbringendes Rot, sattes Kastanienrot (Maroontöne), Gold, Safran, Smaragdgrün, Rani-Pink.
- **Strikte Verbote**:
  - **VERBOT VON DURCHGEHEND SCHWARZ**: Schwarz gilt bei Hochzeitsfeiern als unheilbringend und wird strikt vermieden.
  - **VERBOT VON SCHLICHTEM WEISS**: Reines Weiß wird mit Witwentum und Trauer assoziiert und ist für Hochzeitsgäste tabu.

---

## 4. Ostasiatische Traditionen (东亚礼仪 / 東アジアの儀礼)

### 4.1 Beerdigungen und Gedenkfeiern (葬礼 / お葬式 / 장례식)
- **Anlasstyp**: Chinesische, japanische und koreanische Beisetzungen und Ahnenfeiern.
- **Formalitätsgrad**: Formelle dunkle Trauerkleidung.
- **Farbpalette**: Schlichter schwarzer Anzug, weißes Hemd, matte schwarze Krawatte (Herren); schlichtes schwarzes Kleid oder dunkler Trauer-Kimono (Damen).
- **Strikte Verbote**:
  - **ABSOLUTES VERBOT VON ROT UND GOLD**: In ostasiatischen Kulturen stehen Rot und Gold für ausgelassene Freude und Festlichkeit; das Tragen bei einer Trauerfeier gilt als unverzeihlicher Affront.
  - KEINE bunten Krawatten, glänzenden Schmuckmetalle oder lauten Accessoires.

### 4.2 Hochzeiten und Festbankette (婚礼 / 結婚披露宴)
- **Farbpalette**: Feierliche, dezente Farben (Pastelltöne, Marineblau, feines Grau, Zartrosa, Juwelentöne).
- **Strikte Verbote**:
  - **KEIN DURCHGEHENDES ROT FÜR GÄSTE**: Bei traditionellen chinesischen Hochzeiten ist Rot exklusiv der Braut vorbehalten.
  - **KEIN REINES WEISS FÜR GÄSTE**: Weiß ist der Braut vorbehalten.

---

## 5. Westliche formelle Standards

### 5.1 Black Tie & Gala-Abende
- **Anlasstyp**: Wohltätigkeitsgalas, Opernpremieren, hochoffizielle Abendempfänge.
- **Anforderungen**:
  - **Herren**: Schwarzer oder mitternachtsblauer Smoking (Dinner Jacket) mit Seiden- oder Ripsrevers, passende Smokinghose mit Galonstreifen, weißes Smokinghemd mit Steh- oder Kläppchenkragen, schwarze Seidenschleife (Bow Tie), Kummerbund oder tief geschnittene Weste, schwarze Lack- oder hochglanzpolierte Abendschuhe.
  - **Damen**: Bodenlanges Abendkleid (Evening Gown), eleganter Abendschmuck, kleine Abend-Clutch.
- **Strikte Verbote**:
  - KEINE normalen Büroanzüge oder Tagesblazer.
  - KEINE Langbinder-Krawatten (Fliege ist für Herren obligatorisch).
  - KEINE Sneaker, Freizeitschuhe oder offenen Sandalen für Herren.

### 5.2 Etikette für Hochzeitsgäste
- **Anlasstyp**: Kirchliche, standesamtliche oder feierliche Hochzeitsfeste.
- **Anforderungen**: Semi-formell bis festlich elegant; Cocktail- oder Midikleider; elegante Anzüge in Marineblau oder Anthrazit.
- **Strikte Verbote**:
  - **KEIN REINES WEISS, CREME, ELFENBEIN ODER CHAMPAGNER**: Diese Farbtöne sind ausnahmslos der Braut vorbehalten.
  - KEINE Jeans, T-Shirts oder Sportschuhe.

---

## 6. Technische Umsetzung und Systemintegration

### RAG-basierte Regelverankerung
1. Jeder der obigen Abschnitte ist als kanonisches Axiom in `backend/app/data/fashion_rules_seed.json` hinterlegt.
2. Der dynamische Retriever in `fashion_rules_rag.py` schlägt automatisch bei Erkennung multilingualer Schlüsselbegriffe an.
3. Die Stylist QA Engine (`stylist_qa_engine.py`) erzwingt negative Vorgaben deterministisch in Python: Verbotene Farben (z. B. Rot bei Schiwa, Schwarz bei Antyeshti) werden vollautomatisch verworfen und sprachliche Wendungen präzise normiert.
"""

# ---------------------------------------------------------------------------
# SPANISH (es)
# ---------------------------------------------------------------------------
TRANSLATIONS["es"] = """# Guía de Fundamentación Cultural y Tradicional del Atuendo

## Resumen
DressApp ofrece estilismo inteligente y culturalmente fundamentado en 13 idiomas. En lugar de depender de deducciones probabilísticas de modelos de lenguaje pequeños (SLM) —que con frecuencia alucinan o confunden ritos religiosos diversos—, DressApp aplica **Axiomas Fundamentales (Ground-Truth Axioms)** auditados por expertos.

Este documento define los protocolos canónicos de vestimenta, requisitos de silueta, prohibiciones estrictas y terminología lingüística localizada para las principales tradiciones del mundo.

---

## 1. Tradiciones Judías (יהדות)

### 1.1 Etiqueta de Shiva y Duelo (שבעה, Duelo y Pésame)
- **Tipo de ocasión**: Condolencias, visitas de duelo, funerales y homenajes.
- **Nivel de formalidad**: Respetuoso, solemne y discreto.
- **Paleta de colores**: Negro liso, gris carbón, pizarra oscuro, azul marino profundo, marrón oscuro o tonos tierra tenues. Evite colores primarios brillantes, pasteles luminosos, blanco, dorado o rojo.
- **Siluetas y cortes**:
  - **Hombres**: Pantalones de vestir pulcros o vaqueros oscuros lisos sin roturas; camisa abotonada oscura lisa, polo liso o camiseta oscura de cuello redondo limpio; calzado formal oscuro y sobrio o mocasines discretos.
  - **Mujeres**: Vestidos midi o maxi recatados, faldas largas o pantalones de vestir elegantes; prendas superiores con mangas que cubran hombros y brazos; escote conservador.
- **Prohibiciones estrictas (Negative Constraints)**:
  - NO camisetas con estampados gráficos, logotipos grandes, motivos de águilas o animales, ni leyendas jocosas.
  - NO pantalones cortos (shorts), vaqueros desgastados o rotos, ropa deportiva ni sandalias de playa.
  - NO colores llamativos como rojo brillante, amarillo, fucsia, dorado o tonos neón.
  - NO joyas de lujo ostentosas ni relojes llamativos.
- **Terminología cultural correcta**:
  - *Términos hebreos aprobados*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`.
  - *Errores de traducción automática prohibidos*: No utilizar frases literales defectuosas como `להולך בישיבה שבעה`.

### 1.2 Modestia Ortodoxa (Tzniut / צניעות)
- **Tipo de ocasión**: Cotidiana, sinagoga, eventos comunitarios y sagrados.
- **Nivel de formalidad**: Conservador, digno y sobrio.
- **Requisitos**:
  - **Mujeres**: Faldas y vestidos que cubran la rodilla incluso al sentarse; mangas que pasen del codo; escote que cubra la clavícula; tejidos opacos y no ceñidos. Para mujeres casadas ortodoxas, cubrir el cabello (peluca sheitel, pañuelo tichel o sombrero).
  - **Hombres**: Pantalones largos, camisas con cuello y mangas, cobertura de cabeza (kipá).
- **Prohibiciones estrictas**:
  - NO pantalones, vaqueros o shorts para mujeres ortodoxas.
  - NO prendas sin mangas sin una capa opaca exterior (chaqueta o cárdigan).
  - NO escotes pronunciados en V, espaldas descubiertas, transparencias ni aberturas altas.

### 1.3 Shabat y Festividades Religiosas (שבת וחגים)
- **Tipo de ocasión**: Celebración religiosa alegre, cena de viernes por la noche, servicios festivos.
- **Nivel de formalidad**: Elegante formal o smart-casual refinado.
- **Paleta de colores**: Blanco radiante, marfil, azul marino, celeste, tonos joya y pasteles suaves.
- **Prohibiciones estrictas**:
  - NO ropa de trabajo, atuendos deportivos, vaqueros rotos ni ropa informal de estar por casa.

---

## 2. Tradiciones Islámicas (الإسلام)

### 2.1 Oración del Viernes (Yumu'ah) y Visitas a Mezquitas
- **Tipo de ocasión**: Oración comunitaria del viernes, ingreso a mezquitas y espacios sagrados.
- **Nivel de formalidad**: Limpio, modesto y reverente.
- **Requisitos**:
  - **Hombres**: Pantalones largos limpios, thobe o kurta; hombros y pecho totalmente cubiertos; calcetines limpios (se retira el calzado a la entrada).
  - **Mujeres**: Abaya holgada, vestido maxi o túnica larga sobre pantalón amplio; cobertura total hasta muñecas y tobillos; hiyab que cubra cabello, orejas y cuello.
- **Prohibiciones estrictas**:
  - NO pantalones cortos por encima de la rodilla para hombres (obligación de cubrir el awrah).
  - NO prendas ajustadas que marquen la figura, tejidos transparentes ni escotes bajos.
  - NO prendas con imágenes de rostros humanos o animales en las salas de oración.

### 2.2 Modestia Diaria e Hiyab
- **Nivel de formalidad**: Informal a informal elegante (Casual a Smart-Casual).
- **Requisitos**: Telas opacas, cortes fluidos (corte en A, pantalones palazzo, gabardinas largas, kimonos o abayas), cuellos cerrados y mangas largas.
- **Prohibiciones estrictas**:
  - NO prendas con calados, rejillas o transparencias sin una capa interior opaca.

---

## 3. Tradiciones Hindúes (सनातन धर्म)

### 3.1 Funerales y Duelo (Antyeshti - अंतिम संस्कार)
- **Tipo de ocasión**: Cremación hindú, cortejo fúnebre y condolencias.
- **Nivel de formalidad**: Solemne, puro y austero.
- **Paleta de colores**: **Únicamente blanco liso, pulcro y sin adornos**.
- **Siluetas**:
  - **Hombres**: Kurta-pijama blanco liso o camisa de algodón blanco con pantalón claro neutro.
  - **Mujeres**: Sari de algodón blanco liso o salwar kameez blanco sin bordados ni detalles brillantes.
- **Prohibiciones estrictas**:
  - **PROHIBICIÓN ABSOLUTA DEL COLOR NEGRO**: En la tradición hindú, el negro se asocia a la mala fortuna y está estrictamente prohibido en funerales.
  - NO colores vivos ni alegres (rojo, dorado, naranja, rosa).
  - NO zapatos ni cinturones de cuero en crematorios sagrados o rituales en templos.

### 3.2 Bodas y Celebraciones (Vivaha y Diwali - विवाह उत्सव)
- **Tipo de ocasión**: Bodas hindúes (Sangeet, Baraat, Pheras), Diwali y festividades sagradas.
- **Nivel de formalidad**: Opulento, festivo y de gala.
- **Paleta de colores**: Rojos auspiciosos, granate oscuro, dorado, azafrán, verde esmeralda real y rosa rani.
- **Prohibiciones estrictas**:
  - **PROHIBICIÓN DEL NEGRO TOTAL**: El negro se evita rigurosamente en las bodas hindúes por considerarse de mal augurio.
  - **PROHIBICIÓN DEL BLANCO LISO**: El blanco liso se asocia al luto y la viudez, por lo que los invitados lo evitan por completo.

---

## 4. Tradiciones de Asia Oriental (东亚礼仪 / 東アジアの儀礼)

### 4.1 Funerales y Homenajes (葬礼 / お葬式 / 장례식)
- **Tipo de ocasión**: Funerales y ceremonias ancestrales en China, Japón y Corea.
- **Nivel de formalidad**: Duelo formal oscuro.
- **Paleta de colores**: Traje negro liso, camisa blanca, corbata negra lisa mate (hombres); vestido negro formal sobrio o kimono oscuro liso (mujeres).
- **Prohibiciones estrictas**:
  - **PROHIBICIÓN ABSOLUTA DEL ROJO Y DORADO**: En las culturas de Asia Oriental, el rojo y el dorado simbolizan alegría desbordante y fiesta; llevarlos a un funeral representa un insulto inadmisible.
  - NO corbatas coloridas, metales reflectantes ni accesorios llamativos.

### 4.2 Bodas y Banquetes (婚礼 / 結婚披露宴)
- **Paleta de colores**: Colores refinados y alegres (tonos pastel, marino, gris elegante, rosa suave, tonos joya).
- **Prohibiciones estrictas**:
  - **NO VESTIR DE ROJO COMPLETO LOS INVITADOS**: En bodas chinas, el rojo está reservado con exclusividad para la novia.
  - **NO VESTIR DE BLANCO COMPLETO LOS INVITADOS**: El blanco pertenece únicamente a la novia.

---

## 5. Estándares Formales Occidentales

### 5.1 Eventos de Gala y Black Tie
- **Tipo de ocasión**: Galas benéficas, aperturas de ópera, recepciones nocturnas formales.
- **Requisitos**:
  - **Hombres**: Esmoquin negro o azul noche (Midnight Blue) con solapas de satén, pantalón a juego con galón lateral, camisa de esmoquin blanca impecable, pajarita de seda negra, fajín o chaleco escotado, zapatos de charol negro pulidos.
  - **Mujeres**: Vestido de noche largo hasta el suelo, joyería de fiesta refinada, bolso de mano tipo clutch.
- **Prohibiciones estrictas**:
  - NO trajes de negocios convencionales ni chaquetas diurnas.
  - NO corbata larga común (la pajarita o corbata de lazo es obligatoria para hombres).
  - NO zapatillas deportivas, mocasines informales ni sandalias abiertas para hombres.

### 5.2 Etiqueta para Invitados a Bodas
- **Tipo de ocasión**: Ceremonias religiosas, bodas civiles, recepciones campestres o de salón.
- **Requisitos**: Semiformal a formal elegante; vestidos midi o de cóctel; trajes de vestir en tonos marino o marengo.
- **Prohibiciones estrictas**:
  - **PROHIBIDO EL BLANCO TOTAL, MARFIL O CHAMPÁN**: Reservados exclusivamente para la novia.
  - NO pantalones vaqueros, camisetas informales ni calzado deportivo.

---

## 6. Arquitectura de Implementación e Integración

### Extracción RAG Fundamentada
1. Cada sección se corresponde con un axioma en `backend/app/data/fashion_rules_seed.json`.
2. El recuperador dinámico en `fashion_rules_rag.py` se activa automáticamente mediante palabras clave multilingües.
3. El motor de control de calidad (`stylist_qa_engine.py`) aplica las restricciones negativas de forma determinista en Python, descartando piezas incompatibles (como rojo en Shiva o negro en funerales hindúes) y normalizando el lenguaje antes de mostrar la recomendación.
"""

# ---------------------------------------------------------------------------
# FRENCH (fr)
# ---------------------------------------------------------------------------
TRANSLATIONS["fr"] = """# Guide d'Ancrage Culturel et Traditionnel des Tenues

## Présentation générale
DressApp propose une expertise de stylisme sensible aux spécificités culturelles dans 13 langues. Plutôt que de s'en remettre aux approximations probabilistes de petits modèles linguistiques (SLM) — qui ont tendance à halluciner ou à confondre différents rituels religieux —, DressApp applique des **Axiomes Fondamentaux Vérifiés (Ground-Truth Axioms)** audités par des experts.

Ce document consigne les protocoles vestimentaires formels, les exigences de silhouette, les interdictions strictes et les terminologies locales propres aux grandes traditions mondiales.

---

## 1. Traditions Juives (יהדות)

### 1.1 Protocole de Shiva et Période de Deuil (שבעה, Deuil et Condoléances)
- **Type d'événement**: Visite de condoléances, veillée, commémoration, funérailles.
- **Degré de formalité**: Respectueux, sobre et mesuré.
- **Palette de couleurs**: Noir uni, gris anthracite, ardoise foncé, bleu marine profond, brun sombre ou teintes terreuses discrètes. Évitez les couleurs primaires vives, les pastels éclatants, le blanc, le doré ou le rouge.
- **Coupes & Silhouettes**:
  - **Hommes**: Pantalon habillé soigné ou jean brut foncé sans déchirures ; chemise boutonnée sombre et unie, polo sobre ou t-shirt col rond impeccable ; souliers sombres élégants ou mocassins discrets.
  - **Femmes**: Robes midi ou maxi pudiques, jupes longues ou pantalons droits bien coupés ; hauts avec manches couvrant les épaules et le haut des bras ; encolure mesurée.
- **Interdictions strictes (Negative Constraints)**:
  - AUCUN t-shirt à motifs graphiques, logos voyants, impressions animalières ou slogans humoristiques.
  - AUCUN bermuda/short, jean déchiré ou délavé, tenue de sport ou claquettes de plage.
  - AUCUNE couleur criarde (rouge vif, jaune, rose fuchsia, or, teintes fluorescentes).
  - AUCUN bijou de luxe ostentatoire ni montre clinquante.
- **Terminologie linguistique approuvée**:
  - *Termes hébreux officiels*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`.
  - *Erreurs de traduction automatique prohibées*: Ne jamais utiliser de formules calquées comme `להולך בישיבה שבעה`.

### 1.2 Pudeur Orthodoxe (Tsniout / צניעות)
- **Type d'événement**: Quotidien, synagogue, réunions communautaires et liturgiques.
- **Degré de formalité**: Conservateur, digne et pudique.
- **Exigences**:
  - **Femmes**: Jupes et robes couvrant les genoux même en position assise ; manches couvrant les coudes ; encolures masquant les clavicules ; tissus opaques non moulants. Pour les femmes mariées, couvre-chef (perruque sheitel, foulard tichel ou chapeau).
  - **Hommes**: Pantalon long, chemise habillée à manches, couvre-chef (kippa).
- **Interdictions strictes**:
  - AUCUN pantalon, jean ou short pour les femmes orthodoxes.
  - AUCUN haut sans manches sans veste ou gilet opaque par-dessus.
  - AUCUN décolleté plongeant, dos nu, transparence ou fente haute.

### 1.3 Chabbat et Jours de Fêtes (שבת וחגים)
- **Type d'événement**: Célébration religieuse joyeuse, dîner du vendredi soir, offices de fêtes.
- **Degré de formalité**: Élégance formelle ou smart-casual habillé.
- **Palette de couleurs**: Blanc immaculé, écru, bleu marine, bleu ciel, tons joyaux, pastels raffinés.
- **Interdictions strictes**:
  - AUCUN vêtement de travail, tenue sportive, jean troué ou tenue décontractée d'intérieur.

---

## 2. Traditions Islamiques (الإسلام)

### 2.1 Prière du Vendredi (Jumu'ah) et Visite de la Mosquée
- **Type d'événement**: Prière collective du vendredi, entrée dans une mosquée.
- **Degré de formalité**: Pur, sobre, respectueux et propre.
- **Exigences**:
  - **Hommes**: Pantalon long propre, qamis (thobe) ou kurta ; épaules et torse entièrement couverts ; chaussettes propres (les chaussures sont retirées à l'entrée).
  - **Femmes**: Abaya ample, robe longue ou tunique longue sur pantalon fluide ; couverture complète jusqu'aux poignets et chevilles ; hijab recouvrant les cheveux, les oreilles et le cou.
- **Interdictions strictes**:
  - AUCUN short au-dessus ou au niveau du genou pour les hommes (respect de la 'awra).
  - AUCUN vêtement moulant qui souligne les courbes, textile transparent ou encolure échancrée.
  - AUCUN motif représentant des visages humains ou animaux dans les espaces de prière.

### 2.2 Pudeur Quotidienne et Hijab
- **Degré de formalité**: Décontracté chic (Casual à Smart-Casual).
- **Exigences**: Tissus opaques, coupes amples et fluides (coupe trapèze, pantalons palazzo, trenchs longs, kimonos ou abayas), cols hauts et manches longues.
- **Interdictions strictes**:
  - AUCUN empiècement ajouré ou dentelle transparente sans doublure intégrale.

---

## 3. Traditions Hindoues (सनातन धर्म)

### 3.1 Funérailles et Deuil (Antyeshti - अंतिम संस्कार)
- **Type d'événement**: Crémation hindoue, cortège funèbre, recueillement.
- **Degré de formalité**: Solennel, pur et épuré.
- **Palette de couleurs**: **Blanc uni, modeste et sans aucun motif uniquement**.
- **Silhouettes**:
  - **Hommes**: Kurta-pyjama blanc uni ou chemise en coton blanc avec pantalon clair sobre.
  - **Femmes**: Sari en coton blanc uni ou salwar kameez blanc sans broderies ni dorures.
- **Interdictions strictes**:
  - **INTERDICTION ABSOLUE DU NOIR**: Dans la tradition hindoue, le noir est associé au mauvais présage et formellement proscrit lors des funérailles.
  - AUCUNE couleur vive ou joyeuse (rouge, or, orange, rose).
  - AUCUN article en cuir (chaussures ou ceintures) sur les lieux sacrés de crémation et dans les temples.

### 3.2 Mariages et Grandes Fêtes (Vivaha & Diwali - विवाह उत्सव)
- **Type d'événement**: Cérémonies de mariage (Sangeet, Baraat, Pheras), fête de Diwali.
- **Degré de formalité**: Fastueux, festif et somptueux.
- **Palette de couleurs**: Rouge faste, bordeaux intense, or, safran, vert émeraude royal, rose rani éclatant.
- **Interdictions strictes**:
  - **PROHIBITION DU NOIR TOTAL**: Couleur néfaste lors des mariages hindous, rigoureusement évitée.
  - **PROHIBITION DU BLANC SIMPLE**: Associé au deuil et au veuvage, le blanc immaculé est proscrit pour les invités.

---

## 4. Traditions d'Asie de l'Est (东亚礼仪 / 東アジアの儀礼)

### 4.1 Funérailles et Hommages (葬礼 / お葬式 / 장례식)
- **Type d'événement**: Funérailles et culte des ancêtres en Chine, au Japon et en Corée.
- **Degré de formalité**: Deuil formel sombre.
- **Palette de couleurs**: Costume noir uni, chemise blanche, cravate noire mate unie (hommes) ; robe noire modeste ou kimono de deuil foncé (femmes).
- **Interdictions strictes**:
  - **INTERDICTION FORMELLE DU ROUGE ET DU DORÉ**: En Asie de l'Est, le rouge et l'or incarnent la joie suprême ; les porter à des obsèques constitue un affront impardonnable.
  - AUCUNE cravate colorée, bijou métallique éclatant ni accessoire clinquant.

### 4.2 Mariages et Banquets (婚礼 / 結婚披露宴)
- **Palette de couleurs**: Nuances festives raffinées (tons pastel, marine, gris perle, rose poudré, tons joyaux).
- **Interdictions strictes**:
  - **ROUGE INTÉGRAL INTERDIT AUX INVITÉS**: Dans les mariages chinois, le rouge est l'apanage exclusif de la mariée.
  - **BLANC INTÉGRAL INTERDIT AUX INVITÉS**: Réservé à la mariée.

---

## 5. Protocoles Formels Occidentaux

### 5.1 Soirées Black Tie et Galas
- **Type d'événement**: Galas de bienfaisance, premières d'opéra, réceptions d'ambassade.
- **Exigences**:
  - **Hommes**: Smoking noir ou bleu nuit (Midnight Blue) avec revers en satin ou gros-grain, pantalon assorti avec galon en satin, chemise de smoking blanche à plastron, nœud papillon en soie noire, ceinture de smoking (cummerbund) ou gilet échancré, souliers vernis noirs.
  - **Femmes**: Robe de soirée longue jusqu'au sol, bijoux d'apparat discrets, minaudière ou pochette de soirée.
- **Interdictions strictes**:
  - AUCUN costume de ville standard ni veste d'affaires diurne.
  - AUCUNE cravate longue (le nœud papillon est strictement obligatoire pour les hommes).
  - AUCUNE basket ni soulier décontracté.

### 5.2 Tenue des Invités aux Mariages Occidentaux
- **Type d'événement**: Mariage à l'église, célébration laïque, réception en domaine.
- **Exigences**: Robes cocktail ou midi raffinées ; costumes habillés bleu marine ou gris anthracite.
- **Interdictions strictes**:
  - **INTERDICTION DU BLANC PUR, ÉCRU, IVOIRE OU CHAMPAGNE**: Strictement réservés à la mariée.
  - AUCUN jean, t-shirt ou chaussure de sport.

---

## 6. Architecture d'Intégration et Déploiement

### Extraction de Règles RAG
1. Chaque tradition est modélisée par un axiome canonique dans `backend/app/data/fashion_rules_seed.json`.
2. Le moteur de recherche sémantique dans `fashion_rules_rag.py` s'active sur des expressions multilingues.
3. Le moteur d'assurance qualité (`stylist_qa_engine.py`) applique les exclusions de manière déterministe en Python (rejet automatique des couleurs proscrites comme le rouge à la Shiva ou le noir aux funérailles hindoues) et affine les tournures linguistiques avant restitution.
"""

# ---------------------------------------------------------------------------
# HINDI (hi)
# ---------------------------------------------------------------------------
TRANSLATIONS["hi"] = """# सांस्कृतिक एवं पारंपरिक परिधान मार्गदर्शिका (Cultural Grounding Guide)

## अवलोकन
DressApp 13 भाषाओं में सांस्कृतिक रूप से संवेदनशील स्टाइलिंग विशेषज्ञता प्रदान करता है। छोटे भाषा मॉडलों (SLM) के अनिश्चित अनुमानों पर निर्भर रहने के बजाय — जो अक्सर विभिन्न धार्मिक रीति-रिवाजों में भ्रमित हो जाते हैं — DressApp मानव-सत्यापित **प्रामाणिक सिद्धांतों (Ground-Truth Axioms)** को कड़ाई से लागू करता है।

यह दस्तावेज़ वैश्विक परंपराओं के प्रामाणिक ड्रेस कोड, कट और बनावट की आवश्यकताओं, सख्त निषेधों और स्थानीय शब्दावली को परिभाषित करता है।

---

## 1. यहूदी परंपराएं (יהדות)

### 1.1 शिवा और शोक शिष्टाचार (שבעה एवं सांत्वना सभा)
- **अवसर का प्रकार**: शोक सभा, सांत्वना भेंट, स्मारक, अंतिम संस्कार।
- **औपचारिकता का स्तर**: गरिमापूर्ण, शांत और संयमित।
- **रंग योजना**: गहरा काला, चारकोल ग्रे, गहरा स्लेटी, गहरा नेवी ब्लू, गहरा भूरा या हल्के मिट्टी के रंग। चमकीले प्राथमिक रंगों, पेस्टल, सफेद, सुनहरे या लाल रंगों से बचें।
- **पहनावा**:
  - **पुरुष**: साफ-सुथरे औपचारिक पतलून या बिना किसी कट्स के गहरी जींस; सादी गहरी बटन-डाउन शर्ट, सादी पोलो या साधारण गोल गले की टी-शर्ट; गहरे शांत औपचारिक जूते या लोफर्स।
  - **महिलाएं**: शालीन मिडी या मैक्सी ड्रेस, लंबी स्कर्ट या सुरुचिपूर्ण ट्राउजर्स; कंधों और भुजाओं को ढकने वाली आस्तीन वाले टॉप; शालीन नेकलाइन।
- **सख्त निषेध (Negative Constraints)**:
  - ग्राफिक टी-शर्ट, बड़े ब्रांड लोगो, चील/जानवरों के प्रिंट या व्यंग्यात्मक नारों वाले कपड़े बिल्कुल न पहनें।
  - शॉर्ट्स, फटी हुई (डिस्ट्रॉएड) जींस, जिम के कपड़े या बीच की चप्पलें बिल्कुल न पहनें।
  - भड़कीले लाल, पीले, चमकीले गुलाबी, सुनहरे या नियॉन रंगों के कपड़े न पहनें।
  - अत्यधिक चमक-दमक वाले महंगे गहने या ध्यान खींचने वाली घड़ियां न पहनें।
- **प्रामाणिक हिब्रू शब्दावली**:
  - *स्वीकृत शब्द*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`।
  - *गलत मशीन अनुवाद*: `להולך בישיבה שבעה` जैसे गलत शाब्दिक अनुवादों का उपयोग कभी न करें।

### 1.2 रूढ़िवादी शालीनता (त्ज़निउत - Tzniut / צניעות)
- **अवसर का प्रकार**: दैनिक, आराधनालय (सिनागॉग), समुदाय और पवित्र सभाएं।
- **औपचारिकता**: पारंपरिक, शालीन और आदरणीय।
- **आवश्यकताएं**:
  - **महिलाएं**: बैठने पर भी घुटनों से नीचे तक जाने वाली स्कर्ट या ड्रेस; कोहनी से नीचे तक की आस्तीन; कॉलरबोन को ढकने वाला गला; अपारदर्शी और ढीले कपड़े। विवाहित महिलाओं के लिए सिर ढकना (शीटल, टिकेल या टोपी)।
  - **पुरुष**: पूरी पैंट, आस्तीन वाली कॉलर शर्ट, सिर का आवरण (किप्पा)।
- **सख्त निषेध**:
  - रूढ़िवादी महिलाओं के लिए पैंट, जींस या शॉर्ट्स का निषेध।
  - बिना बाहरी जैकेट या कार्डिगन के बिना आस्तीन वाले (स्लीवलेस) कपड़े न पहनें।
  - गहरे वी-नेक, खुली पीठ, पारदर्शी कपड़े या ऊंची स्लिट वाली स्कर्ट वर्जित हैं।

### 1.3 शब्बत और पर्व (שבת וחגים)
- **अवसर का प्रकार**: आनंदमय धार्मिक उत्सव, शुक्रवार शाम का भोज, पर्व की प्रार्थना।
- **औपचारिकता**: सुरुचिपूर्ण स्मार्ट-कैजुअल से लेकर औपचारिक परिधान।
- **रंग योजना**: चमकीला सफेद, क्रीम, नेवी, आसमानी नीला, गहरे शाही रंग।
- **सख्त निषेध**:
  - काम के कपड़े (वर्कवियर), स्पोर्ट्सवियर, फटी जींस या घर के आरामदायक लाउंजवियर वर्जित हैं।

---

## 2. इस्लामिक परंपराएं (الإسلام)

### 2.1 जुमे की नमाज़ और मस्जिद का दौरा (صلاة الجمعة وزيارة المسجد)
- **अवसर का प्रकार**: शुक्रवार की जुमे की नमाज़, मस्जिद में प्रवेश।
- **औपचारिकता**: स्वच्छ, शालीन, विनम्र और आदरपूर्ण।
- **आवश्यकताएं**:
  - **पुरुष**: स्वच्छ लंबी पैंट, जुब्बा (थोब) या कुर्ता; कंधे और छाती पूरी तरह ढके हुए; साफ मोज़े (प्रवेश द्वार पर जूते उतारे जाते हैं)।
  - **महिलाएं**: ढीली अबाया, मैक्सी ड्रेस या ढीले ट्राउजर पर लंबा कुर्ता; कलाई और टखनों तक पूरा आवरण; बालों, कानों और गर्दन को पूरी तरह ढकने वाला हिजाब।
- **सख्त निषेध**:
  - पुरुषों के लिए घुटने से ऊपर शॉर्ट्स वर्जित हैं (सतर/अवरह का नियम)।
  - तंग, शरीर से चिपके हुए कपड़े, पारदर्शी फैब्रिक या गहरे गले वाले कपड़े न पहनें।
  - नमाज़ के स्थानों में इंसानी चेहरों या जानवरों के प्रिंट वाले कपड़े न पहनें।

### 2.2 दैनिक शालीन पोशाक (हिजमा और हिजाब)
- **औपचारिकता**: कैजुअल से स्मार्ट-कैजुअल।
- **आवश्यकताएं**: अपारदर्शी कपड़े, ढीले-ढाले सिल्हूट (ए-लाइन, पलाज़ो, लंबे ट्रेंच, किमोनो या अबाया), ऊंचे गले और लंबी आस्तीन।

---

## 3. सनातन धर्म और हिंदू परंपराएं (सनातन धर्म)

### 3.1 अंतिम संस्कार और शोक (Antyeshti - अंतिम संस्कार)
- **अवसर का प्रकार**: हिंदू दाह-संस्कार, शवयात्रा, शोक सभा।
- **औपचारिकता**: शांत, पवित्र, सात्विक और आडंबरहीन।
- **रंग योजना**: **केवल और केवल सादा, बिना किसी कढ़ाई का कोरा सफेद**।
- **पहनावा**:
  - **पुरुष**: सादा सफेद कुर्ता-पायजामा या हल्के सादे पैंट के साथ सफेद सूती शर्ट।
  - **महिलाएं**: बिना किसी सुनहरे काम की सादी सफेद सूती साड़ी या सादा सफेद सलवार-कमीज।
- **सख्त निषेध**:
  - **काले रंग पर पूर्ण प्रतिबंध**: हिंदू परंपरा में काला रंग अशुभ माना जाता है और अंतिम संस्कार में इसे पहनना पूरी तरह से वर्जित है।
  - चमकीले और उत्सव के रंग (लाल, सुनहरा, संतरी, गुलाबी) बिल्कुल न पहनें।
  - श्मशान भूमि और धार्मिक अनुष्ठानों में चमड़े के जूते या चमड़े की बेल्ट का प्रयोग न करें।

### 3.2 विवाह एवं धार्मिक उत्सव (Vivaha & Diwali - विवाह उत्सव)
- **अवसर का प्रकार**: हिंदू विवाह समारोह (संगीत, बारात, फेरे), दीपावली और मांगलिक पर्व।
- **औपचारिकता**: भव्य, उत्सवपूर्ण और उच्च औपचारिक।
- **रंग योजना**: शुभ लाल, गहरा मैरून, सुनहरा, केसरिया, पन्ना हरा, रानी गुलाबी।
- **पहनावा**: पुरुषों के लिए शेरवानी, जोधपुरी बंदगला, नेहरू जैकेट के साथ कुर्ता; महिलाओं के लिए लहंगा, बनारसी/कांचीवरम साड़ी, अनारकली।
- **सख्त निषेध**:
  - **पूरी तरह काले रंग का निषेध**: हिंदू विवाह में काले रंग को अशुभ मानकर पूरी तरह टाला जाता है।
  - **सादे सफेद रंग का निषेध**: सादा सफेद रंग शोक और वैधव्य से जुड़ा है, इसलिए शादी के मेहमानों को सादा सफेद पहनने की मनाही होती है।

---

## 4. पूर्वी एशियाई परंपराएं (东亚礼仪 / 東アジアの儀礼)

### 4.1 अंतिम संस्कार और श्राद्ध (葬礼 / お葬式 / 장례식)
- **अवसर का प्रकार**: चीन, जापान और कोरिया में अंतिम संस्कार और पूर्वजों की स्मृति सभा।
- **औपचारिकता**: औपचारिक गहरा शोक परिधान।
- **रंग योजना**: सादा काला सूट, सफेद शर्ट, बिना चमक वाली सादी काली टाई (पुरुष); सादी औपचारिक काली पोशाक या गहरा किमोनो (महिलाएं)।
- **सख्त निषेध**:
  - **लाल और सुनहरे रंग पर पूर्ण प्रतिबंध**: पूर्वी एशियाई संस्कृतियों में लाल और सुनहरा रंग अत्यधिक खुशी और उत्सव का प्रतीक है; अंतिम संस्कार में इन्हें पहनना असहनीय अपमान माना जाता है।
  - रंग-बिरंगी टाई, चमकीले गहने या भड़कीले सामान न पहनें।

### 4.2 विवाह और मांगलिक भोज (婚礼 / 結婚披露宴)
- **रंग योजना**: सुरुचिपूर्ण उत्सव के रंग (पेस्टल, नेवी, ग्रे, हल्का गुलाबी, रत्न रंग)।
- **सख्त निषेध**:
  - **मेहमानों के लिए पूर्ण लाल रंग वर्जित है**: चीनी शादियों में लाल रंग केवल और केवल दुल्हन के लिए आरक्षित होता है।
  - **मेहमानों के लिए पूर्ण सफेद रंग वर्जित है**: पश्चिमी और आधुनिक शादियों में सफेद रंग सिर्फ दुल्हन के लिए होता है।

---

## 5. पश्चिमी औपचारिक मानक

### 5.1 ब्लैक टाई और भव्य रात्रि समारोह (Black Tie)
- **अवसर का प्रकार**: चैरिटी गाला, ओपेरा का उद्घाटन, औपचारिक शाम की दावतें।
- **आवश्यकताएं**:
  - **पुरुष**: साटन कॉलर वाला काला या मिडनाइट ब्लू टक्सीडो, मैचिंग पैंट, सफेद टक्सीडो शर्ट, रेशमी काली बो-टाई, कमरबंद या वेस्टकोट, पॉलिश किए हुए काले पेटेंट लेदर जूते।
  - **महिलाएं**: फर्श तक लंबी औपचारिक इवनिंग गाउन, सुरुचिपूर्ण शाम के आभूषण, छोटा क्लच बैग।
- **सख्त निषेध**:
  - सामान्य ऑफिस सूट या दिन के ब्लेज़र न पहनें।
  - लंबी साधारण टाई न पहनें (काली बो-टाई पहनना अनिवार्य है)।
  - स्नीकर्स या कैजुअल सैंडल न पहनें।

### 5.2 पश्चिमी शादियों में मेहमानों का शिष्टाचार
- **अवसर**: चर्च या बैंक्वेट हॉल की शादियां।
- **आवश्यकताएं**: सेमी-फॉर्मल से स्मार्ट-फॉर्मल; मिडी या कॉकटेल ड्रेस; नेवी या चारकोल के औपचारिक सूट।
- **सख्त निषेध**:
  - **सफेद, क्रीम या आइवरी रंग पूरी तरह वर्जित**: ये रंग विशेष रूप से दुल्हन के लिए आरक्षित होते हैं।
  - जींस, टी-शर्ट या स्पोर्ट्स जूते न पहनें।

---

## 6. कार्यान्वयन एवं प्रणाली एकीकरण (Implementation)

### RAG-आधारित नियम निष्कर्षण
1. प्रत्येक अनुभाग `backend/app/data/fashion_rules_seed.json` में एक अद्वितीय नियम से जुड़ा है।
2. `fashion_rules_rag.py` में खोज इंजन बहुभाषी शब्दों के आधार पर नियमों को स्वचालित रूप से लोड करता है।
3. क्वालिटी एश्योरेंस इंजन (`stylist_qa_engine.py`) पायथन कोड के माध्यम से निषेधों को लागू करता है — जैसे शोक में लाल रंग या हिंदू अंतिम संस्कार में काले रंग को पूरी तरह से हटाना।
"""

# ---------------------------------------------------------------------------
# ITALIAN (it)
# ---------------------------------------------------------------------------
TRANSLATIONS["it"] = """# Guida ai Protocolli Culturali e Tradizionali di Abbigliamento

## Panoramica
DressApp offre consulenze di stile attente alle tradizioni e alle culture in 13 lingue. Anziché affidarsi a deduzioni probabilistiche di piccoli modelli linguistici (SLM) — che rischiano di confondere o inventare dettagli sui diversi riti religiosi —, DressApp adotta **Assiomi Fondamentali Verificati (Ground-Truth Axioms)** revisionati da esperti.

Questo documento definisce i protocolli formali di abbigliamento, le silhouette prescritte, i divieti tassativi e la terminologia linguistica locale delle grandi tradizioni internazionali.

---

## 1. Tradizioni Ebraiche (יהדות)

### 1.1 Etichetta per Shiva e Lutto (שבעה, Lutto e Condoglianze)
- **Tipo di occasione**: Visita di condoglianze, veglia, commemorazione, funerale.
- **Grado di formalità**: Rispettoso, solenne e sobrio.
- **Tavolozza dei colori**: Nero pieno, grigio antracite, ardesia scuro, blu notte profondo, marrone scuro o tonalità della terra smorzate. Evitare colori primari vivaci, tonalità pastello luminose, bianco, oro o rosso.
- **Tagli e silhouette**:
  - **Uomini**: Pantaloni sartoriali curati o jeans scuri senza strappi; camicia scura sobria con colletto, polo a tinta unita o t-shirt scura a girocollo pulita; scarpe scure formali o mocassini discreti.
  - **Donne**: Abiti midi o maxi modesti, gonne lunghe o pantaloni dal taglio classico; maglie con maniche che coprano spalle e braccia; scollatura castigata.
- **Divieti tassativi (Negative Constraints)**:
  - NESSUNA t-shirt con scritte grafiche, loghi appariscenti, stampe animalier o slogan spiritosi.
  - NESSUN pantaloncino corto, jeans strappato, abbigliamento da palestra o ciabatte da spiaggia.
  - NESSUN colore sgargiante come rosso acceso, giallo, fucsia, oro o tinte neon.
  - NESSUN gioiello vistoso o orologio di lusso ostentato.
- **Terminologia corretta**:
  - *Termini ebraici approvati*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`.
  - *Errori di traduzione automatica vietati*: Non usare traduzioni letterali errate come `להולך בישיבה שבעה`.

### 1.2 Modestia Ortodossa (Tzniut / צניעות)
- **Tipo di occasione**: Quotidiano, sinagoga, momenti comunitari e liturgie solenni.
- **Grado di formalità**: Tradizionale, dignitoso e sobrio.
- **Requisiti**:
  - **Donne**: Gonne e abiti che coprano le ginocchia anche da sedute; maniche che oltrepassino il gomito; scollatura che copra la clavicola; tessuti coprenti e non aderenti. Per le donne sposate, copricapo (parrucca sheitel, foulard tichel o cappello).
  - **Uomini**: Pantaloni lunghi, camicia con colletto e maniche, copricapo (kippah).
- **Divieti tassativi**:
  - NESSUN pantalone o shorts per donne ortodosse.
  - NESSUN top smanicato senza un capo coprente sopra (blazer o cardigan).
  - NESSUNA scollatura a V profonda, schiena scoperta o spacchi vertiginosi.

### 1.3 Shabbat e Festività Religiose (שבת וחגים)
- **Tipo di occasione**: Celebrazione lieta, cena del venerdì sera, liturgia festiva.
- **Grado di formalità**: Smart-casual raffinato fino all'abito formale da cerimonia.
- **Tavolozza dei colori**: Bianco luminoso, avorio, blu navy, celeste, toni gioiello e pastelli fini.
- **Divieti tassativi**:
  - NESSUN abbigliamento da lavoro, tenuta sportiva o capi casual da casa.

---

## 2. Tradizioni Islamiche (الإسلام)

### 2.1 Preghiera del Venerdì (Jumu'ah) e Visita alla Moschea
- **Tipo di occasione**: Preghiera comunitaria del venerdì, ingresso nei luoghi sacri.
- **Grado di formalità**: Puro, modesto, pulito e rispettoso.
- **Requisiti**:
  - **Uomini**: Pantaloni lunghi e puliti, thobe o kurta; spalle e petto interamente coperti; calze pulite (si tolgono le scarpe all'ingresso).
  - **Donne**: Abaya fluida, maxi abito o tunica lunga su pantaloni ampi; copertura totale fino a polsi e caviglie; hijab che copra interamente capelli, orecchie e collo.
- **Divieti tassativi**:
  - NESSUN pantalone corto sopra il ginocchio per uomini (copertura dell'awrah).
  - NESSUN capo attillato, tessuto velato o scollatura ampia.
  - NESSUN disegno raffigurante volti umani o animali nelle aree di preghiera.

---

## 3. Tradizioni Induiste (सनातन धर्म)

### 3.1 Funerali e Riti di Commiato (Antyeshti - अंतिम संस्कार)
- **Tipo di occasione**: Cremazione induista, corteo funebre, condoglianze.
- **Grado di formalità**: Solenne, puro, austero e privo di vanità.
- **Tavolozza dei colori**: **Esclusivamente bianco semplice, liscio e privo di decorazioni**.
- **Silhouette**:
  - **Uomini**: Kurta-pigiama bianco o camicia di cotone bianco con pantaloni chiari neutri.
  - **Donne**: Sari di cotone bianco semplice o salwar kameez bianco senza ricami né paillettes.
- **Divieti tassativi**:
  - **DIVIETO ASSOLUTO DEL NERO**: Nella tradizione induista, il nero porta sfortuna ed è rigorosamente proibito ai funerali.
  - NESSUN colore acceso o festoso (rosso, oro, arancio, rosa).
  - NESSUN accessorio in cuoio o pelle all'interno dei luoghi sacri di cremazione o dei templi.

### 3.2 Matrimoni e Ricorrenze Festose (Vivaha & Diwali - विवाह उत्सव)
- **Tipo di occasione**: Cerimonie nuziali indù (Sangeet, Baraat, Pheras), festa di Diwali.
- **Grado di formalità**: Sfarzoso, gioioso e di altissima eleganza.
- **Tavolozza dei colori**: Rossi di buon auspicio, bordeaux sontuoso, oro, zafferano, verde smeraldo, rosa rani.
- **Divieti tassativi**:
  - **DIVIETO DI INDOSSARE IL NERO**: Il nero è bandito dalle nozze indù poiché considerato infausto.
  - **DIVIETO DI INDOSSARE IL BIANCO CANDIDO**: Il bianco puro è legato al lutto e alla vedovanza; è assolutamente vietato agli invitati.

---

## 4. Tradizioni dell'Asia Orientale (东亚礼仪 / 東アジアの儀礼)

### 4.1 Funerali e Cerimonie dei Defunti (葬礼 / お葬式 / 장례식)
- **Tipo di occasione**: Esequie e riti commemorativi in Cina, Giappone e Corea.
- **Grado di formalità**: Lutto formale scuro.
- **Tavolozza dei colori**: Abito nero a tinta unita, camicia bianca, cravatta nera opaca (uomini); abito nero modesto o kimono da lutto scuro (donne).
- **Divieti tassativi**:
  - **DIVIETO ASSOLUTO DI ROSSO E ORO**: In Asia orientale, il rosso e l'oro incarnano la massima felicità; indossarli a un funerale rappresenta un'offesa imperdonabile.
  - NESSUNA cravatta colorata o gioiello metallico riflettente.

### 4.2 Matrimoni e Banchetti Nuziali (婚礼 / 結婚披露宴)
- **Tavolozza dei colori**: Tinte festive raffinate (pastelli, blu navy, grigio chiaro, rosa cipria).
- **Divieti tassativi**:
  - **IL ROSSO COMPLETO È VIETATO AGLI INVITATI**: Nei matrimoni cinesi il rosso è riservato esclusivamente alla sposa.
  - **IL BIANCO CANDIDO È VIETATO AGLI INVITATI**: Riservato alla sposa.

---

## 5. Norme Formali Occidentali

### 5.1 Serate di Gala e Black Tie
- **Tipo di occasione**: Serate benefiche, prime d'opera, ricevimenti serali di gala.
- **Requisiti**:
  - **Uomini**: Smoking (Tuxedo) nero o blu notte con revers in raso, pantaloni abbinati con banda laterale in raso, camicia da smoking bianca con sparato, papillon in seta nera, fascia da smoking o gilet scollato, scarpe in vernice nera.
  - **Donne**: Abito lungo da gran sera fino a terra, gioielli d'alta classe, pochette da sera.
- **Divieti tassativi**:
  - NESSUN completo da ufficio da giorno.
  - NESSUNA cravatta lunga (il papillon nero è tassativo per gli uomini).
  - NESSUNA sneaker o calzatura casual.

### 5.2 Galateo per Invitati a Nozze Occidentali
- **Requisiti**: Abiti da cocktail o midi ricercati; completi sartoriali blu scuro o grigio antracite.
- **Divieti tassativi**:
  - **DIVIETO DI INDOSSARE BIANCO, AVORIO O CHAMPAGNE**: Riservati unicamente alla sposa.
  - NESSUN jeans o capo sportivo.

---

## 6. Architettura di Sistema e Integrazione RAG

1. Ogni capitolo corrisponde a un assioma canonico memorizzato in `backend/app/data/fashion_rules_seed.json`.
2. Il motore RAG in `fashion_rules_rag.py` si attiva in tempo reale tramite parole chiave multilingue.
3. Lo Stylist QA Engine (`stylist_qa_engine.py`) applica controlli deterministici in Python, escludendo automaticamente i capi dai colori proibiti e formattando il testo con eleganza naturale.
"""

# ---------------------------------------------------------------------------
# JAPANESE (ja)
# ---------------------------------------------------------------------------
TRANSLATIONS["ja"] = """# 文化的・伝統的ドレスコード規範ガイド

## 概要
DressAppは、13言語に対応した高精度な文化適応型スタイリング支援を提供します。宗教的儀礼や民族的マナーを混同・誤認しやすい小型言語モデル（SLM）の確率的推測に依存するのではなく、専門家が監修した厳格な**グラウンドトゥルース公理（Ground-Truth Axioms）**を適用しています。

本文書では、世界の伝統における正式な装いの規範、シルエット要件、厳格な禁止事項（ネガティブ制約）、および地域別の推奨用語を定めます。

---

## 1. ユダヤの伝統（יהדות）

### 1.1 シヴァおよび服喪のマナー（שבעה・弔問）
- **オケージョン**: 弔問、慰霊式、葬儀、追悼会。
- **格式**: 控えめで厳粛、品位のある装い。
- **カラーパレット**: ソリッドブラック、チャコールグレー、ダークスレート、ディープネイビー、ダークブラウン、落ち着いたアースカラー。原色、明るいパステル、白、金色、赤は避けてください。
- **シルエットと仕立て**:
  - **男性**: 上品なスラックス、またはダメージのないダークデニム；無地のダークボタンダウンシャツ、ポロシャツ、またはシンプルなクルーネックTシャツ；控えめなダークカラーの革靴やローファー。
  - **女性**: 膝下を覆うミディまたはマキシ丈の清楚なワンピース、ロングスカート、仕立ての良いスラックス；肩と二の腕を覆う袖丈；露出の少ない襟元。
- **厳格な禁止事項（Negative Constraints）**:
  - グラフィックTシャツ、目立つブランドロゴ、動物柄、スローガン入り衣服は禁止。
  - ショートパンツ、ダメージジーンズ、スポーツウェア、サンダルは禁止。
  - 鮮烈な赤、黄色、ピンク、ゴールド、ネオンカラーは厳禁。
  - 華美な高級ジュエリーや派手な腕時計の着用は避けること。
- **適切な用語体系**:
  - *承認されたヘブライ語表現*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`。
  - *機械翻訳特有の誤用*: `להולך בישיבה שבעה` などの不自然な直訳表現は使用しないこと。

### 1.2 正統派の慎み深さ（ツニウート - Tzniut / צניעות）
- **オケージョン**: 日常、シナゴーグ、コミュニティの宗教的集会。
- **格式**: 保守的で品位ある装い。
- **要件**:
  - **女性**: 着席時にも膝が隠れる丈のスカートやドレス；肘が隠れる袖丈；鎖骨を覆うネックライン；透け感や密着感のない生地。既婚女性は頭部の覆い（ウィッグ、スカーフ、帽子）。
  - **男性**: 長ズボン、襟と袖のあるシャツ、頭部の覆い（キッパ）。
- **厳格な禁止事項**:
  - 正統派女性のズボン、ジーンズ、ショートパンツ着用は不可。
  - 上着（ジャケットやカーディガン）を羽織らないノースリーブは禁止。
  - 深いVネック、背中あき、シースルー、深いスリットは禁止。

### 1.3 シャバットおよび祝祭日（שבת וחגים）
- **オケージョン**: 喜ばしい宗教的祝祭、金曜夜の安息日ディナー、祝祭礼拝。
- **格式**: スマートカジュアルからフォーマル。
- **カラーパレット**: クリーンな白、アイボリー、ネイビー、スカイブルー、気品あるジュエルトーン。
- **厳格な禁止事項**:
  - 作業着、スポーツウェア、ダメージ加工のある衣服、部屋着は禁止。

---

## 2. イスラムの伝統（الإسلام）

### 2.1 金曜礼拝（ジュムア）とモスク訪問
- **オケージョン**: 金曜合同礼拝、聖なるモスクへの入場。
- **格式**: 清潔、敬虔、慎み深さ。
- **要件**:
  - **男性**: 清潔な長ズボン、トーブまたはクルタ；肩と胸を完全に覆う服装；清潔な靴下（入口で靴を脱ぐ）。
  - **女性**: ゆったりとしたアバヤ、マキシ丈ドレス、またはワイドパンツの上に羽織るロングチュニック；手首と足首まで完全に覆う丈；髪・耳・首を完全に隠すヒジャブ。
- **厳格な禁止事項**:
  - 男性の膝上ショートパンツは不可（アウラを覆う規定）。
  - 体のラインを強調するタイトな服、透ける素材、胸元のあいた服は禁止。
  - 礼拝所内において、人の顔や動物が描かれた服の着用は禁止。

---

## 3. ヒンドゥーの伝統（सनातन धर्म）

### 3.1 葬送儀礼と服喪（アンティエシュティ - अंतिम संस्कार）
- **オケージョン**: ヒンドゥー火葬儀礼、葬列、弔問。
- **格式**: 厳粛、純粋、質素。
- **カラーパレット**: **装飾のない、無地のプレーンな「白」のみ**。
- **装い**:
  - **男性**: 無地の白いクルタ・パジャマ、または白のコットンシャツに淡い色のスラックス。
  - **女性**: 装飾のない白のコットンサリー、またはシンプルな白のサルワール・カミーズ。
- **厳格な禁止事項**:
  - **黒色の絶対的禁止**: ヒンドゥーの教えにおいて黒は不吉とされ、葬送の場での着用は厳禁です。
  - 華やかで慶事を感じさせる色（赤、金、オレンジ、ピンク）は禁止。
  - 火葬場や寺院内への革靴や革ベルトの持ち込み・着用は禁止。

### 3.2 結婚式・慶祝祭礼（ヴィヴァーハ＆ディワリ - विवाह उत्सव）
- **オケージョン**: 結婚式（サンギート、バラート、フェラ）、ディワリなどの吉日祝祭。
- **格式**: 絢爛豪華、祝祭的、最高格式。
- **カラーパレット**: 吉祥とされる赤、深紅、ゴールド、サフランイエロー、エメラルド、ラニピンク。
- **厳格な禁止事項**:
  - **全身黒の禁止**: ヒンドゥーの慶事において黒は凶兆と見なされるため完全に避けます。
  - **無地白色の禁止**: 飾りのない白は未亡人や喪服を連想させるため、参列者の着用は禁止されています。

---

## 4. 東アジアの伝統儀礼（东亚礼仪 / 東アジアの儀礼）

### 4.1 葬儀・告別式・法要（葬礼 / お葬式 / 장례식）
- **オケージョン**: 日本・中国・韓国における葬儀、告別式、年忌法要。
- **格式**: 正式なダークトーンの喪服。
- **カラーパレット**: 無地のブラックスーツ、白ワイシャツ、無地で光沢のない黒ネクタイ（男性）；シンプルな黒のフォーマルドレス、アンサンブル、または黒紋付（女性）。
- **厳格な禁止事項**:
  - **赤や金色の絶対禁止**: 東アジア文化において赤と金は最高度の歓喜・祝賀を象徴し、弔事に着用することは遺族に対する許されない非礼となります。
  - 色付きのネクタイ、光沢のある金具、派手な装飾品は不可。

### 4.2 結婚式・披露宴（婚礼 / 結婚披露宴）
- **カラーパレット**: 気品ある祝祭カラー（パステルカラー、ネイビー、上品なグレー、淡いピンク）。
- **厳格な禁止事項**:
  - **ゲストの全身赤の着用禁止**: 中国の伝統的婚礼において、赤は花嫁専用の色です。
  - **ゲストの全身白の着用禁止**: 白は花嫁のみに許された色です。

---

## 5. 西洋のフォーマル規格

### 5.1 ブラックタイ（Black Tie）およびガラパーティー
- **オケージョン**: チャリティガラ、オペラ初日公演、正餐会。
- **要件**:
  - **男性**: 拝絹（サテン）付きのタキシード（ブラックまたはミッドナイトブルー）、側章入りスラックス、白のウイングカラーまたはレギュラータキシードシャツ、黒のシルク蝶ネクタイ、カマーバンドまたはローカットベスト、黒のエナメル革靴。
  - **女性**: フロアレングス（床丈）のイブニングドレス、格調高いジュエリー、クラッチバッグ。
- **厳格な禁止事項**:
  - 通常のビジネススーツや昼用のジャケットは不可。
  - 長ネクタイは禁止（黒の蝶ネクタイが必須）。
  - スニーカーやサンダルは禁止。

### 5.2 西洋式結婚式のゲストマナー
- **要件**: セミフォーマルからスマートエレガント；ミディドレスやカクテルドレス；ネイビーやチャコールグレーのスーツ。
- **厳格な禁止事項**:
  - **純白・アイボリー・シャンパンカラーの着用禁止**: 花嫁の特権色です。
  - ジーンズ、Tシャツ、スニーカーなどのカジュアルウェアは禁止。

---

## 6. 実装およびシステム連携アーキテクチャ

### RAG知識検索基盤
1. 上記の各規範は `backend/app/data/fashion_rules_seed.json` に公理として登録されています。
2. `fashion_rules_rag.py` のダイナミックリトリーバーが多言語キーワードを検出し、最適な公理を抽出します。
3. スタイリストQAエンジン（`stylist_qa_engine.py`）がPythonコード上でネガティブ制約を確実に執行し、禁忌色の衣服（シヴァでの赤、ヒンドゥー葬儀での黒など）を自動排除します。
"""

# ---------------------------------------------------------------------------
# DUTCH (nl)
# ---------------------------------------------------------------------------
TRANSLATIONS["nl"] = """# Gids voor Culturele en Traditionele Kledingetiquette

## Overzicht
DressApp biedt cultuurbewuste stylingondersteuning in 13 talen. In plaats van te vertrouwen op vage probabilistische aannames van kleine taalmodellen (SLM's) — die vaak hallucineren of verschillende religieuze gebruiken door elkaar halen —, hanteert DressApp expliciete, door mensen gecontroleerde **Ground-Truth Axioma's**.

Dit document beschrijft de canonieke kledingprotocollen, gewenste silhouetten, strikte verboden (Negative Constraints) en gelokaliseerde terminologie voor wereldwijde tradities.

---

## 1. Joodse Tradities (יהדות)

### 1.1 Shiva en Rouwetiquette (שבעה, Rouw en Condoleance)
- **Gelegenheid**: Condoleancebezoek, herdenking, begrafenis.
- **Formaliteit**: Eerbiedig, ingetogen en plechtig.
- **Kleurenpalet**: Effen zwart, antraciet, donker leisteengrijs, diep marineblauw, donkerbruin of gedempte aardetinten. Vermijd felle primaire kleuren, lichte pastels, wit, goud of rood.
- **Pasvormen en snit**:
  - **Heren**: Nette pantalon of donkere spijkerbroek zonder scheuren; effen donker overhemd met kraag, donkere polo of discreet T-shirt met ronde hals; donkere, nette schoenen of rustige instappers.
  - **Dames**: Zedige midi- of maxijurken, lange rokken of geklede pantalons; tops met mouwen die de schouders en bovenarmen bedekken; beschaafde halslijn.
- **Strikte verboden (Negative Constraints)**:
  - GEEN grafische T-shirts, opvallende merklogo's, dierenprints of humoristische teksten.
  - GEEN korte broeken, gescheurde jeans, sportkleding of strandslippers.
  - GEEN felle kleuren zoals vurig rood, geel, zuurstokroze, goud of neon.
  - GEEN opzichtige luxe sieraden of opvallende horloges.
- **Correcte taal en terminologie**:
  - *Goedgekeurde Hebreeuwse termen*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`.
  - *Verboden automatische vertaalfouten*: Gebruik nooit letterlijke machinevertalingen zoals `להולך בישיבה שבעה`.

### 1.2 Orthodoxe Bescheidenheid (Tzniut / צניעות)
- **Gelegenheid**: Dagelijks, synagoge, gemeenschapsbijeenkomsten en vieringen.
- **Formaliteit**: Conservatief, waardig en bescheiden.
- **Eisen**:
  - **Dames**: Rokken en jurken die ook bij het zitten over de knie vallen; mouwen die de ellebogen bedekken; halslijn die het sleutelbeen bedekt; ondoorzichtige, niet-aansluitende stoffen. Voor getrouwde orthodoxe vrouwen: hoofdbedekking (pruik sheitel, sjaal tichel of hoed).
  - **Heren**: Lange broek, overhemd met kraag en mouwen, hoofdbedekking (keppel / kippah).
- **Strikte verboden**:
  - GEEN broeken, jeans of shorts voor orthodoxe vrouwen.
  - GEEN mouwloze tops zonder ondoorzichtig jasje of vest eroverheen.
  - GEEN diepe decolletés, blote ruggen, transparante stoffen of hoge splits.

### 1.3 Shabbat en Feestdagen (שבת וחגים)
- **Gelegenheid**: Vreugdevolle religieuze viering, vrijdagavonddiner, feestelijke diensten.
- **Formaliteit**: Verzorgd smart-casual tot formeel.
- **Kleurenpalet**: Helder wit, crème, marineblauw, hemelsblauw, juweeltinten en zachte pastels.
- **Strikte verboden**:
  - GEEN werkkleding, sportkleding, versleten jeans of informele huiskleding.

---

## 2. Islamitische Tradities (الإسلام)

### 2.1 Vrijdaggebed (Jumu'ah) en Moskeebezoek
- **Gelegenheid**: Vrijdaggebed, binnentreden van een gewijde moskee.
- **Formaliteit**: Rein, zedig, respectvol en ingetogen.
- **Eisen**:
  - **Heren**: Schone lange broek, thobe of kurta; schouders en borst volledig bedekt; schone sokken (schoenen worden bij de entree uitgetrokken).
  - **Dames**: Ruimvallende abaya, maxijurk of lange tuniek over een wijde broek; volledige bedekking tot de polsen en enkels; hijab die het haar, de oren en de hals geheel bedekt.
- **Strikte verboden**:
  - GEEN korte broeken boven of op de knie voor mannen (awrah-voorschrift).
  - GEEN strakke kleding die de lichaamsvormen accentueert, geen doorschijnende stoffen of diepe halslijnen.
  - GEEN afbeeldingen van menselijke gezichten of dieren in de gebedsruimtes.

---

## 3. Hindoeïstische Tradities (सनातन धर्म)

### 3.1 Uitvaart en Rouw (Antyeshti - अंतिम संस्कार)
- **Gelegenheid**: Hindoeïstische crematie, rouwstoet, condoleance.
- **Formaliteit**: Plechtig, zuiver, sober en eenvoudig.
- **Kleurenpalet**: **Uitsluitend effen, onversierd en eenvoudig wit**.
- **Kleding**:
  - **Heren**: Eenvoudige witte kurta-pyjama of wit katoenen overhemd met een lichte, neutrale broek.
  - **Dames**: Eenvoudige witte katoenen sari of witte salwar kameez zonder borduursels of pailletten.
- **Strikte verboden**:
  - **ABSOLUUT VERBOD OP ZWART**: In de hindoeïstische traditie wordt zwart beschouwd als onheilspellend en is het strikt verboden bij uitvaarten.
  - GEEN felle of feestelijke kleuren (rood, goud, oranje, roze).
  - GEEN leren schoenen of leren riemen op gewijde crematieterreinen of in tempels.

### 3.2 Huwelijk en Feestelijke Vieringen (Vivaha & Diwali - विवाह उत्सव)
- **Gelegenheid**: Hindoeïstische huwelijksceremonies (Sangeet, Baraat, Pheras), Diwali en religieuze feesten.
- **Formaliteit**: Weelderig, feestelijk en zeer formeel.
- **Kleurenpalet**: Voorspoedig rood, diep kastanjebruin/bordeaux, goud, saffraangeel, koninklijk smaragdgroen, rani-roze.
- **Strikte verboden**:
  - **VERBOD OP GEHEEL ZWART**: Zwart brengt volgens de traditie ongeluk bij bruiloften en wordt strikt vermeden.
  - **VERBOD OP EFFEN WIT**: Effen wit wordt geassocieerd met rouw en weduwschap en is taboe voor bruiloftsgasten.

---

## 4. Oost-Aziatische Tradities (东亚礼仪 / 東アジアの儀礼)

### 4.1 Uitvaarten en Herdenkingen (葬礼 / お葬式 / 장례식)
- **Gelegenheid**: Begrafenissen en voorouderherdenkingen in China, Japan en Korea.
- **Formaliteit**: Formele donkere rouwkleding.
- **Kleurenpalet**: Effen zwart pak, wit overhemd, matte zwarte stropdas (heren); ingetogen zwarte formele jurk of donkere kimono (dames).
- **Strikte verboden**:
  - **ABSOLUUT VERBOD OP ROOD EN GOUD**: In Oost-Aziatische culturen staan rood en goud voor vreugde en viering; het dragen ervan bij een uitvaart is een onvergeeflijke belediging.
  - GEEN gekleurde stropdassen, glimmende sieraden of luidruchtige accessoires.

### 4.2 Huwelijken en Banketten (婚礼 / 結婚披露宴)
- **Kleurenpalet**: Geraffineerde feestkleuren (pastels, marine, zachtgrijs, poederroze, juweeltinten).
- **Strikte verboden**:
  - **GEEN EFFEN ROOD VOOR GASTEN**: Bij Chinese bruiloften is rood exclusief voorbehouden aan de bruid.
  - **GEEN EFFEN WIT VOOR GASTEN**: Wit is gereserveerd voor de bruid.

---

## 5. Westerse Formele Normen

### 5.1 Black Tie en Gala-evenementen
- **Gelegenheid**: Liefdadigheidsgala's, operapremières, officiële avondrecepties.
- **Eisen**:
  - **Heren**: Zwarte of nachtblauwe smoking met satijnen revers, bijpassende pantalon met satijnen bies, gesteven wit smokinghemd, zwarte zijden vlinderdas, cummerbund of laag uitgesneden vest, zwarte laklederen schoenen.
  - **Dames**: Vloerlange avondjurk, elegante avondsieraden, avondclutch.
- **Strikte verboden**:
  - GEEN gewone zakelijke pakken of overdagblazers.
  - GEEN lange stropdassen (vlinderdas is verplicht voor heren).
  - GEEN sneakers of vrijetijdsschoenen.

### 5.2 Etiquette voor Bruiloftsgasten
- **Eisen**: Verzorgd semi-formeel tot feestelijk elegant; cocktail- of midijurken; maatpakken in marineblauw of antraciet.
- **Strikte verboden**:
  - **STRIKT VERBOD OP EFFEN WIT, IVOOR OF CHAMPAGNE**: Uitsluitend voorbehouden aan de bruid.
  - GEEN spijkerbroeken, T-shirts of sportschoenen.

---

## 6. Systeeminformatie en RAG-integratie

1. Elke traditie is verankerd als een canoniek axioma in `backend/app/data/fashion_rules_seed.json`.
2. De dynamische retriever in `fashion_rules_rag.py` herkent meertalige zoektermen en laadt direct de juiste voorschriften.
3. De Stylist QA Engine (`stylist_qa_engine.py`) handhaaft de uitsluitingen deterministisch in Python, verwijdert verboden kleuren (zoals rood bij Shiva of zwart bij hindoebegrafenissen) en zorgt voor natuurlijke formuleringen.
"""

# ---------------------------------------------------------------------------
# PORTUGUESE (pt)
# ---------------------------------------------------------------------------
TRANSLATIONS["pt"] = """# Guia de Fundamentação Cultural e Tradicional do Vestuário

## Visão Geral
O DressApp oferece inteligência de estilo culturalmente fundamentada em 13 idiomas. Em vez de depender de suposições probabilísticas de pequenos modelos de linguagem (SLM) — que frequentemente alucinam ou confundem ritos religiosos distintos —, o DressApp aplica **Axiomas Fundamentais Verificados (Ground-Truth Axioms)** auditados por especialistas humanos.

Este documento define os protocolos canônicos de vestimenta, requisitos de silhueta, proibições rigorosas e terminologias locais para as principais tradições globais.

---

## 1. Tradições Judaicas (יהדות)

### 1.1 Etiqueta de Shiva e Luto (שבעה, Luto e Pêsames)
- **Tipo de ocasião**: Visita de condolências, funeral, velório, memorial.
- **Nível de formalidade**: Respeitoso, solene e comedido.
- **Paleta de cores**: Preto sólido, cinza-chumbo (antracite), ardósia escura, azul-marinho profundo, marrom-escuro ou tons terrosos suaves. Evite cores primárias vibrantes, tons pastéis claros, branco, dourado ou vermelho.
- **Silhuetas e cortes**:
  - **Homens**: Calças de alfaiataria alinhadas ou jeans escuro liso sem rasgos; camisa escura de botão, camisa polo discreta ou camiseta escura de gola redonda limpa; sapatos sociais escuros ou mocassins discretos.
  - **Mulheres**: Vestidos midi ou maxi discretos, saias longas ou calças de alfaiataria bem cortadas; blusas com mangas que cubram ombros e braços; decote recatado.
- **Proibições rigorosas (Negative Constraints)**:
  - PROIBIDO camisetas com estampas gráficas, logotipos chamativos, estampas de animais ou frases cômicas.
  - PROIBIDO bermudas, shorts, jeans rasgados, roupas esportivas ou chinelos de praia.
  - PROIBIDO cores berrantes como vermelho vivo, amarelo, pink, dourado ou tons neon.
  - PROIBIDO joias ostentosas ou relógios chamativos.
- **Terminologia correta**:
  - *Termos hebraicos aprovados*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`.
  - *Erros de tradução automática proibidos*: Nunca utilize traduções literais truncadas como `להולך בישיבה שבעה`.

### 1.2 Modéstia Ortodoxa (Tzniut / צניעות)
- **Tipo de ocasião**: Cotidiano, sinagoga, eventos comunitários e encontros sagrados.
- **Nível de formalidade**: Conservador, digno e recatado.
- **Requisitos**:
  - **Mulheres**: Saias e vestidos que cubram os joelhos mesmo ao sentar; mangas que ultrapassem os cotovelos; decote que cubra a clavícula; tecidos opacos e não justos. Para mulheres casadas, cobertura de cabeça (peruca sheitel, lenço tichel ou chapéu).
  - **Homens**: Calças compridas, camisas de gola e mangas, cobertura de cabeça (quipá).
- **Proibições rigorosas**:
  - PROIBIDO calças, jeans ou shorts para mulheres ortodoxas.
  - PROIBIDO blusas sem mangas sem uma terceira peça opaca por cima (blazer ou cardigã).
  - PROIBIDO decotes profundos em V, costas nuas, transparências ou fendas altas.

### 1.3 Shabat e Dias Festivos (שבת וחגים)
- **Tipo de ocasião**: Celebração religiosa alegre, jantar de sexta-feira, serviços litúrgicos festivos.
- **Nível de formalidade**: Elegante formal ou smart-casual refinado.
- **Paleta de cores**: Branco radiante, marfim, azul-marinho, azul-celeste, tons de pedras preciosas e pastéis elegantes.
- **Proibições rigorosas**:
  - PROIBIDO roupas de trabalho diário, trajes de academia, jeans rasgados ou roupas de descanso caseiras.

---

## 2. Tradições Islâmicas (الإسلام)

### 2.1 Oração de Sexta-feira (Jumu'ah) e Visita à Mesquita
- **Tipo de ocasião**: Oração congregacional de sexta-feira, entrada em mesquita sagrada.
- **Nível de formalidade**: Limpo, recatado, respeitoso e puro.
- **Requisitos**:
  - **Homens**: Calças compridas limpas, thobe ou kurta; ombros e peito totalmente cobertos; meias limpas (sapatos são retirados na entrada).
  - **Mulheres**: Abaya ampla, vestido maxi ou túnica comprida sobre calça solta; cobertura completa até os pulsos e tornozelos; hijab cobrindo totalmente cabelos, orelhas e pescoço.
- **Proibições rigorosas**:
  - PROIBIDO bermudas ou shorts acima do joelho para homens (obrigação de cobrir a awrah).
  - PROIBIDO roupas justas que marquem o corpo, tecidos transparentes ou decotes baixos.
  - PROIBIDO roupas com estampas de rostos humanos ou animais nas áreas de oração.

---

## 3. Tradições Hindus (सनातन धर्म)

### 3.1 Funerais e Luto (Antyeshti - अंतिम संस्कार)
- **Tipo de ocasião**: Cremação hindu, cortejo fúnebre, condolências.
- **Nível de formalidade**: Solene, puro, austero e simples.
- **Paleta de cores**: **Exclusivamente branco liso, simples e sem adornos**.
- **Silhuetas**:
  - **Homens**: Kurta-pijama branco simples ou camisa de algodão branco com calças claras discretas.
  - **Mulheres**: Sári de algodão branco simples ou salwar kameez branco sem bordados ou brilhos.
- **Proibições rigorosas**:
  - **PROIBIÇÃO ABSOLUTA DA COR PRETA**: Na tradição hindu, o preto traz mau agouro e é terminantemente proibido em funerais.
  - PROIBIDO cores vivas ou festivas (vermelho, dourado, laranja, rosa).
  - PROIBIDO sapatos ou cintos de couro em crematórios sagrados e templos.

### 3.2 Casamentos e Celebrações (Vivaha & Diwali - विवाह उत्सव)
- **Tipo de ocasião**: Cerimônias nuziais hindus (Sangeet, Baraat, Pheras), festividades do Diwali.
- **Nível de formalidade**: Opulento, festivo e de gala.
- **Paleta de cores**: Vermelhos auspiciosos, bordô profundo, dourado, açafrão, verde-esmeralda, rosa rani.
- **Proibições rigorosas**:
  - **PROIBIÇÃO DE PRETO TOTAL**: O preto é evitado por completo nos casamentos hindus por ser considerado agourento.
  - **PROIBIÇÃO DE BRANCO LISO**: O branco liso é associado ao luto e à viuvez, sendo estritamente proibido para convidados.

---

## 4. Tradições do Leste Asiático (东亚礼仪 / 東アジアの儀礼)

### 4.1 Funerais e Homenagens aos Antepassados (葬礼 / お葬式 / 장례식)
- **Tipo de ocasião**: Funeral e culto aos antepassados na China, Japão e Coreia.
- **Nível de formalidade**: Luto formal escuro.
- **Paleta de cores**: Terno preto liso, camisa branca, gravata preta fosca lisa (homens); vestido preto discreto ou quimono escuro de luto (mulheres).
- **Proibições rigorosas**:
  - **PROIBIÇÃO ABSOLUTA DE VERMELHO E DOURADO**: No Leste Asiático, o vermelho e o dourado simbolizam celebração e alegria extrema; usá-los em um velório é uma ofensa gravíssima.
  - PROIBIDO gravatas coloridas ou joias metálicas chamativas.

### 4.2 Casamentos e Banquetes (婚礼 / 結婚披露宴)
- **Paleta de cores**: Cores festivas refinadas (tons pastéis, marinho, cinza nobre, rosa suave, tons de pedras preciosas).
- **Proibições rigorosas**:
  - **PROIBIDO VERMELHO TOTAL PARA CONVIDADOS**: Em casamentos chineses, o vermelho é exclusivo da noiva.
  - **PROIBIDO BRANCO TOTAL PARA CONVIDADOS**: O branco pertence exclusivamente à noiva.

---

## 5. Normas Formais Ocidentais

### 5.1 Traje a Rigor (Black Tie) e Galas
- **Tipo de ocasião**: Galas beneficentes, aberturas de ópera, recepções de gala noturnas.
- **Requisitos**:
  - **Homens**: Smoking preto ou azul-noite (Midnight Blue) com lapelas de cetim, calças combinando com faixa de cetim lateral, camisa de smoking branca bem passada, gravata-borboleta de seda preta, faixa de smoking (cummerbund) ou colete decotado, sapatos de verniz preto brilhante.
  - **Mulheres**: Vestido longo de festa até o chão, joias finas elegantes, clutch de festa.
- **Proibições rigorosas**:
  - PROIBIDO ternos comuns de escritório ou blazers diurnos.
  - PROIBIDO gravatas longas tradicionais (gravata-borboleta é estritamente obrigatória para homens).
  - PROIBIDO tênis ou calçados esportivos.

### 5.2 Etiqueta para Convidados de Casamento
- **Requisitos**: Passeio completo ou esporte fino alinhado; vestidos midi ou de coquetel; ternos bem cortados em azul-marinho ou chumbo.
- **Proibições rigorosas**:
  - **PROIBIÇÃO TOTAL DE BRANCO, PÉROLA, MARFIM OU CHAMPAGNE**: Cores reservadas exclusivamente à noiva.
  - PROIBIDO calças jeans, camisetas ou tênis.

---

## 6. Arquitetura de Implementação e Integração ao Sistema

1. Cada seção acima corresponde a um axioma em `backend/app/data/fashion_rules_seed.json`.
2. O mecanismo RAG dinâmico em `fashion_rules_rag.py` detecta termos em múltiplos idiomas e extrai os axiomas ideais.
3. O Stylist QA Engine (`stylist_qa_engine.py`) aplica as restrições negativas diretamente em código Python, descartando peças impróprias (como vermelho no Shiva ou preto em funerais hindus) e garantindo uma linguagem polida.
"""

# ---------------------------------------------------------------------------
# RUSSIAN (ru)
# ---------------------------------------------------------------------------
TRANSLATIONS["ru"] = """# Руководство по Культурным и Традиционным Нормам Дресс-кода

## Обзор
DressApp обеспечивает интеллектуальный подбор гардероба с учетом культурных и религиозных особенностей на 13 языках. Вместо вероятностных догадок малых языковых моделей (SLM) — которые нередко галлюцинируют или путают различные обряды —, DressApp строго применяет проверенные человеком **Канонические Аксиомы (Ground-Truth Axioms)**.

В данном документе изложены канонические протоколы одежды, требования к силуэтам, строгие запреты (Negative Constraints) и выверенная локализованная терминология для ключевых мировых традиций.

---

## 1. Еврейские Традиции (יהדות)

### 1.1 Шива и Траурный Этикет (שבעה, Траур и Соболезнования)
- **Тип события**: Визит соболезнования, поминовение, похороны.
- **Уровень формальности**: Сдержанный, строгий, уважительный.
- **Цветовая палитра**: Сплошной черный, антрацитовый, темно-серый (графитовый), глубокий темно-синий, темно-коричневый или приглушенные земляные тона. Избегайте ярких основных цветов, светлых пастельных оттенков, белого, золотого и красного.
- **Силуэты и крой**:
  - **Мужчины**: Аккуратные классические брюки или темные джинсы без потертостей и дыр; темная рубашка с воротником, темное поло или лаконичная футболка с круглым вырезом; темная строгая обувь или лоферы.
  - **Женщины**: Скромные платья длины миди или макси, длинные юбки или классические брюки; верх с рукавами, закрывающими плечи и предплечья; закрытый консервативный вырез.
- **Строгие запреты (Negative Constraints)**:
  - ЗАПРЕЩЕНЫ футболки с графическими принтами, крупными логотипами, изображениями орлов или животных, а также шутливыми надписями.
  - ЗАПРЕЩЕНЫ шорты, рваные джинсы, спортивная одежда и пляжные шлепанцы.
  - ЗАПРЕЩЕНЫ броские цвета: ярко-красный, желтый, цвет фуксии, золотой и неоновые оттенки.
  - ЗАПРЕЩЕНЫ броские ювелирные украшения и массивные дорогие часы.
- **Языковая и культурная терминология**:
  - *Одобренные термины на иврите*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`.
  - *Запрещенные ошибки машинного перевода*: Никогда не использовать дословные кальки вроде `להולך בישיבה שבעה`.

### 1.2 Ортодоксальная Скромность (Цниут - Tzniut / צניעות)
- **Тип события**: Повседневная жизнь, синагога, религиозные собрания.
- **Уровень формальности**: Консервативный, благопристойный.
- **Требования**:
  - **Женщины**: Юбки и платья, закрывающие колени даже в положении сидя; рукава ниже локтя; вырез, закрывающий ключицы; непрозрачные, не облегающие ткани. Для замужних ортодоксальных женщин обязателен головной убор (парик шейтель, платок тихель или шляпка).
  - **Мужчины**: Длинные брюки, рубашка с воротником и рукавами, кипа.
- **Строгие запреты**:
  - ЗАПРЕЩЕНЫ брюки, джинсы и шорты для ортодоксальных женщин.
  - ЗАПРЕЩЕНЫ топы без рукавов без непрозрачного жакета или кардигана поверх.
  - ЗАПРЕЩЕНЫ глубокие вырезы, открытая спина, прозрачные ткани и высокие разрезы.

### 1.3 Шаббат и Праздники (שבת וחגים)
- **Тип события**: Радостное религиозное торжество, трапеза вечера пятницы, праздничные молитвы.
- **Уровень формальности**: Торжественный смарт-кэжуал или формальный костюм.
- **Цветовая палитра**: Белоснежный, кремовый, темно-синий, небесно-голубой, благородные драгоценные оттенки.
- **Строгие запреты**:
  - ЗАПРЕЩЕНЫ рабочая одежда, спортивные костюмы, рваные джинсы и домашняя одежда.

---

## 2. Исламские Традиции (الإسلام)

### 2.1 Пятничная Молитва (Джума) и Посещение Мечети
- **Тип события**: Пятничная коллективная молитва, посещение священной мечети.
- **Уровень формальности**: Чистый, скромный, благоговейный.
- **Требования**:
  - **Мужчины**: Чистые длинные брюки, камис (тоб) или курта; плечи и грудь полностью закрыты; чистые носки (обувь снимается при входе).
  - **Женщины**: Свободная абая, макси-платье или удлиненный туника-костюм поверх свободных брюк; длина полностью до запястий и щиколоток; хиджаб, полностью скрывающий волосы, уши и шею.
- **Строгие запреты**:
  - ЗАПРЕЩЕНЫ шорты выше или на уровне колен для мужчин (норма сокрытия аурата).
  - ЗАПРЕЩЕНЫ обтягивающие фасоны, прозрачные ткани и открытые вырезы.
  - ЗАПРЕЩЕНА одежда с изображениями лиц людей или животных в молельных залах.

---

## 3. Индуистские Традиции (सनातन धर्म)

### 3.1 Похороны и Траур (Антьешти - अंतिम संस्कार)
- **Тип события**: Индуистская кремация, траурная процессия, соболезнования.
- **Уровень формальности**: Торжественный, чистый, аскетичный.
- **Цветовая палитра**: **Исключительно однотонный, простой, белоснежный цвет без украшений**.
- **Фасоны**:
  - **Мужчины**: Простая белая курта-пижама или белая хлопковая рубашка со светлыми сдержанными брюками.
  - **Женщины**: Простое белое хлопковое сари или белый сальвар-камиз без вышивки и пайеток.
- **Строгие запреты**:
  - **КАТЕГОРИЧЕСКИЙ ЗАПРЕТ НА ЧЕРНЫЙ ЦВЕТ**: В индуизме черный цвет считается неблагоприятным и строго запрещен на похоронах.
  - ЗАПРЕЩЕНЫ яркие и праздничные цвета (красный, золотой, оранжевый, розовый).
  - ЗАПРЕЩЕНЫ изделия из кожи (обувь, ремни) в местах священной кремации и в храмах.

### 3.2 Свадьбы и Празднества (Виваха и Дивали - विवाह उत्सव)
- **Тип события**: Индуистские свадебные обряды (Сангит, Бараат, Пхерас), фестиваль Дивали.
- **Уровень формальности**: Роскошный, праздничный, парадный.
- **Цветовая палитра**: Благословенный красный, насыщенный бордовый, золотой, шафрановый, королевский изумрудный, цвет рани-пинк.
- **Строгие запреты**:
  - **ЗАПРЕТ НА ЧЕРНЫЙ ЦВЕТ**: Черный цвет считается дурным предзнаменованием на свадьбах и полностью исключается.
  - **ЗАПРЕТ НА ОДНОТОННЫЙ БЕЛЫЙ ЦВЕТ**: Простой белый цвет ассоциируется с трауром и вдовством; гостям категорически запрещено надевать полностью белый наряд.

---

## 4. Традиции Восточной Азии (东亚礼仪 / 東アジアの儀礼)

### 4.1 Похороны и Поминовение Предков (葬礼 / お葬式 / 장례식)
- **Тип события**: Похороны и поминальные службы в Китае, Японии и Корее.
- **Уровень формальности**: Строгий темный траур.
- **Цветовая палитра**: Однотонный черный костюм, белая рубашка, матовый черный галстук (мужчины); строгое черное закрытое платье или темное траурное кимоно (женщины).
- **Строгие запреты**:
  - **КАТЕГОРИЧЕСКИЙ ЗАПРЕТ НА КРАСНЫЙ И ЗОЛОТОЙ**: В странах Восточной Азии красный и золотой символизируют наивысшую радость и праздник; появиться в них на похоронах — непростительное оскорбление.
  - ЗАПРЕЩЕНЫ цветные галстуки, блестящие металлы и броские аксессуары.

### 4.2 Свадьбы и Банкеты (婚礼 / 結婚披露宴)
- **Цветовая палитра**: Благородные праздничные тона (пастельные оттенки, темно-синий, жемчужно-серый, нежно-розовый).
- **Строгие запреты**:
  - **ГОСТЯМ ЗАПРЕЩЕНО НАДЕВАТЬ ПОЛНОСТЬЮ КРАСНОЕ**: На китайской свадьбе красный цвет принадлежит исключительно невесте.
  - **ГОСТЯМ ЗАПРЕЩЕНО НАДЕВАТЬ ПОЛНОСТЬЮ БЕЛОЕ**: Белое платье предназначено только для невесты.

---

## 5. Западные Формальные Стандарты

### 5.1 Black Tie и Торжественные Приемы
- **Тип события**: Благотворительные балы, премьеры в опере, дипломатические приемы.
- **Требования**:
  - **Мужчины**: Черный или темно-синий (Midnight Blue) смокинг с шелковыми лацканами, брюки с лампасами, белая сорочка под смокинг, черный шелковый галстук-бабочка, пояс-камербанд или низкий жилет, черные лакированные туфли.
  - **Женщины**: Вечернее платье в пол, изысканные украшения, вечерний клатч.
- **Строгие запреты**:
  - ЗАПРЕЩЕНЫ обычные деловые костюмы.
  - ЗАПРЕЩЕНЫ обычные длинные галстуки (бабочка обязательна).
  - ЗАПРЕЩЕНЫ кроссовки и повседневная обувь.

### 5.2 Этикет для Гостей Западных Свадеб
- **Требования**: Элегантные платья миди или коктейльные платья; костюмы темно-синего или графитового цвета.
- **Строгие запреты**:
  - **СТРОГО ЗАПРЕЩЕНЫ БЕЛЫЙ, ЦВЕТ СЛОНОВОЙ КОСТИ, КРЕМОВЫЙ И ШАМПАНЬ**: Эти цвета принадлежат исключительно невесте.
  - ЗАПРЕЩЕНЫ джинсы, футболки и спортивная обувь.

---

## 6. Архитектура Системной Интеграции

1. Каждый раздел сопоставлен с аксиомой в `backend/app/data/fashion_rules_seed.json`.
2. Модуль динамического поиска в `fashion_rules_rag.py` находит релевантные правила по ключевым словам.
3. Модуль контроля качества (`stylist_qa_engine.py`) детерминированно отсекает запрещенные элементы (например, красный цвет при шиве или черный на индуистских похоронах) и обеспечивает естественность языка.
"""

# ---------------------------------------------------------------------------
# CHINESE SIMPLIFIED (zh)
# ---------------------------------------------------------------------------
TRANSLATIONS["zh"] = """# 跨文化与传统着装规范指南 (Cultural Grounding Guide)

## 概述
DressApp 致力于在 13 种语言环境下提供具备深厚文化常识的智能穿搭建议。我们不依赖小型语言模型（SLM）容易出现幻觉或混淆不同宗教仪轨的概率性猜测，而是通过经过人工审核的**真实事实公理（Ground-Truth Axioms）**进行确定性约束。

本文档明确界定了全球各大主流文化与宗教传统下的权威着装礼仪、版型要求、严苛禁忌（Negative Constraints）以及本地化专业术语。

---

## 1. 犹太传统礼仪 (יהדות)

### 1.1 七日守丧与吊唁礼仪 (Shiva / שבעה)
- **适用场合**: 吊唁探访、追思会、葬礼、悼念活动。
- **庄重程度**: 肃穆、庄重、低调克制。
- **推荐色系**: 纯黑、炭黑、暗岩灰、深藏青、深棕或内敛的大地色系。切忌鲜艳原色、明亮浅色、亮白、金色或正红色。
- **剪裁与款式**:
  - **男士**: 剪裁平整的西裤或无破洞深色牛仔裤；素色深色翻领衬衫、Polo衫或利落的圆领打底衫；低调的深色皮鞋或乐福鞋。
  - **女士**: 端庄的中长裙（Midi）或长裙（Maxi），得体的直筒西裤；遮盖双肩与大臂的袖长；领口保守不暴露。
- **严苛禁忌事项 (Negative Constraints)**:
  - 严禁穿着印有大幅图案、夸张品牌Logo、鹰或动物图腾、搞笑标语的T恤。
  - 严禁穿着短裤、做旧破洞牛仔裤、运动健身服或沙滩人字拖。
  - 严禁大面积穿着正红、亮黄、亮粉、金光闪闪或荧光色调。
  - 严禁佩戴过分奢华的闪亮珠宝或夸张腕表。
- **精准术语**:
  - *希伯来语标准表述*: `לביקור שבעה`, `לניחום אבלים`, `לשבעה`, `בשבעה`。
  - *严禁机翻错误*: 严禁使用生硬的直译错词（如 `להולך בישיבה שבעה`）。

### 1.2 正统派端庄要求 (Tzniut / צניעות)
- **适用场合**: 日常出行、犹太会堂（Synagogue）、社区活动与神圣集会。
- **庄重程度**: 保守、端庄、得体。
- **着装要求**:
  - **女士**: 坐下时裙摆仍须覆盖膝盖以下；袖长须过手肘；领口须遮住锁骨；面料厚实不贴身、不透光。已婚正统派女性须佩戴头巾（Tichel）、假发（Sheitel）或帽子。
  - **男士**: 长裤、带领有袖衬衫、佩戴基帕（Kippah）小圆帽。
- **严苛禁忌事项**:
  - 正统派女性严禁穿着裤装、牛仔裤或短裤。
  - 无袖上衣外严禁无外套叠穿（必须外搭不透光西装或开衫）。
  - 严禁深V领、露背装、透视薄纱面料或高开衩裙。

### 1.3 安息日与节庆盛典 (Shabbat / שבת וחגים)
- **适用场合**: 喜庆宗教盛宴、周五安息日晚宴、节庆祈祷。
- **推荐色系**: 洁白、米白、藏蓝、天蓝、典雅宝石色、淡雅色调。
- **严禁事项**:
  - 严禁穿着工装、运动服、破洞牛仔裤或松懈的家居睡衣。

---

## 2. 伊斯兰传统礼仪 (الإسلام)

### 2.1 主麻日聚礼与清真寺礼仪 (Jumu'ah / صلاة الجمعة)
- **适用场合**: 周五主麻聚礼、进入神圣清真寺参拜。
- **庄重程度**: 洁净、端庄、敬虔、谦逊。
- **着装要求**:
  - **男士**: 洁净长裤、长袍（Thobe）或宽袍（Kurta）；双肩与胸口必须完全遮蔽；穿洁净袜子（进门须脱鞋）。
  - **女士**: 宽松阿巴雅长袍（Abaya）、长款连衣裙或长款宽松罩衫搭配阔腿裤；全身覆盖至手腕与脚踝；佩戴完全遮盖头发、耳朵与颈部的希贾布（Hijab）。
- **严苛禁忌事项**:
  - 男士严禁穿着齐膝或膝盖以上的短裤（遮盖羞体 Awrah 之刚性规定）。
  - 严禁穿着紧身勾勒曲线的衣物、轻薄半透面料或低领服装。
  - 礼拜大厅内严禁穿着印有人像面孔、动物图腾的服装。

---

## 3. 印度教传统礼仪 (सनातन धर्म)

### 3.1 丧葬火化与吊唁仪式 (Antyeshti - अंतिम संस्कार)
- **适用场合**: 印度教露天火化、出殡送葬、悼念吊唁。
- **庄重程度**: 肃穆、纯净、俭朴、无华。
- **推荐色系**: **仅限完全无刺绣、无花纹的素白单色（Plain White）**。
- **款式**:
  - **男士**: 纯白棉质库尔塔长衫（Kurta-pyjama）或白色棉衬衫搭配浅色素面长裤。
  - **女士**: 素净无金边装饰的白色棉质纱丽（Saree）或素白萨尔瓦卡米兹（Salwar Kameez）。
- **严苛禁忌事项**:
  - **绝对严禁穿着黑色**: 在印度教信仰中，黑色被视为带来厄运的凶相之色，在葬礼中严厉禁止穿着黑色。
  - 严禁穿着鲜艳欢庆的颜色（红、金、橙、粉红等）。
  - 在圣洁的火葬场地或寺庙祭拜仪式中，严禁穿戴真皮皮鞋或皮带。

### 3.2 婚礼与吉祥庆典 (Vivaha & Diwali - विवाह उत्सव)
- **适用场合**: 印度传统婚礼（Sangeet、Baraat、Pheras）、排灯节（Diwali）等吉祥节日。
- **庄重程度**: 华贵、喜庆、盛大礼服。
- **推荐色系**: 吉祥大红、浓郁酒红、华美金色、藏红花黄、皇家祖母绿、艳丽粉红。
- **严苛禁忌事项**:
  - **严禁全黑打扮**: 黑色在印度教传统婚礼中被视作不祥之兆，绝对避开。
  - **严禁素白打扮**: 纯素白色与寡居和丧葬紧密相连，婚礼宾客严禁全身素白。

---

## 4. 东亚传统仪礼 (东亚礼仪 / 東アジアの儀礼)

### 4.1 丧事追思与告别式 (葬礼 / お葬式 / 장례식)
- **适用场合**: 中日韩传统葬礼、告别式与祖先祭祀。
- **庄重程度**: 正式黑色素丧服。
- **推荐色系**: 素色纯黑西装、白色衬衫、无光泽素黑领带（男士）；素色黑色正装连衣裙或黑色丧服和服/韩服（女士）。
- **严苛禁忌事项**:
  - **绝对严厉禁止红色与金色**: 在东亚文化中，红金二色代表极致的喜庆与宴乐；在葬礼上穿着红金是对逝者与家属不可饶恕的冒犯与挑衅。
  - 严禁佩戴彩色领带、反光金属首饰或浮夸配饰。

### 4.2 婚礼筵席与庆典 (婚礼 / 結婚披露宴)
- **推荐色系**: 典雅喜庆色系（淡雅柔和色、藏蓝、高级灰、淡粉色、宝石色系）。
- **严苛禁忌事项**:
  - **宾客严禁全套正红**: 在中式传统婚礼中，大红色乃新娘之专属特权。
  - **宾客严禁全身纯白**: 在现代及西式东亚婚礼中，纯白婚纱唯新娘专属。

---

## 5. 西方正装礼仪标准

### 5.1 黑领结晚宴与慈善舞会 (Black Tie)
- **适用场合**: 慈善舞会、歌剧院开幕首演、正式外交晚宴。
- **规范要求**:
  - **男士**: 黑色或午夜蓝（Midnight Blue）塔士多无尾礼服（Tuxedo），配有丝缎领（Satin lapel），同面料侧镶缎边西裤，白色法式双叠袖礼服衬衫，黑色真丝领结（Bow Tie），黑色腰封（Cummerbund）或低胸背心，黑色漆皮皮鞋。
  - **女士**: 曳地正式晚礼服（Floor-length Gown），典雅晚宴首饰，小巧晚宴手包。
- **严苛禁忌事项**:
  - 严禁穿着普通日间商务西装或休闲西服。
  - 严禁佩戴日常长条领带（男士必须佩戴黑色蝴蝶领结）。
  - 严禁穿着运动鞋、休闲乐福鞋或露趾凉鞋。

### 5.2 西方婚礼宾客着装礼仪
- **规范要求**: 半正式（Semi-formal）至典雅正装；鸡尾酒礼服裙或及膝中长裙；深藏青或炭灰色修身西装。
- **严苛禁忌事项**:
  - **绝对严禁穿着纯白、象牙白、奶白或香槟白色长裙**: 此类颜色完全属于新娘专属。
  - 严禁穿着牛仔裤、T恤衫或运动鞋入场。

---

## 6. 系统工程实现与 RAG 架构

1. 上述各个章节均已提炼为原子化公理，收录于 `backend/app/data/fashion_rules_seed.json`。
2. `fashion_rules_rag.py` 的多语言检索器根据用户输入的跨语种关键词动态召回对应规则。
3. 质量审查引擎（`stylist_qa_engine.py`）在 Python 代码层强制实行负向约束：自动剔除违背礼俗的单品（如在 Shiva 守丧推荐红色，或在印度教葬礼推荐黑色），并在最终返回前完成自然的本地化语言修饰。
"""


def main():
    print(f"Generating translations for {len(TRANSLATIONS)} languages...")
    
    # Ensure all directories exist
    for lang in TRANSLATIONS:
        (WIKI_DIR / lang).mkdir(parents=True, exist_ok=True)
        (PUBLIC_WIKI_DIR / lang).mkdir(parents=True, exist_ok=True)
    
    results = []
    for lang, content in TRANSLATIONS.items():
        wiki_target = WIKI_DIR / lang / "cultural_traditional_grounding.md"
        public_target = PUBLIC_WIKI_DIR / lang / "cultural_traditional_grounding.md"
        
        wiki_target.write_text(content.strip() + "\n", encoding="utf-8")
        public_target.write_text(content.strip() + "\n", encoding="utf-8")
        
        results.append((lang, wiki_target, public_target))
        print(f"✓ [{lang}] written to {wiki_target.relative_to(BASE_DIR)} and {public_target.relative_to(BASE_DIR)}")

    print("\nAll 12 languages generated successfully!")


if __name__ == "__main__":
    main()
