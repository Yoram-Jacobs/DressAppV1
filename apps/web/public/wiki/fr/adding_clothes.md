# Numérisation et Ajout de Vêtements

Numérisez votre garde-robe physique en quelques secondes grâce au scan IA multimodal, au détourage intelligent de l'arrière-plan et à la reconstruction d'image automatique.

## Vue d'ensemble
Ajoutez vos vêtements via l'appareil photo en direct, l'importation d'images multiples depuis la galerie, les codes QR du Passeport Numérique des Produits (DPP) ou vos reçus numériques (OCR de factures). L'IA sur site intégrée supprime automatiquement les arrière-plans, étiquette plus de 20 attributs de mode et prépare des détourages de qualité studio sans aucune clé API requise.

## Prérequis
- Photos claires et bien éclairées de vos vêtements (selfies devant un miroir, photos de tenues en pied ou vêtements posés à plat).
- Autorisation d'accès à l'appareil photo pour scanner les articles physiques et les codes QR.
- Reçus numériques ou captures d'écran de factures (PDF / PNG / JPEG) pour vos achats en ligne.

## Instructions étape par étape

1. **Prise de vue et importation interactive** :
   - Appuyez sur **Ajouter un article** &rarr; sélectionnez **Prendre une photo** ou téléversez une ou plusieurs photos de tenues depuis votre appareil.
   - La détection de doublons intégrée vérifie instantanément si vous avez déjà importé ce même vêtement.
2. **Segmentation IA et détection multi-articles** :
   - Le modèle de vision isole chaque vêtement distinct (vestes, hauts, jupes, pantalons, chaussures, accessoires) en un seul passage.
3. **Détourage IA et clichés de studio nets** :
   - Le pipeline de vision intégré supprime automatiquement les arrière-plans pour générer des images PNG transparentes et nettes pour tous les comptes.
4. **Étiquetage automatique des métadonnées** :
   - Les comptes du forfait Gratuit (Free Tier) utilisent le moteur sur site **Eyes** de DressApp (actuellement un modèle `Qwen 2.5 VL 3B` affiné), tandis que les abonnés aux forfaits **Manager** et **Professional** bénéficient du modèle Cloud rapide (`Google Gemini 3.5 Flash`) pour extraire plus de 20 attributs de mode (couleurs, composition des tissus, sous-catégorie, code vestimentaire, marque et état).
5. **Réparation photo générative avancée (Nano Banana)** :
   - Nano Banana inspecte les articles recadrés pour détecter les occultations (sacs, mains) et les bords du cadre, complétant et reconstruisant automatiquement le tissu manquant pour obtenir des photographies de studio complètes sans aucune clé API externe requise.
6. **Reçus numériques et balises DPP** :
   - Passez à **Import numérique** pour analyser vos e-mails de confirmation de commande ou vos factures, verrouillant ainsi le prix d'achat et les tailles vérifiées.
   - Appuyez sur **Scanner QR (DPP)** sur l'étiquette pour importer les informations de traçabilité du Passeport Numérique des Produits de l'UE et les consignes d'entretien.
7. **Enregistrer dans le dressing** :
   - Appuyez sur **Enregistrer**. Les articles apparaissent immédiatement dans la grille de votre dressing.

## Résultats attendus
Chaque vêtement apparaît dans votre garde-robe numérique sous la forme d'une photographie de qualité studio centrée et nette, dotée d'attributs de recherche entièrement indexés et d'étiquettes taxonomiques riches.

## Dépannage
- **Vêtements coupés ou partiels sur les photos** : Centrez soigneusement le vêtement sur un arrière-plan contrasté. Nano Banana peut reconstruire automatiquement les cols ou les ourlets coupés.
- **Éclairage et contraste** : Pour de meilleurs résultats sur les vêtements sombres, photographiez-les sur un fond clair contrasté.
- **Erreurs de correspondance OCR sur les reçus** : Utilisez le sélecteur de zone interactif sur les images de reçus pour désigner manuellement les lignes de produits individuelles.

## Limites
- Les importations par lots en haute résolution (> 5 articles) sont traitées via des files d'attente asynchrones en arrière-plan afin de garantir une performance réactive sans expiration du délai du navigateur.
