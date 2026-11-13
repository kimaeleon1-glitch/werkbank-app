// Service Worker: legt alle Dateien im Handy ab, damit die App ohne Netz läuft.
//
// Bei JEDER Änderung an einer ausgelieferten Datei VERSION erhöhen. Neue
// Dateien in DATEIEN eintragen (der Test tests/cache.test.mjs prüft das).

const VERSION = '1.2.2';
const CACHE = `werkbank-${VERSION}`;

const DATEIEN = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/ansicht.js',
  './js/einstellungen.js',
  './js/feedback.js',
  './js/mathe.js',
  './js/rechnen.js',
  './js/sensors.js',
  './js/modules/calc.js',
  './js/modules/camlevel.js',
  './js/modules/compass.js',
  './js/modules/incline.js',
  './js/modules/level.js',
  './js/modules/plumb.js',
  './js/modules/ruler.js',
  './js/modules/height.js',
  './js/modules/lux.js',
  './js/modules/magnet.js',
  './js/modules/settings.js',
  './js/modules/sound.js',
  './js/modules/tables.js',
  './js/modules/timer.js',
  './js/modules/torch.js',
  './js/modules/transfer.js',
  './js/modules/vibration.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' umgeht den HTTP-Cache, damit kein Mischstand entsteht.
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(DATEIEN.map((url) => new Request(url, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('werkbank-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Erst aus dem Offline-Speicher, nur sonst aus dem Netz.
// Seitenaufrufe (auch mit ?… oder #…) bekommen immer index.html.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { cacheName: CACHE }).then((r) => r || fetch(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request, { cacheName: CACHE }).then((r) => r || fetch(e.request)));
});

self.addEventListener('message', (e) => {
  if (e.data?.typ === 'version' && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
});
