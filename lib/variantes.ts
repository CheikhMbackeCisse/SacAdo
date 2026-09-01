import type { VarianteAttributValeur } from "@/lib/supabase/types";

// Réponse Supabase brute d'une variante avec sa jointure sur variante_attributs.
type LigneJointe = {
  variante_attributs?:
    | { attribut_id: number; valeur: string; attributs: { nom: string } | { nom: string }[] | null }[]
    | null;
};

// Aplati la jointure `variante_attributs(attributs(nom))` en `attributs[]`.
export function aplatirAttributs(
  ligne: LigneJointe,
): VarianteAttributValeur[] {
  return (ligne.variante_attributs ?? [])
    .map((va) => {
      const attribut = Array.isArray(va.attributs) ? va.attributs[0] : va.attributs;
      return {
        attribut_id: va.attribut_id,
        nom: attribut?.nom ?? "",
        valeur: va.valeur,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

// « Bleu · M » — libellé court d'une variante pour le panier, la recherche, etc.
export function libelleVariante(variante: {
  attributs: VarianteAttributValeur[];
}): string {
  return variante.attributs.map((a) => a.valeur).join(" · ");
}

// « Couleur : Bleu · Taille : M » — libellé détaillé (fiche produit, admin).
export function libelleVarianteDetaille(variante: {
  attributs: VarianteAttributValeur[];
}): string {
  return variante.attributs.map((a) => `${a.nom} : ${a.valeur}`).join(" · ");
}
