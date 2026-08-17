"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSesion } from "@/lib/sesion";
import { mensajeError } from "@/lib/supabase";
import { Scissors } from "@/components/Icons";

export default function Login() {
  const ses = useSesion();
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (ses?.autenticado) router.replace("/");
  }, [ses?.autenticado, router]);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const err = await ses.entrar(correo, clave);
    setEnviando(false);
    if (err) setError(mensajeError(err));
  };

  if (!ses) return null;

  if (!ses.haySupabase) {
    return (
      <div className="login-pantalla">
        <div className="login-caja">
          <div className="aviso">
            Falta configurar la conexión con la base de datos. Revisa las variables
            <b> NEXT_PUBLIC_SUPABASE_URL</b> y <b> NEXT_PUBLIC_SUPABASE_ANON_KEY</b>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-pantalla">
      <form className="login-caja" onSubmit={enviar}>
        <div className="login-marca">
          <div className="brand-icon"><Scissors /></div>
          <div>
            <h1>BarberOS</h1>
            <p>Entra con tu cuenta</p>
          </div>
        </div>

        <div className="field">
          <label>Correo</label>
          <input type="email" autoComplete="email" required autoFocus
            value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.cl" />
        </div>

        <div className="field">
          <label>Contraseña</label>
          <input type="password" autoComplete="current-password" required
            value={clave} onChange={(e) => setClave(e.target.value)} />
        </div>

        {error && <div className="login-error">{error}</div>}
        {ses.error && !error && <div className="login-error">{ses.error}</div>}

        <button className="bigbtn" type="submit" disabled={enviando || !correo || !clave}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>

        <p className="muted" style={{ marginTop: 18, textAlign: "center", fontSize: 13 }}>
          ¿Olvidaste tu contraseña? Pídele al administrador de tu barbería que te la restablezca.
        </p>
      </form>
    </div>
  );
}
