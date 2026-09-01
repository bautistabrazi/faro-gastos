-- ============================================================================
-- Faro · Control de gastos — esquema de Supabase
-- ----------------------------------------------------------------------------
-- Pegá TODO este archivo en:
--   Panel de Supabase  ->  SQL Editor  ->  New query  ->  Run
--
-- Crea una tabla `estados` con UNA fila por usuario: la columna `datos` guarda
-- todo el JSON de la app (gastos, ingresos, categorías, etc.). Simple a
-- propósito. El "Row Level Security" hace que cada persona solo pueda ver y
-- editar SU propia fila.
-- ============================================================================

create table if not exists public.estados (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  datos       jsonb       not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

-- Activar la seguridad por fila.
alter table public.estados enable row level security;

-- Una sola política: cada usuario manda sobre su propia fila (leer y escribir).
drop policy if exists "cada usuario ve y edita lo suyo" on public.estados;
create policy "cada usuario ve y edita lo suyo"
  on public.estados
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- Además, en el panel de Supabase:
--
-- 1) Authentication -> Providers -> Email:  dejá activado "Email".
--    Para el "enlace mágico" alcanza con eso (no hace falta contraseña).
--
-- 2) Authentication -> URL Configuration:
--      Site URL:           https://TU-APP.vercel.app
--      Redirect URLs:      https://TU-APP.vercel.app/**
--                          http://localhost:*/**        (opcional, para probar local)
--
-- 3) (Opcional) Authentication -> Providers -> Email -> "Confirm email":
--    si lo desactivás, el primer login es más rápido para probar.
-- ============================================================================
