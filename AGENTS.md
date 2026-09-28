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
