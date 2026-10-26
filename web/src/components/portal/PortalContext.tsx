'use client';
// The signed-in member plus the season's structure, loaded once for every
// portal screen.
import { useRouter } from 'next/navigation';
import { createContext, Fragment, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { adminApi } from '@/lib/api/admin';
import { BASE_PATH } from '@/lib/env';
import { clearCache, readCache, writeCache } from '@/lib/cache';
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
  markAllNotificationsRead: () => Promise<void>;
  /** Reload teams, divisions and members after an admin change. */
  reload: () => void;
  refreshMembers: () => Promise<void>;
};

const Ctx = createContext<Portal | null>(null);

export function PortalProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<Portal, 'memberName' | 'team' | 'divisionOfTeam' | 'refreshUnread' | 'markAllNotificationsRead' | 'unread' | 'reload' | 'refreshMembers'> | null>(null);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(() => {
    api.listNotifications().then((n) => { const c = n.filter((x) => !x.read_at).length; setUnread(c); writeCache('unread', c); }).catch(() => {});
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await api.markNotificationsRead();
    setUnread(0);
    writeCache('unread', 0);
  }, []);

  const reload = useCallback(() => {
    Promise.all([api.getMe(), api.listTeams(), api.listDivisions(), api.listMembers(), adminApi.myStaffEvents().catch(() => [] as string[])])
      .then(([me, teams, divisions, members, doorEvents]) => { if (me) setState((cur) => ({ eventsToday: cur?.eventsToday ?? [], me, doorEvents, teams: teams.map((t) => ({ ...t })), divisions: divisions.map((d) => ({ ...d })), members: members.map((m) => ({ ...m })) })); })
      .catch(() => {});
  }, []);

  const refreshMembers = useCallback(async () => {
    const [me, members] = await Promise.all([api.getMe(), api.listMembers()]);
    if (!me) throw new Error('Log in again to refresh the roster.');
    setState((cur) => {
      if (!cur) return cur;
      const next = { ...cur, me, members: members.map((m) => ({ ...m })) };
      writeCache('portal', next);
      return next;
    });
  }, []);

  // A refresh shows the last view at once (before the first paint); the
  // fresh data below replaces it a moment later.
  useLayoutEffect(() => {
    const saved = readCache<NonNullable<typeof state>>('portal');
    if (saved?.me) setState((cur) => cur ?? saved);
    const n = readCache<number>('unread');
    if (typeof n === 'number') setUnread(n);
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
      if (!me) { clearCache(); router.replace(`/login?next=${encodeURIComponent(window.location.pathname.slice(BASE_PATH.length) + window.location.search)}`); return; }
      const today = cairoDay(new Date());
      const eventsToday = allEvents.filter((e) => e.status !== 'cancelled' && e.status !== 'draft' && cairoDay(e.starts_at) === today).map((e) => e.id);
      const next = { me, teams, divisions, members, doorEvents, eventsToday };
      writeCache('portal', next);
      if (alive) setState(next);
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
      markAllNotificationsRead,
      reload,
      refreshMembers,
      memberName: (id) => byId.get(id) ?? (id === state.me.id ? state.me.name : 'Someone'),
      team: (id) => state.teams.find((t) => t.id === id),
      divisionOfTeam: (teamId) => {
        const t = state.teams.find((x) => x.id === teamId);
        return state.divisions.find((d) => d.id === t?.division_id);
      },
    };
  }, [state, unread, refreshUnread, markAllNotificationsRead, reload, refreshMembers]);

  if (!value) return <>{fallback}</>;
  // Keyed by person: if someone else is now logged in, every page starts fresh.
  return <Ctx.Provider value={value}><Fragment key={value.me.id}>{children}</Fragment></Ctx.Provider>;
}

export function usePortal(): Portal {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePortal must be used inside the portal');
  return v;
}
