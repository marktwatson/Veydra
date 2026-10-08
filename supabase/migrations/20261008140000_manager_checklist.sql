-- Preview only. Manual boxes on the wedding checklist.
alter table public.weddings
  add column if not exists manager_checklist jsonb default '{}'::jsonb;
