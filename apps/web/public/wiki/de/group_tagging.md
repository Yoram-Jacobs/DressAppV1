# Group Tagging of Closet Items

## Goal
The goal of the Group tagging feature is to allow fast, bulk categorization of closet garments. The user can select multiple items in their closet and tag them all at once with a single click.

## Purpose
- **Speed & Efficiency**: Instead of entering tags item-by-item, users can select several garments (e.g., all formal jackets or all gym wear) and apply the tags instantly.
- **Improved AI Stylist Accuracy**: Fine-grained categories/tags (e.g., “Work”, “GYM”, “Swimwear”, “Uniforms”) guide the Stylist's reasoning process. Predefined tags enable the Stylist to locate the most relevant items for specific outfit requests (for example, choosing "work"-tagged items first when constructing a "work outfit").
- **Smart Fallbacks**: If certain tagged layers are missing (e.g., no upper-body "work"-tagged items), the Stylist will dynamically match other suitable garments.

## Key Points & Implementation Details
1. **User Interface Integration**:
   - Added a **Tag** button in the Closet selection floater.
   - Built a comma-separated tagging dialog (`AlertDialog`) that pops up when clicked.
2. **Optimistic UI Update**:
   - Tags are merged onto the selected closet items locally first so the changes reflect instantly in the user interface.
3. **Background Syncing**:
   - Sends the tag update requests (`api.patchItem`) to the database in the background to ensure data consistency without blocking user interactions.
4. **i18next Localization**:
   - All text messages, dialog titles, placeholders, and feedback notifications support translations cleanly using options-based defaults.
