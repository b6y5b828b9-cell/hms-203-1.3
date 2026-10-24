create table if not exists public.clinic_memberships (
  clinic_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'doctor', 'nurse', 'receptionist', 'cashier', 'medical-coder')),
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table if not exists public.hms_shared_records (
  clinic_id uuid not null,
  record_type text not null check (record_type in ('patient', 'encounter', 'service', 'approval', 'invoice', 'payment', 'audit')),
  record_id text not null,
  record_data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (clinic_id, record_type, record_id)
);

create index if not exists hms_shared_records_clinic_updated_idx
  on public.hms_shared_records (clinic_id, updated_at desc);

alter table public.clinic_memberships enable row level security;
alter table public.hms_shared_records enable row level security;

create policy "users can read their own clinic memberships"
  on public.clinic_memberships for select to authenticated
  using (user_id = (select auth.uid()));

create policy "clinic staff can read records permitted by role"
  on public.hms_shared_records for select to authenticated
  using (exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = hms_shared_records.clinic_id
      and membership.user_id = (select auth.uid())
      and (
        (record_type in ('patient', 'encounter', 'service') and membership.role in ('admin', 'doctor', 'nurse', 'receptionist', 'cashier'))
        or (record_type = 'approval' and membership.role in ('admin', 'doctor', 'receptionist', 'cashier', 'medical-coder'))
        or (record_type in ('invoice', 'payment') and membership.role in ('admin', 'receptionist', 'cashier'))
        or (record_type = 'audit' and membership.role = 'admin')
      )
  ));

create policy "permitted clinic staff can create records"
  on public.hms_shared_records for insert to authenticated
  with check (exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = hms_shared_records.clinic_id
      and membership.user_id = (select auth.uid())
      and (
        (record_type in ('patient', 'encounter', 'service') and membership.role in ('admin', 'doctor', 'nurse', 'receptionist', 'cashier'))
        or (record_type = 'approval' and membership.role in ('admin', 'doctor', 'cashier', 'medical-coder'))
        or (record_type in ('invoice', 'payment') and membership.role in ('admin', 'receptionist', 'cashier'))
        or (record_type = 'audit' and membership.role = 'admin')
      )
  ));

create policy "permitted clinic staff can update records"
  on public.hms_shared_records for update to authenticated
  using (exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = hms_shared_records.clinic_id
      and membership.user_id = (select auth.uid())
      and (
        (record_type in ('patient', 'encounter', 'service') and membership.role in ('admin', 'doctor', 'nurse', 'receptionist', 'cashier'))
        or (record_type = 'approval' and membership.role in ('admin', 'doctor', 'cashier', 'medical-coder'))
        or (record_type in ('invoice', 'payment') and membership.role in ('admin', 'receptionist', 'cashier'))
      )
  ))
  with check (exists (
    select 1 from public.clinic_memberships membership
    where membership.clinic_id = hms_shared_records.clinic_id
      and membership.user_id = (select auth.uid())
      and (
        (record_type in ('patient', 'encounter', 'service') and membership.role in ('admin', 'doctor', 'nurse', 'receptionist', 'cashier'))
        or (record_type = 'approval' and membership.role in ('admin', 'doctor', 'cashier', 'medical-coder'))
        or (record_type in ('invoice', 'payment') and membership.role in ('admin', 'receptionist', 'cashier'))
      )
  ));

do $$
begin
  alter publication supabase_realtime add table public.hms_shared_records;
exception
  when duplicate_object then null;
end;
$$;