# Student Placement Portal: independent Supabase + Vercel

This guide prepares **the existing app and database model**, not a live deployment or transfer of existing accounts. Lovable remains a source-code development tool only. The production app will run on Vercel; its authentication, database, and realtime services will be provided by your own Supabase project. The Google button uses Supabase OAuth directly. The screens and navigation do not change.

## 1. Before changing anything

1. Keep the current portal running while you prepare the replacement. Choose a maintenance window for the final switch: new applications/jobs entered in the old project after an export will not automatically arrive in the new one.
2. Create your own Supabase organization/project and a Vercel account/project under accounts you control. Keep access to the source repository connected to this Lovable project. Export or clone that source into a Git repository Vercel can access. **Do not connect Vercel to a database you have not migrated yet.**
3. Decide whether you need **the existing user accounts and records**, or only the same empty database structure. Copying schema does not copy accounts, passwords, profiles, roles, jobs, applications, or approval requests. See section 6 for existing-data options.
4. Never paste database passwords, Google client secrets, or service-role keys into source code, Git, a browser environment variable (`VITE_...`), or a public support ticket. Only the Supabase publishable/anon key is intended for the browser.

## 2. Recreate the database model

The checked-in `supabase/migrations/` directory contains the schema and successive changes for `profiles`, `user_roles`, `jobs`, `applications`, `role_requests`, enums, role checks, approval logic, signup trigger, row-level security (RLS), grants, and application realtime publication. Apply **every file in filename order**, not just the first. The last migration assigns one designated Super Admin role only if that verified account already exists at migration time; section 6 covers this caveat.

Recommended approach (Supabase CLI on your own computer, from the repository root):

```sh
supabase login
supabase link --project-ref YOUR_NEW_PROJECT_REF
supabase db push
```

Use the **new** project reference in the CLI, not the previous managed project's reference in `supabase/config.toml`. The CLI prompts for the new database password; do not commit it. If the CLI reports migrations are already recorded, stop and review the remote migration history before retrying. Alternatively, run each `supabase/migrations/*.sql` file in order in your new project's SQL editor; do **not** both run them manually and then push them again with the CLI. Run each file as a separate transaction because the enum addition must commit before the next migration uses its values.

Verify in the **new** project that the five tables exist with RLS enabled, their grants and policies exist, `on_auth_user_created` is attached to new users, and `applications` is in the `supabase_realtime` publication. Do not disable RLS to work around a permissions error. No storage buckets are required by the current app.

The schema contains three designated Super Admin email checks. Preserve these if you need identical behavior. They are not sufficient to grant the newly added designated account: that account also requires a verified email and its `super_admin` row in `user_roles`. See section 6.

## 3. Set up authentication and Google

In your **new Supabase project**:

1. Under **Authentication → Providers**, enable Email (with email confirmation) and Google. Keep email/password, magic links, and password recovery enabled if you want existing sign-in options to continue working. Supabase's default mail service can be rate-limited; configure an SMTP provider for production email delivery.
2. In Google Cloud Console, create/configure a Google OAuth consent screen and a **Web application** OAuth client. Add your Supabase callback URL as an **Authorized redirect URI**: `https://YOUR_NEW_PROJECT_REF.supabase.co/auth/v1/callback`. If Google asks for authorized JavaScript origins, use your actual Vercel production origin, e.g. `https://YOUR_APP.vercel.app`; add your own custom domain if used. Enter the Google Client ID and Client Secret in the **Google provider settings of the new Supabase project**, not in Vercel's browser variables or this repository. Google consent-screen publishing/test-user restrictions still apply.
3. Under **Authentication → URL Configuration**, set Site URL to your eventual production origin (`https://YOUR_APP.vercel.app` or your custom domain). Allow exact redirect URLs for `https://YOUR_APP.vercel.app/auth`, `https://YOUR_APP.vercel.app/auth?flow=confirm`, and `https://YOUR_APP.vercel.app/reset-password`. Add their equivalents for any custom domain you use. For local testing also allow `http://localhost:8080/auth`, `http://localhost:8080/auth?flow=confirm`, and `http://localhost:8080/reset-password` (or the actual local port). The Google flow returns to `/auth`; email confirmation returns to `/auth?flow=confirm`; password recovery returns to `/reset-password`. A magic-link return goes to `/auth`.
4. If you use temporary Vercel preview deployment URLs, explicitly allow their corresponding callback URLs, or use a controlled Supabase wildcard redirect rule for preview subdomains. Avoid a broad production wildcard. The **Google authorized redirect URI remains Supabase's `/auth/v1/callback`**, not a Vercel page.
5. Never point OAuth at a role-protected dashboard. The public `/auth` page establishes a session and then navigates to the appropriate workspace.

## 4. Connect Vercel to the new project

Import your Git repository into Vercel. Choose the TanStack Start framework preset if offered; otherwise use **Other**. Set the project root to the repository root, install command to `bun install --frozen-lockfile`, build command to `bun run build`. Do not select a static-only output directory: this app uses TanStack Start server rendering. The Vite configuration selects Nitro's `vercel` preset when Vercel provides the `VERCEL` environment variable; do not add rewrite rules or a second framework router. Use a current Node.js version supported by the dependencies (Node 22 or newer recommended).

In Vercel **Project Settings → Environment Variables**, configure the following for Production (and for Preview too, if preview deployments should access your new project). Obtain the values from **the new Supabase project's settings/API page**, not from the old managed backend:

| Variable | Value | Visibility |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR_NEW_PROJECT_REF.supabase.co` | Browser-visible |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | New project's publishable key (`sb_publishable_...`) or legacy anon key | Browser-visible |
| `SUPABASE_URL` | Same new-project URL | Server-only |
| `SUPABASE_PUBLISHABLE_KEY` | Same new-project publishable/anon key | Server-only |

No service-role key or database password is needed by the current user-facing workflows. If you add privileged server operations later, store their credentials **only** in Vercel's server-side environment and never prefix them with `VITE_`. Vercel builds embed `VITE_` values into browser code: after changing these values, **redeploy**. For local work, set these four values in your own untracked `.env.local` or shell environment. The checked-in `.env` belongs to the development preview and points at the old backend; do not copy its values to Vercel. A clean external checkout can override them via `.env.local`; do not commit that file.

If you attach a custom domain, set its DNS in Vercel and repeat the Supabase allowed-redirect and Site URL settings for that domain. Test password recovery on the actual domain, not only on the Vercel-generated domain.

## 5. Verify before cutover

On the new deployment, create a **new test student**; confirm its email and sign in. Check that its `profiles` and `user_roles` rows were created, then test profile edits, a recruiter approval, job posting, a qualified student application, application status updates, and realtime refresh. Test Google sign-in, magic link, email confirmation, and password recovery using links generated **after** you changed Site URL and allowed redirect URLs. In a private browsing window, verify that a normal student cannot view approvals and that unauthorized database writes are rejected. Compare counts of users/profiles/roles/jobs/applications/requests with the old project if migrating data. Keep the old deployment until all checks pass.

## 6. Existing accounts and data: separate migration

**No account or record data has been transferred by this preparation.** A schema migration alone creates empty tables. The old backend is managed by Lovable, and its database admin password/service-role key is not available through Lovable Cloud. Do not try to extract it from the app's browser key or copy password hashes by hand. If you require full account continuity (including UUIDs, OAuth identities and existing passwords), request an **authorized, supported export/transfer** from the current provider and follow the receiving Supabase project's official database-migration procedure. The auth schema is provider-managed; restoring it incorrectly can break sign-in. Recheck encryption keys, provider identities, trigger behavior, and email confirmation after such a transfer. Never send a database dump containing user data in chat or put it in the source repository.

If you cannot get an authorized auth export, use a **fresh-start migration**: create the schema first, invite users to register again in the new project, have them choose a new password or use password recovery on the **new** account, and verify emails. Google users must sign in against the newly configured Google provider. Old password-reset links and sessions cannot switch projects. Existing records cannot be copied naively: `profiles.id`, `user_roles.user_id`, `jobs.recruiter_id`, `applications.student_id` and `role_requests.user_id` refer to auth user UUIDs. Export only with authorization, match every old user to a newly registered user, remap all related IDs and job/application references in a controlled import, and validate counts and RLS before cutover. Preserve the correct order (users → profiles/roles → jobs → applications and role requests) and avoid double-creating profiles via the signup trigger.

For the designated `manikanta0615@gmail.com` Super Admin **in the new project only**, after that user exists and has verified their email, an administrator may run the following in the new project's SQL editor. This does not assign privilege based on signup metadata:

```sql
insert into public.user_roles (user_id, role)
select id, 'super_admin'::public.app_role
from auth.users
where lower(email) = 'manikanta0615@gmail.com' and email_confirmed_at is not null
on conflict (user_id, role) do nothing;

delete from public.user_roles
where role = 'student' and user_id in (
  select id from auth.users
  where lower(email) = 'manikanta0615@gmail.com' and email_confirmed_at is not null
);
```

Only an authorized database administrator should execute role grants. Never add a client-side role assignment. The other designated emails already have verification-based checks in the preserved SQL model; review that policy with your security administrator before inviting those accounts. After any data migration, confirm each expected role and approval request under RLS rather than assuming the old UI role matches the new database.
