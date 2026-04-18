// Service Worker — EduCorrect PWA
// Stratégie: Network First pour l'API, Cache First pour les assets statiques.

const CACHE_NAME = "educorrect-v1";
const STATIC_ASSETS = ["/", "/_next/static/"];

// ── Installation : mise en cache des ressources de base ───────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(["/"]).catch(() => {
        // Silently fail if offline during install
      });
    })
  );
  self.skipWaiting();
});

// ── Activation : nettoyage des anciens caches ─────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch : stratégie selon le type de requête ────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les appels API (besoin d'être en ligne)
  if (url.pathname.startsWith("/api/")) {
    return; // Laisse passer, pas de cache pour les API
  }

  // Pour les assets Next.js : Cache First (immutables grâce aux hash)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Pour les pages HTML : Network First avec fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
