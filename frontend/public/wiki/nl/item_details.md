# Itemdetails Architectuur en gebruikershandleiding

Dit document biedt een uitgebreid technisch overzicht en een operationele handleiding voor de **Item Details** pagina (`ItemDetail.jsx`) binnen DressApp. Het behandelt de structuur van de gebruikerservaring, API-communicatiestromen, AI-verwerkingshulpprogramma's, validatieschema's en internationaliseringsdetails.

---

## 1. Samenvatting en waardevoorstel

### Overzicht op hoog niveau
Het paneel **Itemdetails** is de centrale hub voor het beheren van individuele kledingstukken in de digitale garderobe van een gebruiker. Het functioneert als een contextbewuste editor die ruwe visuele media (foto's) overbrugt met semantische metadata (categorie, stofsamenstelling, kleurgewichten, merk, formaliteitsniveau en notities). Het stelt gebruikers in staat om geautomatiseerde AI-opname-uitvoer te verfijnen, achtergrondverwijdering (matting) te activeren, heranalyses van visiemodellen uit te voeren en marktplaatsvermeldingsopties te configureren.

### Architecturale stroom

```Zeemeermin
grafiek TD
    Gebruiker([Gebruiker]) -->|Navigeert door /items/:id| Pagina[ItemDetail.jsx]
    Pagina -->|1. haalItem| API[Backend REST API]
    API -->|Leest| DB[(MongoDB)]
    
    Pagina -->|2. Bevolkingsstaat| FormulierState[formState / naarFormulierState]
    FormState -->|Renders| Kaarten [Editorkaarten en zwevende actiebalk]
    
    %% AI-acties
    Kaarten -->|Achtergrond opschonen| Matten[Matting AI /onCleanBackground]
    Matten -->|Niet-generatieve matten| MattingAPI[Matting-eindpunt]
    
    Kaarten -->|Foto opnieuw analyseren| VisionEngine[De ogen /onReanalyze]
    VisionEngine -->|Metagegevens extraheren| VisionAPI[Visieanalyse-eindpunt]
    
    %% Gegevensmanipulatie en -besparing
    Kaarten -->|Ingangen aanpassen| EmptyValidation{Is leeg?}
    Lege validatie -->|Ja| RedFrame[Red Outline Highlight-rand-rood-400]
    LegeValidatie -->|Nee| NormalFrame[Normaal invoeroverzicht]
    
    Kaarten -->|Wijzigingen opslaan| Poortwachter{Taxonomie Poortwachterwaarschuwing}
    Poortwachter -->|Bevestigen| SaveAPI[updateItem API /onSave]
    Poortwachter -->|Annuleren| BewerkenDoorgaan[Bewerken hervatten]
    SaveAPI -->|Succes| Toast[Sonner Succes Toast]
```

### Waardepropositie voor gebruikers
* **Precisiegarderobeverfijning**: eenvoudige, gestructureerde kaarten groeperen attributen logisch, waardoor invoermoeheid wordt voorkomen.
* **Niet-generatieve AI-uitsparingen**: Schone achtergrondmatten isoleren het kledingstuk zonder hallucinerende/verzonnen details toe te voegen.
* **Automatische categorisatie en heranalyse**: corrigeert luidruchtige opnameresultaten met één klik met behulp van de vision-engine "The Eyes".
* **Optimistische prestaties**: automatisch opslaan op de achtergrond en visuele bevestigingen verkorten de wachttijden.
* **Universele lokalisatie**: Naadloze RTL-richtingspiegeling en volledig vertaalde labels/hints mogelijk gemaakt door `i18next`.

---

## 2. Uitgebreide gebruikershandleiding

### Visuele interfacetopologie
De pagina Artikeldetails maakt gebruik van een asymmetrische lay-out met twee kolommen, afgestemd op desktop- en mobiele viewports:

```
+------------------------------------------------------------------+
|  <- (Terug) (Ongedaan maken) (Opslaan) (Omhoog) |
+--------------------------------+---------------------------------+
| LINKERKOLOM (Visuele en AI-acties) | RECHTERKOLOM (Metagegevenseditor) |
|                                    |                                     |
| +-------------------------------+ | +-------------------------------+ |
| |        KLEDINGFOTO | | | IDENTITEITSKAART | |
| |  [Vervang foto] [Camerasleuf] | | | - Titel (vereist) | |
| +-------------------------------+ | | - Beschrijvende naam | |
|                                    | | - Merk / bijschrift | |
| +-------------------------------+ | +-------------------------------+ |
| | SCHONE ACHTERGRONDKAART | |                                     |
| | - Matting AI-triggerknop | | +-------------------------------+ |
| | - Voortgangsbalk (trouwe snit) | | | TAXONOMIEKAART | |
| +-------------------------------+ | | - Categorie / Subcategorie | |
|                                    | | - Artikeltype / Geslacht | |
| +-------------------------------+ | | - Dresscode | |
| | HER-ANALYSE FOTOKAART | | | - Seizoen Multi-Select | |
| | - Triggerknop voor het bijvullen van Vision | | | - Traditie (met dictaat) | |
| +-------------------------------+ | +-------------------------------+ |
|                                    |                                     |
| +-------------------------------+ | +-------------------------------+ |
| | DPP HERKOMSTPANEEL | | | SAMENSTELLING KAART | |
| | - Digitale productpaspoortgegevens| | | - Maat / Hoofdkleur / Patroon | |
| +-------------------------------+ | | - Gewogen kleurenlijst | |
|                                    | | - Lijst met verzwaarde stoffen | |
|                                    | +-------------------------------+ |
|                                    |                                     |
|                                    | +-------------------------------+ |
|                                    | | KWALITEIT & SLIJTAGEKAART | |
|                                    | | - Staat / Conditie / Niveau | |
|                                    | | - Reparatieadvies Opmerkingen | |
|                                    | +-------------------------------+ |
|                                    |                                     |
|                                    | +-------------------------------+ |
|                                    | | PRIJZEN & INTENTIEKAART | |
|                                    | | - Prijs / Valuta / Intentie | |
|                                    | +-------------------------------+ |
|                                    |                                     |
|                                    | +-------------------------------+ |
|                                    | | ORGANISATIEKAART | |
|                                    | | - Formaliteit / Tags / Notities | |
|                                    | +-------------------------------+ |
+--------------------------------+---------------------------------+
| [Lijst te koop] ​​[Verwijderen] |
+------------------------------------------------------------------+
```

### Modus- en workflow-walkthroughs

#### 1. Fotovervanging en camera-opname
* Gebruikers kunnen de kledingfoto vervangen met behulp van de `memberPhotoInputRef`-sleuf. 
* Als u op **Foto vervangen** klikt, wordt de oorspronkelijke bestandskiezer geopend. Als u op **Maak foto** klikt, krijgt u rechtstreeks toegang tot de camera's van mobiele apparaten via `capture="user"`.

#### 2. Schone achtergrond
* Niet-generatieve matten lopen op de achtergrond. Een voortgangsbalk wordt in realtime bijgewerkt.
* Als er eerder een matsessie is uitgevoerd, verandert de tekst van de actieknop in **Opnieuw opschonen** (volledig gelokaliseerd), zodat gebruikers de achtergrondscheiding opnieuw kunnen proberen.

#### 3. Analyseer de foto opnieuw
* Roept de vision-engine "The Eyes" op de backend aan om de afbeelding van het kledingstuk te evalueren.
* Vult automatisch classificatievelden aan (categorie, subcategorie, kleuren, materialen) met behoud van door de gebruiker gedefinieerde velden (grootte, prijs, opmerkingen).

#### 4. Taxonomie- en compositie-editor
* Met gewogen lijsten kunnen gebruikers percentages opgeven voor kleurenpaletten (bijvoorbeeld zwart 100%) en materialen (bijvoorbeeld polyester 80%, rayon 20%).
* Formulierinvoer geeft dynamisch een rode rand weer (`border-red-400 dark:border-red-900`) als ze leeg worden gelaten, wat duidelijke feedback geeft over ontbrekende attributen.

#### 5. Spraak-naar-tekst-dictaat
* Velden zoals **Traditie** ondersteunen spraakdictatie. Als u op het microfoonpictogram klikt, wordt de Web Speech API-browserlistener geactiveerd. De microfoon wordt rood, neemt audio op, vertaalt deze naar tekst en schrijft deze rechtstreeks naar het invoerveld.

---

## 3. Modalen en dialogen

### 1. Dialoogvenster Kastitemkiezer (`addOpen`)
* **Doel**: Hiermee kunnen gebruikers andere kledingstukken aan dit item koppelen (bijvoorbeeld bijpassende pakken, binnenvoeringen of sets).
* **Structuur**: een schuifbare lijst met andere kastitems met selectievakjes.
* **Lay-out**: wordt weergegeven in een glasmorfe container (`glassmorphic border-white/20`) die is geconfigureerd om te schalen op mobiele schermen (`max-h-[90dvh]`).

### 2. Taxonomie Gatekeeper-waarschuwingsdialoogvenster (`gatekeeperOpen`)
* **Doel**: Voorkomt onbedoelde verkeerde classificaties van de lay-out. Wordt geactiveerd als de gebruiker de hoofdcategorie van het kledingstuk wijzigt (bijvoorbeeld van boven naar beneden) of het itemtype wijzigt in iets dat niet overeenkomt met de bovenliggende categorie.
* **Gebruikersopties**:
  * **Bevestigen**: gaat door met de categoriewijziging en past de metadatavelden aan.
  * **Annuleren**: breekt de wijziging af en herstelt de oorspronkelijke categoriestatus.

### 3. Dialoogvenster Bevestigingswaarschuwing verwijderen (`AlertDialog`)
* **Doel**: Voorkomt dat kledingstukken per ongeluk worden verwijderd.
* **Acties**:
  * **Annuleren**: Dialoogvenster sluiten.
  * **Verwijderen**: verwijdert het item met behulp van een optimistische UI-update, waardoor de gebruiker onmiddellijk terug naar de kast wordt genavigeerd terwijl het verwijderverzoek op de achtergrond wordt verwerkt.

---

## 4. Technologiestapel en mogelijkheden Deep-Dive

### Gegevens- en statuspijplijnen
* **Formuliersynchronisatie**: afgehandeld via lokale React-status (`formulier`-object). Wijzigingen activeren `setField(key, value)`.
* **Automatisch opslagmechanisme**: niet-opgeslagen velden worden gecontroleerd. Wanneer u weg navigeert, worden wijzigingen automatisch doorgevoerd in de backend om gegevensverlies te voorkomen.
* **i18next lokalisatie en RTL-integratie**:
  * Tekstuitlijning, richting en opvulling worden dynamisch omgedraaid op basis van de globale richtingsconfiguratie (`i18n.dir()`).
  * Zwevende actie-elementen spiegelen coördinaten (bijvoorbeeld door logische CSS-waarden te gebruiken of zwevende offsets te standaardiseren) om gecentreerd te blijven en uit de buurt van navigatietabbladen te blijven in zowel de Hebreeuws/Arabische (RTL) als Engelse (LTR) modi.