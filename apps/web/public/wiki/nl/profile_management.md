# Profiel, Maten & Configuratie (`/me`)

Beheer lichaamsmaten, huidskleur, lichaamsfoto's, stylingvoorkeuren, API-referenties voor AI-modellen en systeemintegraties op uw persoonlijke profieldashboard.

## Overzicht
De pagina **Profiel & Instellingen** (`https://dressapp.co/me`) fungeert als het centrale controlecentrum voor uw DressApp-ecosysteem. Hier vindt u uw antropometrische lichaamsparameters, digitale pasfase voor uw avatar, stijlrestricties, gelokaliseerde voorkeuren, API-sleutels voor AI-modellen en schema's voor pushmeldingen.

---

## Vereisten
- Een actief DressApp-account.
- (Optioneel) Toestemming voor apparaatcamera voor het uploaden van een foto van het hele lichaam.
- (Optioneel) Locatietoestemming voor lokale stylistencampagnes, culturele kledingrestricties en weersvoorspellingen.

---

## Stapsgewijze toelichting: Volledig overzicht van de pagina van boven naar beneden

### 1. Paginakop & Explore-navigatiebalk
Bovenaan het `/me`-dashboard:
- **Kop (Header)**: Toont uw accountstatus en titel/naam.
- **Explore-kaarten**: Snelle snelkoppelingen naar hoofdonderdelen van de app:
  - **Trend Scout** (`/trends`): Bekijk dagelijkse door AI samengestelde modenieuwsfeeds.
  - **Outfits** (`/outfits`): Toegang tot uw opgeslagen outfitkalender.
  - **Experts** (`/experts`): Bekijk lokale mode-stylisten en kleermakers.
  - **Unpacked / Stats** (`/me/stats`): Bekijk garderobewaarde, kosten-per-draagbeurt (cost-per-wear) en kleurverdelingen.

### 2. Kaart voor taal- en stemselectie
Duidelijk zichtbaar voor directe toegankelijkheid:
- **Taalkeuze**: Kies uit 12 ondersteunde talen (*Engels, Spaans, Frans, Duits, Italiaans, Portugees, Russisch, Chinees, Japans, Arabisch, Hindi, Hebreeuws*). Het selecteren van een taal werkt automatisch de UI-locale bij en koppelt het standaard regionale Text-to-Speech (TTS)-stemmodel.

---

### 3. Kaart voor identiteit & persoonlijke gegevens (`ProfileDetailsCard`)

Bevat 9 uitklapbare accordeonpanelen voor het beheer van uw persoonlijke identiteit, maten en avatarweergave:

#### Paneel A: Identiteit
- **Voornaam & Achternaam**: Velden voor persoonlijke identificatie.
- **E-mailadres**: Alleen-lezen weergave van uw geregistreerde e-mailadres.
- **Geboortedatum**: Gebruikt om demografische trendscores te personaliseren.
- *Google Autofill-badge*: Wordt automatisch getoond als uw profiel is aangemaakt via Google OAuth.

#### Paneel B: Contact & Bezorgadres
- **Telefoonnummer**: Vereist voor het ontvangen van sms-/pushmeldingen voor dagelijkse plannervoorstellen en lokale expertcampagnes.
- **Adresregel 1**: Voorzien van automatische aanvulling op straatniveau via OpenStreetMap (Nominatim). Het selecteren van een suggestie vult automatisch Regel 1, Stad, Regio, Postcode en Land in.
- **Adresregel 2, Stad, Regio, Postcode**: Handmatige adresvelden voor marktplaatsverzending.
- **Land**: Offline combobox, doorzoekbaar op landnaam of ISO-2-code.

#### Paneel C: Demografie
- **Geslacht (Sex)**: Selecteer *Vrouw* of *Man* om basislichaamsmaten en kledingtaxonomie in te stellen.
- **Burgerlijke staat**: Selecteer *Vrijgezel*, *Getrouwd*, *Gescheiden* of *Weduwe/Weduwnaar*.
- **Beroep**: Vrije tekstinvoer (bijv. *Student*, *Marketingmanager*, *Barista*). Voedt de personalisatieranking van Trend Scout om relevant modenieuws prioriteit te geven.

#### Beknopte handleiding: Ontbrekende Google-profielgegevens synchroniseren (Opnieuw toestemming geven voor People API)
Als u zich via Google heeft aangemeld voordat DressApp toegang vroeg tot uw **People API**-profielgegevens (telefoonnummer, adres, geslacht, geboortedatum), kunnen deze velden leeg blijven. U kunt ze met één klik synchroniseren:

1. **Open het accordeon Contact of Demografie** — naast de sectietitel ziet u de knop **„Sync from Google“** (vernieuwingsicoon).
2. **Klik op „Sync from Google“** — als de vereiste People API-scopes niet zijn verleend tijdens uw eerste aanmelding, detecteert DressApp dit en toont een informatietoast: *„Google heeft uw toestemming nodig voor toegang tot profielgegevens. U wordt doorgestuurd naar Google om toegang te verlenen.“*
3. **Geef toestemming op het Google-scherm** — u wordt doorgestuurd naar het OAuth-toestemmingsscherm van Google. Vink de vakjes aan voor **Profielgegevens** (naam, e-mailadres, foto) en **Contactgegevens** (telefoonnummer, adres, geslacht, verjaardag).
4. **Automatische terugkeer & automatisch invullen** — na toestemming stuurt Google u terug naar DressApp. De functie `syncGoogleProfile()` wordt automatisch uitgevoerd en roept het backend-endpoint `/auth/google/sync-profile` aan, dat:
   - Uw telefoonnummer, adres, geslacht en geboortedatum ophaalt via de Google People API
   - De lege velden in de panelen **Contact** (telefoon, adres) en **Demografie** (geslacht, geboortedatum) invult
   - De updates direct opslaat in uw profiel
5. **Klaar** — uw profiel is nu compleet zonder handmatig typen.

> **Opmerking**: De knop „Sync from Google“ verschijnt ook in de paginakop (naast de hoofdknop „Sync Google Profile“) en werkt op dezelfde manier: alle beschikbare Google-profielgegevens worden in één keer gesynchroniseerd.

#### Paneel D: Voorkeuren & Meeteenheden
- **Gewichtseenheid**: Schakel tussen kilogram (`kg`) en pond (`lb`).
- **Lengte-eenheid**: Schakel tussen centimeters (`cm`) en inches (`in`).

#### Paneel E: Foto's & Digitaal avatar-podium
- **Linkerkolom — Fotokiezers**:
  - *Gezichtsfoto*: Upload een avatarthumbnail.
  - *Foto van het hele lichaam*: Upload een foto van het hele lichaam. Het systeem voert automatisch een lokale U2-Net (`rembg`)-uitsnijding uit om de achtergrond te verwijderen.
  - *Knop Foto verwijderen*: Verwijder uw uitgesneden foto met één klik, waardoor het paspodium zonder vertraging direct terugschakelt naar de 2D-SVG-vectormaniquin.
- **Rechterkolom — Digitale avatar & Paspodium**:
  - **Huidskleurkiezer**: Interactief kleurenpalet om de huidskleur van uw mannequin te selecteren.
  - **Avatar Pascanvas (Avatar Try-On Canvas)**: Rendert kledingstukken over uw uitgesneden foto of dynamische Bezier-vectormaniquin (`DynamicAvatar.jsx`) met behulp van gekalibreerde referentie-offsets (`top-[14.5%]` van kraag naar halslijn en `top-[36.5%]` van tailleband naar taillelijn).

#### Paneel F: Stijlprofiel
- **Esthetiek**: Door komma's gescheiden stijlzoekwoorden (bijv. *Minimalistisch, Streetwear, Vintage*).
- **Kleurenpalet**: Voorkeurskleurtinten (bijv. *Pasteltinten, Aardetinten, Monochroom*).
- **Vermijden**: Kleuren of kledingtypen die strikt moeten worden uitgesloten van AI-aanbevelingen (bijv. *Geel, Crop Tops*).
- **Culturele kledingbescheidenheid**: Selecteer het gewenste bedekkingsniveau (*Casual/Ontspannen*, *Gematigd*, *Conservatief*) om de kledingbedekking van de AI Stylist te sturen.

#### Paneel G: Lichaamsmaten & Maatvoering (ANSUR II Sizing Predictor)
- **Onboarding / Schone start-modus**: Voer 4 basiswaarden in: **Lengte**, **Gewicht**, **Tailleomtrek** en **Voetlengte**. Het ingebouwde scikit-learn ANSUR II multi-output regressiemodel voorspelt automatisch 6 structurele maten:
  - *Schouders*, *Borst / Buste*, *Heup*, *Mouwlengte*, *Binnenbeenlengte* en *Buitenbeenlengte*.
- **Automatische maatvertaling**: Zodra de structurele maten zijn voorspeld, vullen deterministische maatvoeringalgoritmen direct **alle standaard winkelmaten** in, tot en met de schoenmaat:
  - *Casual hemd-/shirtmaat* (XS–XXL op basis van borstomtrek)
  - *Broek taillemaat* (inches, omgerekend vanuit tailleomtrek in cm)
  - *US-schoenmaat* (formules voor heren/dames op basis van voetlengte)
  - *Damesjurkmaat* (US 0–14+ op basis van taille)
  - *Dames BH-maat* (omvang + cup berekend op basis van borstomtrek en onderwijdte)
- **Gedetailleerde bewerkingsmodus**: Verfijn na het automatisch invullen alle 15 maatparameters (waaronder hemdmaat, broekmaat, schoenmaat, bh-maat, jurkmaat) en haarkenmerken (*Lengte, Type, Kleur, Stijl*).
- **Live eenhedenschakelaar**: Schakel tussen *kg/cm* en *lb/in* — alle waarden worden direct omgerekend zonder herberekening van de voorspelling.

#### Paneel H: Registratie voor professionals & expertengids
- **Schakelaar voor professionele stylist**: Registreer als geverifieerde modeprofessional (stylist, kleermaker, ontwerper).
- **Bedrijfsgegevens**: Voer bedrijfsnaam, adres, telefoonnummer, e-mailadres, website en beschrijving in om te worden vermeld in de `/experts`-gids en de regionale campagneticker.

#### Paneel I: PayPal-uitbetalingsinstellingen
- **PayPal-ontvangers-e-mail**: Voer uw PayPal-e-mailadres in om uitbetalingen te ontvangen voor marktplaatsverkopen en actieve expertcampagnes.

---

### 4. Accordeonkaart voor systeemvoorkeuren

Beheert instellingen op systeemniveau, abonnementen en AI-integraties:

- **AI-configuratie**:
  - *Standaardmodus (Primaire productie-engine)*: Aangedreven door **Google Gemini 3.5 Flash-Lite** via `llm_gateway.py`. Biedt razendsnelle styling zonder initiële installatie en zonder dat persoonlijke API-sleutels nodig zijn.
  - *On-premises quotumvangnet*: Als er clouddatalimieten (`429` / `RESOURCE_EXHAUSTED`) worden bereikt, schakelen zoekopdrachten automatisch over naar de zelfgehoste, verfijnde **Gemma-4-E4B**-container op poort 7860, zodat uw stylingsessie nooit wordt onderbroken.
  - *Eigen API-sleutelmodus (BYOK)*: Koppel uw eigen Google Gemini API-sleutel om geavanceerde ontwikkelaarsquota en generatieve cloudtools zoals de dagelijkse Trend Scout-radar en Nano Banana-fotoreconstructie te ontgrendelen.
- **Abonnement & Kledingkastlimieten**:
  - Bekijk het huidige accountniveau (**Free**: basislimiet van 50 items vs. **Manager** ($ 10/mnd) of **Professional** ($ 15/mnd): onbeperkt aantal items).
  - **Testergroepprogramma**: Goedgekeurde tester-e-mails (`maystarboard@gmail.com`, `lokoprod@gmail.com`, `dressapdeveloper@gmail.com`) genieten automatisch gratis toegang tot het **Professional-abonnement** zonder abonnementskosten.
  - Ga naar de **Prijzenpagina** (`/pricing` of klik op uw abonnementskaart) om de vergelijkingstabel te bekijken, een abonnement te kiezen of niet-verlopende prepaid-tegoedpakketten te kopen.
  - Upgraden via PayPal Subscriptions of de Atzmai Gateway voor lokale Israëlische ILS-transacties (Bit / creditcard).
  - **Aanbevelingslink kopiëren**: Levert +10 kledingkastplaatsen op voor elke vriend die zich registreert (tot maximaal 150 items).
- **Planner & Pushherinneringen**:
  - Schakel meldingen voor ochtendoutfitvoorstellen in of uit.
  - Stel de frequentie in (*Elke dag*, *Om de dag*, *Tweemaal per week*, *Op weekdagen*), tijd (bijv. *07:00*) en dresscode-eisen (*Casual*, *Formeel*, *Sportief*, *Aangepast*).
  - Schakel VAPID-pushmeldingen in de browser in.
- **Campagnemelding-voorkeuren**:
  - Gedetailleerde schakelaars voor *Lokale mode push/e-mail*, *Kortingwaarschuwingen*, *Duurzame mode*, *Luxe promoties* en *Persoonlijke stylist*.
  - Pas de schuifregelaar **Maximale campagne-afstand** aan (5 km tot 50 km).
- **Google Agenda koppelen**: OAuth-knop om persoonlijke agenda-afspraken te synchroniseren met de AI Stylist.
- **Locatieservices-kaart**: Schakel GPS-locatietoestemmingen in voor op afstand afgestemde expertfeeds en hyperlokaal weer.
- **Vrienden uitnodigen-knop**: Kopieer de deelbare aanbevelingslink.
- **Shopping Assistant**: Bekijk Chrome Web Store-extensiedetails of genereer een **Universal Bookmarklet** (`javascript:...`) voor directe maatvergelijkingen bij webwinkels.

---

### 5. Accountacties & Diagnostiek
- **Afmelden (Sign Out)**: Uitloggen uit uw huidige sessie.
- **Mijn account verwijderen (Delete my Account)**: Link om accountgegevens definitief te wissen.
- **Ontwikkelaarspaneel**: Diagnostische weergave voor het testen van de omgeving. Geauthenticeerd via Google OAuth (`dressapdeveloper@gmail.com`).

---

## Verwachte resultaten
- Onmiddellijke synchronisatie van lichaamsmaten, huidskleur en foto-uitsnijdingen op het 2D Avatar Pascanvas.
- Geen loze netwerkverzoeken bij het navigeren tussen instellingenpanelen.
- Aangepaste outfitvoorstellen van de AI Stylist die aansluiten bij uw bescheidenheidsregels en agenda.

---

## Probleemoplossing
- **Achtergrond van foto niet verwijderd**: Zorg ervoor dat uw geüploade foto het hele lichaam toont met contrasterende achtergrondverlichting.
- **Pushmeldingen komen niet aan**: Controleer of browsermeldingen zijn toegestaan en er een telefoonnummer is opgeslagen onder *Contact*.
- **Automatisch aanvullen van adres reageert niet**: Controleer of er een actieve internetverbinding is voor OpenStreetMap Nominatim-zoekopdrachten.

---

## Beperkingen
- De accountruimte in het Free Tier is standaard beperkt tot 50 items, tenzij uitgebreid via aanbevelingsbonussen (+10 plaatsen per uitnodiging tot maximaal 150 items) of een upgrade naar het Manager- of Professional-niveau.
- Kostbare generatieve cloud-endpoints (Trend Scout-radar en Nano Banana-fotoreconstructie) vereisen een door de gebruiker verstrekte persoonlijke Google Gemini API-sleutel.
- De modus met eigen API-sleutel schakelt soepel terug naar de ingebouwde Gemma-4-E4B-engine als het quotum van de externe provider is uitgeput.
