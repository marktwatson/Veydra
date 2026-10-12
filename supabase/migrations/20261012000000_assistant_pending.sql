create table if not exists public.assistant_pending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  territory_id uuid not null,
  summary text not null,
  method text not null,
  path text not null,
  body jsonb,
  created_at timestamptz default now()
);

alter table public.assistant_pending enable row level security;
