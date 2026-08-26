-- ============================================================
-- BarberOS · Vaciar los datos de demostración de "osads"
--
-- Borra clientes, cortes, ventas, gastos, comisiones y los dos barberos de
-- ejemplo. Deja la barbería, sus servicios, sus horarios y tu propia cuenta
-- de administrador intactos.
--
-- Supabase avisará "Potential issue detected" por los delete. Es esperado.
-- ============================================================

do $$
declare
  v_barberia uuid;
  v_demo uuid[];
  n int;
begin
  select id into v_barberia from barberias where slug = 'osads';
  if v_barberia is null then
    raise exception 'No existe una barbería con slug "osads".';
  end if;

  /* Los barberos de ejemplo se reconocen por su correo @barberos.demo */
  select array_agg(p.id) into v_demo
    from perfiles p
    join auth.users u on u.id = p.id
   where p.barberia_id = v_barberia
     and u.email like '%@barberos.demo';

  /* En orden: lo que depende de otra cosa primero */
  delete from mensajes       where barberia_id = v_barberia;
  delete from pagos_comision where barberia_id = v_barberia;
  delete from ingresos       where barberia_id = v_barberia;
  delete from gastos         where barberia_id = v_barberia;
  delete from reservas       where barberia_id = v_barberia;

  get diagnostics n = row_count;
  raise notice 'Reservas borradas: %', n;

  delete from consentimientos where barberia_id = v_barberia;
  delete from clientes        where barberia_id = v_barberia;

  if v_demo is not null then
    delete from perfiles  where id = any(v_demo);
    delete from auth.users where id = any(v_demo);
    raise notice 'Barberos de ejemplo borrados: %', array_length(v_demo, 1);
  end if;

  raise notice '=============== BARBERÍA VACÍA ===============';
end $$;

-- Comprobación: todo en cero, salvo servicios y horarios
select 'Clientes' as dato, count(*) from clientes where barberia_id = (select id from barberias where slug = 'osads')
union all
select 'Reservas', count(*) from reservas where barberia_id = (select id from barberias where slug = 'osads')
union all
select 'Ingresos', count(*) from ingresos where barberia_id = (select id from barberias where slug = 'osads')
union all
select 'Servicios (se conservan)', count(*) from servicios where barberia_id = (select id from barberias where slug = 'osads')
union all
select 'Equipo (se conserva)', count(*) from perfiles where barberia_id = (select id from barberias where slug = 'osads');
