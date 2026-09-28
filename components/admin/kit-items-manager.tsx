"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import {
  ajouterKitItem,
  modifierKitItem,
  modifierKitItemQuantite,
  remplacerKitItemProduit,
  retirerKitItem,
  deplacerKitItem,
  type KitItemAvecProduit,
} from "@/lib/admin/kits-actions";
import { formatPrice } from "@/lib/format";
import { ChampSelect } from "@/components/ui/champ-select";
import type { Produit } from "@/lib/supabase/types";

const SECTIONS: { value: KitItemAvecProduit["section"]; label: string }[] = [
  { value: "principal", label: "Principal" },
  { value: "livres_proposes", label: "Livres proposés" },
  { value: "option", label: "Option" },
];

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
  const [remplacementOuvert, setRemplacementOuvert] = useState<number | null>(null);

  const dejaPresents = new Set(items.map((item) => item.produit_id));
  const produitsDisponibles = produits.filter((p) => !dejaPresents.has(p.id));
  const idsOrdonnes = items.map((i) => i.id);

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
    setError(null);
    const result = await modifierKitItemQuantite(id, Math.max(1, valeur));
    if (!result.ok) setError(result.error);
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

  const patcher = async (id: number, patch: Parameters<typeof modifierKitItem>[1]) => {
    setError(null);
    const result = await modifierKitItem(id, patch);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const remplacer = async (id: number, nouveauProduitId: number) => {
    setError(null);
    const result = await remplacerKitItemProduit(id, nouveauProduitId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRemplacementOuvert(null);
    router.refresh();
  };

  const deplacer = async (id: number, direction: -1 | 1) => {
    setError(null);
    const result = await deplacerKitItem(kitId, idsOrdonnes, id, direction);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  return (
    <div className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5">
      {items.length === 0 ? (
        <p className="text-sm text-ink/50">Aucun article dans ce kit pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink/10">
          {items.map((item, index) => (
            <li key={item.id} className="flex flex-col gap-2 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-ink">{item.produit_nom}</span>
                  <span className="text-xs text-ink/40">{formatPrice(item.produit_prix)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => deplacer(item.id, -1)}
                    disabled={index === 0}
                    className="rounded-full border border-ink/15 p-1 text-ink/60 disabled:opacity-30"
                    aria-label="Monter"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deplacer(item.id, 1)}
                    disabled={index === items.length - 1}
                    className="rounded-full border border-ink/15 p-1 text-ink/60 disabled:opacity-30"
                    aria-label="Descendre"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changerQuantite(item.id, item.quantite_defaut - 1)}
                    className="rounded-full border border-ink/15 p-1 text-ink/60"
                    aria-label="Diminuer la quantité"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-6 text-center">{item.quantite_defaut}</span>
                  <button
                    type="button"
                    onClick={() => changerQuantite(item.id, item.quantite_defaut + 1)}
                    className="rounded-full border border-ink/15 p-1 text-ink/60"
                    aria-label="Augmenter la quantité"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <ChampSelect
                  ariaLabel="Section"
                  placeholder="Section"
                  className="min-h-9 rounded-lg border border-ink/15 px-2 text-xs"
                  value={item.section}
                  onChange={(v) => patcher(item.id, { section: v as KitItemAvecProduit["section"] })}
                  options={SECTIONS}
                />

                <label className="flex items-center gap-1.5 text-xs text-ink/60">
                  <input
                    type="checkbox"
                    checked={item.coche_defaut}
                    onChange={(e) => patcher(item.id, { coche_defaut: e.target.checked })}
                    className="size-4 rounded border-ink/25"
                  />
                  Coché par défaut
                </label>

                <input
                  defaultValue={item.groupe_affichage ?? ""}
                  onBlur={(e) => patcher(item.id, { groupe_affichage: e.target.value.trim() || null })}
                  placeholder="Groupe"
                  className="min-h-9 w-28 rounded-lg border border-ink/15 px-2 text-xs"
                />
                <input
                  defaultValue={item.libelle_besoin ?? ""}
                  onBlur={(e) => patcher(item.id, { libelle_besoin: e.target.value.trim() || null })}
                  placeholder="Libellé (ex: 2 cahiers 100p)"
                  className="min-h-9 flex-1 min-w-[10rem] rounded-lg border border-ink/15 px-2 text-xs"
                />

                <button
                  type="button"
                  onClick={() => setRemplacementOuvert(remplacementOuvert === item.id ? null : item.id)}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Remplacer
                </button>
                <button type="button" onClick={() => retirer(item.id)} className="text-xs text-red-600 hover:underline">
                  Retirer
                </button>
              </div>

              {remplacementOuvert === item.id && (
                <ChampSelect
                  ariaLabel="Remplacer par"
                  placeholder="Choisir le nouveau produit…"
                  className="min-h-9 max-w-xs rounded-lg border border-ink/15 px-2 text-xs"
                  value=""
                  onChange={(v) => v && remplacer(item.id, Number(v))}
                  options={produitsDisponibles.map((p) => ({ value: String(p.id), label: p.nom }))}
                />
              )}
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
