'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

// Public pages recover from failed requests instead of showing an endless skeleton.
export function usePublicData<T>(loader: () => Promise<T>, deps: DependencyList = []) {
  const latest = useRef(loader); latest.current = loader;
  const request = useRef(0);
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const id = ++request.current; setLoading(true); setError(null);
    try {
      const next = await latest.current();
      if (id === request.current) setData(next);
    } catch {
      if (id === request.current) setError(navigator.onLine ? 'We could not load this right now. Please try again.' : 'You are offline. Reconnect, then try again.');
    } finally { if (id === request.current) setLoading(false); }
  }, []);
  useEffect(() => { setData(undefined); void reload(); return () => { request.current++; }; }, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload };
}
