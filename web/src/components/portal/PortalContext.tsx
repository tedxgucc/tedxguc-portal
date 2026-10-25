'use client';
// The signed-in member plus the season's structure, loaded once for every
// portal screen.
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { adminApi } from '@/lib/api/admin';
import { cairoDay } from '@/lib/format';
import type { Division, Me, Member, Team, TxEvent } from '@/lib/types';

type Portal = {
  me: Me;
  teams: Team[];
  divisions: Division[];
  members: Member[];
  /** Events where I am door staff. */
  doorEvents: string[];
  /** Events happening today (Cairo time). */
  eventsToday: string[];
  memberName: (id: string) => string;
  team: (id: string | null | undefined) => Team | undefined;
  divisionOfTeam: (teamId: string | null | undefined) => Division | undefined;
  unread: number;
  refreshUnread: () => void;
  /** Reload teams, divisions and members after an admin change. */
  reload: () => void;
};

const Ctx = createContext<Portal | null>(null);

export function PortalProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<Portal, 'memberName' | 'team' | 'divisionOfTeam' | 'refreshUnread' | 'unread' | 'reload'> | null>(null);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(() => {
    api.listNotifications().then((n) => setUnread(n.filter((x) => !x.read_at).length)).catch(() => {});
  }, []);

  const reload = useCallback(() => {
    Promise.all([api.getMe(), api.listTeams(), api.listDivisions(), api.listMembers(), adminApi.myStaffEvents().catch(() => [] as string[])])
      .then(([me, teams, divisions, members, doorEvents]) => { if (me) setState((cur) => ({ eventsToday: cur?.eventsToday ?? [], me, doorEvents, teams: teams.map((t) => ({ ...t })), divisions: divisions.map((d) => ({ ...d })), members: members.map((m) => ({ ...m })) })); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Everything at once: no waiting for one request before the next.
      const [me, teams, divisions, members, doorEvents, allEvents] = await Promise.all([
        api.getMe().catch(() => null),
        api.listTeams().catch(() => []),
        api.listDivisions().catch(() => []),
        api.listMembers().catch(() => []),
        adminApi.myStaffEvents().catch(() => [] as string[]),
        api.listAllEvents().catch(() => [] as TxEvent[]),
      ]);
      if (!me) { router.replace('/login'); return; }
      const today = cairoDay(new Date());
      const eventsToday = allEvents.filter((e) => e.status !== 'cancelled' && e.status !== 'draft' && cairoDay(e.starts_at) === today).map((e) => e.id);
      if (alive) setState({ me, teams, divisions, members, doorEvents, eventsToday });
    })();
    refreshUnread();
    return () => { alive = false; };
  }, [router, refreshUnread]);

  const value = useMemo<Portal | null>(() => {
    if (!state) return null;
    const byId = new Map(state.members.map((m) => [m.user_id, m.name]));
    return {
      ...state,
      unread,
      refreshUnread,
      reload,
      memberName: (id) => byId.get(id) ?? (id === state.me.id ? state.me.name : 'Someone'),
      team: (id) => state.teams.find((t) => t.id === id),
      divisionOfTeam: (teamId) => {
        const t = state.teams.find((x) => x.id === teamId);
        return state.divisions.find((d) => d.id === t?.division_id);
      },
    };
  }, [state, unread, refreshUnread, reload]);

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortal(): Portal {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePortal must be used inside the portal');
  return v;
}
