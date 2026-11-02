import { create } from 'zustand';
import { getDatabase, upsert } from './database';
import type { Statement } from './database';
import { DEFAULT_CATEGORIES, SYNC_TABLES } from './schema';
import type { Data, Profile, Entity, Row, Transaction, Currency, Language } from '../lib/types';
import { accountBalance, debtPaid, validateTransaction } from '../lib/finance';

export const uid = () => crypto.randomUUID();
export const now = () => Date.now();
export const monthStart = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1).getTime();
export const monthEnd = (date = new Date()) => new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
export async function loadData(): Promise<Data> {
  const db = await getDatabase();
  const [profile] = await db.query<Profile>('SELECT * FROM users LIMIT 1');
  const result: Record<string, unknown> = { profile };
  for (const table of [...SYNC_TABLES, 'notifications']) result[table] = await db.query(`SELECT * FROM ${table} WHERE is_deleted=0 ORDER BY created_at DESC`);
  result.transactions = (result.transactions as Transaction[]).sort((a, b) => b.transaction_date - a.transaction_date || b.created_at - a.created_at);
  const [settings] = await db.query<Data['settings']>('SELECT * FROM settings LIMIT 1');
  result.settings = settings;
  result.queueCount = (await db.query<{ n: number }>('SELECT COUNT(*) n FROM sync_queue'))[0].n;
  return result as unknown as Data;
}
export function profileStatements(profile: Profile): Statement[] { return [upsert('users', { ...profile })]; }
export async function enqueue(table: Entity, row: Row, operation = 'update'): Promise<Statement[]> {
  const existing = await (await getDatabase()).query<{ created_at: number }>('SELECT created_at FROM sync_queue WHERE entity_type=? AND entity_id=?', [table, row.id]);
  return [upsert(table, { ...row }), {
    statement: 'INSERT INTO sync_queue(id,entity_type,entity_id,operation,payload,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(entity_type,entity_id) DO UPDATE SET operation=excluded.operation,payload=excluded.payload',
    values: [existing[0] ? `${table}:${row.id}` : uid(), table, row.id, operation, JSON.stringify(row), existing[0]?.created_at ?? now()],
  }];
}
interface Store {
  data: Data | null; ready: boolean; error: string; locked: boolean; toast: { text: string; kind: 'success' | 'error' | 'info'; id: number } | null;
  initialize(): Promise<void>; refresh(): Promise<void>; notify(text: string, kind?: 'success' | 'error' | 'info'): void;
  updateProfile(patch: Partial<Profile>): Promise<void>;
  completeOnboarding(name: string, currency: Currency, language: Language): Promise<void>;
  saveEntity(table: Entity, row: Row, extra?: Statement[]): Promise<void>;
  deleteEntity(table: Entity, id: string): Promise<void>;
  saveTransaction(row: Transaction): Promise<void>;
  addContribution(goalId: string, amount: number): Promise<void>;
  replaceData(data: Data): Promise<void>;
  reset(): Promise<void>;
  setLocked(locked: boolean): void;
}
async function seed(): Promise<Data> {
  const db = await getDatabase();
  const existing = await db.query<Profile>('SELECT * FROM users LIMIT 1');
  if (!existing.length) {
    const id = uid(), time = now();
    const profile: Profile = { id, display_name: '', email: '', base_currency: 'BDT', language: 'en', theme: 'dark', onboarded: 0, hide_balances: 0, reduced_motion: 0, date_format: 'medium', week_start: 1, daily_reminder: '', budget_alerts: 1, due_alerts: 1, push_enabled: 0, auto_lock: 0, created_at: time, updated_at: time };
    const statements: Statement[] = [upsert('users', { ...profile }), upsert('settings', { id: uid(), user_id: id, last_sync: 0, sync_cursor: 0, exchange_rates: '{}', created_at: time, updated_at: time })];
    DEFAULT_CATEGORIES.forEach(([slug, name, type, icon, color]) => statements.push(upsert('categories', { id: `${id}-${slug}`, user_id: id, name, type, icon, color, is_builtin: 1, is_archived: 0, is_deleted: 0, created_at: time, updated_at: time })));
    await db.transact(statements);
  }
  return loadData();
}
export const useStore = create<Store>((set, get) => ({
  data: null, ready: false, error: '', locked: false, toast: null,
  async initialize() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const data = await Promise.race([
        seed(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Opening the local database timed out. Please try again.')), 20000); }),
      ]);
      set({ data, ready: true, error: '' });
    } catch (e) {
      set({ error: e instanceof Error && e.message ? e.message : 'Unable to open your database.', ready: false });
    } finally { if (timer) clearTimeout(timer); }
  },
  async refresh() { set({ data: await loadData() }); },
  notify(text, kind = 'success') {
    const id = now(); set({ toast: { text, kind, id } });
    setTimeout(() => { if (get().toast?.id === id) set({ toast: null }); }, 4500);
  },
  async updateProfile(patch) {
    const profile = { ...get().data!.profile, ...patch, updated_at: now() };
    await (await getDatabase()).transact(profileStatements(profile)); await get().refresh();
  },
  async completeOnboarding(name, currency, language) {
    await get().updateProfile({ display_name: name.trim() || 'Friend', base_currency: currency, language, onboarded: 1 });
  },
  async saveEntity(table, row, extra = []) {
    if (!SYNC_TABLES.includes(table)) throw new Error('Unsupported entity.');
    if (row.user_id !== get().data!.profile.id) throw new Error('This record belongs to another profile.');
    const statements = [...await enqueue(table, row), ...extra];
    await (await getDatabase()).transact(statements); await get().refresh();
  },
  async deleteEntity(table, id) {
    const data = get().data!;
    const row = (data[table as keyof Data] as unknown as Row[]).find(r => r.id === id);
    if (!row) throw new Error('Record not found.');
    if (table === 'accounts' && data.transactions.some(t => t.account_id === id || t.destination_account_id === id)) throw new Error('This account has transactions. Archive it to preserve your history.');
    if (table === 'categories' && data.transactions.some(t => t.category_id === id)) throw new Error('Reassign this category’s transactions before deleting it.');
    if (table === 'debts' && data.transactions.some(t => t.linked_debt_id === id)) throw new Error('This record has payments. Archive it to preserve your history.');
    if (table === 'goals' && data.contributions.some(c => c.goal_id === id)) throw new Error('This goal has contributions. Archive it to preserve your history.');
    if (table === 'budgets' && data.budgets.some(b => b.category_id === id)) throw new Error('Remove the category budget first.');
    await get().saveEntity(table, { ...row, is_deleted: 1, updated_at: now() });
  },
  async saveTransaction(row) {
    const data = get().data!;
    validateTransaction(row, data.accounts);
    if (row.linked_debt_id) {
      const debt = data.debts.find(d => d.id === row.linked_debt_id);
      if (!debt) throw new Error('Linked record not found.');
      const source = data.accounts.find(a => a.id === row.account_id)!;
      if (source.currency !== debt.currency) throw new Error('Use an account in the same currency as this debt.');
      const otherPayments = data.transactions.filter(t => t.id !== row.id && t.linked_debt_id === debt.id && ['debt_payment', 'receivable_collection'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
      if (otherPayments + row.amount > debt.principal_amount) throw new Error('Payment exceeds the outstanding balance.');
    }
    const extra: Statement[] = [];
    if (row.linked_debt_id) {
      const debt = data.debts.find(d => d.id === row.linked_debt_id)!;
      const payments = data.transactions.filter(t => t.id !== row.id && t.linked_debt_id === debt.id).reduce((s, t) => s + t.amount, 0) + row.amount;
      extra.push(...await enqueue('debts', { ...debt, status: payments >= debt.principal_amount ? 'paid' : 'active', updated_at: now() }));
    }
    await get().saveEntity('transactions', { ...row }, extra);
  },
  async addContribution(goalId, amount) {
    const data = get().data!, goal = data.goals.find(g => g.id === goalId);
    if (!goal || !Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a positive contribution.');
    if (goal.linked_account_id) {
      const account = data.accounts.find(a => a.id === goal.linked_account_id)!;
      const reserved = data.goals.filter(g => g.linked_account_id === account.id).reduce((s, g) => s + data.contributions.filter(c => c.goal_id === g.id).reduce((a, c) => a + c.amount, 0), 0);
      if (accountBalance(account, data.transactions) - reserved < amount) throw new Error('Not enough unreserved money in the linked account.');
    }
    const t = now();
    await get().saveEntity('contributions', { id: uid(), user_id: data.profile.id, goal_id: goalId, amount, is_deleted: 0, created_at: t, updated_at: t });
  },
  async replaceData(data) {
    const profile = get().data!.profile;
    const statements: Statement[] = [];
    for (const table of [...SYNC_TABLES].reverse()) statements.push({ statement: `DELETE FROM ${table} WHERE user_id=?`, values: [profile.id] });
    statements.push({ statement: 'DELETE FROM sync_queue' }, { statement: 'DELETE FROM recurrence_history' });
    for (const table of SYNC_TABLES) for (const row of data[table as Entity] as unknown as Row[]) statements.push(...await enqueue(table, { ...row, user_id: profile.id }));
    await (await getDatabase()).transact(statements); await get().refresh();
  },
  async reset() {
    const db = await getDatabase();
    const statements: Statement[] = [{ statement: 'DELETE FROM recurrence_history' }, { statement: 'DELETE FROM sync_queue' }];
    for (const table of [...SYNC_TABLES].reverse()) statements.push({ statement: 'DELETE FROM ' + table });
    statements.push({ statement: 'DELETE FROM notifications' }, { statement: 'DELETE FROM settings' }, { statement: 'DELETE FROM users' });
    await db.transact(statements); set({ data: await seed(), locked: false });
  },
  setLocked(locked) { set({ locked }); },
}));
export const balanceOf = (accountId: string) => { const d = useStore.getState().data!; return accountBalance(d.accounts.find(a => a.id === accountId)!, d.transactions); };
export const remainingDebt = (id: string) => { const d = useStore.getState().data!; const debt = d.debts.find(x => x.id === id)!; return debt.principal_amount - debtPaid(debt, d.transactions); };
