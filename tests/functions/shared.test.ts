// Unit tests for the parts of the server functions that don't need Deno.
// Run with: npm run test:functions
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, escapeText, fold } from '../../supabase/functions/_shared/ics.ts';
import { ticketEmail, waitlistEmail, formatCairo } from '../../supabase/functions/_shared/templates.ts';

test('ics: escapes text and folds long lines at 75 octets', () => {
  assert.equal(escapeText('A, B; C\\D\nE'), 'A\\, B\\; C\\\\D\\nE');
  const long = 'SUMMARY:' + 'x'.repeat(200);
  const folded = fold(long);
  for (const part of folded.split('\r\n')) assert.ok(new TextEncoder().encode(part).length <= 75);
  assert.equal(folded.replaceAll('\r\n ', ''), long);
});

test('ics: builds timed and all-day events with stable UIDs', () => {
  const ics = buildIcs([
    { source: 'event', id: 'e1', title: 'Main Event', starts_at: '2027-03-01T15:00:00Z', ends_at: null, all_day: false, location: 'GUC, Hall H', online_url: null },
    { source: 'entry', id: 'c1', title: 'Deadline day', starts_at: '2027-03-02T22:30:00Z', ends_at: null, all_day: true, location: null, online_url: 'https://meet.example.com/x' },
  ], 'TEDxGUC', new Date('2027-01-01T00:00:00Z'));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /UID:event-e1@tedxguc/);
  assert.match(ics, /DTSTART:20270301T150000Z\r\nDTEND:20270301T160000Z/);
  assert.match(ics, /LOCATION:GUC\\, Hall H/);
  // 22:30 UTC on 2 March is 3 March in Cairo.
  assert.match(ics, /DTSTART;VALUE=DATE:20270303/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test('emails: ticket email has the ticket number, QR image, Cairo time and TEDx disclaimer', () => {
  const t = { guest_name: 'Amira', guest_email: 'a@x.co', event_title: 'Salon <1>', starts_at: '2027-03-01T15:00:00Z', venue: 'Hall H', ticket_no: 'SAL27-0001' };
  const mail = ticketEmail(t, 'https://site/tickets/abc');
  assert.match(mail.subject, /SAL27-0001/);
  assert.match(mail.html, /cid:ticket-qr/);
  assert.match(mail.html, /Salon &lt;1&gt;/, 'HTML is escaped');
  assert.match(mail.text, /operated under license from TED/);
  assert.match(mail.text, new RegExp(formatCairo(t.starts_at).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(waitlistEmail({ ...t, waitlist_position: 4 }, 'u').text, /position 4/);
});
