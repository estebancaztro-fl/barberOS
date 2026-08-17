-- ============================================================
-- BarberOS · 001 — Esquema base
-- Multi-barbería: cada tabla lleva barberia_id y todo se aísla por ahí.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Barbería y sucursales ----------

create table barberias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  slug        text not null unique,
  logo_url    text,
  -- Datos del responsable, exigidos por la Ley 21.719
  razon_social      text,
  rut               text,
  correo_contacto   text,
  creada_en   timestamptz not null default now()
);

comment on column barberias.slug is 'Identificador del link público de reservas: /b/{slug}';

create table sucursales (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  nombre       text not null,
  direccion    text,
  telefono     text,
  activa       boolean not null default true,
  creada_en    timestamptz not null default now()
);
create index on sucursales (barberia_id);

-- ---------- Perfiles: extienden auth.users ----------

create type rol_usuario as enum ('admin', 'recepcion', 'barbero');

create table perfiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  barberia_id  uuid not null references barberias(id) on delete cascade,
  nombre       text not null,
  telefono     text,
  rol          rol_usuario not null default 'barbero',
  comision     numeric(5,2) not null default 0 check (comision >= 0 and comision <= 100),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);
create index on perfiles (barberia_id);

comment on table perfiles is
  'Un registro por usuario autenticado. El rol vive acá, no en el navegador: las políticas RLS lo leen desde esta tabla.';

-- ---------- Servicios ----------

create table servicios (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  nombre       text not null,
  descripcion  text,
  duracion     int not null default 30 check (duracion > 0),
  precio       int not null default 0 check (precio >= 0),
  foto_path    text,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);
create index on servicios (barberia_id);

-- ---------- Clientes ----------

create table clientes (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  nombre       text not null,
  telefono     text,
  correo       text,
  vip          boolean not null default false,

  -- Visagismo: solo la categoría resultante.
  -- No se guardan proporciones ni imágenes del rostro (dato biométrico sensible).
  forma_rostro     text,
  visagismo_fecha  date,
  visagismo_confianza text,
  tipo_pelo        text,
  densidad         text,
  observaciones    text,

  -- Derecho al olvido: se anonimiza, no se borra, para conservar el respaldo tributario
  anonimizado_en   timestamptz,

  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on clientes (barberia_id);
create index on clientes (barberia_id, telefono);

comment on column clientes.forma_rostro is
  'Categoría estética (Ovalado, Cuadrado…). No permite identificar a la persona.';
comment on column clientes.anonimizado_en is
  'Si tiene fecha, los datos de contacto fueron eliminados a petición del titular.';

-- ---------- Reservas ----------

create type estado_reserva as enum ('reservado', 'confirmado', 'finalizado', 'cancelado');

create table reservas (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  sucursal_id  uuid references sucursales(id) on delete set null,
  cliente_id   uuid references clientes(id) on delete set null,
  cliente_nombre text not null,          -- se conserva aunque el cliente se anonimice
  barbero_id   uuid references perfiles(id) on delete set null,
  servicio_id  uuid references servicios(id) on delete set null,
  fecha        date not null,
  hora         time not null,
  estado       estado_reserva not null default 'reservado',
  notas        text,
  foto_path    text,                     -- foto del corte terminado, en bucket privado
  creada_en    timestamptz not null default now()
);
create index on reservas (barberia_id, fecha);
create index on reservas (barbero_id, fecha);
create index on reservas (cliente_id);

comment on column reservas.foto_path is
  'Ruta en Storage privado. Solo se guarda si existe consentimiento de tipo fotos_corte.';

-- ---------- Finanzas ----------

create table ingresos (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  reserva_id   uuid references reservas(id) on delete set null,
  barbero_id   uuid references perfiles(id) on delete set null,
  fecha        date not null,
  concepto     text not null,
  metodo       text not null default 'efectivo',
  monto        int not null check (monto >= 0),
  creado_en    timestamptz not null default now()
);
create index on ingresos (barberia_id, fecha);
create index on ingresos (barbero_id, fecha);

create table gastos (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  fecha        date not null,
  categoria    text not null,
  descripcion  text,
  monto        int not null check (monto >= 0),
  creado_en    timestamptz not null default now()
);
create index on gastos (barberia_id, fecha);

create table pagos_comision (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references barberias(id) on delete cascade,
  barbero_id   uuid not null references perfiles(id) on delete cascade,
  mes          text not null,            -- 'AAAA-MM'
  monto        int not null check (monto > 0),
  metodo       text not null default 'transferencia',
  comprobante_path text,
  creado_en    timestamptz not null default now()
);
create index on pagos_comision (barberia_id, mes);
create index on pagos_comision (barbero_id, mes);

-- ---------- Mantener actualizado_en ----------

create or replace function tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

create trigger t_clientes_actualizado
  before update on clientes
  for each row execute function tocar_actualizado();
