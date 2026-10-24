alter table public.clinic_memberships
  drop constraint if exists clinic_memberships_role_check;

alter table public.clinic_memberships
  add constraint clinic_memberships_role_check
  check (role in (
    'admin',
    'doctor',
    'nurse',
    'receptionist',
    'cashier',
    'medical-coder',
    'pharmacist',
    'lab',
    'radiology'
  ));

create table if not exists public.hms_visit_tokens (
  clinic_id uuid not null,
  token_id text not null,
  token_data jsonb not null,
  line_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (clinic_id, token_id),
  check (jsonb_typeof(token_data) = 'object'),
  check (jsonb_typeof(line_items) = 'array')
);

create index if not exists hms_visit_tokens_clinic_updated_idx
  on public.hms_visit_tokens (clinic_id, updated_at desc);

create or replace function public.guard_visit_token_insurance_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  insurance_approver boolean;
  override_authorized boolean;
  elevated_override_authorized boolean;
  cashier_authorized boolean;
  reception_authorized boolean;
  doctor_authorized boolean;
  self_pay_visit boolean;
  insured_visit boolean;
begin
  if exists (
    select 1
    from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as items(item)
    where coalesce(items.item->>'id', '') = ''
      or coalesce(items.item->>'insuranceStatus', '') not in (
        'Pending_Auth',
        'Approved',
        'Partially_Approved',
        'Denied',
        'Cash_Only'
      )
  ) then
    raise exception 'Visit token line items require an id and a valid insurance status';
  end if;

  if exists (
    select items.item->>'id'
    from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as items(item)
    group by items.item->>'id'
    having count(*) > 1
  ) then
    raise exception 'Visit token line item ids must be unique';
  end if;

  if tg_op = 'UPDATE' then
    if exists (
      select 1
      from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as old_items(item)
      where not exists (
        select 1
        from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as new_items(item)
        where new_items.item->>'id' = old_items.item->>'id'
      )
    ) then
      raise exception 'Visit token line items are append-only';
    end if;
  end if;

  select auth.role() = 'service_role' or exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'medical-coder'
  ) into insurance_approver;

  select auth.role() = 'service_role' or exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'medical-coder', 'cashier', 'receptionist')
  ) into override_authorized;

  select auth.role() = 'service_role' or exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'medical-coder')
  ) into elevated_override_authorized;

  select auth.role() = 'service_role' or exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('cashier', 'receptionist')
  ) into cashier_authorized;

  select auth.role() = 'service_role' or exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'receptionist')
  ) into reception_authorized;

  select auth.role() = 'service_role' or exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'doctor'
  ) into doctor_authorized;

  self_pay_visit :=
    coalesce(new.token_data->'paymentScheme'->>'schemeType' = 'Self-Pay', false)
    or (
      coalesce(new.token_data->'paymentScheme'->>'schemeType', '') = ''
      and new.token_data->>'payMode' = 'Self'
    );
  insured_visit :=
    coalesce(new.token_data->'paymentScheme'->>'schemeType' = 'Insurance', false)
    or coalesce(new.token_data->>'payMode' = 'Insurance', false);

  if cashier_authorized and not elevated_override_authorized and not self_pay_visit then
    if tg_op = 'UPDATE' then
      if exists (
        select 1
        from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as old_items(item)
        join jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as new_items(item)
          on new_items.item->>'id' = old_items.item->>'id'
        where old_items.item->'paymentOverride' is distinct from new_items.item->'paymentOverride'
          and (
            new_items.item->>'insuranceStatus' is distinct from 'Denied'
            or new_items.item->'paymentOverride'->>'mode' is distinct from 'Self_Pay'
          )
      ) then
        raise exception 'Cashier self-pay consent is permitted only for denied token items';
      end if;
    elsif tg_op = 'INSERT' and exists (
      select 1
      from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as items(item)
      where items.item->'paymentOverride' is not null
    ) then
      raise exception 'Cashier self-pay consent is permitted only for denied token items';
    end if;
  end if;

  if not insurance_approver then
    if tg_op = 'INSERT' then
      if exists (
        select 1
        from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as items(item)
        where coalesce(items.item->>'insuranceStatus', '') <>
          case when insured_visit then 'Pending_Auth' else 'Cash_Only' end
          or items.item->>'insuranceApprovalId' is not null
          or items.item->>'insuranceApprovedAmount' is not null
          or items.item->>'copayAmount' is not null
          or items.item->>'insuranceRemarks' is not null
      ) then
        raise exception 'Only Insurance Approval may set a final line-item insurance status';
      end if;
    elsif exists (
      select 1
      from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as old_items(item)
      join jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as new_items(item)
        on new_items.item->>'id' = old_items.item->>'id'
      where jsonb_build_object(
        'insuranceStatus', old_items.item->'insuranceStatus',
        'insuranceApprovalId', old_items.item->'insuranceApprovalId',
        'insuranceApprovedAmount', old_items.item->'insuranceApprovedAmount',
        'copayAmount', old_items.item->'copayAmount',
        'insuranceRemarks', old_items.item->'insuranceRemarks'
      ) is distinct from jsonb_build_object(
        'insuranceStatus', new_items.item->'insuranceStatus',
        'insuranceApprovalId', new_items.item->'insuranceApprovalId',
        'insuranceApprovedAmount', new_items.item->'insuranceApprovedAmount',
        'copayAmount', new_items.item->'copayAmount',
        'insuranceRemarks', new_items.item->'insuranceRemarks'
      )
    ) then
      raise exception 'Only Insurance Approval may change line-item insurance authorization data';
    elsif exists (
      select 1
      from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as new_items(item)
      where not exists (
        select 1
        from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as old_items(item)
        where old_items.item->>'id' = new_items.item->>'id'
      )
        and (
          coalesce(new_items.item->>'insuranceStatus', '') <>
            case when insured_visit then 'Pending_Auth' else 'Cash_Only' end
          or new_items.item->>'insuranceApprovalId' is not null
          or new_items.item->>'insuranceApprovedAmount' is not null
          or new_items.item->>'copayAmount' is not null
          or new_items.item->>'insuranceRemarks' is not null
        )
    ) then
      raise exception 'Only Insurance Approval may set a new line-item authorization result';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if not reception_authorized and (
      old.token_data->'paymentScheme' is distinct from new.token_data->'paymentScheme'
      or old.token_data->>'payMode' is distinct from new.token_data->>'payMode'
    ) then
      raise exception 'Only Reception may update the visit payment scheme';
    end if;
  end if;

  if not doctor_authorized then
    if tg_op = 'INSERT' then
      if exists (
        select 1
        from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as items(item)
        where items.item->'appealRequest' is not null
      ) then
        raise exception 'Only the treating doctor may submit a token item appeal';
      end if;
    elsif tg_op = 'UPDATE' then
      if exists (
        select 1
        from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as old_items(item)
        join jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as new_items(item)
          on new_items.item->>'id' = old_items.item->>'id'
        where old_items.item->'appealRequest' is distinct from new_items.item->'appealRequest'
          and not (
            insurance_approver
            and new_items.item->'appealRequest' is null
          )
      ) or exists (
        select 1
        from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as new_items(item)
        where new_items.item->'appealRequest' is not null
          and not exists (
            select 1
            from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as old_items(item)
            where old_items.item->>'id' = new_items.item->>'id'
          )
      ) then
        raise exception 'Only the treating doctor may submit a token item appeal';
      end if;
    end if;
  end if;

  if not override_authorized then
    if tg_op = 'UPDATE' then
      if exists (
        select 1
        from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as old_items(item)
        join jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as new_items(item)
          on new_items.item->>'id' = old_items.item->>'id'
        where old_items.item->'paymentOverride' is distinct from new_items.item->'paymentOverride'
      ) then
        raise exception 'Only authorized staff may change a self-pay override';
      end if;

      if not self_pay_visit and exists (
        select 1
        from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as new_items(item)
        where new_items.item->'paymentOverride' is not null
          and not exists (
            select 1
            from jsonb_array_elements(coalesce(old.line_items, '[]'::jsonb)) as old_items(item)
            where old_items.item->>'id' = new_items.item->>'id'
          )
      ) then
        raise exception 'Self-pay override requires an authorized role';
      end if;
    elsif tg_op = 'INSERT' and not self_pay_visit and exists (
      select 1
      from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) as items(item)
      where items.item->'paymentOverride' is not null
    ) then
      raise exception 'Self-pay override requires an authorized role';
    end if;
  end if;

  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

drop trigger if exists guard_visit_token_insurance_status on public.hms_visit_tokens;
create trigger guard_visit_token_insurance_status
  before insert or update on public.hms_visit_tokens
  for each row execute function public.guard_visit_token_insurance_status();

alter table public.hms_visit_tokens enable row level security;

create policy "clinic staff can read visit tokens"
  on public.hms_visit_tokens for select to authenticated
  using (exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = hms_visit_tokens.clinic_id
      and membership.user_id = (select auth.uid())
  ));

create policy "clinic staff can create visit tokens"
  on public.hms_visit_tokens for insert to authenticated
  with check (exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = hms_visit_tokens.clinic_id
      and membership.user_id = (select auth.uid())
  ));

create policy "clinic staff can update visit tokens"
  on public.hms_visit_tokens for update to authenticated
  using (exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = hms_visit_tokens.clinic_id
      and membership.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = hms_visit_tokens.clinic_id
      and membership.user_id = (select auth.uid())
  ));

do $$
begin
  alter publication supabase_realtime add table public.hms_visit_tokens;
exception
  when duplicate_object then null;
end;
$$;
