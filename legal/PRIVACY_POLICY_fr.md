# Politique de Confidentialité de DressApp

**Date d'entrée en vigueur :** 27 juillet 2026
**Dernière mise à jour :** 27 juillet 2026

Cette Politique de Confidentialité décrit comment DressApp (« nous », « notre » ou « nos ») collecte, utilise, stocke, partage et protège vos données personnelles lorsque vous utilisez notre application de garde-robe numérique et de stylisme.

Veuillez lire cette politique attentivement. En utilisant DressApp, vous acceptez les pratiques de données décrites dans ce document. Si vous n'êtes pas d'accord, n'utilisez pas l'application.

---

## 1. Informations que Nous Collectons

### 1.1 Informations sur le Compte et le Profil
Lorsque vous créez un compte ou vous connectez via une connexion sociale, nous collectons :

- **Adresse e-mail** — utilisée pour l'identification du compte, l'authentification et les communications transactionnelles.
- **Mot de passe** — stocké sous forme de hachage cryptographique ; nous ne stockons jamais les mots de passe en texte clair.
- **Nom d'affichage** — le nom public que vous choisissez dans l'application.
- **Prénom et nom** — renseignés depuis le profil Google OAuth ou saisis manuellement ; modifiables à tout moment.
- **Numéro de téléphone** — optionnel ; utilisé pour la récupération de compte et les notifications.
- **Date de naissance** — optionnel ; utilisé pour le filtrage de contenu par âge.
- **Sexe** — optionnel ; utilisé pour les recommandations de mesures corporelles et l'avatar.
- **Situation familiale** — optionnel (célibataire, marié, divorcé, veuf).
- **Adresse** — optionnel ; structurée comme {ligne1, ligne2, ville, région, pays, code postal}.
- **Langue et région préférées** — utilisées pour localiser l'expérience de l'application.
- **Voix préférée** — utilisée pour la sortie vocale du styliste IA.
- **Avatar et photos de profil** — photo de visage et photo corporelle, stockées sous forme d'URLs de données base64 dans MongoDB (limitées à ~500 Ko chacune côté client).
- **Mensurations corporelles** — taille, poids, poitrine, taille, hanches et autres mesures utilisées pour la génération d'avatar et les recommandations d'ajustement des vêtements.
- **Profil capillaire** — longueur, type, couleur et style (optionnel).
- **Localisation d'origine** — ville, pays et coordonnées (lat/long), utilisée pour les suggestions de tenues basées sur la météo et le ciblage de campagnes.
- **Profil de style et contexte culturel** — vos préférences de style et origine culturelle utilisées pour des recommandations personnalisées.

### 1.2 Données de Garde-Robe et Médias
DressApp est une application de garde-robe numérique. Les données suivantes sont essentielles au fonctionnement de l'application :

- **Photos de garde-robe** — images de vos vêtements téléchargés. Elles sont traitées dans le navigateur pour la suppression d'arrière-plan (détourage) puis stockées sous forme d'URLs de données dans MongoDB.
- **Métadonnées des vêtements** — catégorie (Haut, Bas, Chaussure, Veste, Robe, Accessoire), marque, couleur, taille, saison, tradition, code vestimentaire, genre et étiquettes de sous-catégorie.
- **Données de tenues** — combinaisons sauvegardées de vêtements du garde-robe.
- **Annonces sur le marché** — si vous vendez ou échangez des articles, détails de l'annonce incluant photos, prix et informations d'expédition.
- **Données de valise/liste d'emballage** — listes d'emballage pour voyages avec articles, quantités et étiquettes de purpose (ex. « Trekking / Plein air »).

### 1.3 Permissions de l'Appareil
DressApp demande les permissions suivantes :

- **Caméra** — pour capturer des photos de vêtements directement dans l'application.
- **Bibliothèque de photos / accès au système de fichiers** — pour sélectionner des photos existantes à télécharger.
- **Géolocalisation** — accès à la localisation approximative pour obtenir des données météorologiques et suggérer des tenues. Vous pouvez refuser ou révoquer cette permission à tout moment.
- **Notifications** — notifications push optionnelles pour les mises à jour de campagnes et suggestions du styliste.

### 1.4 Traitement par IA et Apprentissage Automatique
DressApp utilise l'IA sur l'appareil et sur le serveur pour les fins suivantes :

- **Suppression d'arrière-plan (détourage)** — vos photos de vêtements téléchargées sont traitées via le pipeline `rembg` / u2netp pour extraire des détourages propres. Ce traitement s'effectue sur le serveur.
- **Prédiction corporelle** — le modèle SegFormer estime les mensurations corporelles à partir de photos de tenue complètes.
- **Classification des vêtements** — la classification basée sur CLIP étiquette les articles avec catégories, couleurs et marques.
- **Recommandations du styliste** — l'API Google Gemini traite les données de votre garde-robe pour générer des suggestions de tenues et des conseils de style.
- **Génération d'avatar** — les paramètres de forme de l'avatar 3D sont calculés à partir des mensurations corporelles pour l'essayage virtuel.

**Important :** Les photos téléchargées par les utilisateurs **ne sont pas** utilisées pour entraîner des modèles d'apprentissage automatique. Elles sont traitées uniquement pour fournir les fonctions principales de l'application et ne sont pas partagées avec des pipelines d'entraînement de modèles.

### 1.5 Données d'Utilisation et d'Analyse
Nous collectons des données d'utilisation agrégées et anonymes pour améliorer l'application :

- Modèles d'activité et d'utilisation des fonctionnalités de l'application.
- Données d'interaction avec les articles (visualisations, modifications, suppressions).
- Identifiants d'appareil (adresse IP, version du système d'exploitation, type de navigateur).
- Analyses de campagnes (impressions publicitaires, clics, vues) — liées aux IDs de campagne, pas aux identités individuelles des utilisateurs.

Nous n'utilisons **pas** de SDK d'analyse tiers (pas Mixpanel, Firebase Analytics, Amplitude, Sentry, LogRocket ni similaires). Toute l'analyse est gérée en interne.

### 1.6 Données de Paiement
Si vous utilisez les fonctionnalités de marché ou d'abonnement de DressApp, nous collectons :

- **Stripe** — ID de compte Stripe, ID d'abonnement et IDs d'intention de paiement. Les numéros de carte de crédit ne sont jamais stockés sur nos serveurs ; ils sont gérés directement par Stripe.
- **PayPal** — e-mail du récepteur PayPal et IDs de commande/capture.
- **Apple Pay / Google Play** — tokens de paiement gérés par les SDK de plateforme correspondants ; nous ne stockons pas les détails de carte.

### 1.7 Données d'Authentification Tierces
- **Google OAuth** — lorsque vous vous connectez avec Google, nous recevons et stockons un token OAuth chiffré (champ `google_oauth`) utilisé pour accéder à votre profil Google (nom, e-mail, photo) et, optionnellement, Google Calendar et People API pour les fonctions de planification et de contacts.

---

## 2. Comment Nous Utilisons Vos Données

Nous utilisons vos données pour les fins suivantes :

| Objectif | Base légale (RGPD) | Types de données |
|---|---|---|
| Fournir les fonctions principales de l'application (organisation du garde-robe, création de tenues, génération d'avatar) | Nécessité contractuelle | Photos du garde-robe, métadonnées, mensurations corporelles |
| Traiter la suppression d'arrière-plan et le détourage des vêtements | Nécessité contractuelle | Photos de vêtements téléchargées |
| Générer des recommandations du styliste IA | Intérêt légitime | Métadonnées du garde-robe, profil de style |
| Obtenir des données météo pour suggestions de tenues | Consentement (permission de localisation) | Localisation d'origine (approximative) |
| Authentifier et gérer les comptes utilisateurs | Nécessité contractuelle | E-mail, hash de mot de passe, tokens OAuth |
| Envoyer des e-mails transactionnels (confirmations de compte, réinitialisation de mot de passe, confirmations de suppression) | Nécessité contractuelle | Adresse e-mail |
| Traiter les paiements du marché | Nécessité contractuelle | Tokens Stripe/PayPal, informations de facturation |
| Détecter et prévenir la fraude / les abus | Intérêt légitime | Adresse IP, identifiants d'appareil |
| Améliorer la fonctionnalité de l'application (analyses agrégées) | Intérêt légitime | Données d'utilisation anonymes |
| Se conformer aux obligations légales | Obligation légale | Toutes les données selon les exigences légales |

---

## 3. Stockage et Sécurité des Données

### 3.1 Stockage
- **Base de données :** MongoDB Atlas (hébergé dans le cloud, niveau gratuit M0 ou niveau payant selon le déploiement).
- **Images :** Les photos du garde-robe sont stockées sous forme d'URLs de données encodées en base64 dans les documents MongoDB. Chaque image est limitée à ~500 Ko côté client avant le téléchargement.
- **Cache de modèles :** Les poids des modèles d'IA (SegFormer, u2netp) sont mis en cache dans des volumes Docker persistants sur le serveur de production pour éviter les téléchargements répétés à chaque requête.
- **Aucun magasin de blobs externe** n'est utilisé pour les images pour le moment ; toutes les données d'image résident dans MongoDB.

### 3.2 Sécurité
- Toutes les données en transit sont chiffrées via **HTTPS/TLS 1.3**.
- Les mots de passe sont stockés sous forme de **hashes bcrypt** — jamais en texte clair.
- Les tokens Google OAuth sont stockés chiffrés au repos.
- Les données de paiement (tokens Stripe/PayPal) ne sont jamais stockées en texte clair sur nos serveurs ; nous stockons uniquement des IDs de référence.
- MongoDB Atlas fournit un **chiffrement au repos** et un **chiffrement en transit** par défaut.
- L'accès à la base de données est restreint à l'application backend via les identifiants de la chaîne de connexion.

### 3.3 Conservation des Données
- Vos données sont conservées tant que votre compte est actif.
- Après la suppression du compte (voir Section 5), toutes les données personnelles sont supprimées définitivement de MongoDB dans les 30 jours.
- Les données d'analyse agrégées et anonymes peuvent être conservées indéfiniment et ne peuvent pas être liées à des utilisateurs individuels.

---

## 4. Partage des Données et Tiers

Nous partageons vos données avec les tiers suivants uniquement comme décrit ci-dessous :

| Tiers | Données partagées | Objectif |
|---|---|---|
| **MongoDB Atlas** | Toutes les données utilisateur et images du garde-robe | Hébergement de base de données cloud |
| **Google (OAuth)** | E-mail, nom, photo de profil | Authentification et création de profil |
| **Google Calendar API** | Données d'événements du calendrier (si connecté) | Fonctions de planification du styliste |
| **Google People API** | Données de contacts (si connecté) | Fonctions sociales |
| **Google Gemini API** | Métadonnées du garde-robe et descriptions d'articles | Recommandations du styliste IA |
| **Stripe** | Tokens de paiement, informations de facturation | Traitement des paiements |
| **PayPal** | Tokens de paiement, informations de facturation | Traitement des paiements |
| **Resend / SendGrid** | E-mail et nom | Livraison d'e-mails transactionnels |

**Nous NE vendons PAS vos données personnelles ni vos photos de garde-robe à des courtiers, annonceurs ou agrégateurs de données tiers.**

---

## 5. Vos Droits et Suppression de Compte

Sous le RGPD (UE/EEE), la CCPA (Californie) et autres lois sur la confidentialité applicables, vous disposez des droits suivants :

### 5.1 Accès et Exportation
Vous pouvez demander une copie de toutes les données personnelles que nous détenons sur vous en nous contactant (voir Section 6). Nous fournirons une exportation JSON des données de votre compte, incluant les articles du garde-robe, les tenues et les informations de profil.

### 5.2 Correction
Vous pouvez mettre à jour ou corriger les informations de votre profil à tout moment via la page Paramètres de l'application. Les champs que vous pouvez modifier incluent : nom d'affichage, prénom et nom, téléphone, date de naissance, adresse, mensurations corporelles, localisation d'origine et préférences de style.

### 5.3 Suppression (Droit à l'Oubli)
Vous pouvez supprimer votre compte et toutes les données associées à tout moment :

- **Dans l'application :** Allez dans Paramètres → Compte → Supprimer le compte.
- **API :** Envoyez une requête `POST` à `/api/v1/users/me/delete` (authentifiée).

La suppression du compte déclenche une **suppression en cascade** dans toutes les collections :
- Document utilisateur
- Tous les articles du garde-robe (photos et métadonnées)
- Toutes les tenues
- Toutes les annonces sur le marché
- Toutes les valises et listes d'emballage
- Toutes les sessions et messages du styliste
- Tous les rechargements de crédits et enregistrements de transactions
- Tous les embeddings (données générées par IA)
- Toutes les abonnements de notifications push

Un e-mail de confirmation de suppression est envoyé à votre adresse e-mail enregistrée.

### 5.4 Portabilité des Données
Vous pouvez demander vos données dans un format structuré et lisible par machine (JSON) à tout moment. Contactez-nous en utilisant les détails de la Section 6.

### 5.5 Retrait du Consentement
Vous pouvez retirer votre consentement pour l'accès à la localisation, la caméra et les communications marketing à tout moment via les paramètres de votre appareil ou la page Paramètres de l'application. Le retrait du consentement peut limiter certaines fonctions de l'application (ex. suggestions de tenues basées sur la météo).

### 5.6 Droit d'Opposition (LGPD Art. 18, RGPD Art. 21)
Sous la LGPD (Brésil) et le RGPD (UE/EEE), vous avez le droit de vous opposer au traitement de vos données personnelles à des fins spécifiques, notamment :
- Traitement basé sur l'intérêt légitime
- Marketing direct
- Profilage et prise de décision automatisée (incluant les recommandations du styliste basées sur l'IA)

Pour vous opposer, contactez-nous en utilisant les détails de la Section 6.

### 5.7 Transferts Internationaux de Données
DressApp est une application internationale. Vos données peuvent être transférées et traitées dans des pays autres que votre pays de résidence, y compris Israël et les États-Unis. Nous garantissons que tous les transferts sont régis par des garanties appropriées, y compris les Clauses Contractuelles Types (SCC) lorsque la loi applicable l'exige.

---

## 6. Informations de Contact

Pour les demandes liées à la confidentialité, les demandes d'accès aux données, les demandes de suppression ou pour signaler une préoccupation concernant la confidentialité, contactez-nous à :

**E-mail :** dev@dressapp.co
**Adresse :** DressApp, 11 Hanoter St, 8442711 Be'er-Sheva, Israël

Nous répondrons à toutes les demandes valides dans les 30 jours, conformément aux lois sur la confidentialité applicables incluant le RGPD, la CCPA, la LGPD, la PIPEDA et autres réglementations internationales sur la protection des données.

Pour les Demandes d'Accès des Sujets des Données (DSAR), veuillez inclure l'adresse e-mail de votre compte et une description des données que vous souhaitez accéder ou modifier.

---

## 7. Confidentialité des Mineurs

DressApp n'est pas destinée aux enfants de moins de 16 ans (ou l'âge de consentement numérique applicable dans votre juridiction, le plus élevé des deux). Nous ne collectons pas consciemment de données personnelles auprès de personnes de moins de cet âge. Si nous avons connaissance qu'un mineur nous a fourni des données personnelles, nous prendrons des mesures pour les supprimer rapidement.

Si vous êtes un parent ou tuteur légal et pensez que votre enfant nous a fourni des données personnelles, veuillez nous contacter à dev@dressapp.co et nous prendrons des mesures immédiates.

---

## 8. Conformité Internationale

DressApp est conçue pour fonctionner dans tous les pays. Cette Politique de Confidentialité est rédigée pour se conformer aux cadres internationaux suivants de protection des données :

| Cadre | Juridiction | Dispositions clés couvertes |
|---|---|---|
| **RGPD** | UE/EEE | Base légale, droits du titulaire de données, contact du DPO, transferts internationaux, notification de violation |
| **CCPA/CPRA** | Californie, États-Unis | Droit de savoir, supprimer, refuser la vente, non-discrimination |
| **LGPD** | Brésil | Base légale, droits du titulaire de données, DPO, transferts internationaux, consentement |
| **PIPEDA** | Canada | Consentement, accès, correction, responsabilité, notification de violation |
| **POPIA** | Afrique du Sud | Traitement légal, droits du titulaire de données, transfert transfrontalier |
| **PDPA** | Thaïlande | Consentement, droits du titulaire de données, transfert international |
| **PDPL** | Arabie Saoudite | Base légale, droits du titulaire de données, transfert international |

Lorsque la loi d'une juridiction spécifique exige des droits ou protections supplémentaires au-delà de ce qui est décrit dans cette politique, ces droits supplémentaires s'appliquent.

---

## 9. Modifications de Cette Politique de Confidentialité

Nous pouvons mettre à jour cette Politique de Confidentialité de temps à autre. Nous vous notifierons les modifications matérielles par :

- Publiant la politique mise à jour sur cette page avec une « Date d'entrée en vigueur » révisée.
- Envoyant une notification par e-mail à votre adresse e-mail enregistrée pour les modifications significatives.
- Affichant une notification dans l'application la prochaine fois que vous l'ouvrirez.

Nous vous encourageons à revoir cette politique périodiquement.

---

## 10. Date d'Entrée en Vigueur et Loi Applicable

Cette Politique de Confidentialité est en vigueur à partir du **27 juillet 2026**.

DressApp est une application internationale opérant dans tous les pays. Cette politique est régie par les principes du **Règlement Général sur la Protection des Données (RGPD)** — UE/EEE, la **Loi Californienne sur la Confidentialité des Consommateurs (CCPA)** — États-Unis, la **Loi Générale sur la Protection des Données (LGPD)** — Brésil, la **Loi sur la Protection des Renseignements Personnels et les Documents Électroniques (PIPEDA)** — Canada, et autres lois internationales applicables sur la protection des données. En cas de conflit entre ces cadres, le standard le plus protecteur pour l'utilisateur s'appliquera.

---

## 11. Conformité des Magasins d'Applications

Cette Politique de Confidentialité est hébergée publiquement à :

**https://dressapp.co/privacy**

Elle est référencée dans :
- **Apple App Store Connect** — Section Confidentialité de l'App
- **Google Play Console** — Section Sécurité des Données
- **Paramètres de l'application** — un lien direct est disponible dans le menu Paramètres
- **Flux d'intégration** — un avis de confidentialité est affiché lors de la configuration initiale du compte

---

*DressApp respecte votre vie privée et s'engage envers des pratiques de données transparentes. Si vous avez des questions sur cette politique ou sur la façon dont nous traitons vos données, veuillez nous contacter à dev@dressapp.co.*