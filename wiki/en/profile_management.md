# Profile, Sizing & Configuration

Fine-tune your measurements, modesty constraints, and AI credentials.

## Overview
The Profile section keeps your styling context up-to-date, managing physical body metrics, skin tone palette selection, full-body photo cutouts, styling rules, custom AI API keys, campaign notifications, and local region settings.

## Prerequisites
- Active DressApp user account.

## Step-by-Step
1. **Enter Metrics & ANSUR II Sizing**: Input basic physical parameters (Height, Weight, Waist, Foot Length). The ANSUR II regression model automatically calculates your 6 structural dimensions (Shoulders, Chest, Hip, Arm Length, Inseam, Outseam).
2. **Skin Tone & Body Photo Cutout**: Select your skin tone from the color palette or upload a full-body photograph. The system automatically performs U2-Net background matting to render real-body try-on previews. Click *Remove Photo* to instantly switch back to the 2D SVG vector mannequin.
3. **Specify Rules**: Select style avoids (e.g., "avoid yellow") and modesty levels.
4. **AI Configuration**: Input your custom Google AI Studio keys or select standard provider mode.
5. **Campaign Notifications**: Expand the *Campaign Notifications* accordion to toggle email or push notifications for local promotions, sales, and new stylists in your area, and customize the frequency (Instant, Daily, Weekly) and maximum distance (5km, 10km, 25km, 50km).
6. **Manage Account**: View your subscription level (Pro vs Free limit of 150 items) or request account deletion.

## Expected Results
- Personalized 2D avatar and outfit layouts conforming to your exact shape, skin tone, and clothing style preferences.
- Notifications delivered on your selected channels when active campaigns match your styling rules and fall within your selected distance radius.

## Troubleshooting
- **API key invalid**: Verify that you copied the key correctly from Google AI Studio without extra spaces.
- **Photo background not clean**: Ensure your full-body photo has clear lighting against a contrasting background.
- **Calendar not sync**: Unlink and re-authenticate your Google account to refresh tokens.
- **Not receiving campaigns**: Make sure your *Location Services* are enabled and that your max distance setting covers the local business location.

## Limitations
- Custom rules are applied strictly; if your rules are too strict, the stylist may find no matching outfits.
- Campaign push alerts require browser notification permissions. If blocked, you will only receive email campaign notifications.

