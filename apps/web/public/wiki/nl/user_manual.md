# DressApp Volledige Technische Gebruikershandleiding

Uitgebreide gebruikershandleiding en technisch naslagwerk voor het persoonlijke garderobe-ecosysteem van DressApp, de styling-engine, de circulaire marktplaats en het beheerdersdashboard.

---

## 1. Overzicht & Technologiestack

DressApp is een door AI aangedreven persoonlijke garderobebeheerder, stylingadviseur en circulaire marktplaats. Het helpt gebruikers om kledingstukken digitaal te beheren, automatisch vrijstaand te maken en van tags te voorzien, op het weer en de agenda afgestemde outfitaanbevelingen te ontvangen, EU Digitale Productpaspoorten (DPP) te scannen en kledingstukken te verhandelen.

### Kernwaardepropositie
- **Invoer van Digitale Garderobe**: Verwerking van camerafoto's of geüploade afbeeldingen met geautomatiseerde achtergrondverwijdering, kledingcategorisatie en het genereren van kenmerktags.
- **Virtuele AI-Stylist**: Een conversationele assistent die uw garderobe, Google Agenda-afspraken en lokale weersvoorspellingen in samenhang beoordeelt om dagelijkse outfits voor te stellen.
- **Circulaire Marktplaats**: Veilig peer-to-peer kopen, verkopen, ruilen en huren van kleding om afval door fast fashion te verminderen.
- **Cost-Per-Wear (CPW)-analyses**: Inzicht in de totale waarde van uw garderobe, benuttingsgraden en gebruiksoptimalisatie.

### Technologiearchitectuur
- **Backend Edge**: Python 3.11 met FastAPI, gebruikmakend van asynchrone Motor-drivers verbonden met een speciale on-premises MongoDB 7.0-database op NVMe-opslag.
- **Frontend SPA**: React 19 single-page applicatie met aangepaste `useSyncExternalStore`-stores (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, Shadcn/UI-componenten en `react-i18next` met ondersteuning voor 13 talen.
- **Status- & Netwerkoptimalisatie**: Deduplicatie van lopende verzoeken, 15-minuten store-caching en `visibilitychange`-tabbladvalidatie, wat resulteert in nul achtergrond-GET-verzoeken tijdens inactiviteit.
- **Lokale Machine Learning & Maatvoering**: CPU-lokale U2-Net (`rembg`) achtergrond-matting, SegFormer-b2 kledinganalyse, Fashion-CLIP-embeddings en het ANSUR II regressiemodel voor fysieke lichaamsmaten (`body_predictor.py`). Bevat de speciale on-premises `dressapp-eyes`-container met een gefinetuned `Qwen 2.5 VL 3B`-model (`Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj`) op poort 7860 voor gratis gebruikers (Free Tier) en automatische quotum-fallback.
- **Conversationele STT/TTS**: Realtime client-side Web Speech-herkenning als fallback, multimodale server-side Gemini-modulaties en on-device offline Piper/Sherpa-ONNX-engines.
- **Externe Integratiediensten**: OpenWeatherMap API voor het ophalen van weergegevens, Google Calendar OAuth voor het exporteren van dagschema's, OpenStreetMap (Nominatim) voor automatisch aanvullen van adressen, en PayPal Subscriptions/Checkout REST API's.

---

## 2. Vereisten

### Vereisten voor de Hostomgeving
- **Hardware**: VPS met minimaal 8 GB RAM (bijv. Hetzner CPX32 VPS waarop de productieomgeving `dressapp.co` wordt gehost).
- **Afhankelijkheden**: Docker & Docker Compose-stack (inclusief on-premises MongoDB 7.0, backend, eyes-inferentieserver, frontend en Caddy TLS-terminatie).
- **Omgevingsvariabelen**: Configuratie van API-sleutels (`GEMINI_API_KEY`, `EYES_API_TOKEN`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` en Google Calendar OAuth-tokens).

### Vereisten voor de Gebruikersapp
- **Webbrowser**: Google Chrome of Apple Safari (vereist voor volledige compatibiliteit met spraakfuncties).
- **Machtigingen**: Verleen cameramachtiging (voor kledingfoto's en QR-scans) en microfoonmachtiging (voor spraakgesprekken).
- **Gelaagde Zero-BYOK AI**: Gratis gebruikers maken gebruik van het on-premises Eyes-model (`Qwen 2.5 VL 3B`) van DressApp; abonnees met een Manager- of Professional-abonnement profiteren van het snelle Cloudmodel (`Gemini 3.5 Flash`). Er zijn geen door de gebruiker verstrekte API-sleutels nodig.
- **Netwerk**: Actieve internetverbinding voor LLM-verwerking, waarbij IndexedDB-caching zorgt voor het offline doorbladeren van de catalogus.

---

## 3. Stapsgewijze Instructies

### 3.1 Kledingstukken Invoeren (Items Toevoegen)
INVOERMETHODEN: Fotografie, EU Digitale Productpaspoorten en Digitale Aankoopbewijzen.

#### A. Interactieve Camera en Bestandsupload
1. Ga naar het scherm **Item toevoegen (Add Item)**.
2. Selecteer **Foto maken (Take Photo)** (opent de camera van uw mobiele apparaat) of klik op **Foto's uploaden (Upload Photos)** (opent de bestandskiezer van het besturingssysteem).
3. De client berekent de SHA-256 en horizontale verschil-hash (dHash) van de afbeelding in de browser (~100–180 ms) om te controleren of het item al in uw kledingkast staat.
4. Als er een overeenkomst wordt gevonden, verschijnt het **Duplicaatcontroledialoogvenster (Duplicate Preflight Dialog)** met overeenkomende voorbeelden. Kies **Overslaan (Skip)** of **Toch toevoegen (Add anyway)**.
5. Na acceptatie start de server een NDJSON-stream. Binnen 5–7 seconden wordt een voorlopig voorbeeldframe getoond, zodat u de itemgegevens direct kunt bewerken terwijl de backend het taggen voltooit.
6. Controleer de automatisch gedetecteerde tags (kleur, stof, pasvorm, patroon, gelegenheid). Als de vorm van de uitsnede niet klopt, wijzigt u het keuzemenu **Categorie (Category)**; hierdoor snijdt SegFormer het kledingstuk automatisch opnieuw uit.
7. Klik op **Opslaan (Save)** om het item direct optimistisch weer te geven in het kledingkastraster (~16 ms), terwijl op de achtergrond het genereren van WebP-miniaturen wordt afgerond.

#### B. EU Digitale Productpaspoorten (DPP) Scannen
1. Tik op de knop **Scan QR (DPP)** op de pagina Item toevoegen.
2. Verleen cameramachtigingen en richt de camera op de QR-code op het kledinglabel, of upload een opgeslagen screenshot van een QR-code.
3. De backend lost de URL op en voert SSRF-veiligheidscontroles uit (waarbij privé-IP-bereiken worden geblokkeerd).
4. Het systeem analyseert de JSON-LD-schema's om merk, materiaalsamenstelling, ketentraceerbaarheid, CO2-voetafdruk en onderhoudsinstructies te extraheren.
5. Controleer de geëxtraheerde gegevens in het groene accordeonpaneel **Geverifieerde DPP-gegevens (Verified DPP Data)** en klik op **Opslaan**.

#### C. Digitale Aankoopbewijzen Importeren
1. Open het tabblad **Digitale Import (Digital Import)**.
2. Kies een submodus: **Tekst plakken (Paste Text)**, **Afbeelding uploaden (Upload Image)**, **PDF uploaden (Upload PDF)** of voer een **Weblink** in.
3. De backend gebruikt multimodale vision-modellen om transactiegegevens (merk, prijs, maat, categorie) te extraheren.
4. Uitgelezen velden worden vergrendeld op basis van de bon om ze te beschermen tegen toekomstige visuele heranalyse. Klik op **Opslaan** om te bevestigen.

---

### 3.2 Conversationele Virtuele AI-Stylist
Beschrijf stylingdilemma's en ontvang handsfree gesproken outfitadvies.

1. Ga naar het scherm **AI Stylist**.
2. Klik op het microfoonpictogram `[Microphone]` in de chatinvoerbalk.
3. Spreek uw vraag in (bijv. "Welk bovenstuk past bij mijn beige broek voor een regenachtige lunch buiten?").
4. Als Web Speech wordt ondersteund, wordt uw spraak live uitgeschreven in het invoerveld. Zo niet, dan neemt de app een WebM-bestand op en uploadt dit.
5. De backend routeert vragen van gratis gebruikers naar de on-premises Eyes-container (gefinetuned `Qwen 2.5 VL 3B`) en routeert vragen van abonnees met een Manager- of Professional-abonnement naar het snelle Cloudmodel (`Google Gemini 3.5 Flash`), met automatische fallback naar on-premises Eyes bij cloudsnelheidslimieten.
6. De stylist verwerkt uw garderobegeschiedenis, lokale weersvoorspellingen en agenda-afspraken om een stylingvoorstel te formuleren.
7. De stylist spreekt het antwoord uit met behulp van vooraf geselecteerde stemprofielen (`puck`, `aoede` of `charon`).
8. Tik op **Antwoord afspelen (Play reply)** op de kaart om de gesproken audio opnieuw af te spelen.

---

### 3.3 Profiel, Voorkeuren en Subsysteemafhankelijkheden
De Profielpagina fungeert als het centrale bedieningspaneel voor DressApp. Configuratievelden hebben direct invloed op de prestaties, routering en werking van onderliggende modules.

##### Afhankelijkheden & Achtergrond van Accordeonsecties

1. **Foto's & Digitaal Avatarpodium (`AvatarViewer2D` & `DynamicAvatar`)**
   - **Waarom is dit belangrijk?**: Geeft uw visuele identiteit weer op alle pascanvassen via een tweevoudig podium (gesegmenteerde uitsnede van een echte lichaamsfoto vs. dynamische 2D Bézier-vector SVG-paspop).
   - **Subsysteemafhankelijkheden**: Foto-uitsneden worden vrijstaand gemaakt via lokale U2-Net (`rembg`) en in de browser verkleind tot maximaal 1280 px op 82% kwaliteit om binnen de documentlimiet van 16 MB van MongoDB te passen. Het podium past gekalibreerde positiepunten toe (`top-[14.5%]` kraag-tot-halslijn, `top-[36.5%]` tailleband-tot-taillelijn, `bottom-[2%]` schoenvlak) en proportionele borst-/heupschaling ($scaleX$). Klik op *Foto verwijderen* om direct terug te schakelen naar de 2D SVG-vectorpaspop.

2. **Stijlprofiel (Bescheidenheidsregels, Kledingvoorschrift)**
   - **Waarom is dit belangrijk?**: Stelt persoonlijke grenzen vast voor aanbevolen outfits en voorkomt dat de AI ongepaste stijlsuggesties genereert.
   - **Subsysteemafhankelijkheden**: De geselecteerde parameters (bijv. voorschriften voor bedekkende kleding) worden rechtstreeks meegenomen in de stylingprompts en filteren bijpassende garderobe-items voordat deze worden getoond.

3. **Gegevens (Naam, Telefoon, Beroep)**
   - **Waarom is dit belangrijk?**: Past de communicatietoon aan en stuurt meldingswaarschuwingen aan.
   - **Subsysteemafhankelijkheden**: De naam van de gebruiker wordt dynamisch verwerkt in e-mails en systeem-pushmeldingen. Het telefoonnummer dient als terugvaloptie voor geplande meldingen. Het beroep wordt doorgegeven aan het stylist-LLM en de personalisatie-ranking van Trend Scout om voorstellen op maat te maken.

4. **Lichaamsmaten & Maatvoering (ANSUR II Regressiemodel & Sizing Predictor)**
   - **Waarom is dit belangrijk?**: Maakt een einde aan giswerk bij maten en maakt automatische berekening van winkelmaten, externe maatvergelijking en nauwkeurig virtueel combineren van kledinglagen mogelijk.
   - **Subsysteemafhankelijkheden**: Het invoeren van 4 basisparameters (**Lengte**, **Gewicht**, **Taille**, **Voetlengte**) activeert het scikit-learn ANSUR II regressiemodel (`body_predictor.py`) om automatisch 6 structurele afmetingen te voorspellen (*Schouders*, *Borst*, *Heup*, *Mouw*, *Binnenbeenlengte*, *Buitenbeenlengte*).
     - **Deterministische Maatvertaling**: Zodra continue lichaamsmaten zijn voorspeld, zet de maat-engine van de backend deze dynamisch om in standaard winkelmaten: **Shirtmaat** (XS–XXL op basis van borstomvang), **Broekmaat** (taille in inches), **Schoenmaat** (US heren/dames en EU-standaarden op basis van voetlengte en geslacht), **Jurkmaat** (US 0–14+ op basis van borst, taille en heupen) en **Behamaat** (onderwijdte + cup op basis van borstomvang en geschatte onderborstomvang).
     - **Automatisch Invullen**: Deze aanbevolen winkelmaten worden automatisch ingevuld in de velden van de *Gedetailleerde Bewerkingsmodus* op het profieldashboard.
     - **Integraties**: Maten worden rechtstreeks opgevraagd door de contentscripts van de **Shopping Assistant** Chrome-extensie om maattabellen op partnerwebsites (Zara, Asos) uit te lezen en de juiste maat aan te bevelen.

5. **Levensstijl (Burgerlijke staat, Geslacht)**
   - **Waarom is dit belangrijk?**: Stemt standaardaanbevelingen af en berekent scores voor contentalgoritmen.
   - **Subsysteemafhankelijkheden**: De keuze van het geslacht heeft direct invloed op de rankinglogica van dagelijkse Trend Scout-kaarten. Als de categorie van een nieuwskaart niet overeenkomt met het geslacht van de gebruiker, past het algoritme een score-aftrek van -2,0 toe, waardoor de kaart lager in de feed wordt geplaatst.

6. **AI-modelroutering & Abonnementen (Gelaagde Zero-BYOK-routering & Credits)**
   - **Waarom is dit belangrijk?**: Bepaalt de gelaagde modelroutering en het creditverbruik zonder dat er API-sleutels van de gebruiker nodig zijn.
   - **Subsysteemafhankelijkheden**: Gratis gebruikers (Free Tier) worden gerouteerd naar de on-premises Eyes-container (gefinetuned `Qwen 2.5 VL 3B`). Abonnees met een Manager- of Professional-abonnement worden gerouteerd naar het snelle Cloudmodel (`Google Gemini 3.5 Flash`), met automatische quotum-fallback naar on-premises Eyes.

7. **Planner & Push (Frequentie, dagelijkse wekker, stijlfocus)**
   - **Waarom is dit belangrijk?**: Beheert automatische dagelijkse stijl-pushmeldingen.
   - **Subsysteemafhankelijkheden**: Activeert `APScheduler`-crontaken op de FastAPI-backend. Elke ochtend verstuurt het systeem pushmeldingen via `pywebpush` met behulp van de VAPID-sleutels van de client, afgestemd op de geselecteerde stijlfocusparameters.

8. **Google Agenda (OAuth-synchronisatie, exportregels)**
   - **Waarom is dit belangrijk?**: Verbindt uw garderobe rechtstreeks met uw daadwerkelijke agenda-afspraken.
   - **Subsysteemafhankelijkheden**: Authenticeert via Google OAuth. De planner raadpleegt uw agenda om afspraken te herkennen, stelt outfits samen en plaatst outfitafspraken rechtstreeks in uw Google Agenda.

9. **Locatiediensten (Gps-locatie, weernauwkeurigheid)**
   - **Waarom is dit belangrijk?**: Coördineert weersbestendige suggesties en straalfilters voor lokale transacties.
   - **Subsysteemafhankelijkheden**: Activeert `navigator.geolocation` reverse-geocoding. Coördinaten worden naar de OpenWeatherMap API gestuurd om de aanbevelingen van de stylist aan te passen (bijv. regenkleding bij stortbuien). Daarnaast berekent het afstanden voor lokale Marktplaatsadvertenties en experts.

10. **Stem & Taal (Stemselectie voor virtuele stylist)**
    - **Waarom is dit belangrijk?**: Bepaalt de taalwoordenboeken en stemmodulaties.
    - **Subsysteemafhankelijkheden**: Beheert de actieve vertaaltaal via `react-i18next`. De stemselectie koppelt BCP-47-stemcodes (bijv. `he-IL` of `ar-JO`) aan Web Speech-synthesestemmen van de client of offline Piper TTS-modellen.

11. **Vrienden Uitnodigen (Share-payload API)**
    - **Waarom is dit belangrijk?**: Biedt een virale groeilus voor gratis uitbreiding van uw kledingkastcapaciteit.
    - **Subsysteemafhankelijkheden**: Voegt de MongoDB-ID van de doorverwijzer toe aan de URL. Nieuwe registraties vragen deze ID dynamisch op en verhogen de `closet_capacity_bonus` van de doorverwijzer atomair met +10 plaatsen, waarmee de limietbewakers in `closet.py` worden bijgewerkt.

---

### 3.4 Dashboard voor Garderobe-inzichten (Wardrobe Insights)
Analyseer de kapitaalwaarde van uw garderobe, volg het gebruik van kledingstukken en bekijk cost-per-wear-statistieken.

1. Ga naar **Wardrobe Insights**.
2. **Bekijk Statistieken**:
   - *Kledingkastwaarde (Closet Worth)*: Dynamische optelsom van aankoopprijzen.
   - *Kledingkastbenutting (Closet Utilization)*: Percentage kledingstukken in de kast dat ten minste één keer is gedragen.
   - *Gemiddelde Kosten per Keer Dragen (CPW)*: Berekend als `Prijs / Aantal keer gedragen`.
3. **Verdelingsgrafieken**: Schakel tussen tabbladen om Recharts-visualisaties te bekijken:
   - *Kleurenpalet*: Verdeling van gekoppelde hex-kleurcodes.
   - *Materialen*: Procentuele verdeling van stoffen.
   - *Subcategorieën*: Gekoppelde subcategorieën.
4. **Efficiëntie-ranglijst (Efficiency Leaderboard)**: Bekijk de top 5 kledingstukken met de laagste Cost-per-Wear-scores.

---

### 3.5 Outfit Canvas & Planner
Bouw, combineer lagen en beoordeel outfitvoorstellen op een interactief 2D-avatarcanvas.

1. Open de **Outfit Canvas**-planner.
2. **Bovenkleding in Lagen (Dubbel Canvas)**: Als uw outfit bovenkleding (bijv. een jas) over een bovenstuk bevat, toont de pagina twee verticale canvasmodules: "Met Bovenkleding" (toont de jas als bovenste laag) en "Zonder Bovenkleding" (toont het bovenstuk eronder).
3. **Interactieve 2D-elementen**: Tik direct op een kledingstuk op het lichaam van de avatar. De app stuurt u rechtstreeks naar het detailscherm van dat kledingstuk.
4. **Tabblad Statistieken (Metrics) Bekijken**: Klik op de detailknop en kies het tabblad **Metrics** om voortgangsbalken te bekijken voor compatibiliteitscriteria:
   - *Kleurharmonie (Color Harmony)* (neutrale harmonie)
   - *Patrooncompatibiliteit (Pattern Compatibility)* (voorkomen van vloekende patronen)
   - *Lichaamspasvorm (Body Fitting)* (maatovereenkomst)
   - *Weermatch (Weather Match)* (geschiktheid voor het seizoen)
   - *Evenementmatch (Event Match)* (geschiktheid voor de activiteit)
   - *Locatiematch (Location Match)* (controle op bescheidenheidsregels)
5. **Hernoemen/Beschrijven**: Klik op het potloodpictogram om outfitnamen en -beschrijvingen te bewerken.

---

### 3.6 Kofferassistent (Suitcase Assistant)
Organiseer uw paklijst voor reizen zonder te veel in te pakken.

1. Ga naar de pagina **Suitcase** en vul het reiscontextformulier in (bestemming, begin-/einddatum, reiscategorie, agenda-afspraken).
2. De AI genereert een gepersonaliseerde paklijst en dagelijkse outfits op basis van de reisduur en weersvoorspellingen.
3. Controleer de inpakvoortgang. Als er een belangrijk item ontbreekt (bijv. een paraplu bij regen of zwemkleding voor het strand), waarschuwt het systeem u en stelt het passende items voor van de marktplaats of lokale winkels.
4. Gebruik het geïntegreerde chatvenster om suggesties te verfijnen (bijv. "Verander dag 2 in casual avondkleding"). De assistent past de koffer aan met behoud van de rest van de lijst.
5. Tik op **Koffer Goedkeuren (Approve Suitcase)** om uw reisplanning definitief te maken.

---

### 3.7 Planner & Pushherinneringen
Stel dagelijkse stylingmeldingen in om automatisch outfitaanbevelingen te ontvangen.

1. Open **Profiel** en ga naar **Planner & Push (Scheduler & Push)**.
2. Schakel meldingen in, stel een dagelijkse meldingstijd, weekdagfrequentie en stylingfocusthema in.
3. Elke ochtend controleert de achtergrond-crontaak (`APScheduler`) de weersvoorspellingen en verstuurt een pushmelding.
4. Tik op de melding op uw apparaat (of bekijk het Meldingencentrum in de webapp) om een voorsteldialoogvenster te openen met 3 gestylede suggesties.
5. Sla een suggestie rechtstreeks op in uw **Garderobedagboek (Wardrobe Diary)**.

---

### 3.8 Marktplaats (Doorverkoop, Verhuur, Ruilen, Weggeven)
Neem deel aan de peer-to-peer circulaire modemarktplaats.

- **Een Advertentie Aanmaken**: Open de detailpagina van een item, selecteer **Intentie bewerken (Edit Intent)** en kies een openbare optie:
  - *Te Koop (For Sale)*: Voer de vraagprijs en valuta in (detecteert automatisch uw standaardvaluta via regionale taalvoorkeuren).
  - *Te Huur (Rent)*: Stel het dagelijkse huurtarief en de leenvoorwaarden in.
  - *Ruilen (Swap)*: Markeer het item als beschikbaar voor ruil.
  - *Doneren (Donate)*: Bied het item gratis aan.
- **Statussynchronisatie**: Advertenties worden automatisch doorgezet naar de feed. De client gebruikt `useSyncExternalStore` en IndexedDB-caching om zoekparameters zonder vertraging te laden.
- **Pas-sandbox (Try-On Sandbox)**: Huurders en kopers kunnen een aangeboden kledingstuk vóór het afrekenen virtueel passen in combinatie met items uit hun eigen privékledingkast.
- **Transactioneel Afrekenen**:
  - *Kopen/Huren*: Voltooi de transactie via de geïntegreerde PayPal-knoppen. Vastgelegde webhooks brengen de verkoper op de hoogte, zetten de advertentiestatus op verkocht/verhuurd en registreren de transactie in het grootboek minus 7% platformkosten.
  - *Ruilen (Swapping)*: Geïnteresseerde ruilers doen een ruilvoorstel. De aanbieder ontvangt bevestigingsmails om het voorstel te accepteren of af te wijzen.

---

### 3.9 Beheerdersdashboard (Admin Panel)
Validatie van systeembeschikbaarheid, financiële boekhouding en beheer van gebruikersaccounts.

1. Ga naar `/admin` (beschikbaar voor beheerdersrollen).
2. **Overzicht (Overview)**: Controleer het brutovolume en overzichten van inkomsten uit platformkosten. Inspecteer de **Provider Activity Table** om beschikbaarheidsstatistieken van externe diensten (Gemini API, latentie van weerdiensten en foutpercentages) te bekijken.
3. **Providers**: Klik op **Verify Key** om een directe ping naar de Gemini API te sturen. Zet de schakelaar **Eyes Vision Override** om om beeldanalyse te schakelen tussen het standaard Gemini-eindpunt en de lokale container.
4. **Gebruikers (Users)**: Bekijk actieve credits, rollen en totale betalingen. Gebruik directe acties om gebruikers te promoveren of te degraderen.
5. **Advertenties (Listings)**: Bekijk de status van advertenties en schakel actieve vlaggen om om frauduleuze items op te schorten.

---

## 4. Verwachte Resultaten

- **Invoer**: Items verschijnen onmiddellijk in het kledingkastraster (~16 ms). Achtergronduitsneden leveren strakke, transparante PNG-resultaten op.
- **DPP Geverifieerd-badge**: Het scannen van geldige productpaspoorten toont de groene informatiekaart met duurzaamheidsdetails.
- **Avatar-bovenkleding**: Bovenkleding wordt op het 2D-avatarcanvas correct in lagen over bovenstukken weergegeven zonder hoofddeksels of schoenen af te snijden.
- **Spraakantwoord**: Tekstantwoorden van de Virtuele Stylist spelen automatisch gesproken audio af met een zichtbare geluidsgolfindicator.
- **Abonnementen**: Upgraden naar een Manager- of Professional-abonnement verwijdert onmiddellijk de waarschuwing voor de capaciteitslimiet van de kledingkast.

---

## 5. Probleemoplossing

### HTTP 402 Payment Required
- **Probleem**: Invoer van kleding geblokkeerd. U hebt de basislimiet van 50 kledingkastitems bereikt (of tot 150 items met doorverwijzingsbonussen).
- **Oplossing**: Ga naar de **Prijzenpagina** (`/pricing`) en neem een Manager- of Professional-abonnement, of deel uw uitnodigingslink om +10 plaatsen per registratie te ontvangen (tot maximaal 150 items).

### SSRF Geblokkeerd / DNS-fout bij DPP
- **Probleem**: Gescande URL van het QR-productpaspoort kan niet worden verwerkt.
- **Oplossing**: De parser blokkeert privé-IP-adressen (bijv. `127.0.0.1`, `192.168.x.x`) om interne servers te beschermen. Zorg ervoor dat QR-codes verwijzen naar openbare domeinen.

### Camera- / Microfoonmachtiging Geweigerd
- **Probleem**: Het opname-/scanscherm toont een 'X'-foutscherm of spraakinvoer mislukt.
- **Oplossing**: Open uw browsermachtigingen, schakel toegang tot Camera en Microfoon in voor het domein en laad de pagina opnieuw.

### Stylist-chatfout / Snelheidslimieten (Rate Limits)
- **Probleem**: De chat toont fouten of loopt vast.
- **Oplossing**: De server vangt Gemini `429`-snelheidslimieten op en valt automatisch terug op de on-premises Eyes-engine of het op regels gebaseerde kledingselectie-algoritme. Controleer uw internetverbinding.

### Geheugenpieken (OOM) op de VPS
- **Probleem**: CPU-/RAM-pieken tijdens uploadprocessen.
- **Oplossing**: Het invoerproces maakt gebruik van sequentiële wachtrijvergrendelingen voor batches van >5 items. Zorg ervoor dat de server beschikt over ten minste 4 GB (aanbevolen 8 GB) RAM.

---

## 6. Beperkingen

- **Browser Web Speech API's**: Ingebouwde spraak-naar-tekst-transcriptie is beperkt tot Chrome en Safari; andere browsers vallen terug op standaard tekstinvoer.
- **Offline Client-modulaties**: Mobiele offline Piper ONNX-spraaksynthese gebruikt minder stemprofielen dan de server-side Gemini-audiomodule.
- **Beperkingen op Afbeeldingsgrootte**: Avatar- en profieluploads worden lokaal in de browser gecomprimeerd tot 82% kwaliteit om binnen de MongoDB-documentlimiet van 16 MB te passen.
- **Bereik van Bonanalyse**: Bij sterk vervaagde, vervormde of handgeschreven kassabonnen kan de gegevensextractie mislukken.
