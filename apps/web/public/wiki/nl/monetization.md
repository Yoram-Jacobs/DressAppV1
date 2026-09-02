# DressApp Monetiserings- & Factureringsengine

Dit document biedt een uitgebreid architectonisch overzicht, een gebruikershandleiding en een diepgaande technologische analyse van de monetisering, abonnementsfacturering en virale groeicyclusmechanismen in DressApp.

---

## 1. Samenvatting & Waardecreatie

### Hoofdlijnenoverzicht
DressApp implementeert een hybride model van SaaS-abonnementen en een dagelijks verbruiksbeperkingssysteem (utility gating):
1. **Abonnementen (SaaS)**: Vaste tariefplannen (Free, Manager, Professional) die kledingkastcapaciteit, dagelijkse AI-stylingquota en geavanceerde functies (bijv. aanmaken van advertentiecampagnes) bepalen.
2. **Dagelijkse quota-limieten (Free-abonnement)**: Beperkt AI-gebruik op het Free-abonnement, wat gebruikers beperkt tot 10 dagelijkse aanvragen. De aftreklogica en het verloop van de 30-dagen-tegoeden gelden *alleen* voor Free- en proefaccounts (Trial).
3. **Virale groeicyclus**: Een verwijzingsprogramma waarmee Free-gebruikers hun basiskledingkastcapaciteit organisch kunnen uitbreiden door uitnodigingslinks te delen.
4. **Gelokaliseerde betalingen (Atzmai Gateway)**: Ingebouwde ondersteuning voor Israëlische betalingen (Bit, lokale creditcards) in ILS (Shekel). Omdat Atzmai alleen ILS ondersteunt, worden USD-prijzen omgerekend via een live wisselkoers-API.

### Architectonische stroom

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

## 2. Abonnementen & Prijsstructuur

### Tariefplannen

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | $0.00 / maand | Basis van 50 items | 10 gratis dagelijkse credits (vervallen na 30 dagen) | Basisorganisatie, communityondersteuning, verwijzingsuitbreidingen (+10 slots per registratie tot maximaal 200 items) |
| **Manager (Pro)** | $4.99 / maand | Onbeperkt | Onbeperkt aantal dagelijkse bewerkingen | 14 dagen gratis proefperiode, initiële toewijzing van 50 credits, verkopen & verhuren op de marktplaats, Trend Scout, geplande meldingen |
| **Professional** | $9.99 / maand | Onbeperkt | Onbeperkt aantal dagelijkse bewerkingen | 30 dagen gratis proefperiode, initiële toewijzing van 300 credits, alle Manager-functies, ondersteuning voor het aanmaken van advertentiecampagnes (tarief van $1/dag, max. 3 gelijktijdige campagnes) |

### Prepaid AI-kredietpakketten (Vervallen - Obsolete)
* Prepaid opwaardeerpakketten voor credits worden **niet langer ondersteund**.
* Om serviceonderbrekingen te voorkomen, moeten Free-gebruikers upgraden naar een Manager- of Professional-abonnement.

### Kredietverloop & Verbruiksprioriteit (FIFO-logica)
* **Regel**: Kredietverloop (30 dagen) en FIFO (first-in-first-out) verbruiksprioriteit gelden **alleen voor de Free- en proefabonnementen (Trial)**.
* **Betaalde abonnementen**: Gebruikers met een actief Manager- of Professional-abonnement ontvangen onbeperkte dagelijkse AI-bewerkingen en zijn niet onderworpen aan kredietmetingen, verloop of controles op aftrekprioriteit.

---

## 3. Gelokaliseerde betalingen & Facturering (Atzmai Gateway)

Voor accounts in Israël integreert DressApp met de **Atzmai-betalingsgateway** om lokale transacties in ILS (Shekel) te verwerken:
1. **Verwerking uitsluitend in ILS**: De Atzmai gateway verwerkt lokale betalingen uitsluitend in ILS.
2. **Valutaomrekening**: In USD uitgedrukte abonnementen en campagnekosten worden vóór het genereren van de link dynamisch omgerekend naar ILS via een live wisselkoers-API (terugvallend op een statische koers van 3,70 als deze onbereikbaar is).
3. **Webhook-verificatie & Campagnefacturering**:
   - Algemene transactietrackings via `atzmai_topups` is verstreken.
   - `atzmai_topups` blijft echter actief voor het vastleggen en verifiëren van **dagelijkse campagnebetalingen (tarief van $1/dag)**.
   - Bij een succesvolle transactie wordt de `last_daily_payment_date` van de campagne bijgewerkt naar de huidige datum.
4. **Geautomatiseerde PDF-boekhouding**: Na succesvolle vastlegging vraagt de backend de Atzmai-facturerings-API om officiële PDF-ontvangstbewijzen en facturen te genereren en te downloaden. Deze worden als e-mailbijlage rechtstreeks naar de koper verzonden.

---

## 4. Technische stack & diepgaande analyse van mogelijkheden

### Gegevensschemadefinities (Data Schema Definitions)

Het MongoDB-schema in [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) houdt de abonnementsgegevens en kledingkastcapaciteit van gebruikers bij:

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

### Handhaving van kledingkastlimiet ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
Tijdens het uploaden van items bewaakt het systeem de databaselimieten met een harde limiet van 200 items voor verwijzingen:
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

### Valutaomrekeningslogica ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Zet USD-bedragen dynamisch om naar ILS voordat payloads naar Atzmai worden verzonden:
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
