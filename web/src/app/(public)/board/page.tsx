'use client';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { Button, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import type { BoardMember, Division, Team } from '@/lib/types';
import './board.css';

const divisionOrder = ['talks', 'operations', 'org_development', 'marketing'];
const teamOrder = ['coaching', 'research_production', 'logistics_planning', 'partnerships', 'associates_experience', 'associates_development', 'campaigns_copyrights', 'media_design'];
type BoardData = { members: BoardMember[]; divisions: Division[]; teams: Team[] };
type Person = BoardMember & { title: string; unit: string | null };

const roleTitle = { chairman: 'Chairman', curator: 'Curator', executive: 'Executive', associate: 'Associate' } as const;

export default function BoardPage() {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [members, divisions, teams] = await Promise.all([api.getBoard(), api.listDivisions(), api.listTeams()]);
      setData({ members, divisions, teams });
    } catch { setError('The board could not be loaded. Please try again.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const divisions = useMemo(() => (data?.divisions ?? []).filter((d) => divisionOrder.includes(d.kind)).sort((a, b) => divisionOrder.indexOf(a.kind) - divisionOrder.indexOf(b.kind)), [data]);
  const teamsOf = useCallback((d: Division) => (data?.teams ?? []).filter((t) => t.division_id === d.id && teamOrder.includes(t.kind)).sort((a, b) => teamOrder.indexOf(a.kind) - teamOrder.indexOf(b.kind)), [data]);

  // Everyone in reading order (Chairman, then each Curator followed by their Executives): the order the intros step through.
  const people = useMemo<Person[]>(() => {
    if (!data) return [];
    const out: Person[] = data.members.filter((m) => m.role === 'chairman').map((m) => ({ ...m, title: 'Chairman', unit: null }));
    for (const d of divisions) {
      out.push(...data.members.filter((m) => m.role === 'curator' && m.division === d.name).map((m) => ({ ...m, title: `${d.name} Curator`, unit: d.name })));
      for (const t of teamsOf(d)) out.push(...data.members.filter((m) => m.role === 'executive' && m.team === t.name).map((m) => ({ ...m, title: `${t.name} Executive`, unit: t.name })));
    }
    return out;
  }, [data, divisions, teamsOf]);
  const indexOf = (m: BoardMember) => people.findIndex((p) => p.name === m.name && p.role === m.role && p.team === m.team && p.division === m.division);
  const counts = { curators: people.filter((p) => p.role === 'curator').length, executives: people.filter((p) => p.role === 'executive').length };

  return <div className="mx-auto max-w-[1440px] px-s4 md:px-s6 pt-s7 md:pt-s8 pb-s7">
    <PageTitle label="The team" title="Board" />
    <div className="flex flex-wrap items-end justify-between gap-s4 mb-s5">
      <p className="body-lg text-ink-2 max-w-[640px]">
        {data ? `One Chairman, ${counts.curators} Curators and ${counts.executives} Executives leading TEDxGUC.` : 'The people leading TEDxGUC.'} Tap anyone to meet them.
      </p>
      {people.length > 0 && <Button onClick={() => setOpen(0)}><Play size={16} aria-hidden="true" />Meet the board</Button>}
    </div>
    {error ? <div className="grid gap-s3 justify-items-start"><p role="alert">{error}</p><Button variant="secondary" onClick={load}>Try again</Button></div> : !data ? <Skeleton h={440} /> : <div className="bd">
      {data.members.filter((m) => m.role === 'chairman').map((m) => (
        <button key={m.name} type="button" className="bd-chair" onClick={() => setOpen(indexOf(m))} aria-label={`Meet ${m.name}, Chairman`}>
          <span className="bd-chair__photo"><Portrait m={m} big /></span>
          <span className="bd-chair__text">
            <span className="tx-label">Chairman · TEDxGUC</span>
            <span className="bd-chair__name">{m.name}</span>
            <span className="bd-chair__bio">{m.bio?.trim() || 'Leads TEDxGUC this season, bringing ideas worth spreading to campus.'}</span>
            <span className="bd-chair__go"><Play size={14} aria-hidden="true" />Meet {m.name.split(' ')[0]}</span>
          </span>
        </button>
      ))}
      {divisions.map((d, di) => {
        const curators = data.members.filter((m) => m.role === 'curator' && m.division === d.name);
        return (
          <section key={d.id} className="bd-div" aria-labelledby={`bd-${d.id}`}>
            <div className="bd-div__head"><span className="bd-div__no">{String(di + 1).padStart(2, '0')}</span><h2 id={`bd-${d.id}`}>{d.name}</h2></div>
            <ul className="bd-grid">
              {curators.length ? curators.map((m) => <li key={m.name}><PersonCard m={m} role="Curator" unit={d.name} lead onPick={() => setOpen(indexOf(m))} /></li>)
                : <li><Vacant role="Curator" unit={d.name} /></li>}
              {teamsOf(d).map((t) => {
                const execs = data.members.filter((m) => m.role === 'executive' && m.team === t.name);
                return execs.length ? execs.map((m) => <li key={t.id + m.name}><PersonCard m={m} role="Executive" unit={t.name} onPick={() => setOpen(indexOf(m))} /></li>)
                  : <li key={t.id}><Vacant role="Executive" unit={t.name} /></li>;
              })}
            </ul>
          </section>
        );
      })}
    </div>}
    {open !== null && people[open] && <Intro people={people} at={open} onMove={setOpen} onClose={() => setOpen(null)} />}
  </div>;
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function Portrait({ m, big = false }: { m: BoardMember; big?: boolean }) {
  return m.photo_url
    ? <img src={m.photo_url} alt="" loading="lazy" decoding="async" />
    : <span className={'bd-initials' + (big ? ' bd-initials--big' : '')} aria-hidden="true"><span>{initials(m.name)}</span></span>;
}

function PersonCard({ m, role, unit, lead = false, onPick }: { m: BoardMember; role: string; unit: string; lead?: boolean; onPick: () => void }) {
  return (
    <button type="button" className={'bd-card' + (lead ? ' bd-card--lead' : '')} onClick={onPick} aria-label={`Meet ${m.name}, ${unit} ${role}`}>
      <span className="bd-card__photo"><Portrait m={m} /></span>
      <span className="bd-card__info">
        <span className="bd-card__role">{role}</span>
        <span className="bd-card__name">{m.name}</span>
        <span className="bd-card__unit">{unit}</span>
      </span>
    </button>
  );
}

function Vacant({ role, unit }: { role: string; unit: string }) {
  return <div className="bd-card bd-card--vacant"><span className="bd-card__info"><span className="bd-card__role">{role}</span><span className="bd-card__name">To be announced</span><span className="bd-card__unit">{unit}</span></span></div>;
}

// A spotlight card introducing one person, with arrows (and arrow keys) to step through the board.
function Intro({ people, at, onMove, onClose }: { people: Person[]; at: number; onMove: (i: number) => void; onClose: () => void }) {
  const p = people[at];
  const ref = useRef<HTMLDivElement>(null);
  const last = people.length - 1;
  const prev = () => onMove(at === 0 ? last : at - 1);
  const next = () => onMove(at === last ? 0 : at + 1);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; before?.focus?.(); };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  const first = p.name.split(' ')[0];
  return <div className="board-intro" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="board-intro__card" role="dialog" aria-modal="true" aria-labelledby="board-intro-name" tabIndex={-1} ref={ref}>
      <button type="button" className="tx-iconbtn board-intro__close" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button>
      <div key={at} className="board-intro__body">
        <div className="board-intro__photo">
          {p.photo_url ? <img src={p.photo_url} alt="" /> : <span className="board-intro__initials" aria-hidden="true">{p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</span>}
        </div>
        <div className="board-intro__text">
          <div className="tx-label">{roleTitle[p.role]}{p.unit ? ` · ${p.unit}` : ''}</div>
          <h2 id="board-intro-name" className="board-intro__name">{p.name}</h2>
          <p className="board-intro__title">{p.title}{p.major ? ` · studies ${p.major}` : ''}</p>
          <p className="board-intro__bio">{p.bio?.trim() || `${first} is part of the TEDxGUC board this season, helping bring ideas worth spreading to campus.`}</p>
        </div>
      </div>
      <div className="board-intro__nav">
        <button type="button" className="tx-iconbtn" onClick={prev} aria-label="Previous person"><ChevronLeft aria-hidden="true" /></button>
        <div className="board-intro__dots" aria-hidden="true">{people.map((x, i) => <span key={i} className={i === at ? 'is-on' : ''} onClick={() => onMove(i)} />)}</div>
        <span className="sr-only" aria-live="polite">{at + 1} of {people.length}: {p.name}</span>
        <button type="button" className="tx-iconbtn" onClick={next} aria-label="Next person"><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
  </div>;
}
