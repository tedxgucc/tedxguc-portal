'use client';
// SAO paperwork: pick a form, fill it in, download a PDF to print and sign by hand.
import { ArrowLeft, Download, FileText, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { usePortal } from '@/components/portal/PortalContext';
import { useToast } from '@/components/Toast';
import { Button, Check2, TextArea, TextInput } from '@/components/ui';
import { BASE_PATH } from '@/lib/env';
import { draftMemo } from '@/lib/api/phase2b';
import { SAO_ADVISOR, SAO_FORMS, SAO_OFFICE, SERVICE_GROUPS, type SaoForm } from '@/lib/sao-forms';

const CATS = ['Events', 'Sponsorship', 'Finance'] as const;

export default function PaperworkPage() {
  const [form, setForm] = useState<SaoForm | null>(null);
  return form ? <FillForm form={form} onBack={() => setForm(null)} /> : (
    <>
      <PageTitle label="Paperwork" title="SAO forms" />
      <p className="text-body text-ink-2 mb-s6 max-w-[640px]">Fill in an SAO form here and download it as a PDF, ready to print and sign.</p>
      <div className="grid gap-s7">
        {CATS.map((c) => (
          <section key={c} className="grid gap-s4">
            <SectionHeading as="h3">{c}</SectionHeading>
            <div className="grid gap-s3 sm:grid-cols-2 lg:grid-cols-3">
              {SAO_FORMS.filter((f) => f.cat === c).map((f) => (
                <button key={f.key} type="button" className="tx-card text-left grid gap-s2 cursor-pointer hover:border-[var(--accent)]" onClick={() => { setForm(f); window.scrollTo(0, 0); }}>
                  <span className="flex items-center gap-s2 font-semibold"><FileText size={18} aria-hidden="true" className="text-[var(--accent)]" />{f.name}</span>
                  <span className="text-body-sm text-ink-3">{f.blurb}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function FillForm({ form, onBack }: { form: SaoForm; onBack: () => void }) {
  const { me } = usePortal();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState<Record<string, string>>((): Record<string, string> => form.key === 'expense'
    ? { requestedDate: today, requestedBy: me.name, academicAdvisor: SAO_ADVISOR, memoTo: SAO_OFFICE } : {});
  const [drafting, setDrafting] = useState(false);
  const aiDraft = async () => {
    if (!v.amount || !v.memoSubject || !v.justification) { toast('bad', 'Fill in the amount, justification and subject first.'); return; }
    setDrafting(true);
    try { set('memoBody', await draftMemo({ requestedBy: v.requestedBy ?? '', advisor: v.academicAdvisor ?? SAO_ADVISOR, amount: v.amount, subject: v.memoSubject, justification: v.justification, current: v.memoBody ?? '' })); }
    catch (e) { toast('bad', 'Couldn’t draft the memo.', (e as Error).message); } finally { setDrafting(false); }
  };
  const [busy, setBusy] = useState(false);
  const set = (k: string, x: string) => setV((o) => ({ ...o, [k]: x }));
  const missing = useMemo(() => form.fields.filter((f) => 'k' in f && 'req' in f && f.req && !(v[f.k] ?? '').trim()).map((f) => f.label), [form, v]);

  const download = async () => {
    if (missing.length) { toast('bad', 'Fill in the required fields.', missing.join(', ')); return; }
    setBusy(true);
    try {
      const { saoFormPdf } = await import('@/lib/sao-pdf');
      const logo = await fetch(`${BASE_PATH}/paperwork/guc-logo.jpg`).then((r) => r.ok ? r.arrayBuffer() : null).catch(() => null);
      const bytes = await saoFormPdf(form, v, logo);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const title = (v.eventName || v.sponsorName || v.memoSubject || '').replace(/[^\w\- ]+/g, '').trim();
      a.href = url; a.download = `TEDxGUC - ${form.name}${title ? ' - ' + title : ''}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast('ok', 'PDF downloaded.', 'Print it and collect the signatures.');
    } catch (e) { toast('bad', 'Couldn’t make the PDF.', (e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" className="tx-link text-body-sm mb-s4 inline-flex items-center gap-s2 bg-transparent border-0 cursor-pointer" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />All forms</button>
      <PageTitle label={`Paperwork · ${form.cat}`} title={form.name} />
      <div className="grid gap-s6 lg:grid-cols-[1fr_300px] items-start">
        <div className="tx-card grid gap-s4 sm:grid-cols-2">
          <TextInput label="AWG Name" value="TEDxGUC" disabled />
          <div className="hidden sm:block" />
          {form.fields.map((f, i) => {
            if (f.t === 'heading') return <h3 key={i} className="h4 sm:col-span-2 mt-s3">{f.label}</h3>;
            if (f.t === 'speakers') return (
              <fieldset key={f.k} className="sm:col-span-2 grid gap-s3 sm:grid-cols-2">
                <legend className="tx-label mb-s2">{f.label}</legend>
                {Array.from({ length: f.n }, (_, j) => j + 1).flatMap((n) => [
                  <TextInput key={`n${n}`} label={`Speaker ${n} name`} value={v[`${f.k}${n}name`] ?? ''} onChange={(e) => set(`${f.k}${n}name`, e.target.value)} />,
                  <TextInput key={`t${n}`} label={`Speaker ${n} title / field`} value={v[`${f.k}${n}title`] ?? ''} onChange={(e) => set(`${f.k}${n}title`, e.target.value)} />,
                ])}
              </fieldset>
            );
            if (f.t === 'radio') return (
              <fieldset key={f.k} className="sm:col-span-2 grid gap-s2">
                <legend className="tx-label mb-s2">{f.label}{f.req ? ' *' : ''}</legend>
                <div className="flex flex-wrap gap-x-s5 gap-y-s2">
                  {f.opts.map((o) => <label key={o} className="tx-check"><input type="radio" name={f.k} checked={v[f.k] === o} onChange={() => set(f.k, o)} /><span>{o}</span></label>)}
                </div>
                {f.other && v[f.k] === 'Others' && <TextInput label="Specify" value={v[`${f.k}Other`] ?? ''} onChange={(e) => set(`${f.k}Other`, e.target.value)} />}
              </fieldset>
            );
            const label = f.label + (f.req ? ' *' : '');
            if (f.t === 'textarea') return <div key={f.k} className="sm:col-span-2 grid gap-s2"><TextArea label={label} placeholder={f.k === 'memoBody' ? 'Write the memo, or fill in the amount, justification and subject and click Draft with AI.' : f.ph} rows={f.k === 'memoBody' ? 8 : 3} value={v[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} />{f.k === 'memoBody' && <div><Button small variant="secondary" onClick={aiDraft} loading={drafting}><Sparkles size={16} aria-hidden="true" />{v.memoBody?.trim() ? 'Improve with AI' : 'Draft with AI'}</Button></div>}</div>;
            return <div key={f.k} className={f.half ? '' : 'sm:col-span-2'}><TextInput label={label} type={f.t} placeholder={f.ph} value={v[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} /></div>;
          })}
          {form.services?.length ? (
            <div className="sm:col-span-2 grid gap-s4">
              <h3 className="h4 mt-s3">Needed services</h3>
              <div className="grid gap-s4 sm:grid-cols-2 xl:grid-cols-3">
                {form.services.map((g) => { const grp = SERVICE_GROUPS[g]; return (
                  <fieldset key={g} className="grid gap-s2 content-start">
                    <legend className="tx-label mb-s2">{grp.label}</legend>
                    {grp.items.map((it) => <Check2 key={it} label={it} checked={v[`svc:${g}:${it}`] === '1'} onChange={(e) => set(`svc:${g}:${it}`, e.target.checked ? '1' : '')} />)}
                    {grp.other && <TextInput label="Others" value={v[`svc:${g}:other`] ?? ''} onChange={(e) => set(`svc:${g}:other`, e.target.value)} />}
                  </fieldset>
                ); })}
              </div>
            </div>
          ) : null}
          <div className="sm:col-span-2 flex flex-wrap gap-s3 items-center mt-s3">
            <Button onClick={download} loading={busy}><Download aria-hidden="true" />Download PDF</Button>
            <span className="text-caption text-ink-3">Signature boxes are left empty for signing by hand.</span>
          </div>
        </div>
        <aside className="tx-card tx-card--outline grid gap-s3">
          <h3 className="h4">SAO rules</h3>
          <ul className="grid gap-s2 text-body-sm text-ink-2 list-disc pl-s5">{form.rules.map((r) => <li key={r}>{r}</li>)}</ul>
          {form.attachments?.length ? <><h3 className="h4 mt-s2">Bring with it</h3>
            <ul className="grid gap-s2 text-body-sm text-ink-2 list-disc pl-s5">{form.attachments.map((r) => <li key={r}>{r}</li>)}</ul></> : null}
        </aside>
      </div>
    </>
  );
}
