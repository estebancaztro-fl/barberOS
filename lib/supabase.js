import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el navegador.
 *
 * Usa la clave pública —"Publishable key" (sb_publishable_…) en los proyectos
 * nuevos, "anon" en los antiguos—. Es segura de exponer: por sí sola no da
 * acceso a nada. Quien decide qué ve cada usuario son las políticas RLS de la
 * base, no esta clave.
 *
 * Las claves secretas (sb_secret_… o service_role) NUNCA van acá:
 * se saltan todas las políticas de seguridad.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

/* Acepta el nombre nuevo y el antiguo, para no depender de cuál copiaste */
const clave =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* Red de seguridad: si por error se pega una clave secreta, no se usa */
const esSecreta = typeof clave === "string" && clave.startsWith("sb_secret_");
if (esSecreta && typeof window !== "undefined") {
  console.error(
    "BarberOS: se configuró una clave SECRETA en el navegador. " +
    "Reemplázala por la Publishable key. La conexión queda deshabilitada."
  );
}

/** ¿Está configurada la conexión? Permite que la app siga usable sin ella. */
export const haySupabase = Boolean(url && clave && !esSecreta);

export const supabase = haySupabase
  ? createClient(url, clave, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Traduce los errores de Supabase a mensajes que un barbero entienda */
export function mensajeError(error) {
  if (!error) return "";
  const m = (error.message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Tu correo aún no está confirmado.";
  if (m.includes("too many requests") || m.includes("rate limit"))
    return "Demasiados intentos seguidos. Espera un momento.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Sin conexión. Revisa tu internet.";
  return error.message || "Ocurrió un error inesperado.";
}
