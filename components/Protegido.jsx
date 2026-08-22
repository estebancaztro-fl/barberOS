"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSesion } from "@/lib/sesion";

/* Rutas que se pueden abrir sin haber iniciado sesión */
const ABIERTAS = ["/login", "/registro", "/b/"];
const esAbierta = (ruta) => ABIERTAS.some((r) => ruta === r || ruta.startsWith(r));

/**
 * Manda al login a quien no tenga sesión.
 *
 * Esto es comodidad, no seguridad: la protección real está en las políticas
 * de la base. Aunque alguien saltara esta pantalla, no obtendría ni una fila.
 */
export default function Protegido({ children }) {
  const ses = useSesion();
  const ruta = usePathname();
  const router = useRouter();
  const abierta = esAbierta(ruta || "");

  const enCambioClave = ruta === "/cambiar-clave";
  const enBienvenida = ruta === "/bienvenida";

  /* La portada hace de dos cosas: landing para quien llega de la calle,
     dashboard para quien ya tiene cuenta. Por eso no se manda al login;
     la propia página decide qué mostrar. */
  const esPortada = ruta === "/";

  useEffect(() => {
    if (!ses || ses.cargando || abierta) return;
    if (!ses.haySupabase) return;          // sin conexión configurada, no redirige
    if (!ses.autenticado) { if (!esPortada) router.replace("/login"); return; }
    /* Con clave temporal no se entra a ninguna pantalla hasta cambiarla */
    if (ses.debeCambiarClave && !enCambioClave) { router.replace("/cambiar-clave"); return; }
    /* Barbería recién creada: primero el asistente de configuración */
    if (!ses.debeCambiarClave && ses.debeConfigurar && !enBienvenida) router.replace("/bienvenida");
  }, [ses, ses?.cargando, ses?.autenticado, ses?.debeCambiarClave, ses?.debeConfigurar,
      abierta, esPortada, enCambioClave, enBienvenida, router]);

  if (!ses) return null;
  if (abierta) return children;
  if (!ses.haySupabase) return children;   // modo local para seguir probando

  if (ses.cargando) {
    return (
      <div className="login-pantalla">
        <div className="spinner" />
      </div>
    );
  }

  if (!ses.autenticado) {
    /* Si hay sesión pero sin perfil válido, se explica en vez de dar vueltas */
    if (ses.usuario && ses.error) {
      return (
        <div className="login-pantalla">
          <div className="login-caja">
            <div className="login-error">{ses.error}</div>
            <button className="btn" style={{ width: "100%", marginTop: 16 }} onClick={ses.salir}>
              Cerrar sesión
            </button>
          </div>
        </div>
      );
    }
    if (esPortada) return children;   // muestra la landing
    return null;                      // redirigiendo al login
  }

  if (ses.debeCambiarClave && !enCambioClave) return null;              // redirigiendo
  if (ses.debeConfigurar && !enBienvenida && !enCambioClave) return null;

  return children;
}
