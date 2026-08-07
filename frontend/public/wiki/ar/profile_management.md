# الملف الشخصي، المقاسات والإعدادات (`/me`)

إدارة القياسات البدنية، لون البشرة، قصاصات صور الجسم، تفضيلات الأسلوب (Styling preferences)، بيانات اعتماد نماذج الذكاء الاصطناعي (AI model credentials)، وعمليات تكامل الأنظمة (system integrations) في لوحة تحكم ملفك الشخصي.

## نظرة عامة
تعد صفحة **الملف الشخصي والإعدادات** (`https://dressapp.co/me`) بمثابة مركز التحكم الرئيسي لنظام DressApp البيئي الخاص بك. تضم هذه الصفحة معاييرك الفيزيائية الجسمية (anthropometric parameters)، ومرحلة الصورة الرمزية للتجربة الرقمية (digital try-on avatar stage)، وقيود الأسلوب (style constraints)، والتفضيلات المحلية (localized preferences)، ومفاتيح نماذج الذكاء الاصطناعي (AI model keys)، وجداول إشعارات الدفع (push notification schedules).

---

## المتطلبات المسبقة
- حساب DressApp نشط.
- (اختياري) أذونات كاميرا الجهاز لتحميل صورة لكامل الجسم.
- (اختياري) أذونات الموقع لاستهداف حملات المصممين المحليين وتوقعات الطقس.

---

## دليل خطوة بخطوة: نظرة عامة على الصفحة من الأعلى إلى الأسفل

### 1. رأس الصفحة وشريط التنقل للاستكشاف
يقع في الجزء العلوي من لوحة تحكم `/me`:
- **Header**: يعرض حالة حسابك وعنوانه.
- **Explore Cards**: اختصارات سريعة لأقسام التطبيق الرئيسية:
  - **Trend Scout** (`/trends`): عرض خلاصات أخبار الموضة اليومية المنسقة بواسطة الذكاء الاصطناعي (AI-curated fashion news feeds).
  - **Outfits** (`/outfits`): الوصول إلى تقويم ملابسك المحفوظة.
  - **Experts** (`/experts`): تصفح مصممي الأزياء والخياطين المحليين.
  - **Unpacked / Stats** (`/me/stats`): عرض تقييم خزانة الملابس، ومقاييس التكلفة لكل ارتداء (cost-per-wear metrics)، وتوزيع الألوان (color breakdowns).

### 2. بطاقة اختيار اللغة والصوت
معروضة بشكل بارز لسهولة الوصول الفوري:
- **Language Selector**: اختر من بين 12 لغة مدعومة (*English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi, Hebrew*). يؤدي اختيار لغة إلى تحديث واجهة المستخدم المحلية (UI locale) تلقائياً وربط نموذج الصوت الافتراضي لتحويل النص إلى كلام (Text-to-Speech (TTS) voice model) الإقليمي.

---

### 3. بطاقة الهوية والتفاصيل الشخصية (`ProfileDetailsCard`)

تحتوي على 9 لوحات قابلة للتوسيع (accordion panels) تدير هويتك الشخصية، مقاساتك، وعرض الصورة الرمزية (avatar rendering):

#### لوحة أ: الهوية
- **First Name & Last Name**: حقول تعريف شخصية.
- **Email Address**: عرض بريدك الإلكتروني المسجل للقراءة فقط (Read-only display).
- **Date of Birth**: يُستخدم لتخصيص تصنيف الاتجاهات الديموغرافية (demographic trend scoring).
- *Google Autofill Badge*: يُعرض تلقائياً إذا تم إنشاء ملفك الشخصي عبر Google OAuth.

#### لوحة ب: جهة الاتصال وعنوان التسليم
- **Phone Number**: مطلوب لاستقبال تنبيهات SMS/Push للمقترحات اليومية للمجدول (daily scheduler proposals) وحملات الخبراء المحليين (local expert campaigns).
- **Address Line 1**: يتميز بالإكمال التلقائي على مستوى الشارع لـ OpenStreetMap (Nominatim). يؤدي تحديد اقتراح إلى تعبئة Line 1, City, Region, Zip Code, و Country تلقائياً.
- **Address Line 2, City, Region, Postal Code**: حقول عنوان يدوية لشحن المنتجات في السوق (marketplace shipping).
- **Country**: قائمة منسدلة غير متصلة بالإنترنت (Offline combobox) قابلة للبحث حسب اسم الدولة أو رمز ISO-2.

#### لوحة ج: المعلومات الديموغرافية
- **Sex**: اختر *Female* أو *Male* لتكوين قياسات الجسم الأساسية وتصنيف الملابس (clothing taxonomy).
- **Personal Status**: اختر *Single* (أعزب/عزباء), *Married* (متزوج/متزوجة), *Divorced* (مطلق/مطلقة), أو *Widowed* (أرمل/أرملة).
- **Occupation**: إدخال نص حر (على سبيل المثال *Student*، *Marketing Manager*، *Barista*). يغذي مصنف تخصيص Trend Scout (Trend Scout personalization ranker) لإعطاء الأولوية لأخبار الأسلوب ذات الصلة.

#### دليل موجز: مزامنة بيانات ملف Google المفقودة (People API Re-Consent)
إذا قمت بتسجيل الدخول باستخدام Google قبل أن يطلب DressApp الوصول إلى تفاصيل ملفك الشخصي في **People API** (الهاتف، العنوان، الجنس، تاريخ الميلاد)، فقد تظل تلك الحقول فارغة. يمكنك مزامنتها بنقرة واحدة:

1.  **افتح لوحة Contact أو Demographics** - ستظهر لك زر **"Sync from Google"** (أيقونة التحديث) بجانب عنوان القسم.
2.  **انقر على "Sync from Google"** - إذا لم يتم منح صلاحيات People API المطلوبة أثناء تسجيل الدخول الأصلي، يكتشف DressApp ذلك ويعرض رسالة إعلامية (info toast): *"Google needs your permission to access profile details. You will be redirected to Google to grant access."*
3.  **امنح الموافقة على شاشة Google** - ستتم إعادة توجيهك إلى شاشة موافقة Google OAuth. حدد مربعات **Profile info** (الاسم، البريد الإلكتروني، الصورة) و **Contact info** (الهاتف، العنوان، الجنس، تاريخ الميلاد).
4.  **العودة التلقائية والتعبئة التلقائية** - بعد الموافقة، تعيد Google توجيهك إلى DressApp. تعمل دالة `syncGoogleProfile()` تلقائياً، مستدعية نقطة نهاية الخلفية `/auth/google/sync-profile` التي:
    - تجلب هاتفك وعنوانك وجنسك وتاريخ ميلادك من Google People API
    - تعبئ الحقول الفارغة في لوحتي **Contact** (الهاتف، العنوان) و **Demographics** (الجنس، تاريخ الميلاد)
    - تحفظ التحديثات إلى ملفك الشخصي فوراً
5.  **انتهى** - أصبح ملفك الشخصي كاملاً دون الحاجة إلى الكتابة اليدوية.

> **ملاحظة**: يظهر زر "Sync from Google" أيضاً في رأس الصفحة (بجانب زر "Sync Google Profile" الرئيسي) ويعمل بنفس الطريقة - فهو يزامن جميع بيانات ملف Google المتاحة دفعة واحدة.

#### لوحة د: التفضيلات ووحدات القياس
- **Weight Unit**: التبديل بين الكيلوغرامات (`kg`) والأرطال (`lb`).
- **Length Unit**: التبديل بين السنتيمترات (`cm`) والبوصات (`in`).

#### لوحة هـ: الصور ومرحلة الصورة الرمزية الرقمية
- **العمود الأيسر — أدوات اختيار الصور (Photo Pickers)**:
  - *Face Photo*: تحميل صورة مصغرة رمزية (avatar thumbnail).
  - *Full-body Photo*: تحميل صورة لكامل الجسم. يقوم النظام تلقائياً بتنفيذ عملية قص الخلفية المحلية U2-Net (`rembg`) لإزالة الخلفية.
  - *Remove Photo Button*: إزالة قصاصة صورتك بنقرة واحدة، مما يحول مرحلة التجربة فوراً إلى عارضة الأزياء المتجهة SVG ثنائية الأبعاد (2D SVG vector mannequin) دون أي تأخير في واجهة المستخدم (UI lag).
- **العمود الأيمن — الصورة الرمزية الرقمية ومرحلة التجربة (Digital Avatar & Try-On Stage)**:
  - **Skin Tone Picker**: لوحة ألوان تفاعلية لاختيار لون بشرة العارضة.
  - **Avatar Try-On Canvas**: يعرض الملابس فوق قصاصة صورتك أو عارضة الأزياء المتجهة Bezier الديناميكية (`DynamicAvatar.jsx`) باستخدام إزاحات المعالم المعايرة (calibrated landmark offsets) (الياقة إلى خط العنق `top-[14.5%]` وخط الخصر إلى خط الخصر `top-[36.5%]`).

#### لوحة و: ملف الأسلوب
- **Aesthetics**: كلمات مفتاحية للأسلوب مفصولة بفواصل (على سبيل المثال *Minimalist, Streetwear, Vintage*).
- **Color Palette**: درجات الألوان المفضلة (على سبيل المثال *Pastels, Earth Tones, Monochrome*).
- **Avoid**: الألوان أو أنواع الملابس التي يجب استبعادها بدقة من توصيات الذكاء الاصطناعي (AI recommendations) (على سبيل المثال *Yellow, Crop Tops*).
- **Cultural Dress Conservativeness**: تحديد مستوى الحشمة (*Casual/Relaxed*, *Moderate*, *Conservative*) لتوجيه تغطية ملابس AI Stylist.

#### لوحة ز: قياسات الجسم والمقاسات (ANSUR II Sizing Predictor)
- **وضع الإعداد / البداية الجديدة (Onboarding / Fresh Start Mode)**: أدخل 4 مدخلات أساسية: **الطول (Height)**، **الوزن (Weight)**، **محيط الخصر (Waist Circumference)**، و **طول القدم (Foot Length)**. يتنبأ نموذج الانحدار متعدد المخرجات ANSUR II المدمج في scikit-learn تلقائياً بـ 6 قياسات هيكلية:
  - *الأكتاف (Shoulders)*، *الصدر (Chest / Bust)*، *الورك (Hip)*، *طول الكم (Sleeve Length)*، *درزة البنطال الداخلية (Inseam)*، و *درزة البنطال الخارجية (Outseam)*.
- **تحويل المقاس التلقائي (Automatic Size Translation)**: بمجرد التنبؤ بالقياسات الهيكلية، تملأ خوارزميات تحديد المقاسات (deterministic sizing algorithms) على الفور **جميع مقاسات التجزئة القياسية** وصولاً إلى مقاس الحذاء:
  - *مقاس القميص الكاجوال (Casual Shirt Size)* (XS–XXL بناءً على محيط الصدر)
  - *مقاس خصر البنطال (Pants Waist Size)* (بوصة، محولة من سم الخصر)
  - *مقاس الحذاء الأمريكي (US Shoe Size)* (صيغ الرجال/النساء من طول القدم)
  - *مقاس الفستان النسائي (Women's Dress Size)* (US 0–14+ بناءً على الخصر)
  - *مقاس حمالة الصدر النسائية (Women's Bra Size)* (الشريط + الكوب محسوباً من الصدر/تحت الصدر)
- **وضع التعديل المفصل (Detailed Edit Mode)**: بعد التعبئة التلقائية، قم بضبط جميع معلمات المقاسات الـ 15 (بما في ذلك Shirt Size, Pants Size, Shoe Size, Bra Size, Dress Size) وسمات الشعر (Hair attributes) (*الطول (Length), النوع (Type), اللون (Color), الأسلوب (Style)*).
- **تبديل الوحدة المباشر (Live Unit Toggle)**: التبديل بين *kg/cm* و *lb/in* — تتحول جميع القيم فوراً دون إعادة التنبؤ.

#### لوحة ح: تسجيل الدليل المهني والخبراء
- **Professional Stylist Toggle**: التسجيل كمتخصص أزياء معتمد (مصمم أزياء، خياط، مصمم).
- **Business Details**: أدخل اسم العمل (Business Name)، العنوان (Address)، الهاتف (Phone)، البريد الإلكتروني (Email)، الموقع الإلكتروني (Website)، والوصف (Description) ليظهر في دليل `/experts` وشريط الحملات الإقليمية (regional campaign ticker).

#### لوحة ط: إعدادات دفع PayPal
- **PayPal Receiver Email**: أدخل بريد PayPal الإلكتروني الخاص بك لاستلام المدفوعات لمبيعات السوق (marketplace sales) وحملات الخبراء النشطة (active expert campaigns).

---

### 4. بطاقة لوحة التفضيلات النظامية (System Preferences Accordion Card)

تدير إعدادات على مستوى النظام، والاشتراكات، وعمليات تكامل الذكاء الاصطناعي (AI integrations):

- **AI Configuration**:
  - *Standard Mode*: يستخدم نقاط نهاية Gemini Flash 2.x المدارة بواسطة النظام.
  - *Custom API Keys Mode*: يربط مفاتيح Google Gemini, Anthropic, OpenAI, أو DeepSeek API المخصصة عبر نافذة إعداد موجهة (guided setup modal).
- **Subscription & Closet Limits**:
  - عرض مستوى الحساب الحالي (**Free**: حد 50 قطعة مقابل **Manager** أو **Professional**: قطع غير محدودة).
  - الترقية عبر PayPal Subscriptions REST API (Manager: $5/شهر أو $50/سنة؛ Professional: $10/شهر أو $100/سنة).
- **Scheduler & Push Reminders**:
  - تبديل إشعارات مقترحات الملابس الصباحية.
  - تعيين التكرار (*Everyday*, *Every Other Day*, *Twice a Week*, *On Weekday*)، الوقت (على سبيل المثال، *07:00*)، ومتطلبات أسلوب اللباس (dress-code style demands) (*Casual*, *Formal*, *Athletic*, *Custom*).
  - تفعيل تنبيهات دفع VAPID للمتصفح.
- **Campaign Notification Preferences**:
  - مفاتيح تبديل دقيقة لـ *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos*, و *Personal Stylist*.
  - ضبط شريط **Max Campaign Distance** (من 5 كم إلى 50 كم).
- **Google Calendar Connect**: زر OAuth لمزامنة أحداث التقويم الشخصي مع AI Stylist.
- **Location Services Card**: تبديل أذونات موقع GPS لتغذيات الخبراء المطابقة للمسافة والطقس المحلي الفائق (hyper-local weather).
- **Invite Friends Button**: نسخ رابط الإحالة القابل للمشاركة.
- **Shopping Assistant**: الوصول إلى تفاصيل إضافة Chrome Web Store أو إنشاء **Universal Bookmarklet** (`javascript:...`) لمقارنات المقاسات الفورية للتجارة الإلكترونية (e-commerce).

---

### 5. إجراءات الحساب والتشخيص
- **Sign Out**: تسجيل الخروج من جلستك الحالية.
- **Delete my Account**: رابط لحذف بيانات الحساب نهائياً.
- **Developer Panel**: لوحة تشخيص (Diagnostic accordion) لاختبار البيئة.

---

## النتائج المتوقعة
- مزامنة فورية للقياسات البدنية، لون البشرة، وقصاصات الصور عبر 2D Avatar Try-On Canvas.
- صفر طلبات شبكة خاملة (idle network requests) عند التنقل بين لوحات الإعدادات.
- مقترحات ملابس مخصصة من AI Stylist تتوافق مع قواعد الحشمة وجدولك الزمني.

---

## استكشاف الأخطاء وإصلاحها
- **لم تتم إزالة خلفية الصورة**: تأكد من أن الصورة التي قمت بتحميلها لكامل الجسم مع إضاءة خلفية متباينة.
- **عدم وصول تنبيهات الدفع**: تأكد من تمكين أذونات إشعارات المتصفح وحفظ رقم هاتف تحت *Contact*.
- **عدم استجابة الإكمال التلقائي للعنوان**: تحقق من أن اتصال الإنترنت نشط لاستعلامات OpenStreetMap Nominatim.

---

## القيود
- مساحة الحساب المجانية (Free tier account space) محدودة بـ 150 قطعة ما لم يتم توسيعها عبر مكافأة الإحالة (+10 خانات لكل دعوة) أو الاشتراك الاحترافي (Pro subscription).
- يتطلب وضع مفتاح API المخصص مفاتيح صالحة مع حصة متبقية من المزود المعني.
