-- ============================================================
-- ¿Qué cuentas existen realmente?
--
-- Sirve para revisar el estado después de un intento fallido: puede haber
-- quedado un usuario creado sin perfil, y por eso el correo aparece "ya
-- registrado" pero la persona no sale en el equipo.
-- ============================================================

-- 1. Todos los usuarios, con o sin perfil
select
  u.email,
  u.created_at::date        as creado,
  p.nombre,
  p.rol,
  p.comision,
  p.activo,
  p.debe_cambiar_clave      as clave_temporal_sin_usar,
  b.nombre                  as barberia,
  case when p.id is null then '⚠ SIN PERFIL — no puede entrar' else 'OK' end as estado
from auth.users u
left join perfiles  p on p.id = u.id
left join barberias b on b.id = p.barberia_id
where u.email not like '%@barberos.test'     -- excluye los de las pruebas
order by u.created_at;

-- 2. Usuarios huérfanos: existen para iniciar sesión pero no tienen perfil.
--    La app los adopta sola al volver a crear la cuenta con el mismo correo.
--    Si prefieres borrarlos y empezar limpio, descomenta la línea de abajo.

-- delete from auth.users
--  where id in (select u.id from auth.users u left join perfiles p on p.id = u.id
--               where p.id is null and u.email not like '%@barberos.test');
