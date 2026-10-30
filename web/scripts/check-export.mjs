import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('out');
let base = '';
try { base = JSON.parse(fs.readFileSync('.next/required-server-files.json', 'utf8')).config.basePath ?? ''; } catch { /* Root-domain export. */ }
const routes = ['/', '/events/', '/speakers/', '/calendar/', '/about/', '/board/', '/join/', '/contact/', '/privacy/'];
let failed = false;
const issue = (s) => { console.error('FAIL ' + s); failed = true; };
for (const route of routes) {
  const file = path.join(root, route, 'index.html');
  if (!fs.existsSync(file)) { issue('Missing public page ' + route); continue; }
  const html = fs.readFileSync(file, 'utf8');
  if (!/<title>[^<]+<\/title>/.test(html)) issue('Missing title on ' + route);
  for (const [, href] of html.matchAll(/href="([^"#]+)"/g)) {
    if (!href.startsWith('/')) continue;
    let target = href.split(/[?#]/)[0];
    if (base) { if (!target.startsWith(base + '/') && target !== base) { issue('Wrong base path on ' + route); continue; } target = target.slice(base.length) || '/'; }
    const local = path.join(root, decodeURIComponent(target));
    if (!fs.existsSync(local) && !fs.existsSync(path.join(local, 'index.html'))) issue('Broken local link on ' + route + ': ' + target);
  }
}
for (const route of ['portal', 'login', 'auth/callback', 'tickets', 'orders', 'join/status']) {
 const file = path.join(root, route, 'index.html');
 if (!fs.existsSync(file) || !/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(fs.readFileSync(file, 'utf8'))) issue('Missing noindex on ' + route);
}
for (const file of ['robots.txt','sitemap.xml','manifest.webmanifest','404.html']) if (!fs.existsSync(path.join(root, file))) issue('Missing export ' + file);
if (!failed) console.log('PASS public pages, local asset links, private-page noindex and release files');
process.exitCode = failed ? 1 : 0;
