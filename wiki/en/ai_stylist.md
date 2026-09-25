# Conversational AI Stylist

Engage with an intelligent personal stylist that knows your wardrobe, the weather, and your daily schedule.

## Overview
The AI Stylist is your personal fashion companion. You can chat with it by typing or speaking out loud just like a friend. The Stylist checks your local forecast, glances at your Google Calendar events, and suggests complete, stylish outfits assembled directly from clothes you already own.

DressApp's styling engine is powered by an on-premises fine-tuned **Gemma-4-E4B** intelligence model that runs automatically for all Free Tier accounts without requiring an API key. For users who prefer using their own custom Google Gemini API keys, DressApp includes an automated **Quota Fallback** mechanism: if your personal key exceeds its rate limit or daily quota, the system seamlessly routes your request to the built-in Gemma model with an informative status banner so your styling conversation is never interrupted.

## Prerequisites
- At least one top, one bottom, and one footwear item uploaded to your closet.
- Microphone permission enabled if you wish to use hands-free voice styling.
- *(Optional)* Connected Google Calendar to make suggestions occasion-aware.
- *(Optional)* Personal Google Gemini API key if you wish to use your own cloud developer quota.

## Step-by-Step Instructions
1. **Open the Stylist**: Tap the **AI Stylist** tab from the bottom navigation bar.
2. **Speak or Type**: Tap the **Microphone icon** and ask what you should wear (e.g., *"What should I wear for a rainy afternoon lunch?"* or *"Suggest a chic business look"*).
3. **Listen to Spoken Advice**: The Stylist speaks back with tailored advice and displays matching outfit cards. Tap **Play reply** to hear the audio advice again anytime.
4. **Try the Shuffle Tool**: Want instant serendipity? Tap the **Shuffle** tab to spin your closet and discover fresh combinations you might not have thought of wearing together!
5. **Save Your Favorites**: Tap **Save to Diary** to schedule the look on your personal wardrobe calendar.

## Expected Results
Personalized, weather-appropriate outfit suggestions displayed on your screen, complete with spoken rationales explaining why the pieces match. If your custom API key runs out of quota, an alert banner will inform you that the built-in on-premises Stylist stepped in to complete your answer seamlessly.

## Troubleshooting
- **Microphone not picking up words**: Check your browser or device permissions to ensure DressApp has permission to access your microphone.
- **Stylist suggests too many repeat outfits**: Log your daily outfits in the calendar so the Stylist knows what you recently wore and prioritizes unworn clothes.
- **"Using Platform Stylist (Quota Fallback)" Banner**: This appears when your custom Google Gemini API key runs out of requests or hits a rate limit. The app smoothly answered your question using DressApp's built-in engine. You can check your API key quota in Google AI Studio or continue styling with the built-in engine.

## Limitations
- The Stylist works strictly with items in your closet; it cannot recommend pieces you haven't uploaded yet.
- Free Tier users receive 10 complimentary AI styling credits daily, which replenish automatically every 24 hours.
