"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  creerMaVariante,
  getAttributsUtilisables,
  getMesVariantes,
  modifierMaVariante,
  proposerMonAttribut,
  supprimerMaVariante,
  type VarianteVendeurInput,
} from "@/lib/vendeur/variantes-actions";
import { libelleVarianteDetaille } from "@/lib/variantes";
import { ChampSelect } from "@/components/ui/champ-select";
import type { Attribut, VarianteAvecAttributs } from "@/lib/supabase/types";

type LigneAttribut = { attributId: number; valeur: string };

const CHAMP =
  "rounded-lg border border-[#001314]/15 px-2 py-1.5 text-sm text-[#001314] focus:border-[#0B3D91] focus:outline-none";

export function VendeurVariantesManager({ produitId }: { produitId: number }) {
  const [variantes, setVariantes] = useState<VarianteAvecAttributs[]>([]);
  const [attributs, setAttributs] = useState<Attribut[]>([]);
  const [loading, setLoading] = useState(true);

  const [lignes, setLignes] = useState<LigneAttribut[]>([{ attributId: 0, valeur: "" }]);
  const [prix, setPrix] = useState("");
  const [stock, setStock] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [nouvelAttribut, setNouvelAttribut] = useState("");

  const recharger = () => {
    Promise.all([getMesVariantes(produitId), getAttributsUtilisables()])
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

  const proposer = async () => {
    const nom = nouvelAttribut.trim();
    if (!nom) return;
    setError(null);
    setInfo(null);
    const result = await proposerMonAttribut(nom);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNouvelAttribut("");
    if (result.dejaExistant) {
      setInfo(`« ${nom} » existe déjà — choisis-le dans la liste (rafraîchis si besoin).`);
      recharger();
    } else {
      setInfo(`« ${nom} » a été proposé à SacAdo. Il sera utilisable une fois validé.`);
    }
  };

  const ajouterVariante = async () => {
    setError(null);
    setInfo(null);
    const input: VarianteVendeurInput = {
      prix: prix.trim() ? Number(prix) : null,
      stock: Number(stock),
      photo: null,
      attributs: lignes.map((l) => ({ attributId: l.attributId, valeur: l.valeur })),
    };
    const result = await creerMaVariante(produitId, input);
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
    await modifierMaVariante(variante.id, {
      prix: variante.prix,
      stock: Math.max(0, nouveauStock),
      photo: variante.photo,
      attributs: variante.attributs.map((a) => ({ attributId: a.attribut_id, valeur: a.valeur })),
    });
    recharger();
  };

  const supprimer = async (id: number) => {
    if (!window.confirm("Retirer cette variante ?")) return;
    const result = await supprimerMaVariante(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    recharger();
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#001314]/10 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-[#001314]">Variantes (couleur, taille…)</h2>
        <p className="text-xs text-[#001314]/50">
          Facultatif. Déclare des déclinaisons de ce produit avec leur stock.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#001314]/50">Chargement…</p>
      ) : variantes.length === 0 ? (
        <p className="text-sm text-[#001314]/50">Aucune variante — le produit utilise son stock global.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#001314]/10">
          {variantes.map((variante) => (
            <li
              key={variante.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="text-[#001314]">{libelleVarianteDetaille(variante) || "—"}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={variante.stock}
                  onBlur={(event) => changerStock(variante, Number(event.target.value))}
                  className="w-20 rounded-lg border border-[#001314]/15 px-2 py-1 text-sm"
                />
                <span
                  className={`text-xs ${
                    variante.statut === "epuise" ? "text-red-600" : "text-[#001314]/40"
                  }`}
                >
                  {variante.statut}
                </span>
                <button
                  type="button"
                  onClick={() => supprimer(variante.id)}
                  aria-label="Retirer la variante"
                  className="rounded-lg p-1.5 text-[#001314]/40 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-[#001314]/10 pt-3">
        <span className="text-xs font-medium text-[#001314]/60">Nouvelle variante</span>

        {lignes.map((ligne, index) => (
          <div key={index} className="flex items-center gap-2">
            <ChampSelect
              ariaLabel="Attribut"
              placeholder="Choisir un attribut…"
              className={CHAMP}
              wrapperClassName="w-40 shrink-0"
              value={ligne.attributId === 0 ? "" : String(ligne.attributId)}
              onChange={(v) => majLigne(index, { attributId: v === "" ? 0 : Number(v) })}
              options={attributs.map((a) => ({ value: String(a.id), label: a.nom }))}
            />
            <input
              value={ligne.valeur}
              onChange={(event) => majLigne(index, { valeur: event.target.value })}
              placeholder="Valeur (ex. Bleu)"
              className={`${CHAMP} flex-1`}
            />
            <button
              type="button"
              onClick={() => retirerLigne(index)}
              disabled={lignes.length === 1}
              aria-label="Retirer l'attribut"
              className="rounded-lg p-1.5 text-[#001314]/40 hover:text-red-600 disabled:opacity-30"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={ajouterLigne}
          className="flex w-fit items-center gap-1 rounded-full border border-[#001314]/15 px-3 py-1 text-xs font-medium text-[#001314]/70 hover:bg-[#001314]/[0.04]"
        >
          <Plus size={13} aria-hidden="true" /> Ajouter un attribut
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nouvelAttribut}
            onChange={(event) => setNouvelAttribut(event.target.value)}
            placeholder="Attribut manquant ? (ex. Contenance)"
            className={`${CHAMP} flex-1`}
          />
          <button
            type="button"
            onClick={proposer}
            disabled={!nouvelAttribut.trim()}
            className="rounded-full border border-[#0B3D91]/40 px-3 py-1.5 text-xs font-medium text-[#0B3D91] transition-colors hover:bg-[#0B3D91]/5 disabled:opacity-40"
          >
            Proposer à SacAdo
          </button>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[#001314]/60">Prix (facultatif)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={prix}
              onChange={(event) => setPrix(event.target.value)}
              className={`no-spinner w-28 ${CHAMP}`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[#001314]/60">Stock</span>
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              className={`w-20 ${CHAMP}`}
            />
          </label>
          <button
            type="button"
            onClick={ajouterVariante}
            className="rounded-full bg-[#0B3D91] px-4 py-1.5 text-sm font-semibold text-white active:scale-95"
          >
            Ajouter
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {info && <p className="text-xs text-[#0B3D91]">{info}</p>}
    </section>
  );
}
