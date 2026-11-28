// Draws the ticket-style stage header for each Supabase login email: seat rings,
// the red dot with "IDEAS WORTH SPREADING • …" around it and a word inside, plus
// the TEDxGUC logo. Saved as PNGs under web/public/brand/email/ (served by the site).
// node --experimental-strip-types scripts/email-stage-art.mts <resvg-wasm dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const resvgDir = process.argv[2];
const require = createRequire(import.meta.url);
const { initWasm, Resvg } = require(`${resvgDir}/node_modules/@resvg/resvg-wasm`);
await initWasm(readFileSync(`${resvgDir}/node_modules/@resvg/resvg-wasm/index_bg.wasm`));
const fonts = [500, 600, 800].map((w) => new Uint8Array(readFileSync(`web/public/brand/fonts/archivo-${w}.ttf`)));
const logo = 'data:image/png;base64,' + readFileSync('web/public/brand/tedxguc-lockup-black.png').toString('base64');

export const STAGES: Record<string, { word: string; label: string }> = {
  'reset-password': { word: 'Reset', label: 'PASSWORD RESET' },
  'invite-user': { word: 'Welcome', label: 'PORTAL INVITE' },
  'magic-link': { word: 'Sign in', label: 'SIGN-IN LINK' },
  'confirm-signup': { word: 'Confirm', label: 'CONFIRM YOUR EMAIL' },
  'change-email': { word: 'New email', label: 'EMAIL CHANGE' },
  'reauthentication': { word: 'Your code', label: 'CONFIRMATION CODE' },
};

const W = 480, H = 330, CX = 240, CY = 188, R = 104, RED = '#e62b1e';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function svg(word: string, label: string) {
  let seats = '';
  [132, 148, 164, 180, 196, 212, 228, 244].forEach((r, ri) => {
    const n = Math.floor((2 * Math.PI * r) / 13.5);
    for (let i = 0; i < n; i++) {
      const a = ((i + (ri % 2) * 0.5) / n) * 2 * Math.PI, x = CX + r * Math.cos(a), y = CY + r * Math.sin(a);
      if (y < 58 && x < 200) continue; // keep the logo clear
      seats += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3" fill="#d3cfc9"/>`;
    }
  });
  const rr = R - 12;
  const ring = `M${CX} ${CY} m-${rr} 0 a${rr} ${rr} 0 1 1 ${2 * rr} 0 a${rr} ${rr} 0 1 1 -${2 * rr} 0`;
  const text = `IDEAS WORTH SPREADING • ${label} • TEDxGUC • `;
  const size = word.length > 8 ? 26 : word.length > 6 ? 30 : 36;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>${seats}` +
    `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${RED}"/>` +
    `<defs><path id="ring" d="${ring}"/></defs>` +
    `<text font-family="Archivo" font-weight="600" font-size="9.4" letter-spacing="2.1" fill="#ffffff"><textPath href="#ring" textLength="${(2 * Math.PI * rr - 6).toFixed(0)}">${esc(text)}</textPath></text>` +
    `<text x="${CX}" y="${CY - 14}" text-anchor="middle" font-family="Archivo" font-weight="600" font-size="10" letter-spacing="1.8" fill="#ffffff" fill-opacity=".9">TEDXGUC</text>` +
    `<text x="${CX}" y="${CY + size * 0.42}" text-anchor="middle" font-family="Archivo" font-weight="800" font-size="${size}" letter-spacing="-0.8" fill="#ffffff">${esc(word)}</text>` +
    `<rect x="14" y="14" width="150" height="38" rx="3" fill="#ffffff"/>` +
    `<image href="${logo}" x="22" y="22" width="134" height="21.5" preserveAspectRatio="xMinYMid meet"/>` +
    `</svg>`;
}

mkdirSync('web/public/brand/email', { recursive: true });
for (const [name, s] of Object.entries(STAGES)) {
  const png = new Resvg(svg(s.word, s.label), { fitTo: { mode: 'width', value: W * 2 }, font: { fontBuffers: fonts, defaultFontFamily: 'Archivo', loadSystemFonts: false } }).render().asPng();
  writeFileSync(`web/public/brand/email/${name}.png`, png);
  console.log(name, Math.round(png.length / 1024) + 'KB');
}
