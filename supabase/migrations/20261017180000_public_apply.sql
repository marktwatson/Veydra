-- Public contractor applications.
-- Visitors cannot read territories or portal_settings, and cannot insert
-- contractors. These two functions expose only what an application needs.

create or replace function public.get_public_apply(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_id uuid;
  v_settings public.portal_settings%rowtype;
begin
  if v_slug = '' then
    return jsonb_build_object('found', false);
  end if;

  if v_slug = 'honeysuckle' then
    v_id := '0bbaebfc-1c51-4ebe-98b4-e2e9697ef33d';
  else
    select id into v_id
    from public.territories
    where lower(coalesce(slug, '')) = v_slug
    limit 1;
  end if;

  if v_id is null then
    return jsonb_build_object('found', false);
  end if;

  select * into v_settings
  from public.portal_settings
  where territory_id = v_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'found', true,
      'territory_id', v_id,
      'regions', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'found', true,
    'territory_id', v_id,
    'company_name', v_settings.company_name,
    'logo_url', v_settings.logo_url,
    'app_url', v_settings.app_url,
    'regions', coalesce(to_jsonb(v_settings.regions), '[]'::jsonb),
    'email_pipeline_rejected_enabled', v_settings.email_pipeline_rejected_enabled,
    'email_pipeline_rejected_subject', v_settings.email_pipeline_rejected_subject,
    'email_pipeline_rejected_template', v_settings.email_pipeline_rejected_template,
    'sms_pipeline_rejected_enabled', v_settings.sms_pipeline_rejected_enabled,
    'sms_pipeline_rejected_template', v_settings.sms_pipeline_rejected_template,
    'email_applicant_welcome_enabled', v_settings.email_applicant_welcome_enabled,
    'email_applicant_welcome_subject', v_settings.email_applicant_welcome_subject,
    'email_applicant_welcome_template', v_settings.email_applicant_welcome_template,
    'sms_applicant_welcome_enabled', v_settings.sms_applicant_welcome_enabled,
    'sms_applicant_welcome_template', v_settings.sms_applicant_welcome_template
  );
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

  if exists (select 1 from public.contractors where lower(email) = v_email or id = v_uid) then
    raise exception 'An account with this email already exists in our system (contractors). If this is a mistake, contact support.';
  end if;
  if exists (select 1 from public.editors where lower(email) = v_email) then
    raise exception 'An account with this email already exists in our system (editors). If this is a mistake, contact support.';
  end if;
  if exists (select 1 from public.managers where lower(email) = v_email) then
    raise exception 'An account with this email already exists in our system (managers). If this is a mistake, contact support.';
  end if;

  v_status := case when coalesce(p_lead_weddings, 0) < 3 then 'rejected' else 'applied' end;

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

  return jsonb_build_object('id', v_uid, 'status', v_status, 'territory_id', v_territory);
end;
$$;

revoke all on function public.get_public_apply(text) from public;
revoke all on function public.submit_public_application(text, text, text, text, text, text, text[], text, text, integer) from public;
grant execute on function public.get_public_apply(text) to anon, authenticated;
grant execute on function public.submit_public_application(text, text, text, text, text, text, text[], text, text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
