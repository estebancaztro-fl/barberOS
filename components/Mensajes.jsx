"use client";
import { useState, useEffect } from "react";
import { Toggle } from "@/components/Modal";
import { useApp, fmt } from "@/lib/store";
import { guardarBarberia } from "@/lib/datos";
import { armarTexto, VARIABLES, PLANTILLA_RECORDATORIO } from "@/lib/mensajes";
import { pedirPermisoAvisos, estadoAvisos } from "@/components/Recordatorios";
import { Save, Chat, Clock } from "@/components/Icons";

const MINUTOS = [10, 15, 25, 30, 60, 120];

/**
 * Ajustes de los mensajes al cliente: el recordatorio antes de la cita y el
 * estado de la conexión con WhatsApp.
 */
export default function Mensajes() {
  const app = useApp();
  const [activo, setActivo] = useState(true);
  const [minutos, setMinutos] = useState(25);
  const [plantilla, setPlantilla] = useState(PLANTILLA_RECORDATORIO);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [permiso, setPermiso] = useState("default");

  const barberia = app?.barberia;

  useEffect(() => {
    if (!barberia) return;
    setActivo(barberia.recordatorioActivo !== false);
    setMinutos(barberia.recordatorioMinutos || 25);
    setPlantilla(barberia.recordatorioPlantilla || PLANTILLA_RECORDATORIO);
    setSucio(false);
  }, [barberia?.recordatorioActivo, barberia?.recordatorioMinutos, barberia?.recordatorioPlantilla, barberia]);

  useEffect(() => { setPermiso(estadoAvisos()); }, []);

  if (!app) return null;
  const { conSesion, update, sesion } = app;

  const cambiar = (fn) => { fn(); setSucio(true); setMsg(""); };

  const guardar = async () => {
    setError("");
    setGuardando(true);
    if (conSesion) {
      const r = await guardarBarberia(barberia.id, {
        recordatorio_activo: activo,
        recordatorio_minutos: minutos,
        recordatorio_plantilla: plantilla.trim() || null,
      });
      setGuardando(false);
      if (r.error) { setError(r.error); return; }
      await sesion?.recargarPerfil?.();
    } else {
      update((d) => {
        d.barberia.recordatorioActivo = activo;
        d.barberia.recordatorioMinutos = minutos;
        d.barberia.recordatorioPlantilla = plantilla;
        return d;
      });
      setGuardando(false);
    }
    setSucio(false);
    setMsg("Ajustes guardados");
    setTimeout(() => setMsg(""), 3000);
  };

  const activarAvisos = async () => {
    const r = await pedirPermisoAvisos();
    setPermiso(estadoAvisos());
    if (r.error) setError(r.error); else setError("");
  };

  /* Vista previa con datos de ejemplo: es la única forma de que el barbero
     entienda qué hacen las variables sin tener que probar con un cliente. */
  const ejemplo = armarTexto(plantilla, {
    cliente: "Matías Cifuentes",
    barberia: barberia?.nombre || "tu barbería",
    hora: "15:30",
    fecha: "hoy",
    servicio: "Corte clásico",
    barbero: "Apolo",
  });

  return (
    <>
      {/* ---------- Recordatorio ---------- */}
      <div className="card" style={{ maxWidth: 720, padding: 26 }}>
        <div className="rowline" style={{ padding: 0, marginBottom: 18 }}>
          <div className="grow">
            <h3 style={{ margin: 0 }}>Recordatorio antes de la cita</h3>
            <div className="mut" style={{ marginTop: 3 }}>
              Te avisa para que le confirmes al cliente por WhatsApp
            </div>
          </div>
          <Toggle on={activo} onChange={(v) => cambiar(() => setActivo(v))} />
        </div>

        {activo && (
          <>
            <div className="field">
              <label>Cuánto antes avisarte</label>
              <select value={minutos} onChange={(e) => cambiar(() => setMinutos(Number(e.target.value)))}>
                {MINUTOS.map((m) => (
                  <option key={m} value={m}>{m >= 60 ? `${m / 60} hora${m > 60 ? "s" : ""}` : `${m} minutos`} antes</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Mensaje</label>
              <textarea rows={4} value={plantilla}
                onChange={(e) => cambiar(() => setPlantilla(e.target.value))} />
              <div className="chips" style={{ marginTop: 10 }}>
                {VARIABLES.map(([v, ayuda]) => (
                  <button key={v} className="chip" title={ayuda}
                    onClick={() => cambiar(() => setPlantilla((p) => p + " " + v))}>{v}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Así lo va a recibir</label>
              <div className="burbuja">{ejemplo}</div>
            </div>
          </>
        )}

        {error && <div className="login-error" style={{ marginTop: 14 }}>{error}</div>}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
          <button className="btn dark" disabled={!sucio || guardando} onClick={guardar}>
            <Save /> {guardando ? "Guardando…" : "Guardar"}
          </button>
          {msg && <span className="muted" style={{ color: "var(--green)" }}>✓ {msg}</span>}
        </div>
      </div>

      {/* ---------- Permiso de avisos ---------- */}
      <div className="card" style={{ maxWidth: 720, padding: 26, marginTop: 20 }}>
        <div className="rowline" style={{ padding: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "#17171a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Clock style={{ width: 20, height: 20 }} />
          </div>
          <div className="grow">
            <h4 style={{ margin: 0 }}>Avisos en este dispositivo</h4>
            <div className="mut">
              {permiso === "granted" ? "Activados en este teléfono"
                : permiso === "denied" ? "Bloqueados: actívalos en los ajustes del navegador"
                : permiso === "no-disponible" ? "Este navegador no los permite"
                : "Sin activar"}
            </div>
          </div>
          {permiso !== "granted" && permiso !== "no-disponible" && (
            <button className="btn dark" onClick={activarAvisos}>Activar</button>
          )}
        </div>
        <p className="muted" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
          El aviso llega mientras tienes BarberOS abierto en el teléfono. Con la
          app cerrada el navegador no ejecuta nada, así que sirve durante la
          jornada, no de madrugada. Hay que activarlo en cada dispositivo.
        </p>
      </div>

      {/* ---------- WhatsApp ---------- */}
      <div className="card" style={{ maxWidth: 720, padding: 26, marginTop: 20 }}>
        <div className="rowline" style={{ padding: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "#25D366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Chat style={{ width: 20, height: 20 }} />
          </div>
          <div className="grow">
            <h4 style={{ margin: 0 }}>WhatsApp</h4>
            <div className="mut">
              {barberia?.whatsappModo === "api"
                ? "Conectado: los mensajes salen solos"
                : "Envío desde tu teléfono"}
            </div>
          </div>
          <span className="badge grey">
            {barberia?.whatsappModo === "api" ? "Automático" : "Manual"}
          </span>
        </div>

        <p className="muted" style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.7 }}>
          Hoy BarberOS te abre WhatsApp con el mensaje ya escrito y tú aprietas
          enviar. Sale de tu número, que es el que tus clientes reconocen, y no
          tiene costo por mensaje.
        </p>
        <p className="muted" style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.7 }}>
          Para que salgan <b>solos</b>, WhatsApp exige conectar la Cloud API de
          Meta: verificación del negocio, un número dedicado y plantillas
          aprobadas por Meta. Ese número deja de funcionar en la app WhatsApp
          Business del celular, así que conviene usar uno aparte. Estamos
          trabajando en que se conecte con un botón.
        </p>
      </div>
    </>
  );
}
