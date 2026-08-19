---
titel: DressApp Digital Product Passport (DPP) ecosysteem
beschrijving: Masterclass-documentatie voor de pijplijn voor scannen, parseren en renderen van het EU Digital Product Passport in DressApp.
---

# DressApp Digitaal Productpaspoort (DPP) Integratie

## 1. Samenvatting en waardevoorstel

### Overzicht op hoog niveau
Het DressApp Digital Product Passport (DPP)-ecosysteem is een robuuste, end-to-end pijplijn die is ontworpen om de herkomst van digitale producten naadloos te verwerken, te parseren en weer te geven. De architectuur is ontworpen als onderdeel van de Phase V6-implementatie en omvat een veerkrachtige, op React gebaseerde frontend-scanner (`DppScanner.jsx`), een zeer veilige Python-backend-parser (`dpp_parser.py`) en een elegant, fouttolerant weergavepaneel (`DppPanel.jsx`). Het is gebouwd om moderne DPP-pilotimplementaties te interpreteren (voornamelijk JSON-LD 'Product'-schema's ingebed in HTML) en om directe JSON-payloads te interpreteren, waardoor maximale compatibiliteit met opkomende duurzaamheidsstandaarden wordt gegarandeerd.

### Architecturale stroom

```Zeemeermin
volgordediagram
    deelnemer Gebruiker
    deelnemer DppScanner (Frontend)
    deelnemer AddItemForm (Frontend)
    deelnemer DppParser (Backend)
    deelnemer ExternalDPP als externe DPP-host

Gebruiker->>DppScanner: Opent scanner (camera / afbeelding)
    DppScanner->>Gebruiker: vraagt cameratoestemming
    Gebruiker->>DppScanner: scant QR / uploadt afbeelding
    DppScanner->>AddItemForm: onDecoded(qr_payload)
    AddItemForm->>DppParser: POST /import-dpp (payload)
    
    alt Payload is URL
        DppParser->>DppParser: DNS/SSRF-controle (privé-IP's blokkeren)
        DppParser->>ExterneDPP: HTTP GET (time-out 15s)
        ExterneDPP-->>DppParser: HTML met JSON-LD
    anders is de payload inline JSON
        DppParser->>DppParser: Directe parsering
    einde
    
    DppParser->>DppParser: velden extraheren en normaliseren
    DppParser-->>AddItemForm: genormaliseerde itemgegevens en woordelijke DPP
    AddItemForm->>DppPanel: Geeft geëxtraheerde gegevens weer
    DppPanel-->>Gebruiker: Visuele duurzaamheidsbadges en info
```

### Waardepropositie voor gebruikers
- **Frictionless Onboarding**: gebruikers kunnen items direct aan hun digitale kast toevoegen door een QR-code te scannen, waardoor handmatige gegevensinvoer voor materialen, onderhoudsinstructies en merkdetails wordt omzeild.
- **Duurzaamheidstransparantie**: Directe toegang tot duurzaamheidsstatistieken volgens de EU-standaard, waaronder de CO2-voetafdruk, het land van herkomst en eco-certificeringen, waardoor een bewuste consumptie mogelijk wordt gemaakt.
- **Graceful Degradation**: Gebouwd om nooit abrupt te falen. Als een QR-code onleesbaar is of er een time-out optreedt bij de externe server, gaat het systeem standaard over op de standaard handmatige invoer zonder dat de app crasht.
- **Toegankelijkheid en lokalisatie**: volledige RTL- en meertalige ondersteuning uit de doos, waardoor de scanner en displaypanelen inclusief zijn voor een wereldwijd gebruikersbestand.

---

## 2. Uitgebreide gebruikershandleiding

### Visuele interfacetopologie

De DPP-integratie komt voor in twee primaire interfacecomponenten:

1. **De scannermodale ("DppScanner")**
   - **Header**: iconografie en duidelijke titels die de gebruiker instrueren.
   - **Modusschakelaar (tabbladen)**:
     - `Camera`: Live-zoeker met behulp van de naar achteren gerichte camera van het apparaat.
     - `Bestand`: een doel voor slepen en neerzetten/tikken om te uploaden voor het scannen van opgeslagen afbeeldingen.
   - **Voettekst**: een niet-opdringerige annuleringsactie.

2. **Het inlichtingenpaneel ("DppPanel")**
   - **Koptekst**: een gestileerd QrCode-pictogram dat "Geverifieerde DPP-gegevens" aangeeft.
   - **Sleutel/Waarderaster**: lay-out met twee kolommen voor atomaire gegevens (GTIN, Oorsprong, Carbon Footprint).
   - **Badgeclusters**: visuele rondlopende badges voor materialen (met percentages) en certificeringen.
   - **Instructielijsten**: gidsen met opsommingstekens voor onderhoud en reparatie.
   - **Bronlink**: Deep-link naar het originele paspoort van de fabrikant.

### Modus- en workflow-walkthroughs

- **Cameramodus (standaard)**: bij activering geeft de scanner prioriteit aan de omgevingscamera (achterzijde). Het bemonstert continu frames met 10 FPS. Zodra een QR-code wordt gedetecteerd, wordt de camera automatisch uitgeschakeld om de batterij te sparen en wordt de lading verzonden voor parsering.
- **Bestandsuploadmodus**: als de gebruiker geen camerarechten heeft of een screenshot scant, kan hij overschakelen naar het tabblad Bestand. Als u op de dropzone tikt, wordt de systeemeigen bestandskiezer van het besturingssysteem geopend. De afbeelding wordt lokaal verwerkt met behulp van `html5-qrcode` zonder te worden geüpload naar de server, waardoor privacy en snelheid worden gegarandeerd.

### Foutafhandeling en feedback
- **Camerarechten**: als toegang wordt geweigerd, verschijnt er een duidelijke, gelokaliseerde `X`-foutstatus, met een elegante knop om over te schakelen naar de modus voor het uploaden van bestanden.
- **Lege of ongeldige QR**: de scanner activeert een tijdelijke foutmelding (via `sonner`) om de gebruiker te informeren dat er geen geldige code in de afbeelding is gevonden.
- **Parser-fouten**: als de backend een verkeerd ingedeelde payload of een netwerkfout tegenkomt, retourneert deze een "lege" analyse in plaats van een HTTP 500. De frontend negeert stilletjes de ontbrekende gegevens, waardoor de gebruiker door kan gaan met handmatige invoer.

---

## 3. Technologiestapel en mogelijkheden Deep-Dive

### Kernorkestratie en AI/logica
De backend `dpp_parser.py` is de intelligentiehub van de functie. Het werkt volgens een "best-effort, defensieve parsing" -filosofie:
- **Heuristische JSON-LD Discovery**: gebruikt `BeautifulSoup` om HTML-antwoorden voor `<script type="application/ld+json">`-tags te schrapen, waarbij recursief de grafiek wordt doorlopen om knooppunten te identificeren die typen als `Product`, `GarmentProduct` of `DigitalProductPassport`.
- **Fuzzy Alias ​​Resolution**: wijst tientallen Schema.org-aliassen toe aan interne sleutels. 'Materialen' zijn bijvoorbeeld samengesteld uit 'compositie', 'fiberContent' of 'textileComposition'.
- **Regex-aangedreven normalisatie**: parseert complexe stringdefinities zoals `"80% katoen, 20% elastaan"` in gestructureerde JSON-arrays: `[{"name": "cotton", "pct": 80}, ...]`.

### Gegevens- en contextpijplijnen
- **SSRF-bescherming (server-side request forgery)**: voordat er HTTP-verzoeken worden gedaan aan URL's gevonden in QR-codes, lost de parser de hostnaam op en blokkeert expliciet loopback-, link-local- en private netwerk-IP's met behulp van Python's `ipadres`-module.
- **Bronnenbeperkingen**: netwerkverzoeken zijn strikt beperkt:
  - Absolute time-out van 15 seconden.
  - Maximaal laadvermogen van 2 MB voor HTML-documenten.
  - 6 MB plafond voor het importeren van gekoppelde productafbeeldingen.
- **Behoud van letterlijke gegevens**: tijdens het normaliseren van gegevens voor het DressApp-schema, wordt de onbewerkte DPP-grafiek volledig bewaard in een `dpp_data.raw` MongoDB-subdocument voor toekomstbestendigheid en auditing.

### Frontend- en clientarchitectuur
- **Hardwareabstractie**: `DppScanner.jsx` omhult `html5-qrcode`. Het beheert actief de levenscyclus van de camera binnen `useEffect`, waardoor hardwarevergrendelingen onmiddellijk worden vrijgegeven na ontkoppeling of succesvolle scans om geheugenlekken en leeglopen van de batterij te voorkomen.
- **Defensieve weergave**: `DppPanel.jsx` maakt gebruik van agressieve nulcontrole. Het evalueert of de binnenkomende `dppData` zinvolle sleutels bevat. Als de parser een fout retourneert (`parse_error`), of als alle velden null zijn, retourneert de component `null` en neemt deze nul DOM-ruimte in beslag.
- **Ontwerpsysteemintegratie**: maakt gebruik van Tailwind CSS met aangepaste CSS-variabelen (bijv. `hsl(var(--accent))`) om compatibiliteit in de donkere modus en een zeer hoogwaardige "glassmorphism"-esthetiek te behouden zonder hardcoding hex-waarden. Micro-interacties omvatten hoverstatussen op certificeringsbadges en soepele tabbladovergangen.