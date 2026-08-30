## 2026-08-17T10:36:46Z
You are Explorer 2 for Milestone M2 (ItemDetailScreen.tsx) in DressApp.
Your working directory is: c:\DressApp_AG\.agents\explorer_m2_2
Working root: c:\DressApp_AG

Inputs to read:
- ORIGINAL_REQUEST.md: c:\DressApp_AG\ORIGINAL_REQUEST.md
- PROJECT.md: c:\DressApp_AG\PROJECT.md
- Reference web page: c:\DressApp_AG\apps\web\src\pages\ItemDetail.jsx
- Reference mobile screen: c:\DressApp_AG\apps\mobile\src\screens\closet\ClosetScreen.tsx
- Theme tokens: c:\DressApp_AG\apps\mobile\src\theme\tokens.ts and packages/ui/src/styles/design-tokens.json

Your Task:
1. Analyze the visual layout, UX hierarchy, and styling requirements for porting `ItemDetail.jsx` to Expo 53 React Native.
2. Document:
   - Layout architecture: `ScrollView`, 3:4 portrait hero image container with zoom/full-bleed aspect ratio, header overlay (back button, share/action buttons).
   - Attribute display sections: Item title, brand badge, category/subcategory chips, color swatches with hex dots, fabric composition bars/chips, season badges, care/notes section.
   - Action controls: prominent destructive Delete Item button (styled with `colors.danger` or `colors.error`), edit/favorite triggers (with TODO comments if deferred).
   - Theme tokens: mapped typography (`fonts`, `fontSizes`), spacing (`spacing`), border radii (`radii`), shadows (`shadows`), and colors (`useTheme().colors`).
   - RTL layout rules: start/end alignments, `I18nManager.isRTL` safeguards.
3. Write your UI/UX architecture blueprint to `c:\DressApp_AG\.agents\explorer_m2_2\handoff.md`.
4. Send a message to parent when done.
