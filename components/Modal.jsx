"use client";
import { useState } from "react";
import { X } from "@/components/Icons";

/**
 * Guardado de un formulario dentro de un modal.
 *
 * Resuelve de una vez tres cosas que antes cada pantalla hacía a su manera,
 * o no hacía: el botón avisa que está trabajando, el modal se cierra solo
 * cuando el guardado resulta, y si falla el error se muestra DENTRO del
 * modal. Antes se pintaba en la página, detrás del modal, donde nadie lo veía.
 *
 * onSave debe devolver el mensaje de error, o nada si todo salió bien.
 */
export function useGuardado(onSave) {
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const enviar = async (valor) => {
    setError("");
    setGuardando(true);
    let err = null;
    try {
      err = await onSave(valor);
    } catch (e) {
      err = e?.message || "No se pudo guardar. Inténtalo de nuevo.";
    }
    setGuardando(false);
    if (err) setError(typeof err === "string" ? err : "No se pudo guardar.");
  };

  return { enviar, error, guardando };
}

/** Bloque de error para poner al final del cuerpo del modal. */
export function ErrorModal({ error }) {
  if (!error) return null;
  return <div className="login-error" style={{ marginTop: 4 }}>{error}</div>;
}

export default function Modal({ title, sub, onClose, children, footer, ancho }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={ancho ? { maxWidth: ancho } : undefined}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="x" onClick={onClose}><X /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange }) {
  return (
    <button type="button" className={"toggle" + (on ? " on" : "")} onClick={() => onChange(!on)} aria-pressed={on}>
      <span />
    </button>
  );
}
