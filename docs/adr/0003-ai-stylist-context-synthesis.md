# ADR-0003: AI Stylist Context Synthesis Engine

## Context

Conversational Stylist chat (`POST /api/v1/stylist`), Daily Outfit Suggestions (`POST /api/v1/outfits/proposals`), and Event Planning (`POST /api/v1/outfits/event-proposals`) previously gathered user profiles, sizing metrics, wardrobe inventories, weather conditions, and calendar events independently.

This duplication caused several issues:
1. Sizing and gender heuristics were implemented inconsistently across endpoints.
2. Multilingual prompt grounding (i18next parity across all 13 supported languages) was partially missing in scheduled suggestions.
3. Wardrobe inventory queries were querying full documents instead of projected fields, transferring unnecessary data.

## Decision

We establish a deep module at `backend/app/services/styling_context.py` (`StylingContext`) with a single entry point:

```python
StylingContext.build(
    user_id: str,
    *,
    intent: str,
    lat: float | None = None,
    lng: float | None = None,
    occasion: str | None = None,
    event_date: str | None = None,
    language: str | None = None,
    include_calendar: bool = True,
) -> GroundedStylingContext
```

### Invariants

1. **Strict i18next Localization**:
   - The engine resolves the active language (`en`, `he`, `ar`, `es`, `fr`, `de`, `it`, `pt`, `ru`, `ja`, `ko`, `zh`, `hi`) and injects strict language contracts into the system prompt.

2. **Unified Slot Classification**:
   - Wardrobe items are categorized into canonical slots (`tops`, `bottoms`, `shoes`, `dresses`, `outerwear`, `accessories`) with verified transparent cutout URLs (`clean_image_url`).

3. **Lean Token Projection**:
   - Database queries exclude raw base64 data, passing only lightweight metadata to the LLM context.

## Consequences

- **Positive**: Complete domain parity across Chat, Daily Suggestions, and Event Planning.
- **Positive**: 100% adherence to active user language across 13 locales.
- **Positive**: Sizing, weather, and calendar grounding managed in one place.