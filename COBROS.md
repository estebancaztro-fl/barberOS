# Cobro de suscripciones — Mercado Pago

## Por qué no Stripe

Stripe **no opera en Chile**: no se puede abrir una cuenta con RUT chileno. En
Latinoamérica solo está en Brasil y México. La alternativa sería constituir una
sociedad en EE.UU. con Stripe Atlas (~US$500 más mantención y contabilidad
gringa), lo que no se justifica para empezar.

Mercado Pago funciona con RUT chileno, tiene suscripciones recurrentes nativas
y acepta las tarjetas que usan tus clientes.

Todo lo específico de la pasarela vive en `lib/pagos.js`. Cambiarla más adelante
es reemplazar ese archivo, no reescribir la app.

## El plan

| Concepto | Valor |
|---|---|
| Prueba gratis | 14 días |
| Plan base | $19.990 al mes |
| Barberos incluidos | 4 atendiendo |
| Barbero adicional | $5.990 al mes cada uno |

Los precios de la lista están en `lib/planes.js`. Lo que se le cobra a cada
barbería está guardado en su propia fila (`precio_base`, `precio_extra`): si
mañana subes la lista, **quien ya es cliente conserva el precio con que entró**.

Cuentan cupo solo los perfiles con `atiende` activo. Un administrador que no
corta pelo, o alguien de recepción, no ocupa cupo.

## Configurar Mercado Pago

1. Entra a [mercadopago.cl/developers](https://www.mercadopago.cl/developers) con
   tu cuenta y crea una aplicación. Tipo: **Suscripciones**.
2. En **Credenciales de producción** copia el **Access token**.
3. En **Webhooks**, configura la URL:

   ```
   https://TU-DOMINIO/api/suscripcion/webhook
   ```

   Marca los eventos de **suscripciones** y **pagos**. Al guardar, Mercado Pago
   te muestra una **clave secreta**: cópiala, no se vuelve a mostrar.

4. En Vercel, **Settings → Environment Variables**:

   ```
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
   MERCADOPAGO_WEBHOOK_SECRET=...
   NEXT_PUBLIC_SITIO=https://tu-dominio.cl
   ```

   Ninguna lleva `NEXT_PUBLIC_` salvo la última: el token de acceso **jamás**
   debe llegar al navegador. Con él, cualquiera cobra y devuelve plata en tu
   nombre.

5. Prueba primero con las credenciales de **prueba** y las tarjetas de test de
   Mercado Pago. Recién después cambia a producción.

Mientras no configures estas variables, la app funciona igual: la pantalla de
suscripción avisa que el cobro en línea no está disponible y puedes activar
cuentas a mano.

## Activar una barbería a mano

Mientras cobras por transferencia, o para tu propia cuenta:

```sql
update barberias
   set estado_plan = 'activa',
       periodo_hasta = now() + interval '1 month'
 where slug = 'barber-royce';
```

Para regalar más días de prueba:

```sql
update barberias set prueba_hasta = current_date + 30 where slug = 'barber-royce';
```

## Qué impide la base por sí sola

Esto no depende de que la interfaz esconda botones. Aunque alguien llame la API
directamente, se cumple igual:

- **Sin plan vigente no se escribe nada.** Triggers en reservas, ingresos,
  gastos, servicios, comisiones y clientes. Ver, exportar e imprimir sí funciona:
  la cuenta queda en solo lectura, nunca se pierden datos.
- **El link público deja de ofrecer horas** cuando el plan vence, así el cliente
  final ve "no hay horas" en vez de un error técnico.
- **No se puede exceder el cupo.** Ni creando un perfil nuevo ni activándole
  `atiende` a uno existente.
- **Ampliar el cupo solo lo hace el servidor**, después de actualizar el monto en
  Mercado Pago. `fijar_cupo()` no tiene permiso para `authenticated`.
- **Un cobro rechazado da 5 días de gracia** antes de cortar. Un problema del
  banco no puede dejar a una barbería sin agenda en plena jornada.
- **Reenviar el mismo aviso de pago no acredita dos meses**, por el
  `unique(proveedor, referencia)` en `cobros`.

## La excepción deliberada

Anonimizar datos de un cliente **funciona aunque la barbería no haya pagado**.
Los derechos del titular bajo la Ley 21.719 no son un servicio que se pueda
suspender por falta de pago. Está escrito explícitamente en
`exigir_plan_vigente_cliente()` y probado en `verificar_suscripcion.sql`.

## El webhook

Tres reglas en `app/api/suscripcion/webhook/route.js`:

1. **Se valida la firma** (`x-signature`, HMAC-SHA256). Sin esto, cualquiera que
   adivine la dirección se activa la suscripción gratis con un POST. También se
   rechazan las firmas de más de 15 minutos, para que no sirva reenviar un aviso
   capturado.
2. **No se cree nada del cuerpo salvo el identificador**: el estado y el monto se
   vuelven a consultar a la API de Mercado Pago.
3. **Siempre responde 200.** Si devolviera error, Mercado Pago reintentaría en
   bucle por algo que quizás nunca va a funcionar.
