# DressApp — Frontend SPA (React 19)

This is the Single Page Application (SPA) client interface for the DressApp personal digital wardrobe and styling ecosystem.

---

## 🛠️ Technology Stack & Styling
* **Framework**: React 19 SPA bootstrapped with Create React App & Craco.
* **Styling**: Tailwind CSS & Vanilla CSS custom design tokens, leveraging Shadcn UI components.
* **Global Stores**: Zustand with IndexedDB local caching for zero-latency operations.
* **Locales**: `react-i18next` with dictionary catalogs in 13 languages.
* **Dpp Scanning**: HTML5-QR code reader for Digital Product Passports.
* **Interactive Canvas**: Three.js / React Three Fiber for 2D/3D wardrobe layering representations.

---

## 🚀 Available Scripts

In the frontend directory, you can run:

### `yarn start` / `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000). The page will hot-reload automatically when source code changes are detected.

### `yarn build` / `npm run build`
Compiles static build assets to the `/build` folder, optimizing production bundles for fast page loads and small Gzip footprints.

### `yarn lint` / `npm run lint`
Runs ESLint audits across JS/JSX source files.

---

## 📂 Key Components & Modules

* **`src/components/ProfileDetailsCard.jsx`**: Controls demographic details, lifestyle status, Google Maps coordinates geolocation sync, refer-a-friend links, and the physical sizing profile:
  * **Fresh Start Mode**: Displays only Height, Weight, Waist size, and Foot Length. Completing these fields queries the backend size regression endpoint to populate calculated measurements.
  * **Edit Mode**: Displays all 10 physical body dimensions. Modifying any of the 4 basic parameters recalculates the other 6 immediately with a 400ms debounce.
* **`src/pages/Profile.jsx`**: Handles SaaS AI billing preferences (Credits vs. Personal keys for Gemini, Claude, OpenAI), scheduler daily notification limits, and premium subscriptions integration via PayPal REST APIs.
* **`src/locales/`**: Multi-language dictionaries supporting English, Hebrew, Arabic, Hindi, Spanish, French, German, Italian, Japanese, Portuguese, Russian, Dutch, and Chinese.

---

## 🌐 Localization Guidelines
1. **No Hardcoded Strings**: All user-facing labels must be wrapped inside `t('key', { defaultValue: '...' })` hooks.
2. **Options-Based Fallbacks**: Do not use positional fallbacks `t('key', 'default')`. Always use the options-based object format to ensure proper extraction during compilation.
3. **RTL Support**: Design layout directions to dynamically mirror flex, grids, and alignment indicators when active language codes are Hebrew (`he`) or Arabic (`ar`).
4. **Branding Standard**: Section tags referencing headers like CONTACT must remain clean of parenthesized English text (e.g. no `(CONTACT)` suffixes in translated files).
