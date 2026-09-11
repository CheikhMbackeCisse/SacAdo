"use client";

import { useState } from "react";
import { Ruler } from "lucide-react";

// Tableau standard vêtement de sport (tour de poitrine / longueur, en cm).
// Générique : à corriger si un fournisseur donne un jour ses vraies mesures
// (TACHE_ndayane_sport_et_variantes.md §2.4).
const MESURES_STANDARD: Record<string, { poitrine: string; longueur: string }> = {
  XS: { poitrine: "88-92", longueur: "66" },
  S: { poitrine: "92-96", longueur: "68" },
  M: { poitrine: "96-100", longueur: "70" },
  L: { poitrine: "100-104", longueur: "72" },
  XL: { poitrine: "104-108", longueur: "74" },
  "2XL": { poitrine: "108-114", longueur: "76" },
  "3XL": { poitrine: "114-120", longueur: "78" },
};

type Props = {
  // Tailles réellement proposées par ce produit (valeurs de l'attribut Taille),
  // pour n'afficher que les lignes utiles.
  tailles: string[];
};

export function GuideTailles({ tailles }: Props) {
  const [ouvert, setOuvert] = useState(false);

  const lignes = tailles
    .map((t) => t.toUpperCase())
    .filter((t) => t in MESURES_STANDARD);
  if (lignes.length === 0) return null;

  return (
    <div className="rounded-lg border border-ink/10">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-ink/70"
      >
        <Ruler size={14} aria-hidden="true" />
        Guide des tailles
        <span className="ml-auto text-ink/40">{ouvert ? "−" : "+"}</span>
      </button>
      {ouvert && (
        <div className="border-t border-ink/10 px-3 py-2.5">
          <p className="mb-2 text-[11px] text-ink/45">
            Correspondance standard, à titre indicatif.
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink/50">
                <th className="pb-1.5 font-medium">Taille</th>
                <th className="pb-1.5 font-medium">Tour de poitrine (cm)</th>
                <th className="pb-1.5 font-medium">Longueur (cm)</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((t) => (
                <tr key={t} className="border-t border-ink/5">
                  <td className="py-1.5 font-medium text-ink">{t}</td>
                  <td className="py-1.5 text-ink/70">{MESURES_STANDARD[t].poitrine}</td>
                  <td className="py-1.5 text-ink/70">{MESURES_STANDARD[t].longueur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
