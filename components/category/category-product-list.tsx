"use client";

import { useMemo, useState } from "react";
import { ProductGrid } from "@/components/product/product-grid";
import { getProduitsByCategorie, TAILLE_PAGE_CATALOGUE } from "@/lib/supabase/queries";
import type { SousCategorie } from "@/lib/categories";
import type { Produit } from "@/lib/supabase/types";

type Tri = "defaut" | "prix-asc" | "prix-desc";

type CategoryProductListProps = {
  categorieDb: string;
  produitsInitiaux: Produit[];
  hasMoreInitial: boolean;
  sousCategories: SousCategorie[];
};

export function CategoryProductList({
  categorieDb,
  produitsInitiaux,
  hasMoreInitial,
  sousCategories,
}: CategoryProductListProps) {
  const [produits, setProduits] = useState(produitsInitiaux);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [chargement, setChargement] = useState(false);
  const [sousCategorie, setSousCategorie] = useState<SousCategorie | null>(null);
  const [tri, setTri] = useState<Tri>("defaut");

  const chargerPlus = async () => {
    setChargement(true);
    const { items, hasMore: encoreApres } = await getProduitsByCategorie(categorieDb, {
      offset: produits.length,
      limit: TAILLE_PAGE_CATALOGUE,
    });
    setProduits((current) => [...current, ...items]);
    setHasMore(encoreApres);
    setChargement(false);
  };

  const resultats = useMemo(() => {
    let liste = produits;

    if (sousCategorie) {
      liste = liste.filter((p) => {
        const nom = p.nom.toLowerCase();
        return sousCategorie.keywords.some((mot) => nom.includes(mot));
      });
    }

    if (tri === "prix-asc") liste = [...liste].sort((a, b) => a.prix - b.prix);
    if (tri === "prix-desc") liste = [...liste].sort((a, b) => b.prix - a.prix);

    return liste;
  }, [produits, sousCategorie, tri]);

  return (
    <div className="flex flex-col gap-4">
      {sousCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setSousCategorie(null)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              sousCategorie === null
                ? "border-brand bg-brand text-on-brand"
                : "border-ink/15 text-ink/70"
            }`}
          >
            Tout
          </button>
          {sousCategories.map((sc) => (
            <button
              key={sc.label}
              type="button"
              onClick={() => setSousCategorie(sc)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                sousCategorie?.label === sc.label
                  ? "border-brand bg-brand text-on-brand"
                  : "border-ink/15 text-ink/70"
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-4">
        <span className="text-xs text-ink/50">
          {resultats.length} article{resultats.length > 1 ? "s" : ""}
        </span>
        <select
          value={tri}
          onChange={(event) => setTri(event.target.value as Tri)}
          aria-label="Trier les produits"
          className="rounded-full border border-ink/15 bg-elevated px-3 py-1.5 text-xs text-ink"
        >
          <option value="defaut">Trier</option>
          <option value="prix-asc">Prix croissant</option>
          <option value="prix-desc">Prix décroissant</option>
        </select>
      </div>

      <ProductGrid produits={resultats} />

      {hasMore && !sousCategorie && (
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
