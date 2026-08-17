"use client";
import { createContext, useContext, useEffect, useState } from "react";

export const uid = () => Math.random().toString(36).slice(2, 10);
export const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-CL");
export const hoyISO = () => new Date().toISOString().slice(0, 10);
export const diasDesde = (iso) =>
  Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const daysAhead = (n) => daysAgo(-n);

export const INTERVALO_SUGERIDO = 21; // días entre cortes

/**
 * Convierte el nombre de la barbería en dirección para el link público.
 * "Barbería Ñuñoa & Co." → "barberia-nunoa-co"
 */
export function aSlug(texto) {
  return (texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita tildes
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "barberia";
}

const seed = {
  barberia: {
    id: "b1", nombre: "Barber Royce", slug: "barber-royce", logo: null,
    /* Direcciones que tuvo antes: los links y QR ya repartidos siguen funcionando */
    slugsAnteriores: [],
  },
  sucursales: [
    { id: "s1", nombre: "Sucursal principal", direccion: "Av. Providencia 1234", telefono: "+56 2 2334 4556", activa: true },
    { id: "s2", nombre: "Sucursal Ñuñoa", direccion: "Irarrázaval 890", telefono: "+56 2 2555 7788", activa: true },
  ],
  equipo: [
    { id: "e1", nombre: "Carlos Muñoz", correo: "carlos@mail.com", telefono: "+56 9 3254 7698", rol: "barbero", comision: 40, activo: true },
    { id: "e2", nombre: "Diego Rojas", correo: "diego@mail.com", telefono: "+56 9 1111 3333", rol: "barbero", comision: 50, activo: false },
    { id: "e3", nombre: "Martín Silva", correo: "martin@mail.com", telefono: "+56 9 7474 5353", rol: "barbero", comision: 40, activo: true },
  ],
  servicios: [
    { id: "sv1", nombre: "Arreglo de barba", descripcion: "", duracion: 20, precio: 5000, activo: true },
    { id: "sv2", nombre: "Corte + Barba", descripcion: "", duracion: 60, precio: 15000, activo: true },
    { id: "sv3", nombre: "Corte clásico", descripcion: "", duracion: 30, precio: 8000, activo: true },
    { id: "sv4", nombre: "Degradado", descripcion: "", duracion: 45, precio: 12000, activo: true },
  ],
  clientes: [
    {
      id: "c1", nombre: "Ignacio Pérez", telefono: "+56 9 8765 4321", correo: "ignacio@mail.com",
      vip: true, cortes: 1, ultimaVisita: daysAgo(32),
      observaciones: "Prefiere degradado alto. Piel sensible.",
      tipoPelo: "Ondulado", densidad: "Medio", formaRostro: "Ovalado", notasVoz: [], visagismo: null,
    },
    {
      id: "c2", nombre: "Francisca Soto", telefono: "+56 9 7654 3210", correo: "francisca@mail.com",
      vip: false, cortes: 0, ultimaVisita: daysAgo(8),
      observaciones: "", tipoPelo: "", densidad: "", formaRostro: "", notasVoz: [], visagismo: null,
    },
    {
      id: "c3", nombre: "Matías Cifuentes", telefono: "+56 9 6543 2109", correo: "matias@mail.com",
      vip: false, cortes: 1, ultimaVisita: daysAgo(6),
      observaciones: "", tipoPelo: "Liso", densidad: "Grueso", formaRostro: "Cuadrado", notasVoz: [], visagismo: null,
    },
  ],
  reservas: [
    { id: "r1", sucursalId: "s1", clienteNombre: "Ignacio Pérez", clienteId: "c1", servicioId: "sv4", barberoId: "e1", fecha: daysAgo(32), hora: "09:00", estado: "finalizado", notas: "", foto: null },
    { id: "r2", sucursalId: "s1", clienteNombre: "Ignacio Pérez", clienteId: "c1", servicioId: "sv4", barberoId: "e1", fecha: daysAhead(4), hora: "14:00", estado: "reservado", notas: "", foto: null },
    { id: "r3", sucursalId: "s1", clienteNombre: "Matías Cifuentes", clienteId: "c3", servicioId: "sv2", barberoId: "e3", fecha: daysAgo(6), hora: "16:00", estado: "finalizado", notas: "", foto: null },
  ],
  ingresos: [
    { id: "i1", fecha: daysAgo(6), concepto: "Venta general", metodo: "efectivo", monto: 15000, barberoId: "e3" },
    { id: "i2", fecha: daysAgo(7), concepto: "Venta general", metodo: "tarjeta", monto: 12000, barberoId: "e1" },
  ],
  gastos: [],
  pagosComision: [],
  campanas: [],
};

const KEY = "barberos-db-v2";
const CTX = "barberos-ctx-v2";
const Ctx = createContext(null);

export function DataProvider({ children }) {
  const [db, setDb] = useState(seed);
  const [ready, setReady] = useState(false);
  const [sucursalId, setSucursalId] = useState("s1");
  const [rol, setRol] = useState("admin"); // admin | recepcion | barbero
  /* Quién está usando la app. Provisional hasta que exista login real:
     con Supabase esto vendrá de la sesión, no de un selector. */
  const [usuarioId, setUsuarioId] = useState("e1");
  const [sinEspacio, setSinEspacio] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setDb({ ...seed, ...JSON.parse(raw) });
      const c = localStorage.getItem(CTX);
      if (c) {
        const o = JSON.parse(c);
        if (o.sucursalId) setSucursalId(o.sucursalId);
        if (o.rol) setRol(o.rol);
        if (o.usuarioId) setUsuarioId(o.usuarioId);
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      setSinEspacio(false);
    } catch {
      /* Se llenó el almacenamiento del navegador (normalmente por las fotos) */
      setSinEspacio(true);
    }
  }, [db, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(CTX, JSON.stringify({ sucursalId, rol, usuarioId }));
  }, [sucursalId, rol, usuarioId, ready]);

  const update = (fn) => setDb((prev) => fn(JSON.parse(JSON.stringify(prev))));

  const barberosActivos = db.equipo.filter((e) => e.rol === "barbero" && e.activo);
  const yo = db.equipo.find((e) => e.id === usuarioId) || barberosActivos[0] || db.equipo[0];

  const value = {
    db, update, ready, rol, setRol, sucursalId, setSucursalId, sinEspacio,
    usuarioId, setUsuarioId, yo,
    barberia: db.barberia,
    sucursales: db.sucursales,
    sucursal: db.sucursales.find((s) => s.id === sucursalId) || db.sucursales[0],
    equipo: db.equipo,
    barberos: barberosActivos,
    servicios: db.servicios,
    clientes: db.clientes,
    reservas: db.reservas,
    ingresos: db.ingresos,
    gastos: db.gastos,
    pagosComision: db.pagosComision,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

/* Segmentación CRM */
export function segmentoDe(cliente) {
  if (cliente.vip) return "vip";
  const d = diasDesde(cliente.ultimaVisita);
  if (d > 60) return "perdido";
  if (d >= INTERVALO_SUGERIDO) return "volver";
  if ((cliente.cortes || 0) >= 4) return "frecuente";
  return "activo";
}

/* Días hasta la próxima visita sugerida (negativo = atrasado) */
export function proximaVisita(cliente) {
  return INTERVALO_SUGERIDO - diasDesde(cliente.ultimaVisita);
}

/**
 * Métricas de un barbero para un mes (formato "2026-08").
 * Es lo que ve en su propia pantalla de inicio para autoevaluarse.
 */
export function metricasBarbero(db, barberoId, mes) {
  const delMes = (f) => f && f.startsWith(mes);
  const barbero = db.equipo.find((e) => e.id === barberoId);
  const tasa = barbero ? barbero.comision || 0 : 0;

  const reservasMes = db.reservas.filter((r) => r.barberoId === barberoId && delMes(r.fecha));
  const cortes = reservasMes.filter((r) => r.estado === "finalizado").length;
  const agendados = reservasMes.filter((r) => r.estado === "reservado" || r.estado === "confirmado").length;
  const cancelados = reservasMes.filter((r) => r.estado === "cancelado").length;

  const ingresos = db.ingresos
    .filter((i) => i.barberoId === barberoId && delMes(i.fecha))
    .reduce((a, b) => a + b.monto, 0);

  const comisionCalculada = Math.round((ingresos * tasa) / 100);
  const pagado = db.pagosComision
    .filter((p) => p.barberoId === barberoId && p.mes === mes)
    .reduce((a, b) => a + b.monto, 0);
  const pendiente = Math.max(0, comisionCalculada - pagado);

  /* Servicio que más repite */
  const conteo = {};
  for (const r of reservasMes) {
    if (r.estado !== "finalizado") continue;
    conteo[r.servicioId] = (conteo[r.servicioId] || 0) + 1;
  }
  const topId = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a])[0];
  const topServicio = topId ? db.servicios.find((s) => s.id === topId) : null;

  /* Clientes distintos atendidos */
  const distintos = new Set(
    reservasMes.filter((r) => r.estado === "finalizado").map((r) => r.clienteId || r.clienteNombre)
  ).size;

  return {
    barbero, tasa, cortes, agendados, cancelados, ingresos,
    comisionCalculada, pagado, pendiente,
    ticketPromedio: cortes ? Math.round(ingresos / cortes) : 0,
    topServicio, clientesDistintos: distintos,
  };
}

/* Finalizar reserva: genera ingreso y suma corte al cliente */
export function finalizarReserva(update, reserva) {
  update((d) => {
    const r = d.reservas.find((x) => x.id === reserva.id);
    if (!r || r.estado === "finalizado") return d;
    r.estado = "finalizado";
    const sv = d.servicios.find((s) => s.id === r.servicioId);
    d.ingresos.push({
      id: uid(), fecha: r.fecha,
      concepto: sv ? `${sv.nombre} · ${r.clienteNombre}` : "Servicio",
      metodo: "efectivo", monto: sv ? sv.precio : 0, barberoId: r.barberoId || null,
    });
    const c = d.clientes.find((x) => x.id === r.clienteId);
    if (c) { c.cortes = (c.cortes || 0) + 1; c.ultimaVisita = r.fecha; }
    return d;
  });
}
