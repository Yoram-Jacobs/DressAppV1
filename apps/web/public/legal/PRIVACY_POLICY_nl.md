# DressApp Privacybeleid

**Ingangsdatum:** 23 september 2026  
**Laatst bijgewerkt:** 16 oktober 2026  
**App-versie:** 1.0.5  
**Officiële website:** [https://dressapp.co](https://dressapp.co)  
**Speciale privacy-URL:** [https://dressapp.co/privacy](https://dressapp.co/privacy)  

Welkom bij **DressApp** ("wij", "we", "onze", "ons" of "de Applicatie"). DressApp is een intelligent platform voor digitale garderobeplanning, stijladvies en een persoonlijke AI-stylist, ontwikkeld en geëxploiteerd door **DressApp Ltd.**

In dit Privacybeleid wordt in detail uitgelegd hoe wij persoonsgegevens raadplegen, verzamelen, gebruiken, verwerken, opslaan, verstrekken, bewaren en beveiligen wanneer u ons webplatform, onze mobiele applicaties en gekoppelde diensten gebruikt. Lees dit document zorgvuldig door. Door een account aan te maken of DressApp te gebruiken, erkent u de werkwijzen die in dit beleid worden beschreven en gaat u hiermee akkoord.

---

## 1. Gegevens die Wij Verzamelen en Raadplegen

Wij verzamelen gegevens die u rechtstreeks aan ons verstrekt, gegevens die automatisch worden verzameld via interactie met uw apparaat, en gegevens die worden verkregen via geautoriseerde integraties van derden.

### 1.1 Account- & Identiteitsgegevens
- **Authenticatiegegevens:** E-mailadres en cryptografisch gehashte wachtwoorden (gesalt met bcrypt). Wij slaan nooit wachtwoorden in platte tekst op.
- **Profielgegevens:** Weergavenaam, voornaam, achternaam, telefoonnummer (optioneel), geboortedatum (optioneel) en geslacht (optioneel, gebruikt voor stijladvies op maat en avatargeometrie).
- **Demografische & Maatgegevens:** Lichaamsmaten (lengte, gewicht, borstomvang, taille, heupen, binnenbeenlengte, armlengte), voorkeur voor huidskleur en haarprofiel (optioneel) om virtuele pas-avatars en nauwkeurig pasvormadvies te genereren.
- **Locatiegegevens:** Stad, land en globale geografische coördinaten (breedte-/lengtegraad) die met uw toestemming worden verstrekt om lokale weersomstandigheden op te halen voor weersbestendige dagelijkse outfitaanbevelingen.

### 1.2 Digitale Garderobe, Media en Outfits
- **Kledingfoto's:** Afbeeldingen van kledingstukken die u fotografeert of uploadt naar uw digitale kledingkast.
- **Kledingmetadata:** Artikelcategorie (Bovenstuk, Onderstuk, Schoenen, Bovenkleding, Jurk, Accessoire), merk, kleurenpalet, stofsamenstelling, formaliteit/kledingvoorschrift, seizoen en staat-tags.
- **Outfits & Looks:** Door de gebruiker gemaakte outfitcombinaties, ingeplande agendalooks en kofferpaklijsten.
- **Marktplaatscontent:** Artikeladvertenties die zijn aangemaakt voor verkoop, ruil of donatie, inclusief beschrijvingen, vraagprijzen en leveringsvoorkeuren.

### 1.3 Apparaatmachtigingen
- **Camera:** Wordt uitsluitend gebruikt wanneer u rechtstreeks in de app foto's van kledingstukken maakt.
- **Fotobibliotheek:** Wordt uitsluitend gebruikt wanneer u bestaande foto's van kledingstukken of profielavatars kiest om te uploaden.
- **Pushmeldingen:** Worden alleen met uw toestemming gebruikt om dagelijkse outfitherinneringen, updates van de inpakassistent en belangrijke beveiligingswaarschuwingen te sturen.

---

## 2. Google-gebruikersgegevens & Bekendmaking van Beperkt Gebruik (Limited Use)

DressApp biedt optionele integraties met Google om het inloggen van gebruikers en gepersonaliseerde planning te vergemakkelijken. In dit gedeelte wordt expliciet beschreven welke Google-gebruikersgegevens worden geraadpleegd, hoe deze worden gebruikt en opgeslagen, en hoe wij voldoen aan de strenge privacynormen van Google.

> ### Beleid voor gebruikersgegevens van Google API-services — Verklaring inzake Beperkt Gebruik (Limited Use)
> **Het gebruik door DressApp en de doorgifte aan enige andere app van informatie die is ontvangen van Google API's voldoet aan het [Beleid voor gebruikersgegevens van Google API-services (Google API Services User Data Policy)](https://developers.google.com/terms/api-services-user-data-policy), inclusief de vereisten voor Beperkt Gebruik (Limited Use).**

### 2.1 Welke Google-gebruikersgegevens Wij Raadplegen

| Google API-scope | Geraadpleegde Gegevens | Specifiek Doel in DressApp |
|---|---|---|
| `openid`<br>`userinfo.email`<br>`userinfo.profile` | Google-gebruikers-ID, primair e-mailadres, volledige naam en URL van de profielfoto-avatar. | Om uw identiteit te verifiëren, uw DressApp-gebruikersaccount aan te maken en te beveiligen, en uw naam en profielavatar weer te geven in uw persoonlijke garderobedashboard. |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Samenvattingen van Google Agenda-afspraken, begin-/eindtijdstempels, locaties en afspraakbeschrijvingen. | Alleen-lezen toegang die uitsluitend door de AI Stylist-functie wordt gebruikt om outfitsuggesties af te stemmen op uw werkelijke agenda (bijv. het voorstellen van zakelijke kleding voor geplande vergaderingen, sportkleding voor trainingen of formele kleding voor avondevenementen). |
| `https://www.googleapis.com/auth/user.birthday.read`<br>`https://www.googleapis.com/auth/user.gender.read` | Geboortedatum en geslacht (indien ingevuld in uw Google-profiel en uitdrukkelijk toegestaan). | Gebruikt voor het kalibreren van maatalgoritmen voor uw lichaamsavatar, leeftijdsgeschikt stijladvies en pasvormaanbevelingen. |
| `https://www.googleapis.com/auth/user.phonenumbers.read`<br>`https://www.googleapis.com/auth/user.addresses.read` | Telefoonnummer en adres (indien ingevuld in uw Google-profiel en uitdrukkelijk toegestaan). | Uitsluitend gebruikt om na uitdrukkelijke bevestiging van de gebruiker verzendadressen vooraf in te vullen voor marktplaatstransacties en voor accountherstel. |

### 2.2 Hoe Wij Google-gebruikersgegevens Gebruiken
- Google-gebruikersgegevens worden **uitsluitend gebruikt voor het leveren en verbeteren van gebruikersgerichte functies** van de DressApp-applicatie (authenticatie, instellen van het gebruikersprofiel en op uw agenda afgestemde outfitaanbevelingen).
- Wij verwerken titels en tijdstempels van Google Agenda-afspraken in het tijdelijke werkgeheugen om dagelijkse garderobe-aanbevelingen en paklijsten te genereren.

### 2.3 Strikte Verboden en Beschermingsmaatregelen voor Google-gebruikersgegevens
- **Geen Modeltraining:** Google-gebruikersgegevens en gegevens van Google Workspace API's worden **NIET** gebruikt voor het ontwikkelen, verbeteren of trainen van algemene of niet-gepersonaliseerde modellen voor kunstmatige intelligentie (AI) of machine learning (ML).
- **Geen Advertenties:** Wij gebruiken, verzenden of verstrekken Google-gebruikersgegevens **NIET** voor het weergeven van advertenties, waaronder gerichte, gepersonaliseerde, retargeting- of op interesses gebaseerde advertenties.
- **Geen Gegevensmakelaars / Doorverkoop:** Wij verkopen, verhuren, licentiëren of verhandelen Google-gebruikersgegevens onder geen enkele omstandigheid aan derden, gegevensmakelaars of informatie-wederverkopers.
- **Geen Krediet- of Leningsbeoordeling:** Google-gebruikersgegevens worden nooit gebruikt om de kredietwaardigheid te bepalen of voor kredietverstrekkingsdoeleinden.
- **Beperkingen op Menselijke Toegang:** Menselijke werknemers, opdrachtnemers en ontwikkelaars lezen uw Google-gebruikersgegevens **NIET**, tenzij:
  1. U uitdrukkelijke, bevestigende toestemming hebt gegeven voor een specifieke probleemoplossingssessie;
  2. Dit strikt noodzakelijk is voor beveiligingsonderzoeken (zoals onderzoek naar misbruik, fraude of malware);
  3. Dit vereist is om te voldoen aan toepasselijke dwingende wetgeving of geldige overheidsbevelen; of
  4. De gegevens zijn geaggregeerd en geanonimiseerd voor interne technische werkzaamheden.

---

## 3. Hoe Wij Algemene Gegevens Verwerken en Gebruiken

Wij verwerken niet-Google persoonsgegevens op basis van de volgende wettelijke grondslagen:

| Verwerkingsactiviteit | Wettelijke Grondslag (AVG / Wereldwijde Normen) | Gebruikte Gegevenscategorieën |
|---|---|---|
| Indexeren en catalogiseren van digitale garderobe en maken van outfits | Uitvoering van een overeenkomst | Kledingfoto's, categorieën, kleuren, metadata |
| AI-achtergrondverwijdering en extractie van transparante kledinguitsneden | Uitvoering van een overeenkomst | Geüploade kledingfoto's |
| AI Stylist look-aanbevelingen & stijladvies | Gerechtvaardigd belang / Toestemming | Garderobemetadata, stijlvoorkeuren |
| Weersbestendige outfitplanning | Toestemming (locatiemachtiging) | Globale locatie (stad/coördinaten) |
| Transactionele communicatie (beveiligingsmeldingen, wachtwoordherstel) | Uitvoering van een overeenkomst | E-mailadres van het account |
| Marktplaatstransacties en betalingsverwerking | Uitvoering van een overeenkomst | Tokens van betalingsproviders (Stripe/PayPal), transactiegeschiedenis |

---

## 4. Gegevensopslag, Beveiliging en Beschermingsmechanismen

Wij implementeren robuuste administratieve, technische en fysieke beveiligingsmaatregelen die zijn ontworpen om uw gevoelige gegevens te beschermen tegen ongeautoriseerde toegang, wijziging, openbaarmaking of vernietiging:

- **Versleuteling tijdens Overdracht (Encryption in Transit):** 100% van de gegevens die tussen uw browser/app en onze servers worden verzonden, wordt versleuteld met behulp van moderne **HTTPS en Transport Layer Security (TLS 1.3 / TLS 1.2)**.
- **Geïsoleerde Zelfgehoste Database & Opslagbescherming:** Alle databaserecords, garderobemetadata, profielgegevens en versleutelde OAuth-inloggegevens worden opgeslagen in de geïsoleerde, in eigen beheer zijnde **on-premises MongoDB 7.0-database** van DressApp, gehost op speciale **Hetzner Cloud (EU)** NVMe-opslag; deze is geïsoleerd binnen een intern privé-containernetwerk zonder openbare blootstelling van databasepoorten en wordt beschermd door AES-256-versleuteling voor gevoelige tokens en geautomatiseerde lokale back-ups.
- **Cryptografische Wachtwoordbescherming:** Gebruikerswachtwoorden worden versleuteld met bcrypt-hashing inclusief unieke salts per gebruiker.
- **Toegangscontrole:** Toegang tot de productie-infrastructuur is strikt beperkt via SSH-sleutelauthenticatie, multi-factor-authenticatie (MFA), op rollen gebaseerde toegangscontrole met minimale rechten (least-privilege RBAC) en continue auditlogging.

---

## 5. Bewaring en Verwijdering van Gegevens

### 5.1 Bewaartermijn
- Wij bewaren uw persoonsgegevens en garderoberecords zolang uw DressApp-gebruikersaccount actief blijft.
- Google OAuth-toegangstokens en agendacache worden alleen bewaard zolang de Google-integratie actief en door u geautoriseerd blijft.

### 5.2 Google-integraties Ontkoppelen
- U kunt uw Google-account of Google Agenda-integratie op elk moment rechtstreeks in de app ontkoppelen via **Instellingen → Integraties → Google ontkoppelen** (Settings → Integrations → Disconnect Google).
- U kunt de machtigingen van DressApp ook rechtstreeks intrekken via uw [Beveiligingsinstellingen van uw Google-account](https://myaccount.google.com/permissions).
- Na ontkoppeling worden opgeslagen Google OAuth-tokens en in cache bewaarde agendagegevens onmiddellijk gewist uit onze actieve systemen.

### 5.3 Accountverwijdering & Recht op Gegevenswissing
U hebt het absolute recht om uw account en alle bijbehorende gegevens op elk moment te verwijderen:
- **Verwijdering met Één Klik in de App:** Ga naar **Instellingen → Account → Account verwijderen** (Settings → Account → Delete Account).
- **Via E-mailverzoek:** Stuur een e-mail vanaf uw geregistreerde e-mailadres naar [dev@dressapp.co](mailto:dev@dressapp.co) met als onderwerp "Delete My Account" (Verwijder mijn account).

Accountverwijdering voert een onmiddellijke, onomkeerbare cascadeverwijdering uit in alle databases, waarbij het volgende permanent wordt gewist:
- Uw gebruikersprofiel, identiteitsgegevens en inloggegevens;
- Alle garderobe-items, geüploade foto's en vrijstaande afbeeldingen zonder achtergrond;
- Alle opgeslagen outfits, lookbook-items en paklijsten;
- Alle marktplaatsadvertenties en transactieverwijzingen;
- Alle gespreksgeschiedenissen met de AI-stylist, vector-embeddings en Google-tokens.

Alle gegevens worden binnen 30 dagen na het verwijderingsverzoek volledig vernietigd.

---

## 6. Gegevensdeling, Verstrekking en Derden

Wij verkopen, verhuren of verhandelen uw persoonsgegevens niet. De kern-databaseopslag en basis computer vision ("The Eyes") worden rechtstreeks door DressApp geëxploiteerd op onze geïsoleerde, in eigen beheer zijnde on-premises serverinfrastructuur zonder tussenkomst van externe database-SaaS-aanbieders. Wij verstrekken uitsluitend gegevens aan gescreende infrastructuur- en dienstverleners die ons ondersteunen bij het exploiteren van ons platform en die strikt gebonden zijn aan verwerkersovereenkomsten:

| Dienstverlener | Verstrekte Gegevens | Doel |
|---|---|---|
| **Hetzner Online GmbH (EU-infrastructuur)** | Versleutelde servervolumes waarop de zelfbeheerde on-premises MongoDB-database van DressApp, garderobemedia en on-premises AI-inferentie worden gehost | Speciale Europese Virtual Private Server (VPS) en NVMe-opslaginfrastructuur (AVG-conform EU-datacenter) |
| **Google Cloud Platform / Google API's** | OAuth-authenticatietokens, stylingvraag-prompts | Gebruikersauthenticatie en Gemini AI-stylinganalyse |
| **Stripe / PayPal** | Betalingstransactietokens, factureringsmetadata | PCI-conforme betalingsverwerking (kaartnummers raken nooit onze servers) |
| **Resend / Transactionele E-maildienst** | E-mailadres, weergavenaam van gebruiker | Bezorging van essentiële systeemmeldingen en wachtwoordherstel |

---

## 7. Internationale Privacyrechten (AVG/GDPR, CCPA/CPRA, LGPD, PIPEDA)

Afhankelijk van uw geografische locatie beschikt u over specifieke wettelijke privacyrechten:
- **Recht op Inzage / Overdraagbaarheid:** U kunt een volledige, machineleesbare JSON-kopie opvragen van alle persoonsgegevens die wij over u bewaren.
- **Recht op Rectificatie:** U kunt onjuiste persoonsgegevens op elk moment bijwerken of corrigeren in de app-instellingen.
- **Recht op Gegevenswissing:** U kunt verzoeken om permanente verwijdering van uw persoonsgegevens zoals uiteengezet in Artikel 5.
- **Recht op Beperking of Bezwaar:** U kunt op elk moment bezwaar maken tegen geautomatiseerde profilering of uw toestemming voor locatie-/cameraverwerking intrekken.
- **Non-discriminatie:** Wij zullen u nooit discrimineren, diensten weigeren of prijzen aanpassen omdat u gebruik hebt gemaakt van uw privacyrechten.

---

## 8. Privacy van Kinderen

DressApp is uitsluitend bestemd voor personen van ten minste 16 jaar oud (of de wettelijke minimumleeftijd voor digitale toestemming in uw rechtsgebied). Wij vragen of verzamelen niet bewust persoonsgegevens van kinderen jonger dan 16 jaar. Indien wij ontdekken dat een minderjarige jonger dan 16 jaar ons persoonsgegevens heeft verstrekt, zullen wij dergelijke gegevens onmiddellijk van onze servers verwijderen.

---

## 9. Wijzigingen in Dit Privacybeleid

Wij kunnen dit Privacybeleid periodiek bijwerken om wijzigingen in onze diensten, technologische ontwikkelingen of wettelijke vereisten weer te geven. Wanneer er updates plaatsvinden, herzien wij de datum "Laatst bijgewerkt" bovenaan dit beleid en stellen wij gebruikers bij wezenlijke wijzigingen op de hoogte via een aankondiging in de app of een e-mailmelding. Wij raden u aan deze pagina regelmatig te raadplegen.

---

## 10. Contactgegevens & Vragen over Gegevensbescherming

Als u vragen, zorgen, feedback of verzoeken hebt met betrekking tot dit Privacybeleid of uw persoonsgegevens, kunt u contact opnemen met ons Gegevensbeschermingsteam:

- **Organisatie:** DressApp Ltd.
- **Primair Privacycontact:** [dev@dressapp.co](mailto:dev@dressapp.co)
- **Contact Gebruikersservice:** [lokoprod@gmail.com](mailto:lokoprod@gmail.com)
- **Postadres:** DressApp Ltd., 11 Hanoter St, 8442711 Be'er-Sheva, Israël
- **Officiële Website:** [https://dressapp.co](https://dressapp.co)
- **Speciale Privacy-URL:** [https://dressapp.co/privacy](https://dressapp.co/privacy)

Wij zetten ons in om alle privacyvragen spoedig en uiterlijk binnen dertig (30) dagen na ontvangst te behandelen en op te lossen.