# Suitcase Packing Assistant

Pack efficiently and stress-free for any destination with AI-driven weather forecasting and conversational checklist refinement.

## Overview
The Suitcase Packing Assistant eliminates travel prep anxiety by analyzing your travel itinerary, destination weather, and personal wardrobe catalog to build a customized, day-by-day packing checklist. Powered by **Google Gemini 3.5 Flash-Lite** via `llm_gateway.py`, the assistant generates complete packing plans in seconds and lets you interactively refine items through conversational chat.

## Prerequisites
- Destination city name and departure/return travel dates.
- An active closet inventory with at least a few staple garments.
- Internet connectivity to fetch destination weather forecasts.

## Step-by-Step Instructions
1. **Create a Trip**: Open the Suitcase tab, tap **New Trip**, and enter your destination city, start and end dates, and trip purpose (e.g., *Business*, *Beach Holiday*, *Casual City Tour*).
2. **Generate Packing Plan**: Tap **Generate Checklist**. The AI retrieves forecasted temperatures and conditions for your destination, cross-references your closet items, and constructs a balanced packing list.
3. **Review Daily Outfits**: Inspect day-by-day suggested combinations ensuring appropriate layers for cool mornings and warm afternoons.
4. **Refine via Conversational Chat**: Need extra options? Chat directly with the packing assistant (e.g., *"Add comfortable walking sneakers"* or *"Include a cocktail dress for dinner"*). The checklist updates dynamically.
5. **Mark Items as Packed**: Use the interactive checkboxes as you load your luggage to track what has already been packed.
6. **Save for Offline Travel**: Save the completed trip plan for quick, optimistic access on your device even while offline in transit.

## Expected Results
A comprehensive, weather-optimized luggage packing checklist organized by clothing categories (tops, bottoms, outerwear, footwear, essentials) with zero duplicate or unnecessary pieces.

## Troubleshooting
- **Weather forecast unavailable**: Verify destination city spelling; for remote locations, try specifying the nearest major city.
- **Checklist shows few items**: Ensure you have uploaded enough season-appropriate garments in your closet for the expected destination temperatures.
- **Adjustments not saving**: Confirm your network connection is active when adding custom chat notes.

## Limitations
- Automated weather forecasting covers trips planned up to 14 days in advance; trips further in the future utilize historical seasonal climate averages.
