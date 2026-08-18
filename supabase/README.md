# Supabase — instalación y verificación

## 1. Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) y crea cuenta (gratis).
2. **New project**. Nombre `barberos`. Región **South America (São Paulo)** — es la más cercana a Chile y mantiene los datos en la región.
3. Guarda la contraseña de la base en un lugar seguro. No la vas a volver a ver.

### Casillas de Security al crear el proyecto

| Opción | Cómo dejarla | Por qué |
|---|---|---|
| Enable Data API | ✅ **marcada** | La app se conecta por ahí |
| Automatically expose new tables | ⬜ **desmarcada** | Ninguna tabla queda accesible hasta que se otorgue permiso a mano en `005_permisos.sql`. Si algún día creas una tabla y olvidas protegerla, queda invisible en vez de pública |
| Enable automatic RLS | ✅ **marcada** | Activa protección en toda tabla nueva automáticamente. Es la red contra el error más común: olvidar RLS |

## 2. Ejecutar las migraciones

En el panel de Supabase, **SQL Editor** → **New query**. Pega y ejecuta **en este orden**, uno a la vez:

1. `migraciones/001_esquema.sql` — tablas
2. `migraciones/002_rls.sql` — seguridad por rol
3. `migraciones/003_cumplimiento.sql` — Ley 21.719
4. `migraciones/004_publico.sql` — página pública de reservas
5. `migraciones/005_permisos.sql` — permisos explícitos
6. `migraciones/006_cuentas.sql` — cuentas del equipo y corrección de privilegios
7. `migraciones/007_permisos_servidor.sql` — permisos para crear cuentas desde el servidor

Si alguno falla, detente y avísame. No sigas al siguiente.

**El paso 5 termina mostrando una tabla de resultados: tiene que salir vacía.** Si aparece
alguna fila, esa tabla quedó accesible para visitantes anónimos.

### Por qué la página pública necesita su propia migración

Quien entra a `/b/tu-barberia` no tiene sesión iniciada, así que las políticas de RLS
—que dependen del usuario autenticado— le niegan todo. En vez de abrirle las tablas,
`004_publico.sql` le da **tres funciones controladas**: ver la barbería, consultar horas
ocupadas y crear una reserva. El rol anónimo nunca toca una tabla directamente, así que
no puede listar clientes, ver teléfonos ni leer finanzas aunque manipule las peticiones.

Esas funciones además validan que el servicio y la sucursal sean de esa barbería,
que la hora esté libre, que exista consentimiento, y frenan el abuso con un máximo de
3 reservas por teléfono al día.

## 3. Crear tu barbería y tu usuario

**Authentication → Users → Add user**, con tu correo y contraseña. Copia el UUID que aparece.

Luego en SQL Editor, reemplazando los valores:

```sql
insert into barberias (nombre, slug, correo_contacto)
values ('Barber Royce', 'barber-royce', 'tu@correo.cl')
returning id;
-- copia el id que devuelve

insert into perfiles (id, barberia_id, nombre, rol, comision)
values (
  'UUID-DEL-USUARIO-QUE-CREASTE',
  'UUID-DE-LA-BARBERIA',
  'Esteban', 'admin', 0
);
```

## 4. Verificar que RLS realmente aísla

**Este paso no es opcional.** Es la diferencia entre una base protegida y una base abierta.

En SQL Editor, ejecuta el archivo `pruebas/verificar_rls.sql`. Debe imprimir `TODO OK`.
Si alguna prueba falla, hay una filtración de datos y no se puede lanzar.

Corre también `pruebas/verificar_privilegios.sql`. Comprueba que **un barbero no pueda
ascenderse a administrador** ni subirse la comisión, y que la barbería no pueda quedarse
sin administradores. También debe imprimir `TODO OK`.

Prueba adicional, manual: crea una **segunda** barbería con otro usuario, inicia sesión con
ese usuario en la app y confirma que **no ve ni un solo cliente** de la primera.

## 5. Conectar la app (estado actual: solo el inicio de sesión)

> **Dónde vamos**: el login ya usa Supabase — la identidad, el rol y la barbería
> salen de la base. El resto de las pantallas (agenda, clientes, finanzas) todavía
> guardan en el navegador. Se migran módulo por módulo en los siguientes pasos.
>
> Mientras no configures las variables de abajo, la app sigue funcionando en modo
> local como hasta ahora: no se rompe nada.

En Vercel, **Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Ambas están en **Project Settings → API Keys**.

| Clave | Empieza con | Dónde va |
|---|---|---|
| **Publishable key** | `sb_publishable_` | ✅ En la app. Es la que necesitas |
| **Secret key** | `sb_secret_` | ❌ Nunca en la app ni en el repositorio |

> ⚠️ La **Secret key** (antes `service_role`) **se salta todas las políticas de seguridad**.
> Quien la tenga lee y borra la base completa, sin importar el RLS. No la pongas en
> variables que empiecen con `NEXT_PUBLIC_`, no la subas al repositorio y no la muestres
> en capturas de pantalla. Si alguna vez se filtra, regenérala de inmediato desde ese
> mismo panel.
>
> La app tiene una protección extra: si detecta que se configuró una clave secreta
> en el navegador, se niega a conectarse en vez de exponerla.

## 6. Storage para las fotos

**Storage → New bucket**, nombre `cortes`, **Public: NO**.

Política de acceso:

```sql
create policy "fotos de mi barberia" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'cortes'
    and (storage.foldername(name))[1] = mi_barberia()::text
  );
```

Las fotos se guardan en `cortes/{barberia_id}/{reserva_id}.jpg` y se muestran con URLs
firmadas de 60 segundos, nunca con enlaces permanentes.

## 7. Limpieza automática

**Database → Extensions**, activa `pg_cron`. Luego:

```sql
select cron.schedule('purga-mensual', '0 3 1 * *', $$ select purgar_datos_antiguos() $$);
```

Borra fotos de más de 2 años y anonimiza clientes sin actividad en 5 años, como pide
el principio de no conservar datos más de lo necesario.

---

## Lo que la base impide por sí sola

Estas reglas viven en PostgreSQL, no en la interfaz. Aunque la app tenga un error o
alguien llame la API directamente, se cumplen igual:

| Regla | Cómo se aplica |
|---|---|
| Nadie ve datos de otra barbería | RLS con `barberia_id = mi_barberia()` en todas las tablas |
| Solo el administrador ve las finanzas | Políticas `soy_admin()` en `ingresos` y `gastos` |
| El barbero ve solo sus reservas | Política que compara `barbero_id = auth.uid()` |
| El barbero ve solo sus comisiones | Política en `pagos_comision` |
| No se guarda foto sin autorización | Trigger `exigir_consentimiento_foto` |
| No se guarda visagismo sin autorización | Trigger `exigir_consentimiento_visagismo` |
| La comisión no se puede falsear desde el navegador | Se calcula en `mis_metricas()` dentro de la base |
| Queda rastro de exportaciones y borrados | `registrar_actividad()` |
