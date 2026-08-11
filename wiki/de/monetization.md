# DressApp Monetarisierungs- & Abrechnungs-Engine

Dieses Dokument bietet einen umfassenden architektonischen Überblick, ein Benutzerhandbuch und einen tiefen technologischen Einblick in die Monetarisierung, die Abonnementabrechnung und die Mechanismen von viralen Wachstumsschleifen in DressApp.

---

## 1. Zusammenfassung & Wertversprechen

### High-Level-Übersicht
DressApp implementiert ein hybrides Modell aus SaaS-Abonnements und täglicher Nutzungsbegrenzung (utility gating):
1. **Abonnementstufen (SaaS)**: Flatrate-Pläne (Free, Manager, Professional), die die Speicherkapazität der Garderobe, die täglichen KI-Styling-Limits und erweiterte Funktionen (z. B. Erstellung von Werbekampagnen) regeln.
2. **Tägliche Quotenbegrenzungen (Free-Tarif)**: Begrenzte KI-Nutzung im Free-Tarif, die Nutzer auf 10 tägliche Anfragen beschränkt. Die Abbuchungslogik und der 30-tägige Ablauf von Guthaben-Buckets gelten *nur* für Free- und Testkonten.
3. **Virale Wachstumsschleife**: Ein Empfehlungsprogramm, das es Nutzern des Free-Tarifs ermöglicht, ihre grundlegende Garderobenkapazität organisch durch das Teilen von Einladungslinks zu erweitern.
4. **Lokalisierte Zahlungen (Atzmai-Gateway)**: Native Unterstützung für israelische Zahlungen (Bit, lokale Kreditkarten) in ILS (Schekel). Da Atzmai nur ILS unterstützt, werden USD-Preise mithilfe einer Live-Wechselkurs-API umgerechnet.

### Architektonischer Ablauf

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

## 2. Abonnementstufen & Preisstruktur

### Tarife

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | 0,00 $ / Monat | Basis von 50 Artikeln | 10 kostenlose tägliche Credits (Ablauf nach 30 Tagen) | Grundlegende Organisation, Community-Support, Empfehlungserweiterungen (+10 Slots pro Registrierung bis maximal 200 Artikel) |
| **Manager (Pro)** | 4,99 $ / Monat | Unbegrenzt | Unbegrenzte tägliche Operationen | 14-tägige kostenlose Testphase, 50-Credit-Erstzuteilung, Verkauf & Vermietung auf dem Marktplatz, Trend Scout, geplante Benachrichtigungen |
| **Professional** | 9,99 $ / Monat | Unbegrenzt | Unbegrenzte tägliche Operationen | 30-tägige kostenlose Testphase, 300-Credit-Erstzuteilung, alle Manager-Funktionen, Erstellung von Werbekampagnen (Gebühr von 1 $/Tag, max. 3 Kampagnen gleichzeitig) |

### Vorausbezahlte KI-Guthabenpakete (Veraltet - Obsolete)
* Vorausbezahlte Guthabenaufladepakete werden **nicht mehr unterstützt**.
* Um Dienstunterbrechungen zu vermeiden, müssen Benutzer des Free-Tarifs auf das Manager- oder Professional-Abonnement upgraden.

### Guthabenablauf & Verbrauchspriorität (FIFO-Logik)
* **Regel**: Der Guthabenablauf (30 Tage) und die FIFO-Verbrauchsprioritätslogik (First-In-First-Out) gelten **nur für die Free- und Test-Abonnementstufen**.
* **Bezahlte Tarife**: Benutzer mit aktiven Manager- oder Professional-Plänen erhalten unbegrenzte tägliche KI-Operationen und unterliegen keiner Guthabenmessung, keinem Ablauf und keinen Prioritätsprüfungen für den Abbuchungsverlauf.

---

## 3. Lokalisierte Zahlungen & Rechnungsstellung (Atzmai-Gateway)

Für Konten mit Sitz in Israel ist DressApp in das **Atzmai-Zahlungs-Gateway** integriert, um lokale Transaktionen in ILS (Schekel) abzuwickeln:
1. **Verarbeitung nur in ILS**: Das Atzmai-Gateway verarbeitet lokale Zahlungen ausschließlich in ILS.
2. **Währungsumrechnung**: Auf USD lautende Abonnements und Kampagnengebühren werden vor der Linkgenerierung dynamisch in ILS umgerechnet, wobei eine Live-Wechselkurs-API verwendet wird (mit Rückfall auf einen statischen Kurs von 3,70, falls nicht erreichbar).
3. **Webhook-Verifizierung & Kampagnenabrechnung**:
   - Die allgemeine Transaktionsverfolgung über `atzmai_topups` ist veraltet.
   - `atzmai_topups` bleibt jedoch aktiv, um **tägliche Kampagnenzahlungen (Gebühr von 1 $/Tag)** zu erfassen und zu verifizieren.
   - Nach erfolgreicher Erfassung wird das Datum `last_daily_payment_date` der Kampagne auf das aktuelle Datum aktualisiert.
4. **Automatisierte PDF-Buchhaltung**: Nach erfolgreicher Erfassung fragt das Backend die Atzmai-Abrechnungs-API ab, um offizielle Quittungs- und Rechnungs-PDFs zu generieren und herunterzuladen. Diese werden als E-Mail-Anhänge direkt an den Käufer gesendet.

---

## 4. Technischer Stack & tiefer Einblick in die Funktionen

### Datenschemadefinitionen (Data Schema Definitions)

Die MongoDB-Struktur in [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) erfasst Abonnements und Speicherkapazitäten der Benutzer:

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

### Kapazitätskontrolle ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
Während des Uploads eines Kleidungsstücks sichert das System die Datenbankgrenzen mit einer Obergrenze von 200 Artikeln für Empfehlungen:
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

### Währungsumrechnungslogik ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Rechnet USD-Beträge vor dem Senden von Payloads an Atzmai dynamisch in ILS um:
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
