"use client";

import { useLocalList } from "./use-local-list";

const KEY = "sacado_favoris";

export function useFavoris() {
  const [favoris, setFavoris] = useLocalList<number>(KEY);

  const isFavori = (id: number) => favoris.includes(id);

  const toggleFavori = (id: number) => {
    setFavoris((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  return { favoris, isFavori, toggleFavori };
}
