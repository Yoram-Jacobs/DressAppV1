# Koffer-inpakassistent

Pak efficiënt, veilig en respectvol in voor elke wereldwijde bestemming met AI-gestuurde weersvoorspellingen, geopolitieke en religieuze kledingvoorschriften en interactieve verfijning van uw checklist.

## Overzicht
De Koffer-inpakassistent neemt alle reisstress weg door uw reisschema, de weersverwachting op uw bestemming, agenda-afspraken en uw persoonlijke kledingcatalogus te analyseren om een op maat gemaakte, dag-tot-dag paklijst samen te stellen. Aangedreven door **Google Gemini 3.5 Flash-Lite** en **DressApp Eyes (`Qwen2.5-VL-3B-Instruct`)** via `llm_gateway.py` en ondersteund door `travel_safety_knowledge.md`, genereert de assistent binnen enkele seconden complete inpakplannen, waarschuwt hij u voor lokale kledingwetten of gevarenzones op de bestemming, en kunt u items interactief via een chatgesprek verfijnen.

## Vereisten
- Naam van de bestemmingsstad of het bestemmingsland en vertrek- en terugkeerdata.
- Een actieve kledingkastinventaris met basiskledingstukken.
- Een internetverbinding om weersvoorspellingen voor de bestemming op te halen.

## Geopolitieke, wettelijke en geo-religieuze richtlijnen voor kledingvoorschriften
DressApp vergelijkt uw bestemming en geplande activiteiten met een samengestelde wereldwijde veiligheidsdatabase (`travel_safety_knowledge.md`) die zeven beperkingsdomeinen omvat:

1. **Door de staat opgelegde religieuze bescheidenheids- en openbare fatsoensregimes**:
   - **Iran en Afghanistan**: Handhaaft verplichte hoofddoeken en losvallende tunieken tot op de knie (*manteau* / *abaya*) over enkelbedekkende onderkleding voor vrouwen (plus een lange *chador* in Iraanse heilige schrijnen), en blokkeert strikt korte broeken en mouwloze tops voor mannen.
   - **Saoedi-Arabië, Qatar, Koeweit, Oman, Bahrein, VAE (Sharjah/Dubai/Abu Dhabi), Brunei, Atjeh (Indonesië) en Maleisië (Kelantan/Terengganu)**: Handhaaft openbare bescheidenheid van schouder tot knie, verbiedt strakke of doorschijnende kleding in winkelcentra en soeks, handhaaft wettelijke verboden op crossdressing waar van toepassing, en biedt *Ihram*-regels voor Mekka en Medina.
   - **Malediven (Bewoonde lokale eilanden)**: Waarschuwt reizigers dat bikini's en zwemkleding zonder shirt strikt illegaal zijn op bewoonde lokale eilanden (bijv. Maafushi, Thoddoo) buiten de aangewezen omheinde "Bikini Beaches".
2. **Wettelijke verboden op civiele camouflage- en militaire kleding**:
   - Blokkeert strikt kleding, petten/hoeden, schoenen en rugzakken met camouflagepatroon in **Caribische landen** (Barbados, Jamaica, Trinidad en Tobago, Saint Lucia, Saint Vincent, Antigua en Barbuda, Grenada, Dominica, Saint Kitts en Nevis, Bahama's, Guyana), **Afrikaanse landen** (Nigeria, Oeganda — inclusief rode baretten, Zimbabwe, Zambia, Ghana, Kenia, Zuid-Afrika, Rwanda) en **de Filipijnen, Oman en Saoedi-Arabië**, waar het dragen van camouflage door burgers een strafbaar feit is.
3. **Autoritaire, socialistische en staatsidentiteitswetten voor kleding**:
   - Omvat **Noord-Korea (DVK)** (verbod op blauwe/gescheurde/skinny spijkerbroeken en leren trenchcoats; verplichte formele pakken/jurken bij het Kumsusan-paleis en Mansudae), **Turkmenistan** (verbod in Asjchabad op korte broeken voor mannen en strakke jurken), **Bhutan** (*Driglam Namzha*-regels voor overhemden met lange mouwen en kraag en enkelbedekkende onderkleding, zonder hoeden of paraplu's in Dzongs), **China** (verbod op gezichtssluiers in Xinjiang en VRC-verbod op keizerlijke Japanse uniformen), **Tsjetsjenië** (verbod in Grozny op korte broeken voor mannen) en wettelijke symboolverboden in **Rusland, Oeganda en Nigeria**.
4. **Seculiere verboden op gezichtsbedekking (Boerka/Niqab) en openbare laïcité**:
   - Waarschuwt reizigers voor wettelijke verboden op gezichtsbedekking in het openbaar in **Frankrijk, Zwitserland, Oostenrijk, België, Denemarken, Bulgarije, Nederland** (openbaar vervoer, scholen, ziekenhuizen, overheidsgebouwen) en **Quebec, Canada** (openbare diensten onder Wet 21), evenals regels in Franse gemeentelijke zwembaden (verbod op boerkini's en losse zwemshorts voor mannen).
5. **Verboden wegens majesteitsschennis, nationale vlaggen en politieke/totalitaire symbolen**:
   - Beschermt reizigers in **Thailand** (*Lèse-Majesté* Art. 112, verbod op prints van de Thaise vlag op schoenen/het onderlichaam, verbod op Boeddha-prints en tatoeages op het onderlichaam), **Duitsland en Oostenrijk** (*StGB § 86a* ongrondwettelijke symbolen), **Oekraïne, de Baltische staten, Polen, Georgië en Moldavië** (verbod op de Sovjet-hamer en sikkel, het Sint-Jorislint en Russische militaire 'Z'/'V'-symbolen), **Indonesië** (strikt anticommunistisch verbod op hamer en sikkel) en **Hongkong** (verbod op opruiende leuzen onder de Nationale Veiligheidswet).
6. **Gevarenzones van bendes, kartels, paramilitairen en territoriale facties**:
   - Waarschuwt reizigers voor levensgevaarlijke factie-identificaties in **Braziliaanse favela's** (drie strepen van Adidas geassocieerd met TCP/BDM *Tudo 3* versus effen rood/Nike geassocieerd met CV *Tudo 2*, Mickey Mouse-shirts, Joker-/clowntatoeages en verplichte verwijdering van motorhelmen), **El Salvador, Honduras en Guatemala** (getallen `13`, `18`, `XIII`, `XVIII`, Nike Cortez-schoenen en gotische tatoeages onder het *Régimen de Excepción*), **Colombia** (camouflage op het platteland en rubberen junglelaarzen), **Mexico** (petten met kartelacroniemen `JGL`, `701`, `MZ`, `Chapiza`, `CJNG` en tactische borsttassen *pecheras*), **Jamaica** (garnizoenszones in Kingston: JLP-groen versus PNP-oranje) en **Noord-Ierland / Glasgow** (sektarische voetbalshirts in grenszones).
7. **Strikte heilige plaatsen en religieuze instellingen wereldwijd**:
   - Handhaaft exacte toegangsprotocollen voor **Vaticaanstad en Italiaanse Duomo's** (bedekte schouders en knieën; geen wit tijdens pauselijke audiënties), **de berg Athos** (wettelijk *Avaton* met toegang uitsluitend voor mannen; lange mouwen en lange broeken), **Oosters-orthodoxe kloosters** (Meteora, Rusland, Georgië, Servië — enkellange rokken en hoofddoeken voor vrouwen; geen broeken voor vrouwen), **Ethiopisch-orthodoxe kerken** (blote voeten + witte *Netela*-omslagdoek), **Jeruzalem** (*Kippah* en bescheiden kleding bij de Klaagmuur; losvallende bedekking tot op de enkels en polsen en verbod op niet-islamitische gebedsartikelen op de Tempelberg / Al-Aqsa; *Tzniut* in Mea Shearim), **Grote Moskeeën en sjiitische heiligdommen** (Sjeik Zayed in Abu Dhabi, Muscat, Casablanca, Istanbul, *Chador* in Mashhad/Qom, zwarte *Irakese Abaya* in Karbala/Najaf), **Hindoeïstische en jaïnistische tempels** (strikte *Ahimsa*-regel zonder leer voor riemen/portemonnees/tassen; *Mundu*-regel met ontbloot bovenlichaam voor mannen in Kerala; *Kamben*-sarong en *Selendang*-sjerp op Bali), **Boeddhistische pagodes** (verbod op sarong over een korte broek in het Koninklijk Paleis in Bangkok; verbod op schoenen én sokken bij de Shwedagon-pagode in Myanmar; witte kleding in Kandy), **Sikh Gurdwara's** (verplichte *Rumāl*/*Dastar*-hoofdbedekking, blote voeten en voeten wassen, geen tabak of alcohol in zakken) en **Japanse Onsen** (strikt tatoeageverbod waarvoor afdekpleisters vereist zijn).

## Stapsgewijze instructies
1. **Reis aanmaken**: Open het tabblad Suitcase, tik op **New Trip** en voer uw bestemmingsstad/-land, begin- en einddatum en het reisdoel in (bijv. *Business*, *Beach Holiday*, *Cultural & Temple Tour*).
2. **Inpakplan genereren**: Tik op **Generate Checklist**. De AI haalt voorspelde temperaturen, agenda-afspraken en veiligheids- en religieuze regels voor de bestemming op, vergelijkt deze met uw kledingkast en stelt een gebalanceerde paklijst samen.
3. **Culturele en veiligheidswaarschuwingen bekijken**: Lees de banners **Cultural Etiquette** en **Danger Zone / Legal Warnings** om er zeker van te zijn dat uw ingepakte outfits voldoen aan de lokale wetgeving en kledingvoorschriften voor heilige plaatsen.
4. **Dagelijkse outfits bekijken**: Bekijk de voorgestelde dagelijkse combinaties en zorg voor geschikte laagjes voor frisse ochtenden, warme middagen en geplande activiteiten.
5. **Verfijnen via chat**: Chat rechtstreeks met de inpakassistent (bijv. *„Voeg een bescheiden linnen maxirok toe voor tempelbezoeken“* of *„Vervang de camouflageshort door een beige chino“*). De checklist wordt dynamisch bijgewerkt.
6. **Items als ingepakt markeren en opslaan voor offlinereizen**: Gebruik de interactieve selectievakjes terwijl u uw koffer inpakt en sla het voltooide reisplan op voor offlinetoegang onderweg.

## Verwachte resultaten
Een uitgebreide, op het weer afgestemde en wettelijk/cultureel verantwoorde inpakchecklist voor uw bagage, geordend per kledingcategorie (bovenkleding, onderkleding, jassen, schoenen, essentials) zonder verboden of onnodige kledingstukken.

## Probleemoplossing
- **Weersvoorspelling niet beschikbaar**: Controleer de spelling van de bestemmingsstad; geef voor afgelegen locaties de dichtstbijzijnde grote stad op.
- **Ontbrekende bescheiden of weerspecifieke kledingstukken**: Bekijk het gedeelte **Missing Items** voor specifieke winkelsuggesties en lokale winkels op uw bestemming waar u de vereiste kleding kunt aanschaffen (bijv. een hoofddoek, *sarong* of nette pantalon).
- **Aanpassingen worden niet opgeslagen**: Controleer of uw netwerkverbinding actief is wanneer u aangepaste chatwijzigingen opslaat.

## Beperkingen
- Geautomatiseerde weersvoorspellingen zijn beschikbaar voor reizen die tot 14 dagen van tevoren zijn gepland; voor reizen verder in de toekomst worden historische seizoensgemiddelden gebruikt.