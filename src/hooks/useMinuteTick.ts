import { useState, useEffect } from 'react';

/**
 * Returns a counter that increments every `intervalMs` (default 60s).
 * Use as a dependency in useMemo/useEffect to force re-computation
 * of time-derived state (e.g. meeting status based on Date.now()).
 *
 * Lightweight: single setInterval, no network requests.
 */
export const useMinuteTick = (intervalMs = 60_000): number => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
};
