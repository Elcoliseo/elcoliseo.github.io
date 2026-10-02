-- ============================================================================
-- El Coliseo: solicitudes de reserva que llegan desde la página del cliente
--
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Cómo funciona:
--   - El cliente completa el formulario de la página y el pedido queda guardado
--     en la tabla "solicitudes" (además de abrirse el WhatsApp).
--   - Cualquiera puede ENVIAR una solicitud, pero nadie sin cuenta puede LEER
--     ninguna (ni la suya). Solo los administradores las ven y las resuelven.
--   - Un pedido que incluye cancha y quincho (combo) se guarda como dos filas
--     que comparten el mismo "grupo".
--   - Hay un tope contra abusos: máximo 40 pedidos cada 10 minutos.
-- ============================================================================

create table if not exists public.solicitudes (
  id          uuid primary key default gen_random_uuid(),
  grupo       uuid,
  combo       boolean not null default false,
  recurso     text not null check (recurso in ('f5', 'f6', 'padel', 'quincho')),
  cancha_n    smallint,
  fecha       date not null,
  hora_inicio smallint not null check (hora_inicio between 17 and 24),
  hora_fin    smallint not null check (hora_fin between 18 and 25),
  nombre      text not null,
  personas    smallint not null check (personas between 1 and 500),
  tipo_evento text,
  notas       text,
  estado      text not null default 'nueva' check (estado in ('nueva', 'aceptada', 'rechazada')),
  reserva_id  uuid references public.reservas (id),
  creado_en   timestamptz not null default now(),
  resuelta_por text,
  resuelta_en  timestamptz,

  constraint solicitudes_horas check (hora_fin > hora_inicio),
  -- Las canchas se reservan por turnos de una hora; solo el quincho puede durar más.
  constraint solicitudes_turno_cancha check (recurso = 'quincho' or hora_fin = hora_inicio + 1),
  constraint solicitudes_nombre check (char_length(btrim(nombre)) between 1 and 80),
  constraint solicitudes_notas check (notas is null or char_length(notas) <= 500),
  constraint solicitudes_evento check (tipo_evento is null or char_length(tipo_evento) <= 60),
  -- Números de cancha válidos: fútbol 5 = 1 a 3, fútbol 6 = 4 y 5, pádel = 1 y 2.
  constraint solicitudes_cancha_n check (
    cancha_n is null
    or (recurso = 'f5'    and cancha_n between 1 and 3)
    or (recurso = 'f6'    and cancha_n between 4 and 5)
    or (recurso = 'padel' and cancha_n between 1 and 2)
  )
);

create index if not exists solicitudes_estado_idx on public.solicitudes (estado, fecha);
create index if not exists solicitudes_creado_idx on public.solicitudes (creado_en);

-- Antes de guardar: valida la fecha, pone el tope contra abusos y fuerza los datos
-- que decide el sistema (estado, quién resolvió, cuándo). Corre con permisos del
-- dueño porque necesita contar pedidos que el visitante no puede ver.
create or replace function public.solicitudes_antes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.fecha < current_date - 1 or new.fecha > current_date + 400 then
      raise exception 'La fecha elegida no es válida.' using errcode = 'P0001';
    end if;

    if (select count(*) from public.solicitudes where creado_en > now() - interval '10 minutes') >= 40 then
      raise exception 'Hay demasiados pedidos en este momento. Probá de nuevo en unos minutos.' using errcode = 'P0001';
    end if;

    new.nombre := btrim(new.nombre);
    new.estado := 'nueva';
    new.reserva_id := null;
    new.resuelta_por := null;
    new.resuelta_en := null;
    new.creado_en := now();
  else
    new.id := old.id;
    new.creado_en := old.creado_en;
    if old.estado = 'nueva' and new.estado <> 'nueva' then
      new.resuelta_por := auth.jwt() ->> 'email';
      new.resuelta_en := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists solicitudes_antes on public.solicitudes;
create trigger solicitudes_antes
  before insert or update on public.solicitudes
  for each row execute function public.solicitudes_antes();

-- ---------------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------------
alter table public.solicitudes enable row level security;

revoke all on public.solicitudes from anon, authenticated;

-- Un visitante puede enviar solicitudes completando SOLO estas columnas.
-- No puede elegir el estado ni nada que decida el sistema, y no puede leer nada.
grant insert (grupo, combo, recurso, cancha_n, fecha, hora_inicio, hora_fin,
              nombre, personas, tipo_evento, notas)
  on public.solicitudes to anon;

-- Los administradores las ven y las resuelven (no se borran).
grant select, update on public.solicitudes to authenticated;

drop policy if exists "cualquiera puede enviar solicitudes" on public.solicitudes;
create policy "cualquiera puede enviar solicitudes" on public.solicitudes
  for insert to anon with check (true);

drop policy if exists "admins leen solicitudes" on public.solicitudes;
create policy "admins leen solicitudes" on public.solicitudes
  for select to authenticated using (public.es_admin());

drop policy if exists "admins resuelven solicitudes" on public.solicitudes;
create policy "admins resuelven solicitudes" on public.solicitudes
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
