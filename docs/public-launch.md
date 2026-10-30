# Public launch

The public site keeps the black, white and TEDx red identity. Its approved navigation is Events, Speakers, Calendar, About and Board, with Home and Join the team in the mobile menu. Signups and X Access stay in the member flows; Partners is not in the public navigation.

## Preview and checks

From the repository root:

~~~sh
npm --prefix web run build
npm --prefix web run check:export
npm --prefix web start
~~~

Open http://localhost:3000. The preview serves the static export rather than using Next's server mode. For edits, use npm --prefix web run dev. Do not run a development server and a production build against the same .next directory at the same time.

No live values are configured in the local preview by default. Its sample names, speakers and events are clearly labeled as demo data. Demo builds carry noindex and disallow search crawlers.

## Release configuration

Set these build-time values in web/.env.local for a live local check, or in the deployment environment:

- NEXT_PUBLIC_SUPABASE_URL: the live project URL.
- NEXT_PUBLIC_SUPABASE_ANON_KEY: only an anon or publishable key. Never a service-role key.
- NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional. When using Cloudflare Turnstile, supply a production site key allowed for the real hostname; otherwise leave it unset.
- NEXT_PUBLIC_SITE_URL: the full HTTPS site URL, including /tedxguc-portal if using the repository Pages address.
- NEXT_PUBLIC_BASE_PATH: /tedxguc-portal for repository Pages, empty for a custom domain.

The existing Pages workflow already supplies the public Supabase connection. Only set the GitHub repository variable TURNSTILE_SITE_KEY if using Turnstile. Without Turnstile, leave both this variable and the Supabase TURNSTILE_SECRET_KEY unset. CUSTOM_DOMAIN is optional and should be a bare hostname, without https:// or a path. The workflow computes the canonical URL and base path, runs the launch guard, builds the export and checks internal links before deploying.

~~~sh
npm --prefix web run check:launch
npm --prefix web run check:launch -- --online
~~~

The online option makes anonymous read-only checks of public events and the public board. No email or form submission is sent. A passing configuration check does not prove that server secrets, email delivery or migrations are correct.

## Backend verification before announcing the launch

1. Apply all pending Supabase migrations in order, including the 20261029 migrations for announcement editing, scanner assignments, manual signup accounting and bank corrections.
2. Deploy the required Supabase functions. Confirm SITE_URL, TURNSTILE_SECRET_KEY, RESEND_API_KEY and EMAIL_FROM in the server environment. If using Turnstile, the secret must match the public site key; keep it out of frontend variables.
3. Confirm the production auth site URL and allowed callback/password-reset URLs, including the deployment prefix when needed.
4. Confirm the active season, published event, registration windows, current board names/photos and FAQ. Remove or replace any sample records in the live project.
5. With an email you control, register for an event, receive the email, open its private ticket link and confirm the correct event. Test the waitlist when capacity is reached.
6. Submit one contact message and one recruitment application using data you control. Verify the recipient and notification behavior. Do not test by messaging real applicants.
7. Test on iPhone and Android: menu, theme, event search, speaker profiles, registration validation, camera permissions and QR scanning. Check keyboard-only navigation and reduced-motion mode.
8. Verify the pg_cron publication job for scheduled announcements and the existing maintenance jobs. Publication visibility uses the database clock; scheduled notifications need the job to run.

## What was verified in this workspace

The production build and automated discovery/calendar/configuration tests run locally. The existing live public events and board APIs returned HTTP 200 to read-only requests. A connected browser was unavailable for visual QA. Live email delivery, form submissions, server configuration, migrations, cron execution and phone hardware have not been certified here.

Public data is still loaded in the browser because this site is a static export. Search/share metadata is provided for the public pages; individual query-string event pages use the general event/site metadata rather than server-rendered per-event social cards.

Live content snapshot on 30 October 2026: one public event, zero upcoming published events, and three public board profiles (one Chairman, one Curator, one Executive). Two profiles have photos. These are content gaps to complete before announcing the full board and next event.
