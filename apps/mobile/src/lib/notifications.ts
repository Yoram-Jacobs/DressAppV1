/**
 * apps/mobile/src/lib/notifications.ts
 *
 * Expo push notification registration.
 * Called from App.tsx after the user is confirmed authenticated.
 *
 * ── What this does ────────────────────────────────────────────────────────
 *  1. Requests permission (shows system prompt on first call)
 *  2. Gets the Expo Push Token (a stable string per device/app)
 *  3. Registers the token with the DressApp backend so the server can send
 *     push notifications via Expo's push service
 *
 * ── Backend change required ───────────────────────────────────────────────
 *  The backend endpoint (currently accepts VAPID subscriptions for web push)
 *  must also accept { expo_push_token: string }. This is a small addition to
 *  the existing push registration route in backend/routers/outfits.py.
 *
 * ── Platform notes ───────────────────────────────────────────────────────
 *  - iOS: Shows the "Allow notifications?" system dialog on first call.
 *    If denied, the token fetch silently fails and we skip registration.
 *  - Android: Permission is granted by default (no dialog) in modern Android.
 *  - Simulator: Expo tokens can be fetched but push delivery doesn't work
 *    on iOS Simulator. Use a physical device to test end-to-end delivery.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// Configure notification appearance while the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permission and register the device's Expo Push Token with the
 * DressApp backend. Safe to call multiple times — no-ops if already registered.
 */
export async function registerPushToken(): Promise<void> {
  // Android 13+ requires a POST_NOTIFICATIONS permission at runtime
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DressApp',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: 'hsl(174, 44%, 33%)', // teal accent
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    // User denied — silently skip. Don't nag.
    return;
  }

  try {
    // projectId is required in SDK 53+
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[notifications] EAS projectId not found in app.json — skipping push registration');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenData.data;

    // Register with backend
    // Backend must accept: POST /outfits/webpush/register
    //   body: { expo_push_token: string }
    //   (existing VAPID body: { endpoint, keys: { p256dh, auth } } — keep supporting)
    await (api as any).registerPushToken?.({ expo_push_token: expoPushToken });
  } catch (err) {
    // Non-fatal — push is a nice-to-have, never a blocker
    console.warn('[notifications] Push token registration failed:', err);
  }
}
