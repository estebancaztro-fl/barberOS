-- ============================================================
-- BarberOS · 003 — Cumplimiento Ley N° 21.719
--
-- Vigencia: 1 de diciembre de 2026.
-- Traduce a tablas y funciones las obligaciones de la ley.
-- ============================================================

-- ---------- Consentimientos ----------
-- La ley exige consentimiento explícito, informado y separable.
-- Separado por tipo: el cliente puede aceptar que guardes su teléfono
-- y negarse a las fotos, sin perder el servicio.

create type tipo_consentimiento as enum (
  'datos_basicos',  -- nombre y contacto para agendar
  'fotos_corte',    -- foto del resultado en su historial
  'visagismo',      -- análisis de rostro (DATO SENSIBLE)
  'marketing'       -- campañas de WhatsApp, correo o SMS
);

create table consentimientos (
  id            uuid primary key default gen_random_uuid(),
  barberia_id   uuid not null references barberias(id) on delete cascade,
  cliente_id    uuid not null references clientes(id) on delete cascade,
  tipo          tipo_consentimiento not null,
  otorgado_en   timestamptz not null default now(),
  revocado_en   timestamptz,
  texto_version text not null,   -- qué versión del texto aceptó
  origen        text not null,   -- 'reserva_online' | 'mostrador' | 'ficha'
  registrado_por uuid references perfiles(id) on delete set null
);
create index on consentimientos (cliente_id, tipo);
create unique index consent_activo_unico
  on consentimientos (cliente_id, tipo) where revocado_en is null;

comment on table consentimientos is
  'Historial completo: al revocar no se borra la fila, se marca revocado_en. Así queda prueba de qué se autorizó y cuándo.';

-- ¿Tiene consentimiento vigente para esto?
create or replace function tiene_consentimiento(p_cliente uuid, p_tipo tipo_consentimiento)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from consentimientos
     where cliente_id = p_cliente and tipo = p_tipo and revocado_en is null
  )
$$;

-- No se puede guardar la foto de un corte sin autorización del cliente.
-- La regla vive en la base: si la app se equivoca, la base la frena igual.
create or replace function exigir_consentimiento_foto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.foto_path is not null
     and (old.foto_path is null or old.foto_path is distinct from new.foto_path)
     and new.cliente_id is not null
     and not tiene_consentimiento(new.cliente_id, 'fotos_corte') then
    raise exception 'El cliente no ha autorizado que se guarden fotos de su corte';
  end if;
  return new;
end $$;

create trigger t_reservas_foto_consentida
  before insert or update on reservas
  for each row execute function exigir_consentimiento_foto();

-- Lo mismo para el visagismo: es dato sensible y exige consentimiento aparte.
create or replace function exigir_consentimiento_visagismo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.forma_rostro is not null
     and new.forma_rostro is distinct from old.forma_rostro
     and not tiene_consentimiento(new.id, 'visagismo') then
    raise exception 'El cliente no ha autorizado el análisis de visagismo';
  end if;
  return new;
end $$;

create trigger t_clientes_visagismo_consentido
  before update on clientes
  for each row execute function exigir_consentimiento_visagismo();

-- ---------- Derechos ARCO y portabilidad ----------

create type tipo_solicitud as enum (
  'acceso', 'rectificacion', 'cancelacion', 'oposicion', 'portabilidad'
);
create type estado_solicitud as enum ('pendiente', 'en_proceso', 'resuelta', 'rechazada');

create table solicitudes_arco (
  id            uuid primary key default gen_random_uuid(),
  barberia_id   uuid not null references barberias(id) on delete cascade,
  cliente_id    uuid references clientes(id) on delete set null,
  contacto      text not null,          -- por si el titular ya no está en la base
  tipo          tipo_solicitud not null,
  estado        estado_solicitud not null default 'pendiente',
  solicitada_en timestamptz not null default now(),
  resuelta_en   timestamptz,
  atendida_por  uuid references perfiles(id) on delete set null,
  notas         text
);
create index on solicitudes_arco (barberia_id, estado);

-- Exportar todo lo que la barbería tiene de un cliente (acceso y portabilidad)
create or replace function exportar_cliente(p_cliente uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v jsonb;
begin
  if (select barberia_id from clientes where id = p_cliente) is distinct from mi_barberia() then
    raise exception 'Sin acceso a este cliente';
  end if;

  select jsonb_build_object(
    'cliente', to_jsonb(c) - 'barberia_id',
    'reservas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fecha', r.fecha, 'hora', r.hora, 'estado', r.estado,
        'servicio', s.nombre, 'notas', r.notas))
      from reservas r left join servicios s on s.id = r.servicio_id
      where r.cliente_id = c.id), '[]'::jsonb),
    'consentimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', k.tipo, 'otorgado_en', k.otorgado_en, 'revocado_en', k.revocado_en))
      from consentimientos k where k.cliente_id = c.id), '[]'::jsonb),
    'generado_en', now()
  ) into v
  from clientes c where c.id = p_cliente;

  perform registrar_actividad('exportar_datos', 'clientes', p_cliente);
  return v;
end $$;

comment on function exportar_cliente is
  'Derecho de acceso y portabilidad: entrega en JSON todo lo que la barbería guarda del titular.';

-- Derecho al olvido: anonimizar, no borrar.
-- Los montos deben conservarse por respaldo tributario, pero se desvinculan
-- de la persona.
create or replace function anonimizar_cliente(p_cliente uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not soy_admin() then
    raise exception 'Solo el administrador puede anonimizar clientes';
  end if;
  if (select barberia_id from clientes where id = p_cliente) is distinct from mi_barberia() then
    raise exception 'Sin acceso a este cliente';
  end if;

  update clientes set
    nombre = 'Cliente eliminado',
    telefono = null, correo = null,
    observaciones = null,
    forma_rostro = null, visagismo_fecha = null, visagismo_confianza = null,
    tipo_pelo = null, densidad = null,
    vip = false,
    anonimizado_en = now()
  where id = p_cliente;

  -- Las fotos del corte son datos personales: se marcan para borrado del Storage
  update reservas set foto_path = null, cliente_nombre = 'Cliente eliminado'
   where cliente_id = p_cliente;

  update consentimientos set revocado_en = coalesce(revocado_en, now())
   where cliente_id = p_cliente;

  perform registrar_actividad('anonimizar', 'clientes', p_cliente);
end $$;

-- ---------- Registro de actividad ----------
-- Sin esto, tras un incidente no hay forma de saber qué pasó ni a quién avisar.

create table registro_actividad (
  id          bigserial primary key,
  barberia_id uuid references barberias(id) on delete set null,
  actor_id    uuid references perfiles(id) on delete set null,
  accion      text not null,     -- 'exportar_datos' | 'anonimizar' | 'ver_ficha' | ...
  entidad     text,
  entidad_id  uuid,
  creado_en   timestamptz not null default now()
);
create index on registro_actividad (barberia_id, creado_en desc);

alter table registro_actividad enable row level security;

create policy actividad_lectura on registro_actividad
  for select using (barberia_id = mi_barberia() and soy_admin());

create or replace function registrar_actividad(p_accion text, p_entidad text, p_id uuid)
returns void
language sql security definer set search_path = public
as $$
  insert into registro_actividad (barberia_id, actor_id, accion, entidad, entidad_id)
  values (mi_barberia(), auth.uid(), p_accion, p_entidad, p_id)
$$;

-- ---------- Brechas de seguridad ----------
-- La ley obliga a notificar a la Agencia dentro de 72 horas.

create table brechas (
  id            uuid primary key default gen_random_uuid(),
  barberia_id   uuid references barberias(id) on delete set null,
  detectada_en  timestamptz not null default now(),
  notificada_en timestamptz,
  descripcion   text not null,
  datos_afectados text,
  titulares_afectados int,
  medidas_tomadas text,
  cerrada_en    timestamptz
);
alter table brechas enable row level security;

create policy brechas_admin on brechas
  for all using (barberia_id = mi_barberia() and soy_admin())
  with check (barberia_id = mi_barberia() and soy_admin());

-- Alerta: quedan menos de 72 horas para notificar
create or replace view brechas_por_notificar as
  select id, detectada_en,
         detectada_en + interval '72 hours' as vence_en,
         extract(epoch from (detectada_en + interval '72 hours' - now())) / 3600 as horas_restantes
    from brechas
   where notificada_en is null;

-- ---------- RLS de las tablas de cumplimiento ----------

alter table consentimientos  enable row level security;
alter table solicitudes_arco enable row level security;

create policy consent_lectura on consentimientos
  for select using (barberia_id = mi_barberia());

create policy consent_escritura on consentimientos
  for insert with check (barberia_id = mi_barberia());

-- Revocar es un update; nadie puede borrar la prueba del consentimiento
create policy consent_revocar on consentimientos
  for update using (barberia_id = mi_barberia())
  with check (barberia_id = mi_barberia());

create policy arco_gestion on solicitudes_arco
  for all using (barberia_id = mi_barberia() and puede_gestionar())
  with check (barberia_id = mi_barberia() and puede_gestionar());

-- ---------- Retención ----------
-- La ley pide no conservar datos más de lo necesario.
-- Ejecutar mensualmente con pg_cron.

create or replace function purgar_datos_antiguos()
returns table (fotos_borradas int, clientes_inactivos int)
language plpgsql security definer set search_path = public
as $$
declare f int; c int;
begin
  -- Fotos de cortes de más de 2 años
  with x as (
    update reservas set foto_path = null
     where foto_path is not null and fecha < current_date - interval '2 years'
     returning 1
  ) select count(*)::int into f from x;

  -- Clientes sin actividad en 5 años
  with y as (
    update clientes set
      telefono = null, correo = null, observaciones = null,
      forma_rostro = null, anonimizado_en = now()
     where anonimizado_en is null
       and id not in (
         select cliente_id from reservas
          where cliente_id is not null
            and fecha > current_date - interval '5 years'
       )
       and creado_en < current_date - interval '5 years'
     returning 1
  ) select count(*)::int into c from y;

  return query select f, c;
end $$;
