const CACHE = 'fleettrack-v1';
const PRECACHE = [
  '/', '/index.html', '/css/style.css',
  '/js/api.js', '/js/tracker.js', '/js/map.js', '/js/dashboard.js', '/js/app.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isGET = e.request.method === 'GET';

  // API: only cache GET requests, pass others straight through
  if (url.pathname.startsWith('/api/')) {
    if (isGET) e.respondWith(networkFirst(e.request));
    return;
  }

  // Socket.io & CDN: network-first for GET
  if (isGET && (url.hostname.includes('socket.io') || url.hostname.includes('unpkg.com') || url.hostname.includes('cdn.'))) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Cache-first for app assets (GET only)
  if (isGET) {
    e.respondWith(cacheFirst(e.request));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('message', (e) => {
  if (e.data === 'keepalive') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage('alive'));
    });
  }
});
