-- ============================================================
-- BarberOS · 014 — Un ingreso por reserva, y no más
--
-- Marcar una reserva como "finalizado" registraba el ingreso. Como nada
-- impedía volver a marcarla, tocar el botón seis veces dejaba seis ingresos
-- de $8.000 por un solo corte: las ventas del mes y las comisiones del
-- barbero quedaban infladas.
--
-- La corrección de la interfaz sirve para hoy; el índice único sirve para
-- siempre, incluso si mañana alguien llama la API directamente o hay dos
-- teléfonos apretando el mismo botón al mismo tiempo.
-- ============================================================

-- ---------- 1. Ver el daño antes de tocar nada ----------

select r.id as reserva,
       r.cliente_nombre,
       r.fecha,
       count(*) as ingresos_registrados,
       sum(i.monto) as total_registrado,
       min(i.monto) as deberia_ser
  from ingresos i
  join reservas r on r.id = i.reserva_id
 where i.reserva_id is not null
 group by r.id, r.cliente_nombre, r.fecha
having count(*) > 1
 order by count(*) desc;

-- ---------- 2. Dejar solo el primero de cada reserva ----------
-- Se conserva el más antiguo: es el que corresponde al momento en que el
-- barbero terminó el corte de verdad.

with numerados as (
  select id,
         row_number() over (
           partition by reserva_id
           order by creado_en, id
         ) as n
    from ingresos
   where reserva_id is not null
)
delete from ingresos
 where id in (select id from numerados where n > 1);

-- ---------- 3. Que no vuelva a pasar ----------

create unique index if not exists ingresos_una_por_reserva
  on ingresos (reserva_id)
  where reserva_id is not null;

comment on index ingresos_una_por_reserva is
  'Un corte, un ingreso. Los ingresos sueltos (venta de productos, propinas) van sin reserva_id y no se ven afectados.';

-- ---------- 4. Comprobación ----------
-- Las dos consultas tienen que salir vacías o en cero.

select count(*) as reservas_con_ingreso_duplicado
  from (
    select reserva_id
      from ingresos
     where reserva_id is not null
     group by reserva_id
    having count(*) > 1
  ) x;

select to_char(fecha, 'YYYY-MM') as mes,
       count(*) as ingresos,
       sum(monto) as total
  from ingresos
 group by 1
 order by 1 desc
 limit 6;
