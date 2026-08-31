# Profile, Sizing & Configuration (`/me`)

Manage physical measurements, skin tone, body photo cutouts, styling preferences, AI model credentials, and system integrations on your personal profile dashboard.

## Overview
The **Profile & Settings** page (`https://dressapp.co/me`) serves as the central control hub for your DressApp ecosystem. It houses your physical anthropometric parameters, digital try-on avatar stage, style constraints, localized preferences, AI model keys, and push notification schedules.

---

## Prerequisites
- An active DressApp account.
- (Optional) Device camera permissions for full-body photo upload.
- (Optional) Location permissions for local stylist campaign targeting and weather forecasting.

---

## Step-by-Step Guide: Top-to-Bottom Page Overview

### 1. Page Header & Explore Navigation Bar
Located at the top of the `/me` dashboard:
- **Header**: Displays your account status and title.
- **Explore Cards**: Quick shortcuts to main app sections:
  - **Trend Scout** (`/trends`): View daily AI-curated fashion news feeds.
  - **Outfits** (`/outfits`): Access your saved outfit calendar.
  - **Experts** (`/experts`): Browse local fashion stylists and tailors.
  - **Unpacked / Stats** (`/me/stats`): View wardrobe valuation, cost-per-wear metrics, and color breakdowns.

### 2. Language & Voice Selection Card
Prominently displayed for immediate accessibility:
- **Language Selector**: Choose from 12 supported languages (*English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi, Hebrew*). Selecting a language automatically updates the UI locale and binds the default regional Text-to-Speech (TTS) voice model.

---

### 3. Identity & Personal Details Card (`ProfileDetailsCard`)

Contains 9 expandable accordion panels managing your personal identity, sizing, and avatar rendering:

#### Panel A: Identity
- **First Name & Last Name**: Personal identification fields.
- **Email Address**: Read-only display of your registered email.
- **Date of Birth**: Used to personalize demographic trend scoring.
- *Google Autofill Badge*: Displays automatically if your profile was seeded via Google OAuth.

#### Panel B: Contact & Delivery Address
- **Phone Number**: Required to receive SMS/Push alerts for daily scheduler proposals and local expert campaigns.
- **Address Line 1**: Features OpenStreetMap (Nominatim) street-level autocomplete. Selecting a suggestion automatically populates Line 1, City, Region, Zip Code, and Country.
- **Address Line 2, City, Region, Postal Code**: Manual address fields for marketplace shipping.
- **Country**: Offline combobox searchable by country name or ISO-2 code.

#### Panel C: Demographics
- **Sex**: Select *Female* or *Male* to configure base body measurements and clothing taxonomy.
- **Personal Status**: Select *Single*, *Married*, *Divorced*, or *Widowed*.
- **Occupation**: Free-text entry (e.g. *Student*, *Marketing Manager*, *Barista*). Feeds the Trend Scout personalization ranker to prioritize relevant style news.

#### Summarized Guide: Syncing Missing Google Profile Data (People API Re-Consent)
If you signed in with Google before DressApp requested access to your **People API** profile details (phone, address, gender, date of birth), those fields may remain empty. You can sync them in one click:

1. **Open the Contact or Demographics accordion** — you'll see a **"Sync from Google"** button (refresh icon) next to the section title.
2. **Click "Sync from Google"** — if the required People API scopes weren't granted during your original sign-in, DressApp detects this and shows an info toast: *"Google needs your permission to access profile details. You will be redirected to Google to grant access."*
3. **Grant consent on Google's screen** — you're redirected to Google's OAuth consent screen. Check the boxes for **Profile info** (name, email, photo) and **Contact info** (phone, address, gender, birthday).
4. **Automatic return & auto-fill** — after consent, Google redirects you back to DressApp. The `syncGoogleProfile()` function runs automatically, calling the backend `/auth/google/sync-profile` endpoint which:
   - Fetches your phone, address, gender, and date of birth from Google People API
   - Populates the empty fields in the **Contact** (phone, address) and **Demographics** (sex, date of birth) panels
   - Saves the updates to your profile instantly
5. **Done** — your profile is now complete without manual typing.

> **Note**: The "Sync from Google" button also appears in the page header (next to the main "Sync Google Profile" button) and works the same way — it syncs all available Google profile data at once.

#### Panel D: Preferences & Measurement Units
- **Weight Unit**: Toggle between Kilograms (`kg`) and Pounds (`lb`).
- **Length Unit**: Toggle between Centimeters (`cm`) and Inches (`in`).

#### Panel E: Photos & Digital Avatar Stage
- **Left Column — Photo Pickers**:
  - *Face Photo*: Upload a avatar thumbnail.
  - *Full-body Photo*: Upload a full-body photograph. The system automatically executes local U2-Net (`rembg`) matting to strip the background.
  - *Remove Photo Button*: Single-click removal of your photo cutout, instantly switching the try-on stage back to the 2D SVG vector mannequin with zero UI lag.
- **Right Column — Digital Avatar & Try-On Stage**:
  - **Skin Tone Picker**: Interactive color palette to select your mannequin skin tone.
  - **Avatar Try-On Canvas**: Renders garments on top of your photo cutout or dynamic Bezier vector mannequin (`DynamicAvatar.jsx`) using calibrated landmark offsets (`top-[14.5%]` collar-to-neckline and `top-[36.5%]` waistband-to-waistline).

#### Panel F: Style Profile
- **Aesthetics**: Comma-separated style keywords (e.g. *Minimalist, Streetwear, Vintage*).
- **Color Palette**: Preferred color tones (e.g. *Pastels, Earth Tones, Monochrome*).
- **Avoid**: Colors or garment types to strictly exclude from AI recommendations (e.g. *Yellow, Crop Tops*).
- **Cultural Dress Conservativeness**: Select modesty level (*Casual/Relaxed*, *Moderate*, *Conservative*) to guide AI Stylist outfit coverage.

#### Panel G: Body Measurements & Sizing (ANSUR II Sizing Predictor)
- **Onboarding / Fresh Start Mode**: Enter 4 basic inputs: **Height**, **Weight**, **Waist Circumference**, and **Foot Length**. The built-in scikit-learn ANSUR II multi-output regression model automatically predicts 6 structural measurements:
  - *Shoulders*, *Chest / Bust*, *Hip*, *Sleeve Length*, *Inseam*, and *Outseam*.
- **Automatic Size Translation**: Once the structural measurements are predicted, deterministic sizing algorithms instantly populate **all standard retail sizes** down to the shoe size:
  - *Casual Shirt Size* (XS–XXL based on chest circumference)
  - *Pants Waist Size* (inches, converted from waist cm)
  - *US Shoe Size* (Men's/Women's formulas from foot length)
  - *Women's Dress Size* (US 0–14+ based on waist)
  - *Women's Bra Size* (band + cup calculated from bust/underbust)
- **Detailed Edit Mode**: After the auto-fill, fine-tune all 15 sizing parameters (including Shirt Size, Pants Size, Shoe Size, Bra Size, Dress Size) and Hair attributes (*Length, Type, Color, Style*).
- **Live Unit Toggle**: Switch between *kg/cm* and *lb/in* — all values convert instantly without re-prediction.

#### Panel H: Professional & Expert Directory Registration
- **Professional Stylist Toggle**: Register as a verified fashion professional (stylist, tailor, designer).
- **Business Details**: Input Business Name, Address, Phone, Email, Website, and Description to appear in the `/experts` directory and regional campaign ticker.

#### Panel I: PayPal Payout Settings
- **PayPal Receiver Email**: Enter your PayPal email to receive payouts for marketplace sales and active expert campaigns.

---

### 4. System Preferences Accordion Card

Manages system-level settings, subscriptions, and AI integrations:

- **AI Configuration**:
  - *Standard Mode*: Uses system-managed Gemini Flash 2.x endpoints.
  - *Custom API Keys Mode*: Connect custom Google Gemini, Anthropic, OpenAI, or DeepSeek API keys via a guided setup modal.
- **Subscription & Closet Limits**:
  - View current account tier (**Free**: 150-item limit vs **Pro**: Unlimited items).
  - Upgrade via PayPal Subscriptions REST API ($4.99/month or $29.99/year).
  - Copy **Referral Link**: Grants +10 closet capacity slots for each friend who registers.
  - View current account tier (**Free**: 50-item limit vs **Manager** or **Professional**: Unlimited items).
  - Access the **Pricing page** (`/pricing` or click on your plan card) to view the tier comparison table, select a plan, and subscribe.
  - Upgrade via PayPal Subscriptions REST API (Manager: $4.99/month; Professional: $9.99/month) or the Atzmai Gateway for local ILS transactions.
  - Copy **Referral Link**: Grants +10 closet capacity slots for each friend who registers (up to 200 items max).
- **Scheduler & Push Reminders**:
  - Toggle morning outfit proposal notifications.
  - Set frequency (*Everyday*, *Every Other Day*, *Twice a Week*, *On Weekday*), time (e.g., *07:00*), and dress-code style demands (*Casual*, *Formal*, *Athletic*, *Custom*).
  - Enable browser VAPID push alerts.
- **Campaign Notification Preferences**:
  - Granular toggles for *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos*, and *Personal Stylist*.
  - Adjust **Max Campaign Distance** slider (5km to 50km).
- **Google Calendar Connect**: OAuth button to sync personal calendar events with the AI Stylist.
- **Location Services Card**: Toggle GPS location permissions for distance-matched expert feeds and hyper-local weather.
- **Invite Friends Button**: Copy shareable referral link.
- **Shopping Assistant**: Access Chrome Web Store extension details or generate a **Universal Bookmarklet** (`javascript:...`) for instant e-commerce size comparisons.

---

### 5. Account Actions & Diagnostics
- **Sign Out**: Log out of your current session.
- **Delete my Account**: Link to permanently purge account data.
- **Developer Panel**: Diagnostic accordion for environment testing.

---

## Expected Results
- Instant synchronization of physical metrics, skin tone, and photo cutouts across the 2D Avatar Try-On Canvas.
- Zero idle network requests when navigating between settings panels.
- Customized AI Stylist outfit proposals aligned with your modesty rules and schedule.

---

## Troubleshooting
- **Photo background not removed**: Ensure your uploaded photo is full-body with contrasting background lighting.
- **Push alerts not arriving**: Confirm browser notification permissions are enabled and a phone number is saved under *Contact*.
- **Address autocomplete unresponsive**: Check that internet connection is active for OpenStreetMap Nominatim queries.

---

## Limitations
- Free tier account space is capped at 150 items unless expanded via referral bonus (+10 slots per invite) or Pro subscription.
- Free tier account space is capped at 50 items unless expanded via referral bonus (+10 slots per invite up to 200 items max) or upgrading to the Manager or Professional tier.
- Custom API key mode requires valid keys with remaining quota from the respective provider.
