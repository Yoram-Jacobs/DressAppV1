# Profil, Tailles & Configuration

Ajustez précisément vos mensurations, vos contraintes de pudeur et vos identifiants IA.

## Aperçu
La section Profil maintient votre contexte de style à jour, en gérant les métriques corporelles physiques, la sélection de la palette de teintes de peau, le détourage de photos en pied, les règles de style, les clés API IA personnalisées, les notifications de campagnes et les paramètres régionaux locaux.

## Prérequis
- Compte utilisateur DressApp actif.

## Étape par étape
1. **Saisir les métriques et le taillage ANSUR II** : Entrez les paramètres physiques de base (Taille, Poids, Tour de taille, Longueur du pied). Le modèle de régression ANSUR II calcule automatiquement vos 6 dimensions structurales (Épaules, Poitrine, Hanches, Longueur des bras, Entrejambe, Longueur extérieure).
2. **Teinte de peau & Détourage photo** : Sélectionnez votre teinte de peau dans la palette de couleurs ou téléchargez une photo en pied. Le système effectue automatiquement un détourage d'arrière-plan U2-Net pour afficher des aperçus d'essayage sur corps réel. Cliquez sur *Supprimer la photo* pour revenir instantanément au mannequin vectoriel 2D SVG.
3. **Spécifier les règles** : Sélectionnez les éléments à éviter (ex. « éviter le jaune ») et les niveaux de pudeur.
4. **Configuration IA** : Saisissez vos clés personnalisées Google AI Studio ou sélectionnez le mode fournisseur standard.
5. **Notifications de campagnes** : Déroulez l'accordéon *Notifications de campagnes* pour activer les notifications par e-mail ou push pour les promotions locales, ventes et nouveaux stylistes dans votre zone, et personnalisez la fréquence (Instantannée, Quotidienne, Hebdomadaire) et la distance maximale (5 km, 10 km, 25 km, 50 km).
6. **Gérer le compte** : Consultez votre niveau d'abonnement (Pro vs limite Free de 150 articles) ou demandez la suppression du compte.

## Résultats attendus
- Avatar 2D personnalisé et dispositions de tenues conformes à votre morphologie exacte, teinte de peau et préférences de style vestimentaire.
- Notifications envoyées sur vos canaux sélectionnés lorsque des campagnes actives correspondent à vos règles de style et se situent dans le rayon de distance choisi.

## Dépannage
- **Clé API non valide** : Vérifiez que vous avez correctement copié la clé depuis Google AI Studio sans espaces supplémentaires.
- **Arrière-plan photo non propre** : Assurez-vous que votre photo en pied bénéficie d'un éclairage clair sur un fond contrasté.
- **Le calendrier ne se synchronise pas** : Dissociez et réauthentifiez votre compte Google pour rafraîchir les jetons.
- **Campagnes non reçues** : Assurez-vous que vos *Services de localisation* sont activés et que votre paramètre de distance maximale couvre l'emplacement de l'entreprise locale.

## Limitations
- Les règles personnalisées sont appliquées strictement ; si vos règles sont trop strictes, le styliste risque de ne trouver aucune tenue correspondante.
- Les alertes push de campagne nécessitent les autorisations de notification du navigateur. Si elles sont bloquées, vous ne recevrez que les notifications par e-mail.