import { useEffect, useRef } from 'react';

export function useAutoSave<T>(key: string, state: T, onSave?: (state: T) => void) {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(state));
      onSave?.(state);
    }, 1000);

    return () => clearTimeout(timer);
  }, [key, state, onSave]);

  const load = (): T | null => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  };

  return { load };
}
