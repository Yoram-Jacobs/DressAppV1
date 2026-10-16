# Conversational AI Stylist

Engage with an intelligent personal stylist that knows your wardrobe, the weather, and your daily schedule.

## Overview
The AI Stylist is your personal fashion companion. You can chat with it by typing or speaking out loud just like a friend. The Stylist checks your local forecast, glances at your Google Calendar events, and suggests complete, stylish outfits assembled directly from clothes you already own.

DressApp's styling brain is driven by a resilient, zero-BYOK multi-tier intelligence architecture:
- **Manager & Professional Plans — Fast Cloud Model (Google Gemini 3.5 Flash)**: Subscribers on the **Manager** and **Professional** plans enjoy priority routing to the fast Cloud AI model (currently **Google Gemini 3.5 Flash** via `llm_gateway.py`), delivering lightning-fast responses (sub-350ms TTFT) with zero configuration required.
- **Free Tier — On-Premises Eyes (`Qwen 2.5 VL 3B`) & Quota Safety Net**: Free-tier users are powered by DressApp's dedicated, fine-tuned **Qwen 2.5 VL 3B** model running locally in the `dressapp-eyes` container on port 7860 of the Hetzner CPX32 VPS. It also serves as a transparent safety fallback for paid tiers: if cloud API rate limits (`429` / `RESOURCE_EXHAUSTED`) are encountered, queries automatically redirect to on-premises Eyes without failing or raising 500 errors.

## Prerequisites
- At least one top, one bottom, and one footwear item uploaded to your closet.
- Microphone permission enabled if you wish to use hands-free voice styling.
- *(Optional)* Connected Google Calendar to make outfit suggestions occasion-aware.

## Step-by-Step Instructions
1. **Open the Stylist**: Tap the **AI Stylist** tab from the bottom navigation bar.
2. **Speak or Type**: Tap the **Microphone icon** and ask what you should wear (e.g., *"What should I wear for a rainy afternoon lunch?"* or *"Suggest a chic business look"*).
3. **Listen to Spoken Advice**: The Stylist speaks back with tailored advice and displays matching outfit cards. Tap **Play reply** to hear the audio advice again anytime.
4. **Try the Shuffle Tool**: Want instant serendipity? Tap the **Shuffle** tab to spin your closet and discover fresh combinations you might not have thought of wearing together!
5. **Refine with Follow-Ups**: Ask the stylist to change shoes, swap a jacket, or adapt to temperature changes in continuous conversational flow.
6. **Save Your Favorites**: Tap **Save to Diary** to schedule the look on your personal wardrobe calendar.

## Expected Results
Personalized, weather-appropriate outfit suggestions displayed on your screen, complete with spoken rationales explaining why the pieces match. If external cloud API quotas are temporarily exhausted, an informational banner indicates that the built-in on-premises Eyes Stylist fulfilled your request seamlessly.

## Troubleshooting
- **Microphone not picking up words**: Check your browser or device permissions to ensure DressApp has permission to access your microphone.
- **Stylist suggests too many repeat outfits**: Log your daily outfits in the calendar so the Stylist knows what you recently wore and prioritizes unworn clothes.
- **"Using Platform Stylist (Quota Fallback)" Banner**: This appears when external cloud API rate limits are hit. The app smoothly answered your question using DressApp's built-in on-premises Eyes (`Qwen 2.5 VL 3B`) engine with no disruption to your conversation.

## Limitations
- The Stylist works strictly with items in your closet; it cannot recommend pieces you haven't uploaded yet.
- Free Tier users use the on-premises Eyes model with complimentary styling credits that refresh automatically, while Manager and Professional accounts enjoy the fast Cloud model (`Gemini 3.5 Flash`) and elevated monthly quotas.
