"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import Modal, { useGuardado, ErrorModal } from "@/components/Modal";
import { useApp, uid, fmt, hoyISO } from "@/lib/store";
import { crearIngreso, crearGasto, crearPagoComision } from "@/lib/datos";
import { Plus, Upload } from "@/components/Icons";

const METODOS = ["efectivo", "transferencia", "tarjeta", "otros"];
const CATEGORIAS = ["Sueldos", "Arriendos", "Productos", "Servicios", "Otros"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Finanzas() {
  const app = useApp();
  const [tab, setTab] = useState("resumen");
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [modal, setModal] = useState(null);
  if (!app) return null;
  const { rol, ingresos, gastos, barberos, pagosComision, update,
          conSesion, barberia, recargar } = app;

  if (rol !== "admin") {
    return (
      <Shell>
        <div className="page-head"><div><h2>Finanzas</h2><div className="sub">Solo Administrador</div></div></div>
        <div className="empty">Esta sección es exclusiva del administrador.</div>
      </Shell>
    );
  }

  const iMes = ingresos.filter((i) => i.fecha.startsWith(mes));
  const gMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const totalI = iMes.reduce((a, b) => a + b.monto, 0);
  const totalG = gMes.reduce((a, b) => a + b.monto, 0);

  const comisiones = barberos.map((b) => {
    const ing = iMes.filter((i) => i.barberoId === b.id).reduce((a, x) => a + x.monto, 0);
    const calc = Math.round((ing * (b.comision || 0)) / 100);
    const pagado = pagosComision.filter((p) => p.mes === mes && p.barberoId === b.id).reduce((a, x) => a + x.monto, 0);
    return { b, ing, calc, pagado, pendiente: Math.max(0, calc - pagado) };
  });
  const comPend = comisiones.reduce((a, c) => a + c.pendiente, 0);


  const addIngreso = async (f) => {
    if (conSesion) {
      const r = await crearIngreso(barberia.id, f);
      if (r.error) return r.error;
      await recargar("ingresos");
    } else {
      update((d) => { d.ingresos.push({ id: uid(), ...f, monto: Number(f.monto) }); return d; });
    }
    setModal(null);
    return null;
  };

  const addGasto = async (f) => {
    if (conSesion) {
      const r = await crearGasto(barberia.id, f);
      if (r.error) return r.error;
      await recargar("gastos");
    } else {
      update((d) => { d.gastos.push({ id: uid(), ...f, monto: Number(f.monto) }); return d; });
    }
    setModal(null);
    return null;
  };

  const pagar = async (barberoId, monto, metodo) => {
    if (conSesion) {
      const r = await crearPagoComision(barberia.id, { barberoId, mes, monto, metodo });
      if (r.error) return r.error;
      await recargar("pagosComision");
    } else {
      update((d) => { d.pagosComision.push({ id: uid(), mes, barberoId, monto: Number(monto), metodo }); return d; });
    }
    setModal(null);
    return null;
  };

  return (
    <Shell>
      <div className="page-head">
        <div><h2>Finanzas</h2><div className="sub">Solo Administrador</div></div>
        <div className="mes-picker">
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)}
            style={{ background: "#17171a", color: "#fff", border: 0, fontWeight: 600, padding: "14px 20px", colorScheme: "dark", boxShadow: "0 0 0 1.5px rgba(238,141,150,0.5), 0 0 0 3px rgba(130,182,222,0.3)" }} />
        </div>
      </div>

      <div className="cards c4">
        <div className="card stat white"><b>{fmt(totalI)}</b><span className="lbl">Ingresos mes</span></div>
        <div className="card stat"><b>{fmt(totalG)}</b><span className="lbl">Gastos mes</span></div>
        <div className="card stat rose"><b>{fmt(totalI - totalG)}</b><span className="lbl">Utilidad</span></div>
        <div className="card stat dark"><b>{fmt(comPend)}</b><span className="lbl">Comisiones pend.</span></div>
      </div>

      <div className="toolbar">
        <div className="tabs" style={{ margin: 0 }}>
          {["resumen", "ingresos", "gastos", "comisiones"].map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{cap(t)}</button>
          ))}
        </div>
        {tab === "ingresos" && <button className="btn dark" onClick={() => setModal("pago")}><Plus /> agregar pago</button>}
        {tab === "gastos" && <button className="btn dark" onClick={() => setModal("gasto")}><Plus /> agregar gasto</button>}
      </div>


      {tab === "resumen" && (
        <div className="two-col">
          <div className="card" style={{ padding: 0 }}>
            <div className="section-head">Ingreso por método</div>
            <div style={{ padding: "6px 26px 20px" }}>
              {METODOS.map((m) => (
                <div className="kv" key={m}>
                  <span>{cap(m)}</span>
                  <b>{fmt(iMes.filter((i) => i.metodo === m).reduce((a, b) => a + b.monto, 0))}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="section-head">Gastos por categoría</div>
            <div style={{ padding: "6px 26px 20px" }}>
              {CATEGORIAS.map((c) => (
                <div className="kv" key={c}>
                  <span>{c}</span>
                  <b>{fmt(gMes.filter((g) => g.categoria === c).reduce((a, b) => a + b.monto, 0))}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "ingresos" && (
        iMes.length === 0 ? <div className="empty">Sin ingresos en este periodo</div> : (
          <div className="listcard">
            {[...iMes].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((i) => (
              <div className="listrow" key={i.id}>
                <span className="muted mov-fecha">{i.fecha}</span>
                <div className="grow"><h4 style={{ fontWeight: 600 }}>{i.concepto}</h4></div>
                <span className="badge grey">{cap(i.metodo)}</span>
                <b className="money-green" style={{ minWidth: 92, textAlign: "right" }}>{fmt(i.monto)}</b>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "gastos" && (
        gMes.length === 0 ? <div className="empty">Sin gastos en este periodo</div> : (
          <div className="listcard">
            {[...gMes].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((g) => (
              <div className="listrow" key={g.id}>
                <span className="muted mov-fecha">{g.fecha}</span>
                <div className="grow"><h4 style={{ fontWeight: 600 }}>{g.descripcion || g.categoria}</h4></div>
                <span className="badge grey">{g.categoria}</span>
                <b className="money-red" style={{ minWidth: 92, textAlign: "right" }}>{fmt(g.monto)}</b>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "comisiones" && (
        <div className="listcard">
          {comisiones.map(({ b, ing, calc, pagado, pendiente }) => (
            <div className="listrow com-row" key={b.id} style={{ gap: 22, flexWrap: "wrap" }}>
              <b className="com-nom" style={{ minWidth: 140, fontWeight: 600 }}>{b.nombre}</b>
              <span className="muted">ingresos: <b style={{ color: "var(--ink)" }}>{fmt(ing)}</b></span>
              <span className="muted">{b.comision}%</span>
              <span className="muted">Calc: <b style={{ color: "var(--ink)" }}>{fmt(calc)}</b></span>
              <span className="muted">Pagado <b className="money-green">{fmt(pagado)}</b></span>
              <span className={"right com-pend " + (pendiente > 0 ? "money-red" : "muted")}>{fmt(pendiente)}</span>
              <button className="btn dark sm" onClick={() => setModal({ pagar: b, calc, pagado, pendiente })}>Pagar</button>
            </div>
          ))}
          <div className="muted" style={{ padding: "16px 26px", fontSize: 13 }}>
            *La comisión se calcula automáticamente sobre los servicios finalizados del mes por el % de cada barbero.
          </div>
        </div>
      )}

      {modal === "pago" && <MovModal titulo="Registrar pago" tipo="ingreso" barberos={barberos} onClose={() => setModal(null)} onSave={addIngreso} />}
      {modal === "gasto" && <MovModal titulo="Registrar gasto" tipo="gasto" onClose={() => setModal(null)} onSave={addGasto} />}
      {modal?.pagar && <PagarModal info={modal} mes={mes} onClose={() => setModal(null)} onSave={(m, met) => pagar(modal.pagar.id, m, met)} />}
    </Shell>
  );
}

function MovModal({ titulo, tipo, barberos = [], onClose, onSave }) {
  const [f, setF] = useState({
    fecha: hoyISO(), concepto: "Venta general", metodo: "efectivo",
    categoria: "Otros", descripcion: "", monto: "", barberoId: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const { enviar, error, guardando } = useGuardado(onSave);
  return (
    <Modal title={titulo} onClose={onClose}
      footer={<><button className="link-btn" onClick={onClose}>Cancelar</button>
        <button className="btn dark" disabled={!f.monto || guardando} onClick={() => enviar(f)}>
          {guardando ? "Guardando…" : "Guardar"}</button></>}>
      <div className="grid2">
        <div className="field"><label>Fecha</label><input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></div>
        <div className="field"><label>Monto ($)</label><input type="number" placeholder="0" value={f.monto} onChange={(e) => set("monto", e.target.value)} /></div>
      </div>
      {tipo === "ingreso" ? (
        <>
          <div className="field"><label>Concepto</label><input value={f.concepto} onChange={(e) => set("concepto", e.target.value)} /></div>
          <div className="grid2">
            <div className="field"><label>Método</label>
              <select value={f.metodo} onChange={(e) => set("metodo", e.target.value)}>
                {METODOS.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
              </select>
            </div>
            <div className="field"><label>Barbero (opcional)</label>
              <select value={f.barberoId} onChange={(e) => set("barberoId", e.target.value)}>
                <option value="">—</option>
                {barberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="field"><label>Categoría</label>
            <select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Descripción</label><input value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></div>
        </>
      )}
      <ErrorModal error={error} />
    </Modal>
  );
}

function PagarModal({ info, mes, onClose, onSave }) {
  const [monto, setMonto] = useState(info.pendiente);
  const [metodo, setMetodo] = useState("transferencia");
  const { enviar, error, guardando } = useGuardado(() => onSave(monto, metodo));
  return (
    <Modal title="Pagar comisión" sub={`${info.pagar.nombre}  ·  ${mes.replace("-", " - ")}`} onClose={onClose}
      footer={<><button className="link-btn" onClick={onClose}>Cancelar</button>
        <button className="btn dark" disabled={!monto || guardando} onClick={() => enviar()}>
          {guardando ? "Registrando…" : "Registrar pago"}</button></>}>
      <div className="pay-grid">
        <Box label="Calculada" valor={fmt(info.calc)} />
        <Box label="Pagada" valor={fmt(info.pagado)} />
        <Box label="Pendiente" valor={fmt(info.pendiente)} alerta />
      </div>
      <div className="grid2">
        <div className="field"><label>Monto a pagar</label><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
        <div className="field"><label>Método</label>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Comprobante (imagen)</label>
        <button className="upload"><Upload /> Subir imagen</button>
      </div>
      <ErrorModal error={error} />
    </Modal>
  );
}

function Box({ label, valor, alerta }) {
  return (
    <div style={{
      borderRadius: 10, padding: "16px 12px", textAlign: "center",
      background: alerta ? "#fdeaea" : "#f4f5f7",
    }}>
      <small style={{ display: "block", fontSize: 13, marginBottom: 5, color: alerta ? "var(--red)" : "var(--mut)", fontWeight: 600 }}>{label}</small>
      <b style={{ fontSize: 19, fontWeight: 600, color: alerta ? "var(--red)" : "var(--ink)" }}>{valor}</b>
    </div>
  );
}
