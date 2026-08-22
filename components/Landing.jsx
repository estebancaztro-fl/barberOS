"use client";
import Link from "next/link";
import { PLAN } from "@/lib/planes";
import { fmt } from "@/lib/store";
import { Calendar, Users, Dollar, Chat, Scissors, ImgIcon } from "@/components/Icons";

/**
 * Portada para quien todavía no tiene cuenta.
 *
 * El orden no es casual: primero el dolor que el barbero reconoce al tiro
 * —la agenda en el cuaderno, no saber cuánto entró— y recién después el
 * visagismo, que es la razón para elegirnos a nosotros y no a otro.
 * Al revés sonaría a chiche y no a herramienta de trabajo.
 */

const MODULOS = [
  {
    Icon: Calendar,
    titulo: "Agenda que no se te cae",
    texto: "Horarios por sucursal, días cerrados y bloqueos por feriado. Tus clientes reservan solos desde tu link, a la hora que sea.",
  },
  {
    Icon: Users,
    titulo: "Ficha de cada cliente",
    texto: "Qué corte se hizo, con qué máquina, cuándo vino la última vez. Se acabó el “¿cómo era que te lo hacía?”.",
  },
  {
    Icon: Dollar,
    titulo: "Cuánto entró de verdad",
    texto: "Ventas, gastos y la comisión de cada barbero calculada sola. Sin planillas ni cuentas a mano los domingos.",
  },
  {
    Icon: Chat,
    titulo: "Clientes que vuelven",
    texto: "Te avisa quién no aparece hace rato para que le escribas antes de que se vaya a otra parte.",
  },
];

export default function Landing() {
  const total = PLAN.precioBase;

  return (
    <div className="lp">
      {/* ---------- Barra ---------- */}
      <header className="lp-nav">
        <div className="lp-marca">
          <img src="/barberos-logo.svg" alt="BarberOS" />
        </div>
        <nav>
          <a href="#precio">Precio</a>
          <Link className="btn" href="/login">Entrar</Link>
        </nav>
      </header>

      {/* ---------- Portada ---------- */}
      <section className="lp-hero">
        <span className="lp-pill">Hecho para barberías chilenas</span>
        <h1>
          Ordena tu barbería<br />
          <span className="lp-suave">sin dejar la tijera.</span>
        </h1>
        <p className="lp-bajada">
          Agenda, clientes y plata en un solo lugar. Y algo que no tiene nadie
          más: análisis de rostro para recomendar el corte, con el historial
          completo de cada cliente.
        </p>
        <div className="lp-acciones">
          <Link className="btn dark grande" href="/registro">
            Empezar {PLAN.diasDePrueba} días gratis
          </Link>
          <span className="lp-nota">Sin tarjeta. Sin llamadas.</span>
        </div>
      </section>

      {/* ---------- Lo que resuelve ---------- */}
      <section className="lp-seccion">
        <h2>Todo lo que hoy tienes en el cuaderno</h2>
        <div className="lp-grid">
          {MODULOS.map(({ Icon, titulo, texto }) => (
            <div className="lp-card" key={titulo}>
              <div className="lp-icono"><Icon /></div>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- El diferenciador ---------- */}
      <section className="lp-destacado">
        <div className="lp-destacado-txt">
          <span className="lp-pill oscura">Solo en BarberOS</span>
          <h2>Visagismo digital</h2>
          <p>
            Le sacas una foto al cliente y la app mide su rostro para decirte
            qué corte le favorece y cuál evitar. Deja de ser una conversación
            incómoda y pasa a ser un argumento.
          </p>
          <p>
            <b>La foto del rostro nunca se guarda ni se sube a ningún lado.</b>{" "}
            El análisis ocurre en el mismo teléfono y solo queda la
            recomendación. Los datos del rostro son sensibles bajo la Ley 21.719
            y los tratamos como tales.
          </p>
          <ul className="lista si">
            <li>Seis formas de rostro con su recomendación explicada</li>
            <li>Foto del corte terminado, con permiso del cliente</li>
            <li>Historial visual para repetir el corte exacto</li>
          </ul>
        </div>
        <div className="lp-destacado-img">
          <div className="lp-mock">
            <div className="lp-mock-cara"><Scissors /></div>
            <b>Rostro ovalado</b>
            <span>Confianza alta</span>
            <div className="lp-mock-linea"><ImgIcon /> 12 cortes guardados</div>
          </div>
        </div>
      </section>

      {/* ---------- Precio ---------- */}
      <section className="lp-seccion" id="precio">
        <h2>Un solo plan, sin letra chica</h2>
        <div className="lp-precio">
          <div className="lp-precio-cifra">
            <b>{fmt(total)}</b>
            <span>al mes</span>
          </div>
          <ul className="lista si">
            <li>Hasta {PLAN.barberosIncluidos} barberos atendiendo</li>
            <li>Agenda, clientes, finanzas y CRM completos</li>
            <li>Visagismo e historial de cortes</li>
            <li>Link de reservas propio para tu barbería</li>
            <li>Sucursales ilimitadas</li>
          </ul>
          <div className="lp-precio-extra">
            ¿Más de {PLAN.barberosIncluidos} barberos? {fmt(PLAN.precioExtra)} al
            mes por cada uno. Te avisamos el costo antes de cobrarte, siempre.
          </div>
          <Link className="btn dark grande" href="/registro">
            Empezar {PLAN.diasDePrueba} días gratis
          </Link>
          <p className="lp-nota" style={{ marginTop: 14 }}>
            Cancelas cuando quieras desde la misma app. Si cancelas, tu cuenta
            queda en solo lectura: tus datos no se borran.
          </p>
        </div>
      </section>

      {/* ---------- Cierre ---------- */}
      <section className="lp-cierre">
        <h2>Pruébalo con tu próxima jornada</h2>
        <p>
          Creas tu barbería en dos minutos, agregas a tu equipo y empiezas a
          agendar. Si no te sirve, no pagaste nada.
        </p>
        <Link className="btn grande claro" href="/registro">
          Crear mi barbería
        </Link>
      </section>

      <footer className="lp-pie">
        <span>© {new Date().getFullYear()} BarberOS</span>
        <span>Hecho en Chile · Datos alojados en Sudamérica</span>
      </footer>
    </div>
  );
}
