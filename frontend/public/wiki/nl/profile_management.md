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

---

## Beperkingen
- Gratis accountruimte is beperkt tot 150 items, tenzij uitgebreid via verwijzingsbonus (+10 slots per uitnodiging) of Pro-abonnement.
- Aangepaste API-sleutelmodus vereist geldige sleutels met resterende quota van de betreffende provider.

(End of file)