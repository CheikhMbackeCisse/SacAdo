"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductGrid } from "@/components/product/product-grid";
import { ChampSelect } from "@/components/ui/champ-select";
import { getProduitsByCategorie, TAILLE_PAGE_CATALOGUE } from "@/lib/supabase/queries";
import type { Produit, SousCategorie, SousSousCategorie } from "@/lib/supabase/types";

type Tri = "defaut" | "prix-asc" | "prix-desc";

type CategoryProductListProps = {
  categorieId: number;
  produitsInitiaux: Produit[];
  hasMoreInitial: boolean;
  sousCategories: SousCategorie[];
  // 3e niveau, optionnel : peut être vide même si sousCategories ne l'est pas.
  sousSousCategories: SousSousCategorie[];
};

export function CategoryProductList({
  categorieId,
  produitsInitiaux,
  hasMoreInitial,
  sousCategories,
  sousSousCategories,
}: CategoryProductListProps) {
  const searchParams = useSearchParams();

  const [produits, setProduits] = useState(produitsInitiaux);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [chargement, setChargement] = useState(false);
  // Sous-catégorie / sous-sous-catégorie actives : initialisées depuis l'URL
  // (?sc=, ?ssc=) pour les liens directs (suggestions de recherche incluses).
  const [scSlug, setScSlug] = useState<string | null>(() => searchParams.get("sc"));
  const [sscSlug, setSscSlug] = useState<string | null>(() => searchParams.get("ssc"));
  const [tri, setTri] = useState<Tri>("defaut");

  const idParSlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const sc of sousCategories) map.set(sc.slug, sc.id);
    return map;
  }, [sousCategories]);

  const sousCategorieActiveId = scSlug ? (idParSlug.get(scSlug) ?? null) : null;

  // Sous-sous-catégories de la sous-catégorie active uniquement (un slug de 3e
  // niveau n'est unique que dans sa propre sous-catégorie).
  const sscDeLaSousCat = useMemo(
    () =>
      sousCategorieActiveId == null
        ? []
        : sousSousCategories
            .filter((ssc) => ssc.sous_categorie_id === sousCategorieActiveId)
            .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)),
    [sousSousCategories, sousCategorieActiveId],
  );
  const chargerPage = useCallback(
    async (
      slug: string | null,
      sscSlugCourant: string | null,
      offset: number,
      remplacer: boolean,
    ) => {
      setChargement(true);
      const sousCategorieId = slug ? (idParSlug.get(slug) ?? null) : null;
      const sscMap = new Map<string, number>();
      for (const ssc of sousSousCategories) {
        if (ssc.sous_categorie_id === sousCategorieId) sscMap.set(ssc.slug, ssc.id);
      }
      const { items, hasMore: encoreApres } = await getProduitsByCategorie(categorieId, {
        offset,
        limit: TAILLE_PAGE_CATALOGUE,
        sousCategorieId,
        sousSousCategorieId: sscSlugCourant ? (sscMap.get(sscSlugCourant) ?? null) : null,
      });
      setProduits((current) => (remplacer ? items : [...current, ...items]));
      setHasMore(encoreApres);
      setChargement(false);
    },
    [categorieId, idParSlug, sousSousCategories],
  );

  const majUrl = (sc: string | null, ssc: string | null) => {
    const url = new URL(window.location.href);
    if (sc) url.searchParams.set("sc", sc);
    else url.searchParams.delete("sc");
    if (ssc) url.searchParams.set("ssc", ssc);
    else url.searchParams.delete("ssc");
    window.history.replaceState(null, "", url);
  };

  const choisirSousCat = useCallback(
    (slug: string | null) => {
      setScSlug(slug);
      setSscSlug(null);
      majUrl(slug, null);

      if (!slug) {
        setProduits(produitsInitiaux);
        setHasMore(hasMoreInitial);
        return;
      }
      void chargerPage(slug, null, 0, true);
    },
    [chargerPage, produitsInitiaux, hasMoreInitial],
  );

  const choisirSousSousCat = useCallback(
    (slug: string | null) => {
      setSscSlug(slug);
      majUrl(scSlug, slug);
      void chargerPage(scSlug, slug, 0, true);
    },
    [chargerPage, scSlug],
  );

  // Arrivée directe sur une URL ?sc=...(&ssc=...) : charger les produits
  // filtrés une fois au montage (les produitsInitiaux venus du serveur ne sont
  // pas filtrés).
  const initialise = useRef(false);
  useEffect(() => {
    if (initialise.current || !scSlug || !idParSlug.has(scSlug)) return;
    initialise.current = true;
    let actif = true;
    const sousCategorieId = idParSlug.get(scSlug)!;
    const sscMap = new Map<string, number>();
    for (const ssc of sousSousCategories) {
      if (ssc.sous_categorie_id === sousCategorieId) sscMap.set(ssc.slug, ssc.id);
    }
    getProduitsByCategorie(categorieId, {
      limit: TAILLE_PAGE_CATALOGUE,
      sousCategorieId,
      sousSousCategorieId: sscSlug ? (sscMap.get(sscSlug) ?? null) : null,
    }).then(({ items, hasMore: encoreApres }) => {
      if (!actif) return;
      setProduits(items);
      setHasMore(encoreApres);
    });
    return () => {
      actif = false;
    };
  }, [scSlug, sscSlug, idParSlug, categorieId, sousSousCategories]);

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

      {/* 3e niveau : rangée sous la précédente, seulement si la sous-catégorie
          active en propose (SOUS_SOUS_CATEGORIES.md §1, jamais imposé). */}
      {sscDeLaSousCat.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => choisirSousSousCat(null)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              sscSlug === null
                ? "border-brand bg-brand/10 text-brand"
                : "border-ink/10 text-ink/55"
            }`}
          >
            Tout
          </button>
          {sscDeLaSousCat.map((ssc) => (
            <button
              key={ssc.id}
              type="button"
              onClick={() => choisirSousSousCat(ssc.slug)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                sscSlug === ssc.slug
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-ink/10 text-ink/55"
              }`}
            >
              {ssc.nom}
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
        emptyMessage="Aucun article dans ce rayon pour le moment."
      />

      {hasMore && (
        <button
          type="button"
          onClick={() => chargerPage(scSlug, sscSlug, produits.length, false)}
          disabled={chargement}
          className="mx-4 rounded-full border border-ink/15 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {chargement ? "Chargement…" : "Charger plus"}
        </button>
      )}
    </div>
  );
}
