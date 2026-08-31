# DressApp — Volledige technische gebruikershandleiding

Uitgebreide gebruikershandleiding en technische referentiegids voor het persoonlijke DressApp-garderobe-ecosysteem, de stylingsmotor, de circulaire marktplaats en de beheerderspanelen.

---

## 1. Overzicht & Technologie-stack

DressApp is een door AI aangedreven persoonlijke garderobemanager, stylingadviseur en circulaire marktplaats. Het helpt gebruikers om kledingstukken digitaal te beheren, ze automatisch vrij te stellen en te taggen, kledingaanbevelingen te ontvangen die rekening houden met het weer en de agenda, digitale EU-productpaspoorten (DPP) te scannen en kleding te verhandelen.

### Kernwaardepropositie
- **Digitale garderobe-ingest**: Verwerking van foto's of uploads met automatische achtergrondverwijdering, kledingcategorisatie en generatie van attribuuttags.
- **Virtuele AI-stylist**: Een conversatie-agent die contextueel uw garderobe, Google Agenda-evenementen en lokale weersvoorspellingen analyseert om dagelijkse outfits voor te stellen.
- **Circulaire marktplaats**: Veilige peer-to-peer aankoop, verkoop, ruil en verhuur van kleding om fast fashion-afval te verminderen.
- **Cost-Per-Wear (CPW) analyses**: Inzichten in de waarde van de garderobe, het gebruikspercentage en de optimalisatie van de kledingkast.

### Technologie-architectuur
- **Backend Edge**: Python 3.11 met FastAPI, met gebruik van asynchrone Motor-stuurprogramma's die verbonden zijn met een MongoDB Atlas-cluster.
- **Frontend SPA**: React 19 single-page application die gebruikmaakt van aangepaste `useSyncExternalStore`-stores (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, Shadcn/UI-primitives en `react-i18next` met ondersteuning voor 12 talen.
- **Status- en netwerkoptimalisatie**: Deduplicatie van lopende aanbevelingen, 15 minuten cachetijd voor de stores en revalidatie bij tabbladwisseling (`visibilitychange`), wat resulteert in nul achtergrond-GET-verzoeken bij inactiviteit.
- **Lokale machine learning & maten**: CPU-lokaal U2-Net (`rembg`) voor achtergrondverwijdering, SegFormer-b2 voor kledingsegmentatie, Fashion-CLIP-embeddings en het ANSUR II-regressiemodel voor fysieke lichaamsmaten (`body_predictor.py`). Optioneel routering naar zelfgehoste GPU-containers (SegFormer-b3 + BiRefNet) voor snelle bewerkingen.
- **Conversational STT/TTS**: Realtime spraakherkenning via de Web Speech API van de client als fallback, Gemini 2.5 Flash aan de serverzijde voor multimodale verwerking en Piper/Sherpa-ONNX-engines op het apparaat voor offline spraakuitvoer.
- **Externe integratiediensten**: OpenWeatherMap API voor weergegevens, Google Calendar OAuth voor het exporteren van dagschema's, OpenStreetMap (Nominatim) voor het automatisch aanvullen van adressen en PayPal Subscriptions/Checkout REST API's.
# DressApp Volledige Technische Gebruikershandleiding

Uitgebreide gebruikershandleiding en technische referentiegids voor het persoonlijke kledingkastecosysteem, stylingengine, circulaire marktplaats en administratiepanelen van DressApp.

---

## 1. Overzicht & Technologie-Stack

DressApp is een door AI gestuurde persoonlijke kledingkastbeheerder, stylingadviseur en circulaire marktplaats. Het helpt gebruikers kledingstukken digitaal te beheren, ze automatisch bij te snijden en te taggen, weer- en agendabewuste outfit-aanbevelingen te ontvangen, EU Digitale Productpaspoorten (DPP) te scannen en kledingstukken te verhandelen.

### Kernwaardepropositie
- **Digitale invoer van kledingkast**: Verwerking van foto-uploads met automatische achtergrondverwijdering, kledingcategorisatie en het genereren van attribuuttags.
- **AI Virtual Stylist**: Een conversatie-agent die contextueel uw kledingkast, Google Calendar-evenementen en lokale weersvoorspellingen beoordeelt om dagelijkse outfits voor te stellen.
- **Circulaire marktplaats**: Veilige peer-to-peer aankoop, verkoop, ruil en verhuur van kleding om fast fashion-afval te verminderen.
- **Cost-Per-Wear (CPW) Analyse**: Inzicht in de kapitalisatiewaarde van de kledingkast, benuttingsgraden en gebruiksoptimalisatie.

### Technologie-Architectuur
- **Backend Edge**: Python 3.11 met FastAPI, met behulp van asynchrone Motor-stuurprogramma's die zijn verbonden met een MongoDB Atlas-cluster.
- **Frontend SPA**: React 19 single-page applicatie die gebruikmaakt van `useSyncExternalStore` aangepaste winkels (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, Shadcn/UI-componenten en `react-i18next` die 12 talen ondersteunt.
- **Status- & netwerkoptimalisatie**: Ontdubbeling van lopende verzoeken, opslag in cache gedurende 15 minuten en hernieuwde validatie van tabbladen via `visibilitychange`, wat resulteert in nul GET-verzoeken op de achtergrond bij inactiviteit.
- **Lokale machine learning & maatvoering**: CPU-lokale U2-Net (`rembg`) achtergrondmatting, SegFormer-b2 kledingontleding, Fashion-CLIP-embeddings en ANSUR II regressiemodel voor fysieke lichaamsmetingen (`body_predictor.py`). Optioneel worden aanvragen gerouteerd naar zelfgehoste GPU-containers (SegFormer-b3 + BiRefNet) voor snelle bewerkingen.
- **Conversationele STT/TTS**: Live spraakherkenning aan de clientzijde (Web Speech) als fallback, multimodale Gemini 2.5 Flash-modulaties aan de serverzijde en Piper/Sherpa-ONNX-engines op het apparaat voor offline werking.
- **Externe integratiediensten**: OpenWeatherMap API voor weergegevens, Google Calendar OAuth voor het exporteren van dagelijkse schema's, OpenStreetMap (Nominatim) voor het automatisch aanvullen van adressen en REST API's voor PayPal Subscriptions/Checkout.

---

## 2. Prerequisites (Vereisten)

### Vereisten voor de hostomgeving
- **Hardware**: Minimaal 4 GB RAM VPS (bijv. Hetzner VPS voor het hosten van de productie-omgeving `dressapp.co`).
- **Afhankelijkheden**: Docker & Docker Compose-stack (inclusief backend, frontend en Caddy TLS-beëindiging).
- **Omgevingsvariabelen**: Configuratie van API-sleutels (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` en Google Calendar OAuth-tokens).

### Vereisten voor de gebruikersapp
- **Webbrowser**: Google Chrome of Apple Safari (vereist voor volledige compatibiliteit met spraakfuncties).
- **Machtigingen**: Toegang verlenen tot de camera (voor kledingfoto's en QR-scans) en de microfoon (voor spraakgesprekken).
- **Netwerk**: Actieve verbinding voor de LLM-verwerking, waarbij IndexedDB-caching offline bladeren in de catalogus mogelijk maakt.
### Eisen aan de hostomgeving
- **Hardware**: VPS met minimaal 4 GB RAM (bijv. Hetzner VPS voor het hosten van de productie `dressapp.co`).
- **Afhankelijkheden**: Docker & Docker Compose (inclusief backend, frontend en Caddy TLS-beëindiging).
- **Omgevingsvariabelen**: API-sleutelsconfiguratie (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` en Google Calendar OAuth-tokens).

### Eisen aan de gebruikersapp
- **Webbrowser**: Google Chrome of Apple Safari (vereist voor volledige compatibiliteit van spraakfuncties).
- **Machtigingen**: Verleen cameramachtigingen (voor kledingfoto's en QR-scans) en microfoonmachtigingen (voor spraakgesprekken).
- **Netwerk**: Actieve verbinding voor LLM-verwerking, waarbij IndexedDB-caching offline bladeren door de catalogus mogelijk maakt.

---

## 3. Stap-voor-stap instructies

### 3.1 Kleding toevoegen (Artikelen registreren)
REGISTRATIEMETHODEN: Fotografie, EU-productpaspoorten en digitale aankoopbewijzen.

#### A. Interactieve camera en bestandsupload
1. Navigeer naar het scherm **Artikel toevoegen** (Add Item).
2. Selecteer **Foto maken** (Take Photo) (opent de camera van het mobiele apparaat) of klik op **Foto's uploaden** (Upload Photos) (opent de bestandszoeker van het besturingssysteem).
3. De client berekent de SHA-256-waarde en de horizontale verschil-hash (dHash) van de afbeelding in de browser (~100-180 ms) om deze te vergelijken met uw bestaande kledingkast.
4. Als er een overeenkomst wordt gevonden, verschijnt het **Dialoogvenster voor duplicaten** met voorbeelden van de overeenkomende artikelen. Selecteer **Overslaan** (Skip) of **Tog nog toe voegen** (Add anyway).
5. Na acceptatie start de server een NDJSON-stream. Binnen 5-7 seconden verschijnt er een tijdelijk voorbeeldframe, zodat u de details van het artikel direct kunt bewerken terwijl de backend de tagging voltooit.
6. Controleer de automatisch gedetecteerde tags (kleur, stof, pasvorm, patroon, gelegenheid). Als het uitsnijden niet klopt, wijzigt u de categorie in het vervolgkeuzemenu **Categorie**; dit activeert SegFormer om het kledingstuk automatisch opnieuw uit te snijden.
7. Klik op **Opslaan** (Save) om het artikel direct optimistisch in het kledingkast-raster weer te geven (~16 ms) terwijl de generatie van het WebP-voorbeeldbeeld op de achtergrond wordt voltooid.

#### B. Scannen van EU-productpaspoorten (DPP)
1. Tik op de knop **Scan QR (DPP)** op de pagina Artikel toevoegen.
2. Verleen cameramachtigingen en lijn de QR-code uit die op het etiket van het kledingstuk is gedrukt, of upload een opgeslagen QR-screenshot.
3. De backend lost de URL op en voert SSRF-beveiligingscontroles uit (blokkeren van private IP-bereiken).
4. Het systeem leest de JSON-LD-schema's uit om merk, materiaalsamenstelling, herkomst van de toeleveringsketen, CO2-voetafdruk en onderhoudsrichtlijnen te extraheren.
5. Controleer de geëxtraheerde gegevens die worden weergegeven in het groene paneel **Verified DPP Data** en klik op **Opslaan**.

#### C. Digitale aankoopbewijzen importeren
1. Open het tabblad **Digitaal importeren** (Digital Import).
2. Kies een submodus: **Tekst plakken**, **Afbeelding uploaden**, **PDF uploaden** of geef een **Weblink** op.
3. De backend maakt gebruik van multimodale vision-modellen om transactiegegevens (merk, prijs, maat, categorie) te extraheren.
4. Geanalyseerde velden worden vergrendeld om ze te beschermen tegen toekomstige automatische visuele heranalyses. Klik ter bevestiging op **Opslaan**.

---

### 3.2 Interactieve virtuele AI-stylist
Beschrijf uw stylingsdilemma's en ontvang spraakgestuurd outfitadvies.

1. Navigeer naar het scherm **AI Stylist**.
2. Klik op het microfoonpictogram `[Microphone]` in de chat-invoerbar.
3. Spreek uw verzoek in (bijv. *"Welk shirt past bij mijn beige broek voor een lunch in de buitenlucht als het regent?"*).
4. Als Web Speech wordt ondersteund, wordt uw stem live in het invoerveld getranscribeerd. Als dit niet het geval is, neemt de app een WebM-bestand op en uploadt dit.
5. De backend leidt de spraakquery door naar de lokale Gemma-container (valt offline terug op de Gemini 2.5 Flash-transcriptie).
6. De stylist analyseert uw kledingkastgeschiedenis, lokale weersvoorspellingen en agenda-evenementen om een outfitvoorstel te formuleren.
7. De stylist spreekt het antwoord uit met behulp van vooraf geselecteerde spraakprofielen (`puck`, `aoede` of `charon`).
8. Tik op de kaart op **Antwoord afspelen** (of **Replay** in de Hebreeuwse modus) om de spraakopname opnieuw af te spelen.

---

### 3.3 Profiel, voorkeuren en subversie-afhankelijkheden
De profielpagina dient als het centrale controlepaneel voor DressApp. Configuraties hebben een directe invloed op de prestaties, de routering en het gedrag van gekoppelde modules.

##### Afhankelijkheden en logica van de accordeonsecties

1. **Foto's & Digitale avatar (`AvatarViewer2D` & `DynamicAvatar`)**
   - **Waarom is het belangrijk?**: Toont uw visuele identiteit op alle passchermen met een dual-modus (gesegmenteerde foto-uitsnede van het echte lichaam vs. dynamische 2D-Bezier-vectorpop).
   - **Subsysteem-afhankelijkheden**: Foto-uitsneden worden via het lokale U2-Net (`rembg`) vrijgesteld en in de browser verkleind tot maximaal 1280px bij 82% kwaliteit om binnen de MongoDB-documentenlimiet van 16 MB te blijven. Het scherm past gekalibreerde positiemarkeringen toe (`top-[14.5%]` kraag tot halslijn, `top-[36.5%]` broekband tot taille, `bottom-[2%]` schoenenniveau) en een proportionele borst-/heupschaling ($scaleX$). Klik op *Foto verwijderen* om direct terug te keren naar de 2D-SVG-vectorpop.

2. **Stijlprofiel (Bescheidenheidsregels, dresscode)**
   - **Waarom is het belangrijk?**: Bepaalt persoonlijke grenzen voor aanbevolen outfits en voorkomt dat de AI ongepaste stijlsuggesties genereert.
   - **Subsysteem-afhankelijkheden**: De geselecteerde parameters (bijv. richtlijnen voor bescheiden kleding) worden rechtstreeks opgenomen in de stylingsprompts voor Gemini 2.5 Flash, waardoor kledingkastuitgangen worden gefilterd voordat ze worden weergegeven.

3. **Details (Naam, telefoonnummer, beroep)**
   - **Waarom is het belangrijk?**: Personaliseert de toon van de communicatie en stuurt notificaties aan.
   - **Subsysteem-afhankelijkheden**: De naam van de gebruiker wordt dynamisch ingevoegd in e-mails en push-notificaties van het systeem. Het telefoonnummer dient als back-upregister voor geplande alarmen. De beroepsparameter wordt doorgegeven aan het stylist-LLM en de Trend Scout-personalisatieranker om voorstellen aan te passen.

4. **Lichaamsmaten & Maatberekening (ANSUR II-regressiemodel & Maatrekenaar)**
   - **Waarom is het belangrijk?**: Voorkomt giswerk bij confectiematen en maakt automatische maatberekening en nauwkeurige virtuele schifting van kledingstukken mogelijk.
   - **Subsysteem-afhankelijkheden**: Het invoeren van 4 basisparameters (**Lengte**, **Gewicht**, **Taille**, **Voetlengte**) activeert het scikit-learn ANSUR II-regressiemodel (`body_predictor.py`) om automatisch 6 structurele maten te voorspellen (*Schouders*, *Borst*, *Heupen*, *Mouwlengte*, *Binnenbeenlengte*, *Buitenbeenlengte*).
     - **Maatvertaling**: Zodra de maten zijn voorspeld, converteert de backend-maatsmotor deze dynamisch naar confectiematen: **Hemdmaat** (XS-XXL op basis van de borst), **Broekmaat** (Taille in inches), **Schoenmaat** (US-heren/dames en EU-standaarden op basis van voetlengte en geslacht), **Jurkmaat** (US 0-14+ op basis van borst, taille en heupen) en **BH-maat** (Onderborstband + cup op basis van borst en geschatte onderborstomvang).
     - **Automatische invulling**: Deze aanbevolen maten worden automatisch ingevuld in de velden van de *Gedetailleerde bewerkingsmodus* in het profieldashboard.
     - **Integraties**: De maten worden rechtstreeks opgevraagd door de inhoudsscripts van de Chrome-extensie **Shopping Assistant** om maattabellen op partnerwebsites (Zara, Asos) te lezen en maten aan te bevelen.

5. **Lifestyle (Status, Geslacht)**
   - **Waarom is het belangrijk?**: Past standaardaanbevelingen aan en weegt content-algoritmen.
   - **Subsysteem-afhankelijkheden**: De geslachtskeuze is direct van invloed op de rangschikkingslogica van de dagelijkse Trend Scout-kaarten. Als een categorie niet overeenkomt met het geslacht van de gebruiker, past het algoritme een aftrek van -2.0 punten toe, waardoor deze in de feed naar beneden wordt verplaatst.

6. **KI-configuratie (SaaS-sleutels, edge-modus, credits)**
   - **Waarom is het belangrijk?**: Bepaalt de factureringsroutering, systeemprestaties en offline status van het netwerk.
   - **Subsysteem-afhankelijkheden**: Stuurt tekst-/audio-generatieverzoeken door. Standaardsetups verbruiken DressApp-systeemcredits. De invoer van persoonlijke API-sleutels (Google AI Studio, Anthropic, OpenAI) leidt de kosten door naar het ontwikkelaarsaccount van de gebruiker. De selectie van de lokale edge-modus leidt verzoeken door naar de offline Gemma-container.

7. **Planer & Push-notificaties (Frequentie, dagelijks alarm, stilsturing)**
   - **Waarom is het belangrijk?**: Beheert de automatische dagelijkse outfitbezorging.
   - **Subsysteem-afhankelijkheden**: Activeert `APScheduler`-cronjobs op de FastAPI-backend. Elke ochtend worden push-notificaties via `pywebpush` verzonden met behulp van de VAPID-sleutels van de client, passend bij de geselecteerde stilsturing.

8. **Google Agenda (OAuth-sync, exportregels)**
   - **Waarom is het belangrijk?**: Verbindt uw garderobe rechtstreeks met uw echte agenda-evenementen.
   - **Subsysteem-afhankelijkheden**: Authenticatie via Google OAuth. De planner vraagt uw agenda op om evenementen te identificeren, stelt outfits samen en voegt de afspraken rechtstreeks toe aan uw Google Agenda.

9. **Locatiediensten (GPS-tracking, weersnauwkeurigheid)**
   - **Waarom is het belangrijk?**: Coördineert weersafhankelijke suggesties en lokale zoekradii.
   - **Subsysteem-afhankelijkheden**: Activeert de omgekeerde geocodering via `navigator.geolocation`. De coördinaten worden naar de OpenWeatherMap API verzonden om de aanbevelingen van de stylist aan te passen (bijv. regenkleding bij zware regenval). Bovendien worden afstanden berekend voor marktplaatsadvertenties en experts in de buurt.

10. **Stem & Taal (Spraakkeuze van de virtuele stylist)**
    - **Waarom is het belangrijk?**: Stelt de vertaaltaal en stemmodulaties in.
    - **Subsysteem-afhankelijkheden**: Regelt de actieve vertaaltaal via `react-i18next`. De stemkeuze koppelt BCP-47-taalcodes (bijv. `he-IL` of `ar-JO`) aan de spraaksynthesestemmen van de browser of offline Piper-TTS-modellen.

11. **Vrienden uitnodigen (Aanbevelings-API)**
    - **Waarom is het belangrijk?**: Biedt een virale lus voor de gratis uitbreiding van de kledingkast.
    - **Subsysteem-afhankelijkheden**: Hangt de MongoDB-ID van de aanbeveler aan de URL. Nieuwe registraties vragen deze ID op en verhogen de `closet_capacity_bonus` van de aanbeveler automatisch met +10 plaatsen, waardoor de capaciteitsgrenzen in `closet.py` worden aangepast.

---

## 3.4 Kledingkast-Insights-dashboard
Analyseer de totale waarde van de kledingkast, volg het gebruikspercentage van de kledingstukken en evalueer de Cost-per-Wear-parameters.

1. Navigeer naar **Wardrobe Insights**.
2. **Statistieken controleren**:
   - *Waarde van de kledingkast (Closet Worth)*: Dynamische som van de aankoopprijzen.
   - *Kledingkast-gebruik (Closet Utilization)*: Percentage kledingstukken dat minstens één keer is gedragen.
   - *Gemiddelde Cost-per-Wear (CPW)*: Berekend als `Prijs / Aantal keren gedragen`.
3. **Verdelingsgrafieken**: Wissel van tabblad om Recharts-visualisaties te bekijken:
   - *Kleurpalet*: Verdeling van de gedetecteerde hex-codes.
   - *Materialen*: Verdeling van de stofpercentages.
   - *Subcategorieën*: Verdeling van de gedetecteerde subcategorieën.
4. **Efficiëntie-ranglijst**: Toon de top 5 kledingstukken met de laagste Cost-per-Wear-waarden.

---

### 3.5 Outfit-canvas & Planer
Ontwerp, schik en bekijk outfitvoorstellen op een interactieve 2D-avatar-canvas.

1. Open de planner **Outfit Canvas**.
2. **Bovenkleding schikken (Duaal canvas)**: Als uw outfit bovenkleding (bijv. een jas) over een top bevat, rendert de pagina twee verticale canvas-modules: "Met bovenkleding" (toont de jas erover) and "Zonder bovenkleding" (toont alleen de top eronder).
3. **Interactieve 2D-elementen**: Tik direct op een kledingstuk op het lichaam van de avatar. De app leidt u direct naar het detailscherm van dat kledingstuk.
4. **Tabblad voor compatibiliteitswaarden**: Klik op de knop "Details" en selecteer het tabblad **Metrics** om voortgangsbalken voor de compatibiliteitscriteria weer te geven:
   - *Kleurharmonie* (neutrale harmonie)
   - *Patrooncompatibiliteit* (vermijden van patroonconflicten)
   - *Pasvorm* (maatovereenkomst)
   - *Geschiktheid voor het weer* (seizoenseigenschap)
   - *Gelegenheidscompatibiliteit* (activiteitsgeschiktheid)
   - *Locatiecompatibiliteit* (controle van bescheidenheidsregels)
5. **Naam wijzigen/Beschrijven**: Klik op het potloodpictogram om outfitnamen en -beschrijvingen te bewerken.

---

### 3.6 Koffer-inpakassistent
Organiseer uw bagage voor reizen, zonder te veel in te pakken.

1. Roep de pagina **Suitcase** op en vul het formulier voor de reiscontext in (reisbestemming, start-/einddatum, reiscategorie, agenda-evenementen).
2. De KI genereert op basis van reisduur en weersvoorspelling een op maat gemaakte paklijst en dagelijkse outfits.
3. Controleer de inpakvoortgang. Als een belangrijk artikel ontbreekt (bijv. een paraplu voor regendagen of badkleding voor het strand), waarschuwt het systeem u en stelt passende artikelen voor uit de marktplaats of van lokale winkels.
4. Gebruik de geïntegreerde chat om voorstellen aan te passen (bijv. *"Wijzig dag 2 in informele avondkleding"*). De assistent past de kofferinhoud aan, terwijl de rest van de lijst behouden blijft.
5. Tik op **Koffer goedkeuren** (Approve Suitcase) om uw paklijst op te slaan.

---

### 3.7 Planner & Push-herinneringen
Richt dagelijkse stylingherinneringen in om outfit-aanbevelingen automatisch te ontvangen.

1. Open **Profile** en ga naar **Scheduler & Push**.
2. Activeer meldingen, stel een dagelijkse tijd, de weekdagen en het stylingthema in.
3. Elke ochtend controleert de achtergrondtaak (`APScheduler`) de weersvoorspelling en verzendt een pushmelding.
4. Tik op de melding op uw apparaat (of open het meldingencentrum van de app) om een voorsteldialoog met 3 outfitideeën weer te geven.
5. Sla een voorstel direct op in uw **Garderobe-dagboek** (Wardrobe Diary).

---

## 3.8 Marktplaats (Verkoop, Verhuur, Ruil, Schenking)
Neem deel aan de circulaire peer-to-peer modemarktplaats.

- **Advertentie maken**: Open de detailpagina van een artikel, selecteer **Intentie bewerken** (Edit Intent) en kies een openbare optie:
  - *Te koop (For Sale)*: Geef prijs en valuta op (herkent uw standaardvaluta op basis van de regionale instellingen).
  - *Huren (Rent)*: Stel de dagelijkse huurprijs en de leenvoorwaarden vast.
  - *Ruilen (Swap)*: Markeer het artikel als open voor ruiltransacties.
  - *Schenken (Donate)*: Publiceer het artikel gratis.
- **Statussynchronisatie**: Advertenties worden automatisch naar de feed verzonden. De client gebruikt `useSyncExternalStore` en IndexedDB-caching om zoekresultaten latentievrij te laden.
- **Virtuele pas-sandbox**: Kopers/huurders kunnen een aangeboden artikel voor aankoop virtueel combineren met artikelen uit hun eigen kledingkast.
- **Aankoopafhandeling**:
  - *Kopen/Huren*: Sluit transacties via de geïntegreerde PayPal-knoppen af. Webhooks informeren de verkoper, wijzigen de status van het artikel in verkocht/verhuurd en registreren de transactie minus de systeemkosten van 7% in het kasboek.
  - *Ruilhandel*: Geïnteresseerden stellen ruiltransacties voor. De aanbieder ontvangt bevestigingsmails om het aanbod te accepteren of te weigeren.

---

### 3.9 Beheerdersdashboard
Systeembewaking, boekhouding en gebruikersaccountbeheer.

1. Navigeer naar `/admin` (alleen toegankelijk voor beheerders).
2. **Overzicht**: Controleer het brutovolume en de inkomsten uit systeemkosten. Inspecteer de **Activiteitstabel van de aanbieders** om de status van de externe API's (Gemini, latentie van de weerdienst en foutenpercentages) in te zien.
3. **Aanbieders**: Klik op **Sleutel verifiëren** (Verify Key) om een directe ping naar de Gemini API te sturen. Activeer de schakelaar **Eyes Vision Override** om de afbeeldingsanalyse tussen het standaard Gemini-eindpunt and een lokale Gemma-container om te schakelen.
4. **Gebruikers**: Geef actieve credits, gebruikersrollen en totale omzet weer. Gebruik directe acties om gebruikers te promoveren of te degraderen.
5. **Advertenties**: Bekijk de status van marktplaatsadvertenties en schakel advertenties uit bij misbruik.
### 3.1 Kledingstukken invoeren (Items toevoegen)
INVOERMETHODEN: Fotografie, EU Digitale Productpaspoorten (DPP) en digitale aankoopbewijzen.

#### A. Interactieve camera en bestandsupload
1. Navigeer naar het scherm **Item toevoegen** (Add Item).
2. Selecteer **Foto maken** (start de camera van het mobiele apparaat) of klik op **Foto's uploaden** (opent de bestandskiezer).
3. De client berekent de SHA-256 en dHash van de afbeelding in de browser (~100-180 ms) om te controleren op duplicaten in uw kledingkast.
4. Als er een match wordt gevonden, wordt het **dialoogvenster voor duplicatencontrole** geopend. Selecteer **Overslaan** of **Toch toevoegen**.
5. Na acceptatie start de server een NDJSON-stream. Binnen 5-7 seconden wordt er een tijdelijk previewframe weergegeven, zodat u de itemdetails direct kunt bewerken terwijl de backend het taggen voltooit.
6. Controleer de automatisch gedetecteerde tags (kleur, stof, pasvorm, patroon, gelegenheid). Als de uitsnede onjuist is, wijzigt u de dropdown **Categorie**; dit activeert SegFormer om het kledingstuk automatisch opnieuw uit te snijden.
7. Klik op **Opslaan** om het item direct in het kledingkastraster weer te geven (~16 ms) terwijl het genereren van de WebP-thumbnail op de achtergrond wordt voltooid.

#### B. Scannen van EU Digital Product Passports (DPP)
1. Tik op de knop **Scan QR (DPP)** op de pagina Item toevoegen.
2. Verleen cameramachtigingen en lijn de QR-code uit die op het kledingetiket is gedrukt, of upload een opgeslagen QR-screenshot.
3. De backend lost de URL op en voert SSRF-veiligheidscontroles uit (het blokkeren van private IP-bereiken).
4. Het systeem analyseert de JSON-LD-schema's om merk, materiaalsamenstelling, toeleveringsketen, CO2-voetafdruk en onderhoudsrichtlijnen te extraheren.
5. Controleer de geëxtraheerde gegevens in het groene accordeonpaneel **Geverifieerde DPP-gegevens** en klik op **Opslaan**.

#### C. Digitale aankoopbewijzen importeren
1. Open het tabblad **Digitaal importeren** (Digital Import).
2. Kies een methode: **Tekst plakken**, **Afbeelding uploaden**, **PDF uploaden** of voer een **Weblink** in.
3. De backend maakt gebruik van multimodale visiemodellen om transactiegegevens (merk, prijs, maat, categorie) te extraheren.
4. De geanalyseerde velden worden vergrendeld om ze te beschermen tegen toekomstige visuele heranalyses. Klik ter bevestiging op **Opslaan**.

---

## 3.2 Conversationele AI Virtual Stylist
Beschrijf uw stylingdilemma's en ontvang handsfree gesproken outfitadvies.

1. Navigeer naar het scherm **AI Stylist**.
2. Klik op het microfoonpictogram `[Microphone]` in de chatinvoerregel.
3. Spreek uw verzoek in (bijv. "Welke top past bij mijn beige broek voor een regenachtige lunch buiten?").
4. Als Web Speech wordt ondersteund, wordt uw stem direct getranscribeerd in het invoerveld. Als dat niet het geval is, neemt de app een WebM-bestand op en uploadt dit.
5. De backend stuurt de spraakquery naar de lokale Gemma4-container (met een terugval naar Gemini 2.5 Flash-transcriptie als de server offline is).
6. De stylist verwerkt uw kledingkastgeschiedenis, lokale weersvoorspellingen en agenda-evenementen om een stijlstijlvoorstel te formuleren.
7. De stylist spreekt het antwoord uit met behulp van vooraf geselecteerde stemprofielen (`puck`, `aoede` of `charon`).
8. Tik op de kaart op **Antwoord afspelen** (of **Replay** in de Hebreeuwse modus) om de spraak-audio opnieuw af te spelen.

---

## 3.3 Profiel, voorkeuren en sub-systeemafhankelijkheden
De profielpagina dient als het centrale controlepaneel voor DressApp. Configuraties hebben direct invloed op de prestaties en het gedrag van downstreamblokken.

##### Afhankelijkheden en motivering van accordeonsecties

1. **Foto's & podium voor digitale avatar (`AvatarViewer2D` en `DynamicAvatar`)**
   - **Belang**: Toont uw visuele identiteit op alle passchermen met behulp van een podium met dubbele modus (echte uitgesneden foto versus dynamische 2D Bezier SVG-vectorpaspop).
   - **Afhankelijkheden**: Fotouitsneden worden verwerkt via lokale U2-Net (`rembg`) en in de browser verkleind tot maximaal 1280px bij 82% kwaliteit om binnen de limiet van 16 MB van MongoDB te passen. Het podium past gekalibreerde referentie-offsets toe (`top-[14.5%]` van kraag naar halslijn, `top-[36.5%]` van tailleband naar taille en `bottom-[2%]` voor schoenen) en een proportionele borst-/heupschaling ($scaleX$). Klik op *Foto verwijderen* om direct terug te keren naar de 2D-SVG-paspop.

2. **Stijlprofiel (Bescheidenheidsregels, dresscode)**
   - **Belang**: Stelt persoonlijke grenzen voor aanbevolen outfits, om te voorkomen dat de AI ongepaste stijlsuggesties genereert.
   - **Afhankelijkheden**: De geselecteerde parameters (bijv. bescheidenheidseisen) worden rechtstreeks doorgegeven aan de prompts voor Gemini 2.5 Flash, om passende kastitems te filteren voordat ze worden getoond.

3. **Persoonlijke gegevens (Naam, telefoon, beroep)**
   - **Belang**: Personaliseert de toon van de communicatie en stuurt meldingen.
   - **Afhankelijkheden**: De naam van de gebruiker wordt dynamisch verwerkt in e-mails en systeempushes. Het telefoonnummer dient als reservekanaal voor geplande meldingen. De beroepsparameter wordt aan het Stylist-LLM en de Trend Scout-personalisatieranker doorgegeven om voorstellen aan te passen.

4. **Lichaamsmaten & maatvoering (ANSUR II-regressiemodel en maatvoorspeller)**
   - **Belang**: Voorkomt twijfels over maten, waardoor automatische maatberekening, externe maatvergelijking en nauwkeurige virtuele laagjessimulatie mogelijk zijn.
   - **Afhankelijkheden**: Het invoeren van 4 basisparameters (**Height** (Hoogte), **Weight** (Gewicht), **Waist** (Tailleomtrek), **Foot Length** (Voetlengte)) activeert het regressiemodel ANSUR II van scikit-learn (`body_predictor.py`) om automatisch 6 structurele dimensies te voorspellen (*Schouders*, *Borst*, *Heupen*, *Mouwen*, *Binnenbeenlengte*, *Buitenbeenlengte*).
     - **Maatvertaling**: Zodra structurele maten zijn voorspeld, converteert de engine deze in winkelmaten: **Hemdmaat** (XS-XXL op basis van borstomtrek), **Broekmaat** (Taille in inches), **Schoenmaat** (Amerikaanse maten voor mannen/vrouwen en Europese standaard op basis van voetlengte en geslacht), **Jurkmaat** (US 0-14+ op basis van borst, taille, heupen) and **Bra-maat** (onderborst en bovenborst).
     - **Automatisch invullen**: Deze aanbevolen maten worden automatisch ingevuld in de velden van de *Detailed Edit Mode* op het profiel.
     - **Integraties**: De maten worden direct door de Shopping Assistant (Chrome-extensie) opgevraagd om maattabellen op partnersites (Zara, Asos) te lezen en de beste maat te adviseren.

5. **Levensstijl (Status, geslacht)**
   - **Belang**: Past standaardaanbevelingen aan en scoort inhoudsalgoritmen.
   - **Afhankelijkheden**: Geslachtselectie beïnvloedt direct het rankingalgoritme van de dagelijkse Trend Scout-kaarten. Als de categorie van een nieuwskaart niet overeenkomt met het geslacht van de gebruiker, past het algoritme een aftrek van -2.0 punten toe, waardoor de kaart in de feed naar achteren wordt geschoven.

6. **AI-configuratie (SaaS-sleutels, edge-modus, credits)**
   - **Belang**: Bepaalt de facturering, operationele prestaties en netwerkstatus.
   - **Afhankelijkheden**: Stuurt aanvragen voor tekst- en audiogeneratie door. Standaardinstellingen verbruiken credits van DressApp. Het invoeren van persoonlijke API-sleutels (Google AI Studio, Anthropic, OpenAI) verlegt de kosten naar de ontwikkelaarsaccounts van de gebruiker. Selecteren van de lokale edge-modus stuurt queries naar de offline Gemma-container.

7. **Planner & Push-berichten (Frequentie, dagelijks alarm, stijlfocus)**
   - **Belang**: Beheert het automatische dagelijkse verzenden van stijlaanbevelingen.
   - **Afhankelijkheden**: Activeert `APScheduler`-cron-taken op de FastAPI-backend. Elke ochtend worden pushmeldingen via `pywebpush` verzonden met behulp van de VAPID-sleutels van de client, in overeenstemming met de geselecteerde stijlparameters.

8. **Google Calendar (OAuth-synchronisatie, exportregels)**
   - **Belang**: Verbindt uw kledingkast rechtstreeks met uw echte agenda-evenementen.
   - **Afhankelijkheden**: Vereist verificatie via Google OAuth. De planner raadpleegt uw agenda om evenementen te identificeren, outfits te genereren en deze rechtstreeks naar uw Google Calendar te exporteren.

9. **Locatieservices (GPS-tracking, weersnauwkeurigheid)**
   - **Belang**: Coördineert aan het weer aangepaste voorstellen en geografische filters voor lokale transacties.
   - **Afhankelijkheden**: Activeert `navigator.geolocation` omgekeerde geocodering. De coördinaten worden naar de OpenWeatherMap API gestuurd om aanbevelingen aan te passen (bijv. regenkleding bij zware regenval). Berekent ook afstanden voor Marketplace-items en experts in de buurt.

10. **Stem & taal (Stemkeuze van de virtuele stylist)**
    - **Belang**: Bepaalt de vertaling van teksten en het stemprofiel.
    - **Afhankelijkheden**: Regelt de actieve taal voor vertalingen via `react-i18next`. De stemkeuze koppelt BCP-47-stemcodes (bijv. `he-IL` of `ar-JO`) aan stemuitvoer in de browser of offline Piper-modellen.

11. **Vrienden uitnodigen (Deel-API)**
    - **Belang**: Biedt een virale groeicyclus voor gratis kastuitbreidingen.
    - **Afhankelijkheden**: Voegt de MongoDB-ID van de verwijzer toe aan de URL. Nieuwe registraties lezen deze ID en verhogen de `closet_capacity_bonus` van de verwijzer automatisch met +10 plaatsen, waardoor de capaciteitslimieten in `closet.py` worden bijgewerkt.

---

## 3.4 Dashboard voor kledingkaststatistieken
Analyseer de totale kledingkastwaarde, het volgen van kledinggebruik en CPW-parameters.

1. Navigeer naar **Wardrobe Insights**.
2. **Controleer de statistieken**:
   - *Waarde van de kledingkast (Closet Worth)*: Dynamische som van de aankoopprijzen.
   - *Kastgebruik (Closet Utilization)*: Percentage kledingstukken dat minimaal één keer is gedragen.
   - *Gemiddelde kosten per keer dragen (CPW)*: Berekend als `Prijs / Aantal keren gedragen`.
3. **Verdelingsgrafieken**: Wissel van tabblad om Recharts-visualisaties te bekijken:
   - *Kleurenpalet*: Verdeling van de hex-kleurwaarden in de kledingkast.
   - *Materialen*: Procentuele materiaalverdeling.
   - *Subcategorieën*: Verdeling van de subcategorieën.
4. **Efficiëntie-ranglijst**: Toont de 5 kledingstukken met de laagste CPW-waarden.

---

## 3.5 Outfit-Canvas & Planner
Maak outfits, combineer lagen en bekijk voorstellen op het interactieve 2D-avatar-canvas.

1. Open de **Outfit Canvas** planner.
2. **Lagen van buitenkleding (Dubbel canvas)**: Als uw outfit buitenkleding (bijv. een jas) over een top bevat, toont de pagina twee verticale avatars: "With Outerwear" (toont de jas in de buitenste laag) and "Without Outerwear" (toont de onderliggende top).
3. **Interactieve 2D-elementen**: Klik direct op een kledingstuk op het lichaam van de avatar om direct naar het detailscherm van dat item te gaan.
4. **Tabblad Statistieken**: Klik op de knop Details en kies het tabblad **Metrics** om compatibiliteitscriteria te bekijken:
   - *Kleurharmonie* (neutrale harmonie).
   - *Patrooncompatibiliteit* (vermijden van patroonconflicten).
   - *Pasvorm* (maatovereenkomst).
   - *Weergeschiktheid* (seizoensgeschiktheid).
   - *Gelegenheidsgeschiktheid* (gelegenheidsovereenkomst).
   - *Locatiecompatibiliteit* (controle van de bescheidenheidsregels).
5. **Hernoemen/Beschrijven**: Klik op het potloodpictogram om outfitnamen en -beschrijvingen te bewerken.

---

## 3.6 Kofferassistent (Vakantieplanner)
Organiseer uw paklijst voor reizen om overbagage te voorkomen.

1. Ga naar de pagina **Suitcase** en vul het reisinformatieformulier in (bestemming, reisedata, reiscategorie, agenda-evenementen).
2. De AI genereert een gepersonaliseerde paklijst en dagelijkse outfits op basis van de reisduur en lokale weersvoorspellingen.
3. Controleer de voortgang van het inpakken. Als een belangrijk item ontbreekt (bijv. paraplu bij regen, badkleding voor het strand), waarschuwt het systeem u en stelt passende items voor uit de Marketplace of van winkels in de buurt.
4. Gebruik het geïntegreerde chatveld om suggesties aan te passen (bijv. "Verander dag 2 in informele avondkleding"). De assistent werkt de lijst bij en behoudt de rest.
5. Tik op **Approve Suitcase** om uw inpakplan definitief goed te keuren.

---

## 3.7 Planner & dagelijkse herinneringen
Stel dagelijkse stylingherinneringen in om automatisch outfit-aanbevelingen op uw telefoon te ontvangen.

1. Open **Profile** en ga naar **Scheduler & Push**.
2. Schakel meldingen in, stel de dagelijkse waarschuwingstijd, de weekdagfrequentie en het stylingthema in.
3. Elke ochtend controleert de achtergrondtaak (`APScheduler`) de weersvoorspelling en verzendt een pushmelding.
4. Tik op de melding op uw apparaat (of ga naar het meldingencentrum in de web-app) om een dialoogvenster met 3 outfitvoorstellen te openen.
5. Sla een aanbeveling rechtstreeks op in uw **Wardrobe Diary**.

---

## 3.8 Circulaire marktplaats (Verkoop, Verhuur, Ruil, Donaties)
Neem deel aan de peer-to-peer circulaire modemarktplaats.

- **Advertentie maken**: Open de detailpagina van een item, selecteer **Edit Intent** en kies een openbare intentie:
  - *For Sale*: Voer de verkoopprijs en valuta in (detecteert automatisch uw lokale valuta via uw regionale instellingen).
  - *Rent*: Bepaal de dagelijkse huurprijs en de leenvoorwaarden.
  - *Swap*: Markeer het item als ruilbaar.
  - *Donate*: Schenk het item gratis.
- **Statussynchronisatie**: Advertenties worden automatisch op de marktplaats geplaatst. De frontend gebruikt `useSyncExternalStore` en lokale IndexedDB-cache om zoekresultaten zonder vertraging te laden.
- **Passandbox**: Kopers/huurders kunnen voor het afronden van de transactie een virtuele pasproef van het item uitvoeren ten opzichte van kledingstukken in hun eigen kast.
- **Transactieafwikkeling**:
  - *Koop/Huur*: Rond de transactie af via de geïntegreerde PayPal-knoppen. Webhooks informeren de verkoper, wijzigen de itemstatus naar verkocht/verhuurd en boeken de transactie minus de 7% platformkosten in het boekingsjournaal.
  - *Ruil*: Geïnteresseerden stellen ruiltransacties voor. De eigenaar ontvangt e-mails ter acceptatie of afwijzing.

---

## 3.9 Beheerdersdashboard (Admin Panel)
Controle van de systeemwerking, financiële boekhouding en beheer van gebruikersaccounts.

1. Navigeer naar `/admin` (beschikbaar voor gebruikers met beheerdersrechten).
2. **Overzicht**: Controleer het transactievolume en de inkomsten uit platformkosten. Analyseer de tabel **Provider Activity Table** om responstijden en foutpercentages van externe diensten (Gemini API, weer-API) te controleren.
3. **Aanbieders (Providers)**: Klik op **Verify Key** om een test-ping naar de Gemini API te sturen. Schakel de schakelaar **Eyes Vision Override** om om de beeldanalyse om te leiden tussen het standaard Gemini-eindpunt and een lokale Gemma-container.
4. **Gebruikers**: Toon actieve credits, rollen en totale betalingen. Gebruik directe acties om gebruikers te promoveren of te degraderen.
5. **Advertenties (Listings)**: Toon de status van advertenties en deactiveer items in geval van vermoeden van fraude.

---

## 4. Verwachte resultaten

- **Import**: Artikelen worden direct in het kledingkast-raster geladen (~16 ms). De achtergrond wordt netjes verwijderd en levert transparante PNG's op.
- **DPP-verificatie**: Het scannen van geldige productpaspoorten toont de groene infokaart met duurzaamheidsdetails.
- **Avatar-bovenkleding**: Jassen en mantels worden correct over tops op de 2D-avatar-canvas weergegeven, zonder hoofddeksels of schoenen te oversnijden.
- **Spraakantwoord**: Tekstuitvoer van de virtuele stylist wordt automatisch als audio uitgegeven, vergezeld van een visuele golfvorm.
- **Abonnementen**: De activering van Pro verwijdert direct de waarschuwing voor de limiet van 150 artikelen.
- **Invoer**: Items worden onmiddellijk in het kledingkastraster weergegeven (~16 ms). De achtergrondverwijdering verloopt netjes en levert transparante PNG-bestanden op.
- **DPP-verificatie**: Het scannen van geldige productpaspoorten toont een groene informatiekaart met duurzaamheidsdetails.
- **Avatar-lagen**: Buitenkleding wordt correct over tops weergegeven op het 2D-avatar-canvas, zonder clippingfouten bij hoofddeksels/schoenen.
- **Spraakuitvoer**: Tekstuitvoer van de AI Stylist wordt automatisch voorgelezen, vergezeld van een visuele golfvormweergave.
- **Abonnementen**: Na het upgraden naar de Manager- of Professional-plan verdwijnt de capaciteitswaarschuwing van de kledingkast direct.

---

## 5. Problemen oplossen

### HTTP 402 Payment Required
- **Problem**: Import geblokkeerd. U hebt de maximale basislimiet van 150 kledingkast-artikelen bereikt.
- **Oplossing**: Ga naar Profile -> Subscription en upgrade naar Pro, of deel uw uitnodigingslink om +10 plaatsen per registratie te ontvangen.

### SSRF geblokkeerd / DNS-fout bij DPP
- **Probleem**: De URL van het gescande QR-paspoort kan niet worden opgelost.
- **Oplossing**: De parser blokkeert private IP-adressen (bijv. `127.0.0.1`, `192.168.x.x`) om interne servers te beschermen. Zorg ervoor dat QR-codes naar openbare domeinen verwijzen.

### Cameramachtiging / Microfoonmachtiging geweigerd
- **Probleem**: De camera- of scanweergave toont een foutmelding met een 'X', of de spraakinvoer mislukt.
- **Oplossing**: Open de browserinstellingen, sta het domein toegang toe tot camera en microfoon en laad de pagina opnieuw.

### Fout in Stylist-chat / Ratenbegrenzing (Rate Limits)
- **Probleem**: De chat toont fouten of bevriest.
- **Oplossing**: De server vangt Gemini `429` ratenbegrenzingen op en wijkt uit naar een regelgebaseerd kledingkast-selectiealgoritme. Controleer uw internetverbinding.

### VPS-geheugenoverbelasting (Out of Memory - OOM)
- **Probleem**: CPU-/RAM-pieken tijdens de afbeelding-upload.
- **Oplossing**: De import verwerkt batches van meer dan 5 artikelen via sequentiële wachtrijsloten. Zorg ervoor dat de server over minimaal 4 GB RAM beschikt.
- **Probleem**: Kledinginvoer geblokkeerd. U heeft de basislimiet van 50 items bereikt (of tot 200 items door verwijzingsbonussen).
- **Oplossing**: Ga naar de **tarievenpagina** (`/pricing`) en neem een abonnement op de Manager- of Professional-plan, of deel uw verwijzingslink om +10 plaatsen per registratie te krijgen (tot maximaal 200 items).

### SSRF-blokkering / DNS-fout bij DPP
- **Probleem**: URL van de gescande QR-productpas kan niet worden geanalyseerd.
- **Oplossing**: De parser blokkeert private IP-adressen (bijv. `127.0.0.1` en `192.168.x.x`) om interne servers te beschermen. Zorg ervoor dat QR-codes naar openbare domeinen verwijzen.

### Cameramachtiging / microfoonmachtiging geweigerd
- **Probleem**: Het opname-/scanvenster toont een foutmelding met een 'X' of de spraakinvoer mislukt.
- **Oplossing**: Open de machtigingen in de browser, sta toegang tot camera en microfoon toe voor het domein en laad de pagina opnieuw.

### Stylist-chat mislukt / API-limieten bereikt
- **Probleem**: De chat bevriest of toont fouten.
- **Oplossing**: De server vangt Gemini `429` overbelastingsfouten op en wijkt uit naar een regelgebaseerd itemselectie-algoritme. Controleer uw internetverbinding.

### Geheugentekort (OOM) bij VPS-servers
- **Probleem**: Hoge CPU-/RAM-belasting bij uploadprocessen.
- **Oplossing**: De invoer maakt gebruik van sequentiële wachtrijsloten voor batch-uploads van meer dan 5 items. Zorg ervoor dat de server over minimaal 4 GB RAM beschikt.

---

## 6. Beperkingen

- **Browser-Web-Speech-API's**: De native spraak-naar-tekst-vertaling is beperkt tot Chrome en Safari; andere browsers maken gebruik van de standaard-tekstinvoer.
- **Offline-spraaksynthese**: De mobiele offline-synthese via Piper ONNX maakt gebruik van minder spraakprofielen dan de Gemini-audioverwerking aan de serverzijde.
- **Beperkingen van de afbeeldingsgrootte**: Avatars en profielafbeeldingen worden in de browser lokaal op 82% kwaliteit gecomprimeerd om in de MongoDB-limiet van 16 MB te passen.
- **Kassabonanalyse**: Sterk wazige, vervormde of handgeschreven kassabonnen kunnen mislukken bij het gegevensextractieproces.
- **Spraak-API's in de browser**: De geïntegreerde spraak-naar-tekst-transcriptie is beperkt tot Chrome en Safari; andere browsers vallen terug op standaard tekstinvoer.
- **Offline spraakuitvoer**: De mobiele offline spraaksynthese via Piper ONNX gebruikt minder stemprofielen in vergelijking met het Gemini-audiomodel op de server.
- **Afbeeldingsgroottebeperkingen**: Afbeeldingen die worden geüpload voor profiel of avatar worden in de browser gecomprimeerd tot een kwaliteit van 82% om binnen de limiet van 16 MB van MongoDB-documenten te passen.
- **Bonanalyse**: Bij zeer wazige, vervormde of handgeschreven bonnen kan de gegevensextractie mislukken.
