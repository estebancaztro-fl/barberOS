-- ============================================================
-- BarberOS · 008 — Alinear el esquema con la app
--
-- El esquema original quedó corto respecto de lo que la app guarda:
-- faltaban los cortes acumulados, la última visita, el registro completo
-- de visagismo y la tabla de campañas.
-- ============================================================

-- ---------- Clientes ----------

alter table clientes add column if not exists cortes int not null default 0;
alter table clientes add column if not exists ultima_visita date;

/* El visagismo completo, con la copia fija del consejo dado ese día.
   Se guarda como jsonb porque es un registro cerrado que se lee entero:
   { forma, similitud, confianza, origen, fecha, recomendacion{...} }
   NO contiene proporciones del rostro ni imágenes: solo la categoría. */
alter table clientes add column if not exists visagismo jsonb;

comment on column clientes.visagismo is
  'Registro del análisis: categoría, confianza, fecha y copia del consejo. Sin datos biométricos.';

/* Las columnas sueltas quedan reemplazadas por el jsonb */
alter table clientes drop column if exists visagismo_fecha;
alter table clientes drop column if exists visagismo_confianza;

-- ---------- Reservas ----------

/* La foto del corte se guarda como imagen comprimida (~45 KB) directamente
   en la fila. Cuando el volumen lo justifique se mueve a Storage y esta
   columna pasará a contener la ruta en vez de la imagen. */
alter table reservas add column if not exists foto text;

comment on column reservas.foto is
  'Foto del corte terminado, comprimida. Solo se guarda con consentimiento del cliente.';

/* El disparador de consentimiento apuntaba a foto_path; ahora vigila ambas */
create or replace function exigir_consentimiento_foto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  puso_foto boolean;
begin
  puso_foto :=
    (new.foto is not null and (TG_OP = 'INSERT' or new.foto is distinct from old.foto))
    or (new.foto_path is not null and (TG_OP = 'INSERT' or new.foto_path is distinct from old.foto_path));

  if puso_foto and new.cliente_id is not null
     and not tiene_consentimiento(new.cliente_id, 'fotos_corte') then
    raise exception 'El cliente no ha autorizado que se guarden fotos de su corte';
  end if;
  return new;
end $$;

-- ---------- Campañas de CRM ----------

create table if not exists campanas (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  fecha        date not null default current_date,
  canal        text not null,          -- whatsapp | email | sms
  segmento     text not null,
  mensaje      text not null,
  destinatarios int not null default 0,
  creada_por   uuid references perfiles(id) on delete set null,
  creada_en    timestamptz not null default now()
);
create index if not exists campanas_barberia_idx on campanas (barberia_id, fecha desc);

alter table campanas enable row level security;

create policy campanas_lectura on campanas
  for select using (barberia_id = mi_barberia());

create policy campanas_escritura on campanas
  for insert with check (barberia_id = mi_barberia() and puede_gestionar());

grant select, insert on campanas to authenticated;
grant all on campanas to service_role;

-- ---------- Mantener cortes y última visita al día ----------
-- Se calculan en la base: así el dato no depende de que la app se acuerde
-- de actualizarlo, ni se puede falsear desde el navegador.

create or replace function actualizar_historial_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cliente uuid;
begin
  v_cliente := coalesce(new.cliente_id, old.cliente_id);
  if v_cliente is null then return coalesce(new, old); end if;

  update clientes c set
    cortes = (select count(*) from reservas r
               where r.cliente_id = v_cliente and r.estado = 'finalizado'),
    ultima_visita = (select max(r.fecha) from reservas r
                      where r.cliente_id = v_cliente and r.estado = 'finalizado')
  where c.id = v_cliente;

  return coalesce(new, old);
end $$;

drop trigger if exists t_reservas_historial on reservas;
create trigger t_reservas_historial
  after insert or update or delete on reservas
  for each row execute function actualizar_historial_cliente();

-- ---------- Recalcular lo que ya existe ----------

update clientes c set
  cortes = (select count(*) from reservas r where r.cliente_id = c.id and r.estado = 'finalizado'),
  ultima_visita = coalesce(
    (select max(r.fecha) from reservas r where r.cliente_id = c.id and r.estado = 'finalizado'),
    c.creado_en::date
  );

-- ---------- Comprobación ----------
select
  (select count(*) from information_schema.columns
    where table_name = 'clientes' and column_name in ('cortes','ultima_visita','visagismo')) as campos_cliente_ok,
  (select count(*) from information_schema.columns
    where table_name = 'reservas' and column_name = 'foto') as campo_foto_ok,
  (select count(*) from information_schema.tables
    where table_name = 'campanas') as tabla_campanas_ok;
