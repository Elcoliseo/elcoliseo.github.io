-- ============================================================================
-- El Coliseo: precios que usa el panel para completar el monto de una reserva
--
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede correr las veces que haga falta. Para cambiar un precio, cambiá el
-- número de abajo y volvé a correrlo.
--
--   Canchas de fútbol 5 y 6:  $30.000 sin luz, $35.000 con luz (por hora)
--   Canchas de pádel:         $25.000 sin luz, $30.000 con luz (por hora)
--   Quincho:                  $100.000 por alquiler (mismo precio con o sin luz)
-- ============================================================================

update public.canchas set precio_sin_luz = 30000,  precio_con_luz = 35000  where tipo in ('futbol5', 'futbol6');
update public.canchas set precio_sin_luz = 25000,  precio_con_luz = 30000  where tipo = 'padel';
update public.canchas set precio_sin_luz = 100000, precio_con_luz = 100000 where id = 'quincho';

-- Tiene que mostrar las 8 filas con sus precios.
select id, nombre, precio_sin_luz, precio_con_luz from public.canchas order by orden;
