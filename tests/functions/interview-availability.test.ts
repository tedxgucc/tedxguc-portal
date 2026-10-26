import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availabilitySlots, defaultAvailability } from '../../web/src/lib/interview-availability.ts';
import { fromLocalInput } from '../../web/src/lib/format.ts';

test('multiple daily ranges produce exact interviews and breaks in Cairo time', () => {
  const schedule = defaultAvailability('2030-01-07'); // Monday
  schedule.lastDate = schedule.firstDate;
  schedule.weekly[1] = [{ from: '09:00', to: '10:00' }, { from: '18:00', to: '19:00' }];
  schedule.duration = 20; schedule.gap = 10;
  const slots = availabilitySlots(schedule, fromLocalInput, 0);
  assert.equal(slots.length, 4);
  assert.equal(slots[0].starts_at, '2030-01-07T07:00:00.000Z');
  assert.equal(slots[1].starts_at, '2030-01-07T07:30:00.000Z');
  assert.equal(slots[2].starts_at, '2030-01-07T16:00:00.000Z');
  assert.equal(Date.parse(slots[0].ends_at) - Date.parse(slots[0].starts_at), 20 * 60_000);
});

test('date-specific hours replace weekly hours, including unavailable days', () => {
  const schedule = defaultAvailability('2030-01-07');
  schedule.lastDate = '2030-01-08';
  schedule.weekly[1] = schedule.weekly[2] = [{ from: '09:00', to: '10:00' }];
  schedule.overrides = [{ date: '2030-01-07', ranges: [] }, { date: '2030-01-08', ranges: [{ from: '18:00', to: '18:40' }] }];
  assert.deepEqual(availabilitySlots(schedule, fromLocalInput, 0).map((s) => s.starts_at), ['2030-01-08T16:00:00.000Z', '2030-01-08T16:20:00.000Z']);
});

test('invalid, overlapping and excessive schedules fail; past slots are omitted', () => {
  const schedule = defaultAvailability('2030-01-07'); schedule.lastDate = schedule.firstDate;
  schedule.weekly[1] = [{ from: '09:00', to: '10:00' }, { from: '09:30', to: '11:00' }];
  assert.throws(() => availabilitySlots(schedule, fromLocalInput, 0), /overlap/);
  schedule.weekly[1] = [{ from: '10:00', to: '09:00' }];
  assert.throws(() => availabilitySlots(schedule, fromLocalInput, 0), /end must be after/);
  schedule.weekly[1] = [{ from: '09:00', to: '10:00' }];
  assert.equal(availabilitySlots(schedule, fromLocalInput, Date.parse('2030-01-07T07:20:00Z')).length, 1);
  schedule.lastDate = '2031-01-07';
  assert.throws(() => availabilitySlots(schedule, fromLocalInput, 0), /8 weeks/);
  schedule.firstDate = '2030-02-30'; schedule.lastDate = '2030-03-01';
  assert.throws(() => availabilitySlots(schedule, fromLocalInput, 0), /valid publishing/);
});

test('Cairo summer availability uses daylight saving offset', () => {
  const schedule = defaultAvailability('2030-07-01'); schedule.lastDate = schedule.firstDate;
  schedule.overrides = [{ date: schedule.firstDate, ranges: [{ from: '09:00', to: '09:20' }] }];
  assert.equal(availabilitySlots(schedule, fromLocalInput, 0)[0].starts_at, '2030-07-01T06:00:00.000Z');
});
