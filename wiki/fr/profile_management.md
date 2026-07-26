# Gestion de Profil, Tailles et Configuration (`/me`)

Gérez les mesures corporelles, le teint, les découpes photo du corps, les préférences de style, les identifiants des modèles IA et les intégrations système sur votre tableau de bord de profil personnel.

## Vue d'ensemble
La page **Profil et Paramètres** (`https://dressapp.co/me`) sert de centre de contrôle central pour votre écosystème DressApp. Elle héberge vos paramètres anthropométriques physiques, la scène d'avatar numérique d'essayage virtuel, les contraintes de style, les préférences localisées, les clés de modèles IA et les programmations de notifications push.

---

## Prérequis
- Un compte DressApp actif.
- (Optionnel) Permissions caméra de l'appareil pour le téléchargement de photo corps entier.
- (Optionnel) Permissions de localisation pour le ciblage des campagnes de stylistes locaux et la météo.

---

## Guide Étape par Étape : Vue d'Ensemble de la Page de Haut en Bas

### 1. Barre de Navigation et d'Exploration de l'En-tête de Page
Située en haut du tableau de bord `/me` :
- **En-tête** : Affiche le statut de votre compte et votre titre.
- **Cartes d'Exploration** : Raccourcis rapides vers les sections principales de l'app :
  - **Eclaireur de Tendances** (`/trends`) : Voir les flux d'actualités mode quotidiens curatés par IA.
  - **Tenues** (`/outfits`) : Accéder à votre calendrier de tenues sauvegardées.
  - **Experts** (`/experts`) : Parcourir les stylistes et tailleurs locaux.
  - **Unpacked / Statistiques** (`/me/stats`) : Voir l'évaluation de garde-robe, métriques coût-par-port et répartitions couleur.

### 2. Carte de Sélection de Langue et Voix
Affichée en évidence pour une accessibilité immédiate :
- **Sélecteur de Langue** : Choisissez parmi 12 langues supportées (*Anglais, Espagnol, Français, Allemand, Italien, Portugais, Russe, Chinois, Japonais, Arabe, Hindi, Hébreu*). La sélection met à jour automatiquement la locale de l'UI et lie le modèle de voix Text-to-Speech (TTS) régional par défaut.

---

### 3. Carte d'Identité et Détails Personnels (`ProfileDetailsCard`)

Contient 9 panneaux accordéon dépliables gérant votre identité personnelle, tailles et rendu d'avatar :

#### Panneau A : Identité
- **Prénom et Nom** : Champs d'identification personnelle.
- **Adresse Email** : Affichage en lecture seule de votre email enregistré.
- **Date de Naissance** : Utilisée pour personnaliser le scoring de tendances démographiques.
- *Badge de Remplissage Auto Google* : S'affiche automatiquement si votre profil a été créé via Google OAuth.

#### Panneau B : Contact et Adresse de Livraison
- **Numéro de Téléphone** : Requis pour recevoir alertes SMS/Push pour propositions du planificateur quotidien et campagnes d'experts locaux.
- **Ligne d'Adresse 1** : Autocomplétion rue via OpenStreetMap (Nominatim). Sélectionner une suggestion remplit automatiquement Ligne 1, Ville, Région, Code Postal et Pays.
- **Ligne d'Adresse 2, Ville, Région, Code Postal** : Champs manuels pour expédition marketplace.
- **Pays** : Combo box hors ligne searchable par nom de pays ou code ISO-2.

#### Panneau C : Démographie
- **Sexe** : Sélectionnez *Femme* ou *Homme* pour configurer les mesures de base du corps et la taxonomie vestimentaire.
- **Statut Personnel** : Sélectionnez *Célibataire*, *Marié*, *Divorcé* ou *Veuf*.
- **Profession** : Saisie libre (ex. *Étudiant*, *Directeur Marketing*, *Barista*). Alimente le rankeur de personnalisation Trend Scout pour prioriser les actualités style pertinentes.

#### Guide Résumé : Synchroniser les Données Manquantes du Profil Google (Re-consentement People API)
Si vous vous êtes connecté avec Google avant que DressApp ne demande l'accès aux détails de votre profil **People API** (téléphone, adresse, sexe, date de naissance), ces champs peuvent rester vides. Vous pouvez les synchroniser en un clic :

1. **Ouvrez l'accordéon Contact ou Démographie** — vous verrez un bouton **"Synchroniser depuis Google"** (icône de rafraîchissement) à côté du titre de la section.
2. **Cliquez sur "Synchroniser depuis Google"** — si les scopes People API requis n'ont pas été accordés lors de votre connexion initiale, DressApp le détecte et affiche un toast info : *"Google a besoin de votre permission pour accéder aux détails du profil. Vous serez redirigé vers Google pour accorder l'accès."*
3. **Accordez le consentement sur l'écran de Google** — vous êtes redirigé vers l'écran de consentement OAuth de Google. Cochez les cases pour **Infos de profil** (nom, email, photo) et **Infos de contact** (téléphone, adresse, sexe, anniversaire).
4. **Retour automatique et remplissage auto** — après consentement, Google vous redirige vers DressApp. La fonction `syncGoogleProfile()` s'exécute automatiquement, appelant l'endpoint backend `/auth/google/sync-profile` qui :
   - Récupère votre téléphone, adresse, sexe et date de naissance depuis Google People API
   - Remplit les champs vides dans les panneaux **Contact** (téléphone, adresse) et **Démographie** (sexe, date de naissance)
   - Sauvegarde les mises à jour sur votre profil instantanément
5. **Terminé** — votre profil est maintenant complet sans saisie manuelle.

> **Note** : Le bouton "Synchroniser depuis Google" apparaît aussi dans l'en-tête de page (à côté du bouton principal "Synchroniser Profil Google") et fonctionne de la même façon — il synchronise toutes les données de profil Google disponibles d'un coup.

#### Panneau D : Préférences et Unités de Mesure
- **Unité de Poids** : Basculer entre Kilogrammes (`kg`) et Livres (`lb`).
- **Unité de Longueur** : Basculer entre Centimètres (`cm`) et Pouces (`in`).

#### Panneau E : Photos et Scène d'Avatar Numérique
- **Colonne Gauche — Sélecteurs de Photo** :
  - *Photo de Visage* : Téléverser une miniature d'avatar.
  - *Photo Corps Entier* : Téléverser une photo corps entier. Le système exécute automatiquement le matting U2-Net local (`rembg`) pour supprimer l'arrière-plan.
  - *Bouton Supprimer Photo* : Suppression en un clic de votre découpe photo, basculant instantanément la scène d'essayage vers le mannequin vectoriel SVG 2D sans lag UI.
- **Colonne Droite — Avatar Digital et Scène d'Essayage** :
  - **Sélecteur de Teint** : Palette de couleurs interactive pour sélectionner le teint de votre mannequin.
  - **Canvas d'Essayage Avatar** : Affiche les vêtements sur votre découpe photo ou mannequin vectoriel Bézier dynamique (`DynamicAvatar.jsx`) en utilisant des décalages de points de repère calibrés (`top-[14.5%]` encolure-à-encolure et `top-[36.5%]` taille-à-taille).

#### Panneau F : Profil de Style
- **Esthétiques** : Mots-clés de style séparés par virgules (ex. *Minimaliste, Streetwear, Vintage*).
- **Palette de Couleurs** : Tons de couleur préférés (ex. *Pastels, Tons Terre, Monochrome*).
- **À Éviter** : Couleurs ou types de vêtements à exclure strictement des recommandations IA (ex. *Jaune, Crop Tops*).
- **Conservatisme Vestimentaire Culturel** : Sélectionnez le niveau de pudeur (*Décontracté/Relaxé*, *Modéré*, *Conservateur*) pour guider la couverture des tenues du Styliste IA.

#### Panneau G : Mensurations Corporelles et Tailles (Prédicteur Tailles ANSUR II)
- **Mode Onboarding / Nouveau Départ** : Entrez 4 entrées de base : **Taille**, **Poids**, **Tour de Taille** et **Longueur de Pied**. Le modèle de régression multi-sortie ANSUR II scikit-learn intégré prédit automatiquement 6 mesures structurelles :
  - *Épaules*, *Poitrine/Buste*, *Hanches*, *Longueur de Manche*, *Entrejambe* et *Longueur Extérieure*.
- **Traduction Automatique des Tailles** : Une fois les mesures structurelles prédites, des algorithmes de tailles déterministes remplissent instantanément **toutes les tailles retail standard** jusqu'à la pointure :
  - *Taille Chemise Décontractée* (XS–XXL basée sur tour de poitrine)
  - *Taille Ceinture Pantalon* (pouces, convertie de cm taille)
  - *Pointure US* (Formules Homme/Femme depuis longueur de pied)
  - *Taille Robe Femme* (US 0–14+ basée sur taille)
  - *Taille Soutien-Gorge Femme* (bande + bonnet calculés de buste/sous-buste)
- **Mode Édition Détaillée** : Après le remplissage auto, affinez les 15 paramètres de taille (incl. Taille Chemise, Taille Pantalon, Pointure, Taille Soutien-Gorge, Taille Robe) et attributs cheveux (*Longueur, Type, Couleur, Style*).
- **Basculement d'Unités en Direct** : Basculez entre *kg/cm* et *lb/in* — toutes les valeurs se convertissent instantanément sans re-prédiction.

#### Panneau H : Inscription Annuaire Professionnel et Experts
- **Basculement Styliste Professionnel** : Enregistrez-vous comme professionnel de mode vérifié (styliste, tailleur, designer).
- **Détails Entreprise** : Saisissez Nom Entreprise, Adresse, Téléphone, Email, Site Web et Description pour apparaître dans l'annuaire `/experts` et le ticker de campagnes régionales.

#### Panneau I : Paramètres de Paiement PayPal
- **Email Récepteur PayPal** : Entrez votre email PayPal pour recevoir les paiements des ventes marketplace et campagnes d'experts actifs.

---

### 4. Carte Accordéon Préférences Système

Gère les paramètres niveau système, abonnements et intégrations IA :

- **Configuration IA** :
  - *Mode Standard* : Utilise les endpoints Gemini Flash 2.x gérés par le système.
  - *Mode Clés API Personnalisées* : Connectez clés API personnalisées Google Gemini, Anthropic, OpenAI ou DeepSeek via un modal de configuration guidée.
- **Abonnement et Limites Garde-Robe** :
  - Voir le niveau de compte actuel (**Gratuit** : limite 150 articles vs **Pro** : Articles illimités).
  - Mettre à niveau via PayPal Subscriptions REST API (4,99€/mois ou 29,99€/an).
  - Copier **Lien de Parrainage** : Accorde +10 emplacements capacité garde-robe par ami inscrit.
- **Planificateur et Rappels Push** :
  - Basculer notifications propositions tenues matinales.
  - Définir fréquence (*Quotidien*, *Un jour sur deux*, *Deux fois par semaine*, *En semaine*), heure (ex. *07:00*) et exigences code vestimentaire (*Décontracté*, *Formel*, *Sportif*, *Personnalisé*).
  - Activer alertes push VAPID navigateur.
- **Préférences Notifications Campagne** :
  - Bascules granulaires pour *Push/Email Mode Locale*, *Alertes Soldes*, *Mode Durable*, *Promos Luxe* et *Styliste Personnel*.
  - Ajuster slider **Distance Max Campagne** (5km à 50km).
- **Connecter Google Calendar** : Bouton OAuth pour synchroniser événements calendrier personnel avec le Styliste IA.
- **Carte Services de Localisation** : Basculer permissions GPS pour flux experts par distance et météo hyperlocale.
- **Bouton Inviter Amis** : Copier lien de parrainage partageable.
- **Assistant Shopping** : Accéder détails extension Chrome Web Store ou générer **Bookmarklet Universel** (`javascript:...`) pour comparaisons instantanées tailles e-commerce.

---

### 5. Actions Compte et Diagnostic
- **Déconnexion** : Se déconnecter de la session actuelle.
- **Supprimer mon Compte** : Lien pour purger définitivement les données du compte.
- **Panneau Développeur** : Accordéon diagnostic pour tests d'environnement.

---

## Résultats Attendus
- Synchronisation instantanée des métriques physiques, teint et découpes photo sur le Canvas d'Essayage Avatar 2D.
- Zéro requêtes réseau inactives lors de la navigation entre panneaux de paramètres.
- Propositions tenues personnalisées du Styliste IA alignées avec vos règles de pudeur et planning.

---

## Dépannage
- **Arrière-plan photo non supprimé** : Assurez-vous que votre photo téléversée est corps entier avec éclairage de fond contrasté.
- **Alertes push non reçues** : Confirmez que les permissions notifications navigateur sont activées et un numéro de téléphone est sauvegardé sous *Contact*.
- **Autocomplétion adresse ne répond pas** : Vérifiez que la connexion internet est active pour les requêtes OpenStreetMap Nominatim.

---

## Limitations
- Compte niveau gratuit limité à 150 articles sauf extension via bonus parrainage (+10 slots par invitation) ou abonnement Pro.
- Mode clé API personnalisée nécessite clés valides avec quota restant du fournisseur respectif.

(Fichier terminé)