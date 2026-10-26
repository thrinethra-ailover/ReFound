// public/firebase-messaging-sw.js
//
// Handles push messages that arrive while the app is not in the foreground.
// Config is passed via the registration URL's query string (see
// src/lib/firebase.ts) rather than hardcoded here, since this static file
// isn't processed by Vite's env substitution. Firebase Web config values are
// not secret — Firebase's security model relies on Firebase Security Rules
// and App Check, not on hiding these identifiers — so passing them this way
// is safe and standard practice for a build-step-free service worker.

importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

const params = new URL(location.href).searchParams;

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'ReFound';
  const options = {
    body: payload.notification?.body ?? '',
    icon: '/favicon.svg',
    data: payload.data ?? {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const relatedMatchId = event.notification.data?.related_match_id;
  const relatedItemId = event.notification.data?.related_item_id;
  const targetUrl = relatedMatchId ? '/matches' : relatedItemId ? `/map?focus=${encodeURIComponent(relatedItemId)}` : '/';
  event.waitUntil(self.clients.openWindow(targetUrl));
});
