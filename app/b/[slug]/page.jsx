"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useApp, uid, fmt, hoyISO } from "@/lib/store";
import { haySupabase } from "@/lib/supabase";
import { publicoBarberia, publicoHorasOcupadas, publicoReservar } from "@/lib/datos";
import { Scissors } from "@/components/Icons";

const HORAS = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

const VACIO = {
  servicioId: "", barberoId: "", sucursalId: "",
  fecha: "", hora: "", nombre: "", telefono: "", correo: "", aceptaDatos: false,
};

export default function ReservaPublica() {
  const app = useApp();
  const { slug } = useParams();
  const [f, setF] = useState(VACIO);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  /* Datos de la barbería: de la base si está conectada, del navegador si no */
  const [cargando, setCargando] = useState(haySupabase);
  const [remota, setRemota] = useState(null);
  const [ocupadas, setOcupadas] = useState([]);

  useEffect(() => {
    if (!haySupabase || !slug) return;
    let vivo = true;
    publicoBarberia(slug).then(({ datos, error }) => {
      if (!vivo) return;
      if (error) setError(error);
      setRemota(datos || null);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [slug]);

  /* Horas ya tomadas para la fecha elegida */
  useEffect(() => {
    if (!haySupabase || !f.fecha || !remota) return;
    let vivo = true;
    publicoHorasOcupadas(slug, f.fecha, f.sucursalId, f.barberoId).then(({ datos }) => {
      if (vivo && datos) setOcupadas(datos);
    });
    return () => { vivo = false; };
  }, [slug, f.fecha, f.sucursalId, f.barberoId, remota]);

  if (!app) return null;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  /* ---------- Modo local (sin base configurada) ---------- */
  const local = app.db.barberia;
  const localReconoce =
    !haySupabase && (local.slug === slug || (local.slugsAnteriores || []).includes(slug));

  if (haySupabase && cargando) {
    return <div className="pub"><div className="login-pantalla"><div className="spinner" /></div></div>;
  }

  const barberia = haySupabase ? remota : (localReconoce ? local : null);

  if (!barberia) {
    return (
      <div className="pub">
        <div className="empty">
          Barbería no encontrada.
          <div className="muted" style={{ marginTop: 10, fontSize: 13.5 }}>
            Revisa que el link esté completo. Si te lo pasaron por mensaje,
            puede haberse cortado.
          </div>
        </div>
      </div>
    );
  }

  const servicios = haySupabase ? (barberia.servicios || []) : app.db.servicios.filter((s) => s.activo);
  const barberos  = haySupabase ? (barberia.barberos || [])  : app.db.equipo.filter((e) => e.rol === "barbero" && e.activo);
  const sucursales = haySupabase ? (barberia.sucursales || []) : app.db.sucursales.filter((s) => s.activa);
  const sucursalId = f.sucursalId || sucursales[0]?.id || "";

  /* Horas libres: en modo local se calculan sobre el navegador */
  const tomadasLocal = !haySupabase
    ? app.db.reservas
        .filter((r) => r.fecha === f.fecha && r.estado !== "cancelado" &&
          (!f.barberoId || r.barberoId === f.barberoId))
        .map((r) => r.hora)
    : [];

  const cupos = Math.max(1, barberos.length);
  const horasDisp = HORAS.filter((h) => {
    if (haySupabase) {
      const fila = ocupadas.find((o) => (o.hora || "").slice(0, 5) === h);
      const n = fila ? Number(fila.ocupaciones) : 0;
      return f.barberoId ? n === 0 : n < cupos;
    }
    const n = tomadasLocal.filter((x) => x === h).length;
    return f.barberoId ? n === 0 : n < cupos;
  });

  const valido = f.servicioId && f.fecha && f.hora && f.nombre.trim().length >= 2
    && f.telefono.trim().length >= 8 && f.aceptaDatos;

  const confirmar = async () => {
    setError("");
    setEnviando(true);

    if (haySupabase) {
      const r = await publicoReservar({ ...f, slug, sucursalId });
      setEnviando(false);
      if (r.error) { setError(r.error); return; }
      setOk(true);
      return;
    }

    /* Modo local */
    app.update((d) => {
      let c = d.clientes.find((x) => x.telefono && x.telefono === f.telefono);
      if (!c) {
        c = { id: uid(), nombre: f.nombre, telefono: f.telefono, correo: f.correo,
              vip: false, cortes: 0, ultimaVisita: hoyISO(),
              observaciones: "", tipoPelo: "", densidad: "", formaRostro: "", notasVoz: [], visagismo: null };
        d.clientes.push(c);
      }
      const libres = barberos.filter((b) => !d.reservas.some(
        (r) => r.fecha === f.fecha && r.hora === f.hora && r.barberoId === b.id && r.estado !== "cancelado"));
      d.reservas.push({
        id: uid(), sucursalId,
        clienteNombre: f.nombre, clienteId: c.id,
        servicioId: f.servicioId, barberoId: f.barberoId || (libres[0] || barberos[0])?.id || null,
        fecha: f.fecha, hora: f.hora, estado: "reservado", notas: "Reserva online", foto: null,
      });
      return d;
    });
    setEnviando(false);
    setOk(true);
  };

  const logo = haySupabase ? barberia.logo_url : barberia.logo;

  const Cabecera = () => (
    <div className="pub-head">
      <div className="brand-icon">
        {logo
          ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 18 }} />
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
        <button className="bigbtn" onClick={() => { setOk(false); setF(VACIO); }}>
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
              <button key={s.id} className={"chip" + (sucursalId === s.id ? " on" : "")}
                onClick={() => set("sucursalId", s.id)}>{s.nombre}</button>
            ))}
          </div>
        </>
      )}

      <h3>Servicio</h3>
      {servicios.length === 0 && <div className="empty">Esta barbería aún no publicó sus servicios.</div>}
      {servicios.map((s) => (
        <button key={s.id} className={"svc" + (f.servicioId === s.id ? " on" : "")}
          onClick={() => set("servicioId", s.id)}>
          <span><b>{s.nombre}</b><span className="mut">{s.duracion} min</span></span>
          <span className="price">{fmt(s.precio)}</span>
        </button>
      ))}

      {barberos.length > 0 && (
        <>
          <h3>Barbero</h3>
          <div className="chips">
            <button className={"chip" + (!f.barberoId ? " on" : "")}
              onClick={() => set("barberoId", "")}>Cualquiera</button>
            {barberos.map((b) => (
              <button key={b.id} className={"chip" + (f.barberoId === b.id ? " on" : "")}
                onClick={() => set("barberoId", b.id)}>{b.nombre}</button>
            ))}
          </div>
        </>
      )}

      <div className="grid2" style={{ marginTop: 26 }}>
        <div className="field">
          <label>Fecha</label>
          <input type="date" min={hoyISO()} value={f.fecha}
            onChange={(e) => { set("fecha", e.target.value); set("hora", ""); }} />
        </div>
        <div className="field">
          <label>Hora</label>
          <select value={f.hora} onChange={(e) => set("hora", e.target.value)} disabled={!f.fecha}>
            <option value="">{f.fecha ? "Elige una hora" : "Primero la fecha"}</option>
            {horasDisp.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          {f.fecha && horasDisp.length === 0 && (
            <p className="muted" style={{ marginTop: 7, fontSize: 13 }}>
              No queda cupo ese día. Prueba otra fecha.
            </p>
          )}
        </div>
      </div>

      <div className="field"><label>Nombre</label>
        <input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="field"><label>Teléfono</label>
        <input type="tel" placeholder="+56 9 0000 0000" value={f.telefono}
          onChange={(e) => set("telefono", e.target.value)} /></div>
      <div className="field"><label>Correo (opcional)</label>
        <input type="email" value={f.correo} onChange={(e) => set("correo", e.target.value)} /></div>

      {/* Consentimiento explícito: lo exige la Ley 21.719 y también la base */}
      <label className="consentimiento">
        <input type="checkbox" checked={f.aceptaDatos}
          onChange={(e) => set("aceptaDatos", e.target.checked)} />
        <span>
          Autorizo a <b>{barberia.nombre}</b> a guardar mi nombre y teléfono para gestionar
          esta reserva. Puedo pedir que los eliminen cuando quiera.
        </span>
      </label>

      {error && <div className="login-error" style={{ marginTop: 16 }}>{error}</div>}

      <button className="bigbtn" disabled={!valido || enviando} onClick={confirmar}>
        {enviando ? "Reservando…" : "✓ Confirmar reserva"}
      </button>
    </div>
  );
}
