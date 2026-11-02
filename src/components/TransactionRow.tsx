import { Link } from 'react-router-dom';
import { ChevronRight, ArrowLeftRight } from 'lucide-react';
import { useStore } from '../data/store';
import { transactionSign } from '../lib/finance';
import { money as formatMoney } from '../lib/money';
import { useT, categoryLabel } from '../lib/i18n';
import type { Transaction } from '../lib/types';
import { CategoryIcon } from './ui';
export function TransactionRow({ transaction: tx, compact = false }: { transaction: Transaction; compact?: boolean }) {
  const data = useStore(s => s.data)!, t = useT(), lang = data.profile.language;
  const category = data.categories.find(c => c.id === tx.category_id), account = data.accounts.find(a => a.id === tx.account_id);
  const typeLabel = tx.type === 'debt_payment' ? 'Debt payment' : tx.type === 'receivable_collection' ? 'Receivable collection' : tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
  const title = tx.description?.replace('[debit] ', '') || tx.payee || (category ? categoryLabel(category.name, lang) : t(typeLabel));
  const date = new Date(tx.transaction_date);
  return <Link to={`/transactions/${tx.id}`} className={`transaction-row ${compact ? 'compact' : ''}`}><CategoryIcon icon={tx.type === 'transfer' ? 'transfer' : category?.icon ?? (tx.type === 'income' ? 'income' : 'expense')} color={tx.type === 'transfer' ? '#3781FC' : category?.color ?? (tx.type === 'income' ? '#10B981' : '#8EB69B')}/><div className="transaction-info"><strong>{title}</strong><span>{category ? categoryLabel(category.name, lang) : t(typeLabel)}<i>·</i>{account?.name}</span></div><div className={`transaction-amount tx-${tx.type}`}><strong>{transactionSign(tx.type)}{formatMoney(tx.amount, tx.currency, lang, !!data.profile.hide_balances)}</strong><span>{date.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en', { hour: '2-digit', minute: '2-digit' })}{tx.is_recurring ? <ArrowLeftRight size={11}/> : null}</span></div><ChevronRight size={15} className="row-chevron"/></Link>;
}
