# Styliste conversationnel par IA

Échangez avec un styliste personnel intelligent qui connaît votre garde-robe, la météo locale et votre planning.

## Vue d'ensemble
Le Styliste IA est votre conseiller mode dans DressApp. Vous pouvez dialoguer par texte ou par la voix de manière naturelle. Il consulte vos prévisions météorologiques, prend en compte vos événements Google Calendar et conçoit des tenues harmonieuses créées à partir de vos propres vêtements.

Le moteur de stylisme de DressApp s'appuie sur le modèle d'IA local **Gemma-4-E4B**, disponible immédiatement pour tous les comptes gratuits sans clé d'API. Pour les utilisateurs utilisant leur propre clé Google Gemini, DressApp intègre un **Relais automatique en cas de quota dépassé (Quota Fallback)** : si votre clé personnelle atteint sa limite de requêtes, le système bascule automatiquement et de façon fluide vers le modèle interne Gemma avec une notification d'information, sans jamais interrompre votre conversation.

## Prérequis
- Au moins un haut, un bas et une paire de chaussures enregistrés dans votre garde-robe.
- Autorisation du microphone activée pour le guidage vocal mains libres.
- *(Facultatif)* Connexion à Google Calendar pour des tenues adaptées à vos réunions et sorties.
- *(Facultatif)* Clé d'API Google Gemini personnelle pour exploiter vos propres quotas cloud.

## Instructions étape par étape
1. **Ouvrir le Styliste**: Appuyez sur l'onglet **AI Stylist** dans la barre de navigation.
2. **Parlez ou écrivez**: Touchez l'**icône microphone** et posez votre question (ex. : *« Que devrais-je porter pour un déjeuner professionnel sous la pluie ? »* ou *« Propose-moi un look chic décontracté »*).
3. **Écoutez les conseils vocaux**: Le styliste vous répond oralement et affiche les tenues suggérées. Appuyez sur **Écouter la réponse** pour réentendre le conseil.
4. **Fonction Shuffle**: Envie de nouveauté ? Utilisez l'onglet **Shuffle** pour mélanger les pièces de votre dressing et imaginer des looks inédits !
5. **Enregistrer dans le journal**: Appuyez sur **Enregistrer dans le journal** pour planifier la tenue sur votre calendrier vestimentaire.

## Résultats attendus
Des propositions de tenues pertinentes et adaptées au climat, assorties d'explications audio détaillées. Si votre clé d'API est indisponible, une bannière vous avertit que le moteur local a pris le relais sans aucune erreur.

## Dépannage
- **Le micro ne capte pas votre voix**: Vérifiez les autorisations de votre navigateur ou appareil pour autoriser l'accès au micro.
- **Le styliste propose souvent les mêmes tenues**: Marquez vos tenues portées dans le calendrier pour l'aider à privilégier vos vêtements inutilisés.
- **Bannière « Styliste de la plateforme utilisé (Quota Fallback) »**: S'affiche lorsque votre clé Gemini a épuisé son quota. La réponse a été traitée sans accroc par l'IA interne.

## Limites
- Le styliste compose uniquement des looks à partir des pièces déjà présentes dans votre garde-robe.
- Les utilisateurs de la formule gratuite bénéficient de 10 crédits de stylisme offerts par jour, renouvelés toutes les 24 heures.
