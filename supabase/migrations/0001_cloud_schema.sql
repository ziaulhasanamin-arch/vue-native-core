-- TakaGeloKoi optional cloud schema (Supabase / PostgreSQL)
-- Apply with: supabase db push  (or paste into the SQL editor)
-- Local SQLite remains the source of truth; these tables mirror synced entities.

create extension if not exists pgcrypto;

-- Helper: every table is owned by auth.uid().
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := extract(epoch from now()) * 1000; return new; end; $$;

create table if not exists public.accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('cash','bank','mobile_wallet','credit_card','savings','investment','loan')),
  currency text not null check (char_length(currency) = 3),
  opening_balance bigint not null default 0 check (abs(opening_balance) <= 99999999999999),
  icon text not null default 'wallet',
  color text not null default '#10B981',
  institution text not null default '',
  account_number_last4 text not null default '',
  notes text not null default '',
  is_archived smallint not null default 0,
  include_in_total smallint not null default 1,
  sort_order integer not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint,
  is_deleted smallint not null default 0
);

create table if not exists public.categories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  icon text not null,
  color text not null,
  parent_id text references public.categories(id),
  is_builtin smallint not null default 0,
  is_archived smallint not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint,
  is_deleted smallint not null default 0
);

create table if not exists public.debts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  party_name text not null,
  principal_amount bigint not null check (principal_amount > 0),
  currency text not null check (char_length(currency) = 3),
  start_date bigint not null,
  due_date bigint,
  direction text not null check (direction in ('payable','receivable')),
  status text not null default 'active',
  notes text not null default '',
  reminder_enabled smallint not null default 0,
  is_archived smallint not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint,
  is_deleted smallint not null default 0
);

create table if not exists public.goals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount bigint not null check (target_amount > 0),
  currency text not null check (char_length(currency) = 3),
  target_date bigint,
  icon text not null default 'target',
  color text not null default '#10B981',
  status text not null default 'active',
  linked_account_id text references public.accounts(id),
  notes text not null default '',
  is_archived smallint not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint,
  is_deleted smallint not null default 0
);

create table if not exists public.investments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  symbol text not null default '',
  quantity_milli bigint not null default 0,
  cost_basis bigint not null default 0,
  current_value bigint not null default 0,
  currency text not null check (char_length(currency) = 3),
  valuation_date bigint not null,
  notes text not null default '',
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint,
  is_deleted smallint not null default 0
);

create table if not exists public.budgets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id text references public.categories(id),
  amount bigint not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  period text not null default 'monthly' check (period in ('weekly','monthly','yearly')),
  start_date bigint not null,
  warning_threshold integer not null default 80 check (warning_threshold between 1 and 100),
  is_active smallint not null default 1,
  is_archived smallint not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint,
  is_deleted smallint not null default 0
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','transfer','refund','adjustment','debt_payment','receivable_collection')),
  amount bigint not null check (amount > 0),
  destination_amount bigint not null default 0 check (destination_amount >= 0),
  currency text not null check (char_length(currency) = 3),
  account_id text not null references public.accounts(id),
  destination_account_id text references public.accounts(id),
  category_id text references public.categories(id),
  payee text not null default '',
  description text not null default '',
  transaction_date bigint not null,
  tags text not null default '[]',
  attachment_url text not null default '',
  exchange_rate_ppm bigint not null default 1000000 check (exchange_rate_ppm > 0),
  adjustment_sign smallint not null default 1 check (adjustment_sign in (-1, 1)),
  linked_debt_id text references public.debts(id),
  linked_goal_id text references public.goals(id),
  is_recurring smallint not null default 0,
  recurrence_rule text not null default '',
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint,
  is_deleted smallint not null default 0,
  check (type <> 'transfer' or (destination_account_id is not null and destination_account_id <> account_id and destination_amount > 0)),
  check (type not in ('income','expense','refund') or category_id is not null),
  check (type <> 'transfer' or category_id is null),
  check (type not in ('debt_payment','receivable_collection') or linked_debt_id is not null),
  check (linked_debt_id is null or type in ('debt_payment','receivable_collection'))
);

create table if not exists public.contributions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id text not null references public.goals(id),
  amount bigint not null check (amount > 0),
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint,
  is_deleted smallint not null default 0
);

create table if not exists public.valuations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id text not null references public.investments(id),
  value bigint not null check (value >= 0),
  date bigint not null,
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint,
  is_deleted smallint not null default 0
);

create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  updated_at bigint not null
);

-- Indexes for per-user pagination and foreign keys.
create index if not exists idx_accounts_user on public.accounts(user_id, updated_at);
create index if not exists idx_categories_user on public.categories(user_id, updated_at);
create index if not exists idx_debts_user on public.debts(user_id, updated_at);
create index if not exists idx_goals_user on public.goals(user_id, updated_at);
create index if not exists idx_investments_user on public.investments(user_id, updated_at);
create index if not exists idx_budgets_user on public.budgets(user_id, updated_at);
create index if not exists idx_transactions_user on public.transactions(user_id, updated_at);
create index if not exists idx_transactions_date on public.transactions(user_id, transaction_date desc);
create index if not exists idx_transactions_account on public.transactions(account_id);
create index if not exists idx_contributions_goal on public.contributions(goal_id);
create index if not exists idx_valuations_investment on public.valuations(investment_id, date);
create index if not exists idx_device_tokens_user on public.device_tokens(user_id);

-- Row Level Security: a user can only read/write their own rows.
do $$
declare t text;
begin
  foreach t in array array['accounts','categories','debts','goals','investments','budgets','transactions','contributions','valuations','device_tokens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner_select" on public.%I', t);
    execute format('create policy "owner_select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "owner_insert" on public.%I', t);
    execute format('create policy "owner_insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "owner_update" on public.%I', t);
    execute format('create policy "owner_update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "owner_delete" on public.%I', t);
    execute format('create policy "owner_delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Realtime (optional): broadcast row changes to the owning client.
alter publication supabase_realtime add table public.accounts, public.categories, public.debts, public.goals, public.investments, public.budgets, public.transactions, public.contributions, public.valuations;
