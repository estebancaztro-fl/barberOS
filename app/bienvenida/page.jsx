"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp, fmt } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { guardarSucursal, guardarServicio, borrarServicio, guardarMiembro } from "@/lib/datos";
import { CrearCuenta } from "@/components/CuentaEquipo";
import { Scissors, Plus, Pencil, Trash, Copy, ChevronRight, Building, Users } from "@/components/Icons";

const PASOS = ["Tu sucursal", "Tus servicios", "Tu equipo"];

export default function Bienvenida() {
  const app = useApp();
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!app) return null;
  const { conSesion, rol, barberia, sucursales, servicios, equipo, recargar } = app;

  if (!conSesion) { router.replace("/login"); return null; }
  if (rol !== "admin") { router.replace("/"); return null; }

  const avisar = (m) => { setError(m); setTimeout(() => setError(""), 4000); };

  const terminar = async () => {
    setOcupado(true);
    const { error: err } = await supabase.rpc("terminar_onboarding");
    setOcupado(false);
    if (err) { avisar("No se pudo guardar. Inténtalo otra vez."); return; }
    await app.sesion?.recargarPerfil?.();
    router.replace("/");
  };

  return (
    <div className="bienvenida">
      <div className="bien-caja">
        <div className="bien-cab">
          <div className="brand-icon"><Scissors /></div>
          <div>
            <h1>{barberia?.nombre}</h1>
            <p>Dejemos tu barbería lista en tres pasos</p>
          </div>
        </div>

        <div className="bien-pasos">
          {PASOS.map((p, i) => (
            <div key={p} className={"bien-paso" + (i === paso ? " actual" : i < paso ? " hecho" : "")}>
              <span className="bien-num">{i < paso ? "✓" : i + 1}</span>
              <span>{p}</span>
            </div>
          ))}
        </div>

        {error && <div className="login-error">{error}</div>}

        {paso === 0 && (
          <PasoSucursal sucursal={sucursales[0]} barberiaId={barberia.id}
            onGuardar={async (s) => {
              const r = await guardarSucursal(barberia.id, s);
              if (r.error) return avisar(r.error);
              await recargar("sucursales");
              setPaso(1);
            }} />
        )}

        {paso === 1 && (
          <PasoServicios servicios={servicios} barberiaId={barberia.id}
            onCambio={() => recargar("servicios")} onError={avisar}
            onSeguir={() => setPaso(2)} onVolver={() => setPaso(0)} />
        )}

        {paso === 2 && (
          <PasoEquipo equipo={equipo} yo={app.yo} link={`${origin}/b/${barberia.slug}`}
            onCambio={() => recargar("equipo")} onError={avisar}
            onVolver={() => setPaso(1)} onTerminar={terminar} ocupado={ocupado} />
        )}
      </div>
    </div>
  );
}

/* ---------- Paso 1: sucursal ---------- */

function PasoSucursal({ sucursal, onGuardar }) {
  const [f, setF] = useState({
    id: sucursal?.id, nombre: sucursal?.nombre || "Sucursal principal",
    direccion: sucursal?.direccion || "", telefono: sucursal?.telefono || "", activa: true,
  });
  const [enviando, setEnviando] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <>
      <p className="bien-texto">
        Es la dirección que verán tus clientes al reservar. Si después abres otra,
        la agregas desde Admin.
      </p>

      <div className="field"><label>Nombre</label>
        <input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="field"><label>Dirección</label>
        <input value={f.direccion} onChange={(e) => set("direccion", e.target.value)}
          placeholder="Av. Providencia 1234" /></div>
      <div className="field"><label>Teléfono</label>
        <input value={f.telefono} onChange={(e) => set("telefono", e.target.value)}
          placeholder="+56 2 2345 6789" /></div>

      <button className="bigbtn" disabled={!f.nombre || enviando}
        onClick={async () => { setEnviando(true); await onGuardar(f); setEnviando(false); }}>
        {enviando ? "Guardando…" : "Continuar"}
      </button>
    </>
  );
}

/* ---------- Paso 2: servicios ---------- */

function PasoServicios({ servicios, barberiaId, onCambio, onError, onSeguir, onVolver }) {
  const [editando, setEditando] = useState(null);

  const guardar = async (s) => {
    const r = await guardarServicio(barberiaId, s);
    if (r.error) return onError(r.error);
    await onCambio();
    setEditando(null);
  };

  const borrar = async (id) => {
    const r = await borrarServicio(id);
    if (r.error) return onError(r.error);
    await onCambio();
  };

  return (
    <>
      <p className="bien-texto">
        Te dejamos cuatro servicios comunes. Ajusta los precios a los tuyos, borra
        los que no hagas y agrega los que falten.
      </p>

      <div className="listcard" style={{ marginBottom: 18 }}>
        {servicios.map((s) => (
          <div className="listrow" key={s.id}>
            <div className="grow">
              <h4>{s.nombre}</h4>
              <div className="mut">{s.duracion} min</div>
            </div>
            <b style={{ fontSize: 17, fontWeight: 600 }}>{fmt(s.precio)}</b>
            <button className="icon-btn" onClick={() => setEditando(s)}><Pencil /></button>
            <button className="icon-btn red" onClick={() => borrar(s.id)}><Trash /></button>
          </div>
        ))}
        {servicios.length === 0 && (
          <div style={{ padding: 26, textAlign: "center", color: "#9c9ca6", fontWeight: 600 }}>
            Sin servicios. Agrega al menos uno.
          </div>
        )}
      </div>

      <button className="btn" style={{ width: "100%" }}
        onClick={() => setEditando({ nombre: "", duracion: 30, precio: 0, activo: true })}>
        <Plus /> Agregar servicio
      </button>

      <div className="bien-botones">
        <button className="link-btn" onClick={onVolver}>Atrás</button>
        <button className="btn dark" disabled={servicios.length === 0} onClick={onSeguir}>
          Continuar <ChevronRight />
        </button>
      </div>

      {editando && <EditarServicio item={editando} onClose={() => setEditando(null)} onSave={guardar} />}
    </>
  );
}

function EditarServicio({ item, onClose, onSave }) {
  const [f, setF] = useState(item);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head"><h3>{item.id ? "Editar servicio" : "Nuevo servicio"}</h3></div>
        <div className="modal-body">
          <div className="field"><label>Nombre</label>
            <input autoFocus value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
          <div className="grid2">
            <div className="field"><label>Duración (min)</label>
              <input type="number" value={f.duracion} onChange={(e) => set("duracion", e.target.value)} /></div>
            <div className="field"><label>Precio</label>
              <input type="number" value={f.precio} onChange={(e) => set("precio", e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="link-btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={!f.nombre} onClick={() => onSave(f)}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Paso 3: equipo ---------- */

function PasoEquipo({ equipo, yo, link, onCambio, onError, onVolver, onTerminar, ocupado }) {
  const [creando, setCreando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const barberos = equipo.filter((e) => e.id !== yo?.id);
  const miPerfil = equipo.find((e) => e.id === yo?.id);
  const yoAtiendo = Boolean(miPerfil?.atiende);
  const atienden = equipo.filter((e) => e.atiende && e.activo).length;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch {}
  };

  const cambiarYoAtiendo = async (v) => {
    setGuardando(true);
    const r = await guardarMiembro(yo.id, { ...miPerfil, atiende: v });
    setGuardando(false);
    if (r.error) return onError(r.error);
    await onCambio();
  };

  return (
    <>
      <p className="bien-texto">
        Quien atiende aparece en tu link de reservas. Si trabajas solo, márcate a ti
        mismo y ya puedes recibir citas.
      </p>

      {/* El caso más común al partir: el dueño corta pelo */}
      <label className="consentimiento" style={{ marginBottom: 18 }}>
        <input type="checkbox" checked={yoAtiendo} disabled={guardando}
          onChange={(e) => cambiarYoAtiendo(e.target.checked)} />
        <span><b>Yo también atiendo clientes</b> — aparezco en el link de reservas.</span>
      </label>

      {barberos.length > 0 && (
        <div className="listcard" style={{ marginBottom: 18 }}>
          {barberos.map((b) => (
            <div className="listrow" key={b.id}>
              <div className="avatar">{b.nombre.charAt(0)}</div>
              <div className="grow">
                <h4>{b.nombre}</h4>
                <div className="mut">{b.correo}</div>
              </div>
              <span className="badge">{b.comision}%</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn" style={{ width: "100%" }} onClick={() => setCreando(true)}>
        <Users style={{ width: 17, height: 17 }} /> Agregar barbero
      </button>

      <div className="bien-link">
        <div className="grow">
          <b>Tu link de reservas</b>
          <span>{link}</span>
        </div>
        <button className="btn sm" onClick={copiar}><Copy /> {copiado ? "¡Copiado!" : "Copiar"}</button>
      </div>

      {atienden === 0 && (
        <div className="aviso" style={{ marginTop: 18 }}>
          Nadie atiende todavía, así que tu link de reservas no va a aceptar citas.
          Márcate a ti mismo o agrega un barbero.
        </div>
      )}

      <div className="bien-botones">
        <button className="link-btn" onClick={onVolver}>Atrás</button>
        <button className="btn dark" disabled={ocupado} onClick={onTerminar}>
          {ocupado ? "Guardando…" : "Entrar a mi barbería"}
        </button>
      </div>

      {creando && <CrearCuenta onClose={() => setCreando(false)} onCreado={onCambio} />}
    </>
  );
}
