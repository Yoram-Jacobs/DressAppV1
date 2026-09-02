# Comprehensive Investigation Report: ClosetAddScreen Navigation, Flow & Integration

## Executive Summary
This report provides the architectural specification, route integration design, end-to-end user flow, validation logic, accessibility, and RTL compliance details for implementing `ClosetAddScreen.tsx` in `@dressapp/mobile` (Milestone M3, Requirement R3).

---

## 1. Route Parameters and Navigation Types

### 1.1 Route Param Definitions (`apps/mobile/src/navigation/types.ts`)
In `apps/mobile/src/navigation/types.ts`:
```typescript
// Line 18-22
export type ClosetStackParamList = {
  Closet: undefined;
  ItemDetail: { itemId: string };
  ClosetAdd: { source?: 'camera' | 'manual' };
};
```
The screen receives an optional `source` param:
- `'camera'`: Invoked when user taps the central floating camera FAB in `MainTabs.tsx`.
- `'manual'`: Invoked when user taps the "Add" button in `ClosetScreen.tsx` (header button, FAB, or empty state CTA).
- `undefined`: Defaults to manual entry flow.

### 1.2 Stack Configuration & Presentation (`apps/mobile/src/navigation/stacks/ClosetStack.tsx`)
```typescript
<Stack.Screen
  name="ClosetAdd"
  component={ClosetAddScreen as any}
  options={{ title: 'Add Item', presentation: 'modal' }}
/>
```
Key architectural considerations:
1. **Modal Presentation**: Rendered as a modal presentation stack screen.
2. **Navigation Hooks**: Screen components should use typed hooks:
   ```typescript
   export type ClosetAddNavigationProp = NativeStackNavigationProp<ClosetStackParamList, 'ClosetAdd'>;
   export type ClosetAddRouteProp = RouteProp<ClosetStackParamList, 'ClosetAdd'>;
   ```
3. **Popping Back**: To dismiss or return to the closet list:
   ```typescript
   if (navigation.canGoBack()) {
     navigation.goBack();
   } else {
     navigation.navigate('Closet');
   }
   ```

### 1.3 Navigation Entry Points
1. **`ClosetScreen.tsx` (Header Add Button & Floating FAB)**:
   - Dispatches `navigation.navigate('ClosetAdd', { source: 'manual' })`.
2. **`MainTabs.tsx` (Central Capture FAB)**:
   - Dispatches `nav.navigate('ClosetTab', { screen: 'ClosetAdd', params: { source: 'camera' } })`.

---

## 2. Existing Stub Analysis (`apps/mobile/src/screens/closet/ClosetAddScreen.tsx`)

The existing file is an 18-line placeholder:
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ClosetAddScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Item</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </View>
  );
}
```
**Required Transformation**: Replace this stub with a production-grade manual form screen (>3 KB, full TypeScript, `react-hook-form` + `zod`, `expo-image-picker`, RTL, `KeyboardAvoidingView`, accessible touch targets, and design token adherence).

---

## 3. End-to-End User Flow Architecture

```
+-----------------------------------------------------------------------------+
| 1. ENTRY & ROUTE HYDRATION                                                  |
|    - Read route.params?.source ('camera' | 'manual')                        |
|    - If 'camera': Show "Camera scan coming soon" banner with photo picker CTA|
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 2. IMAGE SELECTION & PREVIEW (expo-image-picker)                            |
|    - Request media library permissions                                      |
|    - Launch ImagePicker (allowsEditing: true, aspect: [3,4], quality: 0.8)   |
|    - Extract base64 payload & display 3:4 portrait thumbnail preview        |
|    - Provide "Change Photo" / "Remove Photo" action buttons                 |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 3. FORM COMPLETION & TAXONOMY SELECTION (react-hook-form + zod)              |
|    - Title / Garment Name (required text input)                             |
|    - Category (required: Top, Bottom, Outerwear, Full Body, Footwear, etc.) |
|    - Sub-category / Item Type (optional text input)                         |
|    - Brand & Size (optional text inputs / quick chips)                      |
|    - Primary Color & Pattern (optional text / chips)                        |
|    - Seasonality (multi-select: spring, summer, fall, winter, all)          |
|    - Dress Code (casual, smart-casual, business, formal, athletic, etc.)   |
|    - Marketplace Intent (own, for_sale, donate, swap, rent) + Optional Price|
|    - Personal Notes (optional multi-line text input)                        |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 4. VALIDATION & FEEDBACK (Zod Schema Validation)                            |
|    - Real-time / on-blur / on-submit validation                             |
|    - Clear inline error messages (with warning icon and red accent styling) |
|    - Highlight invalid fields                                               |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 5. SUBMIT TRIGGER & API POST                                                |
|    - Submit button shows loading spinner (ActivityIndicator)                |
|    - Form interaction disabled during in-flight request                     |
|    - Construct CreateItemIn payload and call api.createItem(payload)        |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 6. SUCCESS HANDLING & NAVIGATION                                            |
|    - Show success confirmation (Alert.alert or Toast / Banner feedback)     |
|    - Reset form state                                                       |
|    - Navigate back to ClosetScreen (navigation.goBack() or navigate('Closet'))
+-----------------------------------------------------------------------------+
```

### 3.1 Form Fields Specification & Data Shapes
Mapping to backend `CreateItemIn` schema (`backend/app/api/v1/closet.py`):

| UI Field Name | Field Key | Type / Component | Backend Schema Match | Validation Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Title / Item Name** | `title` / `name` | `TextInput` | `title: str`, `name: str` | `z.string().min(1, 'Title is required').max(100)` |
| **Category** | `category` | Selectable Chip Group / Picker | `category: str` | `z.string().min(1, 'Category is required')` |
| **Sub-category** | `sub_category` | `TextInput` | `sub_category: str \| None` | `z.string().optional()` |
| **Brand** | `brand` | `TextInput` | `brand: str \| None` | `z.string().optional()` |
| **Size** | `size` | `TextInput` / Chips | `size: str \| None` | `z.string().optional()` |
| **Primary Color** | `color` | `TextInput` / Color Chips | `color: str \| None`, `colors: WeightedTag[]` | `z.string().optional()` |
| **Pattern** | `pattern` | Horizontal Chip Selector | `pattern: str \| None` | `z.string().optional()` |
| **Dress Code** | `dress_code` | Horizontal Chip Selector | `dress_code: DressCode \| None` | `z.string().optional()` |
| **Season** | `season` | Multi-select Chip Group | `season: list[str]` | `z.array(z.string()).optional()` |
| **Marketplace Intent**| `marketplace_intent` | Intent Chip Selector | `marketplace_intent: MarketplaceIntent` | `z.enum(['own', 'for_sale', 'donate', 'swap', 'rent'])` |
| **Price** | `price` | Numeric `TextInput` | `price_cents: int \| None` | Optional numeric string, converted to cents |
| **Notes** | `notes` | Multi-line `TextInput` | `notes: str \| None` | `z.string().optional()` |
| **Garment Photo** | `image_base64` | `expo-image-picker` preview | `image_base64: str \| None`, `image_mime: str` | Optional base64 data string |

### 3.2 Camera Scan Placeholder
When navigated with `source === 'camera'` or when camera capture is requested, display a designated card with:
- Icon: `camera-outline`
- Title: *"Camera Scanner Coming Soon"*
- Subtitle: *"Live optical capture and DPP tag scanning are scheduled for Phase 7. In the meantime, select an existing photo from your photo library or enter details manually."*
- Quick action: "Select from Photo Library" button.

---

## 4. Integration Specifications

### 4.1 API Client Integration
Use the singleton `api` instance from `@mobile/lib/api`:
```typescript
import { api } from '@mobile/lib/api';

// Payload creation
const payload = {
  source: formValues.marketplace_intent !== 'own' ? 'Shared' : 'Private',
  name: formValues.title.trim(),
  title: formValues.title.trim(),
  category: formValues.category,
  sub_category: formValues.sub_category?.trim() || undefined,
  brand: formValues.brand?.trim() || undefined,
  size: formValues.size?.trim() || undefined,
  color: formValues.color?.trim() || undefined,
  colors: formValues.color ? [{ name: formValues.color.trim(), confidence: 1.0 }] : [],
  pattern: formValues.pattern || undefined,
  dress_code: formValues.dress_code || undefined,
  season: formValues.season && formValues.season.length > 0 ? formValues.season : ['all'],
  marketplace_intent: formValues.marketplace_intent || 'own',
  price_cents: formValues.price ? Math.round(parseFloat(formValues.price) * 100) : 0,
  currency: 'USD',
  notes: formValues.notes?.trim() || undefined,
  image_base64: imageBase64 || undefined,
  image_mime: imageMime || 'image/jpeg',
};

const result = await api.createItem(payload);
```

### 4.2 Error Handling & Resilience
1. Catch network, authentication, and validation errors from `api.createItem`.
2. Extract error message:
   ```typescript
   const msg = err?.response?.data?.detail || err?.message || t('addItem.saveFailed', 'Could not save garment.');
   Alert.alert(t('common.error', 'Error'), msg);
   ```
3. Preserve all user input so the user can resolve issues without losing entered data.

---

## 5. Mobile UX, RTL & Keyboard Guidelines

### 5.1 RTL Compliance (`I18nManager.isRTL`)
- **Navigation Controls**:
  - Close / Back icon: `I18nManager.isRTL ? 'arrow-right' : 'arrow-left'` or `'close'`.
- **Text & Input Layout**:
  - All form labels, placeholder text, and text inputs must naturally align with `I18nManager.isRTL ? 'right' : 'left'`.
  - Prefix/suffix icons inside input wrappers must respect logical layout (`paddingStart`, `paddingEnd`, `marginEnd`).
- **Chip & Selector Scrolling**:
  - Horizontal chip selectors must support bidirectional scroll flow.
- **Icon + Label Rows**:
  - Use `flexDirection: 'row'` with `alignItems: 'center'` and explicit `gap` to ensure mirroring in RTL.

### 5.2 Keyboard Avoiding & Tap Dismissal
- Wrap the entire screen inside `KeyboardAvoidingView`:
  ```typescript
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
  >
    <ScrollView
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {/* Form Content */}
    </ScrollView>
  </KeyboardAvoidingView>
  ```
- `keyboardShouldPersistTaps="handled"` ensures that tapping taxonomy chips, photo picker buttons, or the submit button immediately registers without needing a prior tap to dismiss the keyboard.

### 5.3 Accessibility (A11y)
- **Roles & Labels**:
  - Screen Header: `accessibilityRole="header"`
  - Photo picker trigger: `accessibilityRole="button"`, `accessibilityLabel="Pick photo from library"`
  - Category / Taxonomy chips: `accessibilityRole="button"`, `accessibilityState={{ selected: isSelected }}`
  - Submit Button: `accessibilityRole="button"`, `accessibilityLabel="Save garment to closet"`, `accessibilityState={{ disabled: isSubmitting }}`
- **Touch Target Dimensions**: Minimum 44x44 pt hit box for all actionable buttons, close buttons, and chips.
- **Color Contrast**: Compliant with WCAG AA using `@mobile/theme/tokens` (`foreground`, `mutedFg`, `destructive`, `accentFg`).

---

## 6. Implementation Architecture Blueprint

```tsx
// Architectural Blueprint Outline for ClosetAddScreen.tsx
export function ClosetAddScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ClosetAddNavigationProp>();
  const route = useRoute<ClosetAddRouteProp>();
  const { colors } = useTheme();

  const source = route.params?.source ?? 'manual';

  // Photo state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');

  // react-hook-form setup
  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<ItemFormData>({
    defaultValues: {
      title: '',
      category: 'Top',
      brand: '',
      size: '',
      color: '',
      pattern: '',
      dress_code: 'casual',
      season: ['all'],
      marketplace_intent: 'own',
      price: '',
      notes: '',
    },
  });

  // Pick Image handler
  const handlePickImage = async () => { ... };

  // Form Submit handler
  const onSubmit = async (values: ItemFormData) => { ... };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView ...>
        <ScrollView ...>
          {/* Header Bar */}
          {/* Camera Scan Notice Banner (if source === 'camera') */}
          {/* Image Picker Section (3:4 card / preview) */}
          {/* Form Fields: Title, Category Chips, Brand, Size, Color */}
          {/* Advanced Taxonomy: Season, Dress Code, Pattern, Marketplace Intent */}
          {/* Submit Action Button */}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

---

## 7. Verification Strategy
1. **Static Analysis**: Run `node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck` from `apps/mobile/` to guarantee zero compilation or typing regressions.
2. **Web Build Safety**: Run `yarn build` from `apps/web/` to guarantee no shared cross-package breakage.
3. **Screen Completeness**: Verify `ClosetAddScreen.tsx` size > 3 KB with image picker, form fields, Zod validation, API call, loading state, error alert, and navigation back.
