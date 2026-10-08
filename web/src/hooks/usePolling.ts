import { useEffect, useRef, useState } from 'react';

interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Polls `fetcher` every `intervalMs` while `active` is true.
 * Always fetches once immediately on mount / when `active` becomes true.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  active: boolean,
  deps: unknown[] = []
): PollingState<T> {
  const [state, setState] = useState<PollingState<T>>({ data: null, error: null, loading: true });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const data = await fetcherRef.current();
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            data: prev.data,
            error: err instanceof Error ? err.message : 'Request failed',
            loading: false
          }));
        }
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, intervalMs, ...deps]);

  return state;
}
