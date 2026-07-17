# Outfit Planner: Visual 7-Day Outfit Calendar

This document provides a summary of the **Outfit Planner** calendar component, detailing its features, interactions, and technology stack.

## 1. Overview
The **Outfit Planner** (integrated within `Stylist.jsx`) is a scheduling interface that allows users to plan what they wear over a rolling 7-day period. By integrating calendar scheduling with the saved outfits canvas, it logs daily usage history, coordinates styles for planned events, and updates clothing wear statistics.

## 2. Key Features

### Visual 7-Day Timeline Grid
- Displays a horizontal sliding or grid timeline of 7 cards representing a rolling week.
- Each date card displays the day of the week, the calendar month, and day number.
- Highlighting indicates the current calendar day (`TODAY`).
- **Interactive Avatar Cards**: If an outfit is scheduled for a specific day, a mini scaled 2D model/avatar representation is drawn inside the card, showing the planned garments visually. Hovering over the card displays the outfit title and a quick edit affordance.

### Date Navigation
- Jumps to the current calendar date (`Today` button).
- Navigates back and forth day-by-day using previous and next Chevron arrow controls.

### Outfit Assignment & Scheduler
- Clicking any day on the timeline opens a sub-modal (`Dialog` card) allowing the user to manage that day's plan.
- **Unschedule Outfit**: If an outfit is already scheduled, it provides a one-click button to remove/unschedule the outfit.
- **Select Saved Outfit Grid**: Renders a thumbnail gallery of all the user's saved outfits with avatar previews. Selecting an outfit schedules it for that day.
- **Automatic Stat Integration**: Scheduling an outfit automatically updates the wear counter (`use_count`) on the outfit record, keeping wear counts and Cost-per-Wear metrics in sync.

---

## 3. Technology Stack

### Frontend & UI Components
- **React**: Handles timeline date ranges, scheduling states, modals, and API data sync hooks.
- **Radix UI & Shadcn**: Utilizes Radix Dialog primitives (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`) for standard transition-aware modals.
- **OutfitAvatarViewer (Canvas)**: Integrates the 2D HTML5 canvas-based avatar renderer (`AvatarViewer`) to overlay and position transparency-mapped garment layers (tops, bottoms, shoes, outerwear) dynamically on a human figure.
- **Tailwind CSS**: Custom layouts using CSS scrollbars (`scrollbar-thin`), grid alignments (`grid-cols-7`), and flex boxes.
- **Lucide Icons**: Integrates vectors like `Plus`, `Trash2`, `ChevronLeft`, and `ChevronRight`.
- **i18next**: Localizes month names, weekdays, and action button labels across 12 languages.

### Backend API Endpoints
- **REST Endpoints**: Connects to the `/outfits` API routes:
  - `GET /outfits`: Pulls saved outfits to populate the selector grid.
  - `PATCH /outfits/{id}`: Assigns or schedules the outfit to a new date.
  - `DELETE /outfits/{id}`: Deletes or unschedules a saved entry.
