import { describe, expect, it } from 'vitest';
import { accountBalance, budgetSpent, debtPaid, debtRemaining, flow, goalSaved, validateTransaction } from './finance';
import type { Account, Currency, Transaction } from './types';

const account = (id: string, opening_balance = 0, currency: Currency = 'BDT'): Account => ({ id, user_id: 'u', name: id, type: 'cash', currency, opening_balance, icon: 'wallet', color: '#10B981', institution: '', account_number_last4: '', notes: '', is_archived: 0, include_in_total: 1, sort_order: 0, created_at: 0, updated_at: 0, is_deleted: 0 });
let seq = 0;
const tx = (patch: Partial<Transaction>): Transaction => ({ id: `t${seq++}`, user_id: 'u', type: 'expense', amount: 100, destination_amount: 0, currency: 'BDT', account_id: 'a', destination_account_id: null, category_id: 'c', payee: '', description: '', transaction_date: 1000, tags: '[]', attachment_url: '', exchange_rate_ppm: 1_000_000, adjustment_sign: 1, linked_debt_id: null, linked_goal_id: null, is_recurring: 0, recurrence_rule: '', is_deleted: 0, created_at: 0, updated_at: 0, ...patch });

describe('ledger rules', () => {
  const accounts = [account('a', 1000), account('b', 500)];
  it('keeps transfers out of income and expense', () => {
    const rows = [tx({ type: 'income', amount: 5000 }), tx({ type: 'expense', amount: 700 }), tx({ type: 'transfer', amount: 200, destination_account_id: 'b', destination_amount: 200, category_id: null })];
    expect(flow(rows)).toMatchObject({ income: 5000, expense: 700, net: 4300 });
    expect(accountBalance(accounts[0], rows)).toBe(1000 + 5000 - 700 - 200);
    expect(accountBalance(accounts[1], rows)).toBe(500 + 200);
  });
  it('excludes debt payments and receivable collections from operating totals', () => {
    const rows = [tx({ type: 'debt_payment', amount: 300, linked_debt_id: 'd', category_id: null }), tx({ type: 'receivable_collection', amount: 400, linked_debt_id: 'r', category_id: null })];
    expect(flow(rows)).toMatchObject({ income: 0, expense: 0, net: 0 });
    expect(accountBalance(accounts[0], rows)).toBe(1100);
  });
  it('reduces category spending with refunds and ignores adjustments', () => {
    const rows = [tx({ type: 'expense', amount: 1000 }), tx({ type: 'refund', amount: 250 }), tx({ type: 'adjustment', amount: 900, category_id: null }), tx({ type: 'adjustment', amount: 100, adjustment_sign: -1, category_id: null })];
    expect(flow(rows).expense).toBe(750);
    expect(accountBalance(accounts[0], rows)).toBe(1000 - 1000 + 250 + 900 - 100);
  });
  it('ignores soft-deleted rows and respects date windows', () => {
    const rows = [tx({ amount: 100, transaction_date: 5 }), tx({ amount: 200, transaction_date: 15 }), tx({ amount: 999, is_deleted: 1 })];
    expect(flow(rows, 10, 20).expense).toBe(200);
  });
  it('derives debt and goal progress from linked records', () => {
    const debt = { id: 'd', principal_amount: 1000, direction: 'payable' } as never;
    const rows = [tx({ type: 'debt_payment', amount: 250, linked_debt_id: 'd' }), tx({ type: 'debt_payment', amount: 100, linked_debt_id: 'd', is_deleted: 1 })];
    expect(debtPaid(debt, rows)).toBe(250);
    expect(debtRemaining(debt, rows)).toBe(750);
    expect(goalSaved({ id: 'g' } as never, [{ goal_id: 'g', amount: 300, is_deleted: 0 } as never, { goal_id: 'g', amount: 50, is_deleted: 1 } as never])).toBe(300);
  });
  it('computes category budget spending net of refunds', () => {
    const budget = { category_id: 'c', amount: 1000 } as never;
    expect(budgetSpent(budget, [tx({ amount: 600 }), tx({ type: 'refund', amount: 100 }), tx({ amount: 999, category_id: 'other' })], [0, 2000])).toBe(500);
  });
});

describe('transaction validation', () => {
  const accounts = [account('a'), account('b'), account('usd', 0, 'USD')];
  it('requires two distinct accounts and equal amounts for same-currency transfers', () => {
    expect(() => validateTransaction(tx({ type: 'transfer', destination_account_id: 'a', destination_amount: 100, category_id: null }), accounts)).toThrow();
    expect(() => validateTransaction(tx({ type: 'transfer', destination_account_id: 'b', destination_amount: 99, category_id: null }), accounts)).toThrow();
    expect(() => validateTransaction(tx({ type: 'transfer', destination_account_id: 'b', destination_amount: 100, category_id: null }), accounts)).not.toThrow();
  });
  it('validates cross-currency received amounts against the integer rate', () => {
    expect(() => validateTransaction(tx({ type: 'transfer', destination_account_id: 'usd', destination_amount: 150, exchange_rate_ppm: 1_500_000, category_id: null }), accounts)).not.toThrow();
    expect(() => validateTransaction(tx({ type: 'transfer', destination_account_id: 'usd', destination_amount: 151, exchange_rate_ppm: 1_500_000, category_id: null }), accounts)).toThrow();
  });
  it('requires categories for income, expense and refunds', () => {
    expect(() => validateTransaction(tx({ category_id: null }), accounts)).toThrow();
    expect(() => validateTransaction(tx({ type: 'income', category_id: null }), accounts)).toThrow();
  });
});
