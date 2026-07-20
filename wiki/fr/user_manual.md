# Manuel d'Utilisation Technique Complet de DressApp

Manuel d'utilisation complet et guide de référence technique pour l'écosystème de garde-robe personnelle DressApp, son moteur de relooking, sa place de marché circulaire et ses panneaux d'administration.

---

## 1. Vue d'Ensemble & Architecture Technique

DressApp est un gestionnaire de garde-robe personnelle propulsé par l'IA, un conseiller en style et une place de marché circulaire. Il aide les utilisateurs à gérer leurs vêtements numériquement, à les détourer et les étiqueter automatiquement, à recevoir des recommandations de tenues adaptées à la météo et à l'agenda, à scanner les Passeports Numériques des Produits (DPP) de l'UE et à échanger des vêtements.

### Proposition de Valeur Clé
- **Ingestion de Garde-Robe Numérique** : Traitement des photos prises ou téléchargées avec suppression automatisée de l'arrière-plan, catégorisation des vêtements et génération d'étiquettes d'attributs.
- **Styliste Virtuel IA** : Un agent conversationnel qui analyse contextuellement votre garde-robe, vos événements Google Calendar et les prévisions météorologiques locales pour suggérer des tenues quotidiennes.
- **Marché Circulaire** : Achat, vente, échange et location sécurisés de vêtements entre particuliers pour réduire le gaspillage de la fast fashion.
- **Analytique du Coût par Port (CPW)** : Aperçus sur la valeur de capitalisation de la garde-robe, le taux d'utilisation et l'optimisation de l'usage.

### Architecture Technique
- **Backend Edge** : Python 3.11 avec FastAPI, utilisant des pilotes asynchrones Motor connectés à un cluster MongoDB Atlas.
- **Frontend SPA** : Application monopage React 19 utilisant des stores personnalisés `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, des primitives Shadcn/UI et `react-i18next` prenant en charge 12 langues.
- **Optimisation d'État & Réseau** : Déduplication des requêtes en cours, mise en cache du store pendant 15 minutes et revalidation d'onglet lors de `visibilitychange` générant zéro requête GET en arrière-plan au repos.
- **Machine Learning Local & Taillage** : Détourage d'arrière-plan sur CPU local via U2-Net (`rembg`), analyse vestimentaire SegFormer-b2, embeddings Fashion-CLIP et modèle de régression de mesures corporelles ANSUR II (`body_predictor.py`). Routage optionnel vers des conteneurs GPU auto-hébergés (SegFormer-b3 + BiRefNet) pour des opérations rapides.
- **STT/TTS Conversationnel** : Alternative de reconnaissance vocale Web Speech côté client en temps réel, modulations multimodales Gemini 2.5 Flash côté serveur et moteurs hors ligne Piper/Sherpa-ONNX sur l'appareil.
- **Services d'Intégration Externe** : API OpenWeatherMap pour la météo, Google Calendar OAuth pour l'exportation d'emplois du temps quotidiens, autocomplétion d'adresses OpenStreetMap (Nominatim) et APIs REST PayPal Subscriptions/Checkout.

---

## 2. Prérequis

### Exigences de l'Environnement Hôte
- **Matériel** : VPS d'au moins 4 Go de RAM (par ex., VPS Hetzner hébergeant le site de production `dressapp.co`).
- **Dépendances** : Stack Docker & Docker Compose (comprenant le backend, le frontend et la terminaison TLS Caddy).
- **Variables d'Environnement** : Configuration des clés API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` et jetons OAuth Google Calendar).

### Exigences de l'Application Utilisateur
- **Navigateur Web** : Google Chrome ou Apple Safari (requis pour une compatibilité complète avec les fonctionnalités vocales).
- **Autorisations** : Accorder l'autorisation Caméra (pour les prises de vue et les scans QR) et l'autorisation Micro (pour la conversation vocale).
- **Réseau** : Connexion active pour le traitement LLM, avec mise en cache IndexedDB permettant la navigation dans le catalogue hors ligne.

---

## 3. Instructions Étape par Étape

### 3.1 Ingestion d'Articles (Ajouter des Articles)
PARADIGMES D'INGESTION : Photographie, Passeports Numériques de Produits de l'UE et Reçus Numériques.

#### A. Caméra Interactive et Téléversement de Fichiers
1. Naviguez vers l'écran **Ajouter un article**.
2. Sélectionnez **Prendre une photo** (lance l'appareil photo natif) ou cliquez sur **Téléverser des photos** (ouvre le sélecteur de fichiers du système d'exploitation).
3. Le client calcule le hash SHA-256 et le dHash (hash de différence horizontale) de l'image dans le navigateur (~100-180 ms) pour vérifier la présence de doublons dans votre garde-robe.
4. Si une correspondance est trouvée, la boîte de dialogue **Pré-vérification des Doublons** s'ouvre en affichant les aperçus correspondants. Sélectionnez **Ignorer** ou **Ajouter quand même**.
5. Une fois accepté, le serveur démarre un flux NDJSON. Une vue préalable avec espaces réservés s'affiche en 5 à 7 secondes, vous permettant de modifier immédiatement les détails de l'article pendant que le backend termine l'étiquetage.
6. Vérifiez les étiquettes détectées automatiquement (couleur, tissu, coupe, motif, occasion). Si la forme du détourage est incorrecte, modifiez le menu déroulant **Catégorie** ; cela déclenche automatiquement un nouveau détourage par SegFormer.
7. Cliquez sur **Enregistrer** pour afficher immédiatement l'article sur la grille du dressing (~16 ms) pendant que la génération de miniatures WebP s'achève en arrière-plan.

#### B. Scan des Passeports Numériques de Produits (DPP) de l'UE
1. Appuyez sur le bouton **Scanner QR (DPP)** sur la page Ajouter un article.
2. Accordez les autorisations de caméra et alignez le code QR imprimé sur l'étiquette de l'article, ou téléversez une capture d'écran de QR enregistrée.
3. Le backend résout l'URL et exécute des contrôles de sécurité SSRF (blocage des plages d'IP privées).
4. Le système extrait les schémas JSON-LD pour récupérer la marque, la composition des matériaux, la traçabilité de la chaîne d'approvisionnement, l'empreinte carbone et les consignes d'entretien.
5. Vérifiez les données extraites affichées dans le panneau vert **Données DPP Vérifiées** et cliquez sur **Enregistrer**.

#### C. Importation de Reçus Numériques
1. Ouvrez l'onglet **Importation Numérique**.
2. Choisissez un sous-mode : **Coller du texte**, **Téléverser une image**, **Téléverser un PDF** ou entrez un **Lien Web**.
3. Le backend utilise des modèles de vision multimodaux pour extraire les données de transaction (marque, prix, taille, catégorie).
4. Les champs analysés sont verrouillés d'après le reçu pour les protéger contre toute ré-analyse visuelle future. Cliquez sur **Enregistrer** pour confirmer.

---

### 3.2 Styliste Virtuel IA Conversationnel
Décrivez vos dilemmes vestimentaires et recevez des conseils de style parlés en mains libres.

1. Naviguez vers l'écran **Styliste IA**.
2. Cliquez sur l'icône de microphone `[Microphone]` dans la barre de saisie du chat.
3. Prononcez votre requête (ex. : "Quel haut se marie avec mon pantalon beige pour un déjeuner en extérieur par temps de pluie ?").
4. Si Web Speech est pris en charge, votre voix est transcrite en direct dans le champ de saisie. Sinon, l'application enregistre un fichier WebM et le téléverse.
5. Le backend achemine la requête vocale vers le conteneur local Gemma4 (avec repli sur la transcription Gemini 2.5 Flash en cas de mode hors ligne).
6. Le styliste traite l'historique de votre garde-robe, les prévisions météorologiques locales et les événements du calendrier pour formuler une proposition de style.
7. Le styliste énonce la réponse en utilisant des profils vocaux présélectionnés (`puck`, `aoede` ou `charon`).
8. Appuyez sur **Lire la réponse** (ou **Réétudier** en mode hébreu) sur la carte pour réécouter l'audio.

---

### 3.3 Profil, Préférences et Dépendances Sous-système
La page Profil sert de panneau de contrôle principal pour DressApp. Les champs de configuration impactent directement les performances, le routage et le comportement des modules en aval.

##### Dépendances et Raisons d'Être des Sections Accordéon

1. **Scène Photos & Avatar Numérique (`AvatarViewer2D` & `DynamicAvatar`)**
   - **Pourquoi est-ce important ?** : Affiche votre identité visuelle sur tous les modèles d'essayage en utilisant une scène à double mode (détourage photo du corps réel segmenté vs mannequin vectoriel Bezier 2D dynamique).
   - **Dépendances sous-système** : Les détourages photo sont traités via U2-Net (`rembg`) local et réduits dans le navigateur à un maximum de 1280px à 82 % de qualité pour respecter le plafond de 16 Mo des documents MongoDB. La scène applique des repères positionnels calibrés (`top-[14.5%]` col à encolure, `top-[36.5%]` ceinture à taille, `bottom-[2%]` plan des chaussures) et une mise à l'échelle proportionnelle poitrine/hanches ($scaleX$). Cliquez sur *Supprimer la photo* pour revenir instantanément au mannequin vectoriel 2D SVG.

2. **Profil de Style (Règles de pudeur, Code vestimentaire)**
   - **Pourquoi est-ce important ?** : Il établit des limites personnelles pour les tenues recommandées, empêchant l'IA de générer des suggestions inappropriées.
   - **Dépendances sous-système** : Les paramètres sélectionnés (ex. contraintes de vêtements modestes) sont injectés directement dans les prompts de style pour Gemini 2.5 Flash, filtrant les résultats de garde-robe avant leur affichage.

3. **Détails (Nom, Téléphone, Profession)**
   - **Pourquoi est-ce important ?** : Personnalise le ton de la communication et achemine les alertes de notification.
   - **Dépendances sous-système** : Le nom de l'utilisateur est dynamiquement inséré dans les e-mails et les notifications push du système. Le numéro de téléphone sert de registre de secours pour les alertes programmées. Le paramètre profession est transmis au LLM du styliste et au classeur de personnalisation Trend Scout.

4. **Mesures Corporelles & Taillage (Modèle de Régression ANSUR II)**
   - **Pourquoi est-ce important ?** : Élimine les incertitudes sur les tailles, permettant la comparaison de tailles avec des détaillants externes et un superpositions virtuelle précise.
   - **Dépendances sous-système** : La saisie de 4 paramètres de base (**Taille**, **Poids**, **Tour de taille**, **Longueur du pied**) déclenche le modèle de régression scikit-learn ANSUR II (`body_predictor.py`) pour prédire automatiquement 6 dimensions structurelles (*Épaules*, *Poitrine*, *Hanches*, *Manche*, *Longueur entrejambe*, *Longueur extérieure*). Les mesures sont directement interrogées par les scripts de l'extension Chrome **Assistant Shopping** pour lire les tableaux de tailles des sites partenaires (Zara, Asos) et recommander les tailles.

5. **Style de Vie (Statut, Sexe)**
   - **Pourquoi est-ce important ?** : Adapte les recommandations par défaut et évalue les algorithmes de contenu.
   - **Dépendances sous-système** : La sélection du sexe affecte directement la logique de classement des cartes quotidiennes Trend Scout. Si la catégorie d'une carte d'actualités ne correspond pas au sexe de l'utilisateur, l'algorithme applique une pénalité de score de -2.0, la dégradant dans le flux.

6. **Configuration IA (Clés SaaS, mode edge, crédits)**
   - **Pourquoi est-ce important ?** : Détermine le routage de la facturation, les performances opérationnelles et le statut hors ligne du réseau.
   - **Dépendances sous-système** : Achemine les requêtes de génération de texte/audio. Les configurations standard consomment des crédits système DressApp. La saisie de clés API personnelles (Google AI Studio, Anthropic, OpenAI) redirige les frais vers les comptes de facturation développeur de l'utilisateur. La sélection du mode local edge achemine les requêtes vers le conteneur Gemma hors ligne.

7. **Planificateur & Push (Fréquence, alarme quotidienne, thème de style)**
   - **Pourquoi est-ce important ?** : Gère les notifications quotidiennes de style automatiques.
   - **Dépendances sous-système** : Active les tâches cron `APScheduler` sur le backend FastAPI. Chaque matin, déclenche des notifications push via `pywebpush` en utilisant les clés VAPID du client, correspondant aux paramètres de style sélectionnés.

8. **Google Calendar (Synchro OAuth, règles d'exportation)**
   - **Pourquoi est-ce important ?** : Relie directement votre garde-robe à vos événements de calendrier réels.
   - **Dépendances sous-système** : Authentifie via Google OAuth. Le planificateur interroge votre calendrier pour identifier les événements, former les tenues et envoyer les événements directement dans votre agenda Google Calendar.

9. **Services de Localisation (Suivi GPS, précision météo)**
   - **Pourquoi est-ce important ?** : Coordonne les suggestions adaptées à la météo et les filtres de rayon de transaction locale.
   - **Dépendances sous-système** : Déclenche la géolocalisation inverse `navigator.geolocation`. Les coordonnées sont envoyées à l'API OpenWeatherMap pour ajuster les recommandations du styliste (ex. vêtements de pluie en cas d'averses). Calcule également les distances pour les annonces du marché local et les experts (ex. vérifications de rayon à Lisbonne).

10. **Voix & Langue (Sélection de la voix du styliste virtuel)**
    - **Pourquoi est-ce important ?** : Établit les dictionnaires de texte et les modulations vocales.
    - **Dépendances sous-système** : Contrôle la langue active pour les traductions via `react-i18next`. La sélection de la voix associe les codes vocaux BCP-47 (ex. `he-IL` ou `ar-JO`) aux voix de synthèse Web Speech du client ou aux modèles Piper TTS hors ligne.

11. **Inviter des Amis (API de partage)**
    - **Pourquoi est-ce important ?** : Offre une boucle virale pour l'agrandissement gratuit du dressing.
    - **Dépendances sous-système** : Ajoute l'ID MongoDB du parrain à l'URL. Les nouvelles inscriptions interrogent dynamiquement cet ID et incrémentent de manière atomique le `closet_capacity_bonus` du parrain de +10 emplacements, modifiant les limites dans `closet.py`.

---

## 3.4 Tableau de Bord des Analyses de Garde-Robe
Analysez la valeur de capitalisation de votre garde-robe, le suivi d'utilisation des vêtements et les paramètres de coût par port.

1. Naviguez vers **Analyses de Garde-Robe**.
2. **Examiner les Métriques** :
   - *Valeur du Dressing* : Somme dynamique des prix d'achat.
   - *Taux d'Utilisation* : Pourcentage d'articles portés au moins une fois.
   - *Coût Moyen par Port (CPW)* : Calculé par `Price / Wear Count`.
3. **Graphiques de Répartition** : Basculez entre les onglets pour voir les visualisations Recharts :
   - *Palette de Couleurs* : Répartition des codes hexadécimaux associés.
   - *Matériaux* : Pourcentages des compositions de tissus.
   - *Sous-catégories* : Sous-catégories attribuées.
4. **Classement d'Efficacité** : Consultez les 5 vêtements affichant les scores de Coût par Port les plus bas.

---

## 3.5 Zone de Création & Planificateur de Tenues
Créez, superposez et examinez des propositions de tenues sur un mannequin avatar 2D interactif.

1. Ouvrez le planificateur **Zone de Création de Tenues**.
2. **Superposition de Vêtements d'Extérieur (Double Zone)** : Si votre tenue inclut un vêtement d'extérieur (ex. une veste) sur un haut, la page affiche deux modules verticaux : "Avec vêtement d'extérieur" (montrant la veste superposée) et "Sans vêtement d'extérieur" (révélant le haut sous-jacent).
3. **Éléments 2D Interactifs** : Appuyez directement sur n'importe quel vêtement sur le corps de l'avatar. L'application vous redirige immédiatement vers l'écran de détails de cet article.
4. **Onglet de Révision des Métriques** : Cliquez sur le bouton de détails et choisissez l'onglet **Métriques** pour afficher les barres de progression des critères de compatibilité :
   - *Harmonie des Couleurs* (harmonie neutre)
   - *Compatibilité des Motifs* (prévention du choc des motifs)
   - *Ajustement Corporel* (correspondance des tailles)
   - *Adéquation Météo* (adaptation à la saison)
   - *Adéquation Événement* (adaptation à l'activité)
   - *Adéquation Emplacement* (vérifications des règles de pudeur)
5. **Renommer/Décrire** : Cliquez sur l'icône Crayon pour modifier les noms et descriptions des tenues.

---

## 3.6 Assistant Valise
Organisez vos besoins de bagages pour vos voyages sans surcharger vos valises.

1. Allez sur la page **Valise** et remplissez le formulaire Contexte du Voyage (destination, dates de début/fin, catégorie de voyage, événements de l'agenda).
2. L'IA génère une liste de bagages personnalisée et des tenues quotidiennes basées sur la durée du séjour et les prévisions météo.
3. Vérifiez l'avancement des préparatifs. Si un article important manque (ex. parapluie pour la pluie, maillot de bain pour la plage), le système vous alerte et suggère des articles correspondants depuis le marché ou les boutiques locales.
4. Utilisez la zone de chat intégrée pour affiner les suggestions (ex. : "Changer le jour 2 pour une tenue informelle de soirée"). L'assistant modifie la valise tout en préservant le reste de la liste.
5. Appuyez sur **Approuver la valise** pour finaliser votre programme.

---

## 3.7 Planificateur & Rappels Push
Définissez des alertes quotidiennes de style pour recevoir automatiquement des recommandations de tenues.

1. Ouvrez **Profil** et allez dans **Planificateur & Push**.
2. Activez les notifications, définissez l'heure de notification quotidienne, la fréquence des jours de la semaine et le thème de style.
3. Chaque matin, la tâche cron en arrière-plan (`APScheduler`) vérifie les prévisions météo et envoie une notification push.
4. Appuyez sur la notification sur votre appareil (ou consultez le Centre de notifications de l'application web) pour ouvrir une boîte de dialogue présentant 3 propositions de style.
5. Enregistrez une suggestion directement dans votre **Journal de Garde-Robe**.

---

## 3.8 Marché (Revente, Location, Échange, Don)
Participez à la mode circulaire entre particuliers.

- **Créer une Annonce** : Ouvrez la page de détails d'un article, sélectionnez **Modifier l'intention** et choisissez une intention non privée :
  - *À vendre* : Saisissez le prix catalogue et la devise (détecte votre devise par défaut selon vos préférences régionales).
  - *Louer* : Fixez le tarif de location quotidien et les conditions d'emprunt.
  - *Échanger* : Marquez l'article comme disponible à l'échange.
  - *Donner* : Publiez l'article gratuitement.
- **Synchronisation d'État** : Les annonces se propagent automatiquement dans le flux. Le client utilise `useSyncExternalStore` et le stockage IndexedDB pour charger les paramètres de recherche sans latence.
- **Bac à Essai** : Les locataires/acheteurs peuvent tester l'association d'une annonce avec des articles de leur garde-robe privée avant de passer à la caisse.
- **Paiement et Transaction** :
  - *Achat/Location* : Effectuez la transaction via les boutons PayPal intégrés. Les webhooks capturés informent le vendeur, passent le statut de l'annonce à vendu/loué et enregistrent les transactions dans le registre moins les 7 % de frais de plateforme.
  - *Troc (Échange)* : Les troqueurs potentiels proposent des affaires. Le vendeur reçoit des e-mails de confirmation pour accepter ou refuser.

---

## 3.9 Panneau d'Administration
Validation du statut du système, comptabilité financière et gestion des comptes utilisateurs.

1. Naviguez vers `/admin` (accessible aux rôles d'administrateur).
2. **Vue d'Ensemble** : Auditez les volumes bruts et les récapitulatifs de revenus de frais de plateforme. Inspectez le **Tableau d'Activité des Fournisseurs** pour voir les statistiques d'état (API Gemini, latence du service météo et taux d'erreur).
3. **Fournisseurs** : Cliquez sur **Vérifier la Clé** pour envoyer un ping direct à l'API Gemini. Basculez l'interrupteur **Eyes Vision Override** pour router l'analyse d'image entre le point d'accès Gemini par défaut et un conteneur local Gemma.
4. **Utilisateurs** : Consultez les crédits actifs, les rôles et le total des paiements. Utilisez des actions directes pour Promouvoir ou Rétrograder des utilisateurs.
5. **Annonces** : Consultez les états des annonces et basculez les indicateurs d'activité pour suspendre les articles frauduleux.

---

## 4. Résultats Attendus

- **Ingestion** : Les articles apparaissent immédiatement dans la grille du dressing (~16 ms). Le détourage en arrière-plan génère des images PNG transparentes et nettes.
- **Badge DPP Vérifié** : Le scan de passeports valides affiche la carte d'information verte contenant les détails de durabilité.
- **Vêtement d'Extérieur sur Avatar** : Les vêtements d'extérieur s'affichent correctement superposés sur les hauts sur la zone de l'avatar 2D sans masquer les chapeaux ou les chaussures.
- **Réponse Vocale** : Les réponses textuelles du Styliste Virtuel lisent l'audio automatiquement avec un indicateur d'onde sonore visible.
- **Abonnements** : L'activation de l'offre Pro supprime immédiatement l'avertissement de limite de 150 articles.

---

## 5. Dépannage

### HTTP 402 Payment Required
- **Problème** : Ingestion bloquée. Vous avez atteint la limite maximale de base de 150 articles de garde-robe.
- **Solution** : Allez dans Profil -> Abonnement et passez à l'offre Pro, ou partagez votre lien d'invitation pour obtenir +10 emplacements par inscription.

### SSRF Bloqué / Erreur DNS sur DPP
- **Problème** : L'URL du passeport QR scanné ne parvient pas à être analysée.
- **Solution** : L'analyseur bloque les adresses IP privées (ex. `127.0.0.1`, `192.168.x.x`) pour protéger les serveurs internes. Assurez-vous que les codes QR pointent vers des domaines publics.

### Autorisation Caméra / Microphone Refusée
- **Problème** : La vue de capture/scan affiche un écran d'erreur 'X', ou la saisie vocale échoue.
- **Solution** : Ouvrez les autorisations du navigateur, activez l'accès à la caméra et au microphone pour le domaine et rechargez la page.

### Échec du Chat du Styliste / Limites de Débit
- **Problème** : Le chat affiche des erreurs ou se bloque.
- **Solution** : Le serveur gère les limites de débit Gemini `429` et bascule sur un algorithme de sélection basé sur des règles. Vérifiez votre connexion Internet.

### Pics de Mémoire (OOM) sur le VPS
- **Problème** : Pics de CPU/RAM lors des processus de téléversement.
- **Solution** : L'ingestion utilise des verrous de file d'attente séquentiels pour les lots de plus de 5 articles. Assurez-vous que le serveur dispose d'au moins 4 Go de RAM.

---

## 6. Limitations

- **APIs Web Speech des Navigateurs** : La conversion vocale native texte-parole est restreinte à Chrome et Safari ; les autres navigateurs basculent sur la saisie de texte standard.
- **Modulations Client Hors Ligne** : La synthèse vocale mobile hors ligne Piper ONNX utilise moins de profils vocaux que le modèle modal audio Gemini du serveur.
- **Contraintes de Taille d'Image** : Les téléversements d'avatars et de profils sont compressés localement dans le navigateur à 82 % de qualité pour respecter la limite de 16 Mo des documents MongoDB.
- **Portée de l'Analyse des Reçus** : Les reçus flous, déformés ou manuscrits peuvent échouer lors de l'extraction des données.
