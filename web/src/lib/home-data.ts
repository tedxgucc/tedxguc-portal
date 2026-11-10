import type { Speaker, TxEvent } from './types';

export type HomeData = { upcoming: TxEvent[]; past: TxEvent[]; next: TxEvent | null; featured: TxEvent | null; speakers: Speaker[]; allSpeakers: Speaker[] };

// The hero leads with the next main event, or the latest one while nothing is announced.
export function homeData(future: TxEvent[], history: TxEvent[], allSpeakers: Speaker[]): HomeData {
  const upcoming = future.filter((e) => e.type !== 'workshop');
  const past = history.filter((e) => e.type !== 'workshop' && e.status === 'completed' && e.slug);
  const next = upcoming[0] ?? null;
  const featured = upcoming.find((e) => e.type === 'main_event') ?? next ?? past.find((e) => e.type === 'main_event') ?? past[0] ?? null;
  const speakers = featured ? allSpeakers.filter((s) => s.event_id === featured.id) : [];
  return { upcoming, past, next, featured, speakers, allSpeakers };
}
