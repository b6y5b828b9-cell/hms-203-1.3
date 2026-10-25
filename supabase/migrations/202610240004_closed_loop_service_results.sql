create table if not exists public.hms_visit_token_results (
  clinic_id uuid not null,
  token_id text not null,
  line_item_id text not null,
  result_payload jsonb not null,
  submitted_by uuid not null references auth.users (id),
  submitted_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users (id),
  acknowledged_at timestamptz,
  primary key (clinic_id, token_id, line_item_id),
  foreign key (clinic_id, token_id)
    references public.hms_visit_tokens (clinic_id, token_id)
    on delete cascade,
  check (jsonb_typeof(result_payload) = 'object')
);

create index if not exists hms_visit_token_results_unacknowledged_idx
  on public.hms_visit_token_results (clinic_id, submitted_at desc)
  where acknowledged_at is null;

alter table public.hms_visit_token_results enable row level security;

create policy "clinic staff can read visit token results"
  on public.hms_visit_token_results for select to authenticated
  using (exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = hms_visit_token_results.clinic_id
      and membership.user_id = (select auth.uid())
  ));

create policy "service staff can submit visit token results"
  on public.hms_visit_token_results for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and exists (
      select 1
      from public.clinic_memberships membership
      where membership.clinic_id = hms_visit_token_results.clinic_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('admin', 'nurse', 'lab', 'radiology')
    )
  );

create policy "requesting doctors can acknowledge visit token results"
  on public.hms_visit_token_results for update to authenticated
  using (exists (
    select 1
    from public.clinic_memberships membership
    join public.hms_visit_tokens visit
      on visit.clinic_id = membership.clinic_id
     and visit.token_id = hms_visit_token_results.token_id
    where membership.clinic_id = hms_visit_token_results.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'doctor'
      and coalesce(visit.token_data->>'doctorId', visit.token_data->'doctorOrders'->>'orderedByDoctorId') = (select auth.uid())::text
  ))
  with check (
    acknowledged_by = (select auth.uid())
    and acknowledged_at is not null
    and exists (
      select 1
      from public.clinic_memberships membership
      join public.hms_visit_tokens visit
        on visit.clinic_id = membership.clinic_id
       and visit.token_id = hms_visit_token_results.token_id
      where membership.clinic_id = hms_visit_token_results.clinic_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'doctor'
        and coalesce(visit.token_data->>'doctorId', visit.token_data->'doctorOrders'->>'orderedByDoctorId') = (select auth.uid())::text
    )
  );

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
          null;
        elsif old_execution_status = 'READY_FOR_EXECUTION'
          and new_execution_status = 'COMPLETED'
          and item_executor
          and new_item->>'kind' in ('Lab', 'Radiology', 'Procedure', 'Service')
          and jsonb_typeof(new_item->'resultPayload') = 'object'
          and coalesce(new_item->'resultPayload'->>'submittedAt', '') <> ''
          and coalesce(new_item->'resultPayload'->>'submittedBy', '') <> '' then
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

drop trigger if exists guard_visit_token_execution_state on public.hms_visit_tokens;
create trigger guard_visit_token_execution_state
  before insert or update on public.hms_visit_tokens
  for each row execute function public.guard_visit_token_execution_state();

create or replace function public.sync_visit_token_result_records()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_item jsonb;
  old_item jsonb;
begin
  if auth.uid() is null then
    return new;
  end if;

  for new_item in
    select item from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as line(item)
  loop
    select item into old_item
    from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as line(item)
    where item->>'id' = new_item->>'id';

    if new_item->>'executionStatus' = 'COMPLETED'
      and old_item->>'executionStatus' = 'READY_FOR_EXECUTION'
      and jsonb_typeof(new_item->'resultPayload') = 'object' then
      insert into public.hms_visit_token_results (
        clinic_id, token_id, line_item_id, result_payload, submitted_by, submitted_at
      ) values (
        new.clinic_id,
        new.token_id,
        new_item->>'id',
        new_item->'resultPayload',
        (select auth.uid()),
        coalesce((new_item->'resultPayload'->>'submittedAt')::timestamptz, now())
      )
      on conflict (clinic_id, token_id, line_item_id) do nothing;
    elsif new_item->>'executionStatus' = 'COMPLETED'
      and new_item->'resultPayload'->>'acknowledgedAt'
        is distinct from old_item->'resultPayload'->>'acknowledgedAt'
      and new_item->'resultPayload'->>'acknowledgedAt' is not null then
      update public.hms_visit_token_results
      set acknowledged_by = (select auth.uid()),
          acknowledged_at = (new_item->'resultPayload'->>'acknowledgedAt')::timestamptz
      where clinic_id = new.clinic_id
        and token_id = new.token_id
        and line_item_id = new_item->>'id';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists sync_visit_token_result_records on public.hms_visit_tokens;
create trigger sync_visit_token_result_records
  after update on public.hms_visit_tokens
  for each row execute function public.sync_visit_token_result_records();

create or replace function public.guard_visit_token_result_acknowledgement()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.result_payload is distinct from old.result_payload
    or new.submitted_by is distinct from old.submitted_by
    or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Submitted visit service results are immutable';
  end if;

  if new.acknowledged_by is distinct from old.acknowledged_by
    or new.acknowledged_at is distinct from old.acknowledged_at then
    if new.acknowledged_by is distinct from (select auth.uid())
      or new.acknowledged_at is null
      or not exists (
        select 1
        from public.clinic_memberships membership
        join public.hms_visit_tokens visit
          on visit.clinic_id = membership.clinic_id
         and visit.token_id = new.token_id
        where membership.clinic_id = new.clinic_id
          and membership.user_id = (select auth.uid())
          and membership.role = 'doctor'
          and coalesce(visit.token_data->>'doctorId', visit.token_data->'doctorOrders'->>'orderedByDoctorId') = (select auth.uid())::text
      ) then
      raise exception 'Only the requesting doctor may acknowledge this result';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_visit_token_result_acknowledgement on public.hms_visit_token_results;
create trigger guard_visit_token_result_acknowledgement
  before update on public.hms_visit_token_results
  for each row execute function public.guard_visit_token_result_acknowledgement();

create or replace function public.submit_visit_token_result(
  p_clinic_id uuid,
  p_token_id text,
  p_line_item_id text,
  p_result_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.hms_visit_tokens%rowtype;
  line_item jsonb;
  updated_items jsonb;
  result_payload jsonb;
begin
  if jsonb_typeof(p_result_payload) <> 'object' then
    raise exception 'Result payload must be a JSON object';
  end if;

  select * into token_row
  from public.hms_visit_tokens
  where clinic_id = p_clinic_id and token_id = p_token_id
  for update;
  if not found then
    raise exception 'Visit token not found';
  end if;

  select item into line_item
  from jsonb_array_elements(token_row.line_items) as line(item)
  where item->>'id' = p_line_item_id;
  if line_item is null then
    raise exception 'Visit service line item not found';
  end if;
  if line_item->>'executionStatus' <> 'READY_FOR_EXECUTION' then
    raise exception 'Only READY_FOR_EXECUTION services may receive results';
  end if;

  result_payload := p_result_payload || jsonb_build_object(
    'submittedAt', now(),
    'submittedBy', (select auth.uid())::text
  );
  select jsonb_agg(
    case when item->>'id' = p_line_item_id then
      jsonb_set(
        jsonb_set(item, '{executionStatus}', '"COMPLETED"'::jsonb, true),
        '{resultPayload}',
        result_payload,
        true
      )
    else item end
    order by ordinal
  ) into updated_items
  from jsonb_array_elements(token_row.line_items) with ordinality as line(item, ordinal);

  update public.hms_visit_tokens
  set line_items = updated_items
  where clinic_id = p_clinic_id and token_id = p_token_id;

  return result_payload;
end;
$$;

create or replace function public.acknowledge_visit_token_result(
  p_clinic_id uuid,
  p_token_id text,
  p_line_item_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.hms_visit_tokens%rowtype;
  line_item jsonb;
  updated_items jsonb;
  updated_payload jsonb;
begin
  select * into token_row
  from public.hms_visit_tokens
  where clinic_id = p_clinic_id and token_id = p_token_id
  for update;
  if not found then
    raise exception 'Visit token not found';
  end if;

  select item into line_item
  from jsonb_array_elements(token_row.line_items) as line(item)
  where item->>'id' = p_line_item_id;
  if line_item is null or line_item->>'executionStatus' <> 'COMPLETED'
    or jsonb_typeof(line_item->'resultPayload') <> 'object' then
    raise exception 'Completed visit service result not found';
  end if;

  updated_payload := line_item->'resultPayload' || jsonb_build_object(
    'acknowledgedAt', now(),
    'acknowledgedBy', (select auth.uid())::text
  );
  select jsonb_agg(
    case when item->>'id' = p_line_item_id
      then jsonb_set(item, '{resultPayload}', updated_payload, true)
      else item end
    order by ordinal
  ) into updated_items
  from jsonb_array_elements(token_row.line_items) with ordinality as line(item, ordinal);

  update public.hms_visit_tokens
  set line_items = updated_items
  where clinic_id = p_clinic_id and token_id = p_token_id;

  return updated_payload;
end;
$$;

grant execute on function public.submit_visit_token_result(uuid, text, text, jsonb) to authenticated;
grant execute on function public.acknowledge_visit_token_result(uuid, text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.hms_visit_token_results;
exception
  when duplicate_object then null;
end;
$$;
