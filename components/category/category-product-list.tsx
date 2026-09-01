"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductGrid } from "@/components/product/product-grid";
import { ChampSelect } from "@/components/ui/champ-select";
import { getProduitsByCategorie, TAILLE_PAGE_CATALOGUE } from "@/lib/supabase/queries";
import type { Produit, SousCategorie } from "@/lib/supabase/types";

type Tri = "defaut" | "prix-asc" | "prix-desc";

type CategoryProductListProps = {
  categorieId: number;
  produitsInitiaux: Produit[];
  hasMoreInitial: boolean;
  sousCategories: SousCategorie[];
};

export function CategoryProductList({
  categorieId,
  produitsInitiaux,
  hasMoreInitial,
  sousCategories,
}: CategoryProductListProps) {
  const searchParams = useSearchParams();

  const [produits, setProduits] = useState(produitsInitiaux);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [chargement, setChargement] = useState(false);
  // Sous-catégorie active : initialisée depuis l'URL (?sc=) pour les liens directs.
  const [scSlug, setScSlug] = useState<string | null>(() => searchParams.get("sc"));
  const [tri, setTri] = useState<Tri>("defaut");

  const idParSlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const sc of sousCategories) map.set(sc.slug, sc.id);
    return map;
  }, [sousCategories]);

  const chargerPage = useCallback(
    async (slug: string | null, offset: number, remplacer: boolean) => {
      setChargement(true);
      const { items, hasMore: encoreApres } = await getProduitsByCategorie(categorieId, {
        offset,
        limit: TAILLE_PAGE_CATALOGUE,
        sousCategorieId: slug ? idParSlug.get(slug) ?? null : null,
      });
      setProduits((current) => (remplacer ? items : [...current, ...items]));
      setHasMore(encoreApres);
      setChargement(false);
    },
    [categorieId, idParSlug],
  );

  const choisirSousCat = useCallback(
    (slug: string | null) => {
      setScSlug(slug);

      const url = new URL(window.location.href);
      if (slug) url.searchParams.set("sc", slug);
      else url.searchParams.delete("sc");
      window.history.replaceState(null, "", url);

      if (!slug) {
        setProduits(produitsInitiaux);
        setHasMore(hasMoreInitial);
        return;
      }
      void chargerPage(slug, 0, true);
    },
    [chargerPage, produitsInitiaux, hasMoreInitial],
  );

  // Arrivée directe sur une URL ?sc=... : charger les produits filtrés une fois
  // au montage (les produitsInitiaux venus du serveur ne sont pas filtrés).
  const initialise = useRef(false);
  useEffect(() => {
    if (initialise.current || !scSlug || !idParSlug.has(scSlug)) return;
    initialise.current = true;
    let actif = true;
    getProduitsByCategorie(categorieId, {
      limit: TAILLE_PAGE_CATALOGUE,
      sousCategorieId: idParSlug.get(scSlug),
    }).then(({ items, hasMore: encoreApres }) => {
      if (!actif) return;
      setProduits(items);
      setHasMore(encoreApres);
    });
    return () => {
      actif = false;
    };
  }, [scSlug, idParSlug, categorieId]);

  const resultats = useMemo(() => {
    if (tri === "prix-asc") return [...produits].sort((a, b) => a.prix - b.prix);
    if (tri === "prix-desc") return [...produits].sort((a, b) => b.prix - a.prix);
    return produits;
  }, [produits, tri]);

  return (
    <div className="flex flex-col gap-4">
      {sousCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => choisirSousCat(null)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              scSlug === null ? "border-brand bg-brand text-on-brand" : "border-ink/15 text-ink/70"
            }`}
          >
            Tout
          </button>
          {sousCategories.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => choisirSousCat(sc.slug)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                scSlug === sc.slug
                  ? "border-brand bg-brand text-on-brand"
                  : "border-ink/15 text-ink/70"
              }`}
            >
              {sc.nom}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-4">
        <span className="text-xs text-ink/50">
          {resultats.length} article{resultats.length > 1 ? "s" : ""}
          {hasMore ? "+" : ""}
        </span>
        <ChampSelect
          ariaLabel="Trier les produits"
          placeholder="Trier"
          align="end"
          wrapperClassName="w-44 shrink-0"
          className="rounded-full border border-ink/15 bg-elevated px-3 py-1.5 text-xs"
          value={tri === "defaut" ? "" : tri}
          onChange={(v) => setTri(v === "" ? "defaut" : (v as Tri))}
          options={[
            { value: "prix-asc", label: "Prix croissant" },
            { value: "prix-desc", label: "Prix décroissant" },
          ]}
        />
      </div>

      <ProductGrid
        produits={resultats}
        emptyMessage="Aucun article dans cette sous-catégorie pour le moment."
      />

      {hasMore && (
        <button
          type="button"
          onClick={() => chargerPage(scSlug, produits.length, false)}
          disabled={chargement}
          className="mx-4 rounded-full border border-ink/15 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {chargement ? "Chargement…" : "Charger plus"}
        </button>
      )}
    </div>
  );
}
