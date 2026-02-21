# Auth DB Integrity Runbook

## Goal
Verify every authenticated user has the minimum auth graph required by the app:
- `profiles` row
- at least one `user_roles` row
- `clients` row for users with `client` role
- `on_auth_user_created` trigger exists
- `clients_onboarding_submit_approval` trigger exists and fires on insert/update

## Read-only Integrity Checks
Run these first in staging, then production.

```sql
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

select u.id
from auth.users u
left join public.user_roles r on r.user_id = u.id
where r.user_id is null;

select u.id
from auth.users u
left join public.clients c on c.user_id = u.id
where c.user_id is null;

select tgname
from pg_trigger
where tgname = 'on_auth_user_created';

select tgname, tgenabled
from pg_trigger
where tgname = 'on_auth_user_created';

select
  tgname,
  pg_get_triggerdef(oid) as definition
from pg_trigger
where tgname = 'clients_onboarding_submit_approval';

select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in (
    'profiles',
    'clients',
    'approval_requests',
    'user_roles',
    'admin_clients',
    'admin_access_permissions'
  )
order by tablename;
```

## Idempotent Backfill (Only If Needed)
If any check returns rows, run the matching backfill.

```sql
-- 1) Missing profiles
insert into public.profiles (id, full_name, phone)
select
  u.id,
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'phone'), '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 2) Missing roles (default to client)
insert into public.user_roles (user_id, role)
select
  u.id,
  'client'::public.app_role
from auth.users u
left join public.user_roles r on r.user_id = u.id
where r.user_id is null
on conflict (user_id, role) do nothing;

-- 3) Missing client rows for client-role users
insert into public.clients (user_id, company_name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'company_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    p.full_name,
    'New Client'
  ) as company_name
from auth.users u
join public.user_roles ur on ur.user_id = u.id and ur.role = 'client'
left join public.profiles p on p.id = u.id
left join public.clients c on c.user_id = u.id
where c.id is null
on conflict (user_id) do nothing;
```

## Post-Backfill Verification
Re-run all read-only checks. Expected result:
- first three queries return `0` rows
- trigger query returns `on_auth_user_created`
- `on_auth_user_created` is enabled (`tgenabled = 'O'`)
- onboarding trigger definition includes `AFTER INSERT OR UPDATE OF onboarding_completed`
- realtime publication query returns the 6 auth tables listed above

## Operational Notes
- Execute in a controlled window and capture before/after row counts.
- Run in staging first and verify sign-in, onboarding, and pending approval flows before production rollout.
