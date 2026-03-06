import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface AutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  delay?: number;
  storageKey: string;
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 3000,
  storageKey
}: AutoSaveOptions<T>) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<string>('');
  const isSavingRef = useRef(false);

  // Загрузка из localStorage при монтировании
  const loadFromStorage = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error('Auto-save load error:', err);
    }
    return null;
  }, [storageKey]);

  // Сохранение в localStorage
  const saveToStorage = useCallback((data: T) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (err) {
      console.error('Auto-save storage error:', err);
    }
  }, [storageKey]);

  // Автосохранение с задержкой
  useEffect(() => {
    const currentDataStr = JSON.stringify(data);
    
    // Пропускаем, если данные не изменились
    if (currentDataStr === lastSavedRef.current || isSavingRef.current) {
      return;
    }

    // Очищаем предыдущий таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Сохраняем в localStorage сразу
    saveToStorage(data);

    // Устанавливаем таймер для отправки на сервер
    timeoutRef.current = setTimeout(async () => {
      if (currentDataStr === lastSavedRef.current) return;

      isSavingRef.current = true;
      try {
        await onSave(data);
        lastSavedRef.current = currentDataStr;
        toast.success('Прогресс сохранен', { duration: 2000 });
      } catch (err) {
        console.error('Auto-save error:', err);
        toast.error('Ошибка автосохранения');
      } finally {
        isSavingRef.current = false;
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, onSave, saveToStorage]);

  // Очистка сохраненных данных
  const clearSaved = useCallback(() => {
    localStorage.removeItem(storageKey);
    lastSavedRef.current = '';
  }, [storageKey]);

  return {
    loadFromStorage,
    clearSaved
  };
}
