"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { useApp, uid, hoyISO } from "@/lib/store";

export default function Clientes() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState(false);
  if (!app) return null;
  const { clientes, update, barberiaId } = app;

  const lista = clientes.filter((c) =>
    (c.nombre + c.telefono + c.correo).toLowerCase().includes(q.toLowerCase())
  );

  const toggleVip = (c) =>
    update((d) => {
      const x = d.clientes.find((y) => y.id === c.id);
      if (x) x.vip = !x.vip;
      return d;
    });

  const guardar = (f) => {
    update((d) => {
      d.clientes.push({ id: uid(), barberiaId, nombre: f.nombre, telefono: f.telefono, correo: f.correo, vip: false, cortes: 0, ultimaVisita: hoyISO() });
      return d;
    });
    setNuevo(false);
  };

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h2>Clientes</h2>
          <div className="sub">{clientes.length} registrados</div>
        </div>
        <button className="btn dark" onClick={() => setNuevo(true)}>+ Nuevo</button>
      </div>

      <div className="field" style={{ maxWidth: 620 }}>
        <input placeholder="Buscar por nombre, teléfono o correo..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>CLIENTE</th><th>TELÉFONO</th><th>CORREO</th><th>VIP</th></tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td><b>{c.nombre}</b></td>
                <td>{c.telefono || "—"}</td>
                <td>{c.correo || "—"}</td>
                <td>
                  <button className="icon-btn" onClick={() => toggleVip(c)} title="Marcar VIP" style={{ color: c.vip ? "#eab308" : "#d4d4d8" }}>★</button>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={4} style={{ color: "#a6a6ae", textAlign: "center", padding: 40 }}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {nuevo && <NuevoCliente onClose={() => setNuevo(false)} onSave={guardar} />}
    </Shell>
  );
}

function NuevoCliente({ onClose, onSave }) {
  const [f, setF] = useState({ nombre: "", telefono: "", correo: "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal
      title="Nuevo cliente"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={!f.nombre} onClick={() => onSave(f)}>Guardar</button>
        </>
      }
    >
      <div className="field"><label>Nombre</label><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label>Teléfono</label><input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
        <div className="field"><label>Correo</label><input value={f.correo} onChange={(e) => set("correo", e.target.value)} /></div>
      </div>
    </Modal>
  );
}
