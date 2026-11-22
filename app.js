// Control de Transportes GRUP7 — pantallas.
"use strict";
const G = GRUP7;
const R = G.ROL;

// ---------------------------------------------------------------- utilidades de interfaz
function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else if (k === "checked" || k === "disabled" || k === "selected") e[k] = !!v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  add(e, kids);
  return e;
}
function add(e, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) add(e, k);
    else e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
const $ = (s) => document.querySelector(s);
function toast(msg, cls = "", ms = 4200) {
  const t = el("div", { class: "toast " + cls, role: "status" }, msg);
  $("#toasts").append(t);
  setTimeout(() => t.remove(), ms);
}
function tag(texto, cls) { return el("span", { class: "tag " + cls }, texto); }
function vacio(texto) { return el("div", { class: "vacio" }, texto); }
const hoy = () => G.fechaLima(new Date());
const manana = () => G.sumarDias(hoy(), 1);
const byHora = (a, b) => (a.fecha + a.hora_salida).localeCompare(b.fecha + b.hora_salida);
const fmt = (n, d = 1) => (Math.round(G.num(n) * 10 ** d) / 10 ** d).toLocaleString("es-PE");

function modal(titulo, contenido, pie) {
  const cerrar = () => { $("#modal").replaceChildren(); document.removeEventListener("keydown", esc); };
  const esc = (e) => { if (e.key === "Escape") cerrar(); };
  document.addEventListener("keydown", esc);
  const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": titulo },
    el("div", { class: "sheet-h" }, el("h2", null, titulo), el("button", { class: "btn ghost", onclick: cerrar, "aria-label": "Cerrar" }, "✕")),
    contenido, pie ? el("div", { class: "sheet-f" }, pie) : null);
  const ov = el("div", { class: "ov", onclick: (e) => { if (e.target === ov) cerrar(); } }, sheet);
  $("#modal").replaceChildren(ov);
  return cerrar;
}
function seg(opciones, valor, onPick, cls = "") {
  const box = el("div", { class: "seg " + cls, role: "group" });
  const pintar = (v) => box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v ? "true" : "false"));
  Object.keys(opciones).forEach((k) => box.append(el("button", { type: "button", "data-v": k, class: "e-" + k, onclick: () => { pintar(k); onPick(k); } }, opciones[k])));
  pintar(valor);
  return box;
}
function chipsFecha(f, cb) {
  const h = hoy(), m = manana();
  return el("div", { class: "chips" },
    el("button", { class: "chip", "aria-pressed": f === h ? "true" : "false", onclick: () => cb(h) }, "Hoy"),
    el("button", { class: "chip", "aria-pressed": f === m ? "true" : "false", onclick: () => cb(m) }, "Mañana"),
    el("input", { class: "date", type: "date", value: f, "aria-label": "Otra fecha", onchange: (e) => e.target.value && cb(e.target.value) }));
}
function combTag(v) { return v ? tag(G.COMBUSTIBLE_NOMBRE[v.combustible], v.combustible === "GASOHOL" ? "t-gas" : "t-pet") : null; }
function estadoComTag(c) {
  const cls = { PROGRAMADA: "t-mut", EN_CURSO: "t-info", EN_DESTINO: "t-info", RETORNADA: "t-ok", CANCELADA: "t-bad" }[c.estado];
  return tag(G.ESTADO_COM[c.estado] || c.estado, cls);
}
function retornoTag(c) {
  const cls = c.retorno === "CON" ? "t-ok" : c.retorno === "VACIO" ? (c.zona === "URBANO" ? "t-mut" : "t-warn") : "t-mut";
  return tag("Retorno: " + (c.retorno === "CON" ? "con carga/pax" : c.retorno === "VACIO" ? "en vacío" : "por confirmar"), cls);
}
function estadoVehDot(e) { return el("span", { class: "dot " + (e === "OPERATIVO" ? "d-ok" : e === "EN_COMISION" ? "d-info" : "d-bad"), "aria-hidden": "true" }); }
function descargar(nombre, texto, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿" + texto], { type: tipo }));
  const a = el("a", { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); toast("Copiado. Pégalo en WhatsApp o en el correo.", "ok"); }
  catch { modal("Copiar resumen", el("textarea", { class: "in", rows: 14, value: texto, onfocus: (e) => e.target.select() })); }
}
// Abre WhatsApp con el texto ya escrito; la persona elige el chat o grupo y toca Enviar.
function whatsapp(texto) {
  window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener");
}
const btnWhatsApp = (texto, etiqueta = "Enviar por WhatsApp", cls = "btn wa") =>
  el("button", { class: cls, onclick: () => whatsapp(typeof texto === "function" ? texto() : texto) }, etiqueta);
const csv = (filas) => filas.map((f) => f.map((x) => { const s = String(x == null ? "" : x); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(";")).join("\r\n");

// ---------------------------------------------------------------- estado
const S = { yo: null, d: null, tab: null, fCom: null, fDoc: null, diaChofer: "hoy", periodo: "hoy", vistos: new Set(), timer: null, primera: true };
const veh = (id) => S.d.vehiculos.find((v) => v.id === id);
const per = (id) => S.d.personal.find((p) => p.id === id);
const choferes = () => S.d.personal.filter((p) => p.rol === R.CHOFER && p.activo);
const es = (...roles) => roles.includes(S.yo.rol);

async function api(action, body) {
  try { return await Store.api(action, body); }
  catch (e) {
    if (e.sesion === false) { Store.sesion = ""; S.yo = null; arrancar(); }
    if (e.auth === false) { arrancar(); }
    throw e;
  }
}

// ---------------------------------------------------------------- arranque
async function arrancar() {
  clearInterval(S.timer);
  if (!Store.DEMO && !Store.token) return pantallaCodigo();
  if (!Store.sesion) return pantallaIngreso();
  try {
    await sincronizar(true);
    S.timer = setInterval(() => { if (!document.hidden) sincronizar(false).catch(() => {}); }, 60000);
  } catch (e) {
    if (!Store.sesion) return;
    $("#app").replaceChildren(el("main", null, el("div", { class: "alert bad" }, el("b", null, "No se pudo cargar"), e.message,
      el("div", null, el("button", { class: "btn", onclick: arrancar }, "Reintentar")))));
  }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.yo) sincronizar(false).catch(() => {}); });

async function sincronizar(forzarRender) {
  const d = await api("sync");
  S.d = d; S.yo = d.yo;
  if (S.primera) { S.vistos = Store.vistos(S.yo.id); S.primera = false; if (!S.vistos.size) { d.eventos.forEach((e) => S.vistos.add(e.id)); Store.guardarVistos(S.yo.id, S.vistos); } }
  notificarNuevos(d.eventos);
  const activo = document.activeElement;
  const escribiendo = activo && $("#app").contains(activo) && /INPUT|TEXTAREA|SELECT/.test(activo.tagName);
  if (forzarRender || !escribiendo) render(); else actualizarCampana();
}

function notificarNuevos(eventos) {
  const nuevos = eventos.filter((e) => !S.vistos.has(e.id) && !S.notificados?.has(e.id));
  S.notificados = S.notificados || new Set();
  nuevos.slice(0, 3).forEach((e) => {
    S.notificados.add(e.id);
    toast(e.texto.split("\n").slice(0, 3).join("\n"), e.tipo === "retraso" || e.tipo === "flota" ? "warn" : "");
    if ("Notification" in window && Notification.permission === "granted" && navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration().then((reg) => reg && reg.showNotification("Transportes GRUP7", { body: e.texto, icon: "icon-192.png", tag: e.id }));
    }
  });
}
function noLeidos() { return S.d ? S.d.eventos.filter((e) => !S.vistos.has(e.id)).length : 0; }
function actualizarCampana() { const b = $("#campana .badge"); const n = noLeidos(); if (b) { b.textContent = n; b.hidden = !n; } }

// ---------------------------------------------------------------- ingreso
function pantallaCodigo() {
  const inp = el("input", { class: "in", type: "password", autocomplete: "off", placeholder: "Código de la unidad" });
  const msg = el("p", { class: "small", style: "color:#ffb4ab" });
  const guardar = async () => {
    const v = inp.value.trim(); if (!v) return;
    Store.token = v;
    try { await Store.api("personas"); pantallaIngreso(); }
    catch (e) { msg.textContent = e.message; }
  };
  $("#app").replaceChildren(el("div", { class: "login" }, el("div", { class: "in-wrap" },
    el("div", { class: "logo" }, "G7"), el("h1", null, "Control de Transportes GRUP7"),
    el("p", { class: "sub" }, "Configurar este equipo (solo la primera vez)"),
    el("div", { class: "setup" },
      el("label", { class: "l", style: "color:#dfe7f2" }, "Código de la unidad (lo da el Jefe de Departamento)"),
      inp, msg, el("button", { class: "btn ac big block", onclick: guardar }, "Guardar")))));
  inp.focus();
}

async function pantallaIngreso() {
  $("#app").replaceChildren(el("div", { class: "login" }, el("div", { class: "in-wrap" }, el("p", null, "Cargando personal…"))));
  let personas;
  try { personas = (await api("personas")).personas; }
  catch (e) {
    $("#app").replaceChildren(el("div", { class: "login" }, el("div", { class: "in-wrap" }, el("p", null, e.message), el("button", { class: "btn ac", onclick: arrancar }, "Reintentar"))));
    return;
  }
  const ultimo = personas.find((p) => p.id === Store.ultimo);
  const grupos = [[R.JEFE, "Jefatura"], [R.OPS, "Operaciones"], [R.DOC, "Parte Documentario"], [R.MANT, "Mantenimiento"], [R.CHOFER, "Choferes"]];
  const tile = (p, cls = "") => el("button", { class: "persona " + cls, onclick: () => pantallaPin(p) }, el("b", null, p.nombre), el("small", null, p.grado + (p.tiene_pin ? "" : " · crear PIN")));
  $("#app").replaceChildren(el("div", { class: "login" }, el("div", { class: "in-wrap" },
    el("div", { class: "logo" }, "G7"),
    el("h1", null, "Control de Transportes"),
    el("p", { class: "sub" }, "Grupo Aéreo N.º 7 · Piura" + (Store.DEMO ? " · MODO DEMO" : "")),
    ultimo ? [el("h3", null, "Continuar como"), el("div", { class: "personas" }, tile(ultimo, "ultimo"))] : null,
    el("h3", null, "¿Quién eres?"),
    grupos.map(([rol, nombre]) => {
      const ps = personas.filter((p) => p.rol === rol && p.activo);
      return ps.length ? [el("h3", null, nombre), el("div", { class: "personas" }, ps.map((p) => tile(p)))] : null;
    }),
    !Store.DEMO ? el("p", { class: "small", style: "margin-top:24px" }, el("a", { href: "#", style: "color:#b9c6d8", onclick: (e) => { e.preventDefault(); Store.token = ""; arrancar(); } }, "Cambiar código de la unidad")) : null)));
}

function pantallaPin(p) {
  let pin = "", primero = "", modo = "ingresar"; // ingresar | crear | repetir
  const dots = el("div", { class: "dots", "aria-hidden": "true" }, [0, 1, 2, 3].map(() => el("span")));
  const titulo = el("p", { class: "sub" }, p.tiene_pin ? "Escribe tu PIN" : "Crea tu PIN de 4 números");
  const msg = el("div", { class: "msg", role: "alert" });
  if (!p.tiene_pin) modo = "crear";
  const pintar = () => dots.querySelectorAll("span").forEach((s, i) => s.classList.toggle("on", i < pin.length));
  const enviar = async () => {
    if (modo === "crear") { primero = pin; pin = ""; modo = "repetir"; titulo.textContent = "Repite tu PIN"; pintar(); return; }
    if (modo === "repetir" && pin !== primero) { msg.textContent = "Los PIN no coinciden. Empieza de nuevo."; pin = ""; primero = ""; modo = "crear"; titulo.textContent = "Crea tu PIN de 4 números"; pintar(); return; }
    msg.textContent = "Verificando…";
    try {
      const r = await Store.api("login", { persona_id: p.id, pin, crear: modo === "repetir" });
      if (r.crear_pin) { modo = "crear"; pin = ""; titulo.textContent = "Aún no tienes PIN: crea uno de 4 números"; msg.textContent = ""; pintar(); return; }
      Store.sesion = r.sesion; Store.ultimo = p.id; S.primera = true; S.tab = null;
      arrancar();
    } catch (e) { msg.textContent = e.message; pin = ""; pintar(); }
  };
  const tecla = (k) => {
    if (k === "⌫") pin = pin.slice(0, -1);
    else if (/\d/.test(k) && pin.length < 4) pin += k;
    pintar();
    if (pin.length === 4) enviar();
  };
  const teclado = (e) => { if (!document.body.contains(dots)) return document.removeEventListener("keydown", teclado); if (/^\d$/.test(e.key)) tecla(e.key); if (e.key === "Backspace") tecla("⌫"); };
  document.addEventListener("keydown", teclado);
  $("#app").replaceChildren(el("div", { class: "login" }, el("div", { class: "in-wrap" }, el("div", { class: "pin" },
    el("div", { class: "quien" }, p.grado + " " + p.nombre), titulo, dots,
    el("div", { class: "pad" }, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) =>
      k ? el("button", { type: "button", onclick: () => tecla(k), "aria-label": k === "⌫" ? "Borrar" : k }, k) : el("span"))),
    msg,
    el("p", null, el("button", { class: "btn ghost", style: "color:#fff;background:transparent;border-color:#2c4a75;margin-top:14px", onclick: pantallaIngreso }, "← Volver"))))));
}

// ---------------------------------------------------------------- estructura principal
const TABS = {
  tablero: ["Tablero", () => vTablero()],
  comisiones: ["Comisiones", () => vComisiones()],
  agenda: ["Mi agenda", () => vAgenda()],
  papeletas: ["Papeletas y combustible", () => vPapeletas()],
  ordenes: ["Órdenes de movimiento", () => vOrdenes()],
  flota: ["Flota", () => vFlota()],
  personal: ["Personal y avisos", () => vPersonal()],
};
const POR_ROL = {
  jefe: ["tablero", "comisiones", "papeletas", "ordenes", "flota", "personal"],
  operaciones: ["comisiones", "flota"],
  documentario: ["ordenes", "papeletas"],
  mantenimiento: ["flota"],
  chofer: ["agenda"],
};

function render() {
  const tabs = POR_ROL[S.yo.rol] || ["agenda"];
  if (!tabs.includes(S.tab)) S.tab = tabs[0];
  const n = noLeidos();
  const header = el("header", { class: "top" },
    el("div", { class: "bar" },
      el("div", { class: "logo", "aria-hidden": "true" }, "G7"),
      el("div", { class: "ttl" }, el("b", null, "Control de Transportes GRUP7"), el("small", null, S.yo.grado + " " + S.yo.nombre + " · " + G.ROL_NOMBRE[S.yo.rol])),
      el("button", { id: "campana", class: "icon-btn", onclick: verAvisos, "aria-label": "Avisos" }, "🔔", el("span", { class: "badge", hidden: !n }, n)),
      el("button", { class: "icon-btn", onclick: menuCuenta, "aria-label": "Mi cuenta" }, "☰")),
    tabs.length > 1 ? el("nav", { class: "tabs" }, tabs.map((t) => el("button", { "aria-current": S.tab === t ? "page" : null, onclick: () => { S.tab = t; render(); } }, TABS[t][0]))) : null);
  const banner = Store.DEMO ? el("div", { class: "demo" }, "MODO DEMO: datos de ejemplo guardados solo en este equipo. Conecta el servidor para usarla de verdad.") : null;
  $("#app").replaceChildren(...[header, banner, el("main", null, TABS[S.tab][1]())].filter(Boolean));
}

function verAvisos() {
  const evs = S.d.eventos;
  modal("Avisos", evs.length ? el("div", null, evs.map((e) => el("div", { class: "evento" + (S.vistos.has(e.id) ? "" : " nuevo") },
    el("time", null, new Date(e.ts).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" })), e.texto)))
    : vacio("Aún no hay avisos. Aquí verás asignaciones, recordatorios y el parte de las 20:00."));
  evs.forEach((e) => S.vistos.add(e.id));
  Store.guardarVistos(S.yo.id, S.vistos);
  actualizarCampana();
}

function menuCuenta() {
  const notif = "Notification" in window;
  const cerrar = modal("Mi cuenta", el("div", null,
    el("p", null, el("b", null, S.yo.grado + " " + S.yo.nombre), el("br"), el("span", { class: "mut" }, G.ROL_NOMBRE[S.yo.rol])),
    el("div", { class: "list" },
      notif ? el("button", { class: "btn block", onclick: activarNotificaciones }, Notification.permission === "granted" ? "✓ Notificaciones activas en este equipo" : "Activar notificaciones en este equipo") : null,
      el("button", { class: "btn block", onclick: () => { cerrar(); vincularTelegram(); } }, S.yo.telegram ? "✓ Telegram vinculado (volver a vincular)" : "Recibir avisos por Telegram"),
      el("button", { class: "btn block", onclick: async () => { try { const r = await api("prueba_aviso"); toast(r.demo ? "En modo demo los avisos solo aparecen dentro de la app." : r.telegram ? "Aviso de prueba enviado a tu Telegram." : "No tienes Telegram vinculado.", "ok"); } catch (e) { toast(e.message, "bad"); } } }, "Enviarme un aviso de prueba"),
      Store.DEMO ? el("button", { class: "btn bad block", onclick: () => { if (confirm("¿Borrar todos los datos de la demostración y empezar de nuevo?")) { Store.reiniciarDemo(); cerrar(); arrancar(); } } }, "Reiniciar datos de demostración") : null,
      el("button", { class: "btn primary block", onclick: () => { Store.sesion = ""; S.yo = null; S.d = null; cerrar(); arrancar(); } }, "Salir (cambiar de persona)")),
    el("p", { class: "small mut" }, "Versión " + G.VERSION + (Store.DEMO ? " · modo demo" : ""))));
}

async function activarNotificaciones() {
  if (!("Notification" in window)) return toast("Este navegador no permite notificaciones.", "bad");
  const r = await Notification.requestPermission();
  toast(r === "granted" ? "Listo: verás los avisos mientras la app esté abierta. Para recibirlos con la app cerrada, vincula Telegram." : "No se dio permiso. Puedes activarlo en la configuración del navegador.", r === "granted" ? "ok" : "warn", 6000);
}

async function vincularTelegram() {
  let r;
  try { r = await api("vincular_telegram"); } catch (e) { return toast(e.message, "bad"); }
  if (Store.DEMO) {
    return modal("Avisos por Telegram", el("div", null, el("p", null, "En modo demo no hay bot de Telegram. Cuando el servidor esté conectado, aquí aparecerá un botón que abre el bot y te vincula con un toque."), el("p", { class: "mut" }, "Tu código sería: " + r.codigo)));
  }
  if (!r.bot) return modal("Avisos por Telegram", el("p", null, "El Jefe aún no configuró el bot de Telegram (ver README, paso “Avisos por Telegram”)."));
  const link = "https://t.me/" + r.bot + "?start=" + r.codigo;
  const cerrar = modal("Avisos por Telegram", el("div", null,
    el("p", null, "1. Toca el botón: se abre Telegram con el bot del Departamento."),
    el("p", null, "2. Pulsa ", el("b", null, "Iniciar"), " (o envía este código: ", el("b", null, r.codigo), ")."),
    el("p", null, "3. Vuelve aquí y toca “Ya lo hice”."),
    el("a", { class: "btn ac big block", href: link, target: "_blank", rel: "noopener", style: "display:block;text-align:center;text-decoration:none" }, "Abrir Telegram"),
    el("p", { class: "small mut" }, "El código vence en 30 minutos.")),
    el("button", { class: "btn primary", onclick: async () => {
      try { const x = await api("revisar_telegram"); if (x.vinculado) { toast("Telegram vinculado. Ya te llegarán los avisos.", "ok"); cerrar(); sincronizar(true); } else toast("Aún no llegó tu mensaje al bot. Espera unos segundos y vuelve a tocar.", "warn"); }
      catch (e) { toast(e.message, "bad"); }
    } }, "Ya lo hice"));
}

// ================================================================ CHOFER: Mi agenda
function vAgenda() {
  const f = S.diaChofer === "hoy" ? hoy() : manana();
  const mias = S.d.comisiones.filter((c) => c.chofer_id === S.yo.id && c.fecha === f).sort(byHora);
  return el("div", null,
    el("div", { class: "toolbar" }, el("div", { class: "chips" },
      el("button", { class: "chip", "aria-pressed": S.diaChofer === "hoy" ? "true" : "false", onclick: () => { S.diaChofer = "hoy"; render(); } }, "Hoy"),
      el("button", { class: "chip", "aria-pressed": S.diaChofer === "man" ? "true" : "false", onclick: () => { S.diaChofer = "man"; render(); } }, "Mañana")),
      el("span", { class: "mut" }, G.fechaLarga(f))),
    mias.length ? el("div", { class: "list two" }, mias.map((c) => cardChofer(c, f === hoy())))
      : vacio(S.diaChofer === "hoy" ? "No tienes comisiones para hoy. Si te asignan una, te llegará un aviso." : "Aún no tienes comisiones para mañana. El parte llega a las 20:00."));
}

function cardChofer(c, esHoy) {
  const v = veh(c.vehiculo_id);
  const cerrada = c.estado === "CANCELADA" || c.estado === "RETORNADA";
  const fuera = c.estado === "EN_CURSO" || c.estado === "EN_DESTINO";
  return el("article", { class: "card com" + (c.estado === "CANCELADA" ? " cancel" : "") },
    el("div", { class: "hora" }, c.hora_salida, el("small", null, c.hora_retorno ? "vuelve ~" + c.hora_retorno : "")),
    el("div", null,
      el("div", { class: "row sp" }, el("span", { class: "dest" }, c.destino), estadoComTag(c)),
      el("div", { class: "meta" }, el("b", null, v ? v.nombre : "—"), combTag(v), el("span", { class: "mut" }, G.ZONA[c.zona]))),
    el("div", { class: "full meta" }, el("span", null, "👥 " + G.etiquetaCarga(c)), retornoTag(c)),
    c.motivo || c.solicitante ? el("div", { class: "full small mut" }, [c.solicitante, c.motivo].filter(Boolean).join(" · ")) : null,
    c.detalle_agrupados ? el("div", { class: "full small" }, tag("Consolidada", "t-ok"), " ", c.detalle_agrupados) : null,
    c.novedad ? el("div", { class: "full small" }, "📝 " + c.novedad) : null,
    el("div", { class: "full paso-hecho" }, [c.salida_real && "Salió " + c.salida_real + " (km " + c.km_salida + ")", c.llegada_real && "Llegó " + c.llegada_real, c.retorno_real && "Retornó " + c.retorno_real + " · " + c.km_recorridos + " km"].filter(Boolean).join(" · ")),
    !cerrada ? el("div", { class: "full tres" },
      el("button", { class: "btn primary", disabled: !esHoy || c.estado !== "PROGRAMADA", onclick: () => pasoSalir(c) }, "Salí a comisión"),
      el("button", { class: "btn ac", disabled: !esHoy || !fuera, onclick: () => pasoLlegar(c) }, "Llegué / Novedad"),
      el("button", { class: "btn", style: "border-color:var(--ok);color:var(--ok)", disabled: !esHoy || !fuera, onclick: () => pasoRetornar(c) }, "Retorné a base"))
      : null,
    !esHoy && !cerrada ? el("div", { class: "full small mut" }, "Los botones se activan el día de la comisión.") : null);
}

function kmInput(valor, min) {
  return el("input", { class: "in", type: "number", inputmode: "numeric", min: min || 0, step: "1", value: valor === "" || valor == null ? "" : valor, style: "font-size:24px;font-weight:800;text-align:center" });
}
async function enviarPaso(c, body, cerrar, optimista) {
  const antes = Object.assign({}, c);
  Object.assign(c, optimista); cerrar(); render(); // se ve al instante
  try { await api("chofer_paso", Object.assign({ id: c.id }, body)); toast("Registrado. Operaciones ya fue avisado.", "ok"); }
  catch (e) { Object.assign(c, antes); toast(e.message, "bad", 7000); }
  sincronizar(true).catch(() => {});
}
function pasoSalir(c) {
  const v = veh(c.vehiculo_id);
  const km = kmInput(v && v.km_actual);
  const cerrar = modal("Salí a comisión", el("div", null,
    el("p", null, el("b", null, c.hora_salida + " · " + c.destino), el("br"), v ? v.nombre : ""),
    el("label", { class: "l" }, "Kilometraje de salida (odómetro)"), km,
    v && v.km_actual ? el("p", { class: "small mut" }, "Último registrado: " + v.km_actual + " km") : null),
    el("button", { class: "btn primary big", onclick: () => {
      if (!(Number(km.value) > 0)) { km.classList.add("err"); return toast("Escribe el kilometraje", "bad"); }
      enviarPaso(c, { paso: "salir", km: Number(km.value) }, cerrar, { estado: "EN_CURSO", salida_real: G.horaLima(new Date()), km_salida: Number(km.value) });
    } }, "Confirmar salida"));
  km.focus();
}
function pasoLlegar(c) {
  let ret = c.retorno;
  const nov = el("textarea", { class: "in", placeholder: "Ej.: me piden volver por Sullana; regreso con 3 personas; demora de 1 hora…" });
  const cerrar = modal("Llegué / Novedad", el("div", null,
    el("p", null, el("b", null, c.destino)),
    el("label", { class: "l" }, "¿Cómo será el retorno?"),
    seg({ CON: "Vuelvo con pasajeros o carga", VACIO: "Vuelvo vacío", POR_CONFIRMAR: "Aún no sé" }, ret, (k) => (ret = k)),
    el("label", { class: "l" }, "Novedad o cambio de ruta (opcional)"), nov),
    el("button", { class: "btn ac big", onclick: () => enviarPaso(c, { paso: "llegar", retorno: ret, novedad: nov.value.trim() }, cerrar, { estado: "EN_DESTINO", retorno: ret, llegada_real: c.llegada_real || G.horaLima(new Date()) }) }, "Avisar a Operaciones"));
}
function pasoRetornar(c) {
  const v = veh(c.vehiculo_id);
  const km = kmInput("", c.km_salida);
  const prev = el("p", { class: "strong" });
  const calc = () => {
    const r = G.calcularKm({ km_salida: c.km_salida, km_llegada: km.value }, v);
    prev.textContent = km.value && Number(km.value) >= Number(c.km_salida) ? "Recorriste " + fmt(r.km_recorridos) + " km · ≈ " + fmt(r.galones_est, 2) + " gl de " + (v ? G.COMBUSTIBLE_NOMBRE[v.combustible] : "") : "";
  };
  km.addEventListener("input", calc);
  const cerrar = modal("Retorné a base", el("div", null,
    el("p", null, el("b", null, c.destino), " · salió con km " + c.km_salida),
    el("label", { class: "l" }, "Kilometraje de llegada (odómetro)"), km, prev),
    el("button", { class: "btn primary big", onclick: () => {
      const n = Number(km.value);
      if (!(n > 0)) { km.classList.add("err"); return toast("Escribe el kilometraje", "bad"); }
      if (n < Number(c.km_salida)) { km.classList.add("err"); return toast("No puede ser menor que el de salida (" + c.km_salida + ")", "bad"); }
      enviarPaso(c, { paso: "retornar", km: n }, cerrar, { estado: "RETORNADA", retorno_real: G.horaLima(new Date()), km_llegada: n });
    } }, "Confirmar retorno"));
  km.focus();
}

// ================================================================ OPERACIONES: Comisiones
function vComisiones() {
  const f = S.fCom || hoy();
  const coms = S.d.comisiones.filter((c) => c.fecha === f).sort(byHora);
  const puede = es(R.JEFE, R.OPS);
  return el("div", null,
    el("div", { class: "toolbar" }, chipsFecha(f, (v) => { S.fCom = v; render(); }), el("span", { class: "grow" }),
      puede && coms.some((c) => c.estado !== "CANCELADA") ? btnWhatsApp(() => G.textoParte(f, S.d.comisiones, S.d.vehiculos, S.d.personal), "Parte por WhatsApp") : null,
      puede ? el("button", { class: "btn ac big", onclick: () => formComision(null, f) }, "+ Nueva comisión") : null),
    el("h2", null, "Comisiones del " + G.fechaLarga(f)),
    panelRetornos(f),
    coms.length ? el("div", { class: "list two" }, coms.map((c) => cardComision(c, puede)))
      : vacio("No hay comisiones para este día." + (puede ? " Toca “+ Nueva comisión” para crear la primera." : "")));
}

function panelRetornos(f) {
  const todas = S.d.comisiones;
  const vig = todas.filter((c) => c.fecha === f && G.activa(c) && c.zona !== "URBANO" && (c.retorno === "VACIO" || c.retorno === "POR_CONFIRMAR")).sort(byHora);
  if (!vig.length) return null;
  return el("div", { class: "alert warn" }, el("b", null, "Control de retornos: " + vig.length + " unidad(es) a las afueras podrían volver vacías"),
    vig.map((c) => {
      const v = veh(c.vehiculo_id);
      const rec = G.recogidasParaRetorno(c, todas);
      return el("div", { class: "row", style: "margin-top:8px" },
        el("div", { class: "grow" }, el("b", { style: "display:inline" }, c.hora_salida + " " + c.destino), " · " + (v ? v.nombre : "") + " · vuelve ~" + G.deMin(G.intervalo(c)[1]) + " · " + (c.retorno === "VACIO" ? "EN VACÍO" : "por confirmar"),
          rec.length ? el("div", { class: "small" }, "↔ " + rec.length + " solicitud(es) de recoger en el sector: " + rec.map((o) => o.destino + " " + o.hora_salida).join(", ")) : null),
        es(R.JEFE, R.OPS) ? el("button", { class: "btn", onclick: () => modalAgrupar(c, "RETORNO") }, "Coordinar retorno") : null);
    }));
}

function cardComision(c, puede) {
  const v = veh(c.vehiculo_id), ch = per(c.chofer_id);
  const k = G.calcularKm(c, v);
  return el("article", { class: "card com" + (c.estado === "CANCELADA" ? " cancel" : "") },
    el("div", { class: "hora" }, c.hora_salida, el("small", null, c.hora_retorno ? "→ " + c.hora_retorno : "")),
    el("div", null,
      el("div", { class: "row sp" }, el("span", { class: "dest" }, c.destino), estadoComTag(c)),
      el("div", { class: "meta" }, el("b", null, v ? v.nombre : "—"), combTag(v), el("span", null, "🧑‍✈️ " + (ch ? ch.nombre : "—")))),
    el("div", { class: "full meta" }, el("span", null, "👥 " + G.etiquetaCarga(c)), retornoTag(c), el("span", { class: "mut small" }, G.ZONA[c.zona] + (c.eje !== "URBANO" ? " · eje " + c.eje.toLowerCase() : ""))),
    c.solicitante || c.motivo ? el("div", { class: "full small mut" }, [c.solicitante, c.motivo].filter(Boolean).join(" · ")) : null,
    c.override_motivo ? el("div", { class: "full small" }, tag("Cambio de unidad", "t-warn"), " " + c.override_motivo) : null,
    c.detalle_agrupados ? el("div", { class: "full small" }, tag("Consolidada", "t-ok"), " " + c.detalle_agrupados) : null,
    c.novedad ? el("div", { class: "full small" }, "📝 " + c.novedad) : null,
    c.salida_real ? el("div", { class: "full kv" },
      el("div", null, el("b", null, "Salió"), c.salida_real + " · km " + c.km_salida),
      el("div", null, el("b", null, "Llegó"), c.llegada_real || "—"),
      el("div", null, el("b", null, "Retornó"), c.retorno_real ? c.retorno_real + " · km " + c.km_llegada : "—"),
      k.km_recorridos !== "" ? el("div", null, el("b", null, "Recorrido"), fmt(k.km_recorridos) + " km · " + fmt(k.galones_est, 2) + " gl") : null) : null,
    puede && G.activa(c) ? el("div", { class: "full row" },
      el("button", { class: "btn", onclick: () => formComision(c) }, "Editar"),
      c.estado === "PROGRAMADA" ? el("button", { class: "btn ghost", onclick: () => modalAgrupar(c, "IDA") }, "Agregar a esta comisión") : null,
      c.estado === "PROGRAMADA" ? el("button", { class: "btn bad", onclick: () => cancelar(c) }, "Cancelar") : null,
      c.estado !== "PROGRAMADA" ? el("button", { class: "btn ghost", onclick: () => pasoPorChofer(c) }, "Registrar retorno (por el chofer)") : null)
      : null);
}

function pasoPorChofer(c) {
  if (c.estado === "EN_CURSO" || c.estado === "EN_DESTINO") pasoRetornar(c);
}

async function cancelar(c) {
  const motivo = prompt("¿Por qué se cancela la comisión a " + c.destino + "? (se avisará al chofer)");
  if (motivo === null) return;
  try { await api("cancelar_comision", { id: c.id, motivo }); toast("Comisión cancelada. Se avisó al chofer.", "ok"); await sincronizar(true); }
  catch (e) { toast(e.message, "bad"); }
}

function modalAgrupar(c, modo, pre) {
  pre = pre || {};
  const v = veh(c.vehiculo_id);
  const k = { cupos: Math.max(0, v.cap_pax - c.pasajeros), espacio: Math.max(0, Math.round((v.cap_carga_t - c.carga_t) * 10) / 10) };
  const pax = el("input", { class: "in", type: "number", inputmode: "numeric", min: 0, value: pre.pasajeros != null ? pre.pasajeros : 1 });
  const carga = el("input", { class: "in", type: "number", inputmode: "decimal", min: 0, step: "0.1", value: pre.carga_t || 0 });
  const quien = el("input", { class: "in", value: pre.solicitante || "", placeholder: "Dependencia o persona" });
  const donde = el("input", { class: "in", value: pre.destino || c.destino });
  const cerrar = modal(modo === "IDA" ? "Agregar a la comisión" : "Coordinar retorno", el("div", null,
    el("p", null, el("b", null, c.hora_salida + " · " + c.destino + " · " + v.nombre)),
    el("p", { class: "mut" }, modo === "IDA" ? "Libres: " + k.cupos + " cupos" + (v.cap_carga_t ? " y " + k.espacio + " t" : "") : "La unidad vuelve a base: indica qué traerá de regreso."),
    el("div", { class: "fila2" }, el("div", null, el("label", { class: "l" }, "Pasajeros"), pax), el("div", null, el("label", { class: "l" }, "Carga (t)"), carga)),
    el("label", { class: "l" }, "Solicitante"), quien,
    el("label", { class: "l" }, modo === "IDA" ? "Destino de esta solicitud" : "Recoger en"), donde),
    el("button", { class: "btn primary big", onclick: async () => {
      try {
        await api("agrupar", { comision_id: c.id, modo, pasajeros: Number(pax.value), carga_t: Number(carga.value), solicitante: quien.value, destino: donde.value });
        cerrar(); toast("Consolidado: se evitó un viaje. Se avisó al chofer.", "ok"); await sincronizar(true);
      } catch (e) { toast(e.message, "bad", 6000); }
    } }, modo === "IDA" ? "Agrupar" : "Guardar retorno"));
}

// ---------- Formulario de comisión con motor de recomendación ----------
function formComision(c, fecha) {
  const F = c ? Object.assign({}, c) : {
    fecha: fecha || hoy(), hora_salida: "", hora_retorno: "", destino: "", zona: "URBANO", eje: "URBANO", servicio: "LLEVAR",
    pasajeros: 1, carga_tipo: "NINGUNA", carga_t: 0, solicitante: "", motivo: "", retorno: "POR_CONFIRMAR", vehiculo_id: "", chofer_id: "", override_motivo: "",
  };
  const yaSalio = c && c.estado !== "PROGRAMADA";
  let elegidoAMano = !!c;
  const catalogo = G.DESTINOS.find((d) => d.nombre === F.destino);
  const input = (k, props) => el("input", Object.assign({ class: "in", value: F[k], oninput: (e) => { F[k] = e.target.value; actualizar(); } }, props));

  // Destino
  const selDest = el("select", { class: "in", onchange: (e) => {
    const d = G.DESTINOS.find((x) => x.nombre === e.target.value);
    otro.hidden = !!d || !e.target.value;
    if (d) { F.destino = d.nombre; F.zona = d.zona; F.eje = d.eje; selZona.value = d.zona; selEje.value = d.eje; }
    else { F.destino = txtDest.value; }
    actualizar();
  } }, el("option", { value: "" }, "Elige el destino…"), G.DESTINOS.map((d) => el("option", { value: d.nombre, selected: d.nombre === F.destino }, d.nombre + " — " + G.ZONA[d.zona])), el("option", { value: "__otro", selected: !!F.destino && !catalogo }, "Otro destino…"));
  const txtDest = el("input", { class: "in", placeholder: "Escribe el destino", value: catalogo ? "" : F.destino, oninput: (e) => { F.destino = e.target.value; actualizar(); } });
  const selZona = el("select", { class: "in", onchange: (e) => { F.zona = e.target.value; if (F.zona === "URBANO") { F.eje = "URBANO"; selEje.value = "URBANO"; } actualizar(); } }, Object.keys(G.ZONA).map((k) => el("option", { value: k, selected: F.zona === k }, G.ZONA[k])));
  const selEje = el("select", { class: "in", onchange: (e) => { F.eje = e.target.value; actualizar(); } }, Object.keys(G.EJE).map((k) => el("option", { value: k, selected: F.eje === k }, G.EJE[k])));
  const otro = el("div", { hidden: !F.destino || !!catalogo }, el("label", { class: "l" }, "Destino"), txtDest, el("label", { class: "l" }, "Eje vial"), selEje);

  // Pasajeros
  const pax = el("input", { class: "in", type: "number", inputmode: "numeric", min: 0, value: F.pasajeros, oninput: (e) => { F.pasajeros = Number(e.target.value) || 0; actualizar(); } });
  const paso = (d) => () => { F.pasajeros = Math.max(0, (Number(F.pasajeros) || 0) + d); pax.value = F.pasajeros; actualizar(); };
  const toneladas = el("input", { class: "in", type: "number", inputmode: "decimal", step: "0.1", min: 0, value: F.carga_t || "", placeholder: "Toneladas", oninput: (e) => { F.carga_t = Number(e.target.value) || 0; actualizar(); } });
  const boxTon = el("div", { hidden: F.carga_tipo === "NINGUNA" }, el("label", { class: "l" }, "Peso aproximado (toneladas)"), toneladas);

  // Zonas que se repintan
  const consBox = el("div");
  const recBox = el("div");
  const chBox = el("div");
  const motivoTxt = el("textarea", { class: "in", placeholder: "Ej.: Kia Rio en mantenimiento preventivo; el solicitante pidió camioneta", oninput: (e) => { F.override_motivo = e.target.value; } }, );
  motivoTxt.value = F.override_motivo || "";
  const motivoBox = el("div", { hidden: true }, el("label", { class: "l" }, "Motivo del cambio (obligatorio)"), el("p", { class: "small", id: "porque", style: "margin:0 0 6px;color:var(--bad);font-weight:700" }), motivoTxt);

  function actualizar() {
    const coms = S.d.comisiones;
    const sol = Object.assign({}, F, { id: c ? c.id : "" });
    const rec = G.recomendar(sol, S.d.vehiculos, coms);
    if (!elegidoAMano) F.vehiculo_id = rec.sugerido;
    // Consolidación
    const cons = F.hora_salida && F.destino ? G.consolidaciones(sol, coms, S.d.vehiculos) : [];
    consBox.replaceChildren(...cons.map((x) => el("div", { class: "alert warn" }, el("b", null, x.tipo === "IDA" ? "⚠ Posible consolidación" : "↔ Coordinar retorno"), x.texto,
      c ? null : el("div", null, el("button", { class: "btn primary", onclick: async () => {
        try {
          await api("agrupar", { comision_id: x.comision.id, modo: x.tipo, pasajeros: F.pasajeros, carga_t: F.carga_t, solicitante: F.solicitante, destino: F.destino });
          cerrar(); toast("Agrupado en la comisión de las " + x.comision.hora_salida + ". Se evitó un viaje.", "ok"); await sincronizar(true);
        } catch (e) { toast(e.message, "bad", 6000); }
      } }, x.tipo === "IDA" ? "Agrupar en esa comisión" : "Que esa unidad lo traiga")))));
    // Vehículos
    const nivelTxt = { recomendado: ["Recomendado", "t-ok"], alternativa: ["Alternativa", "t-info"], posible: ["Posible", "t-mut"], no_apto: ["No alcanza", "t-bad"], ocupado: ["Ocupado", "t-bad"], bloqueado: ["Inoperativo", "t-bad"] };
    recBox.replaceChildren(
      el("div", { class: "recnota" }, "💡 " + rec.nota),
      el("label", { class: "l" }, "Unidad"),
      el("div", { class: "vops" }, rec.lista.map((it) => {
        const v = it.v, nt = nivelTxt[it.nivel];
        const cap = v.cap_pax + " pax" + (G.num(v.cap_carga_t) ? " · " + v.cap_carga_t + " t" : "");
        return el("button", { type: "button", class: "vop " + it.nivel, "aria-pressed": F.vehiculo_id === v.id ? "true" : "false", disabled: it.nivel === "bloqueado" || yaSalio,
          onclick: () => { F.vehiculo_id = v.id; elegidoAMano = true; actualizar(); } },
          el("span", { class: "n" }, v.nombre), el("span", null, tag(nt[0], nt[1])),
          el("span", { class: "s" }, G.COMBUSTIBLE_NOMBRE[v.combustible] + " · " + v.km_gl + " km/gl · " + cap + (it.motivos.length ? " · " + it.motivos.join("; ") : "")));
      })));
    // Choferes
    const libres = choferes().map((p) => ({ p, cruce: F.hora_salida ? G.cruceChofer(p.id, sol, coms) : null })).sort((a, b) => (!!a.cruce - !!b.cruce));
    chBox.replaceChildren(el("label", { class: "l" }, "Chofer"), el("div", { class: "chips" }, libres.map(({ p, cruce }) =>
      el("button", { type: "button", class: "chip" + (cruce ? " busy" : ""), "aria-pressed": F.chofer_id === p.id ? "true" : "false", disabled: yaSalio, title: cruce ? "Ocupado " + cruce.hora_salida + " " + cruce.destino : "Libre",
        onclick: () => { F.chofer_id = p.id; actualizar(); } }, p.nombre + (cruce ? " (" + cruce.hora_salida + ")" : "")))));
    // ¿Necesita motivo?
    let porque = F.vehiculo_id ? G.requiereMotivo(F.vehiculo_id, rec) : "";
    const cch = F.chofer_id && F.hora_salida ? G.cruceChofer(F.chofer_id, sol, coms) : null;
    if (cch) porque = (porque ? porque + ". " : "") + "El chofer ya tiene comisión a " + cch.destino + " a las " + cch.hora_salida;
    motivoBox.hidden = !porque || porque === "BLOQUEADO";
    motivoBox.querySelector("#porque").textContent = porque;
  }

  const form = el("div", null,
    yaSalio ? el("div", { class: "alert info" }, "La unidad ya salió: solo puedes cambiar el retorno, la hora de retorno y los datos de la solicitud.") : null,
    el("div", { class: "fila2" },
      el("div", null, el("label", { class: "l" }, "Fecha"), input("fecha", { type: "date", disabled: yaSalio })),
      el("div", null, el("label", { class: "l" }, "Hora de salida"), input("hora_salida", { type: "time", disabled: yaSalio }))),
    el("label", { class: "l" }, "Destino / zona"), selDest, otro,
    el("div", { class: "fila2" },
      el("div", null, el("label", { class: "l" }, "Tipo de zona"), selZona),
      el("div", null, el("label", { class: "l" }, "Retorno previsto (hora)"), input("hora_retorno", { type: "time" }))),
    el("label", { class: "l" }, "Servicio"), seg(G.SERVICIO, F.servicio, (k) => { F.servicio = k; actualizar(); }),
    el("label", { class: "l" }, "Pasajeros"),
    el("div", { class: "stepper" }, el("button", { type: "button", class: "btn", onclick: paso(-1), "aria-label": "Menos" }, "−"), pax, el("button", { type: "button", class: "btn", onclick: paso(1), "aria-label": "Más" }, "+")),
    el("label", { class: "l" }, "Carga"), seg(G.CARGA, F.carga_tipo, (k) => { F.carga_tipo = k; boxTon.hidden = k === "NINGUNA"; if (k === "NINGUNA") { F.carga_t = 0; toneladas.value = ""; } actualizar(); }), boxTon,
    el("label", { class: "l" }, "Retorno"), seg(G.RETORNO, F.retorno, (k) => { F.retorno = k; actualizar(); }),
    el("div", { class: "fila2" },
      el("div", null, el("label", { class: "l" }, "Solicitante"), input("solicitante", { placeholder: "Dependencia" })),
      el("div", null, el("label", { class: "l" }, "Motivo"), input("motivo", { placeholder: "Ej.: traslado de personal" }))),
    el("h3", null, "Recomendación"), consBox, recBox, chBox, motivoBox);

  const guardar = el("button", { class: "btn primary big", onclick: async () => {
    if (!F.destino || F.destino === "__otro") return toast("Falta el destino", "bad");
    guardar.disabled = true; guardar.textContent = "Guardando…";
    try {
      const r = await api("guardar_comision", { comision: F });
      cerrar();
      const ch = per(r.comision.chofer_id);
      toast((c ? "Comisión actualizada" : "Comisión creada") + ". Se avisó a " + (ch ? ch.nombre : "el chofer") + " y a Operaciones.", "ok");
      if (r.recogidas) toast("Ojo: esta unidad vuelve sin carga y hay " + r.recogidas + " solicitud(es) de recoger en el sector.", "warn", 7000);
      S.fCom = r.comision.fecha;
      await sincronizar(true);
    } catch (e) { toast(e.message, "bad", 7000); guardar.disabled = false; guardar.textContent = "Guardar y avisar"; }
  } }, "Guardar y avisar");
  const cerrar = modal(c ? "Editar comisión" : "Nueva comisión", form, [el("button", { class: "btn ghost", onclick: () => cerrar() }, "Descartar"), guardar]);
  actualizar();
}

// ================================================================ PARTE DOCUMENTARIO
function vPapeletas() {
  const f = S.fDoc || hoy();
  const coms = S.d.comisiones.filter((c) => c.fecha === f && c.estado !== "CANCELADA").sort(byHora);
  const abast = S.d.combustible.filter((a) => a.fecha === f);
  const r = G.resumen(f, f, S.d.comisiones, S.d.vehiculos, S.d.combustible);
  const puedeComb = es(R.JEFE, R.DOC);
  return el("div", null,
    el("div", { class: "toolbar" }, chipsFecha(f, (v) => { S.fDoc = v; render(); }), el("span", { class: "grow" }),
      el("button", { class: "btn", onclick: () => exportarDia(f, coms, abast) }, "Exportar CSV (Excel)"),
      el("button", { class: "btn", onclick: () => copiar(resumenTexto(f, coms, r)) }, "Copiar resumen"),
      btnWhatsApp(() => resumenTexto(f, coms, r))),
    el("h2", null, "Papeletas del " + G.fechaLarga(f)),
    el("div", { class: "grid2" }, ["GASOHOL", "PETROLEO"].map((t) => tarjetaComb(t, r.porComb[t]))),
    el("h3", null, "Comisiones (" + coms.length + ")"),
    coms.length ? el("div", { class: "list" }, coms.map(filaPapeleta)) : vacio("No hay comisiones este día."),
    el("h3", null, "Abastecimientos de combustible"),
    puedeComb ? formAbastecimiento(f) : null,
    abast.length ? el("div", { class: "card scroll-x", style: "margin-top:10px" }, el("table", { class: "t" },
      el("thead", null, el("tr", null, el("th", null, "Unidad"), el("th", null, "Combustible"), el("th", { class: "n" }, "Galones"), el("th", { class: "n" }, "Km"), el("th", null, "Vale"), el("th"))),
      el("tbody", null, abast.map((a) => { const v = veh(a.vehiculo_id); return el("tr", null, el("td", null, v ? v.nombre : a.vehiculo_id), el("td", null, combTag(v)), el("td", { class: "n" }, fmt(a.galones, 2)), el("td", { class: "n" }, a.km_odometro || "—"), el("td", null, a.vale || "—"),
        el("td", null, puedeComb ? el("button", { class: "btn ghost", onclick: () => borrarAbast(a) }, "Borrar") : null)); }))))
      : el("p", { class: "mut" }, "Sin abastecimientos registrados este día."),
    el("h3", null, "Reporte por rango de fechas"), reporteRango());
}

function tarjetaComb(tipo, x) {
  const dif = Math.round((x.gal_real - x.gal_est) * 100) / 100;
  return el("div", { class: "card" },
    el("div", { class: "row sp" }, el("b", null, G.COMBUSTIBLE_NOMBRE[tipo]), tag(tipo === "GASOHOL" ? "Kia Rio · Hilux · Versa" : "Agrale · camiones · minibuses · Hiace · Amarok", tipo === "GASOHOL" ? "t-gas" : "t-pet")),
    el("div", { class: "kv", style: "margin-top:8px" },
      el("div", null, el("b", null, "Viajes cerrados"), x.viajes),
      el("div", null, el("b", null, "Km recorridos"), fmt(x.km)),
      el("div", null, el("b", null, "Gal. estimados"), fmt(x.gal_est, 2)),
      el("div", null, el("b", null, "Gal. abastecidos"), fmt(x.gal_real, 2)),
      el("div", null, el("b", null, "Diferencia"), (dif > 0 ? "+" : "") + fmt(dif, 2) + " gl")));
}

function filaPapeleta(c) {
  const v = veh(c.vehiculo_id), ch = per(c.chofer_id);
  const papeleta = el("input", { class: "in", value: c.papeleta, placeholder: "N.º" });
  const ks = el("input", { class: "in", type: "number", inputmode: "numeric", value: c.km_salida });
  const kl = el("input", { class: "in", type: "number", inputmode: "numeric", value: c.km_llegada });
  const out = el("div", { class: "strong" });
  const calc = () => { const r = G.calcularKm({ km_salida: ks.value, km_llegada: kl.value }, v); out.textContent = r.km_recorridos !== "" ? fmt(r.km_recorridos) + " km · " + fmt(r.galones_est, 2) + " gl " + (v ? G.COMBUSTIBLE_NOMBRE[v.combustible] : "") : "Falta km"; };
  ks.oninput = kl.oninput = calc; calc();
  const btn = el("button", { class: "btn primary", onclick: async () => {
    btn.disabled = true;
    try { await api("doc_comision", { id: c.id, papeleta: papeleta.value, km_salida: ks.value, km_llegada: kl.value }); toast("Papeleta guardada", "ok"); await sincronizar(true); }
    catch (e) { toast(e.message, "bad"); btn.disabled = false; }
  } }, "Guardar");
  return el("div", { class: "card" },
    el("div", { class: "row sp" }, el("div", null, el("b", null, c.hora_salida + " · " + c.destino), el("div", { class: "small mut" }, (v ? v.nombre : "") + " · " + (ch ? ch.nombre : "") + " · " + G.etiquetaCarga(c))), el("div", { class: "row" }, combTag(v), estadoComTag(c))),
    el("div", { class: "fila2", style: "grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-top:6px" },
      el("div", null, el("label", { class: "l" }, "Papeleta"), papeleta),
      el("div", null, el("label", { class: "l" }, "Km salida"), ks),
      el("div", null, el("label", { class: "l" }, "Km llegada"), kl)),
    el("div", { class: "row sp", style: "margin-top:10px" }, out, btn));
}

function formAbastecimiento(f) {
  const sel = el("select", { class: "in" }, el("option", { value: "" }, "Unidad…"), S.d.vehiculos.map((v) => el("option", { value: v.id }, v.nombre + " (" + G.COMBUSTIBLE_NOMBRE[v.combustible] + ")")));
  const gal = el("input", { class: "in", type: "number", inputmode: "decimal", step: "0.01", min: 0, placeholder: "Galones" });
  const km = el("input", { class: "in", type: "number", inputmode: "numeric", placeholder: "Km odómetro" });
  const vale = el("input", { class: "in", placeholder: "N.º de vale" });
  const btn = el("button", { class: "btn ac", onclick: async () => {
    if (!sel.value) return toast("Elige la unidad", "bad");
    btn.disabled = true;
    try { await api("registrar_combustible", { fecha: f, vehiculo_id: sel.value, galones: Number(gal.value), km_odometro: km.value, vale: vale.value }); toast("Abastecimiento registrado", "ok"); await sincronizar(true); }
    catch (e) { toast(e.message, "bad"); btn.disabled = false; }
  } }, "Registrar");
  return el("div", { class: "card" }, el("div", { class: "fila2", style: "grid-template-columns:repeat(auto-fit,minmax(140px,1fr))" },
    el("div", null, el("label", { class: "l" }, "Unidad"), sel), el("div", null, el("label", { class: "l" }, "Galones"), gal),
    el("div", null, el("label", { class: "l" }, "Km odómetro"), km), el("div", null, el("label", { class: "l" }, "Vale"), vale)),
    el("div", { class: "row", style: "margin-top:10px;justify-content:flex-end" }, btn));
}
async function borrarAbast(a) {
  if (!confirm("¿Borrar este abastecimiento de " + a.galones + " gl? No se puede deshacer.")) return;
  try { await api("borrar_combustible", { id: a.id }); toast("Borrado", "ok"); await sincronizar(true); } catch (e) { toast(e.message, "bad"); }
}

function exportarDia(f, coms, abast) {
  const filas = [["Fecha", "Hora", "Destino", "Zona", "Unidad", "Combustible", "Chofer", "Pasajeros", "Carga t", "Retorno", "Estado", "Papeleta", "Km salida", "Km llegada", "Km recorridos", "Galones estimados", "Solicitante", "Motivo", "Consolidación", "Novedad"]];
  coms.forEach((c) => { const v = veh(c.vehiculo_id), ch = per(c.chofer_id), k = G.calcularKm(c, v);
    filas.push([c.fecha, c.hora_salida, c.destino, G.ZONA[c.zona], v ? v.nombre : "", v ? G.COMBUSTIBLE_NOMBRE[v.combustible] : "", ch ? ch.nombre : "", c.pasajeros, c.carga_t, G.RETORNO[c.retorno], G.ESTADO_COM[c.estado], c.papeleta, c.km_salida, c.km_llegada, k.km_recorridos, k.galones_est, c.solicitante, c.motivo, c.detalle_agrupados, c.novedad]); });
  filas.push([]); filas.push(["ABASTECIMIENTOS"]); filas.push(["Fecha", "Unidad", "Combustible", "Galones", "Km odómetro", "Vale"]);
  abast.forEach((a) => { const v = veh(a.vehiculo_id); filas.push([a.fecha, v ? v.nombre : a.vehiculo_id, G.COMBUSTIBLE_NOMBRE[a.combustible], a.galones, a.km_odometro, a.vale]); });
  descargar("GRUP7-papeletas-" + f + ".csv", csv(filas));
}
function resumenTexto(f, coms, r) {
  const vm = G.mapa(S.d.vehiculos), pm = G.mapa(S.d.personal);
  const l = ["RESUMEN DIARIO – TRANSPORTES GRUP7", G.fechaLarga(f).toUpperCase(), ""];
  coms.forEach((c, i) => { const k = G.calcularKm(c, vm[c.vehiculo_id]); l.push((i + 1) + ") " + G.lineaComision(c, vm, pm) + (k.km_recorridos !== "" ? " · " + k.km_recorridos + " km · " + k.galones_est + " gl" : "") + (c.papeleta ? " · Pap. " + c.papeleta : "")); });
  l.push("");
  ["GASOHOL", "PETROLEO"].forEach((t) => { const x = r.porComb[t]; l.push(G.COMBUSTIBLE_NOMBRE[t] + ": " + x.km + " km · " + x.gal_est + " gl estimados · " + x.gal_real + " gl abastecidos"); });
  l.push("Viajes evitados por consolidación: " + r.evitados + " · Retornos en vacío: " + r.retornos_vacios);
  return l.join("\n");
}

function reporteRango() {
  const box = el("div", { class: "card" });
  const d1 = el("input", { class: "in", type: "date", value: hoy().slice(0, 8) + "01" });
  const d2 = el("input", { class: "in", type: "date", value: hoy() });
  const out = el("div");
  const pintar = () => {
    const r = G.resumen(d1.value, d2.value, S.d.comisiones, S.d.vehiculos, S.d.combustible);
    out.replaceChildren(
      el("div", { class: "scroll-x", style: "margin-top:10px" }, el("table", { class: "t" },
        el("thead", null, el("tr", null, el("th", null, "Unidad"), el("th", null, "Combustible"), el("th", { class: "n" }, "Viajes"), el("th", { class: "n" }, "Km"), el("th", { class: "n" }, "Gl est."), el("th", { class: "n" }, "Gl abast."))),
        el("tbody", null, ["GASOHOL", "PETROLEO"].map((t) => [
          ...S.d.vehiculos.filter((v) => v.combustible === t).map((v) => { const x = r.porVeh[v.id]; return el("tr", null, el("td", null, v.nombre), el("td", null, combTag(v)), el("td", { class: "n" }, x.viajes), el("td", { class: "n" }, fmt(x.km)), el("td", { class: "n" }, fmt(x.gal_est, 2)), el("td", { class: "n" }, fmt(x.gal_real, 2))); }),
          el("tr", { style: "font-weight:800" }, el("td", null, "TOTAL " + G.COMBUSTIBLE_NOMBRE[t].toUpperCase()), el("td"), el("td", { class: "n" }, r.porComb[t].viajes), el("td", { class: "n" }, fmt(r.porComb[t].km)), el("td", { class: "n" }, fmt(r.porComb[t].gal_est, 2)), el("td", { class: "n" }, fmt(r.porComb[t].gal_real, 2))),
        ])))),
      el("div", { class: "row", style: "margin-top:10px;justify-content:flex-end" }, el("button", { class: "btn", onclick: () => {
        const filas = [["Unidad", "Combustible", "Viajes", "Km", "Galones estimados", "Galones abastecidos"]];
        S.d.vehiculos.forEach((v) => { const x = r.porVeh[v.id]; filas.push([v.nombre, G.COMBUSTIBLE_NOMBRE[v.combustible], x.viajes, x.km, x.gal_est, x.gal_real]); });
        ["GASOHOL", "PETROLEO"].forEach((t) => filas.push(["TOTAL " + G.COMBUSTIBLE_NOMBRE[t], "", r.porComb[t].viajes, r.porComb[t].km, r.porComb[t].gal_est, r.porComb[t].gal_real]));
        descargar("GRUP7-combustible-" + d1.value + "-al-" + d2.value + ".csv", csv(filas));
      } }, "Exportar CSV")));
  };
  d1.onchange = d2.onchange = pintar;
  box.append(el("div", { class: "fila2" }, el("div", null, el("label", { class: "l" }, "Desde"), d1), el("div", null, el("label", { class: "l" }, "Hasta"), d2)), out);
  pintar();
  return box;
}

// ================================================================ MANTENIMIENTO: Flota
function vFlota() {
  const puede = es(R.JEFE, R.MANT);
  const cont = { OPERATIVO: 0, EN_COMISION: 0, INOPERATIVO: 0 };
  S.d.vehiculos.forEach((v) => cont[v.estado]++);
  return el("div", null,
    el("div", { class: "kpis" },
      el("div", { class: "kpi" }, el("b", { style: "color:var(--ok)" }, cont.OPERATIVO), el("span", null, "Operativos")),
      el("div", { class: "kpi" }, el("b", { style: "color:var(--info)" }, cont.EN_COMISION), el("span", null, "En comisión")),
      el("div", { class: "kpi" }, el("b", { style: "color:var(--bad)" }, cont.INOPERATIVO), el("span", null, "Inoperativos")),
      el("div", { class: "kpi" }, el("b", null, S.d.vehiculos.length), el("span", null, "Total flota"))),
    !puede ? el("p", { class: "mut" }, "Solo Mantenimiento y Jefatura cambian el estado de las unidades.") : null,
    el("div", { class: "list two" }, S.d.vehiculos.map((v) => cardVehiculo(v, puede))));
}
function cardVehiculo(v, puede) {
  const nov = el("input", { class: "in", value: v.novedad, placeholder: "Falla o novedad mecánica (ej.: pastillas de freno gastadas)" });
  let estado = v.estado;
  const prox = S.d.comisiones.filter((c) => c.vehiculo_id === v.id && G.activa(c) && c.fecha >= hoy()).sort(byHora);
  const guardar = async () => {
    if (estado === "INOPERATIVO" && !nov.value.trim()) { nov.classList.add("err"); nov.focus(); return toast("Escribe la falla para marcarlo inoperativo", "bad"); }
    const antes = { estado: v.estado, novedad: v.novedad };
    Object.assign(v, { estado, novedad: nov.value.trim() }); render();
    try { await api("set_estado_vehiculo", { id: v.id, estado, novedad: nov.value.trim() }); toast(v.nombre + ": " + G.ESTADO_VEH[estado] + ". Operaciones fue avisado.", "ok"); }
    catch (e) { Object.assign(v, antes); toast(e.message, "bad"); }
    sincronizar(true).catch(() => {});
  };
  return el("article", { class: "card" },
    el("div", { class: "row sp" }, el("div", { class: "row" }, estadoVehDot(v.estado), el("b", { style: "font-size:17px" }, v.nombre)), combTag(v)),
    el("div", { class: "small mut", style: "margin:4px 0 8px" }, v.km_gl + " km/gl · " + v.cap_pax + " personas" + (G.num(v.cap_carga_t) ? " · " + v.cap_carga_t + " t" : "") + (v.km_actual ? " · odómetro " + v.km_actual + " km" : "")),
    puede ? [
      seg(G.ESTADO_VEH, estado, (k) => { estado = k; if (k !== "INOPERATIVO") guardar(); else { nov.focus(); toast("Escribe la falla y toca “Guardar novedad”", "warn"); } }, "estado-seg"),
      el("div", { class: "row", style: "margin-top:8px" }, el("div", { class: "grow" }, nov), el("button", { class: "btn", onclick: guardar }, "Guardar novedad")),
    ] : [tag(G.ESTADO_VEH[v.estado], v.estado === "OPERATIVO" ? "t-ok" : v.estado === "EN_COMISION" ? "t-info" : "t-bad"), v.novedad ? el("p", { class: "small" }, "🔧 " + v.novedad) : null],
    prox.length ? el("p", { class: "small", style: "margin:8px 0 0" }, "Próximas: " + prox.slice(0, 3).map((c) => (c.fecha === hoy() ? "" : c.fecha.slice(8) + "/" + c.fecha.slice(5, 7) + " ") + c.hora_salida + " " + c.destino).join(" · ")) : null);
}

// ================================================================ JEFE: Tablero
function vTablero() {
  const h = hoy();
  const rango = { hoy: [h, h, "Hoy"], semana: [G.sumarDias(h, -6), h, "Últimos 7 días"], mes: [h.slice(0, 8) + "01", h, "Este mes"] }[S.periodo];
  const r = G.resumen(rango[0], rango[1], S.d.comisiones, S.d.vehiculos, S.d.combustible);
  const enRuta = S.d.comisiones.filter((c) => c.estado === "EN_CURSO" || c.estado === "EN_DESTINO").sort(byHora);
  const prox = S.d.comisiones.filter((c) => c.fecha === h && c.estado === "PROGRAMADA").sort(byHora);
  const inop = S.d.vehiculos.filter((v) => v.estado === "INOPERATIVO");
  const vigilar = S.d.comisiones.filter((c) => c.fecha === h && G.activa(c) && c.zona !== "URBANO" && c.retorno === "VACIO");
  return el("div", null,
    el("div", { class: "toolbar" }, el("div", { class: "chips" }, [["hoy", "Hoy"], ["semana", "7 días"], ["mes", "Mes"]].map(([k, t]) =>
      el("button", { class: "chip", "aria-pressed": S.periodo === k ? "true" : "false", onclick: () => { S.periodo = k; render(); } }, t))),
      el("span", { class: "mut" }, rango[2] + (rango[0] !== rango[1] ? " (" + rango[0].slice(8) + "/" + rango[0].slice(5, 7) + " – " + rango[1].slice(8) + "/" + rango[1].slice(5, 7) + ")" : ""))),
    el("div", { class: "kpis" },
      el("div", { class: "kpi" }, el("b", null, r.total), el("span", null, "Comisiones (" + r.retornadas + " cerradas)")),
      el("div", { class: "kpi hl" }, el("b", { style: "color:var(--ok)" }, r.evitados), el("span", null, "Viajes vacíos evitados (" + r.agrupados + " agrupados · " + r.retornos_coord + " retornos)")),
      el("div", { class: "kpi" }, el("b", { style: "color:" + (r.retornos_vacios ? "var(--warn)" : "inherit") }, r.retornos_vacios), el("span", null, "Retornos en vacío")),
      el("div", { class: "kpi" }, el("b", null, fmt(r.porComb.GASOHOL.km + r.porComb.PETROLEO.km, 0)), el("span", null, "Km recorridos · " + r.pax + " pasajeros"))),
    el("h3", null, "Combustible: estimado vs. real (abastecido)"),
    el("div", { class: "grid2" }, ["GASOHOL", "PETROLEO"].map((t) => tarjetaComb(t, r.porComb[t]))),
    vigilar.length ? el("div", { class: "alert warn", style: "margin-top:14px" }, el("b", null, "Retornos en vacío previstos hoy"), vigilar.map((c) => el("div", null, c.hora_salida + " " + c.destino + " · " + (veh(c.vehiculo_id) || {}).nombre))) : null,
    el("div", { class: "grid2", style: "margin-top:14px" },
      el("div", { class: "card" }, el("b", null, "En ruta ahora (" + enRuta.length + ")"),
        enRuta.length ? enRuta.map((c) => el("div", { class: "row", style: "margin-top:8px" }, el("span", { class: "strong" }, c.salida_real || c.hora_salida), el("span", { class: "grow" }, c.destino + " · " + (veh(c.vehiculo_id) || {}).nombre + " · " + (per(c.chofer_id) || {}).nombre), estadoComTag(c)))
          : el("p", { class: "mut" }, "Ninguna unidad fuera de base.")),
      el("div", { class: "card" }, el("b", null, "Por salir hoy (" + prox.length + ")"),
        prox.length ? prox.map((c) => el("div", { class: "row", style: "margin-top:8px" }, el("span", { class: "strong" }, c.hora_salida), el("span", { class: "grow" }, c.destino + " · " + (veh(c.vehiculo_id) || {}).nombre + " · " + (per(c.chofer_id) || {}).nombre), retornoTag(c)))
          : el("p", { class: "mut" }, "No quedan salidas programadas hoy."))),
    el("h3", null, "Estado de la flota"),
    el("div", { class: "card scroll-x" }, el("table", { class: "t" },
      el("thead", null, el("tr", null, el("th", null, "Unidad"), el("th", null, "Estado"), el("th", null, "Combustible"), el("th", { class: "n" }, "km/gl"), el("th", { class: "n" }, "Km " + rango[2].toLowerCase()), el("th", null, "Novedad"))),
      el("tbody", null, S.d.vehiculos.map((v) => el("tr", null, el("td", { class: "strong" }, v.nombre),
        el("td", null, el("span", { class: "row", style: "gap:6px;flex-wrap:nowrap" }, estadoVehDot(v.estado), G.ESTADO_VEH[v.estado])), el("td", null, combTag(v)), el("td", { class: "n" }, v.km_gl), el("td", { class: "n" }, fmt(r.porVeh[v.id].km)), el("td", { class: "small" }, v.novedad || "—")))))),
    inop.length ? el("p", { class: "small mut" }, inop.length + " unidad(es) inoperativa(s): no se pueden asignar hasta que Mantenimiento las pase a Operativo.") : null);
}

// ================================================================ DOCUMENTARIO: Órdenes de movimiento
const fCorta = (f) => f ? f.slice(8) + "/" + f.slice(5, 7) + "/" + f.slice(0, 4) : "";
const nOrden = (o) => G.numeroOrden(o) + "–" + o.anio;
const ordenDe = (cid) => (S.d.ordenes || []).find((o) => o.comision_id === cid);
const borrador = (c) => G.borradorOrden(c, S.d.vehiculos, S.d.personal, S.d.ordenes || [], hoy(), S.d.conductores || [], S.d.firmas_om || null);

function vOrdenes() {
  const h = hoy(), desde = G.sumarDias(h, -7);
  const coms = S.d.comisiones.filter((c) => c.zona !== "URBANO" && c.estado !== "CANCELADA" && c.fecha >= desde).sort(byHora);
  const pend = coms.filter((c) => !ordenDe(c.id) && c.fecha >= h);
  const ords = (S.d.ordenes || []).slice().sort((a, b) => (b.anio - a.anio) || (G.num(b.numero) - G.num(a.numero)));
  return el("div", null,
    el("div", { class: "toolbar" }, el("h2", { style: "margin:0" }, "Órdenes de movimiento"), el("span", { class: "grow" }),
      el("button", { class: "btn", onclick: () => formOrden(borrador(null)) }, "+ Orden sin comisión")),
    el("p", { class: "small mut" }, "Para comisiones fuera de Piura. Elige la comisión, revisa los datos y descarga el PDF listo para imprimir (A4 horizontal, 2 copias en una hoja)."),
    pend.length ? el("div", { class: "alert warn" }, el("b", null, pend.length + " comisión(es) fuera de Piura sin orden de movimiento")) : null,
    coms.length ? el("div", { class: "list two" }, coms.map(cardOrdenComision))
      : vacio("No hay comisiones fuera de Piura en los últimos 7 días ni programadas."),
    el("h3", null, "Órdenes emitidas (" + ords.length + ")"),
    ords.length ? el("div", { class: "card scroll-x" }, el("table", { class: "t" },
      el("thead", null, el("tr", null, el("th", null, "N.º"), el("th", null, "Inicio"), el("th", null, "Destino"), el("th", null, "Conductor"), el("th", null, "Vehículo"), el("th"))),
      el("tbody", null, ords.map((o) => el("tr", null, el("td", { class: "strong" }, nOrden(o)), el("td", null, fCorta(o.inicio)), el("td", null, o.destino), el("td", null, o.conductor), el("td", null, o.vehiculo),
        el("td", null, el("div", { class: "row", style: "gap:6px;flex-wrap:nowrap" }, accionesOrden(o, true)))))))) : vacio("Aún no hay órdenes emitidas."));
}
function accionesOrden(o, conBorrar) {
  return [
    el("button", { class: "btn primary", onclick: () => descargarOrdenPDF(o) }, "PDF"),
    el("button", { class: "btn ghost", onclick: () => formOrden(Object.assign({}, o)) }, "Editar"),
    conBorrar ? el("button", { class: "btn ghost", onclick: async () => {
      if (!confirm("¿Borrar la Orden N.º " + nOrden(o) + "? No se puede deshacer.")) return;
      try { await api("borrar_orden", { id: o.id }); toast("Orden borrada.", "ok"); await sincronizar(true); } catch (e) { toast(e.message, "bad"); }
    } }, "Borrar") : null,
  ];
}
function cardOrdenComision(c) {
  const v = veh(c.vehiculo_id), ch = per(c.chofer_id), o = ordenDe(c.id);
  return el("div", { class: "card" },
    el("div", { class: "row" }, el("b", { class: "grow" }, fCorta(c.fecha) + " · " + c.hora_salida + " · " + c.destino),
      o ? tag("Orden N.º " + nOrden(o), "t-ok") : tag("Sin orden", c.fecha >= hoy() ? "t-bad" : "t-mut")),
    el("p", { class: "small" }, (v ? v.nombre : "") + " · " + (ch ? ch.nombre : "") + " · " + G.ZONA[c.zona] + (c.motivo ? " · " + c.motivo : "")),
    el("div", { class: "row", style: "gap:6px" }, o ? accionesOrden(o, false)
      : el("button", { class: "btn ac", onclick: () => formOrden(borrador(c)) }, "Hacer orden de movimiento")));
}

function formOrden(o) {
  const F = Object.assign({}, o);
  const input = (k, props) => el("input", Object.assign({ class: "in", value: F[k] == null ? "" : F[k], oninput: (e) => { F[k] = e.target.value; previa(); } }, props));
  const campo = (titulo, control, ayuda) => el("div", null, el("label", { class: "l" }, titulo), control, ayuda || null);
  const c = F.comision_id ? S.d.comisiones.find((x) => x.id === F.comision_id) : null;
  const v = c ? veh(c.vehiculo_id) : null;
  const sug = c ? G.galonesSugeridos(c.destino, v) : null;
  const pre = G.destinoPreset(c ? c.destino : "");
  // Firmas fijas: siempre las del servidor (no se editan aquí).
  if (S.d.firmas_om) G.CLAVES_FIRMA.forEach((k) => (F[k] = S.d.firmas_om[k]));
  const nota = el("p", { class: "small mut" });
  const largo = el("p", { class: "small mut" });
  const prev = el("pre", { class: "parte", style: "white-space:pre-wrap" });
  function previa() {
    const T = G.textosOrden(F);
    nota.textContent = "Combustible en la orden: " + T.COMBUSTIBLE + (sug ? " · sugerido " + sug + " gl (ida y vuelta ~" + pre.km * 2 + " km + 10 %, " + v.km_gl + " km/gl)" : "");
    const muyLargo = G.lineasExtraOrden(T) > G.MAX_LINEAS_EXTRA;
    largo.className = "small " + (muyLargo ? "bad" : "mut");
    largo.textContent = muyLargo ? "⚠ Muy largo: no entraría en una hoja. Acorta la justificación o el destino." : "";
    prev.textContent = "ORDEN DE MISION FAP N° " + T.NUMERO + "– " + T.ANIO + "\nCONDUCTOR      : " + T.CONDUCTOR + "\nVEHICULO       : " + T.VEHICULO + "\nINICIO         : " + T.INICIO +
      "\nTERMINO        : " + T.TERMINO + "\nCOMBUSTIBLE    : " + T.COMBUSTIBLE + "\nDESTINO        : " + T.DESTINO + "\nJUSTIFICACION  : " + T.JUSTIFICACION + "\n\n" + T.LUGAR + ", " + T.FECHA + ".";
  }
  // Conductor: lista desplegable (pestaña Conductores de la hoja) u "Otro".
  const lista = (S.d.conductores || []).map((x) => x.nombre_doc).filter(Boolean);
  const OTRO = "__otro__";
  const txtCond = input("conductor", { placeholder: "Grado y nombre completo" });
  const selCond = el("select", { class: "in", onchange: (e) => {
    txtCond.hidden = e.target.value !== OTRO;
    F.conductor = e.target.value === OTRO ? txtCond.value : e.target.value;
    if (e.target.value === OTRO) txtCond.focus();
    previa();
  } }, el("option", { value: "" }, "— Elige el conductor —"), lista.map((n) => el("option", { value: n, selected: n === F.conductor }, n)), el("option", { value: OTRO, selected: !!F.conductor && !lista.includes(F.conductor) }, "Otro (escribir)"));
  txtCond.hidden = !(F.conductor && !lista.includes(F.conductor));
  // Vehículo: sugerencias con lo ya usado (con placa) y la flota.
  const usados = [...new Set((S.d.ordenes || []).map((x) => x.vehiculo).filter(Boolean).concat(S.d.vehiculos.map((x) => x.nombre)))];
  const dl = el("datalist", { id: "om-vehiculos" }, usados.map((n) => el("option", { value: n })));
  const f = (k) => F[k] || "—";
  const cuerpo = el("div", null,
    c ? el("p", null, el("b", null, "Comisión: " + fCorta(c.fecha) + " " + c.hora_salida + " · " + c.destino + " · " + (v ? v.nombre : ""))) : null,
    el("div", { class: "fila2" }, campo("N.º de orden", input("numero", { type: "number", inputmode: "numeric", min: 1 })), campo("Año", input("anio", { type: "number", inputmode: "numeric" }))),
    campo("Conductor", el("div", null, selCond, txtCond)),
    campo("Vehículo y placa", el("div", null, input("vehiculo", { placeholder: "CAMIÓN HINO EAH-592", list: "om-vehiculos" }), dl)),
    el("div", { class: "fila2" }, campo("Inicio", input("inicio", { type: "date" })), campo("Término", input("termino", { type: "date" }))),
    el("div", { class: "fila2" }, campo("Galones", input("galones", { type: "number", inputmode: "decimal", min: 1, step: "1" })),
      campo("Combustible", seg({ PETROLEO: "Diésel", GASOHOL: "Gasohol" }, F.combustible, (k) => { F.combustible = k; previa(); }))),
    nota,
    campo("Destino", input("destino", { placeholder: "GRUP7 – SULLANA – GRUP7" })),
    campo("Justificación", el("textarea", { class: "in", rows: 2, value: F.justificacion || "", oninput: (e) => { F.justificacion = e.target.value; previa(); } })),
    el("div", { class: "fila2" }, campo("Lugar", input("lugar")), campo("Fecha del documento", input("fecha_emision", { type: "date" }))),
    el("div", { class: "card", style: "margin-top:10px" }, el("b", null, "Firmas (fijas)"),
      el("p", { class: "small" }, f("f1_cargo") + " · " + f("f1_grado") + " " + f("f1_nombre")),
      el("p", { class: "small" }, f("f2_cargo") + " · " + f("f2_grado") + " " + f("f2_nombre")),
      S.d.firmas_om ? null : el("p", { class: "small bad" }, "Faltan las firmas fijas en el servidor: avisa al Jefe.")),
    el("h3", null, "Vista previa"), largo, prev);
  previa();
  async function guardar() {
    try {
      const r = await api("guardar_orden", { orden: F });
      cerrar(); toast("Orden N.º " + nOrden(r.orden) + " guardada.", "ok");
      await sincronizar(true);
      await descargarOrdenPDF(r.orden);
    } catch (e) { toast(e.message, "bad", 6000); }
  }
  const cerrar = modal(F.id ? "Editar orden N.º " + nOrden(F) : "Nueva orden de movimiento", cuerpo,
    el("button", { class: "btn primary big block", onclick: guardar }, "Guardar y descargar PDF"));
}

// ---------- PDF de la orden (A4 horizontal, 2 copias, siempre 1 hoja, sin enlaces ni encabezados del navegador) ----------
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
let cargandoPDF = null;
function cargarJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!cargandoPDF) cargandoPDF = new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = JSPDF_URL; s.crossOrigin = "anonymous";
    s.onload = () => ok(window.jspdf.jsPDF);
    s.onerror = () => { cargandoPDF = null; mal(new Error("No se pudo preparar el PDF: revisa la conexión a internet.")); };
    document.head.append(s);
  });
  return cargandoPDF;
}
function nombreArchivoOrden(o) { return ("Orden de Mision N " + G.numeroOrden(o) + "-" + o.anio + " " + String(o.destino).replace(/GRUP7/gi, "")).replace(/[^\wÁÉÍÓÚÑáéíóúñ -]+/g, " ").replace(/\s+/g, " ").trim(); }
// Las fuentes estándar del PDF no traen "–" ni "…": se cambian por equivalentes.
const pdfTxt = (s) => String(s == null ? "" : s).replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
const DISPOSICIONES = [
  "EL CONDUCTOR NO DEBERA HABER INGERIDO BEBIDAS ALCOHOLICAS 24 HORAS ANTES DE LA COMISION.",
  "TENDRA PRESENTE LAS SIGUIENTE VELOCIDADES:",
  "TENDRA PRECAUCION CON LAS PISTAS MOJADAS, CANGREJERAS, ROMPEMUELLES, ETC.",
  "HARA USO OBLIGATORIO DEL CINTURON DE SEGURIDAD.",
  "LLEVARA CONSIGO TODA LA DOCUMENTACION VIGENTE COMO TARJETA DE PROPIEDAD, BREVETE, SOAT Y REVISION TECNICA ACTUALIZADAS. ASI MISMO GATA, LLAVE DE TUERCA, LLANTA DE REPUESTO, TRIANGULO DE SEGURIDAD, ETC.",
  "NO DESVIARSE DEL ITINERARIO FIJADO POR LA SUPERIORIDAD.",
  "NO TRASLADAR EN EL VEHÍCULO PASAJEROS O CARGA PARTICULAR, CONSTITUYENDO CIRCUNSTANCIA AGRAVANTE POR OBTENER LUCRO.",
];
// Medidas del formato del Departamento (Word): A4 horizontal, márgenes 15 mm, 2 columnas con 18 mm entre ellas.
const OM = { ancho: 297, alto: 210, izq: 15, der: 15, arriba: 12.5, abajo: 12, sep: 18, cab: 8.5 };
OM.col = (OM.ancho - OM.izq - OM.der - OM.sep) / 2;

// Dibuja (o solo mide, si dibujar=false) una copia en la columna que empieza en x0. Devuelve la altura final (mm).
function copiaOrdenPDF(doc, T, x0, fs, dibujar) {
  const W = OM.col, lh = fs * 0.3528 * 1.15, mm = (pt) => pt * 0.3528;
  let y = OM.arriba;
  const fuente = (estilo, tam) => { doc.setFont("helvetica", estilo); doc.setFontSize(tam || fs); };
  const txt = (s, x, yy, op) => { if (dibujar) doc.text(pdfTxt(s), x, yy, op); };
  const subraya = (x, yy, ancho) => { if (dibujar) { doc.setLineWidth(0.2); doc.line(x, yy + 0.7, x + ancho, yy + 0.7); } };
  const anchoDe = (s) => doc.getTextWidth(pdfTxt(s));
  const partir = (s, ancho) => doc.splitTextToSize(pdfTxt(s), ancho);
  const justificada = (linea, x, yy, ancho, ultima) => {
    const pal = linea.split(" ").filter(Boolean);
    if (ultima || pal.length < 2) return txt(linea, x, yy);
    const libre = (ancho - pal.reduce((s, p) => s + anchoDe(p), 0)) / (pal.length - 1);
    let xx = x; pal.forEach((p) => { txt(p, xx, yy); xx += anchoDe(p) + libre; });
  };
  // Título
  y += lh + mm(10);
  fuente("bold"); const t1 = "ORDEN DE MISION FAP N° ", w1 = anchoDe(t1);
  fuente("bold", fs * 1.2); const t2 = T.NUMERO + "- " + T.ANIO, w2 = anchoDe(t2);
  const xt = x0 + (W - w1 - w2) / 2; y += lh * 1.1;
  fuente("bold"); txt(t1, xt, y); fuente("bold", fs * 1.2); txt(t2, xt + w1, y); subraya(xt, y, w1 + w2);
  y += mm(10);
  // Datos
  const xDos = x0 + 37.5, xVal = x0 + 44.5, wVal = W - 44.5;
  [["CONDUCTOR", T.CONDUCTOR, true], ["VEHICULO", T.VEHICULO, true], ["INICIO", T.INICIO], ["TERMINO", T.TERMINO], ["COMBUSTIBLE", T.COMBUSTIBLE], ["DESTINO", T.DESTINO], ["JUSTIFICACION", T.JUSTIFICACION]]
    .forEach(([k, v, negrita]) => {
      fuente(negrita ? "bold" : "normal");
      const lineas = partir(v || " ", wVal);
      y += lh; txt(k, x0, y); txt(":", xDos, y);
      lineas.forEach((l, i) => { if (i) y += lh; txt(l, xVal, y); });
    });
  y += lh;
  // Disposiciones
  fuente("normal"); y += lh; txt("DISPOSICIONES DE SEGURIDAD:", x0, y); subraya(x0, y, anchoDe("DISPOSICIONES DE SEGURIDAD:"));
  const xBala = x0 + 6.3, xTxt = x0 + 12.6, wTxt = W - 12.6;
  DISPOSICIONES.forEach((d, i) => {
    const lineas = partir(d, wTxt);
    lineas.forEach((l, j) => { y += lh; if (!j) txt("•", xBala, y); justificada(l, xTxt, y, wTxt, j === lineas.length - 1); });
    if (i === 1) { y += lh; txt("MAXIMA DENTRO DE LA CIUDAD.... 40 KM/H", xTxt, y); y += lh; txt("MAXIMA FUERA DE LA CIUDAD.... 90 KM/H", xTxt, y); }
  });
  // Fecha
  y += lh; y += lh; txt(T.LUGAR + ", " + T.FECHA + ".", x0 + W, y, { align: "right" });
  // Firmas
  const firma = (n, cx) => ["CARGO", "GRADO", "NOMBRE", "CIP"].forEach((k, i) => { fuente(k === "NOMBRE" ? "bold" : "normal"); y += lh; txt(T["F" + n + "_" + k], cx, y, { align: "center" }); });
  y += lh * 2; firma(1, x0 + W * 0.66);
  y += lh * 3; firma(2, x0 + W * 0.42);
  return y + mm(3);
}
async function descargarOrdenPDF(o) {
  try {
    const jsPDF = await cargarJsPDF();
    const T = G.textosOrden(o);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    // Tamaño de letra: 10 pt como el formato; si algún texto es largo, se reduce hasta que todo entre en una hoja.
    let fs = 10;
    while (fs > 7 && copiaOrdenPDF(doc, T, OM.izq, fs, false) > OM.alto - OM.abajo) fs -= 0.25;
    [OM.izq, OM.izq + OM.col + OM.sep].forEach((x0) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("GRUPO AEREO N° 7", x0, OM.cab); doc.text("ESC. BASE AEREA N° 707", x0 + OM.col, OM.cab, { align: "right" });
      copiaOrdenPDF(doc, T, x0, fs, true);
    });
    doc.setProperties({ title: "Orden de Mision FAP N° " + T.NUMERO + "-" + T.ANIO, subject: "Orden de movimiento", creator: "Control de Transportes GRUP7" });
    doc.save(nombreArchivoOrden(o) + ".pdf");
    toast("PDF descargado: ábrelo e imprímelo (A4 horizontal, 2 copias en una hoja).", "ok", 6000);
    return doc;
  } catch (e) { toast(e.message, "bad", 6000); }
}

// ================================================================ JEFE: Personal y avisos
function vPersonal() {
  const parte = G.textoParte(manana(), S.d.comisiones, S.d.vehiculos, S.d.personal);
  return el("div", null,
    el("h2", null, "Personal"),
    el("div", { class: "card scroll-x" }, el("table", { class: "t" },
      el("thead", null, el("tr", null, el("th", null, "Nombre"), el("th", null, "Rol"), el("th", null, "PIN"), el("th", null, "Telegram"), el("th"))),
      el("tbody", null, S.d.personal.map((p) => el("tr", null, el("td", { class: "strong" }, p.grado + " " + p.nombre), el("td", null, G.ROL_NOMBRE[p.rol]),
        el("td", null, p.tiene_pin ? tag("Creado", "t-ok") : tag("Pendiente", "t-mut")), el("td", null, p.telegram ? tag("Vinculado", "t-ok") : tag("No", "t-mut")),
        el("td", null, p.tiene_pin && p.id !== S.yo.id ? el("button", { class: "btn ghost", onclick: async () => {
          if (!confirm("¿Reiniciar el PIN de " + p.nombre + "? Tendrá que crear uno nuevo al ingresar.")) return;
          try { await api("reset_pin", { persona_id: p.id }); toast("PIN reiniciado. " + p.nombre + " creará uno nuevo al ingresar.", "ok"); await sincronizar(true); } catch (e) { toast(e.message, "bad"); }
        } }, "Reiniciar PIN") : null)))))),
    el("p", { class: "small mut" }, "Para agregar o dar de baja personal, edita la pestaña “Personal” de la hoja de cálculo (columna activo = FALSE)."),
    el("h2", null, "Parte de mañana"),
    el("p", { class: "small mut" }, "Toca “Enviar por WhatsApp”, elige el grupo del Departamento y envía. A las 20:00 el parte también aparece solo en la campana 🔔 de cada uno."),
    el("pre", { class: "parte" }, parte),
    el("div", { class: "row" },
      btnWhatsApp(parte, "Enviar por WhatsApp", "btn wa big"),
      el("button", { class: "btn", onclick: () => copiar(parte) }, "Copiar texto"),
      el("button", { class: "btn ghost", onclick: async () => { if (!confirm("¿Avisar ahora el parte de mañana en la app a todo el personal?")) return; try { await api("enviar_parte"); toast("Parte avisado en la app a todo el personal.", "ok"); await sincronizar(true); } catch (e) { toast(e.message, "bad"); } } }, "Avisar en la app ahora")));
}

// ---------------------------------------------------------------- inicio
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
arrancar();
