# BarberOS — V0.6 (foto del resultado)

> **Nota de despliegue**: las V0.4 y V0.5 fallaron en Vercel porque `package.json`
> pedía `@mediapipe/tasks-vision@0.10.22`, una versión que no existe, y `npm install`
> abortaba el build. Corregido: MediaPipe ya no es dependencia npm, se carga desde
> CDN al abrir la pantalla de análisis. El proyecto vuelve a tener solo Next y React
> como dependencias, igual que la V0.3 que sí desplegaba.

## Novedades de la V0.6

**Foto del corte terminado.** En el detalle de la reserva, el barbero saca una foto del resultado y queda en el historial del cliente. Al marcar el servicio como finalizado, la app se la recuerda.

- Las fotos se **comprimen antes de guardar**: de ~670 KB a ~45 KB (15 veces menos) redimensionando a 900 px y bajando la calidad. Sin esto, tres fotos llenarían el almacenamiento.
- Se corrige la **orientación** automáticamente (las fotos de celular suelen venir rotadas).
- Tocar una foto la abre a **pantalla completa**, tanto en el detalle como en el historial de la ficha.
- Se puede cambiar o quitar la foto.

**Límite a tener en cuenta**: en esta versión las fotos viven en el navegador, que aguanta unos 5 MB — entre **67 y 88 fotos** según cuánta textura tengan. Al llenarse, la app avisa en vez de fallar en silencio. Este límite desaparece en la V1 con almacenamiento real.

## Novedades de la V0.5

**El barbero escanea al cliente en el momento de atenderlo.**

1. En su agenda toca la reserva del cliente que va a atender
2. Se abre el detalle: servicio, duración, barbero, notas y estado
3. Si el cliente ya tiene visagismo, ve de inmediato su forma de rostro y los cortes recomendados
4. Botón **Visagismo Scan** → abre la cámara trasera del celular
5. El resultado se guarda solo en la ficha del cliente

Si el cliente no estaba registrado (reserva a nombre suelto), al guardar el análisis se **crea su ficha automáticamente** y queda enlazada a la reserva.

El estado de la reserva también se cambia desde ahí, con botones grandes en vez del selector chico de antes. Las reservas del Dashboard se abren igual, para que recepción también pueda escanear.

## Novedades de la V0.4

- **Inicio según el rol**: administrador y recepción entran al Dashboard; el barbero entra directo a su Agenda (y no ve el Dashboard, que muestra datos de caja).
- **Análisis de forma de rostro** desde la ficha del cliente, botón "Analizar con foto".

### Cómo funciona el análisis (sin servicios de IA externos)

1. **MediaPipe Face Mesh** (librería de Google, gratis) detecta 468 puntos del rostro sobre la foto.
2. Se **corrige la inclinación** de la cabeza alineando la línea de los ojos.
3. Se miden 4 distancias: largo, ancho de frente, de pómulos y de mandíbula.
4. Se calculan 3 proporciones y se comparan con un **perfil de referencia por cada forma**. Cada forma recibe un puntaje de similitud de 0 a 100.
5. Si las dos primeras formas quedan muy cerca, avisa que la **confianza es baja** para que el barbero revise a mano.

No hay entrenamiento ni dataset: las referencias son proporciones antropométricas, así que el resultado siempre se puede explicar. La pantalla muestra las medidas, el porqué en palabras, y la similitud con las 6 formas.

**Privacidad**: todo ocurre dentro del dispositivo. La foto no se sube a ningún servidor y se descarta al cerrar; solo se guarda la forma resultante, las proporciones y la fecha. Aun así, una foto de rostro es dato biométrico: pide consentimiento al cliente antes de fotografiarlo.

La lógica vive en `lib/rostro.js` — ahí se ajustan los perfiles de referencia y las recomendaciones de corte de cada forma.

---

# V0.3 (mobile first)

SaaS de gestión para barberías. Prototipo navegable para testear la experiencia: todo funciona y se guarda, pero en el navegador de cada persona (aún no hay servidor ni base de datos).

**Los archivos ya están en esta carpeta.** No tienes que mover nada.

---

## Novedades de la V0.3 — móvil

En el celular (menos de 900px de ancho) la app cambia de forma:

- **Barra inferior fija** con Inicio, Agenda, Clientes, CRM y **Más** (Finanzas, Admin, sucursal y rol)
- **Cabecera compacta** arriba con el nombre de la barbería y la sucursal activa
- **Las tablas se convierten en tarjetas** apiladas, legibles sin desplazamiento horizontal
- **Los modales suben desde abajo** como hoja, al estilo de una app nativa
- Botones y campos con área táctil grande; los campos usan 16px para que **iPhone no haga zoom** al escribir
- Respeta la zona segura de los iPhone con notch

El sidebar sigue apareciendo en tablet y escritorio.

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
