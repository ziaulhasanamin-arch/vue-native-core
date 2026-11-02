# TakaGeloKoi

**Your money, beautifully managed.**

TakaGeloKoi is an offline-first personal finance application for Android, built with React, TypeScript, Vite and Capacitor. The browser preview uses the same application code with a SQL.js/IndexedDB persistence adapter; the Android target uses native SQLite through `@capacitor-community/sqlite`.

- Package: `com.takagelokoi.finance`
- Version: `1.0.0` (versionCode `1`)
- Default currency: `BDT`
- Languages: English and Bangla
- Design system: **Glass Forest** dark/light themes

## Status

The application source, database layer, cloud schema, unit tests and browser E2E tests are implemented. A **signed, installable debug APK is available at `dist/TakaGeloKoi-debug.apk`**. It was built by GitHub Actions with the full native Capacitor plugin set; its package, version, signature, checksum and ZIP alignment were verified. Native device installation/launch has not yet been performed. See `TEST_REPORT.md` and `KNOWN_LIMITATIONS.md` for the verification boundary.

## Quick start (browser)

```bash
npm ci
npm run dev
```

Open the served URL. No cloud credentials are required; every local feature works offline after the app has loaded.

## Production web build

```bash
npm run build
npm run preview
```

## Android build

Requirements: JDK 21 (required by the locked Capacitor 7 plugins), Android SDK 35, Gradle 8.11.1 wrapper, and access to Gradle/Google/Maven repositories. The GitHub Actions workflow installs these automatically.

```bash
npm run cap:sync
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Optional Firebase push: place your own `google-services.json` in `android/app/`, set `VITE_PUSH_ENABLED=true`, and rebuild. No keys are committed.

## Optional Supabase cloud

Copy `.env.example` to `.env`, fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, apply `supabase/migrations/0001_cloud_schema.sql`, then rebuild. See `SUPABASE_SETUP.md`.

## Tests

```bash
npm test            # Vitest: money, ledger, schema, recurrence
npm run test:e2e    # Playwright: onboarding, ledger, planning, mobile/offline
```

In this sandbox the browser tests use a bundled Chromium:

```bash
LD_LIBRARY_PATH=/home/user/tools/nspr-install/lib:/home/user/tools/browser-libs/lib npm run test:e2e
```

## Documentation

- `ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `SUPABASE_SETUP.md`
- `FEATURE_MATRIX.md`
- `TEST_REPORT.md`
- `KNOWN_LIMITATIONS.md`

## Financial rules

Money is stored as integer minor units. Transfers are not income or expense. Debt payments and receivable collections are excluded from operating income/expense. Refunds reduce category spending. Adjustments use an explicit signed `adjustment_sign` and are excluded from operating totals. Balances are derived centrally from opening balance plus posted transactions; edits/deletes replace the row atomically and all selectors recompute from the ledger.

## Privacy

Local data stays in SQLite/IndexedDB. PIN/recovery hashes are device-local (native SecureStorage on Android). JSON backups exclude PIN hashes and cloud tokens. Receipt images are stored locally and are not uploaded by the sync queue. Cloud sync is optional and protected by per-user PostgreSQL RLS.
