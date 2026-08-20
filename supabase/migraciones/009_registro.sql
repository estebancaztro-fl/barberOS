-- ============================================================
-- BarberOS · 009 — Registro de barberías nuevas
-- ============================================================

alter table barberias add column if not exists onboarding_completo boolean not null default false;
alter table barberias add column if not exists plan text not null default 'prueba';
alter table barberias add column if not exists prueba_hasta date;

comment on column barberias.onboarding_completo is
  'false hasta que el dueño termina el asistente de bienvenida.';
comment on column barberias.plan is
  'prueba | basico | pro — por ahora informativo, sin cobro automático.';

/* Las barberías que ya existen no deben ver el asistente */
update barberias set onboarding_completo = true where onboarding_completo = false;

-- ---------- Freno al abuso del registro ----------
-- El registro es público: sin un tope, un script podría crear miles de
-- barberías. Se limita cuántas se crean por hora en toda la plataforma.

create or replace function puede_registrar_barberia()
returns boolean
language sql stable security definer set search_path = public
as $$
  select count(*) < 20 from barberias where creada_en > now() - interval '1 hour'
$$;

comment on function puede_registrar_barberia is
  'Tope de altas por hora. Si alguna vez lo alcanzas de verdad, súbelo: es una defensa, no un límite comercial.';

revoke all on function puede_registrar_barberia() from anon, authenticated;
grant execute on function puede_registrar_barberia() to service_role;

-- ---------- Marcar el asistente como terminado ----------

create or replace function terminar_onboarding()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not soy_admin() then
    raise exception 'Solo el administrador puede terminar la configuración';
  end if;
  update barberias set onboarding_completo = true where id = mi_barberia();
end $$;

grant execute on function terminar_onboarding() to authenticated;

-- ---------- Comprobación ----------
select
  (select count(*) from information_schema.columns
    where table_name = 'barberias' and column_name = 'onboarding_completo') as columna_ok,
  (select count(*) from barberias where onboarding_completo) as barberias_al_dia;
