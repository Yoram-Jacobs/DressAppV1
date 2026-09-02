# Механизм монетизации и выставления счетов DressApp

Этот документ представляет собой всесторонний архитектурный обзор, руководство пользователя и глубокий технический анализ механизмов монетизации, биллинга подписок и вирусных циклов роста в DressApp.

---

## 1. Резюме и ценностное предложение

### Общее описание
DressApp использует гибридную модель SaaS-подписок и ежедневного ограничения использования (utility gating):
1. **Тарифные планы подписки (SaaS)**: Тарифы с фиксированной оплатой (Free, Manager, Professional), которые определяют емкость хранения гардероба, ежедневные лимиты на стилизацию ИИ и доступ к расширенным функциям (например, создание рекламных кампаний).
2. **Лимиты ежедневной квоты (Бесплатный тариф Free)**: Ограниченное использование ИИ на бесплатном тарифе Free, при котором пользователи могут совершать не более 10 запросов в день. Логика списания и 30-дневный срок действия баланса ИИ применяются *только* к учетным записям Free и Trial (пробный период).
3. **Вирусный цикл роста**: Реферальная программа, позволяющая пользователям бесплатного тарифа Free органически расширять базовую емкость своего гардероба, делясь ссылками-приглашениями.
4. **Локальные платежи (Шлюз Atzmai)**: Встроенная поддержка платежей в Израиле (Bit, местные кредитные карты) в ILS (шекелях). Поскольку Atzmai поддерживает только ILS, цены в USD конвертируются с использованием API актуального обменного курса в режиме реального времени.

### Архитектурный поток

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

## 2. Тарифные планы подписки и структура цен

### Тарифы

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | 0,00 $ / месяц | Базовый лимит: 50 вещей | 10 бесплатных ежедневных кредитов (срок действия 30 дней) | Базовая организация, поддержка сообщества, реферальное расширение (+10 слотов за каждую регистрацию, максимум до 200 вещей) |
| **Manager (Pro)** | 4,99 $ / месяц | Безлимитно | Безлимитные ежедневные операции | 14-дневный бесплатный пробный период, начальный пакет из 50 кредитов, продажа и аренда на маркетплейсе, Trend Scout, запланированные уведомления |
| **Professional** | 9,99 $ / месяц | Безлимитно | Безлимитные ежедневные операции | 30-дневный бесплатный пробный период, начальный пакет из 300 кредитов, все функции тарифа Manager, поддержка создания рекламных кампаний (плата 1 $/день, макс. 3 кампании одновременно) |

### Предоплаченные пакеты кредитов ИИ (Устарело - Obsolete)
* Предоплаченные пакеты пополнения баланса ИИ **больше не поддерживаются**.
* Чтобы избежать перерывов в обслуживании, пользователям бесплатного тарифа Free необходимо перейти на тарифный план Manager или Professional.

### Истечение срока действия кредитов и приоритет списания (Логика FIFO)
* **Правило**: Истечение срока действия кредитов (30 дней) и логика приоритета списания FIFO (первым пришел — первым ушел) применяются **только к тарифным планам Free и Trial (пробный период)**.
* **Платные тарифы**: Пользователи с активной подпиской Manager или Professional получают неограниченное количество ежедневных операций ИИ и не подлежат учету кредитов, истечению их срока действия или проверкам приоритета списания.

---

## 3. Локальные платежи и выставление счетов (Шлюз Atzmai)

Для учетных записей, зарегистрированных в Израиле, DressApp интегрируется с **платежным шлюзом Atzmai** для обработки местных транзакций в ILS (шекелях):
1. **Обработка только в ILS**: Шлюз Atzmai обрабатывает местные платежи исключительно в ILS.
2. **Конвертация валюты**: Стоимость подписок и рекламных кампаний в USD динамически конвертируется в ILS перед созданием ссылки с использованием API актуального обменного курса (с возвратом к фиксированному курсу 3,70, если API недоступен).
3. **Webhook-верификация и биллинг кампаний**:
   - Общее отслеживание транзакций через `atzmai_topups` устарело.
   - Тем не менее, `atzmai_topups` остается активным для фиксации и проверки **ежедневных платежей за кампании (плата 1 $/день)**.
   - При успешном списании средств дата `last_daily_payment_date` кампании обновляется на текущую дату.
4. **Автоматический документооборот в PDF**: После успешного подтверждения транзакции бэкенд запрашивает биллинговый API Atzmai для генерации и скачивания официальных PDF-файлов квитанций и счетов-фактур. Они отправляются покупателю напрямую в виде вложений к электронному письму.

---

## 4. Технологический стек и детальный разбор кода

### Определение схем данных (Data Schema Definitions)

Схема MongoDB в [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) отслеживает подписки пользователей и емкость гардероба:

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

### Контроль ограничений емкости гардероба ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
При загрузке вещей система контролирует соблюдение лимитов базы данных с жестким ограничением в 200 вещей для рефералов:
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

### Логика конвертации валюты ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Динамически конвертирует суммы в USD в ILS перед отправкой запроса платежному шлюзу Atzmai:
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
