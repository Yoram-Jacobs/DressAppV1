# Motor de monetização e cobrança do DressApp

Este documento fornece uma visão geral arquitetônica abrangente, manual do usuário e análise tecnológica detalhada da monetização, cobrança de assinaturas e mecânicas do loop de crescimento viral no DressApp.

---

## 1. Resumo executivo e proposta de valor

### Visão geral de alto nível
O DressApp implementa um modelo híbrido de assinatura SaaS e um sistema de limitação de uso diário (utility gating):
1. **Planos de assinatura (SaaS)**: Tarifas planas (Free, Manager, Professional) que controlam a capacidade de armazenamento do guarda-roupa, cotas diárias de estilização por IA e funções avançadas (por exemplo, criação de campanhas publicitárias).
2. **Limites de cota diária (Plano Free)**: Uso limitado de IA no plano Free, que restringe os usuários a 10 solicitações diárias. A lógica de dedução e a expiração dos pacotes de 30 dias aplicam-se *apenas* a contas Free e de teste (Trial).
3. **Loop de crescimento viral**: Um programa de indicação que permite aos usuários do plano Free expandir sua capacidade básica de guarda-roupa de forma orgânica, compartilhando links de convite.
4. **Pagamentos localizados (Gateway Atzmai)**: Suporte nativo para pagamentos israelenses (Bit, cartões de crédito locais) em ILS (Shekels). Como o Atzmai suporta apenas ILS, os preços em USD são convertidos usando uma API de taxa de câmbio em tempo real.

### Fluxo de arquitetura

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

## 2. Planos de assinatura e topologia de preços

### Planos de preços

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | $0.00 / mês | Limite básico de 50 itens | 10 créditos gratuitos diários (expiram em 30 dias) | Organização básica, suporte comunitário, expansões de indicação (+10 slots por cadastro até um limite máximo de 200 itens) |
| **Manager (Pro)** | $4.99 / mês | Ilimitado | Operações diárias ilimitadas | Avaliação gratuita de 14 dias, alocação inicial de 50 créditos, venda e aluguel no marketplace, Trend Scout, notificações programadas |
| **Professional** | $9.99 / mês | Ilimitado | Operações diárias ilimitadas | Avaliação gratuita de 30 dias, alocação inicial de 300 créditos, todos os recursos do Manager, suporte para criar campanhas publicitárias (tarifa de $1/dia, máx. 3 campanhas simultâneas) |

### Pacotes de créditos de IA pré-pagos (Obsoleto - Obsolete)
* Os pacotes de recarga de créditos pré-pagos **não são mais suportados**.
* Para evitar interrupções no serviço, os usuários do plano Free devem atualizar para o plano de assinatura Manager ou Professional.

### Expiração de créditos e prioridade de consumo (Lógica FIFO)
* **Regra**: A expiração de créditos (30 dias) e a lógica de prioridade de consumo FIFO (primeiro a entrar, primeiro a sair) aplicam-se **apenas aos planos de assinatura Free e de teste (Trial)**.
* **Planos pagos**: Usuários com planos Manager ou Professional ativos recebem operações diárias de IA ilimitadas e não estão sujeitos à medição de créditos, expiração ou verificações de prioridade de dedução.

---

## 3. Pagamentos localizados e faturamento (Gateway Atzmai)

Para contas sediadas em Israel, o DressApp se integra ao **gateway de pagamentos Atzmai** para processar transações locais em ILS (Shekels):
1. **Processamento exclusivo em ILS**: O gateway Atzmai processa pagamentos locais exclusivamente em ILS.
2. **Conversão de moeda**: Assinaturas e tarifas de campanhas denominadas em USD são convertidas dinamicamente para ILS antes de gerar o link, usando uma API de taxa de câmbio em tempo real (utilizando uma taxa estática de 3.70 caso esteja indisponível).
3. **Verificação de Webhook e faturamento de campanhas**:
   - O rastreamento geral de transações através de `atzmai_topups` é obsoleto.
   - No entanto, `atzmai_topups` permanece ativo para capturar e verificar os **pagamentos de campanhas diários (tarifa de $1/dia)**.
   - Após a captura bem-sucedida, a data `last_daily_payment_date` da campanha é atualizada para a data atual.
4. **Contabilidade em PDF automatizada**: Após a captura bem-sucedida, o backend consulta a API de faturamento do Atzmai para gerar e baixar PDFs oficiais de recibos e faturas. Eles são enviados como anexos de e-mail diretamente ao comprador.

---

## 4. Stack de tecnologia e análise profunda de recursos

### Definições de esquema de dados (Data Schema Definitions)

O esquema do MongoDB em [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) rastreia as assinaturas dos usuários e a capacidade do guarda-roupa:

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

### Execução de limites de guarda-roupa ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
Durante o envio de peças, o sistema protege os limites do banco de dados com uma capacidade máxima rígida de 200 itens para indicações:
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

### Lógica de conversão de moeda ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Converte valores de USD em ILS de forma dinâmica antes de enviar dados ao Atzmai:
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
