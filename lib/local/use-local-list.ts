"use client";

import { useCallback, useSyncExternalStore } from "react";

// Petit magasin local (localStorage) via useSyncExternalStore : localStorage
// est un système externe, donc on s'y abonne plutôt que de faire un setState
// synchrone dans un effect (favoris, déjà consultés, panier "sans compte").
const cache = new Map<string, unknown[]>();

function readFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function getSnapshot<T>(key: string): T[] {
  if (!cache.has(key)) {
    cache.set(key, readFromStorage<T>(key));
  }
  return cache.get(key) as T[];
}

function getServerSnapshot<T>(): T[] {
  return [];
}

function setSnapshot<T>(key: string, list: T[]) {
  cache.set(key, list);
  window.localStorage.setItem(key, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(`sacado:${key}`));
}

function subscribe(key: string, callback: () => void) {
  const onCustomEvent = () => callback();
  const onStorageEvent = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      cache.delete(key);
      callback();
    }
  };
  window.addEventListener(`sacado:${key}`, onCustomEvent);
  window.addEventListener("storage", onStorageEvent);
  return () => {
    window.removeEventListener(`sacado:${key}`, onCustomEvent);
    window.removeEventListener("storage", onStorageEvent);
  };
}

export function useLocalList<T>(key: string) {
  const list = useSyncExternalStore(
    (callback) => subscribe(key, callback),
    () => getSnapshot<T>(key),
    () => getServerSnapshot<T>(),
  );

  const set = useCallback(
    (updater: (current: T[]) => T[]) => {
      const next = updater(getSnapshot<T>(key));
      setSnapshot<T>(key, next);
    },
    [key],
  );

  return [list, set] as const;
}
