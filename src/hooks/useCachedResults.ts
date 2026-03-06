import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

export function useCachedResults<T>(
  key: string,
  fetcher: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCacheKey = useCallback(() => `cached_${key}`, [key]);

  const getFromCache = useCallback((): T | null => {
    try {
      const cached = sessionStorage.getItem(getCacheKey());
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;

      if (isExpired) {
        sessionStorage.removeItem(getCacheKey());
        return null;
      }

      return entry.data;
    } catch (err) {
      console.error('Cache read error:', err);
      return null;
    }
  }, [getCacheKey]);

  const saveToCache = useCallback((data: T) => {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now()
      };
      sessionStorage.setItem(getCacheKey(), JSON.stringify(entry));
    } catch (err) {
      console.error('Cache write error:', err);
    }
  }, [getCacheKey]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Проверяем кеш
    if (!forceRefresh) {
      const cachedData = getFromCache();
      if (cachedData) {
        setData(cachedData);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
      saveToCache(result);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [fetcher, getFromCache, saveToCache]);

  useEffect(() => {
    fetchData();
  }, dependencies);

  const invalidateCache = useCallback(() => {
    sessionStorage.removeItem(getCacheKey());
    fetchData(true);
  }, [getCacheKey, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
    invalidateCache
  };
}
