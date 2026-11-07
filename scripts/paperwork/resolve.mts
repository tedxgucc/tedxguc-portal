// Rebuild web/src/lib/sao-layouts.json from the official blank PDFs (needs pdfjs-dist; see scripts/paperwork).
// Build step: reads the official blank PDFs and works out where each answer goes.
import fs from 'node:fs';
import path from 'node:path';
import { layout } from './layout.mjs';
import { SAO_FORMS, SERVICE_GROUPS } from './sao-forms.ts';

const SRC = path.resolve('../sao-src/pdf');
const WEB = 'C:/Users/sg/Documents/tedxguc-portal/web';
const FILES: Record<string, string> = {
  general: 'SAO General Event Approval 2023', entertainment: 'SAO Entertainment Event Approval 2023', educational: 'SAO Educational Approval 2023',
  sports: 'SAO Sports Approval 2023', ceremony: 'SAO Opening-Closing Approval 2023', recruitment: 'SAO Recruitment Approval 2023',
  booth: 'SAO Marketing Booth Approval 2023', sponsorAgreement: 'SAO Sponsorship Agreement 2023', fnbAgreement: 'SAO Food&Baverages Sponsorship Agreement 2023',
};
type Cell = { x: number; y: number; w: number; h: number; text: string };
const norm = (s: string) => s.toLowerCase().replace(/\(egp\)/g, '').replace(/[^a-z0-9]/g, '');
const vOverlap = (a: Cell, b: Cell) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
const hOverlap = (a: Cell, b: Cell) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
const box = (c: Cell) => ({ x: c.x, y: c.y, w: c.w, h: c.h });

const out: Record<string, unknown> = {};
for (const form of SAO_FORMS) {
  const file = FILES[form.key]; if (!file) continue;
  const L = await layout(path.join(SRC, file + '.pdf'));
  const cells: Cell[] = L.cells.filter((c: Cell) => c.w < 500 || c.h < 400);
  const right = (c: Cell) => cells.filter((n) => Math.abs(n.x - (c.x + c.w)) < 3 && vOverlap(n, c) > 4).sort((a, b) => vOverlap(b, c) - vOverlap(a, c))[0];
  const left = (c: Cell) => cells.filter((n) => Math.abs(n.x + n.w - c.x) < 3 && vOverlap(n, c) > 4).sort((a, b) => vOverlap(b, c) - vOverlap(a, c))[0];
  const below = (c: Cell) => cells.filter((n) => Math.abs(n.y + n.h - c.y) < 6 && hOverlap(n, c) > 4).sort((a, b) => hOverlap(b, c) - hOverlap(a, c))[0];
  const find = (label: string) => cells.find((c) => norm(c.text) === norm(label)) ?? cells.find((c) => norm(c.text).startsWith(norm(label)) && norm(label).length > 4);

  const text: Record<string, unknown> = {};
  const missing: string[] = [];
  const radios = form.fields.filter((f) => f.t === 'radio') as { k: string; label: string; opts: string[] }[];
  for (const f of form.fields) {
    if (!('k' in f) || f.t === 'radio' || f.t === 'heading') continue;
    if (f.t === 'speakers') {
      const rows = [1, 2, 3].map((n) => cells.find((c) => norm(c.text) === String(n))).filter(Boolean) as Cell[];
      text[f.k] = rows.map((c) => ({ ...box(c), prefix: 18 }));
      continue;
    }
    const lc = find(f.label);
    const vc = lc && (right(lc) ?? below(lc));
    if (!vc) { missing.push(f.label); continue; }
    text[f.k] = box(vc);
  }
  // Checkboxes.
  const groupHeads = (form.services ?? []).map((g) => ({ key: g, cell: find(SERVICE_GROUPS[g].label) }));
  const radioHeads = radios.map((r) => ({ key: r.k, cell: find(r.label) }));
  const checks: Record<string, { x: number; y: number }> = {};
  const rowUsesRight = new Set<number>();
  for (const b of L.boxes) {
    const l = b.cell && left(b.cell);
    if (l && radios.some((r) => norm(r.label) === norm(l.text))) rowUsesRight.add(Math.round(b.y));
  }
  for (const b of L.boxes) {
    if (!b.cell) continue;
    if (rowUsesRight.has(Math.round(b.y))) {
      const rowRadio = radios.find((r) => L.boxes.some((x: { y: number; cell: Cell }) => Math.round(x.y) === Math.round(b.y) && x.cell && left(x.cell) && norm(left(x.cell)!.text) === norm(r.label)))!;
      const r = right(b.cell); const opt = rowRadio.opts.find((o) => r && norm(o) === norm(r.text));
      if (opt) checks[`${rowRadio.k}:${opt}`] = { x: b.x, y: b.y }; else missing.push(`box row ${rowRadio.label} -> ${r?.text}`);
      continue;
    }
    const l = left(b.cell); if (!l || !l.text.trim()) continue;
    const heads = [...groupHeads.map((h) => ({ ...h, kind: 'svc' })), ...radioHeads.map((h) => ({ ...h, kind: 'radio' }))]
      .filter((h) => h.cell && h.cell.y > l.y && hOverlap(h.cell, l) > 2).sort((a, b) => a.cell!.y - b.cell!.y);
    const h = heads[0]; if (!h) { missing.push(`box ${l.text} no group`); continue; }
    if (h.kind === 'radio') {
      const r = radios.find((x) => x.k === h.key)!; const opt = r.opts.find((o) => norm(o) === norm(l.text));
      if (opt) checks[`${r.k}:${opt}`] = { x: b.x, y: b.y }; else missing.push(`radio ${r.label} option ${l.text}`);
    } else {
      const g = SERVICE_GROUPS[h.key]; const item = g.items.find((i) => norm(i) === norm(l.text));
      if (item) checks[`svc:${h.key}:${item}`] = { x: b.x, y: b.y };
      else if (norm(l.text) === 'others') checks[`svc:${h.key}:other`] = { x: b.x, y: b.y };
      else missing.push(`svc ${g.label} item ${l.text}`);
    }
  }
  // "Specify" boxes for Others.
  const specify: Record<string, unknown> = {};
  for (const h of [...groupHeads.map((x) => ({ k: `svc:${x.key}:other`, cell: x.cell })), ...radioHeads.map((x) => ({ k: `${x.key}Other`, cell: x.cell }))]) {
    if (!h.cell) continue;
    const s = cells.filter((c) => norm(c.text) === 'specify' && c.y < h.cell!.y && hOverlap(c, h.cell!) > 2).sort((a, b) => b.y - a.y)[0];
    if (s) specify[h.k] = box(s);
  }
  const adv = find('Academic Advisor'); const advCell = adv && left(adv);
  for (const s of form.services ?? []) for (const it of SERVICE_GROUPS[s].items) {
    if (checks[`svc:${s}:${it}`]) continue;
    const head = groupHeads.find((h) => h.key === s)?.cell;
    const lc = head && cells.filter((c) => norm(c.text) === norm(it) && c.y < head.y && hOverlap(c, head) > 2).sort((a, b) => b.y - a.y)[0];
    const r = lc && right(lc);
    if (r) checks[`svc:${s}:${it}`] = { x: r.x + Math.min(r.w, 20) / 2 - 4, y: r.y + r.h / 2 - 3.5 };
    else missing.push(`no box svc ${s}:${it}`);
  }
  for (const r of radios) for (const o of r.opts) if (!checks[`${r.k}:${o}`]) missing.push(`no box ${r.k}:${o}`);
  const awgL = find('AWG Name'); const awgV = awgL && right(awgL);
  out[form.key] = { file: `${form.key}.pdf`, text, checks, specify, advisor: advCell ? box(advCell) : null, awg: awgV ? box(awgV) : null, boxes: L.boxes.map((b: { x: number; y: number }) => ({ x: b.x, y: b.y })) };
  fs.copyFileSync(path.join(SRC, file + '.pdf'), `${WEB}/public/paperwork/${form.key}.pdf`);
  console.log(form.key, 'fields', Object.keys(text).length, 'checks', Object.keys(checks).length, 'specify', Object.keys(specify).length, 'advisor', !!advCell, missing.length ? 'MISSING: ' + missing.join(' | ') : 'ok');
}
fs.copyFileSync(path.join(SRC, 'Expense Approval.pdf'), `${WEB}/public/paperwork/expense.pdf`);
fs.copyFileSync(path.join(SRC, 'TEDxGUC Memo Template.pdf'), `${WEB}/public/paperwork/memo.pdf`);
fs.writeFileSync(`${WEB}/src/lib/sao-layouts.json`, JSON.stringify(out));
