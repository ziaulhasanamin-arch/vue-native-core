# Feature matrix

Legend: ✅ implemented · 🧪 verified by automated browser/unit test in this sandbox · ☁️ requires your cloud/Firebase credentials · ⚠️ implemented but not device-verified

| Area | Feature | Status |
|---|---|---|
| Onboarding | 4-step onboarding, local guest start, optional cloud auth | ✅ 🧪 |
| Accounts | Cash/bank/bKash/Nagad/Rocket/Alipay/WeChat/credit/savings/investment/loan types | ✅ |
| Accounts | Add/edit/archive, opening balance, currency, last4, include-in-total | ✅ 🧪 |
| Ledger | Income/expense/transfer/refund/adjustment/debt payment/collection | ✅ 🧪 |
| Ledger | Integer minor units, central balance derivation, atomic edit/delete | ✅ 🧪 |
| Ledger | Multi-currency transfer with integer ppm rate and received amount | ✅ 🧪 |
| Transactions | Search/filter/date range/sort, details, duplicate, receipts, tags, recurring | ✅ (receipt camera ⚠️) |
| Dashboard | Net worth, income/expense, recent transactions, quick actions, tips | ✅ |
| Analytics | Category spending, income vs expense, account breakdown, period controls, CSV/PDF export | ✅ (PDF ⚠️) |
| Budgets | Overall/category budgets, weekly/monthly/yearly, warning alerts | ✅ 🧪 |
| Goals | Targets, linked-account contributions, milestones, progress | ✅ 🧪 |
| Debts | Payables/receivables, payments/collections, due reminders, outstanding caps | ✅ 🧪 |
| Investments | Manual holdings, cost basis, valuations, portfolio chart | ✅ 🧪 |
| Profile | Health score, edit name, sign out, cloud status | ✅ |
| Settings | Theme/light/dark/system, Bangla/English, base currency, hide balances, reduced motion, date format, exchange rates | ✅ 🧪 |
| Categories | Custom categories, archive/reassign | ✅ |
| Notifications | Notification center, daily/debt/budget/goal reminders, test notification | ✅ ⚠️ native scheduling |
| Security | PIN/recovery/biometric/auto-lock/rate limiting | ✅ ⚠️ native biometric/secure storage |
| Offline | Native SQLite; browser SQL.js/IndexedDB; offline queue | ✅ 🧪 browser persistence/offline navigation |
| Cloud | Supabase auth, RLS schema, bidirectional sync, realtime | ☁️ not live-tested |
| Push | FCM registration/token storage, Android 13 permission | ☁️ ⚠️ |
| Export | CSV, PDF, JSON backup/restore, reset | ✅ (restore ⚠️) |
| UI | Glass Forest dark/light, floating dock, safe areas, responsive, bundled fonts | ✅ 🧪 mobile layout/theme |
| i18n | English/Bangla UI strings, Bangla numerals/currency formatting | ✅ (long-form help/privacy partially English) |
| Android | Capacitor project, manifest hardening, notification icon, OAuth deep link, signed debug APK | ✅ native CI build/signature/alignment + Android 15 emulator install/launch verified; physical device ⚠️ |
