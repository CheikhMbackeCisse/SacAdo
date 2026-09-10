// Service worker de l'app ADMIN (TACHE_admin_pwa_meme_domaine.md §4).
// Scope /admin/ (déduit de l'emplacement du fichier). Contrôle les pages
// /admin, plus précises que le SW racine.
//
// Volontairement minimal : on met en cache la COQUILLE de l'app pour un
// démarrage hors-ligne, JAMAIS les réponses de données. Un opérateur qui
// verrait des commandes périmées serait pire que pas d'app du tout.

const CACHE = "sacado-admin-v1";
const SHELL = ["/admin", "/admin/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Jamais de cache pour les payloads RSC (navigation Next) ni les appels
  // de données : toujours le réseau.
  if (url.searchParams.has("_rsc") || event.request.headers.get("RSC") === "1") return;

  // Navigations : réseau d'abord, coquille en secours hors-ligne.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("/admin"))),
    );
    return;
  }

  // Assets à nom haché (JS/CSS/polices) : stale-while-revalidate.
  const estAsset =
    url.pathname.startsWith("/_next/static") ||
    /\.(?:js|css|woff2?)$/i.test(url.pathname);
  if (estAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const reseau = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || reseau;
      }),
    );
  }
  // Tout le reste (images, /_next/image, appels Supabase…) : on laisse passer,
  // le navigateur gère. Pas de mise en cache de données côté admin.
});
