import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { BriefcaseBusiness, LayoutDashboard, ClipboardList, UserRound, LogOut, Menu, X, Plus, Users, ChartNoAxesCombined, ArrowUpRight, GraduationCap, Building2, CheckCircle2, Clock3 } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQueryClient } from '@tanstack/react-query';

type Role = 'student' | 'recruiter' | 'admin';
type Status = 'applied' | 'shortlisted' | 'interviewing' | 'selected' | 'rejected';
type Profile = { id: string; full_name: string | null; roll_number: string | null; branch: string | null; cgpa: number | null };
type Job = { id: string; recruiter_id: string; company_name: string; title: string; description: string; min_cgpa: number; created_at: string };
type Application = { id: string; job_id: string; student_id: string; status: Status; created_at: string };
const statuses: Status[] = ['applied', 'shortlisted', 'interviewing', 'selected', 'rejected'];
const nav = {
  student: [{ to: '/student', label: 'Overview', icon: LayoutDashboard }, { to: '/student/jobs', label: 'Job board', icon: BriefcaseBusiness }, { to: '/student/applications', label: 'Applications', icon: ClipboardList }, { to: '/student/profile', label: 'My profile', icon: UserRound }],
  recruiter: [{ to: '/recruiter', label: 'Overview', icon: LayoutDashboard }, { to: '/recruiter/post', label: 'Post a job', icon: Plus }, { to: '/recruiter/applications', label: 'Manage applications', icon: ClipboardList }],
  admin: [{ to: '/admin', label: 'Overview', icon: LayoutDashboard }, { to: '/admin/students', label: 'Students', icon: Users }],
};
const home = (role: Role) => `/${role}`;
const title: Record<string, string> = { overview: 'Overview', jobs: 'Job board', applications: 'Applications', profile: 'My profile', post: 'Post a job', students: 'Students' };
function initials(s: string) { return s.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || 'SP'; }
function formatStatus(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function StatusPill({ status }: { status: Status }) { return <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-medium ${status === 'selected' ? 'bg-chart-2/15 text-chart-2' : status === 'rejected' ? 'bg-destructive/10 text-destructive' : status === 'interviewing' ? 'bg-chart-1/15 text-chart-1' : 'bg-secondary text-secondary-foreground'}`}>{formatStatus(status)}</span>; }
function Empty({ icon: Icon, title, body, action }: { icon: typeof BriefcaseBusiness; title: string; body: string; action?: React.ReactNode }) { return <div className="flex min-h-56 flex-col items-center justify-center border border-dashed border-border bg-card p-8 text-center"><Icon className="mb-4 h-8 w-8 text-muted-foreground"/><p className="font-semibold">{title}</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>{action && <div className="mt-5">{action}</div>}</div>; }
function Metric({ label, value, icon: Icon, detail }: {label: string; value: string | number; icon: typeof BriefcaseBusiness; detail?: string}) { return <div className="border border-border bg-card p-5"><div className="flex items-start justify-between"><p className="text-sm font-medium text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-5 text-3xl font-semibold">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail || 'Current overview'}</p></div>; }

export function Portal({ role: routeRole, page }: { role: Role; page: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', roll_number: '', branch: '', cgpa: '' });
  const [jobForm, setJobForm] = useState({ company_name: '', title: '', description: '', min_cgpa: '' });
  const refresh = async (id: string, actualRole: Role) => {
    const [p, j, a, s] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('applications').select('*').order('created_at', { ascending: false }),
      actualRole === 'admin' || actualRole === 'recruiter' ? supabase.from('profiles').select('*').order('full_name') : Promise.resolve({ data: [] as Profile[], error: null }),
    ]);
    const error = p.error || j.error || a.error || s.error;
    if (error) setMessage(error.message);
    setProfile(p.data as Profile | null);
    setJobs((j.data || []) as Job[]);
    setApplications((a.data || []) as Application[]);
    setStudents((s.data || []) as Profile[]);
  };
  useEffect(() => {
    let live = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!live) return;
      if (!user) { navigate({ to: '/auth', replace: true }); return; }
      const { data: roles, error } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      if (!live) return;
      if (error) { setMessage(error.message); setLoading(false); return; }
      const actualRole: Role = roles?.some(r => r.role === 'admin') ? 'admin' : roles?.some(r => r.role === 'recruiter') ? 'recruiter' : 'student';
      if (actualRole !== routeRole) { navigate({ to: home(actualRole) as '/student', replace: true }); return; }
      setRole(actualRole); setUserId(user.id); setEmail(user.email || '');
      await refresh(user.id, actualRole);
      if (live) setLoading(false);
    };
    load();
    return () => { live = false; };
  }, [routeRole, navigate]);
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`placement-applications-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => { if (role) refresh(userId, role); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, role]);
  useEffect(() => { if (profile) setForm({ full_name: profile.full_name || '', roll_number: profile.roll_number || '', branch: profile.branch || '', cgpa: String(profile.cgpa ?? '') }); }, [profile]);
  const myJobs = jobs.filter(j => j.recruiter_id === userId);
  const myApps = applications.filter(a => a.student_id === userId);
  const recruiterApps = applications.filter(a => myJobs.some(j => j.id === a.job_id));
  const completeness = profile ? [profile.full_name, profile.roll_number, profile.branch, profile.cgpa && profile.cgpa > 0].filter(Boolean).length * 25 : 0;
  const stats = useMemo(() => {
    const branches = [...new Set(students.map(s => s.branch || 'Unspecified'))];
    return branches.map(branch => ({ branch, selected: students.filter(s => (s.branch || 'Unspecified') === branch && applications.some(a => a.student_id === s.id && a.status === 'selected')).length, pending: students.filter(s => (s.branch || 'Unspecified') === branch && !applications.some(a => a.student_id === s.id && a.status === 'selected')).length }));
  }, [students, applications]);
  async function signOut() { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: '/auth', replace: true }); }
  async function apply(job: Job) {
    if (!profile?.cgpa || Number(profile.cgpa) < Number(job.min_cgpa)) { setMessage('Your CGPA does not meet this job’s requirement.'); return; }
    setBusy(true); setMessage('');
    const { error } = await supabase.from('applications').insert({ job_id: job.id, student_id: userId });
    setMessage(error ? error.message : 'Application submitted successfully.');
    if (!error && role) await refresh(userId, role);
    setBusy(false);
  }
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    const cgpa = Number(form.cgpa);
    if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) { setMessage('CGPA must be between 0 and 10.'); setBusy(false); return; }
    const { error } = await supabase.from('profiles').update({ full_name: form.full_name.trim(), roll_number: form.roll_number.trim(), branch: form.branch.trim(), cgpa }).eq('id', userId);
    setMessage(error ? error.message : 'Profile saved.'); if (!error && role) await refresh(userId, role); setBusy(false);
  }
  async function postJob(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    const min_cgpa = Number(jobForm.min_cgpa);
    if (!Number.isFinite(min_cgpa) || min_cgpa < 0 || min_cgpa > 10) { setMessage('Minimum CGPA must be between 0 and 10.'); setBusy(false); return; }
    const { error } = await supabase.from('jobs').insert({ recruiter_id: userId, company_name: jobForm.company_name.trim(), title: jobForm.title.trim(), description: jobForm.description.trim(), min_cgpa });
    setMessage(error ? error.message : 'Job published successfully.');
    if (!error && role) { setJobForm({ company_name: '', title: '', description: '', min_cgpa: '' }); await refresh(userId, role); }
    setBusy(false);
  }
  async function changeStatus(id: string, status: Status) {
    setMessage(''); const { error } = await supabase.from('applications').update({ status }).eq('id', id);
    if (error) setMessage(error.message); else if (role) await refresh(userId, role);
  }
  if (loading || !role) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"/>Loading your workspace</div></div>;
  const currentNav = nav[role];
  return <div className="min-h-screen bg-background text-foreground md:flex">
    <aside className={`${mobileOpen ? 'flex' : 'hidden'} fixed inset-0 z-30 w-full flex-col border-r border-sidebar-border bg-sidebar p-5 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0`}>
      <div className="flex items-center justify-between gap-2 px-2"><Link to={home(role) as '/student'} className="flex items-center gap-2.5 font-semibold"><span className="flex h-9 w-9 items-center justify-center bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5"/></span><span className="leading-tight">Placement<span className="block text-xs font-normal text-muted-foreground">Portal</span></span></Link><Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5"/></Button></div>
      <div className="mt-10 px-3 text-[11px] font-semibold uppercase text-muted-foreground">Workspace</div>
      <nav className="mt-3 flex flex-col gap-1">{currentNav.map(item => <Link key={item.to} to={item.to as '/student'} onClick={() => setMobileOpen(false)} activeOptions={{ exact: true }} activeProps={{ className: 'bg-primary text-primary-foreground' }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><item.icon className="h-4 w-4"/>{item.label}</Link>)}</nav>
      <div className="mt-auto border-t border-sidebar-border pt-5"><div className="flex items-center gap-3 px-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center bg-secondary text-xs font-bold text-secondary-foreground">{initials(profile?.full_name || email)}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{profile?.full_name || email.split('@')[0]}</p><p className="text-xs capitalize text-muted-foreground">{role}</p></div></div><Button variant="ghost" className="mt-4 w-full justify-start gap-3 text-muted-foreground" onClick={signOut}><LogOut className="h-4 w-4"/>Sign out</Button></div>
    </aside>
    <main className="min-w-0 flex-1"><header className="flex h-16 items-center justify-between border-b border-border px-5 md:px-9"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5"/></Button><span className="text-sm text-muted-foreground capitalize">{role} workspace</span><span className="text-muted-foreground">/</span><span className="text-sm font-semibold">{title[page]}</span></div><span className="hidden text-sm text-muted-foreground sm:block">{email}</span></header>
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-9 md:py-10"><div className="mb-8"><p className="mb-2 text-xs font-bold uppercase text-primary">{role === 'student' ? 'Your placement journey' : role === 'recruiter' ? 'Talent acquisition' : 'Campus intelligence'}</p><h1 className="text-3xl font-semibold md:text-4xl">{page === 'overview' ? `Good to see you, ${(profile?.full_name || email.split('@')[0]).split(' ')[0]}.` : title[page]}</h1><p className="mt-2 text-sm text-muted-foreground">{page === 'overview' ? 'Here’s what’s happening across your workspace.' : page === 'jobs' ? 'Discover opportunities that match your ambitions.' : page === 'profile' ? 'Keep your details up to date for the right opportunities.' : page === 'post' ? 'Share your next opportunity with students.' : page === 'students' ? 'Track student placement progress across departments.' : 'Stay on top of every application.'}</p></div>
      {message && <div role="status" className="mb-6 flex items-center justify-between border border-border bg-secondary px-4 py-3 text-sm"><span>{message}</span><Button size="icon" variant="ghost" onClick={() => setMessage('')} aria-label="Dismiss message"><X className="h-4 w-4"/></Button></div>}
      {role === 'student' && page === 'overview' && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Applications sent" value={myApps.length} icon={ClipboardList} detail="Across all opportunities"/><Metric label="Upcoming interviews" value={myApps.filter(a => a.status === 'interviewing').length} icon={Clock3} detail="Applications in interviewing"/><Metric label="Profile completeness" value={`${completeness}%`} icon={UserRound} detail="Complete your profile to stand out"/></div><div className="mt-9 grid gap-9 lg:grid-cols-[1.3fr_1fr]"><section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent opportunities</h2><Link to="/student/jobs" className="flex items-center gap-1 text-sm font-medium text-primary">View all <ArrowUpRight className="h-4 w-4"/></Link></div>{jobs.length ? jobs.slice(0, 3).map(j => <div key={j.id} className="flex items-center justify-between gap-4 border-b border-border py-4"><div><p className="font-medium">{j.title}</p><p className="text-sm text-muted-foreground">{j.company_name} · Min. {j.min_cgpa} CGPA</p></div><Link to="/student/jobs" className="text-sm font-medium text-primary">Explore</Link></div>) : <Empty icon={BriefcaseBusiness} title="No open jobs yet" body="New opportunities will appear here when recruiters post them."/>}</section><section><h2 className="mb-4 text-lg font-semibold">Your profile</h2><div className="border border-border bg-card p-5"><div className="flex justify-between text-sm"><span>Completion</span><strong>{completeness}%</strong></div><Progress value={completeness} className="mt-3"/><p className="mt-5 text-sm text-muted-foreground">A complete profile helps recruiters understand your qualifications.</p><Button asChild variant="outline" className="mt-5"><Link to="/student/profile">Edit profile</Link></Button></div></section></div></>}
      {role === 'student' && page === 'jobs' && (jobs.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{jobs.map(j => { const applied = myApps.some(a => a.job_id === j.id); const eligible = Number(profile?.cgpa || 0) >= Number(j.min_cgpa); return <article key={j.id} className="flex flex-col border border-border bg-card p-6"><div className="mb-5 flex h-10 w-10 items-center justify-center bg-secondary"><Building2 className="h-5 w-5 text-primary"/></div><p className="text-xs font-semibold uppercase text-primary">{j.company_name}</p><h2 className="mt-2 text-lg font-semibold">{j.title}</h2><p className="mt-3 line-clamp-4 flex-1 text-sm leading-6 text-muted-foreground">{j.description}</p><div className="mt-6 flex items-center justify-between border-t border-border pt-4"><span className="text-xs text-muted-foreground">Min. {j.min_cgpa} CGPA</span><span className={`text-xs font-medium ${eligible ? 'text-chart-2' : 'text-destructive'}`}>{eligible ? 'Eligible' : 'Not eligible'}</span></div><Button className="mt-4 w-full" disabled={applied || !eligible || busy} onClick={() => apply(j)}>{applied ? 'Applied' : eligible ? 'Apply now' : 'CGPA requirement not met'}</Button></article>; })}</div> : <Empty icon={BriefcaseBusiness} title="No jobs posted yet" body="Check back soon for new opportunities."/>)}
      {role === 'student' && page === 'applications' && (myApps.length ? <div className="overflow-x-auto border border-border bg-card"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-secondary text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Position</th><th className="px-5 py-4">Company</th><th className="px-5 py-4">Applied on</th><th className="px-5 py-4">Status</th></tr></thead><tbody>{myApps.map(a => { const j = jobs.find(j => j.id === a.job_id); return <tr key={a.id} className="border-t border-border"><td className="px-5 py-4 font-medium">{j?.title || 'Position'}</td><td className="px-5 py-4 text-muted-foreground">{j?.company_name || '—'}</td><td className="px-5 py-4 text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td><td className="px-5 py-4"><StatusPill status={a.status}/></td></tr>; })}</tbody></table></div> : <Empty icon={ClipboardList} title="No applications yet" body="Explore the job board and apply for a role that fits you." action={<Button asChild><Link to="/student/jobs">Browse jobs</Link></Button>}/>)}
      {role === 'student' && page === 'profile' && <form onSubmit={saveProfile} className="max-w-2xl space-y-6"><div className="grid gap-5 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Full name<Input required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Your full name"/></label><label className="space-y-2 text-sm font-medium">Roll number<Input required value={form.roll_number} onChange={e => setForm({...form, roll_number: e.target.value})} placeholder="e.g. CS2024001"/></label><label className="space-y-2 text-sm font-medium">Branch / department<Input required value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} placeholder="e.g. Computer Science"/></label><label className="space-y-2 text-sm font-medium">CGPA (out of 10)<Input required type="number" min="0" max="10" step="0.01" value={form.cgpa} onChange={e => setForm({...form, cgpa: e.target.value})} placeholder="e.g. 8.50"/></label></div><Button type="submit" disabled={busy}>Save profile</Button></form>}
      {role === 'recruiter' && page === 'overview' && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Active jobs posted" value={myJobs.length} icon={BriefcaseBusiness}/><Metric label="Applications received" value={recruiterApps.length} icon={Users}/><Metric label="Pending reviews" value={recruiterApps.filter(a => a.status === 'applied').length} icon={Clock3}/></div><div className="mt-9 flex items-center justify-between"><h2 className="text-lg font-semibold">Your open positions</h2><Button asChild size="sm"><Link to="/recruiter/post"><Plus className="mr-2 h-4 w-4"/>Post a job</Link></Button></div><div className="mt-4">{myJobs.length ? myJobs.map(j => <div key={j.id} className="flex items-center justify-between gap-4 border-b border-border py-4"><div><p className="font-medium">{j.title}</p><p className="text-sm text-muted-foreground">{j.company_name} · {applications.filter(a => a.job_id === j.id).length} applicants</p></div><span className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleDateString()}</span></div>) : <Empty icon={BriefcaseBusiness} title="No jobs posted yet" body="Create your first job opening to connect with students."/>}</div></>}
      {role === 'recruiter' && page === 'post' && <form onSubmit={postJob} className="max-w-2xl space-y-5"><label className="block space-y-2 text-sm font-medium">Company name<Input required value={jobForm.company_name} onChange={e => setJobForm({...jobForm, company_name: e.target.value})} placeholder="Your organization"/></label><label className="block space-y-2 text-sm font-medium">Job title<Input required value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} placeholder="e.g. Software Engineer"/></label><label className="block space-y-2 text-sm font-medium">Job description<Textarea required rows={6} value={jobForm.description} onChange={e => setJobForm({...jobForm, description: e.target.value})} placeholder="Describe the role and responsibilities"/></label><label className="block max-w-xs space-y-2 text-sm font-medium">Minimum eligibility CGPA<Input required type="number" min="0" max="10" step="0.01" value={jobForm.min_cgpa} onChange={e => setJobForm({...jobForm, min_cgpa: e.target.value})} placeholder="e.g. 7.00"/></label><Button disabled={busy} type="submit"><Plus className="mr-2 h-4 w-4"/>Publish job</Button></form>}
      {role === 'recruiter' && page === 'applications' && (recruiterApps.length ? <div className="overflow-x-auto border border-border bg-card"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-secondary text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Student</th><th className="px-5 py-4">Position</th><th className="px-5 py-4">Branch</th><th className="px-5 py-4">CGPA</th><th className="px-5 py-4">Status</th></tr></thead><tbody>{recruiterApps.map(a => { const s = students.find(s => s.id === a.student_id); const j = jobs.find(j => j.id === a.job_id); return <tr key={a.id} className="border-t border-border"><td className="px-5 py-4 font-medium">{s?.full_name || 'Student'}<span className="block text-xs font-normal text-muted-foreground">{s?.roll_number}</span></td><td className="px-5 py-4">{j?.title || 'Position'}</td><td className="px-5 py-4 text-muted-foreground">{s?.branch || '—'}</td><td className="px-5 py-4">{s?.cgpa ?? '—'}</td><td className="px-5 py-4"><Select value={a.status} onValueChange={(v) => changeStatus(a.id, v as Status)}><SelectTrigger className="w-36"><SelectValue/></SelectTrigger><SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>)}</SelectContent></Select></td></tr>; })}</tbody></table></div> : <Empty icon={ClipboardList} title="No applications received" body="Applications to your posted jobs will appear here."/>)}
      {role === 'admin' && page === 'overview' && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Placement percentage" value={students.length ? `${Math.round(students.filter(s => applications.some(a => a.student_id === s.id && a.status === 'selected')).length / students.length * 100)}%` : '0%'} icon={ChartNoAxesCombined} detail="Students with a selected application"/><Metric label="Visiting companies" value={new Set(jobs.map(j => j.company_name.toLowerCase())).size} icon={Building2}/><Metric label="Registered students" value={students.length} icon={GraduationCap}/></div><div className="mt-9"><h2 className="text-lg font-semibold">Placements by department</h2><p className="mt-1 text-sm text-muted-foreground">Selected and pending students across branches</p><div className="mt-5 h-80 border border-border bg-card p-5">{stats.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={stats} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="branch" tick={{ fontSize: 11 }}/><YAxis allowDecimals={false} tick={{ fontSize: 11 }}/><Tooltip/><Legend/><Bar dataKey="selected" name="Selected" fill="var(--color-chart-2)" radius={[3,3,0,0]}/><Bar dataKey="pending" name="Pending" fill="var(--color-chart-1)" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No student data available yet</div>}</div></div></>}
      {role === 'admin' && page === 'students' && (students.length ? <div className="overflow-x-auto border border-border bg-card"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-secondary text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Student</th><th className="px-5 py-4">Roll number</th><th className="px-5 py-4">Branch</th><th className="px-5 py-4">CGPA</th><th className="px-5 py-4">Placement status</th></tr></thead><tbody>{students.map(s => { const selected = applications.some(a => a.student_id === s.id && a.status === 'selected'); return <tr key={s.id} className="border-t border-border"><td className="px-5 py-4 font-medium">{s.full_name || 'Unnamed student'}</td><td className="px-5 py-4 text-muted-foreground">{s.roll_number || '—'}</td><td className="px-5 py-4 text-muted-foreground">{s.branch || '—'}</td><td className="px-5 py-4">{s.cgpa ?? '—'}</td><td className="px-5 py-4">{selected ? <span className="flex items-center gap-1 text-chart-2"><CheckCircle2 className="h-4 w-4"/>Selected</span> : 'Pending'}</td></tr>; })}</tbody></table></div> : <Empty icon={Users} title="No students registered" body="Student profiles will appear here after they join."/>)}
      </div>
    </main>
  </div>;
}
