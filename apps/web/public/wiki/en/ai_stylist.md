# Conversational AI Stylist

Engage with an intelligent personal stylist that knows your wardrobe, the weather, and your daily schedule.

## Overview
The AI Stylist is your personal fashion companion. You can chat with it by typing or speaking out loud just like a friend. The Stylist checks your local forecast, glances at your Google Calendar events, and suggests complete, stylish outfits assembled directly from clothes you already own.

DressApp's styling brain is driven by a resilient multi-tier intelligence architecture:
- **Primary Production Engine (Google Gemini 3.5 Flash-Lite)**: Powers all core styling conversations out of the box via `llm_gateway.py`. It delivers lightning-fast responses (sub-350ms TTFT) with zero initial configuration and zero friction—no personal API keys required to start styling!
- **On-Premises VPS Eyes (`gemma-4-E4B`) — Free Tier & Quota Safety Net**: A dedicated, fine-tuned `gemma-4-E4B` model running locally in the `dressapp-eyes` container on port 7860 of the Hetzner CPX32 VPS. It provides a zero-variable-cost baseline for Free Tier accounts and serves as a transparent fallback. If Google Gemini API limits (`429` / `RESOURCE_EXHAUSTED`) are encountered, queries automatically redirect to on-prem Gemma without failing or raising 500 errors.
- **Custom BYOK Cloud Models**: Users can optionally provide their own Google Gemini API key in Profile settings to access higher-tier models (`gemini-2.5-pro`) or unlock advanced generative tools (Nano Banana photo reconstruction).

## Prerequisites
- At least one top, one bottom, and one footwear item uploaded to your closet.
- Microphone permission enabled if you wish to use hands-free voice styling.
- *(Optional)* Connected Google Calendar to make outfit suggestions occasion-aware.
- *(Optional)* Personal Google Gemini API key if you wish to use your own cloud developer quota.

## Step-by-Step Instructions
1. **Open the Stylist**: Tap the **AI Stylist** tab from the bottom navigation bar.
2. **Speak or Type**: Tap the **Microphone icon** and ask what you should wear (e.g., *"What should I wear for a rainy afternoon lunch?"* or *"Suggest a chic business look"*).
3. **Listen to Spoken Advice**: The Stylist speaks back with tailored advice and displays matching outfit cards. Tap **Play reply** to hear the audio advice again anytime.
4. **Try the Shuffle Tool**: Want instant serendipity? Tap the **Shuffle** tab to spin your closet and discover fresh combinations you might not have thought of wearing together!
5. **Refine with Follow-Ups**: Ask the stylist to change shoes, swap a jacket, or adapt to temperature changes in continuous conversational flow.
6. **Save Your Favorites**: Tap **Save to Diary** to schedule the look on your personal wardrobe calendar.

## Expected Results
Personalized, weather-appropriate outfit suggestions displayed on your screen, complete with spoken rationales explaining why the pieces match. If external API quotas are temporarily exhausted, an informational banner indicates that the built-in on-premises Stylist fulfilled your request seamlessly.

## Troubleshooting
- **Microphone not picking up words**: Check your browser or device permissions to ensure DressApp has permission to access your microphone.
- **Stylist suggests too many repeat outfits**: Log your daily outfits in the calendar so the Stylist knows what you recently wore and prioritizes unworn clothes.
- **"Using Platform Stylist (Quota Fallback)" Banner**: This appears when external API rate limits are hit. The app smoothly answered your question using DressApp's built-in on-prem Gemma engine with no disruption to your conversation.

## Limitations
- The Stylist works strictly with items in your closet; it cannot recommend pieces you haven't uploaded yet.
- Free Tier users receive complimentary styling credits that refresh automatically, while Pro and Tester accounts enjoy elevated monthly quotas.
