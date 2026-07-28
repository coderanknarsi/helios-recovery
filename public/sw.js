/* Helios Recovery resident portal service worker. */

const CACHE = "helios-v1";

// Pages worth having when there is no signal. House holds naloxone locations
// and evacuation info; Support holds the crisis numbers.
const PRECACHE = ["/me", "/me/house", "/me/support", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Network-first for portal pages, falling back to the last good copy when
 * offline. Never caches anything outside /me — documents are served from
 * short-lived signed URLs and staff pages have no business being stored.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/me")) return;
  if (url.pathname.startsWith("/me/login")) return;
  if (request.headers.get("accept")?.includes("text/html") !== true) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached ?? caches.match("/me"))
          .then(
            (cached) =>
              cached ??
              new Response(
                "<h1>You're offline</h1><p>Reconnect to load this page.</p>",
                { headers: { "Content-Type": "text/html" }, status: 503 },
              ),
          ),
      ),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Helios Recovery";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/me" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/me";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Reuse an open portal window rather than piling up new ones.
        for (const client of clients) {
          if (client.url.includes("/me") && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
