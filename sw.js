const VERSION = 'dv-v1';
const ARCHIVOS = [
  './', 'index.html', 'styles.css', 'manifest.json', 'icono.svg', 'icono-192.png', 'icono-512.png',
  'js/main.js', 'js/parse.js', 'js/compute.js', 'js/queue.js', 'js/api.js', 'js/store.js', 'js/formato.js',
  'js/forms.js', 'js/editores.js', 'js/render-hoy.js', 'js/render-itinerario.js', 'js/render-reservas.js',
  'js/render-costos.js', 'js/timeline.js', 'js/charts.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Stale-while-revalidate para la página y sus módulos. Las llamadas al Apps Script nunca pasan por el caché.
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const guardada = await cache.match(req, { ignoreSearch: url.origin === location.origin });
    const red = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (guardada) { e.waitUntil(red); return guardada; }
    return (await red) || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
