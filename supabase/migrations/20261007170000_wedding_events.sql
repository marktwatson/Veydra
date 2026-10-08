-- Preview only. Events under a wedding. Jobs keep wedding_id.
-- event_id is optional and unused by publish until this is approved.

create table if not exists public.wedding_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  territory_id uuid,
  event_type text not null default 'wedding_day',
  title text,
  event_date date,
  location text,
  notes text,
  created_at timestamptz default now()
);

alter table public.jobs add column if not exists event_id uuid;

create index if not exists idx_wedding_events_wedding
  on public.wedding_events(wedding_id);

alter table public.wedding_events enable row level security;

drop policy if exists "wedding_events_admin_all" on public.wedding_events;
create policy "wedding_events_admin_all"
  on public.wedding_events
  for all
  to authenticated
  using (true)
  with check (true);
