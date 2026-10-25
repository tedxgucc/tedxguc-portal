'use client';
// Days / hours / minutes / seconds to the next event (design system: Countdown).
import { useEffect, useState } from 'react';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const two = (n: number) => String(n).padStart(2, '0');

export function Countdown({ to, title }: { to: string; title: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now !== null && now >= target) {
    return <div className="h2 uppercase" aria-live="polite">Happening now</div>;
  }
  const p = parts(now === null ? 0 : target - now);
  const cells: [string, number, string][] = [['Days', p.d, ''], ['Hrs', p.h, ''], ['Min', p.m, ''], ['Sec', p.s, 'tx-red']];
  return (
    <div>
      <div className="tx-label mb-s3">{title} starts in</div>
      <div className="tx-count" role="timer" aria-label={now === null ? undefined : `${p.d} days ${p.h} hours ${p.m} minutes`}>
        {cells.map(([label, v, cls]) => (
          <div key={label}>
            <span className={`stat ${cls}`} aria-hidden="true">{now === null ? '--' : two(v)}</span>
            <span className="tx-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
