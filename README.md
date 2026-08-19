# BarberOS — V1.0-beta (migración a Supabase completa)

**Todos los módulos guardan en la base de datos.** Agenda, clientes, visagismo,
finanzas, CRM, equipo, servicios, sucursales y reservas públicas. Lo que un
barbero anota en su celular aparece en el computador de recepción.

### Antes de nada: corre la migración 008

`supabase/migraciones/008_alinear.sql` agrega campos que faltaban —cortes
acumulados, última visita, registro de visagismo, tabla de campañas— y hace
que la **base calcule sola** los cortes y la última visita de cada cliente,
en vez de confiar en que la app se acuerde de actualizarlos.

### Consentimientos, ahora de verdad

Añadir un cliente, guardar un visagismo o subir una foto **exigen consentimiento**.
No es una casilla decorativa: la base rechaza la operación si no existe el registro.

### Modo local intacto

Sin variables de entorno configuradas, la app sigue funcionando contra el navegador
como el primer día. Útil para mostrarla sin conexión o volver atrás si algo falla.

### Lo que sigue

1. Onboarding: registro automático de barberías nuevas (requiere conectar servicio de correo)
2. Landing con planes y precios

# V0.14 (reservas públicas y barbería en la base)

**Corregido**: el link de reservas daba "Barbería no encontrada". La página pública
seguía leyendo del navegador, donde la barbería tenía otro nombre que el de la base.

- La página pública ahora usa las **funciones seguras** `publico_barberia`,
  `publico_horas_ocupadas` y `publico_reservar`. El visitante nunca toca una tabla:
  no puede listar clientes ni ver teléfonos aunque manipule las peticiones
- **Casilla de consentimiento obligatoria** antes de reservar, como exige la Ley 21.719.
  La base rechaza la reserva si no viene marcada
- Las **horas ocupadas se consultan de verdad**, así dos personas no pueden tomar
  la misma hora desde dos teléfonos
- **Nombre, link y logo de la barbería se guardan en la base**. Antes se perdían al
  recargar. El nombre se guarda al salir del campo o con Enter, no en cada tecla
- El **logo se comprime a 320px** antes de guardarlo

# V0.13 (arreglo del visagismo + revisor)

**Corregido**: guardar el visagismo tumbaba la app con "Application error". La ficha
usaba `hoyISO()` sin haberlo importado — un error que **no aparece al compilar**,
porque JavaScript asume que un nombre desconocido podría ser una variable global.
Solo revienta cuando el usuario toca el botón.

### Revisor antes de subir

Para que no vuelva a pasar, hay un revisor que detecta funciones propias usadas
sin importar:

```bash
node revisar.mjs
```

Debe terminar con `✓ N archivos revisados, sin problemas`. Si algo falta, dice
qué función y desde dónde se exporta. Correrlo **antes de cada subida a GitHub**.

Está probado en los dos sentidos: pasa limpio con el código correcto, y detecta
el error cuando se reintroduce a propósito. Un revisor que solo dice "todo bien"
no sirve de nada.

# V0.12 (cuentas del equipo)

**Cómo entra un barbero.** El dueño lo crea desde Admin → Equipo con su correo. El sistema
genera una **clave temporal legible** (tipo `tijera-corte-4821`) que se muestra **una sola vez**
y se puede copiar para mandar por WhatsApp. Al primer ingreso, la app **obliga** a cambiarla
por una propia que nadie más conoce.

- **Restablecer clave**: botón 🔑 en cada miembro, para el "se me olvidó" del sábado
- **Desactivar en vez de eliminar**: deja de poder entrar, pero sus cortes y comisiones
  se conservan en las finanzas de meses anteriores
- No se puede dejar la barbería **sin ningún administrador activo**

### Corrección de seguridad importante

La política que dejaba a cada usuario editar su propio perfil también le permitía
**cambiarse el rol y la comisión**: un barbero podía ponerse `admin` y ver todas las
finanzas. Corregido en `006_cuentas.sql`:

- Se eliminó esa política; ahora hay una función que solo toca nombre y teléfono
- Un disparador impide que **cualquiera** cambie su propio rol o comisión, incluido el dueño
- No se puede mover un perfil a otra barbería
- `pruebas/verificar_privilegios.sql` intenta todos esos ataques y debe fallar en todos

### Variable nueva

`SUPABASE_SECRET_KEY` (sin `NEXT_PUBLIC_`) — necesaria para crear cuentas. Va **solo**
en el servidor; Next se niega a incluirla en el paquete del navegador.

# V0.11 (inicio de sesión real)

Primera etapa de la migración a Supabase.

- **Pantalla de inicio de sesión** en `/login`, con correo y contraseña
- **El rol viene de la base de datos**, no del navegador. Ya no se puede cambiar
  de rol desde el sidebar cuando hay sesión iniciada
- **Cerrar sesión** desde el menú de usuario
- La **página pública de reservas** sigue abierta sin login, como corresponde
- **Si no configuras las variables de entorno, la app sigue funcionando en modo local**
  igual que antes: nada se rompe mientras migras

### Variables de entorno

Copia `.env.example` como `.env.local` y llena los dos valores desde
Supabase → Project Settings → API. En Vercel van en Settings → Environment Variables.

### Lo que todavía NO está migrado

Agenda, clientes, finanzas, CRM y admin siguen guardando en el navegador. Son
20 operaciones de escritura que se migran módulo por módulo en las próximas etapas.

# V0.10 (link con el nombre y logo eliminable)

- El **link de reservas toma el nombre de la barbería**: si la llamas "Barbería Ñuñoa",
  el link pasa a ser `/b/barberia-nunoa`. Quita tildes, la ñ y los símbolos raros.
- Los **links anteriores siguen funcionando**. Al cambiar el nombre, la dirección vieja
  queda guardada y sigue abriendo la página de reservas, así los QR ya impresos y los
  mensajes ya enviados no se rompen. En Admin se ven cuáles siguen vivos.
- La **dirección se puede editar a mano** si prefieres una distinta del nombre.
- El **logo se puede eliminar**, no solo cambiar: botón en la esquina de la miniatura
  y otro debajo.

# V0.9 (el consejo queda como constancia)

El resumen de visagismo ahora se **guarda como copia fija** en la ficha del cliente, no se
recalcula cada vez. Queda registro de lo que efectivamente se le dijo a ese cliente y cuándo.

- Se guarda al escanear **y** al elegir la forma a mano; la cabecera distingue ambos casos
- El bloque subió al inicio de la tarjeta, justo bajo el botón de scan
- `VERSION_CATALOGO` en `lib/rostro.js` sella cada copia. Al editar los textos de `FORMAS`,
  sube esa versión: las fichas asesoradas con la versión anterior muestran un aviso y un
  botón para actualizarlas, en vez de cambiar solas y en silencio
- Las fichas antiguas sin copia siguen funcionando: caen al catálogo vigente

# V0.8 (feedback de usuarios)

Cambios a partir del testeo con barberos:

**El barbero ahora tiene su propia pantalla de inicio.** Al entrar ve su próximo cliente con el botón de Visagismo Scan al lado, y sus métricas del mes: cortes realizados, dinero generado, su porcentaje de comisión, cuánto lleva pagado y cuánto le queda por cobrar. Antes lo mandaba directo a la agenda; el feedback dijo que necesita autoevaluarse.

**El Visagismo Scan pasó a primer plano.** Es un botón grande y oscuro con halo, lo primero que aparece al abrir una reserva y al abrir la ficha de un cliente. Antes estaba escondido entre los campos del perfil capilar.

**El dictado por voz bajó de jerarquía.** Sigue disponible en la ficha, pero ya no compite visualmente con el visagismo.

**Identidad del barbero.** Para poder mostrarle sus propias métricas, la app necesita saber quién es. Por ahora se elige desde el menú de usuario ("Quién eres"); con Supabase vendrá de la sesión.

> Ver [ARQUITECTURA-V1.md](ARQUITECTURA-V1.md) para el plan de Supabase, cumplimiento de la Ley 21.719 y seguridad.

# V0.7 (ajustes desde Figma)

Cambios traídos del sistema de diseño en Figma:

**Tipografía más liviana en los titulares**

| Estilo | Antes | Ahora |
|---|---|---|
| Título/Página (38px) | ExtraBold 800 | Medium 500 |
| Título/Cifra (34px) | ExtraBold 800 | SemiBold 600 |
| Título/Tarjeta (17px) | Bold 700 | SemiBold 600 |
| Cuerpo/Fuerte (15px) | Bold 700 | SemiBold 600 |

Título/Sección (23px Bold) se mantiene.

**Escala de radios reducida a cuatro valores**

Se eliminaron `radio/xl` (22px) y `radio/2xl` (26px). Todo se colapsó a:

| Token | Valor | Dónde |
|---|---|---|
| `--r-xs` | 5px | detalles y miniaturas |
| `--r-sm` | 10px | botones, campos, chips cuadrados |
| `--r` | 18px | tarjetas, modales, hojas |
| `--r-full` | 999px | chips e insignias |

Las tarjetas bajaron de 22 a 18px y los modales de 26 a 18px, así que la interfaz quedó menos redondeada. Los valores sueltos que había (11, 12, 14, 16, 20, 26) se ajustaron al escalón más cercano.

La escala vive en `:root` de `app/globals.css` y está sincronizada con la colección **Radio** del archivo de Figma.

# V0.6 (foto del resultado)

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
