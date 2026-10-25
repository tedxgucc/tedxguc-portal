'use client';
// Profile (FR-2.5) and session controls (FR-2.4).
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/components/Toast';
import { Avatar, Button, DivTag, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { roleLabel } from '@/lib/roles';

export default function ProfilePage() {
  const { me } = usePortal();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(me.name);
  const [major, setMajor] = useState('');
  const [semester, setSemester] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('save');
    try {
      await api.updateProfile({
        name: name.trim() || undefined,
        ...(major ? { major } : {}),
        ...(semester ? { semester: Number(semester) } : {}),
        ...(phone ? { phone } : {}),
      });
      toast('ok', 'Profile saved.');
    } catch (x) {
      toast('bad', "That didn't save.", (x as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const signOut = async (everywhere: boolean) => {
    setBusy(everywhere ? 'all' : 'out');
    await api.signOut(everywhere);
    router.replace('/login');
  };

  return (
    <>
      <PageTitle label="Profile" title={me.name.split(' ')[0]} />
      <div className="grid gap-s6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <form className="tx-card grid gap-s4" onSubmit={save}>
          <div className="flex items-center gap-s3">
            <Avatar name={me.name} />
            <div>
              <div className="font-semibold">{me.email}</div>
              <div className="flex flex-wrap gap-s2 mt-s1">
                {me.role && <span className="tx-chip tx-chip--soft">{roleLabel[me.role]}</span>}
                {(me.team_name || me.division_name) && <DivTag kind={me.division_kind}>{me.team_name ?? me.division_name}</DivTag>}
              </div>
            </div>
          </div>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <div className="grid gap-s4 sm:grid-cols-2">
            <TextInput label="Major" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Computer Science" />
            <TextInput label="Semester" type="number" min={1} max={12} value={semester} onChange={(e) => setSemester(e.target.value)} />
          </div>
          <TextInput label="Phone / WhatsApp" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20"
            help="Only you, executives and curators can see it." />
          <Button type="submit" loading={busy === 'save'} className="justify-self-start">Save</Button>
        </form>

        <div className="grid gap-s4">
          <section className="tx-card grid gap-s3" aria-labelledby="look">
            <SectionHeading as="h3"><span id="look">Look</span></SectionHeading>
            <div className="flex items-center justify-between"><span>Light or dark</span><ThemeToggle /></div>
          </section>
          <section className="tx-card grid gap-s3" aria-labelledby="sess">
            <SectionHeading as="h3"><span id="sess">Sessions</span></SectionHeading>
            <Button variant="secondary" onClick={() => signOut(false)} loading={busy === 'out'}><LogOut aria-hidden="true" />Sign out</Button>
            <Button variant="danger" onClick={() => signOut(true)} loading={busy === 'all'}><MonitorSmartphone aria-hidden="true" />Sign out everywhere</Button>
            <p className="text-caption text-ink-3">Lost your phone? “Sign out everywhere” ends every session on every device.</p>
          </section>
        </div>
      </div>
    </>
  );
}
