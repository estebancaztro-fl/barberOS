"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { useApp, uid, fmt, hoyISO } from "@/lib/store";

const METODOS = ["efectivo", "transferencia", "tarjeta", "otros"];
const CATEGORIAS = ["Sueldos", "Arriendo", "Productos", "Servicios", "Otros"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export default function Finanzas() {
  const app = useApp();
  const [tab, setTab] = useState("resumen");
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [modal, setModal] = useState(null); // 'pago' | 'gasto' | {pagar: barbero}
  if (!app) return null;
  const { rol, ingresos, gastos, barberos, pagosComision, update, barberiaId } = app;

  if (rol !== "admin") {
    return (
      <Shell>
        <div className="page-head"><div><h2>Finanzas</h2><div className="sub">Solo administrador</div></div></div>
        <div className="empty">Esta sección es exclusiva del administrador.</div>
      </Shell>
    );
  }

  const iMes = ingresos.filter((i) => i.fecha.startsWith(mes));
  const gMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const totalI = iMes.reduce((a, b) => a + b.monto, 0);
  const totalG = gMes.reduce((a, b) => a + b.monto, 0);
  const cajaDiaria = iMes.filter((i) => i.fecha === hoyISO() && i.metodo === "efectivo").reduce((a, b) => a + b.monto, 0);

  const comisiones = barberos.map((b) => {
    const ing = iMes.filter((i) => i.barberoId === b.id).reduce((a, x) => a + x.monto, 0);
    const calc = Math.round((ing * (b.comision || 0)) / 100);
    const pagado = pagosComision.filter((p) => p.mes === mes && p.barberoId === b.id).reduce((a, x) => a + x.monto, 0);
    return { b, ing, calc, pagado, pendiente: Math.max(0, calc - pagado) };
  });
  const comPendientes = comisiones.reduce((a, c) => a + c.pendiente, 0);

  const mesTxt = new Date(mes + "-01T00:00:00").toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  const addIngreso = (f) => { update((d) => { d.ingresos.push({ id: uid(), barberiaId, ...f, monto: Number(f.monto) }); return d; }); setModal(null); };
  const addGasto = (f) => { update((d) => { d.gastos.push({ id: uid(), barberiaId, ...f, monto: Number(f.monto) }); return d; }); setModal(null); };
  const pagarComision = (barberoId, monto, metodo) => {
    update((d) => { d.pagosComision.push({ id: uid(), barberiaId, mes, barberoId, monto: Number(monto), metodo }); return d; });
    setModal(null);
  };

  return (
    <Shell>
      <div className="page-head">
        <div><h2>Finanzas</h2><div className="sub">Solo administrador</div></div>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: "auto" }} />
      </div>

      <div className="cards c5">
        <div className="card stat"><span className="ico">💲</span><b>{fmt(totalI)}</b><span>Ingresos mes</span></div>
        <div className="card stat"><span className="ico">📉</span><b>{fmt(totalG)}</b><span>Gastos mes</span></div>
        <div className="card stat"><span className="ico">💼</span><b>{fmt(totalI - totalG)}</b><span>Utilidad</span></div>
        <div className="card stat"><span className="ico">🕐</span><b>{fmt(comPendientes)}</b><span>Comisiones pendientes</span></div>
        <div className="card stat"><span className="ico">🧾</span><b>{fmt(cajaDiaria)}</b><span>Caja diaria</span></div>
      </div>

      <div className="toolbar">
        <div className="tabs" style={{ margin: 0 }}>
          {["resumen", "ingresos", "gastos", "comisiones"].map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{cap(t)}</button>
          ))}
        </div>
        {tab === "ingresos" && <button className="btn dark" onClick={() => setModal("pago")}>+ Pago</button>}
        {tab === "gastos" && <button className="btn dark" onClick={() => setModal("gasto")}>+ Gasto</button>}
      </div>

      {tab === "resumen" && (
        <div className="two-col">
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Ingresos por método</h3>
            {METODOS.map((m) => (
              <div className="kv" key={m}>
                <span>{cap(m)}</span>
                <b>{fmt(iMes.filter((i) => i.metodo === m).reduce((a, b) => a + b.monto, 0))}</b>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Gastos por categoría</h3>
            {CATEGORIAS.map((c) => (
              <div className="kv" key={c}>
                <span>{c}</span>
                <b>{fmt(gMes.filter((g) => g.categoria === c).reduce((a, b) => a + b.monto, 0))}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "ingresos" && (
        <div className="stack">
          {iMes.length === 0 && <div className="empty">Sin ingresos en este período.</div>}
          {[...iMes].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((i) => (
            <div className="rowline" key={i.id}>
              <span className="muted">{i.fecha}</span>
              <div className="grow"><h4>{i.concepto}</h4></div>
              <span className="badge">{cap(i.metodo)}</span>
              <b className="money-green">{fmt(i.monto)}</b>
            </div>
          ))}
        </div>
      )}

      {tab === "gastos" && (
        <div className="stack">
          {gMes.length === 0 && <div className="empty">Sin gastos en este período.</div>}
          {[...gMes].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((g) => (
            <div className="rowline" key={g.id}>
              <span className="muted">{g.fecha}</span>
              <div className="grow"><h4>{g.descripcion || g.categoria}</h4></div>
              <span className="badge">{g.categoria}</span>
              <b style={{ color: "var(--red)" }}>{fmt(g.monto)}</b>
            </div>
          ))}
        </div>
      )}

      {tab === "comisiones" && (
        <div className="card" style={{ padding: 0 }}>
          {comisiones.map(({ b, ing, calc, pagado, pendiente }) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 24px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
              <b style={{ minWidth: 130 }}>{b.nombre}</b>
              <span className="muted">Ingresos: <b style={{ color: "var(--ink)" }}>{fmt(ing)}</b></span>
              <span className="muted">{b.comision}%</span>
              <span className="muted">Calc: <b style={{ color: "var(--ink)" }}>{fmt(calc)}</b></span>
              <span className="muted">Pagado: <b className="money-green">{fmt(pagado)}</b></span>
              <span className={"right " + (pendiente > 0 ? "money-amber" : "muted")}>{fmt(pendiente)}</span>
              <button className="btn dark sm" onClick={() => setModal({ pagar: b, calc, pagado, pendiente })}>Pagar</button>
            </div>
          ))}
          <div className="muted" style={{ padding: "16px 24px" }}>
            La comisión se calcula automáticamente sobre los servicios finalizados del mes × la tasa de cada barbero.
          </div>
        </div>
      )}

      {modal === "pago" && <MovModal titulo="Registrar pago" campos="ingreso" barberos={barberos} onClose={() => setModal(null)} onSave={addIngreso} />}
      {modal === "gasto" && <MovModal titulo="Registrar gasto" campos="gasto" onClose={() => setModal(null)} onSave={addGasto} />}
      {modal?.pagar && (
        <PagarModal info={modal} mes={mes} onClose={() => setModal(null)} onSave={(monto, metodo) => pagarComision(modal.pagar.id, monto, metodo)} />
      )}
    </Shell>
  );
}

function MovModal({ titulo, campos, barberos = [], onClose, onSave }) {
  const [f, setF] = useState({
    fecha: hoyISO(), concepto: "Venta general", metodo: "efectivo",
    categoria: "Otros", descripcion: "", monto: "", barberoId: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal
      title={titulo}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={!f.monto} onClick={() => onSave(f)}>Guardar</button>
        </>
      }
    >
      <div className="grid2">
        <div className="field"><label>Fecha</label><input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></div>
        <div className="field"><label>Monto ($)</label><input type="number" value={f.monto} onChange={(e) => set("monto", e.target.value)} /></div>
      </div>
      {campos === "ingreso" && (
        <>
          <div className="field"><label>Concepto</label><input value={f.concepto} onChange={(e) => set("concepto", e.target.value)} /></div>
          <div className="grid2">
            <div className="field">
              <label>Método</label>
              <select value={f.metodo} onChange={(e) => set("metodo", e.target.value)}>
                {METODOS.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Barbero (opcional)</label>
              <select value={f.barberoId} onChange={(e) => set("barberoId", e.target.value)}>
                <option value="">—</option>
                {barberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
          </div>
        </>
      )}
      {campos === "gasto" && (
        <>
          <div className="field">
            <label>Categoría</label>
            <select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Descripción</label><input value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></div>
        </>
      )}
    </Modal>
  );
}

function PagarModal({ info, mes, onClose, onSave }) {
  const [monto, setMonto] = useState(info.pendiente);
  const [metodo, setMetodo] = useState("transferencia");
  return (
    <Modal
      title="Pagar comisión"
      sub={`${info.pagar.nombre} · ${mes}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={!monto} onClick={() => onSave(monto, metodo)}>Registrar pago</button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
        <div className="paybox"><small>Calculada</small><b>{fmt(info.calc)}</b></div>
        <div className="paybox"><small>Pagada</small><b>{fmt(info.pagado)}</b></div>
        <div className="paybox pending"><small>Pendiente</small><b style={{ color: "var(--amber)" }}>{fmt(info.pendiente)}</b></div>
      </div>
      <div className="grid2">
        <div className="field"><label>Monto a pagar</label><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
        <div className="field">
          <label>Método</label>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Comprobante (imagen)</label>
        <button className="upload">☁ Subir imagen (demo)</button>
      </div>
    </Modal>
  );
}
