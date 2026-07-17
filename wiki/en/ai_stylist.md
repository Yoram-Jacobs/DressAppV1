# Conversational AI Stylist

Engage with an intelligent personal stylist that knows your closet, weather, and schedule.

## Overview
The AI Stylist handles natural-language voice or text styling queries, automatically integrating weather conditions and calendar events.

## Prerequisites
- A Gemini API key (or default system credits).
- Connected calendar events.

## Step-by-Step
1. **Start Session**: Open the Stylist tab and select Chat, Shuffle, or Match.
2. **Voice input**: Tap the Microphone, speak your query (e.g. "Suggest an outfit for a rainy day"), and tap to send.
3. **Audio Playback**: Listen to the generated styling rationale via the high-fidelity speech player.
4. **Shuffle**: Click the Sparkles button to spin the slot machine; the AI automatically aligns matching items in focus.

## Expected Results
Customized outfit layouts styled around your personal preferences, seasonal constraints, and schedule.

## Troubleshooting
- **Audio plays too slowly**: Switch between Gemini TTS and the Web Speech API fallback in Profile settings.
- **Repeated suggestions**: Ensure your outfit calendar history is updated so the rotation algorithm can block repeat wears.

## Limitations
- Recommendations require at least one top, one bottom, and one footwear item in the closet to complete a look.
- Voice transcription may fallback to standard text typing on unsupported edge devices.
