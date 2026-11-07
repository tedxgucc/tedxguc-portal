// Builds a filled SAO form as a PDF, laid out like the paper form, with
// empty signature boxes so it can be printed and signed by hand.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { SAO_CLUB, SERVICE_GROUPS, type SaoForm } from './sao-forms';

export type SaoValues = Record<string, string>;
// Ticked services are stored as values[`svc:<group>:<item>`] = '1'; "Others" text in values[`svc:<group>:other`].

const INK = rgb(0.08, 0.08, 0.08);
const GREY = rgb(0.42, 0.4, 0.38);
const LINE = rgb(0.6, 0.6, 0.6);
const SHADE = rgb(0.93, 0.93, 0.93);
const RED = rgb(0.89, 0.12, 0.14);
const W = 595.28, H = 841.89, M = 40, CW = W - 2 * M;

// Standard PDF fonts only cover Latin text.
const clean = (s: string) => String(s ?? '')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
  .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
      line = word;
      while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
        let i = line.length; while (i > 1 && font.widthOfTextAtSize(line.slice(0, i), size) > width) i--;
        out.push(line.slice(0, i)); line = line.slice(i);
      }
    }
    out.push(line);
  }
  return out;
}

const fmtDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`;
};
const money = (v: string) => v && !isNaN(Number(v)) ? `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP` : v;

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(public doc: PDFDocument, public font: PDFFont, public bold: PDFFont, public logo: PDFImage | null, public title: string) {}
  newPage() {
    this.page = this.doc.addPage([W, H]);
    const p = this.page;
    if (this.logo) { const s = 42 / this.logo.height; p.drawImage(this.logo, { x: M, y: H - M - 42, width: this.logo.width * s, height: 42 }); }
    const t = clean(this.title);
    p.drawText(t, { x: W - M - this.bold.widthOfTextAtSize(t, 15), y: H - M - 18, size: 15, font: this.bold, color: INK });
    const sub = 'Student Activities Office';
    p.drawText(sub, { x: W - M - this.font.widthOfTextAtSize(sub, 9), y: H - M - 34, size: 9, font: this.font, color: GREY });
    p.drawLine({ start: { x: M, y: H - M - 52 }, end: { x: W - M, y: H - M - 52 }, thickness: 1.2, color: RED });
    this.y = H - M - 66;
  }
  ensure(h: number) { if (this.y - h < M + 20) this.newPage(); }
  box(x: number, y: number, w: number, h: number, fill = false) {
    this.page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: LINE, borderWidth: 0.6, color: fill ? SHADE : undefined });
  }
  text(s: string, x: number, y: number, size = 9.5, f: PDFFont = this.font, color = INK) {
    this.page.drawText(clean(s), { x, y, size, font: f, color });
  }
  check(x: number, y: number, on: boolean) {
    this.page.drawRectangle({ x, y: y - 1, width: 8, height: 8, borderColor: INK, borderWidth: 0.7 });
    if (on) {
      this.page.drawLine({ start: { x: x + 1.5, y: y + 0.5 }, end: { x: x + 6.5, y: y + 5.5 }, thickness: 1, color: INK });
      this.page.drawLine({ start: { x: x + 1.5, y: y + 5.5 }, end: { x: x + 6.5, y: y + 0.5 }, thickness: 1, color: INK });
    }
  }
  section(label: string) {
    this.ensure(48);
    this.y -= 8;
    this.page.drawRectangle({ x: M, y: this.y - 16, width: CW, height: 16, color: INK });
    this.text(label.toUpperCase(), M + 6, this.y - 11.5, 8.5, this.bold, rgb(1, 1, 1));
    this.y -= 16;
  }
  // One row of [label, value] cells side by side.
  row(cells: [string, string][]) {
    const w = CW / cells.length, lw = Math.min(110, w * 0.42);
    const lines = cells.map(([, v]) => wrap(v || '', this.font, 9.5, w - lw - 10));
    const h = Math.max(20, ...lines.map((l) => l.length * 12 + 8));
    this.ensure(h);
    cells.forEach(([label], i) => {
      const x = M + i * w;
      this.box(x, this.y, lw, h, true); this.box(x + lw, this.y, w - lw, h);
      wrap(label, this.bold, 8.5, lw - 8).forEach((l, j) => this.text(l, x + 5, this.y - 13 - j * 11, 8.5, this.bold));
      lines[i].forEach((l, j) => this.text(l, x + lw + 5, this.y - 13 - j * 12));
    });
    this.y -= h;
  }
  // Label bar then a big box of text.
  block(label: string, value: string, minH = 46) {
    const lines = wrap(value || '', this.font, 9.5, CW - 12);
    const h = Math.max(minH, lines.length * 12.5 + 10);
    this.ensure(18 + Math.min(h, 120));
    this.box(M, this.y, CW, 16, true); this.text(label, M + 5, this.y - 11.5, 8.5, this.bold); this.y -= 16;
    let i = 0;
    while (i < lines.length || i === 0) {
      const room = Math.floor((this.y - M - 24) / 12.5);
      const take = lines.slice(i, i + Math.max(1, room));
      const bh = Math.max(i === 0 ? minH : 20, take.length * 12.5 + 10);
      this.box(M, this.y, CW, bh);
      take.forEach((l, j) => this.text(l, M + 6, this.y - 14 - j * 12.5));
      this.y -= bh; i += take.length;
      if (i < lines.length) this.newPage();
      if (!lines.length) break;
    }
  }
  options(label: string, opts: string[], chosen: string, other?: string) {
    this.ensure(22);
    const lw = 110; let x = M + lw + 8;
    const rows: { x: number; o: string }[][] = [[]];
    for (const o of opts) {
      const t = o === 'Others' && chosen === 'Others' && other ? `Others: ${other}` : o;
      const w = 14 + this.font.widthOfTextAtSize(clean(t), 9.5) + 16;
      if (x + w > W - M) { rows.push([]); x = M + lw + 8; }
      rows[rows.length - 1].push({ x, o }); x += w;
    }
    const h = rows.length * 16 + 6;
    this.box(M, this.y, lw, h, true); this.box(M + lw, this.y, CW - lw, h);
    this.text(label, M + 5, this.y - 13, 8.5, this.bold);
    rows.forEach((r, ri) => r.forEach(({ x: ox, o }) => {
      const yy = this.y - 13 - ri * 16;
      this.check(ox, yy, chosen === o);
      this.text(o === 'Others' && chosen === 'Others' && other ? `Others: ${other}` : o, ox + 13, yy);
    }));
    this.y -= h;
  }
  services(groups: string[], v: SaoValues) {
    this.section('Needed Services');
    const cols = 3, gw = CW / cols;
    for (let i = 0; i < groups.length; i += cols) {
      const set = groups.slice(i, i + cols).map((g) => SERVICE_GROUPS[g]).filter(Boolean);
      const keys = groups.slice(i, i + cols);
      const h = 22 + Math.max(...set.map((g) => g.items.length + (g.other ? 1 : 0))) * 14;
      this.ensure(h);
      set.forEach((g, j) => {
        const x = M + j * gw;
        this.box(x, this.y, gw, h);
        this.text(g.label, x + 6, this.y - 13, 8.5, this.bold);
        g.items.forEach((item, k) => {
          const yy = this.y - 28 - k * 14;
          this.check(x + 8, yy, v[`svc:${keys[j]}:${item}`] === '1');
          this.text(item, x + 21, yy, 9);
        });
        if (g.other) {
          const yy = this.y - 28 - g.items.length * 14, o = v[`svc:${keys[j]}:other`] || '';
          this.check(x + 8, yy, !!o.trim());
          this.text(o.trim() ? `Others: ${o}`.slice(0, 34) : 'Others: ____________', x + 21, yy, 9);
        }
      });
      this.y -= h;
    }
  }
  attachments(list: string[]) {
    this.section('Attachments');
    for (const a of list) { this.ensure(16); this.check(M + 6, this.y - 12, false); this.text(a, M + 20, this.y - 12); this.y -= 15; }
  }
  signatures(names: string[], withComments = true) {
    const per = Math.min(names.length, 4), w = CW / per, h = 70;
    this.ensure(30 + h + (withComments ? 50 : 0));
    this.section('Signatures');
    names.forEach((n, i) => {
      const x = M + (i % per) * w;
      this.box(x, this.y, w, h);
      this.page.drawLine({ start: { x: x + 10, y: this.y - h + 22 }, end: { x: x + w - 10, y: this.y - h + 22 }, thickness: 0.5, color: LINE });
      this.text(n, x + 8, this.y - h + 9, 8.5, this.bold, GREY);
      this.text('Date: ___________', x + 8, this.y - 14, 7.5, this.font, GREY);
    });
    this.y -= h;
    if (withComments) { this.box(M, this.y, CW, 46); this.text('Comments', M + 6, this.y - 13, 8.5, this.bold, GREY); this.y -= 46; }
  }
}

export async function saoFormPdf(form: SaoForm, v: SaoValues, logoBytes?: ArrayBuffer | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${form.name} - ${SAO_CLUB}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = logoBytes ? await doc.embedJpg(logoBytes).catch(() => null) : null;
  const w = new Writer(doc, font, bold, logo, form.name);
  w.newPage();

  w.row([['AWG Name', SAO_CLUB]]);
  const val = (f: { k: string; t: string; money?: boolean }) => {
    const x = v[f.k] ?? '';
    return f.t === 'date' ? fmtDate(x) : f.money ? money(x) : x;
  };
  let pair: [string, string][] = [];
  const flush = () => { if (pair.length) { w.row(pair); pair = []; } };
  for (const f of form.fields) {
    if (form.memo && 'k' in f && f.k.startsWith('memo')) continue; // memo goes on page 2
    if (f.t === 'heading') { if (!form.memo) { flush(); w.section(f.label); } continue; }
    if ((f.t === 'text' || f.t === 'date' || f.t === 'number') && f.half) {
      pair.push([f.label, val(f)]); if (pair.length === 2) flush(); continue;
    }
    flush();
    if (f.t === 'text' || f.t === 'date' || f.t === 'number') w.row([[f.label, val(f)]]);
    else if (f.t === 'textarea') w.block(f.label, v[f.k] ?? '');
    else if (f.t === 'radio') w.options(f.label, f.opts, v[f.k] ?? '', v[`${f.k}Other`]);
    else if (f.t === 'speakers') {
      w.section(f.label);
      for (let i = 1; i <= f.n; i++) w.row([[`Speaker ${i}`, v[`${f.k}${i}name`] ?? ''], ['Title / Field', v[`${f.k}${i}title`] ?? '']]);
    }
  }
  flush();
  if (form.services?.length) w.services(form.services, v);
  if (form.attachments?.length) w.attachments(form.attachments);
  w.signatures(form.signatures, !form.memo);

  if (form.memo) {
    w.title = 'MEMORANDUM';
    w.newPage();
    const today = new Date().toISOString().slice(0, 10);
    w.row([['To', v.memoTo || 'Youth Welfare Director']]);
    w.row([['From', `${SAO_CLUB}${v.requestedBy ? ' - ' + v.requestedBy : ''}`], ['Date', fmtDate(v.requestedDate || today)]]);
    w.row([['Subject', v.memoSubject ?? '']]);
    w.y -= 10;
    w.block('Memo', v.memoBody ?? '', 260);
    w.signatures(['Academic Advisor', 'Youth Welfare Director', 'GUC Vice President'], false);
  }
  return doc.save();
}
