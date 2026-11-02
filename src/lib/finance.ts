import type { Account, Transaction, Debt, Goal, Contribution, Budget, Category, TransactionType } from './types';
import { convertMoney } from './money';
export function accountBalance(account: Account, transactions: Transaction[]): number {
  return transactions.filter(t => !t.is_deleted).reduce((balance, t) => {
    if (t.account_id === account.id) {
      if (['income', 'refund', 'receivable_collection'].includes(t.type)) balance += t.amount;
      else if (['expense', 'transfer', 'debt_payment'].includes(t.type)) balance -= t.amount;
      else if (t.type === 'adjustment') balance += t.amount * t.adjustment_sign;
    }
    if (t.type === 'transfer' && t.destination_account_id === account.id) balance += t.destination_amount;
    return balance;
  }, account.opening_balance);
}
export function cashFlow(transactions: Transaction[], from = 0, to = Infinity) {
  return transactions.filter(t => !t.is_deleted && t.transaction_date >= from && t.transaction_date < to).reduce((a, t) => {
    if (t.type === 'income') a.income += t.amount;
    if (t.type === 'expense') a.expense += t.amount;
    if (t.type === 'refund') a.expense -= t.amount;
    return a;
  }, { income: 0, expense: 0, net: 0 });
}
export function flow(transactions: Transaction[], from = 0, to = Infinity) {
  const result = cashFlow(transactions, from, to);
  return { ...result, net: result.income - result.expense, savings: result.income > 0 ? Math.round((result.income - result.expense) / result.income * 100) : 0 };
}
export const debtPaid = (debt: Debt, tx: Transaction[]) => tx.filter(t => !t.is_deleted && t.linked_debt_id === debt.id && (debt.direction === 'payable' ? t.type === 'debt_payment' : t.type === 'receivable_collection')).reduce((s, t) => s + t.amount, 0);
export const debtRemaining = (debt: Debt, tx: Transaction[]) => Math.max(0, debt.principal_amount - debtPaid(debt, tx));
export const goalSaved = (goal: Goal, contributions: Contribution[]) => contributions.filter(c => !c.is_deleted && c.goal_id === goal.id).reduce((s, c) => s + c.amount, 0);
export function budgetSpent(budget: Budget, tx: Transaction[], range: [number, number]) {
  return flow(tx.filter(t => !budget.category_id || t.category_id === budget.category_id), ...range).expense;
}
export function categorySpending(categories: Category[], tx: Transaction[], from: number, to: number) {
  return categories.filter(c => c.type === 'expense' && !c.is_deleted).map(c => ({ ...c, amount: flow(tx.filter(t => t.category_id === c.id), from, to).expense })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
}
export function validateTransaction(t: Pick<Transaction, 'type' | 'amount' | 'account_id' | 'destination_account_id' | 'destination_amount' | 'category_id' | 'exchange_rate_ppm'>, accounts: Account[]) {
  if (!Number.isSafeInteger(t.amount) || t.amount <= 0) throw new Error('Amount must be greater than zero.');
  const source = accounts.find(a => a.id === t.account_id && !a.is_deleted);
  if (!source) throw new Error('Choose an active account.');
  if (t.type === 'transfer') {
    const destination = accounts.find(a => a.id === t.destination_account_id && !a.is_deleted);
    if (!destination || destination.id === source.id) throw new Error('Choose two different accounts.');
    if (!Number.isSafeInteger(t.destination_amount) || t.destination_amount <= 0) throw new Error('Enter a received amount.');
    if (source.currency === destination.currency && (t.amount !== t.destination_amount || t.exchange_rate_ppm !== 1_000_000)) throw new Error('Same-currency transfers must have equal amounts.');
    if (source.currency !== destination.currency && t.destination_amount !== convertMoney(t.amount, t.exchange_rate_ppm)) throw new Error('Received amount does not match the exchange rate.');
  } else if (['income', 'expense', 'refund'].includes(t.type) && !t.category_id) throw new Error('Choose a category.');
}
export const transactionSign = (type: TransactionType) => ['income', 'refund', 'receivable_collection'].includes(type) ? '+' : ['transfer', 'adjustment'].includes(type) ? '' : '−';
export function healthScore(_accounts: Account[], tx: Transaction[], goals: Goal[], contributions: Contribution[], budgets: Budget[], debts: Debt[], range: [number, number]) {
  const f = flow(tx, ...range);
  const savings = f.income ? Math.max(0, Math.min(100, f.savings)) : 0;
  const activeGoals = goals.filter(g => !g.is_deleted && g.status !== 'archived');
  const goalProgress = activeGoals.length ? activeGoals.reduce((s, g) => s + Math.min(1, goalSaved(g, contributions) / g.target_amount), 0) / activeGoals.length * 100 : 0;
  const activeBudgets = budgets.filter(b => !b.is_deleted && b.is_active);
  const budgetControl = activeBudgets.length ? activeBudgets.reduce((s, b) => s + (budgetSpent(b, tx, range) <= b.amount ? 100 : 0), 0) / activeBudgets.length : 0;
  const principal = debts.filter(d => !d.is_deleted && d.direction === 'payable').reduce((s, d) => s + d.principal_amount, 0);
  const debtProgress = principal ? debtPaidAll(debts, tx) / principal * 100 : 100;
  const parts = [f.income ? { value: savings, weight: 40, label: 'Savings rate' } : null, activeGoals.length ? { value: goalProgress, weight: 20, label: 'Goal progress' } : null, activeBudgets.length ? { value: budgetControl, weight: 25, label: 'Budget discipline' } : null, { value: Math.min(100, debtProgress), weight: 15, label: 'Debt repayment' }].filter((p): p is {value:number;weight:number;label:string} => !!p);
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  return { score: Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight), parts };
}
const debtPaidAll = (debts: Debt[], tx: Transaction[]) => debts.filter(d => !d.is_deleted && d.direction === 'payable').reduce((s, d) => s + debtPaid(d, tx), 0);
