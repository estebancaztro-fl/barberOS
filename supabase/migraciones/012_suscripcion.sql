-- ============================================================
-- BarberOS · 012 — Suscripción, prueba de 14 días y cupo de barberos
--
-- Regla del negocio: 14 días gratis, después $19.990 al mes con 4 barberos
-- incluidos y $5.990 por cada barbero adicional que atienda.
--
-- Todo esto vive en la base, no en la interfaz. Si alguien llama la API
-- directamente con una cuenta vencida, la base rechaza igual. Ocultar
-- botones no es proteger nada.
--
-- Excepción deliberada: los derechos del titular de datos (Ley 21.719)
-- siguen funcionando aunque no haya pago. Anonimizar y exportar no se
-- pueden cobrar.
-- ============================================================

-- ---------- Estado comercial de cada barbería ----------

alter table barberias
  add column if not exists estado_plan text not null default 'prueba',
  add column if not exists barberos_incluidos int not null default 4,
  add column if not exists barberos_pagados int not null default 4,
  add column if not exists precio_base int not null default 19990,
  add column if not exists precio_extra int not null default 5990,
  add column if not exists proveedor_pago text,
  add column if not exists suscripcion_externa text,
  add column if not exists periodo_hasta timestamptz,
  add column if not exists cancelada_en timestamptz;

do $$
begin
  alter table barberias add constraint estado_plan_valido
    check (estado_plan in ('prueba', 'activa', 'morosa', 'vencida', 'cancelada'));
exception when duplicate_object then null;
end $$;

comment on column barberias.estado_plan is
  'prueba · activa · morosa (pago rechazado, con días de gracia) · vencida · cancelada';
comment on column barberias.barberos_pagados is
  'Cupos contratados. Nunca puede haber más perfiles atendiendo que este número.';
comment on column barberias.precio_base is
  'Se guarda por barbería a propósito: si mañana suben los precios, quien ya es cliente mantiene el suyo.';
comment on column barberias.periodo_hasta is
  'Hasta cuándo está pagado. Lo mueve el webhook de la pasarela, no la app.';

-- ---------- La prueba dura 14 días ----------

alter table barberias alter column prueba_hasta set default (current_date + 14);

/* A las que ya existen y no tenían fecha se les cuenta desde hoy */
update barberias set prueba_hasta = current_date + 14 where prueba_hasta is null;

-- ============================================================
-- ¿Esta barbería puede escribir?
-- ============================================================

create or replace function plan_vigente(p_barberia uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select case b.estado_plan
             /* Pagada: vale hasta el fin del período pagado */
             when 'activa' then coalesce(b.periodo_hasta, now()) >= now()
             /* Pago rechazado: 5 días de gracia antes de cortar. Un cobro
                que falla por un problema del banco no puede dejar a una
                barbería sin agenda el mismo día. */
             when 'morosa' then coalesce(b.periodo_hasta, now()) + interval '5 days' >= now()
             when 'prueba' then coalesce(b.prueba_hasta, current_date) >= current_date
             else false
           end
      from barberias b
     where b.id = coalesce(p_barberia, mi_barberia())
  ), false);
$$;

comment on function plan_vigente is
  'Única fuente de verdad sobre si una barbería puede escribir. La usan los triggers y la reserva pública.';

create or replace function costo_mensual(p_barberia uuid default null)
returns int
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select b.precio_base
         + greatest(0, b.barberos_pagados - b.barberos_incluidos) * b.precio_extra
      from barberias b
     where b.id = coalesce(p_barberia, mi_barberia())
  ), 0);
$$;

/* Lo que la app necesita mostrar en el banner y en la pantalla de pago */
create or replace function mi_plan()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'estado', b.estado_plan,
    'vigente', plan_vigente(b.id),
    'prueba_hasta', b.prueba_hasta,
    'dias_de_prueba', greatest(0, b.prueba_hasta - current_date),
    'periodo_hasta', b.periodo_hasta,
    'barberos_incluidos', b.barberos_incluidos,
    'barberos_pagados', b.barberos_pagados,
    'barberos_atendiendo', (
      select count(*) from perfiles p
       where p.barberia_id = b.id and p.atiende and p.activo),
    'precio_base', b.precio_base,
    'precio_extra', b.precio_extra,
    'costo_mensual', costo_mensual(b.id),
    'proveedor', b.proveedor_pago
  )
  from barberias b where b.id = mi_barberia();
$$;

grant execute on function plan_vigente(uuid) to authenticated;
grant execute on function costo_mensual(uuid) to authenticated;
grant execute on function mi_plan() to authenticated;

-- ============================================================
-- Con el plan vencido la cuenta queda en solo lectura
-- ============================================================

create or replace function exigir_plan_vigente()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not plan_vigente(coalesce(new.barberia_id, old.barberia_id)) then
    raise exception 'PLAN_VENCIDO: la suscripción de esta barbería no está vigente'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

/* Clientes aparte: anonimizar es un derecho del titular, no un servicio
   que se pueda suspender por falta de pago (Ley 21.719, arts. 4 y 5). */
create or replace function exigir_plan_vigente_cliente()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.anonimizado_en is distinct from old.anonimizado_en then
    return new;                                  -- ejercicio de derechos: siempre pasa
  end if;
  if not plan_vigente(coalesce(new.barberia_id, old.barberia_id)) then
    raise exception 'PLAN_VENCIDO: la suscripción de esta barbería no está vigente'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists t_plan_reservas       on reservas;
drop trigger if exists t_plan_ingresos       on ingresos;
drop trigger if exists t_plan_gastos         on gastos;
drop trigger if exists t_plan_servicios      on servicios;
drop trigger if exists t_plan_pagos_comision on pagos_comision;
drop trigger if exists t_plan_clientes       on clientes;

create trigger t_plan_reservas       before insert or update on reservas
  for each row execute function exigir_plan_vigente();
create trigger t_plan_ingresos       before insert or update on ingresos
  for each row execute function exigir_plan_vigente();
create trigger t_plan_gastos         before insert or update on gastos
  for each row execute function exigir_plan_vigente();
create trigger t_plan_servicios      before insert or update on servicios
  for each row execute function exigir_plan_vigente();
create trigger t_plan_pagos_comision before insert or update on pagos_comision
  for each row execute function exigir_plan_vigente();
create trigger t_plan_clientes       before insert or update on clientes
  for each row execute function exigir_plan_vigente_cliente();

-- ============================================================
-- Cupo de barberos
-- ============================================================

create or replace function exigir_cupo_barberos()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_pagados int;
  v_usados  int;
begin
  /* Solo interesa quien pasa a ocupar cupo */
  if not (new.atiende and new.activo) then return new; end if;
  if tg_op = 'UPDATE' and old.atiende and old.activo then return new; end if;

  select barberos_pagados into v_pagados from barberias where id = new.barberia_id;
  if v_pagados is null then return new; end if;

  select count(*) into v_usados
    from perfiles
   where barberia_id = new.barberia_id and atiende and activo and id <> new.id;

  if v_usados + 1 > v_pagados then
    raise exception 'SIN_CUPO: tu plan cubre % barbero(s) atendiendo', v_pagados
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists t_cupo_barberos on perfiles;
create trigger t_cupo_barberos before insert or update on perfiles
  for each row execute function exigir_cupo_barberos();

/* Ajustar el cupo cambia lo que se cobra, así que solo lo hace el servidor
   DESPUÉS de actualizar la suscripción en la pasarela. Si esto fuera
   ejecutable desde el navegador, cualquiera se regalaría cupos. */
create or replace function fijar_cupo(p_barberia uuid, p_cupos int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_min int;
  v_incluidos int;
begin
  if p_cupos < 1 then
    raise exception 'El cupo mínimo es 1';
  end if;

  select barberos_incluidos into v_incluidos from barberias where id = p_barberia;
  if v_incluidos is null then raise exception 'Barbería no encontrada'; end if;

  select count(*) into v_min
    from perfiles where barberia_id = p_barberia and atiende and activo;

  if p_cupos < v_min then
    raise exception 'Hay % barberos atendiendo: primero desactiva a alguien', v_min;
  end if;

  update barberias set barberos_pagados = greatest(p_cupos, v_incluidos)
   where id = p_barberia;

  return jsonb_build_object('ok', true, 'cupos', greatest(p_cupos, v_incluidos),
                            'costo', costo_mensual(p_barberia));
end $$;

revoke execute on function fijar_cupo(uuid, int) from public, anon, authenticated;
grant  execute on function fijar_cupo(uuid, int) to service_role;

-- ============================================================
-- La reserva pública también respeta el plan
-- ============================================================

/* Versión autoritativa: la de 011 más la condición del plan. Si la barbería
   no está vigente no se ofrece ninguna hora, así el cliente ve "no hay horas"
   en vez de un error técnico, y publico_reservar la rechaza por el mismo camino. */
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

  if not plan_vigente(v_barberia) then return; end if;

  v_sucursal := coalesce(
    p_sucursal,
    (select s.id from sucursales s where s.barberia_id = v_barberia and s.activa order by s.nombre limit 1)
  );
  if v_sucursal is null then return; end if;

  v_dia := extract(dow from p_fecha)::int;

  select h.desde, h.hasta into v_desde, v_hasta
    from horarios h
   where h.sucursal_id = v_sucursal and h.dia = v_dia and h.abierto;
  if v_desde is null then return; end if;
  if v_hasta <= v_desde then return; end if;

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
     not exists (
       select 1 from bloqueos b
        where b.barberia_id = v_barberia and b.fecha = p_fecha
          and b.barbero_id is null
          and b.desde is not null and r.h >= b.desde and r.h < b.hasta
          and (b.sucursal_id is null or b.sucursal_id = v_sucursal)
     )
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
     and (p_fecha > current_date or r.h > (now() at time zone 'America/Santiago')::time)
   order by r.h;
end $$;

grant execute on function publico_horas_disponibles(text, date, uuid, uuid) to anon, authenticated;

-- ============================================================
-- Registro de cobros, para auditoría y para no procesar dos veces
-- ============================================================

create table if not exists cobros (
  id            uuid primary key default gen_random_uuid(),
  barberia_id   uuid not null references barberias(id) on delete cascade,
  proveedor     text not null,
  referencia    text not null,               -- id del pago en la pasarela
  monto         int  not null,
  estado        text not null,               -- aprobado · rechazado · pendiente
  periodo_hasta timestamptz,
  crudo         jsonb,
  creado_en     timestamptz not null default now(),
  unique (proveedor, referencia)
);
create index if not exists cobros_barberia_idx on cobros (barberia_id, creado_en desc);

comment on table cobros is
  'Historial de cobros. El unique(proveedor, referencia) hace que reenviar el mismo webhook no cobre ni acredite dos veces.';

alter table cobros enable row level security;

drop policy if exists cobros_lectura on cobros;
create policy cobros_lectura on cobros
  for select using (barberia_id = mi_barberia() and soy_admin());

grant select on cobros to authenticated;
grant all    on cobros to service_role;

-- ---------- Comprobación ----------
select b.nombre,
       b.estado_plan,
       b.prueba_hasta,
       plan_vigente(b.id) as puede_escribir,
       b.barberos_pagados,
       (select count(*) from perfiles p where p.barberia_id = b.id and p.atiende and p.activo) as atendiendo,
       costo_mensual(b.id) as costo
  from barberias b
 order by b.nombre;
