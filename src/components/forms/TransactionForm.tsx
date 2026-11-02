import { useEffect, useLayoutEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Camera, ChevronDown, Delete, Repeat2, Keyboard, Check, X } from 'lucide-react';
import { useStore, uid, now } from '../../data/store';
import { useT, categoryLabel } from '../../lib/i18n';
import { parseMoney, decimalMoney, currencyInfo, convertMoney, parseRate, money } from '../../lib/money';
import type { Transaction, TransactionType } from '../../lib/types';
import { Button, Modal, Field, Segmented, CategoryIcon, Toggle } from '../ui';
import { remainingDebt } from '../../data/store';
import { Capacitor } from '@capacitor/core';
import { Camera as NativeCamera, CameraResultType, CameraSource } from '@capacitor/camera';
export const localDateInput = (timestamp = Date.now()) => { const d = new Date(timestamp); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const localTimeInput = (timestamp = Date.now()) => { const d = new Date(timestamp); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const schema = z.object({ amount: z.string().min(1, 'Enter an amount.'), account_id: z.string().min(1, 'Choose an account.'), destination_account_id: z.string(), category_id: z.string(), date: z.string().min(1), time: z.string().min(1), description: z.string().max(500), payee: z.string().max(120), tags: z.string().max(300), rate: z.string(), destination_amount: z.string(), recurring: z.boolean(), frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']), adjustment_sign: z.enum(['1', '-1']) });
type Values = z.infer<typeof schema>;
export function TransactionForm({ open, onClose, initialType = 'expense', editing, duplicate = false, presetAccount, presetDebt, presetCategory }: { open: boolean; onClose: () => void; initialType?: TransactionType; editing?: Transaction; duplicate?: boolean; presetAccount?: string; presetDebt?: string; presetCategory?: string }) {
  const t = useT(), data = useStore(s => s.data)!, notify = useStore(s => s.notify);
  const [type, setType] = useState<TransactionType>(initialType), [error, setError] = useState(''), [saving, setSaving] = useState(false), [keypad, setKeypad] = useState(false), [receipt, setReceipt] = useState(''), [tagInput, setTagInput] = useState(''), [tags, setTags] = useState<string[]>([]);
  const defaults = (): Values => ({ amount: editing ? decimalMoney(editing.amount, editing.currency) : '', account_id: editing?.account_id ?? presetAccount ?? data.accounts.find(a => !a.is_archived)?.id ?? '', destination_account_id: editing?.destination_account_id ?? '', category_id: editing?.category_id ?? presetCategory ?? '', date: localDateInput(editing && !duplicate ? editing.transaction_date : Date.now()), time: localTimeInput(editing && !duplicate ? editing.transaction_date : Date.now()), description: editing?.description ?? '', payee: editing?.payee ?? '', tags: '', rate: editing && editing.exchange_rate_ppm !== 1000000 ? decimalMoney(Math.round(editing.exchange_rate_ppm / 100), 'USD') : '1', destination_amount: editing ? decimalMoney(editing.destination_amount) : '', recurring: !!editing?.is_recurring, frequency: (editing?.recurrence_rule ? JSON.parse(editing.recurrence_rule).frequency : 'monthly'), adjustment_sign: editing?.adjustment_sign === -1 ? '-1' : '1' });
  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() });
  useLayoutEffect(() => { if (open) { const initial = editing?.type ?? (presetDebt ? (data.debts.find(d => d.id === presetDebt)?.direction === 'payable' ? 'debt_payment' : 'receivable_collection') : initialType); setType(initial); reset(defaults()); setError(''); setReceipt(editing?.attachment_url ?? ''); setTags(editing ? JSON.parse(editing.tags || '[]') : []); setKeypad(false); } }, [open, editing?.id, initialType, presetAccount, presetDebt]);
  const values = watch();
  const source = data.accounts.find(a => a.id === values.account_id), destination = data.accounts.find(a => a.id === values.destination_account_id);
  const currency = source?.currency ?? data.profile.base_currency;
  const categories = data.categories.filter(c => c.type === (type === 'income' ? 'income' : 'expense') && !c.is_archived);
  const linkedDebt = data.debts.find(d => d.id === (presetDebt ?? editing?.linked_debt_id));
  const isPayment = ['debt_payment', 'receivable_collection'].includes(type);
  const accounts = data.accounts.filter(a => !a.is_archived && (!linkedDebt || a.currency === linkedDebt.currency));
  useEffect(() => { if (type === 'transfer' && source && destination && values.rate) { try { setValue('destination_amount', decimalMoney(convertMoney(parseMoney(values.amount || '0', source.currency), parseRate(values.rate)), destination.currency)); } catch { /* incomplete input is validated on submit */ } } }, [values.rate, values.amount, source?.currency, destination?.currency, type, setValue]);
  const press = (key: string) => { let current = watch('amount'); if (key === 'del') current = current.slice(0, -1); else if (key === '.' && !current.includes('.')) current = (current || '0') + '.'; else if (key !== '.') current = (current === '0' ? '' : current) + key; setValue('amount', current, { shouldValidate: false }); };
  const attach = async () => {
    try {
      if (Capacitor.isNativePlatform()) { const image = await NativeCamera.getPhoto({ quality: 65, resultType: CameraResultType.DataUrl, source: CameraSource.Prompt, width: 1200 }); setReceipt(image.dataUrl ?? ''); }
      else { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = async () => { const file = input.files?.[0]; if (!file) return; if (file.size > 8_000_000) throw new Error('Choose an image smaller than 8 MB.'); const reader = new FileReader(); reader.onload = () => setReceipt(String(reader.result)); reader.readAsDataURL(file); }; input.click(); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Camera unavailable.'); }
  };
  const submit = async (v: Values) => {
    setError(''); setSaving(true);
    try {
      const amount = parseMoney(v.amount, currency);
      if (amount <= 0) throw new Error('Amount must be greater than zero.');
      const sameCurrency = !destination || source?.currency === destination.currency;
      const rate = type === 'transfer' && !sameCurrency ? parseRate(v.rate) : 1_000_000;
      const destinationAmount = type === 'transfer' ? sameCurrency ? amount : convertMoney(amount, rate) : 0;
      if (type === 'transfer' && destination && parseMoney(v.destination_amount, destination.currency) !== destinationAmount) throw new Error('The received amount must match the exchange rate.');
      const time = now();
      const description = v.description;
      const row: Transaction = { id: editing && !duplicate ? editing.id : uid(), user_id: data.profile.id, type, amount, destination_amount: destinationAmount, currency, account_id: v.account_id, destination_account_id: type === 'transfer' ? v.destination_account_id : null, category_id: ['income','expense','refund'].includes(type) ? v.category_id : null, payee: linkedDebt?.party_name ?? v.payee, description, transaction_date: new Date(`${v.date}T${v.time}:00`).getTime(), tags: JSON.stringify(tags), attachment_url: receipt, exchange_rate_ppm: rate, adjustment_sign: type === 'adjustment' && v.adjustment_sign === '-1' ? -1 : 1, linked_debt_id: linkedDebt?.id ?? null, linked_goal_id: editing?.linked_goal_id ?? null, is_recurring: v.recurring ? 1 : 0, recurrence_rule: v.recurring ? JSON.stringify({ frequency: v.frequency, interval: 1 }) : '', is_deleted: 0, created_at: editing && !duplicate ? editing.created_at : time, updated_at: time };
      await useStore.getState().saveTransaction(row); notify(editing && !duplicate ? 'Changes saved.' : 'Transaction saved.'); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save transaction.'); } finally { setSaving(false); }
  };
  return <Modal open={open} onClose={onClose} title={editing && !duplicate ? 'Edit' : isPayment ? linkedDebt?.direction === 'payable' ? 'Record payment' : 'Record collection' : 'Add transaction'} wide>
    <form onSubmit={handleSubmit(submit)} className="transaction-form">
      {!isPayment && <Segmented value={type} onChange={v => { setType(v); setValue('category_id', ''); }} options={[{ value: 'income' as TransactionType, label: 'Income', icon: <ArrowDownLeft size={16}/> }, { value: 'expense' as TransactionType, label: 'Expense', icon: <ArrowUpRight size={16}/> }, { value: 'transfer' as TransactionType, label: 'Transfer', icon: <ArrowLeftRight size={16}/> }]} />}
      {isPayment && linkedDebt && <div className="info-banner"><HandCoinsIcon/>{linkedDebt.party_name}<strong>{money(remainingDebt(linkedDebt.id), linkedDebt.currency, data.profile.language)}</strong></div>}
      <div className={`amount-hero amount-${type}`}><span>{t('Amount')}</span><div className="amount-display"><span>{currencyInfo(currency).symbol}</span><input {...register('amount')} inputMode="decimal" autoComplete="off" placeholder="0.00" aria-label={t('Amount')} /></div><button type="button" className="keypad-toggle" aria-label={t('Show amount keypad')} aria-expanded={keypad} onClick={() => setKeypad(!keypad)}><Keyboard size={18}/></button><small>{currency} <ChevronDown size={12}/><span>·</span>{t('Saved on this device')}</small></div>
      {keypad && <div className="numeric-keypad">{['1','2','3','4','5','6','7','8','9','.','0','del'].map(key => <button type="button" key={key} onClick={() => press(key)} aria-label={key === 'del' ? 'Backspace' : key}>{key === 'del' ? <Delete size={22}/> : key}</button>)}<button type="button" className="keypad-done" onClick={() => setKeypad(false)}><Check size={18}/>{t('Done')}</button></div>}
      {errors.amount && <p className="form-error">{errors.amount.message}</p>}
      {!accounts.length && <div className="info-banner">{t('Start by adding your first account.')}</div>}
      {['income','expense','refund'].includes(type) && <><div className="field-label mb-3">{t('Category')} <span className="required">*</span></div><Controller name="category_id" control={control} render={({ field }) => <div className="category-picker">{categories.map(c => <button type="button" key={c.id} className={field.value === c.id ? 'selected' : ''} onClick={() => field.onChange(c.id)}><CategoryIcon icon={c.icon} color={c.color}/><span>{categoryLabel(c.name, data.profile.language)}</span>{field.value === c.id && <Check size={12} className="category-check"/>}</button>)}</div>}/>{errors.category_id && <p className="form-error">{t('Choose a category.')}</p>}</>}
      <div className="form-grid"><Field label={type === 'transfer' ? 'From account' : 'Account'} required><Controller name="account_id" control={control} render={({field}) => <select name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref}><option value="">{t('Select')}</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select>}/></Field>{type === 'transfer' ? <Field label="To account" required><Controller name="destination_account_id" control={control} render={({field}) => <select name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref}><option value="">{t('Select')}</option>{data.accounts.filter(a => !a.is_archived && a.id !== values.account_id).map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select>}/></Field> : <Field label="Payee / merchant"><input {...register('payee')} placeholder={t('Optional')}/></Field>}</div>
      {type === 'transfer' && source && destination && source.currency !== destination.currency && <div className="form-grid fx-fields"><Field label="Exchange rate" hint={`1 ${source.currency} → ${destination.currency}`}><input {...register('rate')} inputMode="decimal"/></Field><Field label="They receive"><input {...register('destination_amount')} readOnly/></Field></div>}
      <div className="form-grid"><Field label="Date"><input type="date" {...register('date')}/></Field><Field label="Time"><input type="time" {...register('time')}/></Field></div>
      <Field label="Description"><input {...register('description')} placeholder={t('Optional')} maxLength={500}/></Field>
      <div className="field"><span className="field-label">{t('Tags')}</span><div className="tag-input">{tags.map(tag => <span key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => setTags(tags.filter(x => x !== tag))}><X size={12}/></button></span>)}<input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder={t('Optional')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const tag = tagInput.trim().replace(/,/g,''); if (tag && !tags.includes(tag)) setTags([...tags, tag].slice(0, 10)); setTagInput(''); } }}/></div></div>
      <div className="form-extras"><button type="button" className="attachment-button" onClick={attach}><Camera size={18}/>{t(receipt ? 'Change receipt' : 'Attach receipt')}</button>{receipt && <div className="receipt-thumbnail"><img src={receipt} alt="Receipt attachment"/><button type="button" onClick={() => setReceipt('')} aria-label="Remove receipt"><X size={14}/></button></div>}</div>
      {!isPayment && <><Toggle checked={values.recurring} onChange={v => setValue('recurring', v)} label="Recurring transaction" description="Recorded when you open the app on or after the due date."/>{values.recurring && <Field label="Frequency"><select {...register('frequency')}><option value="daily">{t('Daily')}</option><option value="weekly">{t('Weekly')}</option><option value="monthly">{t('Monthly')}</option><option value="yearly">{t('Yearly')}</option></select></Field>}</>}
      {type === 'adjustment' && <Field label="Adjustment"><select {...register('adjustment_sign')}><option value="1">{t('Credit')}</option><option value="-1">{t('Debit')}</option></select></Field>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button type="submit" loading={saving} disabled={!accounts.length}><Check size={18}/>{t(editing && !duplicate ? 'Save changes' : 'Save transaction')}</Button></div>
    </form>
  </Modal>;
}
function HandCoinsIcon() { return <Repeat2 size={18}/>; }
