import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { resolvePortalAccess, rolePath, pendingNotice } from '@/lib/portal-access';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, ArrowRight, Mail } from 'lucide-react';

const registration = z.object({
  full_name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(255), password: z.string().min(6).max(128),
  role: z.enum(['student', 'recruiter', 'tutor']), roll_number: z.string().trim().max(50), branch: z.string().trim().max(100), cgpa: z.string(),
}).superRefine((value, ctx) => {
  if (value.role !== 'student') return;
  if (!value.roll_number || !value.branch || !value.cgpa || !Number.isFinite(Number(value.cgpa)) || Number(value.cgpa) < 0 || Number(value.cgpa) > 10)
    ctx.addIssue({ code: 'custom', message: 'Enter a roll number, branch, and CGPA between 0 and 10.' });
});

export const Route = createFileRoute('/auth')({ head: () => ({ meta: [{ title: 'Sign in | Student Placement Portal' }, { name: 'description', content: 'Sign in or request access to your student placement workspace.' }, { property: 'og:title', content: 'Sign in | Student Placement Portal' }, { property: 'og:description', content: 'Sign in or request access to your student placement workspace.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }), component: Auth });
function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin'|'signup'|'magic'|'forgot'>('signin');
  const [role, setRole] = useState<'student'|'recruiter'|'tutor'>('student');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [roll, setRoll] = useState(''); const [branch, setBranch] = useState(''); const [cgpa, setCgpa] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function goHome() {
    try {
      const access = await resolvePortalAccess();
      if (!access.role) return;
      if (access.pending && access.role !== 'super_admin') { setMessage(access.user?.user_metadata?.['role'] === 'tutor' || access.role === 'tutor' ? pendingNotice : 'Your access request is pending administrator approval.'); return; }
      navigate({ to: rolePath(access.role) as '/student', replace: true });
    } catch { setMessage('Unable to check account access. Please try again.'); }
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const confirmation = params.get('flow') === 'confirm' || hash.get('type') === 'signup';
    if (confirmation) {
      // The confirmation callback can carry a session. End it so the user lands on sign-in.
      void supabase.auth.getSession().then(async () => {
        await supabase.auth.signOut();
        window.history.replaceState(null, '', '/auth');
        setMode('signin'); setMessage('Email verified. Sign in to continue.');
      });
      return;
    }
    void goHome();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN') setTimeout(() => { void goHome(); }, 0);
    });
    return () => subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'magic' || mode === 'forgot') {
        const result = z.string().trim().email().max(255).safeParse(email);
        if (!result.success) setMessage('Enter a valid email address.');
        else if (mode === 'forgot') {
          const { error } = await supabase.auth.resetPasswordForEmail(result.data, { redirectTo: window.location.origin + '/reset-password' });
          setMessage(error?.message || 'If an account exists, a password reset link is on its way.');
        } else {
          const { error } = await supabase.auth.signInWithOtp({ email: result.data, options: { emailRedirectTo: window.location.origin + '/auth' } });
          setMessage(error?.message || 'Check your email for a sign-in link.');
        }
      } else if (mode === 'signup') {
        const result = registration.safeParse({ email, password, full_name: name, role, roll_number: roll, branch, cgpa });
        if (!result.success) setMessage(result.error.issues[0]?.message || 'Check your registration details.');
        else {
          const { data, error } = await supabase.auth.signUp({ email: result.data.email, password: result.data.password, options: { emailRedirectTo: window.location.origin + '/auth?flow=confirm', data: { full_name: result.data.full_name, role: result.data.role, roll_number: result.data.role === 'student' ? result.data.roll_number : null, branch: result.data.role === 'student' ? result.data.branch : null, cgpa: result.data.role === 'student' ? Number(result.data.cgpa) : null } } });
          setMessage(error?.message || (data.session ? 'Account created. Redirecting…' : role === 'student' ? 'Check your email to confirm your account. Then sign in.' : 'Check your email to confirm your account. Your access request then awaits approval.'));
          if (data.session) await goHome();
          else if (!error) setMode('signin');
        }
      } else {
        const result = z.object({ email: z.string().trim().email().max(255), password: z.string().min(1).max(128) }).safeParse({ email, password });
        if (!result.success) setMessage('Enter a valid email address and password.');
        else {
          const { error } = await supabase.auth.signInWithPassword(result.data);
          if (error) setMessage(error.message === 'Invalid login credentials' ? 'Invalid email or password. Use Forgot password to set a new one.' : error.message);
          else await goHome();
        }
      }
    } catch { setMessage('Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  async function google() { setBusy(true); setMessage(''); const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin + '/auth' }); if (result.error) setMessage(result.error.message); else if (!result.redirected) await goHome(); setBusy(false); }
  function switchMode(next: typeof mode) { setMode(next); setMessage(''); }
  return <div className="flex min-h-screen bg-background"><div className="relative hidden w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex"><div className="flex items-center gap-3 font-semibold"><GraduationCap className="h-7 w-7"/>Student Placement Portal</div><div><p className="text-xs font-bold uppercase text-primary-foreground/70">A clearer path forward</p><h1 className="mt-5 max-w-lg text-5xl font-semibold leading-tight">Where potential meets opportunity.</h1><p className="mt-6 max-w-md text-primary-foreground/75">One place for students, recruiters and colleges to move every placement forward.</p></div><p className="text-sm text-primary-foreground/60">Your next chapter starts here.</p></div><div className="flex w-full flex-col justify-center px-6 py-10 sm:px-14 lg:w-1/2"><div className="mx-auto w-full max-w-sm"><div className="mb-12 flex items-center gap-2 font-semibold lg:hidden"><GraduationCap className="h-6 w-6 text-primary"/>Student Placement Portal</div><div className="mb-8"><p className="mb-2 text-xs font-bold uppercase text-primary">Placement workspace</p><h2 className="text-3xl font-semibold">{mode === 'signup' ? 'Create your account' : mode === 'magic' ? 'Sign in with a link' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'}</h2><p className="mt-2 text-sm text-muted-foreground">{mode === 'signup' ? 'Get started with your placement journey.' : mode === 'forgot' ? 'Enter your email to receive a reset link.' : 'Sign in to continue to your workspace.'}</p></div><form className="space-y-4" onSubmit={submit}>{mode === 'signup' && <><label className="block space-y-2 text-sm font-medium">Full name<Input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"/></label><div className="space-y-2 text-sm font-medium"><label htmlFor="account-role">Role</label><Select value={role} onValueChange={v => setRole(v as typeof role)}><SelectTrigger id="account-role"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="recruiter">Recruiter</SelectItem><SelectItem value="tutor">Tutor</SelectItem></SelectContent></Select></div>{role === 'student' && <><label className="block space-y-2 text-sm font-medium">Roll number<Input required maxLength={50} value={roll} onChange={e => setRoll(e.target.value)}/></label><label className="block space-y-2 text-sm font-medium">Branch<Input required maxLength={100} value={branch} onChange={e => setBranch(e.target.value)}/></label><label className="block space-y-2 text-sm font-medium">CGPA<Input required type="number" min="0" max="10" step="0.01" value={cgpa} onChange={e => setCgpa(e.target.value)}/></label></>}</>}<label className="block space-y-2 text-sm font-medium">Email address<Input required type="email" maxLength={255} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>{mode !== 'magic' && mode !== 'forgot' && <label className="block space-y-2 text-sm font-medium">Password<Input required minLength={mode === 'signup' ? 6 : 1} maxLength={128} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"/></label>}{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}<Button type="submit" className="w-full" disabled={busy}>{mode === 'signup' ? 'Create account' : mode === 'magic' ? 'Send magic link' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}<ArrowRight className="ml-2 h-4 w-4"/></Button></form>{mode !== 'forgot' && <><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border"/>or continue with<div className="h-px flex-1 bg-border"/></div><Button variant="outline" className="w-full gap-3" disabled={busy} onClick={google}><span className="font-bold text-primary">G</span>Sign in with Google</Button></>}<div className="mt-8 space-y-3 text-center text-sm">{mode === 'signin' && <Button variant="link" className="w-full" onClick={() => switchMode('forgot')}>Forgot password?</Button>}{mode !== 'magic' && mode !== 'forgot' && <Button variant="link" className="w-full gap-2" onClick={() => switchMode('magic')}><Mail className="h-4 w-4"/>Use a magic link instead</Button>}<p className="text-muted-foreground">{mode === 'signin' ? 'New here?' : 'Already have an account?'} <Button variant="link" className="px-1" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</Button></p></div></div></div></div>;
}
