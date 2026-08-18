"use client";
import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import Modal, { Toggle } from "@/components/Modal";
import { useApp, uid, fmt, aSlug } from "@/lib/store";
import { guardarMiembro, guardarBarberia } from "@/lib/datos";
import { comprimirImagen } from "@/lib/imagen";
import { CrearCuenta, RestablecerClave } from "@/components/CuentaEquipo";
import { Plus, Pencil, Trash, Upload, Save, MapPin, Phone, Building, ImgIcon, Copy, X } from "@/components/Icons";

const ROLES = [["barbero", "Barbero"], ["recepcion", "Recepción"], ["admin", "Admin"]];
const rolTxt = (r) => ROLES.find((x) => x[0] === r)?.[1] || r;

export default function Admin() {
  const app = useApp();
  const [tab, setTab] = useState("equipo");
  const [modal, setModal] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [errorEquipo, setErrorEquipo] = useState("");
  const [errorBarberia, setErrorBarberia] = useState("");
  const [nombreTmp, setNombreTmp] = useState(null);
  const [slugTmp, setSlugTmp] = useState(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (!app) return null;
  const { rol, equipo, servicios, sucursales, barberia, update, conSesion, yo, recargarEquipo } = app;

  /* Con sesión, el equipo se guarda en la base; sin ella, en el navegador */
  const guardarEnEquipo = async (item) => {
    if (!conSesion) { save("equipo", item); return; }
    const r = await guardarMiembro(item.id, item);
    if (r.error) { setErrorEquipo(r.error); setTimeout(() => setErrorEquipo(""), 4000); return; }
    setErrorEquipo("");
    await recargarEquipo();
    setModal(null);
  };

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

  /* Guarda en la base si hay sesión; si no, en el navegador */
  const aplicarBarberia = async (cambiosLocal, cambiosBase) => {
    if (!conSesion) { update((d) => { Object.assign(d.barberia, cambiosLocal); return d; }); return; }
    const r = await guardarBarberia(barberia.id, cambiosBase);
    if (r.error) { setErrorBarberia(r.error); setTimeout(() => setErrorBarberia(""), 5000); return; }
    setErrorBarberia("");
    await app.sesion?.recargarPerfil?.();
  };

  const subirLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";   // permite volver a subir el mismo archivo
    if (!file) return;
    /* Se achica bastante: el logo va en una fila de la base, no en Storage */
    const dataUrl = await comprimirImagen(file, 320, 0.8);
    await aplicarBarberia({ logo: dataUrl }, { logo_url: dataUrl });
  };

  const quitarLogo = () => aplicarBarberia({ logo: null }, { logo_url: null });

  /* Al cambiar el nombre, la dirección del link se regenera sola.
     La anterior se guarda para que los QR ya repartidos sigan sirviendo.
     Con sesión se escribe al salir del campo, no en cada tecla. */
  const nuevoSlug = (actual, anteriores, propuesto) => {
    const nuevo = aSlug(propuesto);
    if (actual === nuevo) return null;
    return {
      slug: nuevo,
      slugs_anteriores: [...new Set([...(anteriores || []), actual])].filter((s) => s && s !== nuevo),
    };
  };

  const cambiarNombre = (nombre) => {
    setNombreTmp(nombre);
    if (!conSesion) update((d) => { d.barberia.nombre = nombre; return d; });
  };

  const confirmarNombre = async () => {
    const nombre = (nombreTmp ?? barberia.nombre).trim();
    if (!nombre || nombre === barberia.nombre) { setNombreTmp(null); return; }
    const cambio = nuevoSlug(barberia.slug, barberia.slugsAnteriores, nombre);
    await aplicarBarberia(
      { nombre, ...(cambio ? { slug: cambio.slug, slugsAnteriores: cambio.slugs_anteriores } : {}) },
      { nombre, ...(cambio || {}) }
    );
    setNombreTmp(null);
  };

  const confirmarSlug = async (valor) => {
    const cambio = nuevoSlug(barberia.slug, barberia.slugsAnteriores, valor);
    setSlugTmp(null);
    if (!cambio) return;
    await aplicarBarberia(
      { slug: cambio.slug, slugsAnteriores: cambio.slugs_anteriores },
      cambio
    );
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
            <button className="btn dark" onClick={() => setModal(
              conSesion
                ? { t: "cuenta" }
                : { t: "miembro", item: { nombre: "", correo: "", telefono: "", rol: "barbero", comision: 40, activo: true } }
            )}>
              <Plus /> Nuevo
            </button>
          </div>
          <div className="stack">
            {equipo.map((m) => {
              const soyYo = conSesion && m.id === yo.id;
              return (
                <div className="rowline" key={m.id} style={m.activo ? undefined : { opacity: 0.6 }}>
                  <div className="avatar" style={{ background: "#17171a" }}>{m.nombre.charAt(0)}</div>
                  <div className="grow">
                    <h4>{m.nombre}{soyYo && <span className="badge grey" style={{ marginLeft: 8 }}>Tú</span>}</h4>
                    <div className="mut">
                      {m.telefono && <span><Phone style={{ verticalAlign: -2 }} /> {m.telefono}</span>}
                      {m.correo && <span>✉ {m.correo}</span>}
                      {m.debe_cambiar_clave && <span style={{ color: "var(--amber)" }}>Clave temporal sin usar</span>}
                    </div>
                  </div>
                  <span className="badge">{rolTxt(m.rol)}</span>
                  <span className="muted">Comisión: <b style={{ color: "var(--ink)" }}>{m.comision}%</b></span>
                  <span className="muted">Activo:</span>
                  <Toggle on={m.activo} onChange={(v) => guardarEnEquipo({ ...m, activo: v })} />
                  {conSesion && !soyYo && (
                    <button className="icon-btn" title="Restablecer clave"
                      onClick={() => setModal({ t: "clave", item: m })}>🔑</button>
                  )}
                  <button className="icon-btn" onClick={() => setModal({ t: "miembro", item: m })}><Pencil /></button>
                </div>
              );
            })}
          </div>
          {errorEquipo && <div className="login-error" style={{ marginTop: 14 }}>{errorEquipo}</div>}
          {conSesion && (
            <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
              Al desactivar a alguien deja de poder entrar, pero sus cortes y comisiones
              anteriores se conservan en las finanzas.
            </p>
          )}
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
                <b style={{ fontSize: 17, fontWeight: 600 }}>{fmt(s.precio)}</b>
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
                <div style={{ width: 46, height: 46, borderRadius: 10, background: "#17171a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
          <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 26, flexWrap: "wrap" }}>
            <div className="logo-caja">
              {barberia.logo
                ? <img src={barberia.logo} alt="Logo de la barbería" />
                : <ImgIcon style={{ width: 44, height: 44, color: "#17171a" }} />}
              {barberia.logo && (
                <button className="logo-quitar" onClick={quitarLogo} aria-label="Eliminar logo" title="Eliminar logo">
                  <X />
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className="upload" style={{ width: "auto", padding: "16px 26px", cursor: "pointer" }}>
                <Upload /> {barberia.logo ? "Cambiar imagen" : "Subir imagen"}
                <input type="file" accept="image/*" onChange={subirLogo} style={{ display: "none" }} />
              </label>
              {barberia.logo && (
                <button className="btn sm" onClick={quitarLogo} style={{ color: "var(--red)" }}>
                  <Trash style={{ width: 15, height: 15 }} /> Eliminar imagen
                </button>
              )}
            </div>
          </div>

          <div className="field">
            <label>Nombre de tu barbería</label>
            <input value={nombreTmp ?? barberia.nombre}
              onChange={(e) => cambiarNombre(e.target.value)}
              onBlur={confirmarNombre}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
          </div>
          <button className="btn dark" onClick={confirmarNombre}><Save /> Guardar cambios</button>
          {errorBarberia && <div className="login-error" style={{ marginTop: 14 }}>{errorBarberia}</div>}

          <hr className="hr" />

          <div className="field">
            <label>Link de reservas</label>
            <div className="copyrow">
              <input readOnly value={link} />
              <button className="btn glow" onClick={copiar}><Copy /> {copiado ? "¡Copiado!" : "Copiar"}</button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>Compártelo con tus clientes para que agenden solos.</p>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Dirección del link</label>
            <div className="slugrow">
              <span className="slugrow-pre">/b/</span>
              <input value={slugTmp ?? barberia.slug}
                onChange={(e) => setSlugTmp(e.target.value)}
                onBlur={(e) => confirmarSlug(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Se genera sola con el nombre de tu barbería. Puedes editarla si prefieres otra.
            </p>
            {(barberia.slugsAnteriores || []).length > 0 && (
              <div className="slug-viejos">
                <b>Los links anteriores siguen funcionando</b>
                <span>
                  {barberia.slugsAnteriores.map((s) => "/b/" + s).join(" · ")}
                </span>
                <small>Así los QR y mensajes que ya repartiste no se rompen al cambiar el nombre.</small>
              </div>
            )}
          </div>
        </div>
      )}

      {modal?.t === "cuenta" && (
        <CrearCuenta onClose={() => setModal(null)} onCreado={recargarEquipo} />
      )}
      {modal?.t === "clave" && <RestablecerClave miembro={modal.item} onClose={() => setModal(null)} />}
      {modal?.t === "miembro" && (
        <MiembroModal item={modal.item} onClose={() => setModal(null)}
          onSave={(it) => (conSesion ? guardarEnEquipo(it) : save("equipo", it))} />
      )}
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
