# BarberOS — V0.2 (prototipo UX)

SaaS de gestión para barberías. Prototipo navegable para testear la experiencia: todo funciona y se guarda, pero en el navegador de cada persona (aún no hay servidor ni base de datos).

**Los archivos ya están en esta carpeta.** No tienes que mover nada.

---

## Novedades de la V0.2

- **Nuevo diseño**: fondo con malla de color, tarjetas con degradado, tarjetas destacadas en negro, toggles e íconos nuevos
- **Ficha de cliente** (`/clientes/[id]`): perfil capilar (tipo de pelo, densidad, forma del rostro), observaciones, **dictado por voz real**, historial de cortes y próxima visita sugerida
- **Multi-sucursal**: la agenda y las reservas se filtran por la sucursal seleccionada en el sidebar
- **Cambio de rol** desde el menú de usuario (abajo del sidebar)
- **Subida real de imágenes** para el logo de la barbería y las fotos de servicios
- CRM: segmentos con columna de próxima visita, campañas con botón Enviar

> El dictado por voz usa la API del navegador y funciona en **Google Chrome**. Pide permiso al micrófono la primera vez.

---

## Opción A — Publicarlo online (recomendado para testear)

No necesitas instalar nada. Consigues un link que puedes mandar por WhatsApp.

1. Entra a [github.com](https://github.com) y crea una cuenta (gratis).
2. Botón **+** arriba a la derecha → **New repository**. Nombre: `barberos`. Crea.
3. En el repo vacío, clic en **"uploading an existing file"**.
4. Arrastra **todo lo que hay dentro** de esta carpeta:
   `app`, `components`, `lib`, `public`, `package.json`, `next.config.mjs`, `jsconfig.json`, `README.md`
   *(no subas `_capturas` ni `node_modules`)*
5. Botón verde **Commit changes**.
6. Entra a [vercel.com](https://vercel.com) → **Sign up** con GitHub.
7. **Add New → Project** → busca `barberos` → **Import** → **Deploy**.
8. En ~1 minuto tienes tu URL, tipo `barberos.vercel.app`.

Link público de reservas: `barberos.vercel.app/b/barber-royce`

Cada cambio que subas a GitHub se publica solo.

---

## Opción B — Correrlo en tu Mac

1. Instala Node.js: [nodejs.org](https://nodejs.org) → versión **LTS** → instalador normal.
2. Abre **Terminal** (Cmd+Espacio → "Terminal").
3. Pega y Enter:

```bash
cd ~/Desktop/barberOS
npm install
```

4. Después:

```bash
npm run dev
```

5. Abre **http://localhost:3000**

Detener: `Control + C`.

---

## Qué probar

| Ruta | Qué es |
|---|---|
| `/` | Dashboard |
| `/agenda` | Agenda día/semana |
| `/clientes` | Listado; clic en una fila abre la **ficha** |
| `/finanzas` | Ingresos, gastos, comisiones (solo admin) |
| `/crm` | Segmentos, fidelización, campañas |
| `/admin` | Equipo, servicios, sucursales, marca y link público |
| `/b/barber-royce` | **Reserva pública** (lo que ve el cliente) |

**Flujo completo**: Agenda → crea una reserva → cámbiale el estado a `finalizado` → aparece el ingreso en Finanzas, la comisión se calcula sola, y el cliente suma un corte en CRM → Fidelización y en su ficha.

**Reiniciar los datos de prueba**: Consola del navegador (Cmd+Opción+J) → `localStorage.clear()` → Enter → recarga.

---

## Personalización de marca

- **Logo de BarberOS** (pie del sidebar): `public/barberos-logo.svg`. Para actualizarlo, reemplaza ese archivo manteniendo el nombre.
- **Isotipo**: `app/icon.svg` (favicon de la pestaña) y `public/isotipo.svg`.
- **Tipografía**: Google Sans Flex, cargada desde Google Fonts en la primera línea de `app/globals.css`.
- **Colores**: todos los tokens están en `:root` al inicio de `app/globals.css`.

## Limitaciones de la V0.2 (a propósito)

- No hay login: se simula el rol desde el menú de usuario
- Los datos viven en el navegador de cada persona, no se comparten entre dispositivos
- Las campañas de CRM se registran pero no se envían

## Siguiente paso (V1)

Conectar **Supabase** (gratis) para login real y datos compartidos. La estructura ya está definida en `lib/store.jsx` y se traduce directo a tablas.
