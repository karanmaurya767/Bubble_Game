// ============================================================
// BUBBLE POP! — Service Worker (PWA offline support)
// ============================================================
// Cache-first for static assets, network-first for runtime.
// ============================================================

const CACHE_NAME = 'bubblepop-v1.0.0';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './css/animations.css',
    './css/responsive.css',
    './js/storage.js',
    './js/audio.js',
    './js/particles.js',
    './js/levels.js',
    './js/powerups.js',
    './js/achievements.js',
    './js/leaderboard.js',
    './js/ui.js',
    './js/game.js',
    './assets/icons/icon.svg',
    'https://fonts.googleapis.com/css2?family=Bungee&family=Press+Start+2P&family=Inter:wght@400;600;800&display=swap',
];

// Install: pre-cache critical assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch: cache-first for static, network-first for everything else
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isStatic = url.origin === self.location.origin;

    if (isStatic) {
        // Cache-first
        event.respondWith(
            caches.match(req).then((cached) => {
                if (cached) return cached;
                return fetch(req).then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
                    return res;
                }).catch(() => caches.match('./index.html'));
            })
        );
    } else {
        // Network-first (e.g., Google Fonts)
        event.respondWith(
            fetch(req).then((res) => {
                const copy = res.clone();
                caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
                return res;
            }).catch(() => caches.match(req))
        );
    }
});