# DressApp Volledige Technische Gebruikershandleiding

Uitgebreide gebruikershandleiding en technische gids voor het DressApp persoonlijke garderobe-ecosysteem, de stylingengine, de circulaire marktplaats en het beheerderspaneel.

---

## 1. Overzicht & Technologiestack

DressApp is een door AI aangedreven persoonlijke garderobemanager, stylingadviseur en circulaire marktplaats. Het helpt gebruikers kledingstukken digitaal te beheren, ze automatisch uit te snijden en te taggen, weer- en agendagestuurde outfitaanbevelingen te ontvangen, EU Digitale Productpaspoorten (DPP) te scannen en kleding te verhandelen.

### Kernwaardepropositie
- **Digitale Garderobe-inname**: Verwerking van foto's of uploads met geautomatiseerde achtergrondverwijdering, kledingcategorisatie en generatie van attribuuttags.
- **AI Virtuele Stylist**: Een conversationele agent die contextueel je garderobe, Google Calendar-evenementen en lokale weersvoorspellingen bekijkt om dagelijkse outfits voor te stellen.
- **Circulaire Marktplaats**: Veilig peer-to-peer kopen, verkopen, ruilen en huren van kleding om fast fashion-afval te verminderen.
- **Cost-Per-Wear (CPW) Analytics**: Inzichten in de kapitalisatiewaarde van de garderobe, benuttingsgraden en gebruiksoptimalisatie.

### Architectuur van de Technologie
- **Backend Edge**: Python 3.11 met FastAPI, gebruikmakend van asynchrone Motor-drivers verbonden met een MongoDB Atlas-cluster.
- **Frontend SPA**: React 19 single-page applicatie die gebruikmaakt van aangepaste `useSyncExternalStore`-stores (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, Shadcn/UI-primitieven en `react-i18next` met ondersteuning voor 12 talen.
- **Status- & Netwerkoptimalisatie**: In-flight verzoekdeduplicatie, 15-minuten store-caching en hervalidatie bij tabwissel (`visibilitychange`), wat resulteert in nul achtergrond GET-verzoeken bij inactiviteit.
- **Lokale Machine Learning & Maatvoering**: CPU-lokale U2-Net (`rembg`) achtergronduitsnijding, SegFormer-b2 kledinganalyse, Fashion-CLIP-embeddings en ANSUR II regressiemodel voor lichaamsmaten (`body_predictor.py`). Optioneel routerend naar zelfgehoste GPU-containers (SegFormer-b3 + BiRefNet) voor snelle bewerkingen.
- **Conversationele STT/TTS**: Realtime Web Speech-herkenningsfallback aan clientzijde, multimodale Gemini 2.5 Flash-modulaties aan serverzijde en offline Piper/Sherpa-ONNX-engines op het apparaat.
- **Externe Integratiediensten**: OpenWeatherMap API voor weergegevens, Google Calendar OAuth voor het exporteren van dagplanningen, OpenStreetMap (Nominatim) adres-autocompletie en PayPal Subscriptions/Checkout REST API's.

---

## 2. Vereisten

### Host-omgevingsvereisten
- **Hardware**: Minimaal 4 GB RAM VPS (bijv. Hetzner VPS die de productie-omgeving `dressapp.co` host).
- **Afhankelijkheden**: Docker & Docker Compose-stack (inclusief backend, frontend en Caddy TLS-beëindiging).
- **Omgevingsvariabelen**: API-sleutelconfiguratie (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` en Google Calendar OAuth-tokens).

### Gebruikers-app vereisten
- **Webbrowser**: Google Chrome of Apple Safari (vereist voor volledige compatibiliteit met spraakfuncties).
- **Machtigingen**: Verleen Cameramachtiging (voor kledingfoto's en QR-scans) en Microfoonmachtiging (voor spraakgesprekken).
- **Netwerk**: Actieve verbinding voor LLM-verwerking, waarbij IndexedDB-caching offline bladeren door de catalogus mogelijk maakt.

---

## 3. Stap-voor-stap Instructies

### 3.1 Kleding Invoeren (Items Toevoegen)
INVOERPARADIGMA'S: Fotografie, EU Productpaspoorten en Digitale Aankoopbewijzen.

#### A. Interactieve Camera en Bestandsupload
1. Navigeer naar het scherm **Item Toevoegen**.
2. Selecteer **Foto Maken** (start de mobiele camera) of klik op **Foto's Uploaden** (opent de bestandskiezer van het besturingssysteem).
3. De client berekent de SHA-256 en horizontale verschildatabase-hash (dHash) van de afbeelding in de browser (~100-180 ms) om te controleren op duplicaten in je bestaande kledingkast.
4. Als er een overeenkomst wordt gevonden, opent het dialoogvenster **Duplicaat Controle** met overeenkomende voorbeelden. Selecteer **Overslaan** of **Toch toevoegen**.
5. Zodra geaccepteerd, start de server een NDJSON-stream. Binnen 5-7 seconden verschijnt er een tijdelijk voorbeeldframe, zodat je de itemdetails meteen kunt bewerken terwijl de backend het taggen voltooit.
6. Controleer de automatisch gedetecteerde tags (kleur, stof, pasvorm, patroon, gelegenheid). Als de uitsnijvorm onjuist is, wijzig dan het keuzemenu **Categorie**; dit activeert SegFormer om het kledingstuk automatisch opnieuw uit te snijden.
7. Klik op **Opslaan** om het item meteen optimistisch in het kledingkastraster te tonen (~16 ms) terwijl het genereren van de WebP-miniaturenafbeeldingen in de achtergrond wordt voltooid.

#### B. Scannen van EU Digitale Productpaspoorten (DPP)
1. Tik op de knop **Scan QR (DPP)** op de pagina Item Toevoegen.
2. Verleen cameramachtigingen en richt de camera op de QR-code op het kledinglabel, of upload een opgeslagen QR-screenshot.
3. De backend verwerkt de URL en voert SSRF-veiligheidscontroles uit (waarbij particuliere IP-bereiken worden geblokkeerd).
4. Het systeem analyseert de JSON-LD-schema's om merk, materiaalsamenstelling, toeleveringsketen, CO2-voetafdruk en onderhoudsinstructies te verwerken.
5. Controleer de uitgevoerde gegevens in het groene **Geverifieerde DPP-gegevens** accordeonpaneel en klik op **Opslaan**.

#### C. Digitale Aankoopbewijzen Importeren
1. Open het tabblad **Digitale Import**.
2. Kies een submodus: **Tekst Plakken**, **Afbeelding Uploaden**, **PDF Uploaden**, of voer een **Weblink** in.
3. De backend gebruikt multimodale visiemodellen om transactiegegevens te verzamelen (merk, prijs, maat, categorie).
4. Geparseerde velden worden vergrendeld op basis van het aankoopbewijs om ze te beschermen tegen toekomstige visuele heranalyses. Klik op **Opslaan** om te bevestigen.

---

### 3.2 Conversationele AI Virtuele Stylist
Beschrijf stylingdilemma's en ontvang handsfree gesproken outfitadvies.

1. Navigeer naar het scherm **AI Stylist**.
2. Klik op het microfoonpictogram `[Microphone]` in de chat-invoerbalk.
3. Spreek je verzoek in (bijv. "Welke top past bij mijn beige broek voor een lunch buiten in de regen?").
4. Als Web Speech wordt ondersteund, wordt je stem live getranscribeerd in het invoerveld. Zo niet, dan neemt de app een WebM-bestand op en uploadt dit.
5. De backend stuurt de spraakaanvraag naar de lokale Gemma4-container (met een terugval op Gemini 2.5 Flash-transcriptie indien offline).
6. De stylist verwerkt je garderobe-historie, lokale weersvoorspellingen en agenda-evenementen om een stylingsvoorstel te formuleren.
7. De stylist spreekt het antwoord uit met behulp van vooraf geselecteerde stemprofielen (`puck`, `aoede`, of `charon`).
8. Tik op **Antwoord afspelen** (of **Opnieuw afspelen** in de Hebreeuwse modus) op de kaart om de audio opnieuw af te spelen.

---

### 3.3 Profiel, Voorkeuren en Subsysteem-afhankelijkheden
De Profielpagina fungeert als het centrale bedieningspaneel voor DressApp. Configuratievelden zijn direct van invloed op de prestaties, routering en het gedrag van onderliggende modules.

##### Accordeonsectie Afhankelijkheden & Onderbouwing

1. **Foto's & Digitaal Avatar-podium (`AvatarViewer2D` & `DynamicAvatar`)**
   - **Waarom is dit belangrijk?**: Toont je visuele identiteit op alle passerstellen met een podium met dubbele modus (gesegmenteerde foto-uitsnijding van het echte lichaam vs. dynamische 2D Bezier-vector SVG-mannequin).
   - **Subsysteem-afhankelijkheden**: Foto-uitsnijdingen worden achtergronds gesneden via lokale U2-Net (`rembg`) en in de browser geschaald naar maximaal 1280px op 82% kwaliteit om binnen de MongoDB-documentlimiet van 16 MB te blijven. Het podium past gecalibreerde positiepunten toe (`top-[14.5%]` kraag-tot-halslijn, `top-[36.5%]` tailleband-tot-taillelijn, `bottom-[2%]` schoenvlak) en een proportionele borst-/heupschaling ($scaleX$). Klik op *Foto verwijderen* om direct terug te keren naar de 2D SVG-vectormannequin.

2. **Stijlprofiel (Eerbaarheidsregels, Dresscode)**
   - **Waarom is dit belangrijk?**: Het stelt persoonlijke grenzen vast voor aanbevolen outfits, waardoor de AI geen ongeschikte stylingsuggesties genereert.
   - **Subsysteem-afhankelijkheden**: De geselecteerde parameters (bijv. beperkingen voor bedekkende kleding) worden rechtstreeks ingevoerd in de stylingsprompts voor Gemini 2.5 Flash, waardoor passende garderobe-resultaten worden gefilterd voordat ze worden getoond.

3. **Details (Naam, Telefoonnummer, Beroep)**
   - **Waarom is dit belangrijk?**: Het past de communicatietoon aan en stuurt meldingen door.
   - **Subsysteem-afhankelijkheden**: De gebruikersnaam wordt dynamisch verwerkt in e-mails en systeem-pushes. Het telefoonnummer dient als reserve-register voor geplande meldingen. De beroepsparameter wordt doorgegeven aan de stylist LLM en de Trend Scout-personalisatieranker om voorstellen op maat te maken.

4. **Lichaamsmaten & Maatvoering (ANSUR II Regressiemodel)**
   - **Waarom is dit belangrijk?**: Het neemt twijfels over maten weg, waardoor maatvergelijking bij externe winkels en nauwkeurige virtuele laagopbouw mogelijk worden.
   - **Subsysteem-afhankelijkheden**: Het invoeren van 4 basisparameters (**Lengte**, **Gewicht**, **Taille**, **Voetlengte**) activeert het scikit-learn ANSUR II regressiemodel (`body_predictor.py`) om automatisch 6 structurele afmetingen te voorspellen (*Schouders*, *Borst*, *Heup*, *Mouw*, *Binnenbeen*, *Buitenbeen*). Maten worden rechtstreeks opgevraagd door de content-scripts van de **Winkelassistent** Chrome-extensie om maattabellen op partnerwebsites (Zara, Asos) te lezen en maten aan te bevelen.

5. **Levensstijl (Status, Geslacht)**
   - **Waarom is dit belangrijk?**: Het stemt standaardaanbevelingen af en scoort inhoudsalgoritmen.
   - **Subsysteem-afhankelijkheden**: De geslachtsselectie heeft direct invloed op de rangschikkingslogica van de dagelijkse Trend Scout-kaarten. Als de categorie van een nieuwskaart niet overeenkomt met het geslacht van de gebruiker, past het algoritme een straf toe van -2,0 punten, waardoor deze in de feed daalt.

6. **AI-configuratie (SaaS-sleutels, edge-modus, credits)**
   - **Waarom is dit belangrijk?**: Het bepaalt de facturatie-routering, operationele prestaties en netwerk-offlinestatus.
   - **Subsysteem-afhankelijkheden**: Stuur tekst-/audiogeneratie-aanvragen door. Standaardinstellingen verbruiken DressApp-systeemcredits. Het invoeren van persoonlijke API-sleutels (Google AI Studio, Anthropic, OpenAI) leidt de kosten om naar de ontwikkelaarsaccounts van de gebruiker. De lokale edge-modus stuurt aanvragen naar de offline Gemma-container.

7. **Planner & Push (Frequentie, dagelijks alarm, stijlfocus)**
   - **Waarom is dit belangrijk?**: Beheert automatische dagelijkse stijl-pushes.
   - **Subsysteem-afhankelijkheden**: Activeert `APScheduler` cron-taken op de FastAPI-backend. Elke ochtend worden pushmeldingen geactiveerd via `pywebpush` met behulp van de VAPID-sleutels van de client, overeenkomend met de geselecteerde stijlfocus-parameters.

8. **Google Calendar (OAuth-sync, exportregels)**
   - **Waarom is dit belangrijk?**: Verbindt je kledingkast rechtstreeks met je echte agenda-evenementen.
   - **Subsysteem-afhankelijkheden**: Authenticeert via Google OAuth. De planner vraagt je agenda op om evenementen te identificeren, outfits op te stellen en evenementen rechtstreeks naar je Google Calendar te pushen.

9. **Locatiediensten (GPS-tracking, weernauwkeurigheid)**
   - **Waarom is dit belangrijk?**: Coördineert weersgeschikte suggesties en lokale transactieradiusfilters.
   - **Subsysteem-afhankelijkheden**: Activeert `navigator.geolocation` omgekeerde geocodering. Coördinaten worden naar de OpenWeatherMap API gestuurd om de stylist-aanbevelingen aan te passen (bijv. regenkleding bij plensbuien). Berekent ook afstanden voor lokale marktplaats-advertenties en experts (bijv. straalcontroles in Lissabon).

10. **Stem & Taal (Stemselectie virtuele stylist)**
    - **Waarom is dit belangrijk?**: Bepaalt de taalwoordenboeken en stemmodulaties.
    - **Subsysteem-afhankelijkheden**: Bestuurt de actieve taal voor vertalingen via `react-i18next`. De stemselectie koppelt BCP-47-stemcodes (bijv. `he-IL` of `ar-JO`) aan Web Speech-synthesestemmen van de client of offline Piper TTS-modellen.

11. **Vrienden Uitnodigen (Share payload API)**
    - **Waarom is dit belangrijk?**: Biedt een virale lus voor gratis kledingkastuitbreiding.
    - **Subsysteem-afhankelijkheden**: Voegt de MongoDB-ID van de verwijzer toe aan de URL. Nieuwe registraties vragen deze ID dynamisch op en verhogen de `closet_capacity_bonus` van de verwijzer atomair met +10 plekken, wat de limieten in `closet.py` aanpast.

---

## 3.4 Garderobe Inzichten Dashboard
Analyseer de kapitalisatiewaarde van de kledingkast, volg het gebruik van kledingstukken en de parameters voor kosten per keer dragen (Cost-Per-Wear).

1. Navigeer naar **Garderobe Inzichten**.
2. **Statistieken Controleren**:
   - *Waarde Kledingkast*: Dynamische som van aankoopprijzen.
   - *Benutting Kledingkast*: Percentage kledingstukken dat minstens één keer is gedragen.
   - *Gemiddelde Kosten per Keer Dragen (CPW)*: Berekend als `Price / Wear Count`.
3. **Verdelingsgrafieken**: Schakel tussen tabbladen om Recharts-visualisaties te bekijken:
   - *Kleurenpalet*: Verdeling van gekoppelde hex-codes.
   - *Materialen*: Percentageverdeling van stoffen.
   - *Subcategorieën*: Gekoppelde subcategorieën.
4. **Efficiëntie Ranglijst**: Bekijk de top 5 kledingstukken met de laagste Kosten per Keer Dragen-scores.

---

## 3.5 Outfit Canvas & Planner
Bouw, laad en bekijk outfitvoorstellen op een interactief 2D-avatarcanvas.

1. Open de planner **Outfit Canvas**.
2. **Bovenkleding Laagopbouw (Dubbel Canvas)**: Als je outfit bovenkleding bevat (bijv. een jas) over een top, toont de pagina twee verticale canvasmodules: "Met Bovenkleding" (met de jas eroverheen) en "Zonder Bovenkleding" (waarbij de onderliggende top zichtbaar wordt).
3. **Interactieve 2D-elementen**: Tik rechtstreeks op een kledingstuk op het lichaam van de avatar. De app stuurt je direct naar het detailscherm van dat kledingstuk.
4. **Tabblad Statistieken Controleren**: Klik op de knop Details en kies het tabblad **Statistieken** om voortgangsbalken voor compatibiliteitscriteria te bekijken:
   - *Kleurharmonie* (neutrale harmonie)
   - *Patrooncompatibiliteit* (voorkomen van botsende patronen)
   - *Lichaamspasvorm* (overeenkomst in maat)
   - *Weermatch* (geschiktheid voor het seizoen)
   - *Evenementmatch* (geschiktheid voor de activiteit)
   - *Locatiematch* (controles van eerbaarheidsregels)
5. **Hernoemen/Beschrijven**: Klik op het potloodpictogram om outfitnamen en -beschrijvingen te bewerken.

---

## 3.6 Kofferassistent
Organiseer je pakvereisten voor reizen zonder te veel in te pakken.

1. Ga naar de pagina **Koffer** en vul het formulier Reisinformatie in (bestemming, begin-/einddatum, reiscategorie, agenda-evenementen).
2. De AI genereert een aangepaste paklijst en dagelijkse outfits op basis van de reisduur en weersvoorspellingen.
3. Controleer de inpakvoortgang. Als er een belangrijk item ontbreekt (bijv. paraplu bij regen, zwemkleding voor het strand), waarschuwt het systeem je en stelt het overeenkomstige items voor via de marktplaats of lokale winkels.
4. Gebruik het geïntegreerde chatveld om suggesties te verfijnen (bijv. "Verander dag 2 in casual avondkleding"). De assistent bewerkt de koffer terwijl de rest van de lijst behouden blijft.
5. Tik op **Koffer Goedkeuren** om je plan af te ronden.

---

## 3.7 Planner & Push-herinneringen
Stel dagelijkse styling-alarms in om automatisch outfitaanbevelingen te ontvangen.

1. Open **Profiel** en ga naar **Planner & Push**.
2. Schakel meldingen in, stel een dagelijkse meldingstijd, weekdagfrequentie en stijlfocusthema in.
3. Elke ochtend controleert de achtergrond-cron-taak (`APScheduler`) de weersvoorspellingen en verstuurt een pushmelding.
4. Tik op de melding op je apparaat (of bekijk het meldingscentrum in de web-app) om een voorstelvenster te openen met 3 gestylde suggesties.
5. Sla een suggestie rechtstreeks op in je **Garderobedagboek**.

---

## 3.8 Marktplaats (Herverkoop, Verhuur, Ruil, Donatie)
Neem deel aan de circulaire peer-to-peer modemarktplaats.

- **Een Advertentie Maken**: Open de detailpagina van een item, selecteer **Intentie Bewerken** en kies een niet-privé intentie:
  - *Te koop*: Voer de vraagprijs en valuta in (detecteert je standaardvaluta via regionale voorkeuren).
  - *Verhuren*: Stel het dagelijkse huurtarief en de leenvoorwaarden in.
  - *Ruilen*: Markeer het item als beschikbaar voor ruil.
  - *Doneren*: Publiceer het item gratis.
- **Statussynchronisatie**: Advertenties worden automatisch in de feed verspreid. De client gebruikt `useSyncExternalStore` en IndexedDB-caching om zoekparameters zonder vertraging te laden.
- **Pas-Sandbox**: Huurders/kopers kunnen een advertentie virtueel passen in combinatie met items uit hun privékledingkast voordat ze afrekenen.
- **Afrekenen & Transacties**:
  - *Kopen/Huren*: Voltooi de transactie via geïntegreerde PayPal-knoppen. Ontvangen webhooks stellen de verkoper op de hoogte, wijzigen de status van de advertentie in verkocht/verhuurd en leggen transacties vast in het grootboek min de 7% platformvergoeding.
  - *Ruilen (Barter)*: Potentiële ruilers stellen deals voor. De aanbieder ontvangt bevestigings-e-mails om te accepteren of te weigeren.

---

## 3.9 Beheerderspaneel Dashboard
Systeembeschikbaarheidsvalidatie, financiële boekhouding en gebruikersaccountbeheer.

1. Navigeer naar `/admin` (beschikbaar voor beheerdersrollen).
2. **Overzicht**: Controleer brutovolumes en samenvattingen van inkomsten uit platformvergoedingen. Inspecteer de **Provider Activiteitstabel** om beschikbaarheidsstatistieken te bekijken (Gemini API, latentie van de weerdienst en foutpercentages).
3. **Providers**: Klik op **Sleutel Verifiëren** om een directe ping naar de Gemini API te sturen. Schakel de **Eyes Vision Override**-schakelaar om de beeldanalyse te routeren tussen het standaard Gemini-eindpunt en een lokale Gemma-container.
4. **Gebruikers**: Bekijk actieve credits, rollen en totale betalingen. Gebruik directe acties om gebruikers te Bevorderen of te Degraderen.
5. **Advertenties**: Bekijk de status van advertenties en schakel actieve vlaggen om om frauduleuze items te schorsen.

---

## 4. Verwachte Resultaten

- **Invoer**: Items worden meteen in het kledingkastraster getoond (~16 ms). Achtergrond-uitsnijdingen leveren schone, transparante PNG-resultaten op.
- **Geverifieerd DPP-badge**: Het scannen van geldige paspoorten toont de groene informatiekaart met duurzaamheidsdetails.
- **Bovenkleding op Avatar**: Bovenkleding wordt correct gelaagd weergegeven over tops op het 2D-avatarcanvas zonder hoofdbedekking/schoenen te overlappen.
- **Spraakreactie**: Tekstuitvoer van de Virtuele Stylist speelt gesproken audio automatisch af met een zichtbare golfvormindicator.
- **Abonnementen**: Het activeren van Pro verwijdert onmiddellijk de waarschuwing voor de limiet van 150 items.

---

## 5. Probleemoplossing

### HTTP 402 Payment Required
- **Probleem**: Invoer geblokkeerd. Je hebt de maximale basislimiet van 150 kledingkast-items bereikt.
- **Oplossing**: Ga naar Profiel -> Abonnement en upgrade naar Pro, of deel je uitnodigingslink om +10 plekken per registratie te krijgen.

### SSRF Geblokkeerd / DNS-fout op DPP
- **Probleem**: Gescannde QR-paspoort-URL kan niet worden verwerkt.
- **Oplossing**: De parser blokkeert particuliere IP-adressen (bijv. `127.0.0.1`, `192.168.x.x`) om interne servers te beschermen. Zorg ervoor dat QR-codes naar openbare domeinen verwijzen.

### Cameramachtiging / Microfoonmachtiging Geweigerd
- **Probleem**: Opname-/scanvenster toont een 'X'-foutscherm, of spraakgestuurd typen mislukt.
- **Oplossing**: Open browser-machtigingen, schakel toegang tot camera en microfoon in voor het domein en vernieuw de pagina.

### Stylist Chat Fout / Rate Limits
- **Probleem**: Chat toont fouten of bevriest.
- **Oplossing**: De server vangt Gemini `429` rate limits op en valt terug op een op regels gebaseerd selectiealgoritme. Controleer je internetverbinding.

### Geheugentekort (OOM) VPS-pieken
- **Probleem**: CPU/RAM-pieken tijdens uploadprocessen.
- **Oplossing**: Invoer maakt gebruik van seriële wachtrijvergrendelingen voor batches van meer dan 5 items. Zorg ervoor dat de server over minstens 4 GB RAM beschikt.

---

## 6. Beperkingen

- **Browser Web Speech API's**: Statische spraak-naar-tekstvertaling is beperkt tot Chrome en Safari; andere browsers vallen terug op standaard tekstinvoer.
- **Offline Clientmodulaties**: Mobiele offline Piper ONNX-spraaksynthese gebruikt minder stemprofielen dan de Gemini-audiomodel aan serverzijde.
- **Afbeeldingsgrootte Beperkingen**: Avatar- en profiel-uploads worden lokaal in de browser gecomprimeerd naar 82% kwaliteit om binnen de MongoDB-documentlimiet van 16 MB te blijven.
- **Reikwijdte Bonnenanalyse**: Sterk wazige, vervormde of handgeschreven aankoopbewijzen kunnen mislukken bij de gegevensextractie.