-- A contractor can apply to another area without a second login.
-- The original contractors row stays their home area.
-- This table is that area's own application and pipeline.

create table if not exists public.contractor_area_applications (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  territory_id uuid not null,
  status text not null default 'applied',
  specialty text,
  region text[] default '{}',
  portfolio_url text,
  gear_list text,
  training_completed boolean default false,
  drone_approved boolean default false,
  interview_date text,
  review_notes text,
  created_at timestamptz default now(),
  unique (contractor_id, territory_id)
);

alter table public.contractor_area_applications enable row level security;
revoke all on public.contractor_area_applications from anon, public;

create or replace function public.manager_can_see_territory(p_territory uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.managers m
    where coalesce(m.status, 'active') is distinct from 'invited'
      and (
        m.id = auth.uid()
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and (
        coalesce(m.role, '') = 'super_admin'
        or m.territory_id = p_territory
        or (m.territory_ids is not null and p_territory = any(m.territory_ids))
      )
  );
$$;

create or replace function public.list_contractor_area_applications(p_territory uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_territory is null or not public.manager_can_see_territory(p_territory) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'area_application_id', a.id,
      'id', c.id,
      'first_name', c.first_name,
      'last_name', c.last_name,
      'email', c.email,
      'phone', c.phone,
      'avatar_url', c.avatar_url,
      'rating', c.rating,
      'tags', c.tags,
      'w9_signature', c.w9_signature,
      'contract_signature', c.contract_signature,
      'contract_url', c.contract_url,
      'insurance_url', c.insurance_url,
      'insurance_expiry', c.insurance_expiry,
      'drone_license_url', c.drone_license_url,
      'drone_license_expiry', c.drone_license_expiry,
      'contract_expiry', c.contract_expiry,
      'gallery_requested_at', c.gallery_requested_at,
      'territory_id', a.territory_id,
      'status', a.status,
      'specialty', a.specialty,
      'region', coalesce(to_jsonb(a.region), '[]'::jsonb),
      'portfolio_url', a.portfolio_url,
      'gear_list', a.gear_list,
      'training_completed', a.training_completed,
      'drone_approved', a.drone_approved,
      'interview_date', a.interview_date,
      'review_notes', a.review_notes,
      'created_at', a.created_at
    ) order by a.created_at desc)
    from public.contractor_area_applications a
    join public.contractors c on c.id = a.contractor_id
    where a.territory_id = p_territory
  ), '[]'::jsonb);
end;
$$;

create or replace function public.my_contractor_area_applications()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'territory_id', a.territory_id,
      'status', a.status,
      'specialty', a.specialty,
      'region', coalesce(to_jsonb(a.region), '[]'::jsonb),
      'drone_approved', a.drone_approved,
      'training_completed', a.training_completed
    ))
    from public.contractor_area_applications a
    join public.contractors c on c.id = a.contractor_id
    where c.id = auth.uid() or lower(c.email) = v_email
  ), '[]'::jsonb);
end;
$$;

create or replace function public.update_contractor_area_application(p_id uuid, p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_territory uuid;
  v_region text[];
begin
  select territory_id into v_territory
  from public.contractor_area_applications
  where id = p_id;

  if v_territory is null then
    raise exception 'Application not found';
  end if;
  if not public.manager_can_see_territory(v_territory) then
    raise exception 'You cannot change this area';
  end if;

  if p_updates ? 'region' and jsonb_typeof(p_updates -> 'region') = 'array' then
    select coalesce(array_agg(value), '{}'::text[])
    into v_region
    from jsonb_array_elements_text(p_updates -> 'region') as value;
  end if;

  update public.contractor_area_applications
  set
    status = case when p_updates ? 'status' then left(p_updates ->> 'status', 40) else status end,
    specialty = case when p_updates ? 'specialty' then left(p_updates ->> 'specialty', 80) else specialty end,
    portfolio_url = case when p_updates ? 'portfolio_url' then left(p_updates ->> 'portfolio_url', 500) else portfolio_url end,
    gear_list = case when p_updates ? 'gear_list' then left(p_updates ->> 'gear_list', 8000) else gear_list end,
    training_completed = case when p_updates ? 'training_completed' then coalesce((p_updates ->> 'training_completed')::boolean, training_completed) else training_completed end,
    drone_approved = case when p_updates ? 'drone_approved' then coalesce((p_updates ->> 'drone_approved')::boolean, drone_approved) else drone_approved end,
    interview_date = case when p_updates ? 'interview_date' then left(p_updates ->> 'interview_date', 80) else interview_date end,
    review_notes = case when p_updates ? 'review_notes' then left(p_updates ->> 'review_notes', 4000) else review_notes end,
    region = case when v_region is not null then v_region else region end
  where id = p_id;

  return jsonb_build_object('id', p_id);
end;
$$;

create or replace function public.delete_contractor_area_application(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_territory uuid;
begin
  select territory_id into v_territory
  from public.contractor_area_applications
  where id = p_id;
  if v_territory is null then
    return;
  end if;
  if not public.manager_can_see_territory(v_territory) then
    raise exception 'You cannot change this area';
  end if;
  delete from public.contractor_area_applications where id = p_id;
end;
$$;

create or replace function public.submit_public_application(
  p_slug text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_specialty text,
  p_regions text[],
  p_portfolio_url text,
  p_gear_list text,
  p_lead_weddings integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_jwt_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_territory uuid;
  v_status text;
  v_specialty text := trim(coalesce(p_specialty, ''));
  v_contractor_id uuid;
  v_home uuid;
begin
  if v_uid is null then
    raise exception 'Sign-in did not finish. Refresh the page and try again.';
  end if;
  if v_jwt_email = '' or v_jwt_email <> v_email then
    raise exception 'Use the same email you are applying with.';
  end if;
  if length(trim(coalesce(p_first_name, ''))) = 0 or length(trim(coalesce(p_last_name, ''))) = 0 then
    raise exception 'First and last name are required.';
  end if;
  if length(v_email) < 5 or position('@' in v_email) = 0 then
    raise exception 'Enter a real email address.';
  end if;
  if v_specialty = '' then
    raise exception 'Please select your specialty.';
  end if;
  if p_regions is null or cardinality(p_regions) = 0 then
    raise exception 'Please select at least one region.';
  end if;
  if cardinality(p_regions) > 12 then
    raise exception 'Too many regions.';
  end if;

  if v_slug = 'honeysuckle' then
    v_territory := '0bbaebfc-1c51-4ebe-98b4-e2e9697ef33d';
  else
    select id into v_territory
    from public.territories
    where lower(coalesce(slug, '')) = v_slug
    limit 1;
  end if;
  if v_territory is null then
    raise exception 'We could not find the location for this application link.';
  end if;

  if exists (select 1 from public.editors where lower(email) = v_email) then
    raise exception 'An account with this email already exists in our system (editors). If this is a mistake, contact support.';
  end if;
  if exists (select 1 from public.managers where lower(email) = v_email) then
    raise exception 'An account with this email already exists in our system (managers). If this is a mistake, contact support.';
  end if;

  v_status := case when coalesce(p_lead_weddings, 0) < 3 then 'rejected' else 'applied' end;

  select id, territory_id
  into v_contractor_id, v_home
  from public.contractors
  where id = v_uid or lower(email) = v_email
  order by (id = v_uid) desc, created_at asc
  limit 1;

  if v_contractor_id is null then
    insert into public.contractors (
      id, first_name, last_name, email, phone, status, specialty, region,
      drone_approved, training_completed, portfolio_url, gear_list, territory_id
    ) values (
      v_uid,
      left(trim(p_first_name), 80),
      left(trim(p_last_name), 80),
      v_email,
      left(trim(coalesce(p_phone, '')), 40),
      v_status,
      left(v_specialty, 80),
      p_regions,
      false,
      v_specialty ilike '%bartender%',
      nullif(left(trim(coalesce(p_portfolio_url, '')), 500), ''),
      left(coalesce(p_gear_list, ''), 8000),
      v_territory
    );
    return jsonb_build_object('id', v_uid, 'status', v_status, 'territory_id', v_territory, 'added_area', false);
  end if;

  if v_home = v_territory then
    raise exception 'You already have an application with this company.';
  end if;

  if exists (
    select 1 from public.contractor_area_applications
    where contractor_id = v_contractor_id and territory_id = v_territory
  ) then
    raise exception 'You already applied to this company. The manager can see it in the contractor list.';
  end if;

  insert into public.contractor_area_applications (
    contractor_id, territory_id, status, specialty, region, portfolio_url, gear_list,
    training_completed, drone_approved
  ) values (
    v_contractor_id,
    v_territory,
    v_status,
    left(v_specialty, 80),
    p_regions,
    nullif(left(trim(coalesce(p_portfolio_url, '')), 500), ''),
    left(coalesce(p_gear_list, ''), 8000),
    v_specialty ilike '%bartender%',
    false
  );

  return jsonb_build_object('id', v_contractor_id, 'status', v_status, 'territory_id', v_territory, 'added_area', true);
end;
$$;

do $grant$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'manager_can_see_territory',
        'list_contractor_area_applications',
        'my_contractor_area_applications',
        'update_contractor_area_application',
        'delete_contractor_area_application',
        'submit_public_application'
      )
  loop
    execute format('revoke all on function %s from public', r.sig);
    if r.proname = 'submit_public_application' then
      execute format('grant execute on function %s to anon, authenticated', r.sig);
    else
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end
$grant$;

notify pgrst, 'reload schema';
