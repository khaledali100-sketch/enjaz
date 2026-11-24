# إنجاز (Enjaz) — project notes for Claude

Arabic (RTL) school-management web app for a Saudi school principal. The owner is
non-technical and talks to Claude in Arabic; answer in Arabic, start every line with
an Arabic word (the Claude app aligns paragraphs by their first strong character),
avoid tables/code blocks in replies to him.

## Where things live
- `claude-version/` — the app as it runs today as a Claude artifact
  (https://claude.ai/artifact/Gfi6fnDmvi2W4jx42m9ehV). Single `index.html` (vanilla JS,
  no build step) + vendored pdf.js (`pdfjs.min.js`, `pdfjs.worker.min.js`, legacy build,
  served as ES modules). Keep this folder as the reference implementation.
- `web/` — standalone version (GENERATED, do not edit by hand): built by
  `python3 tools/build_web.py` from `claude-version/index.html` + `web-src/`
  (`firebase-shim.js` emulates `claude.use(...)` on Firebase v10.14.1 from gstatic CDN,
  shows the email/password login gate, sets `window.ENJAZ_AUTH`; `config.js` holds the
  Firebase config + `STORAGE_ENABLED` flag). Hosted on Cloudflare Workers static assets (`wrangler.jsonc` → `./web`), URL https://enjaz.enjazt.workers.dev (add any new domain to Firebase Auth authorized domains).
  Firebase project: enjaz-d0d3b (Spark for now: Storage disabled → evidence inline ≤650KB
  or links). Security rules in `firebase/` (owner pastes them in the console).
  Setup steps for the owner: `docs/firebase-setup.md`.
- Workflow: edit `claude-version/index.html` → run build → test both (Claude version
  directly; web version via a local server + mocked Firebase modules routed in
  Playwright) → commit both → push main. Optionally republish the Claude artifact
  (slug 7ee0aba8-6da6-4334-b19c-1a3a10380d40) from claude-version/.
- Shared code hooks for web (inert inside Claude): `window.ENJAZ_WEB`, `ENJAZ_READY`,
  `ENJAZ_AUTH` (roles from `users/{uid}`; prefs shows `usersCard()`), `ENJAZ_BLOB_URL`,
  `ENJAZ_INLINE_MAX`.

## Architecture of index.html (both versions)
- Global `D[collection][docId]` in-memory store. All writes go through `put(c,id,obj)`,
  `putQuiet` (debounced, discipline grid), `del(c,id)`, `mutate(c,id,fn)`.
  `writeDoc` is the only place that talks to the backend → swap it (and the
  `onSnapshot` subscriptions in `boot()`) to change backend.
- Collections (`COLLS`): settings, staff, op_meta, op_domains, pip_domains,
  sup_supervisors, sup_visits, sup_lessons, sup_plc, sup_work, dis_classes, dis_days,
  dis_calls, circulars, awareness, safety, safety_team, sf_checks, sf_drills, sf_maint,
  clubs, club_progs, club_tprogs, tachieve. Plus `files` (small inline uploads, read on
  demand) and `oplog` (audit log, one doc per operation, loaded on demand).
- Plans are trees stored as ONE doc per domain: `TREES.op` (domain → goals → ops →
  programs) and `TREES.pip` (domain → standards → indicators → suggestions → actions →
  programs; legacy programs may sit on suggestions). Helpers: `getNode`, `walkProgs`,
  `addNode`, `addProg`, `moveNode`, `moveProg`.
- Generic tables: `TABLES[key]` {coll, mod, schema, cols, sort, defaults, beforeSave}
  rendered by `tableView`; forms by `editForm(schema)`; field types in `fld()`
  (date fields accept typed Hijri/Gregorian via `parseTyped` + `h2g`).
- Items/tasks: `allItems()` flattens every dated program (with `ref` to its source) →
  daily tasks, upcoming, ended (green/red via `endedState`), by-owner, dashboard.
  `getItemObj/updateItem/execForm` let a program's owner set status/level/evidence.
- Evidence: arrays of {name, kind:'asset'|'inline'|'link', ref, type}; viewer
  `openEvidence` renders PDFs with pdf.js and images inline; download via `saveFile`.
- Roles: in-app PIN login (`settings.main.pins`): principal (all), counselor, activity,
  admin (perms per module in `settings.main.perms`), plus `staff` login (staff.pin) that
  may only update programs whose owner name equals theirs. Not real security in the
  artifact version — Firebase version must enforce with Auth + security rules.
- Levels everywhere: التهيئة 25 / الانطلاق 50 / التقدم 75 / التميز 100 (`LEVELS`).
- Teacher achievements scopes: المدرسة، إدارة التعليم، الوزارة، إقليمي، دولي.

## Working agreements
- Test changes headless with Playwright (Chrome at /usr/bin/google-chrome), mobile
  viewport 400×860; check for page errors.
- Never break existing stored data shapes; migrate in code when renaming.
- The owner has allowed direct pushes to `main` (2026-11-25): commit and push changes
  straight to main; no PR needed.
