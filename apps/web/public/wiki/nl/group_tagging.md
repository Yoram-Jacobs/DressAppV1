# Groepslabeling van kastitems

## Doel
Het doel van de functie voor het taggen van groepen is om snelle, bulkcategorisering van kledingstukken in de kast mogelijk te maken. De gebruiker kan meerdere items in zijn kast selecteren en ze allemaal in één keer taggen met een enkele klik.

## Doel
- **Snelheid en efficiëntie**: in plaats van tags per item in te voeren, kunnen gebruikers verschillende kledingstukken selecteren (bijvoorbeeld alle formele jassen of alle sportkleding) en de tags onmiddellijk toepassen.
- **Verbeterde nauwkeurigheid van de AI-stylist**: fijnmazige categorieën/tags (bijvoorbeeld 'Werk', 'GYM', 'Zwemkleding', 'Uniformen') begeleiden het redeneringsproces van de stylist. Met vooraf gedefinieerde tags kan de stylist de meest relevante items voor specifieke outfitverzoeken vinden (bijvoorbeeld door eerst items met de 'werk'-tag te kiezen bij het samenstellen van een 'werkoutfit').
- **Slimme terugval**: als bepaalde getagde lagen ontbreken (bijvoorbeeld als er geen items met de 'werk'-tag voor het bovenlichaam zijn), zal de stylist dynamisch andere geschikte kledingstukken matchen.

## Belangrijkste punten en implementatiedetails
1. **Gebruikersinterface-integratie**:
   - Een **Tag**-knop toegevoegd in de Closet-selectiefloater.
   - Een door komma's gescheiden tagging-dialoogvenster gebouwd (`AlertDialog`) dat verschijnt wanneer erop wordt geklikt.
2. **Optimistische UI-update**:
   - Tags worden eerst lokaal samengevoegd met de geselecteerde kastitems, zodat de wijzigingen onmiddellijk in de gebruikersinterface worden weergegeven.
3. **Achtergrondsynchronisatie**:
   - Stuurt de tagupdateverzoeken (`api.patchItem`) op de achtergrond naar de database om gegevensconsistentie te garanderen zonder gebruikersinteracties te blokkeren.
4. **i18next lokalisatie**:
   - Alle tekstberichten, dialoogtitels, tijdelijke aanduidingen en feedbackmeldingen ondersteunen vertalingen netjes met behulp van op opties gebaseerde standaardinstellingen.