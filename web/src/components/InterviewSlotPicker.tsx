'use client';
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { cairoDay, fmtDate, fmtTime } from '@/lib/format';
import type { SlotView } from '@/lib/types';

const monthDate = (month: string) => new Date(`${month}-01T12:00:00Z`);
const moveMonth = (month: string, amount: number) => {
  const date = monthDate(month);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1, 12)).toISOString().slice(0, 7);
};

export function InterviewSlotPicker({ slots, disabled, rescheduling, onChoose }: {
  slots: SlotView[]; disabled: boolean; rescheduling: boolean; onChoose: (slot: SlotView) => void;
}) {
  const id = useId();
  const byDay = useMemo(() => {
    const days = new Map<string, SlotView[]>();
    for (const slot of [...slots].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))) {
      const day = cairoDay(slot.starts_at);
      days.set(day, [...(days.get(day) ?? []), slot]);
    }
    return days;
  }, [slots]);
  const availableDays = [...byDay.keys()].sort();
  const firstMonth = (availableDays[0] ?? cairoDay(new Date())).slice(0, 7);
  const lastMonth = (availableDays.at(-1) ?? cairoDay(new Date())).slice(0, 7);
  const [month, setMonth] = useState(firstMonth);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const shownMonth = month < firstMonth || month > lastMonth ? firstMonth : month;
  const start = monthDate(shownMonth);
  const offset = (start.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i - offset + 1);
  const selected = selectedDay && selectedDay.startsWith(`${shownMonth}-`) && byDay.has(selectedDay) ? selectedDay : null;
  const today = cairoDay(new Date());

  return <div className="grid gap-s4">
    <div className="tx-card grid gap-s4">
      <div className="flex items-center justify-between gap-s2">
        <button type="button" className="tx-iconbtn" aria-label="Previous month" disabled={disabled || shownMonth <= firstMonth} onClick={() => setMonth(moveMonth(shownMonth, -1))}><ChevronLeft size={20} /></button>
        <h3 className="font-semibold text-center" aria-live="polite">{start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
        <button type="button" className="tx-iconbtn" aria-label="Next month" disabled={disabled || shownMonth >= lastMonth} onClick={() => setMonth(moveMonth(shownMonth, 1))}><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 gap-s1 text-center">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day} className="text-caption text-ink-3 pb-s2">{day}</span>)}
        {cells.map((day, i) => {
          if (day < 1 || day > count) return <span key={`blank-${i}`} aria-hidden="true" />;
          const date = `${shownMonth}-${String(day).padStart(2, '0')}`;
          const available = byDay.has(date);
          const active = selected === date;
          return <button key={date} type="button" disabled={disabled || !available} aria-pressed={active}
            aria-current={date === today ? 'date' : undefined} aria-controls={`${id}-times`}
            aria-label={`${fmtDate(`${date}T12:00:00Z`, { year: true })}, ${available ? `${byDay.get(date)!.length} available times` : 'unavailable'}`}
            onClick={() => setSelectedDay(date)}
            style={available && !active ? { backgroundColor: 'color-mix(in srgb, var(--accent) 10%, var(--surface-1))' } : undefined}
            className={`min-h-[42px] sm:min-h-[48px] border font-semibold text-body-sm transition-colors ${active ? 'bg-accent text-on-accent border-accent' : available ? 'text-accent border-accent hover:underline' : 'border-transparent text-ink-3 opacity-40'} disabled:cursor-default`}>
            {day}
          </button>;
        })}
      </div>
      <p className="text-caption text-ink-3 flex items-center gap-s2"><span className="inline-block w-[10px] h-[10px] bg-accent" aria-hidden="true" />Red days have available interviews. All times are in Cairo.</p>
    </div>
    <div id={`${id}-times`} className="grid gap-s3" aria-live="polite">
      {selected ? <>
        <h3 className="h4">{fmtDate(`${selected}T12:00:00Z`, { year: true })}</h3>
        <ul className="grid gap-s2">
          {byDay.get(selected)!.map((slot) => <li key={slot.slot_id} className="tx-card flex flex-wrap items-center gap-s3" style={{ padding: '12px 16px' }}>
            <span className="flex-1 min-w-0"><span className="font-semibold block">{fmtTime(slot.starts_at)} – {fmtTime(slot.ends_at)}</span><span className="text-caption text-ink-3">{slot.team}{slot.location ? ` · ${slot.location}` : ''}</span></span>
            <Button small disabled={disabled} onClick={() => onChoose(slot)}><CalendarCheck size={16} aria-hidden="true" />{rescheduling ? 'Choose new time' : 'Choose time'}</Button>
          </li>)}
        </ul>
      </> : <p className="text-body-sm text-ink-2">Select a red day to see its available times.</p>}
    </div>
  </div>;
}
