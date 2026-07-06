"use client";

import { useCallback, useSyncExternalStore } from "react";

const LOCAL_EVENT = "local-pref-change";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb); // other tabs
  window.addEventListener(LOCAL_EVENT, cb); // this tab
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(LOCAL_EVENT, cb);
  };
}

/**
 * A string preference persisted in localStorage. Hydration-safe: the server
 * snapshot is the fallback, and React re-renders with the stored value after
 * mount (useSyncExternalStore handles the swap without a hydration mismatch).
 */
export function useLocalPref<T extends string>(
  key: string,
  fallback: T
): [T, (v: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => (localStorage.getItem(key) as T | null) ?? fallback,
    () => fallback
  );

  const set = useCallback(
    (v: T) => {
      localStorage.setItem(key, v);
      window.dispatchEvent(new Event(LOCAL_EVENT));
    },
    [key]
  );

  return [value, set];
}
