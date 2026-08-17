create table if not exists lesson_app_state (
  id text primary key,
  state text not null,
  updated_at text not null
);
