const CACHE_NAME = "clerkme-shell-v28-live-vad";
const APP_SHELL = ["/offline.html", "/manifest.webmanifest", "/clerkme-mark-navy.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache private case data, authentication responses or API results.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/login") || url.pathname.startsWith("/profile")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(new Request(request, { cache: "no-store" })).catch(async () => {
        // Never replay a cached public homepage for a returning, signed-in
        // learner when ClerkME cannot reach the server to verify the session.
        const offline = await caches.match("/offline.html");
        return offline || new Response("ClerkME is offline. Reconnect to open your secure workspace.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
        });
      })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/clerkme-mark-navy.svg") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});


// Background Web Push: notifications can arrive while ClerkMe is closed.
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(payload.title || "ClerkMe has missed you 💙", {
    body: payload.body || "Your clinical learning space is waiting whenever you are ready.",
    icon: "/clerkme-192.png", badge: "/clerkme-192.png",
    tag: payload.tag || "clerkme-gentle-reengagement", renotify: false,
    data: { url: payload.url || "/" }, timestamp: Date.now()
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destination = new URL(event.notification.data && event.notification.data.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        if ("navigate" in client) client.navigate(destination);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination);
  }));
});
