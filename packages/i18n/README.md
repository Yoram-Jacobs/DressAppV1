# @dressapp/i18n

Shared internationalisation package for DressApp. Provides:

- **13 locale JSON files** (`en`, `he`, `ar`, `es`, `fr`, `de`, `it`, `pt`, `nl`, `ru`, `zh`, `ja`, `hi`)
- **RTL metadata**: `RTL_LANGUAGES` set and `isRtl(code)` helper — single source of truth for both web and mobile
- **`createI18n(adapters)`**: platform-agnostic factory that takes persistence callbacks (no `localStorage` hardcoding)

## Usage

### Web (`apps/web`)
```js
import i18n, { isRtl } from '@/lib/i18n'; // thin adapter in apps/web/src/lib/i18n.js
```

### Mobile (`apps/mobile`)
```ts
import i18n, { hydrateLanguage } from '@mobile/lib/i18n';
```

## Updating locale strings

```bash
cd packages/i18n/scripts
python update_locales.py
```

## Supported languages

| Code | Language | RTL |
|------|----------|-----|
| `en` | English | No |
| `he` | Hebrew (עברית) | **Yes** |
| `ar` | Arabic (العربية) | **Yes** |
| `es` | Spanish | No |
| `fr` | French | No |
| `de` | German | No |
| `it` | Italian | No |
| `pt` | Portuguese | No |
| `nl` | Dutch | No |
| `ru` | Russian | No |
| `zh` | Chinese (Simplified) | No |
| `ja` | Japanese | No |
| `hi` | Hindi | No |
