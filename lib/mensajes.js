/**
 * Mensajes a clientes: plantillas, teléfonos y el link de WhatsApp.
 *
 * No hay nada de red acá a propósito. Esto arma el texto; quién lo manda
 * —el barbero desde su teléfono hoy, la Cloud API mañana— es otra decisión
 * y no debería obligar a reescribir las plantillas.
 */

export const PLANTILLA_RECORDATORIO =
  "Hola {cliente}, te recordamos tu hora en {barberia} hoy a las {hora} " +
  "para {servicio}. ¿Nos confirmas que vienes?";

export const VARIABLES = [
  ["{cliente}", "Nombre del cliente"],
  ["{barberia}", "Nombre de tu barbería"],
  ["{hora}", "Hora de la cita"],
  ["{fecha}", "Fecha de la cita"],
  ["{servicio}", "Servicio agendado"],
  ["{barbero}", "Quién lo atiende"],
];

/** Reemplaza las variables. Lo que no se puede llenar se borra sin dejar hueco. */
export function armarTexto(plantilla, datos) {
  const valores = {
    "{cliente}": (datos.cliente || "").trim().split(" ")[0] || "",
    "{barberia}": datos.barberia || "",
    "{hora}": datos.hora || "",
    "{fecha}": datos.fecha || "",
    "{servicio}": datos.servicio || "tu servicio",
    "{barbero}": datos.barbero || "",
  };
  let texto = plantilla || PLANTILLA_RECORDATORIO;
  for (const [clave, valor] of Object.entries(valores)) {
    texto = texto.split(clave).join(valor);
  }
  /* Dobles espacios y espacios antes de un punto, que quedan al vaciar una
     variable. Un mensaje con "  ." se ve descuidado. */
  return texto.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}

/**
 * Teléfono en el formato que espera WhatsApp: solo dígitos, con país.
 * Devuelve null si no hay número utilizable, para no abrir un chat vacío.
 */
export function telefonoWhatsApp(telefono, paisPorDefecto = "56") {
  const solo = String(telefono || "").replace(/\D/g, "");
  if (solo.length < 8) return null;

  /* Ya viene con código de país */
  if (solo.startsWith(paisPorDefecto) && solo.length >= 11) return solo;

  /* Chile: 9 dígitos que parten en 9 (celular) */
  if (solo.length === 9 && solo.startsWith("9")) return paisPorDefecto + solo;
  /* Escrito sin el 9 inicial */
  if (solo.length === 8) return paisPorDefecto + "9" + solo;

  return paisPorDefecto + solo;
}

/** Link que abre WhatsApp con el mensaje ya escrito. */
export function linkWhatsApp(telefono, texto) {
  const numero = telefonoWhatsApp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto || "")}`;
}

/* ---------------- Recordatorios ---------------- */

/** Momento exacto de la cita, a partir de fecha y hora locales. */
export function momentoDeLaCita(reserva) {
  if (!reserva?.fecha || !reserva?.hora) return null;
  const t = new Date(`${reserva.fecha}T${reserva.hora.slice(0, 5)}:00`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/**
 * Citas que toca recordar ahora: dentro de la ventana, sin pasar, activas y
 * que todavía no tienen aviso enviado.
 *
 * `margen` evita que una cita se escape si la app estuvo cerrada un rato:
 * entra igual mientras no haya empezado.
 */
export function citasPorAvisar({ reservas, mensajes, minutos = 25, ahora = new Date() }) {
  const yaAvisadas = new Set(
    (mensajes || [])
      .filter((m) => m.tipo === "recordatorio" && m.reservaId)
      .map((m) => m.reservaId)
  );

  return (reservas || [])
    .filter((r) => {
      if (r.estado === "cancelado" || r.estado === "finalizado") return false;
      if (yaAvisadas.has(r.id)) return false;
      const cita = momentoDeLaCita(r);
      if (!cita) return false;
      const faltan = (cita.getTime() - ahora.getTime()) / 60000;
      return faltan > 0 && faltan <= minutos;
    })
    .sort((a, b) => momentoDeLaCita(a) - momentoDeLaCita(b));
}
