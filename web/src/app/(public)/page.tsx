import { publicSnapshot } from '@/lib/build-data';
import { homeData } from '@/lib/home-data';
import HomeClient from './HomeClient';

export default async function HomePage() {
  const s = await publicSnapshot();
  return <HomeClient initial={s && homeData(s.upcoming, s.past, s.speakers)} />;
}
