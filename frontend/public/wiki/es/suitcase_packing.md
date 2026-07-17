# DressApp Suitcase

## Purpose
The Suitcase feature is designed to solve the common travel problem of packing inappropriate or excessive clothing. It acts as an intelligent travel packing assistant that considers the duration of the trip, local weather, specific conditions (e.g., business trip, hotel vacation, safari, outdoor camping), as well as cultural and religious conventions. By doing so, it prevents overpacking under-usable garments and avoids the frustration of missing crucial items (like a bathing suit for the beach or a warm coat for cold weather), saving space, weight, and unnecessary local purchases.

## Goals
1. **Intelligent Travel Solution**: Provide an AI-driven, context-aware packing companion.
2. **Personalized Curation**: Select the most useful and appropriate items from the user's closet while maintaining their unique personality and style.
3. **Gap Analysis & Recommendations**: Alert the user if crucial items are missing for the trip and recommend purchases from the marketplace (if a good match is found) or local stores.
4. **Iterative Refinement**: Allow users to review and refine the suggested suitcase, requesting specific changes through natural language interactions.

## Key Points
- **Context-Aware Generation**: Automatically generates daily outfits and a packing list based on trip details (destinations, dates) setup in the Trip form and calendar events, along with the user's existing wardrobe.
- **State Retention**: Maintains the active suitcase state and history seamlessly, ensuring that the user's progress and refinement notes are not lost upon refreshing the page.
- **Interactive Refinement**: Users can chat with the AI stylist to tweak the suitcase (e.g., swapping items, adjusting for specific events) while preserving the rest of the curated list.
- **Approval & Execution**: Once the user is satisfied, they can approve the suitcase to finalize their packing plan.

## Technology
- **Frontend**: React (Vite) UI with a custom state machine (`gathering`, `reviewing`, `active`) in `Suitcase.jsx`. It manages user inputs, displays the generated suitcase, and handles real-time refinement chat requests. State is autosaved to prevent data loss.
- **Backend**: Python FastAPI (`suitcase.py`) exposes the `/pack` endpoint, handling both the initial suitcase generation and subsequent refinements.
- **Database**: MongoDB stores the active suitcase state (`active_suitcase_id`), enabling cross-session persistence and preventing duplicate document creation on autosave.
- **AI Integration**: Leverages LLMs to process the user's wardrobe, trip context, and natural language refinement notes. During refinement, the frontend passes the current state (`current_outfits`, `current_packing_list`) to the backend, ensuring the LLM maintains context and accurately updates only the requested items.
