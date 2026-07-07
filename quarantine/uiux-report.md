# Deep UI/UX & RTL Compliance Audit Report

This report lists all detected RTL physical class bugs, physical alignments, hardcoded text strings, i18next violations, and locale file key parity issues.

## 1. i18next Violations & Hardcoded Text
These literal strings and positional arguments bypass the translation hook system.

### Hardcoded Strings (JSX Text / Attributes / Toasts)
- [ ] `src/components/LanguageSync.jsx:10` $\rightarrow$ Hardcoded JSX text: `"and"`
- [ ] `src/components/OutfitCanvas.jsx:270` $\rightarrow$ Hardcoded Attribute: `aria-label="Close"`
- [ ] `src/components/ui/breadcrumb.jsx:9` $\rightarrow$ Hardcoded Attribute: `aria-label="breadcrumb"`
- [ ] `src/components/ui/pagination.jsx:14` $\rightarrow$ Hardcoded Attribute: `aria-label="pagination"`
- [ ] `src/lib/createCachedStore.js:45` $\rightarrow$ Hardcoded JSX text: `"Promise"`
- [ ] `src/lib/useMarketplaceProgress.js:10` $\rightarrow$ Hardcoded JSX text: `"Sync"`
- [ ] `src/lib/utils.js:109` $\rightarrow$ Hardcoded JSX text: `"3] |= bit"`
- [ ] `src/pages/Closet.jsx:1083` $\rightarrow$ Hardcoded JSX text: `"semantic matches across"`
- [ ] `src/pages/Closet.jsx:1420` $\rightarrow$ Hardcoded Attribute: `placeholder="e.g. Work, GYM, Swimwear"`
- [ ] `src/pages/ItemDetail.jsx:2096` $\rightarrow$ Hardcoded Attribute: `placeholder="USD"`
- [ ] `src/pages/ItemDetail.jsx:2105` $\rightarrow$ Hardcoded Attribute: `placeholder="own"`
- [ ] `src/pages/Register.jsx:73` $\rightarrow$ Hardcoded Attribute: `placeholder="Alex"`
- [ ] `src/pages/Stylist.jsx:2261` $\rightarrow$ Hardcoded Attribute: `aria-label="Previous month"`
- [ ] `src/pages/Stylist.jsx:2273` $\rightarrow$ Hardcoded Attribute: `aria-label="Next month"`
- [ ] `src/pages/Stylist.jsx:2467` $\rightarrow$ Hardcoded Attribute: `aria-label="Previous day"`
- [ ] `src/pages/Stylist.jsx:2470` $\rightarrow$ Hardcoded Attribute: `aria-label="Next day"`

## 2. RTL Layout & Spacing Violations
These physical classes prevent proper horizontal alignment flipping when rendering Hebrew or Arabic.

### Physical Spacing/Positioning Classes
- [ ] `src/App.js:81` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/AvatarViewer2D.jsx:102` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/AvatarViewer2D.jsx:105` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/AvatarViewer2D.jsx:109` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/AvatarViewer2D.jsx:113` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/AvatarViewer2D.jsx:116` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/AvatarViewer2D.jsx:121` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/AvatarViewer2D.jsx:124` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/AvatarViewer2D.jsx:133` $\rightarrow$ Physical Spacing Class: `right-[-5%]`
- [ ] `src/components/stylist/ItemFloater.jsx:21` $\rightarrow$ Physical Spacing Class: `right-edge`
- [ ] `src/components/ui/alert-dialog.jsx:30` $\rightarrow$ Physical Spacing Class: `left-[50%]`
- [ ] `src/components/ui/alert-dialog.jsx:30` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/ui/alert-dialog.jsx:30` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/ui/alert.jsx:7` $\rightarrow$ Physical Spacing Class: `left-4`
- [ ] `src/components/ui/alert.jsx:7` $\rightarrow$ Physical Spacing Class: `pl-7`
- [ ] `src/components/ui/calendar.jsx:28` $\rightarrow$ Physical Spacing Class: `left-1`
- [ ] `src/components/ui/calendar.jsx:29` $\rightarrow$ Physical Spacing Class: `right-1`
- [ ] `src/components/ui/carousel.jsx:125` $\rightarrow$ Physical Spacing Class: `ml-4`
- [ ] `src/components/ui/carousel.jsx:144` $\rightarrow$ Physical Spacing Class: `pl-4`
- [ ] `src/components/ui/carousel.jsx:162` $\rightarrow$ Physical Spacing Class: `left-12`
- [ ] `src/components/ui/carousel.jsx:163` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/ui/carousel.jsx:184` $\rightarrow$ Physical Spacing Class: `right-12`
- [ ] `src/components/ui/carousel.jsx:185` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/ui/command.jsx:37` $\rightarrow$ Physical Spacing Class: `mr-2`
- [ ] `src/components/ui/context-menu.jsx:24` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/context-menu.jsx:38` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/context-menu.jsx:38` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/context-menu.jsx:50` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/context-menu.jsx:50` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/context-menu.jsx:63` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/context-menu.jsx:74` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/context-menu.jsx:74` $\rightarrow$ Physical Spacing Class: `pr-2`
- [ ] `src/components/ui/context-menu.jsx:79` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/context-menu.jsx:94` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/context-menu.jsx:94` $\rightarrow$ Physical Spacing Class: `pr-2`
- [ ] `src/components/ui/context-menu.jsx:98` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/context-menu.jsx:113` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/dialog.jsx:35` $\rightarrow$ Physical Spacing Class: `left-[50%]`
- [ ] `src/components/ui/dialog.jsx:35` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/ui/dialog.jsx:35` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/ui/dialog.jsx:41` $\rightarrow$ Physical Spacing Class: `right-4`
- [ ] `src/components/ui/dropdown-menu.jsx:24` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/dropdown-menu.jsx:39` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/dropdown-menu.jsx:39` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/dropdown-menu.jsx:54` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/dropdown-menu.jsx:54` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/dropdown-menu.jsx:67` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/dropdown-menu.jsx:78` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/dropdown-menu.jsx:78` $\rightarrow$ Physical Spacing Class: `pr-2`
- [ ] `src/components/ui/dropdown-menu.jsx:83` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/dropdown-menu.jsx:98` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/dropdown-menu.jsx:98` $\rightarrow$ Physical Spacing Class: `pr-2`
- [ ] `src/components/ui/dropdown-menu.jsx:102` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/dropdown-menu.jsx:115` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/hover-card.jsx:16` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/hover-card.jsx:16` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/menubar.jsx:64` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/menubar.jsx:78` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/menubar.jsx:78` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/menubar.jsx:96` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/menubar.jsx:96` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/menubar.jsx:109` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/menubar.jsx:120` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/menubar.jsx:120` $\rightarrow$ Physical Spacing Class: `pr-2`
- [ ] `src/components/ui/menubar.jsx:125` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/menubar.jsx:139` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/menubar.jsx:139` $\rightarrow$ Physical Spacing Class: `pr-2`
- [ ] `src/components/ui/menubar.jsx:143` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/menubar.jsx:156` $\rightarrow$ Physical Spacing Class: `pl-8`
- [ ] `src/components/ui/navigation-menu.jsx:46` $\rightarrow$ Physical Spacing Class: `ml-1`
- [ ] `src/components/ui/navigation-menu.jsx:56` $\rightarrow$ Physical Spacing Class: `left-0`
- [ ] `src/components/ui/navigation-menu.jsx:56` $\rightarrow$ Physical Spacing Class: `right-52`
- [ ] `src/components/ui/navigation-menu.jsx:56` $\rightarrow$ Physical Spacing Class: `left-52`
- [ ] `src/components/ui/navigation-menu.jsx:56` $\rightarrow$ Physical Spacing Class: `right-52`
- [ ] `src/components/ui/navigation-menu.jsx:56` $\rightarrow$ Physical Spacing Class: `left-52`
- [ ] `src/components/ui/navigation-menu.jsx:66` $\rightarrow$ Physical Spacing Class: `left-0`
- [ ] `src/components/ui/pagination.jsx:58` $\rightarrow$ Physical Spacing Class: `pl-2.5`
- [ ] `src/components/ui/pagination.jsx:76` $\rightarrow$ Physical Spacing Class: `pr-2.5`
- [ ] `src/components/ui/popover.jsx:19` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/popover.jsx:19` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/resizable.jsx:27` $\rightarrow$ Physical Spacing Class: `left-1/2`
- [ ] `src/components/ui/resizable.jsx:27` $\rightarrow$ Physical Spacing Class: `left-0`
- [ ] `src/components/ui/select.jsx:55` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/select.jsx:55` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/components/ui/select.jsx:86` $\rightarrow$ Physical Spacing Class: `pl-2`
- [ ] `src/components/ui/select.jsx:86` $\rightarrow$ Physical Spacing Class: `pr-8`
- [ ] `src/components/ui/select.jsx:90` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/sheet.jsx:36` $\rightarrow$ Physical Spacing Class: `left-0`
- [ ] `src/components/ui/sheet.jsx:38` $\rightarrow$ Physical Spacing Class: `right-0`
- [ ] `src/components/ui/sheet.jsx:54` $\rightarrow$ Physical Spacing Class: `right-4`
- [ ] `src/components/ui/table.jsx:51` $\rightarrow$ Physical Spacing Class: `pr-0`
- [ ] `src/components/ui/table.jsx:62` $\rightarrow$ Physical Spacing Class: `pr-0`
- [ ] `src/components/ui/toast.jsx:14` $\rightarrow$ Physical Spacing Class: `right-0`
- [ ] `src/components/ui/toast.jsx:22` $\rightarrow$ Physical Spacing Class: `pr-6`
- [ ] `src/components/ui/toast.jsx:62` $\rightarrow$ Physical Spacing Class: `right-1`
- [ ] `src/components/ui/tooltip.jsx:18` $\rightarrow$ Physical Spacing Class: `right-2`
- [ ] `src/components/ui/tooltip.jsx:18` $\rightarrow$ Physical Spacing Class: `left-2`
- [ ] `src/pages/ItemDetail.jsx:2208` $\rightarrow$ Physical Spacing Class: `left-1/2`

### Physical Alignments
- [ ] `src/components/LocationCard.jsx:63` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/components/SwapPickerModal.jsx:138` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/components/WeightedList.jsx:86` $\rightarrow$ Physical Alignment: `text-right`
- [ ] `src/components/stylist/OutfitRecommendationCard.jsx:94` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/components/stylist/OutfitTinderSwiper.jsx:204` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/components/ui/accordion.jsx:19` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/components/ui/alert-dialog.jsx:43` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/components/ui/dialog.jsx:56` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/components/ui/drawer.jsx:50` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/components/ui/sheet.jsx:70` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/components/ui/table.jsx:51` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/pages/AddItem.jsx:2310` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/pages/AddItem.jsx:2346` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/pages/AddItem.jsx:2402` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/pages/ItemDetail.jsx:1619` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/pages/ItemDetail.jsx:1664` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/pages/Marketplace.jsx:514` $\rightarrow$ Physical Alignment: `text-right`
- [ ] `src/pages/Profile.jsx:467` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/pages/Profile.jsx:518` $\rightarrow$ Physical Alignment: `text-left`
- [ ] `src/pages/Transactions.jsx:367` $\rightarrow$ Physical Alignment: `text-right`
- [ ] `src/pages/Transactions.jsx:367` $\rightarrow$ Physical Alignment: `text-left`

## 3. Locale File Key Parity
Missing keys in localized files compared to `en.json`.

All locale files are fully in parity with `en.json` (0 missing keys).

---
## Summary Count
16 i18next violations, 119 files with physical RTL classes, 0 total missing keys across locale files.