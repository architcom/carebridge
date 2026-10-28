-- Carebidge SOS log and patient-owned medicine schedule.
-- Run after supabase_schema.sql and roles_schema.sql.
create table if not exists public.emergency_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  patient_name text not null check (char_length(patient_name) between 1 and 80),
  event_type text not null default 'sos' check (event_type = 'sos'),
  vital_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.emergency_events enable row level security;
grant select, insert on public.emergency_events to authenticated;
drop policy if exists "Patients insert own SOS events" on public.emergency_events;
drop policy if exists "Patients and doctors read SOS events" on public.emergency_events;
create policy "Patients insert own SOS events"
on public.emergency_events for insert to authenticated
with check ((select auth.uid()) = patient_id and event_type = 'sos');
create policy "Patients and doctors read SOS events"
on public.emergency_events for select to authenticated
using (
  (select auth.uid()) = patient_id
  or exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'doctor'
  )
);
create index if not exists emergency_events_created_at_idx
on public.emergency_events (created_at desc);

create table if not exists public.medicine_schedules (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  medicine_name text not null check (char_length(medicine_name) between 1 and 100),
  scheduled_time time not null,
  last_taken_on date,
  created_at timestamptz not null default now()
);
alter table public.medicine_schedules enable row level security;
grant select, insert, update, delete on public.medicine_schedules to authenticated;
drop policy if exists "Patients read own medicine schedule" on public.medicine_schedules;
drop policy if exists "Patients insert own medicine schedule" on public.medicine_schedules;
drop policy if exists "Patients update own medicine schedule" on public.medicine_schedules;
drop policy if exists "Patients delete own medicine schedule" on public.medicine_schedules;
create policy "Patients read own medicine schedule"
on public.medicine_schedules for select to authenticated
using ((select auth.uid()) = patient_id);
create policy "Patients insert own medicine schedule"
on public.medicine_schedules for insert to authenticated
with check ((select auth.uid()) = patient_id);
create policy "Patients update own medicine schedule"
on public.medicine_schedules for update to authenticated
using ((select auth.uid()) = patient_id)
with check ((select auth.uid()) = patient_id);
create policy "Patients delete own medicine schedule"
on public.medicine_schedules for delete to authenticated
using ((select auth.uid()) = patient_id);
create index if not exists medicine_schedules_patient_time_idx
on public.medicine_schedules (patient_id, scheduled_time);

-- This pre-existing project helper is an event trigger and does not need Data API access.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
