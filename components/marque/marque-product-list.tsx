"use client";

import { useCallback, useState } from "react";
import { ProductGrid } from "@/components/product/product-grid";
import { getProduitsByMarque, TAILLE_PAGE_CATEGORIE } from "@/lib/supabase/queries";
import { useChargementAuto } from "@/lib/hooks/use-chargement-auto";
import { DemanderProduit } from "@/components/demande/demander-produit";
import type { Produit } from "@/lib/supabase/types";

export function MarqueProductList({
  marque,
  produitsInitiaux,
  hasMoreInitial,
  totalInitial,
}: {
  marque: string;
  produitsInitiaux: Produit[];
  hasMoreInitial: boolean;
  totalInitial: number;
}) {
  const [produits, setProduits] = useState(produitsInitiaux);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [chargement, setChargement] = useState(false);

  const chargerPlus = useCallback(async () => {
    setChargement(true);
    const { items, hasMore: encoreApres } = await getProduitsByMarque(marque, {
      offset: produits.length,
      limit: TAILLE_PAGE_CATEGORIE,
    });
    setProduits((current) => [...current, ...items]);
    setHasMore(encoreApres);
    setChargement(false);
  }, [marque, produits.length]);

  // Fin de liste (maj-26-09 §8) : chargement automatique au scroll.
  const sentinelleRef = useChargementAuto(hasMore && !chargement, () => void chargerPlus());

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4">
        <span className="text-xs text-ink/50">
          {totalInitial} article{totalInitial > 1 ? "s" : ""}
        </span>
      </div>
      <ProductGrid produits={produits} emptyMessage="Aucun article de cette marque pour le moment." />
      <div ref={sentinelleRef} aria-hidden="true" />
      {chargement && <p className="pb-2 text-center text-xs text-ink/40">Chargement…</p>}
      {!hasMore && !chargement && produits.length > 0 && (
        <DemanderProduit origine="fin_de_liste" variante="discret" />
      )}
    </div>
  );
}
