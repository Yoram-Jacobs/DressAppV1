# Styliste IA conversationnel

Échangez avec un styliste personnel intelligent qui connaît votre garde-robe, la météo et votre emploi du temps quotidien.

## Vue d'ensemble
L'AI Stylist est votre compagnon de mode personnel. Vous pouvez discuter avec lui en écrivant ou en parlant à voix haute, tout comme avec un ami. Le styliste consulte vos prévisions locales, jette un œil à vos événements Google Calendar et vous suggère des tenues complètes et élégantes composées directement à partir des vêtements que vous possédez déjà.

Le cerveau de stylisme de DressApp repose sur une architecture d'intelligence multiniveau résiliente :
- **Moteur de production principal (Google Gemini 3.5 Flash-Lite)** : Propulse nativement toutes les conversations de stylisme principales via `llm_gateway.py`. Il fournit des réponses ultra-rapides (TTFT inférieur à 350 ms) sans configuration initiale ni friction — aucune clé API personnelle n'est requise pour commencer à créer des looks !
- **VPS Eyes sur site (`gemma-4-E4B`) — Offre gratuite et filet de sécurité pour les quotas** : Un modèle dédié et affiné `gemma-4-E4B` fonctionnant localement dans le conteneur `dressapp-eyes` sur le port 7860 du VPS Hetzner CPX32. Il offre une base à coût variable nul pour les comptes Free Tier et sert de solution de secours transparente. Si les limites d'API Google Gemini (`429` / `RESOURCE_EXHAUSTED`) sont atteintes, les requêtes basculent automatiquement vers Gemma sur site sans échec ni erreur 500.
- **Programme du groupe de testeurs** : Les testeurs approuvés bénéficient d'un accès gratuit au forfait **Professional**, avec capacité de garde-robe illimitée, flux radar Trend Scout, planification quotidienne de style et 100 crédits/cycle.
- **Modèles Cloud personnalisés (BYOK)** : Les utilisateurs peuvent facultativement renseigner leur propre clé API Google Gemini dans les paramètres du profil pour accéder à des modèles supérieurs (`gemini-2.5-pro`) ou débloquer des outils génératifs avancés (reconstruction photo Nano Banana).

## Prérequis
- Au moins un haut, un bas et une paire de chaussures ajoutés à votre dressing.
- Autorisation du microphone accordée si vous souhaitez utiliser le stylisme vocal mains libres.
- *(Optionnel)* Compte Google Calendar connecté pour adapter les suggestions de tenues aux occasions prévues.
- *(Optionnel)* Clé API Google Gemini personnelle si vous souhaitez utiliser votre propre quota de développeur cloud.

## Instructions étape par étape
1. **Ouvrir le styliste** : Appuyez sur l'onglet **AI Stylist** dans la barre de navigation inférieure.
2. **Parler ou écrire** : Appuyez sur l'**icône de microphone** et demandez ce que vous devriez porter (par exemple, *"Que devrais-je porter pour un déjeuner par un après-midi pluvieux ?"* ou *"Suggère-moi un look professionnel élégant"*).
3. **Écouter les conseils oraux** : Le styliste vous répond avec des conseils sur mesure et affiche des cartes de tenues coordonnées. Appuyez sur **Écouter la réponse** pour réécouter les conseils audio à tout moment.
4. **Essayer l'outil Shuffle** : Envie d'inspiration spontanée ? Appuyez sur l'onglet **Shuffle** pour faire tourner les pièces de votre dressing et découvrir des associations inédites auxquelles vous n'auriez peut-être pas pensé !
5. **Affiner avec des relances** : Demandez au styliste de changer de chaussures, de remplacer une veste ou d'adapter la tenue aux variations de température au fil d'une conversation naturelle.
6. **Enregistrer vos favoris** : Appuyez sur **Enregistrer dans le journal** pour planifier ce look sur le calendrier de votre garde-robe.

## Résultats attendus
Des suggestions de tenues personnalisées et adaptées à la météo affichées sur votre écran, accompagnées d'explications vocales justifiant l'harmonie des pièces. Si les quotas d'API externes sont temporairement atteints, une bannière d'information indique que le styliste sur site intégré a pris le relais en toute transparence.

## Dépannage
- **Le microphone ne capte pas votre voix** : Vérifiez les autorisations de votre navigateur ou de votre appareil pour vous assurer que DressApp est autorisé à accéder au microphone.
- **Le styliste propose trop souvent les mêmes tenues** : Consignez vos tenues quotidiennes dans le calendrier afin que le styliste sache ce que vous avez porté récemment et privilégie les pièces non portées.
- **Bannière "Utilisation du styliste de la plateforme (Secours quota)"** : Elle s'affiche lorsque les limites de requêtes de l'API externe sont dépassées. L'application a répondu à votre demande grâce au moteur local Gemma de DressApp sans aucune coupure dans votre échange.

## Limites
- Le styliste fonctionne exclusivement avec les vêtements de votre dressing ; il ne peut recommander des pièces non encore importées.
- Les utilisateurs du forfait Free Tier reçoivent des crédits de stylisme offerts qui se renouvellent automatiquement, tandis que les comptes Pro et testeurs bénéficient de quotas mensuels supérieurs.
