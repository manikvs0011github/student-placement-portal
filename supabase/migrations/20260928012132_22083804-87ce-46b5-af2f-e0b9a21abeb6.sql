create or replace function private.approve_portal_request(_user_id uuid) returns void language plpgsql security definer set search_path = public as $$
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
revoke all on function private.approve_portal_request(uuid) from public, anon;
grant execute on function private.approve_portal_request(uuid) to authenticated;
create or replace function public.approve_portal_request(_user_id uuid) returns void language sql security invoker set search_path = public as $$ select private.approve_portal_request(_user_id) $$;