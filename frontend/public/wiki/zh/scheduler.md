# Scheduler & Push Reminder Service

This document provides an overview of the Scheduler & Push Reminder system implemented in DressApp, describing its purpose, key features, technology stack, and bug fixes.

---

## 1. Purpose and Goals
The **Scheduler & Push Reminder** system acts as an automated daily personal stylist. 
* **Wardrobe Diary Engagement**: Sends daily push notifications reminding users of scheduled outfits or upcoming events.
* **Smart Rotation**: Generates 3 styled outfit recommendations daily based on the user's styling preferences (e.g., Casual, Evening, Sport) and closet history.
* **Reduce Wear Repetition**: The stylist automatically prioritizes least-worn closet items and avoids repeating recently worn combinations.

---

## 2. Technology Stack
* **Job Scheduling (Backend)**: Powered by `APScheduler` (AsyncIOScheduler) running a recurring cron task inside the FastAPI server.
* **Native Web Push Protocol**: Uses `pywebpush` to sign and transmit native browser notifications to the user's registered browser endpoints using **VAPID** keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_CLAIM_EMAIL`).
* **Database**: MongoDB (via `Motor` driver) stores user settings, push subscriptions, and simulated notification logs.
* **AI Recommendation Engine**: Integrates with the Google Gemini API (via `gemini-2.5-pro`) to dynamically generate contextually aware outfit selections based on closet assets.
* **Frontend**: React components using `Dialog` (Radix UI) and custom canvas rendering to display recommendations and allow users to save them to their diary.

---

## 3. Key Points & Features
* **Simulated & Native Web Push**: If the user has allowed native browser notifications, they receive a real device notification. Simultaneously, all notifications are logged in the simulated **Notification Center** on the web app for easy testing and debugging.
* **On-Demand Dynamic Generation**: If an older notification log is clicked, the app dynamically triggers recommendations on the fly using the backend API.
* **Robust Fail-Safe Fallback**: If the Gemini API hits rate limits or is offline, the backend falls back to a rule-based closet selection algorithm (`_generate_fallback_advice`). This compiles 3 outfits directly from the user's actual database closet rotation, guaranteeing notifications are never blank.
* **Premium Loading States**: Clicking a notification opens a Dialog with a smooth spinner and helper messaging while proposals are generated.

---

## 4. Key Bug Fixes & Refactorings
Throughout the development cycle, we resolved several critical issues:
1. **Cryptography Compatibility**: Patched `pywebpush`'s cryptography dependency by monkeypatching `ec.generate_private_key` to resolve elliptic curve parameter mismatches.
2. **MongoDB Serialisation Error**: Excluded MongoDB `_id` fields from user preference queries to prevent JSON serialization errors during scheduler scans.
3. **i18next/Localization Violations**: 
   - Replaced all hardcoded Hebrew and English user-facing texts with `t('key', { defaultValue: '...' })` translation wrappers.
   - Refactored the notification engine to parse and localize titles and bodies (e.g., converting styles like "casual" to translated labels like "יומיומי" dynamically in Hebrew mode).
4. **Interactive Clickable Notifications**: Replaced a static logs display with clickable entries. Handled conditional payload parsing (supporting both pre-structured payload documents and text-based parsing of body lists).
5. **API Robustness & Rate-Limit Shielding**: Caught Gemini API `429 RESOURCE_EXHAUSTED` exceptions in both the cron job and the `/proposal/scheduled` API endpoint, redirecting execution to our closet-based fallback generator.
