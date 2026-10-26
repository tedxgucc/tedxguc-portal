'use client';
// Team (FR-3.5 org chart, member directory, FR-2.3 invites).
// Phone numbers never show here; they live in a separate, locked table.
import { Search, Trash2, UserCog, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { RequestChangeModal } from '@/components/portal/admin/PeopleTabs';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Avatar, Button, Chip, DivTag, EmptyState, Modal, Select, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { ALLOWED_DOMAINS } from '@/lib/env';
import { fmtShortDate } from '@/lib/format';
import { canManageTeam, canManageTeamMember, isInTeam, memberTeamIds, roleLabel } from '@/lib/roles';
import type { Invite, Member, Role, Team } from '@/lib/types';

export default function TeamPage() {
  const { me, members, divisions, teams, refreshMembers } = usePortal();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviting, setInviting] = useState(false);
  const [changing, setChanging] = useState<Member | null>(null);
  const [adding, setAdding] = useState<Team | null>(null);
  const [removing, setRemoving] = useState<{ member: Member; team: Team } | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  // Curators ask the Chairman to promote, move or remove people in their division (FR-3.6).
  const canRequest = (m: Member) => me.role === 'curator' && ['executive', 'associate'].includes(m.role) && m.division_id === me.division_id && m.user_id !== me.id;
  const canInvite = me.role === 'chairman' || me.role === 'curator';
  const loadInvites = useCallback(() => { if (canInvite) api.listInvites().then(setInvites).catch(() => {}); }, [canInvite]);
  useEffect(() => { loadInvites(); }, [loadInvites]);

  const match = (s: string | null) => (s ?? '').toLowerCase().includes(q.trim().toLowerCase());
  // Executives see and manage only their own team.
  const scoped = useMemo(() => (me.role === 'executive' ? members.filter((m) => isInTeam(m, me.team_id)) : members), [members, me]);
  const shown = useMemo(() => scoped.filter((m) => !q.trim() || match(m.name) || match(m.team) || match(m.division)), [scoped, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const chair = shown.filter((m) => m.role === 'chairman');
  const openInvites = invites.filter((i) => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date());

  return (
    <>
      <PageTitle label={me.role === 'executive' ? (me.team_name ?? 'Team') : 'Team'} count={scoped.length} title={me.role === 'executive' ? 'My team' : 'The team'}>
        {canInvite && <Button onClick={() => setInviting(true)}><UserPlus aria-hidden="true" />Invite</Button>}
      </PageTitle>

      <div className="relative w-full sm:w-[360px] mb-s6">
        <TextInput label="Find someone" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, team or division" style={{ paddingLeft: 44 }} />
        <Search size={18} className="absolute left-s4 bottom-[17px] text-ink-3" aria-hidden="true" />
      </div>

      {chair.map((m) => (
        <div key={m.user_id} className="tx-card tx-card--outline flex items-center gap-s3 mb-s6">
          <Avatar name={m.name} />
          <div><div className="font-semibold">{m.name}</div><div className="text-body-sm text-ink-2">Chairman</div></div>
        </div>
      ))}

      <div className="grid gap-s7">
        {divisions.map((d) => {
          const curator = shown.find((m) => m.role === 'curator' && m.division_id === d.id);
          const dTeams = teams.filter((t) => t.division_id === d.id && (me.role !== 'executive' || t.id === me.team_id));
          const anyone = curator || shown.some((m) => dTeams.some((t) => isInTeam(m, t.id))) || dTeams.some((t) => canManageTeam(me, t));
          if (!anyone) return null;
          return (
            <section key={d.id} className="grid gap-s4" aria-labelledby={`dv-${d.id}`}>
              <div className="flex items-center gap-s3 flex-wrap">
                <SectionHeading as="h3" className="flex-1"><span id={`dv-${d.id}`}>{d.name}</span></SectionHeading>
                {curator && <span className="flex items-center gap-s2 text-body-sm"><Avatar name={curator.name} small />{curator.name} · Curator</span>}
              </div>
              <div className="grid gap-s4 md:grid-cols-2">
                {dTeams.map((t) => {
                  const people = shown.filter((m) => isInTeam(m, t.id)).sort((a, b) => (a.role === 'executive' ? -1 : 1) - (b.role === 'executive' ? -1 : 1));
                  if (!people.length && !canManageTeam(me, t)) return null;
                  return (
                    <div key={t.id} className="tx-card grid gap-s3 content-start">
                      <div className="flex flex-wrap items-center justify-between gap-s2">
                        <h4 className="h4">{t.name}</h4>
                        <DivTag kind={d.kind}>{people.length}</DivTag>
                        {canManageTeam(me, t) && <Button small variant="secondary" onClick={() => setAdding(t)}><UserPlus size={16} aria-hidden="true" />Add Member</Button>}
                      </div>
                      {!people.length && <p className="text-body-sm text-ink-3">{q.trim() ? 'No members match your search.' : 'No members yet. Add an existing club member to this team.'}</p>}
                      <ul className="grid gap-s2">
                        {people.map((m) => (
                          <li key={m.user_id} className="flex items-center gap-s3">
                            <Avatar name={m.name} small photo={m.photo_url} />
                            <span className="flex-1 min-w-0 break-words">{m.name}</span>
                            <span className="text-caption text-ink-3">{roleLabel[m.role]}</span>
                            {canRequest(m) && <button type="button" className="tx-iconbtn" aria-label={`Request a role change for ${m.name}`} onClick={() => setChanging(m)}><UserCog size={16} /></button>}
                            {canManageTeamMember(me, t, m, 'remove', teams) && <button type="button" className="tx-iconbtn shrink-0" title={`Remove ${m.name} from ${t.name}`} aria-label={`Remove ${m.name} from ${t.name}`} onClick={() => { setRemoveError(null); setRemoved(false); setRemoving({ member: m, team: t }); }}><Trash2 size={16} aria-hidden="true" /></button>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {me.role === 'executive' && !me.team_id && <EmptyState title="No team assigned">Your club account is still active. Ask your Curator or the Chairman to assign your team.</EmptyState>}
      {(me.role === 'chairman' || me.role === 'curator') && members.some((m) => ['executive', 'associate'].includes(m.role) && !memberTeamIds(m).length && (me.role === 'chairman' || m.division_id === me.division_id)) && <section className="tx-card grid gap-s2 mt-s6">
        <h3 className="h4">Unassigned club members</h3>
        <p className="text-body-sm text-ink-3">Their accounts and club roles are active. Use Add Member on a team to assign them.</p>
        {members.filter((m) => ['executive', 'associate'].includes(m.role) && !memberTeamIds(m).length && (me.role === 'chairman' || m.division_id === me.division_id)).map((m) => <p key={m.user_id} className="text-body-sm">{m.name} · {roleLabel[m.role]}</p>)}
      </section>}

      {canInvite && openInvites.length > 0 && (
        <section className="grid gap-s3 mt-s7" aria-labelledby="inv">
          <SectionHeading as="h3"><span id="inv">Waiting to join</span></SectionHeading>
          <div className="overflow-x-auto"><table className="tx-table">
            <thead><tr><th>Email</th><th className="hidden sm:table-cell">Role</th><th className="hidden sm:table-cell">Expires</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {openInvites.map((i) => (
                <tr key={i.id}>
                  <td className="tx-strong break-all">{i.email}<div className="sm:hidden text-caption text-ink-3">{roleLabel[i.role]} · expires {fmtShortDate(i.expires_at)}</div></td>
                  <td className="hidden sm:table-cell">{roleLabel[i.role]}{i.team_id ? ` · ${teams.find((t) => t.id === i.team_id)?.name}` : ''}</td>
                  <td className="hidden sm:table-cell">{fmtShortDate(i.expires_at)}</td>
                  <td className="text-right">
                    <button className="tx-iconbtn" aria-label={`Revoke invite for ${i.email}`}
                      onClick={async () => { await api.revokeInvite(i.id).catch(() => {}); toast('ok', 'Invite revoked.'); loadInvites(); }}><X /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
      )}
      <RequestChangeModal member={changing} onClose={() => setChanging(null)} />
      {adding && <AddMemberModal team={adding} onClose={() => setAdding(null)} />}
      <Modal open={!!removing} onClose={() => { if (!removingBusy) setRemoving(null); }} title={`Remove ${removing?.member.name ?? 'member'}?`}
        actions={<><Button variant="secondary" disabled={removingBusy} onClick={() => setRemoving(null)}>Cancel</Button><Button variant="danger" loading={removingBusy} onClick={async () => {
          if (!removing) return;
          setRemovingBusy(true); setRemoveError(null);
          try {
            if (!removed) { await api.removeTeamMember(removing.team.id, removing.member.user_id); setRemoved(true); }
            await refreshMembers();
            toast('ok', `${removing.member.name} removed from ${removing.team.name}.`);
            setRemoving(null);
          } catch (e) { setRemoveError((e as Error).message); } finally { setRemovingBusy(false); }
        }}>{removed ? 'Refresh roster' : 'Remove member'}</Button></>}>
        <p>Remove <b>{removing?.member.name}</b> from <b>{removing?.team.name}</b>? Their account, club role and all other team memberships will be kept.</p>
        {removed && <p className="text-body-sm mt-s3">The member was removed. Refresh the roster to see the latest list.</p>}
        {removeError && <p className="tx-help mt-s3" role="alert">{removeError}</p>}
      </Modal>
      {canInvite && <InviteModal open={inviting} onClose={() => setInviting(false)} onSent={() => { setInviting(false); loadInvites(); }} />}
    </>
  );
}

function AddMemberModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const { me, members, teams, refreshMembers } = usePortal();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const eligible = members.filter((m) => !isInTeam(m, team.id) && canManageTeamMember(me, team, m, 'add', teams));
  const shown = eligible.filter((m) => `${m.name} ${m.team ?? ''} ${roleLabel[m.role]}`.toLowerCase().includes(search.trim().toLowerCase()));
  const save = async () => {
    if (!selected) { setError('Select a club member.'); return; }
    setBusy(true); setError(null);
    try {
      if (!added) { await api.addTeamMember(team.id, selected); setAdded(true); }
      await refreshMembers();
      toast('ok', `Member added to ${team.name}.`);
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open title={`Add Member · ${team.name}`} onClose={() => { if (!busy) onClose(); }}
    actions={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy} disabled={!selected}>{added ? 'Refresh roster' : 'Add member'}</Button></>}>
    <div className="grid gap-s3">
      <p className="text-body-sm text-ink-2">Choose an existing club member. Their club role and other teams stay unchanged.</p>
      {me.role === 'executive' && <p className="text-body-sm text-ink-3">You can add unassigned Associates from your division. Members assigned to another team need their Curator or the Chairman.</p>}
      {!eligible.length && !added ? <EmptyState title="No eligible members">Everyone you can add is already assigned, or outside your management scope. {me.role === 'executive' ? 'Ask your Curator or the Chairman about other assignments.' : 'Use Invite for people who do not have accounts.'}</EmptyState> : <>
        <TextInput label="Find a club member" value={search} disabled={busy || added} onChange={(e) => { setSearch(e.target.value); setSelected(''); }} placeholder="Name, role or current team" />
        <Select label="Member" value={selected} disabled={busy || added} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a member…</option>
          {shown.map((m) => <option key={m.user_id} value={m.user_id}>{m.name} · {roleLabel[m.role]}{m.team ? ` · ${m.team}` : ''}</option>)}
        </Select>
        {!shown.length && <p className="text-body-sm text-ink-3">No eligible members match your search.</p>}
      </>}
      {added && <p className="text-body-sm">Member added. Refresh the roster to see the latest list.</p>}
      {error && <p className="tx-help" role="alert">{error}</p>}
    </div>
  </Modal>;
}

function InviteModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const { me, teams, divisions } = usePortal();
  const toast = useToast();
  const roles: Role[] = me.role === 'chairman' ? ['associate', 'executive', 'curator', 'chairman'] : ['associate', 'executive'];
  const myTeams = me.role === 'chairman' ? teams : teams.filter((t) => t.division_id === me.division_id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('associate');
  const [teamId, setTeamId] = useState(myTeams[0]?.id ?? '');
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    setError(null);
    try {
      await api.createInvite({
        email: e, role,
        team_id: role === 'executive' || role === 'associate' ? teamId : null,
        division_id: role === 'curator' ? divisionId : null,
      });
      toast('ok', 'Invite added.', `Tell ${e} to open the portal login, tap “Set your password” and use this email. It works for 7 days.`);
      setEmail('');
      onSent();
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const domain = email.split('@')[1]?.toLowerCase();
  return (
    <Modal open={open} onClose={onClose} title="Invite to the portal"
      actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={send} loading={busy}>Send invite</Button></>}>
      <div className="grid gap-s4">
        <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error}
          help={domain && !ALLOWED_DOMAINS.includes(domain) ? 'Not a GUC email: they’ll log in with email and password instead of Google.' : 'GUC emails can log in with Google.'} />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
        </Select>
        {(role === 'executive' || role === 'associate') && (
          <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        )}
        {role === 'curator' && (
          <Select label="Division" value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
            {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        )}
        {role === 'chairman' && <Chip kind="warn">Only one chairman per season</Chip>}
      </div>
    </Modal>
  );
}
