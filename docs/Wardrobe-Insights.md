# Wardrobe Insights: Cost-per-Wear Analytics Dashboard

This document provides a summary of the **Wardrobe Insights** page (Cost-per-Wear Analytics Dashboard), detailing its purpose, core metrics, key features, and underlying technology stack.

## 1. Overview
The **Wardrobe Insights** dashboard (`WardrobeStats.jsx`) is a personal fashion analytics center designed to help users analyze their wardrobe value, track garment utilization, and cultivate conscious wear habits. By tracking how often garments are worn, the system computes the exact economic value and utility of each piece.

## 2. Key Metrics & KPIs
The dashboard features a primary grid of Key Performance Indicators (KPIs) calculated dynamically from the user's closet:
- **Closet Worth (Total Value)**: The cumulative sum of the purchase prices (`price_cents` or `purchase_price_cents`) of all items currently saved in the closet.
- **Closet Utilization**: The percentage of garments in the wardrobe that have been worn at least once (`wornItems / totalItems * 100`).
- **Items Worn Ratio**: A fraction representation of worn items versus total closet capacity (e.g., `12 / 45 items`).
- **Average Cost-per-Wear (CPW)**: The average efficiency score across all priced items. CPW is calculated as `Garment Price / Wear Count` (with wear count defaulting to 1 for items worn 0 times to prevent division errors).

## 3. Key Features

### Dynamic Distribution Charts
Users can toggle between three different breakdown views to visualize the composition of their wardrobe:
1. **Color Palette Breakdown**: Displays a ring, pie, or bar chart representation of the dominant color palette of the closet, dynamically pulling mapped hex codes (e.g., navy, charcoal, terracota, burgundy).
2. **Materials Breakdown**: Visualizes the fabric composition (e.g., cotton, denim, cashmere, wool, leather) by parsing percentages from weighted tags.
3. **Subcategories Breakdown**: Categorizes items into specific dress/garment types (e.g., boots, trousers, sneakers, jackets, maxi dresses) to highlight closet distribution.

### Efficiency Leaderboard (Top 5)
- Displays the **Top 5 Most Efficient Items** based on the lowest Cost-per-Wear score. This rewards garments that represent high usage relative to their price.

---

## 4. Technology Stack

### Frontend Components & Library
- **React & Zustand**: Uses React hooks for breakdown tab controls, layout toggles, and state syncing. Pulls closet item arrays globally from the Zustand-managed `useClosetStore`.
- **Recharts**: A charting library used to build responsive charts (`ResponsiveContainer`, `PieChart`, `Pie`, `Cell`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`).
- **Lucide Icons**: Integrates Lucide SVG vector icons (`DollarSign`, `Percent`, `TrendingUp`, `Shirt`, `Award`, `Activity`, `ChevronDown`, `ChevronUp`) for high-fidelity KPI representation.
- **Tailwind CSS**: Implements a clean, responsive layout utilizing border-borders, custom grid spacing, and rounded cards.
- **i18next (Internationalization)**: Mapped with `react-i18next` for full multi-language translations.
