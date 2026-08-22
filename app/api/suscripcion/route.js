import { verificarAdmin, jsonError, anotarActividad } from "@/lib/servidor";
import {
  hayPasarela, crearSuscripcion, cambiarMonto, cancelarSuscripcion,
} from "@/lib/pagos";
import { costoMensual } from "@/lib/planes";

export const dynamic = "force-dynamic";

/**
 * Suscripción de la barbería.
 *
 * POST  { accion: "pagar" }              → devuelve el link de Mercado Pago
 * POST  { accion: "cupos", cupos: n }    → cambia cuántos barberos cubre el plan
 * POST  { accion: "cancelar" }           → corta la renovación
 *
 * El cupo se ajusta SOLO acá, nunca desde el navegador: primero se actualiza
 * el monto en la pasarela y recién después la base. Si se hiciera al revés,
 * una barbería podría quedarse con cupos que no está pagando.
 */
export async function POST(request) {
  try {
    const { admin, perfil, error, estado } = await verificarAdmin(request);
    if (error) return jsonError(error, estado);

    let cuerpo = {};
    try { cuerpo = await request.json(); } catch {}
    const accion = cuerpo.accion || "pagar";

    const { data: barberia, error: errB } = await admin
      .from("barberias")
      .select("id, nombre, correo_contacto, estado_plan, barberos_incluidos, barberos_pagados, precio_base, precio_extra, suscripcion_externa")
      .eq("id", perfil.barberia_id)
      .maybeSingle();
    if (errB || !barberia) return jsonError("No se pudo leer los datos de tu barbería.", 500);

    const precio = (cupos) =>
      costoMensual(cupos, {
        precioBase: barberia.precio_base,
        precioExtra: barberia.precio_extra,
        barberosIncluidos: barberia.barberos_incluidos,
      });

    /* ---------------- Ampliar o reducir cupos ---------------- */
    if (accion === "cupos") {
      const cupos = Number(cuerpo.cupos);
      if (!Number.isInteger(cupos) || cupos < 1 || cupos > 100) {
        return jsonError("Cantidad de barberos no válida.", 400);
      }

      /* Nunca por debajo de los que ya están atendiendo */
      const { count } = await admin
        .from("perfiles")
        .select("id", { count: "exact", head: true })
        .eq("barberia_id", barberia.id)
        .eq("atiende", true)
        .eq("activo", true);
      if (cupos < (count || 0)) {
        return jsonError(`Hay ${count} barberos atendiendo. Desactiva a alguien antes de bajar el cupo.`, 400);
      }

      const nuevoMonto = precio(cupos);

      /* Con suscripción viva hay que avisarle a la pasarela ANTES de tocar
         la base: si esto falla, el cupo no se amplía y no se regala nada. */
      if (barberia.suscripcion_externa) {
        const r = await cambiarMonto(barberia.suscripcion_externa, nuevoMonto);
        if (r.error) return jsonError(r.error, 502);
      }

      const { error: errCupo } = await admin.rpc("fijar_cupo", {
        p_barberia: barberia.id,
        p_cupos: cupos,
      });
      if (errCupo) return jsonError(errCupo.message || "No se pudo actualizar el cupo.", 400);

      await anotarActividad(admin, perfil, "cambiar_cupo", "barberias", barberia.id);
      return Response.json({ ok: true, cupos, costo: nuevoMonto });
    }

    /* ---------------- Cancelar ---------------- */
    if (accion === "cancelar") {
      if (barberia.suscripcion_externa) {
        const r = await cancelarSuscripcion(barberia.suscripcion_externa);
        if (r.error) return jsonError(r.error, 502);
      }
      /* No se corta el acceso al tiro: vale hasta el fin del período pagado */
      await admin.from("barberias")
        .update({ estado_plan: "cancelada", cancelada_en: new Date().toISOString() })
        .eq("id", barberia.id);
      await anotarActividad(admin, perfil, "cancelar_suscripcion", "barberias", barberia.id);
      return Response.json({ ok: true });
    }

    /* ---------------- Iniciar el pago ---------------- */
    if (!hayPasarela()) {
      return jsonError(
        "Todavía no está configurado el cobro en línea. Escríbenos y activamos tu cuenta a mano.",
        503
      );
    }

    const correo = cuerpo.correo || barberia.correo_contacto;
    if (!correo) return jsonError("Falta el correo de facturación.", 400);

    const origen =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITIO ||
      "https://barberos.app";

    const r = await crearSuscripcion({
      barberiaId: barberia.id,
      nombre: barberia.nombre,
      correo,
      monto: precio(barberia.barberos_pagados),
      urlVuelta: `${origen}/suscripcion?volviste=1`,
    });
    if (r.error) return jsonError(r.error, 502);

    /* Se guarda el identificador aunque aún no esté autorizada: si el barbero
       abandona a mitad de camino, el webhook igual sabrá a quién acreditar. */
    await admin.from("barberias").update({
      proveedor_pago: "mercadopago",
      suscripcion_externa: r.datos.id,
    }).eq("id", barberia.id);

    await anotarActividad(admin, perfil, "iniciar_suscripcion", "barberias", barberia.id);

    return Response.json({
      ok: true,
      url: r.datos.init_point || r.datos.sandbox_init_point,
    });
  } catch (e) {
    console.error("suscripcion", e);
    return jsonError("No se pudo completar la operación.", 500);
  }
}
