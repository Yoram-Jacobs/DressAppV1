# Manuel d'utilisation technique complet de DressApp

Manuel d'utilisation complet et guide de référence technique pour l'écosystème de garde-robe personnelle DressApp, le moteur de stylisme, le marché circulaire et les panneaux d'administration.

---

## 1. Présentation générale & pile technologique

DressApp est un gestionnaire de garde-robe personnelle, un conseiller en stylisme et un marché circulaire basé sur l'IA. Il aide les utilisateurs à gérer leurs vêtements numériquement, à les détourer et à les étiqueter automatiquement, à recevoir des recommandations de tenues adaptées à la météo et au calendrier, à scanner les passeports numériques des produits de l'UE (DPP) et à échanger des vêtements.

### Proposition de valeur principale
- **Intégration de la garde-robe numérique** : Traitement des photos téléchargées ou capturées avec suppression automatisée de l'arrière-plan, catégorisation des vêtements et génération d'étiquettes d'attributs.
- **Styliste virtuel IA** : Un agent conversationnel qui analyse contextuellement votre garde-robe, vos événements Google Calendar et les prévisions météorologiques locales pour suggérer des tenues quotidiennes.
- **Marché circulaire (Circular Marketplace)** : Achat, vente, échange et location sécurisés de vêtements entre pairs afin de réduire les déchets de la fast fashion.
- **Analyses du coût par port (CPW)** : Informations sur la valeur de capitalisation de la garde-robe, les taux d'utilisation et l'optimisation de l'utilisation.

### Architecture technique
- **Backend Edge** : Python 3.11 avec FastAPI, utilisant des pilotes Motor asynchrones connectés à un cluster MongoDB Atlas.
- **Frontend SPA** : Application monopage React 19 utilisant des stores personnalisés `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, des composants Shadcn/UI et `react-i18next` prenant en charge 12 langues.
- **Optimisation de l'état & du réseau** : Déduplication des requêtes en cours, mise en cache du magasin pendant 15 minutes et revalidation des onglets en cas de changement de visibilité (`visibilitychange`), ce qui évite toute requête GET en arrière-plan lorsque l'application est inactive.
- **Machine Learning & calcul des tailles locaux** : Détourage de l'arrière-plan via U2-Net (`rembg`) local sur CPU, analyse des vêtements SegFormer-b2, encodages Fashion-CLIP et modèle de régression des mesures corporelles physiques ANSUR II (`body_predictor.py`). Possibilité de redirection vers des conteneurs GPU auto-hébergés (SegFormer-b3 + BiRefNet) pour des opérations rapides.
- **STT/TTS conversationnel** : Reconnaissance vocale client Web Speech en secours, modulations Gemini 2.5 Flash côté serveur et moteurs Piper/Sherpa-ONNX locaux sur l'appareil pour le fonctionnement hors ligne.
- **Services d'intégration externe** : API OpenWeatherMap pour la météo, Google Calendar OAuth pour l'exportation des plannings quotidiens, OpenStreetMap (Nominatim) pour la saisie automatique des adresses et API REST PayPal Subscriptions/Checkout.

---

## 2. Conditions préalables

### Exigences relatives à l'environnement d'hébergement
- **Matériel** : VPS avec un minimum de 4 Go de RAM (par exemple, hébergement VPS Hetzner hébergeant le site de production `dressapp.co`).
- **Dépendances** : Docker et Docker Compose (y compris le backend, le frontend et la terminaison TLS de Caddy).
- **Variables d'environnement** : Configuration des clés API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` et jetons Google Calendar OAuth).

### Exigences relatives à l'application utilisateur
- **Navigateur Web** : Google Chrome ou Apple Safari (requis pour une compatibilité totale avec les fonctions vocales).
- **Autorisations** : Accordez l'autorisation de caméra (pour les photos de vêtements et les scans de codes QR) et de microphone (pour les conversations vocales).
- **Réseau** : Connexion active pour le traitement LLM, le cache IndexedDB permettant la navigation hors ligne dans le catalogue.

---

## 3. Instructions étape par étape

### 3.1 Intégration des vêtements (Ajout d'éléments)
MÉTHODES D'INTÉGRATION : Photographie, Passeport numérique de produit de l'UE et Reçus d'achat numériques.

#### A. Caméra interactive et téléchargement de fichiers
1. Accédez à l'écran **Ajouter un élément** (Add Item).
2. Sélectionnez **Prendre une photo** (lance l'appareil photo natif) ou cliquez sur **Télécharger des photos** (ouvre le sélecteur de fichiers).
3. Le client calcule le SHA-256 de l'image et le dHash dans le navigateur (~100-180 ms) pour vérifier s'il s'agit d'un doublon dans la garde-robe.
4. Si une correspondance est trouvée, la **boîte de dialogue de vérification des doublons** s'ouvre. Sélectionnez **Ignorer** ou **Ajouter quand même**.
5. Une fois accepté, le serveur démarre un flux NDJSON. Un cadre de prévisualisation temporaire s'affiche dans les 5 à 7 secondes, vous permettant de modifier immédiatement les détails de l'article pendant que le backend termine l'étiquetage.
6. Vérifiez les étiquettes détectées automatiquement (couleur, tissu, coupe, motif, occasion). Si le détourage est incorrect, modifiez la liste déroulante **Catégorie** ; cela déclenchera SegFormer pour détourer à nouveau le vêtement.
7. Cliquez sur **Enregistrer** pour afficher immédiatement l'élément dans la grille de la garde-robe (~16 ms) pendant que la génération de la miniature WebP en arrière-plan se termine.

#### B. Scannage des passeports numériques des produits de l'UE (DPP)
1. Appuyez sur le bouton **Scanner QR (DPP)** sur la page d'ajout d'élément.
2. Accordez les autorisations de caméra et alignez le code QR imprimé sur l'étiquette du vêtement, ou téléchargez une capture d'écran d'un code QR enregistré.
3. Le backend résout l'URL et exécute des contrôles de sécurité SSRF (bloquant les plages d'adresses IP privées).
4. Le système analyse les schémas JSON-LD pour extraire la marque, la composition des matériaux, la traçabilité de la chaîne d'approvisionnement, l'empreinte carbone et les consignes d'entretien.
5. Examinez les données extraites affichées dans le panneau d'accordéon vert **Données DPP vérifiées** et cliquez sur **Enregistrer**.

#### C. Importation de reçus d'achat numériques
1. Ouvrez l'onglet **Importation numérique** (Digital Import).
2. Choisissez une méthode : **Coller du texte**, **Télécharger une image**, **Télécharger un PDF** ou saisissez un **Lien Web**.
3. Le backend utilise des modèles de vision multimodaux pour extraire les données de transaction (marque, prix, taille, catégorie).
4. Les champs analysés sont verrouillés pour les protéger de futures réanalyses visuelles. Cliquez sur **Enregistrer** pour confirmer.

---

## 3.2 AI Virtual Stylist conversationnel
Décrivez vos dilemmes de style et recevez des conseils de tenues parlés à mains libres.

1. Accédez à l'écran **AI Stylist**.
2. Cliquez sur l'icône du microphone `[Microphone]` dans la barre d'entrée du chat.
3. Parlez votre demande (par exemple, "Quel haut s'associe avec mon pantalon beige pour un déjeuner pluvieux en extérieur ?").
4. Si la fonction Web Speech est prise en charge, votre voix se transcrit en direct dans la zone de saisie. Sinon, l'application enregistre un fichier WebM et le télécharge.
5. Le backend dirige la requête vocale vers le conteneur local Gemma4 (en revenant à la transcription de Gemini 2.5 Flash si le serveur est hors ligne).
6. Le styliste traite l'historique de votre garde-robe, les prévisions météo locales et les événements du calendrier pour formuler une proposition de style.
7. Le styliste énonce la réponse en utilisant des profils de voix présélectionnés (`puck`, `aoede` ou `charon`).
8. Appuyez sur **Lire la réponse** (ou **Replay** en mode hébreu) sur la carte pour réécouter l'audio.

---

## 3.3 Profil, préférences et dépendances des sous-systèmes
La page de profil sert de panneau de contrôle central pour DressApp. Les champs de configuration affectent directement les performances et le comportement des modules dérivés.

##### Dépendances et justification des sections de l'accordéon

1. **Photos & scène de l'avatar numérique (`AvatarViewer2D` et `DynamicAvatar`)**
   - **Importance** : Représente votre identité visuelle sur tous les écrans d'essayage en utilisant une scène à double mode (détourage photo réel versus mannequin vectoriel 2D Bezier SVG dynamique).
   - **Dépendances** : Les détourages photo sont traités via U2-Net (`rembg`) local et réduits dans le navigateur à un maximum de 1280px à 82% de qualité pour s'adapter à la limite de 16 Mo des documents de MongoDB. La scène applique des repères de position calibrés (`top-[14.5%]` de col à encolure, `top-[36.5%]` de ceinture à taille et `bottom-[2%]` pour les chaussures) et une échelle proportionnelle poitrine/hanche ($scaleX$). Cliquez sur *Supprimer la photo* pour revenir immédiatement au mannequin vectoriel 2D SVG.

2. **Profil de style (Règles de pudeur, code vestimentaire)**
   - **Importance** : Établit des limites personnelles pour les tenues recommandées, empêchant l'IA de générer des suggestions inappropriées.
   - **Dépendances** : Les paramètres sélectionnés (par exemple, les contraintes de vêtements pudiques) sont transmis directement aux invites du styliste pour Gemini 2.5 Flash, filtrant les articles de la garde-robe avant de les afficher.

3. **Détails personnels (Nom, téléphone, profession)**
   - **Importance** : Personnalise le ton de la communication et oriente les alertes de notification.
   - **Dépendances** : Le nom de l'utilisateur est analysé dynamiquement dans les e-mails et les pushs système. Le numéro de téléphone sert de canal de secours pour les alertes planifiées. Le paramètre de profession est injecté dans le LLM du styliste et le classificateur de Trend Scout pour personnaliser les propositions.

4. **Mesures corporelles & tailles (Modèle de régression ANSUR II et prédicteur de tailles)**
   - **Importance** : Élimine les doutes sur les tailles, permettant le calcul automatique des tailles, la comparaison externe des tailles et l'essayage virtuel de couches précis.
   - **Dépendances** : La saisie de 4 paramètres de base (**Height** (Taille), **Weight** (Poids), **Waist** (Cintres), **Foot Length** (Longueur du pied)) active le modèle de régression ANSUR II de scikit-learn (`body_predictor.py`) pour prédire automatiquement 6 dimensions structurelles (*Épaules*, *Poitrine*, *Hanches*, *Manches*, *Entrejambe*, *Couture extérieure*).
     - **Traduction déterministe des tailles** : Une fois les mesures structurelles prédites, le moteur de tailles les convertit en tailles commerciales : **Taille de chemise** (XS-XXL selon la poitrine), **Taille de pantalon** (Taille en pouces), **Taille de chaussures** (Normes US hommes/femmes et standard européen basé sur la longueur du pied et le sexe), **Talla de robe** (US 0-14+ basé sur la poitrine, la taille et les hanches) et **Taille de soutien-gorge** (Bande + Bonnet basés sur la poitrine et le dessous de poitrine estimé).
     - **Remplissage automatique** : Ces tailles recommandées sont automatiquement saisies dans les champs de *Detailed Edit Mode* du profil.
     - **Intégrations** : Les mesures sont consultées directement par l'Assistant de shopping (extension Chrome) pour lire les grilles de tailles sur les sites partenaires (Zara, Asos) et suggérer la meilleure option.

5. **Style de vie (Situation de famille, sexe)**
   - **Importance** : Personnalise les recommandations par défaut et évalue les algorithmes de contenu.
   - **Dépendances** : La sélection du sexe affecte directement l'algorithme de classement des cartes Trend Scout quotidiennes. Si la catégorie d'une carte d'actualités ne correspond pas au sexe de l'utilisateur, l'algorithme applique une pénalité de -2,0 points, retardant son apparition dans le flux.

6. **Configuration de l'IA (Clés SaaS, mode de périphérie (edge), crédits)**
   - **Importance** : Détermine la facturation, les performances opérationnelles et l'état de la connexion réseau.
   - **Dépendances** : Dirige les requêtes de génération de texte et de voix. Les configurations standard consomment des crédits du système DressApp. La saisie de clés API personnelles (Google AI Studio, Anthropic, OpenAI) redirige les coûts vers les comptes de développeur de l'utilisateur. La sélection du mode de périphérie local dirige les requêtes vers le conteneur local de Gemma sans connexion Internet.

7. **Planificateur & rappels (Fréquence, alerte quotidienne, thème de style)**
   - **Importance** : Gère l'envoi automatique d'alertes de style quotidiennes.
   - **Dépendances** : Active les tâches de `APScheduler` sur le backend FastAPI. Chaque matin, envoie des notifications push via `pywebpush` en utilisant les clés VAPID du client, conformément aux paramètres de style configurés.

8. **Google Calendar (Synchronisation OAuth, règles d'exportation)**
   - **Importance** : Lie votre garde-robe directement à vos événements réels du calendrier.
   - **Dépendances** : Requiert une authentification via Google OAuth. Le planificateur consulte votre calendrier pour identifier les événements, générer des tenues et les exporter directement vers votre agenda Google Calendar.

9. **Services de localisation (Suivi GPS, précision météo)**
   - **Importance** : Coordonne les propositions adaptées à la météo et les filtres géographiques pour les transactions locales.
   - **Dépendances** : Active la géolocalisation inverse `navigator.geolocation`. Les coordonnées sont envoyées à l'API OpenWeatherMap pour ajuster les recommandations du styliste (par exemple, vêtements imperméables pour les averses). Calcule également les distances pour les annonces et les experts locaux.

10. **Voix et langue (Sélection de la voix du styliste virtuel)**
    - **Importance** : Détermine la langue des textes et le profil de la voix.
    - **Dépendances** : Contrôle la langue active pour les traductions via `react-i18next`. La sélection de la voix associe les codes vocaux BCP-47 (par exemple, `he-IL` ou `ar-JO`) aux voix de synthèse vocale du navigateur ou aux modèles Piper TTS locaux.

11. **Inviter des amis (API de partage de données)**
    - **Importance** : Fournit une boucle virale pour l'expansion gratuite de la capacité du Schrank.
    - **Dépendances** : Joint l'ID MongoDB du parrain à l'URL. Les nouvelles inscriptions lisent cet ID et augmentent le `closet_capacity_bonus` du parrain de +10 emplacements automatiquement, mettant à jour les limites du placard dans `closet.py`.

---

## 3.4 Tableau de bord des statistiques de la garde-robe
Analysez la valeur totale de la garde-robe, le suivi de l'utilisation des vêtements et les paramètres CPW.

1. Accédez à **Wardrobe Insights**.
2. **Examinez les indicateurs** :
   - *Valeur de la garde-robe (Closet Worth)* : Somme dynamique des prix d'achat.
   - *Utilisation de la garde-robe (Closet Utilization)* : Pourcentage de vêtements dans la garde-robe portés au moins une fois.
   - *Coût moyen par port (CPW)* : Calculé comme `Prix / Nombre de ports`.
3. **Graphiques de répartition** : Basculez entre les onglets pour voir les visualisations Recharts :
   - *Palette de couleurs* : Répartition des valeurs de couleur hexadécimales dans la garde-robe.
   - *Matériaux* : Répartition en pourcentage des tissus.
   - *Sous-catégories* : Répartition des sous-catégories.
4. **Classement de l'efficacité** : Affiche les 5 vêtements ayant les valeurs de CPW les plus basses de la garde-robe.

---

## 3.5 Zone d'essayage et planificateur de tenues
Créez des tenues, combinez des couches et passez en revue les propositions sur la zone interactive de l'avatar 2D.

1. Ouvrez le planificateur **Outfit Canvas**.
2. **Couches de vêtements extérieurs (Double toile)** : Si votre tenue comprend des vêtements extérieurs (par exemple, une veste) sur une chemise, la page affiche deux canevas d'avatar verticaux : "With Outerwear" (montre la veste sur la couche externe) et "Without Outerwear" (montre la chemise en dessous).
3. **Éléments 2D interactifs** : Cliquez directement sur un vêtement sur le corps de l'avatar pour accéder immédiatement à l'écran de détails de cet article.
4. **Onglet des mesures** : Cliquez sur le bouton de détails et choisissez l'onglet **Metrics** pour voir les critères de compatibilité :
   - *Harmonie des couleurs* (combinaison harmonieuse).
   - *Compatibilité des motifs* (prévention des conflits d'imprimés).
   - *Ajustement corporel* (ajustement des tailles).
   - *Alignement climatique* (adaptation à la saison).
   - *Alignement d'événements* (adaptation au type d'activité).
   - *Alignement de l'emplacement* (vérification du respect des règles de pudeur).
5. **Renommer/Décrire** : Cliquez sur l'icône du crayon pour modifier les noms et les descriptions des tenues.

---

## 3.6 Assistant de valise et voyages
Organisez votre liste de bagages pour les voyages de manière intelligente et évitez le surpoids.

1. Accédez à la page **Suitcase** et remplissez le formulaire de contexte de voyage (destination, dates de début/fin, catégorie de voyage, événements du calendrier).
2. L'IA génère une liste de bagages personnalisée et des tenues quotidiennes en fonction de la durée du voyage et des prévisions météo locales.
3. Suivez la progression du rangement. S'il manque un article important (par exemple, un parapluie pour les jours de pluie, un maillot de bain pour la plage), le système vous avertit et vous suggère des articles du marché ou des magasins locaux.
4. Utilisez le chat intégré pour ajuster les suggestions (par exemple, "Change le jour 2 pour une tenue de soirée décontractée"). L'assistant mettra à jour la valise et conservera le reste de la liste.
5. Appuyez sur **Approve Suitcase** pour la confirmation finale de votre plan d'emballage.

---

## 3.7 Planificateur & rappels quotidiens
Configurez des rappels de style quotidiens pour recevoir automatiquement des suggestions de tenues sur votre téléphone.

1. Ouvrez **Profile** et allez à **Scheduler & Push**.
2. Activez les notifications, définissez l'heure d'alerte quotidienne, la fréquence des jours de la semaine et le thème du style.
3. Chaque matin, la tâche en arrière-plan (`APScheduler`) vérifie les prévisions météo et envoie une alerte push.
4. Appuyez sur l'alerte sur votre mobile (ou accédez au centre de notifications de l'application Web) pour ouvrir une fenêtre contenant 3 tenues suggérées.
5. Enregistrez la suggestion sélectionnée directement dans votre journal de vêtements **Wardrobe Diary**.

---

## 3.8 Le marché circulaire (Vente, Location, Échange, Don)
Participez au marché circulaire de la mode entre pairs.

- **Créer une annonce** : Ouvrez la page de détails d'un élément, sélectionnez **Edit Intent** et choisissez une option publique :
  - *For Sale* (En vente) : Saisissez le prix de vente et la devise (détecte automatiquement votre devise par défaut via vos paramètres régionaux).
  - *Rent* (Location) : Définissez le tarif de location journalier et les conditions de prêt.
  - *Swap* (Échange) : Marquez l'article comme disponible pour l'échange.
  - *Donate* (Don) : Publiez l'article comme cadeau sans frais.
- **Synchronisation de l'état** : Les annonces sont publiées automatiquement dans le flux du marché. Le client utilise `useSyncExternalStore` et le cache IndexedDB local pour charger les résultats de recherche sans délai.
- **Essai virtuel dans le bac à sable (sandbox)** : Les acheteurs/locataires peuvent effectuer un essai virtuel de l'article en vente par rapport aux vêtements de leur propre garde-robe avant de finaliser la transaction.
- **Traitement des transactions** :
  - *Achat/Location* : Finalisez la transaction via les boutons PayPal intégrés. Les webhooks entrants notifient le vendeur, modifient le statut de l'annonce en vendu/loué et enregistrent la transaction dans le grand livre de la plateforme en déduisant la commission de 7 %.
  - *Échange* : Les personnes intéressées proposent des offres d'échange. Le propriétaire reçoit des e-mails de confirmation pour accepter ou rejeter.

---

## 3.9 Tableau de bord d'administration (Admin Panel)
Vérification du fonctionnement du système, comptabilité financière et gestion des comptes d'utilisateurs.

1. Accédez à `/admin` (disponible pour les utilisateurs ayant le rôle d'administrateur).
2. **Présentation générale** : Examinez le volume des transactions et les revenus tirés des commissions de la plateforme. Analysez le tableau **Provider Activity Table** pour surveiller les temps de réponse et les taux d'erreur des services externes (API de Gemini, API de météo).
3. **Fournisseurs (Providers)** : Cliquez sur **Verify Key** pour envoyer un test à l'API de Gemini. Basculez l'interrupteur **Eyes Vision Override** pour rediriger l'analyse des images entre l'endpoint de Gemini par défaut et un conteneur local de Gemma.
4. **Utilisateurs** : Affichez le solde de crédits actifs, les rôles et les paiements totaux. Utilisez des actions directes pour promouvoir ou rétrograder des utilisateurs.
5. **Annonces (Listings)** : Affichez le statut des annonces et désactivez les articles en cas de fraude.

---

## 4. Résultats attendus

- **Chargement d'éléments** : Les éléments apparaissent immédiatement dans la grille de la garde-robe (~16 ms). La suppression de l'arrière-plan s'effectue proprement et génère des fichiers PNG transparentes.
- **Vérification DPP** : Le scannage de passeports de produits valides affiche une carte d'information verte avec des détails de durabilité.
- **Couches de l'avatar** : Les vêtements extérieurs sont représentés correctement sur les chemises dans le canevas de l'avatar 2D sans interférer avec les chaussures ou les chapeaux.
- **Réponse vocale** : Les textes de réponse de l'AI Stylist sont lus automatiquement et s'accompagnent d'un indicateur d'onde de son visuel.
- **Abonnements** : La mise à niveau vers un plan Manager ou Professional supprime immédiatement le message d'avertissement de la limite de capacité de la garde-robe.

---

## 5. Dépannage

### HTTP 402 Payment Required
- **Problème** : Chargement des éléments bloqué. Vous avez atteint la limite de base de la garde-robe de 50 éléments (ou jusqu'à 200 éléments avec des bonus de parrainage).
- **Solution** : Accédez à la **page des tarifs** (`/pricing`) et abonnez-vous au plan Manager ou Professional, ou partagez votre lien de parrainage pour obtenir +10 emplacements par inscription (jusqu'à un maximum de 200 éléments).

### SSRF Blocked / DNS Error sur DPP
- **Problème** : Erreur lors de l'analyse de l'URL du code QR du passeport de produit scanné.
- **Solution** : L'analyseur bloque les adresses IP privées (comme `127.0.0.1` et `192.168.x.x`) pour protéger les serveurs internes de la plateforme. Assurez-vous que les codes QR pointent vers des domaines publics.

### Autorisation de caméra / microphone refusée
- **Problème** : La fenêtre de capture/scan affiche un écran d'erreur avec un 'X', ou la saisie vocale échoue.
- **Solution** : Ouvrez les paramètres de permissions du navigateur, autorisez l'accès à la caméra et au microphone pour le domaine et rechargez la page.

### Échec du chat du styliste / Limites de vitesse atteintes
- **Problème** : Le chat se fige ou affiche des erreurs.
- **Solution** : Le serveur gère les erreurs de limite de vitesse `429` de Gemini et recourt à un algorithme de sélection basé sur des règles prédéfinies. Vérifiez votre connexion Internet.

### Excès de mémoire (OOM) sur les serveurs VPS
- **Problème** : Charge élevée sur le processeur/mémoire du serveur lors des processus de téléchargement de fichiers.
- **Solution** : Le processus de chargement utilise une file d'attente séquentielle pour les chargements de plus de 5 éléments à la fois. Assurez-vous que le serveur dispose d'au moins 4 Go de RAM disponibles.

---

## 6. Limitations

- **API de voix dans le navigateur** : La transcription de la voix vers le texte intégrée est limitée aux navigateurs Chrome et Safari ; les autres navigateurs reviendront au clavier de texte standard.
- **Sortie de voix hors ligne** : Le moteur local Piper ONNX sur les appareils mobiles utilise moins de profils de voix par rapport au modèle audio Gemini du serveur.
- **Limites de taille d'image** : Les images téléchargées pour le profil ou l'avatar sont compressées localement dans le navigateur à une qualité de 82% pour respecter la limite de 16 Mo des documents de MongoDB.
- **Précision de l'analyse des reçus** : Sur des reçus très flous, déformés ou écrits à la main, l'extraction des données de transaction peut échouer.
