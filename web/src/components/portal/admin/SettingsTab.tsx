'use client';
// Club settings (FR-14.1), Chairman only. Every rule the portal applies
// automatically lives here, so the Chairman can change it without a developer.
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SectionHeading } from '@/components/Brand';
import { useToast } from '@/components/Toast';
import { Button, Select, Skeleton, TextInput } from '@/components/ui';
import { adminApi, type Settings } from '@/lib/api/admin';

type Level = { level: number; action: 'warn_member' | 'notify_curator' };
type NumKey = { key: string; label: string; help: string; min?: number; step?: number; suffix?: string };

const attendance: NumKey[] = [
  { key: 'lates_per_absence', label: 'Lates that count as one absence', help: 'Two lates = one absence by default.', min: 1 },
  { key: 'excuse_window_hours', label: 'Excuse window (hours)', help: 'How long after a meeting a member can still send an excuse.', min: 1 },
  { key: 'attendance_edit_window_hours', label: 'Attendance edit window (hours)', help: 'How long the person who took attendance can still fix it.', min: 1 },
];
const money: NumKey[] = [
  { key: 'expense_chairman_limit_egp', label: 'Chairman approval above (EGP)', help: 'Expense requests above this also need the Chairman.', min: 0, step: 100 },
  { key: 'vat_rate', label: 'VAT rate (%)', help: 'Taken off sponsor deposits to get the net amount.', min: 0, step: 0.5, suffix: '%' },
  { key: 'cash_hold_days', label: 'Cash order hold (days)', help: 'How long a cash package order waits for payment at the booth.', min: 1 },
  { key: 'proof_hold_hours', label: 'Transfer proof hold (hours)', help: 'How long a transfer order waits for its proof of payment.', min: 1 },
];
const tasks: NumKey[] = [
  { key: 'task_reminder_hours', label: 'Task reminder (hours before deadline)', help: 'Assignees get a reminder this long before a task is due.', min: 1 },
];

export function SettingsTab() {
  const toast = useToast();
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getSettings().then((s) => { setSaved(s); setDraft(s); }).catch(() => setSaved({}));
  }, []);
  if (!saved) return <Skeleton h={320} />;

  // VAT is stored as a fraction (0.14) and shown as a percent (14).
  const shown = (k: NumKey) => {
    const v = draft[k.key];
    if (v === undefined || v === null || v === '') return '';
    return k.key === 'vat_rate' ? String(Math.round(Number(v) * 10000) / 100) : String(v);
  };
  const setNum = (k: NumKey, raw: string) => setDraft({ ...draft, [k.key]: raw === '' ? '' : k.key === 'vat_rate' ? Number(raw) / 100 : Number(raw) });
  const levels = (draft.absence_levels as Level[] | undefined) ?? [];
  const setLevels = (l: Level[]) => setDraft({ ...draft, absence_levels: l });

  const save = async (group: string, keys: string[]) => {
    const changed = keys.filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k]));
    if (!changed.length) { toast('warn', 'Nothing changed'); return; }
    for (const k of changed) {
      const v = draft[k];
      if (typeof v === 'number' && (Number.isNaN(v) || v < 0)) { toast('bad', 'Check the numbers', 'Values can’t be empty or negative.'); return; }
      if (v === '') { toast('bad', 'Fill every field', 'Empty values aren’t allowed.'); return; }
    }
    setBusy(group);
    try {
      for (const k of changed) await adminApi.saveSetting(k, draft[k]);
      setSaved({ ...saved, ...Object.fromEntries(changed.map((k) => [k, draft[k]])) });
      toast('ok', 'Settings saved', `${changed.length} ${changed.length === 1 ? 'change' : 'changes'}, logged in the audit log.`);
    } catch (e) {
      toast('bad', 'Couldn’t save', (e as Error).message);
    } finally { setBusy(null); }
  };

  const numFields = (list: NumKey[]) => (
    <div className="grid gap-s4 md:grid-cols-2">
      {list.map((k) => (
        <TextInput key={k.key} label={k.label} help={k.help} type="number" inputMode="decimal" min={k.min} step={k.step ?? 1}
          value={shown(k)} onChange={(e) => setNum(k, e.target.value)} />
      ))}
    </div>
  );

  return (
    <div className="grid gap-s7 max-w-[860px]">

      <section className="grid gap-s4">
        <SectionHeading>Money</SectionHeading>
        {numFields(money)}
        <div className="grid gap-s4 md:grid-cols-2">
          <TextInput label="InstaPay link" help="Shown to buyers who pay for packages by InstaPay." type="url" value={String(draft.instapay_link ?? '')}
            onChange={(e) => setDraft({ ...draft, instapay_link: e.target.value })} />
          <TextInput label="Telda link" help="Shown to buyers who pay by Telda." type="url" value={String(draft.telda_link ?? '')}
            onChange={(e) => setDraft({ ...draft, telda_link: e.target.value })} />
        </div>
        <div><Button loading={busy === 'money'} onClick={() => save('money', [...money.map((k) => k.key), 'instapay_link', 'telda_link'])}>Save money rules</Button></div>
      </section>

      <section className="grid gap-s4">
        <SectionHeading>Tasks</SectionHeading>
        {numFields(tasks)}
        <div><Button loading={busy === 'tasks'} onClick={() => save('tasks', tasks.map((k) => k.key))}>Save task rules</Button></div>
      </section>
    </div>
  );
}
