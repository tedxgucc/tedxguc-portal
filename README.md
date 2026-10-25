# TEDxGUC Portal: backend

The database, security rules and server functions for the TEDxGUC team portal and public site. The requirements are in [docs/requirements.md](docs/requirements.md).

**Status:** the Phase 1 and Phase 2 backends are built and tested. The Phase 1 screens are built in [web/](web/README.md) on the TEDxGUC design system, with a demo mode you can try without Supabase.

## What's built

| Area | Requirements | Where |
| --- | --- | --- |
| **Phase 1** | | |
| Accounts: invite-only, GUC-only Google sign-in, profiles, private contact details | FR-2 | `migrations/…01_core.sql` |
| Seasons, divisions, teams, roles, role change requests, season rollover, org chart | FR-3 | `…01_core.sql`, `seed.sql` |
| Audit log of sensitive changes | FR-14.3 | `…01_core.sql` (and each module) |
| Public content: page sections, speaker cards, partner logos, contact/partner forms | FR-1 | `…02_site_content.sql` |
| Events, registration, waitlist, tickets, online + offline check-in, run of show | FR-5 | `…03_events.sql` |
| Tasks: several assignees, status rules, comments + @mentions, files, cross-team requests, reminders | FR-6 | `…04_tasks.sql` |
| Announcements with read confirmations; the shared calendar and .ics feed | FR-8.1, FR-15 | `…05_announcements_calendar.sql` |
| Rate limits, file storage rules, scheduled jobs | FR-1.9 | `…06_storage_jobs.sql` |
| **Phase 2** | | |
| Recruitment: cycles, positions with custom questions, CV upload, stages, interview booking and scores, one-click accept → invite, held-back rejections, board season plans, 6-month data purge | FR-4 | `…07_recruitment.sql` |
| Meetings, roll call with a 48-hour edit window, rotating QR check-in, excuses, absence levels and warnings, attendance rates; meetings on the calendar | FR-7, FR-15.7 | `…08_meetings_attendance.sql` |
| File library by club / division / team / board, brand kit, handover check | FR-9 | `…09_files.sql` |
| Finance: cashbook with numbered entries, VAT, fatoras, void-only (no delete), expense requests with Curator → Chairman approval, division budgets, sponsorships, balances, monthly reconciliation, balances carried over at rollover | FR-12 | `…10_finance.sql` |
| Package sales: InstaPay / Telda / cash orders, stock holds and expiry, payment approval, automatic cashbook entries, pickup scan, refunds, sales report | FR-16 | `…11_packages.sql` |
| **Server functions** | | `supabase/functions/` |
| `public-forms`: guest forms (tickets, applications, orders, contact), signed upload links, emails | FR-2.2, FR-4, FR-5, FR-16 | |
| `staff-actions`: member actions that send emails (invites, waitlist, recruitment decisions, order approvals) | | |
| `finance-docs`: numbered expense form and memo PDFs for a cash out | FR-12.3 | |
| `calendar-ics`: personal calendar feed | FR-15.9 | |
| `maintenance`: daily cleanup (applicant data and CV files, expired orders) | FR-4.8, FR-16.6 | |

## How security works

- **Every rule is in the database.** Each table has row-level security, so a member who calls the API directly gets exactly what the permissions matrix allows, whatever the screens show or hide. Guests (not logged in) have no access to member-only tables at all.
- **Role checks** are small helper functions in the `private` schema, which the API can't reach. For example, `private.can_manage_team(team)` is true for the Chairman, that division's Curator and that team's Executives.
- **Team-specific powers** use each team's `kind` (e.g. `logistics_planning`), so renaming a team next season doesn't break anything. Examples: L&P records cash outs, Partnerships records deposits, OD Executives schedule club-wide workshops.
- **Guests never touch tables.** Guest forms go through `public-forms` (Turnstile + rate limits), which calls database functions only the server may run. Status pages use a private 64-character link; only its hash is stored.
- **Tickets and pickups:** the QR holds a random code that is looked up by its hash. The offline ticket list holds only hashes.
- **Money:** no one can delete or un-void an entry, set a document number, or attach a "generated" PDF themselves. Every add, edit and void is in the audit log.

## Run the tests

They need only Node 20+, with no Docker or Supabase. The database tests use an in-memory Postgres 17 (PGlite) with a small stand-in for Supabase's auth and storage.

```bash
npm install
```

```bash
npm test
```

There are **96 tests**: 90 database tests, covering every rule above, plus 6 unit tests for email wording, the .ics builder and the PDFs.

**Not covered by tests:** the server functions' network code (Resend, Turnstile, Supabase storage and auth calls), Supabase's real auth hook wiring, and the cron schedules. These need a real Supabase project.

## Set up the Supabase project

1. Create a project at supabase.com under a **shared TEDxGUC account** (see "Ownership" in the requirements).
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then link and push:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
   ```bash
   supabase db push
   ```
   Then run `supabase/seed.sql` once in the SQL editor to create the 2027 season, divisions, teams and default settings.
3. **Auth → Hooks:** enable "Before User Created" → Postgres function `public.hook_before_user_created`.
4. **Auth → Providers → Google:** add the Google OAuth client. **Auth → URL configuration:** set the site URL and `…/auth/callback`.
5. **Database → Extensions:** enable `pg_cron`, then run `supabase db push` again, or run the `do $$ … $$` blocks at the end of `…06_storage_jobs.sql` and `…11_packages.sql`. These schedule task reminders every 15 minutes and order expiry every 10 minutes.
6. **Integrations → Cron:** schedule the `maintenance` function daily with the service role key.
7. Secrets (see `.env.example`):
   ```bash
   supabase secrets set SITE_URL=https://… RESEND_API_KEY=… EMAIL_FROM="TEDxGUC <tickets@…>" TURNSTILE_SECRET_KEY=…
   ```
8. Deploy the server functions:
   ```bash
   supabase functions deploy public-forms
   ```
   ```bash
   supabase functions deploy staff-actions
   ```
   ```bash
   supabase functions deploy finance-docs
   ```
   ```bash
   supabase functions deploy calendar-ics
   ```
   ```bash
   supabase functions deploy maintenance
   ```
9. **Payment links (FR-16.3, FR-16.4).** Add TEDxGUC's InstaPay and Telda links as settings:
   ```sql
   insert into public.settings (season_id, key, value)
   select id, 'instapay_link', '"https://ipn.eg/S/…"' from public.seasons where is_active;
   ```
   Do the same for `telda_link`.
10. **First Chairman.** Nobody can sign up without an invite, so create the first invite in the SQL editor:
    ```sql
    insert into public.invites (email, season_id, role)
    select 'chairman@student.guc.edu.eg', id, 'chairman' from public.seasons where is_active;
    ```
    They sign in with Google. From then on, the Chairman and Curators invite everyone else from the portal.

**Session timeout (FR-2.4):** Supabase's session time limits ("Auth → Sessions") need the Pro plan. On the free plan, the app itself should sign members out after inactivity, and "log out of all devices" uses `supabase.auth.signOut({ scope: 'global' })`.

**Alumni login (FR-2.6):** before graduating, a member changes their login email to a personal one with `supabase.auth.updateUser({ email })`. The profile email follows automatically.

**Settings the Chairman can change** (table `settings`, per season, no code needed): `lates_per_absence`, `absence_levels`, `excuse_window_hours`, `attendance_edit_window_hours`, `expense_chairman_limit_egp`, `vat_rate`, `cash_hold_days`, `proof_hold_hours`, `task_reminder_hours`, `instapay_link`, `telda_link`.

## API for the screens

The screens will use `supabase-js`. Tables are read and written directly, and RLS enforces the rules. These calls cover everything else.

**Guests (no login)**

| Call | What it does |
| --- | --- |
| `functions.invoke('public-forms', { action: 'register' \| 'resend' \| 'cancel' })` | Event tickets and waitlist |
| `functions.invoke('public-forms', { action: 'upload_url', kind: 'cv' \| 'proof' })` | Signed link; then `storage.from(bucket).uploadToSignedUrl(path, token, file)` |
| `functions.invoke('public-forms', { action: 'apply' })` | Job application with an optional CV |
| `functions.invoke('public-forms', { action: 'order' \| 'submit_proof' \| 'cancel_order' })` | Package orders |
| `functions.invoke('public-forms', { action: 'inquiry' })` | Contact or partner message |
| `rpc('get_registration_by_token' \| 'get_application_by_token' \| 'get_order_by_token')` | Private status pages |
| `rpc('book_interview_slot')`, `rpc('withdraw_application')` | From the application status page |
| `rpc('calendar_feed')`, `rpc('get_public_board')`, `rpc('package_stock')` | Public calendar, board, stock left |

**Members**

| Who | Call | What it does |
| --- | --- | --- |
| Everyone | `rpc('calendar_feed', { p_from, p_to, p_team? })` | Entries, events, meetings, my task deadlines |
| Everyone | `rpc('rotate_calendar_feed_token')` | Personal .ics link: `/functions/v1/calendar-ics?token=…` |
| Everyone | `rpc('my_attendance')`, `rpc('attendance_summary')` | "My attendance" list and level summary |
| Everyone | `rpc('meeting_check_in', { p_meeting_id, p_code })` | Self check-in by meeting QR |
| Everyone | `insert into excuses`, `insert into expense_requests`, `rpc('cancel_expense_request')` | Excuses, expense requests |
| Executives+ | `rpc('meeting_roll_call')`, `rpc('submit_attendance')`, `rpc('meeting_qr')`, `rpc('decide_excuse')` | Take attendance |
| Executives+ | `rpc('attendance_rates')`, `rpc('meeting_attendance_rates')` | Rates per member and per meeting |
| Scanners | `rpc('check_in')`, `rpc('get_checkin_manifest')`, `rpc('sync_offline_checkins')`, `rpc('search_registrations')`, `rpc('event_stats')` | Event door |
| Curators | `functions.invoke('staff-actions', { action: 'application_stage' \| 'release_rejections' \| 'accept_application' })` | Recruitment decisions, with emails |
| Curators | `rpc('decide_expense_request')`, `rpc('division_budget_status')` | Approve spending, see the budget |
| L&P | `insert into transactions (kind 'cash_out')`, `functions.invoke('finance-docs', { transaction_id })` | Cash out + expense form and memo PDFs |
| Partnerships | `insert into transactions (kind 'bank_deposit')`, `sponsorships` table | Deposits, sponsor approvals |
| Operations | `functions.invoke('staff-actions', { action: 'decide_order' \| 'mark_cash_paid' })`, `rpc('pickup_order')`, `rpc('package_sales')` | Package payments, pickup, sales |
| Finance admins | `rpc('finance_balances')`, `rpc('void_transaction')`, `rpc('record_reconciliation')`, `rpc('refund_order')` | Balances, voids, reconciliation, refunds |
| Board | `functions.invoke('staff-actions', { action: 'send_invite' \| 'admin_cancel' \| 'promote_waitlist' })` | Invites, guest changes |
| Chairman | `rpc('decide_role_change')`, `rpc('activate_season')`, `rpc('score_board_plan')`, `rpc('handover_status')` | Roles, rollover, board plans, handovers |

## Choices made while building

These fill gaps in the requirements. Change any that don't match how TEDxGUC works:

**Phase 1**
- **Who can scan tickets:** the Chairman, the whole Operations division, every Executive, and any member assigned as event staff.
- **Contact form messages** go to the Chairman and Curators; partner inquiries go to the Operations Curator and the Partnerships team.
- **Cross-team requests** are sent by Executives or Curators, not Associates.

**Phase 2**
- **Applicants** choose one or two teams. Any Curator (or the Chairman) can release a cycle's held-back rejections, and the release covers the whole cycle.
- **Who is expected at a meeting:** Associates in its scope (team, division or club); for board meetings, Executives and Curators. Board meetings are visible to the board only.
- **QR check-in** opens 30 minutes before the start. Arriving more than 15 minutes late marks you Late. The code changes every 30 seconds.
- **Absence level** = unexcused absences + one for every 2 Lates. Warnings go out at level 2 (to the member) and level 3 (to the Curator and Executives), each only once.
- **Telda is its own balance**, beside the bank account and cash on hand, because it's a separate wallet. The requirements mention two balances.
- **VAT:** a deposit's gross amount includes 14% VAT, so net = gross ÷ 1.14.
- **Budgets warn, they don't block.** A Curator sees the remaining budget when approving, but can approve over it.
- **Package approvers** must be in the Operations division.

## Still to do

- **Phase 2 screens:** recruitment, attendance, files, finance, packages (the backend is ready).
- **Importing TEDxGUC Cash data (FR-12.1)** needs an export of the existing cashbook. The new tables are ready for it.
- **Phase 3 backend:** speakers pipeline, partners CRM, evaluations, reports, inventory, X Access, feedback box, games.