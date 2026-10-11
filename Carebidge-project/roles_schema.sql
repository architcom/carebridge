-- Run in the Supabase SQL Editor. This is safe to rerun.
-- Passwords remain in Supabase Auth as protected hashes.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'patient' check (role in ('patient','doctor')),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
drop policy if exists "Users can read their own role" on public.user_roles;
create policy "Users can read their own role"
on public.user_roles for select to authenticated
using ((select auth.uid()) = user_id);

create schema if not exists private;
revoke all on schema private from public;
create or replace function private.add_default_patient_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'patient')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.add_default_patient_role() from public;
drop trigger if exists add_default_patient_role on auth.users;
create trigger add_default_patient_role
after insert on auth.users for each row
execute function private.add_default_patient_role();

-- Existing accounts start as patients. Doctor access is assigned by an admin only.
insert into public.user_roles(user_id, role)
select id, 'patient' from auth.users
on conflict (user_id) do nothing;

-- The named, already verified Carebidge account is the demo doctor.
update public.user_roles set role = 'doctor'
where user_id = (
  select id from auth.users where lower(email) = lower('architanand272@gmail.com')
);

create table if not exists public.patient_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age integer check (age between 0 and 120),
  sex text,
  care_focus text,
  emergency_contact_name text,
  emergency_contact_phone text,
  updated_at timestamptz not null default now()
);
alter table public.patient_profiles enable row level security;
grant select, insert, update on public.patient_profiles to authenticated;
drop policy if exists "Patients can read their own profile" on public.patient_profiles;
drop policy if exists "Patients can insert their own profile" on public.patient_profiles;
drop policy if exists "Patients can update their own profile" on public.patient_profiles;
create policy "Patients can read their own profile"
on public.patient_profiles for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Patients can insert their own profile"
on public.patient_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Patients can update their own profile"
on public.patient_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
