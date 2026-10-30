import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { filterEvents, filterSpeakers, registrationState, safeExternalUrl } from '../../web/src/lib/public-discovery.ts';
import { eventCalendar } from '../../web/src/lib/public-calendar.ts';
import type { TxEvent, Speaker } from '../../web/src/lib/types.ts';
const event = (patch: Partial<TxEvent> = {}) => ({ id: 'e1', title: 'Loose Ends', description: 'Ideas, people; new perspectives', type: 'main_event', status: 'published', starts_at: '2027-03-20T15:00:00Z', ends_at: '2027-03-20T20:00:00Z', registration_opens_at: null, registration_closes_at: null, venue: 'GUC Main Hall', ...patch } as TxEvent);

test('event discovery combines case-insensitive text and type filters', () => {
 const events = [event(), event({ id: 'e2', title: 'Small Conversations', type: 'salon', venue: 'Campus garden' })];
 assert.deepEqual(filterEvents(events, '  LOOSE  ', '').map((e) => e.id), ['e1']);
 assert.deepEqual(filterEvents(events, 'garden', 'salon').map((e) => e.id), ['e2']);
 assert.equal(filterEvents(events, 'garden', 'main_event').length, 0);
 assert.equal(filterEvents(events, '', '').length, 2);
});
test('speaker discovery searches names, biographies and talk titles within an event', () => {
 const rows = [{ id: 's1', name: 'Laila', bio: 'Architect', talk_title: 'Rebuilding cities', event_id: 'e1' }, { id: 's2', name: 'Omar', bio: null, talk_title: null, event_id: 'e2' }] as Speaker[];
 assert.deepEqual(filterSpeakers(rows, 'CITIES', 'e1').map((s) => s.id), ['s1']);
 assert.equal(filterSpeakers(rows, 'architect', 'e2').length, 0);
 assert.equal(filterSpeakers(rows, 'omar', '').length, 1);
});
test('ticket labels follow registration windows and event status', () => {
 const now = Date.parse('2027-03-01T12:00:00Z');
 assert.equal(registrationState(event(), now), 'open');
 assert.equal(registrationState(event({ registration_opens_at: '2027-03-02T00:00:00Z' }), now), 'soon');
 assert.equal(registrationState(event({ registration_closes_at: '2027-03-01T12:00:00Z' }), now), 'closed');
 assert.equal(registrationState(event({ status: 'cancelled' }), now), 'closed');
 assert.equal(registrationState(event({ starts_at: '2027-03-01T12:00:00Z' }), now), 'closed');
});
test('calendar downloads escape content and fold UTF-8 lines without splitting characters', () => {
 const calendar = eventCalendar(event({ description: 'Hello, world;\n' + String.fromCodePoint(0x1f4a1).repeat(80) }), 'https://example.com/event/?s=loose-ends', new Date('2026-10-30T00:00:00Z'));
 assert.match(calendar, /DTSTART:20270320T150000Z/);
 assert.match(calendar, /DTEND:20270320T200000Z/);
 assert.ok(calendar.includes('DESCRIPTION:Hello\\, world\\;\\n'));
 for (const line of calendar.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
 assert.ok(!calendar.includes(String.fromCharCode(0xfffd)));
 assert.ok(calendar.replace(/\r\n /g, '').includes(String.fromCodePoint(0x1f4a1).repeat(80)));
 assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
 assert.throws(() => eventCalendar(event(), 'javascript:alert(1)'));
 assert.ok(!eventCalendar(event({ ends_at: null }), 'https://example.com').includes('DTEND'));
});
test('external content links allow only HTTP and HTTPS', () => {
 assert.equal(safeExternalUrl('javascript:alert(1)'), null);
 assert.equal(safeExternalUrl('data:text/html,hello'), null);
 assert.equal(safeExternalUrl(null), null);
 assert.equal(safeExternalUrl('https://example.com/talk'), 'https://example.com/talk');
});
test('launch checks allow optional Turnstile and reject unsafe configured keys', () => {
 const cwd = fileURLToPath(new URL('../../web/', import.meta.url));
 const key = (role: string) => 'test.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature';
 const base = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://example.com/site', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAAEXAMPLEPRODUCTIONKEY', NEXT_PUBLIC_SUPABASE_ANON_KEY: key('anon') };
 const run = (patch = {}) => spawnSync(process.execPath, ['scripts/check-launch.mjs'], { cwd, env: { ...base, ...patch }, encoding: 'utf8' });
 assert.equal(run().status, 0);
 assert.equal(run({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: '' }).status, 0);
 assert.equal(run({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'invalid' }).status, 1);
 const secret = key('service_role'); const rejected = run({ NEXT_PUBLIC_SUPABASE_ANON_KEY: secret });
 assert.equal(rejected.status, 1); assert.ok(!rejected.stdout.includes(secret));
 assert.equal(run({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' }).status, 1);
 assert.equal(run({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }).status, 1);
});
