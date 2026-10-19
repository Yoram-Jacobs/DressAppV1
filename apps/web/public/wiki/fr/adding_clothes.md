# Ajout et Numérisation de Vêtements

Numérisez votre garde-robe physique en quelques secondes grâce au routage automatique à 3 pipelines, au détourage intelligent et à la complétion générative d'images.

## Aperçu
Ajoutez vos vêtements via des photos en direct, des importations multiples depuis la galerie (y compris des lots mixtes de pièces uniques, de tenues portées et de piles de vêtements), des QR codes de Passeports Numériques des Produits (DPP) ou des reçus numériques (OCR de factures). L'IA locale intégrée détecte automatiquement les caractéristiques de chaque photo, supprime l'arrière-plan, étiquette plus de 20 attributs de mode (y compris les sweats à capuche/hoodies et plus de 60 vêtements traditionnels et culturels) et génère des visuels studio sans aucune clé API requise.

## Prérequis
- Des photos claires et bien éclairées des vêtements (pièces isolées, selfies miroir en pied, mannequins ou vêtements disposés à plat).
- Accès à la caméra pour scanner les articles physiques et les QR codes.
- Reçus numériques ou captures d'écran de factures (PDF / PNG / JPEG) pour les achats en ligne.

## Instructions Étape par Étape

1. **Import Interactif et Lots Mixtes**:
   - Appuyez sur **Ajouter un article** → sélectionnez **Prendre une photo** ou **Importer des photos** pour choisir une ou plusieurs photos depuis votre appareil. Vous pouvez mélanger librement des photos d'articles uniques, des tenues complètes portées et des piles de vêtements dans le même lot sans choisir d'onglet de mode !
   - La détection de doublons intégrée vérifie instantanément si vous avez déjà importé le même vêtement.
2. **Routage Automatique à 3 Pipelines (`GarmentVision`)**:
   - **GarmentVision** analyse automatiquement chaque photo et l'oriente vers le bon pipeline :
     - **Pièce Unique (`Single`)**: Isole un seul vêtement avec un détourage alpha de qualité studio.
     - **Tenue Multi-Pièces (`Multi-Garment`)**: Découpe les tenues complètes portées par une personne ou un mannequin en fiches distinctes (haut, bas, veste/manteau, chaussures et accessoires).
     - **Lot Groupé (`Mass Cluster`)**: Sépare les groupes de vêtements non portés disposés côte à côte ou suspendus à des patères en articles individuels.
3. **Détourage IA et Photos Studio Propres**:
   - Le pipeline de vision intégré supprime automatiquement les arrière-plans pour produire des images PNG transparentes et nettes pour tous les comptes.
4. **Étiquetage Automatique, Sweats à Capuche et Tenues Traditionnelles**:
   - Les comptes du forfait Gratuit utilisent le moteur local **Eyes** de DressApp (`Qwen 2.5 VL 3B` affiné), tandis que les abonnés **Manager** (10 $/mois) et **Professional** (15 $/mois) bénéficient du modèle Cloud rapide (`Google Gemini 3.5 Flash`) pour extraire plus de 20 attributs de mode — en distinguant précisément les **Sweats & Hoodies** des **T-shirts** et en reconnaissant plus de 60 **vêtements traditionnels et culturels** (Sari, Kimono, Thobe, Caftan, Hanbok, Cheongsam, Ao Dai, Dirndl, Kilt, etc.) dans les 13 langues.
5. **Réparation Générative Avancée (Nano Banana)**:
   - Nano Banana inspecte les articles recadrés pour détecter les occlusions (sacs, mains) et les bords coupés, reconstruisant automatiquement le tissu manquant en photos studio complètes sans clé API externe.
6. **Reçus Numériques et Étiquettes DPP**:
   - Passez à **Import numérique** pour analyser vos e-mails de confirmation de commande ou factures, verrouillant le prix d'achat et les tailles vérifiées.
   - Appuyez sur **Scanner QR (DPP)** sur l'étiquette pour importer les données de traçabilité et d'entretien du Passeport Numérique des Produits de l'UE.
7. **Enregistrer dans la Garde-Robe**:
   - Appuyez sur **Enregistrer**. Les articles apparaissent immédiatement dans la grille de votre garde-robe.

## Résultats Attendus
Chaque vêtement apparaît dans votre garde-robe numérique sous la forme d'une photo studio centrée et détourée, avec des sous-catégories précises, des balises culturelles et des attributs de recherche complets.

## Dépannage
- **Vêtements Coupés ou Partiels**: Centrez bien le vêtement sur un fond contrasté. Nano Banana peut reconstruire automatiquement les cols ou ourlets coupés.
- **Éclairage et Contraste**: Pour de meilleurs résultats sur les vêtements sombres, photographiez-les sur un fond clair et contrasté.
- **Erreurs OCR sur les Reçus**: Utilisez le sélecteur de zone interactif sur les images de reçus pour désigner manuellement chaque ligne de produit.

## Limites
- Les importations par lots haute résolution (>5 articles) sont traitées via des files d'attente asynchrones en arrière-plan afin de garantir une interface fluide sans expiration du navigateur.
