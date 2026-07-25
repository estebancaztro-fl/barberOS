"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import { useApp, segmentoDe, uid, hoyISO } from "@/lib/store";

const SEGS = [
  { id: "volver", label: "Deberían volver", tint: "tint-blue", ico: "🔄" },
  { id: "perdido", label: "Clientes perdidos", tint: "tint-red", ico: "👤" },
  { id: "frecuente", label: "Frecuentes", tint: "tint-green", ico: "👥" },
  { id: "vip", label: "VIP", tint: "tint-yellow", ico: "⭐" },
];

export default function CRM() {
  const app = useApp();
  const [tab, setTab] = useState("segmentos");
  const [seg, setSeg] = useState("volver");
  const [canal, setCanal] = useState("whatsapp");
  const [segObj, setSegObj] = useState("volver");
  const [msg, setMsg] = useState("");
  const [preparada, setPreparada] = useState(null);
  if (!app) return null;
  const { clientes, update, barberiaId } = app;

  const porSeg = (id) => clientes.filter((c) => segmentoDe(c) === id);

  const preparar = () => {
    const destinos = porSeg(segObj);
    setPreparada({ canal, seg: segObj, msg, n: destinos.length, destinos });
    update((d) => {
      d.campanas.push({ id: uid(), barberiaId, fecha: hoyISO(), canal, segmento: segObj, mensaje: msg, destinatarios: destinos.length });
      return d;
    });
  };

  return (
    <Shell>
      <div className="page-head">
        <div><h2>CRM</h2><div className="sub">Segmentación, fidelización y campañas</div></div>
      </div>

      <div className="cards c4">
        {SEGS.map((s) => (
          <div key={s.id} className={"card stat " + s.tint}>
            <span className="ico">{s.ico}</span>
            <b>{porSeg(s.id).length}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="tabs">
        {[["segmentos", "Segmentos"], ["fidelizacion", "Fidelización"], ["campanas", "Campañas"]].map(([id, l]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>

      {tab === "segmentos" && (
        <>
          <div className="chips" style={{ marginBottom: 16 }}>
            {SEGS.map((s) => (
              <button key={s.id} className={"chip" + (seg === s.id ? " on" : "")} onClick={() => setSeg(s.id)}>
                {s.label} <span style={{ opacity: 0.6 }}>{porSeg(s.id).length}</span>
              </button>
            ))}
          </div>
          {porSeg(seg).length === 0 ? (
            <div className="empty">Sin clientes en este segmento.</div>
          ) : (
            <div className="stack">
              {porSeg(seg).map((c) => (
                <div className="rowline" key={c.id}>
                  <div className="avatar" style={{ background: "#111" }}>{c.nombre[0]}</div>
                  <div className="grow">
                    <h4>{c.nombre}</h4>
                    <div className="mut">{c.telefono} · última visita {c.ultimaVisita}</div>
                  </div>
                  {c.vip && <span style={{ color: "#eab308" }}>★</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "fidelizacion" && (
        <div className="stack">
          {clientes.map((c) => {
            const n = (c.cortes || 0) % 6;
            return (
              <div className="rowline" key={c.id}>
                <div className="avatar" style={{ background: "#111" }}>{c.nombre[0]}</div>
                <div className="grow">
                  <h4>{c.nombre}</h4>
                  <div className="mut">{c.cortes || 0} cortes acumulados</div>
                </div>
                <span className="dots">
                  {Array.from({ length: 6 }, (_, i) => <span key={i} className={"dot" + (i < n ? " on" : "")} />)}
                </span>
                <span className="muted">{n}/6 · próximo corte gratis en {6 - n}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === "campanas" && (
        <div className="two-col">
          <div className="card">
            <div className="field">
              <label>Canal</label>
              <div className="chips">
                {[["whatsapp", "WhatsApp 🟢"], ["email", "Email ✉️"], ["sms", "SMS 📱"]].map(([id, l]) => (
                  <button key={id} className={"chip" + (canal === id ? " on" : "")} onClick={() => setCanal(id)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Segmento objetivo</label>
              <select value={segObj} onChange={(e) => setSegObj(e.target.value)}>
                {SEGS.map((s) => <option key={s.id} value={s.id}>{s.label} ({porSeg(s.id).length})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Mensaje</label>
              <textarea rows={5} placeholder="Escribe el mensaje de la campaña..." value={msg} onChange={(e) => setMsg(e.target.value)} />
            </div>
            <button className="btn dark" disabled={!msg} onClick={preparar}>➤ Preparar campaña</button>
            <p className="muted" style={{ marginTop: 14 }}>
              Los envíos no están activos. La campaña queda preparada para futura integración con WhatsApp/Email/SMS.
            </p>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Vista previa</h3>
            {!preparada ? (
              <p className="muted">Configura y prepara una campaña para ver la vista previa.</p>
            ) : (
              <>
                <p className="muted" style={{ marginBottom: 10 }}>
                  {preparada.canal.toUpperCase()} · {SEGS.find((s) => s.id === preparada.seg)?.label} · {preparada.n} destinatario(s)
                </p>
                <div style={{ background: "#f0f0f2", borderRadius: 14, padding: 16, whiteSpace: "pre-wrap" }}>{preparada.msg}</div>
                {preparada.destinos.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    {preparada.destinos.map((c) => <div className="kv" key={c.id}><span>{c.nombre}</span><span className="muted">{c.telefono}</span></div>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
