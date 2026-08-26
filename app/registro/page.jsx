"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSesion } from "@/lib/sesion";
import { mensajeError } from "@/lib/supabase";
import { aSlug } from "@/lib/texto";
import { PLAN } from "@/lib/planes";
import { Scissors } from "@/components/Icons";

export default function Registro() {
  const ses = useSesion();
  const router = useRouter();
  const [f, setF] = useState({
    nombre: "", barberia: "", correo: "", telefono: "", clave: "",
    aceptaTerminos: false, web: "",
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (ses?.autenticado) router.replace("/");
  }, [ses?.autenticado, router]);

  if (!ses) return null;

  if (!ses.haySupabase) {
    return (
      <div className="login-pantalla">
        <div className="login-caja">
          <div className="aviso">
            Falta configurar la conexión con la base de datos.
          </div>
        </div>
      </div>
    );
  }

  const claveCorta = f.clave.length > 0 && f.clave.length < 8;
  const valido = f.nombre.trim().length >= 2 && f.barberia.trim().length >= 2
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo) && f.clave.length >= 8 && f.aceptaTerminos;

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);

    let res, json;
    try {
      res = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      json = await res.json().catch(() => ({}));
    } catch {
      setEnviando(false);
      setError("Sin conexión con el servidor. Revisa tu internet.");
      return;
    }

    if (!res.ok) {
      setEnviando(false);
      setError(json.error || `Error ${res.status} al registrar.`);
      return;
    }

    /* Queda dentro de inmediato, sin esperar ningún correo */
    const err = await ses.entrar(f.correo, f.clave);
    setEnviando(false);
    if (err) { setError(mensajeError(err)); return; }
    router.replace("/bienvenida");
  };

  return (
    <div className="login-pantalla">
      <form className="login-caja" onSubmit={enviar} style={{ maxWidth: 480 }}>
        <div className="login-marca">
          <div className="brand-icon"><Scissors /></div>
          <div>
            <h1>Crea tu barbería</h1>
            <p>{PLAN.diasDePrueba} días de prueba gratis, sin tarjeta</p>
          </div>
        </div>

        <div className="field">
          <label>Nombre de tu barbería</label>
          {/* El ejemplo es un nombre inventado a propósito: usar el de una
              barbería que existe de verdad se presta para confusiones */}
          <input required autoFocus value={f.barberia}
            onChange={(e) => set("barberia", e.target.value)} placeholder="Barbería Los Andes" />
          {f.barberia.trim().length >= 2 && (
            <p className="muted" style={{ marginTop: 7, fontSize: 12.5 }}>
              Tu link de reservas será <b>/b/{aSlug(f.barberia)}</b>
            </p>
          )}
        </div>

        <div className="grid2">
          <div className="field">
            <label>Tu nombre</label>
            <input required value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div className="field">
            <label>Teléfono</label>
            <input value={f.telefono} onChange={(e) => set("telefono", e.target.value)}
              placeholder="+56 9 0000 0000" />
          </div>
        </div>

        <div className="field">
          <label>Correo</label>
          <input type="email" required autoComplete="email" value={f.correo}
            onChange={(e) => set("correo", e.target.value)} placeholder="tu@correo.cl" />
        </div>

        <div className="field">
          <label>Contraseña</label>
          <input type="password" required autoComplete="new-password" value={f.clave}
            onChange={(e) => set("clave", e.target.value)} />
          {claveCorta && <p className="muted" style={{ marginTop: 7, fontSize: 12.5, color: "var(--red)" }}>
            Mínimo 8 caracteres.
          </p>}
        </div>

        {/* Campo trampa contra registros automáticos: invisible para personas */}
        <input type="text" name="web" value={f.web} onChange={(e) => set("web", e.target.value)}
          tabIndex={-1} autoComplete="off" aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />

        <label className="consentimiento">
          <input type="checkbox" checked={f.aceptaTerminos}
            onChange={(e) => set("aceptaTerminos", e.target.checked)} />
          <span>
            Autorizo el tratamiento de mis datos para crear y administrar mi cuenta.
            Puedo pedir su eliminación cuando quiera.
          </span>
        </label>

        {error && <div className="login-error" style={{ marginTop: 16 }}>{error}</div>}

        <button className="bigbtn" type="submit" disabled={!valido || enviando}>
          {enviando ? "Creando tu barbería…" : "Crear mi barbería"}
        </button>

        <p className="muted" style={{ marginTop: 18, textAlign: "center", fontSize: 13.5 }}>
          ¿Ya tienes cuenta? <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Inicia sesión</Link>
        </p>
      </form>
    </div>
  );
}
