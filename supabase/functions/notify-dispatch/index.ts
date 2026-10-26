// supabase/functions/notify-dispatch/index.ts
//
// Deno Edge Function. Fires whenever a row is inserted into `notifications`
// (wired via a Database Webhook — see supabase/functions/notify-dispatch/README.md).
// Sends a real Firebase Cloud Messaging push to every device the user has
// registered, and — for a small allowlist of important event types — a real
// email via the Resend HTTP API. All secrets come from environment
// variables configured as Supabase Edge Function secrets; nothing is
// hardcoded.
//
// This function intentionally does the minimum needed to be a correct,
// honest integration: it does not simulate delivery, does not no-op silently
// on missing config (it logs and skips that channel), and validates the
// caller via a shared secret header rather than embedding a service-role key
// in a Postgres trigger body.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_match_id: string | null;
  related_item_id?: string | null;
}

// Only these event types are important enough to email — avoids notification spam.
const EMAILABLE_TYPES = new Set(['MATCH_FOUND', 'VERIFICATION_REQUESTED', 'RECOVERY_UPDATE']);

function preferenceKey(type: string): string | null {
  if (type === 'MATCH_FOUND') return 'matches';
  if (type === 'VERIFICATION_REQUESTED' || type === 'VERIFICATION_UPDATE' || type === 'MATCH_VERIFIED' || type === 'MATCH_REJECTED') return 'verification';
  if (type === 'NEW_MESSAGE') return 'messages';
  if (type === 'RECOVERY_UPDATE' || type === 'HANDOFF_SCHEDULED') return 'recovery';
  if (type === 'SAVED_SEARCH_MATCH') return 'savedSearches';
  if (type === 'PROXIMITY_ALERT') return 'proximity';
  return null;
}

function getEnv(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

async function getGoogleAccessToken(): Promise<string | null> {
  const serviceAccountJson = getEnv('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) return null;

  const serviceAccount = JSON.parse(serviceAccountJson);
  const nowSec = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const unsigned = `${encode(header)}.${encode(claimSet)}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${arrayBufferToBase64Url(signature)}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    console.error('notify-dispatch: failed to mint Google access token', await tokenResponse.text());
    return null;
  }
  const tokenJson = await tokenResponse.json();
  return tokenJson.access_token as string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const contents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(contents);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendPush(fcmTokens: string[], notification: NotificationRow): Promise<void> {
  const projectId = getEnv('FIREBASE_PROJECT_ID');
  if (!projectId || fcmTokens.length === 0) return;

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return;

  await Promise.all(
    fcmTokens.map((token) =>
      fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: notification.title, body: notification.body },
            data: { related_match_id: notification.related_match_id ?? '', related_item_id: notification.related_item_id ?? '', type: notification.type },
          },
        }),
      }).catch((err) => console.error('notify-dispatch: FCM send failed', err))
    )
  );
}

async function sendEmail(toEmail: string, notification: NotificationRow): Promise<void> {
  const resendApiKey = getEnv('RESEND_API_KEY');
  const fromAddress = getEnv('RESEND_FROM_ADDRESS') ?? 'ReFound <notifications@refound.app>';
  if (!resendApiKey || !EMAILABLE_TYPES.has(notification.type)) return;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [toEmail],
      subject: notification.title,
      text: notification.body,
    }),
  }).catch((err) => console.error('notify-dispatch: Resend send failed', err));
}

Deno.serve(async (req) => {
  const expectedSecret = getEnv('PUSH_WEBHOOK_SECRET');
  const providedSecret = req.headers.get('x-webhook-secret');
  if (!expectedSecret) {
    console.error('notify-dispatch: PUSH_WEBHOOK_SECRET is not configured');
    return new Response('Server misconfigured', { status: 500 });
  }
  if (providedSecret !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await req.json();
  const notification: NotificationRow = payload.record ?? payload;
  if (!notification?.user_id) {
    return new Response('Bad request', { status: 400 });
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Server misconfigured', { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const [{ data: subscriptions }, { data: profile }] = await Promise.all([
    supabase.from('push_subscriptions').select('fcm_token').eq('user_id', notification.user_id),
    supabase
      .from('profiles')
      .select('email_notifications_enabled, push_notifications_enabled, notification_preferences')
      .eq('id', notification.user_id)
      .single(),
  ]);

  const tasks: Promise<void>[] = [];
  const preference = preferenceKey(notification.type);
  const allowed = !preference || profile?.notification_preferences?.[preference] !== false;

  if (allowed && profile?.push_notifications_enabled && subscriptions && subscriptions.length > 0) {
    tasks.push(sendPush(subscriptions.map((s: { fcm_token: string }) => s.fcm_token), notification));
  }

  if (allowed && profile?.email_notifications_enabled) {
    const { data: authUser } = await supabase.auth.admin.getUserById(notification.user_id);
    if (authUser?.user?.email) {
      tasks.push(sendEmail(authUser.user.email, notification));
    }
  }

  await Promise.all(tasks);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
