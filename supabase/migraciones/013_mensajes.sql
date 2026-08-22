-- ============================================================
-- BarberOS · 013 — Mensajes a clientes
--
-- Dos usos, una sola cola: el recordatorio antes de la cita y las campañas
-- del CRM. Antes la campaña se guardaba y no pasaba nada más; ahora queda
-- un mensaje por destinatario, con su estado.
--
-- Importante sobre WhatsApp: no se puede enviar automáticamente desde la
-- app WhatsApp Business del celular. Para eso hace falta la Cloud API de
-- Meta, con número dedicado, verificación y plantillas aprobadas. Esta
-- migración deja la cola y el registro de conexión listos para ese paso,
-- sin depender de él para funcionar hoy.
-- ============================================================

-- ---------- Ajustes del recordatorio, por barbería ----------

alter table barberias
  add column if not exists recordatorio_activo boolean not null default true,
  add column if not exists recordatorio_minutos int not null default 25,
  add column if not exists recordatorio_plantilla text,
  -- Estado de la conexión con WhatsApp: 'app' (envío asistido desde el
  -- teléfono) o 'api' (Cloud API conectada, envío automático)
  add column if not exists whatsapp_modo text not null default 'app',
  add column if not exists whatsapp_numero text,
  add column if not exists whatsapp_id_externo text,
  add column if not exists whatsapp_conectado_en timestamptz;

do $$
begin
  alter table barberias add constraint recordatorio_minutos_valido
    check (recordatorio_minutos between 5 and 240);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table barberias add constraint whatsapp_modo_valido
    check (whatsapp_modo in ('app', 'api'));
exception when duplicate_object then null;
end $$;

comment on column barberias.recordatorio_minutos is
  'Cuántos minutos antes de la cita se avisa. Por defecto 25.';
comment on column barberias.whatsapp_modo is
  'app: el barbero aprieta enviar desde su WhatsApp. api: Cloud API conectada.';

-- ---------- La cola ----------

create table if not exists mensajes (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  tipo         text not null,                -- recordatorio | campana
  canal        text not null default 'whatsapp',
  reserva_id   uuid references reservas(id) on delete cascade,
  cliente_id   uuid references clientes(id) on delete set null,
  campana_id   uuid references campanas(id) on delete cascade,
  telefono     text,
  texto        text not null,
  estado       text not null default 'pendiente',
  enviado_por  uuid references perfiles(id) on delete set null,
  enviado_en   timestamptz,
  creado_en    timestamptz not null default now(),
  constraint mensaje_tipo_valido   check (tipo in ('recordatorio', 'campana')),
  constraint mensaje_estado_valido check (estado in ('pendiente', 'enviado', 'omitido', 'fallido'))
);

create index if not exists mensajes_barberia_idx on mensajes (barberia_id, creado_en desc);
create index if not exists mensajes_pendientes_idx on mensajes (barberia_id, estado)
  where estado = 'pendiente';

/* Una reserva tiene un recordatorio y solo uno. Sin esto, tener la app
   abierta en dos pantallas le mandaría dos avisos al mismo cliente. */
create unique index if not exists mensajes_recordatorio_unico
  on mensajes (reserva_id)
  where tipo = 'recordatorio' and reserva_id is not null;

comment on table mensajes is
  'Cola de mensajes a clientes. Deja rastro de qué se envió, a quién y cuándo.';

-- ---------- Seguridad ----------

alter table mensajes enable row level security;

drop policy if exists mensajes_lectura on mensajes;
drop policy if exists mensajes_escritura on mensajes;

/* El barbero ve los mensajes de sus propias reservas; admin y recepción,
   todos los de la barbería. Nadie ve los de otra. */
create policy mensajes_lectura on mensajes
  for select using (
    barberia_id = mi_barberia()
    and (
      puede_gestionar()
      or exists (
        select 1 from reservas r
         where r.id = mensajes.reserva_id and r.barbero_id = auth.uid()
      )
    )
  );

create policy mensajes_escritura on mensajes
  for all using (barberia_id = mi_barberia())
  with check (barberia_id = mi_barberia());

grant select, insert, update, delete on mensajes to authenticated;
grant all on mensajes to service_role;

/* Escribir mensajes también necesita plan vigente */
drop trigger if exists t_plan_mensajes on mensajes;
create trigger t_plan_mensajes before insert or update on mensajes
  for each row execute function exigir_plan_vigente();

-- ---------- Marcar enviado ----------
-- Se hace con función para que quede el autor sin que la app pueda mentir.

create or replace function marcar_enviado(p_mensaje uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_barberia uuid;
begin
  select barberia_id into v_barberia from mensajes where id = p_mensaje;
  if v_barberia is null or v_barberia <> mi_barberia() then
    raise exception 'Mensaje no encontrado';
  end if;

  update mensajes
     set estado = 'enviado', enviado_en = now(), enviado_por = auth.uid()
   where id = p_mensaje and estado = 'pendiente';

  return jsonb_build_object('ok', true);
end $$;

grant execute on function marcar_enviado(uuid) to authenticated;

-- ---------- Comprobación ----------
select b.nombre,
       b.recordatorio_activo,
       b.recordatorio_minutos,
       b.whatsapp_modo,
       (select count(*) from mensajes m where m.barberia_id = b.id) as mensajes
  from barberias b
 order by b.nombre;
