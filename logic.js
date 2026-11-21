// Control de Transportes GRUP7 — lógica compartida.
// Este MISMO archivo se usa en la app (web/logic.js) y en Apps Script (pegar como Logica.gs).
// No usa nada del navegador ni de Google: solo JavaScript puro.
var GRUP7 = (function () {
  "use strict";

  const VERSION = "1.0.0";
  const OFFSET_MIN = -300; // Perú: UTC-5 fijo, sin horario de verano.

  const ROL = { JEFE: "jefe", OPS: "operaciones", DOC: "documentario", MANT: "mantenimiento", CHOFER: "chofer" };
  const ROL_NOMBRE = { jefe: "Jefe de Departamento", operaciones: "Operaciones", documentario: "Parte Documentario", mantenimiento: "Mantenimiento", chofer: "Chofer" };

  const TABLAS = {
    Vehiculos: ["id", "nombre", "combustible", "km_gl", "cap_pax", "cap_carga_t", "tipo", "refrigerado", "estado", "novedad", "km_actual", "actualizado", "actualizado_por"],
    Personal: ["id", "nombre", "grado", "rol", "pin_hash", "pin_sal", "telegram_chat_id", "tg_codigo", "tg_codigo_exp", "activo"],
    Comisiones: ["id", "fecha", "hora_salida", "hora_retorno", "destino", "zona", "eje", "servicio", "pasajeros", "carga_tipo", "carga_t", "solicitante", "motivo", "vehiculo_id", "chofer_id", "retorno", "estado", "recomendado_id", "override_motivo", "agrupados", "retornos_coord", "detalle_agrupados", "salida_real", "km_salida", "llegada_real", "novedad", "retorno_real", "km_llegada", "km_recorridos", "galones_est", "papeleta", "aviso45", "aviso_retraso", "creado_por", "creado", "actualizado"],
    Combustible: ["id", "fecha", "vehiculo_id", "combustible", "galones", "km_odometro", "vale", "comision_id", "registrado_por", "creado"],
    Eventos: ["id", "ts", "tipo", "para", "texto", "comision_id"],
    Config: ["id", "valor"],
  };

  const COMBUSTIBLE_NOMBRE = { PETROLEO: "Petróleo", GASOHOL: "Gasohol Regular" };
  const ESTADO_VEH = { OPERATIVO: "Operativo", EN_COMISION: "En Comisión", INOPERATIVO: "Inoperativo" };
  const ESTADO_COM = { PROGRAMADA: "Programada", EN_CURSO: "En ruta", EN_DESTINO: "En destino", RETORNADA: "Retornó", CANCELADA: "Cancelada" };
  const RETORNO = { CON: "Con pasajeros/carga", VACIO: "En vacío previsto", POR_CONFIRMAR: "Por confirmar" };
  const SERVICIO = { LLEVAR: "Llevar", RECOGER: "Recoger (traer a base)", LLEVAR_TRAER: "Llevar y traer" };
  const CARGA = { NINGUNA: "Sin carga", LIGERA: "Bultos / carga ligera", PESADA: "Carga pesada", REFRIGERADA: "Refrigerada / sensible" };
  const ZONA = { URBANO: "Piura urbano", AFUERAS: "Afueras de Piura", TROCHA: "Trocha / sierra" };
  const EJE = { URBANO: "Urbano", NORTE: "Norte (Sullana–Talara)", NORESTE: "Noreste (Tambogrande–Ayabaca)", ESTE: "Este (Chulucanas–Huancabamba)", SUR: "Sur (Catacaos–Sechura)", OESTE: "Oeste (Paita)" };

  const DESTINOS = [
    ["Piura Cercado", "URBANO", "URBANO"], ["Castilla", "URBANO", "URBANO"], ["Veintiséis de Octubre", "URBANO", "URBANO"],
    ["Aeropuerto Piura", "URBANO", "URBANO"], ["Hospital / clínica (Piura)", "URBANO", "URBANO"],
    ["Catacaos", "AFUERAS", "SUR"], ["La Arena", "AFUERAS", "SUR"], ["La Unión", "AFUERAS", "SUR"], ["Sechura", "AFUERAS", "SUR"], ["Bayóvar", "AFUERAS", "SUR"],
    ["Paita", "AFUERAS", "OESTE"],
    ["Sullana", "AFUERAS", "NORTE"], ["Talara", "AFUERAS", "NORTE"], ["Máncora", "AFUERAS", "NORTE"],
    ["Tambogrande", "AFUERAS", "NORESTE"], ["Las Lomas", "AFUERAS", "NORESTE"], ["Ayabaca", "TROCHA", "NORESTE"],
    ["Chulucanas", "AFUERAS", "ESTE"], ["Morropón", "AFUERAS", "ESTE"], ["Huancabamba", "TROCHA", "ESTE"],
  ].map(function (d) { return { nombre: d[0], zona: d[1], eje: d[2] }; });

  // ---------- Datos semilla ----------
  function v(id, nombre, comb, kmgl, pax, carga, tipo, estado, novedad, refri) {
    return { id: id, nombre: nombre, combustible: comb, km_gl: kmgl, cap_pax: pax, cap_carga_t: carga, tipo: tipo, refrigerado: !!refri, estado: estado || "OPERATIVO", novedad: novedad || "", km_actual: "", actualizado: "", actualizado_por: "" };
  }
  const SEMILLA_VEHICULOS = [
    v("AGRALE", "BUS AGRALE", "PETROLEO", 11, 50, 0, "bus"),
    v("ISOTERMICO", "CAMIÓN ISOTÉRMICO", "PETROLEO", 15, 2, 3, "camion", "", "", true),
    v("DONGFENG", "CAMIÓN DONGFENG", "PETROLEO", 15, 2, 2, "camion"),
    v("COUNTY", "MINIBUS COUNTY", "PETROLEO", 12, 30, 0, "minibus"),
    v("COASTER", "MINIBUS COASTER", "PETROLEO", 12, 29, 0, "minibus", "INOPERATIVO", "Ruptura de polea volante"),
    v("HIACE", "COMBI HIACE", "PETROLEO", 15, 7, 0, "combi"),
    v("AMAROK", "AMAROK 2DO", "PETROLEO", 20, 4, 1, "pickup"),
    v("HILUX", "HILUX", "GASOHOL", 20, 4, 1, "pickup"),
    v("KIARIO", "KIA RIO", "GASOHOL", 30, 4, 0, "auto"),
    v("VERSA", "NISSAN VERSA", "GASOHOL", 30, 4, 0, "auto", "INOPERATIVO", "Trapecios de dirección y llantas con desgaste"),
  ];
  function p(id, grado, nombre, rol) { return { id: id, nombre: nombre, grado: grado, rol: rol, pin_hash: "", pin_sal: "", telegram_chat_id: "", tg_codigo: "", tg_codigo_exp: "", activo: true }; }
  const SEMILLA_PERSONAL = [
    p("GARCIA", "Alférez", "Nicolás García", ROL.JEFE),
    p("VALLEJOS", "TIP", "Vallejos", ROL.OPS),
    p("MUNIVE", "TC3", "Munive", ROL.DOC),
    p("ANDRADE", "TC3", "Andrade", ROL.DOC),
    p("FLORES", "SO2", "Flores", ROL.MANT),
    p("ALBURQUEQUE", "Mecánico", "Alburqueque", ROL.MANT),
    p("YNGA", "Chofer", "YNGA", ROL.CHOFER),
    p("ROSAS", "Chofer", "ROSAS", ROL.CHOFER),
    p("HERRADA", "Chofer", "HERRADA", ROL.CHOFER),
    p("JUAREZ", "Chofer", "JUAREZ", ROL.CHOFER),
    p("PAZ", "Chofer", "PAZ", ROL.CHOFER),
    p("TABOADA", "Chofer", "TABOADA", ROL.CHOFER),
    p("LIVIA", "Chofer", "LIVIA RULY", ROL.CHOFER),
  ];

  // ---------- Utilidades de fecha (hora de Lima) ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function lima(d) { return new Date(d.getTime() + OFFSET_MIN * 60000); }
  function fechaLima(d) { const x = lima(d); return x.getUTCFullYear() + "-" + pad(x.getUTCMonth() + 1) + "-" + pad(x.getUTCDate()); }
  function horaLima(d) { const x = lima(d); return pad(x.getUTCHours()) + ":" + pad(x.getUTCMinutes()); }
  function sumarDias(fecha, n) { const d = new Date(fecha + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function aMin(h) { if (!h || !/^\d{1,2}:\d{2}$/.test(h)) return null; const a = h.split(":"); return (+a[0]) * 60 + (+a[1]); }
  function deMin(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function fechaHora(fecha, hora) { return new Date(fecha + "T" + hora + ":00-05:00"); }
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  function fechaLarga(fecha) { const d = new Date(fecha + "T12:00:00Z"); return DIAS[d.getUTCDay()] + " " + fecha.slice(8, 10) + "/" + fecha.slice(5, 7) + "/" + fecha.slice(0, 4); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function num(x) { const n = Number(x); return isFinite(n) ? n : 0; }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function txt(s, max) { return String(s == null ? "" : s).trim().slice(0, max || 200); }

  function esSi(x) { return x === true || String(x).toUpperCase() === "TRUE"; }
  function falla(msg) { const e = new Error(msg); e.usuario = true; return e; }

  // ---------- Reglas de ocupación ----------
  const ACTIVAS = { PROGRAMADA: 1, EN_CURSO: 1, EN_DESTINO: 1 };
  function activa(c) { return !!ACTIVAS[c.estado]; }
  function duracionDefecto(zona) { return zona === "URBANO" ? 120 : zona === "TROCHA" ? 480 : 300; }
  function intervalo(c) {
    const ini = aMin(c.hora_salida);
    let fin = aMin(c.hora_retorno);
    if (fin == null) fin = ini + duracionDefecto(c.zona);
    if (fin <= ini) fin += 1440;
    return [ini, fin];
  }
  function seCruzan(a, b) {
    if (a.fecha !== b.fecha) return false;
    const x = intervalo(a), y = intervalo(b);
    return x[0] < y[1] && y[0] < x[1];
  }
  function cruceVehiculo(vehId, sol, comisiones) {
    for (let i = 0; i < comisiones.length; i++) {
      const c = comisiones[i];
      if (c.vehiculo_id === vehId && c.id !== sol.id && activa(c) && seCruzan(c, sol)) return c;
    }
    return null;
  }
  function cruceChofer(choferId, sol, comisiones) {
    for (let i = 0; i < comisiones.length; i++) {
      const c = comisiones[i];
      if (c.chofer_id === choferId && c.id !== sol.id && activa(c) && seCruzan(c, sol)) return c;
    }
    return null;
  }

  // ---------- Motor de recomendación ----------
  function reglaPreferencia(sol) {
    const pax = num(sol.pasajeros), carga = num(sol.carga_t), tipo = sol.carga_tipo || "NINGUNA";
    const conCarga = carga > 0 || tipo !== "NINGUNA";
    const r = { pref: [], alt: [], nota: "", varias: false };
    if (tipo === "REFRIGERADA" || carga > 2) {
      r.pref = ["ISOTERMICO"];
      r.alt = carga <= 2 && tipo !== "REFRIGERADA" ? ["DONGFENG"] : [];
      r.nota = tipo === "REFRIGERADA" ? "Carga refrigerada o sensible: Camión Isotérmico." : "Carga de " + carga + " t: Camión Isotérmico (hasta 3 t).";
      if (carga > 3) { r.varias = true; r.nota += " Supera 3 t: hay que dividirla en dos viajes o dos unidades (Isotérmico + Dongfeng)."; }
      if (pax > 2) r.nota += " Los " + pax + " pasajeros no entran en la cabina: coordine otra unidad.";
      return r;
    }
    if (carga > 1 || tipo === "PESADA") {
      r.pref = ["DONGFENG"]; r.alt = ["ISOTERMICO"];
      r.nota = "Carga de hasta 2 t: Camión Dongfeng.";
      if (pax > 2) r.nota += " Los " + pax + " pasajeros no entran en la cabina: coordine otra unidad.";
      return r;
    }
    if (pax <= 4) {
      if (conCarga) { r.pref = ["AMAROK", "HILUX"]; r.alt = ["DONGFENG"]; r.nota = "1–4 personas con bultos: Amarok o Hilux (tolva de 1 t)."; }
      else if (sol.zona === "URBANO") { r.pref = ["KIARIO"]; r.alt = ["VERSA", "HILUX", "AMAROK"]; r.nota = "1–4 personas dentro de Piura: Kia Rio, la más económica (30 km/gl)."; }
      else { r.pref = ["AMAROK", "HILUX"]; r.alt = ["HIACE"]; r.nota = "1–4 personas a las afueras o trocha: Amarok o Hilux (20 km/gl, 4x4)."; }
      return r;
    }
    if (pax <= 7) { r.pref = ["HIACE"]; r.alt = ["COUNTY"]; r.nota = "5–7 personas: Combi Hiace."; }
    else if (pax <= 30) { r.pref = ["COUNTY"]; r.alt = ["COASTER", "AGRALE"]; r.nota = "8–30 personas: Minibus County. El Bus Agrale solo si no hay County."; }
    else if (pax <= 50) { r.pref = ["AGRALE"]; r.alt = []; r.nota = "31–50 personas: Bus Agrale."; }
    else { r.pref = ["AGRALE"]; r.alt = ["COUNTY"]; r.varias = true; r.nota = "Más de 50 personas: se necesitan dos unidades (Bus Agrale + Minibus County)."; }
    if (conCarga) r.nota += " Con carga: considere enviarla aparte en Amarok/Hilux.";
    return r;
  }

  // Devuelve { sugerido, nota, lista:[{v, nivel, motivos, ocupada}] }
  // nivel: recomendado | alternativa | posible | no_apto | ocupado | bloqueado
  function recomendar(sol, vehiculos, comisiones) {
    const regla = reglaPreferencia(sol);
    const pax = num(sol.pasajeros), carga = num(sol.carga_t);
    const lista = vehiculos.map(function (veh) {
      const motivos = [];
      let nivel;
      const cruce = sol.hora_salida ? cruceVehiculo(veh.id, sol, comisiones) : null;
      const refri = esSi(veh.refrigerado);
      const apto = (regla.varias || pax <= num(veh.cap_pax)) && (regla.varias || carga <= num(veh.cap_carga_t)) && (sol.carga_tipo !== "REFRIGERADA" || refri);
      if (veh.estado === "INOPERATIVO") { nivel = "bloqueado"; motivos.push("Inoperativo" + (veh.novedad ? ": " + veh.novedad : "")); }
      else if (cruce) { nivel = "ocupado"; motivos.push("Ocupado " + cruce.hora_salida + "–" + deMin(intervalo(cruce)[1]) + " (" + cruce.destino + ")"); }
      else if (!apto) {
        nivel = "no_apto";
        if (pax > num(veh.cap_pax)) motivos.push("Solo " + veh.cap_pax + " pasajeros");
        if (carga > num(veh.cap_carga_t)) motivos.push(num(veh.cap_carga_t) ? "Carga máx. " + veh.cap_carga_t + " t" : "No lleva carga");
        if (sol.carga_tipo === "REFRIGERADA" && !refri) motivos.push("No es refrigerado");
      }
      else if (regla.pref.indexOf(veh.id) >= 0) nivel = "recomendado";
      else if (regla.alt.indexOf(veh.id) >= 0) nivel = "alternativa";
      else nivel = "posible";
      return { v: veh, nivel: nivel, motivos: motivos, ocupada: cruce };
    });
    const orden = { recomendado: 0, alternativa: 1, posible: 2, no_apto: 3, ocupado: 4, bloqueado: 5 };
    lista.sort(function (a, b) {
      return orden[a.nivel] - orden[b.nivel] ||
        indice(regla, a.v.id) - indice(regla, b.v.id) ||
        num(b.v.km_gl) - num(a.v.km_gl);
    });
    let sugerido = "", nota = regla.nota;
    const primeraPref = regla.pref[0];
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].nivel === "recomendado" || lista[i].nivel === "alternativa") { sugerido = lista[i].v.id; break; }
    }
    if (sugerido && regla.pref.indexOf(sugerido) < 0 && primeraPref) {
      const pv = lista.filter(function (x) { return x.v.id === primeraPref; })[0];
      if (pv) nota += " " + pv.v.nombre + " no disponible (" + pv.motivos.join("; ") + "), se sugiere " + nombreVeh(vehiculos, sugerido) + ".";
    }
    if (!sugerido) nota += " Ninguna unidad recomendada está libre: revise horarios o elija otra con motivo.";
    return { sugerido: sugerido, nota: nota.trim(), lista: lista, varias: regla.varias };
  }
  function indice(regla, id) { const a = regla.pref.indexOf(id); if (a >= 0) return a; const b = regla.alt.indexOf(id); return b >= 0 ? 10 + b : 99; }
  function nombreVeh(vehiculos, id) { const x = vehiculos.filter(function (v) { return v.id === id; })[0]; return x ? x.nombre : id; }

  // ¿Elegir esta unidad necesita motivo? Devuelve el texto del porqué, o "".
  function requiereMotivo(vehId, rec) {
    const it = rec.lista.filter(function (x) { return x.v.id === vehId; })[0];
    if (!it) return "Unidad desconocida";
    if (it.nivel === "bloqueado") return "BLOQUEADO";
    if (it.nivel === "ocupado") return "La unidad está ocupada en ese horario";
    if (it.nivel === "no_apto") return "La unidad no tiene la capacidad pedida";
    if (rec.sugerido && vehId !== rec.sugerido && it.nivel !== "recomendado") return "Es distinta a la recomendada";
    return "";
  }

  // ---------- Consolidación y retornos ----------
  function mismoSector(a, b) {
    if (norm(a.destino) && norm(a.destino) === norm(b.destino)) return "destino";
    if (a.eje && a.eje !== "URBANO" && a.eje === b.eje) return "eje";
    return "";
  }
  function cuposDe(c, vehiculos) {
    const veh = vehiculos.filter(function (x) { return x.id === c.vehiculo_id; })[0];
    if (!veh) return { cupos: 0, espacio: 0, veh: null };
    return { cupos: Math.max(0, num(veh.cap_pax) - num(c.pasajeros)), espacio: Math.max(0, r1(num(veh.cap_carga_t) - num(c.carga_t))), veh: veh };
  }
  // Busca comisiones con las que se puede agrupar la solicitud `sol`.
  function consolidaciones(sol, comisiones, vehiculos) {
    const res = [];
    const t = aMin(sol.hora_salida);
    if (t == null || !sol.fecha) return res;
    comisiones.forEach(function (c) {
      if (c.id === sol.id || c.fecha !== sol.fecha || !activa(c)) return;
      const sector = mismoSector(c, sol);
      if (!sector) return;
      const k = cuposDe(c, vehiculos);
      const lugar = sector === "destino" ? c.destino : c.destino + " (mismo eje " + (EJE[c.eje] || c.eje) + ")";
      // IDA: salen casi a la misma hora hacia el mismo sector
      if (c.estado === "PROGRAMADA" && Math.abs(aMin(c.hora_salida) - t) <= 60 && sol.servicio !== "RECOGER" && (k.cupos > 0 || k.espacio > 0)) {
        const alcanza = k.cupos >= num(sol.pasajeros) && k.espacio >= num(sol.carga_t);
        res.push({
          tipo: "IDA", comision: c, cupos: k.cupos, espacio: k.espacio, alcanza: alcanza,
          texto: "Posible consolidación: existe comisión a " + lugar + " a las " + c.hora_salida + " (" + (k.veh ? k.veh.nombre : "") + ") con " +
            k.cupos + (k.cupos === 1 ? " cupo" : " cupos") + (k.espacio ? " / " + k.espacio + " t de espacio" : "") + " disponible. ¿Desea agrupar o coordinar retorno?" +
            (alcanza ? "" : " Ojo: no alcanza para toda la solicitud."),
        });
      }
      // RETORNO: esa unidad vuelve vacía (o sin confirmar) mientras esta solicitud necesita traer algo desde allá
      const fueraDeBase = c.zona !== "URBANO" || sector === "destino";
      if (fueraDeBase && (c.retorno === "VACIO" || c.retorno === "POR_CONFIRMAR") && (sol.servicio === "RECOGER" || sol.servicio === "LLEVAR_TRAER")) {
        const iv = intervalo(c);
        if (t >= iv[0] - 60 && t <= iv[1] + 60) {
          res.push({
            tipo: "RETORNO", comision: c, cupos: k.cupos + num(c.pasajeros), espacio: r1(k.espacio + num(c.carga_t)), alcanza: true,
            texto: "Coordinar retorno: la comisión a " + lugar + " (" + (k.veh ? k.veh.nombre : "") + ", sale " + c.hora_salida + ") vuelve " +
              (c.retorno === "VACIO" ? "EN VACÍO" : "sin confirmar carga") + " hacia las " + deMin(iv[1]) + ". Puede traer esta solicitud de regreso.",
          });
        }
      }
    });
    return res;
  }
  // Al revés: una comisión que vuelve vacía, ¿hay solicitudes de "Recoger" en su sector?
  function recogidasParaRetorno(c, comisiones) {
    if (!(c.retorno === "VACIO" || c.retorno === "POR_CONFIRMAR")) return [];
    const iv = intervalo(c);
    return comisiones.filter(function (o) {
      if (o.id === c.id || o.fecha !== c.fecha || o.estado !== "PROGRAMADA") return false;
      if (!(o.servicio === "RECOGER" || o.servicio === "LLEVAR_TRAER")) return false;
      if (!mismoSector(o, c)) return false;
      const t = aMin(o.hora_salida);
      return t >= iv[0] - 60 && t <= iv[1] + 60;
    });
  }

  // ---------- Combustible ----------
  function calcularKm(c, veh) {
    const s = c.km_salida === "" || c.km_salida == null ? null : num(c.km_salida);
    const l = c.km_llegada === "" || c.km_llegada == null ? null : num(c.km_llegada);
    if (s == null || l == null) return { km_recorridos: "", galones_est: "" };
    const km = Math.max(0, l - s);
    return { km_recorridos: r1(km), galones_est: veh && num(veh.km_gl) ? r2(km / num(veh.km_gl)) : "" };
  }

  // Resumen para tableros y reportes, entre dos fechas (incluidas).
  function resumen(desde, hasta, comisiones, vehiculos, combustible) {
    const vmap = {}; vehiculos.forEach(function (x) { vmap[x.id] = x; });
    const r = {
      total: 0, retornadas: 0, activas: 0, canceladas: 0, agrupados: 0, retornos_coord: 0, evitados: 0, retornos_vacios: 0, pax: 0,
      porComb: { PETROLEO: { km: 0, gal_est: 0, gal_real: 0, viajes: 0 }, GASOHOL: { km: 0, gal_est: 0, gal_real: 0, viajes: 0 } },
      porVeh: {},
    };
    vehiculos.forEach(function (x) { r.porVeh[x.id] = { km: 0, gal_est: 0, gal_real: 0, viajes: 0 }; });
    comisiones.forEach(function (c) {
      if (c.fecha < desde || c.fecha > hasta) return;
      if (c.estado === "CANCELADA") { r.canceladas++; return; }
      r.total++;
      r.pax += num(c.pasajeros);
      r.agrupados += num(c.agrupados); r.retornos_coord += num(c.retornos_coord);
      if (activa(c)) r.activas++;
      if (c.estado === "RETORNADA") {
        r.retornadas++;
        if (c.retorno === "VACIO") r.retornos_vacios++;
        const veh = vmap[c.vehiculo_id];
        const k = calcularKm(c, veh);
        if (veh && k.km_recorridos !== "") {
          const pc = r.porComb[veh.combustible]; if (pc) { pc.km += k.km_recorridos; pc.gal_est += num(k.galones_est); pc.viajes++; }
          const pv = r.porVeh[veh.id]; if (pv) { pv.km += k.km_recorridos; pv.gal_est += num(k.galones_est); pv.viajes++; }
        }
      }
    });
    combustible.forEach(function (a) {
      if (a.fecha < desde || a.fecha > hasta) return;
      const veh = vmap[a.vehiculo_id];
      const tipo = a.combustible || (veh && veh.combustible);
      if (r.porComb[tipo]) r.porComb[tipo].gal_real += num(a.galones);
      if (r.porVeh[a.vehiculo_id]) r.porVeh[a.vehiculo_id].gal_real += num(a.galones);
    });
    ["PETROLEO", "GASOHOL"].forEach(function (t) { const x = r.porComb[t]; x.km = r1(x.km); x.gal_est = r2(x.gal_est); x.gal_real = r2(x.gal_real); });
    Object.keys(r.porVeh).forEach(function (k) { const x = r.porVeh[k]; x.km = r1(x.km); x.gal_est = r2(x.gal_est); x.gal_real = r2(x.gal_real); });
    r.evitados = r.agrupados + r.retornos_coord;
    return r;
  }

  // ---------- Textos de avisos ----------
  function etiquetaCarga(c) {
    const pax = num(c.pasajeros), carga = num(c.carga_t);
    const partes = [];
    if (pax) partes.push(pax + (pax === 1 ? " pasajero" : " pasajeros"));
    if (carga || (c.carga_tipo && c.carga_tipo !== "NINGUNA")) partes.push((carga ? carga + " t " : "") + (CARGA[c.carga_tipo] || "carga").toLowerCase());
    return partes.join(" + ") || "sin pasajeros";
  }
  function lineaComision(c, vmap, pmap) {
    const veh = vmap[c.vehiculo_id], ch = pmap[c.chofer_id];
    return c.hora_salida + " · " + (veh ? veh.nombre + " (" + COMBUSTIBLE_NOMBRE[veh.combustible] + ")" : "sin unidad") +
      " · " + (ch ? ch.nombre : "sin chofer") + " · " + c.destino + " · " + etiquetaCarga(c) + " · Retorno: " + (RETORNO[c.retorno] || "-");
  }
  function textoParte(fecha, comisiones, vehiculos, personal) {
    const vmap = mapa(vehiculos), pmap = mapa(personal);
    const del = comisiones.filter(function (c) { return c.fecha === fecha && c.estado !== "CANCELADA"; })
      .sort(function (a, b) { return a.hora_salida < b.hora_salida ? -1 : a.hora_salida > b.hora_salida ? 1 : 0; });
    const out = ["ROL DE COMISIONES – " + fechaLarga(fecha).toUpperCase(), "Dpto. de Transportes GRUP7", ""];
    if (!del.length) out.push("Sin comisiones programadas.");
    del.forEach(function (c, i) {
      out.push((i + 1) + ") " + lineaComision(c, vmap, pmap));
      if (num(c.agrupados) || num(c.retornos_coord)) out.push("   ↳ Consolidada: " + (c.detalle_agrupados || ""));
    });
    const inop = vehiculos.filter(function (x) { return x.estado === "INOPERATIVO"; });
    if (inop.length) { out.push(""); out.push("Inoperativos: " + inop.map(function (x) { return x.nombre + (x.novedad ? " (" + x.novedad + ")" : ""); }).join("; ")); }
    return out.join("\n");
  }
  function mapa(arr) { const m = {}; arr.forEach(function (x) { m[x.id] = x; }); return m; }

  // ---------- Avisos (se guardan en Eventos y salen por Telegram/webhook) ----------
  function avisar(ctx, para, tipo, texto, comisionId) {
    const lista = (Array.isArray(para) ? para : [para]).filter(Boolean);
    const vistos = {};
    lista.forEach(function (dest) {
      if (vistos[dest]) return; vistos[dest] = 1;
      ctx.db.insert("Eventos", { id: ctx.uid(), ts: ctx.now.toISOString(), tipo: tipo, para: dest, texto: texto, comision_id: comisionId || "" });
    });
    if (ctx.externo) {
      try { ctx.externo(destinatarios(lista, ctx.db.all("Personal")), texto, tipo); } catch (e) { /* un fallo de Telegram no debe romper el guardado */ }
    }
  }
  // Convierte ["ROSAS","rol:operaciones","todos"] en personas.
  function destinatarios(lista, personal) {
    const out = {};
    lista.forEach(function (d) {
      personal.forEach(function (p) {
        if (!esActivo(p)) return;
        if (d === "todos" || d === p.id || d === "rol:" + p.rol) out[p.id] = p;
      });
    });
    return Object.keys(out).map(function (k) { return out[k]; });
  }
  function esActivo(p) { return !(p.activo === false || String(p.activo).toUpperCase() === "FALSE"); }
  function eventosPara(persona, eventos) {
    return eventos.filter(function (e) { return e.para === persona.id || e.para === "todos" || e.para === "rol:" + persona.rol; });
  }

  // ---------- Validación ----------
  const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/, RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
  function validarComision(x) {
    x = x || {};
    const c = {
      id: txt(x.id, 60),
      fecha: txt(x.fecha, 10), hora_salida: txt(x.hora_salida, 5), hora_retorno: txt(x.hora_retorno, 5),
      destino: txt(x.destino, 80), zona: x.zona, eje: x.eje, servicio: x.servicio || "LLEVAR",
      pasajeros: Math.round(num(x.pasajeros)), carga_tipo: x.carga_tipo || "NINGUNA", carga_t: r1(num(x.carga_t)),
      solicitante: txt(x.solicitante, 80), motivo: txt(x.motivo, 200),
      vehiculo_id: txt(x.vehiculo_id, 30), chofer_id: txt(x.chofer_id, 30),
      retorno: x.retorno || "POR_CONFIRMAR", override_motivo: txt(x.override_motivo, 200),
    };
    if (!RE_FECHA.test(c.fecha)) throw falla("Fecha no válida");
    if (!RE_HORA.test(c.hora_salida)) throw falla("Hora de salida no válida");
    if (c.hora_retorno && !RE_HORA.test(c.hora_retorno)) throw falla("Hora de retorno no válida");
    if (!c.destino) throw falla("Falta el destino");
    if (!ZONA[c.zona]) throw falla("Elige la zona (urbano, afueras o trocha)");
    if (!EJE[c.eje]) c.eje = c.zona === "URBANO" ? "URBANO" : "";
    if (!c.eje) throw falla("Elige el eje vial del destino");
    if (!SERVICIO[c.servicio]) throw falla("Tipo de servicio no válido");
    if (!CARGA[c.carga_tipo]) throw falla("Tipo de carga no válido");
    if (!RETORNO[c.retorno]) throw falla("Indica cómo será el retorno");
    if (c.pasajeros < 0 || c.pasajeros > 150) throw falla("Número de pasajeros no válido");
    if (c.carga_t < 0 || c.carga_t > 20) throw falla("Toneladas no válidas");
    if (c.carga_tipo === "NINGUNA") c.carga_t = 0;
    if (!c.pasajeros && !c.carga_t && c.carga_tipo === "NINGUNA") throw falla("Indica pasajeros o carga");
    if (!c.vehiculo_id) throw falla("Elige la unidad");
    if (!c.chofer_id) throw falla("Elige el chofer");
    return c;
  }
  function permiso(ctx, roles) { if (roles.indexOf(ctx.yo.rol) < 0) throw falla("Tu rol no puede hacer esto"); }
  function buscar(ctx, tabla, id) { const x = ctx.db.get(tabla, id); if (!x) throw falla("No encontrado: " + id); return x; }

  // ---------- Acciones (las mismas en modo demo y en el servidor) ----------
  const H = {};

  H.sync = function (ctx) {
    const hoy = fechaLima(ctx.now), desde = sumarDias(hoy, -62);
    let com = ctx.db.all("Comisiones").filter(function (c) { return c.fecha >= desde; });
    if (ctx.yo.rol === ROL.CHOFER) com = com.filter(function (c) { return c.chofer_id === ctx.yo.id && c.fecha >= sumarDias(hoy, -7); });
    const eventos = eventosPara(ctx.yo, ctx.db.all("Eventos")).slice(-60).reverse();
    return {
      ahora: ctx.now.toISOString(), hoy: hoy,
      vehiculos: ctx.db.all("Vehiculos"),
      personal: ctx.db.all("Personal").map(publico),
      comisiones: com,
      combustible: ctx.yo.rol === ROL.CHOFER ? [] : ctx.db.all("Combustible").filter(function (a) { return a.fecha >= desde; }),
      eventos: eventos,
      yo: publico(ctx.yo),
    };
  };

  H.guardar_comision = function (ctx, body) {
    permiso(ctx, [ROL.JEFE, ROL.OPS]);
    const c = validarComision(body.comision);
    const vehiculos = ctx.db.all("Vehiculos"), comisiones = ctx.db.all("Comisiones");
    const veh = buscar(ctx, "Vehiculos", c.vehiculo_id);
    const ch = buscar(ctx, "Personal", c.chofer_id);
    if (ch.rol !== ROL.CHOFER) throw falla("La persona elegida no es chofer");
    if (veh.estado === "INOPERATIVO") throw falla(veh.nombre + " está INOPERATIVO (" + (veh.novedad || "sin detalle") + "). Elige otra unidad.");
    let previa = null;
    if (c.id) {
      previa = buscar(ctx, "Comisiones", c.id);
      if (!activa(previa)) throw falla("Esta comisión ya está cerrada o cancelada");
    }
    const rec = recomendar(c, vehiculos, comisiones);
    const porque = requiereMotivo(c.vehiculo_id, rec);
    if (porque && !c.override_motivo) throw falla(porque + ": escribe el motivo para usar " + veh.nombre + ".");
    const cruceCh = cruceChofer(c.chofer_id, c, comisiones);
    if (cruceCh && !c.override_motivo) throw falla(ch.nombre + " ya tiene comisión a " + cruceCh.destino + " a las " + cruceCh.hora_salida + ": escribe el motivo o elige otro chofer.");
    const ahora = ctx.now.toISOString();
    let guardada;
    if (previa) {
      const cambios = Object.assign({}, c, { recomendado_id: rec.sugerido, actualizado: ahora });
      if (previa.estado !== "PROGRAMADA") { // ya salió: solo se puede cambiar retorno, notas y hora de retorno
        cambios.vehiculo_id = previa.vehiculo_id; cambios.chofer_id = previa.chofer_id; cambios.fecha = previa.fecha; cambios.hora_salida = previa.hora_salida;
      }
      if (previa.hora_salida !== cambios.hora_salida || previa.fecha !== cambios.fecha) cambios.aviso45 = "";
      guardada = ctx.db.update("Comisiones", c.id, cambios);
    } else {
      guardada = ctx.db.insert("Comisiones", Object.assign({}, c, {
        id: ctx.uid(), estado: "PROGRAMADA", recomendado_id: rec.sugerido, agrupados: 0, retornos_coord: 0, detalle_agrupados: "",
        salida_real: "", km_salida: "", llegada_real: "", novedad: "", retorno_real: "", km_llegada: "", km_recorridos: "", galones_est: "",
        papeleta: "", aviso45: "", aviso_retraso: "", creado_por: ctx.yo.id, creado: ahora, actualizado: ahora,
      }));
    }
    const todas = ctx.db.all("Comisiones");
    const cons = consolidaciones(guardada, todas, vehiculos);
    const rec2 = recogidasParaRetorno(guardada, todas);
    const titulo = (previa ? "Comisión MODIFICADA: " : "Nueva comisión: ") + fechaLarga(guardada.fecha);
    let texto = titulo + "\n" + lineaComision(guardada, mapa(vehiculos), mapa(ctx.db.all("Personal")));
    if (guardada.motivo) texto += "\nMotivo: " + guardada.motivo;
    if (cons.length) texto += "\n⚠ " + cons[0].texto;
    avisar(ctx, [guardada.chofer_id, "rol:" + ROL.OPS], "asignacion", texto, guardada.id);
    if (previa && previa.chofer_id !== guardada.chofer_id) {
      avisar(ctx, previa.chofer_id, "asignacion", "Se te QUITÓ la comisión a " + previa.destino + " del " + fechaLarga(previa.fecha) + " " + previa.hora_salida + ".", guardada.id);
    }
    if (rec2.length) {
      avisar(ctx, "rol:" + ROL.OPS, "retorno", "Retorno en vacío aprovechable: " + guardada.destino + " vuelve " + (guardada.retorno === "VACIO" ? "vacía" : "sin confirmar") +
        " y hay " + rec2.length + " solicitud(es) de recoger en el mismo sector (" + rec2.map(function (o) { return o.destino + " " + o.hora_salida; }).join(", ") + ").", guardada.id);
    }
    return { comision: guardada, consolidaciones: cons.map(sinComision), recogidas: rec2.length };
  };
  function sinComision(x) { return { tipo: x.tipo, texto: x.texto, comision_id: x.comision.id }; }

  // Suma una solicitud a una comisión que ya existe (en vez de mandar otra unidad).
  H.agrupar = function (ctx, body) {
    permiso(ctx, [ROL.JEFE, ROL.OPS]);
    const c = buscar(ctx, "Comisiones", body.comision_id);
    if (!activa(c)) throw falla("Esa comisión ya no está activa");
    const veh = buscar(ctx, "Vehiculos", c.vehiculo_id);
    const modo = body.modo === "RETORNO" ? "RETORNO" : "IDA";
    const pax = Math.max(0, Math.round(num(body.pasajeros))), carga = Math.max(0, r1(num(body.carga_t)));
    const quien = txt(body.solicitante, 80) || "sin solicitante", donde = txt(body.destino, 80) || c.destino;
    const cambios = { actualizado: ctx.now.toISOString() };
    let detalle;
    if (modo === "IDA") {
      if (c.estado !== "PROGRAMADA") throw falla("La unidad ya salió: use 'coordinar retorno'");
      if (num(c.pasajeros) + pax > num(veh.cap_pax)) throw falla("No hay cupos: " + veh.nombre + " lleva " + veh.cap_pax + " y ya tiene " + c.pasajeros);
      if (num(c.carga_t) + carga > num(veh.cap_carga_t) + 1e-9) throw falla("No hay espacio de carga en " + veh.nombre);
      cambios.pasajeros = num(c.pasajeros) + pax; cambios.carga_t = r1(num(c.carga_t) + carga);
      if (carga && c.carga_tipo === "NINGUNA") cambios.carga_tipo = "LIGERA";
      cambios.agrupados = num(c.agrupados) + 1;
      detalle = "Ida +" + etiquetaCarga({ pasajeros: pax, carga_t: carga, carga_tipo: carga ? "LIGERA" : "NINGUNA" }) + " (" + quien + " → " + donde + ")";
    } else {
      if (pax > num(veh.cap_pax) || carga > num(veh.cap_carga_t) + 1e-9) throw falla(veh.nombre + " no tiene capacidad para traer eso");
      cambios.retorno = "CON"; cambios.retornos_coord = num(c.retornos_coord) + 1;
      detalle = "Retorno trae " + etiquetaCarga({ pasajeros: pax, carga_t: carga, carga_tipo: carga ? "LIGERA" : "NINGUNA" }) + " (" + quien + " desde " + donde + ")";
    }
    cambios.detalle_agrupados = (c.detalle_agrupados ? c.detalle_agrupados + " | " : "") + detalle;
    const out = ctx.db.update("Comisiones", c.id, cambios);
    avisar(ctx, [c.chofer_id, "rol:" + ROL.OPS], "consolidacion", "Comisión CONSOLIDADA (" + c.hora_salida + " a " + c.destino + ", " + veh.nombre + "): " + detalle, c.id);
    return { comision: out };
  };

  H.cancelar_comision = function (ctx, body) {
    permiso(ctx, [ROL.JEFE, ROL.OPS]);
    const c = buscar(ctx, "Comisiones", body.id);
    if (c.estado !== "PROGRAMADA") throw falla("Solo se cancela una comisión que aún no sale");
    const out = ctx.db.update("Comisiones", c.id, { estado: "CANCELADA", novedad: txt(body.motivo, 200), actualizado: ctx.now.toISOString() });
    avisar(ctx, [c.chofer_id, "rol:" + ROL.OPS], "asignacion", "Comisión CANCELADA: " + c.destino + " " + fechaLarga(c.fecha) + " " + c.hora_salida + (body.motivo ? " (" + txt(body.motivo, 200) + ")" : ""), c.id);
    return { comision: out };
  };

  H.chofer_paso = function (ctx, body) {
    const c = buscar(ctx, "Comisiones", body.id);
    if (ctx.yo.rol === ROL.CHOFER ? c.chofer_id !== ctx.yo.id : [ROL.JEFE, ROL.OPS].indexOf(ctx.yo.rol) < 0) throw falla("Esta comisión no es tuya");
    const veh = buscar(ctx, "Vehiculos", c.vehiculo_id);
    const ch = ctx.db.get("Personal", c.chofer_id) || { nombre: "?" };
    const hora = horaLima(ctx.now), ts = ctx.now.toISOString();
    const paso = body.paso;
    let cambios, aviso;
    if (paso === "salir") {
      if (c.estado !== "PROGRAMADA") throw falla("Ya marcaste la salida");
      if (veh.estado === "INOPERATIVO") throw falla(veh.nombre + " figura INOPERATIVO. Avisa a Operaciones.");
      const km = num(body.km);
      if (!(km > 0)) throw falla("Escribe el kilometraje de salida");
      if (veh.km_actual !== "" && veh.km_actual != null && km < num(veh.km_actual)) throw falla("El km de salida (" + km + ") es menor que el último registrado (" + veh.km_actual + "). Revisa el odómetro.");
      cambios = { estado: "EN_CURSO", salida_real: hora, km_salida: km };
      ctx.db.update("Vehiculos", veh.id, { estado: "EN_COMISION", km_actual: km, actualizado: ts, actualizado_por: ctx.yo.id });
      aviso = ch.nombre + " SALIÓ " + hora + " · " + veh.nombre + " → " + c.destino + " · km " + km;
    } else if (paso === "llegar") {
      if (c.estado !== "EN_CURSO" && c.estado !== "EN_DESTINO") throw falla("Primero marca 'Salí a comisión'");
      const ret = RETORNO[body.retorno] ? body.retorno : c.retorno;
      const nov = txt(body.novedad, 300);
      cambios = { estado: "EN_DESTINO", llegada_real: c.llegada_real || hora, retorno: ret, novedad: nov ? (c.novedad ? c.novedad + " | " : "") + hora + " " + nov : c.novedad };
      aviso = ch.nombre + " LLEGÓ a " + c.destino + " " + hora + " · Retorno: " + RETORNO[ret] + (nov ? "\nNovedad: " + nov : "");
      if (ret === "VACIO") {
        const r = recogidasParaRetorno(Object.assign({}, c, cambios), ctx.db.all("Comisiones"));
        aviso += r.length ? "\n⚠ Hay " + r.length + " solicitud(es) de recoger en ese sector: coordinar retorno." : "\n⚠ Retornará EN VACÍO: ¿hay algo que traer de " + c.destino + "?";
      }
    } else if (paso === "retornar") {
      if (c.estado !== "EN_CURSO" && c.estado !== "EN_DESTINO") throw falla("Primero marca 'Salí a comisión'");
      const km = num(body.km);
      const ks = num(c.km_salida);
      if (!(km > 0)) throw falla("Escribe el kilometraje de llegada");
      if (km < ks) throw falla("El km de llegada (" + km + ") no puede ser menor que el de salida (" + ks + ")");
      if (km - ks > 3000) throw falla("Más de 3000 km recorridos: revisa el número");
      const calc = calcularKm({ km_salida: ks, km_llegada: km }, veh);
      cambios = { estado: "RETORNADA", retorno_real: hora, km_llegada: km, km_recorridos: calc.km_recorridos, galones_est: calc.galones_est };
      const otra = ctx.db.all("Comisiones").filter(function (o) { return o.id !== c.id && o.vehiculo_id === veh.id && (o.estado === "EN_CURSO" || o.estado === "EN_DESTINO"); }).length;
      ctx.db.update("Vehiculos", veh.id, { estado: veh.estado === "INOPERATIVO" ? "INOPERATIVO" : otra ? "EN_COMISION" : "OPERATIVO", km_actual: km, actualizado: ts, actualizado_por: ctx.yo.id });
      aviso = ch.nombre + " RETORNÓ a base " + hora + " · " + veh.nombre + " · " + calc.km_recorridos + " km · " + calc.galones_est + " gl " + COMBUSTIBLE_NOMBRE[veh.combustible] + " (estimado)";
    } else throw falla("Paso desconocido");
    cambios.actualizado = ts;
    const out = ctx.db.update("Comisiones", c.id, cambios);
    avisar(ctx, "rol:" + ROL.OPS, "estado", aviso, c.id);
    return { comision: out, vehiculo: ctx.db.get("Vehiculos", veh.id) };
  };

  H.set_estado_vehiculo = function (ctx, body) {
    permiso(ctx, [ROL.JEFE, ROL.MANT]);
    const veh = buscar(ctx, "Vehiculos", body.id);
    const estado = body.estado;
    if (!ESTADO_VEH[estado]) throw falla("Estado no válido");
    const nov = txt(body.novedad, 200);
    if (estado === "INOPERATIVO" && !nov) throw falla("Escribe la falla o novedad para marcarlo inoperativo");
    const out = ctx.db.update("Vehiculos", veh.id, { estado: estado, novedad: estado === "OPERATIVO" && !nov ? "" : nov, actualizado: ctx.now.toISOString(), actualizado_por: ctx.yo.id });
    if (estado !== veh.estado || nov !== veh.novedad) {
      const hoy = fechaLima(ctx.now);
      const pend = ctx.db.all("Comisiones").filter(function (c) { return c.vehiculo_id === veh.id && c.estado === "PROGRAMADA" && c.fecha >= hoy; });
      let t = "Mantenimiento: " + veh.nombre + " → " + ESTADO_VEH[estado] + (nov ? " (" + nov + ")" : "");
      if (estado === "INOPERATIVO" && pend.length) t += "\n⚠ Tiene " + pend.length + " comisión(es) programada(s): REASIGNAR (" + pend.map(function (c) { return c.fecha.slice(8) + "/" + c.fecha.slice(5, 7) + " " + c.hora_salida + " " + c.destino; }).join(", ") + ")";
      avisar(ctx, ["rol:" + ROL.OPS, "rol:" + ROL.JEFE], "flota", t, "");
    }
    return { vehiculo: out };
  };

  H.doc_comision = function (ctx, body) {
    permiso(ctx, [ROL.JEFE, ROL.OPS, ROL.DOC]);
    const c = buscar(ctx, "Comisiones", body.id);
    const veh = ctx.db.get("Vehiculos", c.vehiculo_id);
    const cambios = { actualizado: ctx.now.toISOString() };
    if (body.papeleta !== undefined) cambios.papeleta = txt(body.papeleta, 40);
    if (body.km_salida !== undefined) cambios.km_salida = body.km_salida === "" ? "" : num(body.km_salida);
    if (body.km_llegada !== undefined) cambios.km_llegada = body.km_llegada === "" ? "" : num(body.km_llegada);
    const ks = cambios.km_salida !== undefined ? cambios.km_salida : c.km_salida;
    const kl = cambios.km_llegada !== undefined ? cambios.km_llegada : c.km_llegada;
    if (ks !== "" && kl !== "" && num(kl) < num(ks)) throw falla("El km de llegada no puede ser menor que el de salida");
    const calc = calcularKm({ km_salida: ks, km_llegada: kl }, veh);
    cambios.km_recorridos = calc.km_recorridos; cambios.galones_est = calc.galones_est;
    return { comision: ctx.db.update("Comisiones", c.id, cambios) };
  };

  H.registrar_combustible = function (ctx, body) {
    permiso(ctx, [ROL.JEFE, ROL.DOC]);
    const veh = buscar(ctx, "Vehiculos", body.vehiculo_id);
    const gal = r2(num(body.galones));
    if (!(gal > 0 && gal <= 300)) throw falla("Galones no válidos");
    const fecha = RE_FECHA.test(body.fecha || "") ? body.fecha : fechaLima(ctx.now);
    const a = ctx.db.insert("Combustible", {
      id: ctx.uid(), fecha: fecha, vehiculo_id: veh.id, combustible: veh.combustible, galones: gal,
      km_odometro: body.km_odometro === "" || body.km_odometro == null ? "" : num(body.km_odometro), vale: txt(body.vale, 40),
      comision_id: txt(body.comision_id, 60), registrado_por: ctx.yo.id, creado: ctx.now.toISOString(),
    });
    return { abastecimiento: a };
  };
  H.borrar_combustible = function (ctx, body) {
    permiso(ctx, [ROL.JEFE, ROL.DOC]);
    buscar(ctx, "Combustible", body.id);
    ctx.db.remove("Combustible", body.id);
    return { ok: true };
  };

  H.reset_pin = function (ctx, body) {
    permiso(ctx, [ROL.JEFE]);
    const p = buscar(ctx, "Personal", body.persona_id);
    ctx.db.update("Personal", p.id, { pin_hash: "", pin_sal: "" });
    return { ok: true };
  };

  H.vincular_telegram = function (ctx) {
    const codigo = String(100000 + Math.floor(Math.random() * 900000));
    ctx.db.update("Personal", ctx.yo.id, { tg_codigo: codigo, tg_codigo_exp: new Date(ctx.now.getTime() + 30 * 60000).toISOString() });
    return { codigo: codigo };
  };

  H.enviar_parte = function (ctx) {
    permiso(ctx, [ROL.JEFE, ROL.OPS]);
    return Jobs.parte(ctx, true);
  };

  H.leer_avisos = function (ctx) { return { eventos: eventosPara(ctx.yo, ctx.db.all("Eventos")).slice(-60).reverse() }; };

  // ---------- Tareas automáticas (activador cada 5 min en el servidor; temporizador en modo demo) ----------
  const Jobs = {};
  Jobs.recordatorios = function (ctx) {
    const hoy = fechaLima(ctx.now), ahoraMin = aMin(horaLima(ctx.now));
    const vmap = mapa(ctx.db.all("Vehiculos"));
    let enviados = 0;
    ctx.db.all("Comisiones").forEach(function (c) {
      if (c.fecha !== hoy || c.estado !== "PROGRAMADA") return;
      const falta = aMin(c.hora_salida) - ahoraMin;
      const veh = vmap[c.vehiculo_id];
      if (!c.aviso45 && falta > 0 && falta <= 45) {
        avisar(ctx, c.chofer_id, "recordatorio", "⏰ Recordatorio: en " + falta + " min sales (" + c.hora_salida + ") en " + (veh ? veh.nombre : "") + " a " + c.destino + " · " + etiquetaCarga(c) + ".", c.id);
        ctx.db.update("Comisiones", c.id, { aviso45: ctx.now.toISOString() });
        enviados++;
      }
      if (!c.aviso_retraso && falta <= -15) {
        const ch = ctx.db.get("Personal", c.chofer_id);
        avisar(ctx, ["rol:" + ROL.OPS, c.chofer_id], "retraso", "Despacho retrasado: la comisión de las " + c.hora_salida + " a " + c.destino + " (" + (veh ? veh.nombre : "") + ", " + (ch ? ch.nombre : "") + ") aún no marca 'Salí'.", c.id);
        ctx.db.update("Comisiones", c.id, { aviso_retraso: ctx.now.toISOString() });
      }
    });
    return { enviados: enviados };
  };
  Jobs.parte = function (ctx, forzar) {
    const hoy = fechaLima(ctx.now), hora = horaLima(ctx.now);
    const cfg = ctx.db.get("Config", "parte_enviado");
    if (!forzar && (hora < "20:00" || (cfg && cfg.valor === hoy))) return { enviado: false };
    const manana = sumarDias(hoy, 1);
    const texto = textoParte(manana, ctx.db.all("Comisiones"), ctx.db.all("Vehiculos"), ctx.db.all("Personal"));
    avisar(ctx, "todos", "parte", texto, "");
    if (cfg) ctx.db.update("Config", "parte_enviado", { valor: hoy }); else ctx.db.insert("Config", { id: "parte_enviado", valor: hoy });
    return { enviado: true, texto: texto };
  };
  Jobs.todo = function (ctx) { return { recordatorios: Jobs.recordatorios(ctx), parte: Jobs.parte(ctx, false) }; };

  function publico(p) {
    return { id: p.id, nombre: p.nombre, grado: p.grado, rol: p.rol, tiene_pin: !!p.pin_hash, telegram: !!p.telegram_chat_id, activo: esActivo(p) };
  }

  // Ejecuta una acción. ctx = { db, now, yo, uid, externo }
  function ejecutar(ctx, action, body) {
    const h = H[action];
    if (!h) throw falla("Acción desconocida: " + action);
    return h(ctx, body || {});
  }

  const api = {
    VERSION: VERSION, ROL: ROL, ROL_NOMBRE: ROL_NOMBRE, TABLAS: TABLAS, DESTINOS: DESTINOS,
    COMBUSTIBLE_NOMBRE: COMBUSTIBLE_NOMBRE, ESTADO_VEH: ESTADO_VEH, ESTADO_COM: ESTADO_COM, RETORNO: RETORNO, SERVICIO: SERVICIO, CARGA: CARGA, ZONA: ZONA, EJE: EJE,
    SEMILLA_VEHICULOS: SEMILLA_VEHICULOS, SEMILLA_PERSONAL: SEMILLA_PERSONAL,
    fechaLima: fechaLima, horaLima: horaLima, sumarDias: sumarDias, aMin: aMin, deMin: deMin, fechaHora: fechaHora, fechaLarga: fechaLarga,
    intervalo: intervalo, cruceVehiculo: cruceVehiculo, cruceChofer: cruceChofer, activa: activa,
    recomendar: recomendar, requiereMotivo: requiereMotivo, consolidaciones: consolidaciones, recogidasParaRetorno: recogidasParaRetorno,
    calcularKm: calcularKm, resumen: resumen, textoParte: textoParte, lineaComision: lineaComision, etiquetaCarga: etiquetaCarga, mapa: mapa,
    validarComision: validarComision, eventosPara: eventosPara, destinatarios: destinatarios, publico: publico,
    H: H, Jobs: Jobs, ejecutar: ejecutar, falla: falla, num: num, norm: norm,
  };
  return api;
})();
if (typeof module !== "undefined" && module.exports) module.exports = GRUP7;
