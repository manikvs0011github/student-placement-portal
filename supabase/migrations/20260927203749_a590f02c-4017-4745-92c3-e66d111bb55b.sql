create type public.app_role as enum ('admin', 'recruiter', 'student');
create type public.application_status as enum ('applied', 'shortlisted', 'interviewing', 'selected', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  roll_number text,
  branch text,
  cgpa numeric(3,2) default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Admins read all profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Recruiters read all profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'recruiter'));

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid references auth.users(id) on delete cascade not null,
  company_name text not null,
  title text not null,
  description text not null,
  min_cgpa numeric(3,2) not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "Authenticated read jobs" on public.jobs for select to authenticated using (true);
create policy "Recruiters insert jobs" on public.jobs for insert to authenticated with check (public.has_role(auth.uid(), 'recruiter') and recruiter_id = auth.uid());
create policy "Recruiters update own jobs" on public.jobs for update to authenticated using (recruiter_id = auth.uid());
create policy "Recruiters delete own jobs" on public.jobs for delete to authenticated using (recruiter_id = auth.uid());

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade not null,
  student_id uuid references auth.users(id) on delete cascade not null,
  status application_status not null default 'applied',
  created_at timestamptz not null default now(),
  unique (job_id, student_id)
);
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "Students read own applications" on public.applications for select to authenticated using (student_id = auth.uid());
create policy "Students insert own applications" on public.applications for insert to authenticated with check (student_id = auth.uid());
create policy "Recruiters read applications to own jobs" on public.applications for select to authenticated using (exists (select 1 from public.jobs j where j.id = job_id and j.recruiter_id = auth.uid()));
create policy "Recruiters update applications to own jobs" on public.applications for update to authenticated using (exists (select 1 from public.jobs j where j.id = job_id and j.recruiter_id = auth.uid()));
create policy "Admins read all applications" on public.applications for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.applications;