create or replace function private.validate_application() returns trigger language plpgsql security definer set search_path = public as $$
declare minimum numeric; student_cgpa numeric;
begin
 if not private.has_role(new.student_id, 'student') or new.student_id <> auth.uid() then raise exception 'Only students can apply for jobs'; end if;
 if exists (select 1 from public.role_requests where user_id = new.student_id) then raise exception 'Access request pending approval'; end if;
 select min_cgpa into minimum from public.jobs where id = new.job_id;
 select cgpa into student_cgpa from public.profiles where id = new.student_id;
 if student_cgpa is null or student_cgpa < minimum then raise exception 'CGPA requirement not met'; end if;
 return new;
end $$;