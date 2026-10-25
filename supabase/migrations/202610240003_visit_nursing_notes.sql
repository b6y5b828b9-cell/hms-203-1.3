create or replace function public.guard_visit_token_nursing_data()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  nursing_data_changed boolean;
  nursing_authorized boolean;
  previous_notes jsonb;
  next_notes jsonb;
  note_index integer;
begin
  if tg_op = 'INSERT' then
    nursing_data_changed :=
      new.token_data ? 'vitals'
      or new.token_data ? 'nursingNotes';
  else
    nursing_data_changed :=
      old.token_data->'vitals' is distinct from new.token_data->'vitals'
      or old.token_data->'nursingNotes' is distinct from new.token_data->'nursingNotes';
  end if;

  if not nursing_data_changed then
    return new;
  end if;

  select coalesce(auth.role() = 'service_role', false) or exists (
    select 1
    from public.clinic_memberships membership
    where membership.clinic_id = new.clinic_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('admin', 'nurse')
  ) into nursing_authorized;

  if not nursing_authorized then
    raise exception 'Only nursing staff may record visit vitals and nursing notes';
  end if;

  if tg_op = 'UPDATE' and old.token_data->'nursingNotes' is distinct from new.token_data->'nursingNotes' then
    previous_notes := coalesce(old.token_data->'nursingNotes', '[]'::jsonb);
    next_notes := coalesce(new.token_data->'nursingNotes', '[]'::jsonb);

    if jsonb_typeof(previous_notes) is distinct from 'array'
      or jsonb_typeof(next_notes) is distinct from 'array' then
      raise exception 'Visit nursing notes are append-only';
    end if;

    if jsonb_array_length(next_notes) < jsonb_array_length(previous_notes) then
      raise exception 'Visit nursing notes are append-only';
    end if;

    if jsonb_array_length(previous_notes) > 0 then
      for note_index in 0..jsonb_array_length(previous_notes) - 1 loop
        if previous_notes->note_index is distinct from next_notes->note_index then
          raise exception 'Existing visit nursing notes cannot be changed or removed';
        end if;
      end loop;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_visit_token_nursing_data on public.hms_visit_tokens;
create trigger guard_visit_token_nursing_data
before insert or update on public.hms_visit_tokens
for each row
execute function public.guard_visit_token_nursing_data();
