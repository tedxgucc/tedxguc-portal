# Ticket registration

Source: `Main Event Registration❌ - Google Forms.pdf` supplied by the user, pages 1–3. The ID-front photo question is intentionally omitted.

| Form question | Required | Stored in |
| --- | --- | --- |
| Full name | Always | `registrations.guest_name` |
| Are you a GUCian? (Yes / No) | Always | `answers.gucian` |
| GUC ID | GUCian = Yes | `answers.guc_id` |
| National ID number | GUCian = No | `answers.national_id` |
| Personal email | Always | `registrations.guest_email` |
| Phone number | Always | `registrations.guest_phone` |
| Guest type | Always | `answers.guest_category` |
| How did you reach TEDxGUC? | Always | `answers.referral_source` |
| Other referral details | Referral = Other | `answers.referral_other` |

Guest choices: Attendee, Speaker's Family, Ex-Board, Board Member Family, Sponsor. Attendee maps to stored type `attendee`, displayed as **Regular**. Every other choice maps to `vip`, displayed as **VIP**. The original choice remains available to event managers. Classification does not bypass capacity, the waitlist or the single-use QR check.

The registration form does not preview the ticket tier beneath the guest choice. After confirmation, the tier appears on the ticket. **Save ticket PNG** downloads the entire branded ticket at 3x resolution, including the QR, after fonts and images have loaded.

Referral choices: University, TEDxGUC Instagram, Speaker's Platforms, Other. The PDF's spelling is corrected in the interface. Event date, time and venue come from the configured event; the PDF's sample date does not overwrite event records. Additional event questions and privacy consent continue to apply.

Both the server function and database enforce the form requirements. Switching branches removes the inactive ID number and unused Other answer. No ID photo is requested, uploaded or downloaded. Identity answers are available only to event managers through the existing registration RLS policy; public ticket links and the scanner manifest do not include those answers.

## Deploy

1. Apply `supabase/migrations/20261026000020_ticket_registration.sql` in the project's Supabase SQL Editor (or via the normal migration CLI).
2. Deploy `public-forms`, including its shared modules: `supabase functions deploy public-forms`.
3. Publish the web build through the repository's GitHub Pages workflow.

The migration adds the form validation trigger and makes the ticket type available in ticket views, initial confirmation, resends and waitlist promotion. The server deployment updates validation messages and ticket-email wording. Existing registrations remain usable without fabricating identity data they never supplied.
