const CACHE_NAME = "sacado-v2";
const APP_SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Ne jamais mettre en cache les appels vers Supabase (prix, stock, statut de
  // commande...) : ces données doivent toujours venir du réseau, pas d'un
  // cache local qui pourrait servir un prix ou un stock périmé.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Navigations (le document HTML) : RÉSEAU D'ABORD. Sans ça, un déploiement ne
  // se voit qu'à la visite suivante (le vieux HTML servi du cache référence les
  // anciens bundles). Le cache ne sert que de secours hors-ligne.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Autres ressources same-origin (JS/CSS à nom haché, images) :
  // stale-while-revalidate.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
