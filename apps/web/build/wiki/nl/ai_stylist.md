# Interactieve AI-Stylist

Ga het gesprek aan met een intelligente persoonlijke stylist die uw kledingkast, het weer en uw agenda kent.

## Overzicht
De AI-Stylist verwerkt natuurlijke taal spraak- of tekststylingvragen en integreert automatisch weersomstandigheden, kalendergebeurtenissen en pushmeldingen via thread-safe `useSyncExternalStore` custom stores (`stylistStore` en `dailySuggestionsStore`) met 15 minuten caching en in-flight verzoekontdubbeling.

## Vereisten
- Een Gemini API-sleutel (of standaard systeemtegoeden).
- Gekoppelde kalendergebeurtenissen.

## Stap-voor-stap
1. **Start sessie**: Open het tabblad Stylist en selecteer Chat, Shuffle of Match.
2. **Spraakinvoer**: Tik op de microfoon, spreek uw vraag in (bijv. "Stel een outfit voor voor een regenachtige dag") en tik om te verzenden.
3. **Audio-afspelen**: Luister naar de gegenereerde stylingonderbouwing via de high-fidelity spraakspeler.
4. **Shuffle**: Klik op de knop Sparkles om de fruitautomaat te laten draaien; de AI lijnt automatisch overeenkomende items in focus uit.
5. **Zero-Idle-navigatie**: Navigeren tussen Stylist en andere tabbladen gebruikt in-memory gecachte voorkeuren zonder database GET-verzoeklussen te activeren.

## Verwachte resultaten
Aangepaste outfit-layouts gestyled rond uw persoonlijke voorkeuren, seizoensgebonden beperkingen en agenda.

## Probleemoplossing
- **Audio speelt te langzaam af**: Schakel tussen Gemini TTS en de Web Speech API fallback in Profile-instellingen.
- **Herhaalde suggesties**: Zorg ervoor dat uw outfitkalendergeschiedenis is bijgewerkt zodat het rotatie-algoritme herhaald dragen kan blokkeren.

## Beperkingen
- Aanbevelingen vereisen minstens één bovenstuk, één onderstuk en één paar schoenen in de kledingkast om een look te voltooien.
- Spraaktranscriptie kan terugvallen op standaard tekstinvoer op niet-ondersteunde edge-apparaten.