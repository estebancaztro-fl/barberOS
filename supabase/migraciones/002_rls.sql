-- ============================================================
-- BarberOS · 002 — Row Level Security
--
-- Esta es la barrera que de verdad protege los datos. Sin esto, cualquiera
-- con la clave pública de la app lee la base entera. La interfaz que esconde
-- Finanzas no protege nada: quien mire el tráfico de red las ve igual.
--
-- Regla: RLS activo en TODAS las tablas, sin excepción.
-- ============================================================

-- ---------- Funciones auxiliares ----------
-- Van con SECURITY DEFINER para poder leer "perfiles" sin que las políticas
-- de esa misma tabla se llamen a sí mismas y provoquen recursión infinita.

create or replace function mi_barberia()
returns uuid
language sql stable security definer set search_path = public
as $$ select barberia_id from perfiles where id = auth.uid() $$;

create or replace function mi_rol()
returns rol_usuario
language sql stable security definer set search_path = public
as $$ select rol from perfiles where id = auth.uid() and activo $$;

create or replace function soy_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(mi_rol() = 'admin', false) $$;

create or replace function puede_gestionar()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(mi_rol() in ('admin','recepcion'), false) $$;

-- ---------- Activar RLS en todo ----------

alter table barberias      enable row level security;
alter table sucursales     enable row level security;
alter table perfiles       enable row level security;
alter table servicios      enable row level security;
alter table clientes       enable row level security;
alter table reservas       enable row level security;
alter table ingresos       enable row level security;
alter table gastos         enable row level security;
alter table pagos_comision enable row level security;

-- ---------- Barbería ----------

create policy barberia_lectura on barberias
  for select using (id = mi_barberia());

create policy barberia_edicion on barberias
  for update using (id = mi_barberia() and soy_admin());

-- ---------- Sucursales ----------

create policy sucursales_lectura on sucursales
  for select using (barberia_id = mi_barberia());

create policy sucursales_escritura on sucursales
  for all using (barberia_id = mi_barberia() and soy_admin())
  with check (barberia_id = mi_barberia() and soy_admin());

-- ---------- Perfiles ----------
-- Todos ven a sus compañeros (la agenda necesita mostrar nombres),
-- pero solo el administrador crea, edita o desactiva cuentas.

create policy perfiles_lectura on perfiles
  for select using (barberia_id = mi_barberia());

create policy perfiles_admin on perfiles
  for all using (barberia_id = mi_barberia() and soy_admin())
  with check (barberia_id = mi_barberia() and soy_admin());

create policy perfil_propio on perfiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- Servicios ----------

create policy servicios_lectura on servicios
  for select using (barberia_id = mi_barberia());

create policy servicios_escritura on servicios
  for all using (barberia_id = mi_barberia() and puede_gestionar())
  with check (barberia_id = mi_barberia() and puede_gestionar());

-- ---------- Clientes ----------
-- El barbero necesita leer y anotar el visagismo, pero no eliminar fichas.

create policy clientes_lectura on clientes
  for select using (barberia_id = mi_barberia());

create policy clientes_crear on clientes
  for insert with check (barberia_id = mi_barberia());

create policy clientes_editar on clientes
  for update using (barberia_id = mi_barberia())
  with check (barberia_id = mi_barberia());

create policy clientes_eliminar on clientes
  for delete using (barberia_id = mi_barberia() and soy_admin());

-- ---------- Reservas ----------
-- El barbero solo ve y toca las suyas. Admin y recepción, todas.

create policy reservas_lectura on reservas
  for select using (
    barberia_id = mi_barberia()
    and (puede_gestionar() or barbero_id = auth.uid())
  );

create policy reservas_crear on reservas
  for insert with check (
    barberia_id = mi_barberia()
    and (puede_gestionar() or barbero_id = auth.uid())
  );

create policy reservas_editar on reservas
  for update using (
    barberia_id = mi_barberia()
    and (puede_gestionar() or barbero_id = auth.uid())
  )
  with check (barberia_id = mi_barberia());

create policy reservas_eliminar on reservas
  for delete using (barberia_id = mi_barberia() and puede_gestionar());

-- ---------- Finanzas ----------
-- Ingresos y gastos: solo administrador.

create policy ingresos_admin on ingresos
  for all using (barberia_id = mi_barberia() and soy_admin())
  with check (barberia_id = mi_barberia() and soy_admin());

create policy gastos_admin on gastos
  for all using (barberia_id = mi_barberia() and soy_admin())
  with check (barberia_id = mi_barberia() and soy_admin());

-- Comisiones: el barbero ve SOLO las suyas (las necesita en su dashboard),
-- pero únicamente el administrador registra pagos.

create policy comisiones_lectura on pagos_comision
  for select using (
    barberia_id = mi_barberia()
    and (soy_admin() or barbero_id = auth.uid())
  );

create policy comisiones_escritura on pagos_comision
  for insert with check (barberia_id = mi_barberia() and soy_admin());

create policy comisiones_edicion on pagos_comision
  for update using (barberia_id = mi_barberia() and soy_admin())
  with check (barberia_id = mi_barberia() and soy_admin());

create policy comisiones_borrado on pagos_comision
  for delete using (barberia_id = mi_barberia() and soy_admin());

-- ---------- Vista para el dashboard del barbero ----------
-- El barbero necesita saber cuánto generó, pero no puede leer la tabla
-- de ingresos completa. Esta función le devuelve solo su propio resumen.

create or replace function mis_metricas(p_mes text)
returns table (
  cortes int, ingresos int, tasa numeric,
  comision_calculada int, pagado int, pendiente int
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tasa numeric;
  v_ing  int;
  v_pag  int;
  v_cal  int;
begin
  select comision into v_tasa from perfiles where id = auth.uid();

  select coalesce(sum(monto), 0) into v_ing
    from ingresos
   where barbero_id = auth.uid()
     and to_char(fecha, 'YYYY-MM') = p_mes;

  v_cal := round(v_ing * coalesce(v_tasa, 0) / 100);

  select coalesce(sum(monto), 0) into v_pag
    from pagos_comision
   where barbero_id = auth.uid() and mes = p_mes;

  return query
  select
    (select count(*)::int from reservas
      where barbero_id = auth.uid()
        and estado = 'finalizado'
        and to_char(fecha, 'YYYY-MM') = p_mes),
    v_ing, coalesce(v_tasa, 0), v_cal, v_pag, greatest(0, v_cal - v_pag);
end $$;

comment on function mis_metricas is
  'Resumen del barbero autenticado. Calcula la comisión en la base de datos: nunca se acepta un monto enviado desde el navegador.';
