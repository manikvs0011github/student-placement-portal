import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GraduationCap } from 'lucide-react';

export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [
    { title: 'Reset password | Student Placement Portal' },
    { name: 'description', content: 'Set a new password for your Student Placement Portal account.' },
    { property: 'og:title', content: 'Reset password | Student Placement Portal' },
    { property: 'og:description', content: 'Set a new password for your Student Placement Portal account.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const failure = url.searchParams.get('error_description') || hash.get('error_description');
    const recoveryLink = url.searchParams.get('type') === 'recovery' || hash.get('type') === 'recovery';
    if (failure) { setMessage(decodeURIComponent(failure.replace(/\+/g, ' '))); setChecking(false); return; }
    const check = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      setReady(recoveryLink && !!data.session && !error);
      setChecking(false);
      if (!recoveryLink || !data.session || error) setMessage('This reset link has expired or is invalid. Request a new one below.');
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && active) { setReady(!!session); setChecking(false); setMessage(''); }
    });
    void check();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const valid = z.string().min(8, 'Use at least 8 characters.').max(128).safeParse(password);
    if (!valid.success) { setMessage(valid.error.issues[0]?.message || 'Choose a longer password.'); return; }
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setMessage(error.message); setBusy(false); return; }
    await supabase.auth.signOut();
    navigate({ to: '/auth', replace: true });
  }

  return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
    <div className="w-full max-w-sm">
      <div className="mb-10 flex items-center gap-2 font-semibold"><GraduationCap className="h-6 w-6 text-primary"/>Student Placement Portal</div>
      <p className="mb-2 text-xs font-bold uppercase text-primary">Account recovery</p>
      <h1 className="text-3xl font-semibold">Set a new password</h1>
      {checking ? <p className="mt-6 text-sm text-muted-foreground">Checking your reset link…</p> : ready ?
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block space-y-2 text-sm font-medium">New password<Input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
          <label className="block space-y-2 text-sm font-medium">Confirm new password<Input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}/></label>
          {message && <p role="status" className="text-sm text-destructive">{message}</p>}
          <Button type="submit" disabled={busy} className="w-full">Save new password</Button>
        </form> : <p role="status" className="mt-6 text-sm text-destructive">{message}</p>}
      <Button asChild variant="link" className="mt-5 px-0"><Link to="/auth">{ready ? 'Back to sign in' : 'Request a new reset link'}</Link></Button>
    </div>
  </main>;
}
