# Motore di monetizzazione e fatturazione di DressApp

Questo documento fornisce una panoramica architetturale completa, un manuale utente e un approfondimento tecnologico dei meccanismi di monetizzazione, fatturazione degli abbonamenti e cicli di crescita virale in DressApp.

---

## 1. Sintesi esecutiva e proposta di valore

### Panoramica di alto livello
DressApp implementa un modello ibrido di abbonamento SaaS e limitazione dell'utilizzo giornaliero (utility gating):
1. **Piani di abbonamento (SaaS)**: Piani a tariffa fissa (Free, Manager, Professional) che regolano la capacità dell'armadio, le quote giornaliere di styling IA e le funzionalità avanzate (ad es. creazione di campagne pubblicitarie).
2. **Limiti di quota giornaliera (Piano Free)**: Utilizzo limitato di IA sul piano Free, che limita gli utenti a 10 richieste giornaliere. La logica di detrazione e la scadenza dei pacchetti di 30 giorni si applicano *solo* agli account Free e di prova (Trial).
3. **Ciclo di crescita virale**: Un programma di referral che consente agli utenti del piano Free di espandere organicamente la capacità di base dell'armadio condividendo link di invito.
4. **Pagamenti localizzati (Gateway Atzmai)**: Supporto nativo per pagamenti israeliani (Bit, carte di credito locali) in ILS (Shekel). Poiché Atzmai supporta solo ILS, i prezzi in USD sono convertiti utilizzando un'API di tasso di cambio in tempo reale.

### Flusso architetturale

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

## 2. Piani di abbonamento e struttura dei prezzi

### Piani tariffari

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | $0.00 / mese | 50 articoli base | 10 crediti giornalieri gratuiti (scadono in 30 giorni) | Organizzazione di base, supporto community, espansioni referral (+10 slot per registrazione fino a un massimo di 200 articoli) |
| **Manager (Pro)** | $4.99 / mese | Illimitato | Operazioni giornaliere illimitate | Prova gratuita di 14 giorni, allocazione iniziale di 50 crediti, vendita e noleggio nel marketplace, Trend Scout, notifiche pianificate |
| **Professional** | $9.99 / mese | Illimitato | Operazioni giornaliere illimitate | Prova gratuita di 30 giorni, allocazione iniziale di 300 crediti, tutte le funzionalità Manager, supporto per la creazione di campagne pubblicitarie (tariffa di $1/giorno, max 3 campagne contemporaneamente) |

### Pacchetti di crediti IA prepagati (Obsoleto - Obsolete)
* I pacchetti di ricarica dei crediti prepagati **non sono più supportati**.
* Per evitare interruzioni del servizio, gli utenti del piano Free devono eseguire l'upgrade a un piano di abbonamento Manager o Professional.

### Scadenza dei crediti e priorità di consumo (Logica FIFO)
* **Regola**: La scadenza dei crediti (30 giorni) e la logica di priorità di consumo FIFO (primo entrato, primo uscito) si applicano **solo ai livelli di abbonamento Free e di prova (Trial)**.
* **Piani a pagamento**: Gli utenti con piani Manager o Professional attivi ricevono operazioni giornaliere di IA illimitate e non sono soggetti a misurazione dei crediti, scadenza o controlli di priorità di detrazione.

---

## 3. Pagamenti localizzati e fatturazione (Gateway Atzmai)

Per gli account con sede in Israele, DressApp si integra con il **gateway di pagamento Atzmai** per elaborare le transazioni locali in ILS (Shekel):
1. **Elaborazione solo in ILS**: Il gateway Atzmai elabora i pagamenti locali esclusivamente in ILS.
2. **Conversione di valuta**: Gli abbonamenti e le tariffe delle campagne denominati in USD vengono convertiti dinamicamente in ILS prima della generazione del link, utilizzando un'API dei tassi di cambio in tempo reale (ripiegando su un tasso statico di 3.70 se non raggiungibile).
3. **Verifica Webhook e fatturazione delle campagne**:
   - Il monitoraggio generale delle transazioni tramite `atzmai_topups` è obsoleto.
   - Tuttavia, `atzmai_topups` rimane attiva per acquisire e verificare i **pagamenti giornalieri delle campagne (tariffa di $1/giorno)**.
   - Una volta acquisito con successo, la data `last_daily_payment_date` della campagna viene aggiornata alla data corrente.
4. **Contabilità PDF automatizzata**: Una volta acquisito con successo, il backend interroga l'API di fatturazione Atzmai per generare e scaricare i PDF ufficiali di ricevute e fatture. Questi vengono inviati come allegati e-mail direttamente all'acquirente.

---

## 4. Stack tecnologico e approfondimento delle funzionalità

### Definizioni dello schema dei dati (Data Schema Definitions)

Lo schema MongoDB in [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) tiene traccia degli abbonamenti degli utenti e della capacità dell'armadio:

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

### Applicazione del limite dell'armadio ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
Durante il caricamento dell'articolo, il sistema protegge i limiti del database con un limite rigido di 200 articoli per le segnalazioni:
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

### Logica di conversione di valuta ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Converte gli importi USD in ILS in modo dinamico prima di inviare i payload ad Atzmai:
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
