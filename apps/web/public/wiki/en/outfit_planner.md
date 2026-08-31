# Outfit Planner & Canvas

Compose, layer, and review coordinated layouts.

## Overview
The Outfit Planner provides a visual 2D avatar canvas (supporting both real user body photo cutouts and dynamic vector SVG mannequins) with calibrated landmark offsets (`top-[14.5%]` collar-to-neckline and `top-[36.5%]` waistband-to-waistline) to layer tops, bottoms, outerwear, and footwear flush against body boundaries.

## Prerequisites
- Stored closet items.

## Step-by-Step
1. **Select Canvas**: Open the Planner and click a day or new draft.
2. **Layer Items**: Drag garments onto the 2D avatar. Outerwear automatically stacks on top of inner shirts.
3. **Evaluate Fit**: Check compatibility scores and warnings (e.g., color clashes or weather alerts).
4. **Save**: Set a title and schedule the look to your wardrobe diary. Updates stream thread-safely via `useOutfitStore`.

## Expected Results
Beautifully layered outfit compositions saved to your calendar and visible as grid card previews without background network request polling loops.

## Troubleshooting
- **Layer order incorrect**: Re-verify the category of the item; outerwear must be classified as "Outerwear" to stack correctly.
- **Overlap alerts**: If the avatar warns of repeat wears, check if you wore the same outfit to the same location recently.

## Limitations
- Layers are managed automatically based on category tags; manual z-index overrides are not supported.

