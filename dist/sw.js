/* Service worker de Riposte: Frontline (copié tel quel dans dist/sw.js par build.py).
   Il rend le jeu installable sur l'écran d'accueil (Android, Chrome) et garde en cache les fichiers dont l'adresse change avec
   le contenu (textures, sons, illustrations, icônes : un an d'âge sans risque), ce qui accélère les visites suivantes sur un réseau
   mobile. La page du jeu, l'API et version.json ne sont JAMAIS servis depuis le cache : le jeu se met à jour tout seul
   (src/09h-update.js) et ne doit pas rester sur une ancienne version. Hors ligne, la page n'a pas de réseau pour charger
   three.js : on ne simule donc pas un jeu hors ligne. */
const CACHE = 'cod-fichiers-v1';
const IMMUABLES = /^\/(tex|sfx|maps|icons)\//;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !IMMUABLES.test(u.pathname)) return; // le reste : le réseau, comme sans service worker
  e.respondWith((async () => {
    const c = await caches.open(CACHE), hit = await c.match(r);
    if (hit) return hit;
    const res = await fetch(r);
    if (res.ok) c.put(r, res.clone()).catch(() => {});
    return res;
  })());
});
