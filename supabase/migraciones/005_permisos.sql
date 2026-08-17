-- ============================================================
-- BarberOS · 005 — Permisos explícitos
--
-- Al crear el proyecto se desactivó "Automatically expose new tables",
-- así que ninguna tabla queda accesible hasta que se otorgue permiso aquí.
-- Es una segunda barrera: si mañana creas una tabla y olvidas protegerla,
-- igual queda invisible hasta que la agregues a este archivo.
--
-- Los permisos NO reemplazan a RLS. Trabajan juntos:
--   permiso  = "esta tabla existe para ti"
--   política = "de esta tabla, ves estas filas"
-- ============================================================

-- ---------- Visitante sin sesión (anon) ----------
-- Cero acceso a tablas. Solo puede llamar las tres funciones públicas.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to anon;
grant execute on function publico_barberia(text)                          to anon;
grant execute on function publico_horas_ocupadas(text, date, uuid, uuid)  to anon;
grant execute on function publico_reservar(text, uuid, uuid, uuid, date, time, text, text, text, boolean) to anon;

-- ---------- Usuario con sesión (authenticated) ----------
-- Accede a las tablas, pero RLS decide qué filas ve de cada una.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  barberias, sucursales, perfiles, servicios, clientes, reservas,
  consentimientos, solicitudes_arco
  to authenticated;

-- Finanzas: se otorga acceso, pero las políticas lo limitan al administrador
grant select, insert, update, delete on ingresos, gastos, pagos_comision to authenticated;

-- El registro de actividad se escribe por función, nunca a mano
grant select on registro_actividad to authenticated;
grant select, insert, update on brechas to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- Funciones que usa la app con sesión iniciada
grant execute on function mis_metricas(text)                       to authenticated;
grant execute on function exportar_cliente(uuid)                   to authenticated;
grant execute on function anonimizar_cliente(uuid)                 to authenticated;
grant execute on function tiene_consentimiento(uuid, tipo_consentimiento) to authenticated;
grant execute on function registrar_actividad(text, text, uuid)    to authenticated;
grant execute on function mi_barberia()                            to authenticated;
grant execute on function mi_rol()                                 to authenticated;
grant execute on function soy_admin()                              to authenticated;
grant execute on function puede_gestionar()                        to authenticated;

-- La purga la ejecuta la tarea programada, no un usuario
revoke all on function purgar_datos_antiguos() from anon, authenticated;

-- ---------- Comprobación ----------
-- Debe devolver 0 filas. Si aparece alguna, esa tabla quedó accesible
-- para visitantes anónimos y hay que revocarla.

select table_name, privilege_type
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public';
