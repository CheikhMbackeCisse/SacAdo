"use client";

import { useEffect, useState } from "react";
import { useFavoris } from "@/lib/local/favoris";
import { getProduitsByIds } from "@/lib/supabase/queries";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { FinDeListe } from "@/components/product/fin-de-liste";
import { useChargementAuto } from "@/lib/hooks/use-chargement-auto";
import { useRestaurerDefilement } from "@/lib/hooks/use-restaurer-defilement";
import type { Produit } from "@/lib/supabase/types";

// Chargement continu (maj-accueil §6) : la liste complète est déjà en
// mémoire (favoris = quelques dizaines de produits max), on en révèle
// progressivement des tranches au lieu de tout afficher d'un coup.
const TRANCHE = 20;

export default function FavorisPage() {
  const { favoris } = useFavoris();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [taille, setTaille] = useState(TRANCHE);

  useEffect(() => {
    let active = true;
    getProduitsByIds(favoris)
      .then((data) => {
        if (active) setProduits(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [favoris]);

  const hasMore = taille < produits.length;
  const sentinelleRef = useChargementAuto(hasMore, () => setTaille((t) => t + TRANCHE));

  // Retour arrière depuis une fiche produit (CORRECTIONS_V11 lot 2) : la
  // liste complète est déjà en mémoire, restaurer ne fait que remonter
  // `taille` puis la position de défilement.
  useRestaurerDefilement(
    "favoris",
    taille,
    async (compte) => setTaille(compte),
    !loading,
  );

  return (
    <div className="animate-fade-in-up py-4">
      <h1 className="px-4 pb-3 font-heading text-lg font-bold text-ink">Mes favoris</h1>
      {loading ? (
        <ProductGridSkeleton />
      ) : (
        <>
          <ProductGrid
            produits={produits.slice(0, taille)}
            emptyMessage="Aucun favori pour l'instant. Touche le cœur d'un produit pour l'ajouter ici."
          />
          {hasMore ? (
            <div ref={sentinelleRef} aria-hidden="true" />
          ) : (
            produits.length > 0 && <FinDeListe />
          )}
        </>
      )}
    </div>
  );
}
