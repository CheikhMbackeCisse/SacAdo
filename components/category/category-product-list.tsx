"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductGrid } from "@/components/product/product-grid";
import { ChampSelect } from "@/components/ui/champ-select";
import { getProduitsByCategorie, TAILLE_PAGE_CATALOGUE } from "@/lib/supabase/queries";
import { mesurer } from "@/lib/mesure-client";
import type { Produit, SousCategorie, SousSousCategorie } from "@/lib/supabase/types";

type CategoryProductListProps = {
  categorieId: number;
  categorieSlug: string;
  produitsInitiaux: Produit[];
  hasMoreInitial: boolean;
  sousCategories: SousCategorie[];
  // 3e niveau, optionnel : peut être vide même si sousCategories ne l'est pas.
  sousSousCategories: SousSousCategorie[];
};

// Niveaux lycée : le filtre Série ne s'affiche que pour ceux-là (TACHE_livres_korka §1.5).
const NIVEAUX_LYCEE = new Set(["2nde", "1ere", "Terminale"]);

function capitaliser(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Un select compact par facette (Niveau/Série/Matière/Type) plutôt qu'une
// rangée de puces : même composant que "Trier" ailleurs dans l'app, prend
// beaucoup moins de place verticale (retour testeur).
function FiltreSelect({
  label,
  valeurs,
  actif,
  onChoisir,
}: {
  label: string;
  valeurs: string[];
  actif: string | null;
  onChoisir: (v: string | null) => void;
}) {
  if (valeurs.length === 0) return null;
  return (
    <ChampSelect
      ariaLabel={label}
      placeholder={label}
      wrapperClassName="w-[150px] shrink-0"
      className="rounded-full border border-ink/15 bg-elevated px-3 py-1.5 text-xs"
      // value="" tant qu'aucune option n'est choisie -> le placeholder (nom du
      // filtre) reste affiché. "tout" est une valeur sentinelle qui réinitialise
      // sans jamais matcher une option, pour que le bouton revienne au nom du
      // filtre plutôt que d'afficher "Tout" sur les 4 selects à la fois.
      value={actif ?? ""}
      onChange={(v) => onChoisir(v === "tout" ? null : v)}
      options={[
        { value: "tout", label: "Tout" },
        ...valeurs.map((v) => ({ value: v, label: capitaliser(v) })),
      ]}
    />
  );
}

export function CategoryProductList({
  categorieId,
  categorieSlug,
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
  // Filtres livres (§1.5) : Niveau, Série (si lycée), Matière, Type d'ouvrage.
  const estLivres = categorieSlug === "livres-manuels";
  const [niveauFiltre, setNiveauFiltre] = useState<string | null>(null);
  const [serieFiltre, setSerieFiltre] = useState<string | null>(null);
  const [matiereFiltre, setMatiereFiltre] = useState<string | null>(null);
  const [typeFiltre, setTypeFiltre] = useState<string | null>(null);

  // Signal de classement « vue de catégorie » (poids 0.5), une fois par
  // catégorie affichée.
  useEffect(() => {
    mesurer({ type: "vue_categorie", categorieId });
  }, [categorieId]);

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
      // Choix d'un rayon : signal d'intérêt sur la sous-catégorie (base de
      // l'affinité personnelle).
      const scId = idParSlug.get(slug);
      if (scId) mesurer({ type: "vue_categorie", categorieId, sousCategorieId: scId });
      void chargerPage(slug, null, 0, true);
    },
    [chargerPage, produitsInitiaux, hasMoreInitial, idParSlug, categorieId],
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

  // Facettes livres, calculées sur le lot chargé (une sous-catégorie livres
  // ne dépasse jamais TAILLE_PAGE_CATALOGUE, donc pas de pagination serveur
  // à prévoir pour ces filtres).
  const facettesLivres = useMemo(() => {
    if (!estLivres) return null;
    const valeurs = (champ: "niveau" | "serie" | "matiere" | "type_ouvrage") => {
      const s = new Set<string>();
      for (const p of produits) {
        const v = p[champ];
        if (v) s.add(v);
      }
      return [...s].sort((a, b) => a.localeCompare(b, "fr"));
    };
    return {
      niveaux: valeurs("niveau"),
      series: valeurs("serie"),
      matieres: valeurs("matiere"),
      types: valeurs("type_ouvrage"),
    };
  }, [estLivres, produits]);

  const serieVisible = niveauFiltre !== null && NIVEAUX_LYCEE.has(niveauFiltre);

  const resultats = useMemo(() => {
    if (!estLivres) return produits;
    return produits.filter((p) => {
      // Une édition ancienne ne s'affiche jamais dans les listes quand son
      // édition en vigueur existe (§3.5.1).
      if (p.edition_statut === "ancienne" && p.ouvrage_id !== null) return false;
      if (niveauFiltre && p.niveau !== niveauFiltre) return false;
      if (serieVisible && serieFiltre && p.serie !== serieFiltre) return false;
      if (matiereFiltre && p.matiere !== matiereFiltre) return false;
      if (typeFiltre && p.type_ouvrage !== typeFiltre) return false;
      return true;
    });
  }, [produits, estLivres, niveauFiltre, serieFiltre, serieVisible, matiereFiltre, typeFiltre]);

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

      {/* Filtres livres (§1.5) : Niveau, Série (si lycée), Matière, Type
          d'ouvrage — des selects compacts plutôt que des rangées de puces
          (retour testeur : trop de place verticale). */}
      {estLivres && facettesLivres && (
        <div className="flex flex-wrap gap-2 px-4">
          <FiltreSelect
            label="Niveau"
            valeurs={facettesLivres.niveaux}
            actif={niveauFiltre}
            onChoisir={(v) => {
              setNiveauFiltre(v);
              setSerieFiltre(null);
            }}
          />
          {serieVisible && (
            <FiltreSelect
              label="Série"
              valeurs={facettesLivres.series}
              actif={serieFiltre}
              onChoisir={setSerieFiltre}
            />
          )}
          <FiltreSelect
            label="Matière"
            valeurs={facettesLivres.matieres}
            actif={matiereFiltre}
            onChoisir={setMatiereFiltre}
          />
          <FiltreSelect
            label="Type"
            valeurs={facettesLivres.types}
            actif={typeFiltre}
            onChoisir={setTypeFiltre}
          />
        </div>
      )}

      <div className="px-4">
        <span className="text-xs text-ink/50">
          {resultats.length} article{resultats.length > 1 ? "s" : ""}
          {hasMore ? "+" : ""}
        </span>
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
