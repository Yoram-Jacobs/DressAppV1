# Importer votre garde-robe - Guide détaillé

## Vue d'ensemble

Vous avez déjà suivi votre garde-robe dans une autre application ? Pas de problème !DressApp facilite l'importation de vos données de garde-robe existantes pour que vous n'ayez pas à repartir de zéro.Nous supportons les importations depuis une large gamme d'applications populaires de planification de garde-robe et d'outfit.

## Sources d'importation supportées

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## Guide d'importation étape par étape

### Étape 1 : Ouvrir la page du Closet
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### Étape 2 : Accéder à la fonction d'importation
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### Étape 3 : Sélectionnez la source depuis l'application
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### Étape 4 : Exporter les données depuis l'ancienne application
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### Étape 5 : Téléverser vers DressApp
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### Étape 6 : Réviser et ajuster
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## Ce qui est importé

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## Dépannage

### Import Failed
- Check that the file format is correct (CSV, JSON, or app-specific format)
- Ensure the file isn't corrupted or too large
- Try exporting again from the source app

### Missing Items After Import
- Some fields may not have mapped correctly
- Check the import results page for warnings
- Manually add missing items if needed

### Images Not Imported
- Not all apps include images in their export files
- You can add images manually to imported items later
- Use the camera or upload function on the item detail page

## Besoin d'aide ?

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*Dernière mise à jour : juillet 2026*
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
