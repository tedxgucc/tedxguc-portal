# Stakeholder review: every requirement, every role

Oct 25, 2026 · checked against `docs/requirements.md` v2, the database (`supabase/migrations`), and the screens (`web/`).

For each requirement this lists who the stakeholders are, what each must be able to **do**, and whether the backend (**DB**) and the **screen** support it.

**Key:** ✅ done · 🟡 partly · ❌ missing · — not needed

**Roles:** **Ch** Chairman · **Cu** Curator (own division) · **Ex** Executive (own team only) · **As** Associate · **G** Guest · named teams (L&P, Partnerships, OD, Talks…) where the power belongs to one team.

**Decision applied (Oct 25):** an Executive sees and manages **only his own team**, everywhere. He creates his team's work directly; cross-team task requests are for Curators and the Chairman only (migration 0012).

---

## Summary: what each stakeholder can't do yet

| Stakeholder | Missing (Phase 1–2) |
| --- | --- |
| **Chairman** | Season rollover screen · approve role changes · set up teams/divisions and settings · audit log viewer · score board plans · see pending approvals on the dashboard · **approve expenses over the limit** · **balances & budgets** |
| **Curator** | Edit own public-site section · request role changes · review/decide recruitment · **division attendance rates** · **approve division expenses + budget** · run of show and event questions (Ops) |
| **Executive** | **Take attendance + meeting QR** · **decide excuses** · interview notes/scores · team files · **submit expense requests** · sees only own team on the Team page |
| **Associate** | **My attendance + excuses + QR check-in** · submit expense requests · team files · task attachments |
| **L&P Executive** | **Cash out + fatora upload · expense form + memo (paperwork)** · run of show · inventory (Phase 3) |
| **Partnerships Executive** | **Bank deposits (VAT) · sponsorships** · partner logo wall · inquiry inbox |
| **Operations Curator** | **All money + bank/cash balances · reconciliation** · package approvals · event questions, staff, waitlist promotion |
| **OD** | Set absence thresholds (settings) · feedback box & games (Phase 3) |
| **Talks** | Speaker cards on the public site (management screen) |
| **Guest** | Apply to join (form + status page) · buy packages (Phase 2) · post-event feedback survey |

**Bold** items (attendance and finance) were built on Oct 25 and checked in the browser for each role. The rest is listed below with where it belongs.

---

## 1. Public website

| FR | Stakeholders → what they do | DB | Screen | Gap |
| --- | --- | --- | --- | --- |
| 1.1 Home | G views countdown, registers · Ch/Cu set season theme | ✅ | ✅ | Theme editing has no screen (seasons table) |
| 1.2 About | G reads · Ch edits text · board list automatic | ✅ | 🟡 | No editor for sections |
| 1.3 Events | G views upcoming/past · Ops Cu publishes | ✅ | 🟡 | Gallery and talk videos not built (needs fields) |
| 1.4 Speakers | G views · **Talks** Cu/Ex publish cards | ✅ | 🟡 | No screen for Talks to add/publish speakers |
| 1.5 Partners | G views wall, sends inquiry · **Partnerships** manage logos · Ch/Ops Cu/Partnerships read inquiries | ✅ | 🟡 | No logo manager · **no inquiry inbox** |
| 1.6 Join | G sees open roles, applies | ✅ (0007) | ✅ | Application form + status page built Oct 25 |
| 1.7 Contact/FAQ | G reads FAQ, writes · Ch + Curators read | ✅ | 🟡 | FAQ editor and inbox missing |
| 1.8 License | G sees line on every page · Ops can't publish unlicensed | ✅ | ✅ | — |
| 1.9 Spam/rate limit | G on every form | ✅ | ✅ | Turnstile key needed in production |
| 1.10 Consent | G on every form | ✅ | ✅ | — |
| Matrix: "Curator edits content of own area" | Cu edits own division section | ✅ | ❌ | **Site sections editor** |

## 2. Accounts

| FR | Stakeholders → what they do | DB | Screen | Gap |
| --- | --- | --- | --- | --- |
| 2.1 Login | all members | ✅ | ✅ | — |
| 2.2 Guests no account | G uses status links | ✅ | ✅ | Ticket, application and order status pages |
| 2.3 Invites | Ch invites anyone · Cu invites Ex/As to own division | ✅ | ✅ | — |
| 2.4 Reset / timeout / sign out everywhere | all | 🟡 | 🟡 | Timeout needs Supabase Pro or an inactivity timer in the app |
| 2.5 Profile | all edit own | ✅ | 🟡 | Photo upload, social links, birthday missing |
| 2.6 Personal email | alumni | ✅ | ❌ | "Change login email" on profile |
| 2.7 Status links | G | ✅ | ✅ | — |

## 3. Roles, teams, seasons

| FR | Stakeholders → what they do | DB | Screen | Gap |
| --- | --- | --- | --- | --- |
| 3.1–3.3 Roles | Ch assigns · Cu scoped to division · **Ex scoped to own team** | ✅ | 🟡 | Team page shows everyone to Executives; **scope to own team** |
| 3.2 Configure teams | Ch | ✅ | ❌ | Admin screen for seasons/divisions/teams |
| 3.4 Rollover | Ch | ✅ | ❌ | Rollover screen + handover check |
| 3.5 Org chart | all | ✅ | ✅ | — |
| 3.6 Role changes | Cu requests · Ch approves | ✅ | ❌ | Request + approval screens |

## 4. Recruitment (Phase 2), screens built Oct 25

| FR | Stakeholders → what they do | DB | Screen |
| --- | --- | --- | --- |
| 4.1 Cycles | Ch opens · Cu adds positions + questions for own teams | ✅ | ✅ |
| 4.2 Apply | G fills form, uploads CV | ✅ | ✅ |
| 4.3 Pipeline | Cu moves stages (bulk) · Ex sees own team's applicants | ✅ | ✅ |
| 4.4 Interviews | Ex/Cu add slots · G books by link · Ex scores | ✅ | ✅ |
| 4.5 Accept | Cu one click → invite | ✅ | ✅ |
| 4.6 Status emails | G receives · Cu releases rejections | ✅ | ✅ |
| 4.7 Board plans | Ex/Cu candidates write plan · Ch scores | ✅ | ✅ |
| 4.8 Purge | system | ✅ | — |

## 5. Events & ticketing

| FR | Stakeholders → what they do | DB | Screen | Gap |
| --- | --- | --- | --- | --- |
| 5.1 Create event | Ops Cu / Ch | ✅ | ✅ | — |
| 5.2 Registration + custom fields + waitlist | G registers · Ops Cu sets questions | ✅ | 🟡 | **No editor for registration questions** |
| 5.3 Ticket + QR | G | ✅ | ✅ | WhatsApp sending is Phase 3 |
| 5.4 Check-in | Ops members, all Ex, **assigned staff (As)** | ✅ | 🟡 | **No screen for Ops Cu to assign door staff** |
| 5.5 Run of show | **L&P Ex** edits · members read | ✅ | ❌ | Run-of-show screen |
| 5.6 Post-event | G gets survey · Ops exports attendance | ❌ survey | 🟡 export | Feedback survey not built anywhere |
| 5.7 Offline | door staff | ✅ | ✅ | Test on a real phone |
| 5.8 Manual lookup | door staff | ✅ | ✅ | — |
| Waitlist after raising capacity | Ops Cu | ✅ | ❌ | "Fill new seats" button |

## 6. Tasks

| FR | Stakeholders → what they do | DB | Screen | Gap |
| --- | --- | --- | --- | --- |
| 6.1 Create | **Ex for own team** · Cu for division · Ch any | ✅ | ✅ | Attachments upload missing |
| 6.2 Status | As moves own; Ex/creator marks done | ✅ | ✅ | — |
| 6.3 Comments | everyone on the task | ✅ | ✅ | — |
| 6.4 Reminders | As/Ex/Cu notified | ✅ | ✅ (notifications) | — |
| 6.5 Cross-team | **Cu/Ch send** · receiving Ex accepts/declines | ✅ (0012) | ✅ | — |

## 7. Meetings & attendance (Phase 2), screens built Oct 25

| FR | Stakeholders → what they do | DB | Screen |
| --- | --- | --- | --- |
| 7.1 Schedule | **Ex own team** · Cu division · Ch club/board · OD Ex club workshops | ✅ | ✅ |
| 7.2 Minutes → tasks | organiser | ✅ | ✅ |
| 7.3 My attendance | **As** (and Ex/Cu for board meetings) | ✅ | ✅ |
| 7.4 Take attendance (48 h) + QR | **Ex own associates** · Cu after 48 h · As scans QR | ✅ | ✅ |
| 7.5 Rates | **Cu division** · Ch club · Ex own team | ✅ | ✅ |
| 7.6 Levels | OD sets thresholds · As warned · Cu notified | ✅ | 🟡 levels shown; thresholds editor comes with Settings |
| 7.7 Excuses | **As** sends · **Ex** decides | ✅ | ✅ |
| 7.8 Feeds evaluations | OD (Phase 3) | ✅ | — |

## 8. Communication

| FR | Stakeholders → what they do | DB | Screen | Gap |
| --- | --- | --- | --- | --- |
| 8.1 Announcements | Ch all · Cu division · **Ex own team** · As reads/confirms | ✅ | ✅ | — |
| 8.2 Notifications | all | 🟡 | 🟡 | Email preferences not built |
| 8.4 WhatsApp | G, members | 🟡 links | 🟡 | API is Phase 3 |

## 9. Files (Phase 2), screens built Oct 25

| FR | Stakeholders → what they do | DB | Screen |
| --- | --- | --- | --- |
| 9.1 Folders | Ch/Cu club & board · Cu division · **Ex own team** upload · As view | ✅ | ✅ |
| 9.2 Brand kit | Cu upload, everyone reads | ✅ | ✅ |
| 9.4 Handover | Ex/Cu upload · Ch checks | ✅ | ✅ |

## 12. Finance (Phase 2), screens built Oct 25

| FR | Stakeholders → what they do | DB | Screen |
| --- | --- | --- | --- |
| 12.2 Cash out + fatora | **L&P Ex** records, uploads fatora; missing fatora flagged | ✅ | ✅ |
| 12.3 Paperwork | **L&P Ex** generates numbered expense form + memo PDFs | ✅ | ✅ |
| 12.4 Bank + sponsors | **Partnerships Ex** records deposits (net of VAT), manages sponsor approvals | ✅ | ✅ |
| 12.5 / 12.6 Everything + balances | **Ops Cu**, **Ch** | ✅ | ✅ |
| 12.7 Others | **As/Ex** submit requests · **other Cu** see division budget and approve | ✅ | ✅ |
| 12.8 Void only | creator / Ops Cu / Ch | ✅ | ✅ |
| 12.9 Filters + export | Ops Cu / Ch | ✅ | ✅ |
| 12.10 Approval flow | **Cu** approves · **Ch** over EGP 5,000 · L&P buys | ✅ | ✅ |
| 12.11 Reconciliation | **Ops Cu** | ✅ | ✅ |
| Budgets | **Ch** sets per division | ✅ | ✅ |

## 14–16. Reports, calendar, packages

| FR | Stakeholders → what they do | DB | Screen | Gap |
| --- | --- | --- | --- | --- |
| 14.3 Audit log | Ch reads | ✅ | ❌ | Viewer |
| 14.4 Settings | Ch (OD thresholds, expense limit, VAT…) | ✅ | ❌ | Settings screen |
| 15 Calendar | Ch/Cu club-wide · Cu division teams · **Ex own team** · As view · G public | ✅ | ✅ | Reminders and linking an entry to a meeting/event not in the form |
| 16 Packages | G orders/pays · **Ops approvers** approve, mark cash, pickup · Ops Cu refunds, prices, stock, approvers | ✅ | ✅ | Built Oct 25 |

## Dashboards (Role dashboards table)

| Role | Required | Has | Missing |
| --- | --- | --- | --- |
| Chairman | progress, overdue, budget vs spent, registrations, attendance rates, pending approvals | progress, overdue, registrations, members | **budget vs spent, attendance, pending approvals** |
| Curator | members, board, meetings, budget, KPIs, applications | tasks, calendar | **budget, attendance, approvals** |
| Executive | his associates, tasks, attendance to take | tasks, calendar | **attendance to take, his associates** |
| Associate | tasks, deadlines, meetings, news, my attendance, evaluation | tasks, calendar, news | **my attendance level** |
| Guest | events, calendar, speakers, apply, packages, contact | events, calendar, speakers, contact | apply, packages |

## Build order

1. ~~Attendance and finance screens for every stakeholder, the Executive own-team scope, and the dashboard cards they feed.~~ Done Oct 25.
2. ~~Rest of Phase 2: recruitment, files and handover, package sales.~~ Done Oct 25.
3. **Admin gaps found here:** Ch settings / teams / rollover / role changes / audit log, Cu site-section editor, inquiry inbox, registration questions, door staff assignment, run of show, speaker and partner managers.
4. **Not in any phase yet:** the post-event feedback survey (FR-5.6), and event gallery/videos (FR-1.3).

## Rule changes from the club (2026-10-25)

| Area | Who | Now |
|---|---|---|
| Sign-ups (packages, trips, anything with registration) | Chairman, OD Curator, Ops Curator, L&P Executives, AE Executives | Create and manage at `/portal/packages` with a Google-Forms-style question builder; see responses and export them. Associates never see this page. |
| Sign-ups | All members | Members only (no longer on the public site). Browse and sign up at `/portal/signups`; free ones are confirmed at once. Migration 0014: `member_sign_up`, `member_order_link`. |
| Recruitment | Applicants | Apply with name, GUC ID, email, phone, major, first choice, second preference. |
| Recruitment | Executives | Only "My availability": pick a day, a from–to window and an interview length (Calendly style); see who booked. No board applications. |
| Money requests | L&P Executives ask; Ops Curator decides; Chairman over the limit | Nobody else sees requests or the Finance page unless they record cash or deposits. |
| Events | Chairman, Ops Curator | Full-screen editor: General (site) or Internal (announced to the club, in the calendar), cover photo, agenda, speakers with photos. |
| Announcements | Board | Optional photo; a scrolling billboard on the portal home and News page. |
| Door scanner | Chairman, Ops Curator, L&P Executives; L&P Associates on event day only; added door staff | Enforced in `can_check_in` and in the menu. |
