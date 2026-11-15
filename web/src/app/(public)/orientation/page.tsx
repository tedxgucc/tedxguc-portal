'use client';
// Orientation before associates recruitment. Not an event: it never shows
// with the events. GUC students pick one of the days and the team they're
// most curious about, with their GUC student email as proof they're GUCians.
import { Instagram, Send } from 'lucide-react';
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
      <div className="grid gap-s3">
        <PageTitle label={up ? `For GUC students · ${up.days.map((x) => fmtDate(x.starts_at)).join(' or ')}` : 'For GUC students'} title="Orientation" />
        <p className="body-lg text-ink-2 max-w-[640px]">
          Curious about joining TEDxGUC? Come meet us. We introduce TEDx, the club and every team, and answer all your questions.
        </p>
      </div>

      {up ? (
        <section id="signup" aria-label="Sign up for orientation">
          <SignupForm days={up.days} full={up.counts.filter((c) => c.is_full).map((c) => c.day_id)} teams={teams} divisions={divisions} />
        </section>
      ) : (
        <div className="tx-card tx-card--outline grid gap-s3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 className="h3 uppercase">No orientation scheduled</h2>
            <p className="text-ink-2">Follow us to hear when the next one is.</p>
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
        <p className="text-ink-2 max-w-[640px] -mt-s2">Eight teams in four divisions. Here’s what each one does.</p>
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
    </div>
  );
}

const EMPTY = { name: '', gucId: '', email: '', day: '', team: '' };

function SignupForm({ days, full, teams, divisions }: { days: OrientationDay[]; full: string[]; teams: Team[]; divisions: Division[] }) {
  const [f, setF] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ day: OrientationDay; team: string; name: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const open = days.filter((x) => Date.parse(x.ends_at) >= Date.now());
  const ordered = divisions.flatMap((dv) => teams.filter((t) => t.division_id === dv.id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.day) err.day = 'Pick the day you’ll come.';
    if (f.name.trim().length < 2) err.name = 'Enter your full name.';
    if (!GUC_ID_RE.test(f.gucId.trim())) err.gucId = 'Enter your GUC ID, like 58-12345.';
    if (!GUC_EMAIL_RE.test(f.email.trim())) err.email = 'Use your GUC student email, ending in @student.guc.edu.eg.';
    if (!f.team) err.team = 'Pick the team you’re most interested in.';
    if (!consent) err.consent = 'Tick the box to continue.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      await orientationApi.signUp({ day_id: f.day, name: f.name.trim(), guc_id: f.gucId.trim(), email: f.email.trim().toLowerCase(), team_ids: [f.team], consent, turnstile_token: token });
      setDone({ day: days.find((x) => x.id === f.day)!, team: teams.find((t) => t.id === f.team)?.name ?? '', name: f.name.trim().split(' ')[0] });
      setF(EMPTY); setConsent(false);
    } catch (x) {
      setErrors({ form: (x as Error).message });
    } finally { setBusy(false); setToken(undefined); setAttempt((n) => n + 1); }
  };

  return (
    <>
      <form className="tx-card orient-form grid gap-s5" onSubmit={submit} noValidate>
        <div className="grid gap-s1">
          <h2 className="h3 uppercase">Save your spot</h2>
          <p className="text-body-sm text-ink-3">Takes a minute. Both days are the same, so come to one.</p>
        </div>

        <fieldset className="grid gap-s2">
          <legend className="orient-step"><span>1</span>Pick your day</legend>
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
          {errors.day && <p className="tx-help text-bad" role="alert">{errors.day}</p>}
        </fieldset>

        <fieldset className="grid gap-s3">
          <legend className="orient-step"><span>2</span>About you</legend>
          <TextInput label="Full name" value={f.name} onChange={set('name')} autoComplete="name" error={errors.name} />
          <div className="grid gap-s4 sm:grid-cols-2">
            <TextInput label="GUC ID" value={f.gucId} onChange={set('gucId')} placeholder="58-12345" error={errors.gucId} />
            <TextInput label="GUC student email" type="email" value={f.email} onChange={set('email')} autoComplete="email" placeholder="name.surname@student.guc.edu.eg" error={errors.email} />
          </div>
        </fieldset>

        <fieldset className="grid gap-s2">
          <legend className="orient-step"><span>3</span>The team you’re most interested in</legend>
          <div className="grid gap-s2 grid-cols-1 sm:grid-cols-2">
            {ordered.map((t) => (
              <label key={t.id} className={'orient-team' + (f.team === t.id ? ' is-on' : '')}>
                <input type="radio" name="team" value={t.id} checked={f.team === t.id} onChange={set('team')} className="sr-only" />
                {t.name}
              </label>
            ))}
          </div>
          {errors.team && <p className="tx-help text-bad" role="alert">{errors.team}</p>}
        </fieldset>

        <div className="grid gap-s3">
          <div className={errors.consent ? 'tx-field is-error' : ''}>
            <Check2 checked={consent} onChange={(e) => setConsent(e.target.checked)} label="TEDxGUC may keep these details to plan orientation this season." />
            {errors.consent && <p className="tx-help mt-s1" role="alert">{errors.consent}</p>}
          </div>
          <Turnstile resetKey={attempt} onToken={setToken} />
          {errors.form && <p className="text-bad" role="alert">{errors.form}</p>}
          <Button type="submit" block loading={busy}><Send aria-hidden="true" />Save my spot</Button>
        </div>
      </form>

      {done && (
        <div className="orient-pop" role="dialog" aria-modal="true" aria-labelledby="orient-pop-t" onClick={() => setDone(null)}>
          <div className="orient-pop__card" onClick={(e) => e.stopPropagation()}>
            <div className="orient-pop__dot" aria-hidden="true"><svg viewBox="0 0 24 24" width="44" height="44"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <p className="orient-pop__k">Orientation · {done.team}</p>
            <h2 id="orient-pop-t" className="orient-pop__t">You’re in, {done.name}</h2>
            <div className="orient-pop__when">
              <div><span>Day</span><b>{fmtDate(done.day.starts_at)}</b></div>
              <div><span>Time</span><b>{fmtTime(done.day.starts_at)}–{fmtTime(done.day.ends_at)}</b></div>
              {done.day.location && <div><span>Place</span><b>{done.day.location}</b></div>}
            </div>
            <p className="orient-pop__note">Bring your GUC ID. See you there.</p>
            <button type="button" className="orient-pop__btn" onClick={() => setDone(null)} autoFocus>Done</button>
          </div>
        </div>
      )}
    </>
  );
}
