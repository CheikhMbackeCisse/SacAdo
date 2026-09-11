"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Même forme que use-local-list.ts, mais la source de vérité est le serveur
// (favoris / déjà consultés, migration 0064) plutôt que localStorage : un
// cache partagé en mémoire, une lecture au premier montage, des écritures
// optimistes diffusées à tous les composants abonnés au même `key`.
const cache = new Map<string, unknown[]>();
const charge = new Set<string>();
const listeners = new Map<string, Set<() => void>>();

function abonnes(key: string): Set<() => void> {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

function notifier(key: string) {
  for (const cb of abonnes(key)) cb();
}

function getSnapshot<T>(key: string): T[] {
  // Référence STABLE tant que rien n'est chargé : `?? []` créerait un nouveau
  // tableau à chaque appel, et useSyncExternalStore rerenderait en boucle en
  // le croyant changé à chaque fois ("Maximum update depth exceeded").
  if (!cache.has(key)) cache.set(key, []);
  return cache.get(key) as T[];
}

function getServerSnapshot<T>(): T[] {
  return [];
}

function definir<T>(key: string, liste: T[]) {
  cache.set(key, liste);
  notifier(key);
}

export function useRemoteList<T>(key: string, charger: () => Promise<T[]>) {
  useEffect(() => {
    if (charge.has(key)) return;
    charge.add(key);
    charger()
      .then((liste) => definir(key, liste))
      .catch(() => {
        // best-effort : la liste reste vide, un futur montage retentera.
        charge.delete(key);
      });
  }, [key, charger]);

  const liste = useSyncExternalStore(
    (callback) => {
      const set = abonnes(key);
      set.add(callback);
      return () => set.delete(callback);
    },
    () => getSnapshot<T>(key),
    () => getServerSnapshot<T>(),
  );

  const set = useCallback(
    (updater: (current: T[]) => T[]) => {
      definir<T>(key, updater(getSnapshot<T>(key)));
    },
    [key],
  );

  return [liste, set] as const;
}
