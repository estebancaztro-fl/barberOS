"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useApp, uid, fmt, hoyISO } from "@/lib/store";

const HORAS = ["9:00","9:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

export default function ReservaPublica() {
  const app = useApp();
  const { slug } = useParams();
  const [f, setF] = useState({ servicioId: "", barberoId: "any", fecha: "", hora: "", nombre: "", telefono: "", correo: "" });
  const [ok, setOk] = useState(false);
  if (!app) return null;
  const { db, update } = app;

  const barberia = db.barberias.find((b) => b.slug === slug);
  if (!barberia) {
    return <div className="pub"><div className="empty">Barbería no encontrada.</div></div>;
  }

  const servicios = db.servicios.filter((s) => s.barberiaId === barberia.id && s.activo);
  const barberos = db.equipo.filter((e) => e.barberiaId === barberia.id && e.rol === "barbero" && e.activo);
  const sucursal = db.sucursales.find((s) => s.barberiaId === barberia.id && s.estado === "activa");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const ocupadas = db.reservas
    .filter((r) => r.barberiaId === barberia.id && r.fecha === f.fecha && r.estado !== "cancelado" && (f.barberoId === "any" || r.barberoId === f.barberoId))
    .map((r) => r.hora);
  const horasDisp = f.barberoId === "any"
    ? HORAS.filter((h) => ocupadas.filter((o) => o === h).length < barberos.length || barberos.length === 0)
    : HORAS.filter((h) => !ocupadas.includes(h));

  const valido = f.servicioId && f.fecha && f.hora && f.nombre && f.telefono;

  const confirmar = () => {
    update((d) => {
      let cliente = d.clientes.find((c) => c.barberiaId === barberia.id && c.telefono === f.telefono);
      if (!cliente) {
        cliente = { id: uid(), barberiaId: barberia.id, nombre: f.nombre, telefono: f.telefono, correo: f.correo, vip: false, cortes: 0, ultimaVisita: hoyISO() };
        d.clientes.push(cliente);
      }
      let barberoId = f.barberoId;
      if (barberoId === "any") {
        const libres = barberos.filter((b) => !d.reservas.some((r) => r.fecha === f.fecha && r.hora === f.hora && r.barberoId === b.id && r.estado !== "cancelado"));
        barberoId = (libres[0] || barberos[0])?.id || null;
      }
      d.reservas.push({
        id: uid(), barberiaId: barberia.id, sucursalId: sucursal?.id || null,
        clienteNombre: f.nombre, clienteId: cliente.id,
        servicioId: f.servicioId, barberoId,
        fecha: f.fecha, hora: f.hora, estado: "reservado", notas: "Reserva online",
      });
      return d;
    });
    setOk(true);
  };

  if (ok) {
    const sv = servicios.find((s) => s.id === f.servicioId);
    return (
      <div className="pub">
        <div className="pub-head">
          <div className="brand-icon">✂</div>
          <div><h1>{barberia.nombre}</h1><p>Reserva tu hora</p></div>
        </div>
        <div className="success">
          <b>✓ ¡Reserva confirmada!</b>
          <p style={{ marginTop: 8 }}>{sv?.nombre} · {f.fecha} a las {f.hora}</p>
          <p className="muted" style={{ marginTop: 6 }}>Te esperamos, {f.nombre}.</p>
        </div>
        <button className="bigbtn" onClick={() => { setOk(false); setF({ servicioId: "", barberoId: "any", fecha: "", hora: "", nombre: "", telefono: "", correo: "" }); }}>
          Hacer otra reserva
        </button>
      </div>
    );
  }

  return (
    <div className="pub">
      <div className="pub-head">
        <div className="brand-icon">✂</div>
        <div><h1>{barberia.nombre}</h1><p>Reserva tu hora</p></div>
      </div>

      <h3>Servicio</h3>
      {servicios.map((s) => (
        <button key={s.id} className={"svc" + (f.servicioId === s.id ? " on" : "")} onClick={() => set("servicioId", s.id)}>
          <span><b>{s.nombre}</b><span className="mut">{s.duracion} min</span></span>
          <span className="price">{fmt(s.precio)}</span>
        </button>
      ))}

      <h3>Barbero</h3>
      <div className="chips">
        <button className={"chip" + (f.barberoId === "any" ? " on" : "")} onClick={() => set("barberoId", "any")}>Cualquiera</button>
        {barberos.map((b) => (
          <button key={b.id} className={"chip" + (f.barberoId === b.id ? " on" : "")} onClick={() => set("barberoId", b.id)}>{b.nombre}</button>
        ))}
      </div>

      <div className="grid2" style={{ marginTop: 24 }}>
        <div className="field">
          <label>Fecha</label>
          <input type="date" min={hoyISO()} value={f.fecha} onChange={(e) => { set("fecha", e.target.value); set("hora", ""); }} />
        </div>
        <div className="field">
          <label>Hora</label>
          <select value={f.hora} onChange={(e) => set("hora", e.target.value)} disabled={!f.fecha}>
            <option value="">—</option>
            {horasDisp.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      <div className="field"><label>Nombre</label><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="field"><label>Teléfono</label><input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
      <div className="field"><label>Correo (opcional)</label><input value={f.correo} onChange={(e) => set("correo", e.target.value)} /></div>

      <button className="bigbtn" disabled={!valido} onClick={confirmar}>✓ Confirmar reserva</button>
    </div>
  );
}
