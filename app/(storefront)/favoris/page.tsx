"use client";

import { useEffect, useState } from "react";
import { useFavoris } from "@/lib/local/favoris";
import { getProduitsByIds } from "@/lib/supabase/queries";
import { ProductGrid } from "@/components/product/product-grid";
import type { Produit } from "@/lib/supabase/types";

export default function FavorisPage() {
  const { favoris } = useFavoris();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="animate-fade-in-up py-4">
      <h1 className="px-4 pb-3 font-heading text-lg font-bold text-ink">Mes favoris</h1>
      {loading ? (
        <p className="px-4 text-sm text-ink/50">Chargement…</p>
      ) : (
        <ProductGrid
          produits={produits}
          emptyMessage="Aucun favori pour l'instant. Touche le cœur d'un produit pour l'ajouter ici."
        />
      )}
    </div>
  );
}
