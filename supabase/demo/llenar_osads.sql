-- ============================================================
-- BarberOS · Datos de demostración para la barbería "osads"
--
-- Pensado para mostrar el producto: una barbería de tres sillas funcionando
-- a buen ritmo, con la agenda llena y cada barbero generando alrededor de
-- $900.000 a $1.000.000 al mes en comisiones.
--
-- Las cifras salen de números realistas, no inventados:
--   · 9 cortes diarios por barbero de lunes a viernes, 5 los sábados
--   · ticket promedio ≈ $10.800, con la mezcla de servicios que de verdad
--     vende una barbería (el corte con barba pesa más que las cejas)
--   · ~430 clientes en cartera, cada uno volviendo cada tres semanas
--
-- Todo queda borrable con `vaciar_osads.sql`. No toca otra barbería.
--
-- ANTES DE EJECUTAR:
--   1. Plan vigente, si no los disparadores rechazan las escrituras:
--        update barberias set estado_plan = 'activa',
--               periodo_hasta = now() + interval '1 year'
--         where slug = 'osads';
--   2. Migraciones corridas hasta la 014.
--   3. Si ya lo corriste antes: pasa `vaciar_osads.sql` primero.
--
-- Demora entre 20 y 60 segundos. Al final imprime el resumen.
-- ============================================================

do $$
declare
  v_barberia uuid;
  v_sucursal uuid;
  v_barberos uuid[];
  v_servicios uuid[];
  v_nuevo uuid;
  v_creados int;
begin
  select id into v_barberia from barberias where slug = 'osads';
  if v_barberia is null then
    raise exception 'No existe una barbería con slug "osads". Revisa el nombre.';
  end if;

  if not plan_vigente(v_barberia) then
    raise exception 'La barbería no tiene plan vigente: actívala antes (ver el comentario de arriba).';
  end if;

  select id into v_sucursal
    from sucursales where barberia_id = v_barberia and activa
   order by nombre limit 1;
  if v_sucursal is null then
    insert into sucursales (barberia_id, nombre, direccion, telefono, activa)
    values (v_barberia, 'Sucursal principal', 'Av. Providencia 1234, Santiago', '+56 2 2334 4556', true)
    returning id into v_sucursal;
  end if;

  -- ---------- Servicios ----------

  if (select count(*) from servicios where barberia_id = v_barberia and activo) = 0 then
    insert into servicios (barberia_id, nombre, duracion, precio, activo) values
      (v_barberia, 'Corte clásico',      30,  8000, true),
      (v_barberia, 'Degradado',          45, 12000, true),
      (v_barberia, 'Corte + barba',      60, 15000, true),
      (v_barberia, 'Perfilado de barba', 30,  7000, true),
      (v_barberia, 'Diseño de cejas',    15,  4000, true);
  end if;

  /* El arreglo lleva cada servicio repetido según su precio, así al sortear
     salen más seguido los cortes completos que las cejas. Sin esto todos los
     servicios saldrían igual de seguido y el ticket promedio quedaría bajo. */
  select array_agg(z.id) into v_servicios
    from (
      select s.id
        from servicios s
       cross join generate_series(1, greatest(1, round(s.precio / 2000.0)::int)) as peso
       where s.barberia_id = v_barberia and s.activo
    ) z;

  -- ---------- Equipo ----------

  if (select count(*) from perfiles where barberia_id = v_barberia and atiende and activo) < 3 then
    for k in 1..2 loop
      exit when (select count(*) from perfiles
                  where barberia_id = v_barberia and atiende and activo) >= 3;
      v_nuevo := gen_random_uuid();

      insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
      values
        ('00000000-0000-0000-0000-000000000000', v_nuevo, 'authenticated', 'authenticated',
         'demo-' || substr(v_nuevo::text, 1, 8) || '@barberos.demo', '',
         now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

      insert into perfiles (id, barberia_id, nombre, telefono, rol, comision, activo, atiende)
      values (v_nuevo, v_barberia,
              case k when 1 then 'Cristóbal Vera' else 'Ignacio Soto' end,
              case k when 1 then '+56 9 7712 4488' else '+56 9 6620 3391' end,
              'barbero', case k when 1 then 45 else 40 end, true, true);
    end loop;
  end if;

  select array_agg(id order by nombre) into v_barberos
    from perfiles where barberia_id = v_barberia and atiende and activo;

  -- ---------- Clientes con ficha completa ----------
  -- Estos son los que se ven "escritos a mano" al abrir la lista.

  insert into clientes (barberia_id, nombre, telefono, correo, vip,
                        forma_rostro, tipo_pelo, densidad, observaciones)
  select v_barberia, x.nombre, x.telefono, x.correo, x.vip,
         x.rostro, x.pelo, x.densidad, x.obs
    from (values
      ('Matías Cifuentes',   '+56 9 8123 4451', 'matias.cifuentes@gmail.com', true,  'Ovalado',   'Liso',     'Medio',  'Le gusta el degradado bajo, sin tocar el largo de arriba'),
      ('Ignacio Pérez',      '+56 9 9234 1182', 'nacho.perez@gmail.com',      false, 'Cuadrado',  'Ondulado', 'Grueso', 'Barba siempre perfilada, nunca al ras'),
      ('Sebastián Rojas',    '+56 9 7745 9021', null,                          false, 'Redondo',   'Rulo',     'Grueso', 'Prefiere los lados cortos para estilizar'),
      ('Felipe Contreras',   '+56 9 6612 3308', 'fcontreras@outlook.com',      true,  'Alargado',  'Liso',     'Fino',   'No le gusta el volumen arriba'),
      ('Cristián Muñoz',     '+56 9 8890 4417', null,                          false, 'Ovalado',   'Liso',     'Medio',  null),
      ('Diego Valenzuela',   '+56 9 9012 7734', 'dvalenzuela@gmail.com',       false, 'Triangular','Ondulado', 'Medio',  'Viene cada 3 semanas sin falla'),
      ('Rodrigo Salinas',    '+56 9 7734 2290', null,                          false, 'Cuadrado',  'Liso',     'Grueso', null),
      ('Nicolás Herrera',    '+56 9 8845 1176', 'nico.herrera@gmail.com',      true,  'Ovalado',   'Rulo',     'Grueso', 'Alérgico a la cera con perfume'),
      ('Javier Fuentes',     '+56 9 6690 8823', null,                          false, 'Redondo',   'Liso',     'Fino',   null),
      ('Tomás Araya',        '+56 9 9945 3312', 'tomas.araya@gmail.com',       false, 'Invertido', 'Ondulado', 'Medio',  'Siempre pide fotos del antes y después'),
      ('Benjamín Castro',    '+56 9 7712 6654', null,                          false, 'Cuadrado',  'Liso',     'Medio',  null),
      ('Vicente Morales',    '+56 9 8823 9910', 'vmorales@gmail.com',          false, 'Alargado',  'Rulo',     'Grueso', null),
      ('Andrés Lagos',       '+56 9 9934 5528', null,                          true,  'Ovalado',   'Liso',     'Medio',  'Cliente desde que abrimos'),
      ('Camilo Reyes',       '+56 9 6678 1145', 'camilo.reyes@gmail.com',      false, 'Redondo',   'Ondulado', 'Fino',   null),
      ('Gonzalo Tapia',      '+56 9 7789 3367', null,                          false, 'Cuadrado',  'Liso',     'Grueso', 'Trabaja cerca, viene en su hora de colación'),
      ('Pablo Riquelme',     '+56 9 8834 7712', null,                          false, 'Triangular','Liso',     'Medio',  null),
      ('Esteban Navarro',    '+56 9 9956 2201', 'enavarro@outlook.com',        false, 'Ovalado',   'Ondulado', 'Medio',  null),
      ('Francisco Bravo',    '+56 9 6645 8834', null,                          false, 'Alargado',  'Liso',     'Fino',   null),
      ('Maximiliano Vidal',  '+56 9 7767 4419', 'maxi.vidal@gmail.com',        true,  'Cuadrado',  'Rulo',     'Grueso', 'Pide siempre la misma máquina, la 2'),
      ('Joaquín Espinoza',   '+56 9 8878 5526', null,                          false, 'Redondo',   'Liso',     'Medio',  null),
      ('Martín Aguilera',    '+56 9 9923 1108', null,                          false, 'Ovalado',   'Liso',     'Medio',  null),
      ('Lucas Sepúlveda',    '+56 9 6634 9945', 'lucas.sep@gmail.com',         false, 'Invertido', 'Ondulado', 'Fino',   null),
      ('Emilio Cárdenas',    '+56 9 7756 2273', null,                          false, 'Cuadrado',  'Liso',     'Grueso', null),
      ('Agustín Poblete',    '+56 9 8867 6690', null,                          false, 'Alargado',  'Rulo',     'Medio',  null),
      ('Renato Figueroa',    '+56 9 9989 3341', 'renato.fig@gmail.com',        false, 'Ovalado',   'Liso',     'Medio',  'Se corta antes de cada partido'),
      ('Álvaro Miranda',     '+56 9 6623 7758', null,                          false, 'Redondo',   'Ondulado', 'Grueso', null),
      ('Bastián Cortés',     '+56 9 7745 1182', null,                          false, 'Triangular','Liso',     'Fino',   null),
      ('Damián Silva',       '+56 9 8891 4436', 'dsilva@gmail.com',            false, 'Cuadrado',  'Liso',     'Medio',  null),
      ('Óscar Peña',         '+56 9 9917 8863', null,                          false, 'Ovalado',   'Rulo',     'Grueso', null),
      ('Simón Guzmán',       '+56 9 6656 2294', null,                          true,  'Alargado',  'Liso',     'Medio',  'Trae a sus dos hijos también'),
      ('Ignacio Fuenzalida', '+56 9 7778 6617', null,                          false, 'Redondo',   'Liso',     'Fino',   null),
      ('Cristóbal Leiva',    '+56 9 8802 3345', 'cleiva@outlook.com',          false, 'Cuadrado',  'Ondulado', 'Medio',  null),
      ('Manuel Ortega',      '+56 9 9948 7791', null,                          false, 'Ovalado',   'Liso',     'Grueso', null),
      ('Sergio Maldonado',   '+56 9 6667 1128', null,                          false, 'Invertido', 'Liso',     'Medio',  null),
      ('Rafael Cáceres',     '+56 9 7789 5564', 'rafa.caceres@gmail.com',      false, 'Alargado',  'Rulo',     'Fino',   null),
      ('Marco Villalobos',   '+56 9 8813 9982', null,                          false, 'Cuadrado',  'Liso',     'Grueso', null),
      ('Hernán Toro',        '+56 9 9971 4407', null,                          false, 'Ovalado',   'Ondulado', 'Medio',  null),
      ('Julián Barrera',     '+56 9 6689 8825', null,                          false, 'Redondo',   'Liso',     'Medio',  null)
    ) as x(nombre, telefono, correo, vip, rostro, pelo, densidad, obs)
   where not exists (
     select 1 from clientes c
      where c.barberia_id = v_barberia and c.telefono = x.telefono
   );

  -- ---------- El resto de la cartera ----------
  -- Una barbería que hace 1.300 cortes en dos meses no tiene 38 clientes:
  -- tiene cientos, cada uno volviendo cada tres semanas. Sin esto la ficha
  -- de cada cliente mostraría 30 cortes y no se lo creería nadie.

  insert into clientes (barberia_id, nombre, telefono, vip,
                        forma_rostro, tipo_pelo, densidad)
  select v_barberia,
         c.nombre || ' ' || c.apellido,
         '+56 9 ' || lpad(((c.fila * 373 + 10000019) % 89999999)::text, 8, '0'),
         random() < 0.05,
         (array['Ovalado','Cuadrado','Redondo','Alargado','Triangular','Invertido'])[1 + floor(random() * 6)::int],
         (array['Liso','Ondulado','Rulo'])[1 + floor(random() * 3)::int],
         (array['Fino','Medio','Grueso'])[1 + floor(random() * 3)::int]
    from (
      select n.nombre, a.apellido, row_number() over () as fila
        from unnest(array[
          'Alonso','Bruno','Cristóbal','Daniel','Eduardo','Fabián','Gabriel','Héctor',
          'Iván','Jorge','Kevin','Leandro','Mauricio','Nicolás','Óscar','Patricio',
          'Rodrigo','Sebastián','Tomás','Vicente','Alexis','Boris','Claudio','Diego',
          'Emilio','Franco','Gustavo','Hugo','Ismael','Jaime'
        ]) as n(nombre)
       cross join unnest(array[
          'González','Rodríguez','Muñoz','Rojas','Díaz','Pérez','Soto','Contreras',
          'Silva','Martínez','Sepúlveda','Morales','Rivera','Fuentes','Torres'
        ]) as a(apellido)
       order by md5(n.nombre || a.apellido)
       limit 390
    ) c
   where not exists (
     select 1 from clientes cc
      where cc.barberia_id = v_barberia
        and cc.nombre = c.nombre || ' ' || c.apellido
   );

  /* Autorizaciones al día. El de marketing NO se pone: esa se pide aparte
     y no corresponde darla por supuesta, ni siquiera en una demo. */
  insert into consentimientos (barberia_id, cliente_id, tipo, texto_version, origen)
  select v_barberia, c.id, t.tipo::tipo_consentimiento, 'v1', 'mostrador'
    from clientes c
   cross join (values ('datos_basicos'), ('fotos_corte'), ('visagismo')) as t(tipo)
   where c.barberia_id = v_barberia
   on conflict do nothing;

  -- ---------- Dos meses de agenda a ritmo real ----------
  -- Los disparadores se apagan durante la carga: recalcular el historial de
  -- cada cliente 1.300 veces, una por corte, haría demorar esto varios
  -- minutos. Se recalcula todo junto al final, que da el mismo resultado.

  alter table reservas disable trigger t_reservas_historial;
  alter table reservas disable trigger t_plan_reservas;

  insert into reservas (barberia_id, sucursal_id, cliente_id, cliente_nombre,
                        barbero_id, servicio_id, fecha, hora, estado, notas)
  select v_barberia, v_sucursal, c.id, c.nombre,
         x.barbero, x.servicio, x.fecha, x.hora, 'finalizado'::estado_reserva,
         case when random() < 0.35 then 'Reserva online' else null end
    from (
      select d::date as fecha,
             p.barbero,
             s.hora,
             v_servicios[1 + floor(random() * array_length(v_servicios, 1))::int] as servicio,
             row_number() over () as fila
        from generate_series(current_date - 60, current_date - 1, interval '1 day') d
        cross join unnest(v_barberos) as p(barbero)
        cross join (
          select (time '09:00' + (paso || ' minutes')::interval)::time as hora
            from generate_series(0, 570, 30) as paso
        ) s
       where extract(dow from d) <> 0                    -- domingo cerrado
         and not (extract(dow from d) = 6 and s.hora > time '15:00')
         /* 45% de ocupación: 9 cortes al día por barbero, 5 los sábados */
         and random() < 0.45
    ) x
    join lateral (
      select cl.id, cl.nombre
        from clientes cl
       where cl.barberia_id = v_barberia
       order by md5(cl.id::text || x.fila::text)
       limit 1
    ) c on true;

  get diagnostics v_creados = row_count;
  raise notice 'Cortes terminados: %', v_creados;

  -- ---------- La agenda de los próximos días ----------

  insert into reservas (barberia_id, sucursal_id, cliente_id, cliente_nombre,
                        barbero_id, servicio_id, fecha, hora, estado, notas)
  select v_barberia, v_sucursal, c.id, c.nombre,
         x.barbero, x.servicio, x.fecha, x.hora,
         (case when x.fecha = current_date then 'confirmado' else 'reservado' end)::estado_reserva,
         case when random() < 0.5 then 'Reserva online' else null end
    from (
      select d::date as fecha,
             p.barbero,
             s.hora,
             v_servicios[1 + floor(random() * array_length(v_servicios, 1))::int] as servicio,
             row_number() over () as fila
        from generate_series(current_date, current_date + 6, interval '1 day') d
        cross join unnest(v_barberos) as p(barbero)
        cross join (
          select (time '09:00' + (paso || ' minutes')::interval)::time as hora
            from generate_series(0, 570, 30) as paso
        ) s
       where extract(dow from d) <> 0
         and not (extract(dow from d) = 6 and s.hora > time '15:00')
         /* Hoy, solo horas que todavía no pasan */
         and (d::date > current_date
              or s.hora > (now() at time zone 'America/Santiago')::time)
         and random() < 0.5
    ) x
    join lateral (
      select cl.id, cl.nombre
        from clientes cl
       where cl.barberia_id = v_barberia
       order by md5(cl.id::text || x.fila::text || 'futuro')
       limit 1
    ) c on true;

  get diagnostics v_creados = row_count;
  raise notice 'Reservas próximas: %', v_creados;

  alter table reservas enable trigger t_reservas_historial;
  alter table reservas enable trigger t_plan_reservas;

  /* Ahora sí, el historial de cada cliente de una sola pasada */
  update clientes c set
    cortes = (select count(*) from reservas r
               where r.cliente_id = c.id and r.estado = 'finalizado'),
    ultima_visita = (select max(r.fecha) from reservas r
                      where r.cliente_id = c.id and r.estado = 'finalizado')
   where c.barberia_id = v_barberia;

  -- ---------- La venta de cada corte ----------

  insert into ingresos (barberia_id, reserva_id, barbero_id, fecha, concepto, metodo, monto)
  select v_barberia, r.id, r.barbero_id, r.fecha,
         s.nombre || ' · ' || r.cliente_nombre,
         case
           when random() < 0.40 then 'efectivo'
           when random() < 0.78 then 'debito'
           else 'transferencia'
         end,
         s.precio
    from reservas r
    join servicios s on s.id = r.servicio_id
   where r.barberia_id = v_barberia
     and r.estado = 'finalizado'
   on conflict do nothing;

  -- ---------- Gastos del negocio ----------

  insert into gastos (barberia_id, fecha, categoria, descripcion, monto)
  select v_barberia, g.fecha, g.categoria, g.descripcion, g.monto
    from (
      select (date_trunc('month', d)::date + 4) as fecha,
             'Arriendo' as categoria, 'Arriendo del local' as descripcion,
             850000 as monto
        from generate_series(current_date - interval '2 months', current_date, interval '1 month') d
      union all
      select (date_trunc('month', d)::date + 9), 'Insumos',
             'Ceras, shampoo, navajas y toallas', 240000 + floor(random() * 60000)::int
        from generate_series(current_date - interval '2 months', current_date, interval '1 month') d
      union all
      select (date_trunc('month', d)::date + 14), 'Servicios',
             'Luz, agua e internet', 145000 + floor(random() * 30000)::int
        from generate_series(current_date - interval '2 months', current_date, interval '1 month') d
      union all
      select (date_trunc('month', d)::date + 19), 'Mantención',
             'Afilado de máquinas y tijeras', 65000
        from generate_series(current_date - interval '2 months', current_date, interval '1 month') d
      union all
      select (date_trunc('month', d)::date + 24), 'Marketing',
             'Publicaciones y fotos para redes', 180000
        from generate_series(current_date - interval '2 months', current_date, interval '1 month') d
    ) g
   where g.fecha <= current_date
     and not exists (
       select 1 from gastos gg
        where gg.barberia_id = v_barberia and gg.fecha = g.fecha and gg.categoria = g.categoria
     );

  -- ---------- Comisiones de los meses cerrados ----------
  -- El mes en curso queda pendiente a propósito: es lo que el administrador
  -- espera ver como "por pagar" en su panel.

  insert into pagos_comision (barberia_id, barbero_id, mes, monto, metodo)
  select v_barberia, x.barbero_id, x.mes, x.monto, 'transferencia'
    from (
      select i.barbero_id,
             to_char(i.fecha, 'YYYY-MM') as mes,
             round(sum(i.monto) * max(p.comision) / 100.0)::int as monto
        from ingresos i
        join perfiles p on p.id = i.barbero_id
       where i.barberia_id = v_barberia
         and i.barbero_id is not null
         and to_char(i.fecha, 'YYYY-MM') < to_char(current_date, 'YYYY-MM')
       group by i.barbero_id, to_char(i.fecha, 'YYYY-MM')
    ) x
   where x.monto > 0
     and not exists (
       select 1 from pagos_comision pc
        where pc.barberia_id = v_barberia
          and pc.barbero_id = x.barbero_id and pc.mes = x.mes
     );

  raise notice '=============== LISTO ===============';
end $$;

-- ============================================================
-- Lo que deberías ver en el panel
-- ============================================================

select 'Clientes en cartera' as dato, count(*)::text as valor
  from clientes where barberia_id = (select id from barberias where slug = 'osads')
union all
select 'Cortes terminados', count(*)::text from reservas
 where barberia_id = (select id from barberias where slug = 'osads') and estado = 'finalizado'
union all
select 'Reservas próximas', count(*)::text from reservas
 where barberia_id = (select id from barberias where slug = 'osads')
   and fecha >= current_date and estado <> 'cancelado'
union all
select 'Citas para hoy', count(*)::text from reservas
 where barberia_id = (select id from barberias where slug = 'osads')
   and fecha = current_date and estado <> 'cancelado';

/* Ventas, gastos y utilidad por mes */
with ventas as (
  select to_char(fecha, 'YYYY-MM') as mes, count(*) as cortes, sum(monto) as total
    from ingresos
   where barberia_id = (select id from barberias where slug = 'osads')
   group by 1
),
egresos as (
  select to_char(fecha, 'YYYY-MM') as mes, sum(monto) as total
    from gastos
   where barberia_id = (select id from barberias where slug = 'osads')
   group by 1
)
select v.mes, v.cortes,
       to_char(v.total, 'FM$999G999G999') as ventas,
       to_char(coalesce(e.total, 0), 'FM$999G999G999') as gastos,
       to_char(v.total - coalesce(e.total, 0), 'FM$999G999G999') as utilidad
  from ventas v
  left join egresos e on e.mes = v.mes
 order by v.mes desc;

/* Cuánto se está haciendo cada barbero al mes */
select p.nombre,
       p.comision || '%' as comision,
       count(*) as cortes,
       to_char(sum(i.monto), 'FM$999G999G999') as genero,
       to_char(round(sum(i.monto) * p.comision / 100.0), 'FM$999G999G999') as se_lleva
  from ingresos i
  join perfiles p on p.id = i.barbero_id
 where i.barberia_id = (select id from barberias where slug = 'osads')
   and to_char(i.fecha, 'YYYY-MM') = to_char(current_date - interval '1 month', 'YYYY-MM')
 group by p.nombre, p.comision
 order by sum(i.monto) desc;
