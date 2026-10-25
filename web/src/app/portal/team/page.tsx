'use client';
// Team (FR-3.5 org chart, member directory, FR-2.3 invites).
// Phone numbers never show here; they live in a separate, locked table.
import { Search, UserCog, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { RequestChangeModal } from '@/components/portal/admin/PeopleTabs';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Avatar, Button, Chip, DivTag, Modal, Select, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { ALLOWED_DOMAINS } from '@/lib/env';
import { fmtShortDate } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import type { Invite, Member, Role } from '@/lib/types';

export default function TeamPage() {
  const { me, members, divisions, teams } = usePortal();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviting, setInviting] = useState(false);
  const [changing, setChanging] = useState<Member | null>(null);
  // Curators ask the Chairman to promote, move or remove people in their division (FR-3.6).
  const canRequest = (m: Member) => me.role === 'curator' && m.division_id === me.division_id && m.user_id !== me.id;
  const canInvite = me.role === 'chairman' || me.role === 'curator';
  const loadInvites = useCallback(() => { if (canInvite) api.listInvites().then(setInvites).catch(() => {}); }, [canInvite]);
  useEffect(() => { loadInvites(); }, [loadInvites]);

  const match = (s: string | null) => (s ?? '').toLowerCase().includes(q.trim().toLowerCase());
  // Executives see and manage only their own team.
  const scoped = useMemo(() => (me.role === 'executive' ? members.filter((m) => m.team_id === me.team_id) : members), [members, me]);
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
          const dTeams = teams.filter((t) => t.division_id === d.id);
          const anyone = curator || shown.some((m) => dTeams.some((t) => t.id === m.team_id));
          if (!anyone) return null;
          return (
            <section key={d.id} className="grid gap-s4" aria-labelledby={`dv-${d.id}`}>
              <div className="flex items-center gap-s3 flex-wrap">
                <SectionHeading as="h3" className="flex-1"><span id={`dv-${d.id}`}>{d.name}</span></SectionHeading>
                {curator && <span className="flex items-center gap-s2 text-body-sm"><Avatar name={curator.name} small />{curator.name} · Curator</span>}
              </div>
              <div className="grid gap-s4 md:grid-cols-2">
                {dTeams.map((t) => {
                  const people = shown.filter((m) => m.team_id === t.id).sort((a, b) => (a.role === 'executive' ? -1 : 1) - (b.role === 'executive' ? -1 : 1));
                  if (!people.length) return null;
                  return (
                    <div key={t.id} className="tx-card grid gap-s3 content-start">
                      <div className="flex items-center justify-between gap-s2">
                        <h4 className="h4">{t.name}</h4>
                        <DivTag kind={d.kind}>{people.length}</DivTag>
                      </div>
                      <ul className="grid gap-s2">
                        {people.map((m) => (
                          <li key={m.user_id} className="flex items-center gap-s3">
                            <Avatar name={m.name} small />
                            <span className="flex-1">{m.name}</span>
                            <span className="text-caption text-ink-3">{roleLabel[m.role]}</span>
                            {canRequest(m) && <button type="button" className="tx-iconbtn" aria-label={`Request a role change for ${m.name}`} onClick={() => setChanging(m)}><UserCog size={16} /></button>}
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

      {canInvite && openInvites.length > 0 && (
        <section className="grid gap-s3 mt-s7" aria-labelledby="inv">
          <SectionHeading as="h3"><span id="inv">Waiting to join</span></SectionHeading>
          <table className="tx-table">
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
          </table>
        </section>
      )}
      <RequestChangeModal member={changing} onClose={() => setChanging(null)} />
      {canInvite && <InviteModal open={inviting} onClose={() => setInviting(false)} onSent={() => { setInviting(false); loadInvites(); }} />}
    </>
  );
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
      toast('ok', 'Invite sent.', `${e} can log in for the next 7 days.`);
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
