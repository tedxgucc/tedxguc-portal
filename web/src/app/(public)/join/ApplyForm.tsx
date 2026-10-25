'use client';
// Guest application (FR-4.2), kept short: name, GUC ID, email, phone,
// major, first-choice team and second preference. No account needed.
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Turnstile } from '@/components/Turnstile';
import { useToast } from '@/components/Toast';
import { Button, Check2, Select, TextArea, TextInput } from '@/components/ui';
import { recruitmentApi } from '@/lib/api/phase2b';
import { GUC_MAJORS } from '@/lib/recruitment';
import type { Cycle, Position, Team } from '@/lib/types';

export function ApplyForm({ cycle, positions, teams }: { cycle: Cycle; positions: Position[]; teams: Team[] }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ name: '', gucId: '', email: '', phone: '+20 ', major: '', first: '', second: '' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '';
  const open = positions.filter((p) => p.is_open);
  const choices = [f.first, f.second].filter(Boolean);
  // Teams can still add their own questions; most rounds have none.
  const questions = choices.flatMap((t) => open.find((p) => p.team_id === t)?.questions.map((q) => ({ ...q, team: t })) ?? []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.name.trim()) err.name = 'Enter your full name.';
    if (!/^\d{1,3}-\d{3,6}$/.test(f.gucId.trim())) err.gucId = 'Enter your GUC ID, like 49-12345.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) err.email = 'Enter a valid email address.';
    if (f.phone.replace(/\D/g, '').length < 10) err.phone = 'Enter your phone number.';
    if (!f.major) err.major = 'Pick your major.';
    if (!f.first) err.first = 'Pick the team you want most.';
    if (!f.second) err.second = 'Pick a second preference.';
    for (const q of questions) if (q.required && !answers[q.id]?.trim()) err[q.id] = 'This one is required.';
    if (!consent) err.consent = 'Tick the box to continue.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      const res = await recruitmentApi.apply({
        cycle_id: cycle.id, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(),
        team_ids: f.second === 'none' ? [f.first] : [f.first, f.second],
        answers: { ...answers, guc_id: f.gucId.trim(), major: f.major }, cv_path: null, consent, turnstile_token: token,
      });
      router.push(`/join/status?t=${res.status_token}&new=1`);
    } catch (x) {
      toast('bad', "That didn't send.", (x as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="tx-card grid gap-s4 max-w-[720px]" onSubmit={submit} noValidate>
      <TextInput label="Full name" value={f.name} onChange={set('name')} autoComplete="name" error={errors.name} />
      <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
        <TextInput label="GUC ID" value={f.gucId} onChange={set('gucId')} placeholder="49-12345" inputMode="numeric" error={errors.gucId} />
        <Select label="Major" value={f.major} onChange={set('major')} error={errors.major}>
          <option value="">Choose</option>
          {GUC_MAJORS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <TextInput label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" error={errors.email} help="Updates and your private status link come here." />
        <TextInput label="Phone / WhatsApp" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" error={errors.phone} />
        <Select label="First choice team" value={f.first} error={errors.first} onChange={(e) => setF((x) => ({ ...x, first: e.target.value, second: x.second === e.target.value ? '' : x.second }))}>
          <option value="">Choose</option>
          {open.map((p) => <option key={p.team_id} value={p.team_id}>{teamName(p.team_id)}</option>)}
        </Select>
        <Select label="Second preference" value={f.second} onChange={set('second')} error={errors.second} disabled={!f.first}>
          <option value="">Choose</option>
          {open.filter((p) => p.team_id !== f.first).map((p) => <option key={p.team_id} value={p.team_id}>{teamName(p.team_id)}</option>)}
          <option value="none">No second preference</option>
        </Select>
      </div>
      {f.first && open.find((p) => p.team_id === f.first)?.description && (
        <p className="text-body-sm text-ink-2">{teamName(f.first)}: {open.find((p) => p.team_id === f.first)?.description}</p>
      )}
      {questions.map((q) => {
        const label = `${teamName(q.team)}: ${q.label}${q.required ? '' : ' (optional)'}`;
        const setA = (v: string) => setAnswers((a) => ({ ...a, [q.id]: v }));
        return q.kind === 'textarea'
          ? <TextArea key={q.id} label={label} value={answers[q.id] ?? ''} onChange={(e) => setA(e.target.value)} error={errors[q.id]} rows={3} />
          : <TextInput key={q.id} label={label} type={q.kind === 'url' ? 'url' : 'text'} value={answers[q.id] ?? ''} onChange={(e) => setA(e.target.value)} error={errors[q.id]} />;
      })}
      <div className={errors.consent ? 'tx-field is-error' : ''}>
        <Check2 checked={consent} onChange={(e) => setConsent(e.target.checked)}
          label={<>TEDxGUC may keep my application to review it. It’s deleted 6 months after this round unless I join. <Link href="/privacy" className="tx-link">Privacy notice</Link></>} />
        {errors.consent && <p className="tx-help mt-s1" role="alert">{errors.consent}</p>}
      </div>
      <Turnstile onToken={setToken} />
      <Button type="submit" block loading={busy}><Send aria-hidden="true" />Send application</Button>
    </form>
  );
}
