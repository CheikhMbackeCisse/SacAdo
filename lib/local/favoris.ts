"use client";

import { useRemoteList } from "./use-remote-list";
import { getFavorisAction, toggleFavoriAction } from "@/lib/moi/favoris-actions";

const KEY = "favoris";

// Favoris en base depuis TACHE_notifications_client.md (lot B6) : nécessaires
// pour détecter un retour en stock côté serveur. L'identité (session anonyme
// puis compte) est résolue côté serveur à partir du cookie — rien à fournir
// ici. API inchangée : les appelants (FavoriteButton, /favoris, /moi…)
// n'ont pas à changer.
export function useFavoris() {
  const [favoris, setFavoris] = useRemoteList<number>(KEY, getFavorisAction);

  const isFavori = (id: number) => favoris.includes(id);

  const toggleFavori = (id: number) => {
    setFavoris((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
    void toggleFavoriAction(id);
  };

  return { favoris, isFavori, toggleFavori };
}
