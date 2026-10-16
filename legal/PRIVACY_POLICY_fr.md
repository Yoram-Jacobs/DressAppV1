# Politique de Confidentialité de DressApp

**Date d'entrée en vigueur :** 23 septembre 2026  
**Dernière mise à jour :** 16 octobre 2026  
**Version de l'application :** 1.0.5  
**Site officiel :** [https://dressapp.co](https://dressapp.co)  
**URL dédiée à la confidentialité :** [https://dressapp.co/privacy](https://dressapp.co/privacy)  

Bienvenue sur **DressApp** (« nous », « notre », « nos » ou « l'Application »). DressApp est une plateforme intelligente de garde-robe numérique, de planification de style et de stylisme personnel par IA développée et exploitée par **DressApp Ltd.**

La présente Politique de Confidentialité explique en détail comment nous accédons, collectons, utilisons, traitons, stockons, divulguons, conservons et protégeons vos informations personnelles lorsque vous utilisez notre plateforme web, nos applications mobiles et nos services connectés. Veuillez lire ce document attentivement. En créant un compte ou en utilisant DressApp, vous reconnaissez et acceptez les pratiques décrites dans la présente politique.

---

## 1. Informations que nous collectons et auxquelles nous accédons

Nous collectons les informations que vous nous fournissez directement, les informations collectées automatiquement lors de vos interactions avec l'appareil, ainsi que les informations obtenues via des intégrations tierces autorisées.

### 1.1 Informations relatives au compte et à l'identité
- **Identifiants d'authentification :** Adresse e-mail et mots de passe hachés par cryptographie (salés avec bcrypt). Nous ne stockons jamais les mots de passe en texte clair.
- **Détails du profil :** Nom d'affichage, prénom, nom de famille, numéro de téléphone (facultatif), date de naissance (facultatif) et genre (facultatif, utilisé pour adapter le stylisme et la géométrie de l'avatar).
- **Données démographiques et de mensurations :** Mensurations corporelles (taille, poids, tour de poitrine, tour de taille, tour de hanches, entrejambe, longueur de bras), préférence de teint de peau et profil capillaire (facultatif) afin de générer des avatars d'essayage virtuel et des conseils d'ajustement précis.
- **Informations de localisation :** Ville, pays et coordonnées géographiques approximatives (latitude/longitude) fournies avec votre consentement pour récupérer les conditions météorologiques locales et proposer des recommandations de tenues quotidiennes adaptées à la météo.

### 1.2 Garde-robe numérique, médias et tenues
- **Photos de vêtements :** Images des articles vestimentaires que vous photographiez ou téléversez dans votre dressing numérique.
- **Métadonnées des vêtements :** Catégorie de l'article (Haut, Bas, Chaussures, Vêtement d'extérieur, Robe, Accessoire), marque, palette de couleurs, composition du tissu, niveau de formalité / code vestimentaire, saison et étiquettes d'état.
- **Tenues et looks :** Associations de tenues créées par l'utilisateur, looks planifiés dans le calendrier et listes de bagages (valises).
- **Contenu de la Place de marché (Marketplace) :** Annonces d'articles créées pour la vente, l'échange ou le don, y compris les descriptions, les prix demandés et les préférences de livraison.

### 1.3 Autorisations de l'appareil
- **Appareil photo (Caméra) :** Utilisé strictement lorsque vous prenez des photos de vêtements directement dans l'application.
- **Photothèque :** Utilisée strictement lorsque vous choisissez de téléverser des photos existantes de vêtements ou des avatars de profil.
- **Notifications push :** Utilisées uniquement avec votre autorisation pour envoyer des rappels quotidiens de tenues, des mises à jour de l'assistant de bagages et des alertes de sécurité importantes.

---

## 2. Données utilisateur Google et déclaration d'utilisation limitée (Limited Use)

DressApp propose des intégrations facultatives avec Google pour faciliter la connexion des utilisateurs et la planification personnalisée. Cette section détaille explicitement les données utilisateur Google auxquelles nous accédons, la manière dont elles sont utilisées et stockées, ainsi que notre respect des normes strictes de confidentialité de Google.

> ### Politique relative aux données utilisateur des services API Google — Déclaration d'utilisation limitée
> **L'utilisation et le transfert par DressApp vers toute autre application des informations reçues des API Google respecteront la [Politique relative aux données utilisateur des services API Google](https://developers.google.com/terms/api-services-user-data-policy), y compris les exigences d'utilisation limitée (Limited Use).**

### 2.1 Données utilisateur Google auxquelles nous accédons

| Portée (Scope) de l'API Google | Données consultées | Objectif spécifique dans DressApp |
|---|---|---|
| `openid`<br>`userinfo.email`<br>`userinfo.profile` | Identifiant utilisateur Google, adresse e-mail principale, nom complet et URL de l'image d'avatar du profil. | Authentifier votre identité, créer et sécuriser votre compte utilisateur DressApp, et afficher votre nom ainsi que votre avatar dans votre tableau de bord personnel. |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Titres des événements Google Calendar, horodatages de début et de fin, lieux et descriptions des événements. | Accès en lecture seule utilisé exclusivement par la fonctionnalité AI Stylist pour adapter les suggestions de tenues à votre emploi du temps réel (par ex. suggérer une tenue professionnelle pour des réunions prévues, une tenue de sport pour un entraînement ou une tenue de soirée pour un événement). |
| `https://www.googleapis.com/auth/user.birthday.read`<br>`https://www.googleapis.com/auth/user.gender.read` | Date de naissance et genre (s'ils sont renseignés dans votre profil Google et explicitement accordés). | Utilisés pour calibrer les algorithmes de mensurations de l'avatar corporel, les conseils de style adaptés à l'âge et les recommandations de coupe. |
| `https://www.googleapis.com/auth/user.phonenumbers.read`<br>`https://www.googleapis.com/auth/user.addresses.read` | Numéro de téléphone et adresse (s'ils sont renseignés dans votre profil Google et explicitement accordés). | Utilisés uniquement pour préremplir les adresses de livraison lors des transactions sur la place de marché et pour la récupération de compte, après confirmation explicite de l'utilisateur. |

### 2.2 Comment nous utilisons les données utilisateur Google
- Les données utilisateur Google sont utilisées **strictement pour fournir et améliorer les fonctionnalités destinées à l'utilisateur** de l'application DressApp (authentification, configuration du profil utilisateur et recommandations de tenues basées sur l'emploi du temps).
- Nous traitons les titres et horodatages des événements Google Calendar en mémoire transitoire afin de générer des recommandations vestimentaires quotidiennes et des listes de bagages.

### 2.3 Interdictions strictes et protections relatives aux données utilisateur Google
- **Aucun entraînement de modèle :** Les données utilisateur Google et les données des API Google Workspace ne sont **PAS** utilisées pour développer, améliorer ou entraîner des modèles d'intelligence artificielle (IA) ou d'apprentissage automatique (ML) généralisés ou non personnalisés.
- **Aucune publicité :** Nous n'utilisons, ne transférons ni ne divulguons **PAS** les données utilisateur Google pour diffuser des publicités, y compris la publicité ciblée, personnalisée, reciblée ou basée sur les centres d'intérêt.
- **Aucun courtier en données / aucune revente :** Nous ne vendons, ne louons, ne concédons sous licence ni n'échangeons **JAMAIS** les données utilisateur Google à des tiers, des courtiers en données ou des revendeurs d'informations, en aucune circonstance.
- **Aucune évaluation de crédit ou de prêt :** Les données utilisateur Google ne sont jamais utilisées pour déterminer la solvabilité ou à des fins d'octroi de prêt.
- **Restrictions d'accès humain :** Nos employés, sous-traitants et développeurs ne lisent **PAS** vos données utilisateur Google, sauf si :
  1. Vous avez donné votre consentement explicite et affirmatif pour une session de dépannage spécifique ;
  2. Cela est strictement nécessaire à des fins d'enquête de sécurité (comme l'analyse d'un abus, d'une fraude ou d'un logiciel malveillant) ;
  3. Cela est requis pour se conformer à la législation applicable ou à des injonctions gouvernementales valides ; ou
  4. Les données sont agrégées et anonymisées pour des opérations techniques internes.

---

## 3. Comment nous traitons et utilisons les données générales

Nous traitons les informations personnelles non issues de Google sur les bases juridiques suivantes :

| Activité de traitement | Base juridique (RGPD / Normes mondiales) | Catégories de données utilisées |
|---|---|---|
| Indexation, catalogage de la garde-robe numérique et création de tenues | Exécution d'un contrat | Photos de vêtements, catégories, couleurs, métadonnées |
| Suppression d'arrière-plan par IA et extraction de détourages transparents | Exécution d'un contrat | Photographies de vêtements téléversées |
| Recommandations de looks et conseils de style par l'AI Stylist | Intérêt légitime / Consentement | Métadonnées de la garde-robe, préférences de style |
| Planification de tenues adaptée à la météo | Consentement (autorisation de localisation) | Localisation approximative (ville/coordonnées) |
| Communications transactionnelles (alertes de sécurité, réinitialisations de mot de passe) | Exécution d'un contrat | Adresse e-mail du compte |
| Transactions sur la place de marché et facilitation des paiements | Exécution d'un contrat | Jetons de prestataires de paiement (Stripe/PayPal), historique des transactions |

---

## 4. Stockage des données, sécurité et mécanismes de protection

Nous mettons en œuvre de solides mesures de sécurité administratives, techniques et physiques conçues pour protéger vos données sensibles contre tout accès, modification, divulgation ou destruction non autorisés :

- **Chiffrement en transit :** 100 % des données transmises entre votre navigateur/application et nos serveurs sont chiffrées à l'aide des protocoles modernes **HTTPS et Transport Layer Security (TLS 1.3 / TLS 1.2)**.
- **Protection par base de données et stockage isolés auto-hébergés :** Tous les enregistrements de base de données, métadonnées de garde-robe, entrées de profil et identifiants OAuth chiffrés sont stockés sur la **base de données MongoDB 7.0 sur site (on-premises)** isolée et autogérée de DressApp, hébergée sur un stockage NVMe dédié chez **Hetzner Cloud (UE)**, isolée au sein d'un réseau privé interne de conteneurs sans exposition publique de port de base de données, et protégée par un chiffrement AES-256 pour les jetons sensibles ainsi que par des sauvegardes locales automatisées.
- **Protection cryptographique des mots de passe :** Les mots de passe des utilisateurs sont chiffrés par hachage bcrypt intégrant un salage unique par utilisateur.
- **Contrôle d'accès :** L'accès à l'infrastructure de production est strictement restreint par authentification par clé SSH, authentification multifacteur (MFA), contrôle d'accès basé sur les rôles (RBAC) selon le principe du moindre privilège et journalisation d'audit continue.

---

## 5. Conservation et suppression des données

### 5.1 Durée de conservation
- Nous conservons vos données personnelles et les dossiers de votre garde-robe aussi longtemps que votre compte utilisateur DressApp reste actif.
- Les jetons d'accès Google OAuth et le cache du calendrier ne sont conservés que tant que l'intégration Google reste active et autorisée par vous.

### 5.2 Déconnexion des intégrations Google
- Vous pouvez déconnecter votre compte Google ou l'intégration Google Calendar à tout moment directement dans l'application via **Paramètres → Intégrations → Déconnecter Google**.
- Vous pouvez également révoquer les autorisations accordées à DressApp directement depuis les [Paramètres de sécurité de votre compte Google](https://myaccount.google.com/permissions).
- Dès la déconnexion, les jetons Google OAuth stockés et les enregistrements d'événements de calendrier mis en cache sont immédiatement purgés de nos systèmes actifs.

### 5.3 Suppression de compte et droit à l'effacement
Vous avez le droit absolu de supprimer votre compte et toutes les données associées à tout moment :
- **Suppression en un clic dans l'application :** Accédez à **Paramètres → Compte → Supprimer le compte**.
- **Par demande e-mail :** Envoyez un e-mail depuis votre adresse e-mail enregistrée à [dev@dressapp.co](mailto:dev@dressapp.co) avec l'objet « Delete My Account » (Supprimer mon compte).

La suppression du compte exécute une suppression en cascade immédiate et irréversible sur toutes les bases de données, effaçant définitivement :
- Votre profil utilisateur, vos données d'identité et vos identifiants d'authentification ;
- Tous les articles de votre garde-robe, les photographies téléversées et les images détourées ;
- Toutes les tenues enregistrées, les entrées de lookbook et les listes de bagages ;
- Toutes les annonces de la place de marché et les références de transactions ;
- Tous les historiques de conversation avec l'AI Stylist, les plongements vectoriels (embeddings) et les jetons Google.

Toutes les données sont intégralement détruites dans un délai de 30 jours suivant la demande de suppression.

---

## 6. Partage de données, divulgations et tiers

Nous ne vendons, ne louons ni n'échangeons vos données personnelles. Le stockage principal en base de données et le moteur de vision par ordinateur de base (« The Eyes ») sont exploités directement par DressApp sur notre infrastructure serveur sur site (on-premises) isolée et autogérée, sans intermédiaires SaaS tiers de base de données. Nous ne divulguons des informations qu'à des fournisseurs d'infrastructure et de services vérifiés qui nous aident à exploiter notre plateforme, strictement liés par des accords de traitement des données :

| Prestataire de services | Données divulguées | Objectif |
|---|---|---|
| **Hetzner Online GmbH (Infrastructure UE)** | Volumes de serveurs chiffrés hébergeant la base de données MongoDB sur site autogérée de DressApp, les médias de garde-robe et l'inférence d'IA sur site | Infrastructure dédiée de serveur privé virtuel (VPS) européen et de stockage NVMe (centre de données UE conforme au RGPD) |
| **Google Cloud Platform / API Google** | Jetons d'authentification OAuth, invites de requêtes de stylisme | Authentification des utilisateurs et analyse de stylisme par l'IA Gemini |
| **Stripe / PayPal** | Jetons de transaction de paiement, métadonnées de facturation | Traitement des paiements conforme à la norme PCI (les numéros de carte ne transitent jamais par nos serveurs) |
| **Resend / Service d'e-mailing transactionnel** | Adresse e-mail, nom d'affichage de l'utilisateur | Envoi des notifications système critiques et des réinitialisations de mot de passe |

---

## 7. Droits internationaux en matière de confidentialité (RGPD, CCPA/CPRA, LGPD, LPRPDE/PIPEDA)

Selon votre situation géographique, vous bénéficiez de droits légaux spécifiques en matière de protection de la vie privée :
- **Droit d'accès / à la portabilité :** Vous pouvez demander une copie complète, lisible par machine au format JSON, de toutes les données personnelles que nous détenons à votre sujet.
- **Droit de rectification :** Vous pouvez mettre à jour ou corriger toute information personnelle inexacte à tout moment dans les paramètres de l'application.
- **Droit à l'effacement :** Vous pouvez demander la suppression définitive de vos données personnelles comme indiqué à la Section 5.
- **Droit à la limitation ou d'opposition :** Vous pouvez vous opposer au profilage automatisé ou retirer votre consentement au traitement de la localisation ou de la caméra à tout moment.
- **Non-discrimination :** Nous ne ferons jamais preuve de discrimination à votre égard, ne vous refuserons jamais de services et ne modifierons jamais nos tarifs parce que vous avez exercé vos droits en matière de confidentialité.

---

## 8. Confidentialité des mineurs

DressApp s'adresse strictement aux personnes âgées d'au moins 16 ans (ou ayant atteint l'âge légal minimum du consentement numérique dans votre juridiction). Nous ne sollicitons ni ne collectons sciemment d'informations personnelles auprès d'enfants de moins de 16 ans. Si nous découvrons qu'un mineur de moins de 16 ans nous a fourni des informations personnelles, nous supprimerons immédiatement ces données de nos serveurs.

---

## 9. Modifications de la présente Politique de Confidentialité

Nous pouvons mettre à jour périodiquement la présente Politique de Confidentialité afin de refléter les évolutions de nos services, les avancées technologiques ou les exigences légales. Lorsqu'une mise à jour a lieu, nous révisons la date de « Dernière mise à jour » en haut de la présente politique et informons les utilisateurs par une annonce dans l'application ou une notification par e-mail en cas de changements substantiels. Nous vous encourageons à consulter régulièrement cette page.

---

## 10. Coordonnées et demandes relatives à la protection des données

Si vous avez des questions, des préoccupations, des commentaires ou des demandes concernant la présente Politique de Confidentialité ou vos données personnelles, veuillez contacter notre équipe chargée de la protection des données :

- **Organisation :** DressApp Ltd.
- **Contact principal pour la confidentialité :** [dev@dressapp.co](mailto:dev@dressapp.co)
- **Contact du support utilisateur :** [lokoprod@gmail.com](mailto:lokoprod@gmail.com)
- **Adresse postale :** DressApp Ltd., 11 Hanoter St, 8442711 Be'er-Sheva, Israël
- **Site officiel :** [https://dressapp.co](https://dressapp.co)
- **URL dédiée à la confidentialité :** [https://dressapp.co/privacy](https://dressapp.co/privacy)

Nous nous engageons à traiter et à résoudre toutes les demandes relatives à la confidentialité dans les meilleurs délais et au plus tard dans les trente (30) jours suivant leur réception.