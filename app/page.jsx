"use client";
import Shell from "@/components/Shell";
import { useApp, fmt, hoyISO } from "@/lib/store";

export default function Dashboard() {
  const app = useApp();
  if (!app) return null;
  const { barberia, reservas, ingresos, clientes, barberos, servicios } = app;

  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);
  const ingresosHoy = ingresos.filter((i) => i.fecha === hoy).reduce((a, b) => a + b.monto, 0);
  const ingresosMes = ingresos.filter((i) => i.fecha.startsWith(mes)).reduce((a, b) => a + b.monto, 0);
  const reservasHoy = reservas.filter((r) => r.fecha === hoy && r.estado !== "cancelado");
  const ocupacion = barberos.length ? Math.min(100, Math.round((reservasHoy.length / (barberos.length * 10)) * 100)) : 0;

  const topServicios = servicios
    .map((s) => ({ s, n: reservas.filter((r) => r.servicioId === s.id && r.fecha.startsWith(mes) && r.estado !== "cancelado").length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  const topBarberos = barberos
    .map((b) => ({ b, total: ingresos.filter((i) => i.barberoId === b.id && i.fecha.startsWith(mes)).reduce((a, x) => a + x.monto, 0) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const fechaTxt = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <div className="sub" suppressHydrationWarning>{barberia?.nombre} · {fechaTxt}</div>
        </div>
      </div>

      <div className="cards c6">
        <div className="card stat"><span className="ico">💲</span><b>{fmt(ingresosHoy)}</b><span>Ingresos hoy</span></div>
        <div className="card stat"><span className="ico">📈</span><b>{fmt(ingresosMes)}</b><span>Ingresos mes</span></div>
        <div className="card stat"><span className="ico">📅</span><b>{reservasHoy.length}</b><span>Reservas hoy</span></div>
        <div className="card stat"><span className="ico">👥</span><b>{clientes.length}</b><span>Clientes</span></div>
        <div className="card stat"><span className="ico">✂️</span><b>{barberos.length}</b><span>Barberos activos</span></div>
        <div className="card stat"><span className="ico">⏱</span><b>{ocupacion}%</b><span>Ocupación</span></div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Agenda del día</h3>
          {reservasHoy.length === 0 && <div style={{ color: "#a6a6ae", textAlign: "center", padding: "60px 0" }}>Sin reservas para hoy.</div>}
          <div className="stack">
            {reservasHoy.map((r) => {
              const sv = servicios.find((s) => s.id === r.servicioId);
              const bb = barberos.find((b) => b.id === r.barberoId);
              return (
                <div className="rowline" key={r.id} style={{ padding: "12px 16px" }}>
                  <b>{r.hora}</b>
                  <div className="grow">
                    <h4>{r.clienteNombre}</h4>
                    <div className="mut">{sv?.nombre}{bb ? " · " + bb.nombre : ""}</div>
                  </div>
                  <span className="badge">{r.estado}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h3 style={{ marginBottom: 14 }}>Top servicios</h3>
            {topServicios.length === 0 && <div className="muted">Sin datos este mes.</div>}
            {topServicios.map(({ s, n }) => (
              <div className="kv" key={s.id}><span>{s.nombre}</span><b>{n}×</b></div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 14 }}>Top barberos</h3>
            {topBarberos.length === 0 && <div className="muted">Sin datos este mes.</div>}
            {topBarberos.map(({ b, total }) => (
              <div className="kv" key={b.id}><span>{b.nombre}</span><b>{fmt(total)}</b></div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
