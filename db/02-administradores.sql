-- ============================================================================
-- El Coliseo: autorizar a los 3 administradores
--
-- Orden de trabajo:
--   1) Correr antes 01-tablas.sql.
--   2) Crear los 3 usuarios en Supabase > Authentication > Users > Add user.
--   3) En Supabase > SQL Editor, pegar este script, cambiar los 3 emails de abajo
--      por los reales (en minúsculas) y tocar Run.
--
-- IMPORTANTE: los emails reales se escriben solo en el editor de Supabase.
-- No guardes ni subas este archivo a GitHub con los emails reales.
-- ============================================================================

insert into public.administradores (user_id, email)
select id, email
from auth.users
where email in (
  'email-1@ejemplo.com',
  'email-2@ejemplo.com',
  'email-3@ejemplo.com'
)
on conflict (user_id) do nothing;

-- Tiene que mostrar los 3 emails. Si muestra menos, revisá que estén bien escritos.
select email from public.administradores order by email;
