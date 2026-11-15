'use client';
// Homepage announcement while an orientation is coming up.
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { orientationApi } from '@/lib/api/orientation';
import { fmtDate } from '@/lib/format';

export function OrientationNotice() {
  const [days, setDays] = useState<string[] | null>(null);
  useEffect(() => { orientationApi.upcoming().then((u) => setDays(u ? u.days.filter((d) => Date.parse(d.ends_at) >= Date.now()).map((d) => d.starts_at) : null)).catch(() => {}); }, []);
  if (!days?.length) return null;
  return (
    <section className="home-orient-wrap" aria-label="Announcement">
      <Link href="/orientation" className="home-orient">
        <span className="home-orient__tag">Announcement</span>
        <span className="grid gap-[2px]">
          <span className="home-orient__t">TEDxGUC orientation · {days.map((d) => fmtDate(d)).join(' or ')}</span>
          <span className="home-orient__s">Meet the club and every team. Open to all GUC students.</span>
        </span>
        <span className="home-orient__go">Save my spot<ArrowRight size={16} aria-hidden="true" /></span>
      </Link>
    </section>
  );
}
