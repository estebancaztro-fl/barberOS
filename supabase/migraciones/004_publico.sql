-- ============================================================
-- BarberOS · 004 — Página pública de reservas
--
-- El cliente que agenda desde /b/{slug} NO tiene sesión iniciada. Las
-- políticas de 002 dependen de auth.uid(), así que un visitante anónimo
-- no ve nada — que es lo correcto.
--
-- En vez de abrirle las tablas, se le dan tres funciones controladas que
-- devuelven solo lo mínimo. El rol anónimo nunca toca una tabla directamente:
-- así no puede listar clientes, ver teléfonos ni leer finanzas aunque
-- alguien manipule las peticiones.
-- ============================================================

-- ---------- 1. Datos visibles de la barbería ----------

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
    -- Solo nombre de pila y id: no se expone correo, teléfono ni comisión
    'barberos', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre) order by p.nombre)
        from perfiles p
       where p.barberia_id = b.id and p.rol = 'barbero' and p.activo), '[]'::jsonb)
  )
  from barberias b
  where b.slug = p_slug or p_slug = any(b.slugs_anteriores)
  limit 1
$$;

comment on function publico_barberia is
  'Datos que ve un visitante sin sesión. Acepta direcciones anteriores para que los QR ya repartidos sigan funcionando.';

-- ---------- 2. Horas ya tomadas ----------
-- Devuelve solo las horas ocupadas, nunca de quién son.

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

-- ---------- 3. Crear la reserva ----------

create or replace function publico_reservar(
  p_slug        text,
  p_sucursal    uuid,
  p_servicio    uuid,
  p_barbero     uuid,          -- null = cualquiera disponible
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
begin
  -- Consentimiento: sin autorización no se guardan datos personales
  if not p_acepta_datos then
    raise exception 'Debes aceptar el uso de tus datos para poder agendar';
  end if;

  if length(trim(coalesce(p_nombre, ''))) < 2 or length(trim(coalesce(p_telefono, ''))) < 8 then
    raise exception 'Nombre y teléfono son obligatorios';
  end if;

  -- No se puede agendar en el pasado ni con más de 3 meses de anticipación
  if p_fecha < current_date or p_fecha > current_date + interval '90 days' then
    raise exception 'La fecha no es válida';
  end if;

  select id into v_barberia from barberias
   where slug = p_slug or p_slug = any(slugs_anteriores) limit 1;
  if v_barberia is null then raise exception 'Barbería no encontrada'; end if;

  -- Freno al abuso: máximo 3 reservas por teléfono al día
  select count(*) into v_recientes
    from reservas r join clientes c on c.id = r.cliente_id
   where r.barberia_id = v_barberia
     and c.telefono = p_telefono
     and r.creada_en > now() - interval '24 hours';
  if v_recientes >= 3 then
    raise exception 'Demasiadas reservas seguidas. Escríbenos si necesitas otra hora.';
  end if;

  -- El servicio y la sucursal deben pertenecer a esta barbería
  if not exists (select 1 from servicios where id = p_servicio and barberia_id = v_barberia and activo) then
    raise exception 'Servicio no disponible';
  end if;
  if p_sucursal is not null
     and not exists (select 1 from sucursales where id = p_sucursal and barberia_id = v_barberia and activa) then
    raise exception 'Sucursal no disponible';
  end if;

  -- Barbero: el pedido, o el primero libre
  if p_barbero is not null then
    if not exists (select 1 from perfiles
                    where id = p_barbero and barberia_id = v_barberia
                      and rol = 'barbero' and activo) then
      raise exception 'Barbero no disponible';
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
     where p.barberia_id = v_barberia and p.rol = 'barbero' and p.activo
       and not exists (select 1 from reservas r
                        where r.barbero_id = p.id and r.fecha = p_fecha
                          and r.hora = p_hora and r.estado <> 'cancelado')
     limit 1;
    if v_barbero is null then raise exception 'No queda cupo en ese horario'; end if;
  end if;

  -- Cliente: se reutiliza si ya existe con ese teléfono
  select id into v_cliente from clientes
   where barberia_id = v_barberia and telefono = p_telefono and anonimizado_en is null
   limit 1;

  if v_cliente is null then
    insert into clientes (barberia_id, nombre, telefono, correo)
    values (v_barberia, trim(p_nombre), trim(p_telefono), nullif(trim(coalesce(p_correo,'')), ''))
    returning id into v_cliente;
  end if;

  -- Queda registrado el consentimiento otorgado en la reserva online
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

comment on function publico_reservar is
  'Única vía por la que un visitante sin sesión escribe en la base. Valida pertenencia, disponibilidad, consentimiento y frena el abuso.';
