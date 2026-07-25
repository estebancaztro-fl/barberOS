"use client";
import { createContext, useContext, useEffect, useState } from "react";

export const uid = () => Math.random().toString(36).slice(2, 10);
export const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-CL");
export const hoyISO = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const seed = {
  barberias: [
    { id: "b1", nombre: "Barber Royce", slug: "barber-royce", logo: null },
    { id: "b2", nombre: "Old School Barber", slug: "old-school", logo: null },
  ],
  sucursales: [
    { id: "s1", barberiaId: "b1", nombre: "Sucursal Centro", direccion: "Av. Providencia 1234", telefono: "+56 2 2345 6789", estado: "activa" },
    { id: "s2", barberiaId: "b2", nombre: "Sucursal Única", direccion: "Calle Prat 456", telefono: "+56 2 2222 1111", estado: "activa" },
  ],
  equipo: [
    { id: "e1", barberiaId: "b1", nombre: "Carlos Muñoz", correo: "", telefono: "", rol: "barbero", comision: 40, activo: true },
    { id: "e2", barberiaId: "b1", nombre: "Diego Rojas", correo: "", telefono: "", rol: "barbero", comision: 50, activo: true },
    { id: "e3", barberiaId: "b1", nombre: "Martín Silva", correo: "", telefono: "", rol: "barbero", comision: 40, activo: true },
    { id: "e4", barberiaId: "b2", nombre: "Pedro Díaz", correo: "", telefono: "", rol: "barbero", comision: 45, activo: true },
  ],
  servicios: [
    { id: "sv1", barberiaId: "b1", nombre: "Arreglo de barba", descripcion: "", duracion: 20, precio: 5000, activo: true },
    { id: "sv2", barberiaId: "b1", nombre: "Corte + Barba", descripcion: "", duracion: 60, precio: 15000, activo: true },
    { id: "sv3", barberiaId: "b1", nombre: "Corte clásico", descripcion: "", duracion: 30, precio: 8000, activo: true },
    { id: "sv4", barberiaId: "b1", nombre: "Degradado", descripcion: "", duracion: 45, precio: 12000, activo: true },
    { id: "sv5", barberiaId: "b2", nombre: "Corte clásico", descripcion: "", duracion: 30, precio: 9000, activo: true },
    { id: "sv6", barberiaId: "b2", nombre: "Afeitado tradicional", descripcion: "", duracion: 30, precio: 7000, activo: true },
  ],
  clientes: [
    { id: "c1", barberiaId: "b1", nombre: "Ignacio Pérez", telefono: "+56 9 8765 4321", correo: "ignacio@mail.com", vip: true, cortes: 1, ultimaVisita: daysAgo(5) },
    { id: "c2", barberiaId: "b1", nombre: "Francisca Soto", telefono: "+56 9 7654 3210", correo: "francisca@mail.com", vip: false, cortes: 0, ultimaVisita: daysAgo(40) },
    { id: "c3", barberiaId: "b1", nombre: "Matías Cifuentes", telefono: "+56 9 6543 2109", correo: "matias@mail.com", vip: false, cortes: 1, ultimaVisita: daysAgo(6) },
    { id: "c4", barberiaId: "b2", nombre: "Jorge Rivas", telefono: "+56 9 1111 2222", correo: "", vip: false, cortes: 2, ultimaVisita: daysAgo(10) },
  ],
  reservas: [
    { id: "r1", barberiaId: "b1", sucursalId: "s1", clienteNombre: "Ignacio Pérez", clienteId: "c1", servicioId: "sv2", barberoId: "e3", fecha: daysAgo(5), hora: "11:00", estado: "finalizado", notas: "" },
    { id: "r2", barberiaId: "b1", sucursalId: "s1", clienteNombre: "Matías Cifuentes", clienteId: "c3", servicioId: "sv4", barberoId: "e1", fecha: daysAgo(6), hora: "16:00", estado: "finalizado", notas: "" },
  ],
  ingresos: [
    { id: "i1", barberiaId: "b1", fecha: daysAgo(5), concepto: "Venta general", metodo: "efectivo", monto: 15000, barberoId: "e3" },
    { id: "i2", barberiaId: "b1", fecha: daysAgo(6), concepto: "Venta general", metodo: "tarjeta", monto: 12000, barberoId: "e1" },
  ],
  gastos: [],
  pagosComision: [],
  campanas: [],
};

const Ctx = createContext(null);

export function DataProvider({ children }) {
  const [db, setDb] = useState(seed);
  const [ready, setReady] = useState(false);
  const [barberiaId, setBarberiaId] = useState("b1");
  const [sucursalId, setSucursalId] = useState("s1");
  const [rol, setRol] = useState("admin"); // admin | recepcion | barbero

  useEffect(() => {
    try {
      const raw = localStorage.getItem("barberos-db-v1");
      if (raw) setDb(JSON.parse(raw));
      const ctx = localStorage.getItem("barberos-ctx-v1");
      if (ctx) {
        const c = JSON.parse(ctx);
        if (c.barberiaId) setBarberiaId(c.barberiaId);
        if (c.sucursalId) setSucursalId(c.sucursalId);
        if (c.rol) setRol(c.rol);
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("barberos-db-v1", JSON.stringify(db));
  }, [db, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem("barberos-ctx-v1", JSON.stringify({ barberiaId, sucursalId, rol }));
  }, [barberiaId, sucursalId, rol, ready]);

  const update = (fn) => setDb((prev) => fn(JSON.parse(JSON.stringify(prev))));

  const cambiarBarberia = (id) => {
    setBarberiaId(id);
    const suc = db.sucursales.find((s) => s.barberiaId === id);
    setSucursalId(suc ? suc.id : "");
  };

  // scoped helpers
  const barberia = db.barberias.find((b) => b.id === barberiaId) || db.barberias[0];
  const scoped = (key) => db[key].filter((x) => x.barberiaId === barberiaId);

  const value = {
    db, update, ready,
    barberiaId, sucursalId, rol,
    setSucursalId, setRol, cambiarBarberia,
    barberia,
    sucursales: scoped("sucursales"),
    equipo: scoped("equipo"),
    barberos: scoped("equipo").filter((e) => e.rol === "barbero" && e.activo),
    servicios: scoped("servicios"),
    clientes: scoped("clientes"),
    reservas: scoped("reservas"),
    ingresos: scoped("ingresos"),
    gastos: scoped("gastos"),
    pagosComision: scoped("pagosComision"),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

// Segmentación CRM
export function segmentoDe(cliente) {
  if (cliente.vip) return "vip";
  const dias = Math.floor((Date.now() - new Date(cliente.ultimaVisita + "T00:00:00").getTime()) / 86400000);
  if (dias > 60) return "perdido";
  if (dias >= 30) return "volver";
  if ((cliente.cortes || 0) >= 4) return "frecuente";
  return "activo";
}

// Finaliza una reserva: crea ingreso + suma corte al cliente
export function finalizarReserva(update, db, reserva) {
  update((d) => {
    const r = d.reservas.find((x) => x.id === reserva.id);
    if (!r || r.estado === "finalizado") return d;
    r.estado = "finalizado";
    const sv = d.servicios.find((s) => s.id === r.servicioId);
    d.ingresos.push({
      id: uid(), barberiaId: r.barberiaId, fecha: r.fecha,
      concepto: sv ? sv.nombre + " · " + r.clienteNombre : "Servicio",
      metodo: "efectivo", monto: sv ? sv.precio : 0, barberoId: r.barberoId || null,
    });
    const c = d.clientes.find((x) => x.id === r.clienteId);
    if (c) { c.cortes = (c.cortes || 0) + 1; c.ultimaVisita = r.fecha; }
    return d;
  });
}
