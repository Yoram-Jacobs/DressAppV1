# Importer votre garde-robe depuis d'autres applications (Migration depuis un concurrent)

## Présentation générale
Si vos vêtements sont déjà répertoriés dans une autre application de garde-robe (telle que Whering, Acloset ou Stylebook), vous n'avez pas à tout recommencer depuis le début. DressApp dispose d'un **Desktop Wardrobe Migration Agent** intelligent (via un bookmarklet de navigateur) qui parcourt la page de votre ancienne garde-robe, capture vos fiches de vêtements et les télécharge automatiquement sur DressApp. Notre IA s'exécute ensuite en arrière-plan pour identifier automatiquement les couleurs, les marques, les matières et les catégories de vos vêtements.

## Prérequis
- **Ordinateur de bureau** : Le bookmarklet de migration nécessite des fonctionnalités de navigateur de bureau (Chrome, Edge ou Safari). Il n'est pas pris en charge sur les appareils mobiles ou les tablettes.
- **Comptes actifs** : Vous devez être connecté à la fois à votre compte DressApp et à votre compte de garde-robe concurrent sur le même navigateur.
- **Barre de favoris** : La barre de favoris de votre navigateur doit être visible (Ctrl+Shift+B sur Windows, Cmd+Shift+B sur macOS).

## Instructions étape par étape
1. Ouvrez votre page **Profil** DressApp sur votre ordinateur de bureau et cliquez sur **Import Wardrobe**.
2. Sélectionnez votre ancienne application dans la liste (Whering, Acloset, Stylebook, Smartli, BeautyAI, etc.) ou saisissez un nom personnalisé.
3. Glissez le bouton du bookmarklet **Share & Start Agent** depuis l'écran directement sur la barre de favoris de votre navigateur.
4. Ouvrez un nouvel onglet, accédez à la version web de votre ancienne application de garde-robe et connectez-vous. Allez sur la page où tous vos vêtements sont affichés sous forme de grille.
5. Cliquez sur le bookmarklet **Share & Start Agent** dans votre barre de favoris.
6. L'agent commencera à faire défiler la page, à détecter les images de vêtements et à les diffuser sur DressApp par lots de 15. Ne fermez pas l'onglet DressApp pendant ce processus.
7. Une fois la diffusion terminée, vérifiez votre page Garde-robe (Closet) dans DressApp. L'AI Stylist traitera les éléments en arrière-plan pour remplir automatiquement les attributs des vêtements.

## Résultats attendus
- Les fiches de vêtements apparaîtront immédiatement dans la grille de votre garde-robe DressApp.
- Les arrière-plans sont automatiquement supprimés, laissant des miniatures transparentes et nettes.
- Les champs d'étiquettes (catégorie, couleur, coupe, matière) se rempliront automatiquement dans les quelques minutes suivant l'importation.

## Dépannage
- **Le bookmarklet ne s'installe pas** : Assurez-vous que la barre de favoris de votre navigateur est activée. Si les paramètres de sécurité bloquent le glisser-déposer, faites un clic droit sur le bouton, sélectionnez « Copier l'adresse du lien », créez un nouveau favori manuellement et collez le code dans le champ URL.
- **L'agent s'arrête de défiler** : Assurez-vous que la page de la garde-robe concurrente est active et non réduite. En cas de blocage, actualisez la page concurrente et cliquez à nouveau sur le bookmarklet.
- **Éléments en double** : L'importateur vérifie les signatures des images (dHash) pour filtrer automatiquement les téléchargements en double.

## Limites
- **Ordinateur de bureau uniquement** : Ne peut pas être exécuté sur les navigateurs mobiles en raison de restrictions d'API.
- **Clarté visuelle** : Les dispositions de vêtements fortement déformées, sombres ou superposées sur l'application concurrente peuvent faire échouer l'extraction visuelle du recadrage et nécessiter des ajustements photo manuels ultérieurs.