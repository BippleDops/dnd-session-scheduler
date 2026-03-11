'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);

  // Keep fetcher ref in sync without triggering re-renders
  useEffect(() => { fetcherRef.current = fetcher; });

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetcherRef.current()
      .then(setData)
      .catch(e => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
    // deps array passed from caller controls when to re-fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}

