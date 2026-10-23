/* Appli Runners : garde une copie de l'appli pour qu'elle s'ouvre même sans réseau (v6, appli v44 : toucher une alerte ouvre la demande).
   Toujours la version en ligne d'abord ; la copie sert en cas de coupure, et depuis la v42 aussi quand le réseau
   est trop lent (plus de 3 s) : l'appli s'ouvre tout de suite et la version en ligne est rangée pour la fois suivante.
   Les données (Google) ne passent jamais par ici. */
const CACHE = 'runners-v46';
const ATTENTE_MAX = 3000; /* v42 : au-delà, on ouvre la copie du téléphone (avant : jusqu'à 30 s d'écran blanc sur un réseau faible) */
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
  /* v39 : toujours demander au serveur si le fichier a changé, pour que la nouvelle version arrive tout de suite */
  let range = Promise.resolve();
  const reseau = fetch(e.request, { cache: 'no-cache' }).then(r => {
    if (r.ok) { const copie = r.clone(); range = caches.open(CACHE).then(c => c.put(url.pathname, copie)).catch(() => {}); }
    return r;
  });
  /* v42 : la page elle-même retombe sur index.html, jamais un autre fichier (sinon un script recevrait de la page) */
  const copie = () => caches.match(url.pathname, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : null)).catch(() => null);
  e.respondWith(new Promise(rendre => {
    let fait = false; const fin = r => { if (!fait && r) { fait = true; clearTimeout(t); rendre(r); } };
    /* Réseau lent : la copie du téléphone si elle existe, sinon on continue d'attendre le réseau */
    const t = setTimeout(() => copie().then(fin), ATTENTE_MAX);
    reseau.then(fin, () => copie().then(r => { fin(r); if (!fait) { fait = true; clearTimeout(t); rendre(Response.error()); } }));
  }));
  /* La version en ligne finit d'arriver et d'être rangée même si la copie a déjà été montrée */
  e.waitUntil(reseau.then(() => range, () => {}));
});
/* v36 : toucher la notification d'une nouvelle demande ouvre l'appli */
/* v44 (appli) : directement sur « Rappels et demandes », et l'appli va chercher la demande tout de suite */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    if (l.length) { l[0].postMessage({ type: 'demandes' }); return l[0].focus(); }
    return self.clients.openWindow('./#demandes');
  }));
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
          /* v44 : gardé pour l'afficher dans l'appli pendant qu'elle recharge les demandes */
          if (n) await (await caches.open('runners-cfg')).put('./__notif', new Response(JSON.stringify({ texte, at: Date.now() })));
        } finally { clearTimeout(tm); }
      }
    } catch (err) {}
    try { if (n && self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(n); } catch (err) {}
    await self.registration.showNotification(titre, { body: texte, tag: 'demande', renotify: true, icon: 'icon-192.png', badge: 'icon-192.png' });
  })());
});
