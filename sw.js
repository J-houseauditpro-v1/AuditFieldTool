const CACHE = 'aft-v6';
const FILES = ['index.html','style.css','script.js','manifest.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(
  e.request.url.includes('script.js')
    ? fetch(e.request)
    : caches.match(e.request).then(r => r || fetch(e.request))
);
