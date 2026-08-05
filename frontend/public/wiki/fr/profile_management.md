# Profil, Tailles et Configuration (`/me`)

Gérez les mesures corporelles, le teint, les découpes de photos corps entier, les préférences de style, les identifiants des modèles IA et les intégrations système sur votre tableau de bord personnel.

## Aperçu
La page **Profil et Paramètres** (`https://dressapp.co/me`) sert de centre de contrôle central pour votre écosystème DressApp. Elle héberge vos paramètres anthropométriques physiques, la scène d'avatar d'essayage numérique, les contraintes de style, les préférences localisées, les clés des modèles IA et les plannings de notifications push.

---

## Prérequis
- Un compte DressApp actif.
- (Optionnel) Autorisations caméra de l'appareil pour téléchargement photo corps entier.
- (Optionnel) Autorisations de localisation pour ciblage campagnes stylistes locaux et météo.

---

## Guide Étape par Étape : Vue d'Ensemble de la Page de Haut en Bas

### 1. En-tête de Page et Barre de Navigation Explorer
Situé en haut du tableau de bord `/me` :
- **En-tête** : Affiche le statut et le titre de votre compte.
- **Cartes Explorer** : Raccourcis rapides vers les sections principales de l'app :
  - **Trend Scout** (`/trends`) : Voir les flux d'actualités mode quotidiens curatés par IA.
  - **Tenues** (`/outfits`) : Accéder à votre calendrier de tenues sauvegardées.
  - **Experts** (`/experts`) : Parcourir les stylistes et tailleurs mode locaux.
  - **Unpacked / Statistiques** (`/me/stats`) : Voir l'évaluation garde-robe, métriques coût-par-port et répartitions couleurs.

### 2. Carte de Sélection Langue et Voix
Affichée en évidence pour accessibilité immédiate :
- **Sélecteur de Langue** : Choisissez parmi 12 langues supportées (*Anglais, Espagnol, Français, Allemand, Italien, Portugais, Russe, Chinois, Japonais, Arabe, Hindi, Hébreu*). Sélectionner une langue met à jour automatiquement la locale UI et lie le modèle vocal Text-to-Speech (TTS) régional par défaut.

---

### 3. Carte Identité et Détails Personnels (`ProfileDetailsCard`)

Contient 9 panneaux accordéon dépliables gérant votre identité personnelle, tailles et rendu avatar :

#### Panneau A : Identité
- **Prénom et Nom** : Champs d'identification personnelle.
- **Adresse Email** : Affichage en lecture seule de votre email enregistré.
- **Date de Naissance** : Utilisée pour personnaliser le scoring tendances démographiques.
- *Badge Remplissage Auto Google* : S'affiche automatiquement si votre profil a été créé via Google OAuth.

#### Panneau B : Contact et Adresse de Livraison
- **Numéro de Téléphone** : Requis pour recevoir alertes SMS/Push propositions planificateur quotidien et campagnes experts locaux.
- **Ligne d'Adresse 1** : Autocomplétion niveau rue OpenStreetMap (Nominatim). Sélectionner une suggestion remplit automatiquement Ligne 1, Ville, Région, Code Postal et Pays.
- **Ligne d'Adresse 2, Ville, Région, Code Postal** : Champs adresse manuels pour livraison marketplace.
- **Pays** : Combobox hors-ligne rechercheable par nom de pays ou code ISO-2.

#### Panneau C : Démographie
- **Sexe** : Sélectionnez *Femme* ou *Homme* pour configurer mesures corporelles de base et taxonomie vêtements.
- **Statut Personnel** : Sélectionnez *Célibataire*, *Marié*, *Divorcé* ou *Veuf*.
- **Profession** : Saisie libre (ex. *Étudiant*, *Responsable Marketing*, *Barista*). Alimente le rankeur personnalisation Trend Scout pour prioriser actualités style pertinentes.

#### Panneau D : Préférences et Unités de Mesure
- **Unité de Poids** : Basculer entre Kilogrammes (`kg`) et Livres (`lb`).
- **Unité de Longueur** : Basculer entre Centimètres (`cm`) et Pouces (`in`).

#### Panneau E : Photos et Scène Avatar Numérique
- **Colonne Gauche — Sélecteurs Photo** :
  - *Photo Visage* : Télécharger miniature avatar.
  - *Photo Corps Entier* : Télécharger photo corps entier. Le système exécute automatiquement le matting U2-Net local (`rembg`) pour supprimer l'arrière-plan.
  - *Bouton Supprimer Photo* : Suppression en un clic de votre découpe photo, basculant instantanément la scène d'essayage vers le mannequin vectoriel SVG 2D sans latence UI.
- **Colonne Droite — Avatar Numérique et Scène d'Essayage** :
  - **Sélecteur Teint de Peau** : Palette couleurs interactive pour sélectionner le teint du mannequin.
  - **Canevas Essayage Avatar** : Rend les vêtements sur votre découpe photo ou mannequin vectoriel Bézier dynamique (`DynamicAvatar.jsx`) avec offsets points de repère calibrés (`top-[14.5%]` col-à-encolure et `top-[36.5%]` ceinture-à-taille).

#### Panneau F : Profil de Style
- **Esthétiques** : Mots-clés style séparés par virgules (ex. *Minimaliste, Streetwear, Vintage*).
- **Palette de Couleurs** : Tons de couleur préférés (ex. *Pastels, Tons Terre, Monochrome*).
- **À Éviter** : Couleurs ou types vêtements à exclure strictement des recommandations IA (ex. *Jaune, Crops Tops*).
- **Conservatisme Vestimentaire Culturel** : modestie level (*Décontracté/Relaxé*, *Modéré*, *Conservateur*) pour guider la couverture tenues Styliste IA.

#### Panneau G : Mesures Corporelles et Tailles (Prédicteur Tailles ANSUR II)
- **Mode Onboarding / Nouveau Départ** : Entrez 4 entrées de base : **Taille**, **Poids**, **Tour de Taille** et **Longueur du Pied**. Le modèle de régression multi-sortie ANSUR II scikit-learn intégré prédit automatiquement 6 mesures structurelles :
  - *Épaules*, *Poitrine/Buste*, *Hanches*, *Longueur Manche*, *Entrejambe* et *Longueur Extérieure*.
- **Traduction Automatique des Tailles** : Une fois les mesures structurelles prédites, des algorithmes déterministes de tailles peuplent **toutes les tailles retail standard** instantanément jusqu'à la pointure :
  - *Taille Chemise Décontractée* (XS–XXL basée sur tour de poitrine)
  - *Taille Taille Pantalon* (pouces, convertie de taille cm)
  - *Pointure US* (Formules Homme/Femme depuis longueur pied)
  - *Taille Robe Femme* (US 0–14+ basée sur taille)
  - *Taille Soutien-gorge Femme* (bande + bonnet calculés de buste/sous-buste)
- **Mode Édition Détaillée** : Après auto-remplissage, affinez les 15 paramètres de taille (y compris Taille Chemise, Taille Pantalon, Pointure, Taille Soutien-gorge, Taille Robe) et attributs cheveux (*Longueur, Type, Couleur, Style*).
- **Basculement Unités en Direct** : Basculer entre *kg/cm* et *lb/in* — toutes les valeurs se convertissent instantanément sans re-prédiction.

#### Panneau H : Inscription Annuaire Professionnels et Experts
- **Basculement Styliste Professionnel** : Inscrivez-vous comme professionnel mode vérifié (styliste, tailleur, designer).
- **Détails Entreprise** : Saisissez Nom Entreprise, Adresse, Téléphone, Email, Site Web et Description pour apparaître dans l'annuaire `/experts` et ticker campagnes régionales.

#### Panneau I : Paramètres Paiement PayPal
- **Email Récepteur PayPal** : Entrez votre email PayPal pour recevoir paiements ventes marketplace et campagnes experts actives.

---

### 4. Carte Accordéon Préférences Système

Gère les paramètres niveau système, abonnements et intégrations IA :

- **Configuration IA** :
  - *Mode Standard* : Utilise endpoints Gemini Flash 2.x gérés par le système.
  - *Mode Clés API Personnalisées* : Connectez vos propres clés Google Gemini, Anthropic, OpenAI ou DeepSeek API via modal configuration guidée.
- **Abonnement et Limites Garde-Robe** :
  - Voir niveau compte actuel (**Gratuit** : limite 150 articles vs **Pro** : Articles illimités).
  - Mettre à niveau via PayPal Subscriptions REST API (4,99 €/mois ou 29,99 €/an).
  - Copier **Lien de Parrainage** : Accorde +10 emplacements capacité garde-robe par ami inscrit.
- **Planificateur et Rappels Push** :
  - Basculer notifications propositions tenue matinales.
  - Définir fréquence (*Quotidien*, *Un Jour sur Deux*, *Deux Fois par Semaine*, *En Semaine*), heure (ex. *07:00*) et exigences code vestimentaire (*Décontracté*, *Formel*, *Sportif*, *Personnalisé*).
  - Activer alertes push VAPID navigateur.
- **Préférences Notifications Campagnes** :
  - Bascules granulaires pour *Push/Email Mode Locale*, *Alertes Soldes*, *Mode Durable*, *Promos Luxe* et *Styliste Personnel*.
  - Ajuster curseur **Distance Max Campagne** (5km à 50km).
- **Connexion Google Calendar** : Bouton OAuth pour synchroniser événements calendrier personnel avec Styliste IA.
- **Carte Services de Localisation** : Basculer permissions GPS pour flux experts par distance et météo hyper-locale.
- **Bouton Inviter Amis** : Copier lien parrainage partageable.
- **Assistant Achats** : Accéder détails extension Chrome Web Store ou générer **Signet Universel** (`javascript:...`) pour comparaisons instantanées tailles e-commerce.

---

### 5. Actions Compte et Diagnostic
- **Se Déconnecter** : Quitter votre session actuelle.
- **Supprimer mon Compte** : Lien pour purger données compte définitivement.
- **Panneau Développeur** : Accordéon diagnostic pour tests environnement.

---

## Résultats Attendus
- Synchronisation instantanée métriques physiques, teint et découpes photo sur canevas essayage Avatar 2D.
- Zéro requêtes réseau inactives en naviguant entre panneaux paramètres.
- Propositions tenues Styliste IA personnalisées alignées avec vos règles modestie et planning.

---

## Dépannage
- **Arrière-plan photo non supprimé** : Assurez-vous que votre photo téléchargée est corps entier avec éclairage arrière-plan contrasté.
- **Alertes push non reçues** : Confirmez que permissions notifications navigateur sont activées et numéro téléphone sauvegardé sous *Contact*.
- **Autocomplétion adresse ne répond pas** : Vérifiez que connexion internet est active pour requêtes OpenStreetMap Nominatim.

---

## Limitations
- Espace compte niveau gratuit plafonné à 150 articles sauf expansion via bonus parrainage (+10 emplacements par invitation) ou abonnement Pro.
- Mode clé API personnalisée requiert clés valides avec quota restant du fournisseur respectif.

(Fichier terminé)