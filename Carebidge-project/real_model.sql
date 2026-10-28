-- Run after supabase_schema.sql, roles_schema.sql, and care_features.sql.
-- Patients explicitly connect to doctors before their profiles/readings are shared.

create table if not exists public.doctor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  specialty text not null default '',
  facility text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.doctor_profiles enable row level security;
grant select, insert, update on public.doctor_profiles to authenticated;
drop policy if exists "Signed-in users can list doctors" on public.doctor_profiles;
drop policy if exists "Doctors can insert own profile" on public.doctor_profiles;
drop policy if exists "Doctors can update own profile" on public.doctor_profiles;
create policy "Signed-in users can list doctors"
on public.doctor_profiles for select to authenticated using (true);
create policy "Doctors can insert own profile"
on public.doctor_profiles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.user_roles
              where user_id = (select auth.uid()) and role = 'doctor')
);
create policy "Doctors can update own profile"
on public.doctor_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Create a profile for the existing doctor account without inventing a clinician identity.
insert into public.doctor_profiles (user_id, display_name)
select id, split_part(email, '@', 1)
from auth.users
where lower(email) = lower('architanand272@gmail.com')
on conflict (user_id) do nothing;

create table if not exists public.care_links (
  patient_id uuid not null references auth.users(id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, doctor_id)
);
alter table public.care_links enable row level security;
grant select, insert, delete on public.care_links to authenticated;
drop policy if exists "Patients and doctors read own care links" on public.care_links;
drop policy if exists "Patients connect a doctor" on public.care_links;
drop policy if exists "Patients disconnect a doctor" on public.care_links;
create policy "Patients and doctors read own care links"
on public.care_links for select to authenticated
using (patient_id = (select auth.uid()) or doctor_id = (select auth.uid()));
create policy "Patients connect a doctor"
on public.care_links for insert to authenticated
with check (
  patient_id = (select auth.uid())
  and exists (select 1 from public.user_roles
              where user_id = (select auth.uid()) and role = 'patient')
);
create policy "Patients disconnect a doctor"
on public.care_links for delete to authenticated
using (patient_id = (select auth.uid()));
create index if not exists care_links_doctor_idx on public.care_links (doctor_id, patient_id);

drop policy if exists "Assigned doctors can read patient profiles" on public.patient_profiles;
create policy "Assigned doctors can read patient profiles"
on public.patient_profiles for select to authenticated
using (exists (select 1 from public.care_links
              where patient_id = user_id and doctor_id = (select auth.uid())));

create table if not exists public.vital_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  systolic integer not null check (systolic between 50 and 300),
  diastolic integer not null check (diastolic between 30 and 200),
  spo2 integer not null check (spo2 between 50 and 100),
  heart_rate integer not null check (heart_rate between 25 and 250),
  source text not null default 'manual' check (source in ('manual', 'device')),
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (systolic > diastolic)
);
alter table public.vital_readings enable row level security;
grant select, insert on public.vital_readings to authenticated;
drop policy if exists "Patients and assigned doctors read vitals" on public.vital_readings;
drop policy if exists "Patients add own manual readings" on public.vital_readings;
create policy "Patients and assigned doctors read vitals"
on public.vital_readings for select to authenticated
using (
  patient_id = (select auth.uid())
  or exists (select 1 from public.care_links
             where patient_id = vital_readings.patient_id
               and doctor_id = (select auth.uid()))
);
create policy "Patients add own manual readings"
on public.vital_readings for insert to authenticated
with check (patient_id = (select auth.uid()) and source = 'manual');
create index if not exists vital_readings_patient_time_idx
on public.vital_readings (patient_id, measured_at desc);

-- The SOS alert is delivered to a linked doctor's in-app monitor only.
alter table public.emergency_events add column if not exists vital_snapshot jsonb not null default '{}'::jsonb;
alter table public.emergency_events drop column if exists simulated_vitals;
alter table public.emergency_events drop column if exists demo_recipients;
drop policy if exists "Patients insert own SOS events" on public.emergency_events;
drop policy if exists "Patients and doctors read SOS events" on public.emergency_events;
create policy "Patients insert own SOS events"
on public.emergency_events for insert to authenticated
with check (
  patient_id = (select auth.uid())
  and event_type = 'sos'
  and exists (select 1 from public.care_links
              where patient_id = (select auth.uid()))
);
create policy "Patients and linked doctors read SOS events"
on public.emergency_events for select to authenticated
using (
  patient_id = (select auth.uid())
  or exists (select 1 from public.care_links
             where patient_id = emergency_events.patient_id
               and doctor_id = (select auth.uid()))
);
