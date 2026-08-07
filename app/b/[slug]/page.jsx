"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useApp, uid, fmt, hoyISO } from "@/lib/store";
import { Scissors } from "@/components/Icons";

const HORAS = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

export default function ReservaPublica() {
  const app = useApp();
  const { slug } = useParams();
  const [f, setF] = useState({ servicioId: "", barberoId: "any", sucursalId: "", fecha: "", hora: "", nombre: "", telefono: "", correo: "" });
  const [ok, setOk] = useState(false);
  if (!app) return null;
  const { db, update } = app;
  const { barberia } = db;

  if (barberia.slug !== slug) {
    return <div className="pub"><div className="empty">Barbería no encontrada.</div></div>;
  }

  const servicios = db.servicios.filter((s) => s.activo);
  const barberos = db.equipo.filter((e) => e.rol === "barbero" && e.activo);
  const sucursales = db.sucursales.filter((s) => s.activa);
  const sucursalId = f.sucursalId || sucursales[0]?.id || "";
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const ocupadas = db.reservas.filter(
    (r) => r.fecha === f.fecha && r.sucursalId === sucursalId && r.estado !== "cancelado" &&
      (f.barberoId === "any" || r.barberoId === f.barberoId)
  ).map((r) => r.hora);

  const horasDisp = f.barberoId === "any"
    ? HORAS.filter((h) => ocupadas.filter((o) => o === h).length < Math.max(1, barberos.length))
    : HORAS.filter((h) => !ocupadas.includes(h));

  const valido = f.servicioId && f.fecha && f.hora && f.nombre && f.telefono;

  const confirmar = () => {
    update((d) => {
      let c = d.clientes.find((x) => x.telefono && x.telefono === f.telefono);
      if (!c) {
        c = {
          id: uid(), nombre: f.nombre, telefono: f.telefono, correo: f.correo,
          vip: false, cortes: 0, ultimaVisita: hoyISO(),
          observaciones: "", tipoPelo: "", densidad: "", formaRostro: "", notasVoz: [], analisisRostro: null,
        };
        d.clientes.push(c);
      }
      let barberoId = f.barberoId;
      if (barberoId === "any") {
        const libres = barberos.filter((b) => !d.reservas.some(
          (r) => r.fecha === f.fecha && r.hora === f.hora && r.barberoId === b.id && r.estado !== "cancelado"
        ));
        barberoId = (libres[0] || barberos[0])?.id || null;
      }
      d.reservas.push({
        id: uid(), sucursalId,
        clienteNombre: f.nombre, clienteId: c.id,
        servicioId: f.servicioId, barberoId,
        fecha: f.fecha, hora: f.hora, estado: "reservado", notas: "Reserva online", foto: null,
      });
      return d;
    });
    setOk(true);
  };

  const Cabecera = () => (
    <div className="pub-head">
      <div className="brand-icon">
        {barberia.logo
          ? <img src={barberia.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} />
          : <Scissors />}
      </div>
      <div><h1>{barberia.nombre}</h1><p>Reserva tu hora</p></div>
    </div>
  );

  if (ok) {
    const sv = servicios.find((s) => s.id === f.servicioId);
    return (
      <div className="pub">
        <Cabecera />
        <div className="success">
          <b>✓ ¡Reserva confirmada!</b>
          <p style={{ marginTop: 8 }}>{sv?.nombre} · {f.fecha} a las {f.hora}</p>
          <p style={{ marginTop: 6, opacity: 0.8 }}>Te esperamos, {f.nombre}.</p>
        </div>
        <button className="bigbtn" onClick={() => { setOk(false); setF({ servicioId: "", barberoId: "any", sucursalId: "", fecha: "", hora: "", nombre: "", telefono: "", correo: "" }); }}>
          Hacer otra reserva
        </button>
      </div>
    );
  }

  return (
    <div className="pub">
      <Cabecera />

      {sucursales.length > 1 && (
        <>
          <h3>Sucursal</h3>
          <div className="chips">
            {sucursales.map((s) => (
              <button key={s.id} className={"chip" + (sucursalId === s.id ? " on" : "")} onClick={() => set("sucursalId", s.id)}>{s.nombre}</button>
            ))}
          </div>
        </>
      )}

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

      <div className="grid2" style={{ marginTop: 26 }}>
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
