"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { crearMensajes, marcarEnviado } from "@/lib/datos";
import {
  citasPorAvisar, armarTexto, linkWhatsApp, PLANTILLA_RECORDATORIO,
} from "@/lib/mensajes";
import { Chat, Clock } from "@/components/Icons";

/**
 * Citas que están por empezar y todavía no se han confirmado con el cliente.
 *
 * Aparece solo cuando hay alguna. Un bloque que dice "no hay nada" todos los
 * días termina siendo ruido que el barbero aprende a ignorar.
 */
export default function PorConfirmar() {
  const app = useApp();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState("");
  if (!app) return null;

  const { reservas, clientes, servicios, equipo, mensajes, barberia,
          conSesion, update, recargar, rol, yo } = app;

  if (barberia?.recordatorioActivo === false) return null;

  const mias = rol === "barbero" && yo?.id
    ? reservas.filter((r) => r.barberoId === yo.id)
    : reservas;

  const pendientes = citasPorAvisar({
    reservas: mias,
    mensajes,
    minutos: barberia?.recordatorioMinutos || 25,
  });

  if (pendientes.length === 0) return null;

  const textoDe = (r) => {
    const cliente = clientes.find((c) => c.id === r.clienteId);
    const servicio = servicios.find((s) => s.id === r.servicioId);
    const barbero = equipo.find((b) => b.id === r.barberoId);
    return armarTexto(barberia?.recordatorioPlantilla || PLANTILLA_RECORDATORIO, {
      cliente: r.clienteNombre || cliente?.nombre,
      barberia: barberia?.nombre,
      hora: r.hora?.slice(0, 5),
      fecha: r.fecha,
      servicio: servicio?.nombre,
      barbero: barbero?.nombre,
    });
  };

  const telefonoDe = (r) => clientes.find((c) => c.id === r.clienteId)?.telefono || "";

  /* Se abre WhatsApp con el mensaje escrito y se deja registro de que se
     avisó. El registro es lo que impide mandarle dos veces lo mismo. */
  const avisar = async (r) => {
    setError("");
    const texto = textoDe(r);
    const telefono = telefonoDe(r);
    const link = linkWhatsApp(telefono, texto);

    if (!link) {
      setError(`${r.clienteNombre} no tiene un teléfono válido en su ficha.`);
      return;
    }

    /* Primero se abre la ventana: si se hace después de un await, el
       navegador la bloquea por no venir de un clic directo. */
    window.open(link, "_blank", "noopener");

    setOcupado(r.id);
    if (conSesion) {
      const res = await crearMensajes(barberia.id, [{
        tipo: "recordatorio", reservaId: r.id, clienteId: r.clienteId,
        telefono, texto, estado: "pendiente",
      }]);
      if (res.error) { setError(res.error); setOcupado(""); return; }
      const creado = res.datos?.[0];
      if (creado) await marcarEnviado(creado.id);
      await recargar("mensajes");
    } else {
      update((d) => {
        d.mensajes = [...(d.mensajes || []), {
          id: Math.random().toString(36).slice(2, 10),
          tipo: "recordatorio", reservaId: r.id, clienteId: r.clienteId,
          telefono, texto, estado: "enviado", enviadoEn: new Date().toISOString(),
        }];
        return d;
      });
    }
    setOcupado("");
  };

  const omitir = async (r) => {
    const cuerpo = {
      tipo: "recordatorio", reservaId: r.id, clienteId: r.clienteId,
      telefono: telefonoDe(r), texto: textoDe(r), estado: "omitido",
    };
    if (conSesion) {
      const res = await crearMensajes(barberia.id, [cuerpo]);
      if (res.error) { setError(res.error); return; }
      await recargar("mensajes");
    } else {
      update((d) => {
        d.mensajes = [...(d.mensajes || []), { id: Math.random().toString(36).slice(2, 10), ...cuerpo }];
        return d;
      });
    }
  };

  return (
    <div className="por-confirmar">
      <div className="pc-cab">
        <Clock style={{ width: 17, height: 17 }} />
        <b>
          {pendientes.length === 1
            ? "Una cita está por empezar"
            : `${pendientes.length} citas están por empezar`}
        </b>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="pc-lista">
        {pendientes.map((r) => (
          <div className="pc-fila" key={r.id}>
            <div className="grow">
              <b>{r.hora?.slice(0, 5)} · {r.clienteNombre}</b>
              <div className="mut">
                {telefonoDe(r) || "Sin teléfono en la ficha"}
              </div>
            </div>
            <button className="btn sm" onClick={() => omitir(r)}>No avisar</button>
            <button className="btn dark sm" disabled={ocupado === r.id}
              onClick={() => avisar(r)}>
              <Chat style={{ width: 15, height: 15 }} />
              {ocupado === r.id ? "Abriendo…" : "Confirmar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
