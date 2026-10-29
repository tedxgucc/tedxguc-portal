'use client';
// Role changes (FR-3.6): Curators request, the Chairman decides.
// Audit log (FR-14.3): every change to roles, structure, settings and money.
import { ArrowRight, Check, Download, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionHeading } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Avatar, Button, Check2, Chip, EmptyState, Modal, Select, Skeleton, TextArea } from '@/components/ui';
import { adminApi, type AuditRow, type RoleRequest } from '@/lib/api/admin';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import type { Member, Role } from '@/lib/types';
import { downloadCsv } from '../FinanceBits';

function useTarget() {
  const { teams, divisions } = usePortal();
  return (r: Pick<RoleRequest, 'remove' | 'new_role' | 'new_team_id' | 'new_division_id' | 'current_team'>) => {
    if (r.remove) return 'Removed from the club';
    if (!r.new_role) return '—';
    if (r.new_role === 'curator') return `Curator · ${divisions.find((d) => d.id === r.new_division_id)?.name ?? 'same division'}`;
    if (r.new_role === 'chairman') return 'Chairman';
    return `${roleLabel[r.new_role]} · ${teams.find((t) => t.id === r.new_team_id)?.name ?? r.current_team ?? 'same team'}`;
  };
}

export function RoleChangesTab() {
  const { memberName, members, reload } = usePortal();
  const toast = useToast();
  const target = useTarget();
  const [rows, setRows] = useState<RoleRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => { adminApi.listRoleRequests().then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Skeleton h={200} />;

  const decide = async (r: RoleRequest, approve: boolean) => {
    setBusy(r.id + approve);
    try {
      await adminApi.decideRoleChange(r.id, approve);
      toast('ok', approve ? 'Role change approved' : 'Request rejected', approve ? `${r.name} and ${memberName(r.requested_by)} were notified.` : `${memberName(r.requested_by)} was notified.`);
      load();
      if (approve) reload();
    } catch (e) {
      toast('bad', 'Couldn’t decide', (e as Error).message);
    } finally { setBusy(null); }
  };
  const pending = rows.filter((r) => r.status === 'pending');
  const done = rows.filter((r) => r.status !== 'pending');
  const card = (r: RoleRequest, actions: boolean) => (
    <li key={r.id} className="tx-card grid gap-s3">
      <div className="flex items-center gap-s3 min-w-0">
        <Avatar photo={members.find((m) => m.user_id === r.user_id)?.photo_url} name={r.name} />
        <div className="grid min-w-0">
          <span className="font-semibold truncate">{r.name}</span>
          <span className="caption tx-faint">Asked by {memberName(r.requested_by)} · {fmtRelative(r.created_at)}</span>
        </div>
        {!actions && <span className="ml-auto"><Chip kind={r.status === 'approved' ? 'ok' : 'bad'}>{r.status === 'approved' ? 'Approved' : 'Rejected'}</Chip></span>}
      </div>
      {actions ? (
        <p className="flex flex-wrap items-center gap-s2 text-body-sm">
          <span className="text-ink-2">{r.current_role ? roleLabel[r.current_role] : '—'}{r.current_team ? ` · ${r.current_team}` : ''}</span>
          <ArrowRight size={16} aria-label="to" />
          <span className={`font-semibold ${r.remove ? 'text-bad' : ''}`}>{target(r)}</span>
        </p>
      ) : (
        <p className="text-body-sm"><span className="text-ink-2">{r.status === 'approved' ? 'Changed to ' : 'Asked for '}</span><span className="font-semibold">{target(r)}</span></p>
      )}
      {r.reason && <p className="text-ink-2 text-body-sm">“{r.reason}”</p>}
      {actions && (
        <div className="flex gap-s2">
          <Button small loading={busy === r.id + 'true'} onClick={() => decide(r, true)}><Check size={16} aria-hidden="true" />Approve</Button>
          <Button small variant="secondary" loading={busy === r.id + 'false'} onClick={() => decide(r, false)}><X size={16} aria-hidden="true" />Reject</Button>
        </div>
      )}
    </li>
  );

  return (
    <div className="grid gap-s6 max-w-[760px]">
      <section className="grid gap-s3">
        <SectionHeading>Waiting for you</SectionHeading>
        {pending.length ? <ul className="grid gap-s3">{pending.map((r) => card(r, true))}</ul>
          : <EmptyState title="No requests waiting">Curators ask for promotions, moves and removals from their Team page.</EmptyState>}
      </section>
      {done.length > 0 && (
        <section className="grid gap-s3">
          <SectionHeading>Decided</SectionHeading>
          <ul className="grid gap-s3">{done.map((r) => card(r, false))}</ul>
        </section>
      )}
    </div>
  );
}

// Curators ask the Chairman to change someone's role in their division.
export function RequestChangeModal({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { me, teams } = usePortal();
  const toast = useToast();
  const target = useTarget();
  const [role, setRole] = useState<Role>('executive');
  const [teamId, setTeamId] = useState('');
  const [remove, setRemove] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const myTeams = teams.filter((t) => t.division_id === me.division_id);

  useEffect(() => {
    if (!member) return;
    setRole(member.role === 'associate' ? 'executive' : 'associate');
    setTeamId(member.team_id ?? myTeams[0]?.id ?? '');
    setRemove(false);
    setReason('');
  }, [member]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!member) return;
    if (!reason.trim()) { toast('bad', 'Add a reason', 'The Chairman needs to know why.'); return; }
    setBusy(true);
    try {
      await adminApi.requestRoleChange({ user_id: member.user_id, new_role: remove ? null : role, new_team_id: remove ? null : teamId || null, new_division_id: null, remove, reason });
      toast('ok', 'Request sent to the Chairman', 'You’ll get a notification when it’s decided.');
      onClose();
    } catch (e) {
      toast('bad', 'Couldn’t send the request', (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Modal open={!!member} onClose={onClose} title={`Change ${member?.name ?? ''}’s role`}
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={remove ? 'danger' : 'primary'} loading={busy} onClick={submit}>Send to Chairman</Button></>}>
      {member && (
        <div className="grid gap-s4">
          <p className="text-ink-2 text-body-sm">Now: {roleLabel[member.role]}{member.team ? ` · ${member.team}` : ''}. The Chairman approves every role change.</p>
          <Check2 label="Remove from the club this season" checked={remove} onChange={(e) => setRemove(e.target.checked)} />
          {!remove && (
            <div className="grid gap-s4 md:grid-cols-2">
              <Select label="New role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="executive">Executive</option>
                <option value="associate">Associate</option>
              </Select>
              <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          )}
          {!remove && <p className="caption tx-faint">After approval: {target({ remove, new_role: role, new_team_id: teamId, new_division_id: null, current_team: member.team })}</p>}
          <TextArea label="Reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this change?" />
        </div>
      )}
    </Modal>
  );
}

const targetLabel: Record<string, string> = {
  settings: 'Setting', seasons: 'Season', divisions: 'Division', teams: 'Team', memberships: 'Membership', invites: 'Invite',
  role_change_requests: 'Role request', events: 'Event', transactions: 'Money', expense_requests: 'Expense request',
};
const actionLabel: Record<string, string> = { insert: 'Added', update: 'Changed', delete: 'Deleted', season_rollover: 'Season switched', season_prepared: 'Season prepared' };
const SKIP = new Set(['id', 'created_at', 'updated_at', 'season_id']);
const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function changes(r: AuditRow): string[] {
  const b = r.before ?? {};
  const a = r.after ?? {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !SKIP.has(k));
  if (r.target_type === 'settings' && (a.key ?? b.key)) {
    return [`${String(a.key ?? b.key)}: ${show(b.value)} → ${show(a.value)}`];
  }
  if (r.action === 'update') {
    return keys.filter((k) => k !== 'user_id' && JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => `${k}: ${show(b[k])} → ${show(a[k])}`);
  }
  const src = r.action === 'delete' ? b : a;
  return keys.filter((k) => k !== 'user_id' && src[k] !== undefined && src[k] !== null).map((k) => `${k}: ${show(src[k])}`);
}

export function AuditTab() {
  const { memberName } = usePortal();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [type, setType] = useState('');
  useEffect(() => { adminApi.listAudit(500).then(setRows).catch(() => setRows([])); }, []);
  const types = useMemo(() => [...new Set((rows ?? []).map((r) => r.target_type))].sort(), [rows]);
  if (!rows) return <Skeleton h={300} />;
  const shown = rows.filter((r) => !type || r.target_type === type);
  const who = (r: AuditRow) => (r.user_id ? memberName(r.user_id) : 'System');

  return (
    <div className="grid gap-s4">
      <div className="flex flex-wrap items-end gap-s3">
        <div className="w-full sm:w-[240px]">
          <Select label="Show" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Everything</option>
            {types.map((t) => <option key={t} value={t}>{targetLabel[t] ?? t}</option>)}
          </Select>
        </div>
        <Button variant="secondary" small onClick={() => downloadCsv('tedxguc-audit-log.csv', ['When', 'Who', 'Action', 'What', 'Details'],
          shown.map((r) => [r.created_at, who(r), actionLabel[r.action] ?? r.action, targetLabel[r.target_type] ?? r.target_type, changes(r).join('; ')]))}>
          <Download size={16} aria-hidden="true" />Export CSV
        </Button>
      </div>
      {shown.length === 0 ? <EmptyState title="Nothing logged yet" /> : (
        <ol className="grid gap-s2">
          {shown.map((r) => (
            <li key={r.id} className="tx-card grid gap-s1">
              <div className="flex flex-wrap items-center gap-s2">
                <span className="font-semibold">{who(r)}</span>
                <span className="text-ink-2">{(actionLabel[r.action] ?? r.action).toLowerCase()}</span>
                <span className="tx-tag">{targetLabel[r.target_type] ?? r.target_type}</span>
                {typeof (r.after?.user_id ?? r.before?.user_id) === 'string' && <span className="text-body-sm">for {memberName(String(r.after?.user_id ?? r.before?.user_id))}</span>}
                <span className="caption tx-faint ml-auto" title={fmtDateTime(r.created_at)}>{fmtRelative(r.created_at)}</span>
              </div>
              {changes(r).slice(0, 5).map((c) => <p key={c} className="caption text-ink-2 break-words" style={{ fontFamily: 'var(--font-mono)' }}>{c}</p>)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
