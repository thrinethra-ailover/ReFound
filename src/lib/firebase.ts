// Client-side Firebase Cloud Messaging integration. Every piece of this
// degrades gracefully: missing env vars, unsupported browsers, and denied
// permission are all handled explicitly rather than throwing.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      vapidKey
  );
}

let appInstance: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!appInstance) {
    appInstance = initializeApp(firebaseConfig);
  }
  return appInstance;
}

export type PushSupportStatus =
  | 'unsupported' // browser lacks Notification API, Service Worker, or push messaging
  | 'not_configured' // Firebase env vars missing
  | 'supported';

export async function checkPushSupport(): Promise<PushSupportStatus> {
  if (!isFirebaseConfigured()) return 'not_configured';
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  const supported = await isSupported().catch(() => false);
  return supported ? 'supported' : 'unsupported';
}

export interface RequestPushResult {
  token: string | null;
  error: string | null;
}

/**
 * Explicitly requests notification permission and registers for a push
 * token. Only ever called in response to a direct user action (a button
 * click) — never automatically on page load.
 */
export async function requestPushToken(): Promise<RequestPushResult> {
  const support = await checkPushSupport();
  if (support === 'not_configured') {
    return { token: null, error: 'Push notifications are not configured for this deployment.' };
  }
  if (support === 'unsupported') {
    return { token: null, error: 'This browser does not support push notifications.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { token: null, error: 'Notification permission was not granted.' };
  }

  const app = getFirebaseApp();
  if (!app) return { token: null, error: 'Push notifications are not configured for this deployment.' };

  try {
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(firebaseConfig.apiKey!)}` +
        `&authDomain=${encodeURIComponent(firebaseConfig.authDomain ?? '')}` +
        `&projectId=${encodeURIComponent(firebaseConfig.projectId!)}` +
        `&messagingSenderId=${encodeURIComponent(firebaseConfig.messagingSenderId!)}` +
        `&appId=${encodeURIComponent(firebaseConfig.appId!)}`
    );

    if (!messagingInstance) messagingInstance = getMessaging(app);
    const token = await getToken(messagingInstance, { vapidKey, serviceWorkerRegistration: registration });
    return { token, error: null };
  } catch (err) {
    return { token: null, error: err instanceof Error ? err.message : 'Could not register for push notifications.' };
  }
}

/** Listens for messages that arrive while the app is in the foreground. */
export function onForegroundPushMessage(callback: (title: string, body: string) => void): () => void {
  const app = getFirebaseApp();
  if (!app) return () => {};
  if (!messagingInstance) messagingInstance = getMessaging(app);

  const unsubscribe = onMessage(messagingInstance, (payload) => {
    callback(payload.notification?.title ?? 'New notification', payload.notification?.body ?? '');
  });
  return unsubscribe;
}
