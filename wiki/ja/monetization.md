# DressAppのマネタイズ＆請求エンジン

このドキュメントでは、DressAppにおけるマネタイズ、サブスクリプション請求、およびバイラル成長ループの仕組みについて、包括的なアーキテクチャの概要、ユーザーマニュアル、および技術的な深掘りを提供します。

---

## 1. エグゼクティブサマリー＆価値提案

### ハイレベル概要
DressAppは、定額制のSaaSサブスクリプションと日々の利用制限モデル（daily utility gating model）を組み合わせたハイブリッドモデルを採用しています：
1. **サブスクリプションプラン（SaaS）**：クローゼットの収納容量、1日のAIスタイリング制限、および高度な機能（例：広告キャンペーンの作成など）を制御する定額プラン（Free、Manager、Professional）。
2. **日々のクォータ制限（Freeプラン）**：Freeプランのユーザーは1日あたり10リクエストにAI利用が制限されます。消費ロジックと30日間のバケット有効期限は、Freeおよびトライアル（Trial）アカウントに*のみ*適用されます。
3. **バイラル成長ループ**：Freeプランのユーザーが、招待リンクを共有することでクローゼットの基本容量をオーガニックに拡張できる紹介プログラム。
4. **ローカライズされた決済（Atzmaiゲートウェイ）**：イスラエルのローカル決済（Bit、ローカルクレジットカード）のILS（シェケル）建てでのネイティブサポート。AtzmaiはILSのみをサポートしているため、USD価格はライブ為替レートAPIを使用して自動的に変換されます。

### アーキテクチャフロー

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

## 2. サブスクリプションプランと料金体系

### 料金プラン

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | 月額 $0.00 | 基本50アイテム | 毎日10無料クレジット（30日間有効） | 基本的な整理、コミュニティサポート、紹介による容量拡張（登録1件につき+10スロット、最大200アイテムまで） |
| **Manager (Pro)** | 月額 $4.99 | 無制限 | 1日あたりの操作無制限 | 14日間の無料トライアル、初期割り当て50クレジット、マーケットプレイスでの販売＆レンタル、Trend Scout、スケジュール通知 |
| **Professional** | 月額 $9.99 | 無制限 | 1日あたりの操作無制限 | 30日間の無料トライアル、初期割り当て300クレジット、Managerプランのすべての機能、広告キャンペーン作成のサポート（1日あたり $1 の手数料、同時に最大3キャンペーンまで） |

### プリペイドAIクレジットパック（廃止 - Obsolete）
* プリペイド式のクレジットチャージパッケージは**サポートされなくなりました**。
* サービスの停止を避けるため、FreeプランのユーザーはManagerまたはProfessionalサブスクリプションプランにアップグレードする必要があります。

### クレジットの有効期限と消費優先順位（FIFOロジック）
* **ルール**：クレジットの有効期限（30日間）およびFIFO（先入れ先出し）の消費優先順位ロジックは、**Freeおよびトライアル（Trial）サブスクリプションプランにのみ適用されます**。
* **有料プラン**：有効なManagerまたはProfessionalプランをご利用中のユーザーは、1日あたりのAI操作を無制限に行うことができ、クレジットメーター、有効期限、または消費優先順位チェックの対象外となります。

---

## 3. ローカライズされた決済＆請求（Atzmaiゲートウェイ）

イスラエルに拠点を置くアカウントの場合、DressAppは**Atzmai決済ゲートウェイ**と連携し、ローカルの取引をILS（シェケル）で処理します：
1. **ILS専用の処理**：Atzmaiゲートウェイは、ローカル決済をILSのみで処理します。
2. **通貨換算**：USD建てのサブスクリプションおよびキャンペーン料金は、リンク生成前にライブ為替レートAPIを使用して動的にILSに換算されます（APIにアクセスできない場合は、固定の 3.70 レートにフォールバックします）。
3. **Webhook検証＆キャンペーン請求**：
   - `atzmai_topups` による一般的な取引追跡は廃止されました。
   - ただし、`atzmai_topups` は**日々のキャンペーン決済（1日あたり $1 の手数料）**のキャプチャおよび検証用としてアクティブな状態を維持します。
   - キャプチャに成功すると、キャンペーンの `last_daily_payment_date` が現在の日付に更新されます。
4. **自動PDF記帳**：決済のキャプチャに成功すると、バックエンドはAtzmai請求APIに問い合わせて、公式の領収書および請求書PDFを生成・ダウンロードします。これらはメール添付ファイルとして購入者に直接送信されます。

---

## 4. 技術スタックと機能の深掘り

### データスキーマ定義（Data Schema Definitions）

[schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py)にあるMongoDBスキーマは、ユーザーのサブスクリプション情報とクローゼット容量を追跡します：

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

### クローゼット容量制限の適用 ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
アイテムのアップロード中、システムはデータベース制限を監視します（紹介枠による上限は200アイテムに制限されます）：
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

### 通貨換算ロジック ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Atzmaiにペイロードを送信する前に、USD金額を動的にILSに換算します：
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
