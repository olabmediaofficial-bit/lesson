create table if not exists public.lesson_app_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
