-- Preview only. Where to pay a salesperson, per area. Does not change payouts.
create table if not exists public.salesperson_payment_info (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null,
  email text not null,
  name text,
  payment_note text,
  updated_at timestamptz default now(),
  unique (territory_id, email)
);

alter table public.salesperson_payment_info enable row level security;

drop policy if exists spi_auth_all on public.salesperson_payment_info;
create policy spi_auth_all
  on public.salesperson_payment_info
  for all
  to authenticated
  using (true)
  with check (true);
