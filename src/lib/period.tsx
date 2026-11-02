import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Segmented } from '../components/ui';
import { useT } from './i18n';
import { useStore } from '../data/store';
export type Period = 'week' | 'month' | 'year' | 'custom';
export function usePeriod() {
  const [period, setPeriod] = useState<Period>('month'), [offset, setOffset] = useState(0), [customFrom, setCustomFrom] = useState(''), [customTo, setCustomTo] = useState('');
  const now = new Date(); let from: Date, to: Date;
  if (period === 'week') { const day = (now.getDay() + 6) % 7; from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + offset * 7); to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7); }
  else if (period === 'year') { from = new Date(now.getFullYear() + offset, 0, 1); to = new Date(now.getFullYear() + offset + 1, 0, 1); }
  else if (period === 'custom') { from = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1); to = customTo ? new Date(customTo + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); to.setDate(to.getDate() + (customTo ? 1 : 0)); }
  else { from = new Date(now.getFullYear(), now.getMonth() + offset, 1); to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1); }
  const length = to.getTime() - from.getTime();
  const previous: [number, number] = [from.getTime() - length, from.getTime()];
  return { period, setPeriod: (p: Period) => { setPeriod(p); setOffset(0); }, offset, setOffset, customFrom, setCustomFrom, customTo, setCustomTo, from: from.getTime(), to: to.getTime(), previous, label: `${from.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${new Date(to.getTime() - 1).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}` };
}
export function PeriodControl({ control }: { control: ReturnType<typeof usePeriod> }) {
  const t = useT(), lang = useStore(s => s.data?.profile.language);
  return <div className="period-control"><Segmented value={control.period} onChange={control.setPeriod} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'custom', label: 'Custom' }]}/><div className="period-range">{control.period !== 'custom' ? <><button className="icon-button" onClick={() => control.setOffset(control.offset - 1)} aria-label="Previous period"><ChevronLeft size={16}/></button><span><CalendarDays size={14}/>{lang === 'bn' ? new Date(control.from).toLocaleDateString('bn-BD') + ' – ' + new Date(control.to - 1).toLocaleDateString('bn-BD') : control.label}</span><button className="icon-button" disabled={control.offset >= 0} onClick={() => control.setOffset(control.offset + 1)} aria-label="Next period"><ChevronRight size={16}/></button></> : <><label>{t('From date')}<input type="date" value={control.customFrom} onChange={e => control.setCustomFrom(e.target.value)}/></label><label>{t('To date')}<input type="date" value={control.customTo} min={control.customFrom} onChange={e => control.setCustomTo(e.target.value)}/></label></>}</div></div>;
}
