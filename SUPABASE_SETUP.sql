create table if not exists public.lesson_app_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.lesson_app_state (id, state)
values ('main', '{"blocks":[],"students":[]}'::jsonb)
on conflict (id) do nothing;
