"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/agenda", label: "Agenda", icon: "🗓" },
  { href: "/clientes", label: "Clientes", icon: "👥" },
  { href: "/finanzas", label: "Finanzas", icon: "💼", admin: true },
  { href: "/crm", label: "CRM", icon: "📇" },
  { href: "/admin", label: "Admin", icon: "⚙" },
];

const ROLES = { admin: "Administrador", recepcion: "Recepción", barbero: "Barbero" };

export default function Shell({ children }) {
  const app = useApp();
  const path = usePathname();
  if (!app) return null;
  const { db, barberia, sucursales, barberiaId, sucursalId, setSucursalId, rol, setRol, cambiarBarberia } = app;

  const nav = NAV.filter((n) => !(n.admin && rol !== "admin") && !(n.href === "/admin" && rol === "barbero"));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✂</div>
          <div>
            <h1>BarberOS</h1>
            <p>SaaS Barberías</p>
          </div>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}>
              <span>{n.icon}</span> {n.label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-label">BARBERÍA</div>
          <select value={barberiaId} onChange={(e) => cambiarBarberia(e.target.value)}>
            {db.barberias.map((b) => (
              <option key={b.id} value={b.id}>{b.nombre}</option>
            ))}
          </select>
          <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
          <div className="user-row">
            <div className="avatar">{(ROLES[rol] || "A")[0]}</div>
            <div className="who">
              <b>{ROLES[rol]}</b>
              <span>{barberia?.nombre}</span>
            </div>
          </div>
          <select value={rol} onChange={(e) => setRol(e.target.value)} title="Cambiar rol (demo)">
            <option value="admin">Rol: Administrador</option>
            <option value="recepcion">Rol: Recepción</option>
            <option value="barbero">Rol: Barbero</option>
          </select>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
