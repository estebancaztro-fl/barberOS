"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import DetalleReserva from "@/components/DetalleReserva";
import { useApp, fmt, hoyISO, metricasBarbero } from "@/lib/store";
import { ImgIcon, Scissors, ChevronRight, Clock } from "@/components/Icons";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function DashboardBarbero() {
  const app = useApp();
  const [detalle, setDetalle] = useState(null);
  if (!app) return null;
  const { db, yo, servicios, sucursalId } = app;

  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);
  const m = metricasBarbero(db, yo.id, mes);

  const misHoy = db.reservas
    .filter((r) => r.barberoId === yo.id && r.fecha === hoy && r.sucursalId === sucursalId && r.estado !== "cancelado")
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const siguiente = misHoy.find((r) => r.estado !== "finalizado");
  const avance = m.comisionCalculada ? Math.round((m.pagado / m.comisionCalculada) * 100) : 0;
  const mesTxt = cap(new Date(mes + "-01T00:00:00").toLocaleDateString("es-CL", { month: "long" }));

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h2>Hola, {yo.nombre.split(" ")[0]}</h2>
          <div className="sub" suppressHydrationWarning>
            {misHoy.length === 0 ? "Sin reservas para hoy" : `${misHoy.length} reserva${misHoy.length > 1 ? "s" : ""} hoy`} · {mesTxt}
          </div>
        </div>
      </div>

      {/* Lo primero: a quién atiende ahora y el acceso al visagismo */}
      {siguiente && (
        <div className="proximo">
          <div className="proximo-cab">
            <span className="proximo-lbl"><Clock style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 6 }} />Siguiente · {siguiente.hora}</span>
            <b>{siguiente.clienteNombre}</b>
            <span className="muted">{servicios.find((s) => s.id === siguiente.servicioId)?.nombre}</span>
          </div>
          <button className="btn glow proximo-btn" onClick={() => setDetalle(siguiente)}>
            <ImgIcon style={{ width: 17, height: 17 }} /> Visagismo Scan
          </button>
        </div>
      )}

      <div className="cards c4" style={{ marginTop: siguiente ? 18 : 0 }}>
        <div className="card stat white"><b>{m.cortes}</b><span className="lbl">Cortes del mes</span></div>
        <div className="card stat pink"><b>{fmt(m.ingresos)}</b><span className="lbl">Generado</span></div>
        <div className="card stat rose"><b>{m.tasa}%</b><span className="lbl">Tu comisión</span></div>
        <div className="card stat dark"><b>{fmt(m.pendiente)}</b><span className="lbl">Por cobrar</span></div>
      </div>

      <div className="dash-grid">
        <div className="card plain" style={{ padding: 0 }}>
          <div className="section-head">Tu agenda de hoy</div>
          {misHoy.length === 0 ? (
            <div style={{ color: "#9c9ca6", textAlign: "center", padding: "80px 20px", fontWeight: 600 }}>
              No tienes reservas para hoy.
            </div>
          ) : (
            misHoy.map((r) => {
              const sv = servicios.find((s) => s.id === r.servicioId);
              return (
                <div className="listrow" key={r.id} onClick={() => setDetalle(r)} style={{ cursor: "pointer" }}>
                  <b style={{ fontSize: 15, minWidth: 52 }}>{r.hora}</b>
                  <div className="grow">
                    <h4>{r.clienteNombre}</h4>
                    <div className="mut">{sv?.nombre}</div>
                  </div>
                  <span className={"badge" + (r.estado === "finalizado" ? " green" : " grey")}>{r.estado}</span>
                  <ChevronRight style={{ width: 16, height: 16, color: "var(--mut)" }} />
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card dark">
            <div className="card-title" style={{ marginBottom: 14 }}>Comisión de {mesTxt}</div>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-1px", marginBottom: 4 }}>
              {fmt(m.comisionCalculada)}
            </div>
            <div className="muted" style={{ marginBottom: 16 }}>
              {m.tasa}% sobre {fmt(m.ingresos)} generados
            </div>
            <div className="progreso"><div style={{ width: Math.min(100, avance) + "%" }} /></div>
            <div className="kv" style={{ marginTop: 12 }}>
              <span>Pagado</span><b className="money-green">{fmt(m.pagado)}</b>
            </div>
            <div className="kv">
              <span>Por cobrar</span>
              <b style={{ color: m.pendiente > 0 ? "#ffb86b" : "#a9a9b4" }}>{fmt(m.pendiente)}</b>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>Tu mes</div>
            <div className="kv"><span>Clientes atendidos</span><b>{m.clientesDistintos}</b></div>
            <div className="kv"><span>Promedio por corte</span><b>{fmt(m.ticketPromedio)}</b></div>
            <div className="kv"><span>Agendados por venir</span><b>{m.agendados}</b></div>
            {m.topServicio && (
              <div className="kv">
                <span><Scissors style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 6 }} />Más pedido</span>
                <b>{m.topServicio.nombre}</b>
              </div>
            )}
          </div>
        </div>
      </div>

      {detalle && <DetalleReserva reserva={detalle} onClose={() => setDetalle(null)} />}
    </Shell>
  );
}
