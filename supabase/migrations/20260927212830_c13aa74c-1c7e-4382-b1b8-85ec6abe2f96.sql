create schema if not exists private;
grant usage on schema private to authenticated;
create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke all on function private.has_role(uuid, public.app_role) from public, anon;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;
alter policy "Admins read all profiles" on public.profiles using (private.has_role(auth.uid(), 'admin'));
alter policy "Recruiters read all profiles" on public.profiles using (private.has_role(auth.uid(), 'recruiter') and exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id where a.student_id = profiles.id and j.recruiter_id = auth.uid()));
alter policy "Recruiters insert jobs" on public.jobs with check (private.has_role(auth.uid(), 'recruiter') and recruiter_id = auth.uid());
alter policy "Admins read all applications" on public.applications using (private.has_role(auth.uid(), 'admin'));
drop function public.has_role(uuid, public.app_role);
create or replace function private.validate_application() returns trigger language plpgsql security definer set search_path = public as $$
declare minimum numeric; student_cgpa numeric;
begin
  if not private.has_role(new.student_id, 'student') or new.student_id <> auth.uid() then raise exception 'Only students can apply for jobs'; end if;
  select min_cgpa into minimum from public.jobs where id = new.job_id;
  select cgpa into student_cgpa from public.profiles where id = new.student_id;
  if student_cgpa is null or student_cgpa < minimum then raise exception 'CGPA requirement not met'; end if;
  return new;
end $$;
revoke all on function private.validate_application() from public, anon, authenticated;
create trigger validate_application_before_insert before insert on public.applications for each row execute function private.validate_application();
revoke all on function public.handle_new_user() from public, anon, authenticated;