"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import AnalisisRostro from "@/components/AnalisisRostro";
import { VisorFoto } from "@/components/DetalleReserva";
import { useApp, proximaVisita, INTERVALO_SUGERIDO } from "@/lib/store";
import { FORMAS, registroVisagismo, copiarRecomendacion, estaDesactualizada } from "@/lib/rostro";
import { ChevronLeft, Phone, Mail, Mic, ImgIcon, Clock, Scissors, Note, Save, BarberPole, X } from "@/components/Icons";

const TIPO_PELO = ["Liso", "Ondulado", "Rulo", "Afro"];
const DENSIDAD = ["Fino", "Medio", "Grueso"];
const ROSTRO = ["Redondo", "Cuadrado", "Alargado", "Triangular", "Invertido", "Ovalado"];

export default function FichaCliente() {
  const app = useApp();
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [foto, setFoto] = useState(null);

  const cliente = app?.clientes.find((c) => c.id === id);

  useEffect(() => {
    if (cliente && !form) {
      setForm({
        observaciones: cliente.observaciones || "",
        tipoPelo: cliente.tipoPelo || "",
        densidad: cliente.densidad || "",
        formaRostro: cliente.formaRostro || "",
      });
    }
  }, [cliente, form]);

  if (!app) return null;
  if (!cliente) {
    return (
      <Shell>
        <div className="empty">Cliente no encontrado.</div>
      </Shell>
    );
  }
  if (!form) return <Shell><div className="empty">Cargando…</div></Shell>;

  const { update, reservas, servicios, equipo } = app;
  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setGuardado(false); };

  const guardar = () => {
    update((d) => {
      const c = d.clientes.find((x) => x.id === id);
      if (!c) return d;
      Object.assign(c, form);
      /* Si eligió la forma a mano, también se guarda copia del consejo */
      if (form.formaRostro && c.visagismo?.forma !== form.formaRostro) {
        c.visagismo = registroVisagismo({
          forma: form.formaRostro, origen: "manual", fecha: hoyISO(),
        });
      }
      if (!form.formaRostro) c.visagismo = null;
      return d;
    });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  /* Trae la ficha al catálogo vigente, dejando constancia de la fecha */
  const actualizarRecomendacion = () => {
    update((d) => {
      const c = d.clientes.find((x) => x.id === id);
      if (c?.visagismo) {
        c.visagismo.recomendacion = copiarRecomendacion(c.visagismo.forma);
        c.visagismo.actualizada_en = hoyISO();
      }
      return d;
    });
  };

  /* Guarda el resultado del análisis. La foto nunca se almacena, ni tampoco
     las proporciones del rostro: son medidas biométricas. Sí queda copia
     fija de la recomendación dada ese día. */
  const usarAnalisis = (r) => {
    setForm((p) => ({ ...p, formaRostro: r.forma }));
    update((d) => {
      const c = d.clientes.find((x) => x.id === id);
      if (c) {
        c.formaRostro = r.forma;
        c.visagismo = registroVisagismo({
          forma: r.forma,
          similitud: r.ranking[0].similitud,
          confianza: r.confianza,
          origen: "scan",
          fecha: hoyISO(),
        });
      }
      return d;
    });
    setAnalizando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  /* Se muestra la copia guardada, no el catálogo vivo: la ficha conserva
     lo que se le dijo al cliente. Fichas antiguas sin copia caen al catálogo. */
  const vis = cliente.visagismo || null;
  const reco = vis?.forma === form.formaRostro && vis?.recomendacion
    ? vis.recomendacion
    : (form.formaRostro ? FORMAS[form.formaRostro] : null);
  const desactualizada = vis?.forma === form.formaRostro && estaDesactualizada(vis);

  const historial = reservas
    .filter((r) => r.clienteId === id && r.estado !== "cancelado")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const dias = proximaVisita(cliente);

  return (
    <Shell>
      <button className="back-link" onClick={() => router.push("/clientes")}>
        <ChevronLeft /> Volver a clientes
      </button>

      <div className="card plain" style={{ padding: 0, marginBottom: 20 }}>
        <div className="client-head">
          <div className="avatar">{cliente.nombre.charAt(0)}</div>
          <div className="grow" style={{ flex: 1 }}>
            <h2>
              {cliente.nombre}
              {cliente.vip && <span style={{ marginLeft: 10, verticalAlign: "-4px", display: "inline-block" }}><BarberPole size={22} /></span>}
            </h2>
            <div className="mut">
              <span><Phone style={{ verticalAlign: -3, marginRight: 7 }} />{cliente.telefono || "—"}</span>
              <span><Mail style={{ verticalAlign: -3, marginRight: 7 }} />{cliente.correo || "—"}</span>
            </div>
          </div>
          <button className="btn dark" onClick={guardar}>
            <Save /> {guardado ? "¡Guardado!" : "Guardar cambios"}
          </button>
        </div>
        <div className="obs-block">
          <div className="lbl">OBSERVACIONES</div>
          <textarea
            rows={2}
            style={{ background: "transparent", border: 0, padding: 0, fontSize: 16, resize: "vertical" }}
            placeholder="Escribe una observación general del cliente..."
            value={form.observaciones}
            onChange={(e) => set("observaciones", e.target.value)}
          />
        </div>
      </div>

      <div className="card plain" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <Note style={{ width: 21, height: 21 }} />
          <h3 style={{ fontSize: 21, fontWeight: 700 }}>Notas técnicas y visagismo</h3>
        </div>

        {/* El visagismo es lo que más usa el barbero: va primero y completo */}
        <button className="scan-cta" onClick={() => setAnalizando(true)} style={{ marginBottom: 22 }}>
          <span className="scan-cta-ico"><ImgIcon /></span>
          <span className="grow">
            <b>Visagismo Scan</b>
            <span>{form.formaRostro ? `${form.formaRostro} · toca para repetir el análisis` : "Analiza el rostro y recibe el corte recomendado"}</span>
          </span>
        </button>

        {/* El resumen queda guardado en la ficha: es lo que el barbero
            consulta antes de empezar a cortar. */}
        {reco && (
          <div className="reco-box">
            <div className="reco-cab">
              <b>{form.formaRostro}</b>
              {vis?.forma === form.formaRostro ? (
                <span className="muted">
                  {vis.origen === "scan"
                    ? `${vis.similitud}% de coincidencia · escaneado el ${vis.fecha}`
                    : `Definido a mano el ${vis.fecha}`}
                  {vis.actualizada_en && ` · consejo actualizado el ${vis.actualizada_en}`}
                </span>
              ) : (
                <span className="muted">Sin guardar todavía</span>
              )}
            </div>

            {desactualizada && (
              <div className="reco-aviso">
                <span className="grow">
                  Este consejo se dio con una versión anterior del catálogo. Se mantiene tal cual como constancia.
                </span>
                <button className="btn sm" onClick={actualizarRecomendacion}>Actualizar</button>
              </div>
            )}

            <p style={{ lineHeight: 1.6, margin: "14px 0 18px" }}>{reco.resumen}</p>
            <div className="two-col" style={{ gap: 18 }}>
              <div>
                <div className="bloque-t"><Scissors style={{ width: 15, height: 15, verticalAlign: -3, marginRight: 7 }} />Cortes que favorecen</div>
                <ul className="lista si">{reco.favorece.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
              <div>
                <div className="bloque-t"><X style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 7 }} />Mejor evitar</div>
                <ul className="lista no">{reco.evitar.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            </div>
          </div>
        )}

        <div className="visagismo">
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }}>Perfil capilar</div>
            <div className="perfil-grid">
              <Grupo label="Tipo de pelo" opciones={TIPO_PELO} valor={form.tipoPelo} onPick={(v) => set("tipoPelo", v)} />
              <Grupo label="Densidad" opciones={DENSIDAD} valor={form.densidad} onPick={(v) => set("densidad", v)} />
            </div>
            <div className="opt-group">
              <div className="lbl">Forma del rostro</div>
              <div className="chips">
                {ROSTRO.map((o) => (
                  <button key={o} className={"opt" + (form.formaRostro === o ? " on" : "")}
                    onClick={() => set("formaRostro", form.formaRostro === o ? "" : o)}>{o}</button>
                ))}
              </div>
            </div>
          </div>

          <GrabadorVoz onTexto={(t) => set("observaciones", (form.observaciones ? form.observaciones + " " : "") + t)} />
        </div>
      </div>

      {analizando && (
        <AnalisisRostro
          nombreCliente={cliente.nombre}
          onClose={() => setAnalizando(false)}
          onUsar={usarAnalisis}
        />
      )}

      {foto && <VisorFoto src={foto} onClose={() => setFoto(null)} />}

      <div className="card dark">
        <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 20 }}>Historial de cortes</h3>
        {historial.length === 0 ? (
          <div className="muted" style={{ padding: "20px 0" }}>Sin cortes registrados todavía.</div>
        ) : (
          <div className="historial">
            {historial.map((r) => {
              const sv = servicios.find((s) => s.id === r.servicioId);
              const bb = equipo.find((b) => b.id === r.barberoId);
              return (
                <div className="corte" key={r.id}>
                  <div className="ph" onClick={() => r.foto && setFoto(r.foto)}
                    style={r.foto ? { cursor: "zoom-in" } : undefined}>
                    {r.foto ? <img src={r.foto} alt="Resultado del corte" /> : <ImgIcon />}
                  </div>
                  <div className="meta">
                    <Clock style={{ width: 14, height: 14, color: "#a9a9b4" }} />
                    <b>{sv?.nombre || "Servicio"}</b>
                    {bb && <span style={{ color: "#a9a9b4", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Scissors style={{ width: 12, height: 12 }} />{bb.nombre}
                    </span>}
                  </div>
                  <div className="date">
                    {r.fecha} · {r.hora}
                    <span className={"pill-sm" + (r.estado === "finalizado" ? " fin" : "")} style={{ marginLeft: 8 }}>
                      {r.estado === "finalizado" ? "Finalizado" : "Reservado"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 22, fontSize: 14, color: "#8ec7ee", fontWeight: 600 }}>
          {dias > 0
            ? `Próxima visita sugerida: en ${dias} días`
            : `Próxima visita sugerida: atrasada ${Math.abs(dias)} días (cada ${INTERVALO_SUGERIDO} días)`}
        </div>
      </div>
    </Shell>
  );
}

function Grupo({ label, opciones, valor, onPick }) {
  return (
    <div className="opt-group">
      <div className="lbl">{label}</div>
      <div className="chips">
        {opciones.map((o) => (
          <button key={o} className={"opt" + (valor === o ? " on" : "")} onClick={() => onPick(valor === o ? "" : o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function GrabadorVoz({ onTexto }) {
  const [estado, setEstado] = useState("idle"); // idle | rec | error
  const [msg, setMsg] = useState("");
  const rec = useRef(null);

  useEffect(() => () => { try { rec.current?.stop(); } catch {} }, []);

  const alternar = () => {
    if (estado === "rec") { try { rec.current?.stop(); } catch {} setEstado("idle"); return; }

    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setEstado("error");
      setMsg("Tu navegador no soporta dictado por voz. Prueba en Google Chrome.");
      return;
    }
    const r = new SR();
    r.lang = "es-CL";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) txt += e.results[i][0].transcript;
      }
      if (txt.trim()) onTexto(txt.trim());
    };
    r.onerror = (e) => {
      setEstado("error");
      setMsg(e.error === "not-allowed"
        ? "Necesitas dar permiso al micrófono en el navegador."
        : "No se pudo escuchar. Inténtalo de nuevo.");
    };
    r.onend = () => setEstado((s) => (s === "rec" ? "idle" : s));
    rec.current = r;
    setMsg("");
    setEstado("rec");
    try { r.start(); } catch { setEstado("idle"); }
  };

  return (
    <div className="micbox">
      <button className={"micbtn" + (estado === "rec" ? " rec" : "")} onClick={alternar}>
        <Mic />
      </button>
      <p>
        {estado === "rec"
          ? "Escuchando… toca para detener"
          : "Toca el micrófono y comenta las observaciones"}
      </p>
      <small>{msg || "Preferencias, alergias, máquina o tijera…"}</small>
    </div>
  );
}
