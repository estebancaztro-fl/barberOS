"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { useApp, uid, hoyISO } from "@/lib/store";
import { crearCliente, guardarCliente, darConsentimiento } from "@/lib/datos";
import { Search, Phone, Mail, Plus, BarberPole } from "@/components/Icons";

export default function Clientes() {
  const app = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState("");
  if (!app) return null;
  const { clientes, update, conSesion, barberia, recargar } = app;

  const lista = clientes.filter((c) =>
    (c.nombre + " " + c.telefono + " " + c.correo).toLowerCase().includes(q.toLowerCase())
  );

  const guardar = async (f) => {
    if (conSesion) {
      const r = await crearCliente(barberia.id, f);
      if (r.error) { setError(r.error); return; }
      /* Queda registrado el consentimiento que el cliente dio en el mostrador */
      if (f.aceptaDatos && r.datos?.id) {
        await darConsentimiento(barberia.id, r.datos.id, "datos_basicos");
      }
      await recargar("clientes");
      setError("");
      setNuevo(false);
      return;
    }
    update((d) => {
      d.clientes.push({
        id: uid(), nombre: f.nombre, telefono: f.telefono, correo: f.correo,
        vip: false, cortes: 0, ultimaVisita: hoyISO(),
        observaciones: "", tipoPelo: "", densidad: "", formaRostro: "", notasVoz: [], visagismo: null,
      });
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
      </div>

      <div className="toolbar">
        <div style={{ position: "relative", flex: 1, maxWidth: 560 }}>
          <Search style={{ width: 18, height: 18, position: "absolute", left: 17, top: 15, color: "#b3b3bb" }} />
          <input style={{ paddingLeft: 46, background: "rgba(255,255,255,0.9)", border: 0 }}
            placeholder="Buscar por nombre, teléfono o correo..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn glow" onClick={() => setNuevo(true)}><Plus /> Añadir Cliente</button>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="tablecard">
        <table>
          <thead>
            <tr><th>CLIENTE</th><th>TELÉFONO</th><th>CORREO</th><th style={{ textAlign: "right" }}>VIP</th></tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} onClick={() => router.push(`/clientes/${c.id}`)} style={{ cursor: "pointer" }}>
                <td data-label="CLIENTE">
                  <b style={{ fontWeight: 600 }}>{c.nombre}</b>
                  {c.vip && <span className="solo-movil"><BarberPole size={20} /></span>}
                </td>
                <td data-label="TELÉFONO"><span><Phone />{c.telefono || "—"}</span></td>
                <td data-label="CORREO"><span><Mail />{c.correo || "—"}</span></td>
                <td data-label="VIP" className="col-vip" style={{ textAlign: "right" }}>
                  {c.vip ? <BarberPole size={22} /> : <span className="solo-movil muted">—</span>}
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={4} style={{ color: "#9c9ca6", textAlign: "center", padding: 48, fontWeight: 600 }}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {nuevo && <NuevoCliente onClose={() => setNuevo(false)} onSave={guardar} />}
    </Shell>
  );
}

function NuevoCliente({ onClose, onSave }) {
  const [f, setF] = useState({ nombre: "", telefono: "", correo: "", aceptaDatos: false });
  const [enviando, setEnviando] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const enviar = async () => { setEnviando(true); await onSave(f); setEnviando(false); };

  return (
    <Modal
      title="Añadir cliente" onClose={onClose}
      footer={
        <>
          <button className="link-btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" disabled={!f.nombre || !f.aceptaDatos || enviando}
            onClick={enviar}>{enviando ? "Guardando…" : "Guardar"}</button>
        </>
      }
    >
      <div className="field"><label>Nombre</label><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label>Correo</label><input placeholder="cliente@mail.com" value={f.correo} onChange={(e) => set("correo", e.target.value)} /></div>
        <div className="field"><label>Teléfono</label><input placeholder="+56 9 0000 0000" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
      </div>

      {/* Consentimiento: lo exige la Ley 21.719 antes de guardar datos personales */}
      <label className="consentimiento">
        <input type="checkbox" checked={f.aceptaDatos}
          onChange={(e) => set("aceptaDatos", e.target.checked)} />
        <span>El cliente autoriza guardar su nombre y contacto para gestionar sus reservas.</span>
      </label>
    </Modal>
  );
}
