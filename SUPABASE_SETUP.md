# Optional Supabase setup

TakaGeloKoi works fully offline without Supabase. Cloud adds auth, backup, multi-device sync and realtime.

## 1. Create a project

Create a free Supabase project. Note the project URL and **anon** public key. Never use the service-role key in the app.

## 2. Apply the schema

Using the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

Or paste `supabase/migrations/0001_cloud_schema.sql` into the SQL editor and run it.

The migration creates synced tables, indexes, owner-only RLS policies, and adds tables to `supabase_realtime`.

## 3. Configure auth

- Enable Email provider. Enable Google provider if desired.
- Redirect URLs:
  - Web: `https://your-host/#/auth` (and local preview URL during development)
  - Android: `com.takagelokoi.finance://auth/callback`
- The Android app opens OAuth in a Custom Tab and exchanges the deep-link code/session.

## 4. Configure the app

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_PUSH_ENABLED=false
```

Rebuild:

```bash
npm run build
npx cap sync android
```

## 5. Sync behavior

- Local profile UUID is mapped to the authenticated user ID on push/pull.
- Pending offline writes are queued locally and pushed in dependency order when online.
- Last-write-wins uses `updated_at`; pending local rows are not overwritten during pull.
- Realtime changes trigger a debounced sync.
- Sign-out is blocked while pending changes remain.
- Profile/preferences and PIN/security records are not synced.
- Receipt data URLs are not uploaded; only remote references would sync.

## 6. Push notifications (optional)

1. Create a Firebase project and Android app `com.takagelokoi.finance`.
2. Download `google-services.json` into `android/app/` (gitignored).
3. Set `VITE_PUSH_ENABLED=true`.
4. Rebuild and sync. The app requests Android 13+ notification permission at runtime.
5. Store device tokens in `device_tokens` (RLS protected). Send pushes from your own backend/Edge Function using FCM server credentials.

## Security notes

- RLS is mandatory; do not disable it.
- The anon key is public by design; access is enforced by RLS.
- JSON backups are local files and are not encrypted by the app—store them safely.
- This setup has not been exercised against a live Supabase project in the sandbox; see `TEST_REPORT.md`.
