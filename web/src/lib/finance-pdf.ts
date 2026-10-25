// Expense form and memo PDFs for a cash out (FR-12.3). Plain layout for
// now; the branded version comes with the screens. No Deno APIs here, so
// it can be unit-tested with Node. (Web copy: used by demo mode to make the PDFs in the browser.)
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export type CashOut = {
  doc_number: string;
  occurred_on: string;
  item: string | null;
  supplier: string | null;
  description: string | null;
  amount_gross: number | string;
  method: string;
  team: string | null;
  event: string | null;
  requested_by: string | null;
  recorded_by: string | null;
  has_fatora: boolean;
};

const RED = rgb(0.902, 0.169, 0.118); // #E62B1E
const INK = rgb(0.04, 0.04, 0.04);
const GREY = rgb(0.37, 0.37, 0.37);

const money = (n: number | string) =>
  `EGP ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function header(page: PDFPage, bold: PDFFont, font: PDFFont, title: string, number: string) {
  const { width, height } = page.getSize();
  page.drawText('TEDxGUC', { x: 48, y: height - 64, size: 22, font: bold, color: RED });
  page.drawText(title.toUpperCase(), { x: 48, y: height - 96, size: 16, font: bold, color: INK });
  page.drawText(number, { x: width - 48 - font.widthOfTextAtSize(number, 11), y: height - 64, size: 11, font, color: GREY });
  page.drawLine({ start: { x: 48, y: height - 108 }, end: { x: width - 48, y: height - 108 }, thickness: 1, color: INK });
}

function rows(page: PDFPage, bold: PDFFont, font: PDFFont, startY: number, items: [string, string][]) {
  let y = startY;
  for (const [label, value] of items) {
    page.drawText(label.toUpperCase(), { x: 48, y, size: 8, font: bold, color: GREY });
    page.drawText(value || '—', { x: 200, y, size: 11, font, color: INK, maxWidth: 340 });
    y -= 26;
  }
  return y;
}

function signatures(page: PDFPage, bold: PDFFont, y: number, names: string[]) {
  const colWidth = (page.getSize().width - 96) / names.length;
  names.forEach((name, i) => {
    const x = 48 + i * colWidth;
    page.drawLine({ start: { x, y }, end: { x: x + colWidth - 24, y }, thickness: 0.75, color: INK });
    page.drawText(name.toUpperCase(), { x, y: y - 14, size: 8, font: bold, color: GREY });
  });
}

function footer(page: PDFPage, font: PDFFont) {
  page.drawText('This independent TEDx event is operated under license from TED.', { x: 48, y: 36, size: 8, font, color: GREY });
}

export async function expenseFormPdf(c: CashOut): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Expense form ${c.doc_number}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]); // A4
  header(page, bold, font, 'Expense form', c.doc_number);
  const y = rows(page, bold, font, page.getSize().height - 150, [
    ['Date', c.occurred_on],
    ['Item', c.item ?? ''],
    ['Supplier', c.supplier ?? ''],
    ['Amount', money(c.amount_gross)],
    ['Paid by', c.method],
    ['Team', c.team ?? ''],
    ['Event', c.event ?? ''],
    ['Requested by', c.requested_by ?? ''],
    ['Recorded by', c.recorded_by ?? ''],
    ['Fatora attached', c.has_fatora ? 'Yes' : 'NO: missing'],
    ['Notes', c.description ?? ''],
  ]);
  signatures(page, bold, y - 80, ['Recorded by (L&P)', 'Operations Curator', 'Chairman']);
  footer(page, font);
  return doc.save();
}

export async function memoPdf(c: CashOut): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Memo ${c.doc_number}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  header(page, bold, font, 'Memo', `${c.doc_number}-M`);
  const { height } = page.getSize();
  const lines = [
    `Date: ${c.occurred_on}`,
    '',
    `This memo confirms that ${money(c.amount_gross)} was paid by ${c.method}` +
      `${c.supplier ? ` to ${c.supplier}` : ''} for ${c.item ?? 'the item below'}` +
      `${c.event ? ` for ${c.event}` : ''}${c.team ? `, on behalf of ${c.team}` : ''}.`,
    '',
    `Cashbook entry: ${c.doc_number}`,
    ...(c.description ? ['', c.description] : []),
  ];
  let y = height - 150;
  for (const line of lines) {
    page.drawText(line, { x: 48, y, size: 11, font, color: INK, maxWidth: 499, lineHeight: 16 });
    y -= line ? 16 * Math.max(1, Math.ceil(font.widthOfTextAtSize(line, 11) / 499)) : 12;
  }
  signatures(page, bold, y - 100, ['Logistics and Planning', 'Operations Curator']);
  footer(page, font);
  return doc.save();
}
