# M3 Investigation Report: UI, Form Validation & Image Picker for ClosetAddScreen

## Executive Summary
This report provides the architectural specification and implementation plan for **`ClosetAddScreen.tsx`** (`apps/mobile/src/screens/closet/ClosetAddScreen.tsx`) in Milestone M3.
The screen ports the manual entry flow from `apps/web/src/pages/AddItem.jsx` to React Native / Expo 53 while gracefully handling the excluded camera capture and DPP scanner features with an intuitive placeholder.

---

## 1. Package Inventory & Verification

An inspection of `apps/mobile/package.json` and the workspace root reveals:

| Package | Version | Presence in `apps/mobile` | Status & Compatibility |
| :--- | :--- | :--- | :--- |
| `expo-image-picker` | `~16.1.4` | ✅ Direct dependency | Compatible with Expo SDK 53 |
| `react-hook-form` | `^7.56.2` | ✅ Direct dependency | Compatible with React 19 / RN 0.79 |
| `zod` | `^3.24.4` | ✅ Direct dependency | Compatible |
| `@hookform/resolvers` | `^5.0.1` | ⚠️ Hoisted in workspace | Clean TypeScript resolver implemented inline or imported via `@hookform/resolvers/zod` |
| `react-native-paper` | `^5.13.1` | ✅ Direct dependency | Used for Material Community Icons & ActivityIndicator |
| `react-native-safe-area-context` | `5.4.0` | ✅ Direct dependency | Used for `SafeAreaView` |
| `@react-navigation/native` | `^7.1.10` | ✅ Direct dependency | Used for typed `useNavigation` & route params |
| `i18next` & `react-i18next` | `^26.0.6` / `^17.0.4` | ✅ Direct dependency | Used for multi-language translations and RTL |

---

## 2. Zod Schema & React Hook Form Architecture

### 2.1 Form Data Type & Zod Schema
```typescript
import { z } from 'zod';

export const CATEGORY_KEYS = [
  'Top',
  'Bottom',
  'Outerwear',
  'Full Body',
  'Footwear',
  'Accessories',
  'Underwear',
] as const;

export type CategoryKey = typeof CATEGORY_KEYS[number];

export const closetAddSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Item name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  category: z.enum(CATEGORY_KEYS, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),
  color: z
    .string()
    .trim()
    .min(1, 'Please select or enter a color')
    .max(50, 'Color name must be 50 characters or fewer'),
  brand: z
    .string()
    .trim()
    .max(60, 'Brand name must be 60 characters or fewer')
    .optional()
    .or(z.literal('')),
  size: z
    .string()
    .trim()
    .max(30, 'Size must be 30 characters or fewer')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes must be 500 characters or fewer')
    .optional()
    .or(z.literal('')),
  imageUri: z.string().nullable().optional(),
  imageBase64: z.string().nullable().optional(),
  imageMime: z.string().optional(),
});

export type ClosetAddFormData = z.infer<typeof closetAddSchema>;
```

### 2.2 Integration with `react-hook-form`
To ensure zero dependency friction across workspace bundlers and strict TypeScript checking, a type-safe custom resolver or standard resolver pattern is defined:

```typescript
import { useForm, Controller } from 'react-hook-form';

export const defaultFormValues: ClosetAddFormData = {
  name: '',
  category: 'Top',
  color: 'Black',
  brand: '',
  size: '',
  notes: '',
  imageUri: null,
  imageBase64: null,
  imageMime: 'image/jpeg',
};

// Inside component:
const {
  control,
  handleSubmit,
  setValue,
  watch,
  reset,
  formState: { errors, isSubmitting, isValid },
} = useForm<ClosetAddFormData>({
  defaultValues: defaultFormValues,
  resolver: async (data) => {
    const parsed = closetAddSchema.safeParse(data);
    if (parsed.success) {
      return { values: parsed.data, errors: {} };
    }
    const formErrors: Record<string, { type: string; message: string }> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      if (!formErrors[field]) {
        formErrors[field] = {
          type: issue.code,
          message: issue.message,
        };
      }
    }
    return { values: {}, errors: formErrors };
  },
  mode: 'onChange',
});
```

---

## 3. Expo Image Picker Implementation (`expo-image-picker` 16.x)

### 3.1 Permission Handling & Asset Acquisition
In Expo 53, `expo-image-picker` allows launching the system photo gallery and automatically producing base64 image data suitable for immediate upload to the backend API (`api.createItem` / `closet.createItem`).

```typescript
import * as ImagePicker from 'expo-image-picker';

const handlePickImage = async () => {
  try {
    // 1. Check or request media library permissions
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert(
        t('addItem.permissionRequiredTitle', 'Permission Required'),
        t('addItem.permissionRequiredMsg', 'Photo library access is needed to select garment images.'),
        [{ text: t('common.ok', 'OK') }]
      );
      return;
    }

    // 2. Launch library picker with 3:4 aspect ratio & base64 encoding
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setValue('imageUri', asset.uri, { shouldValidate: true });
      if (asset.base64) {
        setValue('imageBase64', asset.base64);
        setValue('imageMime', asset.mimeType || 'image/jpeg');
      }
    }
  } catch (error) {
    console.error('[ClosetAddScreen] Image pick error:', error);
    Alert.alert(t('common.error', 'Error'), t('addItem.imagePickError', 'Failed to select image.'));
  }
};
```

### 3.2 Key Configuration Parameters:
- `mediaTypes: ['images']`: Restricts selection to image files.
- `allowsEditing: true`: Allows cropping to the ideal bounding box.
- `aspect: [3, 4]`: Maintains consistency with DressApp's portrait card standard.
- `quality: 0.8`: Produces crisp, high-resolution photos while keeping the payload compact (<1 MB base64).
- `base64: true`: Eliminates manual file system read operations by returning base64 directly in `asset.base64`.

---

## 4. Design System & Theme Integration

`ClosetAddScreen.tsx` utilizes tokens from `@mobile/theme/tokens` and `useTheme()` for light/dark mode and RTL support:

- **Colors**:
  - `colors.background`: Main screen background (`hsl(40, 20%, 98%)` light / `hsl(240, 10%, 8%)` dark)
  - `colors.card`: Form surface & container backgrounds
  - `colors.border`: Inputs, card borders, and dividers (`hsl(240, 6%, 90%)`)
  - `colors.foreground` & `colors.mutedFg`: Primary text and secondary/placeholder labels
  - `colors.brand`: Brand highlights, active tab indicators, and submit buttons (`hsl(271, 81%, 56%)`)
  - `colors.destructive`: Required field asterisks and error messages (`hsl(0, 72%, 52%)`)
  - `colors.secondary`: Chip backgrounds and inactive button fills
- **Typography**:
  - `fonts.displayBold` / `fonts.display`: Screen headers and section titles
  - `fonts.body`, `fonts.bodyMedium`, `fonts.bodySemiBold`, `fonts.bodyBold`: Form labels, chip texts, and buttons
- **Layout & Spacing**:
  - `spacing[4]` (16px) standard horizontal padding
  - `spacing[6]` (24px) between form sections
  - `radii.lg` (20px) and `radii.xl` (24px) for cards and hero image containers
  - `radii.full` (9999px) for category/color chips and action pills

---

## 5. UI Architecture & Screen Structure

### 5.1 Top Navigation & Mode Switcher
The screen provides a Segmented Tab Bar at the top:
1. **Manual Entry Tab** (Active Form)
2. **Camera Scan Tab** ("Coming Soon" Placeholder)

```
+--------------------------------------------------------+
|  <- Add Garment                                        |
+--------------------------------------------------------+
|  [  Manual Entry (Active)  ] [ Camera Scan (Phase 7) ] |
+--------------------------------------------------------+
```

### 5.2 Manual Form Layout
When "Manual Entry" is active, a structured `ScrollView` renders:

1. **Hero Image Container (3:4 Ratio)**:
   - If no image: Dashed border container with camera/upload icon, "Select Photo from Library", and 3:4 portrait aspect badge.
   - If image selected: 3:4 image preview with overlay controls to "Change Photo" or "Remove Photo".

2. **Garment Name (Required)**:
   - Floating/styled label with required asterisk (`*`).
   - `TextInput` with clear button and inline error message when invalid.

3. **Category Selector (Required)**:
   - Horizontal scrollable row of tactile chips with icons:
     - `Top` (`tshirt-crew-outline`)
     - `Bottom` (`hanger`)
     - `Outerwear` (`coat-rack`)
     - `Full Body` (`tag-outline`)
     - `Footwear` (`shoe-heel`)
     - `Accessories` (`bag-personal-outline`)
     - `Underwear` (`shield-outline`)
   - Selected chip highlighted in brand purple with checkmark.

4. **Color Swatch & Quick Selector**:
   - Palette chips: Black, White, Grey, Navy, Blue, Green, Beige, Brown, Red, Pink, Purple, Yellow, Orange, Multicolor.
   - Each chip displays a color dot + localized name.
   - Includes custom color text input for precision shades.

5. **Brand & Size (Optional)**:
   - Side-by-side or stacked inputs.
   - Size chips for quick selection: `XS`, `S`, `M`, `L`, `XL`, `XXL`, `One Size` or freeform text.

6. **Notes & Styling Tips (Optional)**:
   - Multiline `TextInput` (3-4 lines) for material care, occasion, or notes.

7. **Submit & Reset Buttons**:
   - Primary full-width button: **"Save Garment to Closet"** (with `ActivityIndicator` during submit).
   - Secondary button: **"Clear Form"**.

### 5.3 "Camera Scan Coming Soon" Placeholder View
When the user switches to the "Camera Scan" tab or navigates with `{ source: 'camera' }`:

```
+--------------------------------------------------------+
|                                                        |
|                     [ (AI Camera) ]                    |
|                                                        |
|            Camera Scan & Auto-Detection                |
|               [ Coming in Phase 7 ]                    |
|                                                        |
|   Live camera scanning, automatic background removal,  |
|   and Digital Product Passport (DPP) QR codes are      |
|   under active development.                            |
|                                                        |
|   In the meantime, please add your garments via the    |
|   Manual Entry tab or upload from your Photo Library.   |
|                                                        |
|            [ -> Switch to Manual Entry ]               |
|                                                        |
+--------------------------------------------------------+
```

---

## 6. API Payload Construction & Submission

When the form is submitted, the payload is mapped to `api.createItem()`:

```typescript
const onSubmit = async (data: ClosetAddFormData) => {
  try {
    const payload = {
      source: 'Private',
      name: data.name.trim(),
      title: data.name.trim(),
      category: data.category,
      color: data.color.trim(),
      colors: data.color ? [{ name: data.color.trim() }] : [],
      brand: data.brand?.trim() || undefined,
      size: data.size?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      caption: data.notes?.trim() || undefined,
      image_base64: data.imageBase64 || undefined,
      image_mime: data.imageMime || (data.imageBase64 ? 'image/jpeg' : undefined),
      marketplace_intent: 'own',
    };

    const created = await api.createItem(payload);
    
    Alert.alert(
      t('addItem.savedTitle', 'Garment Saved!'),
      t('addItem.savedMsg', 'Your new item has been added to your closet.'),
      [
        {
          text: t('common.ok', 'OK'),
          onPress: () => navigation.navigate('Closet'),
        },
      ]
    );
  } catch (err: unknown) {
    console.error('[ClosetAddScreen] Submit error:', err);
    const errorMsg =
      (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
      t('addItem.saveFailed', 'Failed to save garment. Please check your connection and try again.');
    Alert.alert(t('common.error', 'Error'), errorMsg);
  }
};
```

---

## 7. Verification & Typecheck Plan

1. Replace `apps/mobile/src/screens/closet/ClosetAddScreen.tsx` with complete implementation (>3 KB).
2. Run TypeScript verification:
   ```bash
   node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
   ```
3. Verify web build remains intact:
   ```bash
   yarn build
   ```
4. Verify named & default exports for lazy loader compatibility in `ClosetStack.tsx`.
