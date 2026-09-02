# DressApp 商业化与账单引擎

本文档对 DressApp 中的商业化变现、订阅账单和病毒式增长循环机制提供了全面的架构概述、用户手册和技术深度剖析。

---

## 1. 执行摘要与价值主张

### 高层概述
DressApp 实现了混合 SaaS 订阅和每日使用额度限制模型（daily utility gating model）：
1. **订阅方案（SaaS）**：固定费率方案（Free、Manager、Professional）用以管理衣橱存储容量、每日 AI 穿搭额度以及高级功能（例如广告活动创建）。
2. **每日配额限制（免费层 - Free Tier）**：Free 方案中限制 AI 的使用，限制用户每日只能进行 10 次请求。扣减逻辑和 30 天信用度桶过期规则*仅*适用于 Free 和试用（Trial）账户。
3. **病毒式增长循环**：一个推荐计划，允许 Free 方案用户通过分享邀请链接来有机扩展其基础衣橱容量。
4. **本地化支付（Atzmai 网关）**：原生支持以 ILS（谢克尔）进行以色列本地支付（Bit、本地信用卡）。由于 Atzmai 仅支持 ILS，USD 价格使用实时汇率 API 进行换算。

### 架构流程

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

## 2. 订阅方案与定价拓扑

### 定价方案

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | 每月 $0.00 | 基础 50 件物品 | 每日 10 免费信用度（30 天内有效） | 基础整理、社区支持、推荐扩展（每次注册 +10 插槽，最高 200 件物品） |
| **Manager (Pro)** | 每月 $4.99 | 无上限 | 每日操作无上限 | 14 天免费试用、50 信用度初始分配、市场出售与出租、Trend Scout、定时通知 |
| **Professional** | 每月 $9.99 | 无上限 | 每日操作无上限 | 30 天免费试用、300 信用度初始分配、所有 Manager 功能、支持创建广告活动（每天 $1 费用，最多同时进行 3 个广告活动） |

### 预付费 AI 信用度包（废弃 - Obsolete）
* 预付费信用度充值包**不再受支持**。
* 为了避免服务中断，Free 方案用户必须升级到 Manager 或 Professional 订阅方案。

### 信用度到期与消耗优先级（FIFO 逻辑）
* **规则**：信用度到期（30 天）和 FIFO（先进先出）消耗优先级逻辑**仅适用于 Free 和试用（Trial）订阅层级**。
* **付费方案**：处于活跃状态的 Manager 或 Professional 方案用户拥有无限制的每日 AI 操作额度，不受信用度计量、到期或扣除优先级检查的限制。

---

## 3. 本地化支付与开票（Atzmai 网关）

对于总部位于以色列的账户，DressApp 与 **Atzmai 支付网关**集成，以处理 ILS（谢克尔）的本地交易：
1. **仅 ILS 处理**：Atzmai 网关仅处理 ILS 的本地支付。
2. **货币兑换**：以 USD 计价的订阅和广告活动费用在生成链接之前使用实时汇率 API 动态转换为 ILS（如果 API 无法访问，则退回到静态的 3.70 汇率）。
3. **Webhook 验证与广告活动账单**：
   - 通过 `atzmai_topups` 进行的一般交易跟踪已被废弃。
   - 但是，`atzmai_topups` 仍保持活跃，以用于捕获和验证**每日广告活动支付（每天 $1 费用）**。
   - 成功捕获后，广告活动的 `last_daily_payment_date` 将更新为当前日期。
4. **自动化 PDF 记账**：成功捕获后，后端将查询 Atzmai 计费 API 以生成并下载官方收据和发票 PDF。这些将作为电子邮件附件直接发送给买家。

---

## 4. 技术栈与功能深度剖析

### 数据架构定义 (Data Schema Definitions)

在 [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) 中的 MongoDB 架构跟踪用户订阅与衣橱容量限制：

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

### 衣橱容量限制强制执行 ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
在物品上传期间，系统会保护数据库限制，推荐奖励的硬性上限为 200 件物品：
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

### 货币兑换逻辑 ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
在向 Atzmai 发送载荷前，动态将 USD 金额转换为 ILS：
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
