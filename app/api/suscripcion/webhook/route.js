import { clienteAdmin } from "@/lib/servidor";
import { firmaValida, verSuscripcion, verPago } from "@/lib/pagos";

export const dynamic = "force-dynamic";

/**
 * Avisos de Mercado Pago.
 *
 * Tres reglas que no se negocian:
 *
 * 1. Se valida la firma. Sin eso, cualquiera que adivine la dirección se
 *    activa la suscripción gratis con un POST.
 * 2. No se cree nada de lo que viene en el cuerpo salvo el identificador:
 *    el estado y el monto se vuelven a consultar a la API de Mercado Pago.
 * 3. Siempre se responde 200. Si devolviéramos error, Mercado Pago
 *    reintentaría en bucle por algo que quizás nunca va a funcionar.
 */
export async function POST(request) {
  try {
    const url = new URL(request.url);

    let cuerpo = {};
    try { cuerpo = await request.json(); } catch {}

    const dataId =
      cuerpo?.data?.id || cuerpo?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
    const tipo = cuerpo?.type || cuerpo?.topic || url.searchParams.get("type") || "";

    const ok = firmaValida({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
    });
    if (!ok) {
      console.warn("webhook con firma inválida", { tipo, dataId });
      return Response.json({ recibido: true }, { status: 401 });
    }

    const admin = clienteAdmin();
    if (!admin || !dataId) return Response.json({ recibido: true });

    /* ---------- Alta, cambio o baja de la suscripción ---------- */
    if (tipo.includes("preapproval") && !tipo.includes("authorized_payment")) {
      const { datos, error } = await verSuscripcion(dataId);
      if (error || !datos) return Response.json({ recibido: true });

      const barberiaId = datos.external_reference;
      if (!barberiaId) return Response.json({ recibido: true });

      /* authorized = el barbero autorizó el cobro recurrente */
      const estado =
        datos.status === "authorized" ? "activa"
        : datos.status === "paused" ? "morosa"
        : datos.status === "cancelled" ? "cancelada"
        : null;

      if (estado) {
        const hasta = datos.next_payment_date
          ? new Date(datos.next_payment_date).toISOString()
          : null;
        await admin.from("barberias").update({
          estado_plan: estado,
          proveedor_pago: "mercadopago",
          suscripcion_externa: datos.id,
          ...(hasta ? { periodo_hasta: hasta } : {}),
        }).eq("id", barberiaId);
      }
      return Response.json({ recibido: true });
    }

    /* ---------- Un cobro mensual ---------- */
    const { datos: pago, error: errPago } = await verPago(dataId);
    if (errPago || !pago) return Response.json({ recibido: true });

    const barberiaId = pago.external_reference || pago.metadata?.barberia_id;
    if (!barberiaId) return Response.json({ recibido: true });

    const aprobado = pago.status === "approved";

    /* Hasta cuándo queda pagado: un mes desde que se acreditó */
    const desde = pago.date_approved ? new Date(pago.date_approved) : new Date();
    const hasta = new Date(desde);
    hasta.setMonth(hasta.getMonth() + 1);

    /* El unique(proveedor, referencia) hace que reenviar el mismo aviso
       —cosa que Mercado Pago hace— no acredite dos veces el mismo mes. */
    const { error: errCobro } = await admin.from("cobros").insert({
      barberia_id: barberiaId,
      proveedor: "mercadopago",
      referencia: String(pago.id),
      monto: Math.round(pago.transaction_amount || 0),
      estado: aprobado ? "aprobado" : pago.status === "rejected" ? "rechazado" : "pendiente",
      periodo_hasta: aprobado ? hasta.toISOString() : null,
      crudo: { status: pago.status, detalle: pago.status_detail },
    });

    /* Si ya estaba registrado, no se toca nada más */
    if (errCobro && String(errCobro.code) === "23505") {
      return Response.json({ recibido: true, repetido: true });
    }

    if (aprobado) {
      await admin.from("barberias").update({
        estado_plan: "activa",
        periodo_hasta: hasta.toISOString(),
      }).eq("id", barberiaId);
    } else if (pago.status === "rejected") {
      /* Morosa, no vencida: plan_vigente() da unos días de gracia antes
         de dejar la cuenta en solo lectura. */
      await admin.from("barberias")
        .update({ estado_plan: "morosa" })
        .eq("id", barberiaId);
    }

    return Response.json({ recibido: true });
  } catch (e) {
    console.error("webhook", e);
    return Response.json({ recibido: true });
  }
}

/* Mercado Pago comprueba la dirección con un GET antes de habilitarla */
export async function GET() {
  return Response.json({ ok: true });
}
