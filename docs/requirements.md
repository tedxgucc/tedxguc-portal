# TEDxGUC Team Portal — Requirements

v2 · Oct 24, 2026 · Kareem Roshdy

> **What changed from v1:** an expense approval flow and budget visibility rules, a permissions matrix that covers every module, a fuller data model, a privacy design for the anonymous feedback box, offline check-in, alumni access, a lower-cost WhatsApp plan, answers to the open questions, a glossary, and acceptance criteria for the MVP. New requirement IDs were added at the end of each module, so the v1 IDs still point to the same things. Choices this version makes on your behalf are listed under **Decisions to confirm**.

## Overview

One website that replaces scattered WhatsApp groups, Google Forms and Sheets: a public face for guests and a role-based team portal for the board, executives and associates.

**Goals**

- Give every member one login and a dashboard that shows only what their role needs.
- Run the season in one place: teams, tasks, meetings, attendance, events, speakers, partners, money and evaluations.
- Let guests discover TEDxGUC events, register without signing in, get a ticket (number + QR) and apply to join the team.
- Keep a record across seasons (alumni, past events, handover files) so each new board starts from history, not zero.

**In scope:** public site, authentication, role-based portal, events + ticketing, recruitment, task and meeting management, finance (cashbook), partners, speakers, package sales, inventory, X Access, feedback box, bonding games, reports.

**Out of scope (v1):** native mobile app, card payment gateway (tickets stay free; packages are paid by InstaPay, Telda or cash), live streaming, Arabic version (planned for Phase 3).

## Glossary

| Term | Meaning |
| --- | --- |
| Season | One academic year of TEDxGUC, with its own board, teams and theme |
| Division | A group of teams headed by one Curator (Talks, Operations, Org. Development, Marketing & Coordination) |
| L&P | Logistics and Planning team (Operations division) |
| OD | Organizational Development division |
| AE / AD | Associates' Experience / Associates' Development teams (OD division) |
| Fatora | Supplier invoice or receipt, uploaded as proof of a cash out |
| Expense form / memo | Numbered paperwork generated for every cash out, printed and signed |
| Main Event / Salon | The yearly flagship TEDx event / smaller themed events during the year |
| Status link | A private, unguessable link that lets a guest check a ticket, application or order without an account |
| Absence level | A running count of unexcused absences that triggers warnings |

## User roles and hierarchy

```
Team portal (login required)
  Chairman · 1 per season
    Leads the season; approves budget, role changes, all-member news
    Full access to every module and report
      ↓
  Curators · 1 per division
    Head a division: Talks, Operations, Org. Development, Marketing & Coordination
    Full access to their division; approve its expense requests and tasks
      ↓
  Executives · 1 or more per team
    Run day-to-day work and manage the associates in their team
    Assign tasks, take attendance, rate associates
      ↓
  Associates · many per team
    Do the work: tasks, deliverables, meetings
    See only their own tasks, files and evaluation

Guests · public (no account, public site only — not a portal role)
  Register, get QR tickets, apply to join, buy packages
  → accepted applicant becomes an Associate
```

Each role reports to the one above it, and access narrows at each level. Roles are held per season, so a member can be an Associate one year and a Curator the next. At season rollover, everyone without a new role becomes an **alumnus**: they keep read access to their own history and the alumni directory.

**Team-specific powers.** Some teams get extra powers inside their module regardless of role level, e.g. L&P records cash outs, Partnerships records deposits, OD handles feedback, AE/AD build games. The matrix below writes these as *"Team name: power"*.

## Permissions matrix

Key: **Full** = create, edit, delete/void, approve · **Division** = full, but only for the Curator's own division · **Team** = full, but only for own team · **Own** = only records they created or are assigned to · **View** = read only · **—** = no access.

| Feature | Chairman | Curator | Executive | Associate | Guest |
| --- | --- | --- | --- | --- | --- |
| Public site content | Full | Edit own division's section | View | View | View |
| Calendar | Edit club-wide + any team | Edit club-wide + own division | Edit own team | View club-wide + own team | Public entries only |
| Events & ticketing | Full | Operations: Full · others: View | Check-in only | Check-in only (when assigned) | Register by form |
| Recruitment applications | Full | Division (review + decide) | Team (interview notes + scores) | — | Apply by form |
| Board plan review (FR-4.7) | Full (score) | Own plan only | Own plan only | — | — |
| Member directory | Full | View all | View all | View all, **no phone numbers** | — |
| Invite / remove / change roles | Full | Invite to own division; request role changes | — | — | — |
| Teams & org chart | Full | Division | View | View | — |
| Tasks | Full | Division | Team (assign to associates) | Own | — |
| Meetings & attendance | Full | Division | Team (take attendance, 48 h edit window) | Own | — |
| Announcements | All members | Own division | Own team | View | — |
| Files & handover library | Full | Division | Team | View own team + club-wide | — |
| Speakers pipeline | Full | Talks: Division | Talks teams: Team | Talks teams: Own | Published speakers only |
| Partners & sponsors CRM | Full | Operations: Division | Partnerships: Team | Partnerships: Own | Logo wall + inquiry form |
| Finance / cashbook | Full + balances | Operations: Full + balances · others: own division's budget vs spent + approve its requests | L&P: cash out, fatora, forms, memos · Partnerships: deposits, sponsorships · others: submit request | Submit request, track own requests | — |
| Package sales | Full | Operations: Full (approve payments) | Operations approvers: approve payments, pickup | Operations approvers: same | Buy by form |
| Inventory & assets | View | Operations: View | L&P: Full · others: request to borrow | L&P: Team · others: request to borrow | — |
| X Access & sponsor banners | Full | Operations: Division | Partnerships: Team | Partnerships: View | Perks page, card, verify page |
| Anonymous feedback box | Reads feedback about OD + monthly summary | OD: handle all (except feedback about OD) · others: send | OD: handle · others: send | Send + track by code | — |
| Bonding & pop-up games | Play | Play | AE/AD: build + moderate · others: play | AE/AD: build + moderate · others: play | — |
| Evaluations & KPIs | Full | Division | Team (rate associates) | Own results | — |
| Reports & analytics | Full | Division | Own team (tasks, attendance only) | — | — |
| Audit log | View | Operations: finance entries | — | — | — |
| System settings, season rollover | Full | — | — | — | — |
| Alumni (no current role) | — | — | — | Own history + alumni directory | — |

## Functional requirements by module

IDs (FR-x.y) let you track each requirement into tasks or tickets when you build.

### 1. Public website (Guests)

- FR-1.1 Home: next event countdown, season theme (e.g. "Loose Ends"), call-to-action to register.
- FR-1.2 About: TEDx vs TED, TEDxGUC history since 2013, current board.
- FR-1.3 Events: upcoming and past events (Main Event, Salons), date, venue, agenda, gallery, talk videos.
- FR-1.4 Speakers: profile cards per event, talk title, bio, photo, link to talk.
- FR-1.5 Partners: logo wall by tier, "become a partner" inquiry form.
- FR-1.6 Join the team: open roles per team, application form, deadline.
- FR-1.7 Contact + FAQ; links to Instagram @tedxguc__.
- FR-1.8 TEDx license compliance: required TEDx branding, disclaimer "independently organized TED event", an event shown only once licensed.
- FR-1.9 Every public form (registration, application, order, inquiry, contact) has spam protection (Cloudflare Turnstile, free) and rate limits per email and per IP.
- FR-1.10 Every public form has a consent checkbox linking to a short privacy notice (what is stored, why, how long, how to request deletion).

### 2. Accounts & authentication

- FR-2.1 Members log in with GUC email (Google sign-in restricted to @student.guc.edu.eg / @guc.edu.eg) or email + password.
- FR-2.2 Guests never sign in or create accounts: they register for events and apply to join through public forms (name, email, phone); tickets and application updates reach them by email (WhatsApp later, see FR-8.4), with a private status link instead of a login.
- FR-2.3 Invite-only member accounts: the Chairman or a Curator invites; the account gets its role and team on first login. An invite expires after 7 days.
- FR-2.4 Password reset, session timeout (30 days on a trusted device, 12 hours otherwise), logout from all devices.
- FR-2.5 Profile: name, photo, phone/WhatsApp, major, semester, team, role, season(s), social links, fun facts (FR-20.8), birthday (optional).
- FR-2.6 Members can link a personal email as a second login, so alumni keep access after their GUC email is closed.
- FR-2.7 Status links use a random token of at least 128 bits, show only that one record, and can be re-sent by entering the same email.

### 3. Roles, teams & seasons

- FR-3.1 Four portal roles: Chairman, Curator, Executive, Associate. Guests are public visitors, not a role. One member can hold different roles in different seasons.
- FR-3.2 Divisions and teams configurable per season. 2027 setup:
    - Talks: Coaching; Research and Production
    - Operations: Logistics and Planning; Partnerships
    - Organizational Development: Associates' Experience; Associates' Development
    - Marketing & Coordination: Campaigns and Copyrights; Media and Design
- FR-3.3 Each division has one Curator; each team inside it has 1+ Executives and many Associates. A Curator's "Division" access covers every team in their division.
- FR-3.4 Season rollover: the Chairman archives the season, members without a new role become alumni, the new board is assigned; history stays readable. Finance balances carry over to the new season as opening balances.
- FR-3.5 Auto-generated org chart from the database.
- FR-3.6 Role change requests: a Curator requests a promotion, move or removal; the Chairman approves; every change goes into the audit log.

### 4. Recruitment

- FR-4.1 Recruitment cycles with open/close dates and positions per team.
- FR-4.2 Application form with custom questions per team, CV/portfolio upload (PDF, max 10 MB). An applicant can pick up to 2 teams in order of preference.
- FR-4.3 Pipeline stages: Applied → Screened → Interview → Accepted / Rejected; bulk actions.
- FR-4.4 Interview slot booking (the applicant picks a slot through their status link), interviewer notes and scores.
- FR-4.5 An accepted applicant is converted to an Associate invite in one click (FR-2.3).
- FR-4.6 Automatic status emails to applicants at each stage; rejection emails are sent only when the Curator releases them for the whole cycle.
- FR-4.7 Board recruitment: Executive and Curator candidates submit their season plan as a structured form built from the Board of Executives Plan Guidelines: the general section (personal info, mission and vision, job description, year timeline, team dynamics, associates plan, KPIs) plus their team's own questions. The Chairman reviews and scores each plan.
- FR-4.8 Applicant data is deleted 6 months after the cycle closes, except for accepted applicants.

### 5. Events & ticketing

- FR-5.1 Create event: type, date, venue, capacity, registration window, license status, public/private.
- FR-5.2 Registration form with custom fields; one registration per email per event; waitlist when full, with automatic promotion when someone cancels.
- FR-5.3 Auto ticket number + QR code, delivered by email (WhatsApp later); the guest can cancel through their status link.
- FR-5.4 Check-in screen: scan QR on phone, mark attended, prevent double entry, live attendee count.
- FR-5.5 Run of show / event-day timeline with owners per slot, ushering plan, and associates/attendees pack items with their suppliers (Logistics and Planning).
- FR-5.6 Post-event: feedback survey to attendees, attendance export.
- FR-5.7 **Offline check-in:** the check-in app downloads the ticket list before doors open, keeps scanning without internet, and syncs when it reconnects. If two devices scan the same ticket while offline, the first scan wins and the second shows as a warning after sync.
- FR-5.8 Manual lookup by name, email or ticket number for guests without their QR.

### 6. Tasks

- FR-6.1 Create task: title, description, team, one or more assignees, deadline, priority (low / normal / high / urgent), attachments.
- FR-6.2 Status: To do → In progress → In review → Done; Kanban and list views. Only the creator or the assignee's Executive can move a task to Done.
- FR-6.3 Comments and @mentions on tasks.
- FR-6.4 Reminders 24 h before the deadline; overdue tasks flagged to the Executive and Curator.
- FR-6.5 Cross-team task requests (e.g. Marketing asks L&P for supplies): the receiving team's Executive accepts and assigns, or declines with a reason.

### 7. Meetings & attendance

- FR-7.1 Schedule team or board meetings, workshops, general assemblies and sessions, with agenda and location/online link; they appear on the calendar.
- FR-7.2 Meeting minutes and action items that become tasks.
- FR-7.3 **Associate view ("My attendance"):**
    - Summary at the top: each meeting type (team meetings, workshops, general assemblies, events) with the associate's absence level next to it, coloured by level.
    - Overall level shown under the summary.
    - Dropdown to pick a meeting type, then a numbered list of every session, newest first: date, type and slot, and status.
    - Each session is a coloured card: green = Attended, red = Absent, yellow = Late, grey = Excused.
- FR-7.4 **Executive view ("Take attendance"):**
    - The Executive opens a meeting and sees the list of their own associates with photo and name.
    - One tap per associate to set Attended / Absent / Late / Excused, plus "mark all present" and an optional note.
    - Submit saves it and updates each associate's record instantly; the Executive can correct it for 48 hours, after that only the Curator can.
    - Optional QR check-in: associates scan a meeting QR and appear as Attended automatically; the Executive only fixes exceptions. The meeting QR changes every 30 seconds so it can't be shared by screenshot.
- FR-7.5 **Curator view:** attendance for every team in their division, rates per associate and per meeting.
- FR-7.6 **Absence levels:** each unexcused absence raises the level. OD sets the thresholds and actions (e.g. level 2 = warning to the associate, level 3 = Curator notified) and how many Lates count as one absence (default: 2). Excused absences don't count.
- FR-7.7 Associates can submit an excuse with a note or attachment, up to 48 hours after the meeting; their Executive accepts or rejects it.
- FR-7.8 Attendance rate per member feeds evaluations (FR-13).

### 8. Communication

- FR-8.1 Announcements targeted to all, one division, one team, or one role; optional "pin to top" and "require read confirmation".
- FR-8.2 In-app and email notifications; each member chooses which non-urgent types they get by email.
- FR-8.3 Shared calendar: see module 15.
- FR-8.4 **WhatsApp, in two steps:**
    - Phase 1–2 (free): a "Send on WhatsApp" button that opens a pre-filled `wa.me` chat with the ticket or status link, sent by a team member.
    - Phase 3 (paid): automatic messages through the WhatsApp Business API, only after a monthly budget is approved and the business number is verified.

### 9. Files & knowledge base

- FR-9.1 Folders per team and per season (handover docs, templates, brand kit, associates pack).
- FR-9.2 Brand kit: logos, colours, fonts, TEDx rules.
- FR-9.3 Permissions follow the role matrix.
- FR-9.4 Every Executive and Curator must upload a handover document before season rollover; the Chairman sees who is missing.

### 10. Speakers pipeline

- FR-10.1 Owned by the Talks division: Research and Production finds and develops speakers, Coaching prepares them. Speaker stages: nominated → researched → confirmed → coached → delivered (or dropped, with a reason).
- FR-10.2 Speaker profile, talk outline, rehearsal schedule, consent and release forms.
- FR-10.3 Publish confirmed speakers to the public site with one toggle; nothing is public until the signed release form is uploaded.

### 11. Partners & sponsors

- FR-11.1 Partner records: company, contact, tier, status (lead → pitched → signed → delivered, or lost).
- FR-11.2 Deliverables tracker per partner (logo placements, booth, posts), each with an owner and a due date.
- FR-11.3 Loyalty card partners and their perks listed for the community (see module 18). Proposal/deck generation from templates is Phase 3+.

### 12. Finance (TEDxGUC Cash, merged)

- FR-12.1 TEDxGUC Cash is merged into this site: same Supabase database, existing cashbook data imported, one login.
- FR-12.2 **Logistics and Planning:** record cash out (amount, item, supplier, event, team, date) and upload the fatora (photo or PDF) on every cash-out entry; an entry without a fatora is flagged until one is added.
- FR-12.3 **Paperwork (L&P):** each cash out generates its expense form and a memo as numbered PDFs, ready to print and sign.
- FR-12.4 **Partnerships:** record bank deposits and manage sponsorships: sponsor, amount, tier, contract file, status pending → approved / rejected. Every money-in entry stores the gross amount, the 14% VAT amount and the net amount; balances use the net amount.
- FR-12.5 **Operations Curator:** sees everything (all cash out, fatoras, expense forms, memos, deposits and sponsorships) plus the live bank and cash-on-hand balances.
- FR-12.6 **Chairman:** same full view as the Operations Curator, and sets each division's season budget.
- FR-12.7 **Other Curators:** no balances and no other division's entries; they see their own division's budget, total approved spend and remaining budget, and approve their division's expense requests.
- FR-12.8 No hard delete: an entry can only be voided with a reason; every add, edit and void is in the audit log.
- FR-12.9 Filters by event, team and month; export cashbook to Excel and PDF.
- FR-12.10 **Expense request flow:**
    1. Any member submits a request: item, amount, team, event, reason, optional quote.
    2. The member's Curator approves or rejects it against the division budget. Requests above a limit set by the Chairman (default EGP 5,000) also need the Chairman's approval.
    3. L&P buys the item and turns the approved request into a cash-out entry with its fatora (FR-12.2).
    4. The requester sees the status at each step: submitted → approved → purchased, or rejected with a reason.
- FR-12.11 Monthly reconciliation: the Operations Curator enters the bank statement balance and the counted cash; the site shows any difference from the cashbook.

### 13. Evaluations & KPIs

- FR-13.1 Monthly evaluation, run by Organizational Development: Executives rate Associates, Curators rate Executives, the Chairman rates Curators; workshop and camp attendance tracked as engagement.
- FR-13.2 Score built from tasks done on time, attendance, rating and peer feedback; OD sets the weights each season.
- FR-13.3 Member of the month; warnings after repeated absences (FR-7.6).
- FR-13.4 End-of-season certificates, auto-generated as PDF with a verification QR.
- FR-13.5 Members see their own score and the rater's written feedback; raters' individual scores of other members stay private.

### 14. Reports & admin

- FR-14.1 Dashboards: members per team, task completion, attendance, registrations, budget.
- FR-14.2 Export any list to CSV/Excel.
- FR-14.3 Audit log of sensitive actions (role changes, deletions and voids, money, permission changes).
- FR-14.4 Admin settings for seasons, divisions, teams, meeting types, absence thresholds, evaluation weights and expense limits, so no code change is needed between seasons.

### 15. Calendar

- FR-15.1 One calendar for the whole club, with month, week and list views and filters by team and entry type.
- FR-15.2 The Chairman and Curators can create club-wide entries, visible to every member.
- FR-15.3 Curators can also create entries for any team in their division.
- FR-15.4 Executives can create and edit entries for their own team only; only that team (plus its Curator and the Chairman) sees them.
- FR-15.5 Associates have view-only access: they see club-wide entries plus their own team's entries.
- FR-15.6 Entry fields: title, date and time, location or online link, team, visibility (club-wide, team or public), optional link to a meeting, event or task deadline.
- FR-15.7 Meetings, events and task deadlines appear on the calendar automatically.
- FR-15.8 Entries marked public (e.g. Main Event, Salons) show on a public calendar page for guests, no sign-in needed.
- FR-15.9 Reminders before entries; "add to Google Calendar" and a personal .ics feed per member.

### 16. Package sales (mid-year)

- FR-16.1 Public "Packages" page (no sign-in): package name, photo, what's inside, price in EGP, stock left, sale open/close dates.
- FR-16.2 Order form: name, email, phone, quantity (max per order set by admin), pickup or delivery details, then a choice of 3 payment methods: InstaPay, Telda, Cash.
- FR-16.3 **InstaPay:** the site shows the amount and an order number, then sends the buyer to TEDxGUC's InstaPay payment link with the order number as the note.
- FR-16.4 **Telda:** same flow, sending the buyer to TEDxGUC's Telda payment link.
- FR-16.5 After paying, the buyer uploads the transfer screenshot (or enters the transaction reference); the order shows "Pending approval". Stock is held for 24 hours while the order waits for proof.
- FR-16.6 **Cash:** the order is reserved as "Awaiting cash" for a set number of days, paid at the TEDxGUC booth; unpaid orders expire and release stock.
- FR-16.7 A member of the Operations division (the Operations Curator, or an Operations member they assign as approver) checks the TEDxGUC InstaPay / Telda account for the transfer and approves or rejects it. Cash orders are marked paid by the Operations member at the booth. Only an approved order is confirmed, and the buyer gets a confirmation with order number + QR by email.
- FR-16.8 Approved orders post to the cashbook automatically as `package_sale` entries: InstaPay and Telda as account money, cash as cash on hand, visible to the Operations Curator in the balances.
- FR-16.9 Pickup screen: scan the order QR to mark the package as delivered.
- FR-16.10 Admin: create packages, set price and stock, see sales by method, export orders.
- FR-16.11 A rejected or cancelled paid order is recorded with its refund method and date; the refund posts to the cashbook as a reversing entry.

### 17. Inventory and assets (L&P)

- FR-17.1 List of everything TEDxGUC owns: roll-ups, banners, red carpet, decor, equipment, leftover pack items and merch.
- FR-17.2 Each item: name, photo, category, quantity, condition, storage location, season bought, cost.
- FR-17.3 Check out / check in: who borrowed it, for which event, date taken, expected return; overdue items flagged to L&P.
- FR-17.4 Search before buying: when L&P adds a cash out, the site suggests matching items already in stock so nothing is rebought.
- FR-17.5 Event packing list: pick items for an event and print it; scan items back after the event.
- FR-17.6 Access: L&P manages; the Operations Curator and the Chairman view; other members can request to borrow.

### 18. X Access loyalty card and sponsor banner (Partnerships)

- FR-18.1 Each X Access holder gets a digital card with a unique QR, delivered by email (no sign-in needed).
- FR-18.2 Public "X Access perks" page: partner logos, the discount or perk each one gives, and its terms and expiry.
- FR-18.3 Partners scan the card's QR to open a verify page showing valid / expired and the holder's first name only; partners need no account.
- FR-18.4 Optional redemption log: the partner enters a short PIN to record each use, so Partnerships can report usage back to partners.
- FR-18.5 Partnerships issues, renews and cancels cards and adds or edits partners and perks.
- FR-18.6 **Main sponsor discount banner:** a rotating banner on the public site (home, events, packages pages and the ticket confirmation) showing main sponsors' discounts, with logo, offer, promo code, expiry and link.
- FR-18.7 Partnerships schedules each banner's start and end dates; expired offers disappear automatically; clicks are counted per sponsor per day for reporting.

### 19. Anonymous feedback box (Organizational Development)

- FR-19.1 Any logged-in member can send feedback, a problem or a suggestion; the site checks they are a member but never stores who sent it.
- FR-19.2 Fields: category (team issue, workload, conduct, idea, other), optional division it concerns, message, optional attachment.
- FR-19.3 The Organizational Development Curator and Executives read and handle it; status: new → in review → resolved, with an internal note on what was done.
- FR-19.4 The sender gets a private tracking code to check the status and read OD's reply later, still without revealing their name.
- FR-19.5 Feedback about OD itself is routed to the Chairman instead.
- FR-19.6 Monthly summary by category for the Chairman, with no identities, ever.
- FR-19.7 **How anonymity is enforced (not just promised):**
    - Feedback and attachments are saved by a server function using a service key, never as the logged-in member, so neither the database row nor the storage file records the sender.
    - Attachments have their metadata (EXIF, author, device) stripped before saving.
    - Submission time is stored as the date only, and items are shown to OD in batches, not instantly, so timing can't reveal the sender.
    - The audit log and app logs never record feedback submissions.
    - The tracking code is stored only as a hash.

### 20. Bonding and pop-up games (Associates' Experience + Associates' Development)

Members only. Built to get people from different teams to know each other, not just to work together.

**Pop-up games**

- FR-20.1 AE and AD build games from templates in the portal, no code: guess who (baby photo, fun fact, "who said this"), guess the emoji / song / movie, trivia quizzes, this-or-that polls.
- FR-20.2 Each game has a start and end time; when it goes live it pops up on every member's dashboard and sends a notification.
- FR-20.3 Answers are scored automatically; correct answers and speed earn points.
- FR-20.4 Members can submit content for games (e.g. their baby photo or a fun fact) that AE/AD approve before use.

**Photo challenges**

- FR-20.5 AE/AD post a challenge with a theme and deadline (e.g. "best TEDx red outfit", "photo with someone from another team").
- FR-20.6 Members upload photos; AE/AD approve them before they appear in the challenge gallery.
- FR-20.7 Members react and vote (one vote per member per challenge, not on their own photo); winners announced automatically at the deadline.

**Bonding features**

- FR-20.8 Fun-fact profiles: a few "get to know me" answers on each member's profile.
- FR-20.9 Buddy pairing: the site pairs members from different teams each month with a small shared challenge.
- FR-20.10 Shout-out wall: members thank or praise each other publicly inside the portal.
- FR-20.11 Birthday reminders on the dashboard (only for members who added a birthday).

**Points and prizes**

- FR-20.12 Leaderboards by member and by team, reset each month or season.
- FR-20.13 AE/AD set prizes for top scorers; points feed OD's engagement tracking.
- FR-20.14 Moderation: AE/AD can hide any photo, answer or post; everything stays inside the members' portal.

## Role dashboards

Each role lands on a different home screen after login.

| Role | Sees on login | Main actions |
| --- | --- | --- |
| Chairman | Season overview: all teams' progress, overdue tasks, budget vs spent, bank and cash balances, registrations, attendance rates, pending approvals | Approve large expenses and role changes, post announcements to all, run season rollover, view every report |
| Curator | Own division: members, task board, upcoming meetings, division budget vs spent, KPIs, open recruitment applications, expense requests waiting | Assign tasks to executives, approve division expense requests, schedule meetings, evaluate executives, edit own public-site section |
| Executive | Associates under them, their tasks and deadlines, meeting attendance to take, excuses waiting | Assign and review associates' tasks, take attendance, rate associates, submit expense requests |
| Associate | My tasks, my deadlines, next meetings, announcements, my attendance, my evaluation score, live games | Update task status, upload deliverables, RSVP to meetings, submit excuses and expense requests |
| Alumnus | Own history: past roles, certificates, past events | Browse the alumni directory, update profile |
| Guest | No login — public pages: upcoming events, public calendar, speakers, packages | Register for events, apply to join, buy packages, contact the team |

## Non-functional requirements

- **Security:** role checks enforced in the database with row-level security (RLS) on every table, not just hidden buttons; sensitive columns (phone numbers, balances) exposed only through views or server functions; HTTPS; no plain-text passwords; storage buckets private by default with signed URLs.
- **Privacy:** guests consent to data use at registration (FR-1.10); phone numbers hidden from Associates; data deletion on request within 30 days; applicant data auto-deleted (FR-4.8).
- **Performance:** pages load in under 2 s on mobile data; a check-in scan confirms in under 1 s, online or offline; handles ~1,500 registrations and ~1,200 check-ins on event day.
- **Mobile-first:** most members use phones; every screen works at 375 px width; check-in works as an installable web app (PWA) with offline mode (FR-5.7).
- **Availability:** no downtime on event days (no deploys within 24 h of an event); daily database backups, with a restore tested once per season.
- **Branding:** TEDx red (#E62B1E), black and white; follows TEDx brand rules; light and dark mode.
- **Language:** English first; layouts built so Arabic (RTL) can be added later without redesign.
- **Maintainability:** each new board can run it without the original developer: admin settings (FR-14.4) instead of code changes, and a short handover guide covering deploys, backups and adding a season.
- **Accessibility:** WCAG 2.1 AA contrast, alt text on images, keyboard navigation, status never shown by colour alone (attendance cards also show a label).
- **Cost:** runs on free tiers (Supabase, Vercel, Resend, Cloudflare Turnstile); paid items (WhatsApp API, custom domain) need a budget line approved by the Chairman.
- **Ownership:** all accounts (domain, Supabase, Vercel, GitHub, email) are owned by a shared TEDxGUC account, never one person's, and are transferred at every handover.

## Data model

The core tables needed to build the database. Membership is per season, so one person can be an Associate in 2026 and a Curator in 2027. Every table also has `created_at` and `updated_at`.

**People and structure**

| Table | Key fields |
| --- | --- |
| users | id, name, email, personal_email, phone, photo, major, semester, birthday, fun_facts (members only; guests have no account) |
| seasons | id, year, theme, is_active, opening_bank_balance, opening_cash_balance |
| divisions | id, season_id, name, curator_id, budget |
| teams | id, season_id, division_id, name, description |
| memberships | user_id, season_id, team_id, role (chairman / curator / executive / associate), reports_to, status (active / alumni / removed) |
| invites | id, email, season_id, team_id, role, invited_by, token_hash, expires_at, accepted_at |
| role_change_requests | id, user_id, from_role, to_role, team_id, requested_by, status, approved_by |
| settings | season_id, key, value (absence thresholds, late rule, evaluation weights, expense limit) |

**Public: events, recruitment, packages**

| Table | Key fields |
| --- | --- |
| events | id, season_id, type, title, date, venue, capacity, registration_opens, registration_closes, license_status, is_public, status |
| event_fields | id, event_id, label, type, required, options |
| registrations | id, event_id, guest_name, guest_email, guest_phone, answers, ticket_no, qr_code, status (registered / waitlisted / cancelled), status_token_hash, checked_in_at, checked_in_by, consent_at |
| run_of_show | id, event_id, starts_at, ends_at, item, owner_id |
| recruitment_cycles | id, season_id, opens_at, closes_at, kind (associates / board) |
| positions | id, cycle_id, team_id, seats, questions |
| applications | id, cycle_id, applicant_name, applicant_email, applicant_phone, team_choices, answers, cv_url, stage, status_token_hash, consent_at |
| interview_slots | id, cycle_id, starts_at, interviewer_ids, application_id |
| interview_scores | id, application_id, interviewer_id, score, notes |
| board_plans | id, cycle_id, user_id, team_id, answers, score, reviewer_notes |
| packages | id, season_id, name, photo, contents, price, stock, max_per_order, opens_at, closes_at |
| orders | id, package_id, buyer_name, buyer_email, buyer_phone, quantity, total, method (instapay / telda / cash), proof_url, reference, status (pending_proof / pending_approval / awaiting_cash / approved / rejected / expired / delivered / refunded), approved_by, delivered_at, status_token_hash |

**Work: tasks, meetings, communication**

| Table | Key fields |
| --- | --- |
| tasks | id, team_id, title, description, created_by, deadline, priority, status, requested_by_team_id |
| task_assignees | task_id, user_id |
| task_attachments | id, task_id, url, uploaded_by |
| task_comments | id, task_id, user_id, body |
| meetings | id, team_id, type, title, starts_at, slot, location, agenda, minutes, qr_secret |
| attendance | meeting_id, user_id, status (attended / absent / late / excused), marked_by, marked_at, note |
| excuses | id, meeting_id, user_id, note, attachment_url, status, decided_by |
| calendar_entries | id, season_id, created_by, team_id, visibility (club / team / public), title, starts_at, ends_at, location, linked_type, linked_id |
| announcements | id, author_id, audience_type (all / division / team / role), audience_id, body, pinned, needs_confirmation |
| announcement_reads | announcement_id, user_id, read_at |
| notifications | id, user_id, type, title, link, read_at |
| files | id, team_id, season_id, folder, name, url, visibility, is_handover |

**Talks, partners, finance, inventory**

| Table | Key fields |
| --- | --- |
| speakers | id, event_id, name, bio, photo, talk_title, outline, stage, release_form_url, is_public |
| partners | id, season_id, company, contact, tier, status |
| partner_deliverables | id, partner_id, item, owner_id, due_at, done_at |
| expense_requests | id, team_id, event_id, requested_by, item, amount, reason, quote_url, status (submitted / approved / rejected / purchased), curator_approved_by, chairman_approved_by, transaction_id |
| transactions | id, season_id, team_id, event_id, kind (cash_out / bank_deposit / sponsorship / package_sale / refund / opening_balance), direction (in / out), method (cash / bank / instapay / telda), amount_gross, vat_amount, amount_net, fatora_url, expense_form_url, memo_url, doc_number, status (pending / approved / void), void_reason, created_by, approved_by, order_id |
| reconciliations | id, season_id, month, bank_statement_balance, counted_cash, difference, entered_by |
| inventory_items | id, name, photo, category, quantity, condition, location, season_bought, cost |
| inventory_loans | id, item_id, borrower_id, event_id, quantity, taken_at, due_at, returned_at |
| packing_lists | id, event_id, item_id, quantity, packed_at, returned_at |

**Community: X Access, feedback, games, evaluations**

| Table | Key fields |
| --- | --- |
| xaccess_cards | id, holder_name, holder_email, qr_code, valid_until, status |
| perks | id, partner_id, description, terms, pin_hash, expires_at |
| perk_redemptions | id, card_id, perk_id, redeemed_at |
| sponsor_banners | id, partner_id, offer, promo_code, link, image, starts_at, ends_at |
| banner_clicks | banner_id, day, clicks |
| feedback | id, category, division_id, route_to (od / chairman), message, attachment_url, tracking_code_hash, status, internal_note, reply, submitted_on (date only; no sender stored) |
| games | id, type, title, starts_at, ends_at, content, created_by |
| game_submissions | id, user_id, type, content, approved_by |
| game_answers | id, game_id, user_id, answer, points, answered_at |
| photo_challenges | id, theme, deadline, created_by |
| photo_entries | id, challenge_id, user_id, photo_url, approved, hidden |
| photo_votes | entry_id, user_id |
| buddy_pairs | id, month, user_a, user_b, challenge, completed |
| shoutouts | id, from_user, to_user, message, hidden |
| points | id, user_id, team_id, source_type, source_id, points |
| prizes | id, season_id, period, title, winner_id |
| evaluations | id, user_id, evaluator_id, month, score, notes |
| certificates | id, user_id, season_id, pdf_url, verify_code |
| audit_log | id, user_id, action, target_type, target_id, before, after, created_at |

## Tech stack suggestion

Stay on Supabase, which TEDxGUC Cash already uses, so finance and the portal share one database.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js (React) + Tailwind CSS | Fast, mobile-friendly, easy for Claude to generate |
| Backend + database | Supabase (Postgres, Auth, Storage, Row-Level Security, Edge Functions) | Built-in Google login, role rules in the database, free tier |
| Hosting | Vercel | Free, deploys from GitHub on every push, preview links for testing |
| Email | Resend (free tier: 3,000 emails/month) | Tickets, status updates, reminders |
| WhatsApp | `wa.me` links first; WhatsApp Business API in Phase 3 | Free now, automated later once budgeted |
| Spam protection | Cloudflare Turnstile | Free, no puzzles for real users |
| QR | qrcode library + phone-camera scanner (html5-qrcode) | Tickets, check-in, attendance, X Access, orders |
| Offline check-in | Service worker + IndexedDB | Scanning keeps working without internet |
| PDFs | pdf-lib in an Edge Function | Expense forms, memos, certificates, reports |

**Email volume check:** a Main Event with 1,500 registrations needs ~3,000 emails (ticket + reminder), which uses the whole free monthly quota. Either send reminders in-app only, or budget for one paid month around the Main Event.

## MVP vs later phases

Build in three phases so the team can use something real early.

1. **Phase 1 — MVP:** public site (FR-1), login and profiles (FR-2), roles/teams/seasons (FR-3), events + ticketing + offline check-in (FR-5), tasks (FR-6), announcements (FR-8.1), calendar (FR-15).
2. **Phase 2 — Running the team:** recruitment (FR-4), meetings + attendance (FR-7), files + brand kit (FR-9), finance merged from TEDxGUC Cash with the expense request flow (FR-12), package sales ready before mid-year (FR-16).
3. **Phase 3 — Growth:** speakers pipeline (FR-10), partners CRM (FR-11), evaluations + certificates (FR-13), reports and audit log (FR-14), inventory (FR-17), X Access and sponsor banner (FR-18), anonymous feedback box (FR-19), bonding and pop-up games (FR-20), WhatsApp Business API (FR-8.4), Arabic version.

**Note:** the audit log table (FR-14.3) is built in Phase 1 even though its reports come in Phase 3, so role changes and finance entries are logged from day one.

## Acceptance criteria (Phase 1)

Phase 1 is done when all of these pass on a phone at 375 px:

- A guest registers for an event without an account, gets a ticket email with a QR within 1 minute, and can cancel it from the status link.
- When an event is full, the next registrant is waitlisted and is promoted automatically when someone cancels.
- A volunteer scans 50 tickets in a row with Wi-Fi turned off; every scan confirms in under 1 s, a second scan of the same ticket shows "already checked in", and all scans sync when Wi-Fi returns.
- A non-GUC Google account cannot log in; an invited GUC member logs in and lands on the dashboard for their role and team.
- An Associate calling the database API directly cannot read another team's tasks or any member's phone number (tested against RLS, not the UI).
- An Executive creates a team calendar entry; members of other teams can't see it; a public entry shows on the public calendar without login.
- The Chairman changes a member's role and the change appears in the audit log.

## Decisions to confirm

v2 makes these choices to fill gaps in v1. Change any that don't match how TEDxGUC works:

1. **Expense approval:** the member's Curator approves; requests above EGP 5,000 also need the Chairman (FR-12.10).
2. **Budget visibility:** non-Operations Curators see their division's budget vs spent, but never bank or cash balances (FR-12.7).
3. **Late rule:** 2 Lates = 1 absence by default, adjustable by OD (FR-7.6).
4. **Excuse deadline:** 48 hours after the meeting (FR-7.7).
5. **Applicant data:** deleted 6 months after the cycle closes (FR-4.8).
6. **WhatsApp:** free `wa.me` links until a budget exists for the Business API (FR-8.4).
7. **Package approvers:** any Operations member the Operations Curator assigns, not only Partnerships (FR-16.7).

## Open questions

- **Guest types — proposed answer:** VIPs, faculty and alumni are still guests with no account. A registration gets a `guest_type` tag (attendee / VIP / faculty / alumni / press) that controls seating, invitations and reserved tickets. A separate view is only needed if VIPs must see something attendees can't.
- **Domain and ownership — proposed answer:** register tedxguc.com (or similar) under a shared TEDxGUC Google account, with the Chairman and Operations Curator as admins. Transfer access at every season rollover. Who pays the yearly renewal (~USD 10–15) still needs an owner.
- Does GUC's Student Activities office need read access to finance or events (e.g. for approvals or audits)?
- Who signs expense forms and memos: the Operations Curator only, or the requester's Curator too?

**Decided**

- 2027 divisions and teams are set (see FR-3.2).
- TEDxGUC Cash is merged into this site (module 12).
- Tickets stay free; mid-year packages are sold on the site by InstaPay, Telda or cash (module 16); payments approved by the Operations division.
- Guests never sign in.
