# ReFound — Supabase setup

## 1. Create a project
Create a free project at https://supabase.com. Note the **Project URL** and **anon public key**
from Settings → API.

## 2. Run the migrations
Open the SQL editor in your Supabase dashboard and run these in order, once, top to bottom, on
a fresh project:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_matching.sql`
3. `supabase/migrations/0003_proximity.sql`
4. `supabase/migrations/0004_recovery_messaging.sql`
5. `supabase/migrations/0005_admin.sql`
6. `supabase/migrations/0006_verification_normalization.sql`
7. `supabase/migrations/0007_grammar_tolerant_verification.sql`
8. `supabase/migrations/0008_profile_photos.sql`
9. `supabase/migrations/0009_claimant_ownership_verification.sql`
10. `supabase/migrations/0010_flexible_claimant_answers.sql`
11. `supabase/migrations/0011_offline_vocabulary_verification.sql`
12. `supabase/migrations/0012_expanded_offline_vocabulary.sql`
13. `supabase/migrations/0013_owner_confirms_recovery.sql`
14. `supabase/migrations/0014_admin_private_report_details.sql`
15. `supabase/migrations/0015_campus_email_verification.sql`
16. `supabase/migrations/0016_user_facing_improvements.sql`
17. `supabase/migrations/0017_flagged_report_actions.sql`
18. `supabase/migrations/0018_open_english_wordnet.sql`
19. `supabase/migrations/0019_edit_own_verification_attributes.sql`
20. `supabase/migrations/0020_remove_qr_recovery.sql`
21. `supabase/migrations/0021_admin_support_chat.sql`
22. `supabase/migrations/0022_refound_plus_entitlements.sql`
23. `supabase/migrations/0023_refound_plus_launch.sql`
24. `supabase/migrations/0024_fix_refound_plus_admin_request_email_cast.sql`
25. `supabase/migrations/0025_expand_profile_accent_palette.sql`
26. `supabase/migrations/0026_refound_plus_profile_rewards.sql`

`0001_init.sql` creates:
- `profiles`, `items`, `item_images`, `campus_locations`, `item_verification_attributes`
- Indexes on the common lookup/filter columns
- A trigger that creates a `profiles` row automatically on sign-up
- Row Level Security policies for every table
- The `item-images` storage bucket and its access policies

`0002_matching.sql` adds Sprint 2 — smart matching and blind ownership verification:
- `item_matches`, `notifications`, `match_verification_attempts` tables with RLS
- A duplicate-prevention unique constraint on `(lost_item_id, found_item_id)`
- Seven `SECURITY DEFINER` RPCs (`record_match`, `reject_match`,
  `request_match_verification`, `get_verification_questions`,
  `submit_verification_answer`, `finalize_verification`, `advance_recovery`) that
  perform every write and the blind attribute comparison server-side — there are
  intentionally no direct insert/update policies on these tables, so all writes
  must go through an authorized RPC
- Realtime enabled on `notifications` so the notification bell updates live

`0003_proximity.sql` adds Sprint 3 — Proximity Assist and the campus map:
- `profiles.proximity_assist_enabled` and `profiles.proximity_radius_meters`
  (opt-in preference, off by default, radius constrained to 50/100/250/500)
- `proximity_alerts` — a minimal log used only for 24h cooldown deduplication;
  stores a rounded distance and a timestamp, never the user's coordinates or
  any continuous location history
- `record_proximity_alert(item_id, distance_meters)` — a single atomic
  `INSERT ... WHERE NOT EXISTS` function that enforces the cooldown without a
  race-prone select-then-insert round trip

`0004_recovery_messaging.sql` adds Sprint 4 — the fuller recovery flow,
messaging, and notification infrastructure. The QR recovery feature originally
introduced here is removed by `0020_remove_qr_recovery.sql`:
- Extends `item_matches.status` with `HANDOFF_SCHEDULED`, adds
  `handoff_scheduled_at` / `handoff_location`
- `match_status_history` — every status transition is logged automatically by
  a trigger (powers the recovery timeline UI); no RPC changes were needed for
  this, so Sprint 2's functions are untouched
- `schedule_handoff()` RPC and a redefined `advance_recovery()` RPC covering
  the full `VERIFIED → RECOVERY_IN_PROGRESS → HANDOFF_SCHEDULED → RECOVERED`
  state machine
- `match_messages` — RLS-scoped strictly to the two participants of a match,
  only once the finder has engaged (status past `POTENTIAL_MATCH`); enabled
  on `supabase_realtime` for live delivery; a trigger creates a `NEW_MESSAGE`
  notification for the recipient on every insert
- `push_subscriptions` (FCM tokens, RLS owner-only) and
  `profiles.push_notifications_enabled` / `email_notifications_enabled`
- An `authenticated`-only insert policy letting a user create their own
  `PROXIMITY_ALERT` notification row (everything else in `notifications`
  remains writable only via the Sprint 2 `SECURITY DEFINER` functions)

**Optional:** `supabase/functions/notify-dispatch/` is a real Firebase Cloud
Messaging + Resend email integration, deployed as a Supabase Edge Function
and triggered by a Database Webhook on `notifications` inserts. See
`supabase/functions/notify-dispatch/README.md` for full setup — it's entirely
optional; every other Sprint 4 feature (messaging, the recovery
timeline, the in-app notification center) works fully without it.

`0005_admin.sql` adds Sprint 5 — the admin role, audit log, suspicious
activity detection, and analytics:
- `admin_users` — a **separate table**, never a column on `profiles`. Since
  `profiles` has a self-service "update own row" policy, an `is_admin` column
  there would let a user grant themselves admin; `admin_users` has no
  client-writable policy at all. After applying `0028_creator_console.sql`, bootstrap the
  permanent Creator role from `creator_users` using the account UUID (see the
  Creator setup below); the Creator grants delegated Admin access in-app.
  ```sql
  insert into public.creator_users (user_id) values ('<creator auth.users id>');
  ```
- `is_admin()` — a `SECURITY DEFINER`, `STABLE` SQL function used throughout
  every admin policy and RPC below
- Additive admin-only `SELECT` policies on `items`, `item_matches`,
  `match_verification_attempts`, and `profiles`. Admins have no direct table
  access to private verification values; migration `0014` adds a dedicated,
  audited read for active report review, restricted to the Creator by `0028`.
- `audit_log` — populated entirely by triggers (report created/updated, match
  generated, verification attempted/passed/rejected, message sent [content
  never logged, only that one was sent], item recovered) plus explicit
  `log_audit_event()` calls inside the new admin RPCs — no existing Sprint
  2-4 RPC needed to change
- `suspicious_activity_flags` + `refresh_suspicious_activity()` — deterministic,
  rule-based (never ML, never auto-ban): unusually high found-report volume,
  repeated failed verification, repeated rejected claims, duplicate reports,
  and activity scattered across many locations in 24h. Produces a
  LOW/MEDIUM/HIGH score requiring admin review via `admin_review_flag()`
- `admin_deactivate_item()` / `admin_resolve_item()` — the only two ways an
  admin can change a report's status; both are logged, neither can edit
  report content
- `admin_dashboard_stats()`, `admin_match_analytics()`,
  `admin_location_heatmap()`, `admin_recovery_hotspots()`,
  `admin_category_frequency()`, `admin_time_distribution()` — safe
  aggregate-only analytics functions; none ever returns a reporter id or raw
  coordinates, only grouped counts

`0021_admin_support_chat.sql` adds one private support conversation per user,
an admin inbox with live message updates, and a global setting that admins can
toggle from the Admin panel. It is off by default. Row Level Security limits
each user to their own conversation and gives admins inbox access; the database
also blocks user messages while the feature is disabled.

`0008_profile_photos.sql` adds a private `profile-photos` bucket. Each user can
upload, view, and remove only files under their own user-ID folder. The app
stores the object path in `profiles.avatar_url` and uses short-lived signed URLs
to display the photo.

`0009_claimant_ownership_verification.sql` corrects the blind verification flow:
the claimant answers prompts based on private details saved on the found report,
and the finder reviews the boolean results. The initial three-try limit is
replaced by the five-try limit in migration `0010`.

`0010_flexible_claimant_answers.sql` increases the answer limit to five tries
per detail, accepts reordered wording, selected everyday equivalents, and
concise answers that contain the key details, and lets finders review all
prompts including unanswered ones. Apply this migration after `0009` to update
existing projects.

`0011_offline_vocabulary_verification.sql` adds an offline vocabulary of
everyday equivalents (for example, *purse/handbag/bag*, *mobile/cellphone/phone*,
and *tiny/small*) plus common plural and verb-form normalization. It runs in
Postgres and the local comparison helper, adding no API, model, or usage cost.
It also allows two-thirds overlap between multiword answers while still
rejecting known conflicting details. It improves common paraphrases but remains
a curated vocabulary; unusual synonyms may still need to be added deliberately.

`0012_expanded_offline_vocabulary.sql` moves the synonym list into a private,
editable database table and expands it across damage, object names, position,
appearance, color variants, and materials. It also strips more ordinary
sentence framing words. The list can be extended with additional
`alias` → `canonical` pairs without changing the comparison function. Apply it
after `0011` on projects that already have the verification flow.

`0018_open_english_wordnet.sql` adds sense-based synonyms from a filtered
Open English Wordnet 2025 dataset to the same private server-side comparison.
The matcher requires a shared synonym sense and preserves the existing
multiword overlap and contradiction checks. It does not send answers to an
external service. Existing deployments should run migration `0018` once after
`0017`; fresh installations should run all migrations in order. Data source and
license attribution are in `supabase/OPEN_ENGLISH_WORDNET_NOTICE.md` and in the
app footer. To regenerate the data after updating the source, run
`python scripts/build_oewn_lexicon.py` from the project folder.

`0013_owner_confirms_recovery.sql` changes the final handoff confirmation so
only the owner/claimant (the reporter of the lost item) can mark it recovered.
The finder can still coordinate and propose the time and place, but waits for
the owner to confirm receipt. This restriction is enforced in the database as
well as the interface.

`0014_admin_private_report_details.sql` adds an audited admin-only RPC for
loading an active report's full description, photos, and private verification
attributes on demand. It does not grant admins direct table access to hidden
attributes, and it logs each report whose private details are viewed.

`0016_user_facing_improvements.sql` adds owner-scoped saved searches with
automatic in-app alerts (and configured push notifications) for new matching
reports, private community flags with an admin review queue, and item links on
those alerts. Report editing and reopening use the existing owner-only item
policies.

`0017_flagged_report_actions.sql` adds admin actions directly to the community
flag queue. Admins can resolve or deactivate an active flagged report; the
report status change, flag review, and audit entries are committed together.

If you have the Supabase CLI installed locally, you can instead run:
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## 3. Configure auth
Auth → Providers → Email is enabled by default. For local development you can turn off
"Confirm email" under Auth → Settings so new accounts can sign in immediately. Before enabling
campus verification in the Admin panel, turn "Confirm email" on: Supabase's confirmation link
is what proves control of the campus email. The Admin panel defaults to `student.nitw.ac.in`;
admins can edit the allowed domain list and turn the requirement on or off at any time. When it
is enabled, new signups must use an allowed domain and existing users must change to and confirm
an allowed address before using protected ReFound features. Admin accounts retain access.
In Authentication → URL Configuration, set the production Site URL and add both your local
development URL (for example `http://localhost:5173/verify-campus`) and production ReFound URL
to the allowed Redirect URLs so confirmation links return to the app.

## 4. Configure environment variables
Copy `.env.example` to `.env.local` in the project root and fill in:
```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Push notifications (optional — see step 6) additionally need:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```
These are all client-safe Firebase Web config values, not secrets. The real
secrets (Firebase service account, Resend API key) are never `VITE_`-prefixed
and are configured as Supabase Edge Function secrets instead — see step 6.

## 5. Run the app
```bash
npm install
npm run dev
```

## 6. (Optional) Enable real push + email delivery
By default, ReFound's notifications are fully functional in-app (bell
dropdown + `/notifications` Notification Center) without any further setup.
To also deliver real push notifications and emails, deploy and wire up
`supabase/functions/notify-dispatch/` — see that folder's README for the
full walkthrough (Firebase service account, Resend API key, Database
Webhook).
## ReFound+
Migration `0022_refound_plus_entitlements.sql` adds server-managed membership
status. Migration `0023_refound_plus_launch.sql` adds admin-configurable UPI
settings, a payment-request queue, manual UTR review, and database-enforced
profile accent and saved-search perks. A user-entered UTR never activates
membership; only the Creator review RPC can approve it. Do not deploy automatic
recurring billing based on a static QR: subscription renewals in this setup are
manual UPI payments for the configured duration.

After applying `0023`, configure **Zephyrath’s Playground → ReFound+**. Public checkout stays
off until the Creator enables it. The Creator can upload a QR image there; uploaded
QR images are public so payment apps can scan them. As a repository-based
fallback, put the image at `public/refound-plus-upi-qr.png` (exact filename) and
deploy the frontend. Reporting, matching, ownership verification, and recovery
remain free and identical for all users.

## Creator and delegated Admin roles
Apply `0028_creator_console.sql` after `0027`, then apply `0029_admin_plus_recognition.sql` and `0030_admin_plus_profile_styles.sql`. Existing rows in `admin_users`
are promoted to the private `creator_users` table by UUID, then removed from
the delegated Admin list. For a fresh Supabase project, add the Creator's
Auth user UUID(s) directly to `creator_users` using the SQL Editor. Never put
Creator email addresses into Vite environment variables or this public repo.
The Creator can grant and revoke delegated Admin access from
**Zephyrath’s Playground → Admin access**. Admins share the support inbox but
cannot inspect hidden report details, configure ReFound+, or access the
Creator console. Their own ReFound+ access requires a paid entitlement or the
one-time trial. Paid Admins may customize their Admin banner and badge color
treatment, and opt into the thank-you wall under their Admin identity.
