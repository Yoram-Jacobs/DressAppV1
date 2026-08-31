# Moteur de monétisation et de facturation de DressApp

Ce document fournit un aperçu architectural complet, un manuel de l'utilisateur et une analyse technique approfondie des mécanismes de monétisation, de facturation des abonnements et de boucle de croissance virale dans DressApp.

---

## 1. Résumé analytique et proposition de valeur

### Aperçu général
DressApp met en œuvre un modèle hybride d'abonnement SaaS et de limitation de l'utilisation quotidienne (utility gating) :
1. **Niveaux d'abonnement (SaaS)** : Plans à tarif forfaitaire (Free, Manager, Professional) qui régissent la capacité de stockage de la garde-robe, les quotas quotidiens de stylisme IA et les fonctionnalités avancées (par exemple, la création de campagnes publicitaires).
2. **Limites de quotas quotidiens (Niveau Free)** : Utilisation limitée de l'IA sur le plan Free, qui restreint les utilisateurs à 10 requêtes quotidiennes. La logique de déduction et l'expiration des portefeuilles de 30 jours s'appliquent *uniquement* aux comptes Free et d'essai (Trial).
3. **Boucle de croissance virale** : Un programme de parrainage permettant aux utilisateurs du niveau Free d'augmenter organiquement leur capacité de stockage de base en partageant des liens d'invitation.
4. **Paiements localisés (Passerelle Atzmai)** : Prise en charge native des paiements israéliens (Bit, cartes de crédit locales) en ILS (Shekels). Étant donné qu'Atzmai ne prend en charge que l'ILS, les prix en USD sont convertis à l'aide d'une API de taux de change en direct.

### Flux architectural

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

## 2. Niveaux d'abonnement et topologie des tarifs

### Tarifs des abonnements

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | 0,00 $ / mois | Base de 50 éléments | 10 crédits quotidiens gratuits (expirent sous 30 jours) | Organisation de base, assistance communautaire, extensions de parrainage (+10 emplacements par inscription jusqu'à un maximum de 200 éléments) |
| **Manager (Pro)** | 4,99 $ / mois | Illimitée | Opérations quotidiennes illimitées | Essai gratuit de 14 jours, allocation initiale de 50 crédits, vente et location sur la place de marché, Trend Scout, notifications planifiées |
| **Professional** | 9,99 $ / mois | Illimitée | Opérations quotidiennes illimitées | Essai gratuit de 30 jours, allocation initiale de 300 crédits, toutes les fonctionnalités Manager, création de campagnes publicitaires (frais de 1 $/jour, max 3 campagnes simultanées) |

### Packages de crédits d'IA prépayés (Obsolète - Obsolete)
* Les packages de recharge de crédits prépayés **ne sont plus pris en charge**.
* Pour éviter toute interruption de service, les utilisateurs du plan Free doivent passer à un plan d'abonnement Manager ou Professional.

### Expiration des crédits et priorité de consommation (Logique FIFO)
* **Règle** : L'expiration des crédits (30 jours) et la logique de priorité de consommation FIFO (premier entré, premier sorti) s'appliquent **uniquement aux niveaux d'abonnement Free et d'essai (Trial)**.
* **Plans payants** : Les utilisateurs disposant de plans Manager ou Professional actifs bénéficient d'opérations IA quotidiennes illimitées et ne sont pas soumis au comptage des crédits, à leur expiration ou aux vérifications de priorité de déduction.

---

## 3. Paiements localisés et facturation (Passerelle Atzmai)

Pour les comptes basés en Israël, DressApp s'intègre à la **passerelle de paiement Atzmai** pour traiter les transactions locales en ILS (Shekels) :
1. **Traitement en ILS uniquement** : La passerelle Atzmai traite les paiements locaux exclusivement en ILS.
2. **Conversion de devise** : Les abonnements et les frais de campagne libellés en USD sont convertis dynamiquement en ILS avant la génération du lien, à l'aide d'une API de taux de change en direct (avec un repli sur un taux statique de 3,70 si celle-ci n'est pas disponible).
3. **Vérification par Webhook et facturation des campagnes** :
   - Le suivi général de transactions via `atzmai_topups` est obsolète.
   - Cependant, `atzmai_topups` reste active pour capturer et vérifier les **paiements de campagnes quotidiens (frais de 1 $/jour)**.
   - Une fois la transaction capturée avec succès, la date `last_daily_payment_date` de la campagne est mise à jour avec la date du jour.
4. **Comptabilité PDF automatisée** : Une fois la transaction capturée avec succès, le backend interroge l'API de facturation Atzmai pour générer et télécharger les reçus et factures officiels au format PDF. Ceux-ci sont envoyés sous forme de pièces jointes par e-mail directement à l'acheteur.

---

## 4. Pile technique et analyse approfondie des capacités

### Définitions de schémas de données (Data Schema Definitions)

Le schéma MongoDB dans [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) suit les abonnements des utilisateurs et la capacité de stockage :

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

### Application des limites de garde-robe ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
Pendant le téléchargement d'un vêtement, le système protège les limites de la base de données avec une limite stricte de 200 éléments pour les parrainages :
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

### Logique de conversion de devise ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Reconvertit dynamiquement les montants USD en ILS avant d'envoyer les payloads à Atzmai :
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
