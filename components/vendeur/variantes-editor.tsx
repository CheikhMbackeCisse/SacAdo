"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { ChampSelect } from "@/components/ui/champ-select";
import { proposerMonAttribut, type LigneVarianteInput } from "@/lib/vendeur/variantes-actions";
import type { Attribut, VarianteAvecAttributs } from "@/lib/supabase/types";

const VALEUR_MAX = 120;
const COMBINAISONS_MAX = 100;

type AttributChoisi = { attributId: number; valeurs: string[] };
type Override = { actif: boolean; stock: string; prix: string };

export type EtatVariantes = {
  attributs: AttributChoisi[];
  // Réglages par combinaison, indexés par signature (voir `cle()`).
  overrides: Record<string, Override>;
};

export const ETAT_VARIANTES_VIDE: EtatVariantes = { attributs: [], overrides: {} };

// Signature stable d'une combinaison — DOIT rester alignée avec `signature()`
// côté serveur (lib/vendeur/variantes-actions.ts).
function cle(paires: { attributId: number; valeur: string }[]): string {
  return paires
    .map((p) => ({ id: p.attributId, v: p.valeur.trim().toLowerCase().slice(0, VALEUR_MAX) }))
    .sort((a, b) => a.id - b.id || a.v.localeCompare(b.v))
    .map((p) => `${p.id}:${p.v}`)
    .join("|");
}

type Combinaison = {
  cle: string;
  paires: { attributId: number; valeur: string }[];
  actif: boolean;
  stock: string;
  prix: string;
};

// Produit cartésien des valeurs saisies → liste ordonnée de combinaisons.
function genererCombinaisons(etat: EtatVariantes): Combinaison[] {
  const axes = etat.attributs
    .map((a) => ({
      attributId: a.attributId,
      valeurs: [...new Set(a.valeurs.map((v) => v.trim()).filter(Boolean))],
    }))
    .filter((a) => a.attributId > 0 && a.valeurs.length > 0);
  if (axes.length === 0) return [];

  let combos: { attributId: number; valeur: string }[][] = [[]];
  for (const axe of axes) {
    const suivant: { attributId: number; valeur: string }[][] = [];
    for (const combo of combos) {
      for (const valeur of axe.valeurs) {
        suivant.push([...combo, { attributId: axe.attributId, valeur }]);
      }
    }
    combos = suivant;
    if (combos.length > COMBINAISONS_MAX) break;
  }

  return combos.slice(0, COMBINAISONS_MAX).map((paires) => {
    const k = cle(paires);
    const o = etat.overrides[k];
    return {
      cle: k,
      paires,
      actif: o?.actif ?? true,
      stock: o?.stock ?? "0",
      prix: o?.prix ?? "",
    };
  });
}

// État initial à partir des variantes déjà en base (mode édition).
export function etatDepuisVariantes(variantes: VarianteAvecAttributs[]): EtatVariantes {
  const valeursParAttribut = new Map<number, string[]>();
  const overrides: Record<string, Override> = {};

  for (const v of variantes) {
    const paires = v.attributs.map((a) => ({ attributId: a.attribut_id, valeur: a.valeur }));
    for (const p of paires) {
      const liste = valeursParAttribut.get(p.attributId) ?? [];
      if (!liste.some((x) => x.toLowerCase() === p.valeur.toLowerCase())) liste.push(p.valeur);
      valeursParAttribut.set(p.attributId, liste);
    }
    overrides[cle(paires)] = {
      actif: true,
      stock: String(v.stock),
      prix: v.prix != null ? String(v.prix) : "",
    };
  }

  return {
    attributs: [...valeursParAttribut].map(([attributId, valeurs]) => ({ attributId, valeurs })),
    overrides,
  };
}

// État → lignes à envoyer au serveur (combinaisons actives uniquement).
export function etatVersLignes(etat: EtatVariantes): LigneVarianteInput[] {
  return genererCombinaisons(etat)
    .filter((c) => c.actif)
    .map((c) => ({
      attributs: c.paires,
      stock: Number(c.stock) || 0,
      prix: c.prix.trim() ? Number(c.prix) : null,
    }));
}

export function etatVariantesValide(etat: EtatVariantes): string | null {
  const combos = genererCombinaisons(etat).filter((c) => c.actif);
  const axesIncomplets = etat.attributs.some(
    (a) => a.attributId > 0 && a.valeurs.filter((v) => v.trim()).length === 0,
  );
  if (axesIncomplets) return "Chaque attribut ajouté doit avoir au moins une valeur.";
  if (etat.attributs.length > 0 && combos.length === 0 && genererCombinaisons(etat).length > 0) {
    return "Coche au moins une combinaison, ou retire la section Variantes.";
  }
  for (const c of combos) {
    if (!c.stock.trim() || Number(c.stock) < 0 || !Number.isFinite(Number(c.stock))) {
      return "Renseigne un stock valide pour chaque variante cochée.";
    }
    if (c.prix.trim() && (Number(c.prix) < 0 || !Number.isFinite(Number(c.prix)))) {
      return "Le prix d'une variante est invalide.";
    }
  }
  return null;
}

const CHAMP =
  "min-h-10 rounded-lg border border-[#001314]/15 px-2.5 text-sm text-[#001314] focus:border-[#0B3D91] focus:outline-none";

export function VariantesEditor({
  attributsDispo,
  prixProduit,
  value,
  onChange,
}: {
  attributsDispo: Attribut[];
  prixProduit: string;
  value: EtatVariantes;
  onChange: (etat: EtatVariantes) => void;
}) {
  const [nouvelAttribut, setNouvelAttribut] = useState("");
  const [saisieValeur, setSaisieValeur] = useState<Record<number, string>>({});
  const [info, setInfo] = useState<string | null>(null);

  const combinaisons = useMemo(() => genererCombinaisons(value), [value]);
  const nomAttribut = (id: number) => attributsDispo.find((a) => a.id === id)?.nom ?? "—";

  const attributsRestants = attributsDispo.filter(
    (a) => !value.attributs.some((c) => c.attributId === a.id),
  );

  const patch = (etat: Partial<EtatVariantes>) => onChange({ ...value, ...etat });

  const ajouterAttribut = () =>
    patch({ attributs: [...value.attributs, { attributId: 0, valeurs: [] }] });

  const changerAttribut = (index: number, attributId: number) =>
    patch({
      attributs: value.attributs.map((a, i) => (i === index ? { ...a, attributId } : a)),
    });

  const retirerAttribut = (index: number) =>
    patch({ attributs: value.attributs.filter((_, i) => i !== index) });

  const ajouterValeur = (index: number, brut: string) => {
    const valeur = brut.trim().slice(0, VALEUR_MAX);
    if (!valeur) return;
    patch({
      attributs: value.attributs.map((a, i) => {
        if (i !== index) return a;
        if (a.valeurs.some((v) => v.toLowerCase() === valeur.toLowerCase())) return a;
        return { ...a, valeurs: [...a.valeurs, valeur] };
      }),
    });
  };

  const retirerValeur = (index: number, valeur: string) =>
    patch({
      attributs: value.attributs.map((a, i) =>
        i === index ? { ...a, valeurs: a.valeurs.filter((v) => v !== valeur) } : a,
      ),
    });

  const majOverride = (k: string, champ: keyof Override, v: string | boolean) => {
    const actuel = value.overrides[k] ?? { actif: true, stock: "0", prix: "" };
    patch({ overrides: { ...value.overrides, [k]: { ...actuel, [champ]: v } } });
  };

  const proposer = async () => {
    const nom = nouvelAttribut.trim();
    if (!nom) return;
    setInfo(null);
    const res = await proposerMonAttribut(nom);
    if (!res.ok) {
      setInfo(res.error);
      return;
    }
    setNouvelAttribut("");
    setInfo(
      res.dejaExistant
        ? `« ${nom} » existe déjà — choisis-le dans la liste (rafraîchis la page si besoin).`
        : `« ${nom} » a été proposé à SacAdo. Il sera utilisable une fois validé.`,
    );
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[#001314]/10 bg-[#001314]/[0.015] p-4">
      <div>
        <h2 className="text-sm font-semibold text-[#001314]">Variantes (facultatif)</h2>
        <p className="text-xs text-[#001314]/50">
          Décline ce produit par couleur, taille… Choisis les attributs, saisis leurs valeurs,
          puis renseigne le stock de chaque combinaison.
        </p>
      </div>

      {/* Attributs + valeurs */}
      <div className="flex flex-col gap-3">
        {value.attributs.map((choisi, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-xl border border-[#001314]/10 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <ChampSelect
                ariaLabel="Attribut"
                placeholder="Choisir un attribut…"
                className={`${CHAMP} w-full`}
                wrapperClassName="flex-1"
                value={choisi.attributId === 0 ? "" : String(choisi.attributId)}
                onChange={(v) => changerAttribut(index, v === "" ? 0 : Number(v))}
                options={attributsDispo
                  .filter(
                    (a) =>
                      a.id === choisi.attributId ||
                      !value.attributs.some((c) => c.attributId === a.id),
                  )
                  .map((a) => ({ value: String(a.id), label: a.nom }))}
              />
              <button
                type="button"
                onClick={() => retirerAttribut(index)}
                aria-label="Retirer cet attribut"
                className="shrink-0 rounded-lg p-1.5 text-[#001314]/40 hover:bg-red-50 hover:text-red-600"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {choisi.attributId > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {choisi.valeurs.map((valeur) => (
                  <span
                    key={valeur}
                    className="flex items-center gap-1 rounded-full bg-[#0B3D91]/10 px-2 py-1 text-xs font-medium text-[#0B3D91]"
                  >
                    {valeur}
                    <button
                      type="button"
                      onClick={() => retirerValeur(index, valeur)}
                      aria-label={`Retirer ${valeur}`}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  value={saisieValeur[index] ?? ""}
                  onChange={(e) => setSaisieValeur((s) => ({ ...s, [index]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      ajouterValeur(index, saisieValeur[index] ?? "");
                      setSaisieValeur((s) => ({ ...s, [index]: "" }));
                    }
                  }}
                  onBlur={() => {
                    if ((saisieValeur[index] ?? "").trim()) {
                      ajouterValeur(index, saisieValeur[index] ?? "");
                      setSaisieValeur((s) => ({ ...s, [index]: "" }));
                    }
                  }}
                  placeholder="Valeur + Entrée (ex. Bleu)"
                  className={`${CHAMP} min-w-32 flex-1`}
                />
              </div>
            )}
          </div>
        ))}

        {attributsRestants.length > 0 && (
          <button
            type="button"
            onClick={ajouterAttribut}
            className="flex w-fit items-center gap-1 rounded-full border border-[#001314]/15 px-3 py-1.5 text-xs font-medium text-[#001314]/70 hover:bg-[#001314]/[0.04]"
          >
            <Plus size={13} aria-hidden="true" /> Ajouter un attribut
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nouvelAttribut}
            onChange={(e) => setNouvelAttribut(e.target.value)}
            placeholder="Attribut manquant ? (ex. Contenance)"
            className={`${CHAMP} min-w-40 flex-1`}
          />
          <button
            type="button"
            onClick={proposer}
            disabled={!nouvelAttribut.trim()}
            className="rounded-full border border-[#0B3D91]/40 px-3 py-1.5 text-xs font-medium text-[#0B3D91] hover:bg-[#0B3D91]/5 disabled:opacity-40"
          >
            Proposer à SacAdo
          </button>
        </div>
        {info && <p className="text-xs text-[#0B3D91]">{info}</p>}
      </div>

      {/* Combinaisons générées */}
      {combinaisons.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[#001314]/10 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#001314]/60">
              {combinaisons.length} combinaison{combinaisons.length > 1 ? "s" : ""}
            </span>
            <span className="text-[11px] text-[#001314]/40">Prix vide = prix du produit</span>
          </div>
          <ul className="flex flex-col gap-2">
            {combinaisons.map((combo) => (
              <li
                key={combo.cle}
                className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 text-sm ${
                  combo.actif ? "border-[#001314]/10 bg-white" : "border-[#001314]/10 bg-[#001314]/[0.03] opacity-60"
                }`}
              >
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={combo.actif}
                    onChange={(e) => majOverride(combo.cle, "actif", e.target.checked)}
                    className="size-4 accent-[#0B3D91]"
                  />
                  <span className="text-[#001314]">
                    {combo.paires
                      .map((p) => `${nomAttribut(p.attributId)} : ${p.valeur}`)
                      .join(" · ")}
                  </span>
                </label>
                <label className="flex items-center gap-1 text-xs text-[#001314]/55">
                  Stock
                  <input
                    type="number"
                    min={0}
                    value={combo.stock}
                    disabled={!combo.actif}
                    onChange={(e) => majOverride(combo.cle, "stock", e.target.value)}
                    className={`${CHAMP} w-20 disabled:opacity-40`}
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-[#001314]/55">
                  Prix
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={combo.prix}
                    disabled={!combo.actif}
                    placeholder={prixProduit || "—"}
                    onChange={(e) => majOverride(combo.cle, "prix", e.target.value)}
                    className={`no-spinner ${CHAMP} w-24 disabled:opacity-40`}
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
