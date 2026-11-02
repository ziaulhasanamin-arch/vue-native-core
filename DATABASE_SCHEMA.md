# Database schema

Local SQLite schema version: **1**. Cloud mirror: `supabase/migrations/0001_cloud_schema.sql`.

All entity tables use:

```sql
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id),
created_at INTEGER NOT NULL,
updated_at INTEGER NOT NULL,
synced_at INTEGER,
is_deleted INTEGER NOT NULL DEFAULT 0
```

Money columns are `INTEGER` minor units. Timestamps are epoch milliseconds. Soft deletes preserve sync tombstones.

## Tables

| Table | Purpose | Key constraints |
|---|---|---|
| `users` | Local profile/preferences | one local profile; `cloud_user_id` optional unique |
| `accounts` | Cash/bank/wallet/credit/savings/investment/loan | currency length 3; opening balance bounded; archive flag |
| `categories` | Income/expense categories | type check; self-referencing parent; builtin/archive flags |
| `debts` | Payables/receivables | principal > 0; direction check; due date optional |
| `goals` | Savings goals | target > 0; optional linked account |
| `transactions` | Ledger entries | type/amount/currency checks; transfer/category/debt-link CHECKs; signed adjustment |
| `contributions` | Goal contributions | amount > 0; FK to goal |
| `budgets` | Period budgets | amount > 0; warning threshold 1–100; period check |
| `investments` | Manual holdings | cost/value minor units; valuation date |
| `valuations` | Investment history | FK to investment; value >= 0 |
| `settings` | Local sync metadata | exchange rates JSON |
| `notifications` | Notification center | unique dedupe key per user |
| `sync_queue` | Offline outbound queue | unique `(entity_type, entity_id)` |
| `recurrence_history` | Recurring dedupe | PK `(rule_id, occurrence)` |
| `security` | Device-local PIN/biometric record | never synced/backed up |
| `_meta` | Schema version | single row |

## Transaction invariants

Database CHECKs enforce:

- `amount > 0`, `destination_amount >= 0`, `exchange_rate_ppm > 0`, `adjustment_sign IN (-1,1)`.
- Transfers require a distinct destination account and positive received amount, and no category.
- Income/expense/refund require a category.
- Debt payment/receivable collection require a linked debt; other types cannot link a debt.

Application validation additionally enforces account existence/currency, same-currency transfer equality, cross-currency received amount matching the integer rate, category type, debt currency and outstanding-payment cap.

## Indexes

- `transactions(transaction_date DESC)`
- `transactions(account_id)`
- `transactions(category_id)`
- `transactions(user_id, is_deleted)`
- `contributions(goal_id)`
- `valuations(investment_id, date)`
- notification dedupe and queue uniqueness indexes

## Sync order

Foreign-key-safe order:

```text
accounts → categories → debts → goals → investments → budgets → transactions → contributions → valuations
```

Restore deletes in reverse order. Cloud RLS restricts every synced table to `auth.uid() = user_id`.
