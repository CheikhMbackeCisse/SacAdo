"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductGrid } from "@/components/product/product-grid";
import { ChampSelect } from "@/components/ui/champ-select";
import {
  getFacettesLivres,
  getFacettesOrdinateurs,
  getProduitsByCategorie,
  TAILLE_PAGE_CATEGORIE,
  type FacettesLivres,
  type FacettesOrdinateurs,
} from "@/lib/supabase/queries";
import { mesurer } from "@/lib/mesure-client";
import { useChargementAuto } from "@/lib/hooks/use-chargement-auto";
import { DemanderProduit } from "@/components/demande/demander-produit";
import type { Produit, SousCategorie, SousSousCategorie } from "@/lib/supabase/types";

type CategoryProductListProps = {
  categorieId: number;
  categorieSlug: string;
  produitsInitiaux: Produit[];
  hasMoreInitial: boolean;
  totalInitial: number;
  sousCategories: SousCategorie[];
  // 3e niveau, optionnel : peut être vide même si sousCategories ne l'est pas.
  sousSousCategories: SousSousCategorie[];
};

// Niveaux lycée : le filtre Série ne s'affiche que pour ceux-là (TACHE_livres_korka §1.5).
const NIVEAUX_LYCEE = new Set(["2nde", "1ere", "Terminale"]);

// Tranches de prix pour Ordinateurs portables (§3) : fixes plutôt que dérivées
// du lot chargé, pour rester stables d'une page à l'autre. `max` exclusif,
// `null` = dernière tranche, illimitée.
const TRANCHES_PRIX_ORDINATEURS: { label: string; min: number; max: number | null }[] = [
  { label: "Moins de 150 000", min: 0, max: 150000 },
  { label: "150 000 – 250 000", min: 150000, max: 250000 },
  { label: "250 000 – 400 000", min: 250000, max: 400000 },
  { label: "Plus de 400 000", min: 400000, max: null },
];

// Filtre prix générique (maj-26-09 §6 "remets le filtre de prix dans les
// pages de catégorie") : toutes les catégories sauf Ordinateurs, qui garde
// ses tranches dédiées (montants bien plus élevés).
const TRANCHES_PRIX_GENERIQUE: { label: string; min: number; max: number | null }[] = [
  { label: "Moins de 2 000", min: 0, max: 2000 },
  { label: "2 000 – 5 000", min: 2000, max: 5000 },
  { label: "5 000 – 15 000", min: 5000, max: 15000 },
  { label: "15 000 – 50 000", min: 15000, max: 50000 },
  { label: "Plus de 50 000", min: 50000, max: null },
];

// "S" est la série générique : S1/S2 en sont des sous-séries (retour
// testeur), donc choisir "S" doit aussi remonter les titres S1 et S2. Les
// filtres serveur ne connaissant qu'une égalité exacte, ce cas précis reste
// géré en repassant `undefined` au serveur et en filtrant ce sous-lot en JS.
function serieCorrespond(filtre: string, serie: string | null): boolean {
  if (!serie) return false;
  if (filtre === "S") return serie === "S" || serie === "S1" || serie === "S2";
  return serie === filtre;
}

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

type FiltresEtat = {
  niveau: string | null;
  serie: string | null;
  matiere: string | null;
  typeOuvrage: string | null;
  prix: string | null; // label de tranche (générique OU ordinateurs selon la catégorie)
  ram: string | null;
  stockage: string | null;
  ecran: string | null;
  tactile: string | null;
  marque: string | null;
  tri: string | null;
};

const FILTRES_VIDES: FiltresEtat = {
  niveau: null,
  serie: null,
  matiere: null,
  typeOuvrage: null,
  prix: null,
  ram: null,
  stockage: null,
  ecran: null,
  tactile: null,
  marque: null,
  tri: null,
};

export function CategoryProductList({
  categorieId,
  categorieSlug,
  produitsInitiaux,
  hasMoreInitial,
  totalInitial,
  sousCategories,
  sousSousCategories,
}: CategoryProductListProps) {
  const searchParams = useSearchParams();

  const [produits, setProduits] = useState(produitsInitiaux);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [total, setTotal] = useState(totalInitial);
  const [chargement, setChargement] = useState(false);
  // Sous-catégorie / sous-sous-catégorie actives : initialisées depuis l'URL
  // (?sc=, ?ssc=) pour les liens directs (suggestions de recherche incluses).
  const [scSlug, setScSlug] = useState<string | null>(() => searchParams.get("sc"));
  const [sscSlug, setSscSlug] = useState<string | null>(() => searchParams.get("ssc"));
  const [filtres, setFiltres] = useState<FiltresEtat>(FILTRES_VIDES);

  const estLivres = categorieSlug === "livres-manuels";
  const estOrdinateursPortables = categorieSlug === "ordinateurs" && scSlug === "ordinateurs-portables";
  const tranchesPrix = estOrdinateursPortables ? TRANCHES_PRIX_ORDINATEURS : TRANCHES_PRIX_GENERIQUE;

  // Facettes : valeurs calculées côté serveur sur TOUTE la catégorie, jamais
  // sur le seul lot chargé (maj-26-09 §6 — sinon les options elles-mêmes
  // "manquent" tant que la bonne page n'est pas atteinte).
  // Valeur brute conservée même hors "livres" (categorieId ne change pas de
  // sens entre deux rendus) : le "null si pas livres" est dérivé au rendu,
  // jamais pousuivi par un setState direct dans l'effet.
  const [facettesLivresBrutes, setFacettesLivresBrutes] = useState<FacettesLivres | null>(null);
  useEffect(() => {
    if (!estLivres) return;
    let actif = true;
    const charger = async () => {
      const f = await getFacettesLivres(categorieId);
      if (actif) setFacettesLivresBrutes(f);
    };
    void charger();
    return () => { actif = false; };
  }, [estLivres, categorieId]);
  const facettesLivres = estLivres ? facettesLivresBrutes : null;

  const idParSlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const sc of sousCategories) map.set(sc.slug, sc.id);
    return map;
  }, [sousCategories]);

  const [facettesOrdinateursBrutes, setFacettesOrdinateursBrutes] = useState<FacettesOrdinateurs | null>(null);
  useEffect(() => {
    if (!estOrdinateursPortables) return;
    const sousCategorieId = idParSlug.get("ordinateurs-portables");
    if (!sousCategorieId) return;
    let actif = true;
    const charger = async () => {
      const f = await getFacettesOrdinateurs(categorieId, sousCategorieId);
      if (actif) setFacettesOrdinateursBrutes(f);
    };
    void charger();
    return () => { actif = false; };
  }, [estOrdinateursPortables, categorieId, idParSlug]);
  const facettesOrdinateurs = estOrdinateursPortables ? facettesOrdinateursBrutes : null;

  // Signal de classement « vue de catégorie » (poids 0.5), une fois par
  // catégorie affichée.
  useEffect(() => {
    mesurer({ type: "vue_categorie", categorieId });
  }, [categorieId]);

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

  const serieVisible = filtres.niveau !== null && NIVEAUX_LYCEE.has(filtres.niveau);

  // Charge une page depuis le serveur avec l'intégralité des filtres actifs —
  // c'est la SEULE source de vérité pour ce qui s'affiche (plus de filtrage
  // client sur un lot partiel).
  const chargerAvec = useCallback(
    async (
      sc: string | null,
      ssc: string | null,
      f: FiltresEtat,
      offset: number,
      remplacer: boolean,
    ) => {
      setChargement(true);
      const sousCategorieId = sc ? (idParSlug.get(sc) ?? null) : null;
      const sscMap = new Map<string, number>();
      for (const s of sousSousCategories) {
        if (s.sous_categorie_id === sousCategorieId) sscMap.set(s.slug, s.id);
      }
      const tranche = f.prix ? tranchesPrix.find((t) => t.label === f.prix) : null;
      const ramGo = f.ram ? parseFloat(f.ram) : null;
      const stockageGo = f.stockage ? parseFloat(f.stockage) : null;
      const tailleEcran = f.ecran ? parseFloat(f.ecran) : null;

      const { items, hasMore: encoreApres, total: totalServeur } = await getProduitsByCategorie(categorieId, {
        offset,
        limit: TAILLE_PAGE_CATEGORIE,
        sousCategorieId,
        sousSousCategorieId: ssc ? (sscMap.get(ssc) ?? null) : null,
        niveau: f.niveau,
        // "S" générique : pas de filtre serveur, on complète en JS ci-dessous.
        serie: f.serie && f.serie !== "S" ? f.serie : null,
        matiere: f.matiere,
        typeOuvrage: f.typeOuvrage,
        prixMin: tranche?.min ?? null,
        prixMax: tranche?.max ?? null,
        ramGo,
        stockageGo,
        tailleEcran,
        ecranTactile: f.tactile ? f.tactile === "Oui" : null,
        marque: f.marque,
        ordre: estOrdinateursPortables ? (f.tri === "Prix croissant" ? "prix_asc" : "score_desc") : "nom",
      });
      const filtres_S = f.serie === "S" ? items.filter((p) => serieCorrespond("S", p.serie)) : items;
      setProduits((current) => (remplacer ? filtres_S : [...current, ...filtres_S]));
      setHasMore(encoreApres);
      if (totalServeur != null) setTotal(f.serie === "S" ? filtres_S.length : totalServeur);
      setChargement(false);
    },
    [categorieId, idParSlug, sousSousCategories, tranchesPrix, estOrdinateursPortables],
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
      setFiltres(FILTRES_VIDES);
      majUrl(slug, null);

      if (!slug) {
        setProduits(produitsInitiaux);
        setHasMore(hasMoreInitial);
        setTotal(totalInitial);
        return;
      }
      // Choix d'un rayon : signal d'intérêt sur la sous-catégorie (base de
      // l'affinité personnelle).
      const scId = idParSlug.get(slug);
      if (scId) mesurer({ type: "vue_categorie", categorieId, sousCategorieId: scId });
      void chargerAvec(slug, null, FILTRES_VIDES, 0, true);
    },
    [chargerAvec, produitsInitiaux, hasMoreInitial, totalInitial, idParSlug, categorieId],
  );

  const choisirSousSousCat = useCallback(
    (slug: string | null) => {
      setSscSlug(slug);
      majUrl(scSlug, slug);
      void chargerAvec(scSlug, slug, filtres, 0, true);
    },
    [chargerAvec, scSlug, filtres],
  );

  const majFiltre = useCallback(
    (patch: Partial<FiltresEtat>) => {
      const next = { ...filtres, ...patch };
      setFiltres(next);
      void chargerAvec(scSlug, sscSlug, next, 0, true);
    },
    [chargerAvec, scSlug, sscSlug, filtres],
  );

  // Arrivée directe sur une URL ?sc=...(&ssc=...) : charger les produits
  // filtrés une fois au montage (les produitsInitiaux venus du serveur ne sont
  // pas filtrés).
  const initialise = useRef(false);
  useEffect(() => {
    if (initialise.current || !scSlug || !idParSlug.has(scSlug)) return;
    initialise.current = true;
    void chargerAvec(scSlug, sscSlug, FILTRES_VIDES, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scSlug, sscSlug, idParSlug]);

  const sentinelleRef = useChargementAuto(hasMore && !chargement, () => {
    void chargerAvec(scSlug, sscSlug, filtres, produits.length, false);
  });

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
          d'ouvrage — des selects compacts plutôt qu'une rangée de puces
          (retour testeur : trop de place verticale). */}
      {estLivres && facettesLivres && (
        <div className="flex flex-wrap gap-2 px-4">
          <FiltreSelect
            label="Niveau"
            valeurs={facettesLivres.niveaux}
            actif={filtres.niveau}
            onChoisir={(v) => majFiltre({ niveau: v, serie: null })}
          />
          {serieVisible && (
            <FiltreSelect
              label="Série"
              valeurs={facettesLivres.series}
              actif={filtres.serie}
              onChoisir={(v) => majFiltre({ serie: v })}
            />
          )}
          <FiltreSelect
            label="Matière"
            valeurs={facettesLivres.matieres}
            actif={filtres.matiere}
            onChoisir={(v) => majFiltre({ matiere: v })}
          />
          <FiltreSelect
            label="Type"
            valeurs={facettesLivres.types}
            actif={filtres.typeOuvrage}
            onChoisir={(v) => majFiltre({ typeOuvrage: v })}
          />
          <FiltreSelect
            label="Prix"
            valeurs={tranchesPrix.map((t) => t.label)}
            actif={filtres.prix}
            onChoisir={(v) => majFiltre({ prix: v })}
          />
        </div>
      )}

      {/* Filtres Ordinateurs portables (§3) : Prix, RAM, Stockage, Taille
          d'écran, Écran tactile, Marque, dans cet ordre — le prix d'abord,
          premier critère pour un étudiant. */}
      {estOrdinateursPortables && facettesOrdinateurs && (
        <div className="flex flex-wrap gap-2 px-4">
          <FiltreSelect
            label="Trier"
            valeurs={["Pertinence", "Prix croissant"]}
            actif={filtres.tri}
            onChoisir={(v) => majFiltre({ tri: v })}
          />
          <FiltreSelect
            label="Prix"
            valeurs={tranchesPrix.map((t) => t.label)}
            actif={filtres.prix}
            onChoisir={(v) => majFiltre({ prix: v })}
          />
          <FiltreSelect
            label="RAM"
            valeurs={facettesOrdinateurs.rams}
            actif={filtres.ram}
            onChoisir={(v) => majFiltre({ ram: v })}
          />
          <FiltreSelect
            label="Stockage"
            valeurs={facettesOrdinateurs.stockages}
            actif={filtres.stockage}
            onChoisir={(v) => majFiltre({ stockage: v })}
          />
          <FiltreSelect
            label="Écran"
            valeurs={facettesOrdinateurs.ecrans}
            actif={filtres.ecran}
            onChoisir={(v) => majFiltre({ ecran: v })}
          />
          <FiltreSelect
            label="Tactile"
            valeurs={["Oui", "Non"]}
            actif={filtres.tactile}
            onChoisir={(v) => majFiltre({ tactile: v })}
          />
          <FiltreSelect
            label="Marque"
            valeurs={facettesOrdinateurs.marques}
            actif={filtres.marque}
            onChoisir={(v) => majFiltre({ marque: v })}
          />
        </div>
      )}

      {/* Filtre prix générique (§6) : les autres catégories, qui n'ont pas de
          facettes dédiées. */}
      {!estLivres && !estOrdinateursPortables && (
        <div className="flex flex-wrap gap-2 px-4">
          <FiltreSelect
            label="Prix"
            valeurs={tranchesPrix.map((t) => t.label)}
            actif={filtres.prix}
            onChoisir={(v) => majFiltre({ prix: v })}
          />
        </div>
      )}

      <div className="px-4">
        <span className="text-xs text-ink/50">
          {total} article{total > 1 ? "s" : ""}
        </span>
      </div>

      <ProductGrid
        produits={produits}
        emptyMessage="Aucun article dans ce rayon pour le moment."
      />

      {/* Fin de liste (maj-26-09 §8) : chargement automatique au scroll, plus
          de bouton "Charger plus". */}
      <div ref={sentinelleRef} aria-hidden="true" />
      {chargement && (
        <p className="pb-2 text-center text-xs text-ink/40">Chargement…</p>
      )}
      {!hasMore && !chargement && produits.length > 0 && (
        <DemanderProduit origine="fin_de_liste" variante="discret" />
      )}
    </div>
  );
}
