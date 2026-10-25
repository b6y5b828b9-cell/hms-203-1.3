create or replace function public.guard_visit_token_execution_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  item_executor boolean;
  cashier_staff boolean;
  doctor_staff boolean;
  requesting_doctor boolean;
  old_item jsonb;
  new_item jsonb;
  old_execution_status text;
  new_execution_status text;
  billing_status_changed boolean;
begin
  if exists (
    select 1
    from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as line(item)
    where item->>'executionStatus' is not null
      and item->>'executionStatus' not in ('PENDING_SETTLEMENT', 'READY_FOR_EXECUTION', 'COMPLETED')
  ) then
    raise exception 'Visit service line item has an invalid execution status';
  end if;

  select coalesce(auth.role() = 'service_role', false) or exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'cashier', 'receptionist')
  ) into cashier_staff;

  select coalesce(auth.role() = 'service_role', false) or exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'doctor')
  ) into doctor_staff;

  select coalesce(auth.role() = 'service_role', false) or exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'doctor'
      and coalesce(new.token_data->>'doctorId', new.token_data->'doctorOrders'->>'orderedByDoctorId') = (select auth.uid())::text
  ) into requesting_doctor;

  if tg_op = 'UPDATE' then
    billing_status_changed :=
      old.token_data->'billingSummary'->>'paymentStatus'
        is distinct from new.token_data->'billingSummary'->>'paymentStatus';
    if billing_status_changed
      and new.token_data->'billingSummary'->>'paymentStatus' = 'SETTLED'
      and not cashier_staff then
      raise exception 'Only cashier staff may settle visit-token billing';
    end if;

    for new_item in
      select item from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as line(item)
    loop
      select item into old_item
      from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as line(item)
      where item->>'id' = new_item->>'id';

      if old_item is null then
        new_execution_status := new_item->>'executionStatus';
        if new_execution_status is not null
          and (new_execution_status <> 'PENDING_SETTLEMENT' or not doctor_staff) then
          raise exception 'New service orders must be added by a doctor in PENDING_SETTLEMENT';
        end if;
        continue;
      end if;

      select coalesce(auth.role() = 'service_role', false) or exists (
        select 1 from public.clinic_memberships membership
        where membership.clinic_id = new.clinic_id
          and membership.user_id = (select auth.uid())
          and (
            membership.role = 'admin'
            or (
              membership.role = 'nurse'
              and new_item->>'kind' in ('Procedure', 'Service')
            )
            or (
              membership.role = 'lab'
              and lower(coalesce(new_item->>'department', '')) like '%lab%'
            )
            or (
              membership.role = 'radiology'
              and (
                lower(coalesce(new_item->>'department', '')) like '%radiolog%'
                or lower(coalesce(new_item->>'department', '')) like '%imaging%'
              )
            )
          )
      ) into item_executor;

      old_execution_status := old_item->>'executionStatus';
      new_execution_status := new_item->>'executionStatus';
      if old_execution_status is distinct from new_execution_status then
        if old_execution_status = 'PENDING_SETTLEMENT'
          and new_execution_status = 'READY_FOR_EXECUTION'
          and cashier_staff
          and new.token_data->'billingSummary'->>'paymentStatus' = 'SETTLED' then
          if new_item->>'kind' not in ('Lab', 'Radiology', 'Procedure', 'Service', 'Medication')
            or not (
              new_item->>'insuranceStatus' in ('Approved', 'Partially_Approved', 'Cash_Only')
              or new_item->'paymentOverride'->>'mode' = 'Self_Pay'
            ) then
            raise exception 'Only authorized service line items can be released for execution';
          end if;
        elsif old_execution_status = 'READY_FOR_EXECUTION'
          and new_execution_status = 'COMPLETED'
          and old.token_data->>'status' = 'Ready for Treatment'
          and item_executor
          and new_item->>'kind' in ('Lab', 'Radiology', 'Procedure', 'Service')
          and (
            (
              jsonb_typeof(new_item->'resultPayload') = 'object'
              and coalesce(new_item->'resultPayload'->>'submittedAt', '') <> ''
              and coalesce(new_item->'resultPayload'->>'submittedBy', '') <> ''
            )
            or (
              new_item->>'kind' in ('Procedure', 'Service')
              and jsonb_typeof(new_item->'treatmentExecution') = 'object'
              and coalesce(new_item->'treatmentExecution'->>'executedAt', '') <> ''
              and coalesce(new_item->'treatmentExecution'->>'executedBy', '') <> ''
              and new_item->'treatmentExecution'->>'executedBy' = (select auth.uid())::text
              and (
                new_item->>'insuranceStatus' = 'Approved'
                or (
                  new.token_data->'billingSummary'->>'paymentStatus' = 'SETTLED'
                  and (
                    new_item->>'insuranceStatus' = 'Cash_Only'
                    or (
                      new_item->>'insuranceStatus' = 'Denied'
                      and new_item->'paymentOverride'->>'mode' = 'Self_Pay'
                    )
                    or new_item->'paymentOverride'->>'mode' = 'Self_Pay'
                  )
                )
              )
            )
          ) then
          null;
        else
          raise exception 'Invalid visit service execution transition: % -> %',
            coalesce(old_execution_status, 'unset'),
            coalesce(new_execution_status, 'unset');
        end if;
      end if;

      if old_item->'resultPayload' is distinct from new_item->'resultPayload'
        and not (
          old_execution_status = 'READY_FOR_EXECUTION'
          and new_execution_status = 'COMPLETED'
          and item_executor
        )
        and not (
          old_execution_status = 'COMPLETED'
          and new_execution_status = 'COMPLETED'
          and requesting_doctor
          and (old_item->'resultPayload' - 'acknowledgedAt' - 'acknowledgedBy')
            = (new_item->'resultPayload' - 'acknowledgedAt' - 'acknowledgedBy')
        ) then
        raise exception 'Only service staff can submit results and requesting doctors can acknowledge them';
      end if;

      if old_item->'treatmentExecution' is distinct from new_item->'treatmentExecution'
        and not (
          old_execution_status = 'READY_FOR_EXECUTION'
          and new_execution_status = 'COMPLETED'
          and item_executor
          and new_item->>'kind' in ('Procedure', 'Service')
        ) then
        raise exception 'Treatment execution records are immutable after completion';
      end if;
    end loop;
  else
    for new_item in
      select item from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as line(item)
    loop
      if new_item->>'executionStatus' is not null
        and (new_item->>'executionStatus' <> 'PENDING_SETTLEMENT' or not doctor_staff) then
        raise exception 'New service orders must be added by a doctor in PENDING_SETTLEMENT';
      end if;
    end loop;
  end if;

  new.token_data := jsonb_set(
    coalesce(new.token_data, '{}'::jsonb),
    '{lineItems}',
    coalesce(new.line_items, '[]'::jsonb),
    true
  );
  return new;
end;
$$;

create or replace function public.advance_outpatient_nurse_token(
  p_clinic_id uuid,
  p_token_id text,
  p_next_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.hms_visit_tokens%rowtype;
  current_status text;
  has_ready_nursing_service boolean;
begin
  if auth.uid() is null or p_next_status is null
    or p_next_status not in ('In Triage', 'Ready for Treatment') then
    raise exception 'An authenticated nurse and a supported outpatient queue transition are required';
  end if;

  if not exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = p_clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'nurse')
  ) then
    raise exception 'Nurse clinic membership is required';
  end if;

  select * into token_row
  from public.hms_visit_tokens
  where clinic_id = p_clinic_id and token_id = p_token_id
  for update;
  if not found then
    raise exception 'Visit token not found';
  end if;

  current_status := coalesce(token_row.token_data->>'status', 'Waiting');
  if p_next_status = 'In Triage' and current_status <> 'Waiting' then
    raise exception 'Only waiting visits can be called into triage';
  end if;

  if p_next_status = 'Ready for Treatment' then
    select exists (
      select 1
      from jsonb_array_elements(coalesce(token_row.line_items, '[]'::jsonb)) as line(item)
      where line.item->>'kind' in ('Procedure', 'Service')
        and line.item->>'executionStatus' = 'READY_FOR_EXECUTION'
        and (
          line.item->>'insuranceStatus' = 'Approved'
          or (
            token_row.token_data->'billingSummary'->>'paymentStatus' = 'SETTLED'
            and (
              line.item->>'insuranceStatus' = 'Cash_Only'
              or (
                line.item->>'insuranceStatus' = 'Denied'
                and line.item->'paymentOverride'->>'mode' = 'Self_Pay'
              )
              or line.item->'paymentOverride'->>'mode' = 'Self_Pay'
            )
          )
        )
    ) into has_ready_nursing_service;
    if not has_ready_nursing_service then
      raise exception 'No approved or cash-settled outpatient nursing service is ready';
    end if;
  end if;

  update public.hms_visit_tokens
  set token_data = jsonb_set(
    token_data,
    '{status}',
    to_jsonb(p_next_status),
    true
  ) || jsonb_build_object(
    'calledAt',
    case when p_next_status = 'In Triage' then now()::text else token_data->>'calledAt' end,
    'historyLogs',
    coalesce(token_data->'historyLogs', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'stage', coalesce(token_data->>'currentStage', '2_NURSING_VITALS'),
      'timestamp', now()::text,
      'action', 'Outpatient nurse queue status changed to ' || p_next_status || '.',
      'actor', (select auth.uid())::text
    ))
  )
  where clinic_id = p_clinic_id and token_id = p_token_id
  returning * into token_row;

  return jsonb_build_object(
    'tokenId', token_row.token_id,
    'status', token_row.token_data->>'status',
    'calledAt', token_row.token_data->>'calledAt'
  );
end;
$$;

create or replace function public.save_outpatient_nurse_triage(
  p_clinic_id uuid,
  p_token_id text,
  p_vitals jsonb,
  p_progress_note text,
  p_nurse_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.hms_visit_tokens%rowtype;
  saved_vitals jsonb;
  nursing_note jsonb;
  next_notes jsonb;
  height_value numeric;
  weight_value numeric;
begin
  if auth.uid() is null
    or jsonb_typeof(p_vitals) is distinct from 'object'
    or length(trim(coalesce(p_nurse_name, ''))) = 0
    or length(coalesce(p_nurse_name, '')) > 120
    or length(coalesce(p_progress_note, '')) > 2000 then
    raise exception 'Authenticated nurse, valid vitals, and nurse identity are required';
  end if;

  if not exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = p_clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'nurse')
  ) then
    raise exception 'Nurse clinic membership is required';
  end if;

  if exists (
    select 1
    from unnest(array[
      'bpSystolic', 'bpDiastolic', 'heartRate', 'temperature',
      'respiratoryRate', 'heightCm', 'weightKg', 'spO2', 'painScale'
    ]) as required_fields(field_name)
    where jsonb_typeof(p_vitals->required_fields.field_name) is distinct from 'number'
  ) or jsonb_typeof(p_vitals->'triageLevel') is distinct from 'string'
    or coalesce(p_vitals->>'triageLevel', '') not in (
      'Level 1 - Resuscitation', 'Level 2 - Emergent', 'Level 3 - Urgent',
      'Level 4 - Less Urgent', 'Level 5 - Non-Urgent'
    )
    or jsonb_typeof(p_vitals->'chiefComplaint') not in ('string', 'null')
    or jsonb_typeof(p_vitals->'allergyUpdates') not in ('string', 'null')
  then
    raise exception 'All required vital measurements must be numeric';
  end if;

  if (p_vitals->>'bpSystolic')::numeric < 20 or (p_vitals->>'bpSystolic')::numeric > 300
    or (p_vitals->>'bpDiastolic')::numeric < 10 or (p_vitals->>'bpDiastolic')::numeric > 200
    or (p_vitals->>'bpSystolic')::numeric <= (p_vitals->>'bpDiastolic')::numeric
    or (p_vitals->>'heartRate')::numeric < 1 or (p_vitals->>'heartRate')::numeric > 300
    or (p_vitals->>'temperature')::numeric < 77 or (p_vitals->>'temperature')::numeric > 113
    or (p_vitals->>'respiratoryRate')::numeric < 1 or (p_vitals->>'respiratoryRate')::numeric > 100
    or (p_vitals->>'heightCm')::numeric < 20 or (p_vitals->>'heightCm')::numeric > 250
    or (p_vitals->>'weightKg')::numeric < 0.5 or (p_vitals->>'weightKg')::numeric > 500
    or (p_vitals->>'spO2')::numeric < 1 or (p_vitals->>'spO2')::numeric > 100
    or (p_vitals->>'painScale')::numeric < 0 or (p_vitals->>'painScale')::numeric > 10 then
    raise exception 'One or more vital measurements are outside the accepted range';
  end if;

  height_value := (p_vitals->>'heightCm')::numeric;
  weight_value := (p_vitals->>'weightKg')::numeric;
  saved_vitals := p_vitals || jsonb_build_object(
    'bmi', round(weight_value / power(height_value / 100, 2), 2),
    'nurseName', trim(p_nurse_name),
    'recordedAt', now()::text
  );

  select * into token_row
  from public.hms_visit_tokens
  where clinic_id = p_clinic_id and token_id = p_token_id
  for update;
  if not found then
    raise exception 'Visit token not found';
  end if;
  if coalesce(token_row.token_data->>'status', 'Waiting') <> 'In Triage' then
    raise exception 'The visit must be called into triage before saving vitals';
  end if;

  next_notes := coalesce(token_row.token_data->'nursingNotes', '[]'::jsonb);
  if jsonb_typeof(next_notes) is distinct from 'array' then
    raise exception 'Visit nursing notes must be stored as an array';
  end if;
  if length(trim(coalesce(p_progress_note, ''))) > 0 then
    nursing_note := jsonb_build_object(
      'id', p_token_id || '-N-' || replace(gen_random_uuid()::text, '-', ''),
      'note', trim(p_progress_note),
      'nurseId', (select auth.uid())::text,
      'nurseName', trim(p_nurse_name),
      'recordedAt', now()::text,
      'noteType', 'Progress'
    );
    next_notes := next_notes || jsonb_build_array(nursing_note);
  end if;

  update public.hms_visit_tokens
  set token_data = token_row.token_data || jsonb_build_object(
    'vitals', saved_vitals,
    'nursingNotes', next_notes,
    'status', 'In Consultation',
    'historyLogs', coalesce(token_row.token_data->'historyLogs', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'stage', '2_NURSING_VITALS',
      'timestamp', now()::text,
      'action', 'Nurse saved triage vitals and dispatched the visit to the doctor.',
      'actor', (select auth.uid())::text
    ))
  )
  where clinic_id = p_clinic_id and token_id = p_token_id
  returning * into token_row;

  return jsonb_build_object(
    'tokenId', token_row.token_id,
    'status', token_row.token_data->>'status',
    'vitals', token_row.token_data->'vitals'
  );
end;
$$;

create or replace function public.complete_outpatient_nurse_service(
  p_clinic_id uuid,
  p_token_id text,
  p_line_item_id text,
  p_notes text default null,
  p_executor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.hms_visit_tokens%rowtype;
  selected_item jsonb;
  completed_item jsonb;
  next_items jsonb;
  has_ready_treatment boolean;
begin
  if auth.uid() is null or length(trim(coalesce(p_line_item_id, ''))) = 0
    or length(coalesce(p_notes, '')) > 2000
    or length(coalesce(p_executor_name, '')) > 120 then
    raise exception 'Authenticated nurse, line item, and valid treatment note are required';
  end if;

  if not exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = p_clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'nurse')
  ) then
    raise exception 'Nurse clinic membership is required';
  end if;

  select * into token_row
  from public.hms_visit_tokens
  where clinic_id = p_clinic_id and token_id = p_token_id
  for update;
  if not found then
    raise exception 'Visit token not found';
  end if;
  if token_row.token_data->>'status' <> 'Ready for Treatment' then
    raise exception 'Advance the visit to Ready for Treatment before completing a nursing service';
  end if;

  select line.item into selected_item
  from jsonb_array_elements(coalesce(token_row.line_items, '[]'::jsonb)) as line(item)
  where line.item->>'id' = p_line_item_id;
  if selected_item is null then
    raise exception 'Visit service line item not found';
  end if;
  if selected_item->>'kind' not in ('Procedure', 'Service')
    or selected_item->>'executionStatus' <> 'READY_FOR_EXECUTION' then
    raise exception 'Only ready outpatient procedures or services can be completed by nursing';
  end if;
  if not (
    selected_item->>'insuranceStatus' = 'Approved'
    or (
      token_row.token_data->'billingSummary'->>'paymentStatus' = 'SETTLED'
      and (
        selected_item->>'insuranceStatus' = 'Cash_Only'
        or (
          selected_item->>'insuranceStatus' = 'Denied'
          and selected_item->'paymentOverride'->>'mode' = 'Self_Pay'
        )
        or selected_item->'paymentOverride'->>'mode' = 'Self_Pay'
      )
    )
  ) then
    raise exception 'Treatment requires insurance approval or completed cash settlement';
  end if;

  completed_item := selected_item || jsonb_build_object(
    'executionStatus', 'COMPLETED',
    'fulfillmentStatus', 'Completed',
    'treatmentExecution', jsonb_strip_nulls(jsonb_build_object(
      'executedAt', now(),
      'executedBy', (select auth.uid())::text,
      'executedByName', nullif(trim(coalesce(p_executor_name, '')), ''),
      'notes', nullif(trim(coalesce(p_notes, '')), '')
    ))
  );

  select jsonb_agg(
    case when line.item->>'id' = p_line_item_id then completed_item else line.item end
    order by line.ordinality
  )
  into next_items
  from jsonb_array_elements(token_row.line_items) with ordinality as line(item, ordinality);

  select exists (
    select 1
    from jsonb_array_elements(coalesce(next_items, '[]'::jsonb)) as line(item)
    where line.item->>'kind' in ('Procedure', 'Service')
      and line.item->>'executionStatus' = 'READY_FOR_EXECUTION'
      and (
        line.item->>'insuranceStatus' = 'Approved'
        or (
          token_row.token_data->'billingSummary'->>'paymentStatus' = 'SETTLED'
          and (
            line.item->>'insuranceStatus' = 'Cash_Only'
            or line.item->'paymentOverride'->>'mode' = 'Self_Pay'
          )
        )
      )
  ) into has_ready_treatment;

  update public.hms_visit_tokens
  set line_items = coalesce(next_items, '[]'::jsonb),
      token_data = token_row.token_data || jsonb_build_object(
        'status', case when has_ready_treatment then 'Ready for Treatment' else 'In Consultation' end,
        'lineItems', coalesce(next_items, '[]'::jsonb),
        'historyLogs', coalesce(token_row.token_data->'historyLogs', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'stage', coalesce(token_row.token_data->>'currentStage', '5_DIAGNOSTICS_PROCEDURES'),
          'timestamp', now()::text,
          'action', 'Outpatient treatment completed: ' || (selected_item->>'name') || '.',
          'actor', (select auth.uid())::text
        ))
      )
  where clinic_id = p_clinic_id and token_id = p_token_id;

  return completed_item;
end;
$$;

create or replace function public.guard_outpatient_nurse_queue_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous_status text;
  next_status text;
  nurse_staff boolean;
  has_ready_treatment boolean;
begin
  next_status := coalesce(new.token_data->>'status', 'Waiting');
  if next_status not in (
    'Waiting', 'In Triage', 'In Consultation', 'Ready for Treatment', 'Completed', 'Cancelled'
  ) then
    raise exception 'Invalid outpatient visit queue status';
  end if;
  if tg_op = 'INSERT' then
    if next_status in ('In Triage', 'Ready for Treatment') then
      raise exception 'Outpatient nurse workflow states must be reached through an authorized transition';
    end if;
    return new;
  end if;

  previous_status := coalesce(old.token_data->>'status', 'Waiting');
  if previous_status = next_status then
    return new;
  end if;

  select exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'nurse')
  ) into nurse_staff;

  if next_status = 'In Triage' then
    if previous_status <> 'Waiting' or not nurse_staff then
      raise exception 'Only nursing staff can call a waiting token into triage';
    end if;
  elsif next_status = 'Ready for Treatment' then
    if previous_status not in ('In Triage', 'In Consultation', 'Ready for Treatment')
      or not nurse_staff then
      raise exception 'Only nursing staff can advance an active visit to treatment';
    end if;

    select exists (
      select 1
      from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as line(item)
      where line.item->>'kind' in ('Procedure', 'Service')
        and line.item->>'executionStatus' = 'READY_FOR_EXECUTION'
        and (
          line.item->>'insuranceStatus' = 'Approved'
          or (
            new.token_data->'billingSummary'->>'paymentStatus' = 'SETTLED'
            and (
              line.item->>'insuranceStatus' = 'Cash_Only'
              or line.item->'paymentOverride'->>'mode' = 'Self_Pay'
            )
          )
        )
    ) into has_ready_treatment;
    if not has_ready_treatment then
      raise exception 'No approved or cash-settled outpatient nursing service is ready';
    end if;
  elsif next_status = 'In Consultation' and previous_status = 'In Triage' then
    if not nurse_staff or jsonb_typeof(new.token_data->'vitals') is distinct from 'object' then
      raise exception 'Nursing staff must save triage vitals before dispatching to the doctor';
    end if;
  elsif previous_status = 'Ready for Treatment' and next_status = 'In Consultation' then
    if not nurse_staff then
      raise exception 'Only nursing staff can close an outpatient treatment stage';
    end if;
    select exists (
      select 1
      from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as line(item)
      where line.item->>'kind' in ('Procedure', 'Service')
        and line.item->>'executionStatus' = 'READY_FOR_EXECUTION'
        and (
          line.item->>'insuranceStatus' = 'Approved'
          or (
            new.token_data->'billingSummary'->>'paymentStatus' = 'SETTLED'
            and (
              line.item->>'insuranceStatus' = 'Cash_Only'
              or line.item->'paymentOverride'->>'mode' = 'Self_Pay'
            )
          )
        )
    ) into has_ready_treatment;
    if has_ready_treatment then
      raise exception 'Ready treatment line items must be completed before leaving treatment status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_outpatient_nurse_queue_state on public.hms_visit_tokens;
create trigger guard_outpatient_nurse_queue_state
  before insert or update on public.hms_visit_tokens
  for each row execute function public.guard_outpatient_nurse_queue_state();

grant execute on function public.advance_outpatient_nurse_token(uuid, text, text) to authenticated;
grant execute on function public.save_outpatient_nurse_triage(uuid, text, jsonb, text, text) to authenticated;
grant execute on function public.complete_outpatient_nurse_service(uuid, text, text, text, text) to authenticated;
