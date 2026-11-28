// Renders sample ticket PNGs with the same SVG and renderer the email uses.
// node --experimental-strip-types scripts/ticket-art-preview.mts <outDir> <resvg-wasm dir> <qrcode module>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ticketSvg } from '../supabase/functions/_shared/ticket-svg.ts';
const [out, resvgDir, qrMod] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const { initWasm, Resvg } = require(`${resvgDir}/node_modules/@resvg/resvg-wasm`);
const QR = require(qrMod);
await initWasm(readFileSync(`${resvgDir}/node_modules/@resvg/resvg-wasm/index_bg.wasm`));
const fonts = [500, 600, 800].map((w) => new Uint8Array(readFileSync(`web/public/brand/fonts/archivo-${w}.ttf`)));
const qr = (code: string) => { const q = QR.create(code, { errorCorrectionLevel: 'M' }); const n = q.modules.size; return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => !!q.modules.get(r, c))); };
for (const vip of [false, true]) {
  const logo = 'data:image/png;base64,' + readFileSync(`web/public/brand/tedxguc-lockup-${vip ? 'white' : 'black'}.png`).toString('base64');
  const { svg } = ticketSvg({ eventTitle: 'Loose Ends', eventKind: 'TEDxGUC', guestName: 'Salma Hany', vip, date: 'Thu 17 Dec', doors: '6:30 pm', venue: 'GUC Main Hall, New Cairo', ticketNo: vip ? 'LE-0007' : 'LE-0042', qr: qr('TX-DEMO-' + vip), logoDataUrl: logo });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 760 }, font: { fontBuffers: fonts, defaultFontFamily: 'Archivo', loadSystemFonts: false } }).render().asPng();
  writeFileSync(`${out}/ticket-${vip ? 'vip' : 'guest'}.png`, png);
  console.log(vip ? 'vip' : 'guest', Math.round(png.length / 1024) + 'KB');
}
