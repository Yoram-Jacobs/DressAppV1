# Styliste IA Conversationnel

Échangez avec un styliste personnel intelligent qui connaît votre garde-robe, la météo et votre emploi du temps.

## Aperçu
Le Styliste IA traite les requêtes de style vocales ou textuelles en langage naturel, en intégrant automatiquement les conditions météorologiques, les événements du calendrier et les notifications push alimentées par des stores personnalisés `useSyncExternalStore` sécurisés (`stylistStore` et `dailySuggestionsStore`) avec une mise en cache de 15 minutes et une dédoublonnement des requêtes en cours.

## Prérequis
- Une clé API Gemini (or des crédits système par défaut).
- Événements de calendrier connectés.

## Étape par étape
1. **Démarrer la session** : Ouvrez l'onglet Stylist et sélectionnez Chat, Shuffle ou Match.
2. **Saisie vocale** : Appuyez sur le microphone, énoncez votre requête (ex. « Suggère une tenue pour un jour de pluie »), puis appuyez pour envoyer.
3. **Lecture audio** : Écoutez la justification de style générée via le lecteur vocal haute fidélité.
4. **Mélanger (Shuffle)** : Cliquez sur le bouton Sparkles pour faire tourner la machine à sous ; l'IA aligne automatiquement les articles correspondants au centre.
5. **Navigation sans attente** : La navigation entre Stylist et les autres onglets utilise les préférences mises en cache en mémoire sans déclencher de boucles de requêtes GET vers la base de données.

## Résultats attendus
Compositions de tenues personnalisées conçues selon vos préférences personnelles, les contraintes saisonnières et votre emploi du temps.

## Dépannage
- **Lecture audio trop lente** : Basculez entre Gemini TTS et la solution de secours Web Speech API dans les paramètres du Profile.
- **Suggestions répétées** : Assurez-vous que l'historique de votre calendrier de tenues est mis à jour afin que l'algorithme de rotation puisse bloquer les répétitions.

## Limitations
- Les recommandations nécessitent au moins un haut, un bas et une paire de chaussures dans le dressing pour compléter un look.
- La transcription vocale peut revenir à la saisie de texte standard sur les appareils non pris en charge.