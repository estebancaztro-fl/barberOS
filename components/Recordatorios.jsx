"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { citasPorAvisar } from "@/lib/mensajes";

/* Se guarda en el navegador para no repetir el mismo aviso al recargar */
const AVISADAS = "barberos.avisadas";

const leerAvisadas = () => {
  try { return new Set(JSON.parse(localStorage.getItem(AVISADAS) || "[]")); }
  catch { return new Set(); }
};
const guardarAvisadas = (set) => {
  try {
    /* Solo las últimas 200: esto no es un registro, es memoria de corto plazo */
    localStorage.setItem(AVISADAS, JSON.stringify([...set].slice(-200)));
  } catch { /* sin espacio: peor es fallar */ }
};

/**
 * Avisa al barbero antes de cada cita.
 *
 * Corre mientras la app está abierta. Es una limitación real y hay que
 * decirla: el navegador no ejecuta nada con la pestaña cerrada, así que
 * este aviso sirve durante la jornada, no de madrugada. Para un aviso que
 * llegue siempre hace falta la Cloud API de WhatsApp enviando desde el
 * servidor, que es el paso siguiente.
 */
export default function Recordatorios() {
  const app = useApp();
  const router = useRouter();
  const [tic, setTic] = useState(0);
  const avisadas = useRef(null);

  /* Un tic por minuto: suficiente para un margen de 25 y sin gastar batería */
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!app?.conSesion) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (app.barberia?.recordatorioActivo === false) return;

    if (!avisadas.current) avisadas.current = leerAvisadas();

    const pendientes = citasPorAvisar({
      reservas: misReservas(app),
      mensajes: app.mensajes,
      minutos: app.barberia?.recordatorioMinutos || 25,
    }).filter((r) => !avisadas.current.has(r.id));

    if (pendientes.length === 0) return;

    const titulo = pendientes.length === 1
      ? `${pendientes[0].clienteNombre} llega a las ${pendientes[0].hora.slice(0, 5)}`
      : `${pendientes.length} citas en los próximos minutos`;

    const aviso = new Notification(titulo, {
      body: "Toca para confirmarles por WhatsApp.",
      icon: "/icon.svg",
      tag: "barberos-recordatorio",   // reemplaza el anterior en vez de apilar
    });
    aviso.onclick = () => { window.focus(); router.push("/agenda"); aviso.close(); };

    pendientes.forEach((r) => avisadas.current.add(r.id));
    guardarAvisadas(avisadas.current);
  }, [tic, app?.conSesion, app?.mensajes, app?.reservas, router, app]);

  return null;
}

/* El barbero solo se preocupa de sus citas; admin y recepción, de todas */
function misReservas(app) {
  if (app.rol === "barbero" && app.yo?.id) {
    return app.reservas.filter((r) => r.barberoId === app.yo.id);
  }
  return app.reservas;
}

/** Pide permiso para avisar. Se usa desde Administración. */
export async function pedirPermisoAvisos() {
  if (typeof Notification === "undefined") {
    return { error: "Este navegador no permite avisos. Prueba desde Chrome o Safari actualizado." };
  }
  if (Notification.permission === "granted") return { ok: true };
  if (Notification.permission === "denied") {
    return { error: "Los avisos están bloqueados. Actívalos en los ajustes del navegador para este sitio." };
  }
  const r = await Notification.requestPermission();
  return r === "granted" ? { ok: true } : { error: "No se activaron los avisos." };
}

export const estadoAvisos = () =>
  typeof Notification === "undefined" ? "no-disponible" : Notification.permission;
