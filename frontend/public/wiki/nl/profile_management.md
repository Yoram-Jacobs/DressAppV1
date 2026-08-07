Hier is de Nederlandse vertaling van de DressApp markdown documentatie:

# Profiel, Maten & Configuratie (`/me`)

Beheer fysieke metingen, huidskleur, uitsnedes van lichaamsfoto's, stijlvoorkeuren, AI model referenties en systeemintegraties op uw persoonlijke profiel dashboard.

## Overzicht
De pagina **Profiel & Instellingen** (`https://dressapp.co/me`) dient als de centrale controlehub voor uw DressApp ecosysteem. Het bevat uw fysieke antropometrische parameters, het digitale try-on avatar podium, stijlbeperkingen, gelokaliseerde voorkeuren, AI model sleutels en push notificatieschema's.

---

## Vereisten
- Een actief DressApp account.
- (Optioneel) Apparaatcamera-rechten voor het uploaden van een full-body foto.
- (Optioneel) Locatierechten voor het targeten van lokale stylistcampagnes en weersvoorspellingen.

---

## Stap-voor-stap gids: Paginaoverzicht van boven naar beneden

### 1. Paginakop & Ontdek Navigatiebalk
Bovenaan het `/me` dashboard te vinden:
- **Kop**: Toont uw accountstatus en titel.
- **Ontdekkaarten**: Snelle snelkoppelingen naar de belangrijkste app-secties:
  - **Trend Scout** (`/trends`): Bekijk dagelijkse door AI samengestelde modenieuwsfeeds.
  - **Outfits** (`/outfits`): Toegang tot uw opgeslagen outfitkalender.
  - **Experts** (`/experts`): Blader door lokale modestylisten en kleermakers.
  - **Uitgepakt / Statistieken** (`/me/stats`): Bekijk de waardering van uw garderobe, kosten-per-draag-statistieken en kleuruitsplitsingen.

### 2. Kaart voor Taal- en Stemselectie
Prominent weergegeven voor directe toegankelijkheid:
- **Taal kiezer**: Kies uit 12 ondersteunde talen (*English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi, Hebrew*). Het selecteren van een taal werkt automatisch de UI locale bij en koppelt het standaard regionale Text-to-Speech (TTS) stemmodel.

---

### 3. Identiteits- & Persoonlijke Gegevens Kaart (`ProfileDetailsCard`)

Bevat 9 uitvouwbare accordeonpanelen die uw persoonlijke identiteit, maatvoering en avatar rendering beheren:

#### Paneel A: Identiteit
- **Voornaam & Achternaam**: Persoonlijke identificatievelden.
- **E-mailadres**: Alleen-lezen weergave van uw geregistreerde e-mail.
- **Geboortedatum**: Wordt gebruikt om demografische trendscoring te personaliseren.
- *Google Autofill Badge*: Wordt automatisch weergegeven als uw profiel is ingevuld via Google OAuth.

#### Paneel B: Contact- & Bezorgadres
- **Telefoonnummer**: Vereist om SMS/Push meldingen te ontvangen voor dagelijkse planner voorstellen en lokale expertcampagnes.
- **Adresregel 1**: Beschikt over OpenStreetMap (Nominatim) straatniveau autocomplete. Het selecteren van een suggestie vult automatisch Regel 1, Stad, Regio, Postcode en Land in.
- **Adresregel 2, Stad, Regio, Postcode**: Handmatige adresvelden voor marketplace verzending.
- **Land**: Offline combobox doorzoekbaar op landnaam of ISO-2 code.

#### Paneel C: Demografie
- **Geslacht**: Selecteer *Vrouw* of *Man* om basis lichaamsmaten en kledingtaxonomie te configureren.
- **Burgerlijke Staat**: Selecteer *Alleenstaand*, *Getrouwd*, *Gescheiden* of *Weduwnaar/Weduwe*.
- **Beroep**: Vrije tekstinvoer (bijv. *Student*, *Marketing Manager*, *Barista*). Voedt de Trend Scout personalisatie-ranker om relevant stijlnieuws te prioriteren.

#### Samenvattende Gids: Ontbrekende Google Profielgegevens synchroniseren (People API Her-toestemming)
Als u bent ingelogd met Google voordat DressApp toegang vroeg tot uw **People API** profielgegevens (telefoon, adres, geslacht, geboortedatum), kunnen die velden leeg blijven. U kunt ze synchroniseren met één klik:

1.  **Open het Contact- of Demografie-accordeon** — u ziet een **"Synchroniseren vanuit Google"** knop (verversingspictogram) naast de sectietitel.
2.  **Klik op "Synchroniseren vanuit Google"** — als de vereiste People API scopes niet waren verleend tijdens uw oorspronkelijke aanmelding, detecteert DressApp dit en toont een info toast: *"Google heeft uw toestemming nodig om toegang te krijgen tot profielgegevens. U wordt doorgestuurd naar Google om toegang te verlenen."*
3.  **Verleen toestemming op het scherm van Google** — u wordt doorgestuurd naar het OAuth toestemmingsscherm van Google. Vink de vakjes aan voor **Profielinfo** (naam, e-mail, foto) en **Contactinfo** (telefoon, adres, geslacht, verjaardag).
4.  **Automatische terugkeer & automatisch invullen** — na toestemming stuurt Google u terug naar DressApp. De functie `syncGoogleProfile()` wordt automatisch uitgevoerd en roept de backend `/auth/google/sync-profile` endpoint aan, die:
    - Uw telefoon, adres, geslacht en geboortedatum ophaalt van Google People API
    - De lege velden invult in de panelen **Contact** (telefoon, adres) en **Demografie** (geslacht, geboortedatum)
    - De updates direct opslaat in uw profiel
5.  **Klaar** — uw profiel is nu compleet zonder handmatig typen.

> **Opmerking**: De "Synchroniseren vanuit Google" knop verschijnt ook in de paginakop (naast de hoofd "Google Profiel Synchroniseren" knop) en werkt op dezelfde manier — het synchroniseert alle beschikbare Google profielgegevens tegelijk.

#### Paneel D: Voorkeuren & Maateenheden
- **Gewichtseenheid**: Wissel tussen Kilogrammen (`kg`) en Ponden (`lb`).
- **Lengte-eenheid**: Wissel tussen Centimeters (`cm`) en Inches (`in`).

#### Paneel E: Foto's & Digitale Avatar Podium
- **Linkerkolom — Fotokiezers**:
  - *Gezichtsfoto*: Upload een avatar thumbnail.
  - *Full-body foto*: Upload een full-body foto. Het systeem voert automatisch lokale U2-Net (`rembg`) matting uit om de achtergrond te verwijderen.
  - *Foto verwijderen knop*: Verwijdering van uw foto-uitsnede met één klik, waardoor het try-on podium direct terugschakelt naar de 2D SVG vectorpaspop zonder UI lag.
- **Rechterkolom — Digitale Avatar & Try-On Podium**:
  - **Huidskleurkiezer**: Interactief kleurenpalet om uw paspop huidskleur te selecteren.
  - **Avatar Try-On Canvas**: Rendert kledingstukken bovenop uw foto-uitsnede of dynamische Bezier vectorpaspop (`DynamicAvatar.jsx`) met behulp van gekalibreerde landmark offsets (`top-[14.5%]` kraag-tot-halslijn en `top-[36.5%]` tailleband-tot-taillelijn).

#### Paneel F: Stijlprofiel
- **Esthetiek**: Door komma's gescheiden stijl-keywords (bijv. *Minimalist, Streetwear, Vintage*).
- **Kleurenpalet**: Voorkeur voor kleurtinten (bijv. *Pastels, Earth Tones, Monochroom*).
- **Vermijden**: Kleuren of kledingtypen die strikt moeten worden uitgesloten van AI-aanbevelingen (bijv. *Geel, Crop Tops*).
- **Culturele Kleding Conservatisme**: Selecteer bescheidenheidsniveau (*Casual/Relaxed*, *Gematigd*, *Conservatief*) om de outfitdekking van de AI Stylist te sturen.

#### Paneel G: Lichaamsmaten & Maatvoering (ANSUR II Maatvoorspeller)
- **Onboarding / Nieuwe Start Modus**: Voer 4 basisinvoeren in: **Lengte**, **Gewicht**, **Tailleomtrek** en **Voetlengte**. Het ingebouwde scikit-learn ANSUR II multi-output regressiemodel voorspelt automatisch 6 structurele metingen:
  - *Schouders*, *Borst / Buste*, *Heup*, *Mouwlengte*, *Binnenbeenlengte* en *Buitenbeenlengte*.
- **Automatische Maatvertaling**: Zodra de structurele metingen zijn voorspeld, vullen deterministische maatvoeralgoritmen direct **alle standaard winkelmaten** in, tot aan de schoenmaat:
  - *Casual Overhemd Maat* (XS–XXL gebaseerd op borstomtrek)
  - *Broek Taille Maat* (inches, omgerekend van taille cm)
  - *Amerikaanse Schoenmaat* (Heren/Dames formules van voetlengte)
  - *Dames Jurk Maat* (Amerikaanse 0–14+ gebaseerd op taille)
  - *Dames Bh-maat* (band + cup berekend uit buste/onderbuste)
- **Gedetailleerde Bewerkmodus**: Na het automatisch invullen, verfijn alle 15 maatvoeringsparameters (inclusief Overhemd Maat, Broek Maat, Schoen Maat, Bh-maat, Jurk Maat) en Haarkenmerken (*Lengte, Type, Kleur, Stijl*).
- **Live Eenheidswisselaar**: Schakel tussen *kg/cm* en *lb/in* — alle waarden converteren direct zonder opnieuw te voorspellen.

#### Paneel H: Registratie voor Professionele & Expert Directory
- **Professionele Stylist Wisselaar**: Registreer u als een geverifieerde modeprofessional (stylist, kleermaker, ontwerper).
- **Bedrijfsgegevens**: Voer Bedrijfsnaam, Adres, Telefoon, E-mail, Website en Beschrijving in om te verschijnen in de `/experts` directory en de regionale campagne ticker.

#### Paneel I: PayPal Uitbetalingsinstellingen
- **PayPal Ontvanger E-mail**: Voer uw PayPal e-mailadres in om uitbetalingen te ontvangen voor marketplace verkopen en actieve expertcampagnes.

---

### 4. Systeemvoorkeuren Accordeonkaart

Beheert systeeminstellingen, abonnementen en AI-integraties:

- **AI Configuratie**:
  - *Standaardmodus*: Gebruikt door het systeem beheerde Gemini Flash 2.x endpoints.
  - *Aangepaste API Sleutels Modus*: Verbind aangepaste Google Gemini, Anthropic, OpenAI of DeepSeek API sleutels via een begeleide setup modal.
- **Abonnement & Garderobelimieten**:
  - Bekijk het huidige accounttier (**Gratis**: limiet van 50 items versus **Manager** of **Professional**: Onbeperkt aantal items).
  - Upgrade via de PayPal Subscriptions REST API (Manager: $5/maand of $50/jaar; Professional: $10/maand of $100/jaar).
- **Planner & Push Herinneringen**:
  - Schakel meldingen voor outfitvoorstellen in de ochtend in/uit.
  - Stel frequentie in (*Elke Dag*, *Om De Dag*, *Twee Keer Per Week*, *Op Werkdagen*), tijd (bijv. *07:00*) en dresscode-stijleisen (*Casual*, *Formeel*, *Atletisch*, *Aangepast*).
  - Schakel browser VAPID pushmeldingen in.
- **Voorkeuren voor Campagnemeldingen**:
  - Gedetailleerde schakelaars voor *Lokale Mode Push/E-mail*, *Aanbiedingsmeldingen*, *Duurzame Mode*, *Luxe Promoties* en *Persoonlijke Stylist*.
  - Pas de **Max. Campagne Afstand** schuifregelaar aan (5km tot 50km).
- **Google Agenda Verbinden**: OAuth-knop om persoonlijke agenda-evenementen te synchroniseren met de AI Stylist.
- **Locatieservices Kaart**: Schakel GPS-locatierechten in/uit voor op afstand afgestemde expertfeeds en hyperlokaal weer.
- **Vrienden uitnodigen knop**: Kopieer deelbare referral link.
- **Shopping Assistent**: Krijg toegang tot de details van de Chrome Web Store extensie of genereer een **Universele Bookmarklet** (`javascript:...`) voor directe e-commerce maatvergelijkingen.

---

### 5. Accountacties & Diagnostiek
- **Uitloggen**: Log uit van uw huidige sessie.
- **Mijn Account Verwijderen**: Link om accountgegevens permanent te wissen.
- **Ontwikkelaarspaneel**: Diagnostisch accordeon voor omgevingstesten.

---

## Verwachte Resultaten
- Onmiddellijke synchronisatie van fysieke metingen, huidskleur en foto-uitsnedes over het 2D Avatar Try-On Canvas.
- Nul inactieve netwerkverzoeken bij het navigeren tussen instellingenpanelen.
- Gepersonaliseerde AI Stylist outfitvoorstellen afgestemd op uw bescheidenheidsregels en schema.

---

## Probleemoplossing
- **Achtergrond foto niet verwijderd**: Zorg ervoor dat uw geüploade foto full-body is met contrasterende achtergrondverlichting.
- **Pushmeldingen komen niet aan**: Controleer of browser notificatierechten zijn ingeschakeld en een telefoonnummer is opgeslagen onder *Contact*.
- **Adres autocomplete reageert niet**: Controleer of de internetverbinding actief is voor OpenStreetMap Nominatim queries.

---

## Beperkingen
- De accountruimte van de gratis tier is beperkt tot 150 items, tenzij uitgebreid via een referral bonus (+10 slots per uitnodiging) of een Pro abonnement.
- De aangepaste API sleutelmodus vereist geldige sleutels met resterende quota van de respectievelijke provider.
