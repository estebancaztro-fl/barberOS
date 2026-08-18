import { verificarAdmin, claveTemporal, jsonError } from "@/lib/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["admin", "recepcion", "barbero"];

/**
 * Crear la cuenta de un miembro del equipo.
 *
 * Solo el administrador de la barbería puede llamarla, y siempre queda
 * limitado a SU barbería: el barberia_id sale del perfil verificado del
 * llamador, nunca de lo que mande el navegador.
 */
export async function POST(request) {
  const { admin, perfil, error, estado } = await verificarAdmin(request);
  if (error) return jsonError(error, estado);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return jsonError("Petición inválida."); }

  const nombre = String(cuerpo.nombre || "").trim();
  const correo = String(cuerpo.correo || "").trim().toLowerCase();
  const telefono = String(cuerpo.telefono || "").trim();
  const rol = String(cuerpo.rol || "barbero");
  const comision = Number(cuerpo.comision ?? 0);

  if (nombre.length < 2) return jsonError("El nombre es obligatorio.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return jsonError("El correo no es válido.");
  if (!ROLES.includes(rol)) return jsonError("Rol no válido.");
  if (!Number.isFinite(comision) || comision < 0 || comision > 100)
    return jsonError("La comisión debe estar entre 0 y 100.");

  /* Tope razonable por barbería: frena la creación masiva si se filtrara una sesión */
  const { count } = await admin
    .from("perfiles")
    .select("id", { count: "exact", head: true })
    .eq("barberia_id", perfil.barberia_id);
  if ((count || 0) >= 50) return jsonError("Alcanzaste el máximo de cuentas para esta barbería.");

  const clave = claveTemporal();

  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,          // el dueño entrega la clave en persona
    user_metadata: { nombre },
  });

  if (errCrear) {
    const m = (errCrear.message || "").toLowerCase();
    if (m.includes("already been registered") || m.includes("already exists"))
      return jsonError("Ese correo ya tiene una cuenta.");
    return jsonError("No se pudo crear la cuenta: " + errCrear.message, 500);
  }

  const { error: errPerfil } = await admin.from("perfiles").insert({
    id: creado.user.id,
    barberia_id: perfil.barberia_id,     // siempre la del administrador
    nombre, correo,
    telefono: telefono || null,
    rol, comision,
    activo: true,
    debe_cambiar_clave: true,
  });

  if (errPerfil) {
    /* Si el perfil falla, se borra el usuario para no dejar cuentas huérfanas */
    await admin.auth.admin.deleteUser(creado.user.id);
    return jsonError("No se pudo crear el perfil: " + errPerfil.message, 500);
  }

  await admin.rpc("registrar_actividad", {
    p_accion: "crear_cuenta", p_entidad: "perfiles", p_id: creado.user.id,
  }).catch(() => {});

  return Response.json({ ok: true, id: creado.user.id, clave });
}
