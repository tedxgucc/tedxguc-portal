'use client';
// Loads a page's data in the browser (the site is plain files on GitHub
// Pages). A saved copy from this tab shows at once on refresh; fresh data
// replaces it as soon as it arrives.
import { useEffect, useLayoutEffect, useState } from 'react';
import { Skeleton } from '@/components/ui';
import { readCache, writeCache } from './cache';

// useLayoutEffect runs before the browser paints, so the saved copy never flashes the placeholder.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [data, setData] = useState<T>();
  useBeforePaint(() => {
    const key = `page:${window.location.pathname}${window.location.search}`;
    const saved = readCache<T>(key);
    if (saved !== undefined) setData(saved);
    let alive = true;
    load().then((d) => { if (!alive) return; setData(d); writeCache(key, d); }).catch(() => {});
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
