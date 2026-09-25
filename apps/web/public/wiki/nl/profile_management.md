# Profiel, Maatvoering & Configuratie (`/me`)

Beheer fysieke metingen, huidskleur, uitsnijdingen van lichaamsfoto's, stylingvoorkeuren, inloggegevens van AI-modellen en systeemintegraties op uw persoonlijke profieldashboard.

## Overzicht
De pagina **Profiel & Instellingen** (`https://dressapp.co/me`) dient als het centrale controlecentrum voor uw DressApp-ecosysteem. Het bevat uw fysieke antropometrische parameters, het podium voor het passen met uw digitale avatar, stijlbeperkingen, gelokaliseerde voorkeuren, AI-modelsleutels en pushmeldingsschema's.

---

## Prerequisites (Vereisten)
- Een actief DressApp-account.
- (Optioneel) Cameramachtigingen voor het apparaat om een foto van het hele lichaam te uploaden.
- (Optioneel) Locatiemachtigingen voor targeting van lokale stylistencampagnes, culturele beperkingen en weersvoorspellingen.

---

## Stapsgewijze handleiding: Pagina-overzicht van boven naar beneden

### 1. Pagina-koptekst & Exploreer navigatiebalk
Bevindt zich bovenaan het `/me`-dashboard:
- **Koptekst (Header)**: Toont uw accountstatus en naam.
- **Ontdekkingskaarten**: Snelle snelkoppelingen naar de belangrijkste app-secties:
  - **Trend Scout** (`/trends`): Bekijk dagelijkse door AI samengestelde modenieuwsfeeds.
  - **Outfits** (`/outfits`): Krijg toegang tot uw opgeslagen outfitkalender.
  - **Experts** (`/experts`): Blader door lokale mode-stylisten en kleermakers.
  - **Unpacked / Stats** (`/me/stats`): Bekijk de waardebepaling van uw kledingkast, cost-per-wear-statistieken en kleuranalyses.

### 2. Kaart voor taal- & spraakselectie
Prominent weergegeven voor directe toegankelijkheid:
- **Taalkiezer**: Kies uit 12 ondersteunde talen (*Nederlands, Engels, Spaans, Frans, Duits, Italiaans, Portugees, Russisch, Chinees, Japans, Arabisch, Hindi, Hebreeuws*). Het selecteren van een taal bijwerkt automatisch de UI-taal en koppelt het standaard regionale Text-to-Speech (TTS) stemmodel.

---

### 3. Kaart voor identiteit & persoonlijke gegevens (`ProfileDetailsCard`)

Bevat 9 uitklapbare accordeonpanelen voor het beheren van uw persoonlijke identiteit, maatvoering en avatar-rendering:

#### Paneel A: Identiteit
- **Voornaam & Achternaam**: Persoonlijke identificatievelden.
- **E-mailadres**: Alleen-lezen weergave van uw geregistreerde e-mailadres.
- **Geboortedatum**: Wordt gebruikt om demografische trendscores te personaliseren.
- *Google Automatisch invullen-badge*: Wordt automatisch weergegeven als uw profiel is aangemaakt via Google OAuth.

#### Paneel B: Contact & Bezorgadres
- **Telefoonnummer**: Vereist om SMS/Push-waarschuwingen te ontvangen voor dagelijkse plannervoorstellen en lokale expertcampagnes.
- **Adresregel 1**: Biedt automatische aanvulling op straatniveau via OpenStreetMap (Nominatim). Het selecteren van een suggestie vult automatisch Regel 1, Stad, Regio, Postcode en Land in.
- **Adresregel 2, Stad, Regio, Postcode**: Handmatige adresvelden voor verzending via de marktplaats.
- **Land**: Offline keuzelijst met invoervak, doorzoekbaar op landnaam of ISO-2-code.

#### Paneel C: Demografische gegevens
- **Geslacht**: Selecteer *Female* (Vrouw) of *Male* (Man) om de basislichaamsmaten en kledingtaxonomie te configureren.
- **Persoonlijke status**: Selecteer *Single* (Alleenstaand), *Married* (Getrouwd), *Divorced* (Gescheiden) of *Widowed* (Weduwnaar/Weduwe).
- **Beroep**: Vrije tekstinvoer (bijv. *Student*, *Marketing Manager*, *Barista*). Voedt de personalisatieranker van Trend Scout om relevant stijlnieuws te prioriteren.

#### Samengevatte handleiding: Ontbrekende Google-profielgegevens synchroniseren (People API-toestemming)
Als u zich bij Google heeft aangemeld voordat DressApp toegang vroeg tot uw **People API**-profielgegevens (telefoonnummer, adres, geslacht, geboortedatum), kunnen die velden leeg blijven. U kunt ze met één klik synchroniseren:

1. **Open het accordeon Contact of Demografische gegevens** — u ziet een knop **"Sync from Google"** (pictogram voor vernieuwen) naast de sectietitel.
2. **Klik op "Sync from Google"** — als de vereiste People API-toestemmingen niet zijn verleend tijdens uw oorspronkelijke aanmelding, detecteert DressApp dit en toont een melding: *"Google heeft uw toestemming nodig om toegang te krijgen tot profielgegevens. U wordt doorgestuurd naar Google om toegang te verlenen."*
3. **Verleen toestemming op het scherm van Google** — u wordt doorgestuurd naar het OAuth-toestemmingsscherm van Google. Vink de vakjes aan voor **Profile info** (naam, e-mail, foto) en **Contact info** (telefoonnummer, adres, geslacht, verjaardag).
4. **Automatische terugkeer & automatisch invullen** — na toestemming stuurt Google u terug naar DressApp. De functie `syncGoogleProfile()` wordt automatisch uitgevoerd en roept het backend-eindpunt `/auth/google/sync-profile` aan dat:
   - Uw telefoonnummer, adres, geslacht en geboortedatum ophaalt uit de Google People API.
   - De lege velden invult in de panelen **Contact** (telefoonnummer, adres) en **Demografische gegevens** (geslacht, geboortedatum).
   - De updates direct op uw profiel opslaat.
5. **Gereed** — uw profiel is nu compleet zonder handmatig typen.

> **Opmerking**: De knop "Sync from Google" verschijnt ook in de paginakop (naast de hoofdknop "Google profiel synchroniseren") and werkt op dezelfde manier — het synchroniseert alle beschikbare Google-profielgegevens in één keer.

#### Paneel D: Voorkeuren & maateenheden
- **Gewichtseenheid**: Schakel tussen kilogrammen (`kg`) en ponden (`lb`).
- **Lengte-eenheid**: Schakel tussen centimeters (`cm`) en inches (`in`).

#### Paneel E: Foto's & podium voor digitale avatar
- **Linkerkolom — Fotokiezers**:
  - *Gezichtsfoto*: Upload een avatarthumbnail.
  - *Foto van hele lichaam*: Upload een foto van het hele lichaam. Het systeem voert automatisch een lokale U2-Net (`rembg`) bewerking uit om de achtergrond te verwijderen.
  - *Knop Foto verwijderen*: Met één klik verwijdert u uw fotouitsnede, waardoor het passysteem onmiddellijk terugschakelt naar de 2D-SVG-vectorpaspop zonder UI-vertraging.
- **Rechterkolom — Digitale avatar & passysteem**:
  - **Huidskleurkiezer**: Interactief kleurenpalet om de huidskleur van uw paspop te selecteren.
  - **Avatar Pas-canvas**: Rendert kledingstukken bovenop uw fotouitsnede of dynamische Bezier-vectorpaspop (`DynamicAvatar.jsx`) met behulp van gekalibreerde referentie-offsets (`top-[14.5%]` van kraag naar halslijn en `top-[36.5%]` van tailleband naar taille).

#### Paneel F: Stijlprofiel
- **Esthetiek**: Door komma's gescheiden stijlzoekwoorden (bijv. *Minimalist, Streetwear, Vintage*).
- **Kleurenpalet**: Voorkeurskleurtinten (bijv. *Pastels, Earth Tones, Monochrome*).
- **Vermijden**: Kleuren of kledingstuktypen die strikt moeten worden uitgesloten van AI-aanbevelingen (bijv. *Yellow, Crop Tops*).
- **Culturele kledingbescheidenheid**: Selecteer het bescheidenheidsniveau (*Casual/Relaxed*, *Moderate*, *Conservative*) om de kledingaanbevelingen van de AI Stylist te sturen.

#### Paneel G: Lichaamsmaten & maatvoering (ANSUR II Sizing Predictor)
- **Onboarding / Schone start-modus**: Voer 4 basisinvoergegevens in: **Height** (Hoogte), **Weight** (Gewicht), **Waist** (Tailleomtrek) en **Foot Length** (Voetlengte). Het ingebouwde scikit-learn ANSUR II multi-output regressiemodel voorspelt automatisch 6 structurele metingen:
  - *Schouders*, *Borstomtrek / Buste*, *Heupen*, *Mouwlengte*, *Binnenbeenlengte (Inseam)* en *Buitenbeenlengte (Outseam)*.
- **Automatische maatvertaling**: Zodra de structurele maten zijn voorspeld, vullen deterministische algoritmen onmiddellijk **alle standaard winkelmaten** in tot aan de schoenmaat:
  - *Casual hemdmaat* (XS-XXL op basis van borstomtrek).
  - *Broekmaat* (inches, omgerekend van tailleomtrek in cm).
  - *Amerikaanse schoenmaat* (formules voor mannen/vrouwen op basis van voetlengte).
  - *Damesjurkmaat* (US 0-14+ op basis van taille).
  - *Damesbra-maat* (onderborst en bovenborst).
- **Gedetailleerde bewerkingsmodus**: Verfijn na het automatisch invullen alle 15 maatparameters (inclusief hemdmaat, broekmaat, schoenmaat, bra-maat, jurkmaat) en haarkenmerken (*Lengte, Type, Kleur, Stijl*).
- **Live eenhedenschakelaar**: Schakel tussen *kg/cm* en *lb/in* — alle waarden worden direct omgerekend zonder nieuwe voorspelling.

#### Paneel H: Registratie in het register voor experts & professionals
- **Schakelaar voor professionele stylist**: Registreer u als een geverifieerde modeprofessional (stylist, kleermaker, ontwerper).
- **Bedrijfsgegevens**: Voer bedrijfsnaam, adres, telefoonnummer, e-mailadres, website en beschrijving in om te verschijnen in de map `/experts` en de regionale campagne-ticker.

#### Paneel I: PayPal-uitbetalingsinstellingen
- **E-mailadres PayPal-ontvanger**: Voer uw PayPal-e-mailadres in om uitbetalingen te ontvangen voor marktplaatsverkopen en actieve expertcampagnes.

---

### 4. Systeemvoorkeuren Accordeonkaart

Beheert instellingen op systeemniveau, abonnements- en AI-integraties:

- **AI-configuratie**:
  - *Standaardmodus (Ingebouwd platformmodel)*: Maakt gebruik van DressApp's zelf gehoste, gefinetunede **Gemma-4-E4B**-model. Volledig gratis, vereist geen API-sleutels en bevat dagelijks 10 stylingcredits.
  - *Eigen API-sleutelmodus (BYOK)*: Koppel uw eigen Google Gemini API-sleutel (of andere ondersteunde providers) om geavanceerde functies zoals Trend Scout en Nano Banana fotoreconstructie te ontgrendelen.
  - *Automatische quotum-fallbackbeveiliging*: Als uw persoonlijke API-sleutel de limiet overschrijdt (`429` / `RESOURCE_EXHAUSTED`), schakelt DressApp het verzoek automatisch en zonder onderbreking door naar de ingebouwde Gemma-engine, inclusief informatieve banner in de chat.
- **Abonnement & Kledingkastlimieten**:
  - Bekijk het huidige accountniveau (**Free**: limiet van 50 kledingstukken vs **Manager** of **Professional**: onbeperkte items).
  - Ga naar de **Prijzenpagina** (`/pricing` of klik op uw plankkaart) om de vergelijkingstabel te bekijken, een plan te kiezen en u te abonneren.
  - Upgrade via PayPal Subscriptions REST API (Manager: $4.99/maand; Professional: $9.99/maand) of de Atzmai Gateway voor lokale ILS-transacties.
  - Kopieer **verwijzingslink**: Geeft +10 extra kledingkastplaatsen voor elke geregistreerde vriend (tot maximaal 150 items).
- **Planner & Push-herinneringen**:
  - Schakel ochtendoutfitvoorstellen in/uit.
  - Stel de frequentie in (*Elke dag*, *Om de dag*, *Twee keer per week*, *Op weekdagen*), tijd (bijv. *07:00*) en dresscode-stijleisen (*Casual*, *Formal*, *Athletic*, *Custom*).
  - Schakel browser-VAPID-pushwaarschuwingen in.
- **Campagne-meldingsvoorkeuren**:
  - Gedetailleerde schakelaars voor *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos* en *Personal Stylist*.
  - Pas de schuifregelaar voor **maximale campagne-afstand** aan (5 km tot 50 km).
- **Google Calendar Connect**: OAuth-knop om persoonlijke agenda-evenementen te synchroniseren met de AI Stylist.
- **Locatieservices**: Schakel GPS-locatiemachtigingen in voor op afstand afgestemde expertfeeds en hyperlokaal weer.
- **Knop Vrienden uitnodigen**: Kopieer deelbare verwijzingslink.
- **Shopping Assistant**: Krijg toegang tot details over de Chrome Web Store-extensie of genereer een **Universal Bookmarklet** (`javascript:...`) voor onmiddellijke e-commerce maatvergelijkingen.

---

### 5. Accountacties & diagnostiek
- **Afmelden**: Meld u af bij uw huidige sessie.
- **Mijn account verwijderen**: Link om accountgegevens permanent te wissen.
- **Ontwikkelaarspaneel**: Diagnostisch accordeon voor omgevingstests.

---

## Verwachte resultaten
- Onmiddellijke synchronisatie van fysieke metingen, huidskleur en fotouitsneden op het 2D-Avatar Pas-canvas.
- Geen inactieve netwerkverzoeken bij het navigeren tussen instellingenpanelen.
- Op maat gemaakte AI Stylist-outfitvoorstellen die zijn afgestemd op uw bescheidenheidsregels en schema.

---

## Problemen oplossen
- **Achtergrond van foto niet verwijderd**: Zorg ervoor dat uw geüploade foto een foto van het hele lichaam is met contrasterende achtergrondverlichting.
- **Push-waarschuwingen komen niet aan**: Bevestig dat de browsermachtigingen voor meldingen zijn ingeschakeld en dat er een telefoonnummer is opgeslagen onder *Contact*.
- **Automatisch aanvullen van adres reageert niet**: Controleer of de internetverbinding actief is voor OpenStreetMap Nominatim-zoekopdrachten.

---

## Beperkingen
- Gratis accounts hebben een basislimiet van 50 kledingstukken, uitbreidbaar via vriendenuitnodigingen (+10 slots per registratie tot maximaal 150 items) of een upgrade naar Manager of Professional.
- Trend Scout modekanalen en Nano Banana fotoreparatie vereisen een persoonlijke Google Gemini API-sleutel.
- De modus voor eigen API-sleutels schakelt naadloos over naar de ingebouwde Gemma-engine wanneer de externe quota zijn verbruikt.
