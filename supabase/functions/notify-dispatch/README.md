# notify-dispatch Edge Function

Sends a real Firebase Cloud Messaging push and, for a few important event
types, a real email via Resend — triggered whenever a row is inserted into
`public.notifications`.

This function is **optional**. Everything else in Sprint 4 (in-app
notifications, the notification center, messaging, the recovery
timeline) works fully without it. Deploy this only if you want actual push/
email delivery, not just in-app notifications.

## 1. Deploy the function
```bash
supabase functions deploy notify-dispatch --no-verify-jwt
```
`--no-verify-jwt` is required because this function is called by a Postgres
Database Webhook, not by a logged-in user — it authenticates the caller
itself via the `x-webhook-secret` header instead (see below).

## 2. Set secrets
```bash
supabase secrets set PUSH_WEBHOOK_SECRET=<a-long-random-string-you-generate>
supabase secrets set FIREBASE_PROJECT_ID=<your-firebase-project-id>
supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON='<contents of your Firebase service account JSON key, as one line>'
supabase secrets set RESEND_API_KEY=<your-resend-api-key>
supabase secrets set RESEND_FROM_ADDRESS="ReFound <notifications@yourdomain.com>"
```
The Firebase service account JSON comes from Firebase Console → Project
Settings → Service Accounts → "Generate new private key". Never commit it —
it only ever lives in Supabase's secret store.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to every
Edge Function automatically; you don't need to set them yourself.

`PUSH_WEBHOOK_SECRET` is required. The function returns a server error when it
is missing and rejects webhook requests whose `x-webhook-secret` does not
match. Configure the same random value in the Edge Function secrets and the
Database Webhook header.

## 3. Wire the Database Webhook
In the Supabase dashboard: Database → Webhooks → Create a new webhook.
- Table: `notifications`
- Events: `Insert`
- Type: `Supabase Edge Function`
- Function: `notify-dispatch`
- HTTP Headers: add `x-webhook-secret: <the same value you set in step 2>`

Alternatively, via SQL (requires the `pg_net` extension, enabled by default
on Supabase projects):

```sql
create extension if not exists pg_net;

create or replace function public.trigger_notify_dispatch()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://<your-project-ref>.functions.supabase.co/notify-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<the same value you set in step 2>'
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$;

create trigger notify_dispatch_trigger
  after insert on public.notifications
  for each row execute function public.trigger_notify_dispatch();
```

## What this does and doesn't do
- Real FCM HTTP v1 API call, authenticated with a real Google OAuth2 token
  minted from your service account — not simulated.
- Real Resend API call for `MATCH_FOUND`, `VERIFICATION_REQUESTED`, and
  `RECOVERY_UPDATE` notifications only (Feature 7: important events only).
- Respects each user's `push_notifications_enabled` / `email_notifications_enabled`
- Also respects the per-category `notification_preferences` toggles from Profile
  preference (Profile page) before sending anything.
- If a secret is missing, that channel is silently skipped (logged
  server-side) rather than the whole function failing — a user who hasn't
  enabled push still gets their email, and vice versa.
