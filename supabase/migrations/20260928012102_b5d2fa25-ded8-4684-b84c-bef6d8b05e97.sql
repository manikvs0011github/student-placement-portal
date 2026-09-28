alter table public.profiles add column is_approved boolean not null default false;
alter table public.profiles add column updated_at timestamptz not null default now();
create or replace function private.touch_profile() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
create trigger touch_profile_before_update before update on public.profiles for each row execute function private.touch_profile();
create table public.role_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 requested_role public.app_role not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint only_portal_roles check (requested_role in ('recruiter', 'tutor'))
);
grant select on public.role_requests to authenticated;
grant all on public.role_requests to service_role;
alter table public.role_requests enable row level security;
create policy "Users see own request" on public.role_requests for select to authenticated using (user_id = auth.uid());
create trigger touch_role_request_before_update before update on public.role_requests for each row execute function private.touch_profile();
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare requested text := new.raw_user_meta_data->>'role'; academic numeric;
begin
 if requested = 'student' then
  begin academic := (new.raw_user_meta_data->>'cgpa')::numeric; exception when others then academic := null; end;
 else academic := null; end if;
 insert into public.profiles (id, full_name, roll_number, branch, cgpa)
 values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 100),
 case when requested = 'student' then left(new.raw_user_meta_data->>'roll_number', 50) else null end,
 case when requested = 'student' then left(new.raw_user_meta_data->>'branch', 100) else null end,
 case when academic between 0 and 10 then academic else 0 end);
 insert into public.user_roles (user_id, role) values (new.id, 'student');
 if requested in ('recruiter', 'tutor') then insert into public.role_requests(user_id, requested_role) values (new.id, requested::public.app_role); end if;
 return new;
end $$;
create or replace function private.is_verified_super_admin(_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$
 select exists (select 1 from auth.users u where u.id = _user_id and u.email_confirmed_at is not null and lower(u.email) in ('superadmin@college.edu', 'manikvs0011@gmail.com'))
$$;
revoke all on function private.is_verified_super_admin(uuid) from public, anon;
grant execute on function private.is_verified_super_admin(uuid) to authenticated;
create or replace function private.is_approved_tutor(_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.profiles where id = _user_id and is_approved) and private.has_role(_user_id, 'tutor') $$;
revoke all on function private.is_approved_tutor(uuid) from public, anon;
grant execute on function private.is_approved_tutor(uuid) to authenticated;
create policy "Verified super admins read all profiles" on public.profiles for select to authenticated using (private.is_verified_super_admin(auth.uid()));
create policy "Verified super admins read all roles" on public.user_roles for select to authenticated using (private.is_verified_super_admin(auth.uid()));
create policy "Verified super admins read role requests" on public.role_requests for select to authenticated using (private.is_verified_super_admin(auth.uid()));
create policy "Tutors read student profiles" on public.profiles for select to authenticated using (private.is_approved_tutor(auth.uid()) and private.has_role(profiles.id, 'student'));
create policy "Tutors read student roles" on public.user_roles for select to authenticated using (private.is_approved_tutor(auth.uid()) and role = 'student');
create policy "Tutors read applications" on public.applications for select to authenticated using (private.is_approved_tutor(auth.uid()));
create policy "Verified super admins read applications" on public.applications for select to authenticated using (private.is_verified_super_admin(auth.uid()));
create or replace function public.approve_portal_request(_user_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare desired public.app_role;
begin
 if not private.is_verified_super_admin(auth.uid()) then raise exception 'Not authorized'; end if;
 select requested_role into desired from public.role_requests where user_id = _user_id for update;
 if desired is null then raise exception 'No pending request'; end if;
 insert into public.user_roles (user_id, role) values (_user_id, desired) on conflict (user_id, role) do nothing;
 delete from public.user_roles where user_id = _user_id and role = 'student';
 update public.profiles set is_approved = true where id = _user_id;
 delete from public.role_requests where user_id = _user_id;
end $$;
revoke all on function public.approve_portal_request(uuid) from public, anon;
grant execute on function public.approve_portal_request(uuid) to authenticated;