# Test report

Date: 2026-11-02 (UTC)
Environment: Debian 12 sandbox, Node 22.22.3, npm 10.9.8. Browser tests use bundled Chromium 153 via `@sparticuz/chromium` with local NSPR/NSS libraries. No Android emulator/adb or live cloud credentials.

## Commands and actual results

| Command | Result | Notes |
|---|---|---|
| `npm run build` | ✅ PASS | TypeScript strict + Vite production build. Main chunk 771.47 kB (gzip 248.86 kB); route/chart/export chunks split. |
| `npx cap sync android` | ✅ PASS | Copied web assets and registered 11 Capacitor plugins. |
| `npm test` (Vitest) | ✅ PASS | 4 files, 20 tests: money, finance/ledger, schema/rollback, recurrence. |
| `npm run test:e2e` (Playwright) | ✅ PASS | 3 tests: ledger/onboarding/persistence/offline; budgets/goals/debts/investments; mobile layout/theme. |
| `npm audit --omit=dev` | ✅ PASS | 0 vulnerabilities (info/low/moderate/high/critical). |
| `./gradlew :app:assembleDebug` — GitHub Actions | ✅ PASS | Ubuntu 24.04, Temurin JDK 21, Android SDK 35, Gradle 8.11.1; native build completed in 3m47s. |
| APK signature / package / alignment / checksum | ✅ PASS | `apksigner verify` passed (v1+v2); package/version confirmed with `aapt`; `zipalign -c` and SHA-256 checks passed. |
| Native install/launch | ❌ NOT RUN | APK is available; no physical device/emulator launch test has been performed. |
| Live Supabase auth/sync/realtime | ❌ NOT RUN | No project credentials configured. |
| Firebase push / Android 13 permission | ❌ NOT RUN | No Firebase project/device. |
| Biometric / SecureStorage / camera / local notifications | ❌ NOT RUN | Requires native device/emulator. |

## Browser E2E coverage (passing)

1. **Onboarding, real ledger, transfer, edit/delete, persistence, search, themes and offline**
   - Completes 4-step onboarding.
   - Creates bKash/Nagad/Cash accounts with opening balances.
   - Posts income 5000.00 and expense 759.40; asserts exact minor-unit balances and flow.
   - Posts same-currency transfer; asserts transfers excluded from income/expense.
   - Edits expense; asserts recomputed totals.
   - Reloads and asserts persistence.
   - Deletes transfer; asserts balance reversal.
   - Searches and opens transaction detail.
   - Switches light theme and Bangla/English.
   - Navigates offline and asserts account data remains available; no page errors.
2. **Budgets, goals, debts and investment data entry**
   - Creates budget, goal, linked contribution (40% progress), debt and payment (outstanding 400.00, expense excluded).
   - Creates investment holding and valuation.
   - Asserts account balance and operating flow.
3. **Mobile layout, floating navigation, light theme and empty states**
   - 390×844 viewport; floating dock visible; no horizontal overflow.
   - Opens add sheet; switches light theme; captures screenshots.

## Unit coverage (passing)

- `money.test.ts`: decimal parsing, precision rejection, round-trip, half-up conversion, rate ppm, percent.
- `finance.test.ts`: transfer/debt/collection exclusion, refund netting, signed adjustments, soft-delete/date windows, debt/goal/budget selectors, transfer/category validation.
- `schema.test.ts`: table/index initialization, transfer/category/debt CHECK constraints, transaction rollback.
- `recurring.test.ts`: month-end clamp, daily/weekly/yearly advancement, leap-year clamp.

## Artifacts

- Build log: `/home/user/build.log`
- Cap sync log: `/home/user/capsync.log`
- Vitest log: `/home/user/vitest.log`
- E2E log: `/home/user/e2e.log`
- Successful native build: https://github.com/ziaulhasanamin-arch/vue-native-core/actions/runs/41448675187
- Historical local Gradle blocker: `/home/user/gradle.log` (resolved by building on GitHub Actions)
- Audit JSON: `/home/user/audit.json`
- Mobile screenshots: `test-results/mobile-home.png`, `test-results/mobile-light.png`

## APK delivery

- Path: `dist/TakaGeloKoi-debug.apk`
- Package ID: `com.takagelokoi.finance`
- Version: `1.0.0` / versionCode `1`
- Size: **30,747,135 bytes** (30.75 MB / 29.32 MiB)
- Minimum Android: API 23 (Android 6.0); target/compile SDK: 35
- SHA-256: see `dist/TakaGeloKoi-debug.apk.sha256`
- Signing: Android debug certificate; APK Signature Scheme v1 and v2 verified
- Verification: native Gradle build, web build, Capacitor sync, unit tests, signature, package metadata, alignment and checksum pass. Physical-device installation/launch remains unverified.
