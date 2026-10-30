'use client';
import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { Avatar, Button, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import type { BoardMember, Division, Team } from '@/lib/types';
import './board.css';

const divisionOrder = ['talks', 'operations', 'org_development', 'marketing'];
const teamOrder = ['coaching', 'research_production', 'logistics_planning', 'partnerships', 'associates_experience', 'associates_development', 'campaigns_copyrights', 'media_design'];
type BoardData = { members: BoardMember[]; divisions: Division[]; teams: Team[] };

export default function BoardPage() {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [members, divisions, teams] = await Promise.all([api.getBoard(), api.listDivisions(), api.listTeams()]);
      setData({ members, divisions, teams });
    } catch { setError('The board could not be loaded. Please try again.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const divisions = (data?.divisions ?? []).filter((d) => divisionOrder.includes(d.kind)).sort((a, b) => divisionOrder.indexOf(a.kind) - divisionOrder.indexOf(b.kind));
  return <div className="mx-auto max-w-[1440px] px-s4 md:px-s6 pt-s7 md:pt-s8 pb-s7">
    <PageTitle label="The team" title="Board" />
    <p className="body-lg text-ink-2 mb-s5">One Chairman, four Curators and eight Executives leading TEDxGUC.</p>
    {error ? <div className="grid gap-s3 justify-items-start"><p role="alert">{error}</p><Button variant="secondary" onClick={load}>Try again</Button></div> : !data ? <Skeleton h={440} /> : <>
      <p className="text-caption text-ink-3 mb-s3 xl:hidden">Swipe horizontally to explore all four divisions.</p>
      <div className="board-scroll" tabIndex={0} role="region" aria-label="Board hierarchy: Chairman, four Curators, then their eight Executives">
        <div className="board-tree">
          <div className="board-chair"><BoardCard role="Chairman" members={data.members.filter((m) => m.role === 'chairman')} /></div>
          <ul className="board-divisions">
            {divisions.map((d) => <li key={d.id} className="board-branch">
              <div className="board-curator"><BoardCard role="Curator" unit={d.name} members={data.members.filter((m) => m.role === 'curator' && m.division === d.name)} /></div>
              <ul className="board-executives">
                {data.teams.filter((t) => t.division_id === d.id && teamOrder.includes(t.kind)).sort((a, b) => teamOrder.indexOf(a.kind) - teamOrder.indexOf(b.kind)).map((t) => <li key={t.id}><BoardCard role="Executive" unit={t.name} members={data.members.filter((m) => m.role === 'executive' && m.team === t.name)} /></li>)}
              </ul>
            </li>)}
          </ul>
        </div>
      </div>
    </>}
  </div>;
}

function BoardCard({ role, unit, members }: { role: string; unit?: string; members: BoardMember[] }) {
  return <div className={'board-card' + (role === 'Chairman' ? ' board-card--chair' : '')}>
    <div className="tx-label">{role}</div>
    {unit && <h2 className="board-unit">{unit}</h2>}
    {members.length ? members.map((m) => <div key={m.name} className="board-person"><Avatar name={m.name} photo={m.photo_url} size={56} /><p className="font-semibold text-body-sm">{m.name}</p></div>) : <p className="text-body-sm text-ink-3">To be announced</p>}
  </div>;
}
