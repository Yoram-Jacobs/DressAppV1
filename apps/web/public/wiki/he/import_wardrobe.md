# ייבוא המלתחה שלך - מדריך מפורט

## סקירה כללית

כבר יש לך את המלתחה שלך במעקב באפליקציה אחרת? אין בעיה!DressApp הופכת את זה לקל לייבא את נתוני המלתחה הקיימים שלך כך שלא תצטרך להתחיל מאפס.אנחנו תומכים בייבוא ממגוון רחב של אפליקציות פופולריות לתכנון ארון בגדים ואאוטפיטים.

## מקורות ייבוא נתמכים

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## מדריך ייבוא מפורט

### שלב 1: פתח את דף המלתחה
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### שלב 2: גישה לתכונת הייבוא
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### שלב 3: בחר את אפליקציית המקור
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### שלב 4: ייצא נתונים מהאפליקציה הישנה
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### שלב 5: העלה ל-DressApp
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### שלב 6: סקירה והתאמה
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## מה ייקח לקחת

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## פתרון בעיות

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

## זקוק לעזרה?

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*עודכן לאחרונה: יולי 2026*
# ייבוא הארון שלך מאפליקציות אחרות (מעבר ממתחרים)

## סקירה כללית
אם הבגדים שלך כבר מקוטלגים באפליקציית ארון בגדים אחרת (כמו Whering‏, Acloset או Stylebook), אין צורך להתחיל מאפס. DressApp כוללת **Desktop Wardrobe Migration Agent** חכם (באמצעות סימנייה מיוחדת - bookmarklet) הסורק את דף הארון הישן שלך, שולף את כרטיסי הפריטים ומעלה אותם אוטומטית ל-DressApp. לאחר מכן, ה-AI של המערכת פועל ברקע כדי לזהות באופן אוטומטי את הצבעים, המותגים, הבדים והקטגוריות של הבגדים.

## דרישות קדם
- **מחשב שולחני (Desktop)**: סימניית המעבר (bookmarklet) דורשת יכולות דפדפן של מחשב שולחני (Chrome‏, Edge או Safari). אין תמיכה במכשירים ניידים או בטאבלטים.
- **חשבונות פעילים**: יש להיות מחוברים גם לחשבון ה-DressApp וגם לחשבון ארון הבגדים המתחרה באותו דפדפן.
- **סרגל הסימניות (Bookmarks Bar)**: סרגל הסימניות של הדפדפן חייב להיות גלוי (Ctrl+Shift+B ב-Windows‏, Cmd+Shift+B ב-macOS).

## הוראות שלב אחר שלב
1. פתיחת דף **פרופיל (Profile)** ב-DressApp במחשב השולחני ולחיצה על **Import Wardrobe** (ייבוא ארון).
2. בחירת האפליקציה הישנה מהרשימה (Whering‏, Acloset‏, Stylebook‏, Smartli‏, BeautyAI וכדומה) או הזנת שם מותאם אישית.
3. גרירת כפתור הסימנייה **Share & Start Agent** מהמסך ישירות אל סרגל הסימניות של הדפדפן.
4. פתיחת כרטיסייה חדשה, מעבר לגרסת הווב של אפליקציית הארון הישנה והתחברות לחשבון. כניסה לדף שבו מוצגים כל פריטי הלבוש בתצוגת רשת (grid).
5. לחיצה על סימניית **Share & Start Agent** בסרגל הסימניות.
6. הסוכן (agent) יתחיל בגלילה, יזהה תמונות של פריטים ויזרים אותם ל-DressApp בקבוצות של 15 פריטים בכל פעם. אין לסגור את הכרטיסייה של DressApp במהלך תהליך זה.
7. עם סיום ההזרמה, יש לבדוק את דף הארון (Closet) ב-DressApp. ה-AI Stylist יעבד את הפריטים ברקע כדי למלא את מאפייני הלבוש באופן אוטומטית.

## תוצאות צפויות
- כרטיסי הבגדים יופיעו מיד ברשת ארון הבגדים ב-DressApp.
- הרקעים יוסרו באופן אוטומטי, וישאירו תמונות ממוזערות נקיות ושקופות.
- שדות התיוג (קטגוריה, צבע, גזרה, בד) יתמלאו מעצמם תוך דקות ספורות מהייבוא.

## פתרון בעיות
- **לא ניתן להתקין את הסימנייה**: יש לוודא שסרגל הסימניות של הדפדפן פעיל. אם הגדרות אבטחה חוסמות גרירה, ניתן ללחוץ לחיצה ימנית על הכפתור, לבחור ב-"Copy Link Address" (העתקת כתובת קישור), ליצור סימנייה חדשה באופן ידני ולהדביק את הקוד בשדה ה-URL.
- **הסוכן מפסיק לגלול**: יש לוודא שדף הארון של המתחרה פעיל ואינו ממוזער. אם התהליך נעצר, יש לרענן את דף המתחרה וללחוץ שוב על הסימנייה.
- **פריטים כפולים**: מנגנון הייבוא בודק את חתימות התמונות (dHash) כדי לסנן העלאות כפולות באופן אוטומטי.

## מגבלות
- **מחשב שולחני בלבד**: לא ניתן להריץ בדפדפנים בנייד בשל מגבלות API.
- **בהירות חזותית**: פריסות בגדים מעוותות מאוד, כהות או חופפות באפליקציה המתחרה עלולות לגרום לכישלון בחיתוך התמונה, וידרשו התאמות ידניות של התמונות לאחר מכן.
