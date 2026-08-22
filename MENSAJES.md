# Mensajes a clientes

## Lo que WhatsApp permite y lo que no

Esto define todo el diseño, así que conviene tenerlo claro antes de prometerle
algo a un cliente:

**No se pueden enviar mensajes automáticos desde la app WhatsApp Business del
celular.** Esa app es para escribir a mano. No tiene forma de que un programa
externo mande mensajes por ella. Cualquier servicio que diga lo contrario está
usando automatización no oficial, que Meta bloquea y termina con el número
suspendido.

Para envíos automáticos hace falta la **Cloud API de Meta**, y eso implica:

- Verificación del negocio ante Meta.
- Un **número dedicado**. Al conectarlo a la API, ese número **deja de
  funcionar en la app WhatsApp Business**. Un barbero que usa su número para
  hablar con clientes todo el día no puede entregarlo.
- Plantillas aprobadas por Meta, una por una. Un recordatorio de cita entra
  como plantilla *utility*, que es la categoría barata.
- Costo **por mensaje entregado** desde julio de 2025.

## Cómo funciona hoy

Envío asistido. La app arma el mensaje y abre WhatsApp con el texto ya escrito;
el barbero aprieta enviar. Sale de su propio número, sin costo por mensaje y sin
trámites con Meta.

**Recordatorio antes de la cita**

1. Administración → Mensajes: se activa, se elige cuánto antes (25 minutos por
   defecto) y se edita el texto.
2. El barbero activa los avisos del navegador, en cada dispositivo.
3. Con BarberOS abierto, el navegador le avisa cuando falten esos minutos.
4. En la agenda aparece el bloque **"citas por empezar"** con un botón que abre
   WhatsApp. Al enviar, queda registrado y no se vuelve a ofrecer.

**Campañas del CRM**

Preparar la campaña genera un mensaje por destinatario, ya personalizado. La
lista "por enviar" queda abajo, con un botón por cliente. Se puede usar
`{cliente}` en el texto para saludar por su nombre.

## Límite honesto del aviso

El aviso del navegador **corre solo con BarberOS abierto**. Con la pestaña
cerrada el navegador no ejecuta nada. Sirve durante la jornada, no de
madrugada, y en iPhone es menos confiable que en Android.

Para un aviso que llegue siempre, sin depender de que alguien tenga la app
abierta, hay que enviar desde el servidor con la Cloud API.

## Qué falta para el envío automático

El camino es el **Embedded Signup** de Meta: BarberOS se registra como Tech
Provider y cada barbería conecta su número con un botón, sin entender nada de
la API. Es como funcionan Wati o Respond.io.

Pasos, en orden:

1. Cuenta de Meta Business verificada para BarberOS.
2. App de Meta con los permisos `whatsapp_business_management` y
   `whatsapp_business_messaging`, aprobados en App Review.
3. Embedded Signup en la pantalla de Administración → Mensajes.
4. Plantilla de recordatorio enviada a aprobación de Meta.
5. Un proceso en el servidor que recorra las citas próximas y envíe.

La base ya está preparada: `barberias.whatsapp_modo`, `whatsapp_numero` y
`whatsapp_id_externo` guardan la conexión, y la tabla `mensajes` es la misma
cola que usará el envío automático. Cuando llegue ese paso, cambia **quién**
manda el mensaje, no cómo se arma ni dónde se registra.

## Antes de activarlo, dos cosas

**Consentimiento.** Bajo la Ley 21.719 el cliente tiene que haber aceptado que
lo contacten. La reserva online ya pide esa autorización; una campaña de
promociones es otra finalidad y conviene pedirla aparte antes de escalar esto.

**Política de Meta.** Los mensajes de marketing por Cloud API exigen opt-in
explícito y verificable. Mandar promociones a una lista comprada o a clientes
que nunca aceptaron termina con el número bloqueado.
