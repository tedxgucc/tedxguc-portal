'use client';
// Editable site text (FR-1.4). Pages render the saved text on the server;
// in demo mode the browser holds the edits, so these re-read it there.
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DEMO } from '@/lib/env';
import { DIVISION_KEYS } from '@/lib/sections';
import type { Section } from '@/lib/types';

function useSections(initial: Record<string, Section>, keys: string[]) {
  const [s, setS] = useState(initial);
  const k = keys.join(',');
  useEffect(() => {
    if (!DEMO) return;
    api.getSections(k.split(',')).then(setS).catch(() => {});
  }, [k]);
  return s;
}

export function SectionText({ k, initial, fallback, className }: { k: string; initial?: Section; fallback: string; className?: string }) {
  const s = useSections(initial ? { [k]: initial } : {}, [k]);
  return <p className={className}>{s[k]?.body.text ?? fallback}</p>;
}

export function FaqList({ initial }: { initial?: Section }) {
  const s = useSections(initial ? { faq: initial } : {}, ['faq']);
  return (
    <div className="grid">
      {(s.faq?.body.items ?? []).map((item) => (
        <details key={item.q} className="border-b border-line py-s3 group">
          <summary className="font-semibold cursor-pointer list-none flex justify-between gap-s3">
            {item.q}<span className="text-accent font-display text-h4" aria-hidden="true">*</span>
          </summary>
          <p className="text-ink-2 mt-s2">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

const tag: Record<string, string> = { talks: 'talks', operations: 'ops', org_development: 'od', marketing: 'mc' };

export function DivisionSections({ initial }: { initial: Record<string, Section> }) {
  const s = useSections(initial, DIVISION_KEYS);
  const list = DIVISION_KEYS.map((k) => s[k]).filter(Boolean);
  if (!list.length) return null;
  return (
    <ul className="grid gap-s3 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((x) => (
        <li key={x.key} className="tx-card grid gap-s2 content-start">
          <span className={`tx-tag tx-tag--${tag[x.key]}`}>{x.title}</span>
          {x.body.text && <p className="text-ink-2 text-body-sm">{x.body.text}</p>}
        </li>
      ))}
    </ul>
  );
}
