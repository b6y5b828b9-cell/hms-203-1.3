create index if not exists hms_visit_tokens_doctor_pending_results_idx
  on public.hms_visit_tokens (clinic_id, updated_at desc)
  where line_items @> '[{"executionStatus":"COMPLETED"}]'::jsonb;

create or replace function public.save_doctor_visit_emr(
  p_clinic_id uuid,
  p_token_id text,
  p_doctor_orders jsonb,
  p_line_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.hms_visit_tokens%rowtype;
  saved_doctor_orders jsonb;
  merged_line_items jsonb;
  saved_token_data jsonb;
  is_insured boolean;
  doctor_name text;
begin
  if auth.uid() is null or jsonb_typeof(p_doctor_orders) is distinct from 'object'
    or jsonb_typeof(p_doctor_orders->'diagnoses') is distinct from 'array'
    or jsonb_array_length(coalesce(p_doctor_orders->'diagnoses', '[]'::jsonb)) = 0
    or jsonb_typeof(p_line_items) is distinct from 'array' then
    raise exception 'Authenticated doctor, diagnosis-tagged doctor orders, and line item array are required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_doctor_orders->'diagnoses') as diagnosis(item)
    where coalesce(diagnosis.item->>'code', '') = ''
      or coalesce(diagnosis.item->>'description', '') = ''
  ) then
    raise exception 'Every doctor diagnosis requires an ICD-10 code and description';
  end if;

  select * into token_row
  from public.hms_visit_tokens
  where clinic_id = p_clinic_id and token_id = p_token_id
  for update;
  if not found then
    raise exception 'Visit token not found';
  end if;

  if not exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = p_clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'doctor'
  ) or (
    coalesce(
    token_row.token_data->>'doctorId',
    token_row.token_data->'doctorOrders'->>'orderedByDoctorId'
    ) is distinct from (select auth.uid())::text
  ) then
    raise exception 'Only the assigned doctor may save this visit EMR';
  end if;
  doctor_name := coalesce(token_row.token_data->>'doctorName', p_doctor_orders->>'orderedByDoctorName', 'Treating doctor');
  saved_doctor_orders := p_doctor_orders || jsonb_build_object(
    'orderedByDoctorId', (select auth.uid())::text,
    'orderedByDoctorName', doctor_name,
    'orderedAt', now()
  );

  if exists (
    select 1
    from jsonb_array_elements(p_line_items) as submitted(item)
    where coalesce(submitted.item->>'id', '') = ''
       or coalesce(submitted.item->>'kind', '') not in ('Consultation', 'Service', 'Lab', 'Radiology', 'Procedure', 'Medication')
  ) then
    raise exception 'Every submitted service order must have an id and a supported kind';
  end if;
  if exists (
    select submitted.item->>'id'
    from jsonb_array_elements(p_line_items) as submitted(item)
    group by submitted.item->>'id'
    having count(*) > 1
  ) then
    raise exception 'Doctor order line item ids must be unique';
  end if;

  is_insured :=
    coalesce(token_row.token_data->'paymentScheme'->>'schemeType' = 'Insurance', false)
    or coalesce(token_row.token_data->>'payMode' = 'Insurance', false);

  select coalesce(jsonb_agg(
    case
      when submitted.item is null then existing.item
      when existing.item is null then
        submitted.item || jsonb_build_object(
          'insuranceStatus', case when is_insured then 'Pending_Auth' else 'Cash_Only' end,
          'orderedBy', doctor_name,
          'orderedAt', now(),
          'executionStatus', case
            when submitted.item->>'kind' in ('Lab', 'Radiology', 'Procedure', 'Service', 'Medication') then 'PENDING_SETTLEMENT'
            else null
          end,
          'fulfillmentStatus', 'Ordered'
        )
      else submitted.item || jsonb_strip_nulls(jsonb_build_object(
        'insuranceStatus', existing.item->'insuranceStatus',
        'insuranceApprovalId', existing.item->'insuranceApprovalId',
        'insuranceApprovedAmount', existing.item->'insuranceApprovedAmount',
        'copayAmount', existing.item->'copayAmount',
        'insuranceRemarks', existing.item->'insuranceRemarks',
        'paymentOverride', existing.item->'paymentOverride',
        'executionStatus', coalesce(existing.item->'executionStatus', submitted.item->'executionStatus'),
        'resultPayload', existing.item->'resultPayload',
        'fulfillmentStatus', existing.item->'fulfillmentStatus'
      ))
    end
    order by coalesce(submitted.ordinality, existing.ordinality)
  ), '[]'::jsonb)
  into merged_line_items
  from jsonb_array_elements(coalesce(token_row.line_items, '[]'::jsonb))
    with ordinality as existing(item, ordinality)
  full join jsonb_array_elements(p_line_items)
    with ordinality as submitted(item, ordinality)
    on existing.item->>'id' = submitted.item->>'id';

  saved_token_data := jsonb_set(
    coalesce(token_row.token_data, '{}'::jsonb),
    '{doctorOrders}',
    saved_doctor_orders,
    true
  );
  if token_row.token_data->'doctorOrders' is null then
    saved_token_data := jsonb_set(saved_token_data, '{currentStage}', '"4_CASHIER_BILLING"'::jsonb, true);
    saved_token_data := jsonb_set(saved_token_data, '{status}', '"Waiting"'::jsonb, true);
    saved_token_data := jsonb_set(saved_token_data, '{counterOrRoom}', '"Cashier Counter"'::jsonb, true);
  end if;
  saved_token_data := jsonb_set(
    saved_token_data,
    '{historyLogs}',
    coalesce(token_row.token_data->'historyLogs', '[]'::jsonb) ||
      jsonb_build_array(jsonb_build_object(
        'stage', '3_DOCTOR_EMR',
        'timestamp', now(),
        'action', 'Doctor EMR saved; orders dispatched to coding and cashier queues.',
        'actor', doctor_name
      )),
    true
  );

  update public.hms_visit_tokens
  set token_data = saved_token_data,
      line_items = merged_line_items,
      updated_at = now(),
      updated_by = (select auth.uid())
  where clinic_id = p_clinic_id and token_id = p_token_id;

  return jsonb_build_object(
    'tokenId', p_token_id,
    'doctorOrders', saved_doctor_orders,
    'lineItems', merged_line_items,
    'dispatched', true
  );
end;
$$;

create or replace function public.get_doctor_pending_results(p_clinic_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result_rows jsonb;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = p_clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'doctor'
  ) then
    raise exception 'Authenticated doctor membership is required';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'tokenId', visit.token_id,
      'patientId', visit.token_data->>'patientId',
      'patientName', visit.token_data->>'patientName',
      'tokenNumber', visit.token_data->>'tokenNumber',
      'visitDate', coalesce(visit.token_data->>'visitDate', visit.token_data->>'createdDate'),
      'lineItem', item.value
    )
    order by (item.value->'resultPayload'->>'submittedAt')::timestamptz desc
  ), '[]'::jsonb)
  into result_rows
  from public.hms_visit_tokens visit
  cross join lateral jsonb_array_elements(coalesce(visit.line_items, '[]'::jsonb)) item(value)
  where visit.clinic_id = p_clinic_id
    and coalesce(
      visit.token_data->>'doctorId',
      visit.token_data->'doctorOrders'->>'orderedByDoctorId'
    ) = (select auth.uid())::text
    and item.value->>'executionStatus' = 'COMPLETED'
    and item.value->'resultPayload'->>'acknowledgedAt' is null
    and jsonb_typeof(item.value->'resultPayload') = 'object';

  return result_rows;
end;
$$;

grant execute on function public.save_doctor_visit_emr(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.get_doctor_pending_results(uuid) to authenticated;
