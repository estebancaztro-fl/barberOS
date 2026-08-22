/**
 * Cobro de suscripciones — Mercado Pago.
 *
 * Solo servidor: el token de acceso jamás llega al navegador.
 *
 * Se eligió Mercado Pago porque Stripe no opera en Chile: no se puede
 * registrar una cuenta con RUT chileno. Todo lo específico de la pasarela
 * está en este archivo para que cambiarla más adelante sea reemplazarlo,
 * no reescribir la app.
 */
import crypto from "crypto";

const API = "https://api.mercadopago.com";

const token = () => process.env.MERCADOPAGO_ACCESS_TOKEN || "";

export const hayPasarela = () => Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);

async function pedir(ruta, opciones = {}) {
  if (!token()) return { error: "Falta configurar la pasarela de pago." };

  let r;
  try {
    r = await fetch(API + ruta, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
        ...(opciones.headers || {}),
      },
    });
  } catch {
    return { error: "No se pudo contactar a Mercado Pago. Intenta de nuevo." };
  }

  let datos = null;
  try { datos = await r.json(); } catch {}

  if (!r.ok) {
    /* El mensaje de la pasarela es para nosotros, no para el barbero */
    console.error("Mercado Pago", r.status, datos);
    return { error: "La pasarela rechazó la operación. Revisa los datos e intenta otra vez." };
  }
  return { datos };
}

/**
 * Crea la suscripción mensual y devuelve el link donde el barbero paga.
 * Queda "pending" hasta que autoriza el pago; recién ahí el webhook la activa.
 */
export async function crearSuscripcion({ barberiaId, nombre, correo, monto, urlVuelta }) {
  return pedir("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: `BarberOS · ${nombre}`,
      external_reference: barberiaId,        // así el webhook sabe a quién acreditar
      payer_email: correo,
      back_url: urlVuelta,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: Math.round(monto),   // CLP no usa decimales
        currency_id: "CLP",
      },
    }),
  });
}

export async function verSuscripcion(id) {
  return pedir(`/preapproval/${encodeURIComponent(id)}`);
}

/** Cambiar el monto cuando se agregan o quitan barberos. */
export async function cambiarMonto(id, monto) {
  return pedir(`/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({
      auto_recurring: { transaction_amount: Math.round(monto), currency_id: "CLP" },
    }),
  });
}

export async function cancelarSuscripcion(id) {
  return pedir(`/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

export async function verPago(id) {
  return pedir(`/v1/payments/${encodeURIComponent(id)}`);
}

/**
 * Comprueba que el aviso venga realmente de Mercado Pago.
 *
 * Sin esto, cualquiera que conozca la dirección del webhook podría activarse
 * la suscripción gratis mandando un POST. Es la parte más importante de todo
 * el archivo.
 *
 * Mercado Pago firma "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" con
 * HMAC-SHA256 y la clave secreta del webhook.
 */
export function firmaValida({ xSignature, xRequestId, dataId }) {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secreto || !xSignature) return false;

  let ts = "";
  let v1 = "";
  for (const parte of String(xSignature).split(",")) {
    const [k, v] = parte.split("=").map((s) => (s || "").trim());
    if (k === "ts") ts = v;
    if (k === "v1") v1 = v;
  }
  if (!ts || !v1) return false;

  /* Una firma vieja no sirve: frena que alguien reenvíe un aviso capturado */
  const edad = Math.abs(Date.now() - Number(ts)) / 1000;
  if (!Number.isFinite(edad) || edad > 900) return false;

  let manifiesto = "";
  if (dataId) manifiesto += `id:${String(dataId).toLowerCase()};`;
  if (xRequestId) manifiesto += `request-id:${xRequestId};`;
  manifiesto += `ts:${ts};`;

  const esperado = crypto.createHmac("sha256", secreto).update(manifiesto).digest("hex");

  /* Comparación de tiempo constante: comparar con === filtra información */
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
