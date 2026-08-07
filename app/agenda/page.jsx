"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { useApp, uid, hoyISO, finalizarReserva } from "@/lib/store";
import { Plus, ChevronLeft, ChevronRight, Search } from "@/components/Icons";

const HORAS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"];
const ESTADOS = ["reservado", "confirmado", "finalizado", "cancelado"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const monday = (iso) => addDays(iso, -((new Date(iso + "T00:00:00").getDay() + 6) % 7));

export default function Agenda() {
  const app = useApp();
  const [vista, setVista] = useState("dia");
  const [fecha, setFecha] = useState(hoyISO());
  const [modal, setModal] = useState(null);
  if (!app) return null;
  const { update, reservas, servicios, barberos, clientes, sucursalId, sucursal } = app;

  const delDia = (f) => reservas.filter((r) => r.fecha === f && r.sucursalId === sucursalId);

  const guardar = (f) => {
    update((d) => {
      const existente = d.clientes.find((c) => c.nombre.toLowerCase() === f.cliente.toLowerCase());
      d.reservas.push({
        id: uid(), sucursalId,
        clienteNombre: f.cliente, clienteId: existente ? existente.id : null,
        servicioId: f.servicioId, barberoId: f.barberoId,
        fecha: f.fecha, hora: f.hora, estado: f.estado, notas: f.notas, foto: null,
      });
      return d;
    });
    setModal(null);
  };

  const cambiarEstado = (r, estado) => {
    if (estado === "finalizado") return finalizarReserva(update, r);
    update((d) => { const x = d.reservas.find((y) => y.id === r.id); if (x) x.estado = estado; return d; });
  };

  const fechaTxt = cap(new Date(fecha + "T00:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }));
  const lunes = monday(fecha);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h2>Agenda</h2>
          <div className="sub" suppressHydrationWarning>{fechaTxt} · {sucursal?.nombre}</div>
        </div>
        <div className="agenda-ctrl">
          <div className="tabs" style={{ margin: 0 }}>
            <button className={vista === "dia" ? "on" : ""} onClick={() => setVista("dia")}>Día</button>
            <button className={vista === "semana" ? "on" : ""} onClick={() => setVista("semana")}>Semana</button>
          </div>
          <div className="tabs" style={{ margin: 0 }}>
            <button onClick={() => setFecha(addDays(fecha, vista === "dia" ? -1 : -7))}><ChevronLeft style={{ width: 16, height: 16 }} /></button>
            <button onClick={() => setFecha(hoyISO())}>Hoy</button>
            <button onClick={() => setFecha(addDays(fecha, vista === "dia" ? 1 : 7))}><ChevronRight style={{ width: 16, height: 16 }} /></button>
          </div>
          <button className="btn dark agenda-add" onClick={() => setModal({ hora: "13:00" })}><Plus /> Reservar</button>
        </div>
      </div>

      {vista === "dia" && (
        <div className="agenda">
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
                        <span>{r.clienteNombre} · {sv?.nombre}{bb ? " · " + bb.nombre : ""}</span>
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
            return (
              <div key={f} className={"daycol" + (f === hoyISO() ? " today" : "")} onClick={() => { setFecha(f); setVista("dia"); }}>
                <h5 suppressHydrationWarning>{new Date(f + "T00:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric" })}</h5>
                {rs.length === 0 && <div className="muted">—</div>}
                {[...rs].sort((a, b) => a.hora.localeCompare(b.hora)).map((r) => (
                  <div key={r.id} className={"mini " + r.estado}>{r.hora} · {r.clienteNombre}</div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <NuevaReserva
          horaInicial={modal.hora} fecha={fecha}
          servicios={servicios.filter((s) => s.activo)} barberos={barberos} clientes={clientes}
          onClose={() => setModal(null)} onSave={guardar}
        />
      )}
    </Shell>
  );
}

function NuevaReserva({ horaInicial, fecha, servicios, barberos, clientes, onClose, onSave }) {
  const [f, setF] = useState({
    cliente: "", servicioId: "", barberoId: "",
    fecha, hora: horaInicial || "13:00", estado: "confirmado", notas: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const sug = f.cliente
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(f.cliente.toLowerCase()) && c.nombre.toLowerCase() !== f.cliente.toLowerCase()).slice(0, 3)
    : [];

  return (
    <Modal
      title="Nueva reserva" onClose={onClose}
      footer={
        <>
          <button className="link-btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={!f.cliente || !f.servicioId} onClick={() => onSave(f)}>Reservar</button>
        </>
      }
    >
      <div className="field">
        <label>Cliente</label>
        <div style={{ position: "relative" }}>
          <Search style={{ width: 17, height: 17, position: "absolute", left: 15, top: 15, color: "#b3b3bb" }} />
          <input style={{ paddingLeft: 42 }} placeholder="Buscar o escribir nombre..." value={f.cliente} onChange={(e) => set("cliente", e.target.value)} />
        </div>
        {sug.length > 0 && (
          <div className="chips" style={{ marginTop: 10 }}>
            {sug.map((c) => <button key={c.id} className="chip" onClick={() => set("cliente", c.nombre)}>{c.nombre}</button>)}
          </div>
        )}
      </div>
      <div className="grid2">
        <div className="field">
          <label>Servicio</label>
          <select value={f.servicioId} onChange={(e) => set("servicioId", e.target.value)}>
            <option value="">Seleccionar...</option>
            {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Barbero</label>
          <select value={f.barberoId} onChange={(e) => set("barberoId", e.target.value)}>
            <option value="">Seleccionar...</option>
            {barberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Fecha y hora</label>
          <div className="fechahora">
            <input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
            <select value={f.hora} onChange={(e) => set("hora", e.target.value)}>
              {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Estado</label>
          <select value={f.estado} onChange={(e) => set("estado", e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{cap(e)}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Notas</label>
        <textarea rows={3} value={f.notas} onChange={(e) => set("notas", e.target.value)} />
      </div>
    </Modal>
  );
}
