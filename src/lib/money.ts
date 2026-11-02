import { currencies } from './types';

export const MAX_MONEY = 999_999_999_999_99;
export const currencyInfo = (code: string) => currencies.find(c => c.code === code) ?? currencies[0];
/** Decimal strings -> integer minor units. No parseFloat or binary money arithmetic. */
export function parseMoney(input: string, currency = 'BDT'): number {
  const s = input.trim().replace(/,/g, '');
  const decimals = currencyInfo(currency).decimals;
  const regex = decimals ? new RegExp(`^-?\\d+(?:\\.\\d{1,${decimals}})?$`) : /^-?\d+$/;
  if (!regex.test(s)) throw new Error(decimals ? `Enter a valid amount with at most ${decimals} decimal places.` : 'This currency does not use decimal amounts.');
  const negative = s.startsWith('-');
  const [whole, fraction = ''] = s.replace('-', '').split('.');
  const value = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (value > BigInt(MAX_MONEY)) throw new Error('Amount is too large.');
  return Number(value) * (negative ? -1 : 1);
}
export function decimalMoney(amount: number, currency = 'BDT'): string {
  if (!Number.isSafeInteger(amount)) throw new Error('Money must be a safe integer.');
  const d = currencyInfo(currency).decimals;
  const base = 10 ** d;
  const n = BigInt(Math.abs(amount));
  return `${amount < 0 ? '-' : ''}${n / BigInt(base)}${d ? '.' + (n % BigInt(base)).toString().padStart(d, '0') : ''}`;
}
export function money(amount: number, currency = 'BDT', locale = 'en', hidden = false): string {
  if (hidden) return '••••••';
  const tag = locale === 'bn' ? 'bn-BD' : 'en-US', d = currencyInfo(currency).decimals;
  const nf = new Intl.NumberFormat(tag, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: d });
  const text = decimalMoney(Math.abs(amount), currency), [whole, fraction = ''] = text.split('.');
  const digits = Array.from({ length: 10 }, (_, i) => new Intl.NumberFormat(tag).format(BigInt(i)));
  const localizedFraction = fraction.split('').map(c => digits[Number(c)]).join('');
  const grouped = new Intl.NumberFormat(tag, { useGrouping: true }).format(BigInt(whole));
  const parts = nf.formatToParts(0).map(part => part.type === 'integer' ? grouped : part.type === 'fraction' ? localizedFraction : part.type === 'decimal' ? (d ? part.value : '') : part.value).join('');
  return amount < 0 ? '-' + parts : parts;
}
export function compactMoney(amount: number, currency = 'BDT'): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(amount / 10 ** currencyInfo(currency).decimals) + ' ' + currency;
}
/** Rate is an integer in parts per million; result uses exact half-up rounding. */
export function convertMoney(amount: number, ratePpm: number): number {
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(ratePpm) || ratePpm <= 0) throw new Error('Invalid conversion.');
  const result = (BigInt(amount) * BigInt(ratePpm) + 500_000n) / 1_000_000n;
  if (result > BigInt(MAX_MONEY)) throw new Error('Converted amount is too large.');
  return Number(result);
}
export function parseRate(input: string): number {
  const n = parseMoney(input, 'USD') * 10_000;
  if (n <= 0 || n > 1_000_000_000_000) throw new Error('Exchange rate must be positive and at most 1,000,000.');
  return n;
}
export const rateDecimal = (ppm: number) => decimalMoney(ppm / 100, 'USD');
export const percent = (part: number, total: number) => total > 0 ? Math.min(100, Math.round(part / total * 100)) : 0;
