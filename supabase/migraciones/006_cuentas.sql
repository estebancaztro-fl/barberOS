-- ============================================================
-- BarberOS · 006 — Cuentas del equipo
--
-- Incluye una CORRECCIÓN DE SEGURIDAD importante: la política que permitía
-- a cada usuario editar su propio perfil también le dejaba cambiarse el rol
-- y la comisión. Un barbero podía ponerse 'admin' y ver todas las finanzas.
-- ============================================================

-- ---------- Campos nuevos ----------

alter table perfiles add column if not exists correo text;
alter table perfiles add column if not exists debe_cambiar_clave boolean not null default false;
alter table perfiles add column if not exists desactivado_en timestamptz;

comment on column perfiles.debe_cambiar_clave is
  'true cuando el administrador creó o restableció la cuenta. La app obliga a definir una clave propia antes de dejar entrar.';
comment on column perfiles.desactivado_en is
  'Fecha en que dejó la barbería. El historial de cortes y comisiones se conserva.';

-- ============================================================
-- CORRECCIÓN DE SEGURIDAD
-- ============================================================

-- Esta política permitía escalar privilegios: cualquiera podía editar su
-- propia fila, incluidos rol y comisión.
drop policy if exists perfil_propio on perfiles;

-- En su reemplazo, una función que solo toca los campos inofensivos.
-- El rol, la comisión y la barbería quedan fuera de alcance del usuario.
create or replace function actualizar_mi_perfil(p_nombre text, p_telefono text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'El nombre es obligatorio';
  end if;

  update perfiles
     set nombre = trim(p_nombre),
         telefono = nullif(trim(coalesce(p_telefono, '')), '')
   where id = auth.uid();
end $$;

comment on function actualizar_mi_perfil is
  'Único camino por el que un usuario edita su propio perfil. Deja fuera rol, comisión y barbería para que nadie pueda subirse los permisos.';

-- Marcar que ya definió su clave propia
create or replace function marcar_clave_cambiada()
returns void
language sql security definer set search_path = public
as $$
  update perfiles set debe_cambiar_clave = false where id = auth.uid()
$$;

-- ---------- Bloquear también los cambios hechos por el administrador ----------
-- El admin sí puede cambiar roles, pero nunca los suyos propios: así una
-- cuenta comprometida no puede repartirse permisos ni quitárselos a otros
-- para quedarse sola.

create or replace function proteger_cambios_de_rol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Nadie cambia su propio rol ni su propia comisión
  if new.id = auth.uid() then
    if new.rol is distinct from old.rol then
      raise exception 'No puedes cambiar tu propio rol';
    end if;
    if new.comision is distinct from old.comision then
      raise exception 'No puedes cambiar tu propia comisión';
    end if;
  end if;

  -- Nadie mueve un perfil a otra barbería
  if new.barberia_id is distinct from old.barberia_id then
    raise exception 'No se puede mover un perfil a otra barbería';
  end if;

  return new;
end $$;

drop trigger if exists t_perfiles_proteger_rol on perfiles;
create trigger t_perfiles_proteger_rol
  before update on perfiles
  for each row execute function proteger_cambios_de_rol();

-- ---------- Debe quedar siempre al menos un administrador ----------

create or replace function exigir_un_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if old.rol = 'admin' and (new.rol is distinct from 'admin' or new.activo = false) then
    select count(*) into n
      from perfiles
     where barberia_id = old.barberia_id and rol = 'admin' and activo and id <> old.id;
    if n = 0 then
      raise exception 'No puedes dejar la barbería sin ningún administrador activo';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists t_perfiles_un_admin on perfiles;
create trigger t_perfiles_un_admin
  before update on perfiles
  for each row execute function exigir_un_admin();

-- ---------- Permisos ----------

grant execute on function actualizar_mi_perfil(text, text) to authenticated;
grant execute on function marcar_clave_cambiada()          to authenticated;
