import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUEST_CATEGORIES, REFERRAL_SOURCES, cleanRegistrationAnswers, guestTypeFor, registrationErrors, ticketTier } from '../../supabase/functions/_shared/event-registration.ts';
import { ticketEmail, statusLinkEmail } from '../../supabase/functions/_shared/templates.ts';

const answers = { gucian: 'Yes', guc_id: '58-1234', guest_category: 'Attendee', referral_source: 'University' };
const form = { name: 'Guest Name', email: 'guest@example.com', phone: '+20 100 000 0000', answers };

test('PDF options: Attendee is Regular; each other category is VIP', () => {
  assert.equal(GUEST_CATEGORIES.length, 5);
  for (const category of GUEST_CATEGORIES) {
    assert.equal(ticketTier(guestTypeFor(category)), category === 'Attendee' ? 'Regular' : 'VIP');
    assert.deepEqual(registrationErrors({ ...form, answers: { ...answers, guest_category: category } }), {});
  }
  for (const legacy of ['vip', 'faculty', 'alumni', 'press']) assert.equal(ticketTier(legacy), 'VIP');
});

test('GUC and non-GUC branches require their own ID number; no photo is needed', () => {
  assert.deepEqual(registrationErrors(form), {});
  assert.ok(registrationErrors({ ...form, answers: { ...answers, guc_id: '' } }).guc_id);
  assert.ok(registrationErrors({ ...form, answers: { ...answers, gucian: 'No' } }).national_id);
  assert.deepEqual(registrationErrors({ ...form, answers: { ...answers, gucian: 'No', national_id: '12345678901234' } }), {});
  assert.equal('photo' in registrationErrors(form), false);
});

test('all PDF required questions are validated; referral Other requires its text', () => {
  for (const key of ['gucian', 'guest_category', 'referral_source']) assert.ok(registrationErrors({ ...form, answers: { ...answers, [key]: '' } })[key]);
  for (const key of ['name', 'email', 'phone']) assert.ok(registrationErrors({ ...form, [key]: '' })[key]);
  assert.ok(registrationErrors({ ...form, answers: { ...answers, guest_category: 'VIP' } }).guest_category);
  for (const source of REFERRAL_SOURCES) {
    const a = { ...answers, referral_source: source, referral_other: source === 'Other' ? 'A friend' : '' };
    assert.deepEqual(registrationErrors({ ...form, answers: a }), {});
  }
  assert.ok(registrationErrors({ ...form, answers: { ...answers, referral_source: 'Other' } }).referral_other);
  assert.ok(registrationErrors({ ...form, answers: [] }).guest_category);
  assert.ok(registrationErrors({ ...form, answers: { ...answers, bad: { nested: 'value' } } }).answers);
});

test('changing branches discards the inactive identity and Other answer', () => {
  const original = { ...answers, national_id: 'old-id', referral_other: 'old answer' };
  assert.deepEqual(cleanRegistrationAnswers(original), answers);
  assert.equal(original.national_id, 'old-id');
  const nonGuc = cleanRegistrationAnswers({ ...original, gucian: 'No', national_id: 'new-id' });
  assert.equal(nonGuc.guc_id, undefined);
  assert.equal(nonGuc.national_id, 'new-id');
});

test('initial and resent ticket emails identify the ticket tier', () => {
  const t = { guest_name: 'Guest', guest_email: 'g@example.com', guest_type: 'vip', event_title: 'Event', starts_at: '2027-03-01T15:00:00Z', venue: 'GUC', ticket_no: 'TX-001' };
  assert.match(ticketEmail(t).text, /Ticket type: VIP/);
  assert.match(ticketEmail({ ...t, guest_type: 'attendee' }).text, /Ticket type: Regular/);
  assert.match(statusLinkEmail({ ...t, status: 'registered' }, 'private-link').text, /Ticket type: VIP/);
});
