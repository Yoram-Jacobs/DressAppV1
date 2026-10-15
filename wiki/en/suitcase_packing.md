# Suitcase Packing Assistant

Pack efficiently, safely, and respectfully for any global destination with AI-driven weather forecasting, geopolitical & religious dress code guardrails, and conversational checklist refinement.

## Overview
The Suitcase Packing Assistant eliminates travel prep anxiety by analyzing your travel itinerary, destination weather, calendar events, and personal wardrobe catalog to build a customized, day-by-day packing checklist. Powered by **Google Gemini 3.5 Flash-Lite** and **DressApp Eyes (`Qwen2.5-VL-3B-Instruct`)** via `llm_gateway.py` and backed by `travel_safety_knowledge.md`, the assistant generates complete packing plans in seconds, warns you of destination dress code laws or danger zones, and lets you interactively refine items through conversational chat.

## Prerequisites
- Destination city or country name and departure/return travel dates.
- An active closet inventory with staple garments.
- Internet connectivity to fetch destination weather forecasts.

## Geopolitical, Statutory & Geo-Religious Dress Code Guardrails
DressApp cross-references your destination and scheduled activities against a curated global safety database (`travel_safety_knowledge.md`) spanning seven restriction domains:

1. **State-Mandated Religious Modesty & Public Decency Regimes**:
   - **Iran & Afghanistan**: Enforces mandatory headscarves and loose knee-length tunics (*manteau* / *abaya*) over ankle-length bottoms for women (plus full-length *chador* inside Iranian holy shrines), and strictly blocks shorts and sleeveless tops for men.
   - **Saudi Arabia, Qatar, Kuwait, Oman, Bahrain, UAE (Sharjah/Dubai/Abu Dhabi), Brunei, Aceh (Indonesia) & Malaysia (Kelantan/Terengganu)**: Enforces shoulder-to-knee public modesty, bans tight/sheer clothing in malls and souqs, enforces cross-dressing bans where statutory, and provides *Ihram* rules for Mecca and Medina.
   - **Maldives (Inhabited Local Islands)**: Alerts travelers that bikinis and shirtless swimwear are strictly illegal on inhabited local islands (e.g., Maafushi, Thoddoo) outside designated fenced "Bikini Beaches."
2. **Statutory Civilian Camouflage & Military Apparel Bans**:
   - Hard-blocks camouflage-patterned clothing, hats, shoes, and backpacks in **Caribbean nations** (Barbados, Jamaica, Trinidad & Tobago, Saint Lucia, Saint Vincent, Antigua & Barbuda, Grenada, Dominica, Saint Kitts & Nevis, Bahamas, Guyana), **African nations** (Nigeria, Uganda—including red berets, Zimbabwe, Zambia, Ghana, Kenya, South Africa, Rwanda), and **the Philippines, Oman, and Saudi Arabia**, where civilian camo is a criminal offense.
3. **Authoritarian, Socialist & State-Identity Sartorial Laws**:
   - Covers **North Korea (DPRK)** (bans on blue/ripped/skinny jeans and leather trench coats; mandatory formal suits/dresses at Kumsusan Palace and Mansudae), **Turkmenistan** (Ashgabat bans on men's shorts and tight dresses), **Bhutan** (*Driglam Namzha* long-sleeved collared shirt and ankle-length bottom rules with no hats/umbrellas inside Dzongs), **China** (Xinjiang face-veil bans and PRC bans on Imperial Japanese uniforms), **Chechnya** (Grozny ban on men's shorts), and statutory symbol bans in **Russia, Uganda, and Nigeria**.
4. **Secular Face-Covering (Burqa/Niqab) & Public Laïcité Bans**:
   - Alerts travelers to statutory public face-covering bans in **France, Switzerland, Austria, Belgium, Denmark, Bulgaria, the Netherlands** (public transport, schools, hospitals, government buildings), and **Quebec, Canada** (public services under Bill 21), as well as French municipal pool rules (banning burkinis and loose men's boardshorts).
5. **Royal Lèse-Majesté, National Flag & Political/Totalitarian Symbol Bans**:
   - Protects travelers in **Thailand** (*Lèse-Majesté* Art. 112, ban on Thai flag prints on shoes/lower body, ban on Buddha prints/lower-body tattoos), **Germany & Austria** (*StGB § 86a* unconstitutional symbols), **Ukraine, Baltic States, Poland, Georgia & Moldova** (bans on Soviet hammer-and-sickle, St. George ribbon, and Russian 'Z'/'V' military symbols), **Indonesia** (strict anti-communism hammer-and-sickle ban), and **Hong Kong** (National Security Law seditious slogan bans).
6. **Gang, Cartel, Paramilitary & Territorial Faction Danger Zones**:
   - Warns travelers against lethal faction identifiers in **Brazilian favelas** (Adidas three stripes associated with TCP/BDM *Tudo 3* vs. solid red/Nike associated with CV *Tudo 2*, Mickey Mouse shirts, Joker/clown tattoos, and mandatory motorcycle helmet removal), **El Salvador, Honduras & Guatemala** (numbers `13`, `18`, `XIII`, `XVIII`, Nike Cortez shoes, and gothic tattoos under the *Régimen de Excepción*), **Colombia** (rural camo and rubber jungle boots), **Mexico** (cartel acronym caps `JGL`, `701`, `MZ`, `Chapiza`, `CJNG`, and tactical chest bags *pecheras*), **Jamaica** (Kingston JLP green vs. PNP orange garrison zones), and **Northern Ireland / Glasgow** (sectarian football jerseys in interface zones).
7. **Strict Sacred Precincts & Religious Institutions Worldwide**:
   - Enforces exact entry protocols for **Vatican City & Italian Duomos** (covered shoulders and knees; no white at Papal Audiences), **Mount Athos** (statutory *Avaton* male-only entry; long sleeves and trousers), **Eastern Orthodox Monasteries** (Meteora, Russia, Georgia, Serbia—ankle-length skirts and headscarves for women; no trousers for women), **Ethiopian Orthodox Churches** (barefoot + white *Netela* shawl), **Jerusalem** (Western Wall *Kippah* and modesty; Temple Mount / Al-Aqsa loose ankle/wrist coverage and ban on non-Muslim prayer items; Mea Shearim *Tzniut*), **Grand Mosques & Shia Shrines** (Abu Dhabi Sheikh Zayed, Muscat, Casablanca, Istanbul, Mashhad/Qom *Chador*, Karbala/Najaf black *Iraqi Abaya*), **Hindu & Jain Temples** (strict *Ahimsa* zero-leather rule for belts/wallets/bags; Kerala *Mundu* bare-chested rule for men; Bali *Kamben* sarong & *Selendang* sash), **Buddhist Pagodas** (Bangkok Grand Palace no-sarong-over-shorts rule; Myanmar Shwedagon zero-shoes/zero-socks rule; Kandy white attire), **Sikh Gurdwaras** (mandatory *Rumāl*/*Dastar* head covering, barefoot foot-washing, zero tobacco/alcohol in pockets), and **Japanese Onsen** (strict tattoo ban requiring cover stickers).

## Step-by-Step Instructions
1. **Create a Trip**: Open the Suitcase tab, tap **New Trip**, and enter your destination city/country, start and end dates, and trip purpose (e.g., *Business*, *Beach Holiday*, *Cultural & Temple Tour*).
2. **Generate Packing Plan**: Tap **Generate Checklist**. The AI retrieves forecasted temperatures, calendar events, and destination safety/religious rules, cross-references your closet items, and constructs a balanced packing list.
3. **Review Cultural & Safety Alerts**: Read the **Cultural Etiquette** and **Danger Zone / Legal Warnings** banners to ensure your packed outfits comply with local laws and sacred site dress codes.
4. **Review Daily Outfits**: Inspect day-by-day suggested combinations ensuring appropriate layers for cool mornings, warm afternoons, and scheduled activities.
5. **Refine via Conversational Chat**: Chat directly with the packing assistant (e.g., *"Add a modest linen maxi skirt for temple visits"* or *"Replace camo shorts with beige chinos"*). The checklist updates dynamically.
6. **Mark Items as Packed & Save for Offline Travel**: Use the interactive checkboxes as you load your luggage and save the completed trip plan for offline access in transit.

## Expected Results
A comprehensive, weather-optimized, and legally/culturally compliant luggage packing checklist organized by clothing categories (tops, bottoms, outerwear, footwear, essentials) with zero prohibited or unnecessary pieces.

## Troubleshooting
- **Weather forecast unavailable**: Verify destination city spelling; for remote locations, specify the nearest major city.
- **Missing modest or weather-specific garments**: Check the **Missing Items** section for specific shopping suggestions and local destination stores where you can acquire required attire (e.g., a headscarf, *sarong*, or formal trousers).
- **Adjustments not saving**: Confirm your network connection is active when saving custom chat updates.

## Limitations
- Automated weather forecasting covers trips planned up to 14 days in advance; trips further in the future utilize historical seasonal climate averages.
