# Profil, mensurations et configuration (`/me`)

Gérez vos mensurations physiques, votre teint, vos découpes photo corporelles, vos préférences vestimentaires, vos identifiants de modèles d'IA et vos intégrations système sur votre tableau de bord de profil personnel.

## Vue d'ensemble
La page **Profil & Paramètres** (`https://dressapp.co/me`) sert de centre névralgique de contrôle pour votre écosystème DressApp. Elle regroupe vos paramètres anthropométriques physiques, l'espace d'essayage virtuel d'avatar numérique, vos contraintes de style, vos préférences régionales, vos clés de modèles d'IA et vos calendriers de notifications push.

---

## Prérequis
- Un compte DressApp actif.
- (Optionnel) Autorisations d'accès à l'appareil photo pour téléverser une photo plein pied.
- (Optionnel) Autorisations de localisation pour le ciblage des campagnes de stylistes locaux, les préférences culturelles et les prévisions météorologiques.

---

## Guide étape par étape : Présentation complète de la page de haut en bas

### 1. En-tête de page et barre de navigation Explorer
Situés tout en haut du tableau de bord `/me` :
- **En-tête** : Affiche le statut et le titre de votre compte.
- **Cartes Explorer** : Raccourcis rapides vers les sections principales de l'application :
  - **Trend Scout** (`/trends`) : Consultez les flux d'actualités mode quotidiennes sélectionnés par l'IA.
  - **Tenues** (`/outfits`) : Accédez à votre calendrier de tenues enregistrées.
  - **Experts** (`/experts`) : Parcourez les stylistes et retoucheurs locaux.
  - **Déballé / Stats** (`/me/stats`) : Visualisez la valorisation de votre garde-robe, le coût par utilisation et la répartition des couleurs.

### 2. Carte de sélection de langue et de voix
Mise en évidence pour une accessibilité immédiate :
- **Sélecteur de langue** : Choisissez parmi 12 langues prises en charge (*anglais, espagnol, français, allemand, italien, portugais, russe, chinois, japonais, arabe, hindi, hébreu*). Le choix d'une langue actualise automatiquement les textes de l'interface et applique le modèle vocal Text-to-Speech (TTS) régional par défaut.

---

### 3. Carte d'identité et coordonnées personnelles (`ProfileDetailsCard`)

Comprend 9 panneaux déroulants en accordéon pour gérer votre identité, vos tailles et le rendu de votre avatar :

#### Panneau A : Identité
- **Prénom & Nom** : Champs d'identification personnelle.
- **Adresse e-mail** : Affichage en lecture seule de votre adresse e-mail enregistrée.
- **Date de naissance** : Utilisée pour affiner le ciblage démographique des tendances.
- *Badge d'auto-remplissage Google* : S'affiche automatiquement si votre profil a été créé via Google OAuth.

#### Panneau B : Contact et adresse de livraison
- **Numéro de téléphone** : Requis pour recevoir les alertes SMS/Push des suggestions du programmateur quotidien et des campagnes d'experts locaux.
- **Ligne d'adresse 1** : Intègre l'autocomplétion au niveau de la rue via OpenStreetMap (Nominatim). La sélection d'une suggestion remplit automatiquement la Ligne 1, la Ville, la Région, le Code postal et le Pays.
- **Ligne d'adresse 2, Ville, Région, Code postal** : Champs d'adresse manuels pour l'expédition sur le marketplace.
- **Pays** : Liste déroulante hors ligne consultable par nom de pays ou code ISO-2.

#### Panneau C : Données démographiques
- **Sexe** : Sélectionnez *Femme* ou *Homme* pour configurer les mensurations de référence et la classification des vêtements.
- **Statut personnel** : Choisissez entre *Célibataire*, *Marié(e)*, *Divorcé(e)* ou *Veuf/Veuve*.
- **Profession** : Saisie en texte libre (par exemple *Étudiant(e)*, *Responsable marketing*, *Barista*). Alimente l'algorithme de classement Trend Scout afin de prioriser les actualités de mode pertinentes.

#### Guide résumé : Synchroniser les données manquantes du profil Google (re-consentement People API)
Si vous vous êtes connecté avec Google avant que DressApp ne demande l'accès aux détails de profil de la **People API** (téléphone, adresse, sexe, date de naissance), ces champs peuvent rester vides. Vous pouvez les synchroniser en un clic :

1. **Ouvrez l'accordéon Contact ou Démographie** — vous verrez un bouton **"Synchroniser depuis Google"** (icône d'actualisation) à côté du titre de la section.
2. **Cliquez sur "Synchroniser depuis Google"** — si les portées d'autorisation requises pour People API n'avaient pas été accordées lors de votre connexion initiale, DressApp le détecte et affiche une notification informative : *"Google a besoin de votre autorisation pour accéder aux informations de votre profil. Vous allez être redirigé vers Google pour donner votre accord."*
3. **Accordez votre consentement sur l'écran Google** — vous êtes redirigé vers l'écran de consentement Google OAuth. Cochez les cases **Infos de profil** (nom, e-mail, photo) et **Coordonnées** (téléphone, adresse, sexe, anniversaire).
4. **Retour automatique et remplissage instantané** — après accord, Google vous redirige vers DressApp. La fonction `syncGoogleProfile()` s'exécute automatiquement en appelant le point de terminaison backend `/auth/google/sync-profile` qui :
   - Récupère votre téléphone, adresse, sexe et date de naissance depuis Google People API
   - Remplit les champs vides dans les volets **Contact** (téléphone, adresse) et **Démographie** (sexe, date de naissance)
   - Enregistre immédiatement les mises à jour sur votre profil
5. **Terminé** — votre profil est désormais complet sans aucune saisie manuelle.

> **Remarque** : Le bouton "Synchroniser depuis Google" apparaît également dans l'en-tête de la page (à côté du bouton principal "Synchroniser le profil Google") et fonctionne de la même manière — il synchronise l'ensemble des données Google disponibles en une seule action.

#### Panneau D : Préférences et unités de mesure
- **Unité de poids** : Basculez entre kilogrammes (`kg`) et livres (`lb`).
- **Unité de longueur** : Basculez entre centimètres (`cm`) et pouces (`in`).

#### Panneau E : Photos et espace avatar numérique
- **Colonne de gauche — Sélection de photos** :
  - *Photo du visage* : Téléversez une miniature pour votre avatar.
  - *Photo plein pied* : Téléversez une photo de votre corps complet. Le système exécute automatiquement le détourage local U2-Net (`rembg`) pour supprimer l'arrière-plan.
  - *Bouton supprimer la photo* : Suppression en un clic de votre découpe photo, rétablissant instantanément le mannequin vectoriel SVG 2D sans aucun temps de chargement.
- **Colonne de droite — Avatar numérique et scène d'essayage** :
  - **Nuancier de teint** : Palette interactive pour choisir le teint de peau de votre mannequin.
  - **Toile d'essayage de l'avatar** : Affiche les vêtements sur votre silhouette détourée ou sur le mannequin vectoriel dynamique de Bézier (`DynamicAvatar.jsx`) grâce à des repères morphologiques étalonnés (`top-[14.5%]` pour l'encolure et `top-[36.5%]` pour la ceinture).

#### Panneau F : Profil de style
- **Esthétiques** : Mots-clés de style séparés par des virgules (par exemple *Minimaliste, Streetwear, Vintage*).
- **Palette de couleurs** : Nuances favorites (par exemple *Pastels, Tons terreux, Monochrome*).
- **À éviter** : Couleurs ou catégories de vêtements à exclure impérativement des recommandations de l'IA (par exemple *Jaune, Crop tops*).
- **Pudeur vestimentaire culturelle** : Choisissez votre niveau de couvrance (*Décontracté/Libre*, *Modéré*, *Conservateur*) pour guider la coupe des tenues proposées par l'AI Stylist.

#### Panneau G : Mensurations corporelles et tailles (Prédicteur de taille ANSUR II)
- **Mode d'intégration / Nouveau départ** : Renseignez 4 données de base : **Taille**, **Poids**, **Tour de taille** et **Longueur du pied**. Le modèle de régression multivariable intégré scikit-learn ANSUR II déduit automatiquement 6 mensurations morphologiques :
  - *Épaules*, *Tour de poitrine*, *Hanches*, *Longueur de manche*, *Entrejambe* et *Longueur extérieure*.
- **Conversion automatique des tailles** : Une fois les mensurations estimées, des algorithmes déterministes renseignent instantanément **toutes les tailles du commerce standard**, jusqu'à la pointure de chaussures :
  - *Taille de chemise décontractée* (XS–XXL selon le tour de poitrine)
  - *Tour de taille de pantalon* (en pouces, converti depuis les cm de taille)
  - *Pointure US* (formules homme/femme selon la longueur du pied)
  - *Taille de robe femme* (US 0–14+ selon la taille)
  - *Taille de soutien-gorge* (tour de dos + bonnet calculés d'après le buste/sous-buste)
- **Mode d'édition détaillée** : Après le remplissage automatique, affinez les 15 paramètres de tailles (dont taille de chemise, pantalon, chaussures, soutien-gorge, robe) et les attributs capillaires (*Longueur, Type, Couleur, Style*).
- **Bascule d'unités en direct** : Passez de *kg/cm* à *lb/in* — toutes les valeurs sont instantanément converties sans nécessiter de nouvelle prédiction.

#### Panneau H : Inscription à l'annuaire des professionnels et experts
- **Bouton styliste professionnel** : Enregistrez-vous comme professionnel de la mode vérifié (styliste, tailleur, créateur).
- **Coordonnées professionnelles** : Indiquez le nom commercial, l'adresse, le téléphone, l'e-mail, le site web et la description pour figurer dans l'annuaire `/experts` et sur le bandeau d'actualités régionales.

#### Panneau I : Paramètres de virement PayPal
- **E-mail de réception PayPal** : Saisissez votre adresse PayPal afin de percevoir les paiements issus de vos ventes sur le marketplace et de vos campagnes de stylisme.

---

### 4. Carte en accordéon des préférences système

Gère les paramètres généraux, les abonnements et les intégrations d'IA :

- **Configuration de l'IA** :
  - *Mode standard (Moteur principal de production)* : Propulsé par **Google Gemini 3.5 Flash-Lite** via `llm_gateway.py`. Offre des conseils de style instantanés sans configuration initiale et sans clé API requise.
  - *Filet de sécurité pour les quotas sur site* : Si les plafonds d'appels cloud (`429` / `RESOURCE_EXHAUSTED`) sont atteints, les requêtes basculent automatiquement vers le conteneur auto-hébergé et affiné **Gemma-4-E4B** sur le port 7860, évitant ainsi toute coupure de service.
  - *Mode clés API personnalisées (BYOK)* : Connectez votre propre clé API Google Gemini pour débloquer des quotas de développement plus larges et des outils génératifs cloud tels que le radar quotidien Trend Scout et la reconstruction d'images Nano Banana.
- **Abonnements et limites de garde-robe** :
  - Consultez le niveau actuel de votre compte (**Free** : limite de 50 articles de base contre **Manager** (10 \$/mois) ou **Professional** (15 \$/mois) : articles illimités).
  - **Programme du groupe de testeurs** : Les e-mails de testeurs validés (`maystarboard@gmail.com`, `lokoprod@gmail.com`, `dressapdeveloper@gmail.com`) bénéficient gracieusement du **forfait Professional** sans aucuns frais.
  - Accédez à la **page Tarifs** (`/pricing` ou cliquez sur la carte de votre offre) pour consulter le tableau comparatif, choisir une formule ou acheter des packs de crédits prépayés sans expiration.
  - Mettez à niveau votre compte via PayPal Subscriptions ou la passerelle Atzmai pour les paiements locaux en Israël en ILS (Bit / carte bancaire).
  - Copier le **lien de parrainage** : Vous rapporte +10 emplacements de garde-robe supplémentaires pour chaque proche inscrit (jusqu'à 150 articles au total).
- **Programmateur et rappels push** :
  - Activez ou désactivez les notifications de propositions matinales de tenues.
  - Définissez la fréquence (*Chaque jour*, *Un jour sur deux*, *Deux fois par semaine*, *En semaine*), l'heure (par exemple *07:00*) et les exigences de style vestimentaire (*Décontracté*, *Formel*, *Sportif*, *Personnalisé*).
  - Activez les notifications push Web VAPID sur votre navigateur.
- **Préférences de notifications de campagnes** :
  - Réglages fins pour *Push/E-mail mode locale*, *Alertes promotions*, *Mode écoresponsable*, *Offres de luxe* et *Styliste personnel*.
  - Ajustez le curseur **Distance maximale de campagne** (de 5 km à 50 km).
- **Connexion Google Calendar** : Bouton d'autorisation OAuth pour synchroniser vos événements personnels avec l'AI Stylist.
- **Carte des services de localisation** : Activez ou désactivez la géolocalisation GPS pour recevoir les recommandations d'experts à proximité et des prévisions météo hyperlocales.
- **Bouton inviter des amis** : Copiez votre lien de parrainage à partager.
- **Assistant de shopping** : Consultez les informations relatives à l'extension Chrome Web Store ou générez un **Bookmarklet universel** (`javascript:...`) pour comparer immédiatement vos tailles sur les sites d'e-commerce.

---

### 5. Actions de compte et diagnostics
- **Se déconnecter** : Fermez votre session active.
- **Supprimer mon compte** : Lien pour supprimer définitivement les données de votre compte.
- **Panneau développeur** : Console de diagnostic pour vérifier l'environnement. Authentifiée via Google OAuth (`dressapdeveloper@gmail.com`).

---

## Résultats attendus
- Synchronisation instantanée des paramètres morphologiques, du teint de peau et des photos détourées sur la toile d'essayage d'avatar 2D.
- Aucune requête réseau inutile lors de la navigation entre les onglets de configuration.
- Suggestions de tenues de l'AI Stylist personnalisées, respectant vos exigences de couvrance et votre planning.

---

## Dépannage
- **L'arrière-plan de la photo n'est pas effacé** : Vérifiez que la photo importée vous représente en entier avec un éclairage net contrastant avec le décor.
- **Les notifications push n'arrivent pas** : Vérifiez que les autorisations de notification sont accordées dans le navigateur et qu'un numéro de téléphone est renseigné sous *Contact*.
- **L'autocomplétion d'adresse ne répond pas** : Assurez-vous d'avoir une connexion Internet active pour interroger OpenStreetMap Nominatim.

---

## Limites
- La capacité de stockage du compte Free Tier est bridée à 50 pièces par défaut, sauf extension via les parrainages (+10 places par invité jusqu'à 150 pièces au maximum) ou mise à niveau vers Manager ou Professional.
- Les fonctionnalités génératives cloud à fort coût de calcul (radar Trend Scout et reconstruction photo Nano Banana) nécessitent une clé API personnelle Google Gemini fournie par l'utilisateur.
- Le mode avec clé API personnelle basculera de manière fluide vers le moteur intégré Gemma-4-E4B en cas de dépassement de quota auprès du fournisseur externe.
