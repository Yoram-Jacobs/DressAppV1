# Profil, Mensurations et Configuration (`/me`)

Gérez vos mensurations physiques, votre teint de peau, vos découpes photo corporelles, vos préférences de style, vos paramètres de modèles d'IA et vos intégrations système sur le tableau de bord de votre profil personnel.

## Vue d'ensemble
La page **Profil et Paramètres** (`https://dressapp.co/me`) sert de centre de contrôle principal pour votre écosystème DressApp. Elle regroupe vos paramètres anthropométriques physiques, votre scène d'essayage virtuel d'avatar numérique, vos contraintes de style, vos préférences régionales, vos paramètres de modèles d'IA et vos programmations de notifications push.

---

## Prérequis
- Un compte DressApp actif.
- (Facultatif) Autorisations d'accès à l'appareil photo pour le téléversement d'une photo en pied.
- (Facultatif) Autorisations de localisation pour le ciblage des campagnes de stylistes locaux, les préférences culturelles et les prévisions météorologiques.

---

## Guide étape par étape : Présentation complète de la page de haut en bas

### 1. En-tête de page et barre de navigation Explorer
Situés tout en haut du tableau de bord `/me` :
- **En-tête** : Affiche le statut et le titre de votre compte.
- **Cartes Explorer** : Raccourcis rapides vers les sections principales de l'application :
  - **Trend Scout** (`/trends`) : Consultez les flux quotidiens d'actualités mode sélectionnés par l'IA.
  - **Tenues** (`/outfits`) : Accédez à votre calendrier de tenues enregistrées.
  - **Experts** (`/experts`) : Parcourez les stylistes et tailleurs locaux.
  - **Déballé / Stats** (`/me/stats`) : Visualisez la valorisation de votre garde-robe, le coût par port et la répartition des couleurs.

### 2. Carte de sélection de la langue et de la voix
Mise en évidence pour une accessibilité immédiate :
- **Sélecteur de langue** : Choisissez parmi 12 langues prises en charge (*anglais, espagnol, français, allemand, italien, portugais, russe, chinois, japonais, arabe, hindi, hébreu*). La sélection d'une langue met automatiquement à jour la langue de l'interface et associe le modèle vocal de synthèse vocale (TTS) régional par défaut.

---

### 3. Carte d'identité et coordonnées personnelles (`ProfileDetailsCard`)

Comprend 9 panneaux déroulants en accordéon gérant votre identité personnelle, vos tailles et le rendu de votre avatar :

#### Panneau A : Identité
- **Prénom et Nom** : Champs d'identification personnelle.
- **Adresse e-mail** : Affichage en lecture seule de votre adresse e-mail enregistrée.
- **Date de naissance** : Utilisée pour personnaliser le score démographique des tendances.
- *Badge de remplissage automatique Google* : S'affiche automatiquement si votre profil a été initialisé via Google OAuth.

#### Panneau B : Contact et adresse de livraison
- **Numéro de téléphone** : Requis pour recevoir les alertes SMS/Push des propositions du planificateur quotidien et des campagnes d'experts locaux.
- **Adresse Ligne 1** : Intègre l'autocomplétion au niveau de la rue via OpenStreetMap (Nominatim). La sélection d'une suggestion remplit automatiquement la Ligne 1, la Ville, la Région, le Code postal et le Pays.
- **Adresse Ligne 2, Ville, Région, Code postal** : Champs d'adresse manuels pour l'expédition sur la place de marché.
- **Pays** : Liste déroulante hors ligne consultable par nom de pays ou code ISO-2.

#### Panneau C : Données démographiques
- **Sexe** : Sélectionnez *Femme* ou *Homme* pour configurer les mensurations corporelles de base et la taxonomie des vêtements.
- **Situation familiale** : Sélectionnez *Célibataire*, *Marié(e)*, *Divorcé(e)* ou *Veuf/Veuve*.
- **Profession** : Saisie en texte libre (par ex. *Étudiant(e)*, *Responsable marketing*, *Barista*). Alimente l'algorithme de personnalisation de Trend Scout afin de prioriser les actualités de style pertinentes.

#### Guide résumé : Synchroniser les données manquantes du profil Google (nouveau consentement People API)
Si vous vous êtes connecté avec Google avant que DressApp ne demande l'accès aux détails de votre profil via la **People API** (téléphone, adresse, genre, date de naissance), ces champs peuvent rester vides. Vous pouvez les synchroniser en un clic :

1. **Ouvrez l'accordéon Contact ou Données démographiques** — vous verrez un bouton **« Synchroniser depuis Google »** (icône d'actualisation) à côté du titre de la section.
2. **Cliquez sur « Synchroniser depuis Google »** — si les autorisations requises pour la People API n'avaient pas été accordées lors de votre connexion initiale, DressApp le détecte et affiche un message d'information : *« Google a besoin de votre autorisation pour accéder aux détails du profil. Vous allez être redirigé vers Google pour accorder l'accès. »*
3. **Accordez votre consentement sur l'écran de Google** — vous êtes redirigé vers l'écran de consentement OAuth de Google. Cochez les cases **Infos du profil** (nom, e-mail, photo) et **Coordonnées** (téléphone, adresse, genre, date de naissance).
4. **Retour et remplissage automatiques** — après validation, Google vous redirige vers DressApp. La fonction `syncGoogleProfile()` s'exécute automatiquement, appelant le point de terminaison backend `/auth/google/sync-profile` qui :
   - Récupère votre téléphone, votre adresse, votre genre et votre date de naissance depuis l'API Google People
   - Remplit les champs vides dans les panneaux **Contact** (téléphone, adresse) et **Données démographiques** (sexe, date de naissance)
   - Enregistre instantanément les mises à jour dans votre profil
5. **Terminé** — votre profil est désormais complet sans saisie manuelle.

> **Remarque** : Le bouton « Synchroniser depuis Google » apparaît également dans l'en-tête de la page (à côté du bouton principal « Synchroniser le profil Google ») et fonctionne exactement de la même manière — il synchronise toutes les données disponibles du profil Google en une seule fois.

#### Panneau D : Préférences et unités de mesure
- **Unité de poids** : Basculez entre les kilogrammes (`kg`) et les livres (`lb`).
- **Unité de longueur** : Basculez entre les centimètres (`cm`) et les pouces (`in`).

#### Panneau E : Photos et scène de l'avatar numérique
- **Colonne de gauche — Sélecteurs de photos** :
  - *Photo du visage* : Téléversez une miniature d'avatar.
  - *Photo en pied* : Téléversez une photographie de votre corps entier. Le système exécute automatiquement un détourage local U2-Net (`rembg`) pour supprimer l'arrière-plan.
  - *Bouton Supprimer la photo* : Suppression en un clic de votre découpe photo, rétablissant instantanément le mannequin vectoriel SVG 2D sur la scène d'essayage sans aucune latence d'interface.
- **Colonne de droite — Avatar numérique et scène d'essayage** :
  - **Sélecteur de teint de peau** : Palette de couleurs interactive pour choisir le teint de peau de votre mannequin.
  - **Toile d'essayage de l'avatar** : Affiche les vêtements par-dessus votre découpe photo ou sur le mannequin vectoriel dynamique de Bézier (`DynamicAvatar.jsx`) à l'aide de repères anatomiques calibrés (`top-[14.5%]` du col à l'encolure et `top-[36.5%]` de la ceinture à la taille).

#### Panneau F : Profil de style
- **Esthétiques** : Mots-clés de style séparés par des virgules (par ex. *Minimaliste, Streetwear, Vintage*).
- **Palette de couleurs** : Nuances de couleurs préférées (par ex. *Pastels, Tons terreux, Monochrome*).
- **À éviter** : Couleurs ou types de vêtements à exclure strictement des recommandations de l'IA (par ex. *Jaune, Crop Tops*).
- **Pudeur vestimentaire culturelle** : Sélectionnez le niveau de pudeur (*Décontracté/Libre*, *Modéré*, *Conservateur*) pour guider le niveau de couvrance des tenues de l'AI Stylist.

#### Panneau G : Mensurations corporelles et tailles (Prédicteur de tailles ANSUR II)
- **Mode d'intégration / Nouveau départ** : Saisissez 4 données de base : **Taille (Hauteur)**, **Poids**, **Tour de taille** et **Longueur du pied**. Le modèle de régression multi-sorties intégré scikit-learn ANSUR II prédit automatiquement 6 mensurations structurelles :
  - *Épaules*, *Poitrine / Buste*, *Hanches*, *Longueur de manche*, *Entrejambe* et *Longueur extérieure de jambe*.
- **Conversion automatique des tailles** : Une fois les mensurations structurelles prédites, des algorithmes déterministes renseignent instantanément **toutes les tailles commerciales standard**, jusqu'à la pointure de chaussures :
  - *Taille de chemise décontractée* (XS–XXL selon le tour de poitrine)
  - *Tour de taille de pantalon* (en pouces, converti à partir du tour de taille en cm)
  - *Pointure US* (formules Homme/Femme basées sur la longueur du pied)
  - *Taille de robe femme* (US 0–14+ selon le tour de taille)
  - *Taille de soutien-gorge* (tour de dos + bonnet calculés à partir du buste et du dessous de poitrine)
- **Mode d'édition détaillée** : Après le remplissage automatique, ajustez finement l'ensemble des 15 paramètres de taille (dont la taille de chemise, de pantalon, de chaussures, de soutien-gorge et de robe) ainsi que les attributs capillaires (*Longueur, Type, Couleur, Coiffure*).
- **Bascule d'unités en direct** : Basculez entre *kg/cm* et *lb/in* — toutes les valeurs sont converties instantanément sans nécessiter de nouvelle prédiction.

#### Panneau H : Inscription à l'annuaire des professionnels et experts
- **Option Styliste professionnel** : Enregistrez-vous en tant que professionnel de la mode vérifié (styliste, tailleur, créateur).
- **Coordonnées professionnelles** : Saisissez le nom de l'entreprise, l'adresse, le téléphone, l'e-mail, le site web et la description pour apparaître dans l'annuaire `/experts` et le bandeau de campagnes régionales.

#### Panneau I : Paramètres de versement PayPal
- **E-mail de réception PayPal** : Saisissez votre adresse e-mail PayPal pour recevoir les paiements de vos ventes sur la place de marché et de vos campagnes d'expert actives.

---

### 4. Carte en accordéon des préférences système

Gère les paramètres système, les abonnements et les intégrations d'IA :

- **Routage des modèles d'IA (Architecture multiniveau — Zero BYOK)** :
  - *Forfait Gratuit (Moteur Eyes sur site)* : Les utilisateurs du forfait gratuit bénéficient du moteur sur site auto-hébergé **Eyes** de DressApp (actuellement un modèle **Qwen 2.5 VL 3B** affiné) sur le port 7860, sans aucune clé API personnelle requise.
  - *Forfaits Manager et Professional (Modèle Cloud rapide)* : Les abonnés aux forfaits **Manager** et **Professional** bénéficient d'un routage prioritaire vers le modèle d'IA Cloud rapide (actuellement **Google Gemini 3.5 Flash** via `llm_gateway.py`).
  - *Filet de sécurité sur site pour les quotas* : Si des limites de débit cloud externes (`429` / `RESOURCE_EXHAUSTED`) sont rencontrées, les requêtes basculent automatiquement vers le conteneur auto-hébergé **Eyes** (`Qwen 2.5 VL 3B`) sur le port 7860, garantissant que votre conversation de stylisme n'est jamais interrompue.
- **Abonnement et limites de garde-robe** :
  - Consultez le palier actuel de votre compte (**Free** : limite de base de 150 articles contre **Manager** (10 $/mois) ou **Professional** (15 $/mois) : articles illimités + modèle d'IA Cloud rapide).
  - Accédez à la **page Tarifs** (`/pricing` ou cliquez sur la carte de votre forfait) pour consulter le tableau comparatif des paliers, sélectionner un forfait ou acheter des packs de crédits prépayés sans date d'expiration.
  - Passez à un forfait supérieur via PayPal Subscriptions ou la passerelle Atzmai pour les transactions locales en Israël en ILS (Bit / carte bancaire).
  - Copiez le **lien de parrainage** : Octroie +10 emplacements de capacité de garde-robe pour chaque ami qui s'inscrit (jusqu'à 150 articles maximum).
- **Planificateur et rappels push** :
  - Activez ou désactivez les notifications matinales de propositions de tenues.
  - Définissez la fréquence (*Tous les jours*, *Un jour sur deux*, *Deux fois par semaine*, *En semaine*), l'heure (par ex. *07:00*) et les exigences de code vestimentaire (*Décontracté*, *Formel*, *Sportif*, *Personnalisé*).
  - Activez les alertes push VAPID du navigateur.
- **Préférences de notifications de campagnes** :
  - Interrupteurs granulaires pour *Push/E-mail mode locale*, *Alertes soldes*, *Mode durable*, *Promos de luxe* et *Styliste personnel*.
  - Ajustez le curseur **Distance maximale des campagnes** (de 5 km à 50 km).
- **Connexion Google Calendar** : Bouton OAuth permettant de synchroniser vos événements de calendrier personnel avec l'AI Stylist.
- **Carte des services de localisation** : Activez ou désactivez les autorisations de localisation GPS pour obtenir des flux d'experts adaptés à votre distance et une météo hyperlocale.
- **Bouton Inviter des amis** : Copiez votre lien de parrainage partageable.
- **Assistant Shopping** : Accédez aux détails de l'extension Chrome Web Store ou générez un **Bookmarklet universel** (`javascript:...`) pour comparer instantanément les tailles sur les sites d'e-commerce.

---

### 5. Actions du compte et diagnostics
- **Se déconnecter** : Déconnectez-vous de votre session actuelle.
- **Supprimer mon compte** : Lien permettant de purger définitivement toutes les données du compte.
- **Panneau développeur** : Vue de diagnostic pour les tests d'environnement. Authentifiée via Google OAuth (`dressappdeveloper@gmail.com`).

---

## Résultats attendus
- Synchronisation instantanée des mensurations physiques, du teint de peau et des découpes photo sur la toile d'essayage de l'avatar 2D.
- Aucune requête réseau inactive lors de la navigation entre les panneaux de paramètres.
- Propositions de tenues personnalisées de l'AI Stylist alignées sur vos règles de pudeur et votre emploi du temps.

---

## Dépannage
- **L'arrière-plan de la photo n'est pas supprimé** : Assurez-vous que la photo téléversée est une photo en pied avec un éclairage d'arrière-plan bien contrasté.
- **Les alertes push n'arrivent pas** : Vérifiez que les autorisations de notification du navigateur sont activées et qu'un numéro de téléphone est enregistré sous *Contact*.
- **L'autocomplétion d'adresse ne répond pas** : Vérifiez que votre connexion Internet est active pour les requêtes OpenStreetMap Nominatim.

---

## Limites
- L'espace de compte du forfait Gratuit est plafonné à 150 articles et utilise le modèle sur site Eyes (`Qwen 2.5 VL 3B`), sauf mise à niveau vers le forfait **Manager** ou **Professional** pour un stockage illimité et l'accès au modèle Cloud rapide (`Gemini 3.5 Flash`).
- Si les quotas cloud sont temporairement atteints, les requêtes basculent de manière transparente vers le moteur sur site intégré Eyes (`Qwen 2.5 VL 3B`) sans interrompre la session.
