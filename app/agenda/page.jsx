"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { useApp, uid, hoyISO, finalizarReserva } from "@/lib/store";

const HORAS = ["9:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"];
const ESTADOS = ["reservado", "confirmado", "finalizado", "cancelado"];

const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const monday = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  return addDays(iso, -day);
};

export default function Agenda() {
  const app = useApp();
  const [vista, setVista] = useState("dia");
  const [fecha, setFecha] = useState(hoyISO());
  const [modal, setModal] = useState(null); // {hora?}
  if (!app) return null;
  const { update, db, reservas, servicios, barberos, clientes, barberiaId, sucursalId } = app;

  const delDia = (f) => reservas.filter((r) => r.fecha === f);

  const guardar = (form) => {
    update((d) => {
      let clienteId = null;
      const existente = d.clientes.find((c) => c.barberiaId === barberiaId && c.nombre.toLowerCase() === form.cliente.toLowerCase());
      if (existente) clienteId = existente.id;
      d.reservas.push({
        id: uid(), barberiaId, sucursalId,
        clienteNombre: form.cliente, clienteId,
        servicioId: form.servicioId, barberoId: form.barberoId,
        fecha: form.fecha, hora: form.hora, estado: form.estado, notas: form.notas,
      });
      return d;
    });
    setModal(null);
  };

  const cambiarEstado = (r, estado) => {
    if (estado === "finalizado") return finalizarReserva(update, db, r);
    update((d) => {
      const x = d.reservas.find((y) => y.id === r.id);
      if (x) x.estado = estado;
      return d;
    });
  };

  const fechaTxt = new Date(fecha + "T00:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const lunes = monday(fecha);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h2>Agenda</h2>
          <div className="sub" style={{ textTransform: "capitalize" }} suppressHydrationWarning>{fechaTxt}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="tabs" style={{ margin: 0 }}>
            <button className={vista === "dia" ? "on" : ""} onClick={() => setVista("dia")}>Día</button>
            <button className={vista === "semana" ? "on" : ""} onClick={() => setVista("semana")}>Semana</button>
          </div>
          <div className="tabs" style={{ margin: 0 }}>
            <button onClick={() => setFecha(addDays(fecha, vista === "dia" ? -1 : -7))}>‹</button>
            <button onClick={() => setFecha(hoyISO())}>Hoy</button>
            <button onClick={() => setFecha(addDays(fecha, vista === "dia" ? 1 : 7))}>›</button>
          </div>
          <button className="btn dark" onClick={() => setModal({ hora: "13:00" })}>+ Reserva</button>
        </div>
      </div>

      {vista === "dia" && (
        <div className="agenda-grid">
          {HORAS.map((h) => {
            const rs = delDia(fecha).filter((r) => r.hora === h);
            return (
              <div className="slot" key={h}>
                <div className="h">{h}</div>
                <div className="body">
                  {rs.map((r) => {
                    const sv = servicios.find((s) => s.id === r.servicioId);
                    const bb = barberos.find((b) => b.id === r.barberoId);
                    return (
                      <div key={r.id} className={"apt " + r.estado}>
                        <span><b>{r.clienteNombre}</b> · {sv?.nombre}{bb ? " · " + bb.nombre : ""}</span>
                        <select value={r.estado} onChange={(e) => cambiarEstado(r, e.target.value)}>
                          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  <button className="free" onClick={() => setModal({ hora: h })}>+ reservar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vista === "semana" && (
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => addDays(lunes, i)).map((f) => {
            const rs = delDia(f);
            const nombre = new Date(f + "T00:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric" });
            return (
              <div key={f} className={"daycol" + (f === hoyISO() ? " today" : "")} onClick={() => { setFecha(f); setVista("dia"); }}>
                <h5>{nombre}</h5>
                {rs.map((r) => (
                  <div key={r.id} className={"mini " + r.estado}>{r.hora} · {r.clienteNombre}</div>
                ))}
                {rs.length === 0 && <div className="muted">—</div>}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <NuevaReserva
          horaInicial={modal.hora}
          fecha={fecha}
          servicios={servicios}
          barberos={barberos}
          clientes={clientes}
          onClose={() => setModal(null)}
          onSave={guardar}
        />
      )}
    </Shell>
  );
}

function NuevaReserva({ horaInicial, fecha, servicios, barberos, clientes, onClose, onSave }) {
  const [f, setF] = useState({
    cliente: "", servicioId: servicios[0]?.id || "", barberoId: barberos[0]?.id || "",
    fecha, hora: horaInicial || "13:00", estado: "reservado", notas: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const sugerencias = f.cliente
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(f.cliente.toLowerCase()) && c.nombre.toLowerCase() !== f.cliente.toLowerCase()).slice(0, 3)
    : [];

  return (
    <Modal
      title="Nueva reserva"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={!f.cliente || !f.servicioId} onClick={() => onSave(f)}>Guardar</button>
        </>
      }
    >
      <div className="field">
        <label>Cliente</label>
        <input placeholder="Buscar o escribir nombre..." value={f.cliente} onChange={(e) => set("cliente", e.target.value)} />
        {sugerencias.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {sugerencias.map((c) => (
              <button key={c.id} className="chip" onClick={() => set("cliente", c.nombre)}>{c.nombre}</button>
            ))}
          </div>
        )}
      </div>
      <div className="grid2">
        <div className="field">
          <label>Servicio</label>
          <select value={f.servicioId} onChange={(e) => set("servicioId", e.target.value)}>
            {servicios.filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Barbero</label>
          <select value={f.barberoId} onChange={(e) => set("barberoId", e.target.value)}>
            {barberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Fecha</label>
          <input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
        </div>
        <div className="field">
          <label>Hora</label>
          <select value={f.hora} onChange={(e) => set("hora", e.target.value)}>
            {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Estado</label>
        <select value={f.estado} onChange={(e) => set("estado", e.target.value)}>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Notas</label>
        <textarea rows={3} value={f.notas} onChange={(e) => set("notas", e.target.value)} />
      </div>
    </Modal>
  );
}
