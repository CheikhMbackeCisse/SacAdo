"use client";

import { ChampSelect } from "@/components/ui/champ-select";

export type TriPrix = "Prix croissant" | "Prix décroissant";

// Tri par prix (retour testeur) : partagé entre les pages catégorie
// (CategoryProductList) et la recherche (ResultatsRecherche) — même
// comportement partout. "Tout" = ordre par défaut de l'écran.
export function TriPrixSelect({
  actif,
  onChoisir,
}: {
  actif: TriPrix | null;
  onChoisir: (v: TriPrix | null) => void;
}) {
  return (
    <ChampSelect
      ariaLabel="Trier"
      placeholder="Trier"
      wrapperClassName="w-[150px] shrink-0"
      className="rounded-full border border-ink/15 bg-elevated px-3 py-1.5 text-xs"
      value={actif ?? ""}
      onChange={(v) => onChoisir(v === "tout" ? null : (v as TriPrix))}
      options={[
        { value: "tout", label: "Tout" },
        { value: "Prix croissant", label: "Prix croissant" },
        { value: "Prix décroissant", label: "Prix décroissant" },
      ]}
    />
  );
}
