# محرك تحقيق الدخل والفوترة في DressApp

تقدم هذه الوثيقة نظرة عامة شاملة على الهندسة البرمجية، ودليل المستخدم، والتعمق التقني لآليات تحقيق الدخل، وفواتير الاشتراكات، وحلقات النمو في DressApp.

---

## 1. الملخص التنفيذي ونموذج القيمة المضافة

### نظرة عامة عالية المستوى
يعتمد DressApp نموذجًا هجينًا يجمع بين اشتراك SaaS ونظام حظر الخدمة اليومي (utility gating):
1. **فئات الاشتراكات (SaaS)**: خطط ذات أسعار ثابتة (Free، Manager، Professional) تحكم سعة تخزين خزانة الملابس، وحصص التنسيق اليومية بالذكاء الاصطناعي، والميزات المتقدمة (مثل إنشاء حملات الإعلانات).
2. **حدود الحصص اليومية (الفئة المجانية)**: استخدام مقيد للذكاء الاصطناعي في الخطة المجانية، مما يقصر المستخدمين على 10 طلبات يومية. ينطبق منطق الخصم وانتهاء صلاحية الفئات لمدة 30 يومًا على الحسابات المجانية والتجريبية *فقط*.
3. **حلقة النمو الفيروسي**: برنامج إحالة يسمح لمستخدمي الفئة المجانية بتوسيع سعة خزانة الملابس الأساسية بشكل عضوي من خلال مشاركة روابط الدعوة.
4. **المدفوعات المحلية (بوابة Atzmai)**: دعم أصيل للمدفوعات الإسرائيلية (Bit، وبطاقات الائتمان المحلية) بالـ ILS (الشيكل). نظرًا لأن Atzmai تدعم الـ ILS فقط، يتم تحويل أسعار الـ USD باستخدام واجهة برمجة تطبيقات لأسعار الصرف المباشرة.

### التدفق الهندسي (Architectural Flow)

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

## 2. فئات الاشتراكات وهيكل التسעير

### خطط التسعير

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | $0.00 / month | 50 عنصرًا أساسيًا | 10 أرصدة مجانية يوميًا (تنتهي صلاحيتها خلال 30 يومًا) | التنظيم الأساسي، دعم المجتمع، توسيع الإحالات (+10 فتحات لكل تسجيل حتى 200 عنصر كحد أقصى) |
| **Manager (Pro)** | $4.99 / month | غير محدود | عمليات يومية غير محدودة | فترة تجريبية مجانية لمدة 14 يومًا، تخصيص أولي قدره 50 رصيدًا، البيع والتأجير في السوق، Trend Scout، التنبيهات المجدولة |
| **Professional** | $9.99 / month | غير محدود | عمليات يومية غير محدودة | فترة تجريبية مجانية لمدة 30 يومًا، تخصيص أولي قدره 300 رصيدًا، جميع ميزات Manager، دعم إنشاء حملات إعلانية (رسوم $1/يوميًا، بحد أقصى 3 حملات متزامنة) |

### حزم أرصدة الذكاء الاصطناعي المدفوعة مسبقًا (مهجورة - Obsolete)
* لم تعد حزم شحن الرصيد المدفوع مسبقًا **مدعومة**.
* لتجنب انقطاع الخدمة، يجب على مستخدمي الخطة المجانية الترقية إلى خطة اشتراك Manager أو Professional.

### صلاحية الرصيد وأولوية الاستهلاك (منطق الوارد أولاً يصرف أولاً - FIFO)
* **القاعدة**: تنطبق صلاحية الرصيد (30 يومًا) ومنطق أولوية الاستهلاك FIFO (الوارد أولاً يصرف أولاً) على **فئتي الاشتراك المجاني والتجريبي فقط**.
* **الخطط المدفوعة**: يتلقى المستخدمون في خطط Manager أو Professional النشطة عمليات ذكاء اصطناعي يومية غير محدودة، ولا يخضعون لقياس الرصيد أو انتهاء الصلاحية أو فحوصات أولوية السحب.

---

## 3. المدفوعات المحلية والفوترة (بوابة Atzmai)

بالنسبة للحسابات المقيمة في إسرائيل، يتكامل DressApp مع **بوابة دفع Atzmai** لمعالجة المعاملات المحلية بالـ ILS (الشيكل):
1. **المعالجة بالـ ILS فقط**: تعالج بوابة Atzmai المدفوعات المحلية بالـ ILS حصريًا.
2. **تحويل العملات**: يتم تحويل الاشتراكات ورسوم الحملات المقومة بالـ USD ديناميكيًا إلى ILS قبل توليد الرابط باستخدام واجهة برمجة تطبيقات لأسعار الصرف المباشرة (مع الرجوع إلى سعر ثابت قدره 3.70 إذا تعذر الوصول إليها).
3. **التحقق من Webhook وفوترة الحملات**:
   - يعتبر التتبع العام للمعاملات عبر `atzmai_topups` ملغى.
   - ومع ذلك، تظل `atzmai_topups` نشطة لالتقاط والتحقق من **مدفوعات الحملة اليومية (رسوم بقيمة $1/يوميًا)**.
   - عند نجاح عملية الالتقاط، يتم تحديث تاريخ `last_daily_payment_date` للحملة إلى التاريخ الحالي.
4. **مسك الدفاتر المؤتمت بصيغة PDF**: عند نجاح عملية الالتقاط (capture), يستعلم النظام الخلفي عن واجهة برمجة تطبيقات فوترة Atzmai لإنشاء وتنزيل ملفات PDF الرسمية للفواتير والإيصالات. يتم إرسالها كمرفقات بريد إلكتروني مباشرة إلى المشتري.

---

## 4. المكونات التقنية والتعمق في القدرات

### تعريفات مخطط البيانات (Data Schema Definitions)

يتتبع مخطط MongoDB في [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) اشتراكات المستخدم وسعة خزانة الملابس:

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

### فرض قيود خزانة الملابس ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
أثناء تحميل العناصر، يحمي النظام قيود قاعدة البيانات بحد أقصى 200 عنصر للإحالات:
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

### منطق تحويل العملات ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
يحول مبالغ الـ USD إلى ILS ديناميكيًا قبل إرسال البيانات إلى Atzmai:
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
