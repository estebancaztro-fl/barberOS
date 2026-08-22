import { clienteAdmin, jsonError } from "@/lib/servidor";
import { aSlug } from "@/lib/texto";
import { PLAN } from "@/lib/planes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Servicios con los que arranca toda barbería. Se editan después. */
const SERVICIOS_BASE = [
  { nombre: "Corte clásico",    duracion: 30, precio: 8000 },
  { nombre: "Degradado",        duracion: 45, precio: 12000 },
  { nombre: "Corte + Barba",    duracion: 60, precio: 15000 },
  { nombre: "Arreglo de barba", duracion: 20, precio: 5000 },
];

/**
 * Alta de una barbería nueva. Ruta PÚBLICA: cualquiera puede llamarla.
 *
 * Por eso valida con dureza y tiene tope de altas por hora. Crea en un solo
 * paso el usuario, la barbería, el perfil de administrador, una sucursal y
 * los servicios base, para que el dueño entre a algo usable y no a una
 * pantalla vacía.
 */
export async function POST(request) {
  try {
    const admin = clienteAdmin();
    if (!admin) return jsonError("El servidor no está configurado para registrar.", 500);

    let c;
    try { c = await request.json(); } catch { return jsonError("Petición inválida."); }

    /* Campo trampa: los formularios automáticos lo rellenan, las personas no */
    if (c.web) return Response.json({ ok: true });

    const nombre = String(c.nombre || "").trim();
    const barberia = String(c.barberia || "").trim();
    const correo = String(c.correo || "").trim().toLowerCase();
    const clave = String(c.clave || "");
    const telefono = String(c.telefono || "").trim();

    if (nombre.length < 2) return jsonError("Tu nombre es obligatorio.");
    if (barberia.length < 2) return jsonError("El nombre de la barbería es obligatorio.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return jsonError("El correo no es válido.");
    if (clave.length < 8) return jsonError("La contraseña debe tener al menos 8 caracteres.");
    if (!c.aceptaTerminos) return jsonError("Debes aceptar el tratamiento de datos para registrarte.");

    const { data: permitido } = await admin.rpc("puede_registrar_barberia");
    if (permitido === false)
      return jsonError("Estamos recibiendo muchos registros. Inténtalo en unos minutos.", 429);

    /* Dirección del link, única */
    const raiz = aSlug(barberia);
    let slug = raiz;
    for (let i = 2; i < 50; i++) {
      const { data } = await admin.from("barberias").select("id").eq("slug", slug).maybeSingle();
      if (!data) break;
      slug = `${raiz}-${i}`;
    }

    /* Usuario. Queda confirmado: el dueño entra de inmediato y no depende
       de que le llegue un correo. Para exigir verificación, poner false
       y configurar un servicio de correo en Supabase. */
    const { data: creado, error: errUsuario } = await admin.auth.admin.createUser({
      email: correo,
      password: clave,
      email_confirm: true,
      user_metadata: { nombre, barberia },
    });

    if (errUsuario) {
      const m = (errUsuario.message || "").toLowerCase();
      if (m.includes("already") || m.includes("duplicate"))
        return jsonError("Ese correo ya tiene una cuenta. Inicia sesión.", 409);
      return jsonError("No se pudo crear la cuenta: " + errUsuario.message, 500);
    }

    const limpiar = async (msg) => {
      try { await admin.auth.admin.deleteUser(creado.user.id); } catch {}
      return jsonError(msg, 500);
    };

    const { data: barb, error: errBarberia } = await admin.from("barberias").insert({
      nombre: barberia, slug, correo_contacto: correo,
      plan: "prueba",
      estado_plan: "prueba",
      /* La duración de la prueba vive en un solo lugar */
      prueba_hasta: new Date(Date.now() + PLAN.diasDePrueba * 86400000)
        .toISOString().slice(0, 10),
    }).select("id, slug").single();

    if (errBarberia) return limpiar("No se pudo crear la barbería: " + errBarberia.message);

    const deshacer = async (msg) => {
      try { await admin.from("barberias").delete().eq("id", barb.id); } catch {}
      return limpiar(msg);
    };

    const { error: errPerfil } = await admin.from("perfiles").insert({
      id: creado.user.id, barberia_id: barb.id,
      nombre, correo, telefono: telefono || null,
      rol: "admin", comision: 0, activo: true, debe_cambiar_clave: false,
    });
    if (errPerfil) return deshacer("No se pudo crear tu perfil: " + errPerfil.message);

    /* Para que no entre a una app vacía */
    await admin.from("sucursales").insert({
      barberia_id: barb.id, nombre: "Sucursal principal", activa: true,
    });
    await admin.from("servicios").insert(
      SERVICIOS_BASE.map((s) => ({ ...s, barberia_id: barb.id, activo: true }))
    );

    await admin.from("registro_actividad").insert({
      barberia_id: barb.id, actor_id: creado.user.id,
      accion: "registro_barberia", entidad: "barberias", entidad_id: barb.id,
    }).then(() => {}, () => {});

    return Response.json({ ok: true, slug: barb.slug });
  } catch (e) {
    return jsonError("Error inesperado en el servidor: " + (e?.message || e), 500);
  }
}
