"use client";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { resumenPlan } from "@/lib/planes";

/**
 * Barra con el estado de la suscripción.
 *
 * Aparece solo cuando hay algo que decir: durante la prueba, cuando falla un
 * cobro o cuando la cuenta quedó en solo lectura. Con la suscripción al día
 * no molesta a nadie.
 */
export default function AvisoPlan() {
  const app = useApp();
  if (!app?.conSesion || !app.plan) return null;

  const { titulo, detalle, tono } = resumenPlan(app.plan);
  if (!titulo) return null;

  return (
    <div className={"aviso-plan" + (tono === "urgente" ? " urgente" : "")}>
      <div className="grow">
        <b>{titulo}</b>
        <div className="mut">{detalle}</div>
      </div>
      {app.rol === "admin" && (
        <Link className="btn dark" href="/suscripcion">
          {app.plan.vigente ? "Activar suscripción" : "Reactivar"}
        </Link>
      )}
    </div>
  );
}
