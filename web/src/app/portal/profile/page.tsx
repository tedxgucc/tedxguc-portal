'use client';
// Profile (FR-2.5) and session controls (FR-2.4).
import { Camera, KeyRound, LogOut, MonitorSmartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/components/Toast';
import { Avatar, Button, DivTag, TextInput } from '@/components/ui';
import { api } from '@/lib/api';
import { roleLabel } from '@/lib/roles';

export default function ProfilePage() {
  const { me, reload } = usePortal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
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
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy('photo');
    try {
      const url = await api.uploadAvatar(file);
      await api.updateProfile({ photo_url: url });
      reload();
      toast('ok', 'Photo updated.', 'Everyone in the portal sees it now.');
    } catch (x) { toast('bad', 'Photo not changed.', (x as Error).message); } finally { setBusy(null); }
  };
  const removePhoto = async () => {
    setBusy('photo');
    try { await api.updateProfile({ photo_url: null }); reload(); toast('ok', 'Photo removed.'); }
    catch (x) { toast('bad', 'Photo not removed.', (x as Error).message); } finally { setBusy(null); }
  };
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { toast('bad', 'Use at least 8 characters.'); return; }
    if (pw !== pw2) { toast('bad', 'The two passwords don’t match.'); return; }
    setBusy('pw');
    try { await api.changePassword(pw); setPw(''); setPw2(''); toast('ok', 'Password changed.', 'Use the new one next time you log in.'); }
    catch (x) { toast('bad', 'Password not changed.', (x as Error).message); } finally { setBusy(null); }
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
            <div className="grid justify-items-center gap-s1 shrink-0">
              <button type="button" onClick={() => fileRef.current?.click()} className="relative bg-transparent border-0 p-0 cursor-pointer rounded-full" aria-label="Change profile photo">
                <Avatar name={me.name} photo={me.photo_url} size={72} />
                <span className="absolute -right-[2px] -bottom-[2px] w-[28px] h-[28px] rounded-full bg-accent text-on-accent grid place-items-center border-2 border-[var(--surface-1)]"><Camera size={14} aria-hidden="true" /></span>
              </button>
              {me.photo_url && <button type="button" onClick={removePhoto} className="tx-link text-caption bg-transparent border-0 cursor-pointer p-0">Remove</button>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold break-all">{me.email}</div>
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
        <form id="password" className="tx-card grid gap-s4 scroll-mt-[88px] lg:col-start-1" onSubmit={changePassword}>
          <h2 className="tx-heading h3"><KeyRound size={20} aria-hidden="true" />Change password</h2>
          <div className="grid gap-s4 grid-cols-1 sm:grid-cols-2">
            <TextInput label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} help="At least 8 characters." />
            <TextInput label="Repeat it" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary" loading={busy === 'pw'} className="justify-self-start">Change password</Button>
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
