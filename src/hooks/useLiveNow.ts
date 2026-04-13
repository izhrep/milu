import { useState, useEffect } from 'react';

/**
 * Returns a `Date` that refreshes every `intervalMs` (default 30s).
 * Use as a dependency to make time-based validation reactive.
 */
export const useLiveNow = (intervalMs = 30_000): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
};
