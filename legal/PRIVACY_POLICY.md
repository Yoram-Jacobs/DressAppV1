# DressApp Privacy Policy

**Effective Date:** July 27, 2026
**Last Updated:** July 27, 2026

This Privacy Policy describes how DressApp ("we," "our," or "us") collects, uses, stores, shares, and protects your personal data when you use our digital wardrobe and outfit-styling application.

Please read this policy carefully. By using DressApp, you consent to the data practices described herein. If you do not agree, you may not use the application.

---

## 1. Information We Collect

### 1.1 Account & Profile Information
When you create an account or connect via social login, we collect:

- **Email address** — used for account identification, authentication, and transactional communications.
- **Password** — stored as a cryptographic hash; we never store plaintext passwords.
- **Display name** — your chosen public name within the app.
- **First name and last name** — populated from Google OAuth profile or entered manually; editable at any time.
- **Phone number** — optional; used for account recovery and notifications.
- **Date of birth** — optional; used for age-appropriate content filtering.
- **Sex** — optional; used for body measurement and avatar recommendations.
- **Personal status** — optional (single, married, divorced, widowed).
- **Address** — optional; structured as {line1, line2, city, region, country, postal_code}.
- **Locale and preferred language** — used to localize the app experience.
- **Preferred voice** — used for AI stylist voice output.
- **Avatar and profile photos** — face photo and body photo, stored as base64 data URLs in MongoDB (capped at ~500 KB each client-side).
- **Body measurements** — height, weight, bust, waist, hips, and other measurements used for avatar generation and garment fit recommendations.
- **Hair profile** — length, type, color, and style (optional).
- **Home location** — city, country, and coordinates (lat/lng), used for weather-based outfit suggestions and campaign targeting.
- **Style profile and cultural context** — your style preferences and cultural background used for personalized recommendations.

### 1.2 Wardrobe & Media Data
DressApp is a digital closet application. The following data is core to the app's functionality:

- **Wardrobe photos** — images you upload of your clothing items. These are processed in-browser for background removal (matting) and then stored as data URLs in MongoDB.
- **Garment metadata** — category (Top, Bottom, Footwear, Outerwear, Dress, Accessory), brand, color, size, season, tradition, dress code, gender, and sub-category tags.
- **Outfit data** — saved outfit combinations linking multiple wardrobe items together.
- **Marketplace listings** — if you sell or swap items, listing details including photos, price, and shipping information.
- **Suitcase/packing data** — trip packing lists with items, quantities, and purpose tags (e.g., "Tracking / Outdoors").

### 1.3 Device Permissions
DressApp requests the following device permissions:

- **Camera** — to capture photos of clothing items directly within the app.
- **Photo library / file system access** — to select existing photos for upload.
- **Geolocation** — coarse location access to fetch weather data for outfit recommendations. You can deny or revoke this permission at any time.
- **Notifications** — optional push notifications for campaign updates and stylist suggestions.

### 1.4 AI & Machine Learning Processing
DressApp uses on-device and server-side AI for the following purposes:

- **Background removal (matting)** — your uploaded garment photos are processed through the `rembg` / u2netp pipeline to extract clean cutouts. This processing occurs server-side.
- **Body prediction** — the SegFormer model estimates body measurements from full-body outfit photos.
- **Garment classification** — CLIP-based classification tags items with categories, colors, and brands.
- **Stylist recommendations** — Google Gemini API processes your wardrobe data to generate outfit suggestions and styling advice.
- **Avatar generation** — 3D avatar shape parameters are calculated from body measurements for virtual try-on.

**Important:** User-uploaded photos are **not** used to train any machine learning models. They are processed solely to provide the app's core features and are not shared with model training pipelines.

### 1.5 Usage Data & Analytics
We collect aggregate, anonymized usage data to improve the app:

- App activity and feature usage patterns.
- Item interaction data (views, edits, deletions).
- Device identifiers (IP address, OS version, browser type).
- Campaign analytics (ad impressions, clicks, views) — these are tied to campaign IDs, not to individual user identities.

We do **not** use third-party analytics SDKs (no Mixpanel, Firebase Analytics, Amplitude, Sentry, LogRocket, or similar). All analytics are handled internally.

### 1.6 Payment Data
If you use DressApp's marketplace or subscription features, we collect:

- **Stripe** — Stripe account ID, subscription ID, and payment intent IDs. Actual payment card numbers are never stored on our servers; they are handled directly by Stripe.
- **PayPal** — PayPal receiver email and order/capture IDs.
- **Apple Pay / Google Play** — payment tokens handled by the respective platform SDKs; we do not store card details.

### 1.7 Third-Party Authentication Data
- **Google OAuth** — when you sign in with Google, we receive and store an encrypted OAuth token (`google_oauth` field) used to access your Google profile (name, email, avatar) and, optionally, Google Calendar and People API for scheduling and contact features.

---

## 2. How We Use Your Data

We use your data for the following purposes:

| Purpose | Legal Basis (GDPR) | Data Types |
|---|---|---|
| Provide core app features (wardrobe organization, outfit creation, avatar generation) | Contractual necessity | Wardrobe photos, metadata, body measurements |
| Process background removal and garment matting | Contractual necessity | Uploaded garment photos |
| Generate AI stylist recommendations | Legitimate interest | Wardrobe metadata, style profile |
| Fetch weather data for outfit suggestions | Consent (location permission) | Home location (coarse) |
| Authenticate and manage user accounts | Contractual necessity | Email, password hash, OAuth tokens |
| Send transactional emails (account confirmations, password resets, deletion confirmations) | Contractual necessity | Email address |
| Process marketplace payments | Contractual necessity | Stripe/PayPal tokens, billing info |
| Detect and prevent fraud / abuse | Legitimate interest | IP address, device identifiers |
| Improve app functionality (aggregate analytics) | Legitimate interest | Anonymized usage data |
| Comply with legal obligations | Legal obligation | All data as required by law |

---

## 3. Data Storage & Security

### 3.1 Storage
- **Database:** MongoDB Atlas (cloud-hosted, M0 free tier or paid tier depending on deployment).
- **Images:** Wardrobe photos are stored as base64-encoded data URLs within MongoDB documents. Each image is capped at ~500 KB client-side before upload.
- **Model cache:** AI model weights (SegFormer, u2netp) are cached on persistent Docker volumes on the production server to avoid re-downloading on every request.
- **No external blob store** is used for images at this time; all image data resides in MongoDB.

### 3.2 Security
- All data in transit is encrypted via **HTTPS/TLS 1.3**.
- Passwords are stored as **bcrypt hashes** — never in plaintext.
- Google OAuth tokens are stored encrypted at rest.
- Payment data (Stripe/PayPal tokens) is never stored in plaintext on our servers; we store only reference IDs.
- MongoDB Atlas provides **encryption at rest** and **encryption in transit** by default.
- Access to the database is restricted to the backend application via connection string credentials.

### 3.3 Data Retention
- Your data is retained for as long as your account is active.
- Upon account deletion (see Section 5), all personal data is permanently removed from MongoDB within 30 days.
- Aggregated, anonymized analytics data may be retained indefinitely and cannot be linked back to individual users.

---

## 4. Data Sharing & Third Parties

We share your data with the following third parties only as described below:

| Third Party | Data Shared | Purpose |
|---|---|---|
| **MongoDB Atlas** | All user data and wardrobe images | Cloud database hosting |
| **Google (OAuth)** | Email, name, profile photo | Authentication and profile creation |
| **Google Calendar API** | Calendar event data (if connected) | Stylist scheduling features |
| **Google People API** | Contact data (if connected) | Social features |
| **Google Gemini API** | Wardrobe metadata and item descriptions | AI stylist recommendations |
| **Stripe** | Payment tokens, billing info | Payment processing |
| **PayPal** | Payment tokens, billing info | Payment processing |
| **Resend / SendGrid** | Email address and name | Transactional email delivery |

**We do NOT sell your personal data or wardrobe photos to third-party brokers, advertisers, or data aggregators.**

---

## 5. Your Rights & Account Deletion

Under GDPR (EU/EEA), CCPA (California), and other applicable privacy laws, you have the following rights:

### 5.1 Access & Export
You can request a copy of all personal data we hold about you by contacting us (see Section 6). We will provide a JSON export of your account data, including wardrobe items, outfits, and profile information.

### 5.2 Correction
You can update or correct your profile information at any time through the app's Settings page. Fields you can edit include: display name, first/last name, phone, date of birth, address, body measurements, home location, and style preferences.

### 5.3 Erasure (Right to Be Forgotten)
You can delete your account and all associated data at any time:

- **In-app:** Navigate to Settings → Account → Delete Account.
- **API:** Send a `POST` request to `/api/v1/users/me/delete` (authenticated).

Account deletion triggers a **cascade delete** across all collections:
- User document
- All closet items (wardrobe photos and metadata)
- All outfits
- All marketplace listings
- All suitcases and packing lists
- All stylist sessions and messages
- All credit topups and transaction records
- All embeddings (AI-generated data)
- All web push subscriptions

A deletion confirmation email is sent to your registered email address.

### 5.4 Data Portability
You can request your data in a structured, machine-readable format (JSON) at any time. Contact us using the details in Section 6.

### 5.5 Withdraw Consent
You can withdraw consent for location access, camera access, and marketing communications at any time through your device settings or the app's Settings page. Withdrawing consent may limit certain app features (e.g., weather-based outfit suggestions).

### 5.6 Right to Object (LGPD Art. 18, GDPR Art. 21)
Under LGPD (Brazil) and GDPR (EU/EEA), you have the right to object to the processing of your personal data for specific purposes, including:
- Processing based on legitimate interest
- Direct marketing
- Profiling and automated decision-making (including AI-based stylist recommendations)

To object, contact us using the details in Section 6.

### 5.7 Cross-Border Data Transfers
DressApp is an international application. Your data may be transferred to and processed in countries other than your country of residence, including Israel and the United States. We ensure that all transfers are governed by appropriate safeguards, including Standard Contractual Clauses (SCCs) where required by applicable law.

---

## 6. Contact Information

For privacy-related inquiries, data access requests, deletion requests, or to report a privacy concern, contact us at:

**Email:** dev@dressapp.co
**Address:** DressApp, 11 Hanoter St, 8442711 Be'er-Sheva, Israel

We will respond to all valid requests within 30 days, as required by applicable privacy laws including GDPR, CCPA, LGPD, PIPEDA, and other international data protection regulations.

For Data Subject Access Requests (DSARs), please include your account email address and a description of the data you wish to access or modify.

---

## 7. Children's Privacy

DressApp is not intended for children under the age of 16 (or the applicable age of digital consent in your jurisdiction, whichever is higher). We do not knowingly collect personal data from anyone under this age. If we become aware that a minor has provided us with personal data, we will take steps to delete it promptly.

If you are a parent or legal guardian and believe your child has provided us with personal data, please contact us at dev@dressapp.co and we will take immediate action.

---

## 8. International Compliance

DressApp is designed to operate in all countries. This Privacy Policy is drafted to comply with the following international data protection frameworks:

| Framework | Jurisdiction | Key Provisions Covered |
|---|---|---|
| **GDPR** | EU/EEA | Lawful basis, data subject rights, DPO contact, international transfers, breach notification |
| **CCPA/CPRA** | California, USA | Right to know, delete, opt-out of sale, non-discrimination |
| **LGPD** | Brazil | Lawful basis, data subject rights, DPO, international transfers, consent |
| **PIPEDA** | Canada | Consent, access, correction, accountability, breach notification |
| **POPIA** | South Africa | Lawful processing, data subject rights, cross-border transfer |
| **PDPA** | Thailand | Consent, data subject rights, international transfer |
| **PDPL** | Saudi Arabia | Lawful basis, data subject rights, international transfer |

Where a specific jurisdiction's law requires additional rights or protections beyond what is described in this policy, those additional rights apply.

---

## 9. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of material changes by:

- Posting the updated policy on this page with a revised "Effective Date."
- Sending an email notification to your registered email address for significant changes.
- Displaying an in-app notice the next time you open the app.

We encourage you to review this policy periodically.

---

## 10. Effective Date & Governing Law

This Privacy Policy is effective as of **July 27, 2026**.

DressApp is an international application operating across all countries. This policy is governed by the principles of the **General Data Protection Regulation (GDPR)** — EU/EEA, the **California Consumer Privacy Act (CCPA)** — United States, the **Lei Geral de Proteção de Dados (LGPD)** — Brazil, the **Personal Information Protection and Electronic Documents Act (PIPEDA)** — Canada, and other applicable international data protection laws. In the event of any conflict between these frameworks, the most protective standard for the user shall apply.

---

## 10. App Store Compliance

This Privacy Policy is publicly hosted at:

**https://dressapp.co/privacy**

It is referenced in:
- **Apple App Store Connect** — App Privacy section
- **Google Play Console** — Data Safety section
- **In-app Settings** — a direct link is available in the Settings menu
- **Onboarding flow** — a privacy notice is shown during first-time account setup

---

*DressApp respects your privacy and is committed to transparent data practices. If you have any questions about this policy or how we handle your data, please contact us at dev@dressapp.co.*
