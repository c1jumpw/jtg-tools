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

## v1.2.0 (2026-09-19)
- Removed the manual "List ID" field from the admin/rep connect screen -- ContentFlow now points at the one Client Master Content Strategy Workflow list automatically (fixed CU_LIST_ID, matching the backend's CLICKUP_LIST_ID). Admins/reps just connect the ClickUp user/guest that already has access to that list.
- Clients with no account assigned yet now see a dedicated "Almost there -- waiting on your admin" screen instead of an empty board, and no longer trigger a pointless /api/client/tasks call while unassigned.
- Confirmed and documented: the account ID used throughout (invite form, Related Account ID matching) is the MKC ID from the Companies & Accounts list -- the invite form's help text now says so explicitly.
- Added a Dashboard view for both admin/rep and clients: total/overdue/due-this-week stat cards, a status breakdown (bar chart, CSS-only, no new dependency), an account breakdown when more than one account is in view, and a clickable "needs attention" list of overdue/due-soon tasks (by Next Action Date).
- Tested via jsdom smoke test, now 36/36 passing (added coverage for the connect-screen simplification, the client waiting screen, and both dashboards).

## v1.3.0 (2026-09-19)
- CRITICAL FIX: ClickUp's REST API doesn't reliably support being called directly from browser JavaScript on a different origin -- confirmed live, this was causing "Could not reach ClickUp" for every admin/rep after connecting. Root cause: the whole "browser calls ClickUp directly" architecture assumption (carried over from the original mkc-crm precedent) doesn't hold for a real cross-origin deployment; it was only ever exercised through mocked tests before now.
- Fix: added /api/clickup-proxy on the backend. Admin/rep ClickUp calls now route through it (server-to-server, immune to browser CORS) using the admin/rep's own ClickUp token, and the response is relayed back byte-for-byte. cuRequest()'s function signature and error behavior are unchanged, so no other frontend code needed to change.
- Also fixed a related backend bug from the same root cause class: /api/oauth-exchange's CORS setup only allowed a Content-Type header, but the frontend always attaches the user's Supabase login as an Authorization header too -- causing "Failed to fetch" during the ClickUp connect step itself. Now uses the shared applyCors() helper (allows Authorization) instead of a hand-rolled, incomplete copy.
- Added a jsdom test that actually exercises loadAll() -> cuRequest() -> the clickup-proxy backend call end-to-end, so this class of regression can't silently ship again. 40/40 passing.

## v1.4.0 (2026-09-19)
- Account names instead of raw MKC IDs everywhere: admin/rep resolve them via a new accounts directory (fetched from the Companies & Accounts list); clients get them from a new accountNames map the backend resolves server-side. Filter dropdown, board badges, list view, and dashboard breakdown all show names now, sorted alphabetically by name.
- Removed "Related Account ID" as a plain field row in the task modal; replaced with an editable name badge (styled <select>) at the top of the entry -- reassigning a task's account is now picking a name from a list, not hand-typing an id.
- Medium(s) are color-coded everywhere now (list view, edit-modal toggles), using each medium's own ClickUp color -- board cards already did this.
- Renamed "Comments" to "Log" throughout, admin/rep and client alike (heading, empty state, placeholder text).
- Backend: new getAccountNames() in lib/clickupService.js, new CLICKUP_ACCOUNTS_LIST_ID env var, /api/client/tasks now returns an accountNames map alongside tasks.
- jsdom smoke test now 52/52 passing (added coverage for account-name resolution on both roles, medium color-coding, and the Log rename).
