'use client';
// Google-Forms-style questions: managers build them (FormBuilder), members
// answer them (FormFill). Used by sign-ups (packages, trips, anything).
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from 'lucide-react';
import { Button, Check2, Select, TextArea, TextInput } from '@/components/ui';
import type { FormAnswer, FormQuestion, FormQuestionKind } from '@/lib/types';

export const questionKinds: { value: FormQuestionKind; label: string }[] = [
  { value: 'short', label: 'Short answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'choice', label: 'Multiple choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'phone', label: 'Phone number' },
];
const hasOptions = (k: FormQuestionKind) => k === 'choice' || k === 'checkboxes' || k === 'dropdown';
const newId = () => `q${Math.random().toString(36).slice(2, 8)}`;

export function FormBuilder({ value, onChange }: { value: FormQuestion[]; onChange: (q: FormQuestion[]) => void }) {
  const set = (i: number, patch: Partial<FormQuestion>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = () => onChange([...value, { id: newId(), label: '', kind: 'short', required: false, options: [] }]);

  return (
    <div className="grid gap-s3">
      {value.length === 0 && <p className="text-body-sm text-ink-2">No questions yet. Members only confirm their name, email and phone.</p>}
      {value.map((q, i) => (
        <div key={q.id} className="tx-card grid gap-s3" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="grid gap-s3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <TextInput label={`Question ${i + 1}`} value={q.label} maxLength={160} placeholder="Untitled question" onChange={(e) => set(i, { label: e.target.value })} />
            <Select label="Type" value={q.kind} onChange={(e) => {
              const kind = e.target.value as FormQuestionKind;
              set(i, { kind, options: hasOptions(kind) ? (q.options.length ? q.options : ['Option 1']) : [] });
            }}>
              {questionKinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </Select>
          </div>
          {hasOptions(q.kind) && (
            <div className="grid gap-s2">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-s2">
                  <span aria-hidden="true" className="shrink-0 w-[16px] h-[16px] border border-line-strong" style={{ borderRadius: q.kind === 'choice' ? '50%' : q.kind === 'checkboxes' ? 2 : 0 }}>{q.kind === 'dropdown' ? <span className="text-caption text-ink-3 pl-[2px]">{oi + 1}</span> : null}</span>
                  <input className="tx-input flex-1 min-w-0" aria-label={`Option ${oi + 1}`} value={o} maxLength={100}
                    onChange={(e) => set(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} />
                  <button type="button" className="tx-iconbtn" aria-label={`Remove option ${oi + 1}`} disabled={q.options.length < 2}
                    onClick={() => set(i, { options: q.options.filter((_, k) => k !== oi) })}><X size={16} /></button>
                </div>
              ))}
              <div><Button type="button" variant="ghost" small onClick={() => set(i, { options: [...q.options, `Option ${q.options.length + 1}`] })}><Plus size={16} aria-hidden="true" />Add option</Button></div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-s2 border-t border-line pt-s2">
            <Check2 label="Required" checked={q.required} onChange={(e) => set(i, { required: e.target.checked })} />
            <span className="flex items-center gap-s1">
              <button type="button" className="tx-iconbtn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
              <button type="button" className="tx-iconbtn" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
              <button type="button" className="tx-iconbtn" aria-label="Duplicate question" onClick={() => onChange([...value.slice(0, i + 1), { ...q, id: newId() }, ...value.slice(i + 1)])}><Copy size={16} /></button>
              <button type="button" className="tx-iconbtn" aria-label="Delete question" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </span>
          </div>
        </div>
      ))}
      <div><Button type="button" variant="secondary" small onClick={add}><Plus size={16} aria-hidden="true" />Add question</Button></div>
    </div>
  );
}

export function FormFill({ questions, value, onChange, errors = {} }: {
  questions: FormQuestion[]; value: Record<string, FormAnswer>; onChange: (v: Record<string, FormAnswer>) => void; errors?: Record<string, string>;
}) {
  const set = (id: string, a: FormAnswer) => onChange({ ...value, [id]: a });
  return (
    <>
      {questions.map((q) => {
        const label = `${q.label}${q.required ? ' *' : ''}`;
        const err = errors[q.id];
        const str = typeof value[q.id] === 'string' ? (value[q.id] as string) : '';
        if (q.kind === 'paragraph') return <TextArea key={q.id} label={label} rows={3} value={str} error={err} onChange={(e) => set(q.id, e.target.value)} />;
        if (q.kind === 'dropdown') {
          return (
            <Select key={q.id} label={label} value={str} error={err} onChange={(e) => set(q.id, e.target.value)}>
              <option value="">Choose</option>
              {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          );
        }
        if (q.kind === 'choice' || q.kind === 'checkboxes') {
          const arr = Array.isArray(value[q.id]) ? (value[q.id] as string[]) : [];
          return (
            <fieldset key={q.id} className={`tx-field ${err ? 'is-error' : ''}`}>
              <legend className="tx-label mb-s2">{label}</legend>
              <div className="grid gap-s2">
                {q.options.map((o) => (
                  <label key={o} className="tx-check">
                    <input type={q.kind === 'choice' ? 'radio' : 'checkbox'} name={q.id} checked={q.kind === 'choice' ? str === o : arr.includes(o)}
                      onChange={(e) => (q.kind === 'choice' ? set(q.id, o) : set(q.id, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o)))} />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
              {err && <p className="tx-help" role="alert">{err}</p>}
            </fieldset>
          );
        }
        const type = q.kind === 'number' ? 'number' : q.kind === 'date' ? 'date' : q.kind === 'phone' ? 'tel' : 'text';
        return <TextInput key={q.id} label={label} type={type} value={str} error={err} onChange={(e) => set(q.id, e.target.value)} />;
      })}
    </>
  );
}

export function missingAnswers(questions: FormQuestion[], value: Record<string, FormAnswer>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of questions) {
    const a = value[q.id];
    if (q.required && (a === undefined || (Array.isArray(a) ? a.length === 0 : !String(a).trim()))) out[q.id] = 'This question is required.';
  }
  return out;
}

export const answerText = (a: FormAnswer | undefined) => (Array.isArray(a) ? a.join(', ') : a ?? '');
