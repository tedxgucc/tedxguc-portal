// Validates release configuration without displaying keys or personal data.
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
let failed = false;
function check(label, ok, help) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ': ' + help)); if (!ok) failed = true; }
const env = process.env;
function httpsUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !['localhost','127.0.0.1'].includes(u.hostname) && !u.search && !u.hash; } catch { return false; } }
check('Live Supabase URL', httpsUrl(env.NEXT_PUBLIC_SUPABASE_URL), 'Set NEXT_PUBLIC_SUPABASE_URL to the live project URL.');
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
let publicKey = key.startsWith('sb_publishable_') && key.length > 30;
try { publicKey ||= JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role === 'anon'; } catch { /* Invalid key. */ }
check('Browser-safe Supabase key', publicKey, 'Set the anon/publishable key, never a service-role or secret key.');
const turnstile = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
if (turnstile) {
  check('Optional Turnstile configuration', turnstile.length >= 20 && !/^[123]x0{5}/.test(turnstile), 'Use a production NEXT_PUBLIC_TURNSTILE_SITE_KEY and its matching server secret, or leave both unset.');
} else {
  console.log('SKIP Optional Turnstile: not configured.');
}
check('Canonical public site URL', httpsUrl(env.NEXT_PUBLIC_SITE_URL), 'Set NEXT_PUBLIC_SITE_URL to the full public HTTPS URL, including any repository prefix.');
if (process.argv.includes('--online') && !failed) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  for (const [label, path, method] of [['Public events API', '/rest/v1/events?select=id&limit=1', 'GET'], ['Public board API', '/rest/v1/rpc/get_public_board', 'POST']]) {
    try { const res = await fetch(base + path, { method, headers: { apikey: key, Authorization: 'Bearer ' + key, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(15000) }); check(label, res.ok, 'Anonymous read failed (HTTP ' + res.status + '). Check migrations and grants.'); }
    catch { check(label, false, 'The live API could not be reached.'); }
  }
}
console.log('Server secrets, email delivery, auth redirects, migrations and phone-camera behavior still require live verification.');
process.exitCode = failed ? 1 : 0;
