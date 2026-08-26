"use client";

import { useState } from "react";
import { ProductGrid } from "@/components/product/product-grid";
import { searchProduits, TAILLE_PAGE_CATALOGUE } from "@/lib/supabase/queries";
import type { Produit } from "@/lib/supabase/types";

type SearchResultsProps = {
  query: string;
  produitsInitiaux: Produit[];
  hasMoreInitial: boolean;
};

export function SearchResults({ query, produitsInitiaux, hasMoreInitial }: SearchResultsProps) {
  const [produits, setProduits] = useState(produitsInitiaux);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [chargement, setChargement] = useState(false);

  const chargerPlus = async () => {
    setChargement(true);
    const { items, hasMore: encoreApres } = await searchProduits(query, {
      offset: produits.length,
      limit: TAILLE_PAGE_CATALOGUE,
    });
    setProduits((current) => [...current, ...items]);
    setHasMore(encoreApres);
    setChargement(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <ProductGrid
        produits={produits}
        emptyMessage={
          query
            ? "Aucun produit ne correspond à ta recherche."
            : "Tape un mot-clé dans la barre de recherche."
        }
      />

      {hasMore && (
        <button
          type="button"
          onClick={chargerPlus}
          disabled={chargement}
          className="mx-4 rounded-full border border-ink/15 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {chargement ? "Chargement…" : "Charger plus"}
        </button>
      )}
    </div>
  );
}
