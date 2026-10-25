'use client';
// Loads a page's data in the browser (the site is plain files on GitHub
// Pages, so there is no server to load it first).
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui';

export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [data, setData] = useState<T>();
  useEffect(() => {
    let alive = true;
    load().then((d) => { if (alive) setData(d); }).catch(() => {});
    return () => { alive = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}

export function PageLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s8 grid gap-s4" aria-busy="true">
      <Skeleton h={28} w={160} />
      <Skeleton h={64} w="70%" />
      <Skeleton h={240} />
    </div>
  );
}
