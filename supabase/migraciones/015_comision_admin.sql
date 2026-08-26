-- ============================================================
-- BarberOS · 015 — El administrador puede fijar su propia comisión
--
-- En la migración 006 bloqueé que nadie cambiara su propio rol ni su propia
-- comisión. Para el rol está bien; para la comisión del administrador cubría
-- de más y estorbaba sin proteger nada:
--
--   · El administrador ya puede fijar la comisión de cualquier otro perfil.
--   · Si quisiera saltarse la regla, le bastaba con crear un segundo
--     administrador y pedirle que le subiera la suya.
--
-- O sea, la regla solo le hacía la vida difícil al dueño, que además es el
-- caso más común: el dueño que corta pelo y se queda con el 100% de lo suyo.
--
-- Donde SÍ tiene sentido y se mantiene intacto: un barbero o alguien de
-- recepción no puede tocarse la comisión. Ese era el agujero real.
--
-- El rol propio sigue bloqueado para todos, incluido el administrador. Para
-- traspasar la barbería se asciende al otro primero, y ese otro te cambia a ti.
-- ============================================================

create or replace function proteger_cambios_de_rol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id = auth.uid() then
    -- Nadie cambia su propio rol, ni siquiera el administrador
    if new.rol is distinct from old.rol then
      raise exception 'No puedes cambiar tu propio rol. Pídeselo a otro administrador.';
    end if;

    -- La comisión propia: solo el administrador
    if new.comision is distinct from old.comision and not soy_admin() then
      raise exception 'No puedes cambiar tu propia comisión';
    end if;
  end if;

  -- Nadie mueve un perfil a otra barbería
  if new.barberia_id is distinct from old.barberia_id then
    raise exception 'No se puede mover un perfil a otra barbería';
  end if;

  return new;
end $$;

comment on function proteger_cambios_de_rol is
  'El rol propio está bloqueado para todos. La comisión propia solo la puede cambiar un administrador.';

-- ---------- Comprobación ----------
-- Quién puede tocar qué, en la barbería de cada uno.

select p.nombre,
       p.rol,
       p.comision,
       case when p.rol = 'admin' then 'sí' else 'no' end as puede_cambiar_su_comision
  from perfiles p
 where p.activo
 order by p.barberia_id, p.rol, p.nombre;
