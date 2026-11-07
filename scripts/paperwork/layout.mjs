import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
export async function layout(file) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  const page = await doc.getPage(1);
  const ol = await page.getOperatorList();
  const cells = [];
  for (let i = 0; i < ol.fnArray.length - 1; i++) {
    if (ol.fnArray[i] !== OPS.constructPath || ol.fnArray[i + 1] !== OPS.eoClip) continue;
    const a = ol.argsArray[i]; if (a[0].length !== 1 || a[0][0] !== OPS.rectangle) continue;
    let [x, y, w, h] = a[1]; if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    if (w < 12 || h < 8) continue;
    const r = v => Math.round(v * 10) / 10;
    if (!cells.some(c => Math.abs(c.x - x) < 1 && Math.abs(c.y - y) < 1 && Math.abs(c.w - w) < 1 && Math.abs(c.h - h) < 1)) cells.push({ x: r(x), y: r(y), w: r(w), h: r(h), text: '' });
  }
  const tc = await page.getTextContent();
  const boxes = [];
  const inCell = (x, y) => cells.filter(c => x >= c.x - 1 && x <= c.x + c.w + 1 && y >= c.y - 1 && y <= c.y + c.h + 1).sort((a, b) => a.w * a.h - b.w * b.h)[0];
  for (const it of tc.items) {
    const s = it.str; if (!s.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    const c = inCell(x + 1, y + 3);
    if (s.trim() === '☐') { boxes.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, cell: c }); continue; }
    if (c) c.text = (c.text + ' ' + s).replace(/\s+/g, ' ').trim();
  }
  const vp = page.getViewport({ scale: 1 });
  return { width: vp.width, height: vp.height, cells, boxes };
}
if (process.argv[2]) {
  const L = await layout(process.argv[2]);
  for (const c of L.cells.sort((a, b) => b.y - a.y || a.x - b.x)) console.log(c.x, c.y, c.w, c.h, JSON.stringify(c.text));
  console.log('boxes', L.boxes.length);
}
