// TEDxGUC service worker: keeps the door check-in page usable offline
// (FR-5.7). Static files are cached on first use; pages are fetched from
// the network first and fall back to the last copy when offline.
// It never caches API or Supabase requests.
const CACHE = 'tx-v2';
// "" on the club's own domain, "/tedxguc-portal" on GitHub Pages.
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const SHELL = ['/portal/door/', '/brand/tedxguc-lockup-white.png', '/brand/tedxguc-lockup-black.png', '/brand/portal-mark-red.svg', '/icons/favicon.svg'].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Next.js build files, brand files and icons: cache first.
  if (url.pathname.startsWith(BASE + '/_next/static/') || url.pathname.startsWith(BASE + '/brand/') || url.pathname.startsWith(BASE + '/icons/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })));
    return;
  }

  // Portal pages: network first, last copy when offline.
  if (e.request.mode === 'navigate' && url.pathname.startsWith(BASE + '/portal')) {
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match(BASE + '/portal/door/'))));
  }
});
