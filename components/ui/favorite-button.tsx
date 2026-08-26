"use client";

import { Heart } from "lucide-react";
import { useFavoris } from "@/lib/local/favoris";

type FavoriteButtonProps = {
  produitId: number;
  size?: number;
};

// Le cœur "favori" utilise le noir (ink), jamais l'orange : l'orange est
// réservé exclusivement aux actions d'achat (CLAUDE.md section 4).
export function FavoriteButton({ produitId, size = 18 }: FavoriteButtonProps) {
  const { isFavori, toggleFavori } = useFavoris();
  const active = isFavori(produitId);

  return (
    <button
      type="button"
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={active}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavori(produitId);
      }}
      className="flex items-center justify-center rounded-full bg-white/90 p-1.5 text-ink/50 shadow-sm backdrop-blur transition-transform active:scale-90"
    >
      <Heart size={size} className={active ? "fill-ink text-ink" : ""} />
    </button>
  );
}
