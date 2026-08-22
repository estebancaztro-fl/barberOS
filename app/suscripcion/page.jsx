"use client";
import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import Protegido from "@/components/Protegido";
import Modal from "@/components/Modal";
import { useApp, fmt } from "@/lib/store";
import { listarCobros } from "@/lib/datos";
import { PLAN, INCLUYE, costoDeUnoMas } from "@/lib/planes";
import { supabase } from "@/lib/supabase";
import { Plus, Trash } from "@/components/Icons";

const fecha = (v) =>
  v ? new Date(v).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) : "—";

export default function Suscripcion() {
  return (
    <Protegido>
      <Contenido />
    </Protegido>
  );
}

function Contenido() {
  const app = useApp();
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [cobros, setCobros] = useState([]);
  const [confirmar, setConfirmar] = useState(null);

  useEffect(() => {
    if (!app?.conSesion) return;
    listarCobros().then(({ datos }) => datos && setCobros(datos));
  }, [app?.conSesion]);

  if (!app) return null;
  const { plan, rol, recargarPlan, conSesion } = app;

  if (!conSesion) {
    return (
      <Shell>
        <div className="page-head"><div><h2>Suscripción</h2></div></div>
        <div className="empty">Esta sección necesita la app conectada a la base.</div>
      </Shell>
    );
  }

  if (rol !== "admin") {
    return (
      <Shell>
        <div className="page-head"><div><h2>Suscripción</h2></div></div>
        <div className="empty">Solo el administrador de la barbería puede ver el plan y los pagos.</div>
      </Shell>
    );
  }

  if (!plan) {
    return <Shell><div className="login-pantalla"><div className="spinner" /></div></Shell>;
  }

  const extras = Math.max(0, plan.barberos_pagados - plan.barberos_incluidos);

  /* Toda operación de cobro pasa por el servidor: el navegador no tiene
     —ni debe tener— la llave de Mercado Pago. */
  const llamar = async (cuerpo, comoOcupado) => {
    setError(""); setMsg(""); setOcupado(comoOcupado);
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const r = await fetch("/api/suscripcion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sesion?.session?.access_token || ""}`,
        },
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json().catch(() => ({}));
      setOcupado("");
      if (!r.ok || datos.error) { setError(datos.error || "No se pudo completar la operación."); return null; }
      return datos;
    } catch {
      setOcupado("");
      setError("Sin conexión. Intenta de nuevo.");
      return null;
    }
  };

  const pagar = async () => {
    const r = await llamar({ accion: "pagar" }, "pagar");
    if (r?.url) window.location.href = r.url;
  };

  const cambiarCupos = async (cupos) => {
    const r = await llamar({ accion: "cupos", cupos }, "cupos");
    if (r) {
      setConfirmar(null);
      setMsg(`Tu plan ahora cubre ${cupos} barberos. Costo mensual: ${fmt(r.costo)}`);
      await recargarPlan();
    }
  };

  const cancelar = async () => {
    const r = await llamar({ accion: "cancelar" }, "cancelar");
    if (r) { setMsg("Suscripción cancelada. Tu acceso sigue hasta el final del período pagado."); await recargarPlan(); }
  };

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h2>Suscripción</h2>
          <div className="sub">Tu plan, los cupos de barberos y el historial de pagos</div>
        </div>
      </div>

      {/* ---------- Estado ---------- */}
      <div className="card" style={{ maxWidth: 760, padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <div>
            <span className={"badge" + (plan.vigente ? "" : " grey")}>
              {plan.estado === "prueba" ? "Prueba gratis"
                : plan.estado === "activa" ? "Al día"
                : plan.estado === "morosa" ? "Pago pendiente"
                : plan.estado === "cancelada" ? "Cancelada" : "Vencida"}
            </span>
            <h3 style={{ margin: "12px 0 4px" }}>Plan {PLAN.nombre}</h3>
            <div className="muted">
              {plan.estado === "prueba"
                ? <>Tu prueba de {PLAN.diasDePrueba} días termina el {fecha(plan.prueba_hasta)}.</>
                : plan.periodo_hasta
                  ? <>Pagado hasta el {fecha(plan.periodo_hasta)}.</>
                  : <>Sin período pagado todavía.</>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 30, fontWeight: 600 }}>{fmt(plan.costo_mensual)}</div>
            <div className="muted">al mes</div>
          </div>
        </div>

        <div className="stack" style={{ marginTop: 22 }}>
          <div className="rowline">
            <div className="grow"><h4 style={{ margin: 0 }}>Plan base</h4>
              <div className="mut">Incluye {plan.barberos_incluidos} barberos atendiendo</div></div>
            <b>{fmt(plan.precio_base)}</b>
          </div>
          {extras > 0 && (
            <div className="rowline">
              <div className="grow"><h4 style={{ margin: 0 }}>{extras} barbero{extras > 1 ? "s" : ""} extra</h4>
                <div className="mut">{fmt(plan.precio_extra)} cada uno</div></div>
              <b>{fmt(extras * plan.precio_extra)}</b>
            </div>
          )}
        </div>

        {error && <div className="login-error" style={{ marginTop: 18 }}>{error}</div>}
        {msg && <div className="aviso" style={{ marginTop: 18 }}>{msg}</div>}

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          {plan.estado !== "activa" && (
            <button className="btn dark" disabled={ocupado === "pagar"} onClick={pagar}>
              {ocupado === "pagar" ? "Abriendo Mercado Pago…" : "Activar suscripción"}
            </button>
          )}
          {plan.estado === "activa" && (
            <button className="link-btn" disabled={ocupado === "cancelar"} onClick={cancelar}>
              Cancelar renovación
            </button>
          )}
        </div>

        {plan.estado !== "activa" && (
          <p className="muted" style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6 }}>
            El cobro es mensual y se puede cancelar cuando quieras. Al cancelar,
            tu cuenta sigue funcionando hasta el final del período ya pagado.
          </p>
        )}
      </div>

      {/* ---------- Cupos ---------- */}
      <div className="card" style={{ maxWidth: 760, padding: 28, marginTop: 20 }}>
        <h3 style={{ margin: "0 0 6px" }}>Barberos atendiendo</h3>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6 }}>
          Cuentan solo quienes reciben reservas. Un administrador que no corta
          pelo, o alguien de recepción, no ocupa cupo.
        </p>

        <div className="rowline">
          <div className="grow">
            <h4 style={{ margin: 0 }}>{plan.barberos_atendiendo} de {plan.barberos_pagados} cupos en uso</h4>
            <div className="mut">
              {plan.barberos_pagados > plan.barberos_atendiendo
                ? `Puedes agregar ${plan.barberos_pagados - plan.barberos_atendiendo} más sin costo adicional`
                : `El siguiente suma ${fmt(plan.precio_extra)} al mes`}
            </div>
          </div>
          <button className="icon-btn" title="Quitar un cupo"
            disabled={plan.barberos_pagados <= Math.max(plan.barberos_incluidos, plan.barberos_atendiendo) || ocupado === "cupos"}
            onClick={() => cambiarCupos(plan.barberos_pagados - 1)}><Trash /></button>
          <button className="btn dark" disabled={ocupado === "cupos"}
            onClick={() => setConfirmar(plan.barberos_pagados + 1)}>
            <Plus /> Agregar cupo
          </button>
        </div>
      </div>

      {/* ---------- Qué incluye ---------- */}
      <div className="card" style={{ maxWidth: 760, padding: 28, marginTop: 20 }}>
        <h3 style={{ margin: "0 0 14px" }}>Qué incluye</h3>
        <ul className="lista si">
          {INCLUYE.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </div>

      {/* ---------- Pagos ---------- */}
      {cobros.length > 0 && (
        <div className="card" style={{ maxWidth: 760, padding: 28, marginTop: 20 }}>
          <h3 style={{ margin: "0 0 14px" }}>Pagos</h3>
          <div className="listcard">
            {cobros.map((c) => (
              <div className="listrow" key={c.id}>
                <div className="grow">
                  <h4 suppressHydrationWarning>{fecha(c.creado_en)}</h4>
                  <div className="mut">{c.estado === "aprobado" ? "Pagado" : c.estado === "rechazado" ? "Rechazado" : "Pendiente"}</div>
                </div>
                <b className={c.estado === "aprobado" ? "money-green" : "money-red"}>{fmt(c.monto)}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmar && (
        <ConfirmarCupo
          cupos={confirmar}
          plan={plan}
          ocupado={ocupado === "cupos"}
          onClose={() => setConfirmar(null)}
          onOk={() => cambiarCupos(confirmar)}
        />
      )}
    </Shell>
  );
}

function ConfirmarCupo({ cupos, plan, ocupado, onClose, onOk }) {
  const sube = costoDeUnoMas(plan.barberos_pagados, {
    precioBase: plan.precio_base,
    precioExtra: plan.precio_extra,
    barberosIncluidos: plan.barberos_incluidos,
  });
  const nuevo = plan.costo_mensual + sube;

  return (
    <Modal
      title="Agregar un cupo" onClose={onClose}
      footer={
        <>
          <button className="link-btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={ocupado} onClick={onOk}>
            {ocupado ? "Actualizando…" : "Confirmar"}
          </button>
        </>
      }
    >
      {sube === 0 ? (
        <p>Tu plan incluye {plan.barberos_incluidos} barberos. Este cupo no tiene costo adicional.</p>
      ) : (
        <>
          <p>Pasar a <b>{cupos} barberos</b> suma <b>{fmt(sube)}</b> al mes.</p>
          <div className="rowline" style={{ marginTop: 14 }}>
            <div className="grow">
              <h4 style={{ margin: 0 }}>Nuevo total mensual</h4>
              <div className="mut">Se cobra desde el próximo período</div>
            </div>
            <b style={{ fontSize: 19 }}>{fmt(nuevo)}</b>
          </div>
        </>
      )}
    </Modal>
  );
}
