-- ============================================================
-- BarberOS · Crear tu barbería y tu cuenta de administrador
--
-- ANTES de correr esto:
--   Authentication → Users → Add user → crea tu usuario con correo y contraseña
--   (marca "Auto Confirm User" para no tener que confirmar por correo)
--
-- Después cambia los tres valores de abajo y ejecuta todo.
-- No necesitas copiar ningún UUID: te busca por correo.
-- ============================================================

do $$
declare
  -- ⬇⬇⬇ CAMBIA ESTOS TRES VALORES ⬇⬇⬇
  v_correo   text := 'tu@correo.cl';        -- el mismo que usaste en Add user
  v_tu_nombre text := 'Esteban';
  v_barberia  text := 'Barber Royce';
  -- ⬆⬆⬆ CAMBIA ESTOS TRES VALORES ⬆⬆⬆

  v_user   uuid;
  v_barb   uuid;
  v_slug   text;
  v_suc    uuid;
begin
  -- 1. Buscar el usuario creado en Authentication
  select id into v_user from auth.users where lower(email) = lower(v_correo);
  if v_user is null then
    raise exception 'No existe un usuario con el correo %. Créalo primero en Authentication → Users → Add user', v_correo;
  end if;

  if exists (select 1 from perfiles where id = v_user) then
    raise exception 'Ese usuario ya tiene perfil. Si quieres empezar de cero, borra la barbería primero.';
  end if;

  -- 2. Dirección del link público, a partir del nombre
  v_slug := regexp_replace(
              regexp_replace(
                lower(translate(v_barberia, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
              '[^a-z0-9]+', '-', 'g'),
            '^-+|-+$', '', 'g');

  -- 3. Crear la barbería
  insert into barberias (nombre, slug, correo_contacto)
  values (v_barberia, v_slug, v_correo)
  returning id into v_barb;

  -- 4. Tu perfil de administrador
  insert into perfiles (id, barberia_id, nombre, rol, comision, activo)
  values (v_user, v_barb, v_tu_nombre, 'admin', 0, true);

  -- 5. Una sucursal para empezar
  insert into sucursales (barberia_id, nombre, activa)
  values (v_barb, 'Sucursal principal', true)
  returning id into v_suc;

  -- 6. Servicios de ejemplo (edítalos después desde la app)
  insert into servicios (barberia_id, nombre, duracion, precio, activo) values
    (v_barb, 'Corte clásico',     30,  8000, true),
    (v_barb, 'Degradado',         45, 12000, true),
    (v_barb, 'Corte + Barba',     60, 15000, true),
    (v_barb, 'Arreglo de barba',  20,  5000, true);

  raise notice '========================================';
  raise notice 'Listo.';
  raise notice 'Barbería : %', v_barberia;
  raise notice 'Link      : /b/%', v_slug;
  raise notice 'Tu cuenta : %  (administrador)', v_correo;
  raise notice 'Se crearon 1 sucursal y 4 servicios de ejemplo.';
  raise notice '========================================';
end $$;

-- Comprobar que quedó bien
select b.nombre as barberia, b.slug as link, p.nombre as usuario, p.rol
  from perfiles p join barberias b on b.id = p.barberia_id;
