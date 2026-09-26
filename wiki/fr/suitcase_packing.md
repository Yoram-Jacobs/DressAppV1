# Assistant de préparation de valise

Préparez vos bagages efficacement et sans stress pour n'importe quelle destination grâce aux prévisions météo basées sur l'IA et à l'ajustement conversationnel de votre liste.

## Vue d'ensemble
L'Assistant de préparation de valise élimine l'anxiété des préparatifs de voyage en analysant votre itinéraire, la météo de destination et le catalogue de votre garde-robe personnelle pour concevoir une liste de bagages personnalisée jour par jour. Propulsé par **Google Gemini 3.5 Flash-Lite** via `llm_gateway.py`, l'assistant génère des plans de valise complets en quelques secondes et vous permet d'ajuster interactivement chaque élément par échange conversationnel.

## Prérequis
- Nom de la ville de destination et dates de départ et de retour.
- Un inventaire de garde-robe actif contenant au moins quelques vêtements de base.
- Une connexion Internet pour récupérer les prévisions météorologiques de la destination.

## Instructions étape par étape
1. **Créer un voyage** : Ouvrez l'onglet Valise, appuyez sur **Nouveau voyage**, puis indiquez la ville de destination, les dates de début et de fin, ainsi que l'objectif du voyage (par exemple, *Affaires*, *Vacances à la plage*, *Visite citadine décontractée*).
2. **Générer le plan de valise** : Appuyez sur **Générer la liste**. L'IA extrait les températures et conditions prévues à destination, effectue un recoupement avec les pièces de votre dressing et établit une liste équilibrée.
3. **Vérifier les tenues quotidiennes** : Examinez les combinaisons suggérées au jour le jour en vous assurant d'avoir des couches adaptées aux matinées fraîches et aux après-midis plus doux.
4. **Ajuster via le chat conversationnel** : Besoin d'options supplémentaires ? Échangez directement avec l'assistant (par exemple, *"Ajouter des baskets confortables pour marcher"* ou *"Inclure une robe de soirée pour le dîner"*). La liste s'actualise dynamiquement.
5. **Cocher les articles emballés** : Cochez les cases interactives au fur et à mesure que vous remplissez votre valise pour savoir ce qui est déjà prêt.
6. **Enregistrer pour le voyage hors ligne** : Sauvegardez le plan finalisé afin d'y accéder rapidement et de manière optimiste sur votre appareil, même sans connexion Internet pendant vos déplacements.

## Résultats attendus
Une liste de préparation de bagages complète et optimisée selon la météo, organisée par catégories de vêtements (hauts, bas, manteaux/vestes, chaussures, essentiels), sans aucun vêtement en double ou superflu.

## Dépannage
- **Prévisions météo indisponibles** : Vérifiez l'orthographe de la ville de destination ; pour les endroits isolés, essayez de renseigner la grande ville la plus proche.
- **La liste contient peu d'articles** : Assurez-vous d'avoir téléversé dans votre garde-robe suffisamment de pièces adaptées à la saison et aux températures attendues.
- **Les modifications ne s'enregistrent pas** : Vérifiez que votre connexion réseau est active lorsque vous saisissez des notes via le chat.

## Limites
- Les prévisions météorologiques automatisées couvrent les séjours prévus jusqu'à 14 jours à l'avance ; au-delà, le système s'appuie sur les moyennes climatiques saisonnières historiques.