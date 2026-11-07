// Fills the official GUC / SAO papers (blank PDFs in public/paperwork) and
// returns one PDF ready to print and sign by hand. Box positions come from
// sao-layouts.json, made once from the official papers.
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import layouts from './sao-layouts.json';
import { SAO_ADVISOR, SAO_CLUB, type SaoForm } from './sao-forms';

export type SaoValues = Record<string, string>;
type Box = { x: number; y: number; w: number; h: number; prefix?: number };
type Layout = { file: string; text: Record<string, Box | Box[]>; checks: Record<string, { x: number; y: number }>; specify: Record<string, Box>; advisor: Box | null; awg: Box | null; boxes: { x: number; y: number }[] };

const INK = rgb(0, 0, 0); // same black as the printed form
const DARK = rgb(0.07, 0.07, 0.07);
const WHITE = rgb(1, 1, 1);

// Standard PDF fonts only cover Latin text.
const clean = (s: string) => String(s ?? '')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
  .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
const fmtDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v;
const money = (v: string) => v && !isNaN(Number(v)) ? `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP` : v;

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) { line = next; continue; }
      out.push(line); line = word;
    }
    out.push(line);
  }
  return out;
}

// Write text inside a table cell, shrinking it to fit. Clears the cell first
// (some official papers still carry sample text).
function fillCell(page: PDFPage, font: PDFFont, b: Box, value: string, clear = true) {
  if (clear) page.drawRectangle({ x: b.x + 1.2, y: b.y + 1.2, width: b.w - 2.4, height: b.h - 2.4, color: WHITE });
  if (!value.trim()) return;
  const pad = 3, x = b.x + pad + (b.prefix ?? 0), w = b.w - 2 * pad - (b.prefix ?? 0), h = b.h - 2 * pad;
  let size = 9, lines = wrap(value, font, size, w);
  while (size > 5 && lines.length * size * 1.2 > h) { size -= 0.5; lines = wrap(value, font, size, w); }
  const lh = size * 1.2, total = lines.length * lh;
  // Centre the block in the cell, each line centred too.
  let y = b.y + b.h / 2 + total / 2 - size * 0.9;
  for (const l of lines) { page.drawText(l, { x: x + (w - font.widthOfTextAtSize(l, size)) / 2, y, size, font, color: INK }); y -= lh; }
}

function tick(page: PDFPage, p: { x: number; y: number }) {
  const x = p.x + 1.3, y = p.y - 0.1, s = 6.2;
  page.drawLine({ start: { x, y }, end: { x: x + s, y: y + s }, thickness: 1.3, color: INK });
  page.drawLine({ start: { x, y: y + s }, end: { x: x + s, y }, thickness: 1.3, color: INK });
}

export async function saoFormPdf(form: SaoForm, v: SaoValues, load: (file: string) => Promise<ArrayBuffer>): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  out.setTitle(`${form.name} - ${SAO_CLUB}`);
  if (form.key === 'expense') {
    await expensePage(out, await out.embedFont(StandardFonts.TimesRoman), v, load);
    await memoPage(out, await out.embedFont(StandardFonts.Helvetica), v, load);
    return out.save();
  }
  const L = (layouts as unknown as Record<string, Layout>)[form.key];
  // Same font as the paper: Times New Roman Bold, or Calibri Bold (Carlito has the same shapes) on the sponsorship forms.
  let font: PDFFont;
  if (form.cat === 'Sponsorship') { out.registerFontkit(fontkit); font = await out.embedFont(await load('carlito-bold.woff'), { subset: true }); }
  else font = await out.embedFont(StandardFonts.TimesRomanBold);
  const src = await PDFDocument.load(await load(L.file));
  const [page] = await out.copyPages(src, [0]);
  out.addPage(page);

  // Redraw every checkbox as a clean empty square (some official files print them as solid blocks).
  for (const b of L.boxes) {
    page.drawRectangle({ x: b.x - 0.5, y: b.y - 3, width: 10, height: 13.5, color: WHITE });
    page.drawRectangle({ x: b.x + 0.3, y: b.y - 1, width: 8, height: 8, borderColor: rgb(0, 0, 0), borderWidth: 0.9 });
  }
  if (L.awg) fillCell(page, font, L.awg, SAO_CLUB);
  for (const f of form.fields) {
    if (!('k' in f)) continue;
    const at = L.text[f.k];
    if (f.t === 'speakers') {
      if (Array.isArray(at)) at.forEach((b, i) => fillCell(page, font, b, [v[`${f.k}${i + 1}name`], v[`${f.k}${i + 1}title`]].filter(Boolean).join(' - '), false));
      continue;
    }
    if (f.t === 'radio') {
      const p = L.checks[`${f.k}:${v[f.k]}`]; if (p) tick(page, p);
      const s = L.specify[`${f.k}Other`]; if (s && v[f.k] === 'Others' && v[`${f.k}Other`]) fillCell(page, font, s, v[`${f.k}Other`]);
      continue;
    }
    if (!at || Array.isArray(at)) continue;
    const raw = v[f.k] ?? '';
    fillCell(page, font, at, f.t === 'date' ? fmtDate(raw) : 'money' in f && f.money ? money(raw) : raw);
  }
  for (const [k, p] of Object.entries(L.checks)) if (k.startsWith('svc:') && !k.endsWith(':other') && v[k] === '1') tick(page, p);
  for (const g of form.services ?? []) {
    const other = (v[`svc:${g}:other`] ?? '').trim();
    if (!other) continue;
    const p = L.checks[`svc:${g}:other`]; if (p) tick(page, p);
    const s = L.specify[`svc:${g}:other`]; if (s) fillCell(page, font, s, other);
  }
  if (L.advisor) fillCell(page, font, L.advisor, SAO_ADVISOR);
  return out.save();
}

// Expense Approval Request (Student Financial Affairs): values go on the printed lines.
async function expensePage(out: PDFDocument, font: PDFFont, v: SaoValues, load: (f: string) => Promise<ArrayBuffer>) {
  const src = await PDFDocument.load(await load('expense.pdf'));
  const [page] = await out.copyPages(src, [0]); out.addPage(page);
  // Each value is centred on its printed line (from, to = the line's ends).
  const put = (s: string, from: number, to: number, y: number, start = 11) => {
    let size = start; const t = clean(s);
    while (size > 6 && font.widthOfTextAtSize(t, size) > to - from - 4) size -= 0.5;
    page.drawText(t, { x: from + (to - from - font.widthOfTextAtSize(t, size)) / 2, y: y + 2.5, size, font, color: INK });
  };
  put(fmtDate(v.requestedDate ?? ''), 170, 352, 507);
  put(SAO_CLUB, 160, 357, 479);
  put(v.requestedBy ?? '', 160, 332, 452);
  put(v.academicAdvisor || SAO_ADVISOR, 186, 343, 424);
  put(money(v.amount ?? ''), 178, 261, 369);
  let size = 11, ls = wrap(v.justification ?? '', font, size, 410);
  while (ls.length > 2 && size > 6) { size -= 0.5; ls = wrap(v.justification ?? '', font, size, 410); }
  ([[90, 459, 321], [90, 517, 300]] as const).forEach(([a, b, y], i) => { if (ls[i]) put(ls[i], a, b, y, size); });
}

// TEDxGUC memo template: date, subject and body.
async function memoPage(out: PDFDocument, font: PDFFont, v: SaoValues, load: (f: string) => Promise<ArrayBuffer>) {
  const src = await PDFDocument.load(await load('memo.pdf'));
  const [page] = await out.copyPages(src, [0]); out.addPage(page);
  const today = new Date().toISOString().slice(0, 10);
  page.drawText(clean(fmtDate(v.requestedDate || today)), { x: 140, y: 614, size: 11, font, color: DARK });
  page.drawText(clean(v.memoSubject ?? ''), { x: 140, y: 591, size: 11, font, color: DARK, maxWidth: 400 });
  page.drawRectangle({ x: 52, y: 527, width: 200, height: 18, color: WHITE }); // hides "[Write the memo here.]"
  const body = (v.memoBody ?? '').trim();
  let size = 11, lines = wrap(body, font, size, 486);
  while (size > 7 && lines.length * size * 1.45 > 290) { size -= 0.5; lines = wrap(body, font, size, 486); }
  let y = 533;
  for (const l of lines) { page.drawText(l, { x: 54, y, size, font, color: DARK }); y -= size * 1.45; }
}
