# BarberOS — V0.1 (prototipo UX)

SaaS de gestión para barberías. Esta versión es un **prototipo navegable para testear la experiencia de uso**: todo funciona y se guarda, pero en el navegador de cada persona (no hay servidor ni base de datos todavía).

**Los archivos ya están en esta carpeta.** No tienes que mover nada.

---

## Opción A — Publicarlo online (recomendado para testear)

No necesitas instalar nada. Consigues un link que puedes mandar a barberos por WhatsApp.

1. Entra a [github.com](https://github.com) y crea una cuenta (gratis).
2. Botón **+** arriba a la derecha → **New repository**. Nombre: `barberos`. Déjalo en **Private** si quieres. Crea.
3. En la página del repo vacío, haz clic en **"uploading an existing file"**.
4. Abre esta carpeta en tu Mac y arrastra **todo lo que hay dentro** a la ventana del navegador:
   `app`, `components`, `lib`, `package.json`, `next.config.mjs`, `jsconfig.json`, `README.md`
   *(no subas `_capturas` ni `node_modules` si aparecen)*
5. Abajo, botón verde **Commit changes**.
6. Entra a [vercel.com](https://vercel.com) → **Sign up** con tu cuenta de GitHub.
7. **Add New → Project** → busca `barberos` → **Import** → **Deploy**.
8. Espera ~1 minuto. Te da una URL tipo `barberos.vercel.app`.

Tu link público de reservas para clientes será:
`barberos.vercel.app/b/barber-royce`

Cada cambio que subas a GitHub se publica solo.

---

## Opción B — Correrlo en tu Mac

1. Instala Node.js: [nodejs.org](https://nodejs.org) → descarga la versión **LTS** → instalador normal (siguiente, siguiente).
2. Abre la app **Terminal** (Cmd+Espacio → escribe "Terminal").
3. Copia y pega esto, y presiona Enter:

```bash
cd ~/Desktop/barberOS
npm install
```

Espera 1-2 minutos (descarga librerías, se ve mucho texto, es normal).

4. Después pega esto:

```bash
npm run dev
```

5. Abre el navegador en **http://localhost:3000**

Para detenerlo: `Control + C` en la Terminal. Para volver a arrancarlo, repite los pasos 2, 3 (solo `cd`) y 4.

---

## Qué probar

| Ruta | Qué es |
|---|---|
| `/` | Dashboard |
| `/agenda` | Agenda día/semana, crear reservas |
| `/clientes` | Listado y búsqueda |
| `/finanzas` | Ingresos, gastos, comisiones (solo admin) |
| `/crm` | Segmentos, fidelización, campañas |
| `/admin` | Equipo, servicios, sucursales, link público |
| `/b/barber-royce` | **Reserva pública** (lo que ve el cliente) |

**Cambiar de rol**: selector abajo del sidebar (Administrador / Recepción / Barbero). Finanzas y Admin se ocultan según el rol.

**Flujo completo para testear**: Agenda → crea una reserva → cámbiale el estado a `finalizado` → aparece el ingreso en Finanzas, la comisión del barbero se calcula sola, y el cliente suma un corte en CRM → Fidelización.

**Reiniciar los datos de prueba**: en el navegador, Consola (Cmd+Opción+J) → escribe `localStorage.clear()` → Enter → recarga.

---

## Limitaciones de la V0.1 (a propósito)

- No hay login: se simula el rol con el selector del sidebar
- Los datos viven en el navegador de cada persona, no se comparten entre dispositivos
- Subida de logo y comprobantes es visual, no guarda archivos
- Las campañas de CRM se preparan pero no se envían

## Siguiente paso (V1)

Conectar **Supabase** (gratis) para login real y datos compartidos. La estructura ya está definida en `lib/store.jsx` — barberías, sucursales, equipo, servicios, clientes, reservas, ingresos, gastos, pagos de comisión — y se traduce directo a tablas.
