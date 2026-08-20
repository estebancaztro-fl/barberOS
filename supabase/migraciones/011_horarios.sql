-- ============================================================
-- BarberOS · 011 — Horarios de atención y bloqueos
--
-- Antes la reserva pública ofrecía siempre las mismas horas, todos los días
-- del año. Una barbería cerrada los domingos igual recibía reservas para
-- el domingo.
--
-- La disponibilidad se calcula EN LA BASE. Así la página pública, la agenda
-- y cualquier cosa que hagamos después no pueden contradecirse.
-- ============================================================

-- ---------- Horario semanal por sucursal ----------

create table if not exists horarios (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  sucursal_id  uuid not null references sucursales(id) on delete cascade,
  dia          int  not null check (dia between 0 and 6),   -- 0 = domingo
  abierto      boolean not null default true,
  desde        time not null default '09:00',
  hasta        time not null default '19:00',
  unique (sucursal_id, dia),
  /* Un día abierto que cierra antes de abrir no tiene horas que ofrecer */
  constraint horario_coherente check (not abierto or hasta > desde)
);
create index if not exists horarios_sucursal_idx on horarios (sucursal_id);

comment on table horarios is
  'Una fila por día de la semana y sucursal. dia: 0 domingo … 6 sábado.';

-- ---------- Bloqueos puntuales ----------
-- Feriados, vacaciones, una tarde libre o la hora de almuerzo.

create table if not exists bloqueos (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  sucursal_id  uuid references sucursales(id) on delete cascade,  -- null = todas
  barbero_id   uuid references perfiles(id) on delete cascade,    -- null = todos
  fecha        date not null,
  desde        time,        -- null y hasta null = todo el día
  hasta        time,
  motivo       text,
  creado_en    timestamptz not null default now(),
  /* O es el día completo (ambas nulas) o es un rango con principio y fin */
  constraint bloqueo_coherente check (
    (desde is null and hasta is null) or (desde is not null and hasta > desde)
  )
);
create index if not exists bloqueos_fecha_idx on bloqueos (barberia_id, fecha);

comment on table bloqueos is
  'Cierres puntuales. Sin horas, bloquea el día completo. Con barbero_id, solo a esa persona.';

-- ---------- Horario por defecto para lo que ya existe ----------
-- Lunes a viernes 9 a 19, sábado 9 a 15, domingo cerrado.

insert into horarios (barberia_id, sucursal_id, dia, abierto, desde, hasta)
select s.barberia_id, s.id, d.dia,
       case d.dia when 0 then false else true end,
       '09:00'::time,
       case d.dia when 6 then '15:00'::time else '19:00'::time end
  from sucursales s
 cross join (select generate_series(0, 6) as dia) d
 on conflict (sucursal_id, dia) do nothing;

-- ---------- Seguridad ----------

alter table horarios enable row level security;
alter table bloqueos enable row level security;

drop policy if exists horarios_lectura on horarios;
drop policy if exists horarios_escritura on horarios;
drop policy if exists bloqueos_lectura on bloqueos;
drop policy if exists bloqueos_escritura on bloqueos;

create policy horarios_lectura on horarios
  for select using (barberia_id = mi_barberia());
create policy horarios_escritura on horarios
  for all using (barberia_id = mi_barberia() and puede_gestionar())
  with check (barberia_id = mi_barberia() and puede_gestionar());

create policy bloqueos_lectura on bloqueos
  for select using (barberia_id = mi_barberia());
create policy bloqueos_escritura on bloqueos
  for all using (barberia_id = mi_barberia() and puede_gestionar())
  with check (barberia_id = mi_barberia() and puede_gestionar());

grant select, insert, update, delete on horarios, bloqueos to authenticated;
grant all on horarios, bloqueos to service_role;

/* Toda sucursal nueva arranca con horario, si no queda invisible al reservar */
create or replace function horario_por_defecto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into horarios (barberia_id, sucursal_id, dia, abierto, desde, hasta)
  select new.barberia_id, new.id, d.dia,
         case d.dia when 0 then false else true end,
         '09:00'::time,
         case d.dia when 6 then '15:00'::time else '19:00'::time end
    from (select generate_series(0, 6) as dia) d
   on conflict (sucursal_id, dia) do nothing;
  return new;
end $$;

drop trigger if exists t_sucursal_horario on sucursales;
create trigger t_sucursal_horario
  after insert on sucursales
  for each row execute function horario_por_defecto();

-- ============================================================
-- Disponibilidad: la única fuente de verdad
-- ============================================================

create or replace function publico_horas_disponibles(
  p_slug text, p_fecha date, p_sucursal uuid default null, p_barbero uuid default null
)
returns table (hora time)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_barberia uuid;
  v_sucursal uuid;
  v_dia int;
  v_desde time;
  v_hasta time;
  v_cupos int;
begin
  select id into v_barberia from barberias
   where slug = p_slug or p_slug = any(slugs_anteriores) limit 1;
  if v_barberia is null then return; end if;

  /* Si no se indicó sucursal, se usa la primera activa */
  v_sucursal := coalesce(
    p_sucursal,
    (select s.id from sucursales s where s.barberia_id = v_barberia and s.activa order by s.nombre limit 1)
  );
  if v_sucursal is null then return; end if;

  v_dia := extract(dow from p_fecha)::int;

  select h.desde, h.hasta into v_desde, v_hasta
    from horarios h
   where h.sucursal_id = v_sucursal and h.dia = v_dia and h.abierto;
  if v_desde is null then return; end if;             -- cerrado ese día
  if v_hasta <= v_desde then return; end if;          -- rango sin horas

  /* Día completo cerrado para toda la barbería. Un bloqueo que afecta
     solo a una persona no cierra el día: se descuenta más abajo. */
  if exists (
    select 1 from bloqueos b
     where b.barberia_id = v_barberia and b.fecha = p_fecha
       and b.desde is null and b.barbero_id is null
       and (b.sucursal_id is null or b.sucursal_id = v_sucursal)
  ) then return; end if;

  select count(*) into v_cupos
    from perfiles p
   where p.barberia_id = v_barberia and p.atiende and p.activo
     and (p_barbero is null or p.id = p_barbero);
  if v_cupos = 0 then return; end if;

  return query
  with ranura as (
    select (v_desde + (n || ' minutes')::interval)::time as h
      from generate_series(0, (extract(epoch from (v_hasta - v_desde)) / 60)::int - 1, 30) as n
  ),
  persona as (
    select p.id
      from perfiles p
     where p.barberia_id = v_barberia and p.atiende and p.activo
       and (p_barbero is null or p.id = p_barbero)
  )
  select r.h
    from ranura r
   where
     /* Bloqueo que cubre esa hora para toda la barbería */
     not exists (
       select 1 from bloqueos b
        where b.barberia_id = v_barberia and b.fecha = p_fecha
          and b.barbero_id is null
          and b.desde is not null and r.h >= b.desde and r.h < b.hasta
          and (b.sucursal_id is null or b.sucursal_id = v_sucursal)
     )
     /* Tiene que quedar alguien libre: sin reserva a esa hora, sin bloqueo
        propio, y con margen para las reservas que aún no tienen barbero. */
     and (
       select count(*) from persona pe
        where not exists (
                select 1 from reservas re
                 where re.barberia_id = v_barberia and re.fecha = p_fecha
                   and re.hora = r.h and re.estado <> 'cancelado'
                   and re.barbero_id = pe.id)
          and not exists (
                select 1 from bloqueos b
                 where b.barberia_id = v_barberia and b.fecha = p_fecha
                   and b.barbero_id = pe.id
                   and (b.desde is null or (r.h >= b.desde and r.h < b.hasta))
                   and (b.sucursal_id is null or b.sucursal_id = v_sucursal))
     ) > (
       select count(*) from reservas re
        where re.barberia_id = v_barberia and re.fecha = p_fecha
          and re.hora = r.h and re.estado <> 'cancelado'
          and re.barbero_id is null
          and (re.sucursal_id is null or re.sucursal_id = v_sucursal)
     )
     /* Si es hoy, no se ofrecen horas ya pasadas */
     and (p_fecha > current_date or r.h > (now() at time zone 'America/Santiago')::time)
   order by r.h;
end $$;

grant execute on function publico_horas_disponibles(text, date, uuid, uuid) to anon, authenticated;

comment on function publico_horas_disponibles is
  'Horas realmente reservables: horario del día, menos bloqueos, menos ocupadas, menos las ya pasadas.';

-- ---------- La reserva también valida contra el horario ----------
-- Aunque alguien manipule la petición y mande una hora que la pantalla
-- nunca ofreció, la base la rechaza igual.

create or replace function hora_reservable(
  p_slug text, p_fecha date, p_hora time, p_sucursal uuid, p_barbero uuid
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from publico_horas_disponibles(p_slug, p_fecha, p_sucursal, p_barbero) d
     where d.hora = p_hora
  )
$$;

grant execute on function hora_reservable(text, date, time, uuid, uuid) to anon, authenticated;

create or replace function publico_reservar(
  p_slug        text,
  p_sucursal    uuid,
  p_servicio    uuid,
  p_barbero     uuid,
  p_fecha       date,
  p_hora        time,
  p_nombre      text,
  p_telefono    text,
  p_correo      text default null,
  p_acepta_datos boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_barberia uuid;
  v_cliente  uuid;
  v_barbero  uuid;
  v_reserva  uuid;
  v_recientes int;
  v_atienden int;
begin
  if not p_acepta_datos then
    raise exception 'Debes aceptar el uso de tus datos para poder agendar';
  end if;

  if length(trim(coalesce(p_nombre, ''))) < 2 or length(trim(coalesce(p_telefono, ''))) < 8 then
    raise exception 'Nombre y teléfono son obligatorios';
  end if;

  if p_fecha < current_date or p_fecha > current_date + interval '90 days' then
    raise exception 'La fecha no es válida';
  end if;

  select id into v_barberia from barberias
   where slug = p_slug or p_slug = any(slugs_anteriores) limit 1;
  if v_barberia is null then raise exception 'Barbería no encontrada'; end if;

  select count(*) into v_atienden
    from perfiles where barberia_id = v_barberia and atiende and activo;
  if v_atienden = 0 then
    raise exception 'Esta barbería todavía no tiene barberos disponibles para reservar';
  end if;

  /* NUEVO: la hora tiene que estar dentro del horario de atención y sin
     bloqueo. Aunque alguien manipule la petición y mande un domingo o una
     hora que la pantalla nunca mostró, acá se rechaza. */
  if not hora_reservable(p_slug, p_fecha, p_hora, p_sucursal, p_barbero) then
    raise exception 'Esa hora no está disponible para reservar';
  end if;

  select count(*) into v_recientes
    from reservas r join clientes c on c.id = r.cliente_id
   where r.barberia_id = v_barberia
     and c.telefono = p_telefono
     and r.creada_en > now() - interval '24 hours';
  if v_recientes >= 3 then
    raise exception 'Demasiadas reservas seguidas. Escríbenos si necesitas otra hora.';
  end if;

  if not exists (select 1 from servicios where id = p_servicio and barberia_id = v_barberia and activo) then
    raise exception 'Servicio no disponible';
  end if;
  if p_sucursal is not null
     and not exists (select 1 from sucursales where id = p_sucursal and barberia_id = v_barberia and activa) then
    raise exception 'Sucursal no disponible';
  end if;

  if p_barbero is not null then
    if not exists (select 1 from perfiles
                    where id = p_barbero and barberia_id = v_barberia and atiende and activo) then
      raise exception 'Ese barbero no está disponible';
    end if;
    if exists (select 1 from reservas
                where barbero_id = p_barbero and fecha = p_fecha and hora = p_hora
                  and estado <> 'cancelado') then
      raise exception 'Esa hora ya fue tomada';
    end if;
    v_barbero := p_barbero;
  else
    select p.id into v_barbero
      from perfiles p
     where p.barberia_id = v_barberia and p.atiende and p.activo
       and not exists (select 1 from reservas r
                        where r.barbero_id = p.id and r.fecha = p_fecha
                          and r.hora = p_hora and r.estado <> 'cancelado')
       and not exists (select 1 from bloqueos b
                        where b.barberia_id = v_barberia and b.fecha = p_fecha
                          and b.barbero_id = p.id
                          and (b.desde is null or (p_hora >= b.desde and p_hora < b.hasta)))
     limit 1;
    if v_barbero is null then raise exception 'Esa hora ya está tomada. Elige otra.'; end if;
  end if;

  select id into v_cliente from clientes
   where barberia_id = v_barberia and telefono = p_telefono and anonimizado_en is null
   limit 1;

  if v_cliente is null then
    insert into clientes (barberia_id, nombre, telefono, correo)
    values (v_barberia, trim(p_nombre), trim(p_telefono), nullif(trim(coalesce(p_correo,'')), ''))
    returning id into v_cliente;
  end if;

  insert into consentimientos (barberia_id, cliente_id, tipo, texto_version, origen)
  values (v_barberia, v_cliente, 'datos_basicos', 'v1', 'reserva_online')
  on conflict do nothing;

  insert into reservas (barberia_id, sucursal_id, cliente_id, cliente_nombre,
                        barbero_id, servicio_id, fecha, hora, estado, notas)
  values (v_barberia, p_sucursal, v_cliente, trim(p_nombre),
          v_barbero, p_servicio, p_fecha, p_hora, 'reservado', 'Reserva online')
  returning id into v_reserva;

  return jsonb_build_object('ok', true, 'reserva_id', v_reserva);
end $$;

grant execute on function publico_reservar(text, uuid, uuid, uuid, date, time, text, text, text, boolean) to anon;

-- ---------- Comprobación ----------
select s.nombre as sucursal,
       count(*) filter (where h.abierto) as dias_abiertos,
       count(*) filter (where not h.abierto) as dias_cerrados
  from sucursales s left join horarios h on h.sucursal_id = s.id
 group by s.nombre order by s.nombre;
