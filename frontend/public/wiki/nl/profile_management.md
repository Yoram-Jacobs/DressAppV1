# Profiel, Maten & Configuratie (`/me`)

Beheer uw lichamelijke maten, huidskleur, uitsnijdingen van lichaamsfoto's, stylingvoorkeuren, AI-modelreferenties en systeemintegraties op uw persoonlijke profieldashboard.

## Overzicht
De pagina **Profiel & Instellingen** (`https://dressapp.co/me`) fungeert als het centrale bedieningspunt voor uw DressApp-ecosysteem. Het bevat uw fysieke antropometrische parameters, het virtuele paspop-podium voor de avatar, stijlbeperkingen, geïntegreerde voorkeuren, API-sleutels voor AI-modellen en schema's voor pushmeldingen.

---

## Voorwaarden
- Een actief DressApp-account.
- (Optioneel) Apparaatcameramachtigingen voor het uploaden van een foto van het gehele lichaam.
- (Optioneel) Locatiemachtigingen voor lokale campagnes van stylisten en weersvoorspellingen.

---

## Stapsgewijze Handleiding: Pagina-overzicht van boven naar beneden

### 1. Pagina-header & Ontdek-navigatiebalk
Bovenaan het `/me` dashboard te vinden:
- **Header**: Toont uw accountstatus en titel.
- **Ontdek-kaarten (Explore Cards)**: Snelle snelkoppelingen naar de hoofdsecties van de app:
  - **Trend Scout** (`/trends`): Bekijk dagelijkse door AI samengestelde modenieuwsfeeds.
  - **Outfits** (`/outfits`): Toegang tot uw opgeslagen outfitkalender.
  - **Experts** (`/experts`): Blader door lokale modestylisten en kleermakers.
  - **Statistieken (Stats)** (`/me/stats`): Bekijk garderobewaardering, kosten-per-draagbeurt en kleurstatistieken.

### 2. Taal- & Stemselectiekaart
Prominent weergegeven voor onmiddellijke toegankelijkheid:
- **Taalselector**: Kies uit 12 ondersteunde talen (*Engels, Spaans, Frans, Duits, Italiaans, Portugees, Russisch, Chinees, Japans, Arabisch, Hindi, Hebreeuws*). Het selecteren van een taal werkt automatisch de gebruikersinterface bij en koppelt het standaard regionale Text-to-Speech (TTS) stemmodel.

---

### 3. Identiteit- & Persoonlijke Details-kaart (`ProfileDetailsCard`)

Bevat 9 uitvouwbare accordeonpanelen voor het beheren van uw persoonlijke identiteit, maten en avatarweergave:

#### Paneel A: Identiteit
- **Voornaam & Achternaam**: Persoonlijke identificatievelden.
- **E-mailadres**: Alleen-lezen weergave van uw geregistreerde e-mailadres.
- **Geboortedatum**: Gebruikt om de demografische trendscore te personaliseren.
- *Google Automatisch Invullen-badge*: Verschijnt automatisch als uw profiel is aangemaakt via Google OAuth.

#### Paneel B: Contact & Bezorgadres
- **Telefoonnummer**: Vereist voor het ontvangen van SMS/Push-meldingen voor dagelijkse voorstellen en lokale expertcampagnes.
- **Adres Regel 1**: Beschikt over straatniveau automatisch aanvullen via OpenStreetMap (Nominatim).
- **Adres Regel 2, Stad, Regio, Postcode**: Handmatige adresvelden voor marktplaatsverzending.
- **Land**: Offline keuzelijst doorzoekbaar op landnaam of ISO-2-code.

#### Paneel C: Demografie
- **Geslacht**: Selecteer *Vrouw* of *Man* om de basislichaamsmaten en kledingtaxonomie te configureren.
- **Burgerlijke Staat**: Selecteer *Ongehuwd*, *Gehuwd*, *Gescheiden* of *Verweduwd*.
- **Beroep**: Vrije tekstinvoer (bijv. *Student*, *Marketing Manager*, *Barista*). Voedt de Trend Scout personalisatie.

#### Paneel D: Voorkeuren & Meeteenheden
- **Gewichtseenheid**: Schakel tussen Kilogram (`kg`) en Pond (`lb`).
- **Lengte-eenheid**: Schakel tussen Centimeter (`cm`) en Inch (`in`).

#### Paneel E: Foto's & Digitaal Avatar-podium
- **Linkerkolom — Fotoselecteurs**:
  - *Gezichtsfoto*: Upload een avatarsamenvatting.
  - *Foto van het gehele lichaam*: Upload een foto van het gehele lichaam. Het systeem voert automatisch een lokale U2-Net (`rembg`) uit om de achtergrond te verwijderen.
  - *Foto Verwijderen-knop*: Met één klik uw fotouitsnijding verwijderen, waardoor het paspodium direct en zonder vertraging terugschakelt naar de 2D SVG-vectorpaspop.
- **Rechterkolom — Digitale Avatar & Paspodium**:
  - **Huidskleurselectie**: Interactief kleurenpalet om de huidskleur van uw paspop te kiezen.
  - **Avatar Pas-canvas**: Rendert kledingstukken bovenop uw fotouitsnijding of dynamische Bezier-vectorpaspop (`DynamicAvatar.jsx`) met gecalibreerde offsets (`top-[14.5%]` kraag-tot-halslijn en `top-[36.5%]` tailleband-tot-taillelijn).

#### Paneel F: Stijlprofiel
- **Esthetiek**: Door komma's gescheiden stijl-trefwoorden (bijv. *Minimalistisch, Streetwear, Vintage*).
- **Kleurenpalet**: Voorkeurskleurtinten (bijv. *Pastel, Aardtinten, Monochroom*).
- **Vermijden**: Kleuren of kledingtypen die strikt moeten worden uitgesloten van AI-aanbevelingen.
- **Kledingbescheidenheid**: Selecteer het bedekkingsniveau (*Casual/Ontspannen*, *Matig*, *Conservatief*) om de kledingbedekking van de AI Stylist te sturen.

#### Paneel G: Lichaamsmaten & Maatvoering (ANSUR II Maatvoorspeller)
- **Onboarding / Schone Start-modus**: Voer 4 basisgegevens in: **Lengte**, **Gewicht**, **Tailleomtrek** en **Voetlengte**. Het ingebouwde scikit-learn ANSUR II multi-output regressiemodel voorspelt automatisch 6 structurele maten:
  - *Schouders*, *Borst / Buste*, *Heup*, *Mouwlengte*, *Binnenbeenlengte* en *Buitenbeenlengte*.
- **Gedetailleerde Bewerkingsmodus**: Fine-tune alle 15 maatparameters en haarattributen.

#### Paneel H: Registratie in de Directory voor Experts
- **Professionele Stylist-schakelaar**: Registreer als een geverifieerde modeprofessional.
- **Bedrijfsgegevens**: Voer Bedrijfsnaam, Adres, Telefoonnummer, E-mail, Website en Beschrijving in voor weergave in de `/experts` gids.

#### Paneel I: PayPal Uitbetalingsinstellingen
- **PayPal Ontvanger E-mail**: Voer uw PayPal-e-mailadres in om uitbetalingen voor verkopen op de marktplaats en actieve campagnes te ontvangen.

---

## 4. Systeemvoorkeuren Accordeonkaart

Beheert instellingen op systeemniveau, abonnementen en AI-integraties:

- **AI-configuratie (AI Configuration)**:
  - *Standaardmodus*: Gebruikt door het systeem beheerde Gemini Flash 2.x-eindpunten.
  - *Aangepaste API-sleutelsmodus*: Verbind eigen Google Gemini, Anthropic, OpenAI of DeepSeek API-sleutels.
- **Abonnement & Garderobelimieten**:
  - Bekijk het huidige accountniveau (**Gratis**: limiet van 150 artikelen vs **Pro**: onbeperkt aantal artikelen).
  - Upgrade via de PayPal Subscriptions REST API ($4.99/maand of $29.99/jaar).
  - **Verwijzingslink kopiëren**: Krijg +10 garderobecapaciteitsslots voor elke vriend die zich registreert.
- **Planner & Push-herinneringen**:
  - Schakel herinneringsmeldingen voor ochtend-outfits in.
  - Stel frequentie, tijd en kledingvoorschriften in.
  - Browser VAPID pushmeldingen inschakelen.
- **Voorkeuren voor Campagnemeldingen**:
  - Schakelaars voor *Lokale Mode Push/E-mail*, *Kortingsmeldingen*, *Duurzame Mode*, *Luxe Promoties* en *Persoonlijke Stylist*.
  - Pas de schuifregelaar **Maximale Campagne-afstand** aan (5 km tot 50 km).
- **Google Calendar Koppelen**: OAuth-knop om persoonlijke agenda-evenementen te synchroniseren met de AI Stylist.
- **Locatiediensten**: Schakel GPS-locatiemachtigingen in voor dichtbijgelegen experts en lokaal weer.
- **Vrienden Uitnodigen-knop**: Kopieer uw deelbare verwijzingslink.
- **Shopping Assistant**: Bekijk details van de Chrome Web Store-extensie of genereer een **Universele Bladwijzer** (`javascript:...`) voor directe maatvergelijkingen op e-commercesites.

---

## 5. Accountacties & Diagnostiek
- **Uitloggen**: Uitloggen uit uw huidige sessie.
- **Mijn Account Verwijderen**: Link om accountgegevens permanent te wissen.
- **Ontwikkelaarspaneel**: Diagnostisch accordeon voor omgevingsstests.

---

## Verwachte Resultaten
- Directe synchronisatie van fysieke meetwaarden, huidskleur en fotouitsnijdingen op het 2D-avatar pas-canvas.
- Geen onnodige netwerkverzoeken bij het navigeren tussen instellingenpanelen.
- Gepersonaliseerde AI Stylist outfitvoorstellen afgestemd op uw bescheidenheidsregels en agenda.

---

## Probleemoplossing
- **Foto-achtergrond niet verwijderd**: Zorg ervoor dat de geüploade foto een volledige lichaamsfoto is met een goed contrasterende achtergrondverlichting.
- **Pushmeldingen komen niet aan**: Controleer of de meldingsmachtigingen van de browser zijn ingeschakeld en er een telefoonnummer is opgeslagen.
- **Automatisch aanvullen van adres reageert niet**: Controleer of de internetverbinding actief is voor OpenStreetMap Nominatim-query's.

---

## Beperkingen
- De ruimte voor een gratis account is beperkt tot 150 artikelen, tenzij deze wordt uitgebreid via verwijzingsbonussen (+10 slots per uitnodiging) of een Pro-abonnement.
- De modus voor aangepaste API-sleutels vereist geldige sleutels met een resterend quotum van de betreffende provider.