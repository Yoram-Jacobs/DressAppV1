# Profil, Mensurations & Configuration (`/me`)

Gérez vos mensurations physiques, votre teint de peau, le détourage de votre photo corporelle, vos préférences de style, vos identifiants de modèles d'IA et vos intégrations système sur votre tableau de bord de profil personnel.

## Présentation générale
La page **Profil & Paramètres** (`https://dressapp.co/me`) sert de centre de contrôle principal pour votre écosystème DressApp. Elle regroupe vos paramètres anthropométriques physiques, la scène d'essayage virtuel, les contraintes de style, les préférences localisées, les clés d'API IA et la planification des notifications push.

---

## Prérequis
- Un compte DressApp actif.
- (Optionnel) Autorisations de caméra sur l'appareil pour importer une photo en pied.
- (Optionnel) Autorisations de géolocalisation pour les campagnes de stylistes locaux et les prévisions météo.

---

## Guide Étape par Étape : Vue d'ensemble de la page

### 1. En-tête de page & Barre de navigation Explorer
Situé en haut du tableau de bord `/me` :
- **En-tête (Header)** : Affiche le statut de votre compte et votre titre.
- **Cartes Explorer (Explore Cards)** : Raccourcis rapides vers les sections principales de l'application :
  - **Trend Scout** (`/trends`) : Consultez les flux d'actualités mode quotidiennes préparés par l'IA.
  - **Tenues (Outfits)** (`/outfits`) : Accédez à votre calendrier de tenues enregistrées.
  - **Experts** (`/experts`) : Parcourez les stylistes de mode et tailleurs locaux.
  - **Statistiques (Stats)** (`/me/stats`) : Affichez la valorisation du dressing, les métriques de coût par portée et la répartition des couleurs.

### 2. Carte de Sélection de la Langue & de la Voix
Présentée en évidence pour un accès immédiat :
- **Sélecteur de Langue** : Choisissez parmi 12 langues prises en charge (*Anglais, Espagnol, Français, Allemand, Italien, Portugais, Russe, Chinois, Japonais, Arabe, Hindi, Hébreu*). La sélection d'une langue met automatiquement à jour l'interface utilisateur et associe le modèle vocal régional par défaut pour la synthèse vocale (TTS).

---

### 3. Carte d'Identité & Détails Personnels (`ProfileDetailsCard`)

Contient 9 panneaux accordéon dépliables pour gérer votre identité, vos mensurations et l'affichage de votre avatar :

#### Panneau A : Identité
- **Prénom & Nom** : Champs d'identification personnelle.
- **Adresse E-mail** : Affichage en lecture seule de votre adresse e-mail enregistrée.
- **Date de Naissance** : Utilisée pour personnaliser le score de tendances démographiques.
- *Badge de Saisie Automatique Google* : S'affiche automatiquement si votre profil a été créé via Google OAuth.

#### Panneau B : Contact & Adresse de Livraison
- **Numéro de Téléphone** : Requis pour recevoir les alertes SMS/Push pour les propositions quotidiennes et les campagnes locales.
- **Ligne d'Adresse 1** : Intègre la saisie automatique au niveau de la rue via OpenStreetMap (Nominatim).
- **Ligne d'Adresse 2, Ville, Région, Code Postal** : Champs d'adresse manuels pour la livraison sur la marketplace.
- **Pays** : Liste déroulante hors ligne recherchable par nom de pays ou code ISO-2.

#### Panneau C : Démographie
- **Sexe** : Sélectionnez *Femme* ou *Homme* pour configurer les mensurations de base et la taxonomie des vêtements.
- **Statut Personnel** : Sélectionnez *Célibataire*, *Marié(e)*, *Divorcé(e)* ou *Veuf/Veuve*.
- **Profession** : Saisie de texte libre (ex. *Étudiant(e)*, *Responsable Marketing*, *Barista*). Alimente le moteur de personnalisation de Trend Scout.

#### Panneau D : Préférences & Unités de Mesure
- **Unité de Poids** : Basculez entre Kilogrammes (`kg`) et Livres (`lb`).
- **Unité de Taille** : Basculez entre Centimètres (`cm`) et Pouces (`in`).

#### Panneau E : Photos & Scène d'Avatar Numérique
- **Colonne Gauche — Sélecteurs de Photos** :
  - *Photo de Visage* : Importez une miniature d'avatar.
  - *Photo en Pied* : Importez une photo complète de votre corps. Le système exécute automatiquement le détourage local U2-Net (`rembg`) pour supprimer l'arrière-plan.
  - *Bouton Supprimer la Photo* : Suppression en un clic de votre détourage, basculant instantanément la scène d'essayage sur le mannequin vectoriel SVG 2D sans aucun ralentissement.
- **Colonne Droite — Avatar Numérique & Scène d'Essayage** :
  - **Sélecteur de Teint de Peau** : Palette de couleurs interactive pour choisir la couleur de peau de votre mannequin.
  - **Canvas d'Essayage de l'Avatar** : Affiche les vêtements sur votre photo détourée ou sur le mannequin vectoriel Bezier (`DynamicAvatar.jsx`) à l'aide de décalages calibrés (`top-[14.5%]` du col au décolleté et `top-[36.5%]` de la ceinture à la taille).

#### Panneau F : Profil de Style
- **Esthétiques** : Mots-clés de style séparés par des virgules (ex. *Minimaliste, Streetwear, Vintage*).
- **Palette de Couleurs** : Teintes préférées (ex. *Pastel, Tons Chauds, Monochrome*).
- **À Éviter** : Couleurs ou types de vêtements à exclure des recommandations IA.
- **Niveau de Modestie Vestimentaire** : Sélectionnez le niveau (*Décontracté*, *Modéré*, *Conservateur*) pour guider le styliste IA.

#### Panneau G : Mensurations & Tailles (Predicteur de Taille ANSUR II)
- **Mode Démarrage / Réinitialisation** : Saisissez 4 données de base : **Taille**, **Poids**, **Tour de Taille** et **Longueur du Pied**. Le modèle de régression ANSUR II intégré via scikit-learn prédit automatiquement 6 mensurations structurelles :
  - *Épaules*, *Poitrine*, *Hanches*, *Longueur de Manche*, *Entrejambe* et *Longueur Extérieure*.
- **Mode Édition Détaillée** : Ajustez finement les 15 paramètres de taille et attributs de cheveux.

#### Panneau H : Inscription dans l'Annuaire des Experts
- **Bouton Styliste Professionnel** : Inscrivez-vous en tant que professionnel certifié de la mode.
- **Coordonnées Commerciales** : Saisissez Nom, Adresse, Téléphone, E-mail, Site Web et Description pour figurer dans `/experts`.

#### Panneau I : Paramètres de Paiement PayPal
- **E-mail Récepteur PayPal** : Indiquez votre e-mail PayPal pour recevoir vos versements des ventes et campagnes.

---

## 4. Carte Accordéon des Préférences Système

Gère les paramètres système, abonnements et intégrations d'IA :

- **Configuration IA (AI Configuration)** :
  - *Mode Standard* : Utilise les points de terminaison Gemini Flash 2.x gérés par le système.
  - *Mode Clés API Personnalisées* : Connectez vos propres clés API Google Gemini, Anthropic, OpenAI ou DeepSeek.
- **Abonnement & Limites du Dressing** :
  - Affichez votre niveau de compte (**Gratuit** : limite de 150 articles vs **Pro** : articles illimités).
  - Mettez à niveau via la REST API PayPal Subscriptions (4,99 $/mois ou 29,99 $/an).
  - Copier le **Lien de Parrainage** : Offre +10 emplacements de dressing par ami inscrit.
- **Planificateur & Rappels Push** :
  - Activez les notifications de propositions de tenues matinales.
  - Définissez la fréquence, l'heure et le style vestimentaire.
  - Activez les alertes push VAPID du navigateur.
- **Préférences de Notifications de Campagnes** :
  - Boutons modulables pour *Push/E-mail Mode Locale*, *Alertes Promos*, *Mode Écoresponsable*, *Offres de Luxe* et *Styliste Personnel*.
  - Ajustez le curseur **Distance Maximale de Campagne** (5 km à 50 km).
- **Connexion Google Calendar** : Bouton OAuth pour synchroniser vos événements personnels avec le styliste IA.
- **Services de Localisation** : Activez la géolocalisation GPS pour les experts locaux et la météo.
- **Bouton Inviter des Amis** : Copiez votre lien de parrainage.
- **Assistant Shopping** : Accédez à l'extension Chrome Web Store ou gérez un **Bookmarklet Universel** (`javascript:...`) pour des comparaisons de tailles instantanées sur les sites e-commerce.

---

## 5. Actions du Compte & Diagnostics
- **Déconnexion** : Se déconnecter de la session en cours.
- **Supprimer mon Compte** : Lien pour purger définitivement les données du compte.
- **Panneau Développeur** : Accordéon de diagnostic pour les tests d'environnement.

---

## Résultats Attendus
- Synchronisation instantanée des mensurations, du teint et du détourage photo sur le canvas d'essayage 2D.
- Aucune requête réseau inutile lors de la navigation entre les panneaux.
- Propositions de tenues IA sur mesure conformes à vos règles vestimentaires et à votre emploi du temps.

---

## Dépannage
- **Le fond de la photo n'est pas supprimé** : Assurez-vous que la photo importée soit en pied avec un éclairage de fond contrasté.
- **Les alertes push n'arrivent pas** : Vérifiez que les autorisations de notification du navigateur sont activées et qu'un numéro de téléphone est enregistré.
- **La saisie automatique d'adresse ne répond pas** : Vérifiez que la connexion Internet est active pour OpenStreetMap Nominatim.

---

## Limites
- La capacité du compte gratuit est plafonnée à 150 articles sauf en cas de parrainage (+10 emplacements par invitation) ou d'abonnement Pro.
- Le mode clés API personnalisées nécessite des clés valides avec un quota disponible.