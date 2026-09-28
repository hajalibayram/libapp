-- Create application profiles automatically when Supabase Auth users are added.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
begin
  v_role := case
    when new.raw_user_meta_data ->> 'role' in ('VOLUNTEER', 'ADMIN')
      then (new.raw_user_meta_data ->> 'role')::app_role
    else 'VOLUNTEER'::app_role
  end;

  insert into public.profiles (id, name, email, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    v_role,
    true
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists auth_users_create_profile on auth.users;
create trigger auth_users_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, name, email, role, active)
select
  users.id,
  coalesce(nullif(users.raw_user_meta_data ->> 'name', ''), split_part(users.email, '@', 1)),
  users.email,
  case
    when users.raw_user_meta_data ->> 'role' in ('VOLUNTEER', 'ADMIN')
      then (users.raw_user_meta_data ->> 'role')::app_role
    else 'VOLUNTEER'::app_role
  end,
  true
from auth.users
where not exists (
  select 1
  from public.profiles
  where profiles.id = users.id
);
