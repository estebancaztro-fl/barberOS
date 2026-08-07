"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { Scissors, Grid, Calendar, Users, Dollar, Chat, Settings, ChevronDown } from "@/components/Icons";

const NAV = [
  { href: "/", label: "Dashboard", Icon: Grid },
  { href: "/agenda", label: "Agenda", Icon: Calendar },
  { href: "/clientes", label: "Clientes", Icon: Users },
  { href: "/finanzas", label: "Finanzas", Icon: Dollar, soloAdmin: true },
  { href: "/crm", label: "CRM", Icon: Chat },
  { href: "/admin", label: "Admin", Icon: Settings, noBarbero: true },
];

const ROLES = [
  ["admin", "Administrador", "Admin"],
  ["recepcion", "Recepción", "Recepción"],
  ["barbero", "Barbero", "Barbero"],
];

export default function Shell({ children }) {
  const app = useApp();
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  if (!app) return null;
  const { barberia, sucursales, sucursalId, setSucursalId, rol, setRol } = app;
  const rolInfo = ROLES.find((r) => r[0] === rol) || ROLES[0];

  const nav = NAV.filter(
    (n) => !(n.soloAdmin && rol !== "admin") && !(n.noBarbero && rol === "barbero")
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            {barberia.logo ? <img src={barberia.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} /> : <Scissors />}
          </div>
          <h1>{barberia.nombre}</h1>
        </div>

        <nav className="nav">
          {nav.map(({ href, label, Icon }) => {
            const on = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={on ? "on" : ""}>
                <Icon /> {label}
              </Link>
            );
          })}
        </nav>

        <div className="side-foot">
          <select
            className="side-select"
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            style={{ appearance: "none", WebkitAppearance: "none" }}
          >
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>

          <div className="usermenu" ref={ref}>
            {abierto && (
              <div className="pop">
                <small>CAMBIAR ROL</small>
                {ROLES.map(([v, l]) => (
                  <button key={v} className={rol === v ? "on" : ""} onClick={() => { setRol(v); setAbierto(false); }}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setAbierto((v) => !v)}>
              <span className="avatar-user" />
              <span className="who">
                <b>Nombre Usuario</b>
                <span>{rolInfo[2]}</span>
              </span>
              <ChevronDown style={{ width: 16, height: 16, opacity: 0.6 }} />
            </button>
          </div>

          <div className="side-logo">
            <img src="/barberos-logo.svg" alt="BarberOS" />
          </div>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
