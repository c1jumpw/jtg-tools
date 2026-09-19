# ContentFlow — Changelog

Each shipped revision of `content-strategy-workflow/index.html` is archived
here under `index.v<version>.html` so prior behavior can always be diffed or
restored, independent of git history digging.

## v1.0.0 — 2026-09-08
Initial release.
- Board (drag-and-drop by status), List (sortable/filterable), and Calendar
  views, all reading live from the ClickUp "Client Master Content Strategy
  Workflow" list.
- Task modal: name, status, assignees, all custom fields (recognizes
  MKC ID / Next Action Date / Medium(s) / Publish Date / Related Account ID /
  Scheduled Date by name; any other custom field on the list renders
  generically based on its ClickUp field type).
- Comments: view + post, synced to ClickUp.
- No backend/build step: single self-contained HTML/CSS/JS file, matching
  this repo's existing tool convention (see mkc-crm, keyforge, etc.).
- Connect screen: manual personal-API-token entry, cached client-side only
  (localStorage if "remember" is checked, else sessionStorage this tab only).
- Verified with an automated jsdom smoke test (25 checks: connect flow, all
  three views, custom field rendering + editing, comments with HTML-escaping,
  create/update/delete, drag-and-drop status changes, and a regression check
  for the "Save button stuck disabled" bug found and fixed during that same
  test pass -- see inline code comments in index.html for details).

## v1.1.0 (2026-09-19)
- Added ContentFlow-level login (Supabase Auth, email + password) in front of the board -- everyone signs into the app itself now, not just ClickUp.
- Three roles: admin (full access + new Admin panel), rep (their own ClickUp OAuth connection, restricted to assigned account(s)), client (read-only board/list + comments, no ClickUp connection at all).
- Replaced manual personal-API-token entry with ClickUp OAuth for admins/reps.
- Client-role reads/writes now go through a new backend proxy (contentflow-oauth on Vercel: /api/client/tasks, /api/client/comments) instead of a direct ClickUp connection.
- Added an Admin panel: invite users by email (Supabase sends the invite, they set their own password), assign role + ClickUp account(s), see everyone with access.
- Reps are now restricted to their assigned account(s) in both the account filter dropdown and the underlying task list.
- New backend endpoints added to contentflow-oauth: /api/admin/invite-user, /api/admin/list-users, /api/client/tasks, /api/client/comments (see that project's own README/CHANGELOG).
- New Supabase project (uny-tools): `profiles` and `account_access` tables, RLS enabled, no direct client writes -- all writes go through the backend's service-role key.
- Tested via jsdom smoke test (25/25 passing): login gating, role routing, rep account restriction, client task/comment flow, admin invite flow, and a regression check that board/list/calendar rendering for admins/reps is unchanged.
