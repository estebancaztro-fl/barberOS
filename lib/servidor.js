import { createClient } from "@supabase/supabase-js";
import { randomInt } from "crypto";

/**
 * Utilidades que corren SOLO en el servidor.
 *
 * Acá vive la clave secreta de Supabase, que se salta todas las políticas de
 * seguridad. Este archivo nunca debe importarse desde un componente con
 * "use client": si eso pasara, la clave viajaría al navegador.
 *
 * La variable se llama SUPABASE_SECRET_KEY a propósito, sin el prefijo
 * NEXT_PUBLIC_, para que Next se niegue a incluirla en el paquete del cliente.
 */

export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secreta) return null;
  return createClient(url, secreta, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Comprueba que quien llama sea administrador activo de una barbería.
 * Devuelve { admin, perfil } o { error }.
 *
 * No basta con que la app diga "soy admin": se verifica el token contra
 * Supabase y se lee el rol desde la base.
 */
export async function verificarAdmin(request) {
  const admin = clienteAdmin();
  if (!admin) return { error: "El servidor no tiene configurada la clave secreta.", estado: 500 };

  const cabecera = request.headers.get("authorization") || "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : null;
  if (!token) return { error: "Sin sesión.", estado: 401 };

  const { data: sesion, error: errSesion } = await admin.auth.getUser(token);
  if (errSesion || !sesion?.user) return { error: "Tu sesión no es válida.", estado: 401 };

  const { data: perfil, error: errPerfil } = await admin
    .from("perfiles")
    .select("id, rol, barberia_id, activo")
    .eq("id", sesion.user.id)
    .maybeSingle();

  /* Distinguir "no existe el perfil" de "el servidor no puede leer la tabla".
     El segundo caso suele ser falta de permisos para service_role. */
  if (errPerfil) {
    const m = (errPerfil.message || "").toLowerCase();
    if (m.includes("permission denied")) {
      return {
        error: "El servidor no tiene permiso para leer la base. Ejecuta la migración 007_permisos_servidor.sql.",
        estado: 500,
      };
    }
    return { error: "No se pudo verificar tu cuenta: " + errPerfil.message, estado: 500 };
  }

  if (!perfil) return { error: "No tienes perfil en ninguna barbería.", estado: 403 };
  if (!perfil.activo) return { error: "Tu cuenta está desactivada.", estado: 403 };
  if (perfil.rol !== "admin") return { error: "Solo el administrador puede hacer esto.", estado: 403 };

  return { admin, perfil };
}

/* Palabras fáciles de dictar por teléfono, sin tildes ni letras confusas */
const PALABRAS = [
  "tijera", "corte", "barba", "peine", "navaja", "espejo", "silla", "toalla",
  "cera", "gel", "brocha", "maquina", "estilo", "fade", "clasico", "textura",
];

/**
 * Clave temporal legible: dos palabras y cuatro dígitos.
 * Pensada para dictarla en persona o por WhatsApp. Solo sirve una vez:
 * la app obliga a cambiarla al primer ingreso.
 */
export function claveTemporal() {
  const a = PALABRAS[randomInt(PALABRAS.length)];
  let b = PALABRAS[randomInt(PALABRAS.length)];
  while (b === a) b = PALABRAS[randomInt(PALABRAS.length)];
  const n = String(randomInt(1000, 10000));
  return `${a}-${b}-${n}`;
}

export const jsonError = (mensaje, estado = 400) =>
  Response.json({ error: mensaje }, { status: estado });

/**
 * Deja rastro de las acciones sensibles en el registro de actividad.
 *
 * Se inserta directo en la tabla en vez de llamar a registrar_actividad():
 * esa función deduce el autor con auth.uid(), que desde el servidor viene
 * vacío. Acá el autor y la barbería se pasan explícitos.
 *
 * Nunca hace fallar la operación principal: si el registro falla, se ignora.
 */
export async function anotarActividad(admin, perfil, accion, entidad, entidadId) {
  try {
    await admin.from("registro_actividad").insert({
      barberia_id: perfil.barberia_id,
      actor_id: perfil.id,
      accion, entidad, entidad_id: entidadId,
    });
  } catch {
    /* el registro es deseable, no crítico */
  }
}
