"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSesion } from "@/lib/sesion";
import { supabase, mensajeError } from "@/lib/supabase";
import { Scissors } from "@/components/Icons";

const MINIMO = 8;

export default function CambiarClave() {
  const ses = useSesion();
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!ses) return null;
  if (!ses.haySupabase) return null;

  const obligatorio = ses.perfil?.debe_cambiar_clave;
  const corta = clave.length > 0 && clave.length < MINIMO;
  const distintas = repetir.length > 0 && clave !== repetir;
  const valida = clave.length >= MINIMO && clave === repetir;

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);

    const { error: err } = await supabase.auth.updateUser({ password: clave });
    if (err) { setError(mensajeError(err)); setEnviando(false); return; }

    const { error: errRpc } = await supabase.rpc("marcar_clave_cambiada");
    if (errRpc) { setError("La clave cambió, pero hubo un problema al guardar. Vuelve a entrar."); }

    await ses.recargarPerfil?.();
    setEnviando(false);
    router.replace("/");
  };

  return (
    <div className="login-pantalla">
      <form className="login-caja" onSubmit={enviar}>
        <div className="login-marca">
          <div className="brand-icon"><Scissors /></div>
          <div>
            <h1>{obligatorio ? "Define tu clave" : "Cambiar clave"}</h1>
            <p>{obligatorio ? "Antes de entrar, elige una contraseña propia" : "Elige una contraseña nueva"}</p>
          </div>
        </div>

        {obligatorio && (
          <div className="aviso" style={{ marginBottom: 20 }}>
            Estás usando una clave temporal que te entregó el administrador.
            Elige una que solo tú conozcas.
          </div>
        )}

        <div className="field">
          <label>Nueva contraseña</label>
          <input type="password" autoComplete="new-password" required autoFocus
            value={clave} onChange={(e) => setClave(e.target.value)} />
          <p className="muted" style={{ marginTop: 7, fontSize: 12.5 }}>
            Mínimo {MINIMO} caracteres. No uses la que te dictaron.
          </p>
        </div>

        <div className="field">
          <label>Repetir contraseña</label>
          <input type="password" autoComplete="new-password" required
            value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </div>

        {corta && <div className="login-error">La contraseña debe tener al menos {MINIMO} caracteres.</div>}
        {distintas && <div className="login-error">Las dos contraseñas no coinciden.</div>}
        {error && <div className="login-error">{error}</div>}

        <button className="bigbtn" type="submit" disabled={!valida || enviando}>
          {enviando ? "Guardando…" : "Guardar y entrar"}
        </button>

        {!obligatorio && (
          <button type="button" className="btn" style={{ width: "100%", marginTop: 12 }}
            onClick={() => router.back()}>Cancelar</button>
        )}
      </form>
    </div>
  );
}
