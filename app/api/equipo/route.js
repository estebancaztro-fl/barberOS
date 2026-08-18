import { verificarAdmin, claveTemporal, jsonError, anotarActividad } from "@/lib/servidor";

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
  try {
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

    let usuarioId = null;
    let adoptada = false;

    const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
      email: correo,
      password: clave,
      email_confirm: true,          // el dueño entrega la clave en persona
      user_metadata: { nombre },
    });

    if (errCrear) {
      const m = (errCrear.message || "").toLowerCase();
      const yaExiste = m.includes("already been registered") || m.includes("already exists") || m.includes("duplicate");
      if (!yaExiste) return jsonError("No se pudo crear la cuenta: " + errCrear.message, 500);

      /* El correo ya tiene usuario. Puede venir de un intento anterior que
         falló a medias: si no tiene perfil, se adopta en vez de dejarlo
         inservible. Si ya pertenece a otra barbería, no se toca. */
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existente = lista?.users?.find((u) => (u.email || "").toLowerCase() === correo);
      if (!existente) return jsonError("Ese correo ya tiene una cuenta y no se pudo recuperar.", 409);

      const { data: perfilPrevio } = await admin
        .from("perfiles").select("id, barberia_id, nombre").eq("id", existente.id).maybeSingle();

      if (perfilPrevio && perfilPrevio.barberia_id === perfil.barberia_id)
        return jsonError(`${perfilPrevio.nombre} ya está en tu equipo con ese correo.`, 409);
      if (perfilPrevio)
        return jsonError("Ese correo ya pertenece a otra barbería.", 409);

      /* Usuario huérfano: se le pone la clave nueva y se le crea el perfil */
      const { error: errClave } = await admin.auth.admin.updateUserById(existente.id, { password: clave });
      if (errClave) return jsonError("No se pudo recuperar esa cuenta: " + errClave.message, 500);

      usuarioId = existente.id;
      adoptada = true;
    } else {
      usuarioId = creado.user.id;
    }

    const { error: errPerfil } = await admin.from("perfiles").insert({
      id: usuarioId,
      barberia_id: perfil.barberia_id,     // siempre la del administrador
      nombre, correo,
      telefono: telefono || null,
      rol, comision,
      activo: true,
      debe_cambiar_clave: true,
    });

    if (errPerfil) {
      /* Si el perfil falla y el usuario lo creamos recién, se borra para no
         dejar cuentas huérfanas. Si venía de antes, se deja como estaba. */
      if (!adoptada) { try { await admin.auth.admin.deleteUser(usuarioId); } catch {} }
      return jsonError("No se pudo crear el perfil: " + errPerfil.message, 500);
    }

    await anotarActividad(admin, perfil, "crear_cuenta", "perfiles", creado.user.id);

    return Response.json({ ok: true, id: creado.user.id, clave });
  } catch (e) {
    /* Cualquier error inesperado sale como JSON, no como página de error */
    return jsonError("Error inesperado en el servidor: " + (e?.message || e), 500);
  }
}
