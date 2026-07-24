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

---

## 2. Vereisten

### Vereisten voor de hostomgeving
- **Hardware**: Minimaal 4 GB RAM VPS (bijv. Hetzner VPS voor het hosten van de productie-omgeving `dressapp.co`).
- **Afhankelijkheden**: Docker & Docker Compose-stack (inclusief backend, frontend en Caddy TLS-beëindiging).
- **Omgevingsvariabelen**: Configuratie van API-sleutels (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` en Google Calendar OAuth-tokens).

### Vereisten voor de gebruikersapp
- **Webbrowser**: Google Chrome of Apple Safari (vereist voor volledige compatibiliteit met spraakfuncties).
- **Machtigingen**: Toegang verlenen tot de camera (voor kledingfoto's en QR-scans) en de microfoon (voor spraakgesprekken).
- **Netwerk**: Actieve verbinding voor de LLM-verwerking, waarbij IndexedDB-caching offline bladeren in de catalogus mogelijk maakt.

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

---

## 4. Verwachte resultaten

- **Import**: Artikelen worden direct in het kledingkast-raster geladen (~16 ms). De achtergrond wordt netjes verwijderd en levert transparante PNG's op.
- **DPP-verificatie**: Het scannen van geldige productpaspoorten toont de groene infokaart met duurzaamheidsdetails.
- **Avatar-bovenkleding**: Jassen en mantels worden correct over tops op de 2D-avatar-canvas weergegeven, zonder hoofddeksels of schoenen te oversnijden.
- **Spraakantwoord**: Tekstuitvoer van de virtuele stylist wordt automatisch als audio uitgegeven, vergezeld van een visuele golfvorm.
- **Abonnementen**: De activering van Pro verwijdert direct de waarschuwing voor de limiet van 150 artikelen.

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

---

## 6. Beperkingen

- **Browser-Web-Speech-API's**: De native spraak-naar-tekst-vertaling is beperkt tot Chrome en Safari; andere browsers maken gebruik van de standaard-tekstinvoer.
- **Offline-spraaksynthese**: De mobiele offline-synthese via Piper ONNX maakt gebruik van minder spraakprofielen dan de Gemini-audioverwerking aan de serverzijde.
- **Beperkingen van de afbeeldingsgrootte**: Avatars en profielafbeeldingen worden in de browser lokaal op 82% kwaliteit gecomprimeerd om in de MongoDB-limiet van 16 MB te passen.
- **Kassabonanalyse**: Sterk wazige, vervormde of handgeschreven kassabonnen kunnen mislukken bij het gegevensextractieproces.