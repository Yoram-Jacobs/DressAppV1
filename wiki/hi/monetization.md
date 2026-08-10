# DressApp मुद्रीकरण और बिलिंग इंजन

यह दस्तावेज़ DressApp में मुद्रीकरण, सब्सक्रिप्शन बिलिंग और वायरल विकास-लूप यांत्रिकी का एक व्यापक वास्तुशिल्प अवलोकन, उपयोगकर्ता मैनुअल और तकनीकी गहराई से विश्लेषण प्रदान करता है।

---

## 1. कार्यकारी सारांश और मूल्य प्रस्ताव

### उच्च-स्तरीय अवलोकन (High-Level Overview)
DressApp एक हाइब्रिड SaaS सब्सक्रिप्शन और दैनिक उपयोगिता सीमा मॉडल (utility gating model) लागू करता है:
1. **सब्सक्रिप्शन टियर (SaaS)**: फ्लैट-रेट प्लान (Free, Manager, Professional) जो अलमारी भंडारण क्षमता, दैनिक AI स्टाइलिंग सीमाओं और उन्नत सुविधाओं (जैसे, विज्ञापन अभियान निर्माण) को नियंत्रित करते हैं।
2. **दैनिक कोटा सीमाएं (Free टियर)**: Free प्लान पर सीमित AI उपयोग, जो उपयोगकर्ताओं को 10 दैनिक अनुरोधों तक प्रतिबंधित करता है। कटौती लॉजिक और 30-दिवसीय बकेट समाप्ति नियम *केवल* Free और ट्रायल (Trial) खातों पर लागू होते हैं।
3. **वायरल विकास लूप**: एक रेफरल कार्यक्रम जो Free टियर उपयोगकर्ताओं को आमंत्रण लिंक साझा करके व्यवस्थित रूप से अपनी आधारभूत अलमारी क्षमता का विस्तार करने की अनुमति देता है।
4. **स्थानीयकृत भुगतान (Atzmai गेटवे)**: ILS (शेकेल) में स्थानीय इजरायली भुगतानों (Bit, स्थानीय क्रेडिट कार्ड) के लिए देशी समर्थन। चूंकि Atzmai केवल ILS का समर्थन करता है, इसलिए USD कीमतों को लाइव विनिमय दर API का उपयोग करके परिवर्तित किया जाता है।

### वास्तुशिल्प प्रवाह (Architectural Flow)

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

## 2. सब्सक्रिप्शन टियर और मूल्य निर्धारण टोपोलॉजी

### मूल्य निर्धारण योजनाएं

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | $0.00 / माह | 50 आइटम बेसलाइन | 10 मुफ़्त दैनिक क्रेडिट (30 दिनों में समाप्त होने वाले) | बुनियादी संगठन, सामुदायिक सहायता, रेफरल विस्तार (+10 स्लॉट प्रति पंजीकरण, अधिकतम 200 आइटम तक) |
| **Manager (Pro)** | $4.99 / माह | असीमित | असीमित दैनिक संचालन | 14-दिन का निःशुल्क ट्रायल, 50-क्रेडिट प्रारंभिक आवंटन, बाज़ार में बिक्री और किराए पर देना, Trend Scout, निर्धारित सूचनाएं |
| **Professional** | $9.99 / माह | असीमित | असीमित दैनिक संचालन | 30-दिन का निःशुल्क ट्रायल, 300-क्रेडिट प्रारंभिक आवंटन, सभी Manager सुविधाएं, विज्ञापन अभियान बनाने के लिए समर्थन ($1/दिन शुल्क, एक साथ अधिकतम 3 अभियान) |

### प्रीपेड AI क्रेडिट पैक (अप्रचलित - Obsolete)
* प्रीपेड क्रेडिट टॉप-अप पैकेज अब **समर्थित नहीं हैं**।
* सेवा व्यवधानों से बचने के लिए, Free प्लान उपयोगकर्ताओं को Manager या Professional सब्सक्रिप्शन योजना में अपग्रेड करना होगा।

### क्रेडिट समाप्ति और खपत प्राथमिकता (FIFO लॉजिक)
* **नियम**: क्रेडिट समाप्ति (30 दिन) और FIFO (फर्स्ट-इन-फर्स्ट-アウト) खपत प्राथमिकता लॉजिक **केवल Free और ट्रायल (Trial) सब्सक्रिप्शन टियर पर लागू होते हैं**।
* **सशुल्क योजनाएं**: सक्रिय Manager या Professional योजनाओं वाले उपयोगकर्ताओं को असीमित दैनिक AI संचालन मिलते हैं और वे क्रेडिट मीटरिंग, समाप्ति या प्राथमिकता जांच के अधीन नहीं होते हैं।

---

## 3. स्थानीयकृत भुगतान और चालान (Atzmai गेटवे)

इजरायल में स्थित खातों के लिए, DressApp स्थानीय लेनदेन को ILS (शेकेल) में संसाधित करने के लिए **Atzmai भुगतान गेटवे** के साथ एकीकृत होता है:
1. **केवल ILS प्रसंस्करण**: Atzmai गेटवे स्थानीय भुगतान को विशेष रूप से ILS में संसाधित करता है।
2. **मुद्रा विनिमय**: USD-मूल्यवर्ग वाले सब्सक्रिप्शन और अभियान शुल्कों को लिंक निर्माण से पहले लाइव विनिमय दर API का उपयोग करके गतिशील रूप से ILS में परिवर्तित किया जाता है (यदि API अनुपलब्ध हो, तो स्थिर 3.70 दर पर वापस आ जाता है)।
3. **वेबहुक सत्यापन और अभियान बिलिंग**:
   - `atzmai_topups` के माध्यम से सामान्य लेनदेन ट्रैकिंग अप्रचलित है।
   - हालांकि, `atzmai_topups` **दैनिक अभियान भुगतानों ($1/दिन शुल्क)** को कैप्चर और सत्यापित करने के लिए सक्रिय रहता है।
   - सफल कैप्चर पर, अभियान की `last_daily_payment_date` को वर्तमान तिथि में अपडेट कर दिया जाता है।
4. **स्वचालित PDF बहीखाता**: सफल कैप्चर पर, बैकएंड आधिकारिक चालान और रसीद PDF उत्पन्न करने और डाउनलोड करने के लिए Atzmai बिलिंग API से पूछताछ करता है। ये सीधे खरीदार को ईमेल अनुलग्नक के रूप में भेजे जाते हैं।

---

## 4. तकनीकी स्टैक और क्षमता गहन-विश्लेषण

### डेटा स्कीमा परिभाषाएं (Data Schema Definitions)

[schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) में MongoDB स्कीमा उपयोगकर्ता सदस्यता और अलमारी क्षमता को ट्रैक करता है:

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

### अलमारी सीमा प्रवर्तन ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
आइटम अपलोड के दौरान, सिस्टम डेटाबेस सीमाओं को रेफरल के लिए 200 आइटम की कड़ी सीमा के साथ सुरक्षित करता है:
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

### मुद्रा विनिमय लॉजिक ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Atzmai को पेलोड भेजने से पहले USD राशियों को गतिशील रूप से ILS में परिवर्तित करता है:
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
