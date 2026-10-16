# Profiel, Maten & Configuratie (`/me`)

Beheer lichaamsmaten, huidskleur, vrijstaande lichaamsfoto's, stylingvoorkeuren, AI-modelinstellingen en systeemintegraties op uw persoonlijke profieldashboard.

## Overzicht
De pagina **Profiel & Instellingen** (`https://dressapp.co/me`) fungeert als het centrale controlecentrum voor uw DressApp-ecosysteem. Hier vindt u uw fysieke antropometrische parameters, het digitale paspodium voor uw avatar, stijlvoorschriften, gelokaliseerde voorkeuren, AI-modelconfiguraties en schema's voor pushmeldingen.

---

## Vereisten
- Een actief DressApp-account.
- (Optioneel) Cameramachtigingen op uw apparaat voor het uploaden van foto's van het volledige lichaam.
- (Optioneel) Locatiemachtigingen voor het richten van lokale stylistcampagnes, culturele kledingvoorschriften en weersvoorspellingen.

---

## Stapsgewijze Gids: Pagina-overzicht van Boven naar Beneden

### 1. Paginakoptekst & Explore-navigatiebalk
Gelegen bovenaan het `/me`-dashboard:
- **Koptekst (Header)**: Toont uw accountstatus en titel.
- **Explore-kaarten**: Snelle koppelingen naar de belangrijkste onderdelen van de app:
  - **Trend Scout** (`/trends`): Bekijk dagelijkse, door AI samengestelde modenieuwsfeeds.
  - **Outfits** (`/outfits`): Open uw opgeslagen outfitagenda.
  - **Experts** (`/experts`): Blader door lokale modestylisten en kleermakers.
  - **Unpacked / Stats** (`/me/stats`): Bekijk de waardebepaling van uw garderobe, kosten-per-keer-dragen (cost-per-wear) en kleurverdelingen.

### 2. Kaart voor Taal- & Stemselectie
Prominent weergegeven voor directe toegankelijkheid:
- **Taalselectie**: Kies uit 12 ondersteunde talen (*Engels, Spaans, Frans, Duits, Italiaans, Portugees, Russisch, Chinees, Japans, Arabisch, Hindi, Hebreeuws*). Het selecteren van een taal werkt automatisch de taal van de gebruikersinterface bij en koppelt het standaard regionale Text-to-Speech (TTS)-stemmodel.

---

### 3. Kaart voor Identiteit & Persoonlijke Gegevens (`ProfileDetailsCard`)

Bevat 9 uitklapbare accordeonpanelen voor het beheren van uw persoonlijke identiteit, maten en avatarweergave:

#### Paneel A: Identiteit
- **Voornaam & Achternaam**: Persoonlijke identificatievelden.
- **E-mailadres**: Alleen-lezen weergave van uw geregistreerde e-mailadres.
- **Geboortedatum**: Wordt gebruikt om demografische trendscores te personaliseren.
- *Google Autofill-badge*: Wordt automatisch weergegeven als uw profiel is ingevuld via Google OAuth.

#### Paneel B: Contact & Afleveradres
- **Telefoonnummer**: Vereist om sms-/pushmeldingen te ontvangen voor dagelijkse planningsvoorstellen en lokale expertcampagnes.
- **Adresregel 1**: Beschikt over automatisch aanvullen op straatniveau via OpenStreetMap (Nominatim). Het selecteren van een suggestie vult automatisch Regel 1, Stad, Regio, Postcode en Land in.
- **Adresregel 2, Stad, Regio, Postcode**: Handmatige adresvelden voor marktplaatsverzending.
- **Land**: Offline keuzelijst doorzoekbaar op landnaam of ISO-2-code.

#### Paneel C: Demografie
- **Geslacht (Sex)**: Selecteer *Vrouw* of *Man* om basislichaamsmaten en kledingtaxonomie in te stellen.
- **Burgerlijke staat**: Selecteer *Alleenstaand*, *Gehuwd*, *Gescheiden* of *Weduwe/Weduwnaar*.
- **Beroep**: Vrije tekstinvoer (bijv. *Student*, *Marketingmanager*, *Barista*). Voedt het personalisatie-algoritme van Trend Scout om relevant stijlnieuws voorrang te geven.

#### Beknopte Gids: Ontbrekende Google-profielgegevens Synchroniseren (Opnieuw Toestemming Geven voor People API)
Als u bent ingelogd met Google voordat DressApp toegang vroeg tot uw **People API**-profielgegevens (telefoonnummer, adres, geslacht, geboortedatum), zijn die velden mogelijk nog leeg. U kunt ze met één klik synchroniseren:

1. **Open het accordeonpaneel Contact of Demografie** — u ziet een knop **"Sync from Google"** (vernieuwingspictogram) naast de sectietitel.
2. **Klik op "Sync from Google"** — als de vereiste People API-scopes niet zijn verleend tijdens uw oorspronkelijke aanmelding, detecteert DressApp dit en toont een informatiemelding: *"Google heeft uw toestemming nodig voor toegang tot profielgegevens. U wordt doorgestuurd naar Google om toegang te verlenen."*
3. **Geef toestemming op het scherm van Google** — u wordt doorgestuurd naar het OAuth-toestemmingsscherm van Google. Vink de vakjes aan voor **Profielinformatie** (naam, e-mail, foto) en **Contactgegevens** (telefoon, adres, geslacht, verjaardag).
4. **Automatische terugkeer & automatisch invullen** — na toestemming stuurt Google u terug naar DressApp. De functie `syncGoogleProfile()` wordt automatisch uitgevoerd en roept het backend-eindpunt `/auth/google/sync-profile` aan, dat:
   - Uw telefoonnummer, adres, geslacht en geboortedatum ophaalt uit de Google People API
   - De lege velden invult in de panelen **Contact** (telefoon, adres) en **Demografie** (geslacht, geboortedatum)
   - De wijzigingen direct opslaat in uw profiel
5. **Klaar** — uw profiel is nu compleet zonder handmatig typen.

> **Opmerking**: De knop "Sync from Google" verschijnt ook in de paginakoptekst (naast de hoofdknop "Sync Google Profile") en werkt op dezelfde manier — hiermee worden alle beschikbare Google-profielgegevens in één keer gesynchroniseerd.

#### Paneel D: Voorkeuren & Maateenheden
- **Gewichtseenheid**: Schakel tussen kilogram (`kg`) en pond (`lb`).
- **Lengte-eenheid**: Schakel tussen centimeter (`cm`) en inch (`in`).

#### Paneel E: Foto's & Digitaal Avatarpodium
- **Linkerkolom — Fotokiezers**:
  - *Gezichtsfoto*: Upload een miniatuurafbeelding voor uw avatar.
  - *Volledige lichaamsfoto*: Upload een foto van uw volledige lichaam. Het systeem voert automatisch lokale U2-Net (`rembg`)-matting uit om de achtergrond te verwijderen.
  - *Knop Foto verwijderen*: Verwijdert uw vrijstaande foto met één klik en schakelt het paspodium zonder vertraging direct terug naar de 2D SVG-vectorpaspop.
- **Rechterkolom — Digitale Avatar & Paspodium**:
  - **Huidskleurkiezer**: Interactief kleurenpalet om de huidskleur van uw paspop te selecteren.
  - **Avatar Try-On Canvas**: Geeft kledingstukken weer bovenop uw vrijstaande foto of dynamische Bézier-vectorpaspop (`DynamicAvatar.jsx`) met behulp van gekalibreerde positiepunten (`top-[14.5%]` kraag-tot-halslijn en `top-[36.5%]` tailleband-tot-taillelijn).

#### Paneel F: Stijlprofiel
- **Esthetiek**: Door komma's gescheiden stijlzoekwoorden (bijv. *Minimalistisch, Streetwear, Vintage*).
- **Kleurenpalet**: Gewenste kleurtinten (bijv. *Pasteltinten, Aardetinten, Monochroom*).
- **Vermijden**: Kleuren of kledingtypes die strikt moeten worden uitgesloten van AI-aanbevelingen (bijv. *Geel, Croptops*).
- **Culturele Kledingbescheidenheid**: Selecteer het gewenste bedekkingsniveau (*Casual/Ontspannen*, *Gemiddeld*, *Conservatief*) om de bedekking van outfitsuggesties door de AI-Stylist te sturen.

#### Paneel G: Lichaamsmaten & Maatvoering (ANSUR II Sizing Predictor)
- **Onboarding / Frisse Start-modus**: Voer 4 basiswaarden in: **Lengte**, **Gewicht**, **Tailleomvang** en **Voetlengte**. Het ingebouwde scikit-learn ANSUR II multi-output regressiemodel voorspelt automatisch 6 structurele lichaamsmaten:
  - *Schouders*, *Borst / Buste*, *Heup*, *Mouwlengte*, *Binnenbeenlengte* en *Buitenbeenlengte*.
- **Automatische Maatvertaling**: Zodra de structurele maten zijn voorspeld, vullen deterministische maatalgoritmen onmiddellijk **alle standaard winkelmaten** in tot aan de schoenmaat:
  - *Casual overhemd-/shirtmaat* (XS–XXL op basis van borstomvang)
  - *Broekmaat taille* (inches, omgerekend vanuit taille in cm)
  - *US-schoenmaat* (formules voor heren/dames op basis van voetlengte)
  - *Damesjurkmaat* (US 0–14+ op basis van taille)
  - *Behamaat* (onderwijdte + cup berekend op basis van borst-/onderborstomvang)
- **Gedetailleerde Bewerkingsmodus**: Na het automatisch invullen kunt u alle 15 maatparameters (waaronder shirtmaat, broekmaat, schoenmaat, behamaat en jurkmaat) en haarkenmerken (*Lengte, Type, Kleur, Stijl*) nauwkeurig bijstellen.
- **Live Eenhedenschakelaar**: Schakel tussen *kg/cm* en *lb/in* — alle waarden worden direct omgerekend zonder dat een nieuwe voorspelling nodig is.

#### Paneel H: Registratie in het Experts- & Professionalsregister
- **Schakelaar voor Professionele Stylist**: Registreer u als geverifieerde modeprofessional (stylist, kleermaker, ontwerper).
- **Bedrijfsgegevens**: Voer bedrijfsnaam, adres, telefoonnummer, e-mailadres, website en beschrijving in om te worden vermeld in het `/experts`-register en de regionale campagneticker.

#### Paneel I: PayPal-uitbetalingsinstellingen
- **PayPal-ontvangers-e-mailadres**: Voer uw PayPal-e-mailadres in om uitbetalingen te ontvangen voor marktplaatsverkopen en actieve expertcampagnes.

---

### 4. Accordeonkaart voor Systeemvoorkeuren

Beheert instellingen op systeemniveau, abonnementen en AI-integraties:

- **AI-modelroutering (Gelaagde Architectuur — Zero BYOK)**:
  - *Gratis Abonnement / Free Tier (On-Premises Eyes)*: Gebruikers van het gratis abonnement worden ondersteund door de zelfgehoste on-premises **Eyes**-engine van DressApp (momenteel een gefinetuned **Qwen 2.5 VL 3B**-model) op poort 7860, zonder dat er persoonlijke API-sleutels nodig zijn.
  - *Manager- & Professional-abonnementen (Snel Cloudmodel)*: Abonnees met een **Manager**- of **Professional**-abonnement profiteren van prioriteitsroutering naar het snelle Cloud AI-model (momenteel **Google Gemini 3.5 Flash** via `llm_gateway.py`).
  - *On-Premises Quotum-vangnet*: Als er externe cloudsnelheidslimieten (`429` / `RESOURCE_EXHAUSTED`) worden bereikt, vallen verzoeken automatisch terug op de zelfgehoste **Eyes**-container (`Qwen 2.5 VL 3B`) op poort 7860, zodat uw stylinggesprek nooit wordt onderbroken.
- **Abonnement & Kledingkastlimieten**:
  - Bekijk uw huidige abonnementsniveau (**Free**: basislimiet van 150 items vs. **Manager** ($ 10/mnd) of **Professional** ($ 15/mnd): Onbeperkt aantal items + snel Cloud AI-model).
  - Ga naar de **Prijzenpagina** (`/pricing` of klik op uw abonnementskaart) om de vergelijkingstabel te bekijken, een abonnement te kiezen of niet-vervallende prepaid creditpakketten aan te schaffen.
  - Upgrade via PayPal-abonnementen of de Atzmai-gateway voor lokale Israëlische ILS-transacties (Bit / creditcard).
  - **Doorverwijzingslink kopiëren**: Geeft +10 extra kledingkastplaatsen voor elke vriend die zich registreert (tot maximaal 150 items).
- **Planner & Pushherinneringen**:
  - Schakel ochtendmeldingen met outfitvoorstellen in of uit.
  - Stel de frequentie (*Elke dag*, *Om de dag*, *Twee keer per week*, *Op weekdagen*), het tijdstip (bijv. *07:00*) en de gewenste kledingstijl in (*Casual*, *Formeel*, *Sportief*, *Aangepast*).
  - Schakel VAPID-pushmeldingen in uw browser in.
- **Voorkeuren voor Campagnemeldingen**:
  - Specifieke schakelaars voor *Lokale mode push/e-mail*, *Uitverkoopmeldingen*, *Duurzame mode*, *Luxe promoties* en *Persoonlijke stylist*.
  - Pas de schuifregelaar voor **Maximale campagneafstand** aan (5 km tot 50 km).
- **Google Agenda Koppelen**: OAuth-knop om persoonlijke agenda-afspraken te synchroniseren met de AI-Stylist.
- **Kaart voor Locatiediensten**: Schakel gps-locatiemachtigingen in voor op afstand afgestemde expertfeeds en hyperlokaal weer.
- **Knop Vrienden Uitnodigen**: Kopieer een deelbare doorverwijzingslink.
- **Shopping Assistant**: Bekijk gegevens over de Chrome Web Store-extensie of genereer een **Universele Bookmarklet** (`javascript:...`) voor directe maatvergelijkingen bij online winkelen.

---

### 5. Accountacties & Diagnostiek
- **Uitloggen (Sign Out)**: Meld u af bij uw huidige sessie.
- **Mijn Account Verwijderen (Delete my Account)**: Link om alle accountgegevens permanent te wissen.
- **Ontwikkelaarspaneel**: Diagnostische weergave voor omgevingstests. Geauthenticeerd via Google OAuth (`dressappdeveloper@gmail.com`).

---

## Verwachte Resultaten
- Directe synchronisatie van fysieke maten, huidskleur en vrijstaande foto's op het 2D Avatar Try-On Canvas.
- Geen onnodige netwerkverzoeken in rust bij het navigeren tussen instellingenpanelen.
- Op maat gemaakte outfitvoorstellen van de AI-Stylist die zijn afgestemd op uw kledingvoorschriften en agenda.

---

## Probleemoplossing
- **Fotoachtergrond wordt niet verwijderd**: Zorg ervoor dat uw geüploade foto het volledige lichaam toont met een contrasterende achtergrondbelichting.
- **Pushmeldingen komen niet binnen**: Controleer of browsermeldingen zijn ingeschakeld en of er een telefoonnummer is opgeslagen onder *Contact*.
- **Automatisch aanvullen van adres reageert niet**: Controleer of er een actieve internetverbinding is voor OpenStreetMap Nominatim-zoekopdrachten.

---

## Beperkingen
- De opslagruimte voor gratis accounts (Free Tier) is gemaximeerd op 150 items en maakt gebruik van het on-premises Eyes-model (`Qwen 2.5 VL 3B`), tenzij u upgradet naar het **Manager**- of **Professional**-abonnement voor onbeperkte opslag en het snelle Cloudmodel (`Gemini 3.5 Flash`).
- Als cloudquota tijdelijk worden bereikt, vallen verzoeken soepel terug op de ingebouwde on-premises Eyes-engine (`Qwen 2.5 VL 3B`) zonder de sessie te onderbreken.
