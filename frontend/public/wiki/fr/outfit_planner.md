# Planificateur de Tenues & Canvas

Composez, superposez et révisez des tenues coordonnées.

## Aperçu
Le Planificateur de Tenues offre un canvas d'avatar 2D visuel (prenant en charge les découpes photo réelles du corps de l'utilisateur et les mannequins vectoriels SVG dynamiques) avec des décalages de repères calibrés (`top-[14.5%]` du col à l'encolure et `top-[36.5%]` de la ceinture à la taille) pour superposer les hauts, les bas, les vêtements d'extérieur et les chaussures au plus près des contours du corps.

## Prérequis
- Articles de garde-robe enregistrés.

## Étape par étape
1. **Sélectionner le canvas** : Ouvrez le Planificateur et cliquez sur un jour ou un nouveau brouillon.
2. **Superposer les articles** : Faites glisser les vêtements sur l'avatar 2D. Les vêtements d'extérieur se superposent automatiquement sur les t-shirts intérieurs.
3. **Évaluer la tenue** : Vérifiez les scores de compatibilité et les avertissements (ex. conflits de couleurs ou alertes météo).
4. **Enregistrer** : Définissez un titre et planifiez le look dans votre journal de garde-robe. Les mises à jour sont diffusées en toute sécurité via `useOutfitStore`.

## Résultats attendus
Compositions de tenues élégamment superposées, enregistrées dans votre calendrier et visibles sous forme d'aperçus en cartes réseau sans boucles d'interrogation de requêtes réseau en arrière-plan.

## Dépannage
- **Ordre des couches incorrect** : Revérifiez la catégorie de l'article ; les vêtements d'extérieur doivent être classés comme « Outerwear » pour s'empiler correctement.
- **Alertes de chevauchement** : Si l'avatar prévient d'une tenue répétée, vérifiez si vous avez porté la même tenue au même endroit récemment.

## Limitations
- Les couches sont gérées automatiquement en fonction des balises de catégorie ; les substitutions manuelles de z-index ne sont pas prises en charge.