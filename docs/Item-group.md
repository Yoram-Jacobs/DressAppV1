# Item Grouping Feature Summary

The **Item Grouping** feature in DressApp allows users to bundle multiple photographs of the same physical garment (e.g., front view, back view, profile view, and details) into a single logical unit. 

---

## Core Concepts

* **Host and Member Roles**: Within a group, one item is designated as the `host` (`group_role="host"`), and the remaining items are designated as `member`s (`group_role="member"`). 
* **Shared Identifier**: All items in a group share a common `group_id`, which is initialized to the host's item ID.
* **Unified Group Analysis**: When items are grouped, ungrouped, or edited, a background task (`reanalyze_group_helper`) collects the images of all items in the group (host first, then members) and submits them to the vision model (`garment_vision_service.analyze_group`). This synchronizes consistent metadata (such as category, brand, color, fabric, and pattern) across all group components while automatically tagging items with view tags (`Front`, `Back`, `Profile`).
* **Taxonomy Gatekeeper**: To prevent users from mistakenly grouping unrelated items (e.g., grouping a shirt with shoes), the application runs a preflight comparison on key taxonomy fields (category, sub-category, season, and quality). If a mismatch is detected, the frontend presents a gatekeeper warning modal asking the user to confirm the grouping action.

---

## Development Progression

1. **Basic Association**: The feature started with simple one-to-one item linking using `group_id` properties.
2. **Merge & Reorder Capabilities**:
   - Added support for merging entire groups (e.g., if a member item was already a host of another group, the groups are merged under a single host).
   - Added support for swapping the host of a group dynamically (`set-host` endpoint), which changes the `group_role` and reassigns the `group_id` for all group members.
3. **Advanced Editing and Detachment**:
   - Built the `group-edit` endpoint to allow bulk edits, host promotion, and detaching multiple member items in a single request.
   - Built the `ungroup` endpoint. If a host item is ungrouped or deleted, the system automatically promotes one of the remaining members to host, or dissolves the group if only one item remains.
4. **Localization and Validation Integration**:
   - Integrated the preflight check with translations, so the mismatch warnings and buttons render properly across all supported languages (English, Hebrew, Arabic, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, and Hindi).

---

## Key Bug Fixes

### 1. Taxonomy Mismatch False Positives
* **Problem**: Grouping items could trigger a taxonomy warning even if they were the same type of garment, due to category/subcategory string differences (e.g., comparing `'top'` vs `'tops'`, or comparing English `'shirt'` with translated Hebrew `'חולצה'`).
* **Fix**: Refactored the taxonomy comparator helper in `taxonomy.js` to normalize categories (e.g. mapping `tops` to `top`) and utilize the `canonicalSubCategoryKey` translation index to resolve equivalent terms across different languages.

### 2. Season Array Spread Bug
* **Problem**: The season attribute could be stored either as an array (e.g., `['all']`) or a string (e.g., `'all'`). The normalization helper `normSeason` had a bug that spread string variables, treating `'all'` as `['a', 'l', 'l']` and causing incorrect season mismatch warnings.
* **Fix**: Upgraded `normSeason` in `taxonomy.js` to verify variable types explicitly, ensuring string values are wrapped in an array instead of being spread.

### 3. Arabic Unicode Bleed in Hebrew Locale
* **Problem**: The word "Cancel" (`ביטול`) and "Profile" (`פרופיל`) in the Hebrew translation file `he.json` contained Arabic letters (Waw `و`, Lam `ل`, Yeh `ي`) instead of Hebrew equivalents (Vav `ו`, Lamed `ל`, Yod `י`), resulting in distorted styling and rendering.
* **Fix**: Cleaned up the Hebrew translation values recursively to replace all instances of Arabic Unicode characters with their correct Hebrew equivalents.

### 4. Case-Sensitive Language Preference Sync
* **Problem**: Users with `preferred_language = "He"` (capitalized) in the database had their language preference ignored, falling back to English because the i18next synchronization code looked for exact matches against lowercase supported codes (like `"he"`).
* **Fix**: Normalized language code checks to lowercase across all frontend components (including initialization, background sync, profile forms, text-to-speech, and speech-to-text configurations) to ensure case-insensitivity.
