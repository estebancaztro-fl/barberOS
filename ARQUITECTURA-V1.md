# BarberOS V1 — Supabase, Ley 21.719 y seguridad

Plan de arquitectura para pasar del prototipo a una app real con sesiones por usuario.

> **Advertencia**: no soy abogado. Este documento traduce la ley a decisiones técnicas,
> pero antes de operar con clientes reales conviene que un abogado de protección de datos
> revise tu política de privacidad y tus contratos. Las multas llegan a 20.000 UTM
> (unos $1.400 millones) y hasta 4% de los ingresos anuales en caso de reincidencia.

---

## 1. Fechas y por qué importa ahora

La Ley N° 21.719 se publicó el 13 de diciembre de 2024 y **entra en vigencia el 1 de diciembre de 2026**.
Construir la V1 cumpliendo desde el día uno cuesta mucho menos que readaptar después: la mayoría
de los requisitos son decisiones de esquema de base de datos, y cambiarlas con datos productivos
es caro y riesgoso.

Aplica a **toda organización que trate datos personales en Chile, sin importar su tamaño**.
Una barbería con 200 clientes en la base está dentro.

---

## 2. El punto crítico: el visagismo trata datos sensibles

La ley clasifica los **datos biométricos —incluido el rostro— como datos sensibles**. Eso implica:

- Consentimiento **explícito y otorgado por separado** del consentimiento general
- Informar previamente qué sistema se usa, con qué finalidad, por cuánto tiempo y cómo ejercer derechos
- El titular puede **retirar el consentimiento en cualquier momento**, sin perjuicio
- Evaluación de impacto previa y medidas de seguridad reforzadas

### Decisión de diseño que reduce muchísimo el riesgo

Hoy el análisis ya corre **dentro del dispositivo** y la foto se descarta. Eso hay que mantenerlo,
y además conviene ajustar qué se guarda:

| Dato | Hoy | Propuesta V1 | Razón |
|---|---|---|---|
| Foto del rostro | No se guarda | No se guarda | Es lo que más riesgo concentra |
| Forma resultante ("Ovalado") | Se guarda | **Se guarda** | Es una categoría estética, no identifica a nadie |
| Proporciones exactas (r1, r2, r3) | Se guarda | **No guardar** | Son medidas del rostro: se acercan a dato biométrico sin aportar valor al barbero |
| Confianza y fecha | Se guarda | Se guarda | Trazabilidad, no es biométrico |

Guardar solo la categoría te deja en una posición mucho más defendible: no almacenas datos que
permitan reconstruir o identificar un rostro. Es un cambio de tres líneas y vale la pena hacerlo.

### Las fotos del corte terminado

No son biométricas si no se usan para identificar, pero **sí son datos personales**. Necesitan:

- Consentimiento del cliente al momento de tomarlas (casilla explícita, no preseleccionada)
- Almacenamiento en bucket **privado** con URLs firmadas de corta duración, nunca público
- Plazo de retención definido y borrado automático al cumplirse

---

## 3. Esquema de datos

Multi-tenant: **cada tabla lleva `barberia_id`** y toda consulta se filtra por él vía RLS.

```
barberias          id · nombre · slug · logo_url · creada_en
sucursales         id · barberia_id · nombre · direccion · telefono · activa
perfiles           id (= auth.users.id) · barberia_id · nombre · rol · comision · activo
                   rol: 'admin' | 'recepcion' | 'barbero'
servicios          id · barberia_id · nombre · duracion · precio · activo
clientes           id · barberia_id · nombre · telefono · correo · vip
                   forma_rostro · tipo_pelo · densidad · observaciones
                   consent_datos_en · consent_fotos_en · consent_visagismo_en
                   anonimizado_en
reservas           id · barberia_id · sucursal_id · cliente_id · barbero_id · servicio_id
                   fecha · hora · estado · notas · foto_path
ingresos           id · barberia_id · fecha · concepto · metodo · monto · barbero_id
gastos             id · barberia_id · fecha · categoria · descripcion · monto
pagos_comision     id · barberia_id · barbero_id · mes · monto · metodo · comprobante_path

-- Exigidas por la ley --
consentimientos    id · cliente_id · tipo · otorgado_en · revocado_en · texto_version · origen
registro_actividad id · barberia_id · actor_id · accion · entidad · entidad_id · creado_en · ip_hash
solicitudes_arco   id · cliente_id · tipo · estado · solicitada_en · resuelta_en · notas
brechas            id · detectada_en · notificada_en · descripcion · afectados · medidas
```

`tipo` en consentimientos: `datos_basicos` · `fotos_corte` · `visagismo` · `marketing`.
Separados a propósito: la ley exige consentimiento independiente para los sensibles y
para marketing, y el cliente puede revocar uno sin perder el servicio.

---

## 4. Seguridad — lo que no puede faltar

### Row Level Security: la única barrera que importa

Sin RLS, cualquiera con la clave pública de Supabase lee la base completa. **Es el error más
frecuente y más grave en apps hechas con IA.** RLS activado en *todas* las tablas, sin excepción.

```sql
alter table clientes enable row level security;

-- Cada quien ve solo su barbería
create policy "misma barberia" on clientes for select
using (barberia_id = (select barberia_id from perfiles where id = auth.uid()));

-- Solo admin y recepción crean o editan clientes
create policy "escritura admin" on clientes for all
using (
  barberia_id = (select barberia_id from perfiles where id = auth.uid())
  and (select rol from perfiles where id = auth.uid()) in ('admin','recepcion')
);
```

Las finanzas llevan política aún más estricta: **solo `rol = 'admin'`**. Hoy eso se esconde en la
interfaz, lo cual no protege nada — cualquiera que sepa mirar la red ve los datos. En V1 la
restricción vive en la base.

### Checklist

| Riesgo | Medida |
|---|---|
| Fuga masiva por falta de RLS | RLS en todas las tablas + prueba automatizada que falle si alguna queda sin política |
| Clave de servicio expuesta | `service_role` **solo** en variables de entorno del servidor, nunca en código de cliente |
| Robo de cuenta de administrador | Segundo factor obligatorio para `rol = 'admin'` |
| Fuerza bruta en el login | Límite de intentos por IP y por correo |
| Abuso del link público de reservas | Límite de reservas por teléfono y por IP, más captcha si escala |
| Datos manipulados desde el cliente | Validación en el servidor; los montos de comisión se calculan en base de datos, nunca se aceptan del navegador |
| Fotos accesibles por URL | Bucket privado + URLs firmadas de 60 segundos |
| No saber qué pasó tras un incidente | `registro_actividad` en toda lectura de datos sensibles y toda exportación |
| Dependencias con vulnerabilidades | Dependabot en GitHub y `npm audit` en cada despliegue |
| Secretos filtrados en el repo | Escaneo de secretos activado en GitHub |

---

## 5. Obligaciones legales traducidas a funciones

| Obligación | Qué construir |
|---|---|
| **Consentimiento explícito y separable** | Pantalla de alta de cliente con casillas independientes; ninguna preseleccionada. Registrar versión del texto aceptado. |
| **Derechos ARCO + portabilidad** | Sección en la ficha del cliente: exportar sus datos en JSON, rectificar, eliminar. Plazo de respuesta y estado en `solicitudes_arco`. |
| **Derecho al olvido** | Anonimizar en vez de borrar: el cliente pasa a "Cliente eliminado", se borran contacto y fotos, se conservan los montos porque el SII exige respaldo tributario. |
| **Registro de actividades de tratamiento** | Documento vivo: qué datos, para qué, cuánto tiempo, con quién se comparten. Lo genero cuando definamos el alcance. |
| **Notificación de brechas en 72 horas** | Procedimiento escrito + tabla `brechas` + alerta automática ante accesos anómalos. |
| **Encargados de tratamiento** | Supabase y Vercel procesan datos por ti: hay que firmar sus DPA y dejar constancia de dónde se alojan los datos. |
| **Delegado de Protección de Datos** | Obligatorio si el tratamiento es significativo. Con volumen de barbería probablemente baste un responsable designado; confírmalo con abogado. |
| **Minimización** | No pedir datos que no se usan. Hoy el correo del cliente es opcional: mantenerlo así. |

---

## 6. Orden sugerido

**Etapa 1 — Fundaciones (sin esto, nada más importa)**
Proyecto Supabase · esquema con `barberia_id` · RLS en todas las tablas · login por correo ·
tabla `perfiles` ligada a `auth.users` · migrar el prototipo a leer de la base

**Etapa 2 — Cumplimiento**
Consentimientos separados · exportar y eliminar datos del cliente · anonimización ·
`registro_actividad` · quitar las proporciones faciales del guardado

**Etapa 3 — Endurecimiento**
Segundo factor para administradores · límites de intentos · bucket privado con URLs firmadas ·
prueba automatizada de RLS · alertas de acceso anómalo

**Etapa 4 — Documentos**
Política de privacidad · registro de actividades · procedimiento de brechas · DPA firmados

Las etapas 1 y 2 deberían ir juntas al mismo despliegue: sacar la 1 a producción con clientes
reales y dejar la 2 para después significa recolectar datos sin base legal.

---

## 7. Costo

Supabase gratis cubre 500 MB de base y 1 GB de archivos: alcanza para varias barberías chicas.
El plan de $25 al mes se justifica cuando aparezcan las fotos en volumen o quieras respaldos
con retención larga. Vercel sigue gratis.
