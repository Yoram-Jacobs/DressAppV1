# Prerequisites & Setup Guide

Before diving into DressApp, ensure your system is set up to utilize all features and styling services.

## Overview
This document covers the hardware requirements, browser permissions, and AI configuration options needed to run DressApp smoothly. DressApp is designed to work immediately out of the box with zero required API keys, while offering optional integrations for advanced power users.

## Prerequisites
- A modern smartphone, tablet, or PC (iOS, Android, macOS, Windows, Linux).
- Camera permission enabled (for photographing clothes and scanning DPP tags).
- Microphone permission enabled (for hands-free voice styling requests).
- Location permission (for local weather-aware styling recommendations).
- *(Optional)* A Google Gemini API key if you wish to use advanced tools like Trend Scout daily feeds, Nano Banana image repair, or your own custom cloud model quotas. Free accounts do NOT need an API key to use DressApp.

## Step-by-Step Instructions
1. **Allow Permissions**: Accept browser or app camera prompts when capturing items, microphone prompts for voice conversations, and location prompts for live local weather updates.
2. **Start Styling Immediately (Free Tier)**: Your account comes equipped with DressApp's built-in on-premises AI (fine-tuned Gemma-4-E4B) and 10 complimentary daily styling credits with no setup required.
3. **Optional Custom API Key (BYOK)**: If you wish to enable Trend Scout fashion intelligence, high-detail Nano Banana photo reconstruction, or use personal quotas, open **Profile** (`/me`) &rarr; **AI Configuration** and paste your free key from [Google AI Studio](https://aistudio.google.com/).
4. **Link Google Calendar**: Under your Profile, connect your Google Calendar to grant the AI Stylist awareness of upcoming business meetings, parties, and gym sessions.

## Expected Results
You will enjoy seamless camera ingestion, automatic transparent background cutouts, voice styling advice, local weather alerts, and calendar-synchronized outfit recommendations.

## Troubleshooting
- **No Location Weather**: Check if location permissions are disabled in your OS or browser privacy settings.
- **Microphone issues**: Verify that microphone permissions are allowed for DressApp and that another application is not exclusively locking the audio input.
- **Do I need an API key?**: No! Free Tier users can digitize clothes, organize their closet, and converse with the AI Stylist without providing any external keys.

## Limitations
- Local voice recognition works best on modern Chromium-based browsers (Google Chrome, Microsoft Edge) and Safari.
- Trend Scout fashion channels and Nano Banana photo reconstruction require a personal Google Gemini API key to run.
