"use client";
import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { useApp, uid, fmt } from "@/lib/store";

const ROLES = [["barbero", "Barbero"], ["recepcion", "Recepción"], ["admin", "Administrador"]];
const rolTxt = (r) => ROLES.find((x) => x[0] === r)?.[1] || r;

export default function Admin() {
  const app = useApp();
  const [tab, setTab] = useState("equipo");
  const [modal, setModal] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (!app) return null;
  const { rol, equipo, servicios, sucursales, barberia, update, barberiaId } = app;

  if (rol === "barbero") {
    return (
      <Shell>
        <div className="page-head"><div><h2>Administración</h2></div></div>
        <div className="empty">Esta sección requiere rol de administrador o recepción.</div>
      </Shell>
    );
  }

  const save = (key, item) => {
    update((d) => {
      const arr = d[key];
      const i = arr.findIndex((x) => x.id === item.id);
      if (i >= 0) arr[i] = item;
      else arr.push({ ...item, id: uid(), barberiaId });
      return d;
    });
    setModal(null);
  };
  const del = (key, id) => update((d) => { d[key] = d[key].filter((x) => x.id !== id); return d; });

  const linkPublico = `${origin}/b/${barberia?.slug}`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(linkPublico); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch {}
  };

  return (
    <Shell>
      <div className="page-head">
        <div><h2>Administración</h2><div className="sub">Equipo, servicios y configuración de la barbería</div></div>
      </div>

      <div className="tabs">
        {[["equipo", "Equipo"], ["servicios", "Servicios"], ["sucursales", "Sucursales"], ["barberia", "Barbería"]].map(([id, l]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>

      {tab === "equipo" && (
        <>
          <div className="toolbar">
            <span className="muted">{equipo.length} miembros del equipo</span>
            <button className="btn dark" onClick={() => setModal({ tipo: "miembro", item: { nombre: "", correo: "", telefono: "", rol: "barbero", comision: 40, activo: true } })}>+ Nuevo</button>
          </div>
          <div className="stack">
            {equipo.map((m) => (
              <div className="rowline" key={m.id}>
                <div className="avatar" style={{ background: "#111" }}>{m.nombre[0]}</div>
                <div className="grow"><h4>{m.nombre}</h4><div className="mut">{m.correo || "—"}</div></div>
                <span className="badge">{rolTxt(m.rol)}</span>
                <span className="muted">% {m.comision}%</span>
                <label className="check" style={{ fontSize: 14 }}>
                  Activo <input type="checkbox" checked={m.activo} onChange={() => save("equipo", { ...m, activo: !m.activo })} />
                </label>
                <button className="icon-btn" onClick={() => setModal({ tipo: "miembro", item: m })}>✏️</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "servicios" && (
        <>
          <div className="toolbar">
            <span className="muted">{servicios.length} servicios</span>
            <button className="btn dark" onClick={() => setModal({ tipo: "servicio", item: { nombre: "", descripcion: "", duracion: 30, precio: 0, activo: true } })}>+ Nuevo</button>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {servicios.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 24px", borderBottom: "1px solid var(--line)" }}>
                <div className="grow" style={{ flex: 1 }}><h4>{s.nombre}</h4><div className="mut">{s.duracion} min</div></div>
                <b>{fmt(s.precio)}</b>
                <button className="icon-btn" onClick={() => setModal({ tipo: "servicio", item: s })}>✏️</button>
                <button className="icon-btn red" onClick={() => del("servicios", s.id)}>🗑</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "sucursales" && (
        <>
          <div className="toolbar">
            <span className="muted">{sucursales.length} sucursales</span>
            <button className="btn dark" onClick={() => setModal({ tipo: "sucursal", item: { nombre: "", direccion: "", telefono: "", estado: "activa" } })}>+ Nueva</button>
          </div>
          <div className="stack">
            {sucursales.map((s) => (
              <div className="rowline" key={s.id}>
                <span style={{ fontSize: 20 }}>🏢</span>
                <div className="grow"><h4>{s.nombre}</h4><div className="mut">📍 {s.direccion} · 📞 {s.telefono}</div></div>
                <span className={"badge" + (s.estado === "activa" ? " green" : "")}>{s.estado === "activa" ? "Activa" : "Inactiva"}</span>
                <button className="icon-btn" onClick={() => setModal({ tipo: "sucursal", item: s })}>✏️</button>
                <button className="icon-btn red" onClick={() => del("sucursales", s.id)}>🗑</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "barberia" && (
        <div className="card" style={{ maxWidth: 760 }}>
          <div className="field">
            <label>Logo de la barbería</label>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 96, height: 96, border: "1px solid var(--line)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: "#c4c4ca" }}>🖼</div>
              <button className="btn">⬆ Subir logo (demo)</button>
            </div>
          </div>
          <div className="field">
            <label>Nombre de la barbería</label>
            <input
              value={barberia?.nombre || ""}
              onChange={(e) => update((d) => { const b = d.barberias.find((x) => x.id === barberiaId); if (b) b.nombre = e.target.value; return d; })}
            />
          </div>
          <button className="btn dark">💾 Guardar cambios</button>
          <hr style={{ margin: "26px 0", border: 0, borderTop: "1px solid var(--line)" }} />
          <div className="field">
            <label>Link de reservas público</label>
            <div className="copyrow">
              <input readOnly value={linkPublico} />
              <button className="btn" onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar"}</button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>Compártelo con tus clientes para que agenden solos.</p>
          </div>
        </div>
      )}

      {modal?.tipo === "miembro" && <MiembroModal item={modal.item} onClose={() => setModal(null)} onSave={(it) => save("equipo", it)} />}
      {modal?.tipo === "servicio" && <ServicioModal item={modal.item} onClose={() => setModal(null)} onSave={(it) => save("servicios", { ...it, duracion: Number(it.duracion), precio: Number(it.precio) })} />}
      {modal?.tipo === "sucursal" && <SucursalModal item={modal.item} onClose={() => setModal(null)} onSave={(it) => save("sucursales", it)} />}
    </Shell>
  );
}

function MiembroModal({ item, onClose, onSave }) {
  const [f, setF] = useState(item);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={item.id ? "Editar miembro" : "Nuevo miembro"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn dark" disabled={!f.nombre} onClick={() => onSave(f)}>Guardar</button></>}>
      <div className="field"><label>Nombre</label><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label>Correo</label><input value={f.correo} onChange={(e) => set("correo", e.target.value)} /></div>
        <div className="field"><label>Teléfono</label><input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
      </div>
      <div className="field">
        <label>Rol</label>
        <select value={f.rol} onChange={(e) => set("rol", e.target.value)}>
          {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="field"><label>Comisión (%)</label><input type="number" value={f.comision} onChange={(e) => set("comision", Number(e.target.value))} /></div>
      <label className="check"><input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} /> Cuenta activa</label>
    </Modal>
  );
}

function ServicioModal({ item, onClose, onSave }) {
  const [f, setF] = useState(item);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={item.id ? "Editar servicio" : "Nuevo servicio"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn dark" disabled={!f.nombre} onClick={() => onSave(f)}>Guardar</button></>}>
      <div className="field"><label>Nombre</label><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="field"><label>Descripción</label><textarea rows={3} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label>Duración (min)</label><input type="number" value={f.duracion} onChange={(e) => set("duracion", e.target.value)} /></div>
        <div className="field"><label>Precio ($)</label><input type="number" value={f.precio} onChange={(e) => set("precio", e.target.value)} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} /> Servicio activo</label>
    </Modal>
  );
}

function SucursalModal({ item, onClose, onSave }) {
  const [f, setF] = useState(item);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={item.id ? "Editar sucursal" : "Nueva sucursal"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn dark" disabled={!f.nombre} onClick={() => onSave(f)}>Guardar</button></>}>
      <div className="field"><label>Nombre</label><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="field"><label>Dirección</label><input value={f.direccion} onChange={(e) => set("direccion", e.target.value)} /></div>
      <div className="field"><label>Teléfono</label><input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
      <div className="field">
        <label>Estado</label>
        <select value={f.estado} onChange={(e) => set("estado", e.target.value)}>
          <option value="activa">Activa</option>
          <option value="inactiva">Inactiva</option>
        </select>
      </div>
    </Modal>
  );
}
