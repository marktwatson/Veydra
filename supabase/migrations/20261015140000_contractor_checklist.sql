-- Contractors can check off their prep list without being allowed to edit the job.
create or replace function public.save_contractor_checklist(p_job_id uuid, p_todos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if p_todos is null or jsonb_typeof(p_todos) <> 'array' or length(p_todos::text) > 20000 then
    raise exception 'Checklist must be a short list';
  end if;

  select exists (
    select 1
    from public.contractors c
    where (c.id = v_uid or lower(c.email) = v_email)
      and (
        exists (
          select 1
          from public.assignments a
          where a.job_id = p_job_id
            and a.contractor_id = c.id
            and coalesce(a.status, '') not in ('Cancelled', 'Declined')
        )
        or exists (
          select 1
          from public.jobs j
          where j.id = p_job_id
            and j.contractor_id = c.id
        )
      )
  ) or exists (
    select 1
    from public.managers m
    where (m.id = v_uid or lower(coalesce(m.email, '')) = v_email)
      and coalesce(m.status, 'active') is distinct from 'invited'
  )
  into v_allowed;

  if not v_allowed then
    raise exception 'You are not assigned to this job';
  end if;

  update public.jobs
  set contractor_todos = p_todos
  where id = p_job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  return p_todos;
end;
$$;

revoke all on function public.save_contractor_checklist(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_contractor_checklist(uuid, jsonb) to authenticated;
