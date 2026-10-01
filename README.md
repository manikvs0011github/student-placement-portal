# Student Placement Portal

A TanStack Start placement portal with student, recruiter, tutor, and administrator workspaces. The production target is **Vercel** for the application and an independent **Supabase** project for authentication, Google sign-in, database, and realtime. Lovable remains available for source-code development, not production hosting.

**Migration and deployment:** [Independent Supabase + Vercel setup guide](docs/VERCEL_SUPABASE_MIGRATION.md). It includes database migrations, Google OAuth, Vercel variables, validation, and options for existing accounts/data. No external project or production deployment is configured automatically.

## Local development

Install dependencies with `bun install` and run `bun run dev`. For an independent Supabase project, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in a local, untracked `.env.local`. Never commit private credentials. See the guide for authentication callback URLs and schema installation before testing sign-in.
