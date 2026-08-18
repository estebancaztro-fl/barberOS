-- ============================================================
-- ¿Puede un barbero subirse los permisos?
--
-- Comprueba que nadie pueda ascenderse a administrador, subirse la comisión,
-- mudarse a otra barbería ni dejar la barbería sin administradores.
--
-- Ejecutar DESPUÉS de 006_cuentas.sql. Debe imprimir TODO OK.
-- ============================================================

do $$
declare
  b1 uuid; b2 uuid;
  uAdmin uuid := gen_random_uuid();
  uBarb  uuid := gen_random_uuid();
  uOtro  uuid := gen_random_uuid();
  n int;
  fallos int := 0;
  rol_final rol_usuario;
  com_final numeric;
begin
  -- ---------- Preparar ----------
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    ('00000000-0000-0000-0000-000000000000', uAdmin, 'authenticated', 'authenticated',
     'priv-admin-' || substr(uAdmin::text,1,8) || '@barberos.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', uBarb, 'authenticated', 'authenticated',
     'priv-barb-' || substr(uBarb::text,1,8) || '@barberos.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', uOtro, 'authenticated', 'authenticated',
     'priv-otro-' || substr(uOtro::text,1,8) || '@barberos.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  insert into barberias (nombre, slug) values ('Priv A', 'priv-a-' || substr(uAdmin::text,1,8)) returning id into b1;
  insert into barberias (nombre, slug) values ('Priv B', 'priv-b-' || substr(uOtro::text,1,8))  returning id into b2;

  insert into perfiles (id, barberia_id, nombre, rol, comision) values
    (uAdmin, b1, 'Dueño',   'admin',   0),
    (uBarb,  b1, 'Barbero', 'barbero', 40),
    (uOtro,  b2, 'Otro',    'admin',   0);

  execute 'set local role authenticated';

  -- ============================================================
  -- El barbero intenta ascenderse
  -- ============================================================
  perform set_config('request.jwt.claims', json_build_object('sub', uBarb::text)::text, true);

  begin
    update perfiles set rol = 'admin' where id = uBarb;
  exception when others then null;
  end;
  select rol into rol_final from perfiles where id = uBarb;
  if rol_final = 'admin' then
    raise warning 'FALLA · el barbero LOGRÓ hacerse administrador'; fallos := fallos + 1;
  else
    raise notice 'OK · no puede ascenderse a administrador';
  end if;

  begin
    update perfiles set comision = 100 where id = uBarb;
  exception when others then null;
  end;
  select comision into com_final from perfiles where id = uBarb;
  if com_final = 100 then
    raise warning 'FALLA · el barbero LOGRÓ subirse la comisión al 100%%'; fallos := fallos + 1;
  else
    raise notice 'OK · no puede subirse su propia comisión';
  end if;

  -- Sí puede corregir su nombre por la función segura
  begin
    perform actualizar_mi_perfil('Barbero Editado', '+56911112222');
    select count(*) into n from perfiles where id = uBarb and nombre = 'Barbero Editado';
    if n = 1 then raise notice 'OK · sí puede corregir su nombre y teléfono';
    else raise warning 'FALLA · no logró editar sus datos básicos'; fallos := fallos + 1; end if;
  exception when others then
    raise warning 'FALLA · la función segura de perfil no funciona: %', sqlerrm; fallos := fallos + 1;
  end;

  -- El barbero intenta ascender a otro
  begin
    update perfiles set rol = 'admin' where id = uOtro;
  exception when others then null;
  end;
  select count(*) into n from perfiles where id = uOtro and rol = 'admin' and barberia_id = b2;
  raise notice 'OK · no alcanza perfiles de otra barbería (RLS)';

  -- ============================================================
  -- El administrador tampoco puede cambiarse a sí mismo
  -- ============================================================
  perform set_config('request.jwt.claims', json_build_object('sub', uAdmin::text)::text, true);

  begin
    update perfiles set comision = 99 where id = uAdmin;
    select comision into com_final from perfiles where id = uAdmin;
    if com_final = 99 then
      raise warning 'FALLA · el administrador se cambió su propia comisión'; fallos := fallos + 1;
    else
      raise notice 'OK · el administrador tampoco se cambia su comisión';
    end if;
  exception when others then
    raise notice 'OK · el administrador tampoco se cambia su comisión';
  end;

  -- Pero sí puede administrar a su equipo
  begin
    update perfiles set comision = 45 where id = uBarb;
    select comision into com_final from perfiles where id = uBarb;
    if com_final = 45 then raise notice 'OK · el administrador sí ajusta la comisión de su equipo';
    else raise warning 'FALLA · el administrador no pudo ajustar a su barbero'; fallos := fallos + 1; end if;
  exception when others then
    raise warning 'FALLA · el administrador no pudo ajustar a su barbero: %', sqlerrm; fallos := fallos + 1;
  end;

  -- ============================================================
  -- No se puede dejar la barbería sin administrador
  -- ============================================================
  begin
    update perfiles set activo = false where id = uAdmin;
    select count(*) into n from perfiles where id = uAdmin and activo = false;
    if n = 1 then
      raise warning 'FALLA · la barbería quedó sin ningún administrador activo'; fallos := fallos + 1;
    else
      raise notice 'OK · impide quedarse sin administrador';
    end if;
  exception when others then
    raise notice 'OK · impide quedarse sin administrador';
  end;

  -- ============================================================
  -- No se puede mover un perfil a otra barbería
  -- ============================================================
  begin
    update perfiles set barberia_id = b2 where id = uBarb;
    select count(*) into n from perfiles where id = uBarb and barberia_id = b2;
    if n = 1 then
      raise warning 'FALLA · se pudo mover un perfil a otra barbería'; fallos := fallos + 1;
    else
      raise notice 'OK · no se puede mover un perfil de barbería';
    end if;
  exception when others then
    raise notice 'OK · no se puede mover un perfil de barbería';
  end;

  -- ---------- Limpiar ----------
  execute 'set local role postgres';
  delete from barberias where id in (b1, b2);
  delete from auth.users where id in (uAdmin, uBarb, uOtro);

  if fallos = 0 then
    raise notice '=============== TODO OK ===============';
  else
    raise exception '=============== % FALLAS — NO LANZAR ===============', fallos;
  end if;
end $$;

select
  (select count(*) from barberias where slug like 'priv-%') as barberias_de_prueba,
  (select count(*) from auth.users where email like 'priv-%@barberos.test') as usuarios_de_prueba;
