# استيراد خزانة الملابس - دليل مفصل

## نظرة عامة

لديك بالفعل خزانتك المسجلة في تطبيق آخر؟ لا مشكلة!DressApp يجعل من السهل استيراد بيانات خزانتك الحالية حتى لا تضطر للبدء من الصفر.نحن ندعم استيراد البيانات من مجموعة واسعة من تطبيقات تنظيم الملابس وتنسيق الملابس الشهيرة.

## مصادر الاستيراد المدعومة

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## دليل الاستيراد خطوة بخطوة

### الخطوة 1: افتح صفحة الخزانة
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### الخطوة 2: الوصول إلى ميزة الاستيراد
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### الخطوة 3: اختر مصدر التطبيق
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### الخطوة 4: قم بتصدير البيانات من التطبيق القديم
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### الخطوة 5: قم بتحميل إلى DressApp
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### الخطوة 6: المراجعة والتعديل
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## ما الذي يتم استيراده

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## حل المشاكل

### Import Failed
- Check that the file format is correct (CSV, JSON, or app-specific format)
- Ensure the file isn't corrupted or too large
- Try exporting again from the source app

### Missing Items After Import
- Some fields may not have mapped correctly
- Check the import results page for warnings
- Manually add missing items if needed

### Images Not Imported
- Not all apps include images in their export files
- You can add images manually to imported items later
- Use the camera or upload function on the item detail page

## تحتاج مساعدة؟

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*آخر تحديث: يوليو 2026*
# استيراد خزانة الملابس الخاصة بك من تطبيقات أخرى (الانتقال من المنافسين)

## نظرة عامة
إذا كانت ملابسك مصنفة بالفعل في تطبيق خزانة ملابس آخر (مثل Whering أو Acloset أو Stylebook)، فلا داعي للبدء من الصفر. يتميز DressApp بـ **Desktop Wardrobe Migration Agent** ذكي (عبر علامة مرجعية للمتصفح - bookmarklet) يقوم بالدخول إلى صفحة خزانتك القديمة، والتقاط بطاقات الملابس، وتحميلها تلقائيًا إلى DressApp. بعد ذلك، يعمل نظام AI في الخلفية لتحديد الألوان والعلامات التجارية والأقمشة وفئات الملابس تلقائيًا.

## المتطلبات الأساسية
- **كمبيوتر مكتبي (Desktop Computer)**: تتطلب العلامة المرجعية للانتقال (bookmarklet) إمكانيات متصفح سطح المكتب (Chrome أو Edge أو Safari). وهي غير مدعومة على الأجهزة المحمولة أو الأجهزة اللوحية (Tablets).
- **حسابات نشطة**: يجب تسجيل الدخول إلى كل من حساب DressApp وحساب خزانة الملابس المنافس في نفس المتصفح.
- **شريط الإشارات المرجعية (Bookmarks Bar)**: يجب أن يكون شريط الإشارات المرجعية في المتصفح مرئيًا (Ctrl+Shift+B على Windows، وCmd+Shift+B على macOS).

## تعليمات خطوة بخطوة
1. فتح صفحة **الملف الشخصي (Profile)** الخاصة بـ DressApp على كمبيوتر مكتبي والنقر على **Import Wardrobe** (استيراد خزانة الملابس).
2. اختيار التطبيق القديم من القائمة (Whering، Acloset، Stylebook، Smartli، BeautyAI، إلخ) أو كتابة اسم مخصص.
3. سحب زر العلامة المرجعية **Share & Start Agent** من الشاشة مباشرة إلى شريط الإشارات المرجعية في المتصفح.
4. فتح علامة تبويب جديدة، والانتقال إلى إصدار الويب لتطبيق خزانة الملابس القديم، وتسجيل الدخول. الذهاب إلى الصفحة التي تعرض جميع قطع الملابس في شبكة (grid).
5. النقر على علامة **Share & Start Agent** المرجعية في شريط الإشارات المرجعية.
6. سيبدأ الوكيل (agent) بالتمرير، واكتشاف صور الملابس، وبثها إلى DressApp في دفعات مكونة من 15 قطعة. يرجى عدم إغلاق علامة تبويب DressApp أثناء هذه العملية.
7. بمجرد اكتمال البث، يرجى التحقق من صفحة خزانة الملابس (Closet) في DressApp. سيعمل AI Stylist في الخلفية لمعالجة العناصر وتعبئة سمات الملابس تلقائيًا.

## النتائج المتوقعة
- ستظهر بطاقات الملابس على الفور في شبكة خزانة ملابس DressApp.
- تتم إزالة الخلفيات تلقائيًا، مما يترك صورًا مصغرة شفافة ونظيفة.
- سيتم ملء حقول التصنيف (الفئة، اللون، المقاس، القماش) تلقائيًا في غضون بضع دقائق من الاستيراد.

## استكشاف الأخطاء وإصلاحها
- **عدم تثبيت العلامة المرجعية (Bookmarklet)**: التأكد من تمكين شريط الإشارات المرجعية بالمتصفح. إذا كانت إعدادات الأمان تمنع السحب، يرجى النقر بزر الماوس الأيمن على الزر، واختيار "Copy Link Address" (نسخ عنوان الرابط)، وإنشاء إشارة مرجعية جديدة يدويًا، ولصق الرمز في حقل URL.
- **توقف الوكيل (Agent) عن التمرير**: التأكد من أن صفحة خزانة الملابس المنافسة نشطة وليست مصغرة. إذا توقفت، يرجى تحديث الصفحة المنافسة والنقر على العلامة المرجعية مرة أخرى.
- **العناصر المكررة**: يقوم المستورد بالتحقق من تواقيع الصور (dHash) لتصفية التحميلات المكررة تلقائيًا.

## القيود
- **سطح المكتب فقط**: لا يمكن تشغيله على متصفحات الأجهزة المحمولة بسبب قيود واجهة برمجة التطبيقات (API).
- **الوضوح البصري**: قد تفشل عملية استخراج الاقتصاص البصري في التنسيقات المشوهة للغاية أو المظلمة أو المتداخلة للملابس على تطبيق المنافس، مما يتطلب تعديلات يدوية على الصور لاحقًا.
