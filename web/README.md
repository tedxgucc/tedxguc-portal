# TEDxGUC: web app

The public site and the members' portal, built with Next.js 15 and Tailwind 3 on the **TEDxGUC design system**. The design system's own stylesheet (`src/styles/bundle.css`, every `tx-` component) and tokens (`src/styles/tokens.css`) are copied in unchanged, so the screens match it exactly. Tailwind reads the same tokens (`tailwind.config.ts`, from the design system's "Tokens as code" page).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. The dev server compiles each page the first time you open it, so first visits are slow. To see real speed, build and run the production version:

```bash
npm run preview
```

**Demo mode.** Without Supabase settings the app runs on sample data, and the login page offers a role picker: Chairman, Operations Curator, Marketing Curator, the Media & Design, L&P and Partnerships Executives, and two Associates. Each role sees what the permissions matrix allows. Nothing is saved beyond the browser tab. "Reset demo data" on the login page starts fresh. Demo ticket codes for the door are `demo0001` … `demo0036`. In demo mode each area keeps its own sample data, so a demo package sale does not appear in the demo cashbook (the real database posts it automatically).

**Live mode.** Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project (see the main README for setting that up). Everything then goes through the real database and its security rules.

## What's here

| Area | Pages | Requirements |
| --- | --- | --- |
| Public site | `/` home with countdown, `/events`, `/events/[slug]` with registration, `/tickets/[token]` private ticket page, `/speakers`, `/partners` + inquiry form, `/about` with the board, `/calendar`, `/contact` FAQ + form, `/join`, `/privacy` | FR-1, FR-2.2, FR-5.2, FR-5.3, FR-15.8 |
| Login | `/login`: Google (GUC accounts) or email + password, password reset; invite-only | FR-2.1, FR-2.3, FR-2.4 |
| Portal home | `/portal`: dashboard per role | Role dashboards |
| Tasks | `/portal/tasks`: board (columns on desktop, one column at a time on phones), task sheet with status steps and comments with @mentions, new tasks, requests to other teams | FR-6 |
| Calendar | `/portal/calendar`: month / week / list; add team, club-wide or public entries by role; personal sync link | FR-15 |
| Announcements | `/portal/news`: targeted posts, pinning, read confirmations | FR-8.1 |
| Events | `/portal/events`: create and edit (license rule enforced); live numbers; guest list with search and CSV export | FR-5.1, FR-5.6, FR-1.8 |
| Door | `/portal/door`: camera scanning, type-in code, name search, live count, **offline mode** (ticket hashes saved on the phone, scans queued and synced) | FR-5.4, FR-5.7, FR-5.8 |
| Team | `/portal/team`: directory by division and team (no phone numbers), invites for the Chairman and Curators | FR-2.3, FR-3.5 |
| Profile | `/portal/profile`: details, theme, sign out, sign out everywhere | FR-2.4, FR-2.5 |
| Attendance | `/portal/attendance`: Associates see levels, numbered sessions, send excuses and check in by scanning the meeting QR. Executives schedule meetings and take attendance for their own team, and decide excuses. Curators and the Chairman see rates. `/portal/attendance/[id]`: roll call with a 48-hour edit window, rotating QR, minutes and action items → tasks | FR-7 |
| Recruitment | Public `/join` (open roles, application form with team questions and PDF CV) and `/join/status/[token]` (progress, book or move the interview, withdraw). Portal `/portal/recruitment`: Curators run their division's pipeline (bulk stages, accept → invite, release rejections) and roles + questions; Executives read their own team's applicants, add interview times and score; the Chairman opens rounds and scores board plans; members write their board season plan | FR-4 |
| Files | `/portal/files`: club library (brand kit, templates), division, team and board folders; Executives upload to their own team, Curators to their division, the club and board; Associates read only; handover files and the Chairman's handover check | FR-9 |
| Packages | Public `/packages`, `/packages/[id]` order form (InstaPay, Telda, cash; pickup or delivery) and `/orders/[token]` (pay link with the order number, screenshot or reference, pickup QR). Portal `/portal/packages`: approvers check transfers and take cash; pickup scan; the Operations Curator manages packages, sales, refunds and approvers | FR-16 |
| Finance | `/portal/finance`: everyone requests money for their own team. Curators approve and see the division budget. L&P records cash outs with fatoras and makes the numbered expense form + memo PDFs. Partnerships records deposits net of 14% VAT and approves sponsors. The Operations Curator and Chairman see balances, budgets, reconciliation and the full cashbook with export and void | FR-12 |

**Brand rules applied:** dark by default with a full light theme (remembered per device); Anton for titles and buttons, Inter for text; square corners; `tx-label` above every page title; one faded X per hero; the 12px deep-red bar and the TEDx license line on public pages and the login; status chips always carry an icon and a word; division colours on tags, task cards and calendar pills; 16px inputs and 52px buttons; works at 375px with no sideways scrolling.

**Checked in the browser** (demo mode, 375px and 1280px, dark and light): home page, event registration with validation, ticket page with QR, associate dashboard and task permissions, door check-in, the double-entry block, and the Chairman dashboard.

**Not checked yet:**
- Anything against a real Supabase project.
- The camera scanner on a real phone (the browser preview has no camera).
- Offline mode with the network actually off.
- The service worker, which only runs in production builds.

## Notes

- **Tab bar:** Home · Tasks · Attendance · Calendar · More. People who handle money (Curators, the Chairman, L&P and Partnerships) get Finance instead of Calendar. Games join in Phase 3.
- **Executives see only their own team** (Team, Tasks, Attendance, expense requests). Cross-team task requests are for Curators and the Chairman.
- **Ticket numbers** follow each event's prefix (`TX27-0001`). The design system shows `TX27-0412-LE` with an event code suffix; that's easy to add if you want it.
- **Fonts** are self-hosted through `next/font`, not loaded from Google at runtime.
- **Security headers** are set in `next.config.mjs`. The camera is allowed only on this site.
