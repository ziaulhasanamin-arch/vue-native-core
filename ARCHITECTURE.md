# Architecture

## Stack

- React 19 + TypeScript + Vite 7
- Capacitor 7 Android wrapper
- React Router (HashRouter for `file://`/WebView compatibility)
- Zustand store (single consistent state container)
- Tailwind CSS 4 + CSS theme variables
- Framer Motion, Recharts, Lucide
- React Hook Form + Zod validation
- Native SQLite (`@capacitor-community/sqlite`) on Android; SQL.js + IndexedDB in browsers
- Optional Supabase (Auth, Postgres, RLS, Realtime) and Firebase Cloud Messaging

## Layers

```text
src/pages         Route screens (lazy-loaded)
src/components    Shell, dock, UI primitives, forms, transaction rows, security UI
src/lib           Domain types, integer money, finance selectors, i18n, period controls
src/data          SQLite schema/migrations, database adapter, Zustand store, sync queue
src/services      Cloud sync/auth, security, notifications, recurring, export/backup
supabase          PostgreSQL migration with RLS and realtime publication
android           Capacitor Android project, manifest hardening, notification icon
tests             Playwright browser E2E
src/**/*.test.ts  Vitest unit tests
```

## Persistence

`getDatabase()` returns a `DatabaseAdapter` with `query()` and `transact()`.

- Android: `SQLiteConnection.executeSet(statements, true)` for atomic batches.
- Browser: SQL.js database serialized to IndexedDB after each committed transaction; a promise chain serializes writes.
- Schema version is stored in `_meta`. Initialization is transactional. Future migrations must be additive and ordered.
- `upsert()` guards table/column identifiers and uses parameterized values.

The store never mutates balances directly. `accountBalance()` derives balances from opening balance plus non-deleted transactions. Editing/deleting a transaction writes a single row replacement/tombstone; all views recompute.

## Sync

Local writes enqueue an upsert payload in `sync_queue` in the same transaction as the entity write. `syncNow()`:

1. Requires a Supabase session and network.
2. Pushes pending rows in foreign-key dependency order, mapping local profile UUID to `auth.uid()`.
3. Uses last-write-wins on `updated_at`; pending local rows are protected during pull.
4. Pulls all synced tables in 500-row pages and upserts newer remote rows.
5. Records `last_sync` and refreshes the store.

Realtime `postgres_changes` triggers a debounced sync for the signed-in user. Receipt data URLs are stripped before push; only remote storage references would sync. Profile/settings and security records are never synced.

## Security

- PIN: 4–6 digits, bcrypt cost 12, recovery code hash, exponential lockout capped at 300 seconds.
- Native: `@aparajita/capacitor-secure-storage`; browser preview: local SQLite `security` table (not hardware-backed).
- Biometric unlock is gated on an existing PIN and available strong biometric.
- Auto-lock on background/visibility with configurable timeout.
- Android manifest disables backup, cleartext traffic, and adds notification/biometric permissions and OAuth deep link.

## Money

`parseMoney()` converts decimal strings to integer minor units using BigInt. `convertMoney()` uses integer parts-per-million rates with half-up rounding. Display formatting uses Intl on exact decimal strings/BigInt, not binary money arithmetic.

## Recurring transactions

On app open/foreground, `processRecurring()` generates due occurrences from recurring source rows, clamps month-end dates, deduplicates through `recurrence_history`, validates each generated row, and writes atomically. Debt-payment/collection sources are not auto-repeated. Generated rows do not copy debt/goal links or receipts.

## Export / backup

- CSV: UTF-8 BOM, formula-injection guard, minor and decimal units.
- PDF: bundled Noto Sans Bengali font, base-currency report.
- JSON backup: app/version marker, Zod validation, reference/duplicate checks, size/row limits; restore rewrites ownership and re-enqueues sync.
