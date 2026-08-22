"use client";
import { useState, useRef } from "react";
import Modal from "@/components/Modal";
import { useApp } from "@/lib/store";
import { guardarFoto, faltaConsentimiento, TEXTO_CONSENTIMIENTO } from "@/lib/fotos";
import { ImgIcon } from "@/components/Icons";

/**
 * Botón para tomar o cambiar la foto del corte.
 *
 * El mismo componente sirve en el detalle de la reserva y en la ficha del
 * cliente, así las dos pantallas se comportan igual.
 *
 * La primera vez que se guarda una foto de un cliente se pide confirmación
 * explícita al barbero. Antes la app registraba el consentimiento sola, sin
 * que nadie le hubiera preguntado nada al cliente: eso es un consentimiento
 * de mentira y no sirve ante la Ley 21.719.
 */
export default function SubirFoto({ reserva, etiqueta = "Tomar foto", clase = "btn sm", onListo, onError }) {
  const app = useApp();
  const entrada = useRef(null);
  const [pendiente, setPendiente] = useState(null);   // archivo esperando confirmación
  const [acepto, setAcepto] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  if (!app) return null;

  const { conSesion, barberia, update, recargar } = app;

  const elegir = async (archivo) => {
    if (!archivo) return;
    if (await faltaConsentimiento(reserva.clienteId, conSesion)) {
      setAcepto(false);
      setPendiente(archivo);
      return;
    }
    await subir(archivo);
  };

  const subir = async (archivo) => {
    setSubiendo(true);
    const r = await guardarFoto({
      reserva, archivo, conSesion, barberiaId: barberia?.id, update, recargar,
    });
    setSubiendo(false);
    setPendiente(null);
    if (r.error) onError?.(r.error);
    else onListo?.();
  };

  return (
    <>
      <button className={clase} disabled={subiendo} onClick={() => entrada.current?.click()}>
        <ImgIcon style={{ width: 16, height: 16 }} />
        {subiendo ? "Guardando…" : etiqueta}
      </button>
      {/* capture="environment" abre la cámara trasera en el celular */}
      <input ref={entrada} type="file" accept="image/*" capture="environment"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; elegir(f); }} />

      {pendiente && (
        <Modal
          title="Autorización del cliente" onClose={() => setPendiente(null)}
          footer={
            <>
              <button className="link-btn" onClick={() => setPendiente(null)}>Cancelar</button>
              <button className="btn dark" disabled={!acepto || subiendo}
                onClick={() => subir(pendiente)}>
                {subiendo ? "Guardando…" : "Guardar foto"}
              </button>
            </>
          }
        >
          <p style={{ lineHeight: 1.6 }}>
            La foto del resultado queda guardada en la ficha del cliente y casi
            siempre muestra parte de su rostro, así que necesita su autorización.
          </p>
          <label className="consentimiento" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
            <span>{TEXTO_CONSENTIMIENTO}</span>
          </label>
          <p className="muted" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
            Se pide una sola vez por cliente. Queda registrado con fecha, por si
            alguna vez hay que demostrar que se pidió.
          </p>
        </Modal>
      )}
    </>
  );
}
