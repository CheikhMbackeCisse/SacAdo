"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ajouterKitItem,
  modifierKitItemQuantite,
  retirerKitItem,
  type KitItemAvecProduit,
} from "@/lib/admin/kits-actions";
import { formatPrice } from "@/lib/format";
import { ChampSelect } from "@/components/ui/champ-select";
import type { Produit } from "@/lib/supabase/types";

export function KitItemsManager({
  kitId,
  items,
  produits,
}: {
  kitId: number;
  items: KitItemAvecProduit[];
  produits: Produit[];
}) {
  const router = useRouter();
  // Aucun produit pré-sélectionné : choix explicite (sinon on ajoute le premier
  // produit de la liste sans le vouloir).
  const [produitId, setProduitId] = useState<number | "">("");
  const [quantite, setQuantite] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const dejaPresents = new Set(items.map((item) => item.produit_id));
  const produitsDisponibles = produits.filter((p) => !dejaPresents.has(p.id));

  const ajouter = async () => {
    setError(null);
    if (!produitId) {
      setError("Veuillez choisir un article à ajouter.");
      return;
    }
    const result = await ajouterKitItem(kitId, Number(produitId), Number(quantite));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProduitId("");
    setQuantite("1");
    router.refresh();
  };

  const changerQuantite = async (id: number, valeur: number) => {
    await modifierKitItemQuantite(id, Math.max(1, valeur));
    router.refresh();
  };

  const retirer = async (id: number) => {
    const result = await retirerKitItem(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5">
      {items.length === 0 ? (
        <p className="text-sm text-ink/50">Aucun article dans ce kit pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink/10">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="flex flex-col">
                <span className="text-ink">{item.produit_nom}</span>
                <span className="text-xs text-ink/40">{formatPrice(item.produit_prix)}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  defaultValue={item.quantite_defaut}
                  onBlur={(event) => changerQuantite(item.id, Number(event.target.value))}
                  className="w-16 rounded-lg border border-ink/15 min-h-10 px-3 text-sm"
                />
                <button type="button" onClick={() => retirer(item.id)} className="text-red-600 hover:underline">
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {produitsDisponibles.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-ink/10 pt-3 sm:flex-row sm:items-end sm:gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs">
            <span className="text-ink/60">Ajouter un article</span>
            <ChampSelect
              ariaLabel="Article à ajouter au kit"
              placeholder="Choisir un article…"
              className="min-h-11 rounded-lg border border-ink/15 px-3 text-sm"
              value={produitId === "" ? "" : String(produitId)}
              onChange={(v) => setProduitId(v === "" ? "" : Number(v))}
              options={produitsDisponibles.map((p) => ({ value: String(p.id), label: p.nom }))}
            />
          </label>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ink/60">Qté</span>
              <input
                type="number"
                min={1}
                value={quantite}
                onChange={(event) => setQuantite(event.target.value)}
                className="min-h-11 w-16 rounded-lg border border-ink/15 px-3 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={ajouter}
              className="min-h-11 flex-1 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 sm:flex-none"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
