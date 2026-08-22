"use client";
import { useState } from "react";
import Modal from "@/components/Modal";
import { useApp, fmt } from "@/lib/store";
import { costoDeUnoMas } from "@/lib/planes";
import { supabase } from "@/lib/supabase";

/**
 * "Agregar a este barbero cuesta $X más al mes. ¿Confirmas?"
 *
 * Aparece cuando la barbería ya usó todos sus cupos. Se muestra el costo
 * ANTES de cobrar: enterarse por la boleta es la forma más rápida de perder
 * un cliente.
 */
export default function AmpliarCupo({ onClose, onListo }) {
  const app = useApp();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const plan = app?.plan;
  if (!plan) return null;

  const sube = costoDeUnoMas(plan.barberos_pagados, {
    precioBase: plan.precio_base,
    precioExtra: plan.precio_extra,
    barberosIncluidos: plan.barberos_incluidos,
  });
  const nuevoTotal = plan.costo_mensual + sube;
  const nuevosCupos = plan.barberos_pagados + 1;

  const confirmar = async () => {
    setError("");
    setEnviando(true);
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const r = await fetch("/api/suscripcion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sesion?.session?.access_token || ""}`,
        },
        body: JSON.stringify({ accion: "cupos", cupos: nuevosCupos }),
      });
      const datos = await r.json().catch(() => ({}));
      setEnviando(false);
      if (!r.ok || datos.error) { setError(datos.error || "No se pudo ampliar el cupo."); return; }
      await app.recargarPlan();
      onListo?.();
    } catch {
      setEnviando(false);
      setError("Sin conexión. Intenta de nuevo.");
    }
  };

  return (
    <Modal
      title="Este barbero suma a tu plan" onClose={onClose}
      footer={
        <>
          <button className="link-btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={enviando} onClick={confirmar}>
            {enviando ? "Actualizando…" : `Confirmar ${fmt(nuevoTotal)}/mes`}
          </button>
        </>
      }
    >
      <p style={{ lineHeight: 1.6 }}>
        Tu plan cubre <b>{plan.barberos_pagados} barberos atendiendo</b> y ya
        los tienes todos ocupados. Agregar a uno más suma <b>{fmt(sube)}</b> al mes.
      </p>

      <div className="stack" style={{ marginTop: 16 }}>
        <div className="rowline">
          <div className="grow"><h4 style={{ margin: 0 }}>Ahora pagas</h4></div>
          <b>{fmt(plan.costo_mensual)}</b>
        </div>
        <div className="rowline">
          <div className="grow">
            <h4 style={{ margin: 0 }}>Pasarías a pagar</h4>
            <div className="mut">{nuevosCupos} barberos · desde el próximo cobro</div>
          </div>
          <b style={{ fontSize: 19 }}>{fmt(nuevoTotal)}</b>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6 }}>
        Si más adelante alguien deja la barbería, desactívalo y baja el cupo
        desde Suscripción: el cobro vuelve a bajar.
      </p>

      {error && <div className="login-error" style={{ marginTop: 14 }}>{error}</div>}
    </Modal>
  );
}
