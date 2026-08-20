"use client";
import { useState, useEffect } from "react";
import Modal, { Toggle } from "@/components/Modal";
import { useApp, uid, hoyISO, DIAS_SEMANA, horarioDe } from "@/lib/store";
import { guardarHorarios, crearBloqueo, borrarBloqueo } from "@/lib/datos";
import { Plus, Trash, Save, Clock } from "@/components/Icons";

const fechaLarga = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

/**
 * Horario semanal de cada sucursal y bloqueos puntuales.
 *
 * Lo que se guarda acá es lo que la página pública ofrece: la base calcula
 * la disponibilidad con estas mismas tablas, así que no hay forma de que
 * la agenda y el link de reservas digan cosas distintas.
 */
export default function Horarios() {
  const app = useApp();
  const [sucId, setSucId] = useState("");
  const [dias, setDias] = useState([]);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);

  const sucursales = app?.sucursales || [];
  const activa = sucId || sucursales[0]?.id || "";

  /* Al cambiar de sucursal se recargan sus 7 días */
  useEffect(() => {
    if (!activa) return;
    setDias(horarioDe(app.horarios, activa));
    setSucio(false);
  }, [activa, app?.horarios]);

  if (!app) return null;
  const { horarios, bloqueos, barberos, barberia, conSesion, recargar, update } = app;

  const cambiar = (dia, campo, valor) => {
    setDias((prev) => prev.map((d) => (d.dia === dia ? { ...d, [campo]: valor } : d)));
    setSucio(true);
    setMsg("");
  };

  /* Un día abierto con cierre antes o igual a la apertura no tiene horas */
  const invalidos = dias.filter((d) => d.abierto && d.hasta <= d.desde);

  const guardar = async () => {
    if (invalidos.length) {
      setError("Revisa los días marcados: la hora de cierre tiene que ser posterior a la de apertura.");
      return;
    }
    setError("");
    setGuardando(true);

    if (conSesion) {
      const r = await guardarHorarios(barberia.id, activa, dias);
      setGuardando(false);
      if (r.error) { setError(r.error); return; }
      await recargar("horarios");
    } else {
      update((d) => {
        d.horarios = (d.horarios || []).filter((h) => h.sucursalId !== activa)
          .concat(dias.map((x) => ({ id: uid(), sucursalId: activa, ...x })));
        return d;
      });
      setGuardando(false);
    }
    setSucio(false);
    setMsg("Horario guardado");
    setTimeout(() => setMsg(""), 3000);
  };

  const agregarBloqueo = async (b) => {
    if (conSesion) {
      const r = await crearBloqueo(barberia.id, b);
      if (r.error) { setError(r.error); return; }
      await recargar("bloqueos");
    } else {
      update((d) => { d.bloqueos = [...(d.bloqueos || []), { id: uid(), ...b }]; return d; });
    }
    setError("");
    setModal(false);
  };

  const quitarBloqueo = async (id) => {
    if (conSesion) {
      const r = await borrarBloqueo(id);
      if (r.error) { setError(r.error); return; }
      await recargar("bloqueos");
    } else {
      update((d) => { d.bloqueos = (d.bloqueos || []).filter((x) => x.id !== id); return d; });
    }
  };

  const futuros = [...(bloqueos || [])]
    .filter((b) => b.fecha >= hoyISO())
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const nombreSuc = (id) => sucursales.find((s) => s.id === id)?.nombre || "Todas las sucursales";
  const nombreBarbero = (id) => barberos.find((b) => b.id === id)?.nombre || "Todo el equipo";

  return (
    <>
      {sucursales.length > 1 && (
        <div className="chips" style={{ marginBottom: 18 }}>
          {sucursales.map((s) => (
            <button key={s.id} className={"chip" + (activa === s.id ? " on" : "")}
              onClick={() => setSucId(s.id)}>{s.nombre}</button>
          ))}
        </div>
      )}

      <div className="card" style={{ maxWidth: 720, padding: 26 }}>
        <h3 style={{ margin: "0 0 6px" }}>Horario de atención</h3>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6 }}>
          Solo se ofrecen horas dentro de este rango. Un día cerrado desaparece
          del link de reservas.
        </p>

        <div className="stack">
          {dias.map((d) => {
            const malo = d.abierto && d.hasta <= d.desde;
            return (
              <div className="rowline" key={d.dia}
                style={{ opacity: d.abierto ? 1 : 0.55, flexWrap: "wrap", gap: 10 }}>
                <div className="grow" style={{ minWidth: 110 }}>
                  <h4 style={{ margin: 0 }}>{DIAS_SEMANA[d.dia]}</h4>
                  {!d.abierto && <div className="mut">Cerrado</div>}
                </div>
                {d.abierto && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="time" value={d.desde} step="1800"
                      style={{ width: 118, borderColor: malo ? "var(--red)" : undefined }}
                      onChange={(e) => cambiar(d.dia, "desde", e.target.value)} />
                    <span className="muted">a</span>
                    <input type="time" value={d.hasta} step="1800"
                      style={{ width: 118, borderColor: malo ? "var(--red)" : undefined }}
                      onChange={(e) => cambiar(d.dia, "hasta", e.target.value)} />
                  </div>
                )}
                <Toggle on={d.abierto} onChange={(v) => cambiar(d.dia, "abierto", v)} />
              </div>
            );
          })}
        </div>

        {error && <div className="login-error" style={{ marginTop: 16 }}>{error}</div>}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
          <button className="btn dark" disabled={!sucio || guardando} onClick={guardar}>
            <Save /> {guardando ? "Guardando…" : "Guardar horario"}
          </button>
          {msg && <span className="muted" style={{ color: "var(--green)" }}>✓ {msg}</span>}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720, padding: 26, marginTop: 20 }}>
        <div className="toolbar" style={{ marginTop: 0 }}>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>Días y horas bloqueadas</h3>
            <span className="muted" style={{ fontSize: 13.5 }}>
              Feriados, vacaciones o una tarde libre
            </span>
          </div>
          <button className="btn dark" onClick={() => setModal(true)}><Plus /> Bloquear</button>
        </div>

        {futuros.length === 0 && (
          <div className="empty" style={{ marginTop: 6 }}>No hay bloqueos próximos.</div>
        )}

        <div className="stack">
          {futuros.map((b) => (
            <div className="rowline" key={b.id}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "#17171a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Clock style={{ width: 20, height: 20 }} />
              </div>
              <div className="grow">
                <h4 style={{ textTransform: "capitalize" }} suppressHydrationWarning>
                  {fechaLarga(b.fecha)}
                </h4>
                <div className="mut">
                  <span>{b.desde ? `${b.desde} a ${b.hasta}` : "Todo el día"}</span>
                  <span>{nombreSuc(b.sucursalId)}</span>
                  {b.barberoId && <span>{nombreBarbero(b.barberoId)}</span>}
                  {b.motivo && <span>{b.motivo}</span>}
                </div>
              </div>
              <button className="icon-btn red" onClick={() => quitarBloqueo(b.id)}><Trash /></button>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <NuevoBloqueo
          sucursales={sucursales} barberos={barberos}
          onClose={() => setModal(false)} onSave={agregarBloqueo}
        />
      )}
    </>
  );
}

function NuevoBloqueo({ sucursales, barberos, onClose, onSave }) {
  const [f, setF] = useState({
    fecha: hoyISO(), todoElDia: true, desde: "13:00", hasta: "15:00",
    sucursalId: "", barberoId: "", motivo: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const rangoMalo = !f.todoElDia && f.hasta <= f.desde;

  return (
    <Modal
      title="Bloquear horario" onClose={onClose}
      footer={
        <>
          <button className="link-btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={!f.fecha || rangoMalo}
            onClick={() => onSave({
              fecha: f.fecha,
              desde: f.todoElDia ? null : f.desde,
              hasta: f.todoElDia ? null : f.hasta,
              sucursalId: f.sucursalId || null,
              barberoId: f.barberoId || null,
              motivo: f.motivo.trim() || null,
            })}>
            Bloquear
          </button>
        </>
      }
    >
      <div className="field">
        <label>Fecha</label>
        <input type="date" min={hoyISO()} value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
      </div>

      <div className="rowline" style={{ padding: "4px 0" }}>
        <div className="grow"><h4 style={{ margin: 0 }}>Todo el día</h4></div>
        <Toggle on={f.todoElDia} onChange={(v) => set("todoElDia", v)} />
      </div>

      {!f.todoElDia && (
        <div className="grid2">
          <div className="field"><label>Desde</label>
            <input type="time" step="1800" value={f.desde} onChange={(e) => set("desde", e.target.value)} /></div>
          <div className="field"><label>Hasta</label>
            <input type="time" step="1800" value={f.hasta} onChange={(e) => set("hasta", e.target.value)} /></div>
        </div>
      )}
      {rangoMalo && (
        <p className="muted" style={{ color: "var(--red)", fontSize: 13, marginTop: -8 }}>
          La hora de término tiene que ser posterior a la de inicio.
        </p>
      )}

      <div className="grid2">
        {sucursales.length > 1 && (
          <div className="field">
            <label>Sucursal</label>
            <select value={f.sucursalId} onChange={(e) => set("sucursalId", e.target.value)}>
              <option value="">Todas</option>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label>¿A quién afecta?</label>
          <select value={f.barberoId} onChange={(e) => set("barberoId", e.target.value)}>
            <option value="">A toda la barbería</option>
            {barberos.map((b) => <option key={b.id} value={b.id}>Solo {b.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Motivo (opcional)</label>
        <input placeholder="Feriado, vacaciones, capacitación…" value={f.motivo}
          onChange={(e) => set("motivo", e.target.value)} />
      </div>
    </Modal>
  );
}
