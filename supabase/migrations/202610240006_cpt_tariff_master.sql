create table if not exists public.cpt_tariff_master (
  cpt_code text primary key,
  description text not null,
  category text not null check (category in ('Consultation', 'Lab Test', 'Radiology', 'Procedure')),
  standard_unit_price numeric(10, 2) not null check (standard_unit_price >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.cpt_tariff_master is
  'Facility-maintained CPT tariff master. Seed prices are illustrative AED values and must be verified by authorized facility billing staff before production use.';

alter table public.cpt_tariff_master enable row level security;
revoke all on public.cpt_tariff_master from anon;
grant select on public.cpt_tariff_master to authenticated;

create policy "authenticated clinic staff can read active CPT tariffs"
  on public.cpt_tariff_master for select to authenticated
  using (
    is_active
    and exists (
      select 1
      from public.clinic_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.role in ('admin', 'doctor', 'cashier', 'medical-coder')
    )
  );

insert into public.cpt_tariff_master
  (cpt_code, description, category, standard_unit_price, is_active)
values
  ('99213', 'Outpatient established patient consultation', 'Consultation', 250.00, true),
  ('85025', 'Complete Blood Count (CBC) with automated differential', 'Lab Test', 120.00, true),
  ('72148', 'MRI lumbar spine without contrast', 'Radiology', 1800.00, true),
  ('96372', 'Therapeutic intramuscular injection administration', 'Procedure', 80.00, true)
on conflict (cpt_code) do update
set description = excluded.description,
    category = excluded.category,
    standard_unit_price = excluded.standard_unit_price,
    is_active = excluded.is_active,
    updated_at = now();

create or replace function public.add_cpt_tariff_to_visit(
  p_clinic_id uuid,
  p_token_id text,
  p_cpt_code text,
  p_quantity integer,
  p_expected_unit_price numeric(10, 2)
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.hms_visit_tokens%rowtype;
  tariff_row public.cpt_tariff_master%rowtype;
  line_item jsonb;
  item_kind text;
  item_department text;
  insurance_status text;
begin
  if auth.uid() is null or p_quantity is null or p_quantity < 1 or p_quantity > 999
    or p_expected_unit_price is null or p_expected_unit_price < 0 then
    raise exception 'An authenticated doctor and quantity between 1 and 999 are required';
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
  ) or coalesce(
    token_row.token_data->>'doctorId',
    token_row.token_data->'doctorOrders'->>'orderedByDoctorId'
  ) is distinct from (select auth.uid())::text then
    raise exception 'Only the assigned doctor may add services to this visit';
  end if;

  select * into tariff_row
  from public.cpt_tariff_master
  where cpt_code = upper(trim(p_cpt_code))
    and is_active;
  if not found then
    raise exception 'Active CPT tariff not found';
  end if;
  if tariff_row.standard_unit_price <> p_expected_unit_price then
    raise exception 'CPT tariff price changed; search and select the service again';
  end if;

  item_kind := case tariff_row.category
    when 'Consultation' then 'Consultation'
    when 'Lab Test' then 'Lab'
    when 'Radiology' then 'Radiology'
    else 'Procedure'
  end;
  item_department := case tariff_row.category
    when 'Consultation' then 'Outpatient'
    when 'Lab Test' then 'Laboratory'
    when 'Radiology' then 'Radiology'
    else 'Cardiology / Procedures'
  end;
  insurance_status := case
    when token_row.token_data->'paymentScheme'->>'schemeType' = 'Insurance'
      or token_row.token_data->>'payMode' = 'Insurance' then 'Pending_Auth'
    else 'Cash_Only'
  end;

  line_item := jsonb_build_object(
    'id', 'CPT-' || replace(gen_random_uuid()::text, '-', ''),
    'kind', item_kind,
    'name', tariff_row.description,
    'tariffCategory', tariff_row.category,
    'department', item_department,
    'code', tariff_row.cpt_code,
    'quantity', p_quantity,
    'unitPrice', tariff_row.standard_unit_price,
    'totalPrice', tariff_row.standard_unit_price * p_quantity,
    'orderedBy', (select auth.uid())::text,
    'orderedAt', now(),
    'insuranceStatus', insurance_status,
    'fulfillmentStatus', 'Ordered',
    'executionStatus', case when item_kind = 'Consultation' then null else 'PENDING_SETTLEMENT' end
  );

  update public.hms_visit_tokens
  set line_items = coalesce(line_items, '[]'::jsonb) || jsonb_build_array(line_item),
      updated_at = now(),
      updated_by = (select auth.uid())
  where clinic_id = p_clinic_id and token_id = p_token_id;

  return line_item;
end;
$$;

grant execute on function public.add_cpt_tariff_to_visit(uuid, text, text, integer, numeric) to authenticated;
