# Numériser et Ajouter des Vêtements

Numérisez votre garde-robe physique en quelques secondes grâce au scan IA multimodal, au détourage intelligent et à la reconstruction automatique d'image.

## Aperçu
Ajoutez des vêtements à l'aide de prises de vue en direct, de téléversements multiples depuis votre galerie, de QR codes de Passeport Numérique de Produit (DPP) ou de reçus numériques (OCR de facture). L'IA intégrée détoure automatiquement l'arrière-plan, étiquette les attributs de mode, évalue la complétude du cadrage et reconstruit les vêtements masqués ou coupés.

## Prérequis
- Photos nettes et bien éclairées de vos vêtements (selfies miroir, photos de tenue en pied ou flat-lays).
- Accès à la caméra pour scanner les articles physiques et les QR codes.
- Reçus numériques ou captures d'écran de factures (PDF / PNG / JPEG) pour vos achats e-commerce.

## Étape par Étape

1. **Téléversement & Prise de Vue Interactifs** :
   - Appuyez sur **Ajouter un article** &rarr; choisissez **Prendre une photo** ou téléversez une ou plusieurs photos de tenue depuis votre appareil.
   - La détection de doublons intégrée vérifie instantanément si vous avez déjà téléversé le même vêtement.
2. **Segmentation IA & Détection Multi-Articles** :
   - Le modèle de vision isole chaque vêtement distinct (vestes, hauts, jupes, pantalons, chaussures, accessoires) en une seule passe.
3. **Contrôle Qualité IA & Réparation Automatique d'Image** :
   - Le Contrôleur de Qualité visuel de Gemini inspecte chaque élément détouré :
     - **Complet** : Les vêtements intacts et sans obstacle sont détourés directement.
     - **Complétion d'Image** : Si un article a des contours manquants, des zones masquées (par un sac ou un bras) ou des ourlets/cols coupés, l'IA effectue un outpainting automatique pour recréer le tissu manquant.
     - **Reconstruction Studio Complète** : Les articles très tronqués (comme des chaussures dont seul le bout est visible) sont entièrement reconstruits en photos de catalogue de qualité studio.
4. **Étiquetage Automatique des Métadonnées** :
   - L'IA extrait plus de 20 attributs de mode (couleurs, composition textile, sous-catégorie, code vestimentaire, marque et état).
5. **Reçus Numériques & Tags DPP** :
   - Passez à l'onglet **Import Numérique** pour analyser les e-mails de confirmation de commande ou les factures, en verrouillant le prix d'achat et les tailles vérifiées.
   - Appuyez sur **Scanner QR (DPP)** sur l'étiquette pour importer les informations de traçabilité et les conseils d'entretien du Passeport Numérique Européen.
6. **Enregistrer dans le Dressing** :
   - Appuyez sur **Enregistrer**. Les articles apparaissent immédiatement dans la grille de votre dressing, tandis que les complétions génératives se finalisent harmonieusement en arrière-plan.

## Résultats Attendus
Chaque vêtement s'affiche dans votre garde-robe numérique sous forme d'une photographie centrée, nette et de qualité studio, dotée d'attributs de recherche indexés et d'une taxonomie riche.

## Résolution des Problèmes
- **Vêtements Coupés / Partiels sur les Photos** : L'IA détecte automatiquement les limites rognées et les reconstruit ; vous pouvez également appuyer sur **Réparer la photo** sur la fiche détaillée d'un article pour déclencher manuellement une régénération studio.
- **Éclairage & Contraste** : Pour des résultats optimaux avec des vêtements sombres, photographiez-les sur un fond clair et contrasté.
- **Écarts d'OCR sur les Reçus** : Utilisez le sélecteur de zone interactif sur l'image du reçu pour désigner manuellement les lignes de produits correspondantes.

## Limites
- Les téléversements groupés haute résolution (>5 articles) sont traités via des files d'attente asynchrones en arrière-plan pour garantir une fluidité parfaite sans expiration de session dans le navigateur.