"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import DetalleReserva from "@/components/DetalleReserva";
import { useApp, uid, hoyISO, horarioDe, DIAS_SEMANA } from "@/lib/store";
import { crearReserva } from "@/lib/datos";
import { Plus, ChevronLeft, ChevronRight, Search } from "@/components/Icons";

/* Grilla base de la agenda, cada media hora */
const HORAS = [];
for (let h = 9; h <= 20; h++) {
  HORAS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 20) HORAS.push(`${String(h).padStart(2, "0")}:30`);
}
const ESTADOS = ["reservado", "confirmado", "finalizado", "cancelado"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const aMin = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const aHora = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const monday = (iso) => addDays(iso, -((new Date(iso + "T00:00:00").getDay() + 6) % 7));

export default function Agenda() {
  const app = useApp();
  const [vista, setVista] = useState("dia");
  const [fecha, setFecha] = useState(hoyISO());
  const [modal, setModal] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState("");
  if (!app) return null;
  const { update, reservas, servicios, barberos, clientes, sucursalId, sucursal,
          conSesion, barberia, recargar, horarios, bloqueos } = app;

  const delDia = (f) =>
    reservas.filter((r) => r.fecha === f && (!sucursalId || !r.sucursalId || r.sucursalId === sucursalId));

  const guardar = async (f) => {
    const existente = clientes.find((c) => c.nombre.toLowerCase() === f.cliente.toLowerCase());
    const nueva = {
      sucursalId,
      clienteNombre: f.cliente, clienteId: existente ? existente.id : null,
      servicioId: f.servicioId, barberoId: f.barberoId,
      fecha: f.fecha, hora: f.hora, estado: f.estado, notas: f.notas,
    };

    if (conSesion) {
      const r = await crearReserva(barberia.id, nueva);
      if (r.error) { setError(r.error); return; }
      await recargar("reservas", "clientes");
      setError("");
      setModal(null);
      return;
    }

    update((d) => { d.reservas.push({ id: uid(), ...nueva, foto: null }); return d; });
    setModal(null);
  };

  const fechaTxt = cap(new Date(fecha + "T00:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }));
  const lunes = monday(fecha);

  /* La grilla sale del horario de la sucursal, MÁS cualquier hora que tenga
     una reserva. Lo segundo es lo que faltaba: una cita fuera de la grilla
     —por ejemplo a las 14:45, o de antes de cambiar el horario— quedaba
     invisible en vez de mostrarse. */
  const semana = horarioDe(horarios, sucursal?.id);
  const diaSemana = new Date(fecha + "T00:00:00").getDay();
  const hoyHorario = semana[diaSemana];

  const enHorario = [];
  if (hoyHorario.abierto) {
    for (let m = aMin(hoyHorario.desde); m < aMin(hoyHorario.hasta); m += 30) enHorario.push(aHora(m));
  }

  const conReserva = delDia(fecha).map((r) => r.hora).filter(Boolean);
  const horasDelDia = [...new Set([...enHorario, ...conReserva])].sort();

  /* Bloqueos que caen en este día, para avisarlos en pantalla */
  const bloqueosHoy = (bloqueos || []).filter(
    (b) => b.fecha === fecha && (!b.sucursalId || b.sucursalId === sucursal?.id)
  );
  const bloqueada = (h) =>
    bloqueosHoy.some((b) => !b.desde || (h >= b.desde && h < b.hasta));

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
          <button className="btn dark agenda-add"
            onClick={() => setModal({ hora: horasDelDia[0] || "13:00" })}><Plus /> Reservar</button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {vista === "dia" && !hoyHorario.abierto && (
        <div className="aviso" style={{ marginBottom: 16 }}>
          <b>{sucursal?.nombre}</b> no atiende los {DIAS_SEMANA[diaSemana].toLowerCase()}.
          {conReserva.length > 0
            ? " Igual se muestran las reservas que ya estaban tomadas."
            : " Puedes cambiarlo en Administración → Horarios."}
        </div>
      )}

      {vista === "dia" && bloqueosHoy.some((b) => !b.desde) && (
        <div className="aviso" style={{ marginBottom: 16 }}>
          Día bloqueado{bloqueosHoy.find((b) => !b.desde)?.motivo
            ? `: ${bloqueosHoy.find((b) => !b.desde).motivo}` : ""}. No se reciben reservas online.
        </div>
      )}

      {vista === "dia" && (
        <div className="agenda">
          {horasDelDia.length === 0 && (
            <div className="empty">Sin horas de atención este día.</div>
          )}
          {horasDelDia.map((h) => {
            const rs = delDia(fecha).filter((r) => r.hora === h);
            const cerrada = bloqueada(h);
            return (
              <div className="slot" key={h} style={cerrada ? { opacity: 0.5 } : undefined}>
                <div className="h">{h}</div>
                <div className="body">
                  {rs.map((r) => {
                    const sv = servicios.find((s) => s.id === r.servicioId);
                    const bb = barberos.find((b) => b.id === r.barberoId);
                    return (
                      <button key={r.id} className={"apt " + r.estado} onClick={() => setDetalle(r)}>
                        <span className="apt-txt">{r.clienteNombre} · {sv?.nombre}{bb ? " · " + bb.nombre : ""}</span>
                        <span className="apt-estado">{r.estado}</span>
                        <ChevronRight style={{ width: 15, height: 15, opacity: 0.6, flexShrink: 0 }} />
                      </button>
                    );
                  })}
                  {cerrada
                    ? <span className="free" style={{ cursor: "default" }}>bloqueado</span>
                    : <button className="free" onClick={() => setModal({ hora: h })}>+ reservar</button>}
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
                  <div key={r.id} className={"mini " + r.estado}
                    onClick={(e) => { e.stopPropagation(); setDetalle(r); }}>
                    {r.hora} · {r.clienteNombre}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {detalle && <DetalleReserva reserva={detalle} onClose={() => setDetalle(null)} />}

      {modal && (
        <NuevaReserva
          horaInicial={modal.hora} fecha={fecha} horas={horasDelDia}
          servicios={servicios.filter((s) => s.activo)} barberos={barberos} clientes={clientes}
          onClose={() => setModal(null)} onSave={guardar}
        />
      )}
    </Shell>
  );
}

function NuevaReserva({ horaInicial, fecha, horas, servicios, barberos, clientes, onClose, onSave }) {
  const [f, setF] = useState({
    cliente: "", servicioId: "", barberoId: "",
    fecha, hora: horaInicial || "13:00", estado: "confirmado", notas: "",
  });
  /* Se ofrecen las horas de atención del día; si la elegida no está —una
     reserva antigua, por ejemplo— igual se incluye para no perderla. */
  const opciones = [...new Set([...(horas?.length ? horas : HORAS), f.hora])].filter(Boolean).sort();
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
              {opciones.map((h) => <option key={h} value={h}>{h}</option>)}
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
