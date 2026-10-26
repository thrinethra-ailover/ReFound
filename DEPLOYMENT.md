# ReFound — Deployment Guide

## Architecture
- **Frontend**: React + TypeScript + Vite, deployed to **Vercel** (static build, no server runtime needed)
- **Backend**: **Supabase** (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **Optional**: Firebase Cloud Messaging (push), Resend (email) — both wired through a Supabase Edge Function, never called directly from the client

## 1. Supabase setup
1. Use the Supabase project you intend to keep for production. Its Project URL and publishable (or legacy anon) key are frontend configuration; never put a `service_role` or secret API key in the browser app.
2. Apply every migration in `supabase/migrations/` **in numeric order**, once. For a new project, run `0001_init.sql` through `0031_stale_reports_and_notification_preferences.sql`. For an existing project, run only migrations it has not yet received, in order. Migration `0028` separates the permanent Creator role from delegated Admins, adds Creator-only access management, restricts private report details and ReFound+ configuration, and excludes Creator activity from the Admin audit log. Migration `0029` lets paid Admins opt into the thank-you wall under their Admin identity. Migration `0030` lets paid Admins customize the color treatment of their role-based profile banner and badge. Migration `0031` enables 30-day report reminders with a 7-day renewal window and stores per-category email/push preferences.
3. Bootstrap the Creator role using the account UUIDs shown in Authentication → Users. Do not put Creator email addresses in `.env.local` or Vercel variables: this static Vite app has no private frontend environment, and `VITE_` values are public. `CREATOR_MAIL1/2` would not be a secure or usable role check; Supabase stores Creator user IDs and enforces the role server-side. If the project already has the Creator's account(s) in `admin_users`, migration `0028` promotes those IDs automatically. On a fresh project, run this SQL with the Creator account UUID(s):
   ```sql
   insert into public.creator_users (user_id) values ('<creator auth.users id>');
   ```
   Then sign in and use Zephyrath’s Playground → Admin access to add or remove delegated Admins. Never add Creator account IDs to `admin_users` manually.
4. (Optional) Deploy `supabase/functions/notify-dispatch` for real push/email delivery — see `supabase/functions/notify-dispatch/README.md`. Redeploy it after updating ReFound so the per-category notification preferences are honored by email and push delivery.
5. Under Auth → Settings, decide whether to require email confirmation (recommended for production; can be disabled for local testing).

## 2. Environment variables

### Frontend (Vercel)
| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key — safe to expose client-side |
| `VITE_FIREBASE_API_KEY` | No | Firebase web app config; required for browser push |
| `VITE_FIREBASE_AUTH_DOMAIN` | No | Firebase web app config |
| `VITE_FIREBASE_PROJECT_ID` | No | Firebase project ID |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase web app config |
| `VITE_FIREBASE_APP_ID` | No | Firebase web app config |
| `VITE_FIREBASE_VAPID_KEY` | No | Firebase Cloud Messaging → Web Push certificates |

Set these in the Vercel project's **Settings → Environment Variables** before deploying, for the environments you plan to use (Preview and Production). `.env.local` is for local development and is not a substitute for Vercel's build environment settings. All `VITE_`-prefixed values are bundled into the client and are not secrets — Supabase's publishable/anon key and Firebase web config are designed to be public; access control is enforced by RLS and Firebase Security Rules, not by hiding these values.

### Backend (Supabase Edge Function secrets) — set with `supabase secrets set`, never in frontend env
| Variable | Required | Notes |
|---|---|---|
| `PUSH_WEBHOOK_SECRET` | Only for push/email | Random shared secret validating the Database Webhook call |
| `FIREBASE_PROJECT_ID` | Only for push | Same Firebase project as the browser config |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Only for push | Service account JSON; never commit or put in frontend env |
| `RESEND_API_KEY` | Only for email | Never commit this |
| `RESEND_FROM_ADDRESS` | Only for email | |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every Edge Function — you never set these yourself.

## 3. Frontend deployment (Vercel)
The project is a Vite single-page app and already has a `vercel.json` rewrite so direct visits and refreshes on routes such as `/notifications` load the app correctly. You can deploy this local folder without connecting GitHub.

1. Open PowerShell in the project folder and run `npx vercel link`. Sign in when prompted and create or select the Vercel project for ReFound. This links the local folder; a GitHub repository is not required.
2. In the Vercel dashboard, open that project's **Settings → Environment Variables** and add the frontend variables from section 2 for Preview and Production. Never add Supabase service-role keys, Firebase service-account JSON, or webhook secrets here.
3. Back in PowerShell, run `npx vercel deploy` to create a Preview deployment. If asked to enter build settings, use build command `npm run build` and output directory `dist`.
4. Open the Preview URL and check sign-in, reports, matching, verification, notifications, and admin access. Fix any issues before production.
5. When the preview is ready, run `npx vercel deploy --prod` from the same project folder to deploy production.
6. In Supabase Auth → URL Configuration, set the production domain as the Site URL and add it as an allowed Redirect URL. Keep localhost allowed for development. Campus verification redirects to `/verify-campus`, so make sure that route also works on the deployed domain.

Vercel Hobby is free for personal, non-commercial use and has plan limits. Check its current terms and usage limits against the way your campus will operate ReFound before relying on it for a campus-wide service.

## 4. Production checklist
- [ ] All migrations through `0031_stale_reports_and_notification_preferences.sql` applied, in order, with no errors
- [ ] Creator account UUID(s) exist in `creator_users`; delegated Admins are managed from Zephyrath’s Playground
- [ ] If user support chat is wanted, enable it from the Support chat tab after applying migration `0021`
- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set in the production build environment
- [ ] If push is enabled: all six `VITE_FIREBASE_*` variables set in the production build environment and redeployed
- [ ] Auth → email confirmation decision made deliberately (not left on the local-dev default)
- [ ] Storage bucket `item-images` exists and is public-read (created by `0001_init.sql`)
- [ ] `npm run build` succeeds with no errors
- [ ] `npm run test` passes
- [ ] `npm run lint` run and warnings triaged
- [ ] Manually verified: register → report → match → verify → recover, on both desktop and mobile widths
- [ ] Manually verified: a non-admin user is redirected away from `/admin`, and cannot call any `admin_*` RPC (test via browser console)
- [ ] ReFound+ public checkout remains disabled until UPI payee, price, and QR or VPA are configured in Zephyrath’s Playground → ReFound+
- [ ] UPI references are manually checked in bank/UPI records before Creator approval; entering a reference never activates membership by itself
- [ ] If no QR is uploaded in Zephyrath’s Playground → ReFound+, an optional static QR image can be placed at `public/refound-plus-upi-qr.png` and committed with the frontend
- [ ] `.env.local` is not committed (already covered by `.gitignore`'s `*.local` rule)
- [ ] `notify-dispatch` deployed and its Database Webhook wired if push/email delivery is enabled

### Enable browser push notifications
1. In Firebase Console, create a project and register a **Web app**. Copy its web config values into the six `VITE_FIREBASE_*` variables above (the VAPID key comes from Project settings → Cloud Messaging → Web Push certificates). Enable the Firebase Cloud Messaging Registration API if Firebase indicates it is disabled.
2. Enable Firebase Cloud Messaging for the project. Create a service account with permission to send FCM messages, download its JSON key, and keep it private.
3. Add `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_JSON` as Supabase Edge Function secrets. Also set a long random `PUSH_WEBHOOK_SECRET`.
4. Deploy `supabase/functions/notify-dispatch` and create a Supabase Database Webhook for `public.notifications` on **INSERT**, calling `notify-dispatch` with the `x-webhook-secret` header. Detailed CLI and SQL alternatives are in `supabase/functions/notify-dispatch/README.md`.
5. For local browser testing, put the six `VITE_FIREBASE_*` values in `.env.local` and restart Vite. The local URL must be `localhost` (or HTTPS); browsers require a secure context for push.
6. Sign in, open Profile → Push notifications, choose **Enable push notifications**, and allow the browser prompt. Then create a real notification event (for example, create a match with the second test user) and verify delivery with the app closed. Check Supabase Edge Function logs if the device token registers but delivery fails.

The browser Firebase config is public by design. The service account JSON and webhook secret are private server-side secrets and must never use a `VITE_` prefix or be committed.

## 5. Verifying the deployment
- Visit the deployed URL, register a test account, report a LOST and a FOUND item that should match, and confirm they appear on `/matches`.
- Log in as the Creator and confirm `/creator` loads; add a test Admin from its Admin access tab.
- Log in as that Admin and confirm `/admin` loads with real stats, no ReFound+ settings, and no hidden ownership details.
- Confirm the Admin cannot open `/creator` or call the private report-details / ReFound+ configuration RPCs.
- Confirm a non-staff user is redirected away from both `/admin` and `/creator`.
