import { comprimirImagen } from "@/lib/imagen";
import { guardarReserva, darConsentimiento, tieneConsentimiento } from "@/lib/datos";

/**
 * Foto del corte terminado.
 *
 * Vive acá y no dentro de una pantalla porque se usa desde dos lugares —el
 * detalle de la reserva y la ficha del cliente— y las dos tienen que
 * comportarse igual: misma compresión, mismo consentimiento, mismos errores.
 *
 * Sobre el consentimiento: la foto del resultado casi siempre muestra parte
 * del rostro, así que es un dato personal. No es visagismo (eso es análisis
 * biométrico y se pide aparte), pero igual necesita autorización del cliente
 * bajo la Ley 21.719. La base lo exige con un trigger; acá se registra
 * después de que el barbero confirma que efectivamente le preguntó.
 */

export const TEXTO_CONSENTIMIENTO =
  "Le pedí autorización al cliente para guardar una foto de su corte en su ficha. " +
  "Sabe que la imagen puede mostrar parte de su rostro y que puede pedir que la eliminemos cuando quiera.";

/** ¿Ya autorizó este cliente? Sin sesión no hay registro que consultar. */
export async function faltaConsentimiento(clienteId, conSesion) {
  if (!conSesion || !clienteId) return false;
  const { datos } = await tieneConsentimiento(clienteId, "fotos_corte");
  return datos === false;
}

/**
 * Comprime y guarda la foto en la reserva.
 * Devuelve { ok } o { error } con un mensaje ya redactado para el barbero.
 */
export async function guardarFoto({ reserva, archivo, conSesion, barberiaId, update, recargar }) {
  if (!archivo) return { error: "No se seleccionó ninguna foto." };

  let dataUrl;
  try {
    dataUrl = await comprimirImagen(archivo);
  } catch {
    return { error: "No se pudo procesar la foto. Inténtalo de nuevo." };
  }

  if (!conSesion) {
    try {
      update((d) => {
        const x = d.reservas.find((y) => y.id === reserva.id);
        if (x) x.foto = dataUrl;
        return d;
      });
    } catch {
      return { error: "No queda espacio en este dispositivo para más fotos." };
    }
    return { ok: true };
  }

  /* El consentimiento se registra justo antes: si el guardado falla, no
     queda una autorización huérfana de una foto que nunca se guardó. */
  if (reserva.clienteId) {
    const c = await darConsentimiento(barberiaId, reserva.clienteId, "fotos_corte");
    if (c?.error) return { error: c.error };
  }

  const res = await guardarReserva(reserva.id, { foto: dataUrl });
  if (res.error) return { error: res.error };

  await recargar?.("reservas");
  return { ok: true };
}

export async function borrarFoto({ reserva, conSesion, update, recargar }) {
  if (!conSesion) {
    update((d) => {
      const x = d.reservas.find((y) => y.id === reserva.id);
      if (x) x.foto = null;
      return d;
    });
    return { ok: true };
  }
  const res = await guardarReserva(reserva.id, { foto: null });
  if (res.error) return { error: res.error };
  await recargar?.("reservas");
  return { ok: true };
}
