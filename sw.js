/* Appli Runners : garde une copie de l'appli pour qu'elle s'ouvre même sans réseau (v3).
   Toujours la version en ligne d'abord ; la copie ne sert qu'en cas de coupure.
   Les données (Google) ne passent jamais par ici. */
const CACHE = 'runners-v30';
const FICHIERS = ['./', './index.html', './bureau.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copie = r.clone(); caches.open(CACHE).then(c => c.put(url.pathname, copie)); }
      return r;
    }).catch(() => caches.match(url.pathname, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
