# DressApp Privacybeleid

**Inwerkingtredingdatum:** 27 juli 2026
**Laatst bijgewerkt:** 27 juli 2026

Dit Privacybeleid beschrijft hoe DressApp ("wij", "ons" of "we") uw persoonsgegevens verzamelt, gebruikt, opslaat, deelt en beschermt wanneer u onze digitale garderobe- en styling-app gebruikt.

Lees dit beleid zorgvuldig. Door het gebruik van DressApp gaat u akkoord met de hier beschreven datapraktijken. Als u het niet eens bent, gebruikt u de app niet.

---

## 1. Informatie die We Verzamelen

### 1.1 Account- en Profielinformatie
Wanneer u een account aanmaakt of zich aanmeldt via sociale login, verzamelen we:

- **E-mailadres** — gebruikt voor accountidentificatie, authenticatie en transactiecommunicatie.
- **Wachtwoord** — opgeslagen als cryptografische hash; we slaan nooit wachtwoorden op in cleartext.
- **Weergavenaam** — uw gekozen publieke naam binnen de app.
- **Voornaam en achternaam** — gevuld via Google OAuth-profiel of handmatig ingevoerd; te allen tijde bewerkbaar.
- **Telefoonnummer** — optioneel; gebruikt voor accountherstel en meldingen.
- **Geboortedatum** — optioneel; gebruikt voor leeftijdsgebonden inhoudsfiltering.
- **Geslacht** — optioneel; gebruikt voor lichaamsmaataanbevelingen en avatar.
- **Burgerlijke staat** — optioneel (single, getrouwd, gescheiden, weduwe).
- **Adres** — optioneel; gestructureerd als {regel1, regel2, stad, regio, land, postcode}.
- **Voorkeurstaal en -regio** — gebruikt om de app-ervaring te localiseren.
- **Voorkeursstem** — gebruikt voor AI-stylist spraakoutput.
- **Avatar en profielfoto's** — gezichts- en lichaamsfoto, opgeslagen als base64-data-URLs in MongoDB (beperkt tot ~500 KB elk aan de clientzijde).
- **Lichaamsmaten** — lengte, gewicht, borst, taille, heupen en andere maten gebruikt voor avatar-generatie en pasvormaanbevelingen.
- **Haarprofiel** — lengte, type, kleur en stijl (optioneel).
- **Thuislocatie** — stad, land en coördinaten (lat/long), gebruikt voor weergebaseerde outfitaanbevelingen en campagnetargeting.
- **Stijlprofiel en culturele context** — uw stijlvoorkeuren en culturele achtergrond voor gepersonaliseerde aanbevelingen.

### 1.2 Garderobe- en Mediagegevens
DressApp is een digitale garderobe-app. De volgende gegevens zijn essentieel voor de werking van de app:

- **Garderobefoto's** — afbeeldingen van uw kledingstukken die u uploadt. Deze worden in de browser verwerkt voor achtergrondverwijdering (matting) en vervolgens opgeslagen als data-URLs in MongoDB.
- **Kledingmetadata** — categorie (Bovenstuk, Onderstuk, Schoenen, Jas, Jurk, Accessoire), merk, kleur, maat, seizoen, traditie, kledingcode, geslacht en subcategorie-tags.
- **Outfitgegevens** — opgeslagen outfitcombinaties die meerdere garderobestukken met elkaar verbinden.
- **Marktplaatsadvertenties** — als u artikelen verkoopt of ruilt, advertentiedetails inclusief foto's, prijs en verzendinformatie.
- **Reis-/paklijstgegevens** — paklijsten voor reizen met artikelen, hoeveelheden en doeltags (bijv. "Wandelen / Buitenshuis").

### 1.3 Apparaatmachtingen
DressApp vraagt de volgende apparaatmachtingen aan:

- **Camera** — om foto's van kledingstukken direct in de app te capturen.
- **Fotobibliotheek / bestandstoegang** — om bestaande foto's te selecteren voor upload.
- **Geolocatie** — grove locatie-toegang om weergegevens op te halen en outfits te suggereren. U kunt deze machting op elk moment weigeren of intrekken.
- **Meldingen** — optionele pushmeldingen voor campagnewijzigingen en stylistaanbevelingen.

### 1.4 AI en Machine Learning
DressApp gebruikt apparaat- en serverzijde AI voor de volgende doeleinden:

- **Achtergrondverwijdering (matting)** — uw geüploade kledingfoto's worden verwerkt via de `rembg` / u2netp-pipeline om schone uitsneden te extraheren. Deze verwerking vindt plaats op de server.
- **Lichaamsvoorspelling** — het SegFormer-model schat lichaamsmaten uit volledige outfitfoto's.
- **Kledingclassificatie** — CLIP-gebaseerde classificatie tagt items met categorieën, kleuren en merken.
- **Stylistaanbevelingen** — de Google Gemini API verwerkt uw garderobedata om outfitsuggesties en stijltips te genereren.
- **Avatargeneratie** — 3D-avatar-vormparameters worden berekend uit lichaamsmaten voor virtueel passen.

**Belangrijk:** Door gebruikers geüploade foto's worden **niet** gebruikt om machine learning-modellen te trainen. Ze worden uitsluitend verwerkt om de kernfuncties van de app te bieden en worden niet gedeeld met trainingspipelines.

### 1.5 Gebruiksgegevens en Analyse
We verzamelen geaggregeerde, anonieme gebruiksgegevens om de app te verbeteren:

- Activiteits- en functionaliteitsgebruikspatronen.
- Iteminteractiedata (weergaven, bewerkingen, verwijderingen).
- Apparaatidentificatoren (IP-adres, besturingssysteemversie, browsertype).
- Campagneanalyse (advertentie-impressies, klikken, weergaven) — gekoppeld aan campagne-IDs, niet aan individuele gebruikersidentiteiten.

We gebruiken **geen** derde-partij analyse-SDKs (geen Mixpanel, Firebase Analytics, Amplitude, Sentry, LogRocket of vergelijkbare). Alle analyse wordt intern beheerd.

### 1.6 Betalingsgegevens
Als u de marktplaats- of abonnementsfuncties van DressApp gebruikt, verzamelen we:

- **Stripe** — Stripe-account-ID, abonnements-ID en betalingsintentie-IDs. Creditcardnummers worden nooit op onze servers opgeslagen; ze worden direct door Stripe verwerkt.
- **PayPal** — PayPal-ontvanger-e-mail en bestel-/vangst-IDs.
- **Apple Pay / Google Play** — betalingstokens verwerkt door de respectieve platform-SDKs; we slaan kaartgegevens niet op.

### 1.7 Derde-partij Authenticatiegegevens
- **Google OAuth** — wanneer u inlogt met Google, ontvangen en slaan we een versleuteld OAuth-token (`google_oauth`-veld) op dat wordt gebruikt om toegang te krijgen tot uw Google-profiel (naam, e-mail, foto) en, optioneel, Google Calendar en People API voor planning- en contactfuncties.

---

## 2. Hoe We Uw Gegevens Gebruiken

We gebruiken uw gegevens voor de volgende doeleinden:

| Doel | Wettelijke grondslag (AVG) | Gegevenstypen |
|---|---|---|
| Kernapp-functies leveren (garderobe-organisatie, outfitcreatie, avatargeneratie) | Contractuele noodzaak | Garderobefoto's, metadata, lichaamsmaten |
| Achtergrondverwijdering en kledingmatting verwerken | Contractuele noodzaak | Geüploade kledingfoto's |
| AI-stylistaanbevelingen genereren | Rechtmatig belang | Garderobemetadata, stijlprofiel |
| Weergegevens ophalen voor outfitaanbevelingen | Toestemming (locatiemachting) | Thuislocatie (schatting) |
| Gebruikersaccounts authenticatiëren en beheren | Contractuele noodzaak | E-mail, wachtwoordhash, OAuth-tokens |
| Transactie-e-mails verzenden (accountbevestigingen, wachtwoordreset, verwijderingsbevestigingen) | Contractuele noodzaak | E-mailadres |
| Marktplaatsbetalingen verwerken | Contractuele noodzaak | Stripe/PayPal-tokens, facturatieinfo |
| Fraude/missbruik detecteren en voorkomen | Rechtmatig belang | IP-adres, apparaatidentificatoren |
| App-functionaliteit verbeteren (geaggregeerde analyses) | Rechtmatig belang | Anonieme gebruiksgegevens |
| Wettelijke verplichten nakomen | Wettelijke verplichting | Alle gegevens volgens wettelijke vereisten |

---

## 3. Gegevensopslag en Beveiliging

### 3.1 Opslag
- **Database:** MongoDB Atlas (cloud-gehost, gratis M0-niveau of betaald niveau afhankelijk van de implementatie).
- **Afbeeldingen:** Garderobefoto's worden opgeslagen als base64-gecodeerde data-URLs in MongoDB-documenten. Elke afbeelding is beperkt tot ~500 KB aan de clientzijde vóór upload.
- **Modelcache:** AI-modelgewichten (SegFormer, u2netp) worden gecacheerd op persistente Docker-volumes op de productieserver om herhaalde downloads bij elke aanvraag te voorkomen.
- **Geen externe blob-opslag** wordt momenteel gebruikt voor afbeeldingen; alle beeldgegevens bevinden zich in MongoDB.

### 3.2 Beveiliging
- Alle gegevens in transit zijn versleuteld via **HTTPS/TLS 1.3**.
- Wachtwoorden worden opgeslagen als **bcrypt-hashes** — nooit in cleartext.
- Google OAuth-tokens zijn versleuteld opgeslagen in rust.
- Betaalgegevens (Stripe/PayPal-tokens) worden nooit in cleartext op onze servers opgeslagen; we slaan alleen referentie-IDs op.
- MongoDB Atlas biedt **versleuteling op schijf** en **versleuteling in transit** standaard.
- Toegang tot de database is beperkt tot de backend-applicatie via verbindingsreeksreferenties.

### 3.3 Gegevensretentie
- Uw gegevens worden bewaard zolang uw account actief is.
- Na accountverwijdering (zie Sectie 5) worden alle persoonsgegevens binnen 30 dagen permanent uit MongoDB verwijderd.
- Geaggregeerde, anonieme analysegegevens kunnen oneindig worden bewaard en kunnen niet worden teruggevoerd naar individuele gebruikers.

---

## 4. Gegevensdeling en Derde Partijen

We delen uw gegevens met de volgende derde partijen alleen zoals hieronder beschreven:

| Derde partij | Gedeelde gegevens | Doel |
|---|---|---|
| **MongoDB Atlas** | Alle gebruikersgegevens en garderobeafbeeldingen | Cloud database-hosting |
| **Google (OAuth)** | E-mail, naam, profielfoto | Authenticatie en profielcreatie |
| **Google Calendar API** | Calendargebeurtenisgegevens (indien verbonden) | Stylist-planningfuncties |
| **Google People API** | Contactgegevens (indien verbonden) | Sociale functies |
| **Google Gemini API** | Garderobemetadata en itembeschrijvingen | AI-stylistaanbevelingen |
| **Stripe** | Betalingstokens, facturatieinfo | Betalingsverwerking |
| **PayPal** | Betalingstokens, facturatieinfo | Betalingsverwerking |
| **Resend / SendGrid** | E-mailadres en naam | Levering van transactie-e-mails |

**We verkopen uw persoonsgegevens of garderobeafbeeldingen NIET aan derde partijen makelaars, adverteerders of data-aggregators.**

---

## 5. Uw Rechten en Accountverwijdering

Onder de AVG (EU/EEA), de CCPA (Californië) en andere toepasselijke privacywetten heeft u de volgende rechten:

### 5.1 Toegang en Export
U kunt een kopie van alle persoonsgegevens die wij over u hebben vragen door ons te contacteren (zie Sectie 6). We verstrekken een JSON-export van uw accountgegevens, inclusief garderobestukken, outfits en profielinformatie.

### 5.2 Correctie
U kunt uw profielinformatie op elk moment bijwerken of corrigeren via de Instellingen-pagina van de app. Bewerkbare velden omvatten: weergavenaam, voornaam en achternaam, telefoon, geboortedatum, adres, lichaamsmaten, thuislocatie en stijlvoorkeuren.

### 5.3 Verwijdering (Recht op vergetelheid)
U kunt uw account en alle bijbehorende gegevens op elk moment verwijderen:

- **In de app:** Ga naar Instellingen → Account → Account verwijderen.
- **API:** Stuur een `POST`-verzoek naar `/api/v1/users/me/delete` (geauthenticeerd).

Accountverwijdering activeert een **cascadeverwijdering** over alle collecties:
- Gebruikersdocument
- Alle garderobestukken (foto's en metadata)
- Alle outfits
- Alle marktplaatsadvertenties
- Alle reistaschen en paklijsten
- Alle stylist-sessies en berichten
- Alle kredietopnames en transactierecords
- Alle embeddings (AI- gegenereerde gegevens)
- Alle webpush-abonnementen

Een bevestigingsmail wordt naar uw geregistreerde e-mailadres gestuurd.

### 5.4 Data Portabiliteit
U kunt uw gegevens op elk moment aanvragen in een gestructureerd, machineleesbaar formaat (JSON). Neem contact met ons op via de gegevens in Sectie 6.

### 5.5 Toestemming intrekken
U kunt uw toestemming voor locatie-toegang, camera-toegang en marketingcommunicatie op elk moment intrekken via de apparaatinstellingen of de Instellingen-pagina van de app. Het intrekken van toestemming kan bepaalde app-functies beperken (bijv. weergebaseerde outfitaanbevelingen).

### 5.6 Recht van Beroep (LGPD Art. 18, AVG Art. 21)
Onder de LGPD (Brazilië) en de AVG (EU/EEA) heeft u het recht om bezwaar te maken tegen de verwerking van uw persoonsgegevens voor specifieke doeleinden, waaronder:
- Verwerking op basis van rechtmatig belang
- Directe marketing
- Profiling en geautomatiseerde besluitvorming (inclusief AI-gebaseerde stylistaanbevelingen)

Om bezwaar te maken, neem contact met ons op via de gegevens in Sectie 6.

### 5.7 Internationale Gegevensoverdrachten
DressApp is een internationale applicatie. Uw gegevens kunnen worden overgedragen en verwerkt in landen buiten uw woonland, waaronder Israël en de Verenigde Staten. Wij garanderen dat alle overdrachten worden geregeld door adequaat beschermingsmaatregelen, inclusief Standaard Contractuele Clausules (SCC) wanneer dit door de toepasselijke wet wordt vereist.

---

## 6. Contactinformatie

Voor privacy gerelateerde vragen, verzoeken tot gegevens toegang, verwijderingsverzoeken of het melden van een privacy zorg, neem contact met ons op:

**E-mail:** dev@dressapp.co
**Adres:** DressApp, 11 Hanoter St, 8442711 Be'er-Sheva, Israël

We zullen op alle geldende verzoeken binnen 30 dagen reageren, zoals vereist door toepasselijke privacy wetten inclusief AVG, CCPA, LGPD, PIPEDA en andere internationale gegevensbeschermingsregelgeving.

Voor Verzoeken tot Toegang door Betreffenden (DSAR's), voeg het e-mailadres van uw account toe en een beschrijving van de gegevens waarop u toegang wilt of die u wilt wijzigen.

---

## 7. Privacy van Minderjarigen

DressApp is niet bedoeld voor kinderen onder de 16 jaar (of de van toepassing zijnde leeftijd van digitale toestemming in uw jurisdictie, welk hoger is). We verzamelen niet bewust persoonsgegevens van personen jonger dan deze leeftijd. Als wij weten dat een minderjarige ons persoonsgegevens heeft verstrekt, zullen we maatregelen nemen om deze tijdig te verwijderen.

Als u een ouder of wettelijke voogd bent en denkt dat uw kind ons persoonsgegevens heeft verstrekt, neem dan contact met ons op via dev@dressapp.co en we zullen onmiddellijk optreden.

---

## 8. Internationale Conformiteit

DressApp is ontworpen om in alle landen te werken. Dit Privacybeleid is opgesteld om te voldoen aan de volgende internationale gegevensbeschermingskaders:

| Kader | Jurisdictie | Belangrijkste gedekte bepalingen |
|---|---|---|
| **AVG** | EU/EEA | Wettelijke grondslag, rechten van de betrokkene, DPO-contact, internationale overdrachten, melding van schendingen |
| **CCPA/CPRA** | Californië, VS | Recht om te weten, te verwijderen, te kiezen voor geen verkoop, niet-discriminatie |
| **LGPD** | Brazilië | Wettelijke grondslag, rechten van de betrokkene, DPO, internationale overdrachten, toestemming |
| **PIPEDA** | Canada | Toestemming, toegang, correctie, verantwoordelijkheid, melding van schendingen |
| **POPIA** | Zuid-Afrika | Wettelijke verwerking, rechten van de betrokkene, grensoverschrijdende overdracht |
| **PDPA** | Thailand | Toestemming, rechten van de betrokkene, internationale overdracht |
| **PDPL** | Saoedi-Arabië | Wettelijke grondslag, rechten van de betrokkene, internationale overdracht |

Wanneer de wet van een specifieke jurisdictie aanvullende rechten of beschermingen vereist die verder gaan dan wat in dit beleid wordt beschreven, passen deze aanvullende rechten toe.

---

## 9. Wijzigingen in dit Privacybeleid

We kunnen dit Privacybeleid van tijd tot tijd bijwerken. We zullen u op de hoogte stellen van wezenlijke wijzigingen via:

- Het publiceren van de bijgewerkte politiek op deze pagina met een herziene "Inwerkingtredingsdatum".
- Het verzenden van een e-mailmelding naar uw geregistreerde e-mailadres voor wezenlijke wijzigingen.
- Het weergeven van een kennisgeving in de app de volgende keer dat u deze opent.

Wij moedigen u aan om dit beleid periodiek te herzien.

---

## 10. Inwerkingtredingsdatum en Toepasselijk Recht

Dit Privacybeleid is inwerking getreden op **27 juli 2026**.

DressApp is een internationale applicatie die in alle landen opereert. Dit beleid wordt geregeld door de principes van de **Algemene Verordening Gegevensbescherming (AVG)** — EU/EEA, de **California Consumer Privacy Act (CCPA)** — Verenigde Staten, de **Lei Geral de Proteção de Dados (LGPD)** — Brazilië, de **Personal Information Protection and Electronic Documents Act (PIPEDA)** — Canada en andere toepasselijke internationale gegevensbeschermingswetten. In geval van conflict tussen deze kaders, geldt de beschermendere standaard voor de gebruiker.

---

## 11. App Store Conformiteit

Dit Privacybeleid is openbaar gehost op:

**https://dressapp.co/privacy**

Het wordt verwezen naar in:
- **Apple App Store Connect** — App Privacy sectie
- **Google Play Console** — Data Safety sectie
- **App-instellingen** — een directe koppeling is beschikbaar in het Instellingenmenu
- **Onboarding-proces** — een privacykennisgeving wordt getoond tijdens de eerste accountinstelling

---

*DressApp respecteert uw privacy en is committed aan transparante datapraktijken. Als u vragen heeft over dit beleid of over hoe wij uw gegevens verwerken, neem dan contact met ons op via dev@dressapp.co.*