-- ============================================================
-- Prueba del control de cobro
--
-- Comprueba lo que de verdad importa cuando hay plata de por medio:
--   · la prueba dura 14 días y después la cuenta deja de escribir
--   · con el plan vencido igual se puede VER, y los derechos del titular
--     de datos (Ley 21.719) siguen funcionando
--   · el cupo de barberos no se puede exceder ni desde la API
--   · el link público deja de ofrecer horas
--   · el mismo cobro no se acredita dos veces
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
  cli uuid;
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid();
  u4 uuid := gen_random_uuid();
  u5 uuid := gen_random_uuid();
  sufijo text := substr(u1::text, 1, 8);
  slug   text := 'prueba-s-' || sufijo;
  lunes  date;
  n int;
  fallos int := 0;
begin
  lunes := current_date + ((8 - extract(dow from current_date)::int) % 7 + 7);

  -- ---------- Barbería con 5 personas ----------
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated',
         'prueba-s-' || substr(x.id::text,1,8) || '@barberos.test', '',
         now(), now(), now(), '{}'::jsonb, '{}'::jsonb
    from (values (u1),(u2),(u3),(u4),(u5)) as x(id);

  insert into barberias (nombre, slug) values ('Prueba Cobro', slug) returning id into b;
  insert into sucursales (barberia_id, nombre, activa)
    values (b, 'Única', true) returning id into suc;

  insert into perfiles (id, barberia_id, nombre, rol, comision, atiende)
  values (u1, b, 'Dueño', 'admin', 0, true),
         (u2, b, 'Dos', 'barbero', 40, true),
         (u3, b, 'Tres', 'barbero', 40, true),
         (u4, b, 'Cuatro', 'barbero', 40, true);

  insert into servicios (barberia_id, nombre, duracion, precio, activo)
    values (b, 'Corte', 30, 10000, true) returning id into srv;
  insert into clientes (barberia_id, nombre, telefono)
    values (b, 'Cliente', '+56911112222') returning id into cli;

  -- ---------- 1. La prueba nace de 14 días ----------
  select (prueba_hasta - current_date) into n from barberias where id = b;
  if n = 14 then
    raise notice 'OK · la prueba dura 14 días';
  else
    raise warning 'FALLA · la prueba nació con % días', n;
    fallos := fallos + 1;
  end if;

  if plan_vigente(b) then
    raise notice 'OK · durante la prueba se puede escribir';
  else
    raise warning 'FALLA · la prueba no deja escribir';
    fallos := fallos + 1;
  end if;

  /* Referencia para la prueba 7: durante la prueba SÍ hay horas.
     Sin esto, un cero más adelante podría deberse a otra cosa. */
  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, null);
  if n > 0 then
    raise notice 'OK · durante la prueba el link público ofrece % horas', n;
  else
    raise warning 'FALLA · el link público no ofrece horas ni siquiera en prueba';
    fallos := fallos + 1;
  end if;

  -- ---------- 2. El quinto barbero no cabe ----------
  begin
    insert into perfiles (id, barberia_id, nombre, rol, comision, atiende)
      values (u5, b, 'Cinco', 'barbero', 40, true);
    raise warning 'FALLA · aceptó un quinto barbero con 4 cupos';
    fallos := fallos + 1;
  exception when others then
    raise notice 'OK · rechaza el quinto barbero (%)', sqlerrm;
  end;

  /* Sí se puede agregar si no atiende: recepción no ocupa cupo */
  begin
    insert into perfiles (id, barberia_id, nombre, rol, comision, atiende)
      values (u5, b, 'Recepción', 'recepcion', 0, false);
    raise notice 'OK · quien no atiende no ocupa cupo';
  exception when others then
    raise warning 'FALLA · bloqueó a alguien que no atiende: %', sqlerrm;
    fallos := fallos + 1;
  end;

  /* Tampoco por la puerta de atrás: activarle "atiende" después */
  begin
    update perfiles set atiende = true where id = u5;
    raise warning 'FALLA · dejó activar "atiende" sin cupo';
    fallos := fallos + 1;
  exception when others then
    raise notice 'OK · tampoco deja activar "atiende" sin cupo';
  end;

  -- ---------- 3. Ampliar el cupo lo permite ----------
  perform fijar_cupo(b, 5);
  begin
    update perfiles set atiende = true where id = u5;
    raise notice 'OK · con el cupo ampliado sí entra';
  exception when others then
    raise warning 'FALLA · con cupo ampliado sigue bloqueado: %', sqlerrm;
    fallos := fallos + 1;
  end;

  select costo_mensual(b) into n;
  if n = 19990 + 5990 then
    raise notice 'OK · 5 barberos cuestan %', n;
  else
    raise warning 'FALLA · 5 barberos cuestan %, se esperaban %', n, 19990 + 5990;
    fallos := fallos + 1;
  end if;

  /* No se puede bajar el cupo dejando gente fuera */
  begin
    perform fijar_cupo(b, 4);
    raise warning 'FALLA · dejó bajar el cupo con 5 barberos atendiendo';
    fallos := fallos + 1;
  exception when others then
    raise notice 'OK · no deja bajar el cupo con gente atendiendo';
  end;

  -- ---------- 4. Se acaba la prueba ----------
  update barberias set prueba_hasta = current_date - 1 where id = b;

  if not plan_vigente(b) then
    raise notice 'OK · la prueba vencida corta la escritura';
  else
    raise warning 'FALLA · la prueba vencida sigue vigente';
    fallos := fallos + 1;
  end if;

  begin
    insert into reservas (barberia_id, sucursal_id, cliente_nombre, barbero_id,
                          servicio_id, fecha, hora, estado)
      values (b, suc, 'Colado', u1, srv, lunes, '11:00', 'reservado');
    raise warning 'FALLA · agendó con el plan vencido';
    fallos := fallos + 1;
  exception when others then
    raise notice 'OK · con el plan vencido no se puede agendar';
  end;

  begin
    insert into ingresos (barberia_id, monto, concepto, fecha)
      values (b, 10000, 'Corte', current_date);
    raise warning 'FALLA · registró un ingreso con el plan vencido';
    fallos := fallos + 1;
  exception when others then
    raise notice 'OK · con el plan vencido no se registran ventas';
  end;

  -- ---------- 5. Pero se puede seguir viendo ----------
  select count(*) into n from clientes where barberia_id = b;
  if n >= 1 then
    raise notice 'OK · los datos siguen visibles (solo lectura)';
  else
    raise warning 'FALLA · se perdió el acceso de lectura';
    fallos := fallos + 1;
  end if;

  -- ---------- 6. Los derechos del titular no se cobran ----------
  begin
    update clientes set anonimizado_en = now() where id = cli;
    raise notice 'OK · se puede anonimizar aunque el plan esté vencido';
  exception when others then
    raise warning 'FALLA · el plan vencido bloqueó un derecho ARCO: %', sqlerrm;
    fallos := fallos + 1;
  end;

  /* Pero editar datos comerciales del cliente sí queda bloqueado */
  begin
    update clientes set observaciones = 'nota nueva' where id = cli;
    raise warning 'FALLA · dejó editar clientes con el plan vencido';
    fallos := fallos + 1;
  exception when others then
    raise notice 'OK · editar clientes sí está bloqueado';
  end;

  -- ---------- 7. El link público deja de ofrecer horas ----------
  select count(*) into n from publico_horas_disponibles(slug, lunes, suc, null);
  if n = 0 then
    raise notice 'OK · el link público no ofrece horas con el plan vencido';
  else
    raise warning 'FALLA · el link público ofrece % horas sin plan vigente', n;
    fallos := fallos + 1;
  end if;

  -- ---------- 8. Al pagar, todo vuelve ----------
  update barberias
     set estado_plan = 'activa', periodo_hasta = now() + interval '30 days'
   where id = b;

  if plan_vigente(b) then
    raise notice 'OK · al pagar se recupera la escritura';
  else
    raise warning 'FALLA · pagando sigue bloqueada';
    fallos := fallos + 1;
  end if;

  begin
    insert into reservas (barberia_id, sucursal_id, cliente_nombre, barbero_id,
                          servicio_id, fecha, hora, estado)
      values (b, suc, 'Ahora sí', u1, srv, lunes, '11:00', 'reservado');
    raise notice 'OK · vuelve a agendar';
  exception when others then
    raise warning 'FALLA · sigue sin poder agendar: %', sqlerrm;
    fallos := fallos + 1;
  end;

  -- ---------- 9. Días de gracia al fallar un cobro ----------
  update barberias
     set estado_plan = 'morosa', periodo_hasta = now() - interval '2 days'
   where id = b;
  if plan_vigente(b) then
    raise notice 'OK · un cobro rechazado da días de gracia';
  else
    raise warning 'FALLA · corta el servicio el mismo día del rechazo';
    fallos := fallos + 1;
  end if;

  update barberias set periodo_hasta = now() - interval '10 days' where id = b;
  if not plan_vigente(b) then
    raise notice 'OK · pasada la gracia sí corta';
  else
    raise warning 'FALLA · la gracia no termina nunca';
    fallos := fallos + 1;
  end if;

  -- ---------- 10. El mismo cobro no se acredita dos veces ----------
  insert into cobros (barberia_id, proveedor, referencia, monto, estado)
    values (b, 'mercadopago', 'pago-de-prueba', 25980, 'aprobado');
  begin
    insert into cobros (barberia_id, proveedor, referencia, monto, estado)
      values (b, 'mercadopago', 'pago-de-prueba', 25980, 'aprobado');
    raise warning 'FALLA · aceptó el mismo cobro dos veces';
    fallos := fallos + 1;
  exception when unique_violation then
    raise notice 'OK · reenviar el mismo aviso no cobra dos veces';
  end;

  -- ---------- Limpiar y resultado ----------
  delete from barberias where id = b;
  delete from auth.users where id in (u1, u2, u3, u4, u5);

  if fallos = 0 then
    raise notice '=============== TODO OK ===============';
  else
    raise exception '=============== % FALLAS — NO LANZAR ===============', fallos;
  end if;
end $$;

-- Comprobar que no quedó basura de la prueba
select
  (select count(*) from barberias where slug like 'prueba-s-%') as barberias_de_prueba,
  (select count(*) from auth.users where email like 'prueba-s-%@barberos.test') as usuarios_de_prueba;
