# Planification matinale & alertes push

Commencez votre journée avec des recommandations de style automatiques et adaptées à la météo, livrées directement sur votre appareil.

## Aperçu
Le planificateur matinal automatise la sélection de vos tenues en vous proposant chaque matin des suggestions de style personnalisées. Il consulte les prévisions météo locales et vos activités quotidiennes (via Google Calendar) pour générer trois options assorties. Appuyez sur la notification pour visualiser les options sur votre avatar personnel, enregistrer votre choix préféré et consulter instantanément les scores de compatibilité météo.

## Prérequis
- **Notifications autorisées** : Les notifications push doivent être activées pour DressApp dans les paramètres de votre appareil ou de votre navigateur.
- **Articles de garde-robe** : Vous devez avoir téléchargé au moins un haut, un bas et une paire de chaussures dans votre garde-robe.
- **Google Calendar** : Un compte Google Calendar associé (facultatif, mais recommandé pour adapter les suggestions à vos événements).
- **Clé Gemini** : Une clé d'API Gemini personnalisée configurée dans vos paramètres.

## Instructions étape par étape
1. **Activer les alertes** : Allez dans **Paramètres du profil** -> **Planificateur & Push**. Activez le commutateur de notification.
2. **Définir l'heure** : Configurez l'heure et la minute exactes auxquelles vous souhaitez recevoir votre suggestion (par exemple, 07h30).
3. **Associer l'agenda** : Sous Paramètres de l'agenda, connectez votre compte Google Calendar pour que l'IA connaisse votre emploi du temps.
4. **Ouvrir la suggestion** : Lorsque l'alerte push du matin arrive, cliquez dessus. Vous serez redirigé directement vers l'onglet **Suggestion quotidienne** (Match) sous **Styliste**.
5. **Afficher les options** : Le sélecteur **Planifier la tenue** s'ouvrira automatiquement, affichant vos trois combinaisons stylisées directement sur votre avatar.
6. **Enregistrer et examiner** : Appuyez sur l'une des suggestions quotidiennes pour la planifier dans votre agenda. L'application enregistrera la tenue et ouvrira immédiatement un panneau de détails affichant ses indicateurs de compatibilité météo (harmonie des couleurs, adéquation à la température et cohérence du style).

## Résultats attendus
Une notification est livrée quotidiennement à l'heure choisie. Cliquer dessus ouvre l'application, affiche trois options sur votre avatar et vous permet d'en enregistrer une dans votre agenda avec tous les détails de compatibilité.

## Dépannage
- **Aucune notification n'arrive** : 
  - Assurez-vous que les notifications sont autorisées pour le site Web DressApp dans les paramètres de site de votre navigateur ou les paramètres de votre système d'exploitation.
  - Vérifiez que votre appareil n'est pas en mode "Ne pas déranger" ou "Concentration" pendant l'heure de notification planifiée.
- **Vêtements manquants sur l'avatar** : 
  - Assurez-vous d'avoir des vêtements dans toutes les catégories de base (hauts, bas, chaussures) dans votre garde-robe pour que le planificateur puisse habiller correctement l'avatar.
- **Recommandations génériques** : 
  - Associez votre Google Calendar pour que les suggestions correspondent à vos événements quotidiens spécifiques.

## Limites
- Vous pouvez planifier jusqu'à une tenue par jour dans votre agenda.
- Les mises à jour météo nécessitent une connexion Internet active sur le serveur.
