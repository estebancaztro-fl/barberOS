"use client";
import { useState } from "react";
import Modal, { Toggle } from "@/components/Modal";
import { supabase } from "@/lib/supabase";
import { Copy, Upload } from "@/components/Icons";

const ROLES = [["barbero", "Barbero"], ["recepcion", "Recepción"], ["admin", "Admin"]];

/** Llama a las rutas del servidor llevando el token de la sesión */
async function pedir(ruta, cuerpo) {
  let res;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return { error: "Tu sesión expiró. Vuelve a entrar." };

    res = await fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    return { error: "Sin conexión con el servidor. Revisa tu internet." };
  }

  /* Si el servidor devuelve algo que no es JSON, se muestra el motivo real
     en vez de un mensaje genérico que no ayuda a nadie. */
  const texto = await res.text().catch(() => "");
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch {}

  if (!res.ok) {
    if (json?.error) return { error: json.error };
    if (res.status === 404)
      return { error: "La ruta del servidor no existe. Falta desplegar la versión nueva." };
    if (res.status === 401 || res.status === 403)
      return { error: "No tienes permiso para hacer esto." };
    return { error: `Error ${res.status} en el servidor. ${texto.slice(0, 140)}` };
  }
  return json || {};
}

/* ---------- Crear cuenta ---------- */

export function CrearCuenta({ onClose, onCreado }) {
  const [f, setF] = useState({ nombre: "", correo: "", telefono: "", rol: "barbero", comision: 40 });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const crear = async () => {
    setError(""); setEnviando(true);
    const r = await pedir("/api/equipo", f);
    setEnviando(false);
    if (r.error) { setError(r.error); return; }
    setListo({ nombre: f.nombre, correo: f.correo, clave: r.clave });
    onCreado?.();
  };

  if (listo) return <ClaveEntregada info={listo} onClose={onClose} />;

  return (
    <Modal
      title="Nueva cuenta"
      sub="El barbero entra con su correo y la clave que le entregues"
      onClose={onClose}
      footer={
        <>
          <button className="link-btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={enviando || !f.nombre || !f.correo}
            onClick={crear}>{enviando ? "Creando…" : "Crear cuenta"}</button>
        </>
      }
    >
      <div className="field"><label>Nombre</label>
        <input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>

      <div className="grid2">
        <div className="field"><label>Correo</label>
          <input type="email" placeholder="barbero@correo.cl" value={f.correo}
            onChange={(e) => set("correo", e.target.value)} /></div>
        <div className="field"><label>Teléfono</label>
          <input placeholder="+56 9 0000 0000" value={f.telefono}
            onChange={(e) => set("telefono", e.target.value)} /></div>
      </div>

      <div className="rol-grid">
        <div className="field">
          <label>Rol asignado</label>
          <div className="chips">
            {ROLES.map(([v, l]) => (
              <button key={v} className={"chip" + (f.rol === v ? " on" : "")}
                onClick={() => set("rol", v)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label style={{ color: "var(--accent)" }}>Comisión (%)</label>
          <input type="number" value={f.comision}
            onChange={(e) => set("comision", Number(e.target.value))} />
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
        Se generará una clave temporal que verás una sola vez. Al primer ingreso,
        la persona está obligada a cambiarla por una propia.
      </p>
    </Modal>
  );
}

/* ---------- Mostrar la clave temporal ---------- */

function ClaveEntregada({ info, onClose }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `BarberOS\nCorreo: ${info.correo}\nClave temporal: ${info.clave}\n\nAl entrar te pedirá cambiarla.`;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch {}
  };

  return (
    <Modal
      title="Cuenta creada"
      sub={info.nombre}
      onClose={onClose}
      footer={<button className="btn dark" onClick={onClose}>Listo, ya la entregué</button>}
    >
      <div className="clave-caja">
        <small>CLAVE TEMPORAL</small>
        <b>{info.clave}</b>
        <span>{info.correo}</span>
      </div>

      <button className="btn glow" style={{ width: "100%", marginTop: 14 }} onClick={copiar}>
        <Copy /> {copiado ? "¡Copiado!" : "Copiar para enviar por WhatsApp"}
      </button>

      <div className="aviso" style={{ marginTop: 18 }}>
        Anótala o cópiala ahora: <b>no se puede volver a ver</b>. Si se pierde,
        se genera otra desde el botón de restablecer.
      </div>
    </Modal>
  );
}

/* ---------- Restablecer clave ---------- */

export function RestablecerClave({ miembro, onClose }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(null);

  const restablecer = async () => {
    setError(""); setEnviando(true);
    const r = await pedir("/api/equipo/clave", { id: miembro.id });
    setEnviando(false);
    if (r.error) { setError(r.error); return; }
    setListo({ nombre: miembro.nombre, correo: miembro.correo || "", clave: r.clave });
  };

  if (listo) return <ClaveEntregada info={listo} onClose={onClose} />;

  return (
    <Modal
      title="Restablecer clave"
      sub={miembro.nombre}
      onClose={onClose}
      footer={
        <>
          <button className="link-btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={enviando} onClick={restablecer}>
            {enviando ? "Generando…" : "Generar clave nueva"}
          </button>
        </>
      }
    >
      <p style={{ lineHeight: 1.6 }}>
        Se generará una clave temporal nueva para <b>{miembro.nombre}</b>.
        La anterior deja de funcionar de inmediato, y al entrar tendrá que
        definir una propia.
      </p>
      {error && <div className="login-error" style={{ marginTop: 16 }}>{error}</div>}
    </Modal>
  );
}
