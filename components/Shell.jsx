"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { Scissors, Grid, Calendar, Users, Dollar, Chat, Settings, ChevronDown, X } from "@/components/Icons";

const NAV = [
  { href: "/", label: "Inicio", full: "Dashboard", Icon: Grid },
  { href: "/agenda", label: "Agenda", full: "Agenda", Icon: Calendar },
  { href: "/clientes", label: "Clientes", full: "Clientes", Icon: Users },
  { href: "/finanzas", label: "Finanzas", full: "Finanzas", Icon: Dollar, soloAdmin: true },
  { href: "/crm", label: "CRM", full: "CRM", Icon: Chat },
  { href: "/admin", label: "Admin", full: "Admin", Icon: Settings, noBarbero: true },
];

const ROLES = [
  ["admin", "Administrador", "Admin"],
  ["recepcion", "Recepción", "Recepción"],
  ["barbero", "Barbero", "Barbero"],
];

/* En celular la barra inferior muestra 4 secciones + "Más" */
const EN_BARRA = ["/", "/agenda", "/clientes", "/crm"];

export default function Shell({ children }) {
  const app = useApp();
  const path = usePathname();
  const [rolAbierto, setRolAbierto] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setRolAbierto(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => { setMasAbierto(false); }, [path]);

  if (!app) return null;
  const { barberia, sucursales, sucursalId, setSucursalId, sucursal, rol, setRol,
          barberos, usuarioId, setUsuarioId, yo } = app;
  const rolInfo = ROLES.find((r) => r[0] === rol) || ROLES[0];
  const nombreUsuario = rol === "barbero" ? (yo?.nombre || "Barbero") : rolInfo[1];

  const nav = NAV.filter(
    (n) => !(n.soloAdmin && rol !== "admin") && !(n.noBarbero && rol === "barbero")
  );
  const enBarra = nav.filter((n) => EN_BARRA.includes(n.href));
  const enMas = nav.filter((n) => !EN_BARRA.includes(n.href));
  const activo = (href) => (href === "/" ? path === "/" : path.startsWith(href));

  const Marca = () => (
    <>
      {barberia.logo
        ? <img src={barberia.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
        : <Scissors />}
    </>
  );

  return (
    <div className="shell">
      {/* ---------- Sidebar (escritorio) ---------- */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Marca /></div>
          <h1>{barberia.nombre}</h1>
        </div>

        <nav className="nav">
          {nav.map(({ href, full, Icon }) => (
            <Link key={href} href={href} className={activo(href) ? "on" : ""}>
              <Icon /> {full}
            </Link>
          ))}
        </nav>

        <div className="side-foot">
          <select className="side-select" value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            style={{ appearance: "none", WebkitAppearance: "none" }}>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>

          <div className="usermenu" ref={ref}>
            {rolAbierto && (
              <div className="pop">
                <small>CAMBIAR ROL</small>
                {ROLES.map(([v, l]) => (
                  <button key={v} className={rol === v ? "on" : ""} onClick={() => { setRol(v); setRolAbierto(false); }}>{l}</button>
                ))}
                {rol === "barbero" && barberos.length > 0 && (
                  <>
                    <small style={{ marginTop: 8 }}>QUIÉN ERES</small>
                    {barberos.map((b) => (
                      <button key={b.id} className={usuarioId === b.id ? "on" : ""}
                        onClick={() => { setUsuarioId(b.id); setRolAbierto(false); }}>{b.nombre}</button>
                    ))}
                  </>
                )}
              </div>
            )}
            <button onClick={() => setRolAbierto((v) => !v)}>
              <span className="avatar-user" />
              <span className="who"><b>{nombreUsuario}</b><span>{rolInfo[2]}</span></span>
              <ChevronDown style={{ width: 16, height: 16, opacity: 0.6 }} />
            </button>
          </div>

          <div className="side-logo"><img src="/barberos-logo.svg" alt="BarberOS" /></div>
        </div>
      </aside>

      {/* ---------- Cabecera (celular) ---------- */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-icon"><Marca /></div>
          <div className="topbar-txt">
            <b>{barberia.nombre}</b>
            <span>{sucursal?.nombre}</span>
          </div>
        </div>
        <button className="topbar-user" onClick={() => setMasAbierto(true)} aria-label="Cuenta">
          <span className="avatar-user" style={{ width: 34, height: 34 }} />
        </button>
      </header>

      <main className="content">{children}</main>

      {/* ---------- Barra inferior (celular) ---------- */}
      <nav className="tabbar">
        {enBarra.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={activo(href) ? "on" : ""}>
            <Icon /><span>{label}</span>
          </Link>
        ))}
        <button className={masAbierto ? "on" : ""} onClick={() => setMasAbierto(true)}>
          <Settings /><span>Más</span>
        </button>
      </nav>

      {/* ---------- Hoja "Más" (celular) ---------- */}
      {masAbierto && (
        <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && setMasAbierto(false)}>
          <div className="sheet">
            <div className="sheet-head">
              <b>Cuenta y ajustes</b>
              <button className="x" onClick={() => setMasAbierto(false)}><X /></button>
            </div>

            {enMas.length > 0 && (
              <div className="sheet-sec">
                <small>SECCIONES</small>
                {enMas.map(({ href, full, Icon }) => (
                  <Link key={href} href={href} className={"sheet-item" + (activo(href) ? " on" : "")}>
                    <Icon /> {full}
                  </Link>
                ))}
              </div>
            )}

            <div className="sheet-sec">
              <small>SUCURSAL</small>
              <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div className="sheet-sec">
              <small>ROL</small>
              <div className="chips">
                {ROLES.map(([v, l]) => (
                  <button key={v} className={"chip" + (rol === v ? " on" : "")} onClick={() => setRol(v)}>{l}</button>
                ))}
              </div>
            </div>

            {rol === "barbero" && barberos.length > 0 && (
              <div className="sheet-sec">
                <small>QUIÉN ERES</small>
                <div className="chips">
                  {barberos.map((b) => (
                    <button key={b.id} className={"chip" + (usuarioId === b.id ? " on" : "")}
                      onClick={() => setUsuarioId(b.id)}>{b.nombre}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="sheet-logo"><img src="/barberos-logo.svg" alt="BarberOS" /></div>
          </div>
        </div>
      )}
    </div>
  );
}
