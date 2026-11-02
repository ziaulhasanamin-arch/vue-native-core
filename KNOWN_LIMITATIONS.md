# Known limitations

## Build / device verification

- The local sandbox cannot download Gradle/Android dependencies, so the APK was built successfully on **GitHub Actions** instead. The delivered file is a development/debug APK, not a Play Store release. Its debug signing identity is cached between CI builds on a best-effort basis; it is not a production signing key.
- The locked Capacitor 7 plugins require **JDK 21** to compile. This supersedes the original JDK 17 build-tool preference; the APK still supports Android API 23+.
- Native install/launch, SQLite plugin behavior, biometric prompt, SecureStorage, camera, local notification scheduling, FCM push, and OAuth Custom Tab flow were **not** verified on a device/emulator.
- The browser preview uses SQL.js/IndexedDB, not native SQLite. Its `security` table is not hardware-backed; native Android uses SecureStorage.

## Cloud / push

- Supabase and Firebase are optional and unconfigured in this build. No live auth/sync/realtime/push test was run. Apply the migration and add your own credentials to exercise them.
- Receipt images are kept locally; the sync queue strips data URLs. Remote receipt storage/upload is not implemented.
- Conflict resolution is last-write-wins at row granularity, not field-level CRDT merging.

## Financial / product

- Exchange rates are manual entries, not live market feeds. Base-currency dashboard grouping does not convert historical account currencies automatically.
- Investments use manual valuations; no live prices. Holdings are tracked separately from account balances.
- Recurring transactions are generated when the app opens/foregrounds, not by a background server. Android exact-alarm/background scheduling is not used.
- PDF reports cover the selected base currency and use the bundled Bengali font; multi-currency consolidated PDF valuation is not implemented.
- JSON backups are not encrypted by the app. Users must store backup files securely.
- Long-form Help/Privacy content and some secondary helper text remain primarily English; core navigation, forms, settings and financial labels are translated.
- Budget period start dates are anchored to creation date; custom fiscal calendars are not supported.
- Health score is a heuristic, not financial advice.

## Testing boundary

- Browser E2E covers onboarding, ledger/transfer/edit/delete/persistence/search/theme/offline navigation, budgets/goals/debts/investments, and mobile layout. It does not cover native Android APIs or live cloud.
- Unit tests cover money parsing/conversion, ledger selectors/validation, schema constraints/rollback, and recurrence date math.
- No accessibility audit beyond role/label-based E2E and reduced-motion support was performed.
