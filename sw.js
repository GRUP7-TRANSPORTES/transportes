// Guarda solo la "cáscara" de la app para que abra rápido y sin señal.
// Las llamadas al servidor (Apps Script) nunca se guardan en caché.
const CACHE = "grup7-v8";
const SHELL = ["./", "index.html", "styles.css?v=8", "config.js?v=8", "logic.js?v=8", "store.js?v=8", "app.js?v=8", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

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

// ---- Avisos al celular con la app cerrada (Web Push) ----
// El aviso llega vacío; aquí se pide el texto al servidor con la dirección de avisos de este equipo.
self.window = self;
try { importScripts("config.js"); } catch (_) { /* sin config: no hay servidor */ }
const K_VISTOS = "./__avisos_mostrados";

async function leerMostrados() {
  try { const r = await (await caches.open(CACHE)).match(K_VISTOS); return r ? await r.json() : []; } catch (_) { return []; }
}
async function guardarMostrados(ids) {
  try { await (await caches.open(CACHE)).put(K_VISTOS, new Response(JSON.stringify(ids.slice(-100)))); } catch (_) {}
}
async function mostrarPush() {
  let eventos = [];
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (sub && self.SCRIPT_URL) {
      const r = await fetch(self.SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "push_pendientes", endpoint: sub.endpoint }) });
      eventos = (await r.json()).eventos || [];
    }
  } catch (_) {}
  const mostrados = await leerMostrados();
  const nuevos = eventos.filter((e) => !mostrados.includes(e.id));
  const opc = { icon: "icon-192.png", badge: "icon-192.png", vibrate: [200, 100, 200] };
  if (!nuevos.length) {
    // Siempre hay que mostrar algo. Si no hay nada nuevo, se repite el último sin volver a sonar.
    if (eventos.length) return self.registration.showNotification("Transportes GRUP7", { ...opc, body: eventos[0].texto, tag: eventos[0].id, renotify: false });
    return self.registration.showNotification("Transportes GRUP7", { ...opc, body: "Tienes un aviso nuevo. Toca para verlo.", tag: "grup7" });
  }
  await Promise.all(nuevos.reverse().map((e) => self.registration.showNotification("Transportes GRUP7", { ...opc, body: e.texto, tag: e.id })));
  await guardarMostrados(mostrados.concat(nuevos.map((e) => e.id)));
}
self.addEventListener("push", (e) => e.waitUntil(mostrarPush()));

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
