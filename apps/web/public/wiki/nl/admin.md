# DressApp-beheerderspaneel — Architectuurverhaal en gebruikershandleiding

Dit document biedt een uitsplitsing op masterclassniveau van het DressApp-beheerderspaneel, waarbij de frontend-dashboardinterface ([Admin.jsx](file:///C:/DressApp_AG/frontend/src/pages/Admin.jsx)) en de bijbehorende backend-API-laag ([admin.py](file:///C:/DressApp_AG/backend/app/api/v1/admin.py)) worden gevolgd.

---

## 1. Samenvatting en waardevoorstel

### Overzicht op hoog niveau
Het DressApp-beheerderspaneel is de gecentraliseerde hub voor applicatiebeheer, auditing van het genereren van inkomsten, configuratie van AI-modellen en pijplijndiagnostiek. Het geeft systeembeheerders een real-time, high-fidelity lens voor de operationele gezondheid van het systeem, de transactievolumes op de markt, het verbruik van AI-credits van gebruikers en API-afhankelijkheden van derden, zonder dat directe SSH/database-shell-toegang nodig is.

### Architecturale stroom
Het volgende diagram illustreert hoe het frontend-dashboard overzichtsgegevens, gebruikersconfiguraties en live-diagnostiek opvraagt bij de backend FastAPI-services, MongoDB-verzamelingen bevraagt en downstream liveness-controles uitvoert.

```Zeemeermin
grafiek TD
    %% Frontend-componenten
    subgraph Frontend [React Applicatie Client]
        UI[Admin.jsx-dashboard]
        API_JS[api.js-client]
        Gebruikersinterface --> API_JS
    einde

%% Backend-router
    subgraph Backend [FastAPI Backend Service]
        Router[admin.py Router]
        Auth [require_admin afhankelijkheid]
        ProviderAct[provider_activiteittracker]
        
        API_JS -- HTTP GET/POST --> Auth
        Verificatie --> Router
    einde

%% Database en downstream
    subgraph Opslag [MongoDB-database]
        db_users[(db.users)]
        db_tx[(db.transacties)]
        db_topups[(db.credit_topups)]
        db_listings[(db.listings)]
        db_trends[(db.trend_rapporten)]
    einde

subgrafiek AI_Services [Downstream API & Microservices]
        Gemini[Google Gemini-API]
        Gemma[Zelfgehoste Gemma Space]
    einde

Router --> db_users
    Router --> db_tx
    Router --> db_topups
    Router --> db_listings
    Router --> db_trends
    Router --> ProviderAct
    
    %% Downstream-controles
    Router -- tekst(ping) --x Gemini
    Router -- GET /gezondheid --x Gemma
```

### Waardepropositie voor gebruikers
- **Totale zichtbaarheid**: realtime KPI-samenvattingskaarten die het totale aantal gebruikers, actieve vermeldingen, betaalde transacties, berichtvolumes van stylisten en wereldwijde applicatie-inkomsten weergeven.
- **Factureringstransparantie**: Duidelijke uitsplitsing per gebruiker van geselecteerde modellen, beschikbare kredietquota, huidig ​​cyclusgebruik en totale vastgelegde factuurgeschiedenis.
- **Proactieve gezondheidsmonitoring**: directe diagnostiek van de validiteit van de Gemini API-sleutel en de status van het zelfgehoste Gemma vision-model op afstand met één enkele interfaceklik.
- **Marktplaatsveiligheidsschakelaars**: directe mogelijkheid om vermeldingen te pauzeren/reactiveren, frauduleuze professionals te verbergen of beheerders te degraderen/promoveren.

---

## 2. Uitgebreide gebruikershandleiding

### Visuele interfacetopologie
Het beheerdersdashboard is onderverdeeld in een overzichtelijke lay-out met meerdere tabbladen, geoptimaliseerd voor desktop- en mobiele stijl:

```
+----------------------------------------------------------------------+
|  DressApp (beheerder) [Terug naar Home] |
|  ------------------------------------------------------------------- |
|  [ Overzicht ] [ Aanbieders ] [ Trend Scout ] [ Gebruikers ] [ Advertenties ] ... |
+----------------------------------------------------------------------+
|  OVERZICHT TAB |
|  +-----------------+ +-----------------+ +----------------+ +-------+ |
|  | Gebruikers |  | Kastartikelen |  | Actieve vermeldingen |  | ... |  |
|  | 15 (+0 nieuw binnen 24 uur)|  | 262 onder gebruikers |  | 5 (11 totaal) |  |       |  |
|  +-----------------+ +-----------------+ +----------------+ +-------+ |
|                                                                               |
|  +-----------------------------------------------------------------+ |
|  | Provideractiviteit (laatste 200 oproepen) |  |
|  | tweeling-stylist: 1 keer gebeld, 100% foutenpercentage | openweer: 1 oproepen, 0% fout |  |
|  +-----------------------------------------------------------------+ |
+----------------------------------------------------------------------+
```

### Modus- en workflow-walkthroughs

#### 1. Tabblad Overzicht
- **Statistiekenraster**: geeft 8 essentiële statistieken weer (gebruikers, kastitems, actieve vermeldingen, transacties, brutovolume, platformkosten, 24 uur stylist, live trendkaarten).
  - *Opmerking*: **Brutovolume** en **Platformkosten** omvatten dynamisch zowel marktplaatstransacties als vastgelegde kredietopwaarderingen.
- **Provider-activiteitentabel**: toont liveness-statistieken voor downstream-services van derden (bijvoorbeeld `gemini-stylist`, `openweather`) met het aantal oproepen, foutpercentages, gemiddelde latentie en p95-benchmarks.

#### 2. Tabblad Providers
- **Gemini API-kaart**: geeft directe statusvalidatie van de Gemini API-sleutel weer. Als u op **Sleutel verifiëren** klikt, wordt een backend-pingtest geactiveerd.
- **Eyes Vision Override**: Maakt het mogelijk om de standaard afbeeldingssegmentatie/analyserouting te schakelen tussen 'gemini' en een zelf-gehost 'gemma'-containermodel.

#### 3. Tabblad Gebruikers
- **Interactieve lijst**: Toont een tabel met zoekmogelijkheden, met een lijst van e-mailadressen van gebruikers, rollen, actief model, beschikbare kredietquota, kredietgebruik, DressApp-kosten en levenslange betalingen.
- **Beheerschakelaars**: Directe knoppen om standaardgebruikers te **promoveren** tot beheerders of **degraderen** bestaande gebruikers.

#### 4. Tabbladen Advertenties en Transacties
- **Lijstfilters**: filter actieve garderobelijsten op 'alles', 'actief', 'gepauzeerd', 'verkocht' of 'verwijderd'. Beheerders kunnen vermeldingen geforceerd pauzeren/activeren.
- **Transactietotalen**: vat het totale brutovolume, platformkosten, Stripe-kosten en netto verkopers samen.

---

## 3. Technologiestapel en mogelijkheden Deep-Dive

### Kernorkestratie en AI/logica
- **API Engine**: FastAPI Python-framework dat op rollen gebaseerde afhankelijkheden implementeert (extractie van `require_admin`).
- **Gemini Direct Integratie**: Voert een tekstgeneratiecontrole uit met `GeminiClient` om de API rechtstreeks te pingen, waarbij middlewares van derden worden omzeild:
  ```python
  client = wacht op get_default_client()
  wacht op client.text(user_text="ping", max_tokens=5)
  ```
- **Gemma Space Probe**: lost dynamische modelrouting op en verzendt liveheid HTTP-controles:
  ```python
  async met httpx.AsyncClient(timeout=probe_timeout) als cli:
      r = wacht op cli.get(f"{gemma_url}/health")
  ```

### Gegevens- en contextpijplijnen
- **MongoDB-aggregaties**:
  - Financiële gegevens van marktplaatstransacties:
    ```python
    pipeline = [{"$match": {"status": "paid"}}, {"$group": {"_id": Geen, "bruto": {"$sum": "$financial.gross_cents"}}}]
    ```
  - Aankoopbedrag prepaid credits:
    ```python
    topup_pipeline = [{"$match": {"status": "captured"}}, {"$group": {"_id": Geen, "total": {"$sum": "$amount_cents"}}}]
    ```
- **Lichtgewicht DB-query's**: items per gebruiker en aantallen actieve vermeldingen worden asynchroon parallel ingevuld.

### Frontend-clientarchitectuur
- **State Management**: Reageer op `useState` hooks gekoppeld aan lokale API-aanroepen gedefinieerd in `src/lib/api.js`.
- **Lokalisatie-integratie**: rigoureuze op i18next-opties gebaseerde sleutels toegewezen onder `pages.admin.*` in 12 talen. Mirroring van rechts naar links (RTL) wordt mogelijk gemaakt via de start/end-eigenschappen van Tailwind (bijvoorbeeld `ps-`, `pe-`, `text-end`).
- **Visuele responsiviteit**: op maat gemaakte ondersteuning voor de donkere modus en aangepaste lay-outrasters gebouwd met behulp van shadcn/ui-componenten (`Tabel`, `Kaart`, `Badge`, `Skelet`).