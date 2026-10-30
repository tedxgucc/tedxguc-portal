'use client';
import { Instagram } from 'lucide-react';
import { PageTitle, SectionHeading, TxLabel } from '@/components/Brand';
import { DivTag } from '@/components/ui';
import { api } from '@/lib/api';
import { PageLoading } from '@/lib/useLoad';
import { usePublicData } from '@/lib/usePublicData';
import { DataNotice } from '@/components/public/DataNotice';
import { recruitmentApi } from '@/lib/api/phase2b';
import { INSTAGRAM_URL } from '@/lib/env';
import { fmtDate } from '@/lib/format';
import { ApplyForm } from './ApplyForm';


// FR-1.6, FR-4.1, FR-4.2: open roles per team, the form, the deadline.
export default function JoinPage() {
  const { data: d, error, loading, reload } = usePublicData(async () => {
    const [divisions, teams, cycles] = await Promise.all([api.listDivisions(), api.listTeams(), recruitmentApi.listCycles()]);
    const now = Date.now();
    const open = cycles.find((c) => c.kind === 'associates' && new Date(c.opens_at).getTime() <= now && new Date(c.closes_at).getTime() >= now) ?? null;
    const positions = open ? (await recruitmentApi.listPositions(open.id)).filter((p) => p.is_open) : [];
    const fill = open ? await recruitmentApi.positionFill(open.id).catch(() => []) : [];
    return { divisions, teams, cycles, now, open, positions, fill };
  });
  if (!d && error) return <div className="public-container pt-s7"><DataNotice message={error} retry={reload} loading={loading} /></div>;
  if (!d) return <PageLoading />;
  const { divisions, teams, cycles, now, open, positions, fill } = d;
  const full = new Set(fill.filter((x) => x.is_full).map((x) => x.team_id));
  const recruiting = new Set(positions.map((p) => p.team_id));

  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7 grid gap-s7">
      <PageTitle label="Join the team" count={open ? positions.length : teams.length} title="Make the next one" />
      <p className="body-lg text-ink-2 max-w-[640px] -mt-s4">
        GUC students run TEDxGUC across four divisions and eight teams. {open ? 'Pick one or two teams and tell us why.' : 'We recruit associates at the start of each season.'}
      </p>

      {open ? (
        <div className="tx-card tx-card--red grid gap-s3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <div className="tx-label" style={{ color: '#fff' }}>Applications open · closes {fmtDate(open.closes_at)}</div>
            <h2 className="h3 uppercase">{open.name}</h2>
          </div>
          <a href="#apply" className="tx-btn tx-btn--secondary" style={{ color: '#fff', borderColor: '#fff' }}>Apply now</a>
        </div>
      ) : (
        <div className="tx-card tx-card--outline grid gap-s3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 className="h3 uppercase">Applications are closed</h2>
            <p className="text-ink-2">The next round opens with the new season. Follow us so you don’t miss it.</p>
          </div>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="tx-btn tx-btn--secondary"><Instagram aria-hidden="true" />Follow us</a>
        </div>
      )}

      <div className="grid gap-s6 md:grid-cols-2">
        {divisions.map((d) => (
          <section key={d.id} className="grid gap-s3 content-start" aria-labelledby={`d-${d.id}`}>
            <SectionHeading as="h3"><span id={`d-${d.id}`}>{d.name}</span></SectionHeading>
            <ul className="grid gap-s2">
              {teams.filter((t) => t.division_id === d.id).map((t) => {
                const p = positions.find((x) => x.team_id === t.id);
                return (
                  <li key={t.id} className="tx-card grid gap-s1">
                    <div className="flex items-center justify-between gap-s3">
                      <span className="font-semibold">{t.name}</span>
                      {open && (!recruiting.has(t.id) ? <span className="text-caption text-ink-3">Not this round</span> : full.has(t.id) ? <span className="tx-chip tx-chip--void">Full</span> : <DivTag kind={d.kind}>Open</DivTag>)}
                    </div>
                    {p?.description && <p className="text-body-sm text-ink-2">{p.description}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {open && positions.length > 0 && (
        <section id="apply" className="grid gap-s4 scroll-mt-[88px]" aria-labelledby="apply-h">
          <TxLabel>Apply</TxLabel>
          <SectionHeading><span id="apply-h">Your application</span></SectionHeading>
          <ApplyForm cycle={open} positions={positions} teams={teams} full={[...full]} />
        </section>
      )}
    </div>
  );
}
