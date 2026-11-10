import { publicSnapshot } from '@/lib/build-data';
import EventsClient from './EventsClient';

export default async function EventsPage() {
  const s = await publicSnapshot();
  return <EventsClient initial={s && { upcoming: s.upcoming, past: s.past }} />;
}
