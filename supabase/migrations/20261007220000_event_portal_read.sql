alter table public.wedding_events
  add column if not exists venue text,
  add column if not exists address text,
  add column if not exists timeline_notes text,
  add column if not exists day_questions text,
  add column if not exists needs_early_edit boolean default false;

drop policy if exists wedding_events_public_read on public.wedding_events;
create policy wedding_events_public_read
  on public.wedding_events
  for select
  using (true);

create or replace function public.get_public_wedding_team_dates(p_wedding_id uuid)
returns table (contractor_id uuid, role text, event_title text)
language sql
security definer
set search_path = public
as $$
  select a.contractor_id,
         j.role,
         coalesce(e.title, 'Wedding day') as event_title
  from jobs j
  join assignments a on a.job_id = j.id
  left join wedding_events e on e.id = j.event_id
  where j.wedding_id = p_wedding_id
    and coalesce(a.status, '') not ilike 'cancelled';
$$;

grant execute on function public.get_public_wedding_team_dates(uuid) to anon, authenticated;
