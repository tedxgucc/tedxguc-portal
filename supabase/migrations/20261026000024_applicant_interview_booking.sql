-- Applicants choose an interview immediately after submitting their form.
-- The booking itself advances the application to the interview stage.

create or replace function public.get_application_by_token(p_status_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'application_id', a.id,
    'applicant_name', a.applicant_name,
    'cycle', c.name,
    'stage', private.public_stage(a.stage, c.rejections_released_at is not null or a.rejection_notified_at is not null),
    'teams', (select jsonb_agg(t.name order by array_position(a.team_choices, t.id))
              from public.teams t where t.id = any (a.team_choices)),
    'interview', (select jsonb_build_object('slot_id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
                                            'location', s.location, 'team', t.name)
                  from public.interview_slots s join public.teams t on t.id = s.team_id
                  where s.application_id = a.id),
    'open_slots', case when a.stage in ('applied', 'screened', 'interview') then coalesce((
        select jsonb_agg(jsonb_build_object('slot_id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
                                            'location', s.location, 'team', t.name) order by s.starts_at)
        from public.interview_slots s join public.teams t on t.id = s.team_id
        where s.cycle_id = a.cycle_id and s.team_id = any (a.team_choices)
          and s.application_id is null and s.starts_at > now() + interval '1 hour'), '[]'::jsonb) end)
  from public.applications a
  join public.recruitment_cycles c on c.id = a.cycle_id
  where a.status_token_hash = private.hash_token(p_status_token)
$$;

create or replace function public.book_interview_slot(p_status_token text, p_slot_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_app public.applications;
  v_slot public.interview_slots;
begin
  select * into v_app from public.applications
  where status_token_hash = private.hash_token(p_status_token) for update;
  if not found then raise exception 'not_found'; end if;
  if v_app.stage not in ('applied', 'screened', 'interview') then raise exception 'not_invited_to_interview'; end if;

  select * into v_slot from public.interview_slots where id = p_slot_id for update;
  if not found or v_slot.cycle_id <> v_app.cycle_id or not (v_slot.team_id = any (v_app.team_choices)) then
    raise exception 'slot_not_found';
  end if;
  if v_slot.application_id is not null and v_slot.application_id <> v_app.id then
    raise exception 'slot_taken';
  end if;
  if v_slot.starts_at <= now() + interval '1 hour' then
    raise exception 'slot_too_soon';
  end if;

  update public.interview_slots set application_id = null, booked_at = null
   where application_id = v_app.id and id <> p_slot_id;
  update public.interview_slots set application_id = v_app.id, booked_at = now() where id = p_slot_id;

  update public.applications set stage = 'interview', stage_changed_at = now() where id = v_app.id and stage <> 'interview';

  perform private.notify(v_slot.interviewer_ids, 'interview_booked',
    'Interview booked: ' || v_app.applicant_name, null, '/portal/recruitment/' || v_app.id);
  return jsonb_build_object('slot_id', v_slot.id, 'starts_at', v_slot.starts_at, 'location', v_slot.location);
end $$;
