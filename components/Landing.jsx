"use client";
import Link from "next/link";
import { PLAN, INCLUYE } from "@/lib/planes";
import { fmt } from "@/lib/store";
import { Calendar, Users, Dollar, Clock } from "@/components/Icons";

/**
 * WebP para quien lo soporta —que es casi todo el mundo— y PNG de respaldo.
 * Así no hay que elegir entre que se vea bien y que cargue rápido.
 */
function Imagen({ nombre, alt, clase }) {
  return (
    <picture>
      <source srcSet={`/landing/${nombre}.webp`} type="image/webp" />
      <img className={clase} src={`/landing/${nombre}.png`} alt={alt} loading="lazy" />
    </picture>
  );
}

/**
 * Portada para quien todavía no tiene cuenta.
 *
 * El orden no es casual: primero el dolor que el barbero reconoce al tiro
 * —la agenda, la ficha, la plata— y recién después el visagismo, que es la
 * razón para elegirnos a nosotros y no a otro. Al revés sonaría a chiche
 * y no a herramienta de trabajo.
 */

const MODULOS = [
  {
    Icon: Calendar,
    titulo: "Tu agenda, tal como la tienes hoy",
    texto: "Horarios por sucursal, días cerrados y bloqueos por feriado. Tus clientes reservan solos desde tu link, a la hora que sea.",
    extra: "¿Ya usas otra agenda? Te migramos tus clientes y sus horarios. No empiezas de cero.",
  },
  {
    Icon: Users,
    titulo: "La ficha de cada cliente",
    texto: "Qué corte, qué máquina, qué número, qué le gustó y qué no. Cada visita mejora la siguiente, aunque lo atienda otro barbero de tu equipo.",
  },
  {
    Icon: Dollar,
    titulo: "Tus finanzas en orden",
    texto: "Ventas, gastos y la comisión de cada barbero calculada sola. Sin planillas ni cuentas a mano los domingos.",
  },
  {
    Icon: Clock,
    titulo: "Quién dejó de venir",
    texto: "Te avisa quién no aparece hace tiempo para que le escribas antes de que se vaya a otra parte.",
  },
];

const VISAGISMO = [
  "Seis formas de rostro con su recomendación explicada",
  "Foto del corte terminado, con permiso del cliente",
  "Historial visual para repetir el corte exacto",
];

export default function Landing() {
  return (
    <div className="lp">
      {/* ================= Portada =================
          A todo el ancho, sin bordes redondeados. Las capas van en este
          orden, igual que en el archivo de Figma: fondo #1d1818, las dos
          luces (celeste y coral), el isotipo coral difuminado y encima el
          teléfono, que se sale del bloque oscuro por abajo. */}
      <header className="lp-hero">
        {/* Como en el archivo de Figma: las luces y el isotipo viven DENTRO
            del bloque oscuro y se recortan exacto donde termina el negro.
            El teléfono vive fuera y se asoma a la parte clara. */}
        <div className="lp-luces" aria-hidden="true">
          <div className="lp-luz celeste" />
          <div className="lp-luz coral" />
          <picture>
            <source srcSet="/landing/isotipo-difuso.webp" type="image/webp" />
            <img className="lp-isotipo" src="/landing/isotipo-difuso.png" alt="" />
          </picture>
        </div>

        <div className="lp-hero-contenido">
          <div className="lp-hero-nav">
            <img src="/barberos-logo.svg" alt="BarberOS" className="lp-logo" />
            <Link className="lp-entrar" href="/login">Entrar</Link>
          </div>

          <span className="lp-pill">Creado con barberos, para barberos</span>

          <h1>
            <span className="lp-celeste">Cualquier agenda te ordena la barbería.</span>
            <br />
            <b>BarberOS revaloriza la industria.</b>
          </h1>

          <div className="lp-acciones">
            <Link className="lp-cta" href="/registro">
              Empezar {PLAN.diasDePrueba} días gratis
            </Link>
            <span className="lp-nota">Sin agregar una tarjeta.</span>
          </div>

          <div className="lp-hero-figura">
            {/* Sin lazy: es lo primero que se ve */}
            <picture>
              <source srcSet="/landing/hero.webp" type="image/webp" />
              <img className="lp-hero-img" src="/landing/hero.png"
                alt="BarberOS en el teléfono, junto a las herramientas del barbero" />
            </picture>
          </div>
        </div>
      </header>

      {/* ================= Módulos ================= */}
      <section className="lp-seccion lp-centro">
        <h2>Toda tu barbería en un mismo lugar</h2>
        <div className="lp-grid">
          {MODULOS.map(({ Icon, titulo, texto, extra }) => (
            <div className="lp-card" key={titulo}>
              <div className="lp-icono"><Icon /></div>
              <h3>{titulo}</h3>
              <p>{texto}</p>
              {extra && <p className="lp-extra">{extra}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ================= Visagismo ================= */}
      <div className="lp-centro">
      <section className="lp-visagismo">
        <div className="lp-vis-txt">
          <span className="lp-pill oscura">Solo en BarberOS</span>
          <h2>Visagismo Digital</h2>
          <p>
            Le sacas una foto y la app mide su cara: proporciones, tercios,
            forma de mandíbula. Lo mismo que tú ves cuando el cliente se
            sienta, pero queda guardado en su ficha. La próxima vez no parte
            de cero: cualquier barbero de tu equipo abre la ficha y sabe qué
            le queda, qué máquina, qué número y qué le gustó la última vez.
          </p>
          <ul className="lp-checks">
            {VISAGISMO.map((x) => <li key={x}>{x}</li>)}
          </ul>

          <div className="lp-aviso">
            <span className="lp-candado" aria-hidden="true">🔒</span>
            <span>
              La foto del rostro <b>nunca se guarda ni se sube a ningún lado</b>.
              El análisis ocurre en el mismo teléfono y solo queda la
              recomendación. Los datos del rostro son sensibles bajo la
              Ley 21.719 y los tratamos como tales.
            </span>
          </div>
        </div>

        <div className="lp-vis-img">
          <Imagen nombre="rostro" alt="Análisis de rostro: forma detectada Cuadrado, 86% de coincidencia" />
        </div>
      </section>
      </div>

      {/* ================= El panel ================= */}
      <section className="lp-panel">
        <Imagen nombre="panel" alt="Panel de BarberOS con la agenda del día, ingresos y ranking de barberos" />
      </section>

      {/* ================= Precio ================= */}
      <section className="lp-seccion lp-centro" id="precio">
        <h2>Un solo plan, sin letra chica</h2>

        <div className="lp-precio">
          <div className="lp-precio-cifra">
            <b>{fmt(PLAN.precioBase)}</b>
            <span>al mes</span>
          </div>

          <ul className="lp-checks">
            {INCLUYE.map((x) => <li key={x}>{x}</li>)}
          </ul>

          <div className="lp-precio-extra">
            ¿Más de {PLAN.barberosIncluidos} barberos? {fmt(PLAN.precioExtra)} al
            mes por cada uno. Te avisamos el costo antes de cobrarte, siempre.
          </div>

          <Link className="lp-cta ancho" href="/registro">
            Empezar {PLAN.diasDePrueba} días gratis
          </Link>

          <p className="lp-nota bajo">
            Cancelas cuando quieras desde la misma app. Si cancelas, tu cuenta
            queda en solo lectura: tus datos no se borran.
          </p>
        </div>
      </section>

      {/* ================= Cierre ================= */}
      <div className="lp-centro">
      <section className="lp-cierre">
        <h2>Crea tu barbería en 2 minutos</h2>
        <p>
          Agregas a tu equipo y empiezas a agendar. Si decides no seguir,
          no pagaste nada.
        </p>
        <Link className="lp-cta claro" href="/registro">Crear mi barbería</Link>
      </section>
      </div>

      {/* ================= Marca ================= */}
      <footer className="lp-pie">
        <Imagen nombre="marca" alt="BarberOS" clase="lp-marca" />
        <div className="lp-legal">
          © {new Date().getFullYear()} BarberOS. Hecho por barberos, para barberos · Chile
        </div>
      </footer>
    </div>
  );
}
