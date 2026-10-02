-- ============================================================================
-- El Coliseo: base de datos del panel de administración
--
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Qué crea:
--   canchas          las 5 canchas de fútbol, las 2 de pádel y el quincho
--   administradores  la lista de personas autorizadas (se llena con 02-administradores.sql)
--   reservas         las reservas, con la regla que impide reservar dos veces lo mismo
--   historial        quién cargó, editó o canceló cada reserva (se llena solo)
--   eventos          torneos y eventos
-- ============================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Canchas y quincho
-- ---------------------------------------------------------------------------
create table if not exists public.canchas (
  id              text primary key,
  nombre          text not null,
  tipo            text not null check (tipo in ('futbol5', 'futbol6', 'padel', 'quincho')),
  orden           smallint not null,
  precio_sin_luz  integer,
  precio_con_luz  integer
);

insert into public.canchas (id, nombre, tipo, orden, precio_sin_luz, precio_con_luz) values
  ('cancha-1', 'Cancha 1', 'futbol5', 1, 30000, 35000),
  ('cancha-2', 'Cancha 2', 'futbol5', 2, 30000, 35000),
  ('cancha-3', 'Cancha 3', 'futbol5', 3, 30000, 35000),
  ('cancha-4', 'Cancha 4', 'futbol6', 4, 30000, 35000),
  ('cancha-5', 'Cancha 5', 'futbol6', 5, 30000, 35000),
  ('padel-1',  'Pádel 1',  'padel',   6, 25000, 30000),
  ('padel-2',  'Pádel 2',  'padel',   7, 25000, 30000),
  ('quincho',  'Quincho',  'quincho', 8, 100000, 100000)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Administradores (las únicas personas que pueden ver y cambiar datos)
-- ---------------------------------------------------------------------------
create table if not exists public.administradores (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  email    text not null
);

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.administradores where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Reservas
-- Las horas van en números enteros: 17 = 17:00, 24 = 00:00, 25 = 01:00.
-- ---------------------------------------------------------------------------
create table if not exists public.reservas (
  id              uuid primary key default gen_random_uuid(),
  cancha_id       text not null references public.canchas (id),
  fecha           date not null,
  hora_inicio     smallint not null check (hora_inicio between 17 and 24),
  hora_fin        smallint not null check (hora_fin between 18 and 25),
  cliente         text not null,
  telefono        text,
  personas        smallint check (personas is null or personas > 0),
  tipo_evento     text,
  monto_total     integer not null default 0 check (monto_total >= 0),
  sena            integer not null default 0 check (sena >= 0),
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'senada', 'pagada', 'cancelada')),
  notas           text,
  creado_por      text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  cancelada_por   text,
  cancelada_en    timestamptz,

  constraint reservas_horas_validas check (hora_fin > hora_inicio),

  -- La regla anti dobles reservas: la misma cancha, el mismo día y horas que se
  -- pisan no pueden existir a la vez (las canceladas no cuentan).
  constraint reservas_sin_choques exclude using gist (
    cancha_id with =,
    fecha with =,
    int4range(hora_inicio, hora_fin) with &&
  ) where (estado <> 'cancelada')
);

create index if not exists reservas_fecha_idx on public.reservas (fecha);

-- Antes de guardar: anota quién y cuándo, y no deja falsificar esos datos.
create or replace function public.reservas_antes()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();

  if tg_op = 'INSERT' then
    new.creado_por := auth.jwt() ->> 'email';
    new.creado_en := now();
    if new.estado = 'cancelada' then
      new.cancelada_por := auth.jwt() ->> 'email';
      new.cancelada_en := now();
    else
      new.cancelada_por := null;
      new.cancelada_en := null;
    end if;
  else
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
    if new.estado = 'cancelada' and old.estado <> 'cancelada' then
      new.cancelada_por := auth.jwt() ->> 'email';
      new.cancelada_en := now();
    elsif new.estado = 'cancelada' then
      new.cancelada_por := old.cancelada_por;
      new.cancelada_en := old.cancelada_en;
    else
      new.cancelada_por := null;
      new.cancelada_en := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservas_antes on public.reservas;
create trigger reservas_antes
  before insert or update on public.reservas
  for each row execute function public.reservas_antes();

-- ---------------------------------------------------------------------------
-- Historial (se llena solo cada vez que se crea, edita o cancela una reserva)
-- ---------------------------------------------------------------------------
create table if not exists public.historial (
  id          bigint generated always as identity primary key,
  reserva_id  uuid not null,
  accion      text not null check (accion in ('creada', 'editada', 'cancelada')),
  usuario     text,
  fecha       timestamptz not null default now(),
  antes       jsonb,
  despues     jsonb
);

create index if not exists historial_reserva_idx on public.historial (reserva_id);

create or replace function public.reservas_historial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial (reserva_id, accion, usuario, despues)
    values (new.id, 'creada', auth.jwt() ->> 'email', to_jsonb(new));
  else
    insert into public.historial (reserva_id, accion, usuario, antes, despues)
    values (
      new.id,
      case when new.estado = 'cancelada' and old.estado <> 'cancelada' then 'cancelada' else 'editada' end,
      auth.jwt() ->> 'email',
      to_jsonb(old),
      to_jsonb(new)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists reservas_historial on public.reservas;
create trigger reservas_historial
  after insert or update on public.reservas
  for each row execute function public.reservas_historial();

-- ---------------------------------------------------------------------------
-- Eventos y torneos
-- ---------------------------------------------------------------------------
create table if not exists public.eventos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  tipo        text not null default 'torneo' check (tipo in ('torneo', 'evento')),
  fecha       date not null,
  canchas     text[] not null default '{}',
  inscriptos  integer not null default 0 check (inscriptos >= 0),
  notas       text,
  cancelado   boolean not null default false,
  creado_por  text,
  creado_en   timestamptz not null default now()
);

create or replace function public.eventos_antes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.jwt() ->> 'email';
    new.creado_en := now();
  else
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  end if;
  return new;
end;
$$;

drop trigger if exists eventos_antes on public.eventos;
create trigger eventos_antes
  before insert or update on public.eventos
  for each row execute function public.eventos_antes();

-- ---------------------------------------------------------------------------
-- Seguridad: nadie ve ni toca nada si no está en la lista de administradores.
-- Con la seguridad activada y sin permisos, el acceso queda cerrado por defecto.
-- ---------------------------------------------------------------------------
alter table public.canchas          enable row level security;
alter table public.administradores  enable row level security;
alter table public.reservas         enable row level security;
alter table public.historial        enable row level security;
alter table public.eventos          enable row level security;

-- Las visitas anónimas (cualquiera que abra la página sin entrar) no tienen acceso a nada.
revoke all on public.canchas, public.administradores, public.reservas,
              public.historial, public.eventos from anon;

-- Quienes iniciaron sesión pueden pedir datos, pero las reglas de abajo deciden
-- si realmente los reciben (solo los administradores).
grant select on public.canchas, public.administradores, public.historial to authenticated;
grant select, insert, update on public.reservas, public.eventos to authenticated;
grant execute on function public.es_admin() to authenticated;

drop policy if exists "admins leen canchas" on public.canchas;
create policy "admins leen canchas" on public.canchas
  for select to authenticated using (public.es_admin());

drop policy if exists "cada admin ve su fila" on public.administradores;
create policy "cada admin ve su fila" on public.administradores
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins leen reservas" on public.reservas;
create policy "admins leen reservas" on public.reservas
  for select to authenticated using (public.es_admin());

drop policy if exists "admins crean reservas" on public.reservas;
create policy "admins crean reservas" on public.reservas
  for insert to authenticated with check (public.es_admin());

drop policy if exists "admins editan reservas" on public.reservas;
create policy "admins editan reservas" on public.reservas
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Nadie puede borrar reservas: se cancelan, y el historial queda.

drop policy if exists "admins leen historial" on public.historial;
create policy "admins leen historial" on public.historial
  for select to authenticated using (public.es_admin());

drop policy if exists "admins leen eventos" on public.eventos;
create policy "admins leen eventos" on public.eventos
  for select to authenticated using (public.es_admin());

drop policy if exists "admins crean eventos" on public.eventos;
create policy "admins crean eventos" on public.eventos
  for insert to authenticated with check (public.es_admin());

drop policy if exists "admins editan eventos" on public.eventos;
create policy "admins editan eventos" on public.eventos
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
