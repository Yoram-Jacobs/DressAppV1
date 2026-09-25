# Numérisation & Ajout de Vêtements

Numérisez votre garde-robe physique en quelques secondes grâce au scan IA multimodal, au détourage intelligent et à la reconstruction d'image automatique.

## Vue d'ensemble
Ajoutez vos vêtements via l'appareil photo en direct, l'importation multiple depuis la galerie, les codes QR du Passeport Numérique des Produits (DPP) ou vos factures numériques (OCR). L'IA locale intégrée détourage automatiquement les arrière-plans, extrait plus de 20 attributs de mode et prépare des clichés de studio sans nécessiter de clé API.

## Prérequis
- Photos claires et bien éclairées de vos vêtements (selfies miroir, photos en pied ou vêtements à plat).
- Autorisation d'accès à l'appareil photo pour scanner les articles et les codes QR.
- Reçus numériques ou captures d'écran de factures (PDF / PNG / JPEG) pour vos achats en ligne.
- *(Facultatif)* Une clé personnelle Google Gemini API si vous souhaitez utiliser la retouche photo générative Nano Banana.

## Instructions étape par étape

1. **Prise de vue & Importation interactive** :
   - Cliquez sur **Ajouter un article** &rarr; choisissez **Prendre une photo** ou sélectionnez une ou plusieurs images sur votre appareil.
   - La détection de doublons intégrée vérifie instantanément si vous avez déjà ajouté ce vêtement.
2. **Segmentation IA & Détection multi-articles** :
   - Le modèle de vision isole chaque pièce distincte (vestes, hauts, jupes, pantalons, chaussures, accessoires) en une seule étape.
3. **Détourage IA & Clichés Studio Professionnels** :
   - Le moteur de traitement intégré supprime automatiquement les arrière-plans pour créer des images PNG transparentes et nettes pour tous les comptes.
4. **Extraction automatique des métadonnées** :
   - L'IA locale extrait plus de 20 critères de mode (couleurs, composition des tissus, sous-catégorie, code vestimentaire, marque et état).
5. **Restauration photo générative avancée (Nano Banana)** :
   - Pour les utilisateurs disposant d'une clé personnelle Google Gemini API, Nano Banana analyse les parties masquées ou tronquées (sacs, mains, bords de cadre) et reconstruit le tissu manquant.
6. **Reçus numériques & Balises DPP** :
   - Passez à **Import Numérique** pour analyser vos confirmations de commande et enregistrer le prix d'achat et les tailles exactes.
   - Cliquez sur **Scanner QR (DPP)** sur l'étiquette pour charger les données de traçabilité européenne et les conseils d'entretien.
7. **Enregistrer dans le dressing** :
   - Cliquez sur **Enregistrer**. Les articles apparaissent instantanément dans votre dressing.

## Résultats attendus
Chaque pièce apparaît sous la forme d'un cliché de studio centré et net, doté d'attributs de recherche précis et d'un étiquetage complet.

## Dépannage
- **Vêtements tronqués sur la photo** : Centrez bien le vêtement sur un fond contrasté. Si vous avez configuré une clé API, Nano Banana peut reconstruire automatiquement les cols ou les ourlets coupés.
- **Éclairage & Contraste** : Pour les vêtements sombres, privilégiez un arrière-plan clair et lumineux.
- **Erreurs de lecture de facture** : Utilisez le sélecteur interactif sur la photo de la facture pour désigner manuellement les lignes de produits.

## Limites
- Les imports groupés volumineux (>5 articles) sont traités en tâche de fond pour garantir la réactivité de l'interface.
- La retouche photo générative Nano Banana nécessite une clé personnelle Google Gemini API fournie par l'utilisateur.
