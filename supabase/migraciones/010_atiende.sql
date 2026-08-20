-- ============================================================
-- BarberOS · 010 — Quién atiende clientes
--
-- El rol y el atender son cosas distintas: en muchas barberías el dueño
-- corta pelo además de administrar, y hay recepcionistas que no atienden.
-- Antes solo aparecían en la reserva los perfiles con rol 'barbero', así
-- que una barbería de una sola persona no podía recibir reservas.
-- ============================================================

alter table perfiles add column if not exists atiende boolean not null default false;

comment on column perfiles.atiende is
  'Si toma reservas. Independiente del rol: un admin puede atender y un barbero puede estar de licencia.';

/* Todos los barberos existentes atienden */
update perfiles set atiende = true where rol = 'barbero' and not atiende;

/* Si una barbería no tiene a nadie atendiendo, su administrador pasa a
   atender: es el caso del dueño que trabaja solo. */
update perfiles p set atiende = true
 where p.rol = 'admin' and p.activo
   and not exists (
     select 1 from perfiles q
      where q.barberia_id = p.barberia_id and q.atiende and q.activo
   );

-- ---------- Las funciones públicas miran "atiende", no el rol ----------

create or replace function publico_barberia(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'nombre', b.nombre,
    'slug',   b.slug,
    'logo_url', b.logo_url,
    'sucursales', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'direccion', s.direccion)
             order by s.nombre)
        from sucursales s where s.barberia_id = b.id and s.activa), '[]'::jsonb),
    'servicios', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'nombre', v.nombre,
                                          'duracion', v.duracion, 'precio', v.precio)
             order by v.precio)
        from servicios v where v.barberia_id = b.id and v.activo), '[]'::jsonb),
    -- Solo nombre e id: no se expone correo, teléfono ni comisión
    'barberos', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre) order by p.nombre)
        from perfiles p
       where p.barberia_id = b.id and p.atiende and p.activo), '[]'::jsonb)
  )
  from barberias b
  where b.slug = p_slug or p_slug = any(b.slugs_anteriores)
  limit 1
$$;

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

  /* Mensaje honesto: no es lo mismo estar lleno que no tener a nadie */
  select count(*) into v_atienden
    from perfiles where barberia_id = v_barberia and atiende and activo;
  if v_atienden = 0 then
    raise exception 'Esta barbería todavía no tiene barberos disponibles para reservar';
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

grant execute on function publico_barberia(text) to anon;
grant execute on function publico_reservar(text, uuid, uuid, uuid, date, time, text, text, text, boolean) to anon;

/* Las horas ocupadas también se miden contra quienes atienden */
create or replace function publico_horas_ocupadas(
  p_slug text, p_fecha date, p_sucursal uuid default null, p_barbero uuid default null
)
returns table (hora time, ocupaciones int)
language sql stable security definer set search_path = public
as $$
  select r.hora, count(*)::int
    from reservas r
    join barberias b on b.id = r.barberia_id
   where (b.slug = p_slug or p_slug = any(b.slugs_anteriores))
     and r.fecha = p_fecha
     and r.estado <> 'cancelado'
     and (p_sucursal is null or r.sucursal_id = p_sucursal)
     and (p_barbero  is null or r.barbero_id  = p_barbero)
   group by r.hora
$$;
grant execute on function publico_horas_ocupadas(text, date, uuid, uuid) to anon;

-- ---------- Comprobación ----------
select b.nombre as barberia,
       count(*) filter (where p.atiende and p.activo) as personas_que_atienden
  from barberias b left join perfiles p on p.barberia_id = b.id
 group by b.nombre
 order by b.nombre;
