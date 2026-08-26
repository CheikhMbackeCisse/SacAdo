"use client";

import { useEffect, useState } from "react";
import { useConsultes } from "@/lib/local/consultes";
import { getProduitsByIds } from "@/lib/supabase/queries";
import { ProductGrid } from "@/components/product/product-grid";
import type { Produit } from "@/lib/supabase/types";

export default function ConsultesPage() {
  const { consultes } = useConsultes();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProduitsByIds(consultes.map((c) => c.id))
      .then((data) => {
        if (!active) return;
        const ordre = consultes.map((c) => c.id);
        const tries = [...data].sort((a, b) => ordre.indexOf(a.id) - ordre.indexOf(b.id));
        setProduits(tries);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [consultes]);

  return (
    <div className="animate-fade-in-up py-4">
      <h1 className="px-4 pb-3 font-heading text-lg font-bold text-ink">Déjà consultés</h1>
      {loading ? (
        <p className="px-4 text-sm text-ink/50">Chargement…</p>
      ) : (
        <ProductGrid produits={produits} emptyMessage="Aucun produit consulté pour l'instant." />
      )}
    </div>
  );
}
