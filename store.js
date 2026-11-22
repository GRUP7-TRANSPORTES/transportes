// Capa de datos. Si config.js no tiene SCRIPT_URL, la app funciona en MODO DEMO:
// la misma lógica (logic.js) corre aquí mismo y guarda en este navegador.
const Store = (function () {
  const DEMO = !window.SCRIPT_URL;
  const K = { db: "grup7_demo_db_v1", sesion: "grup7_sesion", token: "grup7_token", ultimo: "grup7_ultimo", vistos: "grup7_vistos_" };
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  class ErrorApp extends Error { constructor(msg, extra) { super(msg); Object.assign(this, extra || {}); } }

  // ------------------------------------------------------------------ modo demo
  // Datos de ejemplo para la Orden de Movimiento (los reales viven solo en el servidor).
  function demoOrdenes(d) {
    if (!d.Conductores || !d.Conductores.length) d.Conductores = d.Personal.filter((p) => p.rol === "chofer").map((p, i) => ({ id: p.id, nombre_doc: "CON. FAP " + p.nombre.toUpperCase() + " (DEMO)", persona_id: p.id, activo: true, nsa: "DEMO" + (101 + i) }));
    d.Config = d.Config || [];
    const f = { f1_cargo: "EL CMDTE DEL ESC. DE BASE AÉREA Nº707", f1_grado: "Capitán FAP", f1_nombre: "NOMBRE DE EJEMPLO", f1_cip: "O-0000000-O+",
      f2_cargo: "EL COMANDANTE DEL GRUPO AÉREO N° 7", f2_grado: "Coronel FAP", f2_nombre: "NOMBRE DE EJEMPLO", f2_cip: "O-0000000-O+" };
    Object.keys(f).forEach((k) => { if (!d.Config.some((c) => c.id === "om_" + k)) d.Config.push({ id: "om_" + k, valor: f[k] }); });
  }
  function semillaDemo() {
    const d = {};
    Object.keys(GRUP7.TABLAS).forEach((t) => (d[t] = []));
    d.Vehiculos = clone(GRUP7.SEMILLA_VEHICULOS);
    d.Personal = clone(GRUP7.SEMILLA_PERSONAL);
    demoOrdenes(d);
    const km = { AGRALE: 182340, ISOTERMICO: 96410, DONGFENG: 74120, COUNTY: 151880, COASTER: 203115, HIACE: 128870, AMAROK: 88452, HILUX: 112300, KIARIO: 45210, VERSA: 61005 };
    d.Vehiculos.forEach((v, i) => { v.km_actual = km[v.id]; v.placa = "DEM-" + (101 + i); }); // placas de ejemplo; las reales están en el servidor
    // Comisiones de ejemplo para que el tablero no esté vacío (solo existen en modo demo).
    const ahora = new Date();
    const hoy = GRUP7.fechaLima(ahora), man = GRUP7.sumarDias(hoy, 1);
    let base = GRUP7.aMin(GRUP7.horaLima(ahora));
    const hoyOk = base < 20 * 60;
    const f = hoyOk ? hoy : man;
    if (!hoyOk) base = 7 * 60;
    const H = (m) => GRUP7.deMin(Math.min(base + m, 23 * 60 + 30));
    let n = 0;
    const com = (x) => d.Comisiones.push(Object.assign({
      id: "demo" + (++n), hora_retorno: "", servicio: "LLEVAR", carga_tipo: "NINGUNA", carga_t: 0, solicitante: "", motivo: "",
      retorno: "POR_CONFIRMAR", estado: "PROGRAMADA", recomendado_id: x.vehiculo_id, override_motivo: "", agrupados: 0, retornos_coord: 0, detalle_agrupados: "",
      salida_real: "", km_salida: "", llegada_real: "", novedad: "", retorno_real: "", km_llegada: "", km_recorridos: "", galones_est: "", papeleta: "",
      aviso45: "", aviso_retraso: "", creado_por: "VALLEJOS", creado: ahora.toISOString(), actualizado: ahora.toISOString(),
    }, x));
    const real = GRUP7.aMin(GRUP7.horaLima(ahora));
    const P = (m) => GRUP7.deMin(Math.max(real - m, 0)); // horas ya pasadas de hoy
    com({ fecha: hoy, hora_salida: P(180), hora_retorno: P(90), destino: "Catacaos", zona: "AFUERAS", eje: "SUR", pasajeros: 6, vehiculo_id: "HIACE", chofer_id: "HERRADA",
      solicitante: "Escuadrón de Mantenimiento", motivo: "Traslado de personal", retorno: "CON", estado: "RETORNADA", salida_real: P(178), km_salida: 128812,
      llegada_real: P(150), retorno_real: P(92), km_llegada: 128870, km_recorridos: 58, galones_est: 3.87, papeleta: "P-0412" });
    com({ fecha: f, hora_salida: H(70), hora_retorno: H(160), destino: "Castilla", zona: "URBANO", eje: "URBANO", pasajeros: 3, vehiculo_id: "KIARIO", chofer_id: "ROSAS",
      solicitante: "Comando GRUP7", motivo: "Gestión documentaria", retorno: "CON" });
    com({ fecha: f, hora_salida: H(110), hora_retorno: H(330), destino: "Sullana", zona: "AFUERAS", eje: "NORTE", pasajeros: 2, carga_tipo: "LIGERA", carga_t: 0.4,
      vehiculo_id: "AMAROK", chofer_id: "YNGA", solicitante: "Logística", motivo: "Entrega de repuestos", retorno: "VACIO" });
    com({ fecha: man, hora_salida: "07:00", hora_retorno: "13:00", destino: "Paita", zona: "AFUERAS", eje: "OESTE", pasajeros: 24, vehiculo_id: "COUNTY", chofer_id: "JUAREZ",
      solicitante: "Escuadrilla de Seguridad", motivo: "Apoyo a ceremonia", retorno: "CON" });
    com({ fecha: man, hora_salida: "08:30", hora_retorno: "15:00", destino: "Tambogrande", zona: "AFUERAS", eje: "NORESTE", pasajeros: 1, carga_tipo: "PESADA", carga_t: 1.5,
      vehiculo_id: "DONGFENG", chofer_id: "PAZ", solicitante: "Intendencia", motivo: "Traslado de víveres", retorno: "VACIO" });
    d.Combustible.push({ id: "demoA1", fecha: hoy, vehiculo_id: "HIACE", combustible: "PETROLEO", galones: 4, km_odometro: 128870, vale: "V-2231", comision_id: "demo1", registrado_por: "MUNIVE", creado: ahora.toISOString() });
    return d;
  }
  let demoData = null;
  function demoCargar() {
    if (demoData) return demoData;
    try { demoData = JSON.parse(ls.get(K.db) || "null"); } catch { demoData = null; }
    if (!demoData) { demoData = semillaDemo(); demoGuardar(); }
    else if (!demoData.Conductores || !demoData.Conductores.length) { demoOrdenes(demoData); demoGuardar(); }
    return demoData;
  }
  function demoGuardar() { ls.set(K.db, JSON.stringify(demoData)); }
  function memDB(d) {
    return {
      all: (t) => (d[t] || []).map((o) => Object.assign({}, o)),
      get: (t, id) => { const x = (d[t] || []).find((o) => o.id === id); return x ? Object.assign({}, x) : null; },
      insert: (t, o) => { const x = Object.assign({}, o); (d[t] = d[t] || []).push(x); return Object.assign({}, x); },
      update: (t, id, p) => { const x = (d[t] || []).find((o) => o.id === id); if (!x) throw new Error("No encontrado: " + id); Object.assign(x, p); return Object.assign({}, x); },
      remove: (t, id) => { d[t] = (d[t] || []).filter((o) => o.id !== id); },
    };
  }
  async function sha256(s) {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    }
    let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return "x" + h; // respaldo solo para la demo
  }
  const fallosDemo = {};
  async function demoApi(action, body) {
    const d = demoCargar();
    const db = memDB(d);
    const uid = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (action === "personas") return { personas: d.Personal.map(GRUP7.publico) };
    if (action === "login") {
      const p = db.get("Personal", body.persona_id);
      if (!p) throw new ErrorApp("Persona no encontrada");
      if ((fallosDemo[p.id] || 0) >= 5) throw new ErrorApp("Demasiados intentos. Espera 15 minutos o pide al Jefe que reinicie tu PIN.");
      if (!/^\d{4}$/.test(body.pin || "")) throw new ErrorApp("El PIN es de 4 números");
      if (!p.pin_hash) {
        if (!body.crear) return { crear_pin: true };
        const sal = uid();
        db.update("Personal", p.id, { pin_sal: sal, pin_hash: await sha256(sal + ":" + body.pin) });
        demoGuardar();
      } else if ((await sha256(p.pin_sal + ":" + body.pin)) !== p.pin_hash) {
        fallosDemo[p.id] = (fallosDemo[p.id] || 0) + 1;
        throw new ErrorApp("PIN incorrecto (" + (5 - fallosDemo[p.id]) + " intentos más)");
      }
      fallosDemo[p.id] = 0;
      const fresco = db.get("Personal", p.id);
      return { sesion: "demo." + p.id + "." + fresco.pin_hash.slice(0, 12), persona: GRUP7.publico(fresco) };
    }
    const partes = String(body.sesion || "").split(".");
    const yo = db.get("Personal", partes[1]);
    if (!yo || !yo.pin_hash || yo.pin_hash.slice(0, 12) !== partes[2]) throw new ErrorApp("Tu sesión terminó. Ingresa de nuevo con tu PIN.", { sesion: false });
    if (action === "revisar_telegram") return { vinculado: false };
    if (action === "prueba_aviso") return { ok: true, telegram: false, webhook: false, demo: true };
    const ctx = { db, now: new Date(), yo, uid, externo: null };
    // En la demo, las tareas automáticas (recordatorio 45 min, parte 20:00) corren en cada sincronización.
    if (action === "sync") GRUP7.Jobs.todo(Object.assign({}, ctx, { yo: { id: "SISTEMA", rol: "jefe" } }));
    try {
      const res = GRUP7.ejecutar(ctx, action, body);
      if (action === "sync" || action === "vincular_telegram") res.bot = "";
      return clone(res);
    } catch (e) {
      demoData = null; // descarta cambios a medias
      throw new ErrorApp(e.message);
    } finally {
      if (demoData) demoGuardar();
    }
  }

  // ------------------------------------------------------------------ servidor real
  async function remotoApi(action, body) {
    let res;
    try {
      res = await fetch(window.SCRIPT_URL, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=utf-8" }, // evita el preflight CORS que Apps Script no responde
        body: JSON.stringify(Object.assign({ action, token: ls.get(K.token) || "", sesion: ls.get(K.sesion) || "" }, body)),
      });
    } catch {
      throw new ErrorApp("Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.", { red: true });
    }
    const data = await res.json().catch(() => ({}));
    if (data.auth === false) { ls.set(K.token, null); throw new ErrorApp(data.error || "Código de la unidad incorrecto", { auth: false }); }
    if (data.sesion === false) { ls.set(K.sesion, null); throw new ErrorApp(data.error, { sesion: false }); }
    if (!res.ok || data.error) throw new ErrorApp(data.error || "Error " + res.status);
    return data;
  }

  async function api(action, body) {
    body = Object.assign({ sesion: ls.get(K.sesion) || "" }, body || {});
    return DEMO ? demoApi(action, body) : remotoApi(action, body);
  }

  return {
    DEMO,
    api,
    get token() { return ls.get(K.token) || ""; }, set token(v) { ls.set(K.token, v || null); },
    get sesion() { return ls.get(K.sesion) || ""; }, set sesion(v) { ls.set(K.sesion, v || null); },
    get ultimo() { return ls.get(K.ultimo) || ""; }, set ultimo(v) { ls.set(K.ultimo, v || null); },
    vistos(id) { try { return new Set(JSON.parse(ls.get(K.vistos + id) || "[]")); } catch { return new Set(); } },
    guardarVistos(id, set) { ls.set(K.vistos + id, JSON.stringify([...set].slice(-300))); },
    reiniciarDemo() { demoData = null; ls.set(K.db, null); ls.set(K.sesion, null); },
  };
})();
