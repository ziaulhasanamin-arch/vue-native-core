export type Currency = 'BDT' | 'USD' | 'INR' | 'CNY' | 'EUR' | 'GBP' | 'SAR' | 'AED' | 'JPY' | 'KWD';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund' | 'adjustment' | 'debt_payment' | 'receivable_collection';
export type AccountType = 'cash' | 'bank' | 'mobile_wallet' | 'credit_card' | 'savings' | 'investment' | 'loan';
export type Language = 'en' | 'bn';
export type Theme = 'system' | 'light' | 'dark';
export interface Profile { id: string; display_name: string; email: string; base_currency: Currency; language: Language; theme: Theme; onboarded: number; hide_balances: number; reduced_motion: number; date_format: string; week_start: number; daily_reminder: string; budget_alerts: number; due_alerts: number; push_enabled: number; auto_lock: number; created_at: number; updated_at: number }
export interface Account { id: string; user_id: string; name: string; type: AccountType; currency: Currency; opening_balance: number; icon: string; color: string; institution: string; account_number_last4: string; notes: string; is_archived: number; include_in_total: number; sort_order: number; is_deleted: number; created_at: number; updated_at: number }
export interface Category { id: string; user_id: string; name: string; type: 'income' | 'expense'; icon: string; color: string; is_builtin: number; is_archived: number; is_deleted: number; created_at: number; updated_at: number }
export interface Transaction { id: string; user_id: string; type: TransactionType; amount: number; destination_amount: number; currency: string; account_id: string; destination_account_id: string | null; category_id: string | null; payee: string; description: string; transaction_date: number; tags: string; attachment_url: string; exchange_rate_ppm: number; adjustment_sign: 1 | -1; linked_debt_id: string | null; linked_goal_id: string | null; is_recurring: number; recurrence_rule: string; is_deleted: number; created_at: number; updated_at: number }
export interface Debt { id: string; user_id: string; party_name: string; principal_amount: number; currency: string; start_date: number; due_date: number | null; direction: 'payable' | 'receivable'; status: string; notes: string; reminder_enabled: number; is_deleted: number; created_at: number; updated_at: number; is_archived?: number; }
export interface Goal { id: string; user_id: string; name: string; target_amount: number; currency: string; target_date: number | null; icon: string; color: string; status: string; linked_account_id: string | null; notes: string; is_deleted: number; created_at: number; updated_at: number; is_archived?: number; }
export interface Contribution { id: string; user_id: string; goal_id: string; amount: number; created_at: number; updated_at: number; is_deleted: number }
export interface Budget { id: string; user_id: string; name: string; category_id: string | null; amount: number; currency: string; period: string; start_date: number; warning_threshold: number; is_active: number; is_deleted: number; created_at: number; updated_at: number; is_archived?: number; }
export interface Investment { id: string; user_id: string; name: string; type: string; symbol: string; quantity_milli: number; cost_basis: number; current_value: number; currency: string; valuation_date: number; notes: string; is_deleted: number; created_at: number; updated_at: number }
export interface Valuation { id: string; user_id: string; investment_id: string; value: number; date: number; created_at: number; updated_at: number; is_deleted: number }
export interface Notification { id: string; user_id: string; type: string; title: string; body: string; is_read: number; deep_link: string; dedupe_key: string; created_at: number; updated_at: number }
export interface Settings { id: string; user_id: string; last_sync: number; sync_cursor: number; exchange_rates: string; created_at: number; updated_at: number }
export interface Data { profile: Profile; accounts: Account[]; categories: Category[]; transactions: Transaction[]; debts: Debt[]; goals: Goal[]; contributions: Contribution[]; budgets: Budget[]; investments: Investment[]; valuations: Valuation[]; notifications: Notification[]; settings: Settings; queueCount: number }
export type Entity = 'accounts' | 'categories' | 'transactions' | 'debts' | 'goals' | 'contributions' | 'budgets' | 'investments' | 'valuations';
export type Row = { id: string; user_id: string; updated_at: number; is_deleted?: number; [key: string]: unknown };
export const currencies: { code: Currency; symbol: string; name: string; flag: string; decimals: number }[] = [
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi taka', flag: '🇧🇩', decimals: 2 },
  { code: 'USD', symbol: '$', name: 'US dollar', flag: '🇺🇸', decimals: 2 },
  { code: 'INR', symbol: '₹', name: 'Indian rupee', flag: '🇮🇳', decimals: 2 },
  { code: 'CNY', symbol: '¥', name: 'Chinese yuan', flag: '🇨🇳', decimals: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'British pound', flag: '🇬🇧', decimals: 2 },
  { code: 'SAR', symbol: '﷼', name: 'Saudi riyal', flag: '🇸🇦', decimals: 2 },
  { code: 'AED', symbol: 'د.إ', name: 'UAE dirham', flag: '🇦🇪', decimals: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen', flag: '🇯🇵', decimals: 0 },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti dinar', flag: '🇰🇼', decimals: 3 },
];
