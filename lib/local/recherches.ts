"use client";

import { useLocalList } from "./use-local-list";

const KEY = "sacado_recherches";
const MAX_RECHERCHES = 5;

// Historique des dernières recherches de l'appareil (comme les favoris / déjà
// consultés : local, sans compte). Affiché sous la barre quand elle est vide.
export function useRecherchesRecentes() {
  const [recherches, set] = useLocalList<string>(KEY);

  const enregistrer = (terme: string) => {
    const t = terme.trim();
    if (t.length < 2) return;
    set((current) => [
      t,
      ...current.filter((x) => x.toLowerCase() !== t.toLowerCase()),
    ].slice(0, MAX_RECHERCHES));
  };

  const vider = () => set(() => []);

  return { recherches, enregistrer, vider };
}
