-- ============================================================================
-- El Coliseo: horarios ocupados, visibles para los clientes en la página
--
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Qué hace: crea una consulta pública que, dada una fecha, devuelve SOLO
-- qué cancha está ocupada y de qué hora a qué hora. No devuelve nombres,
-- teléfonos, montos, estados ni notas: la tabla de reservas sigue cerrada.
-- Las reservas canceladas no cuentan (ese horario está libre).
-- ============================================================================

create or replace function public.horarios_ocupados(p_fecha date)
returns table (cancha_id text, hora_inicio smallint, hora_fin smallint)
language sql
stable
security definer
set search_path = public
as $$
  select r.cancha_id, r.hora_inicio, r.hora_fin
  from public.reservas r
  where r.fecha = p_fecha
    and r.estado <> 'cancelada'
    -- solo fechas razonables (ayer hasta dentro de poco más de un año)
    and p_fecha between current_date - 1 and current_date + 400;
$$;

revoke all on function public.horarios_ocupados(date) from public;
grant execute on function public.horarios_ocupados(date) to anon, authenticated;
