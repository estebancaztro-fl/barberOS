# Supabase — instalación y verificación

## 1. Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) y crea cuenta (gratis).
2. **New project**. Nombre `barberos`. Región **South America (São Paulo)** — es la más cercana a Chile y mantiene los datos en la región.
3. Guarda la contraseña de la base en un lugar seguro. No la vas a volver a ver.

## 2. Ejecutar las migraciones

En el panel de Supabase, **SQL Editor** → **New query**. Pega y ejecuta **en este orden**, uno a la vez:

1. `migraciones/001_esquema.sql` — tablas
2. `migraciones/002_rls.sql` — seguridad
3. `migraciones/003_cumplimiento.sql` — Ley 21.719

Si alguno falla, detente y avísame. No sigas al siguiente.

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

Prueba adicional, manual: crea una **segunda** barbería con otro usuario, inicia sesión con
ese usuario en la app y confirma que **no ve ni un solo cliente** de la primera.

## 5. Conectar la app

En Vercel, **Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

Ambas están en **Project Settings → API**.

> ⚠️ La clave **`service_role`** NO va acá ni en ningún archivo del repositorio.
> Salta todas las políticas de seguridad. Si se filtra, cualquiera lee y borra la base completa.
> Úsala solo en tareas de servidor, guardada como variable de entorno privada.

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
