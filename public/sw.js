const CACHE_NAME = "hennder-crm-static-v4";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/icons/hennder-icon-72.png",
  "/icons/hennder-icon-96.png",
  "/icons/hennder-icon-128.png",
  "/icons/hennder-icon-144.png",
  "/icons/hennder-icon-152.png",
  "/icons/hennder-icon-192.png",
  "/icons/hennder-icon-384.png",
  "/icons/hennder-icon-512.png",
  "/icons/hennder-icon-maskable-192.png",
  "/icons/hennder-icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isAppAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const title = payload.title || "Hennder CRM";
  const options = {
    body: payload.body || "Voce tem uma nova atividade comercial.",
    icon: payload.icon || "/icons/hennder-icon-192.png",
    badge: payload.badge || "/icons/hennder-icon-96.png",
    data: payload.data || { url: "/" },
    tag: payload.data?.notificationId || "hennder-crm",
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => {
          try {
            return new URL(client.url).origin === targetUrl.origin;
          } catch {
            return false;
          }
        });

        if (existing) {
          existing.focus();
          return existing.navigate(targetUrl.href);
        }

        return self.clients.openWindow(targetUrl.href);
      }),
  );
});

function isAppAsset(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/favicon.ico"
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

function readPushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}
