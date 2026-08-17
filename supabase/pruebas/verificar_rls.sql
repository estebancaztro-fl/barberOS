-- ============================================================
-- Prueba de aislamiento: ¿RLS realmente separa las barberías?
--
-- Crea dos barberías de prueba con sus usuarios, se hace pasar por cada uno
-- y comprueba que ninguno vea los datos del otro. Al terminar borra todo.
--
-- IMPORTANTE: en el SQL Editor corres como superusuario, y el superusuario
-- SE SALTA RLS. Por eso el script cambia de rol a 'authenticated' y arranca
-- con una prueba canario: si esa falla, significa que RLS no se está
-- aplicando y todo el resto daría un falso OK.
--
-- Supabase avisará "Potential issue detected" por las líneas de limpieza.
-- Es esperado: solo borra lo que el propio script acaba de crear.
--
-- Ejecutar completo. Debe imprimir TODO OK.
-- ============================================================

do $$
declare
  b1 uuid; b2 uuid;
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid();
  fantasma uuid := gen_random_uuid();
  c1 uuid; c2 uuid; r1 uuid;
  n int;
  fallos int := 0;
begin
  -- ---------- Usuarios de prueba ----------
  -- perfiles.id apunta a auth.users, así que los usuarios deben existir.
  -- Nunca inician sesión: son solo para comprobar las políticas.
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data)
  values
    ('00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
     'prueba-a-' || substr(u1::text,1,8) || '@barberos.test', '',
     now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated',
     'prueba-b-' || substr(u2::text,1,8) || '@barberos.test', '',
     now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', u3, 'authenticated', 'authenticated',
     'prueba-c-' || substr(u3::text,1,8) || '@barberos.test', '',
     now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  -- ---------- Dos barberías con datos ----------
  insert into barberias (nombre, slug)
    values ('Prueba A', 'prueba-a-' || substr(u1::text,1,8)) returning id into b1;
  insert into barberias (nombre, slug)
    values ('Prueba B', 'prueba-b-' || substr(u2::text,1,8)) returning id into b2;

  insert into perfiles (id, barberia_id, nombre, rol, comision)
  values (u1, b1, 'Admin A',   'admin',   0),
         (u2, b2, 'Admin B',   'admin',   0),
         (u3, b1, 'Barbero A', 'barbero', 40);

  insert into clientes (barberia_id, nombre, telefono)
    values (b1, 'Cliente de A', '+56911111111') returning id into c1;
  insert into clientes (barberia_id, nombre, telefono)
    values (b2, 'Cliente de B', '+56922222222') returning id into c2;

  insert into ingresos (barberia_id, fecha, concepto, monto, barbero_id)
    values (b1, current_date, 'Venta A', 10000, u3);

  insert into reservas (barberia_id, cliente_id, cliente_nombre, barbero_id, fecha, hora, estado)
    values (b1, c1, 'Cliente de A', u3, current_date, '10:00', 'reservado') returning id into r1;
  insert into reservas (barberia_id, cliente_id, cliente_nombre, fecha, hora, estado)
    values (b1, c1, 'Cliente de A', current_date, '12:00', 'reservado');

  -- ============================================================
  -- CANARIO: comprobar que RLS se está aplicando de verdad.
  -- Un usuario sin perfil no debe ver absolutamente nada.
  -- ============================================================
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
                     json_build_object('sub', fantasma::text)::text, true);

  select count(*) into n from clientes;
  if n <> 0 then
    execute 'set local role postgres';
    delete from barberias where id in (b1, b2);
    delete from auth.users where id in (u1, u2, u3);
    raise exception
      'RLS NO SE ESTÁ APLICANDO: un usuario sin perfil ve % clientes. Revisa que 002_rls.sql se haya ejecutado completo.', n;
  end if;
  raise notice 'OK · canario: RLS activo, un desconocido no ve nada';

  -- ---------- Admin de la barbería A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text)::text, true);

  select count(*) into n from clientes;
  if n <> 1 then raise warning 'FALLA · Admin A ve % clientes, debería ver 1', n; fallos := fallos + 1;
  else raise notice 'OK · Admin A ve solo su cliente'; end if;

  select count(*) into n from ingresos;
  if n <> 1 then raise warning 'FALLA · Admin A ve % ingresos, debería ver 1', n; fallos := fallos + 1;
  else raise notice 'OK · Admin A ve sus ingresos'; end if;

  -- ---------- Admin de la barbería B ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u2::text)::text, true);

  select count(*) into n from clientes where id = c1;
  if n <> 0 then raise warning 'FALLA · Admin B alcanza el cliente de A'; fallos := fallos + 1;
  else raise notice 'OK · el cliente de A es invisible para B'; end if;

  select count(*) into n from ingresos;
  if n <> 0 then raise warning 'FALLA · Admin B ve ingresos ajenos'; fallos := fallos + 1;
  else raise notice 'OK · las finanzas de A son invisibles para B'; end if;

  select count(*) into n from reservas;
  if n <> 0 then raise warning 'FALLA · Admin B ve reservas ajenas'; fallos := fallos + 1;
  else raise notice 'OK · las reservas de A son invisibles para B'; end if;

  -- ---------- Barbero de A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u3::text)::text, true);

  select count(*) into n from ingresos;
  if n <> 0 then raise warning 'FALLA · el barbero ve la tabla de ingresos (% filas)', n; fallos := fallos + 1;
  else raise notice 'OK · el barbero no accede a las finanzas'; end if;

  select count(*) into n from reservas;
  if n <> 1 then raise warning 'FALLA · el barbero ve % reservas, solo debería ver la suya', n; fallos := fallos + 1;
  else raise notice 'OK · el barbero ve solo sus reservas'; end if;

  select count(*) into n from clientes;
  if n <> 1 then raise warning 'FALLA · el barbero no puede leer la ficha del cliente'; fallos := fallos + 1;
  else raise notice 'OK · el barbero sí lee fichas de clientes (las necesita)'; end if;

  -- ---------- Consentimiento obligatorio para la foto ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text)::text, true);
  begin
    update reservas set foto_path = 'cortes/x.jpg' where id = r1;
    raise warning 'FALLA · guardó la foto sin consentimiento del cliente';
    fallos := fallos + 1;
  exception when others then
    raise notice 'OK · rechaza guardar foto sin consentimiento';
  end;

  insert into consentimientos (barberia_id, cliente_id, tipo, texto_version, origen)
    values (b1, c1, 'fotos_corte', 'v1', 'mostrador');

  begin
    update reservas set foto_path = 'cortes/x.jpg' where id = r1;
    raise notice 'OK · con consentimiento sí permite guardar la foto';
  exception when others then
    raise warning 'FALLA · bloquea la foto pese a existir consentimiento: %', sqlerrm;
    fallos := fallos + 1;
  end;

  -- ---------- Limpiar y resultado ----------
  execute 'set local role postgres';
  delete from barberias where id in (b1, b2);
  delete from auth.users where id in (u1, u2, u3);

  if fallos = 0 then
    raise notice '=============== TODO OK ===============';
  else
    raise exception '=============== % FALLAS — NO LANZAR ===============', fallos;
  end if;
end $$;

-- Comprobar que no quedó basura de la prueba
select
  (select count(*) from barberias where slug like 'prueba-%') as barberias_de_prueba,
  (select count(*) from auth.users where email like '%@barberos.test') as usuarios_de_prueba;
