# DressApp-engine voor het genereren van inkomsten en facturering

Dit document biedt een uitgebreid architectonisch overzicht, een gebruikershandleiding en een diepgaande technologische analyse van het genereren van inkomsten, abonnementsfacturering en groeicyclusmechanismen in DressApp.

---

## 1. Samenvatting en waardevoorstel

### Overzicht op hoog niveau
DressApp implementeert een hybride freemium- en growth-loop-model voor het genereren van inkomsten. Gebruikers op het gratis niveau krijgen een basiskastcapaciteit van **150 kledingstukken** toegewezen. Wanneer de limieten zijn bereikt, laat het platform nieuwe kledinguploads achter een **402 Betaling vereist**-wachter, die twee verschillende paden naar uitbreiding biedt:
1. **Pro-abonnement (betaald)**: een premium-abonnement (maandelijks voor $ 4,99 of jaarlijks voor $ 29,99) mogelijk gemaakt door een native **PayPal Subscriptions REST API**-integratie.
2. **Virale groeilus (gratis)**: een verwijzingsprogramma waarbij het uitnodigen van vrienden de verwijzer **+10 capaciteitsslots** per geregistreerde aanmelding verleent, waardoor hun basiskast voor onbepaalde tijd wordt uitgebreid.

### Architecturale stroom

```Zeemeermin
grafiek TD
    Gebruiker([Gebruikersapp-client])
    Gateway[Betalings-API-gateway /paypal]
    Auth[Auth-router /auth/registreren]
    Kast[Kastrouter /kast/item]
    DB[(MongoDB-atlas)]
    PayPalAPI[PayPal-abonnementen-API]

%% Closet Uploadlimiet Gating
    Gebruiker -->|1. Kledingstuk uploaden| Kast
    Kast -->|2. Controleer het aantal artikelen en het abonnement| DB
    DB -->|3. Retourtelling + abonnementsinformatie| Kast
    Kast -.->|Indien overschreden en sub-inactief: HTTP 402| Gebruiker
    
    %% betaald abonnement afrekenen
    Gebruiker -->|4. Post /paypal/abonneren| Poort
    Toegangspoort -->|5. Intentie creëren| PayPalAPI
    PayPalAPI -->|6. Retourneer URL goedkeuren| Poort
    Toegangspoort -->|7. Retourneer URL goedkeuren| Gebruiker
    Gebruiker -->|8. Gebruiker keurt betaling goed| PayPalAPI
    Gebruiker -->|9. Plaats /paypal/subscribe/capture| Poort
    Toegangspoort -->|10. Activering verifiëren| PayPalAPI
    Toegangspoort -->|11. Schrijf actieve sub| DB
    
    %% Virale verwijzingsmechanismen
    Gebruiker -->|12. Registreer met referrer_id| Aut
    Verificatie -->|13. Verhoog closet_capacity_bonus| DB
```

### Waardepropositie voor gebruikers
* **Wrijvingsloos upgradepad**: Premiumfuncties (onbeperkte kastruimte en prioriteit GPU-achtergrondmatten) kunnen onmiddellijk worden ontgrendeld.
* **Organische limietuitbreiding**: gebruikers die niet willen betalen, kunnen hun limieten verhogen door simpelweg een link te delen, waardoor het kernhulpprogramma toegankelijk blijft voor voorstanders van virussen.
* **PayPal Mock-Testmodus**: ontwikkelaars en testtesters kunnen het end-to-end betaalproces evalueren zonder echte creditcards of actieve factureringsplannen voor verkopers.

---

## 2. Uitgebreide gebruikershandleiding

### Visuele interfacetopologie
De gebruikersprofielpagina ([Profile.jsx](file:///C:/DressApp_AG/frontend/src/pages/Profile.jsx)) host de widget Abonnementsbeheer onder de sectie **Abonnementen en limieten**:

```
+-----------------------------------------------------------+
|  [Kroon] ABONNEMENT & LIMIETEN v|
+-----------------------------------------------------------+
|  Gratis abonnement: 85 / 150 gebruikte items |
|                                                                   |
|  Kastcapaciteit 85 / 150 stuks |
|  [=======================>................................................] |
|                                                                   |
|  +--------------------------+ +--------------------------+ |
|  | Maandabonnement |   | Jaarabonnement [BESTE WAARDE] |  |
|  | Flexibele factureringscyclus.    |   | Bespaar 50% ten opzichte van het maandtarief.  |  |
|  |                            |   |                            |  |
|  | $ 4,99 / maand |   | $ 29,99 / jaar |  |
|  |                            |   |                            |  |
|  | [ Maandelijks upgraden ] |   | [ Jaarlijkse upgrade ] |  |
|  +--------------------------+ +--------------------------+ |
|                                                                   |
|  Verwijs vrienden (ontvang +10 slots per aanmelding): |
|  [Kopieer uitnodigingslink] |
+-----------------------------------------------------------+
```

### Modus- en workflow-walkthroughs

#### A. Upgraden naar DressApp Pro (betaalde stroom)
1. **Upgrade starten**: de gebruiker selecteert zijn abonnement (maandelijks of jaarlijks) en klikt op **Upgraden**.
2. **Bestellingsregistratie**: De klant geeft een 'POST /paypal/subscribe'-verzoek uit. De backend neemt contact op met PayPal, genereert een abonnements-ID en retourneert een `approve_url`.
3. **Betalingsverwerking**: de clientbrowser wordt omgeleid naar de betaalpagina van PayPal Sandbox (of wordt lokaal onderschept in de nepmodus). De gebruiker logt in en keurt de factureringsovereenkomst goed.
4. **Omleiding en vastleggen**: PayPal leidt de browser terug naar `/me?sub_status=success&token=SUBSCRIPTION_ID`.
5. **Activering**: De client detecteert de zoekparameters, geeft `POST /paypal/subscribe/capture/{subscription_id}` uit en vernieuwt de gebruikerssessie. De limietindicator verdwijnt en geeft **Active Premium** weer.

#### B. Activering van de verwijzingslus (Free Flow)
1. **Uitnodiging delen**: de gebruiker klikt op **Uitnodigingslink kopiëren**, waardoor zijn database-ID wordt toegevoegd aan de URL: `https://dressapp.co/register?ref=USER_ID`.
2. **Tracking en verwijzingsstaging**: wanneer de doorverwezen vriend de registratie-URL bezoekt, slaat de router aan de clientzijde het `ref`-token op in `sessionStorage` onder de sleutel `referrer_id`.
3. **Registratiebrug**: bij het indienen van het registratieformulier bevat de payload de geënsceneerde `referrer_id`.
4. **Beloning**: De backend registreert het nieuwe account, vindt de verwijzer en verhoogt atomair hun `closet_capacity_bonus` met `10`.

---

## 3. Technologiestapel en mogelijkheden Deep-Dive

### Definities van gegevensschema's
Het MongoDB-schema in [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) bevat de factureringsstatus van de gebruiker:

```python
klasse SubscriptionInfo(BaseModel):
    is_actief: bool = Onwaar
    plan_type: Letterlijk["gratis", "maandelijks", "jaarlijks"] = "gratis"
    stripe_subscription_id: str | Geen = Geen # Oudere ondersteuning
    paypal_subscription_id: str | Geen = Geen
    verloopt_at: str | Geen = Geen # ISO-tijdstempel
    geannuleerd_at: str | Geen = Geen # ISO-tijdstempel

klasse Gebruiker (BaseDoc):
    # ...andere profieldocumenten ...
    abonnement: SubscriptionInfo = Field(default_factory=SubscriptionInfo)
    closet_capacity_bonus: int = 0 # Verdiend via verwijzingen
```

### API-routing- en gatewaycontracten

#### Gated eindpunten ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
Tijdens het invoegen van artikelen verifieert het systeem de limieten met behulp van:
```python
capaciteit = 150 + user.get("closet_capacity_bonus", 0)
item_count = wacht op db.closet_items.count_documents({"owner_id": user_id, "status": {"$ne": "verwijderd"}})

if item_count >= capaciteit en niet user.get("abonnement", {}).get("is_actief", False):
    raise HTTPException(status_code=402, detail="Capaciteitslimiet kast overschreden. Upgrade vereist.")
```

#### Factureringsacties ([betalingen.py](file:///C:/DressApp_AG/backend/app/api/v1/betalingen.py))
* `POST /paypal/subscribe`: Leest planconfiguraties op basis van de payload van de aanvraag en vraagt een token voor een factuurovereenkomst aan bij PayPal.
* `POST /paypal/subscribe/capture/{subscription_id}`: Haalt abonnementsgegevens op uit de PayPal API, extraheert de startdatum en abonnementsfrequentie, berekent de vervaltijdstempel en slaat de actieve status op in de database.
* `POST /paypal/subscribe/cancel`: neemt contact op met PayPal om de factureringsovereenkomst te beëindigen en markeert het abonnementsobject in MongoDB als gepland voor beëindiging na afloop.

### Mock-integratieframework ([paypal_client.py](file:///C:/DressApp_AG/backend/app/services/paypal_client.py))
Om het testen van lokale en testomgevingen te vereenvoudigen, gebruikt de integratie `PAYPAL_MOCK_MODE=true`:
```python
if _is_mock_token(token) of plan_id.startswith("P-MOCK"):
    mock_sub_id = f"MOCK-SUB-{uuid.uuid4().hex[:14].upper()}"
    # In plaats van naar PayPal te navigeren, kunt u onmiddellijk doorsturen naar return_url met een nep-token
    checkout_href = f"{return_url}&token={mock_sub_id}" if return_url anders ...
    terug {
        "id": mock_sub_id,
        "status": "APPROVAL_PENDING",
        "links": [{"href": checkout_href, "rel": "goedkeuren", "methode": "GET"}]
    }
```
Hierdoor worden externe afhankelijkheden volledig omzeild, waardoor end-to-end checkout-tests direct toegankelijk zijn voor lokale ontwikkelaars.