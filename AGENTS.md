<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep role assignments in `user_roles`, with new users defaulting to student; role changes remain administrative because self-assignment would permit privilege escalation.
- Use shared role-aware portal screens with TanStack route wrappers, while database row policies enforce access independently of navigation guards.
- Treat signup role metadata as a request, not an assignment; only a verified designated super administrator can approve it because client metadata is user-controlled.
- Keep role resolution in a shared browser-safe helper and reuse the existing portal for dashboard aliases because navigation should agree across entry points.
- Keep signup confirmation callbacks on the public sign-in screen and recovery callbacks on the public reset-password route; callback sessions must be handled before portal redirects so email actions are not mistaken for ordinary sign-in.
- Grant requested Super Admin access only to an already verified account through an administrator-controlled user_roles assignment; require both the verified email and assigned role for the new designated account so a new signup cannot claim its privileges.
- Deploy the TanStack Start server with Nitro's Vercel preset on Vercel and use Supabase as the only data and authentication service; keep the Lovable preview preset for development.
- Use Supabase OAuth directly for Google sign-in so production authentication does not depend on Lovable's auth broker.
