# Conversationele AI-Stylist

Communiceer met een intelligente persoonlijke stylist die uw garderobe, het weer en uw dagelijkse planning kent.

## Overzicht
De AI-Stylist (AI Stylist) is uw persoonlijke modepartner. U kunt ermee chatten door te typen of hardop te spreken, net als met een vriend. De Stylist controleert uw lokale weersverwachting, bekijkt uw afspraken in Google Agenda en stelt complete, stijlvolle outfits voor die direct worden samengesteld uit kleding die u al in uw kast hebt hangen.

Het stylingbrein van DressApp wordt aangedreven door een veerkrachtige, gelaagde Zero-BYOK-intelligentiearchitectuur:
- **Manager- & Professional-abonnementen — Snel Cloudmodel (Google Gemini 3.5 Flash)**: Abonnees met een **Manager**- of **Professional**-abonnement profiteren van prioriteitsroutering naar het snelle Cloud AI-model (momenteel **Google Gemini 3.5 Flash** via `llm_gateway.py`), wat zorgt voor razendsnelle antwoorden (minder dan 350 ms TTFT) zonder dat er enige configuratie nodig is.
- **Gratis Abonnement (Free Tier) — On-Premises Eyes (`Qwen 2.5 VL 3B`) & Quotum-vangnet**: Gebruikers van het gratis abonnement worden ondersteund door het speciale, gefinetunede **Qwen 2.5 VL 3B**-model van DressApp dat lokaal draait in de `dressapp-eyes`-container op poort 7860 van de Hetzner CPX32 VPS. Het dient tevens als transparant vangnet voor betaalde abonnementen: als er snelheidslimieten van de cloud-API (`429` / `RESOURCE_EXHAUSTED`) worden bereikt, worden vragen automatisch omgeleid naar de on-premises Eyes-engine zonder dat dit mislukt of 500-foutmeldingen veroorzaakt.

## Vereisten
- Ten minste één bovenstuk, één onderstuk en één paar schoenen geüpload naar uw digitale kledingkast.
- Microfoonmachtiging ingeschakeld als u handsfree spraakstyling wilt gebruiken.
- *(Optioneel)* Gekoppelde Google Agenda om outfitsuggesties af te stemmen op uw gelegenheden.

## Stapsgewijze Instructies
1. **Open de Stylist**: Tik op het tabblad **AI Stylist** in de onderste navigatiebalk.
2. **Spreek of Typ**: Tik op het **Microfoonpictogram** en vraag wat u kunt aantrekken (bijv. *"Wat zal ik aantrekken voor een regenachtige lunch vanmiddag?"* of *"Stel een chique zakelijke look voor"*).
3. **Luister naar Gesproken Advies**: De Stylist geeft gesproken advies op maat en toont bijpassende outfitkaarten. Tik op **Antwoord afspelen (Play reply)** om het audio-advies op elk gewenst moment opnieuw te beluisteren.
4. **Probeer de Shuffle-tool**: Zin in directe inspiratie? Tik op het tabblad **Shuffle** om uw kledingkast door elkaar te schudden en frisse combinaties te ontdekken waar u zelf misschien nog niet aan had gedacht!
5. **Verfijn met Vervolgvragen**: Vraag de stylist in een doorlopend gesprek om van schoenen te wisselen, een andere jas te kiezen of de outfit aan te passen aan temperatuurveranderingen.
6. **Sla Uw Favorieten Op**: Tik op **Opslaan in Dagboek (Save to Diary)** om de look in te plannen in uw persoonlijke garderobe-agenda.

## Verwachte Resultaten
Gepersonaliseerde, weersbestendige outfitsuggesties op uw scherm, compleet met gesproken toelichtingen waarom de kledingstukken goed bij elkaar passen. Als externe cloud-API-quota tijdelijk zijn uitgeput, geeft een informatieve banner aan dat de ingebouwde on-premises Eyes-Stylist uw verzoek naadloos heeft afgehandeld.

## Probleemoplossing
- **Microfoon vangt geen woorden op**: Controleer de machtigingen van uw browser of apparaat om er zeker van te zijn dat DressApp toegang heeft tot uw microfoon.
- **Stylist stelt te vaak dezelfde outfits voor**: Registreer uw dagelijkse outfits in de agenda, zodat de Stylist weet wat u onlangs hebt gedragen en voorrang geeft aan ongedragen kleding.
- **Banner "Using Platform Stylist (Quota Fallback)"**: Deze melding verschijnt wanneer externe cloud-API-limieten worden bereikt. De app heeft uw vraag soepel beantwoord met behulp van de ingebouwde on-premises Eyes-engine (`Qwen 2.5 VL 3B`) van DressApp, zonder uw gesprek te onderbreken.

## Beperkingen
- De Stylist werkt uitsluitend met items in uw eigen kledingkast; hij kan geen kledingstukken aanbevelen die u nog niet hebt geüpload.
- Gebruikers van het gratis abonnement (Free Tier) gebruiken het on-premises Eyes-model met gratis stylingcredits die automatisch worden vernieuwd, terwijl Manager- en Professional-accounts profiteren van het snelle Cloudmodel (`Gemini 3.5 Flash`) en hogere maandelijkse quota.
