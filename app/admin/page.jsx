"use client";
import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import Modal, { Toggle } from "@/components/Modal";
import { useApp, uid, fmt } from "@/lib/store";
import { Plus, Pencil, Trash, Upload, Save, MapPin, Phone, Building, ImgIcon, Copy } from "@/components/Icons";

const ROLES = [["barbero", "Barbero"], ["recepcion", "Recepción"], ["admin", "Admin"]];
const rolTxt = (r) => ROLES.find((x) => x[0] === r)?.[1] || r;

export default function Admin() {
  const app = useApp();
  const [tab, setTab] = useState("equipo");
  const [modal, setModal] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (!app) return null;
  const { rol, equipo, servicios, sucursales, barberia, update } = app;

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
      const i = d[key].findIndex((x) => x.id === item.id);
      if (i >= 0) d[key][i] = item; else d[key].push({ ...item, id: uid() });
      return d;
    });
    setModal(null);
  };
  const del = (key, id) => update((d) => { d[key] = d[key].filter((x) => x.id !== id); return d; });

  const link = `${origin}/b/${barberia.slug}`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch {}
  };

  const subirLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => update((d) => { d.barberia.logo = rd.result; return d; });
    rd.readAsDataURL(file);
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
            <button className="btn dark" onClick={() => setModal({ t: "miembro", item: { nombre: "", correo: "", telefono: "", rol: "barbero", comision: 40, activo: true } })}>
              <Plus /> Nuevo
            </button>
          </div>
          <div className="stack">
            {equipo.map((m) => (
              <div className="rowline" key={m.id}>
                <div className="avatar" style={{ background: "#17171a" }} />
                <div className="grow">
                  <h4>{m.nombre}</h4>
                  <div className="mut">{m.telefono && <span><Phone style={{ verticalAlign: -2 }} /> {m.telefono}</span>}{m.correo && <span>✉ {m.correo}</span>}</div>
                </div>
                <span className="badge">{rolTxt(m.rol)}</span>
                <span className="muted">Comisión: <b style={{ color: "var(--ink)" }}>{m.comision}%</b></span>
                <span className="muted">Activo:</span>
                <Toggle on={m.activo} onChange={(v) => save("equipo", { ...m, activo: v })} />
                <button className="icon-btn" onClick={() => setModal({ t: "miembro", item: m })}><Pencil /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "servicios" && (
        <>
          <div className="toolbar">
            <span className="muted">{servicios.length} servicios</span>
            <button className="btn dark" onClick={() => setModal({ t: "servicio", item: { nombre: "", descripcion: "", duracion: 30, precio: 0, activo: true, foto: null } })}>
              <Plus /> agregar servicio
            </button>
          </div>
          <div className="listcard">
            {servicios.map((s) => (
              <div className="listrow" key={s.id}>
                <div className="grow">
                  <h4>{s.nombre}</h4>
                  <div className="mut">{s.duracion} min</div>
                </div>
                <b style={{ fontSize: 17, fontWeight: 700 }}>{fmt(s.precio)}</b>
                <button className="icon-btn" onClick={() => setModal({ t: "servicio", item: s })}><Pencil /></button>
                <button className="icon-btn red" onClick={() => del("servicios", s.id)}><Trash /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "sucursales" && (
        <>
          <div className="toolbar">
            <span className="muted">{sucursales.length} sucursales</span>
            <button className="btn dark" onClick={() => setModal({ t: "sucursal", item: { nombre: "", direccion: "", telefono: "", activa: true } })}>
              <Plus /> agregar sucursal
            </button>
          </div>
          <div className="stack">
            {sucursales.map((s) => (
              <div className="rowline" key={s.id}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: "#17171a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building style={{ width: 22, height: 22 }} />
                </div>
                <div className="grow">
                  <h4>{s.nombre}</h4>
                  <div className="mut">
                    <span><MapPin style={{ verticalAlign: -2 }} /> {s.direccion}</span>
                    <span><Phone style={{ verticalAlign: -2 }} /> {s.telefono}</span>
                  </div>
                </div>
                <span className="muted">Activo:</span>
                <Toggle on={s.activa} onChange={(v) => save("sucursales", { ...s, activa: v })} />
                <button className="icon-btn" onClick={() => setModal({ t: "sucursal", item: s })}><Pencil /></button>
                <button className="icon-btn red" onClick={() => del("sucursales", s.id)}><Trash /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "barberia" && (
        <div className="card" style={{ maxWidth: 720, padding: 32 }}>
          <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 26 }}>
            <div style={{ width: 124, height: 124, borderRadius: 18, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {barberia.logo
                ? <img src={barberia.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <ImgIcon style={{ width: 44, height: 44, color: "#17171a" }} />}
            </div>
            <label className="upload" style={{ width: "auto", padding: "16px 26px", cursor: "pointer" }}>
              <Upload /> Subir imagen
              <input type="file" accept="image/*" onChange={subirLogo} style={{ display: "none" }} />
            </label>
          </div>

          <div className="field">
            <label>Nombre de tu barbería</label>
            <input value={barberia.nombre}
              onChange={(e) => update((d) => { d.barberia.nombre = e.target.value; return d; })} />
          </div>
          <button className="btn dark"><Save /> Guardar cambios</button>

          <hr className="hr" />

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Link de reservas</label>
            <div className="copyrow">
              <input readOnly value={link} />
              <button className="btn glow" onClick={copiar}><Copy /> {copiado ? "¡Copiado!" : "Copiar"}</button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>Compártelo con tus clientes para que agenden solos.</p>
          </div>
        </div>
      )}

      {modal?.t === "miembro" && <MiembroModal item={modal.item} onClose={() => setModal(null)} onSave={(it) => save("equipo", it)} />}
      {modal?.t === "servicio" && <ServicioModal item={modal.item} onClose={() => setModal(null)} onSave={(it) => save("servicios", { ...it, duracion: Number(it.duracion) || 0, precio: Number(it.precio) || 0 })} />}
      {modal?.t === "sucursal" && <SucursalModal item={modal.item} onClose={() => setModal(null)} onSave={(it) => save("sucursales", it)} />}
    </Shell>
  );
}

function MiembroModal({ item, onClose, onSave }) {
  const [f, setF] = useState(item);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title="Editar / Agregar miembro" onClose={onClose}
      footer={<><button className="link-btn" onClick={onClose}>Cancelar</button>
        <button className="btn dark" disabled={!f.nombre} onClick={() => onSave(f)}>Guardar</button></>}>
      <div className="field"><label>Nombre</label><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label>Correo</label><input placeholder="correo@mail.com" value={f.correo} onChange={(e) => set("correo", e.target.value)} /></div>
        <div className="field"><label>Teléfono</label><input placeholder="+56 9 0000 0000" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
      </div>
      <div className="rol-grid">
        <div className="field">
          <label>Rol asignado</label>
          <div className="chips">
            {ROLES.map(([v, l]) => (
              <button key={v} className={"chip" + (f.rol === v ? " on" : "")} onClick={() => set("rol", v)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label style={{ color: "var(--accent)" }}>Comisión (%)</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input type="number" value={f.comision} onChange={(e) => set("comision", Number(e.target.value))} />
            <Toggle on={f.activo} onChange={(v) => set("activo", v)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ServicioModal({ item, onClose, onSave }) {
  const [f, setF] = useState(item);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const subir = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => set("foto", rd.result);
    rd.readAsDataURL(file);
  };
  return (
    <Modal title="Editar / Agregar Servicio" onClose={onClose}
      footer={<><button className="link-btn" onClick={onClose}>Cancelar</button>
        <button className="btn dark" disabled={!f.nombre} onClick={() => onSave(f)}>Guardar</button></>}>
      <div className="field"><label>Nombre</label><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label>Tiempo</label><input type="number" placeholder="20" value={f.duracion} onChange={(e) => set("duracion", e.target.value)} /></div>
        <div className="field"><label>Precio</label><input type="number" placeholder="5000" value={f.precio} onChange={(e) => set("precio", e.target.value)} /></div>
      </div>
      <div className="field"><label>Descripción</label><textarea rows={2} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></div>
      <div className="field">
        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Imagen del servicio</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 500 }}>Activo <Toggle on={f.activo} onChange={(v) => set("activo", v)} /></span>
        </label>
        <label className="upload" style={{ cursor: "pointer" }}>
          {f.foto ? <img src={f.foto} alt="" style={{ height: 60, borderRadius: 10 }} /> : <><Upload /> Subir imagen</>}
          <input type="file" accept="image/*" onChange={subir} style={{ display: "none" }} />
        </label>
      </div>
    </Modal>
  );
}

function SucursalModal({ item, onClose, onSave }) {
  const [f, setF] = useState(item);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title="Editar / Agregar Sucursal" onClose={onClose}
      footer={<><button className="link-btn" onClick={onClose}>Cancelar</button>
        <button className="btn dark" disabled={!f.nombre} onClick={() => onSave(f)}>Guardar</button></>}>
      <div className="field"><label>Nombre</label><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="field"><label>Dirección</label><input value={f.direccion} onChange={(e) => set("direccion", e.target.value)} /></div>
      <div className="field"><label>Teléfono</label><input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 12 }}>Activa <Toggle on={f.activa} onChange={(v) => set("activa", v)} /></label>
      </div>
    </Modal>
  );
}
