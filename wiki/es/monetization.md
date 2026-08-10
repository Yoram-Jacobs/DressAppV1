# Motor de monetización y facturación de DressApp

Este documento proporciona una visión general integral de la arquitectura, el manual del usuario y el análisis tecnológico detallado de la monetización, la facturación de suscripciones y la mecánica del ciclo de crecimiento viral en DressApp.

---

## 1. Resumen ejecutivo y propuesta de valor

### Perspectiva general de alto nivel
DressApp implementa un modelo híbrido de suscripción SaaS y un sistema de limitación de uso diario (utility gating):
1. **Planes de suscripción (SaaS)**: Tarifas planas (Free, Manager, Professional) que controlan la capacidad de almacenamiento del armario, las cuotas diarias de estilismo con IA y las funciones avanzadas (p. ej., creación de campañas publicitarias).
2. **Límites de cuota diaria (Plan Free)**: Uso limitado de IA en el plan Free, que restringe a los usuarios a 10 solicitudes diarias. La lógica de deducción y el vencimiento de los paquetes de 30 días se aplican *únicamente* a las cuentas Free y de prueba (Trial).
3. **Ciclo de crecimiento viral**: Un programa de recomendación que permite a los usuarios del plan Free expandir su capacidad básica de armario de forma orgánica compartiendo enlaces de invitación.
4. **Pagos localizados (Pasarela Atzmai)**: Soporte nativo para pagos israelíes (Bit, tarjetas de crédito locales) en ILS (shékels). Dado que Atzmai solo admite ILS, los precios en USD se convierten utilizando una API de tipo de cambio en vivo.

### Flujo de arquitectura

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

## 2. Planes de suscripción y topología de precios

### Planes de precios

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | $0.00 / mes | 50 elementos base | 10 créditos diarios gratuitos (expiran en 30 días) | Organización básica, soporte de la comunidad, expansiones por recomendaciones (+10 espacios por registro hasta un máximo de 200 elementos) |
| **Manager (Pro)** | $4.99 / mes | Ilimitado | Operaciones diarias ilimitadas | Prueba gratuita de 14 días, asignación inicial de 50 créditos, venta y alquiler en el mercado, Trend Scout, notificaciones programadas |
| **Professional** | $9.99 / mes | Ilimitado | Operaciones diarias ilimitadas | Prueba gratuita de 30 días, asignación inicial de 300 créditos, todas las funciones de Manager, soporte para crear campañas publicitarias (tarifa de $1/día, máx. 3 campañas simultáneas) |

### Paquetes de créditos prepagados de IA (Obsoleto - Obsolete)
* Los paquetes de recarga de créditos prepagados **ya no son compatibles**.
* Para evitar interrupciones en el servicio, los usuarios del plan Free deben actualizar a un plan de suscripción Manager o Professional.

### Vencimiento de créditos y prioridad de consumo (Lógica FIFO)
* **Regla**: El vencimiento de los créditos (30 días) y la lógica de prioridad de consumo FIFO (primero en entrar, primero en salir) se aplican **únicamente a los planes de suscripción Free y de prueba (Trial)**.
* **Planes de pago**: Los usuarios con planes Manager o Professional activos reciben operaciones diarias de IA ilimitadas y no están sujetos a la medición de créditos, su vencimiento o comprobaciones de prioridad de deducción.

---

## 3. Pagos localizados y facturación (Pasarela Atzmai)

Para las cuentas con sede en Israel, DressApp se integra con la **pasarela de pagos Atzmai** para procesar transacciones locales en ILS (shékels):
1. **Procesamiento exclusivo en ILS**: La pasarela Atzmai procesa los pagos locales exclusivamente en ILS.
2. **Conversión de moneda**: Las suscripciones y las tarifas de campañas denominadas en USD se convierten dinámicamente a ILS antes de generar el enlace, utilizando una API de tipo de cambio en vivo (volviendo a una tarifa estática de 3.70 si no está disponible).
3. **Verificación por Webhook y facturación de campañas**:
   - El seguimiento general de transacciones a través de `atzmai_topups` es obsoleto.
   - Sin embargo, `atzmai_topups` sigue activa para capturar y verificar los **pagos de campañas diarios (tarifa de $1/día)**.
   - Tras una captura exitosa, la fecha `last_daily_payment_date` de la campaña se actualiza a la fecha actual.
4. **Contabilidad automatizada en PDF**: Tras una captura exitosa, el backend consulta la API de facturación de Atzmai para generar y descargar los archivos PDF de facturas y recibos oficiales. Estos se envían como archivos adjuntos por correo electrónico directamente al comprador.

---

## 4. Pila tecnológica y análisis profundo de capacidades

### Definiciones de esquemas de datos (Data Schema Definitions)

El esquema de MongoDB en [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) realiza un seguimiento de las suscripciones de los usuarios y la capacidad del armario:

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

### Aplicación de límites del armario ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
Durante la carga de prendas, el sistema protege los límites de la base de datos con un límite estricto de 200 elementos para recomendaciones:
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

### Lógica de conversión de moneda ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Convierte montos de USD a ILS dinámicamente antes de enviar payloads a Atzmai:
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
