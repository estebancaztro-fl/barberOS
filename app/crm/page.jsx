"use client";
import { useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useApp, segmentoDe, proximaVisita, uid, hoyISO } from "@/lib/store";
import { crearCampana, crearMensajes, marcarEnviado } from "@/lib/datos";
import { armarTexto, linkWhatsApp } from "@/lib/mensajes";
import { Refresh, UserMinus, UserCheck, BarberPole, Chat, Mail, Phone, Send } from "@/components/Icons";

const SEGS = [
  { id: "volver", label: "Deberían volver", cls: "blue", Icon: Refresh, color: "#167aaf" },
  { id: "perdido", label: "Clientes perdidos", cls: "rose", Icon: UserMinus, color: "#c0392b" },
  { id: "frecuente", label: "Frecuentes", cls: "pink", Icon: UserCheck, color: "#6b7d8f" },
  { id: "vip", label: "VIP", cls: "dark", Icon: null },
];

const CANALES = [
  { id: "whatsapp", label: "Whatsapp", Icon: Chat, tint: "#d8f3e2", color: "#15803d" },
  { id: "email", label: "Email", Icon: Mail, tint: "#e4edfa", color: "#2b5fa8" },
  { id: "sms", label: "SMS", Icon: Phone, tint: "#ece4fa", color: "#6b46c1" },
];

export default function CRM() {
  const app = useApp();
  const [tab, setTab] = useState("segmentos");
  const [seg, setSeg] = useState("volver");
  const [canal, setCanal] = useState("whatsapp");
  const [segObj, setSegObj] = useState("volver");
  const [msg, setMsg] = useState("");
  const [prev, setPrev] = useState(null);
  const [enviada, setEnviada] = useState(false);
  if (!app) return null;
  const { clientes, update, conSesion, barberia, mensajes, recargar } = app;
  const [errorCampana, setErrorCampana] = useState("");

  const porSeg = (id) => clientes.filter((c) => segmentoDe(c) === id);

  const pendientesCampana = (mensajes || []).filter(
    (m) => m.tipo === "campana" && m.estado === "pendiente"
  );

  const preparar = () => {
    setPrev({ canal, seg: segObj, msg, destinos: porSeg(segObj) });
    setEnviada(false);
  };
  /* Prepara la campaña: crea un mensaje por destinatario, ya personalizado.
     Antes esto solo dejaba una fila registrada y no pasaba nada más. */
  const enviar = async () => {
    const campana = {
      canal: prev.canal, segmento: prev.seg,
      mensaje: prev.msg, destinatarios: prev.destinos.length,
    };

    const paraCliente = (c) => ({
      tipo: "campana",
      canal: prev.canal,
      clienteId: c.id,
      telefono: c.telefono || "",
      texto: armarTexto(prev.msg, { cliente: c.nombre, barberia: barberia?.nombre }),
      estado: "pendiente",
    });

    if (conSesion) {
      const r = await crearCampana(barberia.id, campana);
      if (r.error) { setErrorCampana(r.error); setTimeout(() => setErrorCampana(""), 4000); return; }

      const res = await crearMensajes(
        barberia.id,
        prev.destinos.map((c) => ({ ...paraCliente(c), campanaId: r.id }))
      );
      if (res.error) { setErrorCampana(res.error); setTimeout(() => setErrorCampana(""), 4000); return; }
      await recargar("mensajes");
    } else {
      update((d) => {
        const id = uid();
        d.campanas.push({ id, fecha: hoyISO(), ...campana, seg: prev.seg });
        d.mensajes = [
          ...(d.mensajes || []),
          ...prev.destinos.map((c) => ({ id: uid(), campanaId: id, ...paraCliente(c) })),
        ];
        return d;
      });
    }
    setEnviada(true);
  };

  /* Abre WhatsApp con el mensaje escrito y lo marca como enviado */
  const enviarUno = async (m) => {
    const link = linkWhatsApp(m.telefono, m.texto);
    if (!link) { setErrorCampana("Ese cliente no tiene un teléfono válido."); return; }
    window.open(link, "_blank", "noopener");
    if (conSesion) {
      await marcarEnviado(m.id);
      await recargar("mensajes");
    } else {
      update((d) => {
        const x = (d.mensajes || []).find((y) => y.id === m.id);
        if (x) { x.estado = "enviado"; x.enviadoEn = new Date().toISOString(); }
        return d;
      });
    }
  };

  return (
    <Shell>
      <div className="page-head">
        <div><h2>CRM</h2><div className="sub">Segmentación, fidelización y campañas</div></div>
      </div>

      <div className="cards c4">
        {SEGS.map((s) => (
          <div key={s.id} className={"card stat " + s.cls} style={{ position: "relative" }}>
            <span style={{ position: "absolute", top: 24, right: 24, color: s.color }}>
              {s.Icon ? <s.Icon style={{ width: 22, height: 22 }} /> : <BarberPole size={24} />}
            </span>
            <b>{porSeg(s.id).length}</b>
            <span className="lbl">{s.label}</span>
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
          <div className="chips" style={{ marginBottom: 18 }}>
            {SEGS.map((s) => (
              <button key={s.id} className={"chip" + (seg === s.id ? " on" : "")} onClick={() => setSeg(s.id)}>
                {s.label} <span style={{ opacity: 0.55 }}>{porSeg(s.id).length}</span>
              </button>
            ))}
          </div>
          {porSeg(seg).length === 0 ? (
            <div className="empty">Sin clientes en este segmento.</div>
          ) : (
            <div className="tablecard">
              <table>
                <thead>
                  <tr><th>CLIENTE</th><th>TELÉFONO</th><th>CORREO</th><th style={{ textAlign: "right" }}>PRÓXIMA VISITA</th></tr>
                </thead>
                <tbody>
                  {porSeg(seg).map((c) => {
                    const d = proximaVisita(c);
                    return (
                      <tr key={c.id}>
                        <td data-label="CLIENTE"><Link href={`/clientes/${c.id}`}><b style={{ fontWeight: 600 }}>{c.nombre}</b></Link></td>
                        <td data-label="TELÉFONO"><span><Phone />{c.telefono || "—"}</span></td>
                        <td data-label="CORREO"><span><Mail />{c.correo || "—"}</span></td>
                        <td data-label="PRÓXIMA VISITA" style={{ textAlign: "right", color: d === null ? "var(--mut)" : d > 0 ? "var(--accent)" : "var(--red)", fontWeight: 600 }}>
                          <span>
                            {d === null ? "sin visitas aún"
                              : d > 0 ? `sugerida: ${d} días`
                              : `atrasada ${Math.abs(d)} días`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "fidelizacion" && (
        <div className="listcard">
          {clientes.map((c) => {
            const n = (c.cortes || 0) % 6;
            return (
              <div className="listrow" key={c.id}>
                <div className="avatar">{c.nombre.charAt(0)}</div>
                <div className="grow">
                  <h4>{c.nombre}</h4>
                  <div className="mut">{c.cortes || 0} cortes acumulados</div>
                </div>
                <span className="dots">
                  {Array.from({ length: 6 }, (_, i) => <span key={i} className={"dot" + (i < n ? " on" : "")} />)}
                </span>
                <span className="muted fidel-txt">
                  {n}/6 · próximo corte gratis en <b style={{ color: "var(--accent)" }}>{6 - n}</b>
                </span>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {CANALES.map(({ id, label, Icon, tint, color }) => (
                  <button key={id} onClick={() => setCanal(id)}
                    style={{
                      background: canal === id ? tint : "rgba(255,255,255,0.75)",
                      border: canal === id ? `1.5px solid ${color}40` : "1.5px solid rgba(23,23,26,0.08)",
                      borderRadius: 10, padding: "18px 8px",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      fontSize: 14, fontWeight: 600, color: canal === id ? color : "#4a4a52",
                    }}>
                    <Icon style={{ width: 20, height: 20 }} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Segmento Objetivo</label>
              <select value={segObj} onChange={(e) => setSegObj(e.target.value)}>
                {SEGS.map((s) => <option key={s.id} value={s.id}>{s.label} ({porSeg(s.id).length})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Mensaje difusión</label>
              <textarea rows={6} placeholder="Escribe el mensaje de la campaña..." value={msg} onChange={(e) => setMsg(e.target.value)} />
            </div>
            <button className="btn dark" disabled={!msg} onClick={preparar}>Preparar campaña</button>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="card-title" style={{ fontSize: 20, marginBottom: 14 }}>Vista previa</h3>
            {!prev ? (
              <p className="muted">Configura y prepara una campaña para ver la vista previa.</p>
            ) : (
              <>
                <p className="muted" style={{ marginBottom: 12 }}>
                  {CANALES.find((c) => c.id === prev.canal)?.label} · {SEGS.find((s) => s.id === prev.seg)?.label} · {prev.destinos.length} destinatario(s)
                </p>
                <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 10, padding: 18, whiteSpace: "pre-wrap", fontSize: 15 }}>
                  {prev.msg}
                </div>
                {prev.destinos.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    {prev.destinos.map((c) => (
                      <div className="kv" key={c.id}><span>{c.nombre}</span><span className="muted">{c.telefono}</span></div>
                    ))}
                  </div>
                )}
              </>
            )}
            <div style={{ marginTop: "auto", paddingTop: 20, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14 }}>
              {errorCampana && <span className="muted" style={{ color: "var(--red)", fontWeight: 600 }}>{errorCampana}</span>}
              {enviada && !errorCampana && <span className="muted" style={{ color: "var(--green)", fontWeight: 600 }}>Lista preparada ✓</span>}
              <button className="btn dark" disabled={!prev || enviada} onClick={enviar}>
                <Send /> Preparar envíos
              </button>
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 12.5, textAlign: "right" }}>
              Puedes usar <b>{"{cliente}"}</b> en el mensaje para saludar a cada
              uno por su nombre.
            </p>
          </div>
        </div>
      )}

      {tab === "campanas" && pendientesCampana.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="toolbar" style={{ marginTop: 0 }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 20, marginBottom: 4 }}>
                Por enviar ({pendientesCampana.length})
              </h3>
              <span className="muted" style={{ fontSize: 13.5 }}>
                Se abre WhatsApp con el mensaje escrito. Tú aprietas enviar.
              </span>
            </div>
          </div>

          <div className="stack">
            {pendientesCampana.map((m) => {
              const c = clientes.find((x) => x.id === m.clienteId);
              return (
                <div className="rowline" key={m.id}>
                  <div className="grow">
                    <h4>{c?.nombre || "Cliente"}</h4>
                    <div className="mut">{m.telefono || "Sin teléfono"}</div>
                  </div>
                  <button className="btn dark sm" onClick={() => enviarUno(m)}>
                    <Send style={{ width: 15, height: 15 }} /> Enviar
                  </button>
                </div>
              );
            })}
          </div>

          <p className="muted" style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6 }}>
            WhatsApp no permite envíos automáticos desde el teléfono. Para que
            salgan solos hay que conectar la Cloud API de Meta: se explica en
            Administración → Mensajes.
          </p>
        </div>
      )}
    </Shell>
  );
}
