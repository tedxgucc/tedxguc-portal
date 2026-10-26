export type TimeRange = { from: string; to: string };
export type InterviewAvailability = {
  weekly: TimeRange[][];
  overrides: { date: string; ranges: TimeRange[] }[];
  firstDate: string; lastDate: string; duration: number; gap: number; location: string;
};
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY = 86400_000;
export const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const defaultAvailability = (date: string): InterviewAvailability => ({
  weekly: WEEKDAYS.map(() => []), overrides: [], firstDate: date, lastDate: shiftDate(date, 13), duration: 20, gap: 0, location: '',
});
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
const minutes = (value: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Enter a valid start and end time.');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
};
function checkRanges(ranges: TimeRange[], label: string) {
  const sorted = ranges.map((r) => ({ from: minutes(r.from), to: minutes(r.to) })).sort((a, b) => a.from - b.from);
  sorted.forEach((r, i) => {
    if (r.to <= r.from) throw new Error(`${label}: the end must be after the start.`);
    if (i && r.from < sorted[i - 1].to) throw new Error(`${label}: time ranges overlap.`);
  });
}

// The caller supplies the app's Cairo wall-time conversion, independent of
// the browser's timezone. A date override replaces that day's weekly hours.
export function availabilitySlots(schedule: InterviewAvailability, toInstant: (wall: string) => string, now = Date.now()) {
  if (!validDate(schedule.firstDate) || !validDate(schedule.lastDate) || schedule.lastDate < schedule.firstDate) throw new Error('Choose a valid publishing date range.');
  if (Date.parse(schedule.lastDate) - Date.parse(schedule.firstDate) > 55 * DAY) throw new Error('Publish up to 8 weeks at a time.');
  if (![15, 20, 30, 45, 60].includes(schedule.duration) || ![0, 5, 10, 15].includes(schedule.gap)) throw new Error('Choose a valid interview length and break.');
  if (schedule.weekly.length !== 7) throw new Error('Set availability for all seven days.');
  schedule.weekly.forEach((ranges, i) => checkRanges(ranges, WEEKDAYS[i]));
  const dates = new Set<string>();
  schedule.overrides.forEach((o) => {
    if (!validDate(o.date) || dates.has(o.date)) throw new Error('Each date-specific entry needs a unique, valid date.');
    dates.add(o.date); checkRanges(o.ranges, o.date);
  });
  const slots: { starts_at: string; ends_at: string }[] = [];
  for (let date = schedule.firstDate; date <= schedule.lastDate; date = shiftDate(date, 1)) {
    const ranges = schedule.overrides.find((o) => o.date === date)?.ranges ?? schedule.weekly[new Date(`${date}T12:00:00Z`).getUTCDay()];
    for (const range of ranges) {
      const end = Date.parse(toInstant(`${date}T${range.to}`));
      for (let start = Date.parse(toInstant(`${date}T${range.from}`)); start + schedule.duration * 60_000 <= end; start += (schedule.duration + schedule.gap) * 60_000) {
        if (start <= now) continue;
        slots.push({ starts_at: new Date(start).toISOString(), ends_at: new Date(start + schedule.duration * 60_000).toISOString() });
        if (slots.length > 500) throw new Error('Too many slots. Choose a shorter publishing period.');
      }
    }
  }
  return slots.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
