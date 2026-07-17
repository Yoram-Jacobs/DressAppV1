# DressApp Volledige technische gebruikershandleiding

Uitgebreide gebruikershandleiding en technische naslaggids voor het DressApp-ecosysteem voor persoonlijke garderobe, stylingengine, circulaire marktplaats en administratiepanelen.

---

## 1. Overzicht en technologiestapel

DressApp is een AI-gestuurde persoonlijke garderobemanager, stylingadviseur en circulaire marktplaats. Het helpt gebruikers kledingstukken digitaal te beheren, ze automatisch bij te snijden en te taggen, weer- en kalenderbewuste outfitaanbevelingen te ontvangen, EU Digital Product Passports (DPP) te scannen en kleding te verhandelen.

### Kernwaardepropositie
- **Inname van digitale kledingkast**: momentopname of upload fotoverwerking met automatische achtergrondverwijdering, kledingcategorisatie en genereren van attribuuttags.
- **AI Virtual Stylist**: een conversatieagent die contextueel uw garderobe, Google Agenda-evenementen en lokale weersvoorspellingen beoordeelt om dagelijkse outfits voor te stellen.
- **Circulaire marktplaats**: veilig peer-to-peer kopen, verkopen, ruilen en huren van kleding om fast fashion-verspilling te verminderen.
- **Cost-Per-Wear (CPW) Analytics**: inzicht in de waarde van garderobekapitalisatie, bezettingsgraden en gebruiksoptimalisatie.

### Technologie Architectuur
- **Backend Edge**: Python 3.11 met FastAPI, met behulp van asynchrone motorstuurprogramma's verbonden met een MongoDB Atlas-cluster.
- **Frontend SPA**: React 19 applicatie van één pagina die gebruik maakt van Tailwind CSS, Shadcn/UI-primitieven, wereldwijde Zustand-winkels, IndexedDB lokale caching en `react-i18next` die 12 landinstellingen ondersteunt.
- **Lokale Machine Learning**: CPU-lokale U2-Net (`rembg`) achtergrondmatten, SegFormer-b2 kledingparsering en Fashion-CLIP-insluitingen. Optioneel routes naar zelf-gehoste GPU-containers (SegFormer-b3 + BiRefNet) voor snelle bewerkingen.
- **Conversationele STT/TTS**: real-time terugval op webspraakherkenning aan de clientzijde, multimodale Gemini 2.5 Flash-modulaties op de server en offline Piper/Sherpa-ONNX-engines op het apparaat.
- **Externe integratieservices**: OpenWeatherMap API voor het ophalen van het weer, Google Agenda OAuth voor het exporteren van dagelijkse schema's en PayPal-abonnementen/Checkout REST API's.

---

## 2. Vereisten

### Vereisten voor de hostomgeving
- **Hardware**: Minimaal 4 GB RAM VPS (bijvoorbeeld Hetzner VPS die de productie `dressapp.co` host).
- **Afhankelijkheden**: Docker & Docker Compose-stack (inclusief backend, frontend en Caddy TLS-beëindiging).
- **Omgevingsvariabelen**: configuratie van API-sleutels (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` en Google Agenda OAuth-tokens).

### Vereisten voor gebruikersapps
- **Webbrowser**: Google Chrome of Apple Safari (vereist voor volledige compatibiliteit met spraakfuncties).
- **Machtigingen**: Verleen cameratoestemming (voor kledingsnapshots en QR-scans) en microfoontoestemming (voor spraakgesprekken).
- **Netwerk**: Actieve verbinding voor LLM-verwerking, met IndexedDB-caching voor offline bladeren door catalogi.

---

## 3. Stapsgewijze instructies

### 3.1 Kleding innemen (items toevoegen)
OPNAMEPARADIGMEN: Fotografie, EU-productpaspoorten en ontvangstbewijzen voor digitale handel.

#### A. Interactieve camera en bestandsupload
1. Navigeer naar het scherm **Item toevoegen**.
2. Selecteer **Foto maken** (start de eigen mobiele camera) of klik op **Foto's uploaden** (opent de OS-bestandskiezer).
3. De client berekent de SHA-256 en de horizontale verschil-hash (dHash) van de afbeelding in de browser (~100-180 ms) om te vergelijken met uw bestaande kast.
4. Als er een overeenkomst wordt gevonden, wordt het **Duplicaatpreflightdialoogvenster** geopend met overeenkomende voorbeelden. Selecteer **Overslaan** of **Toch toevoegen**.
5. Na acceptatie start de server een NDJSON-stream. Binnen 5-7 seconden wordt een plaatsaanduidingsvoorbeeldvenster weergegeven, zodat u de itemdetails onmiddellijk kunt bewerken terwijl de backend het taggen voltooit.
6. Controleer automatisch gedetecteerde tags (kleur, stof, pasvorm, patroon, gelegenheid). Als de uitgesneden vorm onjuist is, wijzigt u de vervolgkeuzelijst **Categorie**; dit zorgt ervoor dat SegFormer het kledingstuk automatisch opnieuw bijsnijdt.
7. Klik op **Opslaan** om het item optimistisch onmiddellijk in het kastraster te schilderen (~16 ms) terwijl het genereren van de WebP-miniaturen op de achtergrond eindigt.

#### B. Scannen van EU digitale productpaspoorten (DPP)
1. Tik op de knop **QR scannen (DPP)** op de pagina Item toevoegen.
2. Verleen camerarechten en lijn de QR-code uit die op het winkellabel van het kledingstuk is afgedrukt, of upload een opgeslagen QR-screenshot.
3. De backend lost de URL op en voert SSRF-veiligheidscontroles uit (blokkeert privé-IP-bereiken).
4. Het systeem schrapt de JSON-LD-schema's om merk, materiaalsamenstelling, tracering van de toeleveringsketen, ecologische voetafdruk en zorgrichtlijnen te extraheren.
5. Bekijk de geëxtraheerde gegevens die worden weergegeven in het groene accordeonpaneel **Geverifieerde DPP-gegevens** en klik op **Opslaan**.

#### C. Digitale handelsbewijzen importeren
1. Open het tabblad **Digitaal importeren**.
2. Kies een submodus: **Tekst plakken**, **Afbeelding uploaden**, **PDF uploaden** of voer een **Weblink** in.
3. De backend maakt gebruik van multimodale visiemodellen om transactiefeiten (merk, prijs, grootte, categorie) te extraheren.
4. Geparseerde velden worden vergrendeld om ze te beschermen tegen toekomstige visuele heranalyse. Klik op **Opslaan** om te bevestigen.

---

### 3.2 Conversationele AI Virtuele Stylist
Beschrijf stylingdilemma’s en ontvang handsfree gesproken outfitadvies.

1. Navigeer naar het scherm **AI Stylist**.
2. Klik op het microfoonpictogram `[Microfoon]` in de chatinvoerbalk.
3. Spreek je verzoek uit (bijvoorbeeld: "Welke top past bij mijn beige broek voor een regenachtige lunch in de buitenlucht?").
4. Als Web Speech wordt ondersteund, wordt uw stem live getranscribeerd in het invoervak. Als dit niet het geval is, neemt de app een WebM-bestand op en uploadt dit.
5. De backend routeert de gesproken zoekopdracht naar de lokale Gemma4-container (waarbij wordt teruggevallen op Gemini 2.5 Flash-transcriptie indien offline).
6. De stylist verwerkt jouw garderobegeschiedenis, lokale weersvoorspellingen en agenda-evenementen om een ​​stylingvoorstel te formuleren.
7. De stylist spreekt het antwoord uit met behulp van vooraf geselecteerde stemprofielen (`puck`, `aoede` of `charon`).
8. Tik op **Antwoord afspelen** (of **Opnieuw afspelen** in de Hebreeuwse modus) op de kaart om de gesproken audio opnieuw af te spelen.

---

### 3.3 Profiel, voorkeuren en afhankelijkheden van subsystemen
De Profielpagina fungeert als het belangrijkste controlepaneel voor DressApp. Configuratievelden hebben een directe invloed op de prestaties, routering en gedrag van downstream-modules.

#### Accordeonsectie Afhankelijkheden en grondgedachte

1. **Foto's en avatar**
   - **Waarom maakt het uit?**: het biedt de visuele identiteit voor gepersonaliseerde stijlweergave en canvasoverlays.
   - **Subsysteemafhankelijkheden**: Avatars en referentiefoto's bevolken de `AvatarViewer2D` en `OutfitAvatarViewer`. Om fouten bij het uploaden van databases (MongoDB's documentgrens van 16 MB) te voorkomen en bandbreedte te besparen, worden foto's in de browser gecomprimeerd tot een maximum van 1280 px met een kwaliteit van 82%.

2. **Stijlprofiel (bescheiden regels, dresscode)**
   - **Waarom maakt het uit?**: Het stelt persoonlijke grenzen vast voor aanbevolen outfits, waardoor wordt voorkomen dat de AI ongepaste stijlsuggesties genereert.
   - **Afhankelijkheden van het subsysteem**: de geselecteerde parameters (bijvoorbeeld bescheiden kledingbeperkingen) worden rechtstreeks in de stylingprompts voor Gemini 2.5 Flash ingevoerd, waarbij overeenkomende garderobe-uitvoer wordt gefilterd voordat deze wordt getoond.

3. **Details (naam, telefoon, beroep)**
   - **Waarom maakt het uit?**: Het past de communicatietoon aan en stuurt notificatiewaarschuwingen door.
   - **Subsysteemafhankelijkheden**: de naam van de gebruiker wordt dynamisch geparseerd in e-mails en pushes op systeemniveau. Het telefoonnummer dient als reserveregister voor geplande waarschuwingen. De bezettingsparameter wordt aan de LLM-stylist doorgegeven om voorstellen aan te passen (bijvoorbeeld sjablonen voor een bedrijfskantoor versus werk op afstand).

4. **Lichaam en afmetingen (lengte, gewicht, vormen)**
   - **Waarom maakt het uit?**: Het elimineert giswerk over de maatvoering, waardoor externe vergelijking van winkelgroottes en nauwkeurige virtuele gelaagdheid mogelijk is.
   - **Subsysteemafhankelijkheden**: metingen worden rechtstreeks opgevraagd door de contentscripts van de **Shopping Assistant** Chrome-extensie om maattabellen op partnerwebsites (zoals Zara en Asos) te lezen en maten aan te bevelen. Ze passen ook de weergaveschaal van kledingsegmenten op het Outfit Canvas aan.

5. **Levensstijl (status, geslacht)**
   - **Waarom maakt het uit?**: het past standaardaanbevelingen aan en scoort inhoudsalgoritmen.
   - **Afhankelijkheden van het subsysteem**: de geslachtsselectie heeft rechtstreeks invloed op de rangschikkingslogica van de dagelijkse Trend Scout-kaarten. Als een nieuwskaartcategorie niet overeenkomt met het geslacht van de gebruiker, past het algoritme een score van -2,0 toe, waardoor deze in de feed wordt gedegradeerd.

6. **AI-configuratie (SaaS-sleutels, edge-modus, credits)**
   - **Waarom maakt het uit?**: het bepaalt de factureringsrouting, operationele prestaties en de offline status van het netwerk.
   - **Subsysteemafhankelijkheden**: routeert zoekopdrachten voor het genereren van tekst/audio. Standaardconfiguraties verbruiken DressApp-systeemcredits. Door persoonlijke API-sleutels (Google AI Studio, Anthropic, OpenAI) in te voeren, worden de kosten omgeleid naar de factureringsaccounts van de ontwikkelaar. Als u de lokale Edge-modus selecteert, worden query's naar de offline Gemma-container geleid.

7. **Scheduler en push (frequentie, dagelijks alarm, stijlfocus)**
   - **Waarom maakt het uit?**: Het beheert automatische dagelijkse stijlpushs.
   - **Subsysteemafhankelijkheden**: activeert `APScheduler` cron-taken op de FastAPI-backend. Elke ochtend activeert het pushmeldingen via `pywebpush` met behulp van de VAPID-sleutels van de klant, passend bij de geselecteerde stijlfocusparameters.

8. **Google Agenda (OAuth-synchronisatie, exportregels)**
   - **Waarom maakt het uit?**: Het verbindt uw garderobe rechtstreeks met uw agenda-evenementen in de echte wereld.
   - **Subsysteemafhankelijkheden**: Authenticatie via Google OAuth. De planner vraagt ​​uw agenda om evenementen te identificeren, formatteert outfits en stuurt agenda-evenementen rechtstreeks naar uw Google Agenda-agenda.

9. **Locatiediensten (GPS-tracking, weernauwkeurigheid)**
   - **Waarom maakt het uit?**: Het coördineert suggesties die geschikt zijn voor het weer en filters voor de lokale transactieradius.
   - **Subsysteemafhankelijkheden**: activeert `navigator.geolocation` omgekeerde geocodering. Coördinaten worden naar de OpenWeatherMap API gestuurd om de aanbevelingen van de stylisten aan te passen (bijvoorbeeld regenkleding bij regenbuien). Het berekent ook afstanden voor lokale marktplaatsvermeldingen en experts (bijvoorbeeld straalcontroles in Lissabon).

10. **Stem en taal (stemselectie van virtuele stilisten)**
    - **Waarom maakt het uit?**: het stelt de locatie van het tekstwoordenboek en stemmodulaties vast.
    - **Subsysteemafhankelijkheden**: beheert de actieve taal voor vertalingen via `react-i18next`. De stemselectie wijst BCP-47-spraakcodes (bijvoorbeeld `he-IL` of `ar-JO`) toe aan client Web Speech-synthesestemmen of offline Piper TTS-modellen.

11. **Vrienden uitnodigen (payload-API delen)**
    - **Waarom maakt het uit?**: Het biedt een virale lus voor gratis kastuitbreiding.
    - **Subsysteemafhankelijkheden**: voegt de MongoDB-ID van de verwijzer toe aan de URL. Nieuwe registraties ondervragen deze ID dynamisch en verhogen atomair de `closet_capacity_bonus` van de verwijzer met +10 slots, waardoor de limietwachters in `closet.py` worden gewijzigd.

---

### 3.4 Dashboard Garderobe-inzichten
Analyseer de kapitalisatiewaarde van kleding, volg het gebruik van kleding en parameters voor de kosten per slijtage.

1. Navigeer naar **Garderobe-inzichten**.
2. **Bekijk statistieken**:
   - *Closet Worth*: dynamische sommatie van aankoopprijzen.
   - *Kastgebruik*: percentage kledingstukken dat minstens één keer is gedragen.
   - *Gemiddelde kosten per slijtage (CPW)*: berekend als 'Prijs/slijtagetelling'.
3. **Verdelingsgrafieken**: schakel tussen tabbladen om Recharts-visualisaties te bekijken:
   - *Kleurenpalet*: verdeling van hexadecimale codes in kaart gebracht.
   - *Materialen*: verdeling van stofpercentages.
   - *Subcategorieën*: toegewezen subcategorieën.
4. **Efficiency Leaderboard**: Bekijk de top 5 kledingstukken met de laagste Cost-per-Wear-scores.

---

### 3.5 Outfitcanvas en -planner
Bouw, laag en bekijk outfitvoorstellen op een interactief 2D-avatarcanvas.

1. Open de **Outfit Canvas**-planner.
2. **Bovenkledinglagen (Dual Canvas)**: Als je outfit bovenkleding (bijvoorbeeld een jas) over een topje bevat, geeft de pagina twee verticale canvasmodules weer: 'Met bovenkleding' (waarbij de jas gelaagd wordt weergegeven) en 'Zonder bovenkleding' (waarbij de bovenkleding eronder zichtbaar wordt).
3. **Interactieve 2D-elementen**: Tik rechtstreeks op een kledingstuk op het lichaam van de avatar. De app leidt u rechtstreeks naar het detailscherm van dat kledingstuk.
4. **Tabblad Metrieken bekijken**: Klik op de knop Details en kies het tabblad **Metrische gegevens** om de voortgangsbalken voor compatibiliteitscriteria te bekijken:
   - *Kleurharmonie* (neutrale harmonie)
   - *Patrooncompatibiliteit* (preventie van botsende patronen)
   - *Body Fitting* (maat passend)
   - *Weermatch* (geschikt voor seizoen)
   - *Event Match* (geschiktheid van de activiteit)
   - *Locatiematch* (bescheiden regelscontroles)
5. **Hernoemen/beschrijven**: klik op het potloodpictogram om de namen en beschrijvingen van outfits te bewerken.

---

### 3.6 Kofferassistent
Organiseer uw verpakkingsbehoeften voor reizen zonder oververpakking.

1. Ga naar de pagina **Koffer** en vul het Reiscontextformulier in (bestemming, begin-/einddatum, reiscategorie, kalendergebeurtenissen).
2. De AI genereert een aangepaste paklijst en dagelijkse outfits op basis van de reisduur en weersvoorspellingen.
3. Bekijk de voortgang van het inpakken. Als een belangrijk item ontbreekt (bijvoorbeeld een paraplu voor de regen, zwemkleding voor op het strand), waarschuwt het systeem u en stelt het overeenkomsten voor op de markt of in lokale winkels.
4. Gebruik de geïntegreerde chatbox om suggesties te verfijnen (bijvoorbeeld 'Wijzig dag 2 in casual avondkleding'). De assistent bewerkt de koffer en behoudt de rest van de lijst.
5. Tik op **Koffer goedkeuren** om uw plan af te ronden.

---

### 3.7 Planner en pushherinneringen
Stel dagelijkse stylingwaarschuwingen in om automatisch outfitaanbevelingen te ontvangen.

1. Open **Profiel** en ga naar **Scheduler & Push**.
2. Schakel meldingen in, stel een dagelijkse meldingstijd, weekdagfrequentie en stijlfocusthema in.
3. Elke ochtend controleert de cron-taak op de achtergrond (`APScheduler`) de weersvoorspellingen en verzendt een pushmelding.
4. Tik op de melding op uw apparaat (of bekijk het Berichtencentrum van de webapp) om een ​​voorsteldialoogvenster te openen met drie gestileerde suggesties.
5. Sla een suggestie rechtstreeks op in je **Garderobedagboek**.

---

### 3.8 Marktplaats (wederverkoop, verhuur, ruilen, schenken)
Neem deel aan de peer-to-peer circulaire modemarktplaats.

- **Maak een aanbieding**: open de detailpagina van een item, selecteer **Intentie bewerken** en kies een niet-privé-intentie:
  - *Te koop*: voer de catalogusprijs en valuta in (detecteert uw standaardvaluta via regionale landinstellingen).
  - *Huur*: Stel het dagelijkse huurtarief en de leenvoorwaarden in.
  - *Ruilen*: Markeer het item dat open is voor ruil.
  - *Doneren*: Publiceer het item gratis.
- **Statussynchronisatie**: vermeldingen worden automatisch doorgegeven aan de feed. De client gebruikt `useSyncExternalStore` en IndexedDB-caching om zoekparameters zonder latentie te laden.
- **Try-On Sandbox**: huurders/kopers kunnen een advertentie testen met items in hun privékast voordat ze afrekenen.
- **Transactioneel afrekenen**:
  - *Aankoop/Huur*: voltooi de transactie via geïntegreerde PayPal-knoppen. Vastgelegde webhooks stellen de verkoper hiervan op de hoogte, veranderen de status van de vermelding in verkocht/verhuurd en registreren transacties in het grootboek minus de platformkosten van 7%.
  - *Bartering (ruilen)*: potentiële swappers stellen transacties voor. Lister ontvangt bevestigingsmails om te accepteren of te weigeren.

---

### 3.9 Dashboard beheerderspaneel
Validatie van systeemlevensduur, financiële boekhouding en beheer van gebruikersaccounts.

1. Navigeer naar `/admin` (beschikbaar voor beheerdersrollen).
2. **Overzicht**: Overzichten van brutovolumes en inkomsten uit platformvergoedingen. Bekijk de **Provider Activity Table** om stroomafwaartse livenessstatistieken te bekijken (Gemini API, latentie van weerservices en foutpercentages).
3. **Providers**: klik op **Sleutel verifiëren** om een ​​directe ping naar de Gemini API te sturen. Schakel de schakelaar **Eyes Vision Override** in om de beeldanalyse te routeren tussen het standaard Gemini-eindpunt en een lokale Gemma-container.
4. **Gebruikers**: bekijk actieve credits, rollen en levenslange betalingen. Gebruik directe acties om gebruikers te promoten of te degraderen.
5. **Aanvermeldingen**: bekijk de status van de vermeldingen en schakel actieve vlaggen in om frauduleuze items op te schorten.

---

## 4. Verwachte resultaten

- **Opname**: items vullen onmiddellijk het kastraster in (~16 ms). Achtergronduitsparingen zorgen voor heldere, transparante PNG-resultaten.
- **DPP Verified Badge**: bij het scannen van geldige paspoorten wordt de groene informatiekaart met duurzaamheidsdetails weergegeven.
- **Avatar-bovenkleding**: bovenkleding wordt correct gelaagd over tops weergegeven op het 2D-avatarcanvas zonder hoofddeksels/schoenen af ​​te knippen.
- **Voice Response**: tekstuitvoer van de virtuele stylist speelt gesproken audio automatisch af met een zichtbare golfvormindicator.
- **Abonnementen**: als u Pro activeert, wordt de waarschuwing voor de limiet van 150 items onmiddellijk verwijderd.

---

## 5. Problemen oplossen

### HTTP 402-betaling vereist
- **Probleem**: Inname geblokkeerd. U heeft de maximale basislimiet van 150 kastitems bereikt.
- **Oplossing**: Ga naar Profiel -> Abonnement en upgrade naar Pro, of deel uw uitnodigingslink om +10 slots per registratie te krijgen.

### SSRF geblokkeerd/DNS-fout op DPP
- **Probleem**: de gescande QR-paspoort-URL kan niet worden geparseerd.
- **Oplossing**: de parser blokkeert privé-IP-adressen (bijvoorbeeld `127.0.0.1`, `192.168.x.x`) om interne servers te beschermen. Zorg ervoor dat QR-codes naar publieke domeinen verwijzen.

### Camera-/microfoontoestemming geweigerd
- **Probleem**: Viewport voor vastleggen/scannen geeft een 'X'-foutscherm weer, of spraaktypen mislukt.
- **Oplossing**: open browserrechten, schakel camera- en microfoontoegang in voor het domein en laad opnieuw.

### Stylist-chat mislukt / tarieflimieten
- **Probleem**: Chat vertoont fouten of loopt vast.
- **Oplossing**: de server onderschept de Gemini `429`-tarieflimieten en valt terug op een op regels gebaseerd algoritme voor kastselectie. Controleer uw internetverbinding.

### Onvoldoende geheugen (OOM) VPS-pieken
- **Probleem**: CPU/RAM-pieken tijdens uploadprocessen.
- **Oplossing**: Inname maakt gebruik van opeenvolgende wachtrijvergrendelingen voor batches > 5 items. Zorg ervoor dat de server minimaal 4 GB RAM heeft.

---

## 6. Beperkingen

- **Browser Web Speech API's**: Native spraak-naar-tekstvertaling is beperkt tot Chrome en Safari; andere browsers vallen terug op standaard tekstinvoer.
- **Offline clientmodulaties**: mobiele offline Piper ONNX-spraaksynthese gebruikt minder stemprofielen dan de server-side Gemini-audiomodal.
- **Beperkingen van de afbeeldingsgrootte**: Avatar- en profieluploads worden lokaal in de browser gecomprimeerd tot een kwaliteit van 82% om binnen de MongoDB-documentgrens van 16 MB te passen.
- **Reikwijdte van het parseren van ontvangstbewijzen**: zeer wazige, vervormde of handgeschreven ontvangstbewijzen kunnen de gegevensextractie mislukken.