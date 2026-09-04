"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { formatPrice } from "@/lib/format";
import { usePanier } from "@/lib/local/panier";
import { useKitEnfants } from "@/lib/local/kit-enfants";
import { getSacsDisponibles } from "@/lib/supabase/queries";
import type { KitItemAvecProduit } from "@/lib/supabase/queries";
import type { Produit } from "@/lib/supabase/types";

type ItemState = { checked: boolean; quantite: number };

type KitBuilderProps = {
  kitNom: string;
  items: KitItemAvecProduit[];
  // Sac par défaut proposé (décoché) : null si le catalogue n'a pas encore
  // de sac rangé dans "Sacs à dos" / "Sacs à roulettes" (KIT_AMELIORATIONS.md §3).
  sacParDefaut: Produit | null;
};

const TAILLE_SELECTION_SACS = 5;

export function KitBuilder({ kitNom, items, sacParDefaut }: KitBuilderProps) {
  const { ajouter } = usePanier();
  const { enregistrer: enregistrerEnfant } = useKitEnfants();
  const [prenomEnfant, setPrenomEnfant] = useState("");
  const [added, setAdded] = useState(false);
  const [etats, setEtats] = useState<Record<number, ItemState>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        { checked: item.produit.statut !== "epuise", quantite: item.quantite_defaut },
      ]),
    ),
  );

  // Le sac ne fait jamais partie de la liste pré-cochée : trop d'élèves
  // réutilisent le leur (KIT_AMELIORATIONS.md §3).
  const [sacChoisi, setSacChoisi] = useState<Produit | null>(sacParDefaut);
  const [sacCoche, setSacCoche] = useState(false);

  const [sheetOuvert, setSheetOuvert] = useState(false);
  const [autresSacs, setAutresSacs] = useState<Produit[]>([]);
  const [hasMoreSacs, setHasMoreSacs] = useState(false);
  const [chargementSacs, setChargementSacs] = useState(false);

  const { nbArticles, total } = useMemo(() => {
    const base = items.reduce(
      (acc, item) => {
        const etat = etats[item.id];
        if (!etat?.checked) return acc;
        return {
          nbArticles: acc.nbArticles + etat.quantite,
          total: acc.total + etat.quantite * item.produit.prix,
        };
      },
      { nbArticles: 0, total: 0 },
    );
    if (sacCoche && sacChoisi) {
      return { nbArticles: base.nbArticles + 1, total: base.total + sacChoisi.prix };
    }
    return base;
  }, [items, etats, sacCoche, sacChoisi]);

  const toggle = (id: number) =>
    setEtats((current) => ({
      ...current,
      [id]: { ...current[id], checked: !current[id].checked },
    }));

  const setQuantite = (id: number, quantite: number) =>
    setEtats((current) => ({
      ...current,
      [id]: { ...current[id], quantite: Math.max(1, quantite) },
    }));

  const chargerSacs = async (offset: number, remplacer: boolean) => {
    setChargementSacs(true);
    const excludeIds = sacChoisi ? [sacChoisi.id] : [];
    const { items: page, hasMore } = await getSacsDisponibles({
      offset,
      limit: TAILLE_SELECTION_SACS,
      excludeIds,
    });
    setAutresSacs((current) => (remplacer ? page : [...current, ...page]));
    setHasMoreSacs(hasMore);
    setChargementSacs(false);
  };

  const ouvrirSelectionSacs = () => {
    setSheetOuvert(true);
    void chargerSacs(0, true);
  };

  const choisirSac = (produit: Produit) => {
    setSacChoisi(produit);
    setSacCoche(true);
    setSheetOuvert(false);
  };

  const handleAjouter = () => {
    items.forEach((item) => {
      const etat = etats[item.id];
      if (etat?.checked) ajouter(item.produit.id, null, etat.quantite);
    });
    if (sacCoche && sacChoisi) ajouter(sacChoisi.id, null, 1);
    enregistrerEnfant(`Kit ${kitNom}`, prenomEnfant);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="flex flex-col">
      <label htmlFor="prenom-enfant" className="mx-4 mb-3 flex flex-col gap-1">
        <span className="text-xs font-medium text-ink/60">
          Prénom de l&apos;élève <span className="text-ink/40">(facultatif)</span>
        </span>
        <input
          id="prenom-enfant"
          type="text"
          value={prenomEnfant}
          onChange={(event) => setPrenomEnfant(event.target.value)}
          placeholder="Ex. : Awa"
          autoComplete="off"
          maxLength={60}
          className="w-full rounded-lg border border-ink/15 bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:max-w-xs"
        />
        <span className="text-xs text-ink/45">
          Il sera inscrit sur l&apos;ebook offert avec ce kit.
        </span>
      </label>

      <ul className="flex flex-col divide-y divide-ink/10 px-4">
        {items.map((item) => {
          const etat = etats[item.id];
          const epuise = item.produit.statut === "epuise";
          return (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <input
                type="checkbox"
                checked={etat?.checked ?? false}
                disabled={epuise}
                onChange={() => toggle(item.id)}
                aria-label={`Inclure ${item.produit.nom}`}
                className="size-5 shrink-0 accent-brand"
              />

              <div className="relative size-12 shrink-0 overflow-hidden rounded-xl">
                <ProductImage
                  src={item.produit.photo}
                  alt={item.produit.nom}
                  className="h-full w-full"
                  sizes="48px"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-ink">{item.produit.nom}</span>
                <span className="text-xs text-ink/50">{formatPrice(item.produit.prix)}</span>
                {epuise && (
                  <span className="text-[11px] text-ink/40">Épuisé — non inclus</span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2 rounded-full border border-ink/15 px-1.5 py-1">
                <button
                  type="button"
                  aria-label="Diminuer la quantité"
                  disabled={!etat?.checked}
                  onClick={() => setQuantite(item.id, (etat?.quantite ?? 1) - 1)}
                  className="flex size-6 items-center justify-center rounded-full text-ink/70 disabled:opacity-30"
                >
                  <Minus size={13} aria-hidden="true" />
                </button>
                <span className="w-4 text-center text-sm">{etat?.quantite ?? 0}</span>
                <button
                  type="button"
                  aria-label="Augmenter la quantité"
                  disabled={!etat?.checked}
                  onClick={() => setQuantite(item.id, (etat?.quantite ?? 1) + 1)}
                  className="flex size-6 items-center justify-center rounded-full text-ink/70 disabled:opacity-30"
                >
                  <Plus size={13} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {sacChoisi && (
        <div className="mx-4 mt-2 flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={sacCoche}
              onChange={() => setSacCoche((v) => !v)}
              aria-label={`Ajouter le sac ${sacChoisi.nom}`}
              className="size-5 shrink-0 accent-brand"
            />
            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl">
              <ProductImage
                src={sacChoisi.photo}
                alt={sacChoisi.nom}
                className="h-full w-full"
                sizes="48px"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-ink">{sacChoisi.nom}</span>
              <span className="text-xs text-ink/50">{formatPrice(sacChoisi.prix)}</span>
            </div>
          </div>
          <p className="text-xs text-ink/45">
            Beaucoup d&apos;élèves réutilisent leur sac : cochez pour l&apos;ajouter.
          </p>
          <button
            type="button"
            onClick={ouvrirSelectionSacs}
            className="self-start text-xs font-medium text-brand"
          >
            Voir d&apos;autres sacs
          </button>
        </div>
      )}

      <div className="sticky bottom-16 z-30 mt-4 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:bottom-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-ink/50">
              {nbArticles} article{nbArticles > 1 ? "s" : ""} sélectionné{nbArticles > 1 ? "s" : ""}
            </span>
            <span className="text-sm font-semibold text-ink">{formatPrice(total)}</span>
          </div>
          <button
            type="button"
            disabled={nbArticles === 0}
            onClick={handleAjouter}
            className="flex h-11 items-center justify-center rounded-full bg-action px-5 text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
          >
            {added ? "Ajouté ✓" : `Ajouter le kit ${kitNom}`}
          </button>
        </div>
      </div>

      {sheetOuvert &&
        // Portail vers document.body : la page kit anime son conteneur racine
        // (animate-fade-in-up), qui garde un transform résiduel une fois
        // l'animation finie (fill-mode both) et devient donc le "containing
        // block" de tout descendant position:fixed. Sans portail, ce panneau
        // hériterait du scroll de la page au lieu de couvrir le vrai viewport.
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-surface">
          <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
            <button
              type="button"
              onClick={() => setSheetOuvert(false)}
              className="flex items-center gap-1.5 text-sm font-medium text-ink/70"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Retour à mon kit
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            <h2 className="mb-3 font-heading text-base font-semibold text-ink">
              Choisir un sac
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {autresSacs.map((produit) => {
                const epuise = produit.statut === "epuise";
                return (
                  <button
                    key={produit.id}
                    type="button"
                    disabled={epuise}
                    onClick={() => choisirSac(produit)}
                    className={`flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-elevated text-left transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="relative aspect-square w-full">
                      <ProductImage src={produit.photo} alt={produit.nom} className="h-full w-full" />
                      {epuise && (
                        <div className="absolute inset-0 flex items-center justify-center bg-elevated/70">
                          <span className="rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-on-brand">
                            Épuisé
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 p-2">
                      <span className="line-clamp-1 text-sm text-ink">{produit.nom}</span>
                      <span className="text-xs font-semibold text-ink/70">
                        {formatPrice(produit.prix)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {autresSacs.length === 0 && !chargementSacs && (
              <p className="py-8 text-center text-sm text-ink/50">
                Aucun autre sac disponible pour le moment.
              </p>
            )}

            {hasMoreSacs && (
              <button
                type="button"
                onClick={() => chargerSacs(autresSacs.length, false)}
                disabled={chargementSacs}
                className="mt-4 w-full rounded-full border border-ink/15 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                {chargementSacs ? "Chargement…" : "Voir plus de sacs"}
              </button>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
            <button
              type="button"
              onClick={() => setSheetOuvert(false)}
              className="mx-auto flex h-11 w-full max-w-6xl items-center justify-center rounded-full border border-ink/15 text-sm font-semibold text-ink/70"
            >
              Retour à mon kit
            </button>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
