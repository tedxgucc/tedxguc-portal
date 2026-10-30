// Preview the static export with the same URL prefix used at build time.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const root = path.resolve('out');
let base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
try { base = JSON.parse(fs.readFileSync('.next/required-server-files.json', 'utf8')).config.basePath ?? base; } catch { /* Use environment for standalone exports. */ }
const port = Number(process.env.PORT || 3000);
if (!fs.existsSync(path.join(root, 'index.html'))) throw Error('No static export found. Run npm run build first.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (base) { if (pathname === base) pathname = '/'; else if (pathname.startsWith(base + '/')) pathname = pathname.slice(base.length); else { res.writeHead(404); res.end('Not found'); return; } }
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const status = fs.existsSync(file) && fs.statSync(file).isFile() ? 200 : 404;
    if (status === 404) file = path.join(root, '404.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(status, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400); res.end('Invalid request'); }
}).listen(port, '127.0.0.1', () => console.log('Local preview: http://localhost:' + port + base + '/'));
