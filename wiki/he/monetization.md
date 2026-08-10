# מנוע המונטיזציה והחיוב של DressApp

מסמך זה מספק סקירה ארכיטקטונית מקיפה, מדריך למשתמש וצלילת עומק טכנולוגית לחיוב מנויים, מונטיזציה ומכניקת לולאות צמיחה ב-DressApp.

---

## 1. תקציר מנהלים והצעת ערך

### סקירה כללית
DressApp מפעילה מודל היברידי של מנוי SaaS ומנגנון הגבלת שירות יומי (utility gating):
1. **מסלולי מנוי (SaaS)**: תוכניות במחיר קבוע (Free‏, Manager‏, Professional) המנהלות את קיבולת האחסון של הארון, מכסות עיצוב יומיות ב-AI ותכונות מתקדמות (כגון יצירת קמפיינים פרסומיים).
2. **מגבלות מכסה יומית (מסלול Free)**: שימוש מוגבל ב-AI במסלול Free, המגביל את המשתמשים ל-10 בקשות ביום. לוגיקת הניכוי ופוג תוקף יתרות של 30 יום חלים על חשבונות Free וחשבונות ניסיון *בלבד*.
3. **לולאת צמיחה ויראלית**: תוכנית הפניות המאפשרת למשתמשי מסלול Free להרחיב את קיבולת הארון הבסיסית שלהם באופן אורגני על ידי שיתוף קישורי הזמנה.
4. **תשלומים מקומיים (שער Atzmai)**: תמיכה מובנית בתשלומים ישראליים (Bit, כרטיסי אשראי מקומיים) ב-ILS (שקלים). מכיוון ששער Atzmai תומך רק ב-ILS, מחירי USD מומרים באמצעות API של שערי חליפין בזמן אמת.

### תזרים ארכיטקטוני

```mermaid
graph TD
    User([User App Client])
    Gateway[Payments API Gateway /atzmai]
    Auth[Auth Router /auth/register]
    Closet[Closet Router /closet/item]
    DB[(MongoDB Atlas)]
    AtzmaiAPI[Atzmai Payment API]
    PayPalAPI[PayPal Subscriptions API]

    %% Closet Upload Limit Gating
    User -->|1. Upload Garment| Closet
    Closet -->|2. Check Item Count & Subscription| DB
    DB -->|3. Return Count + SubscriptionInfo| Closet
    Closet -.->|If Exceeded & Sub Inactive: HTTP 402| User
    
    %% Paid Subscription Checkout
    User -->|4. Post /atzmai/subscribe| Gateway
    Gateway -->|5. Create Intent (ILS)| AtzmaiAPI
    AtzmaiAPI -->|6. Return Payment URL| Gateway
    Gateway -->|7. Return Payment URL| User
    User -->|8. User Approves Payment| AtzmaiAPI
    AtzmaiAPI -->|9. Trigger Webhook| Gateway
    Gateway -->|10. Capture Transaction| DB
    
    %% Viral Referral Mechanics
    User -->|11. Register with referrer_id| Auth
    Auth -->|12. Increment closet_capacity_bonus| DB
```

---

## 2. מסלולי מנוי ומבנה תמחור

### תוכניות תמחור

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | $0.00 לחודש | 50 פריטים בבסיס | 10 נקודות ללא עלות יומיות (פגות תוך 30 יום) | ארגון בסיסי, תמיכת קהילה, הרחבת הפניות (+10 מקומות לכל הרשמה עד 200 פריטים לכל היותר) |
| **Manager (Pro)** | $4.99 לחודש | ללא הגבלה | פעולות יומיות ללא הגבלה | 14 ימי ניסיון בחינם, הקצאה ראשונית של 50 נקודות, מכירה והשכרה במרקטפלייס, Trend Scout, התראות מתוזמנות |
| **Professional** | $9.99 לחודש | ללא הגבלה | פעולות יומיות ללא הגבלה | 30 ימי ניסיון בחינם, הקצאה ראשונית של 300 נקודות, כל תכונות Manager, תמיכה ביצירת קמפיינים פרסומיים (עמלה של $1 ליום, מקסימום 3 קמפיינים במקביל) |

### חבילות נקודות AI מראש (לא רלוונטי - Obsolete)
* חבילות טעינת נקודות מראש **אינן נתמכות עוד**.
* כדי למנוע הפרעות בשירות, על משתמשי מסלול Free לשדרг למסלול המנוי Manager או Professional.

### תוקף נקודות ועדיפות צריכה (לוגיקת FIFO)
* **כלל**: תוקף נקודות (30 יום) ולוגיקת עדיפות צריכה FIFO (הראשון שנכנס הוא הראשון שיוצא) חלים **רק על מסלולי המנוי Free ו-Trial**.
* **תוכניות בתשלום**: משתמשים במסלולי Manager או Professional פעילים מקבלים פעולות AI יומיות ללא הגבלה ואינם כפופмы למדידת נקודות, פקיעת תוקף או בדיקות עדיפות ניכוי.

---

## 3. תשלומים מקומיים וחשבוניות (שער Atzmai)

עבור חשבונות הממוקמים בישראל, DressApp מתממשקת עם **שער התשלום Atzmai** כדי לעבד עסקאות מקומיות ב-ILS (שקלים):
1. **עיבוד ב-ILS בלבד**: שער Atzmai מעבד תשלומים מקומיים ב-ILS בלבד.
2. **המרת מטבע**: מנויים ועמלות קמפיינים הנקובים ב-USD מומרים באופן דינמי ל-ILS לפני הפקת הקישור באמצעות API של שערי חליפין בזמן אמת (עם מעבר לשער קבוע של 3.70 אם ה-API אינו זמין).
3. **אימות Webhook וחיוב קמפיינים**:
   - מעקב עסקאות כללי באמצעות `atzmai_topups` אינו פעיל עוד.
   - עם זאת, `atzmai_topups` נותר פעיל עבור קליטה ואימות של **תשلوמי קמפיין יומיים (עמלה של $1 ליום)**.
   - עם קליטה מוצלחת, השדה `last_daily_payment_date` של הקמפיין מעודכן לתאריך הנוכחי.
4. **הנהלת חשבונות ממוחשבת ב-PDF**: עם קליטה מוצלחת (capture), השרת פונה ל-API של Atzmai להפקה והורדה של קבצי PDF רשמיים של קבלה וחשבונית. אלה נשלחים כקבצים מצורפים בדוא"ל ישירות לרוכשים.

---

## 4. מפרט טכנולוגי וצלילת עומק ליכולות

### הגדרות סכמת נתונים (Data Schema Definitions)

הסכמה של MongoDB ב-[schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) עוקבת אחר מנויי המשתמשים וקיבולת הארון:

```python
class SubscriptionInfo(BaseModel):
    is_active: bool = False
    plan_type: Literal["free", "monthly", "yearly"] = "free"
    tier: Literal["free", "manager", "professional"] = "free"
    stripe_subscription_id: str | None = None
    paypal_subscription_id: str | None = None
    atzmai_subscription_id: str | None = None
    expires_at: str | None = None
    cancelled_at: str | None = None

class User(BaseDoc):
    subscription: SubscriptionInfo = Field(default_factory=SubscriptionInfo)
    closet_capacity_bonus: int = 0
```

### אכיפת מגבלות הארון ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
אצל העלאת פריטים, המערכת מגנה על מגבלות מסד הנתונים עם מגבלה קשיחה של 200 פריטים עבור הפניות:
```python
capacity_limit = min(200, 50 + user.get("closet_capacity_bonus", 0))
if current_count >= capacity_limit and not user.get("subscription", {}).get("is_active", False):
    raise HTTPException(
        status_code=402,
        detail={
            "code": "closet_capacity_exceeded",
            "message": f"You have reached your free closet capacity of {capacity_limit} items. Upgrade to Manager or Professional to add more items."
        }
    )
```

### לוגיקת המרת מטבע ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
ממירה סכומי USD ל-ILS באופן דינמי לפני שליחת הנתונים ל-Atzmai:
```python
async def get_usd_to_ils_rate() -> float:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://open.er-api.com/v6/latest/USD", timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                rate = data.get("rates", {}).get("ILS")
                if rate:
                    return float(rate)
    except Exception:
        pass
    return 3.70
```
