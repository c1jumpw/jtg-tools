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
