# Profil, Tailles & Configuration (`/me`)

Gérez vos mesures physiques, votre teint de peau, les détourages de photos corporelles, vos préférences de style, les identifiants de modèles d'IA et les intégrations système sur votre tableau de bord de profil personnel.

## Présentation générale
La page **Profil & Paramètres** (`https://dressapp.co/me`) sert de centre de contrôle central pour votre écosystème DressApp. Elle héberge vos paramètres physiques anthropométriques, votre scène d'avatar d'essayage numérique, vos contraintes de style, vos préférences locales, vos clés de modèles d'IA et vos calendriers de notifications.

---

## Conditions préalables
- Un compte DressApp actif.
- (Facultatif) Autorisations de caméra d'appareil pour le téléchargement de photos en pied (corps entier).
- (Facultatif) Autorisations de localisation pour le ciblage des campagnes de stylistes locaux, les restrictions culturelles et les prévisions météorologiques.

---

## Guide étape par étape : Présentation de la page de haut en bas

### 1. En-tête de page & barre de navigation d'exploration
Situé en haut du tableau de bord `/me` :
- **En-tête** : Affiche le statut et le titre de votre compte.
- **Cartes d'exploration** : Raccourcis rapides vers les sections principales de l'application :
  - **Trend Scout** (`/trends`) : Affichez les flux d'actualités de mode quotidiens organisés par l'IA.
  - **Outfits** (`/outfits`) : Accédez à votre calendrier de tenues enregistrées.
  - **Experts** (`/experts`) : Parcourez les stylistes et tailleurs de mode locaux.
  - **Unpacked / Stats** (`/me/stats`) : Affichez l'évaluation de la garde-robe, les mesures du coût par port et les répartitions de couleurs.

### 2. Carte de sélection de langue et de voix
Affiché en évidence pour une accessibilité immédiate :
- **Sélecteur de langue** : Choisissez parmi 12 langues prises en charge (*français, anglais, espagnol, allemand, italien, portugais, russe, chinois, japonais, arabe, hindi, hébreu*). La sélection d'une langue met automatiquement à jour les textes de l'interface et lie le modèle de voix de synthèse vocale (TTS) régional par défaut.

---

### 3. Carte d'identité et de détails personnels (`ProfileDetailsCard`)

Contient 9 panneaux accordéons extensibles gérant votre identité personnelle, vos tailles et le rendu de votre avatar :

#### Panneau A : Identité
- **Prénom & Nom** : Champs d'identification personnelle.
- **Adresse e-mail** : Affichage en lecture seule de votre e-mail enregistré.
- **Date de naissance** : Utilisée pour personnaliser le score des tendances démographiques.
- *Badge de saisie automatique Google* : S'affiche automatiquement si votre profil a été créé via Google OAuth.

#### Panneau B : Adresse de contact & de livraison
- **Numéro de téléphone** : Requis pour recevoir des alertes SMS/Push pour les propositions quotidiennes du planificateur et les campagnes d'experts locaux.
- **Ligne d'adresse 1** : Dispose d'une saisie automatique au niveau de la rue via OpenStreetMap (Nominatim). La sélection d'une suggestion remplit automatiquement la ligne 1, la ville, la région, le code postal et le pays.
- **Ligne d'adresse 2, Ville, Région, Code postal** : Champs d'adresse manuels pour l'expédition sur le marché (marketplace).
- **Pays** : Liste déroulante hors ligne interrogeable par nom de pays ou code ISO-2.

#### Panneau C : Données démographiques
- **Sexe** : Sélectionnez *Female* (Féminin) ou *Male* (Masculin) pour configurer les mesures corporelles de base et la taxonomie des vêtements.
- **Situation familiale** : Sélectionnez *Single* (Célibataire), *Married* (Marié/e), *Divorced* (Divorcé/e) ou *Widowed* (Veuf/Veuve).
- **Profession** : Saisie de texte libre (par exemple, *Étudiant*, *Responsable marketing*, *Barista*). Alimente le classificateur de personnalisation de Trend Scout pour hiérarchiser les actualités de style pertinentes.

#### Guide résumé : Synchroniser les données de profil Google manquantes (Nouveau consentement People API)
Si vous vous êtes connecté avec Google avant que DressApp ne demande l'accès aux détails de votre profil **People API** (téléphone, adresse, sexe, date de naissance), ces champs peuvent rester vides. Vous pouvez les synchroniser en un clic :

1. **Ouvrez l'accordéon Contact ou Démographie** — vous verrez un bouton **"Sync from Google"** (icône de rafraîchissement) à côté du titre de la section.
2. **Cliquez sur "Sync from Google"** — si les autorisations People API requises n'ont pas été accordées lors de votre connexion initiale, DressApp le détecte et affiche un toast d'information : *"Google a besoin de votre autorisation pour accéder aux détails du profil. Vous allez être redirigé vers Google pour accorder l'accès."*
3. **Accordez le consentement sur l'écran de Google** — vous êtes redirigé vers l'écran de consentement OAuth de Google. Cochez les cases pour **Profile info** (nom, e-mail, photo) et **Contact info** (téléphone, adresse, sexe, anniversaire).
4. **Retour automatique & saisie automatique** — après le consentement, Google vous redirige vers DressApp. La fonction `syncGoogleProfile()` s'exécute automatiquement, appelant le point de terminaison backend `/auth/google/sync-profile` qui :
   - Récupère votre téléphone, votre adresse, votre sexe et votre date de naissance depuis l'API Google People.
   - Remplit les champs vides dans les panneaux **Contact** (téléphone, adresse) et **Démographie** (sexe, date de naissance).
   - Enregistre instantanément les mises à jour sur votre profil.
5. **Terminé** — votre profil est maintenant complet sans saisie manuelle.

> **Remarque** : Le bouton "Sync from Google" apparaît également dans l'en-tête de la page (à côté du bouton principal "Synchroniser le profil Google") et fonctionne de la même manière — il synchronise toutes les données de profil Google disponibles en même temps.

#### Panneau D : Préférences & unités de mesure
- **Unité de poids** : Basculez entre Kilogrammes (`kg`) et Livres (`lb`).
- **Unité de longueur** : Basculez entre Centimètres (`cm`) et Pouces (`in`).

#### Panneau E : Photos & scène de l'avatar numérique
- **Colonne de gauche — Sélecteurs de photos** :
  - *Photo de visage* : Téléchargez une miniature d'avatar.
  - *Photo en pied* : Téléchargez une photographie en pied (corps entier). Le système exécute automatiquement un détourage U2-Net (`rembg`) local pour supprimer l'arrière-plan.
  - *Bouton Supprimer la photo* : Suppression en un seul clic de votre détourage photo, rétablissant instantanément la scène d'essayage sur le mannequin vectoriel 2D SVG sans aucun décalage de l'interface utilisateur.
- **Colonne de droite — Avatar numérique & scène d'essayage** :
  - **Sélecteur de teint de peau** : Palette de couleurs interactive pour sélectionner le teint de peau de votre mannequin.
  - **Zone d'essayage de l'avatar** : Affiche les vêtements au-dessus de votre détourage photo ou de votre mannequin vectoriel Bezier dynamique (`DynamicAvatar.jsx`) en utilisant des décalages de repères calibrés (`top-[14.5%]` col-à-encolure et `top-[36.5%]` ceinture-à-taille).

#### Panneau F : Profil de style
- **Esthétiques** : Mots-clés de style séparés par des virgules (par exemple, *Minimalist, Streetwear, Vintage*).
- **Palette de couleurs** : Tons de couleurs préférés (par exemple, *Pastels, Earth Tones, Monochrome*).
- **À éviter** : Couleurs ou types de vêtements à exclure strictement des recommandations de l'IA (par exemple, *Yellow, Crop Tops*).
- **Conservatisme culturel des vêtements** : Sélectionnez le niveau de pudeur (*Casual/Relaxed*, *Moderate*, *Conservative*) pour guider la couverture des tenues suggérées par l'AI Stylist.

#### Panneau G : Mesures corporelles & tailles (ANSUR II Sizing Predictor)
- **Mode Onboarding / Nouveau départ** : Entrez 4 données de base : **Height** (Taille), **Weight** (Poids), **Waist** (Tour de taille) et **Foot Length** (Longueur du pied). Le modèle de régression multi-sorties scikit-learn ANSUR II intégré prédit automatiquement 6 mesures structurelles :
  - *Épaules*, *Poitrine / Buste*, *Hanches*, *Longueur des manches*, *Entrejambe (Inseam)* et *Longueur extérieure (Outseam)*.
- **Traduction automatique des tailles** : Une fois les mesures structurelles prédites, des algorithmes de dimensionnement déterministes remplissent instantanément **toutes les tailles de vente au détail standard** jusqu'à la taille des chaussures :
  - *Taille de chemise décontractée* (XS–XXL basée sur le tour de poitrine).
  - *Taille de pantalon* (pouces, convertie à partir du tour de taille en cm).
  - *Taille de chaussures US* (formules hommes/femmes basées sur la longueur du pied).
  - *Taille de robe pour femmes* (US 0–14+ basée sur la taille).
  - *Taille de soutien-gorge pour femmes* (bande + bonnet calculés à partir du tour de poitrine/sous-poitrine).
- **Mode d'édition détaillé** : Après le remplissage automatique, ajustez les 15 paramètres de taille (y compris la taille de la chemise, la taille du pantalon, la taille des chaussures, la taille du soutien-gorge, la taille de la robe) et les attributs des cheveux (*Longueur, Type, Couleur, Style*).
- **Bascule d'unité en direct** : Basculez entre *kg/cm* et *lb/in* — toutes les valeurs se convertissent instantanément sans nouvelle prédiction.

#### Panneau H : Enregistrement dans l'annuaire des professionnels et des experts
- **Bouton d'activation Styliste professionnel** : Enregistrez-vous en tant que professionnel de la mode vérifié (stylist, tailleur, designer).
- **Détails de l'entreprise** : Saisissez le nom de l'entreprise, l'adresse, le téléphone, l'e-mail, le site Web et la description pour apparaître dans l'annuaire `/experts` et le ticker des campagnes régionales.

#### Panneau I : Paramètres de paiement PayPal
- **E-mail du destinataire PayPal** : Saisissez votre adresse e-mail PayPal pour recevoir les paiements des ventes du marché et des campagnes d'experts actives.

---

### 4. Carte d'accordéon des préférences système

Gère les paramètres au niveau du système, les abonnements et les intégrations d'IA :

- **Configuration de l'IA** :
  - *Mode standard* : Utilise les points de terminaison Gemini Flash 2.x gérés par le système.
  - *Mode Clés API personnalisées* : Connectez des clés API personnalisées Google Gemini, Anthropic, OpenAI ou DeepSeek via un modal de configuration guidé.
- **Abonnement & limites de la garde-robe** :
  - Affichez le niveau de compte actuel (**Free** : limite de 50 éléments vs **Manager** ou **Professional** : éléments illimités).
  - Accédez à la **page des tarifs** (`/pricing` ou cliquez sur la carte de votre plan) pour afficher le tableau de comparaison des niveaux, sélectionner un plan et vous abonner.
  - Mettez à niveau via l'API REST de PayPal Subscriptions (Manager : 4,99 $/mois ; Professional : 9,99 $/mois) ou la passerelle Atzmai pour les transactions locales en ILS.
  - Copier le **lien de parrainage** : Accorde +10 emplacements de capacité de garde-robe pour chaque ami qui s'inscrit (jusqu'à un maximum de 200 éléments).
- **Planificateur & rappels push** :
  - Activez/désactivez les notifications quotidiennes de propositions de tenues le matin.
  - Définissez la fréquence (*Tous les jours*, *Un jour sur deux*, *Deux fois par semaine*, *En semaine*), l'heure (par exemple, *07:00*) et les exigences de style de code vestimentaire (*Casual*, *Formal*, *Athletic*, *Custom*).
  - Activez les alertes push VAPID du navigateur.
- **Préférences de notifications de campagne** :
  - Boutons d'activation granulaires pour *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos* et *Personal Stylist*.
  - Ajustez le curseur de **distance maximale de la campagne** (5 km à 50 km).
- **Connexion Google Calendar** : Bouton OAuth pour synchroniser les événements du calendrier personnel avec l'AI Stylist.
- **Carte des services de localisation** : Activez les autorisations de localisation GPS pour les flux d'experts adaptés à la distance et la météo locale.
- **Bouton Inviter des amis** : Copiez le lien de parrainage partageable.
- **Assistant de shopping** : Accédez aux détails de l'extension Chrome Web Store ou générez un **Universal Bookmarklet** (`javascript:...`) pour des comparaisons de tailles instantanées sur les sites d'e-commerce.

---

### 5. Actions de compte & diagnostics
- **Se déconnecter** : Déconnectez-vous de votre session actuelle.
- **Supprimer mon compte** : Lien pour purger définitivement les données du compte.
- **Panneau de développement** : Accordéon de diagnostic pour les tests d'environnement.

---

## Résultats attendus
- Synchronisation instantanée des mesures physiques, du teint de la peau et des détourages photo sur la zone d'essayage de l'avatar 2D.
- Aucune requête réseau inactive lors de la navigation entre les panneaux de paramètres.
- Propositions de tenues AI Stylist personnalisées alignées sur vos règles de pudeur et votre calendrier.

---

## Dépannage
- **L'arrière-plan de la photo n'est pas supprimé** : Assurez-vous que votre photo téléchargée est en pied (corps entier) avec un éclairage d'arrière-plan contrasté.
- **Les alertes push n'arrivent pas** : Confirmez que les autorisations de notification du navigateur sont activées et qu'un numéro de téléphone est enregistré sous *Contact*.
- **La saisie automatique de l'adresse ne répond pas** : Vérifiez que la connexion Internet est active pour les requêtes OpenStreetMap Nominatim.

---

## Limitations
- L'espace de compte de niveau gratuit est limité à 50 éléments, sauf s'il est augmenté via un bonus de parrainage (+10 emplacements par invitation jusqu'à un maximum de 200 éléments) ou une mise à niveau vers le niveau Manager ou Professional.
- Le mode clé API personnalisée nécessite des clés valides avec un quota restant du fournisseur respectif.
