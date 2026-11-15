'use client';
// Orientation before associates recruitment. Not an event: it never shows
// with the events. GUC students pick one of the days and the teams they're
// curious about, with their GUC student email as proof they're GUCians.
import { Instagram, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageTitle, SectionHeading, TxLabel } from '@/components/Brand';
import { Turnstile } from '@/components/Turnstile';
import { DataNotice } from '@/components/public/DataNotice';
import { Button, Check2, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { GUC_EMAIL_RE, GUC_ID_RE, orientationApi, type OrientationDay } from '@/lib/api/orientation';
import { INSTAGRAM_URL } from '@/lib/env';
import { fmtDate, fmtTime } from '@/lib/format';
import { TEAM_INFO, TEDX_FAQ } from '@/lib/orientation-content';
import { PageLoading } from '@/lib/useLoad';
import { usePublicData } from '@/lib/usePublicData';
import type { Division, Team } from '@/lib/types';


export default function OrientationPage() {
  const { data: d, error, loading, reload } = usePublicData(async () => {
    const [divisions, teams, up] = await Promise.all([api.listDivisions(), api.listTeams(), orientationApi.upcoming()]);
    return { divisions, teams, up };
  });
  if (!d && error) return <div className="public-container pt-s7"><DataNotice message={error} retry={reload} loading={loading} /></div>;
  if (!d) return <PageLoading />;
  const { divisions, teams, up } = d;

  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7 grid gap-s7">
      <PageTitle label="Before recruitment" title="Orientation" />
      <p className="body-lg text-ink-2 max-w-[640px] -mt-s4">
        Thinking of joining TEDxGUC as an associate? Come meet us first. We introduce TEDx, the club and every team, so you know where you fit before applications open.
      </p>

      {up ? (
        <div className="tx-card tx-card--red grid gap-s3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <div className="tx-label" style={{ color: '#fff' }}>For GUC students · {up.days.length} {up.days.length === 1 ? 'day' : 'days'}, pick one</div>
            <h2 className="h3 uppercase">{up.days.map((x) => fmtDate(x.starts_at)).join(' or ')}</h2>
          </div>
          <a href="#signup" className="tx-btn tx-btn--secondary" style={{ color: '#fff', borderColor: '#fff' }}>Save my spot</a>
        </div>
      ) : (
        <div className="tx-card tx-card--outline grid gap-s3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 className="h3 uppercase">No orientation scheduled</h2>
            <p className="text-ink-2">We hold one before every associates round. Follow us to hear when the next one is.</p>
          </div>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="tx-btn tx-btn--secondary"><Instagram aria-hidden="true" />Follow us</a>
        </div>
      )}

      <section className="grid gap-s4" aria-labelledby="faq-h">
        <SectionHeading><span id="faq-h">TEDx in five answers</span></SectionHeading>
        <div className="grid gap-s3 md:grid-cols-2">
          {TEDX_FAQ.map((f) => (
            <details key={f.q} className="tx-card orient-faq">
              <summary className="font-semibold cursor-pointer">{f.q}</summary>
              <p className="text-ink-2 mt-s2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="grid gap-s4" aria-labelledby="teams-h">
        <SectionHeading><span id="teams-h">The teams</span></SectionHeading>
        <p className="text-ink-2 max-w-[640px] -mt-s2">Eight teams in four divisions. Tick the ones you’re curious about when you sign up; you choose for real when you apply.</p>
        <div className="grid gap-s6 md:grid-cols-2">
          {divisions.map((dv) => (
            <div key={dv.id} className="grid gap-s2 content-start">
              <TxLabel>{dv.name}</TxLabel>
              <ul className="grid gap-s2">
                {teams.filter((t) => t.division_id === dv.id).map((t) => (
                  <li key={t.id} className="tx-card grid gap-s1">
                    <span className="font-semibold">{t.name}</span>
                    {TEAM_INFO[t.kind] && <p className="text-body-sm text-ink-2">{TEAM_INFO[t.kind]}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {up && (
        <section id="signup" className="grid gap-s4 scroll-mt-[88px]" aria-labelledby="signup-h">
          <TxLabel>Sign up</TxLabel>
          <SectionHeading><span id="signup-h">Save your spot</span></SectionHeading>
          <SignupForm days={up.days} full={up.counts.filter((c) => c.is_full).map((c) => c.day_id)} teams={teams} divisions={divisions} />
        </section>
      )}
    </div>
  );
}

function SignupForm({ days, full, teams, divisions }: { days: OrientationDay[]; full: string[]; teams: Team[]; divisions: Division[] }) {
  const [f, setF] = useState({ name: '', gucId: '', email: '', day: '' });
  const [picked, setPicked] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<OrientationDay | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]);
  const open = days.filter((x) => Date.parse(x.ends_at) >= Date.now());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (f.name.trim().length < 2) err.name = 'Enter your full name.';
    if (!GUC_ID_RE.test(f.gucId.trim())) err.gucId = 'Enter your GUC ID, like 58-12345.';
    if (!GUC_EMAIL_RE.test(f.email.trim())) err.email = 'Use your GUC student email, ending in @student.guc.edu.eg.';
    if (!f.day) err.day = 'Pick the day you’ll come.';
    if (!picked.length) err.teams = 'Pick at least one team.';
    if (!consent) err.consent = 'Tick the box to continue.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      await orientationApi.signUp({ day_id: f.day, name: f.name.trim(), guc_id: f.gucId.trim(), email: f.email.trim().toLowerCase(), team_ids: picked, consent, turnstile_token: token });
      setDone(days.find((x) => x.id === f.day) ?? null);
    } catch (x) {
      setToken(undefined); setAttempt((n) => n + 1);
      setErrors({ form: (x as Error).message });
    } finally { setBusy(false); }
  };

  if (done) return (
    <div className="tx-card grid gap-s3 max-w-[720px]" role="status">
      <h3 className="h3 uppercase">You’re in</h3>
      <p className="text-ink-2">See you on <b>{fmtDate(done.starts_at)}</b>, {fmtTime(done.starts_at)}–{fmtTime(done.ends_at)}{done.location ? <> at <b>{done.location}</b></> : null}. Bring your GUC ID. We sent the details to your GUC email.</p>
      <p className="text-body-sm text-ink-3">Applications open after orientation on the <Link href="/join" className="tx-link">Join</Link> page.</p>
    </div>
  );

  return (
    <form className="tx-card grid gap-s4 max-w-[720px]" onSubmit={submit} noValidate>
      <fieldset className={'grid gap-s2' + (errors.day ? ' tx-field is-error' : '')}>
        <legend className="tx-label mb-s2">Which day will you come?</legend>
        <div className="grid gap-s2 sm:grid-cols-2">
          {open.map((x) => {
            const isFull = full.includes(x.id);
            return (
              <label key={x.id} className={'orient-day' + (f.day === x.id ? ' is-on' : '') + (isFull ? ' is-full' : '')}>
                <input type="radio" name="day" value={x.id} checked={f.day === x.id} disabled={isFull} onChange={set('day')} className="sr-only" />
                <span className="font-semibold">{fmtDate(x.starts_at)}</span>
                <span className="text-body-sm text-ink-2">{fmtTime(x.starts_at)}–{fmtTime(x.ends_at)}{x.location ? ` · ${x.location}` : ''}</span>
                {isFull && <span className="text-caption text-ink-3">Full</span>}
              </label>
            );
          })}
        </div>
        {errors.day && <p className="tx-help" role="alert">{errors.day}</p>}
      </fieldset>
      <TextInput label="Full name" value={f.name} onChange={set('name')} autoComplete="name" error={errors.name} />
      <div className="grid gap-s4 sm:grid-cols-2">
        <TextInput label="GUC ID" value={f.gucId} onChange={set('gucId')} placeholder="58-12345" error={errors.gucId} />
        <TextInput label="GUC student email" type="email" value={f.email} onChange={set('email')} autoComplete="email" placeholder="name.surname@student.guc.edu.eg" error={errors.email} help="Only GUC student emails can sign up." />
      </div>
      <fieldset className={'grid gap-s2' + (errors.teams ? ' tx-field is-error' : '')}>
        <legend className="tx-label mb-s2">Teams you’re interested in (up to 3)</legend>
        {divisions.map((dv) => (
          <div key={dv.id} className="flex flex-wrap gap-s2">
            {teams.filter((t) => t.division_id === dv.id).map((t) => (
              <button type="button" key={t.id} aria-pressed={picked.includes(t.id)} onClick={() => toggle(t.id)}
                className={'orient-team' + (picked.includes(t.id) ? ' is-on' : '')} disabled={!picked.includes(t.id) && picked.length >= 3}>{t.name}</button>
            ))}
          </div>
        ))}
        {errors.teams && <p className="tx-help" role="alert">{errors.teams}</p>}
      </fieldset>
      <div className={errors.consent ? 'tx-field is-error' : ''}>
        <Check2 checked={consent} onChange={(e) => setConsent(e.target.checked)} label="TEDxGUC may keep these details to plan orientation and recruitment this season." />
        {errors.consent && <p className="tx-help mt-s1" role="alert">{errors.consent}</p>}
      </div>
      <Turnstile resetKey={attempt} onToken={setToken} />
      {errors.form && <p className="text-bad" role="alert">{errors.form}</p>}
      <Button type="submit" block loading={busy}><Send aria-hidden="true" />Save my spot</Button>
    </form>
  );
}
