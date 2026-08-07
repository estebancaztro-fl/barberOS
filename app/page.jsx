"use client";
import Shell from "@/components/Shell";
import { useApp, fmt, hoyISO } from "@/lib/store";
import { Money } from "@/components/Icons";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Dashboard() {
  const app = useApp();
  if (!app) return null;
  const { sucursal, reservas, ingresos, clientes, barberos, servicios } = app;

  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);
  const ingresosHoy = ingresos.filter((i) => i.fecha === hoy).reduce((a, b) => a + b.monto, 0);
  const ingresosMes = ingresos.filter((i) => i.fecha.startsWith(mes)).reduce((a, b) => a + b.monto, 0);
  const reservasHoy = reservas.filter((r) => r.fecha === hoy && r.estado !== "cancelado");
  const ocupacion = barberos.length ? Math.min(100, Math.round((reservasHoy.length / (barberos.length * 10)) * 100)) : 0;

  const topServicios = servicios
    .map((s) => ({ s, n: reservas.filter((r) => r.servicioId === s.id && r.fecha.startsWith(mes) && r.estado !== "cancelado").length }))
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5);

  const topBarberos = barberos
    .map((b) => ({ b, total: ingresos.filter((i) => i.barberoId === b.id && i.fecha.startsWith(mes)).reduce((a, x) => a + x.monto, 0) }))
    .filter((x) => x.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

  const fechaTxt = cap(new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }));

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <div className="sub" suppressHydrationWarning>{fechaTxt} · {sucursal?.nombre}</div>
        </div>
      </div>

      <div className="cards c5">
        <div className="card stat white"><b>{fmt(ingresosHoy)}</b><span className="lbl">Ingresos hoy</span></div>
        <div className="card stat"><b>{reservasHoy.length}</b><span className="lbl">Reservas hoy</span></div>
        <div className="card stat pink"><b>{clientes.length}</b><span className="lbl">Clientes</span></div>
        <div className="card stat pink"><b>{barberos.length}</b><span className="lbl">Barberos activos</span></div>
        <div className="card stat rose"><b>{ocupacion}%</b><span className="lbl">Ocupación</span></div>
      </div>

      <div className="dash-grid">
        <div className="card plain" style={{ padding: 0 }}>
          <div className="section-head">Agenda del día</div>
          {reservasHoy.length === 0 ? (
            <div style={{ color: "#9c9ca6", textAlign: "center", padding: "110px 20px", fontWeight: 600 }}>
              Sin reservas para hoy.
            </div>
          ) : (
            <div>
              {[...reservasHoy].sort((a, b) => a.hora.localeCompare(b.hora)).map((r) => {
                const sv = servicios.find((s) => s.id === r.servicioId);
                const bb = barberos.find((b) => b.id === r.barberoId);
                return (
                  <div className="listrow" key={r.id}>
                    <b style={{ fontSize: 15, minWidth: 52 }}>{r.hora}</b>
                    <div className="grow">
                      <h4>{r.clienteNombre}</h4>
                      <div className="mut">{sv?.nombre}{bb ? " · " + bb.nombre : ""}</div>
                    </div>
                    <span className="badge grey">{r.estado}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card white" style={{ display: "flex", alignItems: "center", gap: 18, background: "linear-gradient(140deg,#fff,#f4f9fe)" }}>
            <Money style={{ width: 34, height: 34, color: "#c9a227", flexShrink: 0 }} />
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <b style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-1px", display: "block" }}>{fmt(ingresosMes)}</b>
              <span style={{ color: "#5f5f68", fontSize: 15 }}>Ingresos mes</span>
            </div>
          </div>

          <div className="card dark" style={{ padding: 0 }}>
            <div className="section-head">Top servicios</div>
            <div style={{ padding: "6px 26px 18px" }}>
              {topServicios.length === 0 && <div className="muted" style={{ padding: "14px 0" }}>Sin datos este mes.</div>}
              {topServicios.map(({ s, n }) => (
                <div className="kv" key={s.id}><span style={{ color: "#fff" }}>{s.nombre}</span><b>{n}×</b></div>
              ))}
            </div>
          </div>

          <div className="card dark" style={{ padding: 0 }}>
            <div className="section-head">Top barberos</div>
            <div style={{ padding: "6px 26px 18px" }}>
              {topBarberos.length === 0 && <div className="muted" style={{ padding: "14px 0" }}>Sin datos este mes.</div>}
              {topBarberos.map(({ b, total }) => (
                <div className="kv" key={b.id}><span style={{ color: "#fff" }}>{b.nombre}</span><b>{fmt(total)}</b></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
