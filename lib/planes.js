/**
 * Precios de BarberOS, en un solo lugar.
 *
 * Estos valores son solo para mostrar y para crear suscripciones nuevas.
 * Lo que se cobra de verdad sale de la barbería en la base (precio_base y
 * precio_extra), porque quien ya es cliente conserva el precio con el que
 * entró aunque después subamos la lista.
 */

export const PLAN = {
  nombre: "BarberOS",
  precioBase: 19990,
  barberosIncluidos: 4,
  precioExtra: 5990,
  diasDePrueba: 14,
  moneda: "CLP",
};

/** Total mensual para una cantidad de cupos. */
export function costoMensual(cupos, p = PLAN) {
  const extras = Math.max(0, (cupos || p.barberosIncluidos) - p.barberosIncluidos);
  return p.precioBase + extras * p.precioExtra;
}

/** Lo que sube la cuenta al agregar un barbero más, para avisarlo antes. */
export function costoDeUnoMas(cuposActuales, p = PLAN) {
  return costoMensual(cuposActuales + 1, p) - costoMensual(cuposActuales, p);
}

/* Lo que incluye el plan, para la pantalla de suscripción y la landing.
   El primer punto sale del plan para que no se desincronice si cambia. */
export const INCLUYE = [
  `Hasta ${PLAN.barberosIncluidos} barberos atendiendo`,
  "Agenda, clientes, finanzas y CRM completos",
  "Visagismo e historial de cortes",
  "Link de reservas propio para tu barbería",
  "Sucursales ilimitadas",
];

/** Texto del estado del plan, para no repetirlo en cada pantalla. */
export function resumenPlan(plan) {
  if (!plan) return { titulo: "", detalle: "", tono: "" };
  const dias = plan.dias_de_prueba ?? 0;

  if (plan.estado === "prueba" && plan.vigente) {
    return {
      tono: dias <= 3 ? "urgente" : "info",
      titulo: dias === 0 ? "Tu prueba termina hoy" : `Te ${dias === 1 ? "queda" : "quedan"} ${dias} ${dias === 1 ? "día" : "días"} de prueba`,
      detalle: "Después, la cuenta queda en solo lectura hasta que actives la suscripción.",
    };
  }
  if (plan.estado === "morosa") {
    return {
      tono: "urgente",
      titulo: "No pudimos cobrar tu suscripción",
      detalle: "Revisa tu medio de pago. Tienes unos días antes de que la cuenta quede en solo lectura.",
    };
  }
  if (!plan.vigente) {
    return {
      tono: "urgente",
      titulo: "Tu cuenta está en solo lectura",
      detalle: "Puedes ver toda tu información, pero no agendar ni registrar ventas. Se reactiva al pagar.",
    };
  }
  return { tono: "", titulo: "", detalle: "" };
}
