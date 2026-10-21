# Manuel d'Utilisation Technique Complet de DressApp

Manuel d'utilisation complet et guide de référence technique pour l'écosystème de garde-robe personnelle DressApp, le moteur de stylisme, la place de marché circulaire et les panneaux d'administration.

---

## 1. Vue d'ensemble et pile technologique

DressApp est un gestionnaire de garde-robe personnelle propulsé par l'IA, un conseiller en stylisme et une place de marché circulaire. Il aide les utilisateurs à gérer numériquement leurs vêtements, à les détourer et les étiqueter automatiquement, à recevoir des recommandations de tenues adaptées à la météo et à leur agenda, à scanner les Passeports Numériques des Produits de l'UE (DPP) et à échanger des vêtements.

### Proposition de valeur principale
- **Intégration de la garde-robe numérique** : Traitement des photos prises en direct ou téléversées avec suppression automatisée de l'arrière-plan, catégorisation des vêtements et génération d'étiquettes d'attributs.
- **Styliste virtuel IA** : Un agent conversationnel qui analyse en contexte votre garde-robe, vos événements Google Calendar et les prévisions météorologiques locales pour suggérer des tenues quotidiennes.
- **Place de marché circulaire (Circular Marketplace)** : Achat, vente, échange et location sécurisés de vêtements entre particuliers afin de réduire les déchets de la fast fashion.
- **Analyses du coût par port (CPW)** : Informations détaillées sur la valeur de capitalisation de la garde-robe, les taux d'utilisation et l'optimisation de l'usage des vêtements.

### Architecture technologique
- **Backend Edge** : Python 3.11 avec FastAPI, utilisant des pilotes asynchrones Motor connectés à une base de données dédiée sur site (on-premises) MongoDB 7.0 sur stockage NVMe.
- **Frontend SPA** : Application monopage React 19 utilisant des stores personnalisés `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, des composants primitifs Shadcn/UI et `react-i18next` prenant en charge 13 langues.
- **Optimisation de l'état et du réseau** : Déduplication des requêtes en cours, mise en cache des stores pendant 15 minutes et revalidation des onglets sur l'événement `visibilitychange`, garantissant zéro requête GET en arrière-plan lorsque l'application est inactive.
- **Apprentissage automatique local et calcul des tailles** : Détourage d'arrière-plan local sur CPU via U2-Net (`rembg`), analyse vestimentaire SegFormer-b2, plongements vectoriels (embeddings) Fashion-CLIP et modèle de régression des mensurations corporelles physiques ANSUR II (`body_predictor.py`). Inclut le conteneur dédié sur site `dressapp-eyes` exécutant un modèle `Qwen 2.5 VL 3B` affiné (`Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj`) sur le port 7860 pour les utilisateurs du forfait Gratuit (Free Tier) et le basculement automatique de secours des quotas.
- **STT/TTS conversationnel** : Reconnaissance vocale Web Speech côté client en temps réel, modulations multimodales Gemini côté serveur et moteurs hors ligne embarqués Piper/Sherpa-ONNX.
- **Services d'intégration externes** : API OpenWeatherMap pour les données météo, Google Calendar OAuth pour la synchronisation de l'agenda quotidien, autocomplétion d'adresses OpenStreetMap (Nominatim) et API REST PayPal Subscriptions/Checkout.

---

## 2. Prérequis

### Exigences relatives à l'environnement hôte
- **Matériel** : VPS doté d'au moins 8 Go de RAM (par ex. VPS Hetzner CPX32 hébergeant l'environnement de production `dressapp.co`).
- **Dépendances** : Pile Docker et Docker Compose (comprenant MongoDB 7.0 sur site, le backend, le serveur d'inférence eyes, le frontend et la terminaison TLS Caddy).
- **Variables d'environnement** : Configuration des clés d'API (`GEMINI_API_KEY`, `EYES_API_TOKEN`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` et jetons Google Calendar OAuth).

### Exigences relatives à l'application utilisateur
- **Navigateur Web** : Google Chrome ou Apple Safari (requis pour une compatibilité complète avec les fonctionnalités vocales).
- **Autorisations** : Accorder l'autorisation d'accès à la caméra (pour les photos de vêtements et le scan de codes QR) et au microphone (pour les conversations vocales).
- **IA multiniveau sans clé externe (Zero-BYOK)** : Les utilisateurs gratuits utilisent le modèle sur site Eyes (`Qwen 2.5 VL 3B`) de DressApp ; les abonnés aux forfaits Manager et Professional bénéficient du modèle Cloud rapide (`Gemini 3.5 Flash`). Aucune clé API fournie par l'utilisateur n'est nécessaire.
- **Réseau** : Connexion active pour le traitement LLM, avec mise en cache IndexedDB permettant la consultation hors ligne du catalogue.

---

## 3. Instructions étape par étape

### 3.1 Intégration des vêtements (Ajout d'articles)
PARADIGMES D'INTÉGRATION : Photographie, Passeports Numériques des Produits de l'UE et Reçus de commerce numérique.

#### A. Caméra Interactive, Import de Lots Mixtes et Routage Automatique à 3 Pipelines
1. Accédez à l'écran **Ajouter un article** (*Add Item*).
2. Sélectionnez **Prendre une photo** (ouvre l'appareil photo natif) ou cliquez sur **Importer des photos** (ouvre le sélecteur de fichiers). Vous pouvez importer plusieurs photos aux caractéristiques mixtes dans un seul lot (pièces uniques, tenues complètes sur une personne/un mannequin et piles/groupes de vêtements non portés) sans sélectionner d'onglet de mode manuel.
3. Le client calcule dans le navigateur le condensat SHA-256 et le dHash horizontal (~100-180 ms) de chaque image pour vérifier l'absence de doublon dans votre garde-robe.
4. Si une correspondance est trouvée, la **Boîte de dialogue de détection des doublons** s'ouvre avec les aperçus correspondants. Choisissez **Ignorer** (*Skip*) ou **Ajouter quand même** (*Add anyway*).
5. **Routage Automatique à 3 Pipelines (`detect_photo_pipeline`)** : Pour chaque photo acceptée, `clothing_parser.py` inspecte les masques sémantiques SegFormer (`face_skin_ratio`, `anatomical_stack`, composantes connexes) et oriente automatiquement la photo vers :
   - **Pipeline `single`** : Vêtement unique isolé avec détourage alpha studio (`rembg` + intersection de masque SegFormer).
   - **Pipeline `multi`** : Tenue multi-pièces portée par un modèle ou un mannequin, extrayant séparément haut, bas, vêtement d'extérieur, chaussures et accessoires.
   - **Pipeline `mass`** : Lots de vêtements non portés, dispositions à plat ou articles suspendus à des patères (`parse_unworn_cluster`), séparant les composantes disjointes et appliquant une segmentation couleur tout en protégeant les motifs imprimés.
6. Le serveur diffuse des trames NDJSON progressives (`detect`, `field`, `item`, `done`) en quelques secondes, vous permettant de modifier les détails immédiatement pendant que le backend termine l'étiquetage — y compris la distinction précise entre **Sweats & Hoodies** (*Sweatshirts & Hoodies*) et **T-shirts** (*T-Shirt*) ainsi que plus de 60 **tenues traditionnelles et culturelles** dans les 13 langues.
7. Vérifiez les étiquettes détectées automatiquement (couleur, matière, coupe, motif, code vestimentaire, occasion). Si la forme du détourage est incorrecte, modifiez le menu déroulant **Catégorie** ; cela déclenche le recadrage automatique par SegFormer.
8. Cliquez sur **Enregistrer** pour afficher immédiatement l'article dans la grille (~16 ms) pendant que la génération des miniatures WebP et les complétions génératives Nano Banana se terminent en arrière-plan.

#### B. Scan des Passeports Numériques des Produits de l'UE (DPP)
1. Appuyez sur le bouton **Scanner QR (DPP)** sur la page Ajouter un article.
2. Accordez les autorisations de caméra et alignez le code QR imprimé sur l'étiquette du vêtement, ou téléversez une capture d'écran d'un code QR enregistré.
3. Le backend résout l'URL et exécute des contrôles de sécurité SSRF (bloquant les plages d'adresses IP privées).
4. Le système analyse les schémas JSON-LD pour extraire la marque, la composition des matériaux, la traçabilité de la chaîne d'approvisionnement, l'empreinte carbone et les consignes d'entretien.
5. Vérifiez les données extraites affichées dans le panneau accordéon vert **Données DPP vérifiées** et cliquez sur **Enregistrer**.

#### C. Importation de reçus de commerce numérique
1. Ouvrez l'onglet **Import numérique (Digital Import)**.
2. Choisissez un sous-mode : **Coller du texte**, **Téléverser une image**, **Téléverser un PDF** ou saisir un **Lien Web**.
3. Le backend utilise des modèles de vision multimodaux pour extraire les informations de transaction (marque, prix, taille, catégorie).
4. Les champs extraits sont verrouillés par le reçu afin de les protéger contre toute réanalyse visuelle ultérieure. Cliquez sur **Enregistrer** pour confirmer.

---

### 3.2 Styliste virtuel IA conversationnel
Décrivez vos dilemmes vestimentaires et recevez des conseils de tenues vocaux mains libres.

1. Accédez à l'écran **AI Stylist**.
2. Cliquez sur l'icône du microphone `[Microphone]` dans la barre de saisie du chat.
3. Énoncez votre demande (par ex. « Quel haut va avec mon pantalon beige pour un déjeuner pluvieux en terrasse ? »).
4. Si l'API Web Speech est prise en charge, votre voix est transcrite en direct dans le champ de saisie. Sinon, l'application enregistre un fichier WebM et le téléverse.
5. Le backend achemine les requêtes des utilisateurs Gratuits vers le conteneur sur site Eyes (`Qwen 2.5 VL 3B` affiné) et celles des abonnés aux forfaits Manager et Professional vers le modèle Cloud rapide (`Google Gemini 3.5 Flash`), avec basculement automatique vers Eyes sur site en cas de limite de débit cloud.
6. Le styliste analyse l'historique de votre garde-robe, les prévisions météo locales et les événements de votre calendrier pour formuler une proposition de tenue.
7. Le styliste énonce la réponse à l'aide de profils vocaux présélectionnés (`puck`, `aoede` ou `charon`).
8. Appuyez sur **Écouter la réponse** (ou **Replay** en mode hébreu) sur la carte pour réécouter l'audio vocal.

---

### 3.3 Profil, préférences et dépendances des sous-systèmes
La page Profil sert de panneau de contrôle central pour DressApp. Les champs de configuration ont un impact direct sur les performances, le routage et le comportement des modules en aval.

##### Dépendances et justification des sections en accordéon

1. **Photos et scène d'avatar dynamique 3D (`AvatarViewer2D`, `DynamicAvatar` et `closetGarmentFitter`)**
   - **Pourquoi est-ce important ?** : Génère votre identité visuelle sur tous les canevas d'essayage grâce à une scène bi-mode : un maillage humain 3D MB-Lab WebGL réaliste (`avatar_male_1.glb` et `avatar_female_1.glb`, avec repli SVG Bézier 2D) ou une découpe segmentée de votre photo en pied réelle.
   - **Dépendances du sous-système** : L'avatar 3D se transforme dynamiquement dans un canevas orthographique `200 x 450` selon votre taille et vos circonférences corporelles (`scaleY` découplé de `scaleXZ`) et applique 8 nuances réalistes de carnation Monk (`SkinTonePicker.jsx`). Les découpes photo sont détourées localement via U2-Net (`rembg`) et réduites dans le navigateur à 1280 px maximum à 82 % de qualité pour respecter la limite de document de 16 Mo de MongoDB. Les 48 articles d'onboarding pré-ajustés ainsi que les découpes de la garde-robe utilisateur sont projetés via `closetGarmentFitter.js` et le découpage horizontal dynamique (`FittedGarmentLayer`) sur les épaules, les bras écartés, le torse, les jambes en posture en A et les pieds du modèle 3D. Cliquez sur *Supprimer la photo* pour revenir instantanément à l'avatar 3D.

2. **Profil de style (Règles de pudeur, code vestimentaire)**
   - **Pourquoi est-ce important ?** : Établit des limites personnelles pour les tenues recommandées, empêchant l'IA de générer des suggestions de style inappropriées.
   - **Dépendances des sous-systèmes** : Les paramètres sélectionnés (par ex. les contraintes vestimentaires de pudeur) sont injectés directement dans les invites de stylisme pour Gemini 2.5 Flash, filtrant les résultats de garde-robe correspondants avant leur affichage.

3. **Détails (Nom, Téléphone, Profession)**
   - **Pourquoi est-ce important ?** : Personnalise le ton de communication et achemine les alertes de notification.
   - **Dépendances des sous-systèmes** : Le nom de l'utilisateur est inséré dynamiquement dans les e-mails et les notifications push système. Le numéro de téléphone sert de registre de secours pour les alertes programmées. Le paramètre de profession est transmis au LLM du styliste et à l'algorithme de classement personnalisé de Trend Scout pour adapter les propositions.

4. **Mensurations corporelles et tailles (Modèle de régression ANSUR II et prédicteur de tailles)**
   - **Pourquoi est-ce important ?** : Élimine les approximations de taille, permettant le calcul automatique des tailles commerciales, la comparaison sur les boutiques externes et une superposition virtuelle précise.
   - **Dépendances des sous-systèmes** : La saisie de 4 paramètres de base (**Taille/Hauteur**, **Poids**, **Tour de taille**, **Longueur du pied**) déclenche le modèle de régression scikit-learn ANSUR II (`body_predictor.py`) pour prédire automatiquement 6 dimensions structurelles (*Épaules*, *Poitrine*, *Hanches*, *Manche*, *Entrejambe*, *Longueur extérieure*).
     - **Traduction déterministe des tailles** : Une fois les mensurations continues prédites, le moteur de tailles du backend les convertit dynamiquement en tailles de vêtements commerciales : **Taille de chemise** (XS-XXL selon la poitrine), **Taille de pantalon** (tour de taille en pouces), **Pointure de chaussures** (normes US Homme/Femme et UE basées sur la longueur du pied et le genre), **Taille de robe** (US 0-14+ selon la poitrine, la taille et les hanches) et **Taille de soutien-gorge** (tour de dos + bonnet basés sur la poitrine et le dessous de poitrine estimé).
     - **Remplissage automatique** : Ces tailles commerciales recommandées sont automatiquement renseignées dans les champs du *Mode d'édition détaillée* du tableau de bord du profil.
     - **Intégrations** : Les mensurations sont interrogées directement par les scripts de contenu de l'extension Chrome **Shopping Assistant** pour lire les tableaux de tailles sur les sites partenaires (Zara, Asos) et recommander la bonne taille.

5. **Mode de vie (Situation familiale, Sexe)**
   - **Pourquoi est-ce important ?** : Adapte les recommandations par défaut et pondère les algorithmes de contenu.
   - **Dépendances des sous-systèmes** : La sélection du sexe influe directement sur la logique de classement des cartes quotidiennes Trend Scout. Si la catégorie d'une carte d'actualité ne correspond pas au sexe de l'utilisateur, l'algorithme applique une pénalité de score de -2,0, la rétrogradant dans le flux.

6. **Routage des modèles d'IA et forfaits d'abonnement (Routage multiniveau Zero-BYOK et crédits)**
   - **Pourquoi est-ce important ?** : Détermine le routage multiniveau des modèles et la consommation de crédits sans aucune clé API utilisateur requise.
   - **Dépendances des sous-systèmes** : Les utilisateurs du forfait Gratuit sont routés vers le conteneur sur site Eyes (`Qwen 2.5 VL 3B` affiné). Les abonnés aux forfaits Manager et Professional sont routés vers le modèle Cloud rapide (`Google Gemini 3.5 Flash`), avec basculement automatique de secours des quotas vers Eyes sur site.

7. **Planificateur et notifications Push (Fréquence, alarme quotidienne, orientation de style)**
   - **Pourquoi est-ce important ?** : Gère l'envoi automatique de suggestions de style quotidiennes par notification push.
   - **Dépendances des sous-systèmes** : Active les tâches planifiées `APScheduler` sur le backend FastAPI. Chaque matin, il déclenche des notifications push via `pywebpush` à l'aide des clés VAPID du client, en fonction des paramètres de style sélectionnés.

8. **Google Calendar (Synchronisation OAuth, règles d'exportation)**
   - **Pourquoi est-ce important ?** : Relie directement votre garde-robe aux événements réels de votre calendrier.
   - **Dépendances des sous-systèmes** : S'authentifie via Google OAuth. Le planificateur interroge votre calendrier pour identifier les événements, compose des tenues et exporte les événements vestimentaires directement dans votre agenda Google Calendar.

9. **Services de localisation (Suivi GPS, précision météo)**
   - **Pourquoi est-ce important ?** : Coordonne les suggestions adaptées à la météo et les filtres de rayon géographique pour les transactions locales.
   - **Dépendances des sous-systèmes** : Déclenche le géocodage inverse via `navigator.geolocation`. Les coordonnées sont envoyées à l'API OpenWeatherMap pour ajuster les recommandations du styliste (par ex. vêtements de pluie en cas d'averse). Calcule également les distances pour les annonces locales de la Place de marché et les experts (par ex. vérification du rayon autour de Lisbonne).

10. **Voix et langue (Sélection de la voix du styliste virtuel)**
    - **Pourquoi est-ce important ?** : Définit les dictionnaires linguistiques de texte et les modulations vocales.
    - **Dépendances des sous-systèmes** : Contrôle la langue active des traductions via `react-i18next`. La sélection de la voix associe les codes vocaux BCP-47 (par ex. `he-IL` ou `ar-JO`) aux voix de synthèse Web Speech du client ou aux modèles hors ligne Piper TTS.

11. **Inviter des amis (API de partage de parrainage)**
    - **Pourquoi est-ce important ?** : Offre une boucle virale permettant d'augmenter gratuitement la capacité du dressing.
    - **Dépendances des sous-systèmes** : Ajoute l'identifiant MongoDB du parrain à l'URL. Les nouvelles inscriptions interrogent dynamiquement cet identifiant et incrémentent de manière atomique le champ `closet_capacity_bonus` du parrain de +10 emplacements, modifiant les gardes-fous de limite dans `closet.py`.

---

### 3.4 Tableau de bord des statistiques de la garde-robe (Wardrobe Insights)
Analysez la valeur de capitalisation de votre garde-robe, suivez le taux d'utilisation des vêtements et évaluez les paramètres de coût par port.

1. Accédez à **Statistiques de la garde-robe (Wardrobe Insights)**.
2. **Consultez les indicateurs** :
   - *Valeur du dressing (Closet Worth)* : Somme dynamique des prix d'achat.
   - *Taux d'utilisation (Closet Utilization)* : Pourcentage de vêtements du dressing portés au moins une fois.
   - *Coût moyen par port (CPW)* : Calculé selon la formule `Prix / Nombre de ports`.
3. **Graphiques de répartition** : Basculez entre les onglets pour afficher les visualisations Recharts :
   - *Palette de couleurs* : Répartition des codes hexadécimaux associés.
   - *Matériaux* : Répartition en pourcentage des tissus.
   - *Sous-catégories* : Sous-catégories répertoriées.
4. **Classement d'efficacité** : Consultez le top 5 des vêtements présentant les scores de coût par port les plus bas.

---

### 3.5 Toile de tenue et planificateur (Outfit Canvas & Planner)
Composez, superposez et examinez des propositions de tenues sur une toile d'avatar 2D interactive.

1. Ouvrez le planificateur **Outfit Canvas**.
2. **Superposition des vêtements d'extérieur (Double toile)** : Si votre tenue comprend un vêtement d'extérieur (par ex. une veste) par-dessus un haut, la page affiche deux modules de toile verticaux : « Avec vêtement d'extérieur » (montrant la veste superposée) et « Sans vêtement d'extérieur » (révélant le haut en dessous).
3. **Éléments 2D interactifs** : Appuyez directement sur n'importe quelle pièce vestimentaire sur le corps de l'avatar. L'application vous redirige directement vers l'écran de détails de ce vêtement.
4. **Onglet des indicateurs (Metrics)** : Cliquez sur le bouton de détails et choisissez l'onglet **Metrics** pour afficher les barres de progression des critères de compatibilité :
   - *Harmonie des couleurs* (harmonie neutre)
   - *Compatibilité des motifs* (prévention des dissonances d'imprimés)
   - *Ajustement corporel* (correspondance des tailles)
   - *Adéquation météo* (pertinence saisonnière)
   - *Adéquation à l'événement* (pertinence par rapport à l'activité)
   - *Adéquation au lieu* (vérification des règles de pudeur)
5. **Renommer / Décrire** : Cliquez sur l'icône Crayon pour modifier le nom et la description de la tenue.

---

### 3.6 Assistant Valise (Suitcase Assistant)
Organisez vos besoins en bagages pour vos voyages sans surcharger votre valise.

1. Accédez à la page **Valise (Suitcase)** et remplissez le formulaire de contexte du voyage (destination, dates de début et de fin, catégorie de voyage, événements du calendrier).
2. L'IA génère une liste de bagages personnalisée ainsi que des tenues quotidiennes basées sur la durée du séjour et les prévisions météorologiques.
3. Suivez la progression de votre valise. Si un article important manque (par ex. un parapluie pour la pluie, un maillot de bain pour la plage), le système vous alerte et suggère des articles correspondants issus de la place de marché ou de boutiques locales.
4. Utilisez la boîte de discussion intégrée pour affiner les suggestions (par ex. « Change le jour 2 pour une tenue de soirée décontractée »). L'assistant modifie la valise tout en préservant le reste de la liste.
5. Appuyez sur **Approuver la valise (Approve Suitcase)** pour finaliser votre plan.

---

### 3.7 Planificateur et rappels Push
Configurez des alertes de style quotidiennes pour recevoir automatiquement des recommandations de tenues.

1. Ouvrez **Profil** et accédez à **Planificateur et Push (Scheduler & Push)**.
2. Activez les notifications, définissez une heure de notification quotidienne, la fréquence hebdomadaire et le thème de style privilégié.
3. Chaque matin, la tâche planifiée en arrière-plan (`APScheduler`) vérifie les prévisions météo et envoie une notification push.
4. Appuyez sur la notification sur votre appareil (ou consultez le Centre de notifications de l'application web) pour ouvrir une boîte de dialogue présentant 3 suggestions de tenues.
5. Enregistrez directement une suggestion dans votre **Journal de garde-robe (Wardrobe Diary)**.

---

### 3.8 Place de marché (Revente, Location, Échange, Don)
Participez à la place de marché de mode circulaire entre particuliers.

- **Créer une annonce** : Ouvrez la page de détails d'un article, sélectionnez **Modifier l'intention (Edit Intent)** et choisissez une intention non privée :
  - *À vendre (For Sale)* : Saisissez le prix affiché et la devise (détecte automatiquement votre devise par défaut via les préférences régionales).
  - *À louer (Rent)* : Définissez le tarif de location journalier et les conditions d'emprunt.
  - *Échange (Swap)* : Marquez l'article comme ouvert au troc.
  - *Don (Donate)* : Publiez l'article gratuitement.
- **Synchronisation de l'état** : Les annonces se propagent automatiquement dans le flux. Le client utilise `useSyncExternalStore` et la mise en cache IndexedDB pour charger les paramètres de recherche sans aucune latence.
- **Bac à sable d'essayage (Try-On Sandbox)** : Les locataires et acheteurs peuvent essayer virtuellement un article d'une annonce avec les vêtements de leur propre dressing privé avant de passer commande.
- **Paiement transactionnel** :
  - *Achat / Location* : Finalisez la transaction via les boutons PayPal intégrés. Les webhooks capturés informent le vendeur, basculent l'état de l'annonce sur vendu/loué et enregistrent les transactions dans le grand livre après déduction des frais de plateforme de 7 %.
  - *Troc (Échange)* : Les utilisateurs intéressés proposent des échanges. Le créateur de l'annonce reçoit des e-mails de confirmation pour accepter ou refuser.

---

### 3.9 Tableau de bord du panneau d'administration
Validation de la disponibilité du système, comptabilité financière et gestion des comptes utilisateurs.

1. Accédez à `/admin` (accessible aux rôles d'administrateur).
2. **Vue d'ensemble (Overview)** : Auditez les volumes bruts et les résumés de revenus des frais de plateforme. Inspectez la **Table d'activité des fournisseurs (Provider Activity Table)** pour consulter les statistiques de disponibilité en aval (API Gemini, latence du service météo et taux d'erreur).
3. **Fournisseurs (Providers)** : Cliquez sur **Vérifier la clé (Verify Key)** pour envoyer un ping direct à l'API Gemini. Basculez le commutateur **Eyes Vision Override** pour router l'analyse d'images entre le point de terminaison Gemini par défaut et un conteneur local.
4. **Utilisateurs (Users)** : Consultez les crédits actifs, les rôles et le total des paiements effectués. Utilisez les actions directes pour promouvoir ou rétrograder des utilisateurs.
5. **Annonces (Listings)** : Consultez l'état des annonces et basculez les indicateurs d'activation pour suspendre les articles frauduleux.

---

## 4. Résultats attendus

- **Intégration** : Les articles peuplent immédiatement la grille du dressing (~16 ms). Les détourages d'arrière-plan produisent des images PNG transparentes et nettes.
- **Badge DPP vérifié** : Le scan de passeports valides affiche la carte d'information verte contenant les détails de durabilité.
- **Vêtements d'extérieur sur l'avatar** : Les vêtements d'extérieur s'affichent correctement superposés par-dessus les hauts sur la toile de l'avatar 2D sans masquer les couvre-chefs ni les chaussures.
- **Réponse vocale** : Les réponses textuelles du styliste virtuel lancent automatiquement la lecture audio vocale avec un indicateur visuel d'onde sonore.
- **Abonnements** : Le passage à un forfait Manager ou Professional supprime immédiatement l'avertissement de limite de capacité du dressing.

---

## 5. Dépannage

### Erreur HTTP 402 Payment Required
- **Problème** : Intégration bloquée. Vous avez atteint la limite de base de 50 articles du dressing (ou jusqu'à 150 articles avec les bonus de parrainage).
- **Solution** : Rendez-vous sur la **page Tarifs** (`/pricing`) et souscrivez au forfait Manager ou Professional, ou partagez votre lien d'invitation pour obtenir +10 emplacements par inscription (jusqu'à 150 articles maximum).

### Blocage SSRF / Erreur DNS sur le DPP
- **Problème** : L'URL du passeport QR scanné ne parvient pas à être analysée.
- **Solution** : L'analyseur bloque les adresses IP privées (par ex. `127.0.0.1`, `192.168.x.x`) afin de protéger les serveurs internes. Assurez-vous que les codes QR pointent vers des domaines publics.

### Autorisation de caméra / microphone refusée
- **Problème** : La fenêtre de capture/scan affiche un écran d'erreur « X », ou la saisie vocale échoue.
- **Solution** : Ouvrez les autorisations du navigateur, activez l'accès à la caméra et au microphone pour le domaine, puis rechargez la page.

### Échec du chat du styliste / Limites de débit
- **Problème** : Le chat affiche des erreurs ou se fige.
- **Solution** : Le serveur intercepte les limites de débit `429` de Gemini et bascule vers un algorithme de sélection de garde-robe basé sur des règles ou le moteur local Eyes. Vérifiez votre connexion Internet.

### Pics de saturation mémoire (OOM) sur le VPS
- **Problème** : Pics d'utilisation CPU/RAM lors des processus de téléversement.
- **Solution** : L'intégration utilise des verrous de file d'attente séquentiels pour les lots de plus de 5 articles. Assurez-vous que le serveur dispose d'au moins 4 Go de RAM.

---

## 6. Limites

- **API Web Speech du navigateur** : La transcription native de la parole en texte (Speech-to-Text) est limitée à Chrome et Safari ; les autres navigateurs basculent vers la saisie textuelle standard.
- **Modulations clientes hors ligne** : La synthèse vocale mobile hors ligne Piper ONNX utilise moins de profils vocaux que le modèle audio Gemini côté serveur.
- **Contraintes de taille d'image** : Les téléversements d'avatar et de profil sont compressés localement dans le navigateur à une qualité de 82 % afin de respecter la limite de document de 16 Mo de MongoDB.
- **Portée de l'analyse des reçus** : Les reçus très flous, déformés ou manuscrits peuvent faire échouer l'extraction des données.
