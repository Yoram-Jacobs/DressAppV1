# Conversational AI Stylist

Ga in gesprek met een intelligente persoonlijke stylist die uw garderobe, het weer en uw dagelijkse planning kent.

## Overzicht
De AI Stylist is uw persoonlijke modeadviseur. U kunt ermee chatten door te typen of hardop te praten, net zoals met een vriend. De Stylist controleert de lokale weersvoorspelling, bekijkt uw afspraken in Google Agenda en stelt complete, stijlvolle outfits voor die rechtstreeks zijn samengesteld uit kleding die u al bezit.

Het stylingbrein van DressApp wordt aangedreven door een veerkrachtige multi-tier intelligentie-architectuur:
- **Primaire Productie-engine (Google Gemini 3.5 Flash-Lite)**: Drijft direct alle centrale stylinggesprekken aan via `llm_gateway.py`. Het levert razendsnelle reacties (minder dan 350 ms TTFT) zonder initiële configuratie en zonder gedoe – geen persoonlijke API-sleutels nodig om met stylen te beginnen!
- **On-Premises VPS Eyes (`gemma-4-E4B`) – Free Tier & Quotumvangnet**: Een speciaal, verfijnd `gemma-4-E4B`-model dat lokaal draait in de `dressapp-eyes`-container op poort 7860 van de Hetzner CPX32 VPS. Het biedt een basis zonder variabele kosten voor Free Tier-accounts en fungeert als transparante fallback. Als er limieten voor de Google Gemini API (`429` / `RESOURCE_EXHAUSTED`) worden bereikt, worden zoekopdrachten automatisch omgeleid naar lokale Gemma zonder te mislukken of 500-fouten te veroorzaken.
- **Aangepaste BYOK-cloudmodellen**: Gebruikers kunnen desgewenst hun eigen Google Gemini API-sleutel invoeren in de profielinstellingen om toegang te krijgen tot geavanceerdere modellen (`gemini-2.5-pro`) of geavanceerde generatieve tools te ontgrendelen (Nano Banana fotoreconstructie).

## Vereisten
- Minstens één bovenstuk, één onderstuk en één paar schoenen geüpload naar uw kledingkast.
- Microfoontoestemming ingeschakeld als u handsfree gesproken styling wilt gebruiken.
- *(Optioneel)* Gekoppelde Google Agenda om outfitsuggesties af te stemmen op specifieke gelegenheden.
- *(Optioneel)* Persoonlijke Google Gemini API-sleutel als u uw eigen cloud-ontwikkelaarsquotum wilt gebruiken.

## Stapsgewijze instructies
1. **De stylist openen**: Tik op het tabblad **AI Stylist** in de navigatiebalk onderaan.
2. **Praten of typen**: Tik op het **microfoonicoon** en vraag wat u moet dragen (bijv. *„Wat zal ik dragen voor een lunch op een regenachtige middag?“* of *„Stel een chique zakelijke look voor“*).
3. **Luister naar het gesproken advies**: De Stylist antwoordt met advies op maat en toont bijpassende outfitkaarten. Tik op **Play reply** om het gesproken advies op elk moment opnieuw te horen.
4. **Probeer de Shuffle-tool**: Zin in spontane inspiratie? Tik op het tabblad **Shuffle** om uw kledingkast te laten draaien en frisse combinaties te ontdekken waar u zelf misschien niet aan had gedacht!
5. **Verfijnen met vervolgvragen**: Vraag de stylist in een doorlopend gesprek om andere schoenen te kiezen, een jasje te ruilen of rekening te houden met temperatuurschommelingen.
6. **Favorieten opslaan**: Tik op **Save to Diary** om de look in te plannen in uw persoonlijke garderobekalender.

## Verwachte resultaten
Gepersonaliseerde, weerbestendige outfitsuggesties op uw scherm, compleet met gesproken toelichting waarom de kledingstukken bij elkaar passen. Als externe API-quota tijdelijk zijn uitgeput, geeft een informatiebanner aan dat de ingebouwde on-premises Stylist uw verzoek naadloos heeft afgehandeld.

## Probleemoplossing
- **Microfoon pikt geen woorden op**: Controleer uw browser- of apparaattoestemmingen om er zeker van te zijn dat DressApp toegang heeft tot uw microfoon.`
- **Stylist stelt te vaak dezelfde outfits voor**: Leg uw dagelijkse outfits vast in de kalender, zodat de Stylist weet wat u onlangs heeft gedragen en voorrang geeft aan ongedragen kleding.
- **Banner „Using Platform Stylist (Quota Fallback)“**: Dit verschijnt wanneer de snelheidslimieten van de externe API worden bereikt. De app heeft uw vraag soepel beantwoord met behulp van de ingebouwde on-prem Gemma-engine van DressApp, zonder onderbreking van uw gesprek.

## Beperkingen
- De Stylist werkt uitsluitend met kledingstukken in uw kledingkast; er kunnen geen stukken worden aanbevolen die u nog niet heeft geüpload.
- Free Tier-gebruikers ontvangen gratis stylingcredits die automatisch worden vernieuwd, terwijl Pro- en Tester-accounts profiteren van ruimere maandelijkse quota.
