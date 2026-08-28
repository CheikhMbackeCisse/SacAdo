"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { formatPrice } from "@/lib/format";
import { usePanier } from "@/lib/local/panier";
import { useKitEnfants } from "@/lib/local/kit-enfants";
import type { KitItemAvecProduit } from "@/lib/supabase/queries";

type ItemState = { checked: boolean; quantite: number };

type KitBuilderProps = {
  kitNom: string;
  items: KitItemAvecProduit[];
};

export function KitBuilder({ kitNom, items }: KitBuilderProps) {
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

  const { nbArticles, total } = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          const etat = etats[item.id];
          if (!etat?.checked) return acc;
          return {
            nbArticles: acc.nbArticles + etat.quantite,
            total: acc.total + etat.quantite * item.produit.prix,
          };
        },
        { nbArticles: 0, total: 0 },
      ),
    [items, etats],
  );

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

  const handleAjouter = () => {
    items.forEach((item) => {
      const etat = etats[item.id];
      if (etat?.checked) ajouter(item.produit.id, null, etat.quantite);
    });
    enregistrerEnfant(`Kit ${kitNom}`, prenomEnfant);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="flex flex-col">
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

      <div className="sticky bottom-16 z-30 mt-4 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:bottom-0">
        <label
          htmlFor="prenom-enfant"
          className="mx-auto mb-2.5 flex max-w-6xl flex-col gap-1"
        >
          <span className="text-xs font-medium text-ink/60">
            Prénom de l&apos;enfant <span className="text-ink/40">(facultatif)</span>
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
    </div>
  );
}
