"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import AnalisisRostro from "@/components/AnalisisRostro";
import { useApp, uid, fmt, hoyISO, finalizarReserva } from "@/lib/store";
import { FORMAS, registroVisagismo } from "@/lib/rostro";
import { comprimirImagen } from "@/lib/imagen";
import {
  guardarReserva, guardarCliente, crearCliente, crearIngreso, darConsentimiento,
} from "@/lib/datos";
import { Scissors, Clock, Note, ImgIcon, X, Trash, Upload } from "@/components/Icons";

const ESTADOS = [
  ["reservado", "Reservado"],
  ["confirmado", "Confirmado"],
  ["finalizado", "Finalizado"],
  ["cancelado", "Cancelado"],
];

export default function DetalleReserva({ reserva, onClose }) {
  const app = useApp();
  const router = useRouter();
  const [escaneando, setEscaneando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [verFoto, setVerFoto] = useState(false);
  if (!app) return null;

  const { update, servicios, equipo, clientes, sinEspacio,
          conSesion, barberia, recargar } = app;
  const r = app.reservas.find((x) => x.id === reserva.id) || reserva;
  const servicio = servicios.find((s) => s.id === r.servicioId);
  const barbero = equipo.find((b) => b.id === r.barberoId);
  const cliente = clientes.find((c) => c.id === r.clienteId);
  const forma = cliente?.formaRostro;
  /* Se muestra la copia guardada en la ficha; si no hay, el catálogo vigente */
  const vis = cliente?.visagismo;
  const reco = vis?.forma === forma && vis?.recomendacion
    ? vis.recomendacion
    : (forma ? FORMAS[forma] : null);

  const avisar = (msg) => { setAviso(msg); setTimeout(() => setAviso(""), 4000); };

  const cambiarEstado = async (e) => {
    if (!conSesion) {
      if (e === "finalizado") return finalizarReserva(update, r);
      update((d) => { const x = d.reservas.find((y) => y.id === r.id); if (x) x.estado = e; return d; });
      return;
    }

    const res = await guardarReserva(r.id, { estado: e });
    if (res.error) { avisar(res.error); return; }

    /* Al finalizar se registra el ingreso. Los cortes acumulados y la última
       visita del cliente los recalcula la base sola. */
    if (e === "finalizado" && servicio) {
      await crearIngreso(barberia.id, {
        fecha: r.fecha,
        concepto: `${servicio.nombre} · ${r.clienteNombre}`,
        metodo: "efectivo",
        monto: servicio.precio,
        barberoId: r.barberoId,
        reservaId: r.id,
      });
    }
    await recargar("reservas", "clientes", "ingresos");
  };

  /* Foto del corte terminado: se comprime antes de guardar */
  const subirFoto = async (file) => {
    if (!file) return;
    setSubiendo(true);
    setAviso("");
    try {
      const dataUrl = await comprimirImagen(file);

      if (conSesion) {
        /* La base rechaza la foto sin consentimiento del cliente */
        if (r.clienteId) await darConsentimiento(barberia.id, r.clienteId, "fotos_corte");
        const res = await guardarReserva(r.id, { foto: dataUrl });
        if (res.error) { avisar(res.error); setSubiendo(false); return; }
        await recargar("reservas");
      } else {
        update((d) => { const x = d.reservas.find((y) => y.id === r.id); if (x) x.foto = dataUrl; return d; });
      }
      avisar("Foto guardada en el historial del cliente.");
    } catch {
      avisar("No se pudo procesar la foto. Inténtalo de nuevo.");
    }
    setSubiendo(false);
  };

  const quitarFoto = async () => {
    if (conSesion) {
      const res = await guardarReserva(r.id, { foto: null });
      if (res.error) { avisar(res.error); return; }
      await recargar("reservas");
      return;
    }
    update((d) => { const x = d.reservas.find((y) => y.id === r.id); if (x) x.foto = null; return d; });
  };

  /* Finaliza el servicio y ofrece la foto si aún no la tiene */
  const finalizar = async () => {
    await cambiarEstado("finalizado");
    if (!r.foto) avisar("Servicio finalizado. Saca una foto del resultado para el historial.");
  };

  /* Guarda el visagismo en la ficha. Si el cliente no estaba registrado, lo crea. */
  const guardarAnalisis = async (res) => {
    /* Solo la categoría y copia fija del consejo dado hoy.
       Las proporciones del rostro no se almacenan. */
    const analisis = registroVisagismo({
      forma: res.forma,
      similitud: res.ranking[0].similitud,
      confianza: res.confianza,
      origen: "scan",
      fecha: hoyISO(),
    });
    setEscaneando(false);

    if (conSesion) {
      let clienteId = r.clienteId;
      /* Si la reserva era a nombre suelto, se le crea la ficha */
      if (!clienteId) {
        const nuevo = await crearCliente(barberia.id, { nombre: r.clienteNombre });
        if (nuevo.error) { avisar(nuevo.error); return; }
        clienteId = nuevo.datos.id;
        await guardarReserva(r.id, { clienteId });
      }
      await darConsentimiento(barberia.id, clienteId, "visagismo");
      const res = await guardarCliente(clienteId, { formaRostro: analisis.forma, visagismo: analisis });
      if (res.error) { avisar(res.error); return; }
      await recargar("clientes", "reservas");
      avisar(r.clienteId ? "Visagismo guardado en la ficha." : "Cliente creado y visagismo guardado.");
      return;
    }

    update((d) => {
      let c = d.clientes.find((x) => x.id === r.clienteId);
      if (!c) {
        c = {
          id: uid(), nombre: r.clienteNombre, telefono: "", correo: "",
          vip: false, cortes: 0, ultimaVisita: hoyISO(),
          observaciones: "", tipoPelo: "", densidad: "", formaRostro: "", notasVoz: [], visagismo: null,
        };
        d.clientes.push(c);
        const res2 = d.reservas.find((x) => x.id === r.id);
        if (res2) res2.clienteId = c.id;
      }
      c.formaRostro = analisis.forma;
      c.visagismo = analisis;
      return d;
    });
    avisar(cliente ? "Visagismo guardado en la ficha." : "Cliente creado y visagismo guardado.");
  };

  return (
    <>
      <Modal
        title={r.clienteNombre}
        sub={`${r.hora} · ${r.fecha}`}
        onClose={onClose}
        footer={
          <>
            {r.clienteId && (
              <button className="link-btn" onClick={() => router.push(`/clientes/${r.clienteId}`)}>
                Ver ficha completa
              </button>
            )}
            <button className="btn dark" onClick={onClose}>Listo</button>
          </>
        }
      >
        {/* Lo primero al abrir la reserva: el barbero va a cortar ahora */}
        <button className="scan-cta" onClick={() => setEscaneando(true)}>
          <span className="scan-cta-ico"><ImgIcon /></span>
          <span className="grow">
            <b>Visagismo Scan</b>
            <span>{forma ? `Última lectura: ${forma} · toca para repetir` : "Analiza el rostro y recibe el corte recomendado"}</span>
          </span>
        </button>

        <div className="det-lista">
          <div className="det-fila">
            <Scissors />
            <span className="grow">{servicio?.nombre || "Sin servicio"}</span>
            <b>{servicio ? fmt(servicio.precio) : ""}</b>
          </div>
          <div className="det-fila">
            <Clock />
            <span className="grow">{servicio?.duracion || 0} min</span>
            <span className="muted">{barbero?.nombre || "Sin barbero"}</span>
          </div>
          {r.notas && (
            <div className="det-fila">
              <Note />
              <span className="grow">{r.notas}</span>
            </div>
          )}
        </div>

        <div className="field" style={{ marginTop: 20 }}>
          <label>Estado</label>
          <div className="chips">
            {ESTADOS.map(([v, l]) => (
              <button key={v} className={"chip" + (r.estado === v ? " on" : "")}
                onClick={() => (v === "finalizado" ? finalizar() : cambiarEstado(v))}>{l}</button>
            ))}
          </div>
        </div>

        {/* --- Foto del resultado --- */}
        <div className="foto-box">
          <div className="scan-cab" style={{ marginBottom: r.foto || subiendo ? 14 : 0 }}>
            <div>
              <b>Foto del resultado</b>
              <div className="muted" style={{ fontSize: 13 }}>
                {r.foto ? "Guardada en el historial" : "Queda en la ficha del cliente"}
              </div>
            </div>
            {!r.foto && !subiendo && (
              <label className="btn dark" style={{ cursor: "pointer" }}>
                <ImgIcon style={{ width: 16, height: 16 }} /> Tomar foto
                <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => subirFoto(e.target.files?.[0])} />
              </label>
            )}
          </div>

          {subiendo && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
              <div className="spinner" style={{ width: 22, height: 22, borderWidth: 2, margin: 0 }} />
              <span className="muted">Optimizando la foto…</span>
            </div>
          )}

          {r.foto && (
            <>
              <img src={r.foto} alt="Resultado del corte" className="foto-prev" onClick={() => setVerFoto(true)} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <label className="btn sm" style={{ cursor: "pointer", flex: 1 }}>
                  <Upload style={{ width: 15, height: 15 }} /> Cambiar
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                    onChange={(e) => subirFoto(e.target.files?.[0])} />
                </label>
                <button className="btn sm" onClick={quitarFoto} style={{ color: "var(--red)" }}>
                  <Trash style={{ width: 15, height: 15 }} /> Quitar
                </button>
              </div>
            </>
          )}

          {sinEspacio && (
            <div className="aviso" style={{ marginTop: 14 }}>
              El almacenamiento del navegador está lleno. Elimina fotos antiguas del historial
              para poder guardar nuevas.
            </div>
          )}
        </div>

        <div className="scan-box">
          {aviso && <div className="scan-ok" style={{ marginTop: 0, marginBottom: reco ? 16 : 0 }}>{aviso}</div>}

          {!reco && !aviso && (
            <div className="muted" style={{ fontSize: 13.5 }}>
              Sin visagismo todavía. Escanea al cliente para ver qué cortes le favorecen.
            </div>
          )}

          {reco && (
            <div>
              <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>{reco.resumen}</p>
              <div className="bloque-t"><Scissors style={{ width: 15, height: 15, verticalAlign: -3, marginRight: 7 }} />Cortes que favorecen</div>
              <ul className="lista si">{reco.favorece.map((t, i) => <li key={i}>{t}</li>)}</ul>
              <div className="bloque-t" style={{ marginTop: 14 }}><X style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 7 }} />Mejor evitar</div>
              <ul className="lista no">{reco.evitar.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      </Modal>

      {escaneando && (
        <AnalisisRostro
          titulo="Visagismo Scan"
          nombreCliente={r.clienteNombre}
          textoGuardar="Guardar y usar"
          onClose={() => setEscaneando(false)}
          onUsar={guardarAnalisis}
        />
      )}

      {verFoto && r.foto && <VisorFoto src={r.foto} onClose={() => setVerFoto(false)} />}
    </>
  );
}

export function VisorFoto({ src, onClose }) {
  return (
    <div className="visor" onMouseDown={onClose}>
      <button className="visor-x" onClick={onClose} aria-label="Cerrar"><X /></button>
      <img src={src} alt="" onMouseDown={(e) => e.stopPropagation()} />
    </div>
  );
}
