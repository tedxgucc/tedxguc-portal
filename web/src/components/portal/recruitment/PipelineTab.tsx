'use client';
// Pipeline (FR-4.3, 4.4, 4.5, 4.6): Applied → Screened → Interview → Accepted / Rejected.
// Curators and the Chairman move stages; Executives accept applicants
// into their own team and send reallocation referrals.
import { Check, ExternalLink, FileText, Send, Star, UserCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Chip, EmptyState, Modal, Select, Skeleton, TextArea, TextInput } from '@/components/ui';
import { recruitmentApi } from '@/lib/api/phase2b';
import { fmtRelative } from '@/lib/format';
import { canManageTeam } from '@/lib/roles';
import type { Application, ApplicationDecisionContext, Cycle, InterviewScore, Position, Stage } from '@/lib/types';

const STAGES: { s: Stage; label: string }[] = [
  { s: 'applied', label: 'Applied' }, { s: 'screened', label: 'Screened' }, { s: 'interview', label: 'Interview' },
  { s: 'accepted', label: 'Accepted' }, { s: 'rejected', label: 'Rejected' }, { s: 'withdrawn', label: 'Withdrawn' },
];

export function stageChip(s: Stage) {
  const map: Record<Stage, ['ok' | 'bad' | 'pending' | 'void' | 'soft', string]> = {
    applied: ['soft', 'Applied'], screened: ['soft', 'Screened'], interview: ['pending', 'Interview'],
    accepted: ['ok', 'Accepted'], rejected: ['bad', 'Rejected'], withdrawn: ['void', 'Withdrawn'],
  };
  const [k, w] = map[s];
  return <Chip kind={k}>{w}</Chip>;
}

export function PipelineTab({ decisionsOnly = false }: { decisionsOnly?: boolean }) {
  const { me, team, teams } = usePortal();
  const toast = useToast();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [apps, setApps] = useState<Application[] | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [teamFilter, setTeamFilter] = useState('');
  const [stage, setStage] = useState<Stage | ''>('');
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<Application | null>(null);
  const decides = me.role === 'chairman' || me.role === 'curator';

  const load = useCallback(() => {
    recruitmentApi.listApplications().then(setApps).catch(() => setApps([]));
    recruitmentApi.listCycles().then((c) => { const a = c.filter((x) => x.kind === 'associates'); setCycles(a); setCycleId((cur) => cur || a[0]?.id || ''); }).catch(() => {});
    recruitmentApi.listPositions().then(setPositions).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const inTeam = (a: Application, id: string) => a.team_choices.includes(id) || a.referred_team_ids?.includes(id) || a.accepted_team_id === id;
  const visibleTeams = useMemo(() => teams.filter((t) => canManageTeam(me, t)), [teams, me]);
  const shown = (apps ?? []).filter((a) => (!cycleId || a.cycle_id === cycleId) && (!teamFilter || inTeam(a, teamFilter)) && (!stage || a.stage === stage));
  const count = (s: Stage) => (apps ?? []).filter((a) => (!cycleId || a.cycle_id === cycleId) && (!teamFilter || inTeam(a, teamFilter)) && a.stage === s).length;
  const heldRejections = (apps ?? []).filter((a) => a.cycle_id === cycleId && a.stage === 'rejected').length;
  const cycle = cycles.find((c) => c.id === cycleId);

  const move = async (ids: string[], s: Exclude<Stage, 'accepted' | 'withdrawn'>) => {
    try {
      const r = await recruitmentApi.setStage(ids, s);
      toast('ok', `Moved ${ids.length} to ${s}.`, s === 'rejected' && r.held_back ? `${r.held_back} rejection email${r.held_back > 1 ? 's' : ''} held until you release the round.` : r.emailed ? `${r.emailed} applicant${r.emailed > 1 ? 's' : ''} emailed.` : undefined);
      setPicked([]);
      load();
    } catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
  };
  const release = async () => {
    try { const n = await recruitmentApi.releaseRejections(cycleId); toast('ok', n ? `Sent ${n} rejection email${n > 1 ? 's' : ''} for this round.` : 'Nothing to send.', 'Includes all teams. Later rejections in this round are emailed straight away.'); load(); }
    catch (e) { toast('bad', 'That didn’t send.', (e as Error).message); }
  };

  return (
    <div className="grid gap-s4">
      {decisionsOnly && <p className="text-body-sm text-ink-2">Review applicants and incoming reallocations. Accept an applicant into your team or refer them to another team for review at any time.</p>}
      <div className="grid gap-s3 sm:grid-cols-3">
        <Select label="Round" value={cycleId} onChange={(e) => { setCycleId(e.target.value); setPicked([]); }}>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {visibleTeams.length > 1 && (
          <Select label="Team" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">All my teams</option>{visibleTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        )}
        <Select label="Stage" value={stage} onChange={(e) => setStage(e.target.value as Stage | '')}>
          <option value="">All stages</option>{STAGES.map((s) => <option key={s.s} value={s.s}>{s.label} ({count(s.s)})</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-s2" aria-label="Stage counts">
        {STAGES.slice(0, 5).map((s) => (
          <button key={s.s} className={`tx-card tx-kpi text-left cursor-pointer ${stage === s.s ? 'tx-card--outline' : ''}`} onClick={() => setStage(stage === s.s ? '' : s.s)} style={{ padding: 12 }}>
            <span className="tx-label">{s.label}</span><span className="stat tx-num" style={{ fontSize: 32 }}>{count(s.s)}</span>
          </button>
        ))}
      </div>

      {decides && cycle && heldRejections > 0 && !cycle.rejections_released_at && (
        <div className="tx-card tx-card--outline flex flex-wrap items-center justify-between gap-s3">
          <p className="text-body-sm text-ink-2">{heldRejections} rejection{heldRejections > 1 ? 's' : ''} waiting. Applicants still see “in review” until rejections are sent. Sending releases every held rejection in this round, for all teams.</p>
          <Button small variant="secondary" onClick={release}><Send aria-hidden="true" />Send rejections</Button>
        </div>
      )}

      {decides && picked.length > 0 && (
        <div className="sticky top-[64px] z-[5] tx-card flex flex-wrap items-center gap-s2" style={{ boxShadow: 'var(--shadow-pop)' }}>
          <span className="text-body-sm font-semibold mr-auto">{picked.length} selected</span>
          <Button small variant="secondary" onClick={() => move(picked, 'screened')}>Screened</Button>
          <Button small variant="secondary" onClick={() => move(picked, 'interview')}>Invite to interview</Button>
          <Button small variant="danger" onClick={() => move(picked, 'rejected')}><X aria-hidden="true" />Reject</Button>
        </div>
      )}

      {apps === null ? <Skeleton h={240} /> : shown.length === 0 ? (
        <EmptyState title="No applicants here.">{me.role === 'executive' ? 'Applicants who pick your team show up here.' : 'When people apply to your teams, they land here.'}</EmptyState>
      ) : (
        <ul className="grid gap-s2">
          {shown.map((a) => (
            <li key={a.id} className="tx-card grid grid-cols-[auto_minmax(0,1fr)_auto] gap-s3 items-center" style={{ padding: '12px 16px' }}>
              {decides && !['accepted', 'withdrawn'].includes(a.stage)
                ? <input type="checkbox" className="w-[20px] h-[20px]" style={{ accentColor: 'var(--accent)' }} aria-label={`Select ${a.applicant_name}`}
                    checked={picked.includes(a.id)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, a.id] : p.filter((x) => x !== a.id))} />
                : <span className="w-[20px]" />}
              <button className="grid grid-cols-1 min-w-0 text-left bg-transparent border-0 cursor-pointer p-0 text-ink" onClick={() => setOpen(a)}>
                <span className="font-semibold truncate">{a.applicant_name}</span>
                {a.referred_team_ids?.some((id) => canManageTeam(me, team(id))) && <span className="text-caption text-accent">Reallocation received</span>}
                <span className="text-caption text-ink-3 truncate">{a.team_choices.map((t, i) => `${i + 1}. ${team(t)?.name}`).join('  ')} · {fmtRelative(a.created_at)}</span>
              </button>
              {stageChip(a.stage)}
            </li>
          ))}
        </ul>
      )}
      {open && <ApplicantSheet app={open} positions={positions} decides={decides} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} onMove={move} />}
    </div>
  );
}

function ApplicantSheet({ app, positions, decides, onClose, onChanged, onMove }: {
  app: Application; positions: Position[]; decides: boolean; onClose: () => void; onChanged: () => void;
  onMove: (ids: string[], s: Exclude<Stage, 'accepted' | 'withdrawn'>) => Promise<void>;
}) {
  const { me, team, teams, memberName } = usePortal();
  const toast = useToast();
  const [scores, setScores] = useState<InterviewScore[]>([]);
  const [score, setScore] = useState('');
  const [notes, setNotes] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptTeam, setAcceptTeam] = useState('');
  const [context, setContext] = useState<ApplicationDecisionContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [referring, setReferring] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [referTeam, setReferTeam] = useState('');
  const [referNotes, setReferNotes] = useState('');
  const loadContext = useCallback(() => {
    setContextError(null);
    recruitmentApi.decisionContext(app.id).then((c) => { setContext(c); setAcceptTeam((id) => c.acceptable_team_ids.includes(id) ? id : c.acceptable_team_ids[0] ?? ''); }).catch((e) => setContextError((e as Error).message));
  }, [app.id]);
  useEffect(() => { loadContext(); }, [loadContext]);
  const loadScores = useCallback(() => recruitmentApi.listScores(app.id).then((s) => {
    setScores(s);
    const mine = s.find((x) => x.interviewer_id === me.id);
    if (mine) { setScore(String(mine.score)); setNotes(mine.notes ?? ''); }
  }).catch(() => {}), [app.id, me.id]);
  useEffect(() => { loadScores(); }, [loadScores]);

  const qs = positions.filter((p) => p.cycle_id === app.cycle_id && app.team_choices.includes(p.team_id)).flatMap((p) => p.questions);
  const avg = scores.length ? Math.round((scores.reduce((a, s) => a + s.score, 0) / scores.length) * 10) / 10 : null;
  const acceptable = context?.acceptable_team_ids ?? [];
  const sourceTeams = [...app.team_choices, ...(context?.referrals.filter((r) => r.status === 'pending').map((r) => r.to_team_id) ?? [])].filter((id) => canManageTeam(me, team(id)));
  const referable = teams.filter((t) => sourceTeams.some((id) => id !== t.id) && !context?.referrals.some((r) => r.to_team_id === t.id));

  const saveScore = async () => {
    const n = Number(score);
    if (!(n >= 0 && n <= 10)) { toast('bad', 'Score from 0 to 10.'); return; }
    try { await recruitmentApi.saveScore(app.id, n, notes.trim()); toast('ok', 'Score saved.'); loadScores(); }
    catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
  };
  const accept = async () => {
    setSaving(true);
    try { const r = await recruitmentApi.accept(app.id, acceptTeam); toast('ok', `${app.applicant_name} accepted into ${r.team}.`, 'They get an invite to the portal by email.'); onChanged(); }
    catch (e) { toast('bad', 'That didn’t save.', (e as Error).message); }
    finally { setSaving(false); }
  };
  const refer = async () => {
    if (!referTeam) return;
    setSaving(true);
    try { await recruitmentApi.refer(app.id, referTeam, referNotes); toast('ok', `Referred to ${team(referTeam)?.name}.`, 'The receiving team reviews and accepts the applicant.'); onChanged(); }
    catch (e) { toast('bad', 'That did not save.', (e as Error).message); }
    finally { setSaving(false); }
  };
  const reject = async () => {
    setSaving(true);
    try {
      const result = await recruitmentApi.setStage([app.id], 'rejected');
      toast('ok', `${app.applicant_name} rejected.`, result.held_back ? 'The rejection email is held until the round is released.' : undefined);
      onChanged();
    } catch (e) { toast('bad', 'That did not save.', (e as Error).message); }
    finally { setSaving(false); }
  };
  const openCv = async () => {
    if (!app.cv_path) return;
    const url = await recruitmentApi.cvUrl(app.cv_path);
    if (url) window.open(url, '_blank', 'noopener');
    else toast('warn', 'CVs open in live mode.', 'Demo mode has no real files.');
  };

  return (
    <Modal open onClose={onClose} title={app.applicant_name}>
      <div className="grid gap-s4">
        <div className="flex flex-wrap items-center gap-s2">{stageChip(app.stage)}{app.accepted_team_id && <span className="tx-chip tx-chip--soft">{team(app.accepted_team_id)?.name}</span>}</div>
        <dl className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-s3 gap-y-s1 text-body-sm">
          <dt className="tx-label pt-[2px]">Email</dt><dd className="break-all">{app.applicant_email}</dd>
          {app.applicant_phone && <><dt className="tx-label pt-[2px]">Phone</dt><dd>{app.applicant_phone}</dd></>}
          {app.answers.guc_id && <><dt className="tx-label pt-[2px]">GUC ID</dt><dd>{app.answers.guc_id}</dd></>}
          {app.answers.major && <><dt className="tx-label pt-[2px]">Major</dt><dd>{app.answers.major}</dd></>}
          <dt className="tx-label pt-[2px]">1st choice</dt><dd>{team(app.team_choices[0])?.name ?? '—'}</dd>
          <dt className="tx-label pt-[2px]">2nd</dt><dd>{app.team_choices[1] ? team(app.team_choices[1])?.name : 'None'}</dd>
        </dl>
        {app.cv_path && <Button small variant="secondary" className="justify-self-start" onClick={openCv}><FileText aria-hidden="true" />Open CV</Button>}
        <section className="grid gap-s3">
          {qs.map((q) => (
            <div key={q.id} className="grid gap-s1">
              <div className="tx-label">{q.label}</div>
              {app.answers[q.id]
                ? (q.kind === 'url' ? <a href={app.answers[q.id]} target="_blank" rel="noopener noreferrer" className="tx-link inline-flex items-center gap-s1 break-all"><ExternalLink size={14} aria-hidden="true" />{app.answers[q.id]}</a>
                  : <p className="text-ink-2 whitespace-pre-line">{app.answers[q.id]}</p>)
                : <p className="text-ink-3">No answer</p>}
            </div>
          ))}
        </section>

        <section className="grid gap-s3 border-t border-line pt-s4" aria-labelledby="scores">
          <h3 id="scores" className="tx-label flex items-center gap-s1"><Star size={14} aria-hidden="true" />Interview scores {avg !== null && <b>(avg {avg})</b>}</h3>
          <ul className="grid gap-s1">{scores.map((s) => <li key={s.id} className="text-body-sm"><b>{s.score}/10</b> · {memberName(s.interviewer_id)}{s.notes ? `: ${s.notes}` : ''}</li>)}</ul>
          <div className="grid gap-s3 sm:grid-cols-[120px_minmax(0,1fr)]">
            <TextInput label="Your score" type="number" min={0} max={10} step={0.5} value={score} onChange={(e) => setScore(e.target.value)} />
            <TextInput label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button small variant="secondary" className="justify-self-start" onClick={saveScore}>Save my score</Button>
        </section>

        {context?.referrals.length ? <section className="grid gap-s2 border-t border-line pt-s4"><h3 className="h4">Reallocations</h3>{context.referrals.map((r) => <div key={r.id} className="tx-card grid gap-s1"><p className="text-body-sm font-semibold">{team(r.from_team_id)?.name} → {team(r.to_team_id)?.name} · {r.status}</p>{r.notes && <p className="text-body-sm text-ink-2 whitespace-pre-line">{r.notes}</p>}</div>)}</section> : null}
        {contextError && <div role="alert" className="grid gap-s2"><p className="tx-help">{contextError}</p><div><Button small variant="secondary" onClick={loadContext}>Retry decision permissions</Button></div></div>}
        {(decides || me.role === 'executive') && !['accepted', 'withdrawn'].includes(app.stage) && (
          <section className="grid gap-s2 border-t border-line pt-s4">
            <h3 className="h4">Interview decision</h3>
            {!context && !contextError && <p className="text-body-sm text-ink-3">Loading decision permissions…</p>}
            <div className="grid grid-cols-2 gap-s2">
              {decides && app.stage !== 'screened' && app.stage !== 'interview' && <Button small variant="secondary" onClick={() => onMove([app.id], 'screened')}>Screened</Button>}
              {decides && app.stage !== 'interview' && <Button small variant="secondary" onClick={() => onMove([app.id], 'interview')}>Invite to interview</Button>}
              {app.stage !== 'rejected' && <Button small variant="danger" disabled={saving || (!decides && !acceptable.length)} onClick={() => { setRejecting(true); setAccepting(false); setReferring(false); }}><X aria-hidden="true" />Reject</Button>}
              {acceptable.length > 0 && <Button small disabled={saving} onClick={() => { setAccepting(true); setRejecting(false); setReferring(false); }}><UserCheck aria-hidden="true" />Accept</Button>}
              <Button small variant="secondary" disabled={saving || !context || !sourceTeams.length} onClick={() => { setReferring((v) => !v); setAccepting(false); setRejecting(false); }}>Reallocate</Button>
            </div>
            {accepting && (
              <div className="tx-card tx-card--outline grid gap-s3">
                <Select label="Into which team?" value={acceptTeam} onChange={(e) => setAcceptTeam(e.target.value)}>
                  {acceptable.map((t) => <option key={t} value={t}>{team(t)?.name}</option>)}
                </Select>
                <p className="text-caption text-ink-3">One step: they become an Associate and get an invite to the portal.</p>
                <Button small loading={saving} disabled={!acceptTeam} onClick={accept}><Check aria-hidden="true" />Accept {app.applicant_name.split(' ')[0]}</Button>
              </div>
            )}
            {rejecting && <div className="tx-card tx-card--outline grid gap-s3"><p className="text-body-sm">Reject <b>{app.applicant_name}</b>? Their application will be marked rejected. Email follows the round's rejection-release settings.</p><div className="flex flex-wrap gap-s2"><Button small variant="secondary" disabled={saving} onClick={() => setRejecting(false)}>Cancel</Button><Button small variant="danger" loading={saving} onClick={reject}>Confirm rejection</Button></div></div>}
            {referring && <div className="tx-card tx-card--outline grid gap-s3">{referable.length ? <><Select label="Receiving team" value={referTeam} onChange={(e) => setReferTeam(e.target.value)}><option value="">Choose a team</option>{referable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select><TextArea label="Reallocation notes" maxLength={2000} value={referNotes} onChange={(e) => setReferNotes(e.target.value)} placeholder="Why might this applicant suit the receiving team?" /><p className="text-caption text-ink-3">Their original preferences stay unchanged. The receiving Executive makes the acceptance decision.</p><Button small loading={saving} disabled={!referTeam} onClick={refer}>Send reallocation</Button></> : <p className="text-body-sm text-ink-3">No other destination is available. This applicant has already been referred to the other available teams; see Reallocations above.</p>}</div>}
          </section>
        )}
      </div>
    </Modal>
  );
}
