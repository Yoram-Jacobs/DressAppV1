# Styliste IA Conversationnel

Échangez avec un styliste personnel intelligent qui connaît votre garde-robe, la météo et votre emploi du temps quotidien.

## Vue d'ensemble
L'AI Stylist est votre compagnon de mode personnel. Vous pouvez discuter avec lui en écrivant ou en parlant à voix haute, tout comme avec un ami. Le styliste consulte vos prévisions météo locales, examine vos événements Google Calendar et vous suggère des tenues complètes et élégantes composées directement à partir des vêtements que vous possédez déjà.

Le cerveau de stylisme de DressApp repose sur une architecture d'intelligence multiniveau résiliente sans clé API externe (Zero-BYOK) :
- **Forfaits Manager et Professional — Modèle Cloud rapide (Google Gemini 3.5 Flash)** : Les abonnés aux forfaits **Manager** et **Professional** bénéficient d'un routage prioritaire vers le modèle d'IA Cloud rapide (actuellement **Google Gemini 3.5 Flash** via `llm_gateway.py`), offrant des réponses ultra-rapides (TTFT inférieur à 350 ms) sans aucune configuration requise.
- **Forfait Gratuit (Free Tier) — Moteur sur site Eyes (`Qwen 2.5 VL 3B`) et filet de sécurité pour les quotas** : Les utilisateurs du forfait gratuit bénéficient du modèle dédié et affiné **Qwen 2.5 VL 3B** de DressApp, exécuté localement dans le conteneur `dressapp-eyes` sur le port 7860 du VPS Hetzner CPX32. Il sert également de solution de secours transparente pour les forfaits payants : si les limites de débit de l'API cloud (`429` / `RESOURCE_EXHAUSTED`) sont atteintes, les requêtes sont automatiquement redirigées vers le moteur sur site Eyes sans échec ni erreur 500.

## Prérequis
- Au moins un haut, un bas et une paire de chaussures ajoutés à votre dressing.
- Autorisation d'accès au microphone activée si vous souhaitez utiliser le stylisme vocal mains libres.
- *(Facultatif)* Compte Google Calendar connecté pour adapter les suggestions de tenues aux occasions prévues.

## Instructions étape par étape
1. **Ouvrir le styliste** : Appuyez sur l'onglet **AI Stylist** dans la barre de navigation inférieure.
2. **Parler ou écrire** : Appuyez sur l'**icône de microphone** et demandez ce que vous devriez porter (par ex. *« Que devrais-je porter pour un déjeuner par un après-midi pluvieux ? »* ou *« Suggère-moi un look professionnel chic »*).
3. **Écouter les conseils vocaux** : Le styliste vous répond avec des conseils sur mesure et affiche des cartes de tenues assorties. Appuyez sur **Écouter la réponse** pour réécouter les conseils audio à tout moment.
4. **Essayer l'outil Shuffle** : Envie d'inspiration spontanée ? Appuyez sur l'onglet **Shuffle** pour faire tourner votre dressing et découvrir de nouvelles combinaisons auxquelles vous n'auriez peut-être pas pensé !
5. **Affiner avec des questions de suivi** : Demandez au styliste de changer de chaussures, de remplacer une veste ou de s'adapter aux changements de température au fil d'une conversation continue.
6. **Enregistrer vos favoris** : Appuyez sur **Enregistrer dans le journal** pour planifier le look sur le calendrier personnel de votre garde-robe.

## Résultats attendus
Des suggestions de tenues personnalisées et adaptées à la météo affichées sur votre écran, accompagnées d'explications vocales détaillant pourquoi les pièces s'accordent. Si les quotas de l'API cloud externe sont temporairement épuisés, une bannière d'information indique que le styliste sur site Eyes intégré a traité votre demande en toute transparence.

## Dépannage
- **Le microphone ne capte pas les mots** : Vérifiez les autorisations de votre navigateur ou de votre appareil pour vous assurer que DressApp est autorisé à accéder à votre microphone.
- **Le styliste suggère trop souvent les mêmes tenues** : Enregistrez vos tenues quotidiennes dans le calendrier afin que le styliste sache ce que vous avez porté récemment et donne la priorité aux vêtements non portés.
- **Bannière « Utilisation du styliste de la plateforme (Secours quota) »** : Ce message apparaît lorsque les limites de débit de l'API cloud externe sont atteintes. L'application a répondu de manière fluide à votre question en utilisant le moteur sur site intégré Eyes (`Qwen 2.5 VL 3B`) de DressApp, sans aucune interruption de votre conversation.

## Limites
- Le styliste travaille strictement avec les articles présents dans votre dressing ; il ne peut pas recommander des pièces que vous n'avez pas encore importées.
- Les utilisateurs du forfait Gratuit utilisent le modèle sur site Eyes avec des crédits de stylisme offerts qui se renouvellent automatiquement, tandis que les comptes Manager et Professional bénéficient du modèle Cloud rapide (`Gemini 3.5 Flash`) et de quotas mensuels plus élevés.
