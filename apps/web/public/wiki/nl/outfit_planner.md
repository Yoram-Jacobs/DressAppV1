# Outfitplanner & Canvas

Stel gecoördineerde layouts samen, laag ze en bekijk ze.

## Overzicht
De Outfitplanner biedt een visueel 2D-avatarcanvas (dat zowel uitsneden van echte lichaamsfoto's van gebruikers als dynamische vector SVG-mannequins ondersteunt) met gecalibreerde landmark-offsets (`top-[14.5%]` kraag-tot-halslijn en `top-[36.5%]` tailleband-tot-taillelijn) om bovenstukken, onderstukken, outerwear en schoenen naadloos op de lichaamsgrenzen te lagen.

## Vereisten
- Opgeslagen kledingkastartikelen.

## Stap-voor-stap
1. **Selecteer canvas**: Open de Planner en klik op een dag of een nieuw concept.
2. **Artikelen lagen**: Sleep kledingstukken naar de 2D-avatar. Outerwear wordt automatisch over binnenhemden gestapeld.
3. **Pasvorm beoordelen**: Controleer compatibiliteitsscores en waarschuwingen (bijv. kleurconflicten of weerwaarschuwingen).
4. **Opslaan**: Stel een titel in en plan de look in uw kledingkastdagboek. Updates worden thread-safe gestreamd via `useOutfitStore`.

## Verwachte resultaten
Prachtig gelaagde outfitcomposities opgeslagen in uw kalender en zichtbaar als rasterkaart-voorbeelden zonder achtergrondnetwerkverzoek-pollinglussen.

## Probleemoplossing
- **Laagvolgorde onjuist**: Controleer de categorie van het artikel opnieuw; outerwear moet worden gecategoriseerd als "Outerwear" om correct te stapelen.
- **Overlapwaarschuwingen**: Als de avatar waarschuwt voor herhaald dragen, controleer dan of u recentelijk dezelfde outfit op dezelfde locatie hebt gedragen.

## Beperkingen
- Lagen worden automatisch beheerd op basis van categorietags; handmatige z-index-overschrijvingen worden niet ondersteund.