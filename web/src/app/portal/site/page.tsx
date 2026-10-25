'use client';
// Site editor (FR-1.4). The Chairman edits every section; each Curator
// edits their own division's section. Public pages update on save.
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Check2, Chip, DivTag, EmptyState, Skeleton, TextArea, TextInput } from '@/components/ui';
import { adminApi, type SiteSection } from '@/lib/api/admin';
import { fmtRelative } from '@/lib/format';
import { canEditSection, canOpenSiteEditor } from '@/lib/roles';

const page: Record<string, { href: string; label: string }> = {
  about: { href: '/about', label: 'About page, top' },
  tedx: { href: '/about', label: 'About page, TED and TEDx' },
  faq: { href: '/contact', label: 'Contact page, FAQ' },
};
const where = (key: string) => page[key] ?? { href: '/about', label: 'About page, How we work' };

export default function SiteEditorPage() {
  const { me } = usePortal();
  const toast = useToast();
  const [rows, setRows] = useState<SiteSection[] | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<SiteSection | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.listSections().then((all) => {
      const mine = all.filter((s) => canEditSection(me, s.owner_kind));
      setRows(mine);
      setKey((k) => k ?? mine[0]?.key ?? null);
    }).catch(() => setRows([]));
  }, [me]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDraft(rows?.find((r) => r.key === key) ?? null); }, [key, rows]);

  if (!canOpenSiteEditor(me)) return <EmptyState title="Board leads only">The Chairman and Curators edit the public site.</EmptyState>;
  if (!rows) return <Skeleton h={320} />;
  if (!rows.length) return <EmptyState title="No sections for you yet">Ask the Chairman to add your division’s section.</EmptyState>;

  const items = draft?.body.items;
  const setItems = (list: { q: string; a: string }[]) => draft && setDraft({ ...draft, body: { ...draft.body, items: list } });
  const original = rows.find((r) => r.key === key);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(original);

  const save = async () => {
    if (!draft) return;
    if (items && items.some((i) => !i.q.trim() || !i.a.trim())) { toast('bad', 'Finish every question', 'Each FAQ needs a question and an answer.'); return; }
    setBusy(true);
    try {
      await adminApi.saveSection(draft.key, { title: draft.title, body: items ? { ...draft.body, items: items.map((i) => ({ q: i.q.trim(), a: i.a.trim() })) } : draft.body, is_published: draft.is_published });
      toast('ok', draft.is_published ? 'Saved and live' : 'Saved as hidden', draft.is_published ? `It shows on the ${where(draft.key).label}.` : 'Visitors won’t see it until you publish.');
      load();
    } catch (e) {
      toast('bad', 'Couldn’t save', (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageTitle label={me.role === 'curator' ? `Site · ${me.division_name ?? ''}` : 'Site'} title="Public site text" />
      <div className="grid gap-s6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start">
        <ul className="grid gap-s2" aria-label="Sections">
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" onClick={() => setKey(r.key)} aria-current={r.key === key || undefined}
                className={`tx-card w-full text-left grid gap-s1 ${r.key === key ? 'tx-card--outline' : 'hover:bg-surface-2'}`}>
                <span className="flex items-center justify-between gap-s2">
                  <span className="font-semibold truncate">{r.title}</span>
                  {r.is_published ? <Chip kind="ok">Live</Chip> : <Chip kind="soft">Hidden</Chip>}
                </span>
                <span className="caption tx-faint">{where(r.key).label} · edited {fmtRelative(r.updated_at)}</span>
              </button>
            </li>
          ))}
        </ul>

        {draft && (
          <section className="grid gap-s4 max-w-[720px]" aria-label={`Edit ${draft.title}`}>
            <div className="flex flex-wrap items-center gap-s3">
              {draft.owner_kind ? <DivTag kind={draft.owner_kind}>Division section</DivTag> : <span className="tx-tag">Club section</span>}
              <Link href={where(draft.key).href} target="_blank" className="text-body-sm inline-flex items-center gap-s1">View on site<ExternalLink size={14} aria-hidden="true" /></Link>
            </div>
            <TextInput label="Title" value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            {items ? (
              <div className="grid gap-s3">
                <span className="tx-label">Questions</span>
                {items.map((it, i) => (
                  <div key={i} className="tx-card grid gap-s3">
                    <div className="flex items-end gap-s2">
                      <div className="flex-1 min-w-0"><TextInput label={`Question ${i + 1}`} value={it.q} maxLength={160} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} /></div>
                      <button type="button" className="tx-iconbtn mb-[2px]" aria-label={`Remove question ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
                    </div>
                    <TextArea label="Answer" rows={2} maxLength={600} value={it.a} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                  </div>
                ))}
                <div><Button variant="ghost" small onClick={() => setItems([...items, { q: '', a: '' }])}><Plus size={16} aria-hidden="true" />Add question</Button></div>
              </div>
            ) : (
              <TextArea label="Text" rows={6} maxLength={1500} value={draft.body.text ?? ''} help={`${(draft.body.text ?? '').length} / 1500`}
                onChange={(e) => setDraft({ ...draft, body: { ...draft.body, text: e.target.value } })} />
            )}
            <Check2 label="Published: visitors can see this section" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} />
            <div className="flex gap-s2">
              <Button loading={busy} disabled={!dirty} onClick={save}>Save</Button>
              <Button variant="secondary" disabled={!dirty} onClick={() => setDraft(original ?? null)}>Undo changes</Button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
