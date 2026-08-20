-- ============================================================
-- Prueba de horarios y bloqueos
--
-- Comprueba que la disponibilidad que calcula la base sea la correcta:
-- respeta el día cerrado, los bloqueos completos y parciales, distingue
-- un bloqueo de una sola persona del cierre de la barbería, y rechaza
-- una reserva fuera de horario aunque se llame la función directamente.
--
-- Supabase avisará "Potential issue detected" por las líneas de limpieza.
-- Es esperado: solo borra lo que el propio script acaba de crear.
--
-- Ejecutar completo. Debe imprimir TODO OK.
-- ============================================================

do $$
declare
  b   uuid;
  suc uuid;
  srv uuid;
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  sufijo text := substr(u1::text, 1, 8);
  slug   text := 'prueba-h-' || sufijo;
  lunes    date;
  domingo  date;
  n int;
  fallos int := 0;
begin
  -- ---------- Fechas: el próximo lunes y el próximo domingo ----------
  -- Siempre futuras, para que no interfiera el filtro de horas pasadas.
  lunes   := current_date + ((8 - extract(dow from current_date)::int) % 7 + 7);
  domingo := lunes + 6;

  -- ---------- Barbería de prueba con dos personas que atienden ----------
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data)
  values
    ('00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
     'prueba-h1-' || sufijo || '@barberos.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated',
     'prueba-h2-' || sufijo || '@barberos.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  insert into barberias (nombre, slug) values ('Prueba Horarios', slug) returning id into b;

  insert into sucursales (barberia_id, nombre, activa)
    values (b, 'Única', true) returning id into suc;

  insert into perfiles (id, barberia_id, nombre, rol, comision, atiende)
  values (u1, b, 'Dueño',  'admin',   0,  true),
         (u2, b, 'Ayudante', 'barbero', 40, true);

  insert into servicios (barberia_id, nombre, duracion, precio, activo)
    values (b, 'Corte', 30, 10000, true) returning id into srv;

  -- El trigger ya dejó horario por defecto: L-V 9-19, sábado 9-15, domingo cerrado.

  -- ---------- 1. Un lunes normal ofrece horas ----------
  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, null);
  if n = 20 then                              -- 09:00 a 18:30, cada media hora
    raise notice 'OK · lunes ofrece 20 horas';
  else
    raise warning 'FALLA · lunes ofrece % horas, se esperaban 20', n;
    fallos := fallos + 1;
  end if;

  -- ---------- 2. El domingo está cerrado ----------
  select count(*) into n from publico_horas_disponibles(slug, domingo, suc, null);
  if n = 0 then
    raise notice 'OK · domingo cerrado no ofrece horas';
  else
    raise warning 'FALLA · domingo cerrado igual ofrece % horas', n;
    fallos := fallos + 1;
  end if;

  -- ---------- 3. Reservar un domingo se rechaza ----------
  begin
    perform publico_reservar(slug, suc, srv, null::uuid, domingo, '10:00'::time,
                             'Colado', '+56900000001', null::text, true);
    raise warning 'FALLA · aceptó una reserva en un día cerrado';
    fallos := fallos + 1;
  exception when others then
    raise notice 'OK · rechaza reservar en día cerrado (%)', sqlerrm;
  end;

  -- ---------- 4. Bloqueo parcial: se van solo esas horas ----------
  insert into bloqueos (barberia_id, sucursal_id, fecha, desde, hasta, motivo)
    values (b, suc, lunes, '13:00', '15:00', 'Almuerzo');

  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, null);
  if n = 16 then                              -- 20 menos 13:00,13:30,14:00,14:30
    raise notice 'OK · bloqueo de 13 a 15 quita 4 horas';
  else
    raise warning 'FALLA · con bloqueo parcial quedan % horas, se esperaban 16', n;
    fallos := fallos + 1;
  end if;

  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, null) d
   where d.hora = '13:30'::time;
  if n = 0 then
    raise notice 'OK · 13:30 desapareció';
  else
    raise warning 'FALLA · 13:30 sigue disponible dentro del bloqueo';
    fallos := fallos + 1;
  end if;

  -- ---------- 5. Bloqueo de una sola persona no cierra la barbería ----------
  delete from bloqueos where barberia_id = b;
  insert into bloqueos (barberia_id, sucursal_id, barbero_id, fecha, motivo)
    values (b, suc, u2, lunes, 'Día libre del ayudante');

  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, null);
  if n = 20 then
    raise notice 'OK · con el ayudante libre la barbería sigue atendiendo';
  else
    raise warning 'FALLA · el día libre de una persona dejó % horas', n;
    fallos := fallos + 1;
  end if;

  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, u2);
  if n = 0 then
    raise notice 'OK · pedir a esa persona ese día no ofrece horas';
  else
    raise warning 'FALLA · la persona bloqueada ofrece % horas', n;
    fallos := fallos + 1;
  end if;

  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, u1);
  if n = 20 then
    raise notice 'OK · la otra persona sigue con agenda completa';
  else
    raise warning 'FALLA · la persona sin bloqueo ofrece % horas', n;
    fallos := fallos + 1;
  end if;

  -- ---------- 6. Las reservas ocupan cupo ----------
  delete from bloqueos where barberia_id = b;

  insert into reservas (barberia_id, sucursal_id, cliente_nombre, barbero_id,
                        servicio_id, fecha, hora, estado)
  values (b, suc, 'Uno', u1, srv, lunes, '11:00', 'reservado'),
         (b, suc, 'Dos', u2, srv, lunes, '11:00', 'reservado');

  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, null) d
   where d.hora = '11:00'::time;
  if n = 0 then
    raise notice 'OK · con las dos personas tomadas, las 11:00 se cierran';
  else
    raise warning 'FALLA · las 11:00 siguen disponibles con todo el equipo ocupado';
    fallos := fallos + 1;
  end if;

  -- Una sola tomada sí deja cupo
  delete from reservas where barberia_id = b and barbero_id = u2;
  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, null) d
   where d.hora = '11:00'::time;
  if n = 1 then
    raise notice 'OK · con una persona libre las 11:00 siguen abiertas';
  else
    raise warning 'FALLA · quedando alguien libre, las 11:00 no aparecen';
    fallos := fallos + 1;
  end if;

  -- ---------- 7. Cambiar el horario cambia la oferta ----------
  delete from reservas where barberia_id = b;   -- partir de un día limpio
  update horarios set hasta = '13:00' where sucursal_id = suc and dia = 1;
  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, u1);
  if n = 8 then                               -- 09:00 a 12:30
    raise notice 'OK · acortar el lunes deja 8 horas';
  else
    raise warning 'FALLA · lunes hasta las 13:00 ofrece % horas, se esperaban 8', n;
    fallos := fallos + 1;
  end if;

  -- ---------- 8. Un horario incoherente no se puede guardar ----------
  begin
    update horarios set desde = '18:00', hasta = '10:00'
     where sucursal_id = suc and dia = 2;
    raise warning 'FALLA · aceptó un horario que cierra antes de abrir';
    fallos := fallos + 1;
  exception when check_violation then
    raise notice 'OK · rechaza cerrar antes de abrir';
  end;

  -- ---------- Limpiar y resultado ----------
  delete from barberias where id = b;
  delete from auth.users where id in (u1, u2);

  if fallos = 0 then
    raise notice '=============== TODO OK ===============';
  else
    raise exception '=============== % FALLAS — NO LANZAR ===============', fallos;
  end if;
end $$;

-- Comprobar que no quedó basura de la prueba
select
  (select count(*) from barberias where slug like 'prueba-h-%') as barberias_de_prueba,
  (select count(*) from auth.users where email like 'prueba-h%@barberos.test') as usuarios_de_prueba;
