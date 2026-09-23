# DressApp Privacy Policy

**Effective Date:** September 23, 2026  
**Last Updated:** September 23, 2026  
**App Version:** 1.0.5  
**Official Website:** [https://dressapp.co](https://dressapp.co)  
**Dedicated Privacy URL:** [https://dressapp.co/privacy](https://dressapp.co/privacy)  

Welcome to **DressApp** ("we," "our," "us," or "the Application"). DressApp is an intelligent digital wardrobe, style planning, and personal AI stylist platform developed and operated by **DressApp Ltd.**

This Privacy Policy explains in detail how we access, collect, use, process, store, disclose, retain, and safeguard personal information when you use our web platform, mobile applications, and connected services. Please read this document carefully. By creating an account or using DressApp, you acknowledge and agree to the practices outlined in this policy.

---

## 1. Information We Collect and Access

We collect information you directly provide to us, information collected automatically through device interaction, and information obtained through authorized third-party integrations.

### 1.1 Account & Identity Information
- **Authentication Credentials:** Email address and cryptographically hashed passwords (salted with bcrypt). We never store plaintext passwords.
- **Profile Details:** Display name, first name, last name, phone number (optional), date of birth (optional), and gender (optional, used for tailored styling and avatar geometry).
- **Demographic & Sizing Data:** Body measurements (height, weight, chest, waist, hips, inseam, arm length), skin tone preference, and hair profile (optional) to generate virtual fitting avatars and accurate fit advice.
- **Location Information:** City, country, and coarse geographic coordinates (lat/long) provided with your consent to fetch localized weather conditions for weather-appropriate daily outfit recommendations.

### 1.2 Digital Wardrobe, Media, and Outfits
- **Garment Photos:** Images of clothing items you photograph or upload to your digital closet.
- **Garment Metadata:** Item category (Top, Bottom, Footwear, Outerwear, Dress, Accessory), brand, color palette, fabric composition, formality/dress code, season, and condition tags.
- **Outfits & Looks:** User-created outfit pairings, scheduled calendar looks, and suitcase packing lists.
- **Marketplace Content:** Item listings created for sale, swap, or donation, including descriptions, asking prices, and delivery preferences.

### 1.3 Device Permissions
- **Camera:** Used strictly when you capture photos of clothing items directly within the app.
- **Photo Library:** Used strictly when you choose existing photos of garments or profile avatars to upload.
- **Push Notifications:** Used only with your permission to send daily outfit reminders, packing assistant updates, and important security alerts.

---

## 2. Google User Data & Limited Use Disclosure

DressApp provides optional integrations with Google to facilitate user sign-in and personalized scheduling. This section explicitly details what Google user data is accessed, how it is used, how it is stored, and our adherence to Google's strict privacy standards.

> ### Google API Services User Data Policy — Limited Use Statement
> **DressApp's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.**

### 2.1 What Google User Data We Access

| Google API Scope | Data Accessed | Specific Purpose in DressApp |
|---|---|---|
| `openid`<br>`userinfo.email`<br>`userinfo.profile` | Google user ID, primary email address, full name, and profile picture avatar URL. | To authenticate your identity, create and secure your DressApp user account, and display your name and profile avatar in your personal closet dashboard. |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Google Calendar event summaries, event start/end timestamps, locations, and event descriptions. | Read-only access utilized exclusively by the AI Stylist feature to ground outfit suggestions in your real-life schedule (e.g., suggesting professional business attire for scheduled meetings, athletic gear for workouts, or formal wear for evening events). |
| `https://www.googleapis.com/auth/user.birthday.read`<br>`https://www.googleapis.com/auth/user.gender.read` | Date of birth and gender (if populated in your Google profile and explicitly granted). | Used to calibrate body avatar sizing algorithms, age-appropriate style advice, and fit recommendations. |
| `https://www.googleapis.com/auth/user.phonenumbers.read`<br>`https://www.googleapis.com/auth/user.addresses.read` | Phone number and address (if populated in your Google profile and explicitly granted). | Used only to pre-fill shipping addresses for marketplace transactions and account recovery, upon explicit user confirmation. |

### 2.2 How We Use Google User Data
- Google user data is used **strictly to provide and enhance user-facing features** of the DressApp application (authentication, user profile setup, and schedule-grounded outfit recommendations).
- We process Google Calendar event titles and timestamps in transient memory to generate daily wardrobe recommendations and packing lists.

### 2.3 Strict Prohibitions and Protections on Google User Data
- **No Model Training:** Google user data and Google Workspace API data are **NOT** used to develop, improve, or train generalized or non-personalized Artificial Intelligence (AI) or Machine Learning (ML) models.
- **No Advertising:** We do **NOT** use, transfer, or disclose Google user data for serving advertisements, including targeted, personalized, re-targeted, or interest-based advertising.
- **No Data Brokers / Resale:** We do **NOT** sell, rent, license, or trade Google user data to third parties, data brokers, or information resellers under any circumstances.
- **No Credit or Lending Evaluation:** Google user data is never used to determine credit-worthiness or for lending purposes.
- **Human Access Restrictions:** Human employees, contractors, and developers do **NOT** read your Google user data unless:
  1. You have provided explicit affirmative consent for a specific troubleshooting session;
  2. It is strictly necessary for security investigations (such as investigating abuse, fraud, or malware);
  3. It is required to comply with applicable statutory law or valid governmental orders; or
  4. The data is aggregated and anonymized for internal technical operations.

---

## 3. How We Process and Use General Data

We process non-Google personal information on the following legal bases:

| Processing Activity | Legal Basis (GDPR / Global Standards) | Data Categories Utilized |
|---|---|---|
| Digital wardrobe indexing, cataloging, and outfit creation | Contractual necessity | Garment photos, categories, colors, metadata |
| AI background removal and transparent garment cutout extraction | Contractual necessity | Uploaded clothing photographs |
| AI Stylist look recommendations & style advice | Legitimate interest / Consent | Wardrobe metadata, style preferences |
| Weather-adapted outfit planning | Consent (location permission) | Coarse location (city/coordinates) |
| Transactional communications (security alerts, password resets) | Contractual necessity | Account email address |
| Marketplace transactions and payment facilitation | Contractual necessity | Payment provider tokens (Stripe/PayPal), transaction history |

---

## 4. Data Storage, Security, and Protection Mechanisms

We implement robust administrative, technical, and physical security measures designed to protect your sensitive data against unauthorized access, alteration, disclosure, or destruction:

- **Encryption in Transit:** 100% of data transmitted between your browser/app and our servers is encrypted using modern **HTTPS and Transport Layer Security (TLS 1.3 / TLS 1.2)**.
- **Encryption at Rest:** All stored database records, profile entries, and OAuth credentials are encrypted at rest using industry-standard **AES-256 encryption** within enterprise-grade MongoDB Atlas cloud clusters.
- **Cryptographic Password Protection:** User passwords are encrypted with bcrypt hashing incorporating per-user salts.
- **Access Control:** Production infrastructure access is strictly restricted through multi-factor authentication (MFA), least-privilege role-based access controls (RBAC), and continuous audit logging.

---

## 5. Data Retention and Deletion

### 5.1 Retention Duration
- We retain your personal data and wardrobe records for as long as your DressApp user account remains active.
- Google OAuth access tokens and calendar cache are retained only while the Google integration remains active and authorized by you.

### 5.2 Disconnecting Google Integrations
- You can disconnect your Google account or Google Calendar integration at any time directly in the app via **Settings → Integrations → Disconnect Google**.
- You can also revoke DressApp's permissions directly via your [Google Account Security Settings](https://myaccount.google.com/permissions).
- Upon disconnection, stored Google OAuth tokens and cached calendar event records are immediately purged from our active systems.

### 5.3 Account Deletion & Right to Erasure
You have the absolute right to delete your account and all associated data at any time:
- **In-App One-Click Deletion:** Navigate to **Settings → Account → Delete Account**.
- **Via Email Request:** Send an email from your registered email address to [dev@dressapp.co](mailto:dev@dressapp.co) with the subject "Delete My Account".

Account deletion executes an immediate, irreversible cascade deletion across all databases, permanently wiping:
- Your user profile, identity records, and authentication credentials;
- All wardrobe items, uploaded photographs, and background-matted images;
- All saved outfits, lookbook entries, and packing lists;
- All marketplace listings and transaction references;
- All AI stylist conversational histories, vector embeddings, and Google tokens.

All data is completely destroyed within 30 days of the deletion request.

---

## 6. Data Sharing, Disclosures, and Third Parties

We do not sell, rent, or trade your personal data. We disclose information only to vetted service providers who assist us in operating our platform, strictly bound by data processing agreements:

| Service Provider | Data Disclosed | Purpose |
|---|---|---|
| **MongoDB Atlas** | Encrypted account data, wardrobe metadata, images | Cloud database hosting with enterprise encryption at rest |
| **Google Cloud Platform / Google APIs** | OAuth authentication tokens, styling query prompts | User authentication and Gemini AI styling analysis |
| **Stripe / PayPal** | Payment transaction tokens, billing metadata | PCI-compliant payment processing (card numbers never touch our servers) |
| **Resend / Transactional Mailer** | Email address, user display name | Delivery of critical system notices and password resets |

---

## 7. International Privacy Rights (GDPR, CCPA/CPRA, LGPD, PIPEDA)

Depending on your geographic location, you enjoy specific statutory privacy rights:
- **Right to Access / Portability:** You can request a complete, machine-readable JSON copy of all personal data we hold about you.
- **Right to Rectification:** You can update or correct any inaccurate personal information at any time in the app settings.
- **Right to Erasure:** You can request the permanent deletion of your personal data as outlined in Section 5.
- **Right to Restrict or Object:** You can object to automated profiling or withdraw consent for location/camera processing at any time.
- **Non-Discrimination:** We will never discriminate against you, deny services, or alter pricing because you exercised your privacy rights.

---

## 8. Children's Privacy

DressApp is strictly intended for individuals who are at least 16 years of age (or the minimum legal age of digital consent in your jurisdiction). We do not knowingly solicit or collect personal information from children under 16. If we discover that a minor under 16 has provided us with personal information, we will immediately delete such data from our servers.

---

## 9. Changes to This Privacy Policy

We may periodically update this Privacy Policy to reflect changes in our services, technological advancements, or legal requirements. When updates occur, we will revise the "Last Updated" date at the top of this policy and notify users via an in-app announcement or email notification for material changes. We encourage you to review this page regularly.

---

## 10. Contact Information & Data Protection Inquiries

If you have any questions, concerns, feedback, or requests regarding this Privacy Policy or your personal data, please contact our Data Protection team:

- **Organization:** DressApp Ltd.
- **Primary Privacy Contact:** [dev@dressapp.co](mailto:dev@dressapp.co)
- **User Support Contact:** [lokoprod@gmail.com](mailto:lokoprod@gmail.com)
- **Mailing Address:** DressApp Ltd., 11 Hanoter St, 8442711 Be'er-Sheva, Israel
- **Official Website:** [https://dressapp.co](https://dressapp.co)
- **Dedicated Privacy URL:** [https://dressapp.co/privacy](https://dressapp.co/privacy)

We are committed to addressing and resolving all privacy inquiries promptly and within thirty (30) days of receipt.
