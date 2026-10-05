"use client";

import { useCallback, useState } from "react";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { FinDeListe } from "@/components/product/fin-de-liste";
import { getProduitsSimilaires } from "@/lib/supabase/queries";
import { useChargementAuto } from "@/lib/hooks/use-chargement-auto";
import type { Produit } from "@/lib/supabase/types";

const TAILLE_PAGE_SIMILAIRES = 12;

type SimilarProductsProps = {
  produitId: number;
  categorieId: number;
  sousCategorieId: number | null;
  produitsInitiaux: Produit[];
  hasMoreInitial: boolean;
};

// Vous aimerez aussi (Lot 2, prompt partage/mobilier/fournisseurs) : au moins
// 12 produits dès le chargement, puis la suite au défilement — même liste que
// getProduitsSimilaires côté serveur, juste paginée plus loin.
export function SimilarProducts({
  produitId,
  categorieId,
  sousCategorieId,
  produitsInitiaux,
  hasMoreInitial,
}: SimilarProductsProps) {
  const [produits, setProduits] = useState(produitsInitiaux);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [chargement, setChargement] = useState(false);
  const [enErreur, setEnErreur] = useState(false);

  const chargerSuite = useCallback(async () => {
    setChargement(true);
    setEnErreur(false);
    try {
      const { items, hasMore: encoreApres } = await getProduitsSimilaires(
        { id: produitId, categorieId, sousCategorieId },
        { offset: produits.length, limit: TAILLE_PAGE_SIMILAIRES },
      );
      setProduits((current) => [...current, ...items]);
      setHasMore(encoreApres);
    } catch {
      setEnErreur(true);
    } finally {
      setChargement(false);
    }
  }, [produitId, categorieId, sousCategorieId, produits.length]);

  const sentinelleRef = useChargementAuto(hasMore && !chargement && !enErreur, chargerSuite);

  if (produits.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-4 font-heading text-base font-semibold text-ink">Vous aimerez aussi</h2>
      <ProductGrid produits={produits} />
      <div ref={sentinelleRef} aria-hidden="true" />
      {chargement && <ProductGridSkeleton />}
      {enErreur && !chargement && (
        <button
          type="button"
          onClick={chargerSuite}
          className="mx-auto mb-2 flex h-9 items-center justify-center rounded-full border border-ink/15 px-4 text-xs font-medium text-ink/70"
        >
          Charger plus
        </button>
      )}
      {!hasMore && !chargement && <FinDeListe />}
    </section>
  );
}
