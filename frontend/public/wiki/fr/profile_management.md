Voici la traduction du document DressApp en français, en respectant toutes les règles spécifiées :

# Profil, Tailles et Configuration (`/me`)

Gérez vos mesures physiques, votre teint de peau, le détourage de photos corporelles, vos préférences de style, les identifiants des modèles d'IA et les intégrations système sur le tableau de bord de votre profil personnel.

## Aperçu
La page **Profil et Paramètres** (`https://dressapp.co/me`) est le centre de contrôle principal de votre écosystème DressApp. Elle regroupe vos paramètres anthropométriques physiques, la scène d'avatar d'essayage numérique, les contraintes de style, les préférences localisées, les clés de modèle d'IA et les planifications de notifications push.

---

## Prérequis
- Un compte DressApp actif.
- (Facultatif) Autorisations d'accès à la caméra de l'appareil pour le téléchargement de photos plein corps.
- (Facultatif) Autorisations d'accès à la localisation pour le ciblage des campagnes de stylistes locaux et les prévisions météorologiques.

---

## Guide étape par étape : Aperçu de la page de haut en bas

### 1. En-tête de page et barre de navigation Explore
Situé en haut du tableau de bord `/me` :
- **En-tête** : Affiche le statut de votre compte et votre titre.
- **Cartes Explore** : Raccourcis rapides vers les sections principales de l'application :
  - **Trend Scout** (`/trends`) : Affichez les fils d'actualités de mode quotidiens, organisés par l'IA.
  - **Tenues** (`/outfits`) : Accédez à votre calendrier de tenues sauvegardées.
  - **Experts** (`/experts`) : Parcourez les stylistes et tailleurs de mode locaux.
  - **Déballé / Stats** (`/me/stats`) : Affichez l'évaluation de la garde-robe, les métriques de coût par utilisation et les ventilations par couleur.

### 2. Carte de sélection de la langue et de la voix
Affiché en évidence pour une accessibilité immédiate :
- **Sélecteur de langue** : Choisissez parmi 12 langues prises en charge (*English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi, Hebrew*). La sélection d'une langue met automatiquement à jour le UI locale et lie le modèle de voix Text-to-Speech (TTS) régional par défaut.

---

### 3. Carte d'identité et de détails personnels (`ProfileDetailsCard`)

Contient 9 panneaux accordéons extensibles gérant votre identité personnelle, vos tailles et le rendu de votre avatar :

#### Panneau A : Identité
- **Prénom et Nom** : Champs d'identification personnelle.
- **Adresse e-mail** : Affichage en lecture seule de votre e-mail enregistré.
- **Date de naissance** : Utilisée pour personnaliser le demographic trend scoring.
- *Badge Google Autofill* : S'affiche automatiquement si votre profil a été initialisé via Google OAuth.

#### Panneau B : Coordonnées et adresse de livraison
- **Numéro de téléphone** : Requis pour recevoir les alertes SMS/Push pour les propositions de planification quotidiennes et les campagnes d'experts locaux.
- **Ligne d'adresse 1** : Comprend l'autocomplete de niveau de rue OpenStreetMap (Nominatim). La sélection d'une suggestion remplit automatiquement la Ligne 1, la Ville, la Région, le Code postal et le Pays.
- **Ligne d'adresse 2, Ville, Région, Code postal** : Champs d'adresse manuels pour l'expédition via le marketplace.
- **Pays** : Combobox hors ligne consultable par nom de pays ou code ISO-2.

#### Panneau C : Données démographiques
- **Sexe** : Sélectionnez *Femme* ou *Homme* pour configurer les mesures corporelles de base et la clothing taxonomy.
- **Situation personnelle** : Sélectionnez *Célibataire*, *Marié(e)*, *Divorcé(e)* ou *Veuf/Veuve*.
- **Profession** : Saisie de texte libre (par exemple, *Étudiant(e)*, *Marketing Manager*, *Barista*). Alimente le Trend Scout personalization ranker pour prioriser les actualités de style pertinentes.

#### Guide récapitulatif : Synchronisation des données manquantes du profil Google (re-consentement People API)
Si vous vous êtes connecté avec Google avant que DressApp ne demande l'accès à vos détails de profil **People API** (téléphone, adresse, sexe, date de naissance), ces champs peuvent rester vides. Vous pouvez les synchroniser en un seul clic :

1.  **Ouvrez l'accordéon Contact ou Données démographiques** — vous verrez un bouton **"Synchroniser depuis Google"** (icône d'actualisation) à côté du titre de la section.
2.  **Cliquez sur "Synchroniser depuis Google"** — si les People API scopes requis n'ont pas été accordés lors de votre connexion initiale, DressApp le détecte et affiche un info toast : *"Google a besoin de votre permission pour accéder aux détails du profil. Vous serez redirigé vers Google pour accorder l'accès."*
3.  **Donnez votre consentement sur l'écran de Google** — vous êtes redirigé vers l'écran de consentement OAuth de Google. Cochez les cases pour **Profile info** (nom, e-mail, photo) et **Contact info** (téléphone, adresse, sexe, date de naissance).
4.  **Retour automatique et remplissage automatique** — après le consentement, Google vous redirige vers DressApp. La fonction `syncGoogleProfile()` s'exécute automatiquement, appelant le backend `/auth/google/sync-profile` endpoint qui :
    -   Récupère votre téléphone, adresse, sexe et date de naissance depuis Google People API
    -   Rempli les champs vides dans les panneaux **Contact** (téléphone, adresse) et **Données démographiques** (sexe, date de naissance)
    -   Enregistre instantanément les mises à jour de votre profil
5.  **Terminé** — votre profil est maintenant complet sans saisie manuelle.

> **Note** : Le bouton "Synchroniser depuis Google" apparaît également dans l'en-tête de la page (à côté du bouton principal "Synchroniser le profil Google") et fonctionne de la même manière — il synchronise toutes les données de profil Google disponibles en une seule fois.

#### Panneau D : Préférences et unités de mesure
- **Unité de poids** : Basculez entre les Kilogrammes (`kg`) et les Livres (`lb`).
- **Unité de longueur** : Basculez entre les Centimètres (`cm`) et les Pouces (`in`).

#### Panneau E : Photos et scène d'avatar numérique
- **Colonne de gauche — Sélecteurs de photos** :
  - *Photo de visage* : Téléchargez une miniature d'avatar.
  - *Photo plein corps* : Téléchargez une photo plein corps. Le système exécute automatiquement le matting local U2-Net (`rembg`) pour supprimer l'arrière-plan.
  - *Bouton Supprimer la photo* : Suppression en un clic de votre photo détourée, rétablissant instantanément la scène d'essayage sur le 2D SVG vector mannequin sans aucun UI lag.
- **Colonne de droite — Avatar numérique et scène d'essayage** :
  - **Sélecteur de teint de peau** : Palette de couleurs interactive pour sélectionner le teint de peau de votre mannequin.
  - **Canvas d'essayage d'avatar** : Rend les garments sur votre photo détourée ou votre Bezier vector mannequin dynamique (`DynamicAvatar.jsx`) en utilisant des landmark offsets calibrés (`top-[14.5%]` collar-to-neckline et `top-[36.5%]` waistband-to-waistline).

#### Panneau F : Profil de style
- **Esthétique** : Mots-clés de style séparés par des virgules (par exemple, *Minimalist, Streetwear, Vintage*).
- **Palette de couleurs** : Tons de couleurs préférés (par exemple, *Pastels, Earth Tones, Monochrome*).
- **Éviter** : Couleurs ou types de vêtements à exclure strictement des recommandations de l'IA (par exemple, *Yellow, Crop Tops*).
- **Conservatisme vestimentaire culturel** : Sélectionnez le niveau de modestie (*Casual/Relaxed*, *Moderate*, *Conservative*) pour guider la couverture des tenues de l'AI Stylist.

#### Panneau G : Mesures corporelles et tailles (prédicteur de tailles ANSUR II)
- **Mode d'accueil / Nouveau départ** : Saisissez 4 entrées de base : **Taille**, **Poids**, **Tour de taille** et **Longueur du pied**. Le scikit-learn ANSUR II multi-output regression model intégré prédit automatiquement 6 structural measurements :
  - *Épaules*, *Poitrine / Buste*, *Hanche*, *Longueur de manche*, *Entrejambe* et *Couture extérieure*.
- **Traduction automatique des tailles** : Une fois les structural measurements prédites, les deterministic sizing algorithms remplissent instantanément **toutes les retail sizes standard** jusqu'à la shoe size :
  - *Taille de chemise décontractée* (XS–XXL basée sur le tour de poitrine)
  - *Taille de pantalon* (inches, convertie à partir du tour de taille en cm)
  - *Taille de chaussure US* (formules Hommes/Femmes basées sur la longueur du pied)
  - *Taille de robe femme* (US 0–14+ basée sur la taille)
  - *Taille de soutien-gorge femme* (band + cup calculées à partir du buste/sous-buste)
- **Mode d'édition détaillée** : Après le auto-fill, ajustez finement les 15 sizing parameters (y compris Shirt Size, Pants Size, Shoe Size, Bra Size, Dress Size) et les attributs de cheveux (*Longueur, Type, Couleur, Style*).
- **Live Unit Toggle** : Basculez entre *kg/cm* et *lb/in* — toutes les valeurs se convertissent instantanément sans re-prediction.

#### Panneau H : Inscription au répertoire des professionnels et experts
- **Bascule de styliste professionnel** : Inscrivez-vous en tant que professionnel de la mode vérifié (styliste, tailleur, designer).
- **Détails de l'entreprise** : Saisissez le nom, l'adresse, le téléphone, l'e-mail, le site web et la description de l'entreprise pour apparaître dans le répertoire `/experts` et le ticker des campagnes régionales.

#### Panneau I : Paramètres de paiement PayPal
- **E-mail du bénéficiaire PayPal** : Saisissez votre e-mail PayPal pour recevoir les payouts des ventes sur le marketplace et des campagnes d'experts actives.

---

### 4. Carte accordéon des préférences système

Gère les system-level settings, les abonnements et les AI integrations :

- **Configuration de l'IA** :
  - *Mode Standard* : Utilise les Gemini Flash 2.x endpoints gérés par le système.
  - *Mode Clés API personnalisées* : Connectez des Google Gemini, Anthropic, OpenAI ou DeepSeek API keys personnalisées via un modal de configuration guidée.
- **Abonnement et limites de garde-robe** :
  - Affichez votre account tier actuel (**Gratuit** : limite de 50 articles vs **Manager** ou **Professionnel** : articles illimités).
  - Passez au niveau supérieur via l'API REST PayPal Subscriptions (Manager: $5/month or $50/year; Professional: $10/month or $100/year).
- **Planificateur et rappels Push** :
  - Activez/désactivez les notifications de propositions de tenues du matin.
  - Définissez la fréquence (*Everyday*, *Every Other Day*, *Twice a Week*, *On Weekday*), l'heure (par exemple, *07:00*) et les exigences de style du code vestimentaire (*Casual*, *Formal*, *Athletic*, *Custom*).
  - Activez les VAPID push alerts du navigateur.
- **Préférences de notification de campagne** :
  - Toggles granulaires pour *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos* et *Personal Stylist*.
  - Ajustez le curseur **Max Campaign Distance** (5km to 50km).
- **Connexion Google Calendar** : Bouton OAuth pour synchroniser les événements de votre calendrier personnel avec l'AI Stylist.
- **Carte des services de localisation** : Activez/désactivez les GPS location permissions pour les flux d'experts basés sur la distance et la météo hyper-locale.
- **Bouton Inviter des amis** : Copiez le referral link partageable.
- **Assistant Shopping** : Accédez aux détails de l'extension Chrome Web Store ou générez un **Universal Bookmarklet** (`javascript:...`) pour des comparaisons instantanées de tailles e-commerce.

---

### 5. Actions du compte et diagnostics
- **Déconnexion** : Déconnectez-vous de votre session actuelle.
- **Supprimer mon compte** : Lien pour purger définitivement les données du compte.
- **Panneau développeur** : Accordéon diagnostic pour le environment testing.

---

## Résultats attendus
- Synchronisation instantanée des physical metrics, du skin tone et des photo cutouts sur le 2D Avatar Try-On Canvas.
- Zéro idle network requests lors de la navigation entre les panneaux de paramètres.
- Propositions de tenues AI Stylist personnalisées, alignées sur vos modesty rules et votre schedule.

---

## Dépannage
- **Arrière-plan de la photo non supprimé** : Assurez-vous que votre photo téléchargée est plein corps avec un background lighting contrasté.
- **Alertes push non reçues** : Confirmez que les browser notification permissions sont activées et qu'un numéro de téléphone est enregistré sous *Contact*.
- **Autocomplete d'adresse ne répond pas** : Vérifiez que la internet connection est active pour les OpenStreetMap Nominatim queries.

---

## Limitations
- L'espace de compte free tier est plafonné à 150 articles, sauf extension via un referral bonus (+10 slots par invitation) ou un Pro subscription.
- Le custom API key mode nécessite des valid keys avec un remaining quota auprès du fournisseur respectif.
