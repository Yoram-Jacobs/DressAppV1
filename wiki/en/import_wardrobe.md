# Import Your Wardrobe from Other Apps (Competitor Migration)

## Overview
If you already have your clothes cataloged in another wardrobe app (such as Whering, Acloset, or Stylebook), you don't have to start from scratch. DressApp features a smart **Desktop Wardrobe Migration Agent** (via a browser bookmarklet) that crawls your old closet page, captures your garment cards, and automatically uploads them to DressApp. Our AI then runs in the background to automatically identify the colors, brands, fabrics, and categories of your clothes.

## Prerequisites
- **Desktop Computer**: The migration bookmarklet requires desktop browser capabilities (Chrome, Edge, or Safari). It is not supported on mobile devices or tablets.
- **Active Accounts**: You must be logged into both your DressApp account and your competitor wardrobe account in the same browser.
- **Bookmarks Bar**: Your browser's Bookmarks Bar must be visible (Ctrl+Shift+B on Windows, Cmd+Shift+B on macOS).

## Step-by-Step Instructions
1. Open your DressApp **Profile** page on your desktop computer and click **Import Wardrobe**.
2. Select your old app from the list (Whering, Acloset, Stylebook, Smartli, BeautyAI, etc.) or type a custom name.
3. Drag the **Share & Start Agent** bookmarklet button from the screen directly onto your browser's bookmarks bar.
4. Open a new tab, navigate to the web version of your old wardrobe app, and log in. Go to the page where all your clothing items are displayed in a grid.
5. Click the **Share & Start Agent** bookmarklet in your bookmarks bar.
6. The agent will begin scrolling, detecting garment images, and streaming them to DressApp in batches of 15. Do not close the DressApp tab during this process.
7. Once streaming completes, check your DressApp Closet page. The AI Stylist will be processing items in the background to fill in garment attributes automatically.

## Expected Results
- Garment cards will immediately appear in your DressApp closet grid.
- Backgrounds are automatically removed, leaving clean transparent thumbnails.
- Tag fields (category, color, fit, fabric) will populate automatically within a few minutes of import.

## Troubleshooting
- **Bookmarklet won't install**: Ensure your browser's bookmarks bar is enabled. If security settings block dragging, right-click the button, select "Copy Link Address", create a new bookmark manually, and paste the code into the URL field.
- **Agent stops scrolling**: Ensure the competitor wardrobe page is active and not minimized. If it stalls, refresh the competitor page and click the bookmarklet again.
- **Duplicate items**: The importer checks the image signatures (dHash) to filter out duplicate uploads automatically.

## Limitations
- **Desktop Only**: Cannot be run on mobile browsers due to API restrictions.
- **Visual Clarity**: Highly distorted, dark, or overlapping clothing layouts on the competitor app may fail visual crop extraction and require manual photo adjustments later.