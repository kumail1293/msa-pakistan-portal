/**
 * Service Worker for MSAP Portal (§144)
 *
 * Cache-first for static assets, network-first for API calls,
 * offline fallback page, and background sync.
 */

const CACHE_NAME = "msap-v1";
const STATIC_CACHE = "msap-static-v1";
const API_CACHE = "msap-api-v1";
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
];

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // API calls: network-first with cache fallback
  if (url.pathname.startsWith("/trpc/") || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(API_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || new Response(JSON.stringify({ error: "Offline" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            });
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".png") || url.pathname.endsWith(".svg"))) {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (request.mode === "navigate") {
          return caches.match(OFFLINE_URL);
        }
        return new Response("Offline", { status: 503 });
      });
    })
  );
});

// Background sync for form submissions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-form-submissions") {
    event.waitUntil(syncFormSubmissions());
  }
});

async function syncFormSubmissions() {
  // Retrieve and resend any queued form submissions
  try {
    const cache = await caches.open("msap-sync-queue");
    const requests = await cache.keys();
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const body = await response.json();
        await fetch(request, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        await cache.delete(request);
      }
    }
  } catch (err) {
    console.error("Background sync failed:", err);
  }
}

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "MSAP", body: "New notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      data: data.url,
      actions: data.actions ?? [],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
