-- ============================================================
-- BarberOS · 007 — Permisos del servidor
--
-- CORRECCIÓN: al desactivar "Automatically expose new tables", Supabase dejó
-- de otorgar permisos automáticos a TODOS los roles, incluido `service_role`,
-- que es el que usa el servidor para crear cuentas del equipo.
--
-- En 005 se dieron permisos a `anon` y `authenticated`, pero faltó el servidor.
-- Síntoma: el inicio de sesión funciona, pero crear una cuenta falla con
-- "No tienes perfil en ninguna barbería".
--
-- Ojo: `service_role` se salta las políticas RLS, pero igual necesita permisos
-- a nivel de tabla. Son dos capas distintas.
-- ============================================================

grant usage on schema public to service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Para que las tablas que se creen más adelante no repitan este problema.
-- Se aplica SOLO al servidor: `anon` y `authenticated` siguen necesitando
-- permiso explícito, que es la protección que buscábamos.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;

-- ---------- Comprobación ----------
-- Debe devolver una fila por cada tabla, con `service_role` en grantee.
-- Si sale vacío, algo no se aplicó.

select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as permisos
  from information_schema.role_table_grants
 where grantee = 'service_role' and table_schema = 'public'
 group by table_name, grantee
 order by table_name;
