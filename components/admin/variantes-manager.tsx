"use client";

import { useEffect, useState } from "react";
import {
  creerVariante,
  getVariantesAdmin,
  modifierVariante,
  supprimerVariante,
  type VarianteInput,
} from "@/lib/admin/produits-actions";
import type { ProduitVariante } from "@/lib/supabase/types";

export function VariantesManager({ produitId }: { produitId: number }) {
  const [variantes, setVariantes] = useState<ProduitVariante[]>([]);
  const [loading, setLoading] = useState(true);
  const [dimension, setDimension] = useState<"couleur" | "taille">("couleur");
  const [valeur, setValeur] = useState("");
  const [stock, setStock] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const recharger = () => {
    getVariantesAdmin(produitId)
      .then(setVariantes)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitId]);

  const ajouter = async () => {
    if (!valeur.trim()) return;
    setError(null);
    const input: VarianteInput = {
      couleur: dimension === "couleur" ? valeur.trim() : null,
      taille: dimension === "taille" ? valeur.trim() : null,
      prix: null,
      stock: Number(stock),
      photo: null,
    };
    const result = await creerVariante(produitId, input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setValeur("");
    setStock("0");
    recharger();
  };

  const changerStock = async (variante: ProduitVariante, nouveauStock: number) => {
    await modifierVariante(variante.id, {
      couleur: variante.couleur,
      taille: variante.taille,
      prix: variante.prix,
      stock: Math.max(0, nouveauStock),
      photo: variante.photo,
    });
    recharger();
  };

  const supprimer = async (id: number) => {
    if (!window.confirm("Retirer cette variante ?")) return;
    const result = await supprimerVariante(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    recharger();
  };

  return (
    <section className="flex max-w-xl flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">Variantes (couleur / taille)</h2>

      {loading ? (
        <p className="text-sm text-ink/50">Chargement…</p>
      ) : variantes.length === 0 ? (
        <p className="text-sm text-ink/50">Aucune variante — ce produit utilise le stock du produit.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink/10">
          {variantes.map((variante) => (
            <li key={variante.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink">{variante.couleur ?? variante.taille}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={variante.stock}
                  onBlur={(event) => changerStock(variante, Number(event.target.value))}
                  className="w-20 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                />
                <span className={`text-xs ${variante.statut === "epuise" ? "text-red-600" : "text-ink/40"}`}>
                  {variante.statut}
                </span>
                <button
                  type="button"
                  onClick={() => supprimer(variante.id)}
                  className="text-red-600 hover:underline"
                >
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2 border-t border-ink/10 pt-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Type</span>
          <select
            value={dimension}
            onChange={(event) => setDimension(event.target.value as "couleur" | "taille")}
            className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
          >
            <option value="couleur">Couleur</option>
            <option value="taille">Taille</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-ink/60">Valeur</span>
          <input
            value={valeur}
            onChange={(event) => setValeur(event.target.value)}
            placeholder={dimension === "couleur" ? "Bleu" : "M"}
            className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Stock</span>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            className="w-20 rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={ajouter}
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-surface active:scale-95"
        >
          Ajouter
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
