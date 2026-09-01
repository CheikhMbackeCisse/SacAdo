"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  creerVariante,
  getVariantesAdmin,
  modifierVariante,
  supprimerVariante,
  type VarianteInput,
} from "@/lib/admin/produits-actions";
import { creerAttribut, getAttributsValides } from "@/lib/admin/attributs-actions";
import { libelleVarianteDetaille } from "@/lib/variantes";
import type { Attribut, VarianteAvecAttributs } from "@/lib/supabase/types";

type LigneAttribut = { attributId: number; valeur: string };

export function VariantesManager({ produitId }: { produitId: number }) {
  const [variantes, setVariantes] = useState<VarianteAvecAttributs[]>([]);
  const [attributs, setAttributs] = useState<Attribut[]>([]);
  const [loading, setLoading] = useState(true);

  const [lignes, setLignes] = useState<LigneAttribut[]>([{ attributId: 0, valeur: "" }]);
  const [prix, setPrix] = useState("");
  const [stock, setStock] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const [nouvelAttribut, setNouvelAttribut] = useState("");

  const recharger = () => {
    Promise.all([getVariantesAdmin(produitId), getAttributsValides()])
      .then(([v, a]) => {
        setVariantes(v);
        setAttributs(a);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitId]);

  const ajouterLigne = () => setLignes((l) => [...l, { attributId: 0, valeur: "" }]);
  const retirerLigne = (index: number) =>
    setLignes((l) => (l.length === 1 ? l : l.filter((_, i) => i !== index)));
  const majLigne = (index: number, patch: Partial<LigneAttribut>) =>
    setLignes((l) => l.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const proposerAttribut = async () => {
    const nom = nouvelAttribut.trim();
    if (!nom) return;
    setError(null);
    const result = await creerAttribut(nom);
    if (!result.ok || !result.id) {
      setError(result.ok ? "Création impossible." : result.error);
      return;
    }
    const ajoute: Attribut = {
      id: result.id,
      nom,
      statut: "valide",
      propose_par: null,
      created_at: "",
    };
    setAttributs((a) => [...a, ajoute].sort((x, y) => x.nom.localeCompare(y.nom)));
    setNouvelAttribut("");
  };

  const ajouterVariante = async () => {
    setError(null);
    const input: VarianteInput = {
      prix: prix.trim() ? Number(prix) : null,
      stock: Number(stock),
      photo: null,
      attributs: lignes.map((l) => ({ attributId: l.attributId, valeur: l.valeur })),
    };
    const result = await creerVariante(produitId, input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLignes([{ attributId: 0, valeur: "" }]);
    setPrix("");
    setStock("0");
    recharger();
  };

  const changerStock = async (variante: VarianteAvecAttributs, nouveauStock: number) => {
    await modifierVariante(variante.id, {
      prix: variante.prix,
      stock: Math.max(0, nouveauStock),
      photo: variante.photo,
      attributs: variante.attributs.map((a) => ({ attributId: a.attribut_id, valeur: a.valeur })),
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

  const champ =
    "rounded-lg border border-ink/15 px-2 py-1.5 text-sm focus:border-brand focus:outline-none";

  return (
    <section className="flex max-w-xl flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">Variantes</h2>

      {loading ? (
        <p className="text-sm text-ink/50">Chargement…</p>
      ) : variantes.length === 0 ? (
        <p className="text-sm text-ink/50">
          Aucune variante — ce produit utilise le stock du produit.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink/10">
          {variantes.map((variante) => (
            <li key={variante.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink">{libelleVarianteDetaille(variante) || "—"}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={variante.stock}
                  onBlur={(event) => changerStock(variante, Number(event.target.value))}
                  className="w-20 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                />
                <span
                  className={`text-xs ${variante.statut === "epuise" ? "text-red-600" : "text-ink/40"}`}
                >
                  {variante.statut}
                </span>
                <button
                  type="button"
                  onClick={() => supprimer(variante.id)}
                  className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Retirer la variante"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-ink/10 pt-3">
        <span className="text-xs font-medium text-ink/60">Nouvelle variante</span>

        {lignes.map((ligne, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              value={ligne.attributId}
              onChange={(event) => majLigne(index, { attributId: Number(event.target.value) })}
              className={champ}
            >
              <option value={0} disabled>
                Choisir un attribut…
              </option>
              {attributs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
            <input
              value={ligne.valeur}
              onChange={(event) => majLigne(index, { valeur: event.target.value })}
              placeholder="Valeur (ex. Bleu)"
              className={`${champ} flex-1`}
            />
            <button
              type="button"
              onClick={() => retirerLigne(index)}
              className="rounded-lg p-1.5 text-ink/40 hover:text-red-600 disabled:opacity-30"
              disabled={lignes.length === 1}
              aria-label="Retirer l'attribut"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={ajouterLigne}
          className="flex w-fit items-center gap-1 rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 hover:bg-ink/[0.04]"
        >
          <Plus size={13} aria-hidden="true" /> Ajouter un attribut
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nouvelAttribut}
            onChange={(event) => setNouvelAttribut(event.target.value)}
            placeholder="Nouvel attribut (ex. Contenance)"
            className={`${champ} flex-1`}
          />
          <button
            type="button"
            onClick={proposerAttribut}
            disabled={!nouvelAttribut.trim()}
            className="rounded-full border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/5 disabled:opacity-40"
          >
            Créer l&apos;attribut
          </button>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink/60">Prix (facultatif)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={prix}
              onChange={(event) => setPrix(event.target.value)}
              className={`no-spinner w-28 ${champ}`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink/60">Stock</span>
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              className={`w-20 ${champ}`}
            />
          </label>
          <button
            type="button"
            onClick={ajouterVariante}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-surface active:scale-95"
          >
            Ajouter
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
