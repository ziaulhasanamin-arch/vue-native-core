export const SYNC_TABLES = ['accounts', 'categories', 'debts', 'goals', 'investments', 'budgets', 'transactions', 'contributions', 'valuations'] as const;
export const SCHEMA_VERSION = 1;
const audit = 'created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, synced_at INTEGER, is_deleted INTEGER NOT NULL DEFAULT 0';
const owned = (body: string, constraints = '') => `id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), ${body.trim().replace(/,$/, '')}, ${audit}${constraints ? ', ' + constraints : ''}`;
export const INITIAL_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, cloud_user_id TEXT UNIQUE, email TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL,
 avatar_url TEXT NOT NULL DEFAULT '', base_currency TEXT NOT NULL DEFAULT 'BDT', language TEXT NOT NULL DEFAULT 'en',
 theme TEXT NOT NULL DEFAULT 'dark', onboarded INTEGER NOT NULL DEFAULT 0, hide_balances INTEGER NOT NULL DEFAULT 0,
 reduced_motion INTEGER NOT NULL DEFAULT 0, date_format TEXT NOT NULL DEFAULT 'medium', week_start INTEGER NOT NULL DEFAULT 1,
 daily_reminder TEXT NOT NULL DEFAULT '', budget_alerts INTEGER NOT NULL DEFAULT 1, due_alerts INTEGER NOT NULL DEFAULT 1,
 push_enabled INTEGER NOT NULL DEFAULT 0, auto_lock INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (${owned(`name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('cash','bank','mobile_wallet','credit_card','savings','investment','loan')), currency TEXT NOT NULL, opening_balance INTEGER NOT NULL DEFAULT 0 CHECK(ABS(opening_balance) <= 99999999999999), icon TEXT NOT NULL DEFAULT 'wallet', color TEXT NOT NULL DEFAULT '#10B981', institution TEXT NOT NULL DEFAULT '', account_number_last4 TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', is_archived INTEGER NOT NULL DEFAULT 0, include_in_total INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0`)});
CREATE TABLE IF NOT EXISTS categories (${owned(`name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense')), icon TEXT NOT NULL, color TEXT NOT NULL, parent_id TEXT REFERENCES categories(id), is_builtin INTEGER NOT NULL DEFAULT 0, is_archived INTEGER NOT NULL DEFAULT 0`)});
CREATE TABLE IF NOT EXISTS debts (${owned(`party_name TEXT NOT NULL, principal_amount INTEGER NOT NULL CHECK(principal_amount > 0), currency TEXT NOT NULL, start_date INTEGER NOT NULL, due_date INTEGER, direction TEXT NOT NULL CHECK(direction IN ('payable','receivable')), status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '', reminder_enabled INTEGER NOT NULL DEFAULT 0, is_archived INTEGER NOT NULL DEFAULT 0`)});
CREATE TABLE IF NOT EXISTS goals (${owned(`name TEXT NOT NULL, target_amount INTEGER NOT NULL CHECK(target_amount > 0), currency TEXT NOT NULL, target_date INTEGER, icon TEXT NOT NULL DEFAULT 'target', color TEXT NOT NULL DEFAULT '#10B981', status TEXT NOT NULL DEFAULT 'active', linked_account_id TEXT REFERENCES accounts(id), notes TEXT NOT NULL DEFAULT '', is_archived INTEGER NOT NULL DEFAULT 0`)});
CREATE TABLE IF NOT EXISTS transactions (${owned(`type TEXT NOT NULL CHECK(type IN ('income','expense','transfer','refund','adjustment','debt_payment','receivable_collection')), amount INTEGER NOT NULL CHECK(amount > 0), destination_amount INTEGER NOT NULL DEFAULT 0 CHECK(destination_amount >= 0), currency TEXT NOT NULL CHECK(length(currency) = 3), account_id TEXT NOT NULL REFERENCES accounts(id), destination_account_id TEXT REFERENCES accounts(id), category_id TEXT REFERENCES categories(id), payee TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', transaction_date INTEGER NOT NULL, tags TEXT NOT NULL DEFAULT '[]', attachment_url TEXT NOT NULL DEFAULT '', exchange_rate_ppm INTEGER NOT NULL DEFAULT 1000000 CHECK(exchange_rate_ppm > 0), adjustment_sign INTEGER NOT NULL DEFAULT 1 CHECK (adjustment_sign IN (-1, 1)), linked_debt_id TEXT REFERENCES debts(id), linked_goal_id TEXT REFERENCES goals(id), is_recurring INTEGER NOT NULL DEFAULT 0, recurrence_rule TEXT NOT NULL DEFAULT ''`, `CHECK (type <> 'transfer' OR (destination_account_id IS NOT NULL AND destination_account_id <> account_id AND destination_amount > 0)), CHECK (type NOT IN ('income','expense','refund') OR category_id IS NOT NULL), CHECK (type <> 'transfer' OR category_id IS NULL), CHECK (type NOT IN ('debt_payment','receivable_collection') OR linked_debt_id IS NOT NULL), CHECK (linked_debt_id IS NULL OR type IN ('debt_payment','receivable_collection'))`)});
CREATE TABLE IF NOT EXISTS contributions (${owned(`goal_id TEXT NOT NULL REFERENCES goals(id), amount INTEGER NOT NULL CHECK(amount > 0)`)});
CREATE TABLE IF NOT EXISTS budgets (${owned(`name TEXT NOT NULL, category_id TEXT REFERENCES categories(id), amount INTEGER NOT NULL CHECK(amount > 0), currency TEXT NOT NULL, period TEXT NOT NULL DEFAULT 'monthly', start_date INTEGER NOT NULL, warning_threshold INTEGER NOT NULL DEFAULT 80 CHECK(warning_threshold BETWEEN 1 AND 100), is_active INTEGER NOT NULL DEFAULT 1, is_archived INTEGER NOT NULL DEFAULT 0`)});
CREATE TABLE IF NOT EXISTS investments (${owned(`name TEXT NOT NULL, type TEXT NOT NULL, symbol TEXT NOT NULL DEFAULT '', quantity_milli INTEGER NOT NULL DEFAULT 0, cost_basis INTEGER NOT NULL DEFAULT 0, current_value INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL, valuation_date INTEGER NOT NULL, notes TEXT NOT NULL DEFAULT ''`)});
CREATE TABLE IF NOT EXISTS valuations (${owned(`investment_id TEXT NOT NULL REFERENCES investments(id), value INTEGER NOT NULL, date INTEGER NOT NULL`)});
CREATE TABLE IF NOT EXISTS settings (${owned(`last_sync INTEGER NOT NULL DEFAULT 0, sync_cursor INTEGER NOT NULL DEFAULT 0, exchange_rates TEXT NOT NULL DEFAULT '{}'`)});
CREATE TABLE IF NOT EXISTS notifications (${owned(`type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', is_read INTEGER NOT NULL DEFAULT 0, deep_link TEXT NOT NULL DEFAULT '/', dedupe_key TEXT NOT NULL DEFAULT ''`)});
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_dedupe ON notifications(user_id, dedupe_key) WHERE dedupe_key != '';
CREATE TABLE IF NOT EXISTS sync_queue (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, retry_count INTEGER NOT NULL DEFAULT 0, last_error TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_entity ON sync_queue(entity_type, entity_id);
CREATE TABLE IF NOT EXISTS recurrence_history (rule_id TEXT NOT NULL, occurrence INTEGER NOT NULL, transaction_id TEXT NOT NULL REFERENCES transactions(id), PRIMARY KEY(rule_id, occurrence));
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_contributions_goal ON contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_valuations_investment ON valuations(investment_id, date);
`;
export const DEFAULT_CATEGORIES = [
 ['food', 'Food & dining', 'expense', 'utensils', '#F59E0B'],
 ['transport', 'Transport', 'expense', 'car', '#3781FC'],
 ['shopping', 'Shopping', 'expense', 'shopping-bag', '#EC4899'],
 ['health', 'Health', 'expense', 'heart-pulse', '#EF4444'],
 ['entertainment', 'Entertainment', 'expense', 'clapperboard', '#A78BFA'],
 ['bills', 'Bills & utilities', 'expense', 'receipt', '#2DD4BF'],
 ['home', 'Home', 'expense', 'house', '#FB923C'],
 ['education', 'Education', 'expense', 'graduation-cap', '#60A5FA'],
 ['other-expense', 'Other expense', 'expense', 'shapes', '#94A3B8'],
 ['salary', 'Salary', 'income', 'briefcase-business', '#10B981'],
 ['freelance', 'Freelance', 'income', 'laptop', '#34D399'],
 ['gift', 'Gifts', 'income', 'gift', '#F472B6'],
 ['other-income', 'Other income', 'income', 'banknote', '#2DD4BF'],
] as const;
