import { useSyncExternalStore, useCallback, useMemo } from 'react';

/**
 * Hook to persist state in localStorage and keep it instantly synced across
 * all components and browser tabs using React 18's useSyncExternalStore.
 */
export function useLocalStorageSync(key, initialValue) {
  const subscribe = useCallback(
    (callback) => {
      const handleStorage = (e) => {
        if (e.key === key) {
          callback();
        }
      };

      const handleLocalDispatch = () => callback();

      window.addEventListener('storage', handleStorage);
      window.addEventListener(`local-storage-${key}`, handleLocalDispatch);

      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(`local-storage-${key}`, handleLocalDispatch);
      };
    },
    [key]
  );

  const getSnapshot = useCallback(() => {
    return localStorage.getItem(key);
  }, [key]);

  const serializedInitial = useMemo(() => JSON.stringify(initialValue), [initialValue]);

  const getServerSnapshot = useCallback(() => {
    return serializedInitial;
  }, [serializedInitial]);

  const storeValue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const parsedValue = useMemo(() => {
    if (storeValue === null) return initialValue;
    try {
      const val = JSON.parse(storeValue);
      return val || initialValue;
    } catch {
      return initialValue;
    }
  }, [storeValue, initialValue]);

  const setValue = useCallback(
    (newValue) => {
      const valueToStore = newValue instanceof Function ? newValue(parsedValue) : newValue;
      const raw = JSON.stringify(valueToStore);
      localStorage.setItem(key, raw);
      window.dispatchEvent(new Event(`local-storage-${key}`));
    },
    [key, parsedValue]
  );

  return [parsedValue, setValue];
}
