import { verificarAdmin, claveTemporal, jsonError, anotarActividad } from "@/lib/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restablecer la clave de un miembro del equipo.
 *
 * Para el caso real: el barbero olvidó su contraseña un sábado a media mañana.
 * El administrador genera una temporal y se la dicta; al entrar, la app obliga
 * a cambiarla otra vez.
 */
export async function POST(request) {
  try {
    const { admin, perfil, error, estado } = await verificarAdmin(request);
    if (error) return jsonError(error, estado);

    let cuerpo;
    try { cuerpo = await request.json(); } catch { return jsonError("Petición inválida."); }

    const id = String(cuerpo.id || "");
    if (!id) return jsonError("Falta indicar a quién.");

    /* Solo puede tocar cuentas de su propia barbería */
    const { data: objetivo, error: errBuscar } = await admin
      .from("perfiles")
      .select("id, nombre, barberia_id")
      .eq("id", id)
      .maybeSingle();

    if (errBuscar) return jsonError("No se pudo buscar esa cuenta: " + errBuscar.message, 500);
    if (!objetivo) return jsonError("No se encontró esa persona.", 404);
    if (objetivo.barberia_id !== perfil.barberia_id)
      return jsonError("Esa cuenta no pertenece a tu barbería.", 403);

    const clave = claveTemporal();

    const { error: errClave } = await admin.auth.admin.updateUserById(id, { password: clave });
    if (errClave) return jsonError("No se pudo restablecer: " + errClave.message, 500);

    const { error: errMarca } = await admin
      .from("perfiles")
      .update({ debe_cambiar_clave: true })
      .eq("id", id);
    if (errMarca) return jsonError("Clave cambiada, pero no se marcó el cambio obligatorio.", 500);

    await anotarActividad(admin, perfil, "restablecer_clave", "perfiles", id);

    return Response.json({ ok: true, nombre: objetivo.nombre, clave });
  } catch (e) {
    return jsonError("Error inesperado en el servidor: " + (e?.message || e), 500);
  }
}
