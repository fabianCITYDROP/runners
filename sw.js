/* Appli Runners : garde une copie de l'appli pour qu'elle s'ouvre même sans réseau (v4, appli v39).
   Toujours la version en ligne d'abord ; la copie ne sert qu'en cas de coupure.
   Les données (Google) ne passent jamais par ici. */
const CACHE = 'runners-v39';
const FICHIERS = ['./', './index.html', './bureau.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  /* v39 : copie prise directement en ligne (pas d'ancienne copie du navigateur) */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
/* v38 : la mise à jour de l'appli garde « runners-cfg » (adresse et code pour les alertes appli fermée) */
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'runners-cfg').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    /* v39 : toujours demander au serveur si le fichier a changé, pour que la nouvelle version arrive tout de suite */
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const copie = r.clone(); caches.open(CACHE).then(c => c.put(url.pathname, copie)); }
      return r;
    }).catch(() => caches.match(url.pathname, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
/* v36 : toucher la notification d'une nouvelle demande ouvre l'appli */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => l.length ? l[0].focus() : self.clients.openWindow('./')));
});
/* v37 : alerte envoyée par le script Google (vide) : on demande le détail au script, puis on l'affiche.
   Une alerte est toujours affichée, même sans réseau (exigé par Apple). */
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let titre = 'Nouvelle demande du bureau', texte = 'Ouvrez l\'appli pour la voir.', n = 0;
    try {
      const cfg = await (await caches.open('runners-cfg')).match('./__cfg').then(r => r ? r.json() : null);
      if (cfg && cfg.api && cfg.code) {
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
        try {
          const d = await (await fetch(cfg.api + '?' + new URLSearchParams({ action: 'notif', code: cfg.code }), { signal: ctl.signal, cache: 'no-store' })).json();
          if (d && d.titre) { titre = d.titre; texte = d.texte || texte; n = d.n || 0; }
        } finally { clearTimeout(tm); }
      }
    } catch (err) {}
    try { if (n && self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(n); } catch (err) {}
    await self.registration.showNotification(titre, { body: texte, tag: 'demande', renotify: true, icon: 'icon-192.png', badge: 'icon-192.png' });
  })());
});
