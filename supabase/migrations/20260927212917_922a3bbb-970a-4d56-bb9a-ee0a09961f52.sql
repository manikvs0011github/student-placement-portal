create policy "Admins read all roles" on public.user_roles for select to authenticated using (private.has_role(auth.uid(), 'admin'));
alter policy "Recruiters update own jobs" on public.jobs with check (recruiter_id = auth.uid());
alter policy "Recruiters update applications to own jobs" on public.applications with check (exists (select 1 from public.jobs j where j.id = job_id and j.recruiter_id = auth.uid()));
create or replace function private.lock_application_identity() returns trigger language plpgsql set search_path = public as $$
begin
 if new.student_id is distinct from old.student_id or new.job_id is distinct from old.job_id then raise exception 'Application identity cannot be changed'; end if;
 return new;
end $$;
revoke all on function private.lock_application_identity() from public, anon, authenticated;
create trigger lock_application_identity_before_update before update on public.applications for each row execute function private.lock_application_identity();