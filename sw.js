// Guarda solo la "cáscara" de la app para que abra rápido y sin señal.
// Las llamadas al servidor (Apps Script) nunca se guardan en caché.
const CACHE = "grup7-v3";
const SHELL = ["./", "index.html", "styles.css?v=3", "config.js?v=3", "logic.js?v=3", "store.js?v=3", "app.js?v=3", "om-plantilla.json?v=3", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Red primero, caché como respaldo: así las actualizaciones llegan siempre.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request))
  );
});

// Al tocar una notificación, abrir (o enfocar) la app.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
      for (const w of ws) if ("focus" in w) return w.focus();
      return self.clients.openWindow("./");
    })
  );
});
