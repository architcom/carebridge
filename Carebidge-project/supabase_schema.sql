-- Run this in the SQL Editor of the selected Supabase project.
-- Passwords stay in Supabase Auth (auth.users.encrypted_password), never in this public table.

create table if not exists public.login_accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  updated_at timestamptz not null default now()
);

alter table public.login_accounts enable row level security;

grant select, insert, update on public.login_accounts to authenticated;

drop policy if exists "Users can read their own account" on public.login_accounts;
drop policy if exists "Users can insert their own account" on public.login_accounts;
drop policy if exists "Users can update their own account" on public.login_accounts;

create policy "Users can read their own account"
on public.login_accounts for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can insert their own account"
on public.login_accounts for insert
to authenticated
with check (
  (select auth.uid()) = id
  and email = (select auth.jwt() ->> 'email')
);

create policy "Users can update their own account"
on public.login_accounts for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and email = (select auth.jwt() ->> 'email')
);

-- Supabase Auth inserts this row as soon as a user registers.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.sync_login_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.login_accounts (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

revoke all on function private.sync_login_account() from public;

drop trigger if exists sync_login_account on auth.users;
create trigger sync_login_account
after insert or update of email on auth.users
for each row when (new.email is not null)
execute function private.sync_login_account();

-- Include accounts that existed before this trigger was installed.
insert into public.login_accounts (id, email)
select id, email from auth.users where email is not null
on conflict (id) do update
set email = excluded.email, updated_at = now();
