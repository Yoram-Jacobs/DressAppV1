# Profiel, Maten en Configuratie (`/me`)

Beheer lichaamsmetingen, huidskleur, full-body fotoknipperingen, stijlvoorkeuren, AI-modelcredentials en systeemintegraties in uw persoonlijke profieldashboard.

## Overzicht
De **Profiel en Instellingen** pagina (`https://dressapp.co/me`) fungeert als centrale controle-hub voor uw DressApp-ecosysteem. Het bevat uw fysieke anthropometrische parameters, digitale aanpas-avatar-stage, stijlbeperkingen, gelokaliseerde voorkeuren, AI-modellsleutels en push-meldingschema's.

---

## Vereisten
- Een actief DressApp-account.
- (Optioneel) Apparaatcameratoestemming voor full-body fotoupload.
- (Optioneel) Locatietoestemming voor lokale stylistcampagne-targeting en weersvoorspelling.

---

## Stapsgewijze Handleiding: Pagina-overzicht van Boven naar Beneden

### 1. Pagina-header en Verken-navigatiebalk
Bovenaan het `/me`-dashboard:
- **Header**: Toont uw accountstatus en titel.
- **Verken-kaarten**: Snelle snelkoppelingen naar hoofdapp-secties:
  - **Trend Scout** (`/trends`): Bekijk dagelijkse AI-gecurateerde modenieuwsfeeds.
  - **Outfits** (`/outfits`): Toegang tot uw opgeslagen outfit-kalender.
  - **Experts** (`/experts`): Blader door lokale modestylicten en kledingmakers.
  - **Unpacked / Statistieken** (`/me/stats`): Bekijk gardeerrobevaluatie, cost-per-wear metrics en kleurverdelingen.

### 2. Taal- en Stemselectiekaart
Prominent weergegeven voor directe toegankelijkheid:
- **Taalselector**: Kies uit 12 ondersteunde talen (*Engels, Spaans, Frans, Duits, Italiaans, Portugees, Russisch, Chinees, Japans, Arabisch, Hindi, Hebreeuws*). Het selecteren van een taal werkt de UI-locale automatisch bij en koppelt het standaard regionale Text-to-Speech (TTS) stemmodel.

---

### 3. Identiteits- en Persoonlijke Gegevenskaart (`ProfileDetailsCard`)

Bevat 9 uitklapbare accordion-panelen die uw persoonlijke identiteit, maten en avatar-rendering beheren:

#### Paneel A: Identiteit
- **Voor- en Achternaam**: Persoonlijke identificatievelden.
- **E-mailadres**: Alleen-lezen weergave van uw geregistreerde e-mail.
- **Geboortedatum**: Gebruikt om demografische trendscoring te personaliseren.
- *Google Autofill-badge*: Wordt automatisch weergegeven als uw profiel via Google OAuth is aangemaakt.

#### Paneel B: Contact en Leveradres
- **Telefoonnummer**: Vereist om SMS/Push-berichten te ontvangen voor dagelijkse scheduler-voorstellen en lokale expertcampagnes.
- **Adresregel 1**: Bevat OpenStreetMap (Nominatim) straatniveau-autocompletie. Het selecteren van een suggestie vult regel 1, stad, regio, postcode en land automatisch in.
- **Adresregel 2, Stad, Regio, Postcode**: Handmatige adresvelden voor marketplace-verzending.
- **Land**: Offline combobox doorzoekbaar op landnaam of ISO-2-code.

#### Paneel C: Demografie
- **Geslacht**: Selecteer *Vrouw* of *Man* om basiskorpsmetingen en kledingtaxonomie te configureren.
- **Persoonlijke Staat**: Selecteer *Ongehuwd*, *Getrouwd*, *Gescheiden* of *Weduwe*.
- **Beroep**: Vrije-tekstinvoer (bijv. *Student*, *Marketing Manager*, *Barista*). Voedt de Trend Scout-personalisatieranker om relevante stijlnieuws te prioritairen.

#### Paneel D: Voorkeuren en Meeteenheden
- **Gewichtseenheid**: Schakel tussen Kilogrammen (`kg`) en Ponden (`lb`).
- **Lengte-eenheid**: Schakel tussen Centimeters (`cm`) en Inches (`in`).

#### Paneel E: Foto's en Digitale Avatar-stage
- **Linkerkolom — Fotokiezers**:
  - *Gezichts foto*: Upload avatar-thumbnail.
  - *Full-body Foto*: Upload full-body foto. Het systeem voert automatisch lokale U2-Net (`rembg`) matting uit om de achtergrond te verwijderen.
  - *Verwijder Foto Knop*: Één-klik verwijdering van uw fotoknippering, direct omschakelen van de aanpasstage terug naar de 2D SVG-vector mannequin met nul UI-vertraging.
- **Rechterkolom — Digitale Avatar en Aanpas-stage**:
  - **Huidskleur-kiezer**: Interactief kleurenpalet om uw mannequin-huidskleur te selecteren.
  - **Avatar Aanpas-canvas**: Render kledingstukken op uw fotoknippering of dynamische Bézier-vector mannequin (`DynamicAvatar.jsx`) met gecalibreerde landmark-offsets (`top-[14.5%]` kraag-naar-halslijn en `top-[36.5%]` tailleband-naar-taillelijn).

#### Paneel F: Stijlprofiel
- **Esthetiek**: Kommagescheiden stijltrefwoorden (bijv. *Minimalistisch, Streetwear, Vintage*).
- **Kleurpalet**: Voorkeurskleurtinten (bijv. *Pastel, Aardetinten, Monochroom*).
- **Vermijd**: Kleuren of kledingstukken die strikt worden uitgesloten van AI-aanbevelingen (bijv. *Geel, Crop Tops*).
- **Culturele Kledingconservatisme**: Selecteer bescheidenheidsniveau (*Casual/Ontspannen*, *Matig*, *Conservatief*) om AI-stylist outfit-dekking te sturen.

#### Paneel G: Lichaamsmetingen en Maten (ANSUR II Maatvoorspeller)
- **Onboarding / Fresh Start Modus**: Voer 4 basisinvoeren in: **Lengte**, **Gewicht**, **Tailleomtrek** en **Voetlengte**. Het ingebouwde scikit-learn ANSUR II multi-output regressiemodel voorspelt automatisch 6 structurele metingen:
  - *Schouders*, *Borst/Borstomtrek*, *Heupen*, *Mouwlengte*, *Inseam* en *Outseam*.
- **Automatische Maatvertaling**: Zodra de structurele metingen zijn voorspeld, vullen deterministische maatalgoritmen **alle standaard retail-maten** direct in tot aan de schoenmaat:
  - *Casual Hemd Maat* (XS–XXL gebaseerd op borstomtrek)
  - *Broek Taille Maat* (inches, geconverteerd van taille cm)
  - *US Schoenmaat* (Heren/Dames formules van voetlengte)
  - *Dames Jurk Maat* (US 0–14+ gebaseerd op taille)
  - *Dames BH Maat* (band + cup berekend van borst/onderborst)
- **Gedetailleerde Bewerkingsmodus**: Na auto-invullen, fijn afstellen van alle 15 maatparameters (incl. Hemd Maat, Broek Maat, Schoen Maat, BH Maat, Jurk Maat) en haarkenmerken (*Lengte, Type, Kleur, Stijl*).
- **Live Eenheidsschakelaar**: Schakel tussen *kg/cm* en *lb/in* — alle waarden converteren direct zonder herberekening.

#### Paneel H: Professionele en Expert Directory Registratie
- **Professionele Stylist Schakelaar**: Registreer als geverifieerde modeprofessional (stylist, kledingmaker, ontwerper).
- **Zakelijke Gegevens**: Voer Bedrijfsnaam, Adres, Telefoon, E-mail, Website en Beschrijving in om te verschijnen in de `/experts` directory en regionale campagneticker.

#### Paneel I: PayPal Uitbetalingsinstellingen
- **PayPal Ontvanger E-mail**: Voer uw PayPal e-mail in om uitbetalingen te ontvangen voor marketplace-verkopen en actieve expertcampagnes.

---

### 4. Systeemvoorkeuren Accordion-kaart

Beheert systeemniveau-instellingen, abonnementen en AI-integraties:

- **AI-configuratie**:
  - *Standaardmodus*: Gebruikt systeembeheerde Gemini Flash 2.x-eindpunten.
  - *Aangepaste API-sleutelmodus*: Verbind aangepaste Google Gemini, Anthropic, OpenAI of DeepSeek API-sleutels via een begeleide setup-modal.
- **Abonnement en Gardeerrobelimieten**:
  - Bekijk huidig account-niveau (**Gratis**: 150-items limiet vs **Pro**: Onbeperkte items).
  - Upgrade via PayPal Subscriptions REST API ($4.99/maand of $29.99/jaar).
  - **Verwijzingslink Kopiëren**: Geeft +10 gardeerrobe-capaciteitsslots voor elke vriend die zich registreert.
- **Scheduler en Push-herinneringen**:
  - Schakel ochtend-outfit-voorstelnotificaties in/uit.
  - Stel frequentie in (*Elke Dag*, *Elke Andere Dag*, *Tweekeer per Week*, *Op Werkdagen*), tijd (bijv. *07:00*) en dress-code-stileisen (*Casual*, *Formeel*, *Sportief*, *Aangepast*).
  - Schakel browser VAPID push-meldingen in.
- **Campagnemeldingsvoorkeuren**:
  - Gedetailleerde schakelaars voor *Lokale Mode Push/E-mail*, *Uitverkoopwaarschuwingen*, *Duurzame Mode*, *Luxe Promo's* en *Persoonlijke Stylist*.
  - Pas **Max Campagne Afstand** schuifregelaar aan (5km tot 50km).
- **Google Agenda Koppelen**: OAuth-knop om persoonlijke agenda-gebeurtenissen te synchroniseren met de AI-stylist.
- **Locatieservices Kaart**: Schakel GPS-locatietoestemming in voor afstands-gebaseerde expert-feeds en hyper-lokaal weer.
- **Vrienden Uitnodigen Knop**: Kopieer deelbare verwijzingslink.
- **Winkelaassistent**: Toegang tot Chrome Web Store-extensiedetails of genereer een **Universele Bookmarklet** (`javascript:...`) voor direct e-commerce maatvergelijkingen.

---

### 5. Accountacties en Diagnostiek
- **Afmelden**: Log uit van uw huidige sessie.
- **Mijn Account Verwijderen**: Link om accountgegevens permanent te wissen.
- **Ontwikkelaarspaneel**: Diagnostische accordion voor omgevingstests.

---

## Verwachte Resultaten
- Directe synchronisatie van fysieke metrics, huidskleur en fotoknipperingen over het 2D Avatar Aanpas-canvas.
- Nul idle netwerkaanvragen bij navigeren tussen instellingenpanelen.
- Aangepaste AI-stylist outfit-voorstellen afgestemd op uw bescheidenheidsregels en schema.

---

## Probleemoplossing
- **Foto-achtergrond niet verwijderd**: Zorg ervoor dat uw geüploade foto full-body is met contrasterende achtergrondverlichting.
- **Push-meldingen komen niet aan**: Bevestig dat browsermeldingstoestemmingen ingeschakeld zijn en een telefoonnummer is opgeslagen onder *Contact*.
- **Adresautocompletie reageert niet**: Controleer of internetverbinding actief is voor OpenStreetMap Nominatim-query's.
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
  - *Standaardmodus*: Maakt gebruik van door het systeem beheerde Gemini Flash 2.x-eindpunten.
  - *Aangepaste API-sleutelsmodus*: Verbind aangepaste Google Gemini-, Anthropic-, OpenAI- of DeepSeek-API-sleutels via een geleide installatie-modal.
- **Abonnement & kledingkastlimieten**:
  - Bekijk het huidige accountniveau (**Free**: limiet van 50 items versus **Manager** of **Professional**: onbeperkte items).
  - Ga naar de **tarievenpagina** (`/pricing` of klik op uw abonnementkaart) om de tabel voor niveauvergelijking te bekijken, een abonnement te selecteren en u aan te melden.
  - Upgrade via PayPal Subscriptions REST API (Manager: $4.99/maand; Professional: $9.99/maand) of de Atzmai Gateway voor lokale ILS-transacties.
  - Kopieer **verwijzingslink**: Geeft +10 kledingkastcapaciteitsplaatsen voor elke vriend die zich registreert (tot maximaal 200 items).
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
- Gratis accountruimte is beperkt tot 150 items, tenzij uitgebreid via verwijzingsbonus (+10 slots per uitnodiging) of Pro-abonnement.
- Aangepaste API-sleutelmodus vereist geldige sleutels met resterende quota van de betreffende provider.

(End of file)
- De accountruimte voor het gratis niveau is beperkt tot 50 items, tenzij deze wordt uitgebreid via een verwijzingsbonus (+10 plaatsen per uitnodiging tot maximaal 200 items) of door te upgraden naar het niveau Manager of Professional.
- De modus voor aangepaste API-sleutels vereist geldige sleutels met resterend quotum van de respectieve provider.
