import { supabase } from '@/integrations/supabase/client';

export type PortalRole = 'student' | 'recruiter' | 'tutor' | 'admin' | 'super_admin';
export const pendingNotice = 'Your administrator access is pending Super Admin validation.';
export async function resolvePortalAccess() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { role: null, pending: false, user: null };
  const [roles, profile, requests] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase.from('profiles').select('is_approved').eq('id', user.id).maybeSingle(),
    supabase.from('role_requests').select('requested_role').eq('user_id', user.id).maybeSingle(),
  ]);
  if (roles.error || profile.error || requests.error) throw new Error(roles.error?.message || profile.error?.message || requests.error?.message);
  const pending = !!requests.data || (roles.data?.some(r => r.role === 'tutor') && !profile.data?.is_approved);
  const designated = !!user.email_confirmed_at && (['superadmin@college.edu', 'manikvs0011@gmail.com'].includes(user.email?.toLowerCase() || '') || (user.email?.toLowerCase() === 'manikanta0615@gmail.com' && !!roles.data?.some(r => r.role === 'super_admin')));
  const role: PortalRole = designated ? 'super_admin' : roles.data?.some(r => r.role === 'admin') ? 'admin' : roles.data?.some(r => r.role === 'tutor') ? 'tutor' : roles.data?.some(r => r.role === 'recruiter') ? 'recruiter' : 'student';
  return { role, pending, user };
}
export function rolePath(role: PortalRole) { return role === 'super_admin' ? '/admin/approvals' : role === 'admin' || role === 'tutor' ? '/dashboard/admin' : `/dashboard/${role}`; }
